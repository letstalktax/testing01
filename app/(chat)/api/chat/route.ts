import {
  type Message,
  createDataStreamResponse,
  smoothStream,
  streamText,
} from 'ai';
import { auth } from '@/app/(auth)/auth';
import { systemPrompt } from '@/lib/ai/prompts';
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import {
  generateUUID,
  getMostRecentUserMessage,
  sanitizeResponseMessages,
} from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { isProductionEnvironment } from '@/lib/constants';
import { NextResponse } from 'next/server';
import { myProvider } from '@/lib/ai/providers';
import { queryEmbeddings } from '@/lib/rag/pinecone-client';
import { queryTemporaryEmbeddings } from '@/app/api/temp-documents/route';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const {
      id,
      messages,
      selectedChatModel,
    }: {
      id: string;
      messages: Array<Message>;
      selectedChatModel: string;
    } = await request.json();

    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Check if we have any messages
    if (!messages || messages.length === 0) {
      return new Response('No messages provided', { status: 400 });
    }

    // Get the most recent message (regardless of role)
    const lastMessage = messages[messages.length - 1];
    
    // First, ensure the chat exists in the database
    let chat = await getChatById({ id });
    
    if (!chat) {
      // Get the user's first message to generate a title
      const userMessage = getMostRecentUserMessage(messages);
      let title = "New Chat";
      
      if (userMessage) {
        try {
          title = await generateTitleFromUserMessage({ message: userMessage });
        } catch (error) {
          console.error('Error generating title:', error);
        }
      } else if (selectedChatModel === 'chat-model-report-iq') {
        title = "Document Analysis";
      }
      
      try {
        await saveChat({ id, userId: session.user.id, title });
        chat = await getChatById({ id });
      } catch (error) {
        console.error('Error creating chat:', error);
        return new Response('Error creating chat', { status: 500 });
      }
    } else {
      // Verify ownership
      if (chat.userId !== session.user.id) {
        return new Response('Unauthorized', { status: 401 });
      }
    }
    
    // Handle system messages differently
    if (lastMessage.role === 'system') {
      try {
        await saveMessages({
          messages: [{
            id: lastMessage.id,
            role: lastMessage.role,
            content: lastMessage.content,
            createdAt: new Date(),
            chatId: id
          }],
        });
        
        // For system messages, just return success without streaming
        return NextResponse.json({ success: true, message: 'System message saved' });
      } catch (saveError) {
        console.error('Error saving system message:', saveError);
        return new Response('Error saving message', { status: 500 });
      }
    }
    
    // For assistant messages without user input (like initial messages), just save them
    if (lastMessage.role === 'assistant' && messages.length === 1) {
      try {
        await saveMessages({
          messages: [{
            id: lastMessage.id,
            role: lastMessage.role,
            content: lastMessage.content,
            createdAt: new Date(),
            chatId: id
          }],
        });
        
        // For initial assistant messages, just return success without streaming
        return NextResponse.json({ success: true, message: 'Assistant message saved' });
      } catch (saveError) {
        console.error('Error saving assistant message:', saveError);
        return new Response('Error saving message', { status: 500 });
      }
    }
    
    // For user messages, continue with the normal flow
    const userMessage = getMostRecentUserMessage(messages);
    
    if (!userMessage) {
      return new Response('No user message found', { status: 400 });
    }

    const sanitizedUserMessage = {
      id: userMessage.id,
      role: userMessage.role,
      content: userMessage.content,
      createdAt: new Date(),
      chatId: id
    };

    try {
      await saveMessages({
        messages: [sanitizedUserMessage],
      });
    } catch (saveError) {
      console.error('Error saving message:', saveError);
      return new Response('Error saving message', { status: 500 });
    }
    
    // Generate embedding for the user query using OpenAI API directly
    console.log('Generating embedding for query:', userMessage.content);
    let queryEmbedding = null;
    let contextText = '';
    
    try {
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: userMessage.content,
          encoding_format: 'float'
        })
      });
      
      if (embeddingResponse.ok) {
        const embeddingData = await embeddingResponse.json();
        queryEmbedding = embeddingData.data[0].embedding;
        console.log('Successfully generated embedding');
      } else {
        const errorData = await embeddingResponse.text();
        console.error('Error generating embedding:', errorData);
      }
    } catch (error) {
      console.error('Exception generating embedding:', error);
    }
    
    // Query Pinecone for relevant context if we have an embedding
    let relevantContext: Array<{text: string, score?: number, namespace?: string}> = [];
    
    if (queryEmbedding) {
      console.log('Querying for relevant context...');
      try {
        // Create a session-specific namespace for temporary document embeddings
        const sessionNamespace = `session-${session.user.id}`;
        
        // First, try to get results from temporary embeddings
        const tempResults = await queryTemporaryEmbeddings(
          sessionNamespace,
          queryEmbedding,
          20 // Get top 20 most relevant chunks (increased from 8)
        );
        
        // Convert temporary results to the same format as Pinecone results
        const formattedTempResults = tempResults.map(result => ({
          text: result.text,
          score: result.score,
          namespace: sessionNamespace,
          metadata: result.metadata
        }));
        
        if (formattedTempResults.length > 0) {
          console.log(`Found ${formattedTempResults.length} matches in temporary embeddings`);
          relevantContext = formattedTempResults;
        } else {
          // If no temporary results, fall back to knowledge base in Pinecone
          console.log('No temporary embeddings found, querying knowledge base...');
          relevantContext = await queryEmbeddings(
            process.env.PINECONE_INDEX_NAME!,
            queryEmbedding,
            20, // Get top 20 most relevant chunks (increased from 8)
            ['(Default)'] // Only query the default namespace
          );
        }
        
        // Log the results for debugging
        console.log('Context query results:', {
          matchesFound: relevantContext.length,
          topMatchScore: relevantContext[0]?.score,
          contextPreview: relevantContext.length > 0 
            ? `${relevantContext[0].text.substring(0, 100)}...` 
            : 'undefined...',
          namespaceBreakdown: relevantContext.reduce((acc, curr) => {
            acc[curr.namespace || 'unknown'] = (acc[curr.namespace || 'unknown'] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        });
      } catch (error) {
        console.error('Error in RAG system:', error);
        // We'll continue with empty context if there's an error
        // The fallback system in queryEmbeddings should have provided some context
      }
    }

    // Prepare the prompt with the retrieved context
    const contextPrompt = relevantContext.length > 0
      ? `I've found some relevant information that might help answer the query. Here's the structured context:

${relevantContext.map((ctx, i) => {
  // Check if this is from the temporary document namespace
  const isFromUploadedDocument = ctx.namespace?.startsWith('session-') || false;
  const sourceLabel = isFromUploadedDocument ? 'UPLOADED DOCUMENT' : 'KNOWLEDGE BASE';
  
  // Check if the text is JSON-structured
  try {
    const jsonData = JSON.parse(ctx.text);
    
    // Handle different types of JSON chunks
    if (jsonData.type === 'section') {
      return `[${i + 1}] ${sourceLabel} - SECTION: ${jsonData.title}\n${jsonData.content.trim()}`;
    } else if (jsonData.type === 'full_content') {
      return `[${i + 1}] ${sourceLabel} - FULL DOCUMENT CONTENT:\n${jsonData.content.substring(0, 500)}...`;
    } else if (jsonData.sections) {
      // Handle structured document data
      return `[${i + 1}] ${sourceLabel} - DOCUMENT SECTIONS:\n${jsonData.sections.map((section: any) => 
        `- ${section.title}:\n${section.content.trim()}`
      ).join('\n\n')}`;
    } else {
      return `[${i + 1}] ${sourceLabel}: ${ctx.text}`;
    }
  } catch (e) {
    // If it's not valid JSON, use the text as is
    return `[${i + 1}] ${sourceLabel}: ${ctx.text}`;
  }
}).join('\n\n')}

Please use this information to provide an accurate response. If the information doesn't fully address the query, acknowledge the limitations of the available information. If information from both the uploaded document and knowledge base is available, prioritize the uploaded document for context-specific details, but use the knowledge base for general information.`
      : `I don't have specific information about this in my knowledge base. Please provide a general response based on your understanding of UAE Corporate Tax, but make it clear that this is general information and not specific tax advice.`;

    // Get the system prompt based on the selected chat model
    const promptTemplate = systemPrompt({ selectedChatModel });

    // Combine the system prompt with the context
    const fullPrompt = `${promptTemplate}

${contextPrompt}`;

    return createDataStreamResponse({
      execute: (dataStream) => {
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: fullPrompt,
          messages,
          experimental_transform: smoothStream({ chunking: 'word' }),
          experimental_generateMessageId: generateUUID,
          onFinish: async ({ response, reasoning }) => {
            if (session.user?.id) {
              try {
                const sanitizedResponseMessages = sanitizeResponseMessages({
                  messages: response.messages,
                  reasoning,
                });

                await saveMessages({
                  messages: sanitizedResponseMessages.map((message) => {
                    return {
                      id: message.id,
                      chatId: id,
                      role: message.role,
                      content: message.content,
                      createdAt: new Date(),
                    };
                  }),
                });
              } catch (error) {
                console.error('Failed to save chat');
              }
            }
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        });

        result.consumeStream();
        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true,
        });
      },
      onError: () => {
        return 'Oops, an error occurred! Please try again.';
      },
    });
  } catch (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return new Response('Chat ID is required', { status: 400 });
    }

    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const chat = await getChatById({ id });

    if (!chat) {
      return new Response('Chat not found', { status: 404 });
    }

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
}

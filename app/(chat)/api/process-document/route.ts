import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { saveMessages, getChatById, saveChat } from '@/lib/db/queries';
import { generateUUID } from '@/lib/utils';

export async function POST(request: Request) {
  const session = await auth();

  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { attachments, chatId } = body;

    if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
      return NextResponse.json(
        { error: 'No attachments provided' },
        { status: 400 }
      );
    }

    if (!chatId) {
      return NextResponse.json(
        { error: 'No chat ID provided' },
        { status: 400 }
      );
    }

    // Check if the chat exists, create it if it doesn't
    const existingChat = await getChatById({ id: chatId });
    if (!existingChat) {
      // Create a new chat with a default title
      await saveChat({
        id: chatId,
        userId: session.user.id,
        title: "Document Analysis",
      });
    }

    // Create a list of document names
    const documentNames = [];
    for (const attachment of attachments) {
      if (attachment.name) {
        documentNames.push(attachment.name);
      } else {
        documentNames.push('Unnamed Document');
      }
    }
    const documentNamesList = documentNames.join(', ');

    // Create messages for the database
    const messages = [
      {
        id: generateUUID(),
        chatId,
        role: 'system',
        content: 'Document has been processed. You can now chat with MusTax AI Report IQ about the document.',
        createdAt: new Date(),
      },
      {
        id: generateUUID(),
        chatId,
        role: 'assistant',
        content: `I've analyzed the document(s): ${documentNamesList}. I'm ready to answer your questions about the content and provide insights related to UAE Corporate Tax.`,
        createdAt: new Date(),
      }
    ];

    // Save the messages to the database
    await saveMessages({ messages });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing document:', error);
    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 }
    );
  }
} 
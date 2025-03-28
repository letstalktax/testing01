import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { generateEmbeddings, splitTextIntoChunks } from '@/lib/rag/document-processor';
import { storeEmbeddings } from '@/lib/rag/pinecone-client';

export const maxDuration = 60;

// Function to convert extracted text to structured JSON
function convertToStructuredJSON(text: string) {
  // Create a structured JSON object with the extracted text
  const sections = splitTextIntoSections(text);
  
  return {
    content: text,
    metadata: {
      extractionMethod: 'llama-3.2-vision',
      extractionDate: new Date().toISOString(),
      contentType: 'text/plain',
      sectionCount: sections.length
    },
    sections: sections
  };
}

// Function to split text into logical sections
function splitTextIntoSections(text: string) {
  // Split by potential section headers (lines ending with colon or all caps lines)
  const lines = text.split('\n');
  const sections = [];
  let currentSection = {
    title: 'Introduction',
    content: ''
  };
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Check if this line looks like a section header
    if (
      (trimmedLine.endsWith(':') && trimmedLine.length < 100) || 
      (trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 5 && trimmedLine.length < 100) ||
      (trimmedLine.startsWith('Section') || trimmedLine.startsWith('CHAPTER') || trimmedLine.startsWith('Article'))
    ) {
      // Save the previous section if it has content
      if (currentSection.content.trim()) {
        sections.push({...currentSection});
      }
      
      // Start a new section
      currentSection = {
        title: trimmedLine.endsWith(':') ? trimmedLine.slice(0, -1) : trimmedLine,
        content: ''
      };
    } else {
      // Add to the current section
      currentSection.content += line + '\n';
    }
  }
  
  // Add the last section
  if (currentSection.content.trim()) {
    sections.push(currentSection);
  }
  
  return sections;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // Get file as array buffer
    const fileBuffer = await file.arrayBuffer();
    const base64File = Buffer.from(fileBuffer).toString('base64');
    
    // Determine content type
    const contentType = file.type;
    const dataUri = `data:${contentType};base64,${base64File}`;
    
    console.log(`Processing document with Llama 3.2 Vision: ${file.name} (${file.size} bytes)`);
    
    // Call OpenRouter API with Llama 3.2 Vision
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'MusTax AI Document Processor'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.2-11b-vision-instruct:free',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all the text content from this document. Format it as plain text, preserving paragraphs and important structure. Identify section headers and important information. Ignore watermarks, headers, footers, and page numbers.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: dataUri
                }
              }
            ]
          }
        ],
        max_tokens: 4000
      })
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('Error from OpenRouter:', errorData);
      return NextResponse.json({ error: 'Failed to process document with Llama 3.2 Vision' }, { status: 500 });
    }
    
    const data = await response.json();
    const extractedText = data.choices[0].message.content;
    
    console.log(`Extracted ${extractedText.length} characters of text from document`);
    
    // Convert the extracted text to structured JSON
    const structuredData = convertToStructuredJSON(extractedText);
    console.log('Converted extracted text to structured JSON format');
    
    // Process each section as a separate chunk for better context retrieval
    const chunks = [];
    
    // Add the full content as a chunk
    chunks.push(JSON.stringify({
      type: 'full_content',
      content: structuredData.content,
      metadata: structuredData.metadata
    }));
    
    // Add each section as a separate chunk
    for (const section of structuredData.sections) {
      chunks.push(JSON.stringify({
        type: 'section',
        title: section.title,
        content: section.content,
        metadata: {
          ...structuredData.metadata,
          sectionTitle: section.title
        }
      }));
    }
    
    // Add the complete structured document as a chunk
    chunks.push(JSON.stringify(structuredData));
    
    console.log(`Created ${chunks.length} JSON chunks from the document`);
    
    // Generate embeddings for chunks
    const embeddingsWithText = await generateEmbeddings(chunks, {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      userId: session.user.id,
      processedWith: 'llama-3.2-vision-json'
    });
    
    console.log(`Generated ${embeddingsWithText.length} embeddings`);
    
    // Store embeddings in Pinecone
    if (embeddingsWithText.length > 0) {
      await storeEmbeddings(
        process.env.PINECONE_INDEX_NAME!,
        embeddingsWithText.map(item => ({
          ...item,
          metadata: {
            ...item.metadata,
            userId: session.user?.id,
            fileName: file.name,
            uploadedAt: new Date().toISOString(),
            isJsonStructured: true
          }
        }))
      );
      console.log('Stored embeddings in Pinecone');
    }
    
    return NextResponse.json({
      success: true,
      textLength: extractedText.length,
      chunks: chunks.length,
      embeddings: embeddingsWithText.length,
      preview: extractedText.substring(0, 200) + '...',
      structuredData: structuredData
    });
  } catch (error) {
    console.error('Error processing document with vision model:', error);
    return NextResponse.json({ 
      error: 'Failed to process document',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 
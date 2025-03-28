import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { put } from '@vercel/blob';
import { storeEmbeddings } from '@/lib/rag/pinecone-client';
import { generateUUID } from '@/lib/utils';

// Function to split text into chunks for embedding
function splitTextIntoChunks(text: string, maxChunkSize = 1000, overlap = 200) {
  const chunks = [];
  let startIndex = 0;
  
  while (startIndex < text.length) {
    // Calculate end index for this chunk
    let endIndex = startIndex + maxChunkSize;
    
    // If we're not at the end of the text, try to find a good break point
    if (endIndex < text.length) {
      // Look for paragraph breaks or sentence breaks
      const paragraphBreak = text.lastIndexOf('\n\n', endIndex);
      const sentenceBreak = text.lastIndexOf('. ', endIndex);
      
      if (paragraphBreak > startIndex && paragraphBreak > endIndex - 200) {
        endIndex = paragraphBreak;
      } else if (sentenceBreak > startIndex && sentenceBreak > endIndex - 100) {
        endIndex = sentenceBreak + 1; // Include the period
      }
    } else {
      endIndex = text.length;
    }
    
    // Add this chunk to our list
    chunks.push(text.substring(startIndex, endIndex).trim());
    
    // Move start index for next chunk, with overlap
    startIndex = endIndex - overlap;
    if (startIndex < 0) startIndex = 0;
  }
  
  return chunks;
}

// Function to generate embeddings for text chunks
async function generateEmbeddings(chunks: string[]) {
  const embeddingResults = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'text-embedding-3-large',
          input: chunk,
          encoding_format: 'float'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        embeddingResults.push({
          id: generateUUID(),
          text: chunk,
          embedding: data.data[0].embedding
        });
        console.log(`Generated embedding for chunk ${i+1}/${chunks.length}`);
      } else {
        console.error(`Error generating embedding for chunk ${i+1}:`, await response.text());
      }
    } catch (error) {
      console.error(`Exception generating embedding for chunk ${i+1}:`, error);
    }
    
    // Add a small delay to avoid rate limiting
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return embeddingResults;
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
    
    // Upload file to Vercel Blob
    const blob = await put(`documents/${session.user.id}/${file.name}`, file, {
      access: 'public',
    });
    
    // Read file content
    const fileContent = await file.text();
    console.log(`Processing document: ${file.name} (${fileContent.length} characters)`);
    
    // Split content into chunks
    const chunks = splitTextIntoChunks(fileContent);
    console.log(`Split document into ${chunks.length} chunks`);
    
    // Generate embeddings for chunks
    const embeddingsWithText = await generateEmbeddings(chunks);
    console.log(`Generated ${embeddingsWithText.length} embeddings`);
    
    // Store embeddings in Pinecone
    if (embeddingsWithText.length > 0) {
      await storeEmbeddings(
        process.env.PINECONE_INDEX_NAME!,
        embeddingsWithText.map(item => ({
          ...item,
          metadata: {
            userId: session.user?.id,
            fileName: file.name,
            uploadedAt: new Date().toISOString()
          }
        }))
      );
      console.log('Stored embeddings in Pinecone');
    }
    
    return NextResponse.json({
      success: true,
      fileUrl: blob.url,
      chunks: chunks.length,
      embeddings: embeddingsWithText.length
    });
  } catch (error) {
    console.error('Error processing document:', error);
    return NextResponse.json({ error: 'Failed to process document' }, { status: 500 });
  }
} 
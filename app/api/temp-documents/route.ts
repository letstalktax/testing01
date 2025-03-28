import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { generateUUID } from '@/lib/utils';
// import { storeEmbeddings } from '@/lib/rag/pinecone-client';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 60;

// In-memory storage for temporary embeddings
// This will be lost on server restart, which is fine for temporary usage
const temporaryEmbeddings: Record<string, Array<{
  id: string;
  text: string;
  embedding: number[];
  metadata: Record<string, any>;
  createdAt: number; // Timestamp for cleanup
}>> = {};

// Track total memory usage
let totalEmbeddingsSize = 0;
const MAX_EMBEDDINGS_SIZE = 1000 * 1024 * 1024; // 1GB max memory usage
const MAX_EMBEDDINGS_PER_NAMESPACE = 100; // Increased from 50 to 100 for better document coverage
const EMBEDDING_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

// Function to estimate size of embeddings in memory
function estimateEmbeddingSize(embedding: number[]): number {
  // Each number in the embedding is a float (8 bytes)
  return embedding.length * 8;
}

// Function to clean up old embeddings
function cleanupOldEmbeddings() {
  console.log('Cleaning up old embeddings to free memory...');
  const now = Date.now();
  let freedMemory = 0;
  
  // First, remove expired embeddings
  Object.keys(temporaryEmbeddings).forEach(namespace => {
    const initialLength = temporaryEmbeddings[namespace].length;
    temporaryEmbeddings[namespace] = temporaryEmbeddings[namespace].filter(item => {
      const isExpired = now - item.createdAt > EMBEDDING_EXPIRY_MS;
      if (isExpired) {
        freedMemory += estimateEmbeddingSize(item.embedding);
      }
      return !isExpired;
    });
    
    const removedCount = initialLength - temporaryEmbeddings[namespace].length;
    if (removedCount > 0) {
      console.log(`Removed ${removedCount} expired embeddings from namespace ${namespace}`);
    }
    
    // If namespace is empty, delete it
    if (temporaryEmbeddings[namespace].length === 0) {
      delete temporaryEmbeddings[namespace];
      console.log(`Deleted empty namespace ${namespace}`);
    }
  });
  
  // If we're still over the limit, remove oldest embeddings from each namespace
  if (totalEmbeddingsSize - freedMemory > MAX_EMBEDDINGS_SIZE) {
    Object.keys(temporaryEmbeddings).forEach(namespace => {
      // Sort by creation time (oldest first)
      temporaryEmbeddings[namespace].sort((a, b) => a.createdAt - b.createdAt);
      
      // Keep only the newest MAX_EMBEDDINGS_PER_NAMESPACE
      if (temporaryEmbeddings[namespace].length > MAX_EMBEDDINGS_PER_NAMESPACE) {
        const toRemove = temporaryEmbeddings[namespace].slice(0, temporaryEmbeddings[namespace].length - MAX_EMBEDDINGS_PER_NAMESPACE);
        toRemove.forEach(item => {
          freedMemory += estimateEmbeddingSize(item.embedding);
        });
        
        temporaryEmbeddings[namespace] = temporaryEmbeddings[namespace].slice(-MAX_EMBEDDINGS_PER_NAMESPACE);
        console.log(`Trimmed namespace ${namespace} to ${MAX_EMBEDDINGS_PER_NAMESPACE} embeddings`);
      }
    });
  }
  
  // Update total memory usage
  totalEmbeddingsSize -= freedMemory;
  console.log(`Freed approximately ${(freedMemory / (1024 * 1024)).toFixed(2)}MB of memory. Current usage: ${(totalEmbeddingsSize / (1024 * 1024)).toFixed(2)}MB`);
  
  return freedMemory;
}

// Function to store embeddings in memory instead of Pinecone
async function storeTemporaryEmbeddings(
  namespace: string,
  vectors: Array<{
    id: string;
    text: string;
    embedding: number[];
    metadata: Record<string, any>;
  }>
): Promise<boolean> {
  try {
    console.log(`Storing ${vectors.length} embeddings in temporary memory for namespace: ${namespace}`);
    
    // Check if we need to clean up before adding more
    let estimatedNewSize = 0;
    vectors.forEach(vector => {
      estimatedNewSize += estimateEmbeddingSize(vector.embedding);
    });
    
    // If adding these vectors would exceed our limit, clean up first
    if (totalEmbeddingsSize + estimatedNewSize > MAX_EMBEDDINGS_SIZE * 0.9) {
      cleanupOldEmbeddings();
    }
    
    // Initialize namespace if it doesn't exist
    if (!temporaryEmbeddings[namespace]) {
      temporaryEmbeddings[namespace] = [];
    }
    
    // Add vectors to the namespace with creation timestamp
    const now = Date.now();
    const vectorsWithTimestamp = vectors.map(vector => ({
      ...vector,
      createdAt: now
    }));
    
    // If adding these would exceed per-namespace limit, keep only the newest ones
    if (temporaryEmbeddings[namespace].length + vectorsWithTimestamp.length > MAX_EMBEDDINGS_PER_NAMESPACE) {
      // Sort existing embeddings by creation time (oldest first)
      temporaryEmbeddings[namespace].sort((a, b) => a.createdAt - b.createdAt);
      
      // Calculate how many we need to remove
      const totalAfterAdding = temporaryEmbeddings[namespace].length + vectorsWithTimestamp.length;
      const toRemoveCount = totalAfterAdding - MAX_EMBEDDINGS_PER_NAMESPACE;
      
      if (toRemoveCount > 0) {
        // Remove oldest embeddings
        const removed = temporaryEmbeddings[namespace].splice(0, toRemoveCount);
        removed.forEach(item => {
          totalEmbeddingsSize -= estimateEmbeddingSize(item.embedding);
        });
        console.log(`Removed ${toRemoveCount} oldest embeddings from namespace ${namespace} to stay within limits`);
      }
    }
    
    // Add the new vectors
    temporaryEmbeddings[namespace].push(...vectorsWithTimestamp);
    
    // Update total memory usage
    totalEmbeddingsSize += estimatedNewSize;
    
    console.log(`Successfully stored embeddings in temporary memory. Total count for namespace ${namespace}: ${temporaryEmbeddings[namespace].length}`);
    console.log(`Estimated memory usage: ${(totalEmbeddingsSize / (1024 * 1024)).toFixed(2)}MB`);
    
    return true;
  } catch (error) {
    console.error('Error storing temporary embeddings:', error);
    return false;
  }
}

// Function to query temporary embeddings
export async function queryTemporaryEmbeddings(
  namespace: string,
  queryEmbedding: number[],
  topK: number = 20 // Increased from 5 to 20 for better context retrieval
): Promise<Array<{
  id: string;
  text: string;
  score: number;
  metadata: Record<string, any>;
}>> {
  try {
    if (!temporaryEmbeddings[namespace] || temporaryEmbeddings[namespace].length === 0) {
      console.log(`No embeddings found in namespace: ${namespace}`);
      return [];
    }
    
    // Calculate cosine similarity between query and all vectors
    const results = temporaryEmbeddings[namespace].map(vector => {
      const similarity = calculateCosineSimilarity(queryEmbedding, vector.embedding);
      return {
        id: vector.id,
        text: vector.text,
        score: similarity,
        metadata: vector.metadata
      };
    });
    
    // Sort by similarity score (descending) and take top K
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  } catch (error) {
    console.error('Error querying temporary embeddings:', error);
    return [];
  }
}

// Helper function to calculate cosine similarity
function calculateCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimensions');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (normA * normB);
}

// Function to split text into chunks with overlap
function splitTextIntoChunks(text: string, maxSize = 1500, overlap = 50): string[] {
  // Safety check for empty or invalid text
  if (!text || typeof text !== 'string' || text.length === 0) {
    console.log('Warning: Empty or invalid text provided to splitTextIntoChunks');
    return [];
  }

  // Optimize chunk size and overlap
  const optimizedMaxSize = Math.min(maxSize, 1500);
  const optimizedOverlap = Math.min(overlap, 50);
  
  const chunks: string[] = [];
  let startIndex = 0;
  
  // Safety check to prevent infinite loops
  const maxIterations = Math.ceil(text.length / (optimizedMaxSize - optimizedOverlap)) + 1;
  let iterations = 0;
  
  while (startIndex < text.length && iterations < maxIterations) {
    iterations++;
    
    // Calculate end index for this chunk
    let endIndex = Math.min(startIndex + optimizedMaxSize, text.length);
    
    // Don't create chunks that are too small
    if (endIndex - startIndex < 100 && chunks.length > 0) {
      // If the remaining text is too small, append it to the previous chunk
      const lastChunk = chunks.pop();
      if (lastChunk) {
        chunks.push(lastChunk + text.substring(startIndex));
      } else {
        // Fallback if somehow we don't have a last chunk
        chunks.push(text.substring(startIndex));
      }
      break;
    }
    
    // Validate indices to prevent errors
    if (startIndex < 0) startIndex = 0;
    if (endIndex > text.length) endIndex = text.length;
    if (endIndex <= startIndex) break; // Prevent invalid ranges
    
    // Add the chunk
    chunks.push(text.substring(startIndex, endIndex));
    
    // Move the start index for the next chunk, with overlap
    startIndex = endIndex - optimizedOverlap;
    
    // Safety check for the next iteration
    if (startIndex >= text.length) break;
  }
  
  // Log chunking results
  console.log(`Split text of length ${text.length} into ${chunks.length} chunks (maxSize: ${optimizedMaxSize}, overlap: ${optimizedOverlap})`);
  
  return chunks;
}

// Function to generate embeddings for text chunks
async function generateEmbeddings(chunks: string[], metadata: Record<string, any> = {}) {
  const embeddingResults: Array<{
    id: string;
    text: string;
    embedding: number[];
    metadata: Record<string, any>;
  }> = [];
  const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
  
  console.log(`Generating embeddings using model: ${EMBEDDING_MODEL} for ${chunks.length} chunks`);
  
  // For larger documents, use batching if possible
  const batchSize = 10; // Increased batch size for faster processing
  const batches = [];
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    batches.push(chunks.slice(i, i + batchSize));
  }
  
  console.log(`Split into ${batches.length} batches for processing`);
  
  let batchCounter = 0;
  for (const batch of batches) {
    batchCounter++;
    console.log(`Processing batch ${batchCounter}/${batches.length} with ${batch.length} chunks`);
    
    try {
      // Process all chunks in this batch in parallel
      const batchPromises = batch.map(async (chunk, chunkIndex) => {
        const globalChunkIndex = (batchCounter - 1) * batchSize + chunkIndex + 1;
      
      try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: EMBEDDING_MODEL,
            input: chunk,
            encoding_format: 'float'
          })
        });
        
          if (response.ok) {
        const data = await response.json();
            console.log(`Generated embedding for chunk ${globalChunkIndex}/${chunks.length}`);
            
            embeddingResults.push({
          id: generateUUID(),
          text: chunk,
          embedding: data.data[0].embedding,
          metadata: {
            ...metadata,
                chunkIndex: globalChunkIndex
              }
            });
          } else {
            const errorText = await response.text();
            console.error(`Error generating embedding for chunk ${globalChunkIndex}: ${errorText}`);
          }
        } catch (error) {
          console.error(`Exception generating embedding for chunk ${globalChunkIndex}:`, error);
        }
      });
      
      // Wait for all chunks in this batch to complete
      await Promise.all(batchPromises);
      
      // Only add a small delay between batches if we have more than 2 batches
      if (batches.length > 2 && batchCounter < batches.length) {
        console.log('Waiting between batches to avoid rate limits...');
        await new Promise(resolve => setTimeout(resolve, 500)); // Reduced delay
      }
    } catch (error) {
      console.error(`Error processing batch ${batchCounter}:`, error);
    }
  }
  
  console.log(`Successfully generated ${embeddingResults.length} embeddings out of ${chunks.length} chunks`);
  return embeddingResults;
}

// Function to extract text from model output
function extractTextFromLlamaOutput(output: string | object): string {
  if (typeof output !== 'string') {
    return extractTextFromObject(output);
  }
  
  try {
    const jsonData = JSON.parse(output);
    return extractTextFromObject(jsonData);
  } catch {
    // Return as plain text if not JSON
    return output;
  }
}

// Helper function to recursively extract text from any JSON structure
function extractTextFromObject(obj: any): string {
  if (typeof obj === 'string') return obj;
  if (Array.isArray(obj)) return obj.map(extractTextFromObject).join('\n');
  
  if (typeof obj === 'object' && obj !== null) {
    // Special handling for common response structures
    if (obj.content) return obj.content;
    if (obj.text) return obj.text;
    if (obj.message && obj.message.content) return obj.message.content;
    
    // Handle sections array if present
    if (obj.sections && Array.isArray(obj.sections)) {
      return obj.sections.map((section: any) => {
        if (typeof section === 'object' && section !== null) {
          const title = section.title ? `${section.title}\n` : '';
          const content = section.content || '';
          return title + content;
        }
        return extractTextFromObject(section);
      }).join('\n\n');
    }
    
    // Recursively process all object values
    return Object.values(obj)
      .filter(val => val !== null && val !== undefined)
      .map(extractTextFromObject)
      .join('\n')
      .trim();
  }
  
  return String(obj);
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
    
    console.log(`Processing document with Gemini Flash: ${file.name} (${file.size} bytes)`);
    
    // Process directly with Gemini Flash regardless of file type
    return await processWithGeminiFlash(file, dataUri, session);
  } catch (error) {
    console.error('Error processing document:', error);
    return NextResponse.json({ 
      error: 'Failed to process document',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// New function to process documents with Gemini Flash
async function processWithGeminiFlash(file: File, dataUri: string, session: any): Promise<NextResponse> {
  try {
    console.log('Processing document with Gemini Flash 2.0...');
    
    // Initialize the Google Generative AI with the API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not defined in environment variables');
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Get the Gemini model
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-thinking-exp-01-21",
    });
    
    // Set generation config
    const generationConfig = {
      temperature: 0.7,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 65536,
      responseMimeType: "text/plain",
    };
    
    // Extract content type and base64 data from file
    const contentType = file.type;
    const fileBuffer = await file.arrayBuffer();
    const base64File = Buffer.from(fileBuffer).toString('base64');
    
    // Prepare the prompt
    const prompt = "Extract all the text content from this document. Format it as plain text, preserving paragraphs and important structure. Identify section headers and important information. Ignore watermarks, headers, footers, and page numbers.";
    
    console.log(`Sending document to Gemini Flash: ${file.name} (${contentType}, ${fileBuffer.byteLength} bytes)`);
    
    // Send the content to Gemini Flash
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: contentType, data: base64File } }
          ]
        }
      ],
      generationConfig
    });
    
    // Check if the response is valid
    if (!result || !result.response) {
      console.error('Gemini Flash returned an invalid response:', result);
      throw new Error('Invalid response from Gemini Flash');
    }
    
    // Get the response text directly
    const responseText = result.response.text();
    
    if (!responseText || responseText.length < 50) {
      console.error('Gemini Flash returned a short or empty response:', responseText);
      
      return NextResponse.json({ 
        error: 'Failed to extract meaningful text from document',
        message: 'The AI model could not extract meaningful text from your document. Please try a different document or format.'
      }, { status: 500 });
    }
    
    console.log(`Extracted ${responseText.length} characters of text from document using Gemini Flash`);
    console.log('Gemini Flash processing succeeded');
    
    // Pass the raw text directly to processModelResponse
    return processModelResponse(responseText, file, session, 'gemini-flash');
  } catch (error) {
    console.error('Error processing document with Gemini Flash:', error);
    
    return NextResponse.json({ 
      error: 'Failed to process document with Gemini Flash',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// Helper function to process model response
async function processModelResponse(data: any, file: File, session: any, modelUsed = 'gemini-flash') {
  try {
    // Extract the text from the model response
    let processedText = '';
    
    // Handle different response formats
    if (data.response && data.response.text) {
      // New Gemini Flash format
      processedText = data.response.text();
    } else if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
      // Old format with choices array
      processedText = data.choices[0].message.content;
    } else if (typeof data === 'string') {
      // Plain text response
      processedText = data;
    } else {
      console.error('Unrecognized model response format:', JSON.stringify(data).substring(0, 200));
      return NextResponse.json({
        success: false,
        error: 'Invalid model response',
        message: 'The document could not be processed correctly. Please try again with a different document.'
      }, { status: 500 });
    }
    
    // Remove any code blocks or formatting that might have been added
    processedText = processedText.replace(/```plain text\n/g, '');
    processedText = processedText.replace(/```\n/g, '');
    processedText = processedText.replace(/```/g, '');
    
    // Validate the processed text
    if (!processedText || processedText.length < 50) {
      console.error(`Extracted text is too short (${processedText?.length || 0} chars)`);
      return NextResponse.json({
        success: false,
        error: 'Insufficient text extracted',
        message: 'Not enough text could be extracted from the document. Please try a different document.'
      }, { status: 400 });
    }
    
    console.log(`Extracted ${processedText.length} characters of text from document using ${modelUsed}`);
    
    // For very short documents, don't bother with chunking
    if (processedText.length < 1000) {
      console.log('Document is very short, skipping chunking');
      
      try {
        // Generate a single embedding for the entire text
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: processedText,
            encoding_format: 'float'
            // Remove dimensions parameter to use default 1536
          })
        });
        
        if (!embeddingResponse.ok) {
          const errorText = await embeddingResponse.text();
          console.error('Error generating embedding:', errorText);
          throw new Error(`Failed to generate embedding: ${errorText}`);
        }
        
        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;
        
        // Store the single embedding
        const embeddingsWithText = [{
          id: generateUUID(),
          text: processedText,
          embedding: embedding,
          metadata: {
            source: file.name,
            chunkIndex: 0,
            totalChunks: 1
          }
        }];
        
        // Create a session-specific namespace
        const sessionNamespace = `session-${session.user.id}`;
        
        // Store embeddings in temporary memory
        await storeTemporaryEmbeddings(
          sessionNamespace,
          embeddingsWithText.map(item => ({
            ...item,
            metadata: {
              ...item.metadata,
              namespace: sessionNamespace,
              sessionId: session.user?.id,
              fileName: file.name,
              uploadedAt: new Date().toISOString()
            }
          }))
        );
        
        return NextResponse.json({
          success: true,
          textLength: processedText.length,
          chunks: 1,
          embeddings: 1,
          preview: processedText.substring(0, 200) + '...',
          sessionNamespace: sessionNamespace,
          modelUsed: modelUsed
        });
      } catch (embeddingError) {
        console.error('Error generating embedding for short document:', embeddingError);
        return NextResponse.json({
          success: false,
          error: 'Embedding generation failed',
          message: 'Failed to create embeddings for your document. Please try again later.'
      }, { status: 500 });
      }
    }
    
    // For longer documents, use optimized chunking
    let chunks: string[] = [];
    try {
      chunks = splitTextIntoChunks(processedText);
      console.log(`Successfully split document into ${chunks.length} chunks`);
      
      if (chunks.length === 0) {
        throw new Error('Chunking resulted in 0 chunks');
      }
    } catch (chunkingError) {
      console.error('Error during text chunking:', chunkingError);
      
      // Fallback: try with a single chunk approach
      console.log('Falling back to single chunk approach');
      
      // Truncate text if it's too long to avoid embedding API limits
      const truncatedText = processedText.substring(0, 8000);
      chunks = [truncatedText];
    }
    
    // Generate embeddings for chunks
    // For faster processing and less memory usage, limit to max 20 chunks (increased from 5)
    const maxChunks = Math.min(chunks.length, 20);
    const selectedChunks = chunks.slice(0, maxChunks);
    
    console.log(`Generating embeddings using model: text-embedding-3-small for ${selectedChunks.length} chunks`);
    
    // Process in batches to avoid rate limits
    const batchSize = 10; // Increased from 5 to 10 for faster processing
    const batches = [];
    
    for (let i = 0; i < selectedChunks.length; i += batchSize) {
      batches.push(selectedChunks.slice(i, i + batchSize));
    }
    
    console.log(`Split into ${batches.length} batches for processing`);
    
    const embeddingsWithText = [];
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} chunks`);
      
      try {
        // Generate embeddings for this batch
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: batch,
            encoding_format: 'float'
            // Remove dimensions parameter to use default 1536
          })
        });
        
        if (!embeddingResponse.ok) {
          const errorText = await embeddingResponse.text();
          console.error('Error generating embeddings for batch:', errorText);
          continue; // Skip this batch but continue with others
        }
        
        const embeddingData = await embeddingResponse.json();
        
        // Map embeddings to chunks
        for (let i = 0; i < batch.length; i++) {
          if (embeddingData.data[i]) {
            const chunkIndex = batchIndex * batchSize + i;
            embeddingsWithText.push({
              id: generateUUID(),
              text: batch[i],
              embedding: embeddingData.data[i].embedding,
              metadata: {
                source: file.name,
                chunkIndex: chunkIndex,
                totalChunks: selectedChunks.length
              }
            });
            console.log(`Generated embedding for chunk ${chunkIndex + 1}/${selectedChunks.length}`);
          }
        }
        
        // Force garbage collection between batches by clearing references
        // This helps prevent memory buildup
        if (batches.length > 1) {
          batch.length = 0;
          
          // Small delay to allow GC to run
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`Error processing batch ${batchIndex}:`, error);
        // Continue with next batch
      }
    }
    
    // If we couldn't generate any embeddings, return an error
    if (embeddingsWithText.length === 0) {
      console.error('Failed to generate any embeddings');
      return NextResponse.json({
        success: false,
        error: 'Failed to generate embeddings',
        message: 'Could not create embeddings for your document. Please try again later.'
      }, { status: 500 });
    }
    
    // Create a session-specific namespace
    const sessionNamespace = `session-${session.user.id}`;
    
    // Store embeddings in temporary memory
    await storeTemporaryEmbeddings(
      sessionNamespace,
          embeddingsWithText.map(item => ({
            ...item,
            metadata: {
              ...item.metadata,
              namespace: sessionNamespace,
              sessionId: session.user?.id,
              fileName: file.name,
              uploadedAt: new Date().toISOString()
            }
      }))
    );
    
    return NextResponse.json({
      success: true,
      textLength: processedText.length,
      chunks: chunks.length,
      embeddings: embeddingsWithText.length,
      preview: processedText.substring(0, 200) + '...',
      sessionNamespace: sessionNamespace,
      modelUsed: modelUsed
    });
  } catch (error) {
    console.error('Error in processModelResponse:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process document',
      message: 'An unexpected error occurred while processing the document.',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// Add a route to manually clear embeddings if needed
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if the user is an admin (optional)
    // if (!session.user.isAdmin) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }
    
    const { searchParams } = new URL(request.url);
    const namespace = searchParams.get('namespace');
    
    if (namespace) {
      // Clear specific namespace
      if (temporaryEmbeddings[namespace]) {
        const count = temporaryEmbeddings[namespace].length;
        let freedMemory = 0;
        temporaryEmbeddings[namespace].forEach(item => {
          freedMemory += estimateEmbeddingSize(item.embedding);
        });
        
        delete temporaryEmbeddings[namespace];
        totalEmbeddingsSize -= freedMemory;
        
        console.log(`Cleared ${count} embeddings from namespace ${namespace}, freed ${(freedMemory / (1024 * 1024)).toFixed(2)}MB`);
        return NextResponse.json({ 
          success: true, 
          message: `Cleared ${count} embeddings from namespace ${namespace}`,
          freedMemoryMB: (freedMemory / (1024 * 1024)).toFixed(2)
        });
      } else {
        return NextResponse.json({ 
          success: false, 
          message: `Namespace ${namespace} not found` 
        });
      }
    } else {
      // Clear all embeddings
      const namespaceCount = Object.keys(temporaryEmbeddings).length;
      let totalCount = 0;
      
      Object.keys(temporaryEmbeddings).forEach(ns => {
        totalCount += temporaryEmbeddings[ns].length;
      });
      
      // Reset everything
      Object.keys(temporaryEmbeddings).forEach(key => {
        delete temporaryEmbeddings[key];
      });
      
      const freedMemory = totalEmbeddingsSize;
      totalEmbeddingsSize = 0;
      
      console.log(`Cleared all embeddings: ${totalCount} embeddings from ${namespaceCount} namespaces, freed ${(freedMemory / (1024 * 1024)).toFixed(2)}MB`);
      return NextResponse.json({ 
        success: true, 
        message: `Cleared all embeddings: ${totalCount} embeddings from ${namespaceCount} namespaces`,
        freedMemoryMB: (freedMemory / (1024 * 1024)).toFixed(2)
      });
    }
  } catch (error) {
    console.error('Error clearing embeddings:', error);
    return NextResponse.json({ 
      error: 'Failed to clear embeddings',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 
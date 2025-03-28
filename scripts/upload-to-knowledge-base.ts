import fs from 'fs';
import path from 'path';
import { Pinecone } from '@pinecone-database/pinecone';
import { pipeline } from '@xenova/transformers';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

// Function to chunk text into smaller pieces
function chunkText(text: string, chunkSize: number = 500): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    currentChunk += sentence + ' ';
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

async function main() {
  try {
    console.log('Initializing embedding model...');
    // Using all-MiniLM-L6-v2 which produces 384-dimensional embeddings
    const embeddingModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    const embeddingDimension = 384; // Dimension for all-MiniLM-L6-v2

    console.log('Connecting to Pinecone...');
    const indexName = process.env.PINECONE_INDEX_NAME || 'knowledge-base';
    
    // Check if the index exists
    const indexes = await pinecone.listIndexes();
    const indexExists = indexes.indexes?.some((idx: { name: string }) => idx.name === indexName) || false;
    
    if (indexExists) {
      console.log(`Index ${indexName} already exists. Checking dimensions...`);
      
      try {
        // Try to describe the index to get its dimension
        const indexDescription = await pinecone.describeIndex(indexName);
        const existingDimension = indexDescription.dimension;
        
        if (existingDimension !== embeddingDimension) {
          console.log(`Warning: Index dimension (${existingDimension}) does not match embedding dimension (${embeddingDimension}).`);
          console.log(`To fix this, you need to delete the existing index and create a new one with the correct dimension.`);
          console.log(`You can delete the index from the Pinecone console or by running:`);
          console.log(`await pinecone.deleteIndex('${indexName}');`);
          return;
        }
      } catch (error) {
        console.error('Error checking index dimensions:', error);
        return;
      }
    } else {
      console.log(`Creating index ${indexName}...`);
      await pinecone.createIndex({
        name: indexName,
        dimension: embeddingDimension,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1'
          }
        }
      });
      console.log('Waiting for index to be ready...');
      await new Promise(resolve => setTimeout(resolve, 60000)); // Wait for 60 seconds
    }
    
    const index = pinecone.index(indexName);

    // Path to the documents directory
    const docsDir = path.join(process.cwd(), 'docs');
    
    // Check if directory exists
    if (!fs.existsSync(docsDir)) {
      console.log('Creating docs directory...');
      fs.mkdirSync(docsDir);
      console.log('Please place your documents in the "docs" directory and run this script again.');
      return;
    }

    // Get all files in the directory
    const files = fs.readdirSync(docsDir);
    
    if (files.length === 0) {
      console.log('No files found in the docs directory. Please add some documents and try again.');
      return;
    }

    console.log(`Found ${files.length} files to process.`);

    // Process each file
    for (const file of files) {
      const filePath = path.join(docsDir, file);
      const stats = fs.statSync(filePath);
      
      if (!stats.isFile()) continue;
      
      console.log(`Processing ${file}...`);
      
      // Read file content
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Chunk the content
      const chunks = chunkText(content);
      console.log(`Split into ${chunks.length} chunks.`);
      
      // Process each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`Embedding chunk ${i + 1}/${chunks.length}...`);
        
        // Generate embedding
        const embedding = await embeddingModel(chunk, { pooling: 'mean', normalize: true });
        const vector = Array.from(embedding.data);
        
        // Create a unique ID for this chunk
        const id = `${path.basename(file, path.extname(file))}_chunk_${i}`;
        
        // Upsert to Pinecone
        await index.upsert([{
          id,
          values: vector,
          metadata: {
            text: chunk,
            source: file,
            chunk: i,
            totalChunks: chunks.length
          }
        }]);
        
        console.log(`Uploaded chunk ${i + 1}/${chunks.length} to Pinecone.`);
      }
      
      console.log(`Completed processing ${file}.`);
    }
    
    console.log('All documents have been processed and uploaded to the knowledge base.');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main(); 
import { Pinecone } from '@pinecone-database/pinecone';
import { pipeline } from '@xenova/transformers';

// Initialize Pinecone client
let pineconeClient: Pinecone | null = null;
let embeddingModel: any = null;

// Initialize the Pinecone client
export async function getPineconeClient() {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
  }
  return pineconeClient;
}

// Initialize the embedding model
export async function getEmbeddingModel() {
  if (!embeddingModel) {
    embeddingModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embeddingModel;
}

// Generate embeddings for a text
export async function generateEmbeddings(text: string): Promise<number[]> {
  const model = await getEmbeddingModel();
  if (!model) {
    throw new Error('Embedding model not initialized');
  }
  const result = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data);
}

// Query the knowledge base
export async function queryKnowledgeBase(query: string, topK: number = 5) {
  try {
    const client = await getPineconeClient();
    const indexName = process.env.PINECONE_INDEX_NAME || 'knowledge-base';
    const index = client.index(indexName);
    
    // Generate embeddings for the query
    const embeddings = await generateEmbeddings(query);
    
    // Query Pinecone
    const queryResponse = await index.query({
      vector: embeddings,
      topK,
      includeMetadata: true,
    });
    
    return queryResponse.matches;
  } catch (error) {
    console.error('Error querying knowledge base:', error);
    throw error;
  }
} 
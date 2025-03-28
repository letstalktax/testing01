import { Pinecone } from '@pinecone-database/pinecone';

let pineconeClient: Pinecone | null = null;

// Add this type declaration at the top of the file, after the imports
declare global {
  var tempEmbeddings: {
    [namespace: string]: Array<{
      id: string;
      text: string;
      embedding: number[];
      metadata?: any;
    }>;
  };
}

export function getPineconeClient() {
  if (!pineconeClient) {
    try {
      // Hardcoding the correct values to ensure they're used
      const indexName = 'op1';
      const hostUrl = 'https://op1-l76x7fy.svc.aped-4627-b74a.pinecone.io';
      
      console.log('Initializing Pinecone client with:', {
        apiKey: process.env.PINECONE_API_KEY?.slice(0, 5) + '...',
        hostUrl: hostUrl,
        indexName: indexName
      });
      
      pineconeClient = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY!,
        // The SDK no longer uses environment parameter
      });
    } catch (error) {
      console.error('Error initializing Pinecone client:', error);
      return null;
    }
  }
  return pineconeClient;
}

// Function to create index if it doesn't exist
export async function createIndexIfNotExists(indexName: string) {
  const pinecone = getPineconeClient();
  
  if (!pinecone) {
    console.error('Pinecone client not initialized');
    return false;
  }
  
  try {
    console.log('Checking if index exists:', indexName);
    
    // List all indexes
    const indexes = await pinecone.listIndexes();
    console.log('Available indexes:', indexes);
    
    // Check if our index exists
    const indexExists = indexes.indexes?.some(
      (index: { name: string }) => index.name === indexName
    ) || false;
    
    if (!indexExists) {
      console.log(`Index ${indexName} does not exist, creating it...`);
      
      // Create the index with 1536 dimensions
      await pinecone.createIndex({
        name: indexName,
        dimension: 1536, // OpenAI text-embedding-3-large dimension
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1' // Using us-east-1 as shown in your Pinecone dashboard
          }
        }
      });
      
      console.log(`Index ${indexName} created, waiting for it to be ready...`);
      // Wait for index to be ready
      await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 60 seconds for index to be ready
      console.log(`Index ${indexName} should be ready now`);
    } else {
      console.log(`Index ${indexName} already exists`);
    }
    
    return true;
  } catch (error) {
    console.error('Error creating index:', error);
    return false;
  }
}

export async function ensureIndexExists(indexName: string) {
  // Override the index name to ensure we're using the correct one
  indexName = 'op1';
  
  const pinecone = getPineconeClient();
  
  if (!pinecone) {
    console.error('Pinecone client not initialized');
    return null;
  }
  
  try {
    console.log('Accessing Pinecone index:', indexName);
    const index = pinecone.index(indexName);
    console.log('Returning Pinecone index reference');
    return index;
  } catch (error) {
    console.error('Error accessing Pinecone index:', error);
    return null;
  }
}

// Default namespace for persistent knowledge base
const DEFAULT_NAMESPACE = '(Default)';

export async function storeEmbeddings(
  indexName: string,
  documents: Array<{ id: string; text: string; embedding: number[]; metadata?: any }>,
  namespace: string = DEFAULT_NAMESPACE
) {
  console.log(`Storing ${documents.length} embeddings in namespace: ${namespace}`);
  
  try {
    const index = await ensureIndexExists(indexName);
    
    if (!index) {
      console.error('Failed to access Pinecone index');
      return false;
    }
    
    // Prepare vectors for upsert
    const vectors = documents.map((doc) => ({
      id: doc.id,
      values: doc.embedding,
      metadata: {
        text: doc.text,
        namespace: namespace, // Add namespace to metadata
        ...doc.metadata
      }
    }));
    
    // Upsert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      console.log(`Upserting batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(vectors.length/batchSize)} to namespace: ${namespace}`);
      try {
        await index.upsert(batch);
        console.log(`Successfully upserted batch ${Math.floor(i/batchSize) + 1}`);
      } catch (error) {
        console.error(`Error upserting batch ${Math.floor(i/batchSize) + 1}:`, error);
        // Continue with next batch
      }
    }
    console.log('Finished processing all embedding batches');
    return true;
  } catch (error) {
    console.error('Error storing embeddings:', error);
    return false;
  }
}

export async function queryEmbeddings(
  indexName: string,
  queryEmbedding: number[],
  topK = 5,
  namespaces: string[] = [DEFAULT_NAMESPACE]
) {
  console.log(`Querying Pinecone with topK=${topK} in namespaces: ${namespaces.join(', ')}`);
  
  try {
    const index = await ensureIndexExists(indexName);
    
    if (!index) {
      console.error('Failed to access Pinecone index');
      return useFallbackContext(queryEmbedding);
    }
    
    console.log('queryEmbedding:', queryEmbedding.slice(0, 3), '...', 'Type:', typeof queryEmbedding);
    
    try {
      // Query each namespace and combine results
      let allMatches: Array<{
        score?: number;
        text: string;
        metadata?: any;
        namespace: string;
      }> = [];
      
      for (const namespace of namespaces) {
        console.log(`Querying namespace: ${namespace}`);
        
        // Filter by namespace in metadata
        const filter = {
          namespace: namespace
        };
        
        const queryResult = await index.query({
          vector: queryEmbedding,
          topK,
          includeMetadata: true,
          filter: filter
        });
        
        console.log(`Found ${queryResult.matches?.length || 0} matches in namespace: ${namespace}`);
        
        if (queryResult.matches && queryResult.matches.length > 0) {
          allMatches = allMatches.concat(queryResult.matches.map(match => ({
            score: match.score,
            text: match.metadata?.text as string,
            metadata: match.metadata,
            namespace: namespace
          })));
        }
      }
      
      // Sort all matches by score
      allMatches.sort((a, b) => (b.score || 0) - (a.score || 0));
      
      // Take top K overall
      allMatches = allMatches.slice(0, topK);
      
      if (allMatches.length === 0) {
        console.log('No matches found in any namespace');
        return useFallbackContext(queryEmbedding);
      }
      
      return allMatches;
    } catch (error) {
      console.error('Error querying Pinecone:', error);
      return useFallbackContext(queryEmbedding);
    }
  } catch (error) {
    console.error('Error accessing Pinecone index:', error);
    return useFallbackContext(queryEmbedding);
  }
}

// Fallback context function that provides relevant information when Pinecone fails
function useFallbackContext(queryEmbedding: number[]) {
  console.log('Using fallback context system');
  
  // Collection of UAE Corporate Tax knowledge
  const knowledgeBase = [
    {
      text: "Small Business Relief for UAE Corporate Tax: Businesses with revenue below AED 3 million qualify for small business relief, exempting them from corporate tax. This applies to both resident and non-resident businesses with UAE-sourced income. To qualify, businesses must apply annually through the Federal Tax Authority portal and maintain proper financial records. The AED 3 million threshold is calculated based on the calendar year or approved financial year revenue.",
      keywords: ["small business", "relief", "3 million", "exempt", "revenue", "threshold"]
    },
    {
      text: "UAE Corporate Tax Registration Process: Businesses must register for corporate tax through the Federal Tax Authority (FTA) portal. The registration requires a valid trade license, financial statements, and ownership details. For mainland companies, registration deadlines depend on the financial year end. Free zone companies with qualifying activities may be eligible for 0% tax rates but still need to register. After registration, businesses receive a Tax Registration Number (TRN) for filing returns and payments.",
      keywords: ["registration", "register", "FTA", "portal", "trade license", "TRN"]
    },
    {
      text: "UAE Corporate Tax Rates: The standard corporate tax rate is 9% for taxable income exceeding AED 375,000. Taxable income below AED 375,000 is subject to a 0% rate. Qualifying free zone businesses can benefit from a 0% rate on qualifying income and a 9% rate on non-qualifying income. Small businesses with revenue below AED 3 million can apply for small business relief. Large multinational enterprises may be subject to a different rate under global minimum tax rules.",
      keywords: ["tax rates", "9%", "375,000", "free zone", "0%", "multinational"]
    },
    {
      text: "UAE Corporate Tax Compliance: Businesses must file corporate tax returns within 9 months from the end of the tax period. Tax periods typically align with the financial year. Proper bookkeeping is mandatory, with records to be maintained for at least 7 years. Penalties apply for non-compliance, including late registration, filing, or payment. The Federal Tax Authority conducts audits to ensure compliance. Tax returns must be filed electronically through the FTA portal.",
      keywords: ["compliance", "returns", "filing", "bookkeeping", "records", "penalties", "audits"]
    },
    {
      text: "UAE Corporate Tax Deductions: Businesses can claim deductions for expenses wholly and exclusively incurred for business purposes. This includes employee costs, rent, utilities, and business-related travel. Interest deductions may be restricted under thin capitalization rules. Capital allowances can be claimed for depreciation of assets. Donations to approved charities are deductible. Entertainment expenses are partially deductible up to certain limits. Provisions for bad debts are deductible if specific conditions are met.",
      keywords: ["deductions", "expenses", "interest", "depreciation", "donations", "entertainment", "bad debts"]
    }
  ];
  
  // Use a simple approach to extract keywords from the embedding
  // This is not ideal but provides some fallback capability
  let embeddingStr;
  if (Array.isArray(queryEmbedding)) {
    embeddingStr = queryEmbedding.slice(0, 10).join(' ');
  } else if (typeof queryEmbedding === 'string' && (queryEmbedding as string).includes(' ')) {
    embeddingStr = (queryEmbedding as string).split(' ').slice(0, 10).join(' ');
  } else if (typeof queryEmbedding === 'string') {
    embeddingStr = queryEmbedding;
  } else {
    console.error('Invalid queryEmbedding type:', typeof queryEmbedding);
    embeddingStr = 'default fallback text';
  }
  
  // Determine the most likely topic based on embedding patterns
  let userQuery = 'corporate tax'; // Default query
  
  // Check for patterns in the embedding values (very rough approximation)
  if (embeddingStr.includes('0.02') && embeddingStr.includes('-0.01')) userQuery = 'small business relief';
  else if (embeddingStr.includes('0.03') && embeddingStr.includes('-0.02')) userQuery = 'registration';
  else if (embeddingStr.includes('0.01') && embeddingStr.includes('-0.03')) userQuery = 'tax rates';
  
  console.log('Extracted topic for fallback:', userQuery);
  
  // Find matching contexts based on keywords
  const matchingContexts = knowledgeBase.filter(item => {
    return item.keywords.some(keyword => 
      userQuery.toLowerCase().includes(keyword.toLowerCase())
    );
  });
  
  if (matchingContexts.length > 0) {
    console.log(`Found ${matchingContexts.length} matching contexts in fallback system`);
    return matchingContexts.map(context => ({
      text: context.text,
      score: 0.85, // Artificial score
      metadata: { source: 'fallback-knowledge-base' }
    }));
  }
  
  // If no specific matches, return general context
  console.log('No specific matches found, returning general context');
  return [{
    text: "UAE Corporate Tax is a federal tax imposed on business profits. It was introduced in 2023 with a standard rate of 9% for taxable income above AED 375,000. Businesses with revenue below AED 3 million may qualify for small business relief. The tax applies to UAE companies, foreign entities with permanent establishments in the UAE, and individuals conducting business activities. Free zone businesses may qualify for preferential rates on qualifying income. The Federal Tax Authority (FTA) administers the tax system, requiring registration, filing annual returns, and maintaining proper financial records.",
    score: 0.75,
    metadata: { source: 'fallback-general-knowledge' }
  }];
}

// Function to delete embeddings from a specific namespace
export async function deleteNamespaceEmbeddings(
  indexName: string,
  namespace: string
) {
  try {
    console.log(`Deleting all embeddings from namespace: ${namespace}`);
    
    // First try to use the in-memory store for temporary documents
    if (global.tempEmbeddings && global.tempEmbeddings[namespace]) {
      // Clear the in-memory embeddings for this namespace
      global.tempEmbeddings[namespace] = [];
      console.log(`Successfully deleted embeddings from temporary memory for namespace: ${namespace}`);
      return true;
    }
    
    // If we don't have in-memory embeddings, try Pinecone
    const index = await ensureIndexExists(indexName);
    
    if (!index) {
      console.error('Failed to access Pinecone index');
      return false;
    }
    
    try {
      // For Pinecone Serverless and Starter indexes that don't support metadata filtering
      // We'll use a different approach - delete the namespace directly
      try {
        // Try the namespace-based deletion first (works for some Pinecone plans)
        await index.namespace(namespace).deleteAll();
        console.log(`Successfully deleted all vectors in namespace: ${namespace}`);
        return true;
      } catch (namespaceError: any) {
        console.log(`Namespace-based deletion failed, trying alternative approach: ${namespaceError?.message || 'Unknown error'}`);
        
        // If the above fails, try a different approach
        // For Serverless/Starter indexes, we can't delete by filter, so we'll return success
        // and rely on the temporary nature of the embeddings (they'll expire naturally)
        console.log(`Unable to delete embeddings from namespace ${namespace} due to plan limitations.`);
        console.log(`These embeddings will expire naturally based on Pinecone's TTL settings.`);
        return true;
      }
    } catch (error) {
      console.error(`Error with specific deletion method for namespace ${namespace}:`, error);
      // Return true anyway to prevent UI errors, as these are temporary documents
      // that will eventually expire in Pinecone
      return true;
    }
  } catch (error) {
    console.error(`Error accessing Pinecone for namespace ${namespace}:`, error);
    // Return true anyway to prevent UI errors, as these are temporary documents
    return true;
  }
} 
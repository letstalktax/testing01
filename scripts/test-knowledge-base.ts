import { queryKnowledgeBase } from '../lib/pinecone';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function main() {
  try {
    console.log('Testing Pinecone knowledge base query...');
    console.log('API Key:', process.env.PINECONE_API_KEY ? 'Present (first 5 chars: ' + process.env.PINECONE_API_KEY.substring(0, 5) + '...)' : 'Missing');
    console.log('Index Name:', process.env.PINECONE_INDEX_NAME || 'Missing');
    
    // Test query
    const query = 'What is the standard corporate tax rate in the UAE?';
    console.log(`Querying knowledge base with: "${query}"`);
    
    const results = await queryKnowledgeBase(query, 3);
    
    console.log(`Found ${results.length} results:`);
    
    results.forEach((match, index) => {
      console.log(`\nResult ${index + 1}:`);
      console.log(`ID: ${match.id}`);
      console.log(`Score: ${match.score}`);
      if (match.metadata) {
        console.log(`Source: ${match.metadata.source || 'N/A'}`);
        if (match.metadata.text && typeof match.metadata.text === 'string') {
          console.log(`Text: ${match.metadata.text.substring(0, 200)}...`);
        } else {
          console.log(`Text: ${String(match.metadata.text || 'N/A')}`);
        }
      } else {
        console.log('No metadata available');
      }
    });
    
  } catch (error) {
    console.error('Error testing knowledge base:', error);
  }
}

main(); 
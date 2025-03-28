import { Session } from 'next-auth';
import { type AppendableStream, type MatchResult, type Tool } from '@/lib/types';

interface QueryInput {
  query: string;
  topK?: number;
}

interface QueryOutput {
  results: MatchResult[];
  message: string;
}

export const queryKnowledgeBaseTool = ({
  session,
  dataStream,
}: {
  session: Session | null;
  dataStream: AppendableStream;
}): Tool<QueryInput, QueryOutput> => {
  return async function queryKnowledgeBase({
    query,
    topK = 5,
  }: QueryInput): Promise<QueryOutput> {
    try {
      console.log('🔍 Knowledge Base Tool Called with query:', query);
      
      if (!session || !session.user) {
        console.error('❌ Knowledge Base Tool: Unauthorized - No session or user');
        throw new Error('Unauthorized');
      }

      dataStream.append({
        type: 'toolCall',
        content: `Searching knowledge base for: "${query}"...`,
      });

      console.log('🔍 Knowledge Base Tool: Mock implementation, returning empty results');
      
      // Return empty results
      const formattedResults: MatchResult[] = [];

      dataStream.append({
        type: 'toolResult',
        content: `Knowledge base search is currently disabled.`,
      });

      return {
        results: formattedResults,
        message: `Knowledge base search is currently disabled.`,
      };
    } catch (error) {
      console.error('❌ Error querying knowledge base:', error);
      dataStream.append({
        type: 'toolError',
        content: 'Failed to query knowledge base.',
      });
      throw error;
    }
  };
}; 
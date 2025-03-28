import { streamText } from 'ai';
import dotenv from 'dotenv';
import { myProvider } from '../lib/ai/providers';
import { systemPrompt } from '../lib/ai/prompts';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Simple mock tool for testing
const testTool = async ({ query }: { query: string }) => {
  console.log(`📝 Test Tool Called with query: "${query}"`);
  return {
    result: `This is the result for query: "${query}"`,
  };
};

async function main() {
  try {
    console.log('🧪 Testing model tool usage...');
    
    const selectedChatModel = 'chat-model-large';
    console.log(`🧪 Using model: ${selectedChatModel}`);
    
    const messages = [
      {
        role: 'user',
        content: 'What is the standard corporate tax rate in the UAE?',
      },
    ];
    
    console.log('🧪 Starting stream...');
    
    const result = streamText({
      model: myProvider.languageModel(selectedChatModel),
      system: `You are a helpful assistant. When asked about tax rates, use the testTool to get accurate information.`,
      messages,
      maxSteps: 5,
      experimental_activeTools: ['testTool'],
      tools: {
        testTool,
      },
    });
    
    console.log('🧪 Processing stream...');
    
    // Process the stream
    const reader = result.stream.getReader();
    let done = false;
    
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      
      if (value) {
        console.log('🧪 Stream part:', value);
      }
    }
    
    console.log('🧪 Stream completed');
    
  } catch (error) {
    console.error('🧪 Error testing model tool usage:', error);
  }
}

main(); 
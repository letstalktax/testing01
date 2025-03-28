import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Google Generative AI client
const API_KEY = process.env.GOOGLE_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

// Generation config for the model
const generationConfig = {
  temperature: 0.2,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

// Handle POST requests to answer follow-up questions
export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    
    // Check if required fields are provided
    if (!body.question) {
      return NextResponse.json(
        { error: 'No question provided' },
        { status: 400 }
      );
    }
    
    if (!body.summary) {
      return NextResponse.json(
        { error: 'No summary provided' },
        { status: 400 }
      );
    }
    
    // Generate answer using Gemini
    const answer = await generateAnswer(body.question, body.summary);
    
    // Return the answer
    return NextResponse.json({
      answer,
      message: 'Question answered successfully',
    });
  } catch (error) {
    console.error('Error answering question:', error);
    return NextResponse.json(
      { error: 'Failed to answer question' },
      { status: 500 }
    );
  }
}

// Function to generate an answer using Gemini
async function generateAnswer(question: string, summary: string): Promise<string> {
  try {
    console.log('Generating answer for question:', question);
    
    // Access the model with the correct Gemini model name
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-thinking-exp-01-21'
    });
    
    // Create a chat session
    const chatSession = model.startChat({
      generationConfig,
      history: [
        {
          role: "user",
          parts: [
            {
              text: `I'm going to provide you with a summary of a financial document analysis. 
              You will act as a helpful financial assistant that can answer questions based on this summary.
              
              Here's the summary:
              ${summary}
              
              Please confirm you've received this information.`
            }
          ]
        },
        {
          role: "model",
          parts: [
            {
              text: "I've received the summary of the financial document analysis. I'm ready to answer your questions about this document based on the information in the summary. What would you like to know?"
            }
          ]
        }
      ],
    });
    
    console.log('Sending to Gemini for answering...');
    
    // Send the user's question
    const result = await chatSession.sendMessage(question);
    const text = result.response.text();
    
    console.log('Answer generated successfully');
    
    return text;
  } catch (error) {
    console.error('Error generating answer with Gemini:', error);
    throw new Error('Failed to generate answer with AI');
  }
} 
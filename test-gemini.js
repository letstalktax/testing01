// Test script for Gemini Flash API
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function testGeminiFlash() {
  try {
    // Get API key from environment
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not defined in environment variables');
    }
    
    console.log('API key found, initializing Gemini...');
    
    // Initialize the Google Generative AI with the API key
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
    
    // Read a test file (README.md)
    const filePath = path.join(__dirname, 'README.md');
    const fileBuffer = fs.readFileSync(filePath);
    const base64File = fileBuffer.toString('base64');
    const contentType = 'text/markdown';
    
    console.log(`File loaded: ${filePath} (${fileBuffer.length} bytes)`);
    
    // Prepare the prompt
    const prompt = "Extract all the text content from this document. Format it as plain text, preserving paragraphs and important structure. Identify section headers and important information.";
    
    console.log('Sending request to Gemini Flash...');
    
    // Send the message with the image
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
    
    // Get the response text
    const responseText = result.response.text();
    
    if (!responseText) {
      console.error('Gemini Flash returned an empty response');
      throw new Error('Empty response from Gemini Flash');
    }
    
    console.log('Response received from Gemini Flash:');
    console.log('-----------------------------------');
    console.log(responseText.substring(0, 500) + '...');
    console.log('-----------------------------------');
    console.log(`Total response length: ${responseText.length} characters`);
    
  } catch (error) {
    console.error('Error testing Gemini Flash:', error);
  }
}

// Run the test
testGeminiFlash(); 
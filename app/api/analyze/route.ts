import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { z } from 'zod';
import { readFile } from 'fs/promises';
import path from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { v4 as uuidv4 } from 'uuid';
import { sql } from 'drizzle-orm';
import fs from 'fs/promises';

// Define the schema for request validation
const AnalyzeRequestSchema = z.object({
  attachmentId: z.string(),
  fileName: z.string(),
  chatId: z.string(),
});

// Initialize the database client
// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
const model = genAI.getGenerativeModel({ 
  model: 'gemini-2.0-flash-thinking-exp-01-21',
  generationConfig: {
    temperature: 0.2,
    topK: 32,
    topP: 0.95,
    maxOutputTokens: 8192,
  },
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ],
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const json = await request.json();
    
    // Validate the request body
    const validationResult = AnalyzeRequestSchema.safeParse(json);
    
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors
        .map((error) => error.message)
        .join(', ');
      
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    
    const { attachmentId, fileName, chatId } = validationResult.data;
    
    console.log('Processing analysis request:', { attachmentId, fileName, chatId });
    
    // Extract file path from the URL (assuming it's stored in public/uploads)
    // Format is typically /uploads/{timestamp}-{filename}
    let fileContent: Buffer;
    let filePath: string;
    
    try {
      // The attachmentId is actually a URL like /uploads/1234567890-filename.pdf
      // We need to use this to find the file in the public directory
      filePath = path.join(process.cwd(), 'public', attachmentId.replace(/^\//, ''));
      console.log('Looking for file at:', filePath);
      
      // Check if file exists before reading
      await fs.access(filePath);
      fileContent = await readFile(filePath);
      console.log(`File read successfully, size: ${fileContent.length} bytes`);
    } catch (error) {
      console.error('Error reading file:', error);
      return NextResponse.json({ 
        error: 'Failed to read file: ' + (error instanceof Error ? error.message : String(error)) 
      }, { status: 500 });
    }
    
    // Check file format and size
    const fileExtension = path.extname(filePath).toLowerCase();
    console.log('File extension:', fileExtension);
    
    // Convert file content to base64 for the AI model
    let fileBase64: string;
    try {
      fileBase64 = fileContent.toString('base64');
      console.log('File converted to base64 successfully');
    } catch (error) {
      console.error('Error converting file to base64:', error);
      return NextResponse.json({ 
        error: 'Failed to process file: ' + (error instanceof Error ? error.message : String(error)) 
      }, { status: 500 });
    }
    
    try {
      console.log('Sending document to Gemini for analysis...');
      
      // Generate analysis using Google Gemini AI
      const result = await model.generateContent([
        {
          text: "You are MusTax AI Analyze, an expert tax document analysis tool. " +
                "Analyze the provided document in detail, focusing on tax implications, financial insights, and compliance considerations. " +
                "Format your response in HTML with semantic markup for better presentation. " +
                "Include specific sections for: 1) Document Overview, 2) Key Findings, 3) Tax Implications, 4) Recommendations. " +
                `Document name: ${fileName}`
        },
        {
          inlineData: {
            mimeType: "application/octet-stream",
            data: fileBase64
          }
        }
      ]);
      
      console.log('Analysis generated successfully');
      const responseText = result.response.text();
      
      // Generate a summary for the chat interface
      console.log('Generating summary...');
      const summaryResult = await model.generateContent([
        "Create a concise 3-5 sentence summary of the following analysis:",
        responseText,
      ]);
      
      const summary = summaryResult.response.text();
      console.log('Summary generated successfully');
      
      // Generate a unique ID for the report
      const reportId = uuidv4();
      
      // Store the analysis directly in the database
      try {
        console.log('Storing analysis in database...');
        await db.execute(
          sql`INSERT INTO "Report" ("id", "chatId", "userId", "content", "summary", "createdAt") 
              VALUES (${reportId}, ${chatId}, ${session.user?.id || ''}, ${responseText}, ${summary}, ${new Date()})`
        );
        console.log('Analysis stored in database successfully');
      } catch (error) {
        console.error('Error storing report in database:', error);
        // Continue execution even if DB storage fails - we'll still return the analysis
      }
      
      // Create a URL for viewing the report
      const reportUrl = `/reports/${reportId}`;
      
      return NextResponse.json({
        success: true,
        html: responseText,
        summary: summary,
        reportUrl: reportUrl,
      });
    } catch (error) {
      console.error('Error generating analysis:', error);
      return NextResponse.json({ 
        error: 'Failed to analyze document: ' + (error instanceof Error ? error.message : String(error)) 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Request processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process request: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 },
    );
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { analyzeWithGemini, processGeminiResponse } from '@/lib/gemini-client';
import { auth } from '@/lib/firebase/config';
import { createClient } from '@vercel/postgres';
import { put } from '@vercel/blob';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authCookie = request.cookies.get('auth')?.value;
    if (!authCookie) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse the form data
    const formData = await request.formData();
    const prompt = formData.get('prompt') as string;
    const fileData = formData.getAll('files') as File[];
    
    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Analyze with Gemini
    const analysisResult = await analyzeWithGemini(prompt, fileData.length > 0 ? fileData : undefined);
    
    // Save analysis result to database
    const client = createClient();
    await client.connect();
    
    let fileUrls: string[] = [];
    
    // Store files if any
    if (fileData.length > 0) {
      const fileUploadPromises = fileData.map(async (file) => {
        const blob = await put(file.name, file, {
          access: 'public',
        });
        return blob.url;
      });
      
      fileUrls = await Promise.all(fileUploadPromises);
    }
    
    // Store analysis in database
    await client.sql`
      INSERT INTO analyses (user_id, prompt, result, files)
      VALUES (${authCookie}, ${prompt}, ${analysisResult}, ${JSON.stringify(fileUrls)})
    `;
    
    await client.end();
    
    return NextResponse.json({
      success: true,
      result: analysisResult,
      files: fileUrls
    });
  } catch (error) {
    console.error('Error in analysis API:', error);
    return NextResponse.json(
      { error: 'Failed to analyze content' },
      { status: 500 }
    );
  }
} 
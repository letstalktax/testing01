import { NextRequest, NextResponse } from 'next/server';
import { analyzeFinancialStatements } from '@/lib/gemini-client';
import { auth } from '@/lib/firebase/config';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication using Firebase cookie
    const authCookie = request.cookies.get('auth')?.value;
    if (!authCookie) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Process form data (file upload)
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Check file size limit (10MB)
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxFileSize) {
      return NextResponse.json(
        { error: 'File size exceeds the 10MB limit' },
        { status: 400 }
      );
    }

    // Get file details
    const fileName = file.name;
    const fileType = file.type;
    
    // Convert file to buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    // Create a temporary directory for uploads if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    
    // Save the file with a timestamp to avoid name conflicts
    const timestamp = Date.now();
    const savedFileName = `${timestamp}-${fileName}`;
    const filePath = path.join(uploadsDir, savedFileName);
    await fs.writeFile(filePath, fileBuffer);
    
    // The URL path to access the file
    const fileUrl = `/uploads/${savedFileName}`;
    
    // Analyze the financial statements using Gemini
    const analysisResult = await analyzeFinancialStatements(
      fileName,
      fileBuffer,
      fileType
    );
    
    // Generate a unique report ID
    const reportId = uuidv4();
    
    // Create reports directory if it doesn't exist
    const reportsDir = path.join(process.cwd(), 'public', 'reports');
    await fs.mkdir(reportsDir, { recursive: true });
    
    // Save the report with the unique ID
    const reportFileName = `${reportId}.html`;
    const reportFilePath = path.join(reportsDir, reportFileName);
    await fs.writeFile(reportFilePath, analysisResult.html);
    
    return NextResponse.json({
      success: true,
      message: `Financial statements ${fileName} analyzed successfully`,
      documentPreview: fileUrl, // URL to the saved file
      knowledgeBasePreview: 'Used UAE Corporate Tax knowledge base',
      htmlReport: analysisResult.html,
      summary: analysisResult.summary,
      reportUrl: `/reports/${reportFileName}`
    });
  } catch (error) {
    console.error('Error in financial statements analysis API:', error);
    return NextResponse.json(
      { 
        error: 'Failed to analyze financial statements',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase/config';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Define the directory where reports will be stored
const REPORTS_DIR = path.join(process.cwd(), 'public', 'reports');

// Ensure the reports directory exists
async function ensureReportsDir() {
  try {
    await fs.access(REPORTS_DIR);
  } catch (error) {
    // Directory doesn't exist, create it
    await fs.mkdir(REPORTS_DIR, { recursive: true });
  }
}

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

    // Parse the request body
    const { htmlReport } = await request.json();
    
    if (!htmlReport) {
      return NextResponse.json(
        { error: 'No report content provided' },
        { status: 400 }
      );
    }

    // Create reports directory if it doesn't exist
    const reportsDir = path.join(process.cwd(), 'public', 'reports');
    await fs.mkdir(reportsDir, { recursive: true });
    
    // Generate a unique ID for the report
    const reportId = uuidv4();
    const fileName = `${reportId}.html`;
    const filePath = path.join(reportsDir, fileName);
    
    // Write the HTML report to a file
    await fs.writeFile(filePath, htmlReport);
    
    // Generate the URL for accessing the report
    const reportUrl = `/reports/${fileName}`;
    
    return NextResponse.json({
      success: true,
      reportUrl,
      message: 'Report saved successfully'
    });
  } catch (error) {
    console.error('Error saving report:', error);
    return NextResponse.json(
      { error: 'Failed to save report' },
      { status: 500 }
    );
  }
} 
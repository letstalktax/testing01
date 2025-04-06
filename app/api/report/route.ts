import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
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
    // Ensure the reports directory exists
    await ensureReportsDir();
    
    // Parse the request body
    const body = await request.json();
    
    // Check if htmlReport is provided
    if (!body.htmlReport) {
      return NextResponse.json(
        { error: 'No HTML report provided' },
        { status: 400 }
      );
    }
    
    // Generate a unique filename for the report
    const reportId = uuidv4();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `report-${timestamp}-${reportId}.html`;
    const filePath = path.join(REPORTS_DIR, filename);
    
    // Write the HTML report to the file
    await fs.writeFile(filePath, body.htmlReport, 'utf-8');
    
    // Return the URL to access the report
    const reportUrl = `/reports/${filename}`;
    
    return NextResponse.json({
      reportUrl,
      message: 'Report saved successfully',
    });
  } catch (error) {
    console.error('Error saving report:', error);
    return NextResponse.json(
      { error: 'Failed to save report' },
      { status: 500 }
    );
  }
} 
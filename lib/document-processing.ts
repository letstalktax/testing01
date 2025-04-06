import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { writeFile } from 'fs/promises';

// Function to save an uploaded file to disk
export async function saveUploadedFile(
  file: File,
  directory: string = 'uploads'
): Promise<{ filePath: string; fileName: string; fileType: string }> {
  try {
    // Create unique filename with UUID
    const fileName = `${uuidv4()}-${file.name}`;
    
    // Get file extension
    const fileType = path.extname(file.name);
    
    // Make sure directory exists
    const uploadDir = path.join(process.cwd(), 'public', directory);
    await fs.mkdir(uploadDir, { recursive: true });
    
    // Convert file to array buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Save file to disk
    const filePath = path.join(uploadDir, fileName);
    await writeFile(filePath, buffer);
    
    // Return file info
    return {
      filePath,
      fileName,
      fileType,
    };
  } catch (error) {
    console.error('Error saving file:', error);
    throw new Error(`Failed to save file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Function to extract text from files based on type
export async function extractTextFromFile(filePath: string, fileType: string): Promise<string> {
  try {
    if (fileType === '.txt') {
      // For text files, just read the content
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } else if (fileType === '.pdf') {
      try {
        // Dynamically import pdf-parse to prevent server issues
        const pdfParse = (await import('pdf-parse')).default;
        const dataBuffer = await fs.readFile(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text;
      } catch (pdfError) {
        console.error('Error parsing PDF:', pdfError);
        return `[PDF Content from ${path.basename(filePath)}] - Unable to extract text: ${pdfError instanceof Error ? pdfError.message : String(pdfError)}`;
      }
    } else if (fileType === '.doc' || fileType === '.docx') {
      try {
        // Dynamically import mammoth for Word documents
        const mammoth = await import('mammoth');
        const buffer = await fs.readFile(filePath);
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      } catch (docError) {
        console.error('Error parsing Word document:', docError);
        return `[Word Document Content from ${path.basename(filePath)}] - Unable to extract text: ${docError instanceof Error ? docError.message : String(docError)}`;
      }
    } else {
      return `Unsupported file format: ${fileType}`;
    }
  } catch (error) {
    console.error('Error extracting text:', error);
    throw new Error(`Failed to extract text: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Save the generated HTML report to a file
export async function saveHtmlReport(html: string, fileName: string = `report-${new Date().toISOString()}-${uuidv4()}.html`): Promise<string> {
  try {
    // Create reports directory if it doesn't exist
    const reportsDir = path.join(process.cwd(), 'public', 'reports');
    await fs.mkdir(reportsDir, { recursive: true });
    
    // Full path for the report file
    const reportPath = path.join(reportsDir, fileName);
    
    // Save HTML content to file
    await fs.writeFile(reportPath, html, 'utf-8');
    
    // Return the relative path for public access
    return `/reports/${fileName}`;
  } catch (error) {
    console.error('Error saving HTML report:', error);
    throw new Error(`Failed to save HTML report: ${error instanceof Error ? error.message : String(error)}`);
  }
} 
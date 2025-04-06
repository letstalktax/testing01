import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { writeFile } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { saveUploadedFile, extractTextFromFile, saveHtmlReport } from '@/lib/document-processing';
import { storeDocumentInfo } from '@/lib/db';

// Function to read the knowledge base
async function readKnowledgeBase(): Promise<string> {
  try {
    const kbPath = path.join(process.cwd(), 'CTKB.txt');
    try {
      // Check if file exists first
      await fs.access(kbPath);
      const content = await fs.readFile(kbPath, 'utf-8');
      return content;
    } catch (fileError) {
      console.warn('Knowledge base file not found, creating a default one:', fileError);
      
      // Create a default knowledge base file if it doesn't exist
      const defaultContent = 'This is a sample knowledge base for testing purposes.\n';
      try {
        await fs.writeFile(kbPath, defaultContent);
        console.log('Created default knowledge base file at:', kbPath);
        return defaultContent;
      } catch (writeError) {
        console.error('Failed to create default knowledge base file:', writeError);
        return 'Default knowledge base (in-memory): This is a sample knowledge base for testing purposes.';
      }
    }
  } catch (error) {
    console.error('Error reading knowledge base:', error);
    return 'Error reading knowledge base: ' + (error instanceof Error ? error.message : String(error));
  }
}

// Add retry logic with exponential backoff
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (error instanceof Error && (error.message.includes('503') || error.message.includes('overloaded'))) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  
  throw lastError;
}

// Function to generate AI analysis using Google's Gemini API
async function generateAIAnalysis(documentText: string, knowledgeBaseText: string): Promise<{ htmlReport: string, summary: string }> {
  try {
    console.log('Generating AI analysis...');
    
    // Optimize the input size by truncating if necessary
    const maxInputLength = 900000; // Keep this high to allow for large documents
    const truncatedDocumentText = documentText.length > maxInputLength 
      ? documentText.substring(0, maxInputLength) + '...' 
      : documentText;
    
    const truncatedKnowledgeBase = knowledgeBaseText.length > maxInputLength 
      ? knowledgeBaseText.substring(0, maxInputLength) + '...' 
      : knowledgeBaseText;
    
    // Initialize Google AI with proper API key validation
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('Google API key is missing. Please set the GOOGLE_API_KEY environment variable.');
    }
    
    // Try multiple model options in case the first one fails
    const modelOptions = [
      'gemini-2.0-flash-thinking-exp-01-21',  // First choice - our preferred model
      'gemini-pro',                           // Fallback - more stable model
      'gemini-1.5-flash'                      // Second fallback
    ];
    
    let lastError: Error | null = null;
    
    // Try each model in sequence until one works
    for (const modelName of modelOptions) {
      try {
        console.log(`Attempting to use model: ${modelName}`);
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 65536,
          }
        });

        // Updated system prompt with new UAE Corporate Tax advisor role
        const systemPrompt = `**Act as an expert UAE Corporate Tax advisor.** Your task is to analyze the provided financial statements (OCR text below/uploaded data) for [Specify Company Name if known, otherwise state 'the company'] for the financial year ending [Specify Date if known, otherwise state 'the specified date']. Based *only* on these financial statements and the comprehensive UAE Corporate Tax Knowledge Base (assume access), generate a detailed Corporate Tax Analysis Report.

**Output Requirements:**

1.  **Format:** The output *must* be a single, complete HTML file.
2.  **Structure:** The report *must* follow this structure:
    *   HTML Head (Title, Meta, Embedded CSS)
    *   Body:
        *   Header Section (with specified logo on the right)
        *   H1 Title: Corporate Tax Analysis Report
        *   H2 Subtitle: [Company Name]
        *   H3 Subtitle: For the Financial Year Ended [Date]
        *   Executive Summary (within a styled summary box)
        *   Section 1: Company Overview & CT Applicability (use a table)
        *   Section 2: Accounting & Financial Statements Analysis (use a table)
        *   Section 3: Revenue & Small Business Relief (SBR) Analysis (use a table)
        *   Section 4: Taxable Income Calculation - Key Adjustments & Considerations (use a detailed table with columns: 'Area', 'Details & CT Implications', 'Flags & Recommendations based on Financials')
        *   Section 5: Specific Issues & Flags from Financial Statements (use a table with columns: 'Issue', 'Observation & Potential CT Impact / Risk')
        *   Section 6: Actionable Recommendations (use a numbered list)
        *   Section 7: Conclusion
        *   Footer Section (with specified disclaimer)`;

        // Combine document text and knowledge base for the AI model
        const userPrompt = `DOCUMENT TEXT: ${truncatedDocumentText}
KNOWLEDGE BASE: ${truncatedKnowledgeBase}`;

        // Use retry logic for the API call
        const result = await retryWithBackoff(async () => {
          const result = await model.generateContent([
            { text: systemPrompt },
            { text: userPrompt }
          ]);
          
          const response = await result.response;
          return response.text();
        }, 3, 2000); // Increase delay for better chance of success
        
        let text = result;
        
        // Remove any markdown code block syntax if present
        text = text.replace(/```html/g, '').replace(/```/g, '');
        
        // Check if the result is actual HTML content
        if (!text.includes('<html') && !text.includes('<!DOCTYPE')) {
          // Wrap plain text in HTML structure if needed
          text = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Corporate Tax Analysis Report</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1, h2, h3 { color: #2c3e50; }
    .summary-box { background-color: #f8f9fa; border-left: 4px solid #4a6fa5; padding: 15px; margin: 20px 0; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { padding: 12px; border: 1px solid #ddd; }
    th { background-color: #f2f2f2; text-align: left; }
    .flag { color: #e74c3c; font-weight: bold; }
    .finding { color: #3498db; }
    .recommendation { color: #27ae60; }
    .header, .footer { display: flex; justify-content: space-between; align-items: center; padding: 20px 0; }
    .logo { max-width: 200px; height: auto; }
    .footer { margin-top: 30px; border-top: 1px solid #eee; font-size: 0.9em; color: #7f8c8d; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Corporate Tax Analysis Report</h1>
  </div>
  ${text}
  <div class="footer">
    <p>Disclaimer: This report is based solely on the financial statements provided and general UAE Corporate Tax knowledge. It is not a substitute for professional tax advice tailored to your specific circumstances. Please consult with a qualified tax professional before making any tax-related decisions.</p>
  </div>
</body>
</html>`;
        }

        // Generate a simple summary
        let summary = "Financial document analysis completed. ";
        
        // Extract company name if available
        const companyNameMatch = text.match(/<h2[^>]*>([^<]+)<\/h2>/i);
        if (companyNameMatch && companyNameMatch[1]) {
          summary += `Company: ${companyNameMatch[1].trim()}. `;
        }
        
        // Extract a brief conclusion if available
        const conclusionMatch = text.match(/<h2[^>]*>Conclusion<\/h2>([^<]+)<p>([^<]+)<\/p>/i);
        if (conclusionMatch && conclusionMatch[2]) {
          summary += `Summary: ${conclusionMatch[2].trim().substring(0, 150)}...`;
        } else {
          summary += "The report provides a detailed tax analysis based on the provided financial statements.";
        }
        
        return {
          htmlReport: text,
          summary: summary
        };
      } catch (modelError) {
        console.error(`Error with model ${modelName}:`, modelError);
        lastError = modelError instanceof Error ? modelError : new Error(String(modelError));
        // Continue to the next model option
      }
    }
    
    // If all models failed, throw the last error
    throw lastError || new Error('All AI models failed to generate content');
    
  } catch (error) {
    console.error('Error in AI analysis:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Return a formatted error as HTML
    const errorHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Analysis Error</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #e74c3c; }
    .error-box { background-color: #fdf3f2; border-left: 4px solid #e74c3c; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <h1>Analysis Error</h1>
  <div class="error-box">
    <p>We encountered an error while analyzing your document:</p>
    <p><strong>${errorMessage}</strong></p>
    <p>Please try again later or contact support if the problem persists.</p>
  </div>
</body>
</html>`;

    return {
      htmlReport: errorHtml,
      summary: `Error during analysis: ${errorMessage.substring(0, 100)}...`
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string || 'anonymous';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Save uploaded file
    const { filePath, fileName, fileType } = await saveUploadedFile(file);

    // Extract text from file
    const documentText = await extractTextFromFile(filePath, fileType);

    // Read knowledge base
    const knowledgeBaseText = await readKnowledgeBase();

    // Generate AI analysis
    const { htmlReport, summary } = await generateAIAnalysis(documentText, knowledgeBaseText);

    // Save HTML report to file
    const reportFileName = `report-${new Date().toISOString().replace(/:/g, '-')}-${uuidv4()}.html`;
    const reportUrl = await saveHtmlReport(htmlReport, reportFileName);

    // Store document info in database
    const docId = uuidv4();
    try {
      await storeDocumentInfo(
        userId,
        docId,
        fileName,
        fileType,
        summary
      );
    } catch (dbError) {
      console.error('Database error when storing document info:', dbError);
      // Continue processing even if database storage fails
    }

    // Return success response
    return NextResponse.json({
      success: true,
      reportUrl,
      docId,
      summary
    });
  } catch (error) {
    console.error('Error processing document:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process document',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 
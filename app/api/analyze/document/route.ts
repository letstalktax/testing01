import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { writeFile } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';

// Import libraries with proper error handling
let pdfParse: any;
let mammoth: any;

try {
  // The pdf-parse library is looking for a test file in './test/data/05-versions-space.pdf'
  // Try to create the directory structure if it doesn't exist
  const testDir = path.join(process.cwd(), 'test', 'data');
  fs.mkdir(testDir, { recursive: true }).catch(err => 
    console.warn('Could not create test directory for pdf-parse:', err)
  );
  
  pdfParse = require('pdf-parse');
} catch (err) {
  console.warn('pdf-parse library failed to load, falling back to basic handling:', err);
  pdfParse = null;
}

try {
  mammoth = require('mammoth');
} catch (err) {
  console.warn('mammoth library failed to load, falling back to basic handling:', err);
  mammoth = null;
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

// Function to extract text from files based on type
async function extractTextFromFile(filePath: string, fileType: string): Promise<string> {
  try {
    if (fileType === '.txt') {
      // For text files, just read the content
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } else if (fileType === '.pdf') {
      // Use pdf-parse to extract text from PDF if available
      if (pdfParse) {
        try {
          const dataBuffer = await fs.readFile(filePath);
          const data = await pdfParse(dataBuffer);
          return data.text;
        } catch (pdfError: unknown) {
          console.error('Error parsing PDF:', pdfError);
          const errorMessage = pdfError instanceof Error ? pdfError.message : String(pdfError);
          return `[PDF Content from ${path.basename(filePath)}] - Unable to extract text: ${errorMessage}`;
        }
      } else {
        return `[PDF Content from ${path.basename(filePath)}] - Text extraction simulated (pdf-parse unavailable)`;
      }
    } else if (fileType === '.doc' || fileType === '.docx') {
      // Use mammoth to extract text from Word documents if available
      if (mammoth) {
        try {
          const buffer = await fs.readFile(filePath);
          const result = await mammoth.extractRawText({ buffer });
          return result.value;
        } catch (docError: unknown) {
          console.error('Error parsing Word document:', docError);
          const errorMessage = docError instanceof Error ? docError.message : String(docError);
          return `[Word Document Content from ${path.basename(filePath)}] - Unable to extract text: ${errorMessage}`;
        }
      } else {
        return `[Word Document Content from ${path.basename(filePath)}] - Text extraction simulated (mammoth unavailable)`;
      }
    } else {
      return `Unsupported file format: ${fileType}`;
    }
  } catch (error) {
    console.error('Error extracting text:', error);
    throw new Error(`Failed to extract text: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Function to read the CTKB.txt knowledge base
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

// Function to generate AI analysis using OpenRouter's Gemini API
async function generateAIAnalysis(documentText: string, knowledgeBaseText: string): Promise<{ htmlReport: string, summary: string }> {
  try {
    console.log('Preparing AI analysis prompt...');
    
    // Optimize the input size by truncating if necessary
    const maxInputLength = 900000; // Keep this high to allow for large documents
    const truncatedDocumentText = documentText.length > maxInputLength 
      ? documentText.substring(0, maxInputLength) + '...' 
      : documentText;
    
    const truncatedKnowledgeBase = knowledgeBaseText.length > maxInputLength 
      ? knowledgeBaseText.substring(0, maxInputLength) + '...' 
      : knowledgeBaseText;
    
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
        *   Footer Section (with specified disclaimer)
3.  **Content - Detailed Analysis (Mandatory Sections):**
    *   **Executive Summary:** Provide a concise overview of the company's CT position, key findings, risks, and high-level recommendations.
    *   **Company Overview & CT Applicability:** Identify Entity Name, Reporting Period, Principal Activity (cite FS source), Legal Form. Determine likely CT Status (Resident/Non-Resident Juridical/Natural), state CT registration obligation, likely first CT period, and first filing/payment deadline (cite relevant KB sources like \`CTGGCT1\`, \`CTGRJP1\`, CT Law Articles). Use a table.
    *   **Accounting & FS Analysis:** Analyze Accounting Standards used (IFRS/SMEs), Basis of Accounting (Accrual/Cash - check revenue threshold), Audit Requirement (check revenue threshold >AED 50m, cite \`Ministerial Decision 82\`, \`CTGACS1\`), and Statement Type (Standalone/Consolidated - mention Tax Group implications, cite \`CTGTGR1\`). Cite FS sources and relevant KB guides. Use a table.
    *   **Revenue & SBR Analysis:** Identify reported Revenue (cite FS source). Compare against the AED 3m SBR threshold. Conclude definitively on SBR eligibility (cite \`CTGSBR1\`, \`Ministerial Decision 73\`). Use a table.
    *   **Taxable Income Calculation:** Start with Accounting Income/Loss (cite FS source). Systematically analyze *each* potential adjustment area listed below. For each area:
        *   Identify relevant figures/information from the FS (cite page/note).
        *   State the applicable UAE CT rule/principle from the KB (cite specific guide like \`CTGGCT1\`, \`CTGACS1\`, \`CTGTP1\`, \`CTGEXI1\`, CT Law Articles, Decisions).
        *   Determine the finding/implication for the company.
        *   Use \`<span class="flag">\` for risks/non-compliance, \`<span class="finding">\` for confirmations/neutral findings, and \`<span class="recommendation">\` for suggested actions/further checks.
        *   Present this analysis clearly, preferably within the specified table format.
        *   **Adjustment Areas to Cover:**
            *   Pre-CT Losses (Non-deductibility)
            *   Future Tax Losses (Carry-forward rules, 75% cap, ownership change impact)
            *   Related Party Transactions / Transfer Pricing (TP) (Identify balances/transactions, state Arm's Length Principle, TP documentation needs - Disclosure Form, Master/Local File thresholds, cite \`CTGTP1\`, \`Min Dec 97\`)
            *   Interest Expenditure (Identify finance costs, check General Interest Deduction Limit - AED 12m/30% EBITDA, check Specific Interest Deduction Limit - RP loans, cite \`CTGGCT1\`, \`Min Dec 126\`)
            *   Depreciation & Amortisation (General deductibility, link to business use)
            *   Non-Deductible Expenses (Fines, penalties, specific donations, owner withdrawals, 50% entertainment rule, cite \`Art. 32, 33 CT Law\`, \`CTGGCT1\`)
            *   Exempt Income (Domestic dividends, Participation Exemption criteria, Foreign PE election possibility, cite \`CTGEXI1\`, \`CT Law Art. 22-24\`)
            *   Transitional Rules (Identify pre-CT assets at historical cost - Immovable Property, Intangibles, Financial Assets/Liabilities, mention election for excluding pre-CT gains/losses, cite \`Min Dec 120\`, \`CTGACS1 Sec 7\`)
            *   Realisation Basis Election (Mention option if using Accrual Basis, cite \`Art. 20(3) CT Law\`, \`CTGACS1 Sec 5\`)
    *   **Specific Issues & Flags:** Identify anomalies or high-risk items directly observed in the FS (e.g., going concern notes, unusual equity/cash flow movements, high RP balances, missing disclosures). Explain the potential CT relevance/risk. Use a table.
    *   **Actionable Recommendations:** Provide a clear, numbered list of specific actions the company should take based on the analysis and flags. Link recommendations back to the relevant findings and KB rules.
    *   **Conclusion:** Summarize the company's overall CT position, reiterate key risks and priorities for compliance.
4.  **Styling (Embedded CSS):** Use the following CSS within \`<style>\` tags in the HTML \`<head>\`:
    *   Base font: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif, 10pt, color #333.
    *   Header: Right-aligned, bottom border \`2px solid #0056b3\`, logo max-width 130px.
    *   Footer: Centered, top border \`1px solid #ccc\`, font-size 0.75em, color #777.
    *   Headings: H1 centered, \`#004085\`; H2 \`#0056b3\`, bottom border \`#aed6f1\`; H3 \`#007bff\`.
    *   Tables: 100% width, border-collapse, box-shadow \`0 1px 3px rgba(0,0,0,0.1)\`, border \`1px solid #ddd\`, padding 8px.
    *   Table Header (th): Background \`#e7f3ff\`, color \`#004085\`, font-weight 600.
    *   Table Rows: Alternating row background \`#f8f9fa\`.
    *   Summary Box: Border \`1px solid #b8daff\`, background \`#f0f8ff\`, padding 15px, margin-bottom 30px, border-radius 5px. Remove H2 border inside summary box.
    *   Flags: \`<span class="flag">\` with color \`#c82333\`, bold.
    *   Recommendations: \`<span class="recommendation">\` with color \`#0056b3\`, bold.
    *   Findings: \`<span class="finding">\` with color \`#218838\`, bold.
    *   **Reference Colors:**
        *   Financial Statement References: \`<span class="ref-audit-report">\` with color \`#28a745\` (green), italic.
        *   CT Law/KB References: \`<span class="ref-ct-law">\` with color \`#fd7e14\` (orange), italic.
    *   Lists (ul, ol): Standard padding, margin-bottom 15px, list item margin-bottom 6px. Improve list spacing within table cells.
    *   Use \`narrow-col1\` class for tables where the first column should be narrower (approx 25-30%).
5.  **Specific Content:**
    *   **Header Logo URL:** \`https://i.postimg.cc/Y9BPdcKk/1.png\`
    *   **Footer Disclaimer Text:** \`Generated using MusTax AI. This analysis is based on the provided OCR data and knowledge base ([List KB Guide Codes like CTGGCT1, CTGACS1, etc., Decisions & Articles cited]). It does not constitute professional tax advice. Consult with a qualified tax professional for specific advice tailored to your circumstances.\` (Ensure the KB list in the disclaimer is populated based on actual references used).
6.  **Tone & Quality:** Professional, formal, detailed, accurate, objective, and easy for a business user/accountant to understand. Avoid speculation beyond the provided data and KB.
7.  **Constraints:** Base the analysis *strictly* on the provided FS data and the assumed KB. Do not invent data or make assumptions beyond what is reasonable from the inputs. Clearly state when information is missing or clarification is needed.`;

    // Combine document text and knowledge base for the AI model
    const userPrompt = `DOCUMENT TEXT: ${truncatedDocumentText}
KNOWLEDGE BASE: ${truncatedKnowledgeBase}`;

    console.log('Generating AI analysis...');
    
    // Use retry logic for the API call
    const result = await retryWithBackoff(async () => {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://mustax.ai",
          "X-Title": "MusTax AI",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          "model": "google/gemini-2.0-pro-exp-02-05:free",
          "messages": [
            {
              "role": "system",
              "content": systemPrompt
            },
            {
              "role": "user",
              "content": userPrompt
            }
          ],
          "temperature": 0.7,
          "max_tokens": 65536
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}${
          errorData.error ? ` - ${errorData.error.message}` : ''
        }`);
      }

      const data = await response.json();
      
      // Handle OpenRouter response format
      if (data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content;
      } else if (data.choices && data.choices[0] && data.choices[0].content) {
        return data.choices[0].content;
      } else if (data.text) {
        return data.text;
      } else {
        console.error('Unexpected API response:', JSON.stringify(data, null, 2));
        throw new Error('Unexpected response format from OpenRouter API');
      }
    });
    
    let text = result;
    
    // Remove any markdown code block syntax if present
    text = text.replace(/```html/g, '').replace(/```/g, '');
    
    console.log('AI analysis generated successfully.');
    
    // Extract the summary if it exists
    let summary = '';
    const summaryMatch = text.match(/---SUMMARY---([\s\S]*?)---END SUMMARY---/);
    if (summaryMatch && summaryMatch[1]) {
      summary = summaryMatch[1].trim();
    }
    
    return {
      htmlReport: text,
      summary: summary
    };
  } catch (error) {
    console.error('Error generating AI analysis:', error);
    throw new Error(`Failed to generate AI analysis: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check if the request is multipart/form-data
    if (!request.headers.get('content-type')?.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Request must be multipart/form-data' }, { status: 400 });
    }

    // Parse the form data
    const formData = await request.formData();
    
    // Get the file from the form data
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    
    // Create a temporary directory for file processing
    const tempDir = path.join(os.tmpdir(), 'mustax-analysis');
    await fs.mkdir(tempDir, { recursive: true });
    
    // Generate a unique filename to avoid collisions
    const uniqueFileName = `${uuidv4()}-${file.name}`;
    const filePath = path.join(tempDir, uniqueFileName);
    
    // Save the file to the temporary directory
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, fileBuffer);
    
    console.log(`File saved to ${filePath}`);
    
    // Get the file extension
    const fileExtension = path.extname(file.name).toLowerCase();
    
    // Extract text from the uploaded document
    const documentText = await extractTextFromFile(filePath, fileExtension);
    
    // Read the knowledge base
    const knowledgeBaseText = await readKnowledgeBase();
    
    // Log the results (for verification as required)
    console.log('Document text excerpt:', documentText.substring(0, 200));
    console.log('Knowledge base excerpt:', knowledgeBaseText.substring(0, 100));
    
    // Generate AI analysis
    console.log('Generating AI analysis...');
    const analysis = await generateAIAnalysis(documentText, knowledgeBaseText);
    console.log('AI analysis generated successfully');
    
    // Clean up the temporary file
    await fs.unlink(filePath);
    
    return NextResponse.json({ 
      message: "Document analyzed successfully",
      documentPreview: documentText.substring(0, 200) + "...",
      knowledgeBasePreview: knowledgeBaseText.substring(0, 100) + "...",
      htmlReport: analysis.htmlReport,
      summary: analysis.summary
    });
  } catch (error) {
    console.error('Error processing document:', error);
    return NextResponse.json(
      { error: 'Failed to process document: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
} 
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { promises as fs } from 'fs';
import path from 'path';

// Initialize the Gemini client
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey as string);

// Configure the Gemini model
export const geminiModel = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
});

// Default generation config
export const defaultGenerationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: 'text/plain',
};

// Helper function to start a chat session
export function startGeminiChat(history: Array<{ role: string; parts: Array<{ text: string }> }> = []) {
  return geminiModel.startChat({
    generationConfig: defaultGenerationConfig,
    history,
  });
}

// Load the knowledge base file
async function loadKnowledgeBase() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'ctkb.txt');
    const knowledgeBaseContent = await fs.readFile(filePath, 'utf-8');
    return knowledgeBaseContent;
  } catch (error) {
    console.error('Error loading knowledge base:', error);
    return '';
  }
}

// Function to analyze documents using Gemini against the knowledge base
export async function analyzeWithGemini(fileName: string, fileContent: Buffer, fileType: string) {
  try {
    // Load the knowledge base content
    const knowledgeBase = await loadKnowledgeBase();
    
    // Convert file content to base64
    const fileBase64 = fileContent.toString('base64');
    
    // Create the chat session
    const chatSession = startGeminiChat();
    
    // Prepare the system prompt with context
    const systemPrompt = `You are MusTax AI Analyze, an expert tax document analysis tool.
Analyze the provided document in detail, focusing on tax implications, financial insights, and compliance considerations based on the UAE Corporate Tax context.
Reference the knowledge base provided for UAE tax regulations and compliance requirements.
Format your response in HTML with semantic markup for better presentation.
Include specific sections for:
1) Document Overview
2) Key Findings
3) Tax Implications
4) Recommendations

Knowledge Base Context:
${knowledgeBase}

Document name: ${fileName}`;

    // Send the message with the file
    const result = await chatSession.sendMessage([
      {
        text: systemPrompt
      },
      {
        inlineData: {
          mimeType: fileType,
          data: fileBase64
        }
      }
    ]);
    
    // Generate a summary for the chat interface
    const fullAnalysis = result.response.text();
    const summaryResult = await geminiModel.generateContent([
      "Create a concise 3-5 sentence summary of the following analysis:",
      fullAnalysis,
    ]);
    
    const summary = summaryResult.response.text();
    
    return {
      html: fullAnalysis,
      summary: summary
    };
  } catch (error) {
    console.error('Error analyzing with Gemini:', error);
    throw error;
  }
}

// Function to analyze financial statements for UAE Corporate Tax compliance
export async function analyzeFinancialStatements(fileName: string, fileContent: Buffer, fileType: string) {
  try {
    // Load the knowledge base content
    const knowledgeBase = await loadKnowledgeBase();
    
    // Convert file content to base64
    const fileBase64 = fileContent.toString('base64');
    
    // Create the chat session
    const chatSession = startGeminiChat();
    
    // Extract client name and date from filename (if possible)
    let clientName = "Client Company Name";
    let dateEnded = "Date";
    
    // Try to extract client name from filename (assuming format might be "CompanyName_FinancialStatements_Date.pdf")
    const fileNameParts = fileName.split('_');
    if (fileNameParts.length > 0) {
      clientName = fileNameParts[0].replace(/\.[^/.]+$/, ""); // Remove file extension
    }
    
    // Prepare the specialized financial analysis prompt
    const financialAnalysisPrompt = `You are MusTax AI Analyze, an expert UAE Corporate Tax document analysis tool. Analyze the attached financial statements for ${clientName} for the year ended ${dateEnded}, from a detailed data analysis and UAE Corporate Tax compliance perspective.

Specifically, I need the analysis to be structured as a comprehensive report with the following sections and level of detail, **including a logo header and a custom footer that repeat correctly on every printed A4 page, and using text-based tables only for data visualization (no graphs)**:

**Report Structure:**

1.  **Table of Contents:** Automatically generate a Table of Contents listing all sections and subsections with page numbers.

2.  **Executive Summary:**  A concise overview of the key findings and recommendations (approximately 1-2 paragraphs). Include a "---SUMMARY---" and "---END SUMMARY---" block around the summary text for easy extraction.

3.  **Introduction:** Briefly introduce the report's purpose and scope (1 paragraph).

4.  **Detailed Data Analysis:**
    *   **4.1 Financial Performance Highlights:**  In-depth analysis of key financial performance indicators, presented with text-based tables.  Include year-over-year trend analysis for each metric. **Do not include any graph placeholders.**
    *   **4.2 Statement of Financial Position Insights:**  Detailed insights into key balance sheet items, presented in a text-based table with trend analysis.
    *   **4.3 Statement of Cash Flows Observations:**  Key observations from the cash flow statement, presented in a text-based table with trend analysis.
    *   **4.4 Key Notes to the Financial Statements:** Summarize critical notes from the financial statements relevant to Corporate Tax, presented as a bulleted list.

5.  **UAE Corporate Tax Analysis:**
    *   **5.1 Taxable Person Status:** Clearly state the Taxable Person status of ${clientName} (Resident Juridical Person, etc.) and justify the determination based on UAE Corporate Tax Law.
    *   **5.2 Taxable Income and Rate:**
        *   State the applicable Corporate Tax rate (0% / 9%).
        *   Provide a **detailed step-by-step calculation of estimated Taxable Income**, starting from Accounting Income (Net Profit/Loss) and showing all potential adjustments (disallowable expenses, exempt income, etc.) based on the financial statements. Present this calculation in a clear text-based table format.
        *   State the estimated Corporate Tax Payable for the Tax Period.
        *   Assess eligibility for Small Business Relief, clearly stating whether the client is eligible and why/why not.
    *   **5.3 Potential Corporate Tax Adjustments & Considerations:**
        *   In-depth discussion of potential areas requiring Corporate Tax adjustments, including:
            *   **5.3.1 Related Party Transactions:**  Detailed analysis of potential Transfer Pricing risks, specific transactions requiring arm's length review, and concrete "Action Required" steps for documentation and compliance.
            *   **5.3.2 Depreciation & Amortization:**  Detailed analysis of depreciation and amortization policies and potential adjustments, with "Action Required" steps.
            *   **5.3.3 Finance Charges:**  Detailed analysis of finance charges, General Interest Deduction Limitation Rule applicability, and "Action Required" steps for calculation and documentation.
            *   **5.3.4 Accrued Expenses:** Detailed review of accrued expenses, deductibility assessment under Corporate Tax Law, and "Action Required" steps for verification.
            *   **5.3.5 Loss Carry Forward:**  Detailed explanation of Tax Loss carry forward implications and "Action Required" steps for tracking and documentation.

6.  **Compliance and Documentation Recommendations:**  A comprehensive, numbered checklist of all essential compliance and documentation recommendations, presented in a clear, actionable format.

7.  **Conclusion:**  A more extended conclusion summarizing the key takeaways and emphasizing the importance of Corporate Tax compliance for ${clientName} (approximately 2-3 paragraphs).

8.  **Disclaimer:**  Standard disclaimer.

**Formatting Requirements (HTML for Print - A4 Page Repeating Header & Footer, Text & Tables Only):**

*   **Report Format:** Generate complete HTML code for the report.
*   **Header (Repeating on Each Printed A4 Page):** Include a fixed header section at the top of the report with:
    *   **Logo:** Embed the logo image using this URL: \`<img src="https://i.postimg.cc/L5Dw0kyW/temp-Image140q-Ht.avif" alt="MusTax AI Logo" class="logo">\`. Use the CSS class \`.logo\` (defined below) for styling.
    *   **Report Title:**  Use an \`<h1>\` tag for the report title "${clientName} - UAE Corporate Tax Analysis". Ensure the header is styled using the CSS class \`.header\` (defined below) to be fixed for printing on A4 paper.
    *   **CSS Styling for Header (A4 Print Repeating):**
        \`\`\`css
        .header { display: flex; align-items: center; margin-bottom: 15px; position: fixed; top: 0; left: 0; right: 0; padding: 10mm 25mm 5mm 25mm; border-bottom: 1px solid #ddd; background-color: white;  /* Fixed header style */
            @media print {
                position: fixed; top: 0; left: 0; right: 0; /* Fixed header for print */
            }
        }
        .logo { max-height: 60px; margin-right: 15px; } /* Logo style - adjust max-height as needed */
        \`\`\`
*   **Footer (Repeating on Each Printed A4 Page):** Include a fixed footer section at the bottom of each report page with:
    *   Text: "Confidential | Prepared for: ${clientName} | Prepared by: MusTax AI powered by LetsTalkTax". Ensure the footer is styled using the CSS class \`.footer\` (defined below) to be fixed for printing on A4 paper.
    *   **CSS Styling for Footer (A4 Print Repeating):**
        \`\`\`css
        .footer { margin-top: auto; border-top: 1px solid #ddd; padding: 5mm 25mm 10mm 25mm; text-align: center; font-size: smaller; color: #777; position: fixed; bottom: 0; left: 0; right: 0; background-color: white;  /* Fixed footer style */
            @media print {
                body { margin-bottom: 30mm; } /* Increased body margin-bottom for footer */
                .footer { position: fixed; bottom: 0; left: 0; right: 0; /* Fixed footer for print */ }
            }
        }
        \`\`\`
*   **Body Margins (A4 Print Standard):**  Set body margins optimized for A4 printing, and ensure these margins are enforced during printing using \`@media print\`:
    \`\`\`css
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 25mm; /* Standard A4 print margins - adjust as needed */ display: flex; flex-direction: column; min-height: 100vh; }
        @media print {
            body { margin: 25mm; } /* Re-enforce margins for printing */
        }
    \`\`\`
*   **Headings:** Use clear, numbered headings (e.g., 1., 2., 3. etc. for main sections and 4.1, 4.2, etc. for subsections). Use bolding and different font sizes to visually distinguish headings (H1, H2, H3 tags in HTML).
*   **Tables:** Present all financial data and comparative analysis in well-structured HTML tables with clear headers, borders, and consistent cell padding. Ensure tables are visually distinct from surrounding text.
*   **Graphs:** **Do not include any graph placeholders or attempt to generate graphs. Focus on text and tables only.**
*   **Action Required Sections:**  Use bullet points within "Action Required" sections for clear, step-by-step recommendations.
*   **Margins & Spacing:** Ensure consistent and visually appealing margins and spacing throughout the report using CSS (increase margins around the \`body\` and between \`.section\` elements).

**Important Instructions:**

*   **Base the analysis ONLY on the attached financial statements and general knowledge of UAE Corporate Tax Law.** Do not make assumptions about the client's business or industry beyond what is evident in the provided financial statements.
*   **Clearly cite the relevant articles and ministerial decisions** of the UAE Corporate Tax Law where applicable to support the analysis and recommendations.
*   **Emphasize actionable recommendations** for the client to ensure compliance and optimize their tax position.
*   **Include a disclaimer** stating that the report is for informational purposes only and does not constitute professional tax advice.
*   **Do not include any graphs or graph placeholders.** Focus on text and table-based data presentation.

Knowledge Base Context for UAE CT Law:
${knowledgeBase}`;

    // Send the message with the file
    const result = await chatSession.sendMessage([
      {
        text: financialAnalysisPrompt
      },
      {
        inlineData: {
          mimeType: fileType,
          data: fileBase64
        }
      }
    ]);
    
    // Extract the full analysis
    const fullAnalysis = result.response.text();
    
    // Extract summary from the full analysis (between ---SUMMARY--- and ---END SUMMARY---)
    let summary = "";
    const summaryMatch = fullAnalysis.match(/---SUMMARY---([\s\S]*?)---END SUMMARY---/);
    if (summaryMatch && summaryMatch[1]) {
      summary = summaryMatch[1].trim();
    } else {
      // If there's no summary in the format requested, generate one
      const summaryResult = await geminiModel.generateContent([
        "Create a concise 3-5 sentence summary of the following financial statement analysis:",
        fullAnalysis,
      ]);
      summary = summaryResult.response.text();
    }
    
    return {
      html: fullAnalysis,
      summary: summary
    };
  } catch (error) {
    console.error('Error analyzing financial statements with Gemini:', error);
    throw error;
  }
}

// Process the response from Gemini
export function processGeminiResponse(response: any) {
  const candidates = response.candidates;
  const results: any[] = [];
  
  candidates.forEach((candidate: any, candidateIndex: number) => {
    candidate.content.parts.forEach((part: any, partIndex: number) => {
      if (part.inlineData) {
        results.push({
          type: 'file',
          mimeType: part.inlineData.mimeType,
          data: part.inlineData.data,
          filename: `output_${candidateIndex}_${partIndex}`
        });
      } else if (part.text) {
        results.push({
          type: 'text',
          content: part.text
        });
      }
    });
  });
  
  return results;
} 
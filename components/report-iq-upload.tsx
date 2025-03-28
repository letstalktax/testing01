'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { UploadIcon } from './icons';
import { PreviewAttachment } from './preview-attachment';
import type { Attachment, Message } from 'ai';
import { useChat } from '@ai-sdk/react';
import { generateUUID } from '@/lib/utils';
import { useDropzone } from 'react-dropzone';
import { Progress } from './ui/progress';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TaxReportPDF } from './tax-report-pdf';

interface ReportIQUploadProps {
  onDocumentProcessed: (success: boolean) => void;
  chatId: string;
}

export function ReportIQUpload({ onDocumentProcessed, chatId }: ReportIQUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const [isPendingConfirmation, setIsPendingConfirmation] = useState(false);
  const [originalFileName, setOriginalFileName] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [analysisData, setAnalysisData] = useState<{ content: string } | null>(null);
  const [showOverrideButton, setShowOverrideButton] = useState(false);
  const [analysisTime, setAnalysisTime] = useState(0);

  const { append, messages } = useChat({
    id: chatId,
    body: { id: chatId },
    generateId: generateUUID,
  });

  // Listen for AI responses to detect when analysis is complete
  useEffect(() => {
    if (isAnalyzing && messages.length > 0) {
      // Look for the last assistant message after analysis started
      const assistantMessages = messages.filter(msg => msg.role === 'assistant');
      if (assistantMessages.length > 0) {
        const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
        
        // Check if the message contains analysis content with more flexible conditions
        // Consider analysis complete if the message is substantial and contains any of these keywords
        const isSubstantialMessage = lastAssistantMessage.content.length > 1000;
        const hasAnalysisKeywords = 
          lastAssistantMessage.content.includes('Executive Summary') || 
          lastAssistantMessage.content.includes('Financial Data') ||
          lastAssistantMessage.content.includes('Tax Calculation') ||
          lastAssistantMessage.content.includes('Recommendations') ||
          lastAssistantMessage.content.includes('Analysis');
        
        if (isSubstantialMessage && hasAnalysisKeywords) {
          // Analysis is complete
          setIsAnalyzing(false);
          setAnalysisComplete(true);
          setAnalysisData({ content: lastAssistantMessage.content });
          
          // Enable chat interface
          onDocumentProcessed(true);
          toast.success('Document analyzed and ready for chat', {
            description: 'You can now ask specific questions about your document'
          });
        }
      }
    }
  }, [messages, isAnalyzing, onDocumentProcessed]);
  
  // Add a timeout to ensure the UI doesn't get stuck
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    if (isAnalyzing) {
      // Set a timeout to force-complete the analysis after 2 minutes
      timeoutId = setTimeout(() => {
        // If we're still analyzing after 2 minutes, consider it complete
        if (isAnalyzing) {
          console.log('Analysis timeout reached, enabling chat interface');
          
          // Find the last assistant message if any
          const assistantMessages = messages.filter(msg => msg.role === 'assistant');
          const lastMessage = assistantMessages.length > 0 
            ? assistantMessages[assistantMessages.length - 1] 
            : null;
          
          setIsAnalyzing(false);
          
          if (lastMessage && lastMessage.content.length > 500) {
            // We have some content, so mark as complete
            setAnalysisComplete(true);
            setAnalysisData({ content: lastMessage.content });
          }
          
          // Enable chat interface regardless
          onDocumentProcessed(true);
          toast.success('Document ready for chat', {
            description: 'You can now ask questions about your document'
          });
        }
      }, 120000); // 2 minutes
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isAnalyzing, messages, onDocumentProcessed]);

  // Add a timer to track analysis time and show override button
  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null;
    
    if (isAnalyzing) {
      // Reset analysis time when analysis starts
      setAnalysisTime(0);
      setShowOverrideButton(false);
      
      // Start a timer to update analysis time every second
      timerId = setInterval(() => {
        setAnalysisTime(prev => {
          const newTime = prev + 1;
          
          // Show override button after 30 seconds
          if (newTime >= 30 && !showOverrideButton) {
            setShowOverrideButton(true);
          }
          
          return newTime;
        });
      }, 1000);
    } else {
      // Reset when not analyzing
      setAnalysisTime(0);
      setShowOverrideButton(false);
    }
    
    return () => {
      if (timerId) {
        clearInterval(timerId);
      }
    };
  }, [isAnalyzing, showOverrideButton]);

  const startBuffering = useCallback(() => {
    setProgress(0);
    const duration = 5000; // 5 seconds
    const interval = 50; // Update every 50ms
    const steps = duration / interval;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const newProgress = (currentStep / steps) * 100;
      
      if (currentStep >= steps) {
        clearInterval(timer);
        setProgress(100);
        setIsProcessing(false);
        setIsAnalyzing(true); // Start analysis phase after buffering
      } else {
        setProgress(newProgress);
      }
    }, interval);
  }, []);

  // Custom prompt for document analysis
  const analysisPrompt = `You are MusTax AI, an AI assistant tasked with analyzing audit reports uploaded by users to provide detailed tax-related insights and recommendations. The user is a [individual/business] located in [user's location]. Your goal is to deliver a comprehensive, accurate, and user-friendly analysis that helps the user understand their tax situation and optimize their tax obligations. Follow these steps to process the document:

Data Extraction:
Extract all key financial data from the audit report, including but not limited to:
Total revenue
Total expenses (with a breakdown by major categories if available, e.g., administrative, operating)
Net income or loss
Total assets
Total liabilities
Depreciation (for all asset types, e.g., property, plant, equipment, right-of-use assets)
Amortization (e.g., intangible assets like software)
Interest expenses
Other relevant figures (e.g., charitable contributions, tax credits, provisions)
Source these from standard sections like the balance sheet, income statement, cash flow statement, and notes.
If data is missing, unclear, or requires interpretation (e.g., depreciation schedules), note this explicitly and make reasonable assumptions where possible, explaining them in the report.
Knowledge Base Query:
Use the extracted data to query the Pinecone knowledge base for:
Tax laws and rates applicable to [individual/business] in [user's location] (e.g., UAE corporate tax effective June 2023, VAT rules)
Standard tax calculation formulas and allowable deductions
Industry benchmarks or similar cases (e.g., typical expense ratios, depreciation rates) for comparison
Cross-reference the report's data with this information to identify compliance gaps or opportunities.
Tax Calculation:
Calculate estimated taxes based on retrieved tax laws and formulas, considering:
Current tax obligations (e.g., VAT if applicable)
Future tax liabilities under new regimes (e.g., UAE corporate tax)
Potential benefits like loss carryforwards or deductions
Show each step of the calculation transparently, including assumptions (e.g., tax rate applied, taxable income adjustments).
Analysis and Recommendations:
Analyze the report for:
Tax-saving opportunities (e.g., unclaimed deductions, optimized depreciation methods)
Potential errors or risks (e.g., misclassified expenses, overstated income)
Financial health indicators (e.g., negative equity, high expense ratios)
Provide specific, evidence-based recommendations, such as:
"Adjust depreciation on X assets to Y method to reduce taxable income by Z."
"Review AED X in [expense category] for potential misclassification; reclassifying could save AED Y in taxes."
"With a net loss of AED X, consider carrying it forward to offset future tax liabilities under the new regime."
For uncertain areas, offer informed general advice (e.g., "High administrative costs suggest a review of [specific category]") and recommend professional consultation only as a secondary step.
Report Generation:
Produce a structured report with these sections:
Executive Summary: Concise overview of key findings (e.g., tax liability estimate, top 2-3 recommendations).
Financial Data Extraction: Detailed list of extracted figures with sources (e.g., "Depreciation: AED X from Note Y").
Tax Calculation: Step-by-step breakdown of current and projected tax estimates.
Analysis and Recommendations: In-depth insights and specific, actionable suggestions, supported by data and knowledge base findings.
Limitations: Note missing data, assumptions, or uncertainties (e.g., "Depreciation method assumed as straight-line due to lack of detail").
Use clear, concise language, avoiding jargon unless explained (e.g., "Negative equity means liabilities exceed assets, indicating financial strain").
Include a disclaimer: "This analysis is for informational purposes only and should be verified by a qualified tax professional."
Objective:
Deliver a thorough, compliant, and practical analysis that empowers the user with clear insights and steps to optimize their tax and financial strategy, leveraging the audit report and Pinecone knowledge base fully.`;

  // Function to run initial document analysis
  const runInitialAnalysis = async () => {
    try {
      // Add a system message indicating analysis is starting
      await append({
        id: generateUUID(),
        role: 'system',
        content: 'Analyzing your document to provide initial tax insights...'
      });

      // Add the analysis prompt as a system message
      await append({
        id: generateUUID(),
        role: 'system',
        content: analysisPrompt
      });

      // Add a user message to trigger the AI response with instruction to use more embeddings
      await append({
        id: generateUUID(),
        role: 'user',
        content: `Please analyze the uploaded document "${originalFileName}" and provide tax insights based on its contents. Use as many embeddings as possible (at least 20) to ensure comprehensive analysis of the entire document.`
      });

      // The AI will automatically respond to this message
      // The useEffect hook will detect when analysis is complete and enable the chat interface
    } catch (error) {
      console.error('Error during initial analysis:', error);
      setIsAnalyzing(false);
      onDocumentProcessed(true); // Still enable chat even if analysis fails
      toast.error('Error during document analysis', {
        description: 'You can still ask questions about your document'
      });
    }
  };

  const uploadFile = async (file: File): Promise<Attachment | undefined> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;
        return { url, name: pathname, contentType };
      }
      
      const { error } = await response.json();
      toast.error(error);
      return undefined;
    } catch (error) {
      toast.error('Failed to upload file, please try again!');
      return undefined;
    }
  };

  const processDocumentInBackground = async (file: File) => {
    try {
      // Add initial messages to indicate processing
      await append({
        id: generateUUID(),
        role: 'system',
        content: 'Your document is being processed. Please wait while I analyze it.'
      });

      // Process document in background
        const formData = new FormData();
        formData.append('file', file);
        
      const response = await fetch('/api/temp-documents', {
          method: 'POST',
          body: formData,
        });
        
        if (response.ok) {
        // Document processed successfully, now run the analysis
        await runInitialAnalysis();
        } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        console.error('Processing error:', errorData.error);
        await append({
          id: generateUUID(),
          role: 'system',
          content: 'There was an issue processing your document. I\'ll do my best to answer your questions with limited context.'
        });
        setIsAnalyzing(false);
        onDocumentProcessed(true); // Still enable chat even if processing fails
      }
    } catch (error) {
      console.error('Error in background processing:', error);
      setIsAnalyzing(false);
      onDocumentProcessed(true); // Still enable chat even if processing fails
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    setError(null);
    
    const file = acceptedFiles[0];
    setOriginalFileName(file.name);

    try {
      // Upload file to get attachment
      const attachment = await uploadFile(file);
      if (attachment) {
        setAttachments([{ ...attachment, name: file.name }]);
        setIsPendingConfirmation(true);
      } else {
        throw new Error('Failed to upload document');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process document');
      setIsPendingConfirmation(false);
      onDocumentProcessed(false);
    }
  }, []);

  const handleConfirmDocument = async () => {
    if (attachments.length === 0) return;
    
    setIsProcessing(true);
    setIsPendingConfirmation(false);
    
    try {
      // Clear any existing temporary embeddings first
      await clearTemporaryEmbeddings();
      
      // Get the file from the attachment
      const response = await fetch(attachments[0].url);
      const blob = await response.blob();
      const file = new File([blob], attachments[0].name || 'unnamed-file', { type: attachments[0].contentType || 'application/octet-stream' });
      
      // Start buffering animation
      startBuffering();
      
      // Process document in background
      setTimeout(() => processDocumentInBackground(file), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process document');
      setIsProcessing(false);
      onDocumentProcessed(false);
    }
  };

  // Function to clear temporary embeddings
  const clearTemporaryEmbeddings = async () => {
    try {
      // Call the cleanup endpoint to clear temporary embeddings
      const response = await fetch('/api/temp-documents/cleanup', {
        method: 'POST',
      });
      
      if (!response.ok) {
        console.warn('Failed to clear temporary embeddings:', await response.text());
      }
    } catch (error) {
      console.error('Error clearing temporary embeddings:', error);
      // Continue with document processing even if cleanup fails
    }
  };

  const handleRemoveDocument = () => {
    setAttachments([]);
    setIsPendingConfirmation(false);
    setError(null);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    multiple: false,
    disabled: isProcessing || isAnalyzing
  });

  // Function to manually complete analysis
  const handleManualComplete = () => {
    // Find the last assistant message if any
    const assistantMessages = messages.filter(msg => msg.role === 'assistant');
    const lastMessage = assistantMessages.length > 0 
      ? assistantMessages[assistantMessages.length - 1] 
      : null;
    
    setIsAnalyzing(false);
    
    if (lastMessage && lastMessage.content.length > 500) {
      // We have some content, so mark as complete
      setAnalysisComplete(true);
      setAnalysisData({ content: lastMessage.content });
    }
    
    // Enable chat interface regardless
    onDocumentProcessed(true);
    toast.success('Document ready for chat', {
      description: 'You can now ask questions about your document'
    });
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300',
          (isProcessing || isAnalyzing) ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-500 hover:bg-gray-50',
          isPendingConfirmation ? 'border-blue-500 bg-blue-50/50' : ''
        )}
      >
        <input {...getInputProps()} />
        
        {isProcessing ? (
          <div className="space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
            <p className="text-sm text-gray-600">Processing document...</p>
            <Progress value={progress} className="w-full max-w-md mx-auto" />
      </div>
        ) : isAnalyzing ? (
          <div className="space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
            <p className="text-sm text-gray-600">Analyzing document for tax insights...</p>
            <p className="text-xs text-gray-500">This may take a moment ({analysisTime}s)</p>
            
            {showOverrideButton && (
              <div className="mt-4">
        <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleManualComplete();
                  }}
          variant="outline"
                  className="bg-white hover:bg-gray-50 dark:bg-zinc-800 dark:hover:bg-zinc-700"
        >
                  Skip Analysis and Continue
        </Button>
              </div>
            )}
          </div>
        ) : isPendingConfirmation && attachments.length > 0 ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-blue-500"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                      />
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {originalFileName || 'Document'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Ready to process
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-center gap-4 mt-4">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveDocument();
                }}
                variant="outline"
                className="bg-white hover:bg-gray-50 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              >
                Remove Document
              </Button>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleConfirmDocument();
                }}
                className="bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                Process Document
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-lg font-medium text-gray-900">
              {isDragActive ? 'Drop your document here' : 'Drag & drop your document here'}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              or click to select a file (PDF, DOC, DOCX, or TXT)
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* PDF Report Download Button */}
      {analysisComplete && analysisData && (
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Tax Analysis Report Ready
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Your tax analysis report is ready. You can download it as a PDF with detailed insights, charts, and recommendations.
          </p>
          <TaxReportPDF analysisData={analysisData} documentName={originalFileName} />
        </div>
      )}
    </div>
  );
} 
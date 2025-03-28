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
import { v4 as uuidv4 } from 'uuid';
import { Input } from '@/components/ui/input';

interface ExtendedAttachment extends Attachment {
  id: string;
}

interface AnalyzeUploadProps {
  onDocumentProcessed: (success: boolean) => void;
  chatId: string;
}

export function AnalyzeUpload({ onDocumentProcessed, chatId }: AnalyzeUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Array<ExtendedAttachment>>([]);
  const [isPendingConfirmation, setIsPendingConfirmation] = useState(false);
  const [originalFileName, setOriginalFileName] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [analysisData, setAnalysisData] = useState<{ html: string; summary: string } | null>(null);
  const [showViewReportButton, setShowViewReportButton] = useState(false);
  const [analysisTime, setAnalysisTime] = useState(0);
  const [showReportUrl, setShowReportUrl] = useState<string | null>(null);

  const { append, messages } = useChat({
    id: chatId,
    body: { id: chatId },
    generateId: generateUUID,
  });

  // Monitor analysis progress
  useEffect(() => {
    if (isAnalyzing) {
      const interval = setInterval(() => {
        setAnalysisTime(prev => prev + 1);
        // Simulate progress - actual progress would come from backend
        setProgress(prev => Math.min(prev + 0.5, 95));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isAnalyzing]);

  // Add a timeout to ensure the UI doesn't get stuck
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    if (isAnalyzing) {
      // Set a timeout to force-complete the analysis after 3 minutes
      timeoutId = setTimeout(() => {
        if (isAnalyzing) {
          console.log('Analysis timeout reached');
          setIsAnalyzing(false);
          setAnalysisComplete(false);
          
          toast.error('Analysis taking longer than expected', {
            description: 'Please try again with a smaller document'
          });
        }
      }, 180000); // 3 minutes
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isAnalyzing]);

  // Process document and generate analysis
  const analyzeDocument = async (attachment: ExtendedAttachment) => {
    try {
      setIsAnalyzing(true);
      setProgress(10);
      
      // Prepare the document for analysis
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          attachmentId: attachment.id,
          fileName: originalFileName,
          chatId: chatId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error analyzing document: ${response.statusText}`);
      }

      const data = await response.json();
      setProgress(100);
      
      if (data.success) {
        setAnalysisComplete(true);
        setAnalysisData({
          html: data.html,
          summary: data.summary
        });
        
        setShowViewReportButton(true);
        setShowReportUrl(data.reportUrl);
        
        // Add the summary to chat for context in follow-up questions
        await append({
          role: 'system',
          content: `Document has been analyzed. Analysis summary: ${data.summary}`,
        });
        
        // Enable chat interface for follow-up questions
        onDocumentProcessed(true);
        
        toast.success('Document analyzed successfully', {
          description: 'You can now view the report or ask follow-up questions'
        });
      } else {
        throw new Error(data.error || 'Unknown error during analysis');
      }
    } catch (error) {
      console.error('Error during document analysis:', error);
      setError((error as Error).message || 'Failed to analyze document');
      toast.error('Analysis failed', {
        description: (error as Error).message || 'Please try again with a different document'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle file upload
  const uploadFile = async (file: File): Promise<ExtendedAttachment | undefined> => {
    try {
      setOriginalFileName(file.name);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Error uploading file: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        id: data.url,
        name: file.name,
        contentType: file.type,
        url: data.url || URL.createObjectURL(file),
      };
    } catch (error) {
      console.error('Error uploading document:', error);
      setError((error as Error).message || 'Failed to upload document');
      toast.error('Upload failed', {
        description: (error as Error).message || 'Please try again'
      });
      return undefined;
    }
  };

  // Handle file drop
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      
      setError(null);
      setIsProcessing(true);
      setProgress(0);
      
      try {
        const file = acceptedFiles[0];
        
        // Check file size (limit to 10MB)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error('File size exceeds 10MB limit');
        }
        
        const attachment = await uploadFile(file);
        if (!attachment) return;
        
        setAttachments([attachment]);
        setIsPendingConfirmation(true);
        toast.success('Document uploaded', {
          description: 'Ready for analysis. Click Analyze to continue.'
        });
      } catch (error) {
        console.error('Error handling file:', error);
        setError((error as Error).message || 'Failed to process file');
        toast.error('Processing failed', {
          description: (error as Error).message || 'Please try again'
        });
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  // Configure dropzone
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
    maxFiles: 1,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    }
  });

  // Handle document analysis confirmation
  const handleConfirmAnalysis = async () => {
    if (attachments.length === 0) return;
    
    setIsPendingConfirmation(false);
    await analyzeDocument(attachments[0]);
  };

  // Open report in new tab
  const handleViewReport = () => {
    if (showReportUrl) {
      window.open(showReportUrl, '_blank');
    }
  };
  
  // Reset and cancel
  const handleCancel = () => {
    setAttachments([]);
    setIsPendingConfirmation(false);
    setIsAnalyzing(false);
    setAnalysisComplete(false);
    setAnalysisData(null);
    setShowViewReportButton(false);
    setProgress(0);
    setError(null);
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4">
      <div className="rounded-lg border bg-background p-8">
        <h2 className="text-xl font-bold mb-2">MusTax AI Analyze</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Upload a document to get detailed analysis and insights. Once processed, you can
          view a comprehensive report and ask follow-up questions.
        </p>

        {/* Simple Document Upload Interface */}
        <div className="mb-6 p-4 border border-dashed rounded-lg">
          <div className="flex flex-col space-y-4">
            <label htmlFor="documentUpload" className="text-sm font-medium">
              Select a document to analyze:
            </label>
            <Input
              type="file"
              id="documentUpload"
              accept=".pdf,.doc,.docx,.txt"
              className="cursor-pointer"
              onChange={(e) => {
                const fileName = e.target.files?.[0]?.name;
                if (fileName) {
                  console.log(`File selected: ${fileName}`);
                }
              }}
            />
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  const fileInput = document.getElementById('documentUpload') as HTMLInputElement;
                  if (!fileInput.files || fileInput.files.length === 0) {
                    toast.error('Please upload a document first');
                    return;
                  }
                  
                  const fileName = fileInput.files[0].name;
                  toast.success(`Analyzing document: ${fileName}`);
                  // Further processing would go here
                }}
              >
                Analyze Document
              </Button>
            </div>
          </div>
        </div>

        {/* Document drop area */}
        {!isPendingConfirmation && !isAnalyzing && !analysisComplete && (
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-6 transition-colors",
              isDragActive ? "border-primary/50 bg-primary/5" : "border-muted-foreground/30",
              "cursor-pointer hover:border-primary/50 hover:bg-primary/5"
            )}
            onClick={open}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <UploadIcon />
              <p className="text-sm text-muted-foreground">
                Drag & drop your document here or click to select
              </p>
              <p className="text-xs text-muted-foreground">
                Supports PDF, JPG, PNG, XLS, XLSX (up to 10MB)
              </p>
              <Button type="button" variant="outline" className="mt-2">
                Select Document
              </Button>
            </div>
          </div>
        )}

        {/* Document preview and confirmation */}
        {isPendingConfirmation && attachments.length > 0 && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <PreviewAttachment attachment={attachments[0]} />
            </div>
            <div className="flex flex-row gap-2 justify-end">
              <Button
                variant="outline"
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmAnalysis}
              >
                Analyze Document
              </Button>
            </div>
          </div>
        )}

        {/* Analysis progress */}
        {isAnalyzing && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Analyzing document...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground mt-2">
                  This may take a few minutes depending on document size and complexity
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Analysis complete */}
        {analysisComplete && analysisData && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-primary/5 p-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-primary">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  <span className="font-medium">Analysis Complete</span>
                </div>
                <p className="text-sm">
                  Your document has been analyzed. You can view the detailed report or ask follow-up questions.
                </p>
              </div>
            </div>
            <div className="flex flex-row justify-end gap-2">
              <Button variant="outline" onClick={handleCancel}>
                New Analysis
              </Button>
              <Button onClick={handleViewReport}>
                View Report
              </Button>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 rounded-lg bg-destructive/10 p-4 text-destructive">
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span className="font-medium">Error</span>
            </div>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
} 
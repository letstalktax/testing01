'use client';

import { useState, useRef } from 'react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { PaperclipIcon } from './icons';
import { ArrowRight, File, ExternalLink, Download } from 'lucide-react';
import { useAuth } from '@/lib/firebase/auth-context';

// Define the analysis result type
interface AnalysisResult {
  message: string;
  documentPreview: string;
  knowledgeBasePreview: string;
  htmlReport?: string;
  summary?: string;
  reportUrl?: string;
}

export function DocumentAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('You need to be logged in to use this feature');
      return;
    }

    if (!file) {
      toast.error('Please select a file to analyze');
      return;
    }

    setIsAnalyzing(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/analyze/document', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze document');
      }

      const data = await response.json();
      setResult(data);
      toast.success('Document analyzed successfully');
    } catch (error) {
      console.error('Error analyzing document:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to analyze document');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleViewReport = async () => {
    if (!result?.htmlReport) {
      toast.error('No report available to view');
      return;
    }
    
    setIsSavingReport(true);
    
    try {
      // If we already have a report URL, just open it
      if (result.reportUrl) {
        window.open(result.reportUrl, '_blank');
        return;
      }
      
      // Save the report to a file on the server
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          htmlReport: result.htmlReport,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save report');
      }
      
      const data = await response.json();
      
      // Update the result with the report URL
      setResult(prev => prev ? { ...prev, reportUrl: data.reportUrl } : null);
      
      // Open the report in a new tab
      window.open(data.reportUrl, '_blank');
      
      toast.success('Report opened in new tab');
    } catch (error) {
      console.error('Error saving report:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save report');
    } finally {
      setIsSavingReport(false);
    }
  };

  // Function to download the HTML report
  const handleDownloadReport = () => {
    if (!result?.htmlReport) {
      toast.error('No report available to download');
      return;
    }

    const blob = new Blob([result.htmlReport], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tax-analysis-report.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Report downloaded');
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="p-6 bg-white dark:bg-zinc-900 rounded-lg shadow border border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xl font-semibold mb-4">Upload a Document</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative w-full">
            <input
              type="file"
              id="file-upload"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.txt"
              className="sr-only"
              ref={fileInputRef}
            />
            <label 
              htmlFor="file-upload" 
              className="flex items-center justify-between w-full px-4 py-3 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
            >
              <div className="flex items-center gap-3">
                <PaperclipIcon size={20} />
                <span className="text-sm">
                  {file ? file.name : 'No file chosen'}
                </span>
              </div>
              <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-md">
                Choose File
              </span>
            </label>
          </div>
          
          <div className="text-sm text-zinc-500 dark:text-zinc-400 flex justify-between items-center">
            <p>Supported file types: PDF, DOC, DOCX, TXT</p>
            <p>Maximum file size: 10MB</p>
          </div>
          
          <Button
            type="submit"
            className="w-full"
            disabled={isAnalyzing || !file}
          >
            {isAnalyzing ? (
              <span className="animate-pulse">Analyzing Document...</span>
            ) : (
              <span className="flex items-center gap-2">
                Analyze Document <ArrowRight size={16} />
              </span>
            )}
          </Button>
        </form>
      </div>

      {/* Analysis Results Section */}
      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
          {/* Main Content (70%) */}
          <div className="lg:col-span-7 order-2 lg:order-1">
            <div className="h-full bg-white dark:bg-zinc-900 rounded-lg shadow border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col">
              <div className="border-b border-zinc-200 dark:border-zinc-800 p-4">
                <h2 className="text-lg font-semibold">Document Analysis</h2>
              </div>
              
              {/* Summary Display */}
              {result.summary && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-zinc-200 dark:border-zinc-800">
                  <h3 className="text-md font-medium mb-2">Analysis Summary</h3>
                  <p className="text-sm whitespace-pre-wrap">{result.summary}</p>
                </div>
              )}
              
              {/* HTML Content Preview */}
              {result.htmlReport && (
                <div className="p-4 flex-grow overflow-auto">
                  <div 
                    className="prose dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: result.htmlReport.substring(0, 1000) + '...' }}
                  />
                  <div className="mt-4 text-center text-sm text-zinc-500">
                    <p>Preview truncated. View full report using the buttons on the right.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Sidebar (30%) */}
          <div className="lg:col-span-3 order-1 lg:order-2">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="border-b border-zinc-200 dark:border-zinc-800 p-4">
                <h2 className="text-lg font-semibold">Analysis Actions</h2>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Document Info */}
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                  <h3 className="text-sm font-medium mb-2">Document</h3>
                  <p className="text-xs text-zinc-500">{file?.name}</p>
                </div>
                
                {/* Knowledge Base Info */}
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                  <h3 className="text-sm font-medium mb-2">Knowledge Base</h3>
                  <p className="text-xs text-zinc-500">{result.knowledgeBasePreview}</p>
                </div>
                
                {/* Report Actions */}
                {result.htmlReport && (
                  <div className="space-y-3">
                    <h3 className="text-md font-medium">Full Report</h3>
                    <div className="space-y-2">
                      <Button 
                        onClick={handleViewReport}
                        disabled={isSavingReport}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        <ExternalLink size={16} className="mr-2" />
                        {isSavingReport ? 'Opening...' : 'View Report'}
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        onClick={handleDownloadReport}
                        className="w-full"
                      >
                        <Download size={16} className="mr-2" />
                        Download HTML
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
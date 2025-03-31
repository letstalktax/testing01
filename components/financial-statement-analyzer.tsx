'use client';

import { useState, useRef } from 'react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { PaperclipIcon } from './icons';
import { ArrowRight, FileText, ExternalLink, Download, Printer } from 'lucide-react';
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

export function FinancialStatementAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      // Check if the file is a financial statement (PDF, Excel, etc.)
      const validFileTypes = [
        'application/pdf',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      
      if (!validFileTypes.includes(selectedFile.type)) {
        toast.warning('Please upload a financial statement document (PDF, Excel, Word, CSV)');
        return;
      }
      
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('You need to be logged in to use this feature');
      return;
    }

    if (!file) {
      toast.error('Please select a financial statement file to analyze');
      return;
    }

    setIsAnalyzing(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/analyze/financial-statements', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze financial statements');
      }

      const data = await response.json();
      setResult(data);
      toast.success('Financial statements analyzed successfully');
    } catch (error) {
      console.error('Error analyzing financial statements:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to analyze financial statements');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleViewReport = async () => {
    if (!result?.reportUrl) {
      toast.error('No report available to view');
      return;
    }
    
    // Open the report in a new tab
    window.open(result.reportUrl, '_blank');
    toast.success('Report opened in new tab');
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
    a.download = 'financial-analysis-report.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Report downloaded');
  };

  // Function to print the report
  const handlePrintReport = () => {
    if (!result?.reportUrl) {
      toast.error('No report available to print');
      return;
    }
    
    // Open the report in a new window and trigger print
    const printWindow = window.open(result.reportUrl, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    } else {
      toast.error('Unable to open print window. Please check if pop-ups are blocked');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="p-6 bg-white dark:bg-zinc-900 rounded-lg shadow border border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xl font-semibold mb-4">Upload Financial Statements</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative w-full">
            <input
              type="file"
              id="file-upload"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
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
            <p>Supported file types: PDF, DOC, DOCX, XLS, XLSX, CSV</p>
            <p>Maximum file size: 10MB</p>
          </div>
          
          <Button
            type="submit"
            className="w-full"
            disabled={isAnalyzing || !file}
          >
            {isAnalyzing ? (
              <span className="animate-pulse">Analyzing Financial Statements...</span>
            ) : (
              <span className="flex items-center gap-2">
                Generate Professional Tax Analysis <ArrowRight size={16} />
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
                <h2 className="text-lg font-semibold">Financial Statement Analysis</h2>
              </div>
              
              {/* Summary Display */}
              {result.summary && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-zinc-200 dark:border-zinc-800">
                  <h3 className="text-md font-medium mb-2">Executive Summary</h3>
                  <p className="text-sm whitespace-pre-wrap">{result.summary}</p>
                </div>
              )}
              
              {/* Description of Report Sections */}
              <div className="p-4 flex-grow">
                <h3 className="text-md font-medium mb-3">Professional Tax Analysis Report Includes:</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start">
                    <FileText size={16} className="mr-2 mt-1 text-blue-600" />
                    <span>Comprehensive UAE Corporate Tax analysis based on financial statements</span>
                  </li>
                  <li className="flex items-start">
                    <FileText size={16} className="mr-2 mt-1 text-blue-600" />
                    <span>Detailed Taxable Person status assessment and rate determination</span>
                  </li>
                  <li className="flex items-start">
                    <FileText size={16} className="mr-2 mt-1 text-blue-600" />
                    <span>Step-by-step taxable income calculation with adjustments</span>
                  </li>
                  <li className="flex items-start">
                    <FileText size={16} className="mr-2 mt-1 text-blue-600" />
                    <span>In-depth analysis of transfer pricing, depreciation, and finance charges</span>
                  </li>
                  <li className="flex items-start">
                    <FileText size={16} className="mr-2 mt-1 text-blue-600" />
                    <span>Actionable compliance recommendations with specific steps</span>
                  </li>
                </ul>
                
                <div className="mt-6 p-4 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h4 className="text-sm font-medium mb-2 text-blue-700 dark:text-blue-400">Professional Format Features:</h4>
                  <ul className="space-y-1 text-xs text-blue-700 dark:text-blue-400">
                    <li>• A4 print-optimized with repeating headers and footers</li>
                    <li>• Proper table of contents with page numbers</li>
                    <li>• Well-structured sections with detailed analysis</li>
                    <li>• Data visualized in clear, text-based tables</li>
                    <li>• Citations to relevant UAE Corporate Tax Law articles</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          {/* Sidebar (30%) */}
          <div className="lg:col-span-3 order-1 lg:order-2">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="border-b border-zinc-200 dark:border-zinc-800 p-4">
                <h2 className="text-lg font-semibold">Report Actions</h2>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Document Info */}
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                  <h3 className="text-sm font-medium mb-2">Financial Statements</h3>
                  <p className="text-xs text-zinc-500">{file?.name}</p>
                </div>
                
                {/* Knowledge Base Info */}
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                  <h3 className="text-sm font-medium mb-2">Knowledge Base</h3>
                  <p className="text-xs text-zinc-500">{result.knowledgeBasePreview}</p>
                </div>
                
                {/* Report Actions */}
                {result.reportUrl && (
                  <div className="space-y-3">
                    <h3 className="text-md font-medium">Professional Tax Report</h3>
                    <div className="space-y-2">
                      <Button 
                        onClick={handleViewReport}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        <ExternalLink size={16} className="mr-2" />
                        View Full Report
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        onClick={handlePrintReport}
                        className="w-full"
                      >
                        <Printer size={16} className="mr-2" />
                        Print Report
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
'use client';

import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ReactMarkdown from 'react-markdown';
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

// Define the chat message type
interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  isStreaming?: boolean;
}

// Add CSS for loading animation
const LoadingScreen = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm transition-all duration-300">
    <div className="card dark:bg-[#212121] bg-slate-100">
      <div className="loader">
        <p>MusTax AI is</p>
        <div className="words">
          <span className="word">processing your financial data...</span>
          <span className="word">calculating your tax liabilities...</span>
          <span className="word">analyzing your compliance status...</span>
          <span className="word">extracting key financial figures...</span>
          <span className="word">identifying tax optimization opportunities...</span>
          <span className="word">cross-referencing with UAE tax laws...</span>
          <span className="word">generating your compliance report...</span>
          <span className="word">ensuring accuracy in every calculation...</span>
          <span className="word">finalizing your financial insights...</span>
          <span className="word">preparing your report for review...</span>
        </div>
      </div>
    </div>
  </div>
);

export default function MusTaxAnalyzePage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [isSendingQuestion, setIsSendingQuestion] = useState(false);
  const [question, setQuestion] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [result, setResult] = useState<{ 
    message: string, 
    documentPreview: string, 
    knowledgeBasePreview: string,
    htmlReport?: string,
    summary?: string,
    reportUrl?: string
  } | null>(null);
  const chatOutputRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [userQuestion, setUserQuestion] = useState<string>("");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [isProcessingQuestion, setIsProcessingQuestion] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom of chat whenever messages change
  useEffect(() => {
    if (chatOutputRef.current) {
      chatOutputRef.current.scrollTop = chatOutputRef.current.scrollHeight;
    }
  }, [chatMessages]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      const fileName = e.target.files[0].name;
      console.log(`File selected: ${fileName}`);
    }
  };

  // Handle form submission for document analysis
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      toast.error("Please select a file to analyze.");
      return;
    }
    
    // Set loading state to true to show loading screen
    setIsLoading(true);
    setIsUploading(true);
    setResult(null); // Clear any previous results
    setChatMessages([]); // Clear previous chat messages
    
    // Create form data for file upload
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      // Submit file for analysis
      const response = await fetch('/api/analyze/document', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Update result state with analysis data
      setResult(data);
      
      // Show success toast
      toast.success("Document analyzed successfully");
      
    } catch (error) {
      console.error('Error analyzing document:', error);
      toast.error(error instanceof Error ? error.message : "Failed to analyze document");
    } finally {
      // Set loading state to false to hide loading screen
      setIsLoading(false);
      setIsUploading(false);
    }
  };

  // Function to save the report and open it in a new tab
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

  // Function to handle sending a follow-up question
  const handleSendQuestion = async () => {
    if (!question.trim()) {
      toast.error('Please enter a question');
      return;
    }

    if (!result?.summary) {
      toast.error('No analysis summary available');
      return;
    }

    setIsSendingQuestion(true);
    
    // Add user question to chat
    const userMessage: ChatMessage = { role: 'user', content: question };
    
    // Add a placeholder for the AI's response with the isStreaming flag
    const aiPlaceholder: ChatMessage = { 
      role: 'ai', 
      content: '', 
      isStreaming: true 
    };
    
    setChatMessages(prev => [...prev, userMessage, aiPlaceholder]);
    
    try {
      const response = await fetch('/api/analyze/question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          summary: result.summary,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get answer');
      }
      
      const data = await response.json();
      
      // Update the placeholder message with the actual response
      setChatMessages(prev => {
        const updatedMessages = [...prev];
        // Replace the last message (placeholder) with the actual response
        updatedMessages[updatedMessages.length - 1] = { 
          role: 'ai', 
          content: data.answer,
          isStreaming: false
        };
        return updatedMessages;
      });
      
      // Clear the question input
      setQuestion('');
    } catch (error) {
      console.error('Error getting answer:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to get answer');
      
      // Update the placeholder with an error message
      setChatMessages(prev => {
        const updatedMessages = [...prev];
        updatedMessages[updatedMessages.length - 1] = { 
          role: 'ai', 
          content: 'Sorry, I was unable to process your question. Please try again.',
          isStreaming: false
        };
        return updatedMessages;
      });
    } finally {
      setIsSendingQuestion(false);
    }
  };

  // Handle pressing Enter in the question input
  const handleQuestionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isSendingQuestion) {
      handleSendQuestion();
    }
  };

  // Thinking animation component
  const ThinkingAnimation = () => (
    <div className="flex space-x-2 mt-1">
      <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: '0ms' }}></div>
      <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: '300ms' }}></div>
      <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: '600ms' }}></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-4xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-[#956afa] to-[#3498db]">MusTax AI Analyze</h1>
        
        {/* Document upload section */}
        <div className={`mb-8 p-8 border rounded-xl shadow-lg ${result ? 'border-primary/20 bg-primary/5' : 'border-muted/30 bg-card'}`}>
          <h2 className="text-2xl font-semibold mb-6 text-foreground">Select a document to analyze</h2>
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full max-w-md">
              <input
              type="file"
                id="file-upload"
                onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.txt"
                className="sr-only"
              />
              <label 
                htmlFor="file-upload" 
                className="flex items-center justify-between w-full px-4 py-3 border-2 border-dashed border-muted-foreground/40 rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm text-muted-foreground">
                    {file ? file.name : 'No file chosen'}
                  </span>
                </div>
                <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-md">Choose File</span>
              </label>
            </div>
            
            <div className="relative group">
              <button
                onClick={handleSubmit}
                disabled={isUploading || isLoading || !file}
                className="relative inline-block p-px font-semibold leading-6 text-white bg-gray-800 shadow-2xl cursor-pointer rounded-xl shadow-zinc-900 transition-transform duration-300 ease-in-out hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              >
                <span
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#956afa] via-[#3498db] to-[#2c3e50] p-[2px] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                ></span>

                <span className="relative z-10 block px-6 py-3 rounded-xl bg-gray-950">
                  <div className="relative z-10 flex items-center space-x-2">
                    <span className="transition-all duration-500 group-hover:translate-x-1">
                      {isUploading || isLoading ? 'Processing...' : 'Analyze Financials'}
                    </span>
                    <svg
                      className="w-6 h-6 transition-transform duration-500 group-hover:translate-x-1"
                      data-slot="icon"
                      aria-hidden="true"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        clipRule="evenodd"
                        d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
                        fillRule="evenodd"
                      ></path>
                    </svg>
                  </div>
                </span>
              </button>
            </div>
          </div>
          <div className="text-sm text-muted-foreground mt-4 flex justify-between items-center">
            <p>Supported file types: PDF, DOC, DOCX, TXT</p>
            <p>Maximum file size: 10MB</p>
          </div>
        </div>
        
        {/* Loading screen - shows during document analysis */}
        {isLoading && <LoadingScreen />}
        
        {/* Split Screen Layout - Main Content */}
        {result && (
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
            {/* Chat Section (70% on large screens) */}
            <div className="lg:col-span-7 order-2 lg:order-1">
              <div className="h-full bg-card rounded-xl shadow-lg border border-muted overflow-hidden flex flex-col">
                <div className="border-b border-muted p-4">
                  <h2 className="text-lg font-semibold text-foreground">Ask Follow-up Questions</h2>
                </div>
                
                {/* Chat Messages Area */}
                <div 
                  ref={chatOutputRef}
                  className="flex-grow p-4 overflow-y-auto chat-container"
                  style={{ height: '500px' }}
                >
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full">
                      <div className="text-muted-foreground text-center max-w-sm">
                        <div className="mb-3 text-2xl">✨</div>
                        <p className="text-lg font-medium mb-2">Ask questions about your document analysis</p>
                        <p className="text-sm">I'll provide insights based on the analysis of your uploaded document</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {chatMessages.map((msg, idx) => (
                        <div key={idx} className={`animate-fadeIn ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
                          {msg.role === 'user' ? (
                            <div className="bg-primary/10 rounded-lg p-3 max-w-[80%]">
                              <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                            </div>
                          ) : (
                            <div className="w-full">
                              <div className="flex items-center mb-2 text-xs text-muted-foreground">
                                <span className="mr-1">✨</span>
                                <span>AI</span>
                              </div>
                              {msg.isStreaming ? (
                                <ThinkingAnimation />
                              ) : (
                                <div className="bg-secondary/30 rounded-lg p-3 prose dark:prose-invert prose-sm max-w-none">
                                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Chat Input Area */}
                <div className="p-4 border-t border-muted bg-card">
                  <div className="flex gap-2 items-center">
                    <div className="text-muted-foreground px-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5z"/>
                        <path d="M10 8a2 2 0 1 1-4 0V3a2 2 0 1 1 4 0v5zM8 0a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V3a3 3 0 0 0-3-3z"/>
                      </svg>
                    </div>
                    <Input
                      type="text"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={handleQuestionKeyDown}
                      placeholder="Type your question here..."
                      disabled={isSendingQuestion || !result?.summary}
                      className="flex-grow"
                    />
                    <Button 
                      onClick={handleSendQuestion}
                      disabled={isSendingQuestion || !question.trim() || !result?.summary}
                      className="bg-primary hover:bg-primary/90"
                    >
                      {isSendingQuestion ? 'Sending...' : 'Send'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Analysis Results Sidebar (30% on large screens) */}
            <div className="lg:col-span-3 order-1 lg:order-2 animate-slideIn">
              <div className="bg-card rounded-xl shadow-lg border border-muted overflow-hidden">
                <div className="border-b border-muted p-4">
                  <h2 className="text-lg font-semibold text-foreground">Analysis Results</h2>
                </div>
                
                <div className="p-4 space-y-4">
                  {/* Analysis Message */}
                  {result.message && (
                    <div className="p-3 bg-accent/20 rounded-lg border border-muted">
                      <p className="text-sm font-medium text-foreground">{result.message}</p>
                    </div>
                  )}
                  
                  {/* Summary */}
                  {result.summary && (
                    <div>
                      <h3 className="text-md font-medium mb-2 text-foreground">AI Analysis Summary</h3>
                      <div className="p-3 bg-background rounded-lg border border-muted max-h-72 overflow-y-auto">
                        <p className="text-xs whitespace-pre-wrap text-foreground/80">{result.summary}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Report Actions */}
                  {result.htmlReport && (
                    <div className="space-y-3">
                      <h3 className="text-md font-medium text-foreground">Full Report</h3>
                      <div className="space-y-2">
                        <div className="view-report-button-container">
                          <button 
                            onClick={handleViewReport}
                            disabled={isSavingReport}
                            className="view-report-btn w-full"
                            type="button"
                          >
                            <div className="default-btn">
                              <span>{isSavingReport ? 'Opening...' : 'View Report'}</span>
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
                                className="icon"
                              >
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                              </svg>
                            </div>
                            <div className="hover-btn">
                              <span>{isSavingReport ? 'Opening...' : 'View Report'}</span>
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
                                className="icon"
                              >
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                              </svg>
                            </div>
                          </button>
                        </div>
                        <Button 
                          variant="outline" 
                          onClick={handleDownloadReport}
                          className="w-full"
                          type="button"
                        >
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
        
        {/* Add styles for loading animation and button animations */}
        <style jsx global>{`
          .card {
            --bg-color: #212121;
            background-color: var(--bg-color);
            padding: 1rem 2rem;
            border-radius: 1.25rem;
          }
          .loader {
            color: rgb(124, 124, 124);
            font-family: "Poppins", sans-serif;
            font-weight: 500;
            font-size: 25px;
            -webkit-box-sizing: content-box;
            box-sizing: content-box;
            height: 40px;
            padding: 10px 10px;
            display: -webkit-box;
            display: -ms-flexbox;
            display: flex;
            border-radius: 8px;
          }
          
          .words {
            overflow: hidden;
            position: relative;
          }
          .words::after {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(
              var(--bg-color) 10%,
              transparent 30%,
              transparent 70%,
              var(--bg-color) 90%
            );
            z-index: 20;
          }
          
          .word {
            display: block;
            height: 100%;
            padding-left: 6px;
            color: #956afa;
            animation: spin_4991 45s forwards;
          }
          
          @keyframes spin_4991 {
            0%, 9% {
              -webkit-transform: translateY(0);
              transform: translateY(0);
            }
            
            10%, 19% {
              -webkit-transform: translateY(-100%);
              transform: translateY(-100%);
            }
            
            20%, 29% {
              -webkit-transform: translateY(-200%);
              transform: translateY(-200%);
            }
            
            30%, 39% {
              -webkit-transform: translateY(-300%);
              transform: translateY(-300%);
            }
            
            40%, 49% {
              -webkit-transform: translateY(-400%);
              transform: translateY(-400%);
            }
            
            50%, 59% {
              -webkit-transform: translateY(-500%);
              transform: translateY(-500%);
            }
            
            60%, 69% {
              -webkit-transform: translateY(-600%);
              transform: translateY(-600%);
            }
            
            70%, 79% {
              -webkit-transform: translateY(-700%);
              transform: translateY(-700%);
            }
            
            80%, 89% {
              -webkit-transform: translateY(-800%);
              transform: translateY(-800%);
            }
            
            90%, 100% {
              -webkit-transform: translateY(-900%);
              transform: translateY(-900%);
            }
          }
          
          html.light .card {
            --bg-color: #f1f5f9;
          }
          
          /* Scoped custom button styles for the View Report button only */
          .view-report-button-container {
            width: 100%;
            position: relative;
          }
          
          .view-report-btn {
            position: relative;
            overflow: hidden;
            outline: none;
            cursor: pointer;
            border-radius: 8px;
            background-color: #1c7e26;
            border: none;
            width: 100%;
            font-family: inherit;
            font-size: 14px;
            height: 40px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }

          .view-report-btn .default-btn,
          .view-report-btn .hover-btn {
            background-color: #1c7e26;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 0 16px;
            border-radius: 8px;
            font-weight: 500;
            text-transform: uppercase;
            transition: all 0.3s ease;
            height: 100%;
            width: 100%;
          }

          .view-report-btn .hover-btn {
            position: absolute;
            inset: 0;
            background-color: #165c1c;
            transform: translate(0%, 100%);
          }

          .view-report-btn .default-btn span,
          .view-report-btn .hover-btn span {
            color: white;
            font-size: 14px;
          }

          .view-report-btn:hover .default-btn {
            transform: translate(0%, -100%);
          }

          .view-report-btn:hover .hover-btn {
            transform: translate(0%, 0%);
          }
          
          .view-report-btn .icon {
            color: white;
            width: 18px;
            height: 18px;
          }
          
          .view-report-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          
          .view-report-btn:disabled:hover .default-btn {
            transform: none;
          }
          
          .view-report-btn:disabled:hover .hover-btn {
            transform: translate(0%, 100%);
          }

          /* Animations specifically for analyze button */
          @keyframes border-glow-translate {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(100%);
            }
          }
          
          @keyframes border-glow-scale {
            0% {
              opacity: 0.5;
              transform: translateX(0) scale(1);
            }
            100% {
              opacity: 0.9;
              transform: translateX(100%) scale(1.2);
            }
          }
          
          @keyframes star-rotate {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
          
          @keyframes star-shine {
            0% {
              opacity: 0;
              transform: translate(-50%, -50%) scale(0);
            }
            50% {
              opacity: 0.1;
              transform: translate(-50%, -50%) scale(0.5);
            }
            100% {
              opacity: 0.3;
              transform: translate(-50%, -50%) scale(1);
            }
          }
        `}</style>
      </div>
    </div>
  );
} 
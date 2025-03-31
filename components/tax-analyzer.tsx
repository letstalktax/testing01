'use client';

import { useState, useRef } from 'react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { PaperclipIcon } from './icons';
import { ArrowRight, File } from 'lucide-react';
import { Textarea } from './ui/textarea';
import { useAuth } from '@/lib/firebase/auth-context';

export function TaxAnalyzer() {
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('You need to be logged in to use this feature');
      return;
    }

    if (!prompt.trim()) {
      toast.error('Please enter a prompt for analysis');
      return;
    }

    setIsAnalyzing(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('prompt', prompt);
      
      files.forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze document');
      }

      const data = await response.json();
      setResult(data.result);
      toast.success('Analysis completed successfully');
    } catch (error) {
      console.error('Error analyzing document:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to analyze document');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6 bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">MusTax AI Document Analyzer</h2>
        <p className="text-zinc-500 dark:text-zinc-400">
          Upload tax documents and get detailed AI-powered analysis and insights.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="prompt" className="block text-sm font-medium">
            Analysis Prompt
          </label>
          <Textarea
            id="prompt"
            placeholder="What would you like to know about these tax documents? (e.g., Analyze this invoice for tax implications)"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[100px]"
            required
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium">
              Upload Documents
            </label>
            <span className="text-xs text-zinc-500">
              Supported formats: PDF, DOCX, XLSX, JPG, PNG
            </span>
          </div>
          
          <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-4 text-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            onClick={() => fileInputRef.current?.click()}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              multiple
              accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
            />
            <PaperclipIcon size={32} />
            <p className="text-sm font-medium mt-2">Click to upload or drag and drop</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Upload tax documents for detailed analysis
            </p>
          </div>
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Uploaded Files:</p>
            <ul className="space-y-2">
              {files.map((file, index) => (
                <li key={index} className="flex items-center justify-between p-2 bg-zinc-50 dark:bg-zinc-800 rounded-md">
                  <div className="flex items-center">
                    <File size={16} className="mr-2 text-blue-500" />
                    <span className="text-sm truncate max-w-[250px]">{file.name}</span>
                    <span className="text-xs text-zinc-500 ml-2">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFile(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button
          type="submit"
          className="w-full flex items-center justify-center gap-2"
          disabled={isAnalyzing || !prompt.trim()}
        >
          {isAnalyzing ? (
            <>
              <span className="animate-pulse">Analyzing...</span>
            </>
          ) : (
            <>
              Analyze Document
              <ArrowRight size={16} />
            </>
          )}
        </Button>
      </form>

      {result && (
        <div className="mt-8 space-y-4">
          <h3 className="text-xl font-semibold">Analysis Results</h3>
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg prose dark:prose-invert max-w-none">
            <div dangerouslySetInnerHTML={{ __html: result }} />
          </div>
        </div>
      )}
    </div>
  );
} 
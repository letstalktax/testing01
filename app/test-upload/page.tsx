'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function MusTaxAnalyzePage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      const fileName = e.target.files[0].name;
      console.log(`File selected: ${fileName}`);
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      toast.error('Please upload a document first');
      return;
    }
    
    const fileName = file.name;
    toast.success(`Analyzing document: ${fileName}`);
    setIsUploading(true);
    
    // Simulate analysis for demo purposes
    setTimeout(() => {
      setIsUploading(false);
      toast.success('Analysis complete!');
    }, 2000);
  };

  return (
    <div className="container mx-auto p-8 max-w-3xl">
      <div className="rounded-lg border bg-background p-8">
        <h2 className="text-xl font-bold mb-2">MusTax AI Analyze</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Upload a document to get detailed analysis and insights. Once processed, you can
          view a comprehensive report and ask follow-up questions.
        </p>
        
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
              onChange={handleFileChange}
            />
            <div className="flex justify-end">
              <Button
                onClick={handleAnalyze}
                disabled={isUploading}
              >
                {isUploading ? 'Analyzing...' : 'Analyze Document'}
              </Button>
            </div>
          </div>
        </div>
        
        <div className="text-sm text-muted-foreground">
          <p>Supported file types: PDF, DOC, DOCX, TXT</p>
          <p>Maximum file size: 10MB</p>
        </div>
      </div>
    </div>
  );
} 
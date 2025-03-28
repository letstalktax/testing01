'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Upload, FileText, CheckCircle, AlertCircle, Download } from 'lucide-react';

// Sample tax document content
const SAMPLE_TAX_DOCUMENT = `
# UAE Corporate Tax - Small Business Relief

## Overview
Small Business Relief is a key feature of the UAE Corporate Tax regime designed to support startups and small businesses. This relief aims to reduce compliance burdens and support the growth of small enterprises in the UAE economy.

## Eligibility Criteria
To qualify for Small Business Relief under UAE Corporate Tax, businesses must meet the following criteria:

1. **Revenue Threshold**: The business must have revenue below AED 3 million per financial year.
2. **Business Type**: Available to natural persons (individuals) and other persons (entities) conducting business in the UAE.
3. **Registration**: The business must be properly registered for Corporate Tax purposes.
4. **Compliance**: The business must maintain proper financial records and submit simplified tax returns.

## Benefits
Businesses that qualify for Small Business Relief will:

1. Be deemed to have no taxable income for the relevant Tax Period.
2. Be subject to 0% Corporate Tax rate.
3. Have simplified compliance requirements.
4. Not need to prepare detailed financial statements.

## Exclusions
Small Business Relief is not available to:

1. Free Zone Persons that benefit from a 0% Corporate Tax rate.
2. Businesses engaged in extractive businesses and non-extractive natural resources businesses.
3. Businesses that are part of a multinational enterprise group subject to Pillar Two rules.

## Application Process
To apply for Small Business Relief:

1. Register for Corporate Tax with the Federal Tax Authority.
2. Elect to apply the Small Business Relief in the Corporate Tax registration form.
3. Confirm eligibility in each tax return.

## Important Considerations
1. The relief is optional and businesses can choose not to apply it.
2. Once elected, businesses must continue to apply the relief for a minimum of 3 consecutive Tax Periods.
3. Businesses must maintain basic records to demonstrate eligibility.
4. The Federal Tax Authority may request documentation to verify eligibility.

## Legal References
This relief is established under Article 22 of the UAE Corporate Tax Law, Federal Decree-Law No. 47 of 2022.
`;

export default function DocumentUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
    details?: {
      fileUrl?: string;
      chunks?: number;
      embeddings?: number;
    };
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setUploadResult({
          success: true,
          message: 'Document uploaded and processed successfully!',
          details: {
            fileUrl: data.fileUrl,
            chunks: data.chunks,
            embeddings: data.embeddings,
          },
        });
      } else {
        setUploadResult({
          success: false,
          message: data.error || 'Failed to upload document',
        });
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      setUploadResult({
        success: false,
        message: 'An error occurred while uploading the document',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleUseSample = async () => {
    setIsUploading(true);
    setUploadResult(null);

    try {
      // Create a file from the sample content
      const sampleFile = new File([SAMPLE_TAX_DOCUMENT], 'uae-corporate-tax-small-business-relief.md', {
        type: 'text/markdown',
      });

      const formData = new FormData();
      formData.append('file', sampleFile);

      const response = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setUploadResult({
          success: true,
          message: 'Sample document uploaded and processed successfully!',
          details: {
            fileUrl: data.fileUrl,
            chunks: data.chunks,
            embeddings: data.embeddings,
          },
        });
      } else {
        setUploadResult({
          success: false,
          message: data.error || 'Failed to upload sample document',
        });
      }
    } catch (error) {
      console.error('Error uploading sample document:', error);
      setUploadResult({
        success: false,
        message: 'An error occurred while uploading the sample document',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const downloadSampleDocument = () => {
    const blob = new Blob([SAMPLE_TAX_DOCUMENT], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'uae-corporate-tax-small-business-relief.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Knowledge Base Documents</CardTitle>
        <CardDescription>
          Upload documents to add to your knowledge base or use our sample document to test the system.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Upload Your Document</h3>
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept=".txt,.md,.pdf"
              onChange={handleFileChange}
              disabled={isUploading}
              className="flex-1"
            />
            <Button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="min-w-[120px]"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
          </div>

          {file && !isUploading && !uploadResult && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>
                {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </span>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Or Use Sample Document</h3>
          <div className="p-4 border rounded-md bg-muted/20">
            <h4 className="font-medium mb-2">UAE Corporate Tax - Small Business Relief</h4>
            <p className="text-sm text-muted-foreground mb-4">
              This sample document contains information about Small Business Relief criteria under UAE Corporate Tax.
            </p>
            <div className="flex gap-2">
              <Button onClick={handleUseSample} disabled={isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Use Sample
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={downloadSampleDocument}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>
          </div>
        </div>

        {uploadResult && (
          <div
            className={`p-4 rounded-md ${
              uploadResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              {uploadResult.success ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
              <span>{uploadResult.message}</span>
            </div>
            {uploadResult.success && uploadResult.details && (
              <div className="mt-2 text-sm">
                <p>Document split into {uploadResult.details.chunks} chunks</p>
                <p>Generated {uploadResult.details.embeddings} embeddings</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        <p>
          After uploading documents, you can ask questions about them in the chat. The AI will use the knowledge from your documents to provide accurate answers.
        </p>
      </CardFooter>
    </Card>
  );
} 
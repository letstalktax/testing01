import { Metadata } from 'next';
import { DocumentAnalyzer } from '@/components/document-analyzer';
import { FinancialStatementAnalyzer } from '@/components/financial-statement-analyzer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, BarChart3 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'MusTax AI - Document Analysis',
  description: 'Analyze tax documents and financial statements using advanced AI for insights and recommendations.',
};

export default function AnalyzePage() {
  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">MusTax AI Analyze</h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            Upload tax documents or financial statements to get detailed analysis, insights, and recommendations based on UAE Corporate Tax knowledge.
          </p>
        </div>
        
        <Tabs defaultValue="document" className="mt-8">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="document" className="flex items-center gap-2">
              <FileText size={16} />
              <span>Document Analysis</span>
            </TabsTrigger>
            <TabsTrigger value="financial" className="flex items-center gap-2">
              <BarChart3 size={16} />
              <span>Financial Statement Analysis</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="document">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Document Analysis</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Upload any tax document for general analysis and insights based on UAE Corporate Tax regulations.
              </p>
            </div>
            <DocumentAnalyzer />
          </TabsContent>
          
          <TabsContent value="financial">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Financial Statement Analysis</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Upload financial statements for comprehensive tax analysis with detailed calculations and professional reporting.
              </p>
            </div>
            <FinancialStatementAnalyzer />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 
import DocumentUpload from '@/components/document-upload';

export default function DocumentsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Knowledge Base Documents</h1>
      <DocumentUpload />
    </div>
  );
} 
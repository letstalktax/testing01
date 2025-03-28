'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Trash2, FileText, Upload, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Document = {
  id: string;
  name: string;
  type: string;
  uploadedBy: string;
  uploadDate: string;
  chunkCount: number;
};

export function AdminKnowledgeBaseManager() {
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentType, setDocumentType] = useState('tax-law');
  
  // Fetch documents on load
  useEffect(() => {
    fetchDocuments();
  }, []);
  
  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/knowledge-base/documents');
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      
      const data = await response.json();
      setDocuments(data.documents);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };
  
  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file to upload');
      return;
    }
    
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name);
      formData.append('type', documentType);
      
      const response = await fetch('/api/admin/knowledge-base', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload document');
      }
      
      const data = await response.json();
      
      toast.success(`Document uploaded and processed into ${data.chunkCount} chunks`);
      setFile(null);
      
      // Refresh document list
      fetchDocuments();
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleDeleteDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/admin/knowledge-base?documentId=${documentId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete document');
      }
      
      toast.success('Document deleted successfully');
      
      // Update the documents list
      setDocuments(documents.filter(doc => doc.id !== documentId));
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Tax Knowledge Base Manager</CardTitle>
        <CardDescription>
          Upload and manage tax documents to enhance AI responses.
        </CardDescription>
      </CardHeader>
      
      <Tabs defaultValue="upload">
        <TabsList className="mx-6">
          <TabsTrigger value="upload">Upload Document</TabsTrigger>
          <TabsTrigger value="manage">Manage Documents</TabsTrigger>
        </TabsList>
        
        <TabsContent value="upload">
          <CardContent>
            <div className="flex flex-col space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Document Type</label>
                  <select 
                    className="w-full p-2 border rounded-md"
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                  >
                    <option value="tax-law">Tax Law/Regulation</option>
                    <option value="tax-procedure">Tax Procedure</option>
                    <option value="tax-case">Tax Case Law</option>
                    <option value="tax-form">Tax Form Instructions</option>
                    <option value="tax-guide">Tax Guide</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-1 block">Select File</label>
                  <Input
                    type="file"
                    onChange={handleFileChange}
                    disabled={isUploading}
                    accept=".txt,.pdf,.docx,.md"
                  />
                </div>
              </div>
              
              {file && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  <FileText size={16} />
                  <span className="text-sm">{file.name}</span>
                </div>
              )}
            </div>
          </CardContent>
          
          <CardFooter>
            <Button 
              onClick={handleUpload} 
              disabled={!file || isUploading}
              className="w-full"
            >
              {isUploading ? (
                <>
                  <RefreshCw size={16} className="mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload size={16} className="mr-2" />
                  Upload to Knowledge Base
                </>
              )}
            </Button>
          </CardFooter>
        </TabsContent>
        
        <TabsContent value="manage">
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <RefreshCw size={24} className="animate-spin" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No documents in the knowledge base yet.
              </div>
            ) : (
              <div className="space-y-4">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded-md">
                    <div className="flex items-center gap-3">
                      <FileText size={20} />
                      <div>
                        <div className="font-medium">{doc.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Added: {new Date(doc.uploadDate).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{doc.chunkCount} chunks</Badge>
                      <Badge>{doc.type}</Badge>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDeleteDocument(doc.id)}
                      >
                        <Trash2 size={16} className="text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          
          <CardFooter className="justify-end">
            <Button variant="outline" onClick={fetchDocuments}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
          </CardFooter>
        </TabsContent>
      </Tabs>
    </Card>
  );
} 
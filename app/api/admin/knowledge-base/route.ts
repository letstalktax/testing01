import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { processDocument } from '@/lib/rag/document-processor';
import { storeEmbeddings, deleteNamespaceEmbeddings } from '@/lib/rag/pinecone-client';
import { nanoid } from 'nanoid';

// Check if user is an admin
async function isAdmin(userId: string) {
  // Implement your admin check logic here
  // For example, check against a list of admin user IDs or a role in your database
  const adminUsers = process.env.ADMIN_USER_IDS?.split(',') || [];
  return adminUsers.includes(userId);
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    
    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    // Check if user is an admin
    if (!await isAdmin(session.user.id)) {
      return new Response('Forbidden', { status: 403 });
    }
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentName = formData.get('name') as string;
    const documentType = formData.get('type') as string;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // Generate a unique ID for the document
    const documentId = nanoid();
    
    // Process document and generate embeddings
    const embeddingResults = await processDocument(file, {
      documentId,
      documentType,
      documentName,
      uploadedBy: session.user.id,
      uploadDate: new Date().toISOString()
    });
    
    // Store in Pinecone - using a global namespace for all tax knowledge
    await storeEmbeddings(
      process.env.PINECONE_INDEX_NAME!,
      embeddingResults.map(result => ({
        id: result.id,
        text: result.text,
        embedding: result.embedding,
        metadata: result.metadata
      })),
      'tax-knowledge-base'
    );
    
    // Log the upload in your admin activity log if needed
    
    return NextResponse.json({ 
      success: true, 
      documentId,
      chunkCount: embeddingResults.length
    });
    
  } catch (error) {
    console.error('Error processing document:', error);
    return NextResponse.json({ error: 'Failed to process document' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    
    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    // Check if user is an admin
    if (!await isAdmin(session.user.id)) {
      return new Response('Forbidden', { status: 403 });
    }
    
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    
    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }
    
    // Delete from Pinecone
    await deleteNamespaceEmbeddings(
      process.env.PINECONE_INDEX_NAME!,
      'tax-knowledge-base'
    );
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
} 
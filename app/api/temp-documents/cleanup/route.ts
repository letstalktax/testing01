import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { deleteNamespaceEmbeddings } from '@/lib/rag/pinecone-client';

export async function POST(request: Request) {
  try {
    const session = await auth();
    
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Create the session-specific namespace
    const sessionNamespace = `session-${session.user.id}`;
    
    // Delete all embeddings in the session namespace
    const success = await deleteNamespaceEmbeddings(
      process.env.PINECONE_INDEX_NAME!,
      sessionNamespace
    );
    
    if (success) {
      return NextResponse.json({
        success: true,
        message: `Successfully cleaned up temporary document embeddings for session: ${sessionNamespace}`
      });
    } else {
      return NextResponse.json({
        success: false,
        message: `Failed to clean up temporary document embeddings for session: ${sessionNamespace}`
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error cleaning up temporary document embeddings:', error);
    return NextResponse.json({ 
      error: 'Failed to clean up temporary document embeddings',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 
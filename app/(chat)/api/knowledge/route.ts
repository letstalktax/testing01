import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { queryKnowledgeBase } from '@/lib/pinecone';

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { query, topK = 5 } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const results = await queryKnowledgeBase(query, topK);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error in knowledge base query:', error);
    return NextResponse.json(
      { error: 'Failed to query knowledge base' },
      { status: 500 }
    );
  }
} 
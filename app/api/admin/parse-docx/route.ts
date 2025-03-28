import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import mammoth from 'mammoth';

// Check if user is an admin
async function isAdmin(userId: string) {
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
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Extract text from DOCX
    const result = await mammoth.extractRawText({
      arrayBuffer: arrayBuffer
    });
    
    return NextResponse.json({ text: result.value });
  } catch (error) {
    console.error('Error parsing DOCX:', error);
    return NextResponse.json({ error: 'Failed to parse DOCX' }, { status: 500 });
  }
} 
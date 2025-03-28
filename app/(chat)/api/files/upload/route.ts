import { NextResponse } from 'next/server';
import { z } from 'zod';
import { writeFile } from 'fs/promises';
import path from 'path';
import { auth } from '@/app/(auth)/auth';

// List of allowed file types
const ALLOWED_FILE_TYPES = [
  'image/jpeg', 
  'image/png', 
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

// List of allowed file extensions (as fallback for MIME type detection issues)
const ALLOWED_FILE_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.pdf', '.xls', '.xlsx'
];

// Use Blob instead of File since File is not available in Node.js environment
const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 10 * 1024 * 1024, {
      message: 'File size should be less than 10MB',
    })
    .refine((file) => {
      console.log('File type:', file.type);
      return ALLOWED_FILE_TYPES.includes(file.type);
    }, {
      message: `File type should be one of: ${ALLOWED_FILE_TYPES.join(', ')}`,
    }),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (request.body === null) {
    return new Response('Request body is empty', { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as Blob;
    const fileName = (formData.get('file') as File).name;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    console.log('Uploaded file:', {
      type: file.type,
      size: file.size,
      name: fileName
    });

    // Check file extension as fallback if MIME type is empty or incorrect
    if (!file.type || !ALLOWED_FILE_TYPES.includes(file.type)) {
      const fileExtension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
      if (!ALLOWED_FILE_EXTENSIONS.includes(fileExtension)) {
        return NextResponse.json({ 
          error: `File extension ${fileExtension} is not allowed. Allowed extensions: ${ALLOWED_FILE_EXTENSIONS.join(', ')}` 
        }, { status: 400 });
      }
    }

    const validatedFile = FileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(', ');

      console.error('File validation error:', errorMessage);
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const fileBuffer = await file.arrayBuffer();
    
    try {
      // Add a timestamp to the filename to avoid collisions
      const timestamp = new Date().getTime();
      const uniqueFileName = `${timestamp}-${fileName}`;
      
      // Create a public URL for the file
      const publicUrl = `/uploads/${uniqueFileName}`;
      
      // Save file to public directory
      const publicDir = path.join(process.cwd(), 'public');
      const uploadsDir = path.join(publicDir, 'uploads');
      const filePath = path.join(uploadsDir, uniqueFileName);
      
      // Ensure uploads directory exists
      try {
        await writeFile(filePath, Buffer.from(fileBuffer));
        console.log('File saved successfully:', filePath);
      } catch (error) {
        console.error('Error saving file:', error);
        return NextResponse.json({ 
          error: 'Failed to save file: ' + (error instanceof Error ? error.message : String(error)) 
        }, { status: 500 });
      }

      return NextResponse.json({
        url: publicUrl,
        name: fileName,
        size: file.size,
        contentType: file.type
      });
    } catch (error) {
      console.error('File upload error:', error);
      return NextResponse.json({ 
        error: 'Upload failed: ' + (error instanceof Error ? error.message : String(error)) 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Request processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process request: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 },
    );
  }
}

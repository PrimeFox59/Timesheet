import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Strict 10MB file size check
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds maximum 10MB limit' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Sanitize filename and create unique name
    const originalName = file.name || 'attachment';
    const cleanBaseName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const uniqueFileName = `${uniqueSuffix}_${cleanBaseName}`;

    // Target upload directory in public/uploads/chat
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'chat');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, uniqueFileName);
    fs.writeFileSync(filePath, buffer);

    const relativeUrl = `/api/chat/download?file=${encodeURIComponent(uniqueFileName)}&name=${encodeURIComponent(originalName)}`;

    return NextResponse.json({
      success: true,
      url: relativeUrl,
      file_name: originalName,
      file_size: file.size,
      file_type: file.type || 'application/octet-stream'
    });

  } catch (error: any) {
    console.error('File upload error:', error);
    return NextResponse.json({ error: error.message || 'File upload failed' }, { status: 500 });
  }
}

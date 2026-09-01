import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

// Helper to determine Content-Type
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    case '.pdf':
      return 'application/pdf';
    case '.txt':
      return 'text/plain; charset=utf-8';
    case '.csv':
      return 'text/csv; charset=utf-8';
    case '.json':
      return 'application/json';
    case '.doc':
      return 'application/msword';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.xls':
      return 'application/vnd.ms-excel';
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case '.zip':
      return 'application/zip';
    case '.rar':
      return 'application/x-rar-compressed';
    case '.7z':
      return 'application/x-7z-compressed';
    default:
      return 'application/octet-stream';
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let fileName = searchParams.get('file') || searchParams.get('filename') || '';
    const customDownloadName = searchParams.get('name') || '';
    const isInline = searchParams.get('view') === '1' || searchParams.get('inline') === '1';

    if (!fileName) {
      return NextResponse.json({ error: 'Missing file parameter' }, { status: 400 });
    }

    // Clean up filename to prevent directory traversal
    fileName = fileName.replace(/^\/uploads\/chat\//, '').replace(/^\/uploads\//, '');
    fileName = path.basename(fileName);

    const filePath = path.join(process.cwd(), 'public', 'uploads', 'chat', fileName);

    if (!fs.existsSync(filePath)) {
      // Check fallback location
      const fallbackPath = path.join(process.cwd(), 'uploads', 'chat', fileName);
      if (!fs.existsSync(fallbackPath)) {
        return NextResponse.json({ error: 'File not found on server' }, { status: 404 });
      }
    }

    const targetPath = fs.existsSync(filePath) ? filePath : path.join(process.cwd(), 'uploads', 'chat', fileName);
    const fileStat = fs.statSync(targetPath);
    const fileBuffer = fs.readFileSync(targetPath);

    const mimeType = getMimeType(targetPath);
    const downloadName = customDownloadName ? path.basename(customDownloadName) : fileName;
    
    // Encode filename for Content-Disposition header
    const encodedName = encodeURIComponent(downloadName);
    const disposition = isInline 
      ? `inline; filename="${downloadName}"; filename*=UTF-8''${encodedName}`
      : `attachment; filename="${downloadName}"; filename*=UTF-8''${encodedName}`;

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': fileStat.size.toString(),
        'Content-Disposition': disposition,
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });

  } catch (error: any) {
    console.error('File download error:', error);
    return NextResponse.json({ error: error.message || 'Failed to download file' }, { status: 500 });
  }
}

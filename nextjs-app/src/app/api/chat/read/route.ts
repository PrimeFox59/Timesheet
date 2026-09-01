import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/socketBroadcaster';

export async function POST(request: Request) {
  try {
    const { user_id, recipient_id = 'ALL' } = await request.json();

    if (!user_id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    let candidateMessages: any[] = [];

    if (recipient_id === 'ALL') {
      candidateMessages = db.prepare(`
        SELECT id, read_by FROM chat_messages 
        WHERE recipient_id = 'ALL' AND sender_id != ?
      `).all(user_id);
    } else if (recipient_id.startsWith('PRJ_')) {
      candidateMessages = db.prepare(`
        SELECT id, read_by FROM chat_messages 
        WHERE recipient_id = ? AND sender_id != ?
      `).all(recipient_id, user_id);
    } else {
      // 1-on-1 direct chat
      candidateMessages = db.prepare(`
        SELECT id, read_by FROM chat_messages 
        WHERE (sender_id = ? AND recipient_id = ?)
      `).all(recipient_id, user_id);
    }

    const updateStmt = db.prepare('UPDATE chat_messages SET read_by = ? WHERE id = ?');

    for (const msg of candidateMessages) {
      let readList: string[] = [];
      try {
        readList = JSON.parse(msg.read_by || '[]');
      } catch {
        readList = [];
      }

      if (!readList.includes(user_id)) {
        readList.push(user_id);
        updateStmt.run(JSON.stringify(readList), msg.id);
      }
    }

    await broadcastRealtimeEvent('chat_read', { user_id, recipient_id });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('POST /api/chat/read error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/socketBroadcaster';
import { getWibTimestamp } from '@/lib/dateUtils';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || searchParams.get('user_id');
    const recipientId = searchParams.get('recipientId') || searchParams.get('recipient_id') || 'ALL';
    const limit = Number(searchParams.get('limit')) || 100;

    let messages: any[] = [];

    if (recipientId === 'ALL') {
      // General commissioning team chat
      messages = db.prepare(`
        SELECT * FROM chat_messages 
        WHERE recipient_id = 'ALL' 
        ORDER BY id ASC 
        LIMIT ?
      `).all(limit);
    } else if (recipientId.startsWith('PRJ_')) {
      // Project-specific channel
      messages = db.prepare(`
        SELECT * FROM chat_messages 
        WHERE recipient_id = ? 
        ORDER BY id ASC 
        LIMIT ?
      `).all(recipientId, limit);
    } else if (userId) {
      // Direct Message (1-on-1) between userId and recipientId
      messages = db.prepare(`
        SELECT * FROM chat_messages 
        WHERE (sender_id = ? AND recipient_id = ?) 
           OR (sender_id = ? AND recipient_id = ?)
        ORDER BY id ASC 
        LIMIT ?
      `).all(userId, recipientId, recipientId, userId, limit);
    }

    // Compute unread count for current user
    let unreadCount = 0;
    let latestUnreadSender = '';
    let latestUnreadText = '';
    let latestUnreadChannel = 'ALL';

    if (userId) {
      const allCandidateUnreads = db.prepare(`
        SELECT sender_id, sender_name, recipient_id, message, read_by 
        FROM chat_messages 
        WHERE sender_id != ? 
          AND (recipient_id = ? OR recipient_id = 'ALL')
        ORDER BY id DESC
        LIMIT 50
      `).all(userId, userId) as any[];

      for (const msg of allCandidateUnreads) {
        let readList: string[] = [];
        try {
          readList = JSON.parse(msg.read_by || '[]');
        } catch {
          readList = [];
        }

        if (!readList.includes(userId)) {
          unreadCount++;
          if (!latestUnreadSender) {
            latestUnreadSender = msg.sender_name;
            latestUnreadText = msg.message;
            latestUnreadChannel = msg.recipient_id === 'ALL' ? 'ALL' : msg.sender_id;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      messages,
      unreadCount,
      latestUnreadSender,
      latestUnreadText,
      latestUnreadChannel
    });

  } catch (error: any) {
    console.error('GET /api/chat/messages error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      sender_id,
      sender_name,
      sender_role = 'Member',
      recipient_id = 'ALL',
      message = '',
      file_url = '',
      file_name = '',
      file_size = 0,
      file_type = ''
    } = body;

    const cleanMessage = (message || '').trim();
    const cleanFileUrl = (file_url || '').trim();
    const cleanFileName = (file_name || '').trim();
    const cleanFileSize = Number(file_size) || 0;
    const cleanFileType = (file_type || '').trim();

    if (!sender_id || !sender_name || (!cleanMessage && !cleanFileUrl)) {
      return NextResponse.json({ error: 'Sender ID, Sender Name, and either a Message or a File are required' }, { status: 400 });
    }

    const senderExists = db.prepare('SELECT id FROM users WHERE id = ?').get(sender_id);
    if (!senderExists) {
      return NextResponse.json({ error: 'User account not found in database. Session expired.' }, { status: 401 });
    }

    const timestamp = getWibTimestamp();
    const initialReadBy = JSON.stringify([sender_id]);

    const result = db.prepare(`
      INSERT INTO chat_messages (sender_id, sender_name, sender_role, recipient_id, message, read_by, file_url, file_name, file_size, file_type, timestamp, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sender_id,
      sender_name,
      sender_role,
      recipient_id,
      cleanMessage,
      initialReadBy,
      cleanFileUrl,
      cleanFileName,
      cleanFileSize,
      cleanFileType,
      timestamp,
      timestamp
    );

    const newMsg = {
      id: result.lastInsertRowid,
      client_msg_id: body.client_msg_id || undefined,
      sender_id,
      sender_name,
      sender_role,
      recipient_id,
      message: cleanMessage,
      read_by: initialReadBy,
      file_url: cleanFileUrl,
      file_name: cleanFileName,
      file_size: cleanFileSize,
      file_type: cleanFileType,
      timestamp,
      created_at: timestamp
    };

    // Broadcast realtime event to all connected clients
    await broadcastRealtimeEvent('chat_message', newMsg);

    return NextResponse.json({
      success: true,
      message: newMsg
    });

  } catch (error: any) {
    console.error('POST /api/chat/messages error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('id');
    const userId = searchParams.get('userId') || searchParams.get('user_id');

    if (!messageId || !userId) {
      return NextResponse.json({ error: 'Message ID and User ID are required' }, { status: 400 });
    }

    const message = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(messageId) as any;
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const user = db.prepare('SELECT id, role FROM users WHERE LOWER(id) = LOWER(?)').get(userId) as any;
    const isSuperUser = user && (user.role?.toLowerCase() === 'superuser' || user.id.toLowerCase() === 'prime');

    // Users can delete their own messages; Superusers can delete any message
    if (message.sender_id.toLowerCase() !== userId.toLowerCase() && !isSuperUser) {
      return NextResponse.json({ error: 'Forbidden: You can only delete your own messages' }, { status: 403 });
    }

    db.prepare('DELETE FROM chat_messages WHERE id = ?').run(messageId);

    // Broadcast deletion realtime event so all clients update instantly
    await broadcastRealtimeEvent('chat_message_deleted', {
      id: Number(messageId),
      sender_id: message.sender_id,
      recipient_id: message.recipient_id
    });

    return NextResponse.json({
      success: true,
      message: 'Message deleted successfully',
      id: Number(messageId)
    });
  } catch (error: any) {
    console.error('DELETE /api/chat/messages error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

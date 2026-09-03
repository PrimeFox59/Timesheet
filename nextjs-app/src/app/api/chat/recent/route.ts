import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json({ error: 'userId parameter is required' }, { status: 400 });
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // 1. Get recent direct message partner summaries
    const recentPartners = db.prepare(`
      SELECT 
        CASE 
          WHEN sender_id = ? THEN recipient_id 
          ELSE sender_id 
        END AS partner_id,
        MAX(id) AS latest_id,
        MAX(timestamp) AS last_timestamp
      FROM chat_messages
      WHERE recipient_id != 'ALL' 
        AND (sender_id = ? OR recipient_id = ?)
      GROUP BY partner_id
      ORDER BY last_timestamp DESC
      LIMIT 30
    `).all(userId, userId, userId) as any[];

    const recentChats: any[] = [];

    // 2. Fetch details for each conversation partner
    const getMsgStmt = db.prepare(`SELECT * FROM chat_messages WHERE id = ?`);
    const getUserStmt = db.prepare(`SELECT id, username, role, last_active FROM users WHERE id = ?`);
    const getUnreadStmt = db.prepare(`
      SELECT id, read_by 
      FROM chat_messages 
      WHERE sender_id = ? AND recipient_id = ?
      ORDER BY id DESC 
      LIMIT 50
    `);

    for (const item of recentPartners) {
      if (!item.partner_id) continue;
      
      const user = getUserStmt.get(item.partner_id) as any;
      const latestMsg = getMsgStmt.get(item.latest_id) as any;

      if (!user && !latestMsg) continue;

      // Calculate unread count
      const unreadCandidates = getUnreadStmt.all(item.partner_id, userId) as any[];
      let unreadCount = 0;
      for (const cand of unreadCandidates) {
        let readList: string[] = [];
        try {
          readList = JSON.parse(cand.read_by || '[]');
        } catch {
          readList = [];
        }
        if (!readList.includes(userId)) {
          unreadCount++;
        }
      }

      let isOnline = false;
      if (user?.last_active && typeof user.last_active === 'string' && user.last_active.trim() !== '') {
        const isoWibStr = user.last_active.trim().replace(' ', 'T') + '+07:00';
        const lastActiveTime = new Date(isoWibStr).getTime();
        if (!isNaN(lastActiveTime)) {
          const diffMs = Date.now() - lastActiveTime;
          isOnline = diffMs >= -5000 && diffMs <= 60 * 1000;
        }
      }

      let snippet = latestMsg?.message || '';
      if (!snippet && latestMsg?.file_name) {
        snippet = `📎 ${latestMsg.file_name}`;
      } else if (!snippet && latestMsg?.file_url) {
        snippet = '📷 Sent a photo';
      }

      recentChats.push({
        id: item.partner_id,
        name: user?.username || latestMsg?.sender_name || item.partner_id,
        role: user?.role || 'Member',
        last_message: snippet,
        last_sender_id: latestMsg?.sender_id,
        last_sender_name: latestMsg?.sender_name,
        timestamp: latestMsg?.timestamp || item.last_timestamp,
        unread_count: unreadCount,
        is_online: isOnline,
        type: 'direct'
      });
    }

    // 3. Fetch latest #general team message summary
    const latestGeneralMsg = db.prepare(`
      SELECT * FROM chat_messages 
      WHERE recipient_id = 'ALL' 
      ORDER BY id DESC 
      LIMIT 1
    `).get() as any;

    let generalUnread = 0;
    if (latestGeneralMsg) {
      const generalCandidates = db.prepare(`
        SELECT id, sender_id, read_by 
        FROM chat_messages 
        WHERE recipient_id = 'ALL' AND sender_id != ?
        ORDER BY id DESC 
        LIMIT 50
      `).all(userId) as any[];

      for (const cand of generalCandidates) {
        let readList: string[] = [];
        try {
          readList = JSON.parse(cand.read_by || '[]');
        } catch {
          readList = [];
        }
        if (!readList.includes(userId)) {
          generalUnread++;
        }
      }
    }

    let generalSnippet = latestGeneralMsg?.message || 'No messages yet';
    if (!latestGeneralMsg?.message && latestGeneralMsg?.file_name) {
      generalSnippet = `📎 ${latestGeneralMsg.file_name}`;
    }

    const generalChat = {
      id: 'ALL',
      name: '#general (Commissioning Team)',
      role: 'Public Channel',
      last_message: generalSnippet,
      last_sender_id: latestGeneralMsg?.sender_id,
      last_sender_name: latestGeneralMsg?.sender_name,
      timestamp: latestGeneralMsg?.timestamp || '',
      unread_count: generalUnread,
      is_online: true,
      type: 'channel'
    };

    return NextResponse.json({
      success: true,
      general: generalChat,
      recentChats
    });

  } catch (error: any) {
    console.error('GET /api/chat/recent error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

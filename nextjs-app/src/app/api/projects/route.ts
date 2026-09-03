import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/socketBroadcaster';
import { getWibTimestamp } from '@/lib/dateUtils';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const area = searchParams.get('area');
    const status = searchParams.get('status');
    const userId = searchParams.get('userId') || searchParams.get('user_id');
    const userRole = searchParams.get('userRole') || searchParams.get('user_role');

    const roleLower = (userRole || '').toLowerCase();
    const isPrivileged = roleLower === 'superuser' || roleLower === 'site admin' || roleLower.includes('director');

    let query = `
      SELECT 
        p.*,
        COUNT(t.id) as total_tasks,
        SUM(CASE WHEN t.status = 'Done' THEN 1 ELSE 0 END) as completed_tasks,
        COALESCE(AVG(t.progress), 0) as avg_progress,
        COALESCE(SUM(t.estimated_hours), 0) as total_estimated_hours,
        COALESCE(SUM(t.actual_hours), 0) as total_actual_hours
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id
    `;

    const conditions: string[] = [];
    const params: any[] = [];

    // User visibility restriction: Non-admins only see projects where they are creator, manager, member, or task assignee
    if (!isPrivileged) {
      if (userId) {
        conditions.push(`(
          p.created_by = ? 
          OR p.manager_id = ? 
          OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?) 
          OR p.id IN (SELECT project_id FROM tasks WHERE assignee_id = ?)
        )`);
        params.push(userId, userId, userId, userId);
      } else {
        conditions.push('1 = 0');
      }
    }

    if (area && area !== 'ALL') {
      conditions.push('p.area = ?');
      params.push(area);
    }
    if (status && status !== 'ALL') {
      conditions.push('p.status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` GROUP BY p.id ORDER BY p.start_date ASC, p.id DESC`;

    const projects = db.prepare(query).all(...params);

    // Fetch tasks & members for each project
    const tasksStmt = db.prepare(`SELECT * FROM tasks WHERE project_id = ? ORDER BY start_date ASC`);
    const membersStmt = db.prepare(`
      SELECT 
        pm.user_id, 
        COALESCE(u.username, pm.user_id) as username, 
        COALESCE(u.role, 'User') as system_role, 
        pm.role as project_role,
        pm.created_at as joined_at
      FROM project_members pm
      LEFT JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
      ORDER BY pm.role DESC, u.username ASC
    `);

    const formatted = projects.map((p: any) => {
      const tasks = tasksStmt.all(p.id);
      const members = membersStmt.all(p.id);
      return {
        ...p,
        progress: Math.round(p.avg_progress),
        tasks,
        members,
        member_ids: members.map((m: any) => m.user_id)
      };
    });

    return NextResponse.json({ success: true, projects: formatted });
  } catch (error: any) {
    console.error("GET /api/projects error:", error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      code,
      description,
      area,
      status,
      priority,
      start_date,
      end_date,
      budget_hours,
      manager_id,
      manager_name,
      created_by,
      member_ids = []
    } = body;

    if (!name || !code || !start_date || !end_date) {
      return NextResponse.json({ error: 'Project name, code, start date, and end date are required' }, { status: 400 });
    }

    // Check code uniqueness
    const existing = db.prepare('SELECT id FROM projects WHERE code = ?').get(code.trim().toUpperCase());
    if (existing) {
      return NextResponse.json({ error: `Project code '${code}' already exists. Please use a unique code.` }, { status: 400 });
    }

    const timestamp = getWibTimestamp();

    const result = db.prepare(`
      INSERT INTO projects (
        name, code, description, area, status, priority,
        start_date, end_date, budget_hours, manager_id, manager_name,
        created_by, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      code.trim().toUpperCase(),
      description?.trim() || '',
      area || 'CMN',
      status || 'In Progress',
      priority || 'Medium',
      start_date,
      end_date,
      Number(budget_hours) || 0,
      manager_id || '',
      manager_name || '',
      created_by || 'admin',
      timestamp,
      timestamp
    );

    const newProjectId = result.lastInsertRowid;

    // Add Creator & Manager & Invited Members
    const insertMember = db.prepare(`
      INSERT OR IGNORE INTO project_members (project_id, user_id, role, invited_by, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    if (created_by) {
      insertMember.run(newProjectId, created_by, 'creator', created_by, timestamp);
    }
    if (manager_id && manager_id !== created_by) {
      insertMember.run(newProjectId, manager_id, 'lead', created_by || 'admin', timestamp);
    }

    if (Array.isArray(member_ids)) {
      for (const uid of member_ids) {
        if (uid && uid !== created_by && uid !== manager_id) {
          insertMember.run(newProjectId, uid, 'member', created_by || 'admin', timestamp);
        }
      }
    }

    const newProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(newProjectId);
    const members = db.prepare(`
      SELECT pm.user_id, COALESCE(u.username, pm.user_id) as username, pm.role as project_role
      FROM project_members pm
      LEFT JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
    `).all(newProjectId);

    return NextResponse.json({ 
      success: true, 
      project: { ...newProject, members, member_ids: members.map((m: any) => m.user_id) }, 
      message: 'Project and member invitations saved successfully.' 
    });
  } catch (error: any) {
    console.error("POST /api/projects error:", error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      name,
      code,
      description,
      area,
      status,
      priority,
      start_date,
      end_date,
      budget_hours,
      manager_id,
      manager_name,
      member_ids,
      invited_by
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const timestamp = getWibTimestamp();

    db.prepare(`
      UPDATE projects
      SET name = ?, code = ?, description = ?, area = ?, status = ?, priority = ?,
          start_date = ?, end_date = ?, budget_hours = ?, manager_id = ?, manager_name = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      name.trim(),
      code.trim().toUpperCase(),
      description?.trim() || '',
      area || 'CMN',
      status || 'In Progress',
      priority || 'Medium',
      start_date,
      end_date,
      Number(budget_hours) || 0,
      manager_id || '',
      manager_name || '',
      timestamp,
      id
    );

    // Sync invited members if provided
    if (Array.isArray(member_ids)) {
      const existingProject: any = db.prepare('SELECT created_by, manager_id FROM projects WHERE id = ?').get(id);
      
      db.prepare('DELETE FROM project_members WHERE project_id = ?').run(id);

      const insertMember = db.prepare(`
        INSERT OR IGNORE INTO project_members (project_id, user_id, role, invited_by, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      if (existingProject?.created_by) {
        insertMember.run(id, existingProject.created_by, 'creator', existingProject.created_by, timestamp);
      }
      if (manager_id && manager_id !== existingProject?.created_by) {
        insertMember.run(id, manager_id, 'lead', invited_by || 'admin', timestamp);
      }

      for (const uid of member_ids) {
        if (uid && uid !== existingProject?.created_by && uid !== manager_id) {
          insertMember.run(id, uid, 'member', invited_by || 'admin', timestamp);
        }
      }
    }

    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    const members = db.prepare(`
      SELECT pm.user_id, COALESCE(u.username, pm.user_id) as username, pm.role as project_role
      FROM project_members pm
      LEFT JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
    `).all(id);

    return NextResponse.json({ 
      success: true, 
      project: { ...updated, members, member_ids: members.map((m: any) => m.user_id) }, 
      message: 'Project and team members updated successfully.' 
    });
  } catch (error: any) {
    console.error("PUT /api/projects error:", error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Cascade delete members and tasks
    db.prepare('DELETE FROM project_members WHERE project_id = ?').run(id);
    db.prepare('DELETE FROM tasks WHERE project_id = ?').run(id);
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);

    return NextResponse.json({ success: true, message: 'Project, team members, and associated tasks deleted successfully.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

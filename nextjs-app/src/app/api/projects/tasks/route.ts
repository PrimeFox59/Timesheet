import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const assigneeId = searchParams.get('assigneeId');
    const status = searchParams.get('status');
    const userId = searchParams.get('userId') || searchParams.get('user_id');
    const userRole = searchParams.get('userRole') || searchParams.get('user_role');

    const roleLower = (userRole || '').toLowerCase();
    const isPrivileged = roleLower === 'superuser' || roleLower === 'site admin' || roleLower.includes('director');

    let query = `
      SELECT t.*, p.name as project_name, p.code as project_code, p.area as project_area
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
    `;

    const conditions: string[] = [];
    const params: any[] = [];

    if (!isPrivileged && userId) {
      conditions.push(`(
        p.created_by = ? 
        OR p.manager_id = ? 
        OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?) 
        OR t.assignee_id = ?
        OR t.delegated_by = ?
      )`);
      params.push(userId, userId, userId, userId, userId);
    }

    if (projectId && projectId !== 'ALL') {
      conditions.push('t.project_id = ?');
      params.push(projectId);
    }
    if (assigneeId && assigneeId !== 'ALL') {
      conditions.push('t.assignee_id = ?');
      params.push(assigneeId);
    }
    if (status && status !== 'ALL') {
      conditions.push('t.status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY t.start_date ASC, t.id ASC`;

    const tasks = db.prepare(query).all(...params);
    return NextResponse.json({ success: true, tasks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      project_id,
      title,
      description,
      area,
      assignee_id,
      assignee_name,
      delegated_by,
      delegated_by_name,
      start_date,
      end_date,
      duration_days,
      progress,
      status,
      priority,
      estimated_hours,
      actual_hours,
      color
    } = body;

    if (!project_id || !title || !start_date || !end_date) {
      return NextResponse.json({ error: 'Project, task title, start date, and end date are required' }, { status: 400 });
    }

    // Calculate duration in days if not provided
    const start = new Date(start_date);
    const end = new Date(end_date);
    const calculatedDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const result = db.prepare(`
      INSERT INTO tasks (
        project_id, title, description, area, assignee_id, assignee_name,
        delegated_by, delegated_by_name, start_date, end_date, duration_days,
        progress, status, priority, estimated_hours, actual_hours, color,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      project_id,
      title.trim(),
      description?.trim() || '',
      area || 'CMN',
      assignee_id || '',
      assignee_name || '',
      delegated_by || '',
      delegated_by_name || '',
      start_date,
      end_date,
      duration_days || calculatedDays,
      Number(progress) || 0,
      status || 'To Do',
      priority || 'Medium',
      Number(estimated_hours) || 0,
      Number(actual_hours) || 0,
      color || '#FF6B00',
      timestamp,
      timestamp
    );

    const newTask = db.prepare(`
      SELECT t.*, p.name as project_name, p.code as project_code
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);

    return NextResponse.json({ success: true, task: newTask, message: 'Task created and delegated successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      project_id,
      title,
      description,
      area,
      assignee_id,
      assignee_name,
      delegated_by,
      delegated_by_name,
      start_date,
      end_date,
      duration_days,
      progress,
      status,
      priority,
      estimated_hours,
      actual_hours,
      color
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    const start = new Date(start_date);
    const end = new Date(end_date);
    const calculatedDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    db.prepare(`
      UPDATE tasks
      SET project_id = COALESCE(?, project_id),
          title = COALESCE(?, title),
          description = COALESCE(?, description),
          area = COALESCE(?, area),
          assignee_id = COALESCE(?, assignee_id),
          assignee_name = COALESCE(?, assignee_name),
          delegated_by = COALESCE(?, delegated_by),
          delegated_by_name = COALESCE(?, delegated_by_name),
          start_date = COALESCE(?, start_date),
          end_date = COALESCE(?, end_date),
          duration_days = COALESCE(?, duration_days),
          progress = COALESCE(?, progress),
          status = COALESCE(?, status),
          priority = COALESCE(?, priority),
          estimated_hours = COALESCE(?, estimated_hours),
          actual_hours = COALESCE(?, actual_hours),
          color = COALESCE(?, color),
          updated_at = ?
      WHERE id = ?
    `).run(
      project_id,
      title?.trim(),
      description !== undefined ? description.trim() : null,
      area,
      assignee_id,
      assignee_name,
      delegated_by,
      delegated_by_name,
      start_date,
      end_date,
      duration_days || (start_date && end_date ? calculatedDays : null),
      progress !== undefined ? Number(progress) : null,
      status,
      priority,
      estimated_hours !== undefined ? Number(estimated_hours) : null,
      actual_hours !== undefined ? Number(actual_hours) : null,
      color,
      timestamp,
      id
    );

    const updated = db.prepare(`
      SELECT t.*, p.name as project_name, p.code as project_code
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = ?
    `).get(id);

    return NextResponse.json({ success: true, task: updated, message: 'Task updated successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return NextResponse.json({ success: true, message: 'Task deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

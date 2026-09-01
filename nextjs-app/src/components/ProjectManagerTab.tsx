'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  FolderKanban, Plus, Calendar, Clock, User, Users, CheckCircle2, 
  AlertCircle, ChevronRight, ChevronLeft, Filter, Search, Edit3, Trash2, 
  BarChart3, LayoutGrid, List, ArrowRight, Flag, Shield, Sparkles, 
  RefreshCw, X, Check, Eye, Lock, UserPlus
} from 'lucide-react';
import { apiUrl } from '@/lib/api';

interface Task {
  id: number;
  project_id: number;
  project_name?: string;
  project_code?: string;
  project_area?: string;
  title: string;
  description: string;
  area: string;
  assignee_id: string;
  assignee_name: string;
  delegated_by: string;
  delegated_by_name: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  progress: number;
  status: 'To Do' | 'In Progress' | 'Review' | 'Done' | 'Blocked';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  estimated_hours: number;
  actual_hours: number;
  color: string;
  created_at: string;
}

interface ProjectMember {
  user_id: string;
  username: string;
  system_role?: string;
  project_role?: string;
  joined_at?: string;
}

interface Project {
  id: number;
  name: string;
  code: string;
  description: string;
  area: string;
  status: 'Planning' | 'In Progress' | 'On Hold' | 'Completed' | 'Cancelled';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  start_date: string;
  end_date: string;
  budget_hours: number;
  manager_id: string;
  manager_name: string;
  created_by: string;
  total_tasks: number;
  completed_tasks: number;
  progress: number;
  total_estimated_hours: number;
  total_actual_hours: number;
  tasks?: Task[];
  members?: ProjectMember[];
  member_ids?: string[];
}

interface ProjectManagerTabProps {
  currentUser: any;
  usersList: any[];
  areasList: string[];
  activeSubTab?: string;
  initialSubTab?: string;
}

const DAY_COL_WIDTH = 44; // Exact pixel width per day cell for 100% accurate alignment
const LEFT_COL_WIDTH = 320; // Exact pixel width for sticky task info column

export default function ProjectManagerTab({
  currentUser,
  usersList = [],
  areasList = [],
  activeSubTab,
  initialSubTab = 'gantt_timeline'
}: ProjectManagerTabProps) {
  const currentSubTab = activeSubTab || initialSubTab;
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters with LocalStorage persistence so switching tabs or refreshing doesn't reset them!
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [selectedArea, setSelectedArea] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Hydrate filters from localStorage on mount
  useEffect(() => {
    try {
      const savedProj = localStorage.getItem('metso_pm_filter_project');
      const savedArea = localStorage.getItem('metso_pm_filter_area');
      const savedStatus = localStorage.getItem('metso_pm_filter_status');
      const savedSearch = localStorage.getItem('metso_pm_filter_search');

      if (savedProj !== null) setSelectedProjectId(savedProj);
      if (savedArea !== null) setSelectedArea(savedArea);
      if (savedStatus !== null) setSelectedStatus(savedStatus);
      if (savedSearch !== null) setSearchQuery(savedSearch);
    } catch (e) {}
  }, []);

  const handleSetSelectedProjectId = (val: string) => {
    setSelectedProjectId(val);
    try {
      localStorage.setItem('metso_pm_filter_project', val);
    } catch (e) {}
  };

  const handleSetSelectedArea = (val: string) => {
    setSelectedArea(val);
    try {
      localStorage.setItem('metso_pm_filter_area', val);
    } catch (e) {}
  };

  const handleSetSelectedStatus = (val: string) => {
    setSelectedStatus(val);
    try {
      localStorage.setItem('metso_pm_filter_status', val);
    } catch (e) {}
  };

  const handleSetSearchQuery = (val: string) => {
    setSearchQuery(val);
    try {
      localStorage.setItem('metso_pm_filter_search', val);
    } catch (e) {}
  };

  const handleResetFilters = () => {
    handleSetSelectedProjectId('ALL');
    handleSetSelectedArea('ALL');
    handleSetSelectedStatus('ALL');
    handleSetSearchQuery('');
  };

  // Modals
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectForm, setProjectForm] = useState({
    name: '',
    code: '',
    description: '',
    area: 'CMN',
    status: 'In Progress',
    priority: 'Medium',
    start_date: new Date().toISOString().substring(0, 10),
    end_date: new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10),
    budget_hours: 100,
    manager_id: currentUser?.id || '',
    manager_name: currentUser?.username || '',
    member_ids: [currentUser?.id || ''] as string[]
  });

  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  // Quick Member Manage Modal
  const [managingMembersProject, setManagingMembersProject] = useState<Project | null>(null);
  const [quickMemberIds, setQuickMemberIds] = useState<string[]>([]);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState({
    project_id: '',
    title: '',
    description: '',
    area: 'CMN',
    assignee_id: currentUser?.id || '',
    assignee_name: currentUser?.username || '',
    start_date: new Date().toISOString().substring(0, 10),
    end_date: new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10),
    duration_days: 14,
    progress: 0,
    status: 'To Do',
    priority: 'Medium',
    estimated_hours: 20,
    actual_hours: 0,
    color: '#FF6B00'
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'project' | 'task'; id: number; name: string } | null>(null);
  const [mounted, setMounted] = useState(false);
  const ganttScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch Data with User Context
  const fetchData = async () => {
    try {
      setRefreshing(true);
      const userParam = `userId=${encodeURIComponent(currentUser?.id || '')}&userRole=${encodeURIComponent(currentUser?.role || '')}`;
      const [projRes, taskRes] = await Promise.all([
        fetch(apiUrl(`/api/projects?${userParam}`)),
        fetch(apiUrl(`/api/projects/tasks?${userParam}`))
      ]);

      const projData = await projRes.json();
      const taskData = await taskRes.json();

      if (projData.success) {
        setProjects(projData.projects || []);
      }
      if (taskData.success) {
        setTasks(taskData.tasks || []);
      }
    } catch (err: any) {
      console.error("Error fetching projects & tasks:", err);
      setFeedback({ type: 'error', text: 'Failed to load projects and tasks.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser?.id, currentUser?.role]);

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (selectedProjectId !== 'ALL' && t.project_id.toString() !== selectedProjectId) return false;
      if (selectedArea !== 'ALL' && t.area !== selectedArea) return false;
      if (selectedStatus !== 'ALL' && t.status !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchAssignee = t.assignee_name.toLowerCase().includes(q);
        const matchProject = (t.project_name || '').toLowerCase().includes(q);
        if (!matchTitle && !matchAssignee && !matchProject) return false;
      }
      if (currentSubTab === 'my_delegations') {
        return t.assignee_id === currentUser?.id || t.delegated_by === currentUser?.id;
      }
      return true;
    });
  }, [tasks, selectedProjectId, selectedArea, selectedStatus, searchQuery, currentSubTab, currentUser]);

  // Gantt Timeline Dates Calculation (with Month grouping)
  const timelineData = useMemo(() => {
    let minDate: Date;
    let maxDate: Date;

    if (filteredTasks.length > 0) {
      const dates = filteredTasks.flatMap(t => [new Date(t.start_date), new Date(t.end_date)]);
      minDate = new Date(Math.min(...dates.map(d => d.getTime())));
      maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    } else {
      minDate = new Date();
      maxDate = new Date(Date.now() + 30 * 86400000);
    }

    minDate = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate() - 3);
    maxDate = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate() + 7);

    const daysList: {
      date: Date;
      dateStr: string;
      dayName: string;
      dayNum: number;
      monthStr: string;
      monthYearLabel: string;
      isToday: boolean;
      isWeekend: boolean;
      index: number;
    }[] = [];

    const monthGroupsMap: { [key: string]: { label: string; count: number; startIndex: number } } = {};

    const curr = new Date(minDate);
    const todayStr = new Date().toISOString().substring(0, 10);
    let dayIdx = 0;

    while (curr <= maxDate) {
      const dateStr = curr.toISOString().substring(0, 10);
      const dayOfWeek = curr.getDay();
      const monthYearLabel = curr.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const monthStr = curr.toLocaleDateString('en-US', { month: 'short' });

      daysList.push({
        date: new Date(curr),
        dateStr,
        dayName: curr.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: curr.getDate(),
        monthStr,
        monthYearLabel,
        isToday: dateStr === todayStr,
        isWeekend: dayOfWeek === 0, // Only Sunday is weekly rest day
        index: dayIdx
      });

      if (!monthGroupsMap[monthYearLabel]) {
        monthGroupsMap[monthYearLabel] = {
          label: monthYearLabel,
          count: 0,
          startIndex: dayIdx
        };
      }
      monthGroupsMap[monthYearLabel].count += 1;

      curr.setDate(curr.getDate() + 1);
      dayIdx += 1;
    }

    const monthGroups = Object.values(monthGroupsMap);
    const totalDays = daysList.length;
    const totalTimelineWidth = totalDays * DAY_COL_WIDTH;
    const todayIndex = daysList.findIndex(d => d.isToday);

    return { minDate, maxDate, daysList, monthGroups, totalDays, totalTimelineWidth, todayIndex };
  }, [filteredTasks]);

  // Auto-scroll to today
  useEffect(() => {
    if (ganttScrollRef.current && timelineData.todayIndex >= 0) {
      const scrollPos = Math.max(0, (timelineData.todayIndex * DAY_COL_WIDTH) - 200);
      ganttScrollRef.current.scrollLeft = scrollPos;
    }
  }, [timelineData.todayIndex]);

  // Project Member Toggle
  const toggleProjectMember = (userId: string) => {
    setProjectForm(prev => {
      const current = prev.member_ids || [];
      if (current.includes(userId)) {
        return { ...prev, member_ids: current.filter(id => id !== userId) };
      } else {
        return { ...prev, member_ids: [...current, userId] };
      }
    });
  };

  const toggleQuickMember = (userId: string) => {
    setQuickMemberIds(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  // Project Submit
  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingProject ? 'PUT' : 'POST';
      const bodyPayload = editingProject
        ? { id: editingProject.id, ...projectForm, invited_by: currentUser?.id }
        : { ...projectForm, created_by: currentUser?.id || 'admin' };

      const res = await fetch(apiUrl('/api/projects'), {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });

      const data = await res.json();
      if (data.success) {
        setFeedback({ type: 'success', text: data.message || 'Project and member invitations saved successfully!' });
        setIsProjectModalOpen(false);
        setEditingProject(null);
        fetchData();
      } else {
        setFeedback({ type: 'error', text: data.error || 'Failed to save project' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Network error' });
    }
  };

  // Quick Save Members
  const handleSaveQuickMembers = async () => {
    if (!managingMembersProject) return;
    try {
      const res = await fetch(apiUrl('/api/projects'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: managingMembersProject.id,
          name: managingMembersProject.name,
          code: managingMembersProject.code,
          description: managingMembersProject.description,
          area: managingMembersProject.area,
          status: managingMembersProject.status,
          priority: managingMembersProject.priority,
          start_date: managingMembersProject.start_date,
          end_date: managingMembersProject.end_date,
          budget_hours: managingMembersProject.budget_hours,
          manager_id: managingMembersProject.manager_id,
          manager_name: managingMembersProject.manager_name,
          member_ids: quickMemberIds,
          invited_by: currentUser?.id
        })
      });

      const data = await res.json();
      if (data.success) {
        setFeedback({ type: 'success', text: 'Project team members updated successfully!' });
        setManagingMembersProject(null);
        fetchData();
      } else {
        setFeedback({ type: 'error', text: data.error || 'Failed to update team members' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Network error' });
    }
  };

  // Task Submit
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingTask ? 'PUT' : 'POST';
      const bodyPayload = editingTask
        ? { id: editingTask.id, ...taskForm }
        : {
            ...taskForm,
            delegated_by: currentUser?.id || '',
            delegated_by_name: currentUser?.username || ''
          };

      const res = await fetch(apiUrl('/api/projects/tasks'), {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });

      const data = await res.json();
      if (data.success) {
        setFeedback({ type: 'success', text: data.message || 'Task and delegation saved successfully!' });
        setIsTaskModalOpen(false);
        setEditingTask(null);
        fetchData();
      } else {
        setFeedback({ type: 'error', text: data.error || 'Failed to save task' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Network error' });
    }
  };

  // Delete
  const handleExecuteDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const url = deleteConfirm.type === 'project'
        ? apiUrl(`/api/projects?id=${deleteConfirm.id}`)
        : apiUrl(`/api/projects/tasks?id=${deleteConfirm.id}`);

      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        setFeedback({ type: 'success', text: `${deleteConfirm.type === 'project' ? 'Project' : 'Task'} deleted successfully!` });
        setDeleteConfirm(null);
        fetchData();
      } else {
        setFeedback({ type: 'error', text: data.error || 'Failed to delete' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'Error deleting item' });
    }
  };

  const openNewTaskModal = (projId?: number) => {
    setEditingTask(null);
    setTaskForm({
      project_id: projId ? projId.toString() : (projects[0]?.id?.toString() || ''),
      title: '',
      description: '',
      area: 'CMN',
      assignee_id: currentUser?.id || '',
      assignee_name: currentUser?.username || '',
      start_date: new Date().toISOString().substring(0, 10),
      end_date: new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10),
      duration_days: 14,
      progress: 0,
      status: 'To Do',
      priority: 'Medium',
      estimated_hours: 20,
      actual_hours: 0,
      color: '#FF6B00'
    });
    setIsTaskModalOpen(true);
  };

  const openEditTaskModal = (task: Task) => {
    setEditingTask(task);
    setTaskForm({
      project_id: task.project_id.toString(),
      title: task.title,
      description: task.description,
      area: task.area,
      assignee_id: task.assignee_id,
      assignee_name: task.assignee_name,
      start_date: task.start_date,
      end_date: task.end_date,
      duration_days: task.duration_days,
      progress: task.progress,
      status: task.status,
      priority: task.priority,
      estimated_hours: task.estimated_hours,
      actual_hours: task.actual_hours,
      color: task.color || '#FF6B00'
    });
    setIsTaskModalOpen(true);
  };

  const openNewProjectModal = () => {
    setEditingProject(null);
    const codeSuggest = `PRJ-METSO-0${projects.length + 1}`;
    setProjectForm({
      name: '',
      code: codeSuggest,
      description: '',
      area: 'CMN',
      status: 'In Progress',
      priority: 'Medium',
      start_date: new Date().toISOString().substring(0, 10),
      end_date: new Date(Date.now() + 45 * 86400000).toISOString().substring(0, 10),
      budget_hours: 150,
      manager_id: currentUser?.id || '',
      manager_name: currentUser?.username || '',
      member_ids: [currentUser?.id || '']
    });
    setMemberSearchQuery('');
    setIsProjectModalOpen(true);
  };

  const openEditProjectModal = (project: Project) => {
    setEditingProject(project);
    setProjectForm({
      name: project.name,
      code: project.code,
      description: project.description,
      area: project.area,
      status: project.status,
      priority: project.priority,
      start_date: project.start_date,
      end_date: project.end_date,
      budget_hours: project.budget_hours,
      manager_id: project.manager_id,
      manager_name: project.manager_name,
      member_ids: project.member_ids || (project.members?.map(m => m.user_id) || [project.manager_id])
    });
    setMemberSearchQuery('');
    setIsProjectModalOpen(true);
  };

  const openManageMembers = (project: Project) => {
    setManagingMembersProject(project);
    setQuickMemberIds(project.member_ids || (project.members?.map(m => m.user_id) || [project.manager_id]));
    setMemberSearchQuery('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Done':
      case 'Completed':
        return 'bg-emerald-500/10 text-emerald-700 border-emerald-300';
      case 'In Progress':
        return 'bg-orange-500/10 text-orange-800 border-orange-300';
      case 'Review':
        return 'bg-blue-500/10 text-blue-700 border-blue-300';
      case 'Planning':
      case 'To Do':
        return 'bg-slate-500/10 text-slate-700 border-slate-300';
      case 'Blocked':
      case 'Cancelled':
        return 'bg-rose-500/10 text-rose-700 border-rose-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return 'bg-rose-100 text-rose-800 font-extrabold';
      case 'High':
        return 'bg-orange-100 text-orange-800 font-bold';
      case 'Medium':
        return 'bg-amber-100 text-amber-800 font-medium';
      case 'Low':
        return 'bg-slate-100 text-slate-600';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-5 animate-smooth-fade pb-16">
      
      {/* Unified Compact Control Bar: Actions & Filters */}
      <div className="glass-card rounded-3xl p-5 shadow-sm border border-white/80 space-y-4">
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-orange-400 to-[#FF6B00] text-white shadow-md shadow-orange-500/20 shrink-0">
              <FolderKanban className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                Project Manager &amp; Commissioning Timeline
              </h2>
              <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-[#FF6B00]" />
                <span>Private: Accessible only to invited members &amp; Site Admin.</span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={fetchData}
              disabled={refreshing}
              className="px-3.5 py-2 rounded-xl bg-white/90 hover:bg-white text-slate-700 border border-slate-200 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
              title="Refresh data"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#FF6B00] ${refreshing ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </button>

            <button
              onClick={openNewProjectModal}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 text-[#FF6B00]" />
              <span>New Project</span>
            </button>

            <button
              onClick={() => openNewTaskModal()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#E05B00] hover:from-[#E05B00] hover:to-[#C04600] text-white text-xs font-black transition flex items-center gap-1.5 shadow-lg shadow-orange-500/25 cursor-pointer active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              <span>Delegate Task</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="pt-3 border-t border-slate-200/60 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
          
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-slate-500 font-bold">
              <Filter className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span>Filter:</span>
            </div>

            {/* Project Filter */}
            <select
              value={selectedProjectId}
              onChange={e => handleSetSelectedProjectId(e.target.value)}
              className="px-3 py-1.5 rounded-xl glass-input font-bold text-slate-800 text-xs cursor-pointer"
            >
              <option value="ALL">All Visible Projects ({projects.length})</option>
              {projects.map(p => (
                <option key={p.id} value={p.id.toString()}>{p.code} - {p.name}</option>
              ))}
            </select>

            {/* Area Filter */}
            <select
              value={selectedArea}
              onChange={e => handleSetSelectedArea(e.target.value)}
              className="px-3 py-1.5 rounded-xl glass-input font-bold text-slate-800 text-xs cursor-pointer"
            >
              <option value="ALL">All Areas</option>
              {areasList.map(a => (
                <option key={a} value={a}>Area: {a}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={e => handleSetSelectedStatus(e.target.value)}
              className="px-3 py-1.5 rounded-xl glass-input font-bold text-slate-800 text-xs cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="To Do">To Do</option>
              <option value="In Progress">In Progress</option>
              <option value="Review">Review</option>
              <option value="Done">Done</option>
              <option value="Blocked">Blocked</option>
            </select>

            {(selectedProjectId !== 'ALL' || selectedArea !== 'ALL' || selectedStatus !== 'ALL' || searchQuery) && (
              <button
                onClick={handleResetFilters}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 underline px-2 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          {/* Search Box */}
          <div className="relative max-w-xs w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => handleSetSearchQuery(e.target.value)}
              placeholder="Search task, project, member..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs glass-input font-medium"
            />
          </div>

        </div>

      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in ${
          feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="p-1 rounded-lg hover:bg-black/5 text-slate-400 hover:text-slate-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* VIEW 1: GANTT CHART TIMELINE */}
      {(currentSubTab === 'gantt_timeline' || !currentSubTab) && (
        <div className="glass-card rounded-3xl p-5 shadow-lg border border-white/80 space-y-4">
          
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#FF6B00]" />
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Gantt Timeline Schedule ({filteredTasks.length} Tasks in {projects.length} Visible Projects)
              </h3>
            </div>

            <div className="flex items-center gap-2 bg-slate-100/90 px-3 py-1 rounded-xl border border-slate-200 text-xs">
              <span className="text-[11px] font-bold text-slate-500">Legend:</span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Done
              </span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-orange-700">
                <span className="w-2 h-2 rounded-full bg-[#FF6B00]" /> In Progress
              </span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-slate-600">
                <span className="w-2 h-2 rounded-full bg-slate-400" /> To Do
              </span>
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <Calendar className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-xs font-semibold">No accessible project tasks found. Please create a project and invite team members.</p>
              <button
                onClick={() => openNewProjectModal()}
                className="px-4 py-2 rounded-xl btn-orange text-xs font-bold"
              >
                + Create New Project
              </button>
            </div>
          ) : (
            <div 
              ref={ganttScrollRef}
              className="overflow-x-auto rounded-2xl border border-slate-200 shadow-inner max-h-[620px] overflow-y-auto bg-slate-50/50"
            >
              <div 
                style={{ width: `${LEFT_COL_WIDTH + timelineData.totalTimelineWidth}px` }} 
                className="relative select-none text-xs"
              >
                
                {/* 1. TIMELINE HEADER */}
                <div className="sticky top-0 z-30 flex flex-col bg-slate-900 text-white shadow-md">
                  
                  {/* Row A: Month Headers */}
                  <div className="flex border-b border-slate-800 font-mono text-[10px] font-extrabold uppercase">
                    <div 
                      style={{ width: `${LEFT_COL_WIDTH}px` }} 
                      className="shrink-0 p-2.5 bg-slate-950 border-r border-slate-800 sticky left-0 z-40 flex items-center justify-between tracking-wider text-slate-300"
                    >
                      <span>Task &amp; Delegated Assignee</span>
                      <span className="text-[9px] text-slate-500 font-normal">({filteredTasks.length})</span>
                    </div>

                    <div className="flex">
                      {timelineData.monthGroups.map((mg) => (
                        <div
                          key={mg.label}
                          style={{ width: `${mg.count * DAY_COL_WIDTH}px` }}
                          className="py-1.5 px-3 border-r border-slate-800 text-center font-bold tracking-widest text-orange-400/90 bg-slate-900/90 truncate"
                        >
                          {mg.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Row B: Day Columns */}
                  <div className="flex font-mono text-[10px]">
                    <div 
                      style={{ width: `${LEFT_COL_WIDTH}px` }} 
                      className="shrink-0 bg-slate-950 border-r border-slate-800 sticky left-0 z-40"
                    />

                    <div className="flex">
                      {timelineData.daysList.map((day) => (
                        <div
                          key={day.dateStr}
                          style={{ width: `${DAY_COL_WIDTH}px` }}
                          className={`py-1.5 text-center border-r border-slate-800/80 flex flex-col items-center justify-center shrink-0 ${
                            day.isToday 
                              ? 'bg-[#FF6B00] text-white font-black shadow-inner' 
                              : day.isWeekend 
                              ? 'bg-slate-800/60 text-slate-400' 
                              : 'text-slate-300'
                          }`}
                          title={day.dateStr}
                        >
                          <span className="text-[9px] uppercase leading-none opacity-80">{day.dayName}</span>
                          <span className="text-[11px] font-bold leading-tight mt-0.5">{day.dayNum}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* 2. TIMELINE TASK ROWS */}
                <div className="divide-y divide-slate-200/80 bg-white relative">
                  
                  {/* Today Indicator Line */}
                  {timelineData.todayIndex >= 0 && (
                    <div
                      style={{
                        left: `${LEFT_COL_WIDTH + (timelineData.todayIndex * DAY_COL_WIDTH) + (DAY_COL_WIDTH / 2)}px`
                      }}
                      className="absolute top-0 bottom-0 w-0.5 bg-[#FF6B00] z-20 pointer-events-none opacity-80"
                    />
                  )}

                  {filteredTasks.map((task) => {
                    const startIndex = timelineData.daysList.findIndex(d => d.dateStr === task.start_date);
                    const endIndex = timelineData.daysList.findIndex(d => d.dateStr === task.end_date);

                    const startCol = startIndex >= 0 ? startIndex : 0;
                    const endCol = endIndex >= 0 ? endIndex : timelineData.totalDays - 1;
                    const spanCols = Math.max(1, endCol - startCol + 1);

                    const barLeftPx = (startCol * DAY_COL_WIDTH) + 3;
                    const barWidthPx = (spanCols * DAY_COL_WIDTH) - 6;

                    return (
                      <div
                        key={task.id}
                        className="flex hover:bg-orange-50/40 transition group items-center relative h-[52px]"
                      >
                        {/* Task Left Info Column (Sticky) */}
                        <div 
                          style={{ width: `${LEFT_COL_WIDTH}px` }}
                          className="shrink-0 px-3 py-2 bg-white/95 border-r border-slate-200/90 sticky left-0 z-20 shadow-xs flex items-center justify-between gap-2 h-full"
                        >
                          <div className="truncate space-y-0.5 flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200 shrink-0">
                                {task.area}
                              </span>
                              <span 
                                onClick={() => openEditTaskModal(task)}
                                className="text-xs font-bold text-slate-900 truncate hover:text-[#FF6B00] cursor-pointer"
                                title={task.title}
                              >
                                {task.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium truncate">
                              <span className="text-[#FF6B00] font-bold font-mono shrink-0">{task.project_code}</span>
                              <span>&bull;</span>
                              <span className="flex items-center gap-1 truncate text-slate-600">
                                <User className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">{task.assignee_name || 'Unassigned'}</span>
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => openEditTaskModal(task)}
                            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition shrink-0 cursor-pointer"
                            title="Edit task"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Timeline Grid Background & Pixel-Perfect Gantt Bar */}
                        <div 
                          style={{ width: `${timelineData.totalTimelineWidth}px` }} 
                          className="flex relative h-full items-center shrink-0"
                        >
                          {/* Background Day Cells */}
                          {timelineData.daysList.map((day) => (
                            <div
                              key={day.dateStr}
                              style={{ width: `${DAY_COL_WIDTH}px` }}
                              className={`h-full border-r border-slate-100 shrink-0 ${
                                day.isToday ? 'bg-orange-100/30' : day.isWeekend ? 'bg-slate-50' : ''
                              }`}
                            />
                          ))}

                          {/* Pixel-Accurate Gantt Bar */}
                          <div
                            onClick={() => openEditTaskModal(task)}
                            style={{
                              left: `${barLeftPx}px`,
                              width: `${barWidthPx}px`,
                              backgroundColor: task.color || '#FF6B00'
                            }}
                            className="absolute h-8 rounded-xl shadow-md cursor-pointer transition-all hover:scale-[1.01] hover:shadow-lg overflow-hidden flex items-center px-2.5 z-10 group/bar border border-white/40"
                            title={`${task.title}\nDates: ${task.start_date} to ${task.end_date} (${task.duration_days} days)\nProgress: ${task.progress}%\nAssignee: ${task.assignee_name}\nDelegated by: ${task.delegated_by_name}`}
                          >
                            {/* Inner Progress Overlay */}
                            <div
                              style={{ width: `${task.progress}%` }}
                              className="absolute left-0 top-0 bottom-0 bg-white/25 backdrop-brightness-125 transition-all"
                            />

                            {/* Label inside bar */}
                            <div className="relative z-10 flex items-center justify-between w-full text-white text-[11px] font-bold drop-shadow-xs truncate gap-2">
                              <span className="truncate flex items-center gap-1.5">
                                {task.progress === 100 ? (
                                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-white text-emerald-600 shrink-0 font-black text-[10px]">
                                    ✓
                                  </span>
                                ) : null}
                                <span className="truncate">{task.title}</span>
                              </span>
                              <span className="font-mono text-[10px] bg-black/30 px-1.5 py-0.5 rounded-lg shrink-0">
                                {task.progress}%
                              </span>
                            </div>
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>
          )}

        </div>
      )}

      {/* VIEW 2: PROJECTS & TASKS CARDS */}
      {currentSubTab === 'projects_list' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map(proj => (
              <div
                key={proj.id}
                className="glass-card rounded-3xl p-5 shadow-md border border-white/80 space-y-4 hover:shadow-xl transition-all duration-200 relative group flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-black bg-orange-100 text-[#FF6B00] border border-orange-200">
                          {proj.code}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5 text-[#FF6B00]" />
                          <span>{(proj.members?.length || 1)} Members</span>
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-slate-900 leading-snug pt-1">
                        {proj.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openManageMembers(proj)}
                        className="p-1.5 rounded-xl hover:bg-orange-50 text-slate-400 hover:text-[#FF6B00] transition cursor-pointer"
                        title="Manage & Invite Team Members"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openEditProjectModal(proj)}
                        className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition cursor-pointer"
                        title="Edit Project"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ type: 'project', id: proj.id, name: proj.name })}
                        className="p-1.5 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        title="Delete Project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {proj.description || 'No detailed scope provided.'}
                  </p>

                  {/* Badges */}
                  <div className="flex items-center gap-2 flex-wrap text-[11px]">
                    <span className={`px-2 py-0.5 rounded-lg border font-bold ${getStatusBadge(proj.status)}`}>
                      {proj.status}
                    </span>
                    <span className={`px-2 py-0.5 rounded-lg font-bold ${getPriorityBadge(proj.priority)}`}>
                      {proj.priority} Priority
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold border border-slate-200">
                      Area: {proj.area}
                    </span>
                  </div>

                  {/* Invited Member Avatars Stack */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                    <span className="text-[11px] font-bold text-slate-500">Invited Members:</span>
                    <div 
                      onClick={() => openManageMembers(proj)}
                      className="flex items-center -space-x-1.5 cursor-pointer hover:opacity-80 transition"
                      title="Click to view or invite team members"
                    >
                      {(proj.members || []).slice(0, 4).map((m, idx) => (
                        <div
                          key={m.user_id || idx}
                          className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-[#FF6B00] text-white flex items-center justify-center font-bold text-[9px] border-2 border-white shadow-xs"
                          title={`${m.username} (${m.project_role || 'member'})`}
                        >
                          {m.username.charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {(proj.members?.length || 0) > 4 && (
                        <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center font-mono font-bold text-[9px] border-2 border-white shadow-xs">
                          +{(proj.members?.length || 0) - 4}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-500">Overall Progress</span>
                      <span className="text-slate-900 font-mono">{proj.progress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200/80">
                      <div
                        style={{ width: `${proj.progress}%` }}
                        className="h-full bg-gradient-to-r from-[#FF6B00] to-emerald-500 rounded-full transition-all duration-300"
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/70 text-xs">
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/60">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">Tasks</span>
                      <span className="font-bold text-slate-800">
                        {proj.completed_tasks} / {proj.total_tasks} Done
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/60">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">Hours</span>
                      <span className="font-bold text-slate-800">
                        {proj.total_actual_hours}h / {proj.budget_hours}h
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                    <Calendar className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>{proj.start_date} &rarr; {proj.end_date}</span>
                  </div>

                  <button
                    onClick={() => openNewTaskModal(proj.id)}
                    className="px-2.5 py-1 rounded-lg bg-orange-100 hover:bg-orange-200 text-[#FF6B00] font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Task</span>
                  </button>
                </div>

              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 3: TASK DELEGATION TABLE */}
      {currentSubTab === 'my_delegations' && (
        <div className="glass-card rounded-3xl p-5 shadow-lg border border-white/80 space-y-4">
          
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-[#FF6B00]" />
                Delegated Task Register ({filteredTasks.length} Tasks)
              </h3>
              <p className="text-xs text-slate-500">
                Tasks assigned to you or delegated by you to other team members.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 shadow-inner">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Task Title &amp; Project</th>
                  <th className="px-3 py-3">Area</th>
                  <th className="px-3 py-3">Assignee</th>
                  <th className="px-3 py-3">Delegated By</th>
                  <th className="px-3 py-3">Timeline</th>
                  <th className="px-3 py-3">Progress</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 font-medium bg-white/70">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      No delegated tasks match the current filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((t) => (
                    <tr key={t.id} className="hover:bg-orange-50/50 transition">
                      
                      {/* Title & Project */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 text-xs">{t.title}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                          <span className="font-bold text-[#FF6B00]">{t.project_code}</span>
                          <span>&bull;</span>
                          <span className="truncate max-w-[200px]">{t.project_name}</span>
                        </div>
                      </td>

                      {/* Area */}
                      <td className="px-3 py-3">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold font-mono bg-slate-100 border border-slate-200 text-slate-800">
                          {t.area}
                        </span>
                      </td>

                      {/* Assignee */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-[#FF6B00] text-white flex items-center justify-center font-bold text-[10px] shadow-2xs shrink-0">
                            {t.assignee_name ? t.assignee_name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 leading-tight">{t.assignee_name}</div>
                            <div className="text-[10px] font-mono text-slate-400">{t.assignee_id}</div>
                          </div>
                        </div>
                      </td>

                      {/* Delegated By */}
                      <td className="px-3 py-3 text-[11px] text-slate-600 font-medium">
                        {t.delegated_by_name || 'Admin'}
                      </td>

                      {/* Dates */}
                      <td className="px-3 py-3 text-[11px] whitespace-nowrap">
                        <div className="font-mono font-semibold text-slate-800">
                          {t.start_date} &rarr; {t.end_date}
                        </div>
                        <div className="text-[10px] text-slate-400">{t.duration_days} work days</div>
                      </td>

                      {/* Progress */}
                      <td className="px-3 py-3 w-32">
                        <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                          <span className="text-slate-600">{t.progress}%</span>
                          <span className="text-slate-400 text-[10px] font-mono">{t.actual_hours}h/{t.estimated_hours}h</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                          <div
                            style={{ width: `${t.progress}%` }}
                            className="h-full bg-[#FF6B00] rounded-full"
                          />
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3">
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border ${getStatusBadge(t.status)}`}>
                          {t.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditTaskModal(t)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition cursor-pointer"
                            title="Edit task"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ type: 'task', id: t.id, name: t.title })}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title="Delete task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* CREATE / EDIT PROJECT MODAL WITH MEMBER INVITATIONS (PORTALED) */}
      {isProjectModalOpen && mounted && typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="glass-card max-w-xl w-full max-h-[88vh] flex flex-col rounded-3xl shadow-2xl bg-white border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            
            {/* Sticky Header */}
            <div className="shrink-0 px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-orange-100 text-[#FF6B00]">
                  <FolderKanban className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingProject ? 'Edit Commissioning Project' : 'Create Commissioning Project'}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                    <Lock className="w-3 h-3 text-[#FF6B00]" />
                    <span>This project is private and only accessible to invited members.</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsProjectModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveProject} className="flex-1 overflow-y-auto flex flex-col justify-between">
              
              <div className="p-6 space-y-4 text-xs">
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Project Name</label>
                    <input
                      type="text"
                      value={projectForm.name}
                      onChange={e => setProjectForm({ ...projectForm, name: e.target.value })}
                      placeholder="e.g. Grinding Mill Commissioning"
                      className="w-full px-3 py-2 rounded-xl glass-input font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Project Code</label>
                    <input
                      type="text"
                      value={projectForm.code}
                      onChange={e => setProjectForm({ ...projectForm, code: e.target.value })}
                      placeholder="PRJ-METSO-01"
                      className="w-full px-3 py-2 rounded-xl glass-input font-mono uppercase font-bold"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Scope &amp; Target Description</label>
                  <textarea
                    value={projectForm.description}
                    onChange={e => setProjectForm({ ...projectForm, description: e.target.value })}
                    rows={2}
                    placeholder="Details of commissioning scope, milestones and deliverables..."
                    className="w-full px-3 py-2 rounded-xl glass-input font-medium"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Primary Area</label>
                    <select
                      value={projectForm.area}
                      onChange={e => setProjectForm({ ...projectForm, area: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl glass-input font-bold"
                    >
                      {areasList.map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Status</label>
                    <select
                      value={projectForm.status}
                      onChange={e => setProjectForm({ ...projectForm, status: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl glass-input font-bold"
                    >
                      <option value="Planning">Planning</option>
                      <option value="In Progress">In Progress</option>
                      <option value="On Hold">On Hold</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Priority</label>
                    <select
                      value={projectForm.priority}
                      onChange={e => setProjectForm({ ...projectForm, priority: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl glass-input font-bold"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={projectForm.start_date}
                      onChange={e => setProjectForm({ ...projectForm, start_date: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl glass-input font-medium"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={projectForm.end_date}
                      onChange={e => setProjectForm({ ...projectForm, end_date: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl glass-input font-medium"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Budget Hours</label>
                    <input
                      type="number"
                      value={projectForm.budget_hours}
                      onChange={e => setProjectForm({ ...projectForm, budget_hours: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl glass-input font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Project Lead / Manager</label>
                  <select
                    value={projectForm.manager_id}
                    onChange={e => {
                      const selUser = usersList.find(u => u.id === e.target.value);
                      const newManagerId = e.target.value;
                      setProjectForm(prev => {
                        const updatedMembers = prev.member_ids.includes(newManagerId) 
                          ? prev.member_ids 
                          : [...prev.member_ids, newManagerId];
                        return {
                          ...prev,
                          manager_id: newManagerId,
                          manager_name: selUser?.username || '',
                          member_ids: updatedMembers
                        };
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl glass-input font-bold"
                  >
                    <option value="">-- Select Project Manager --</option>
                    {usersList.map(u => (
                      <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                    ))}
                  </select>
                </div>

                {/* PROJECT INVITATION & MEMBERS SECTION */}
                <div className="space-y-2.5 p-3.5 rounded-2xl bg-orange-50/60 border border-orange-200/80">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <UserPlus className="w-4 h-4 text-[#FF6B00]" />
                      <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                        Invite Project Members
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-[#FF6B00] text-white text-[10px] font-black">
                      {projectForm.member_ids.length} Members Selected
                    </span>
                  </div>

                  {/* Selected Chips */}
                  {projectForm.member_ids.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {projectForm.member_ids.map(uid => {
                        const userObj = usersList.find(u => u.id === uid);
                        const isLead = uid === projectForm.manager_id || uid === (editingProject?.created_by || currentUser?.id);
                        return (
                          <span
                            key={uid}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-orange-200 text-[11px] font-bold text-slate-800 shadow-2xs"
                          >
                            <span className="w-2 h-2 rounded-full bg-[#FF6B00]" />
                            <span>{userObj?.username || uid}</span>
                            {isLead && <span className="text-[9px] text-[#FF6B00] bg-orange-100 px-1 rounded font-mono font-black">LEAD</span>}
                            {!isLead && (
                              <button
                                type="button"
                                onClick={() => toggleProjectMember(uid)}
                                className="p-0.5 hover:bg-slate-100 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Search user inside modal */}
                  <div className="relative">
                    <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={memberSearchQuery}
                      onChange={e => setMemberSearchQuery(e.target.value)}
                      placeholder="Search user / commissioning engineer to invite..."
                      className="w-full pl-7 pr-3 py-1 rounded-lg text-[11px] bg-white border border-slate-200 font-medium"
                    />
                  </div>

                  {/* Member Checkbox List */}
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 shadow-inner">
                    {usersList
                      .filter(u => !memberSearchQuery || u.username.toLowerCase().includes(memberSearchQuery.toLowerCase()) || u.id.toLowerCase().includes(memberSearchQuery.toLowerCase()))
                      .map(u => {
                        const isSelected = projectForm.member_ids.includes(u.id);
                        const isLead = u.id === projectForm.manager_id || u.id === (editingProject?.created_by || currentUser?.id);
                        return (
                          <div
                            key={u.id}
                            onClick={() => !isLead && toggleProjectMember(u.id)}
                            className={`px-3 py-2 flex items-center justify-between transition cursor-pointer ${
                              isSelected ? 'bg-orange-50/80 text-slate-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                            } ${isLead ? 'cursor-default opacity-85' : ''}`}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700 shrink-0">
                                {u.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="text-xs">{u.username}</span>
                                <span className="text-[10px] text-slate-400 font-mono ml-1.5">({u.id} &bull; {u.role})</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {isLead && <span className="text-[9px] font-mono text-[#FF6B00] bg-orange-100 px-1.5 py-0.5 rounded font-bold">Project Lead</span>}
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={isLead}
                                readOnly
                                className="w-4 h-4 rounded text-[#FF6B00] accent-[#FF6B00]"
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

              </div>

              {/* Sticky Footer */}
              <div className="shrink-0 px-6 py-4 border-t border-slate-100 bg-slate-50/90 flex items-center justify-between z-10">
                <span className="text-[11px] font-bold text-slate-500">
                  {projectForm.member_ids.length} Members Selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsProjectModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl btn-orange text-white font-black shadow-md transition cursor-pointer active:scale-95"
                  >
                    {editingProject ? 'Save Changes' : 'Create Project'}
                  </button>
                </div>
              </div>

            </form>

          </div>
        </div>,
        document.body
      ) : null}

      {/* QUICK MANAGE MEMBERS MODAL (PORTALED) */}
      {managingMembersProject && mounted && typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="glass-card max-w-md w-full max-h-[85vh] flex flex-col rounded-3xl shadow-2xl bg-white border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            
            {/* Sticky Header */}
            <div className="shrink-0 px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-orange-100 text-[#FF6B00]">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Invite &amp; Manage Team
                  </h3>
                  <p className="text-xs text-[#FF6B00] font-mono font-bold">
                    {managingMembersProject.code} - {managingMembersProject.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setManagingMembersProject(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3.5 text-xs">
              <p className="text-slate-500 font-medium">
                Select authorized team members who can view, access, and receive task delegations for this project.
              </p>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={memberSearchQuery}
                  onChange={e => setMemberSearchQuery(e.target.value)}
                  placeholder="Search user / engineer..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs glass-input font-medium"
                />
              </div>

              {/* Members List */}
              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-2xl bg-white divide-y divide-slate-100 shadow-inner">
                {usersList
                  .filter(u => !memberSearchQuery || u.username.toLowerCase().includes(memberSearchQuery.toLowerCase()) || u.id.toLowerCase().includes(memberSearchQuery.toLowerCase()))
                  .map(u => {
                    const isSelected = quickMemberIds.includes(u.id);
                    const isLead = u.id === managingMembersProject.manager_id || u.id === managingMembersProject.created_by;
                    return (
                      <div
                        key={u.id}
                        onClick={() => !isLead && toggleQuickMember(u.id)}
                        className={`px-3.5 py-2.5 flex items-center justify-between transition cursor-pointer ${
                          isSelected ? 'bg-orange-50/80 text-slate-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                        } ${isLead ? 'cursor-default opacity-85' : ''}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-[#FF6B00] text-white flex items-center justify-center font-bold text-[10px] shadow-2xs shrink-0">
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">{u.username}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{u.id} &bull; {u.role}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isLead && (
                            <span className="text-[9px] font-mono text-[#FF6B00] bg-orange-100 px-1.5 py-0.5 rounded font-bold">
                              Lead / Creator
                            </span>
                          )}
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isLead}
                            readOnly
                            className="w-4 h-4 rounded text-[#FF6B00] accent-[#FF6B00]"
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Sticky Footer */}
            <div className="shrink-0 px-6 py-4 border-t border-slate-100 bg-slate-50/90 flex items-center justify-between z-10">
              <span className="text-[11px] font-bold text-slate-500">
                {quickMemberIds.length} Members Selected
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setManagingMembersProject(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuickMembers}
                  className="px-5 py-2 rounded-xl btn-orange text-white font-black shadow-md transition cursor-pointer active:scale-95"
                >
                  Save Members
                </button>
              </div>
            </div>

          </div>
        </div>,
        document.body
      ) : null}

      {/* CREATE / EDIT TASK & DELEGATE MODAL (PORTALED) */}
      {isTaskModalOpen && mounted && typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="glass-card max-w-lg w-full max-h-[88vh] flex flex-col rounded-3xl shadow-2xl bg-white border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            
            {/* Sticky Header */}
            <div className="shrink-0 px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-orange-100 text-[#FF6B00]">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingTask ? 'Edit Delegated Task' : 'Delegate New Task'}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Assign team members, set timeline duration, and define budget hours.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTaskModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveTask} className="flex-1 overflow-y-auto flex flex-col justify-between">
              
              <div className="p-6 space-y-3.5 text-xs">
                
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Parent Project</label>
                  <select
                    value={taskForm.project_id}
                    onChange={e => setTaskForm({ ...taskForm, project_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl glass-input font-bold text-slate-800"
                    required
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id.toString()}>{p.code} - {p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Task Title</label>
                  <input
                    type="text"
                    value={taskForm.title}
                    onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                    placeholder="e.g. Cold Loop Check & Megger Test"
                    className="w-full px-3 py-2 rounded-xl glass-input font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Work Instructions &amp; SOP Details</label>
                  <textarea
                    value={taskForm.description}
                    onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
                    rows={2}
                    placeholder="Provide step-by-step instructions, SOP specs, or reference drawings..."
                    className="w-full px-3 py-2 rounded-xl glass-input font-medium"
                  />
                </div>

                {/* Assignee Selection (Delegation) */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-orange-50/60 border border-orange-200/80">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-[#FF6B00]" />
                      Delegated Assignee
                    </label>
                    <select
                      value={taskForm.assignee_id}
                      onChange={e => {
                        const selUser = usersList.find(u => u.id === e.target.value);
                        setTaskForm({
                          ...taskForm,
                          assignee_id: e.target.value,
                          assignee_name: selUser?.username || ''
                        });
                      }}
                      className="w-full px-3 py-2 rounded-xl glass-input font-bold text-slate-900"
                      required
                    >
                      <option value="">-- Select Team Member --</option>
                      {usersList.map(u => (
                        <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Work Area</label>
                    <select
                      value={taskForm.area}
                      onChange={e => setTaskForm({ ...taskForm, area: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl glass-input font-bold"
                    >
                      {areasList.map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Timeline Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={taskForm.start_date}
                      onChange={e => setTaskForm({ ...taskForm, start_date: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl glass-input font-medium"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Target End Date</label>
                    <input
                      type="date"
                      value={taskForm.end_date}
                      onChange={e => setTaskForm({ ...taskForm, end_date: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl glass-input font-medium"
                      required
                    />
                  </div>
                </div>

                {/* Status, Priority, Progress */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Status</label>
                    <select
                      value={taskForm.status}
                      onChange={e => setTaskForm({ ...taskForm, status: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl glass-input font-bold"
                    >
                      <option value="To Do">To Do</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Review">Review</option>
                      <option value="Done">Done</option>
                      <option value="Blocked">Blocked</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Priority</label>
                    <select
                      value={taskForm.priority}
                      onChange={e => setTaskForm({ ...taskForm, priority: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl glass-input font-bold"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Progress (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={taskForm.progress}
                      onChange={e => setTaskForm({ ...taskForm, progress: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl glass-input font-bold"
                    />
                  </div>
                </div>

                {/* Hours & Color */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Est. Hours</label>
                    <input
                      type="number"
                      value={taskForm.estimated_hours}
                      onChange={e => setTaskForm({ ...taskForm, estimated_hours: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl glass-input font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Actual Hours</label>
                    <input
                      type="number"
                      value={taskForm.actual_hours}
                      onChange={e => setTaskForm({ ...taskForm, actual_hours: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl glass-input font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Timeline Color</label>
                    <div className="flex items-center gap-1.5 mt-1">
                      {['#FF6B00', '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444'].map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setTaskForm({ ...taskForm, color: c })}
                          style={{ backgroundColor: c }}
                          className={`w-6 h-6 rounded-full transition cursor-pointer ${taskForm.color === c ? 'ring-2 ring-slate-900 scale-110' : 'opacity-70 hover:opacity-100'}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

              </div>

              {/* Sticky Footer */}
              <div className="shrink-0 px-6 py-4 border-t border-slate-100 bg-slate-50/90 flex items-center justify-end gap-2 z-10">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl btn-orange text-white font-black shadow-md transition cursor-pointer active:scale-95"
                >
                  {editingTask ? 'Save Task' : 'Delegate Task'}
                </button>
              </div>

            </form>

          </div>
        </div>,
        document.body
      ) : null}

      {/* DELETE CONFIRMATION MODAL (PORTALED) */}
      {deleteConfirm && mounted && typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-150">
          <div className="glass-card max-w-sm w-full rounded-3xl p-6 space-y-4 shadow-2xl bg-white border border-slate-200 relative drop-shadow-2xl text-center my-auto">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Delete {deleteConfirm.type === 'project' ? 'Project' : 'Task'}?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete <strong>&quot;{deleteConfirm.name}&quot;</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md transition cursor-pointer active:scale-95"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}

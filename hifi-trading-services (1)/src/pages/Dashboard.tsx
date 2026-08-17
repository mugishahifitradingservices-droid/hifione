import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  Activity, 
  Users, 
  Building2, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Award, 
  Calendar, 
  RefreshCw, 
  ChevronRight, 
  ListTodo, 
  Plus,
  Compass,
  Contact2,
  Phone,
  Mail,
  Check,
  Search,
  ArrowUpRight,
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
  ShieldCheck,
  Smartphone,
  UsersRound
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { DashboardSkeleton } from '../components/ui/Skeleton';
import { PlannedVisit, FollowUp, Organization, AppUser, Priority } from '../types';
import { 
  computeDashboardKPIs, 
  MonthKPIStats, 
  DailyVisitTrend, 
  PriorityDistributionItem, 
  ExecutiveBenchmarkItem, 
  TaskStatusBreakdownItem 
} from '../lib/dashboardData';
import QuickTaskModal from '../components/dashboard/QuickTaskModal';
import QuickVisitModal from '../components/dashboard/QuickVisitModal';

export default function Dashboard() {
  const { appUser } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();

  // Selected filters
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-08');
  const [selectedExecutiveId, setSelectedExecutiveId] = useState<string>('ALL');
  const [chartViewMode, setChartViewMode] = useState<'trends' | 'priority' | 'benchmarks'>('trends');

  // Modals
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  
  // Data state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visits, setVisits] = useState<PlannedVisit[]>([]);
  const [tasks, setTasks] = useState<FollowUp[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [executives, setExecutives] = useState<AppUser[]>([]);
  
  // Task filter & search
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [taskSearch, setTaskSearch] = useState<string>('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Month list
  const availableMonths = [
    { value: '2026-08', label: 'August 2026 (Current)' },
    { value: '2026-07', label: 'July 2026' },
    { value: '2026-06', label: 'June 2026' },
    { value: '2026-05', label: 'May 2026' }
  ];

  const isManagerOrAdmin = appUser?.role === 'MARKETING_MANAGER' || appUser?.role === 'SYSTEM_ADMIN' || appUser?.role === 'CEO' || appUser?.role === 'SALES_MANAGER';

  useEffect(() => {
    fetchDashboardData();
  }, [selectedMonth]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // 1. Fetch organizations
      const { data: orgsData } = await supabase.from('organizations').select('*').order('created_at', { ascending: false });
      const loadedOrgs: Organization[] = (orgsData as Organization[]) || [];
      setOrganizations(loadedOrgs);

      // 2. Fetch users/profiles
      let loadedUsers: AppUser[] = [];
      const { data: profilesData } = await supabase.from('profiles').select('*').order('name');
      if (profilesData && profilesData.length > 0) {
        loadedUsers = profilesData as AppUser[];
      } else {
        const { data: usersData } = await supabase.from('app_users').select('*').order('name');
        if (usersData && usersData.length > 0) {
          loadedUsers = usersData as AppUser[];
        }
      }
      setExecutives(loadedUsers);

      // 3. Fetch planned visits for selected month
      const { data: visitsData } = await supabase
        .from('planned_visits')
        .select('*')
        .gte('planned_date', `${selectedMonth}-01`)
        .lte('planned_date', `${selectedMonth}-31`);

      if (visitsData && visitsData.length > 0) {
        const enrichedVisits = (visitsData as PlannedVisit[]).map(v => ({
          ...v,
          organization: loadedOrgs.find(o => o.id === v.organization_id),
          employee: loadedUsers.find(u => u.id === v.employee_id)
        }));
        setVisits(enrichedVisits);
      } else {
        setVisits([]);
      }

      // 4. Fetch follow up tasks
      const { data: tasksData } = await supabase.from('follow_ups').select('*').order('due_date', { ascending: true });
      if (tasksData && tasksData.length > 0) {
        const enrichedTasks = (tasksData as FollowUp[]).map(t => ({
          ...t,
          organization: loadedOrgs.find(o => o.id === t.organization_id),
          employee: loadedUsers.find(u => u.id === t.assigned_to)
        }));
        setTasks(enrichedTasks);
      } else {
        setTasks([]);
      }

    } catch (err) {
      console.warn('Dashboard data fetch notice:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  // Compute processed KPI statistics
  const kpiData = useMemo(() => {
    return computeDashboardKPIs(
      selectedMonth,
      visits,
      tasks,
      organizations,
      executives,
      selectedExecutiveId
    );
  }, [selectedMonth, visits, tasks, organizations, executives, selectedExecutiveId]);

  // Handle Mark Task Complete
  const handleMarkTaskComplete = async (taskId: string) => {
    try {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'COMPLETED' } : t));
      await supabase.from('follow_ups').update({ status: 'COMPLETED' }).eq('id', taskId);

      setActionSuccessMsg('Action item marked as Completed!');
      setTimeout(() => setActionSuccessMsg(null), 3000);
    } catch (e) {
      console.error('Error updating task status:', e);
    }
  };

  // Today's Date String
  const todayStr = useMemo(() => {
    const today = new Date();
    return today.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }, []);

  // Time of day greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Filter tasks for task queue list
  const pendingTasksList = useMemo(() => {
    return tasks
      .filter(t => {
        if (t.status === 'COMPLETED' || t.status === 'CANCELLED') return false;
        if (selectedExecutiveId !== 'ALL' && t.assigned_to !== selectedExecutiveId) return false;
        if (taskPriorityFilter !== 'ALL' && t.priority !== taskPriorityFilter) return false;
        if (taskSearch.trim() !== '') {
          const q = taskSearch.toLowerCase();
          const matchTitle = t.title.toLowerCase().includes(q);
          const matchOrg = t.organization?.name?.toLowerCase().includes(q) || false;
          return matchTitle || matchOrg;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.priority === 'HIGH' && b.priority !== 'HIGH') return -1;
        if (b.priority === 'HIGH' && a.priority !== 'HIGH') return 1;
        return (a.due_date || '').localeCompare(b.due_date || '');
      });
  }, [tasks, selectedExecutiveId, taskPriorityFilter, taskSearch]);

  if (loading && !refreshing) {
    return <DashboardSkeleton />;
  }

  const { stats, dailyTrends, priorityDistribution, executiveBenchmarks } = kpiData;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & QUICK FILTERS */}
      {/* ========================================================================= */}
      <div className={cn(
        "p-5 sm:p-6 rounded-2xl border flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 transition-all shadow-xs",
        isDark ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
      )}>
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="bg-[#1848A0]/10 text-[#1848A0] dark:bg-[#1848A0]/25 dark:text-blue-300 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tracking-wider uppercase">
              {appUser?.role ? appUser.role.replace(/_/g, ' ') : 'HIFI ONE'}
            </span>
            <span className="text-xs font-semibold text-slate-400">
              • {todayStr}
            </span>
          </div>
          <h1 className={cn("text-xl sm:text-2xl font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
            {greeting}, {appUser?.name ? appUser.name.split(' ')[0] : 'Team Member'}
          </h1>
          <p className={cn("text-xs sm:text-sm mt-0.5", isDark ? "text-slate-400" : "text-slate-600")}>
            Here is your field operations pulse and performance overview for <span className="font-bold text-[#1848A0] dark:text-blue-400">{stats.monthLabel}</span>.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Month Selector */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold flex-1 sm:flex-initial",
            isDark ? "bg-[#0B0B0E] border-[#2A2A38] text-slate-200" : "bg-slate-50 border-slate-200 text-slate-700"
          )}>
            <Calendar className="w-4 h-4 text-[#1848A0] shrink-0" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-0 outline-hidden font-bold cursor-pointer pr-1 w-full text-xs"
            >
              {availableMonths.map(m => (
                <option key={m.value} value={m.value} className={isDark ? 'bg-[#15151A] text-white' : 'bg-white text-slate-900'}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Executive Filter (Visible to managers or if multiple executives exist) */}
          {isManagerOrAdmin && executives.length > 0 && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold flex-1 sm:flex-initial",
              isDark ? "bg-[#0B0B0E] border-[#2A2A38] text-slate-200" : "bg-slate-50 border-slate-200 text-slate-700"
            )}>
              <Users className="w-4 h-4 text-[#F88020] shrink-0" />
              <select
                value={selectedExecutiveId}
                onChange={(e) => setSelectedExecutiveId(e.target.value)}
                className="bg-transparent border-0 outline-hidden font-bold cursor-pointer pr-1 max-w-[140px] truncate text-xs"
              >
                <option value="ALL" className={isDark ? 'bg-[#15151A] text-white' : 'bg-white text-slate-900'}>
                  All Staff ({executives.length})
                </option>
                {executives.map(exec => (
                  <option key={exec.id} value={exec.id} className={isDark ? 'bg-[#15151A] text-white' : 'bg-white text-slate-900'}>
                    {exec.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Refresh Action */}
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            title="Refresh Live Data"
            className={cn(
              "p-2.5 rounded-xl border flex items-center justify-center transition-all shadow-xs cursor-pointer hover:border-[#1848A0]",
              isDark ? "bg-[#0B0B0E] border-[#2A2A38] text-slate-300 hover:text-white" : "bg-slate-50 border-slate-200 text-slate-600 hover:text-[#1848A0]"
            )}
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin text-[#1848A0]")} />
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {actionSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-between text-xs font-semibold animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-500" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="hover:opacity-75 font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. QUICK ACTION SHORTCUTS (1-Tap Workflows) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {appUser?.role === 'MARKETING_EXECUTIVE' ? (
          <Link
            to="/field/mode"
            className={cn(
              "p-3.5 rounded-2xl border transition-all flex items-center gap-3 group hover:border-[#1848A0] shadow-xs cursor-pointer relative overflow-hidden",
              isDark ? "bg-[#15151A] border-[#1848A0]/40 hover:bg-[#1848A0]/10" : "bg-blue-50/60 border-blue-200 hover:bg-blue-50"
            )}
          >
            <div className="w-10 h-10 rounded-xl bg-[#1848A0] text-white flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform shadow-sm">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={cn("text-xs sm:text-sm font-extrabold truncate", isDark ? "text-white" : "text-slate-900")}>
                  Field Mode
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
              </div>
              <div className="text-[11px] text-[#1848A0] dark:text-blue-400 font-bold truncate">
                Mobile GPS Route
              </div>
            </div>
          </Link>
        ) : isManagerOrAdmin ? (
          <Link
            to="/field/team-planning"
            className={cn(
              "p-3.5 rounded-2xl border transition-all flex items-center gap-3 group hover:border-[#1848A0] shadow-xs cursor-pointer relative overflow-hidden",
              isDark ? "bg-[#15151A] border-[#1848A0]/40 hover:bg-[#1848A0]/10" : "bg-blue-50/60 border-blue-200 hover:bg-blue-50"
            )}
          >
            <div className="w-10 h-10 rounded-xl bg-[#1848A0] text-white flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform shadow-sm">
              <UsersRound className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={cn("text-xs sm:text-sm font-extrabold truncate", isDark ? "text-white" : "text-slate-900")}>
                  Team Planning
                </span>
              </div>
              <div className="text-[11px] text-[#1848A0] dark:text-blue-400 font-bold truncate">
                Assign & Track Visits
              </div>
            </div>
          </Link>
        ) : null}

        <Link
          to="/field/my-day"
          className={cn(
            "p-3.5 rounded-2xl border transition-all flex items-center gap-3 group hover:border-[#1848A0] shadow-xs cursor-pointer",
            isDark ? "bg-[#15151A] border-[#2A2A35] hover:bg-[#1A1A24]" : "bg-white border-slate-200 hover:bg-slate-50"
          )}
        >
          <div className="w-10 h-10 rounded-xl bg-[#1848A0]/10 text-[#1848A0] dark:text-blue-400 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
            <Compass className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className={cn("text-xs sm:text-sm font-bold truncate", isDark ? "text-white" : "text-slate-900")}>
              My Day Planner
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {stats.totalVisitsPlanned} planned visits
            </div>
          </div>
        </Link>

        <Link
          to="/organizations"
          className={cn(
            "p-3.5 rounded-2xl border transition-all flex items-center gap-3 group hover:border-[#F88020] shadow-xs cursor-pointer",
            isDark ? "bg-[#15151A] border-[#2A2A35] hover:bg-[#1A1A24]" : "bg-white border-slate-200 hover:bg-slate-50"
          )}
        >
          <div className="w-10 h-10 rounded-xl bg-[#F88020]/10 text-[#F88020] flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className={cn("text-xs sm:text-sm font-bold truncate", isDark ? "text-white" : "text-slate-900")}>
              Organizations
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {organizations.length} total accounts
            </div>
          </div>
        </Link>

        <button
          onClick={() => setIsTaskModalOpen(true)}
          className={cn(
            "p-3.5 rounded-2xl border transition-all flex items-center gap-3 group hover:border-emerald-500 shadow-xs cursor-pointer text-left",
            isDark ? "bg-[#15151A] border-[#2A2A35] hover:bg-[#1A1A24]" : "bg-white border-slate-200 hover:bg-slate-50"
          )}
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
            <Plus className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className={cn("text-xs sm:text-sm font-bold truncate", isDark ? "text-white" : "text-slate-900")}>
              Add Follow-up
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              Create quick task
            </div>
          </div>
        </button>

        <button
          onClick={() => setIsVisitModalOpen(true)}
          className={cn(
            "p-3.5 rounded-2xl border transition-all flex items-center gap-3 group hover:border-blue-500 shadow-xs cursor-pointer text-left",
            isDark ? "bg-[#15151A] border-[#2A2A35] hover:bg-[#1A1A24]" : "bg-white border-slate-200 hover:bg-slate-50"
          )}
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className={cn("text-xs sm:text-sm font-bold truncate", isDark ? "text-white" : "text-slate-900")}>
              Schedule Visit
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              Plan new meeting
            </div>
          </div>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. FOUR CORE KEY PERFORMANCE INDICATORS (KPI CARDS) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: VISITS COMPLETED */}
        <div className={cn(
          "p-5 rounded-2xl border transition-all shadow-xs flex flex-col justify-between",
          isDark ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
        )}>
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#1848A0] dark:text-blue-400 block mb-1">
                Completed Field Visits
              </span>
              <div className={cn("text-2xl sm:text-3xl font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                {stats.totalVisitsCompleted} <span className="text-xs font-semibold text-slate-400">/ {stats.totalVisitsPlanned}</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t dark:border-[#252530] space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className={isDark ? "text-slate-400" : "text-slate-600"}>Progress</span>
              <span className="text-emerald-500 font-bold">{stats.visitCompletionRate}% Completed</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-[#252530] h-2 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(stats.visitCompletionRate, 100)}%` }} 
              />
            </div>
          </div>
        </div>

        {/* KPI 2: OPEN TASKS & FOLLOW-UPS */}
        <div className={cn(
          "p-5 rounded-2xl border transition-all shadow-xs flex flex-col justify-between",
          isDark ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
        )}>
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#F88020] block mb-1">
                Follow-up Action Queue
              </span>
              <div className={cn("text-2xl sm:text-3xl font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                {stats.pendingTasks} <span className="text-xs font-semibold text-slate-400">Pending</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-[#F88020]/10 border border-[#F88020]/20 text-[#F88020] flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t dark:border-[#252530] flex items-center justify-between text-xs font-semibold">
            {stats.overdueTasks > 0 ? (
              <span className="text-rose-500 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> {stats.overdueTasks} Overdue
              </span>
            ) : (
              <span className="text-emerald-500 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> All On Schedule
              </span>
            )}
            <span className="text-slate-400">{stats.highPriorityPendingTasks} High Priority</span>
          </div>
        </div>

        {/* KPI 3: CLIENTS ENGAGED */}
        <div className={cn(
          "p-5 rounded-2xl border transition-all shadow-xs flex flex-col justify-between",
          isDark ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
        )}>
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-500 block mb-1">
                Clients Engaged ({stats.month})
              </span>
              <div className={cn("text-2xl sm:text-3xl font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                {stats.totalOrganizationsCovered} <span className="text-xs font-semibold text-slate-400">/ {organizations.length} Orgs</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t dark:border-[#252530] flex items-center justify-between text-xs font-semibold">
            <span className={isDark ? "text-slate-400" : "text-slate-600"}>Market Coverage</span>
            <span className="font-bold text-[#1848A0] dark:text-blue-400">
              {organizations.length > 0 ? Math.round((stats.totalOrganizationsCovered / organizations.length) * 100) : 0}% Active Reach
            </span>
          </div>
        </div>

        {/* KPI 4: AVERAGE PRIORITY SCORE */}
        <div className={cn(
          "p-5 rounded-2xl border transition-all shadow-xs flex flex-col justify-between",
          isDark ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
        )}>
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-500 block mb-1">
                Average Priority Rating
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className={cn("text-2xl sm:text-3xl font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                  {stats.averagePriorityScore.toFixed(2)}
                </span>
                <span className="text-xs font-bold text-slate-400">/ 3.00</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t dark:border-[#252530] flex items-center justify-between text-xs font-semibold">
            <span className="text-emerald-500 font-bold">
              {stats.averagePriorityScore >= 2.5 ? 'Tier 1 Quality' : stats.averagePriorityScore >= 1.5 ? 'Tier 2 Target' : 'Standard'}
            </span>
            <span className="text-slate-400">{stats.highPriorityCount} High Priority</span>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 4. MAIN DUAL-PANE RESPONSIVE DASHBOARD LAYOUT */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ----------------------------------------------------------------------- */}
        {/* LEFT COLUMN (7 COLS): VISUAL PERFORMANCE & ACTION QUEUE */}
        {/* ----------------------------------------------------------------------- */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Visual Analytics Segment */}
          <div className={cn(
            "p-5 sm:p-6 rounded-2xl border transition-all shadow-xs",
            isDark ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
          )}>
            {/* Header with Segment Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h2 className={cn("text-base sm:text-lg font-bold flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                  <Activity className="w-4 h-4 text-[#1848A0] shrink-0" />
                  Field Performance Velocity
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time analytics for {stats.monthLabel}
                </p>
              </div>

              {/* View Switcher Tabs */}
              <div className={cn(
                "flex items-center gap-1 p-1 rounded-xl border text-xs font-semibold self-start sm:self-auto",
                isDark ? "bg-[#0B0B0E] border-[#2A2A38]" : "bg-slate-100 border-slate-200"
              )}>
                <button
                  onClick={() => setChartViewMode('trends')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                    chartViewMode === 'trends'
                      ? "bg-[#1848A0] text-white shadow-xs font-bold"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Visits</span>
                </button>
                <button
                  onClick={() => setChartViewMode('priority')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                    chartViewMode === 'priority'
                      ? "bg-[#1848A0] text-white shadow-xs font-bold"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  <PieIcon className="w-3.5 h-3.5" />
                  <span>Priority</span>
                </button>
                {isManagerOrAdmin && (
                  <button
                    onClick={() => setChartViewMode('benchmarks')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                      chartViewMode === 'benchmarks'
                        ? "bg-[#1848A0] text-white shadow-xs font-bold"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Team</span>
                  </button>
                )}
              </div>
            </div>

            {/* Rendered Chart based on Selected Mode */}
            <div className="h-64 sm:h-72 w-full">
              {chartViewMode === 'trends' && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={dailyTrends}
                    margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="plannedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1848A0" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#1848A0" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      stroke={isDark ? '#2A2A35' : '#E2E8F0'} 
                      vertical={false}
                    />
                    <XAxis 
                      dataKey="day" 
                      tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }}
                      axisLine={{ stroke: isDark ? '#2A2A35' : '#CBD5E1' }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: isDark ? '#1A1A24' : '#FFFFFF',
                        borderColor: isDark ? '#333342' : '#CBD5E1',
                        borderRadius: '12px',
                        fontSize: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                      itemStyle={{ fontWeight: 600 }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="completed" 
                      name="Completed Visits"
                      stroke="#10B981" 
                      strokeWidth={2.5}
                      fillOpacity={1} 
                      fill="url(#completedGrad)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="planned" 
                      name="Planned Capacity"
                      stroke="#1848A0" 
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      fillOpacity={1} 
                      fill="url(#plannedGrad)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}

              {chartViewMode === 'priority' && (
                <div className="relative h-full w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={priorityDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="count"
                      >
                        {priorityDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(val, name, item: any) => [`${val} items (${item?.payload?.percentage || 0}%)`, name]}
                        contentStyle={{
                          backgroundColor: isDark ? '#1A1A24' : '#FFFFFF',
                          borderColor: isDark ? '#333342' : '#CBD5E1',
                          borderRadius: '12px',
                          fontSize: '12px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Centered Score Badge */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Score</div>
                    <div className={cn("text-2xl font-black", isDark ? "text-white" : "text-slate-900")}>
                      {stats.averagePriorityScore.toFixed(2)}
                    </div>
                    <div className="text-[10px] font-bold text-emerald-500">
                      Tier 1 Target
                    </div>
                  </div>
                </div>
              )}

              {chartViewMode === 'benchmarks' && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={executiveBenchmarks}
                    margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                  >
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      stroke={isDark ? '#2A2A35' : '#E2E8F0'} 
                      vertical={false}
                    />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }}
                      axisLine={{ stroke: isDark ? '#2A2A35' : '#CBD5E1' }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: isDark ? '#1A1A24' : '#FFFFFF',
                        borderColor: isDark ? '#333342' : '#CBD5E1',
                        borderRadius: '12px',
                        fontSize: '12px'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                    <Bar dataKey="completedVisits" name="Completed Visits" fill="#10B981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pendingTasks" name="Pending Tasks" fill="#F88020" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Quick Chart Legend / Metric Indicators */}
            <div className={cn(
              "mt-4 pt-3 border-t grid grid-cols-3 gap-2 text-center text-xs font-semibold",
              isDark ? "border-[#252530]" : "border-slate-100"
            )}>
              <div>
                <div className="text-slate-400 text-[10px] uppercase tracking-wider">Completion Rate</div>
                <div className="text-sm font-black text-emerald-500 mt-0.5">{stats.visitCompletionRate}%</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px] uppercase tracking-wider">Active Staff</div>
                <div className="text-sm font-black text-[#1848A0] dark:text-blue-400 mt-0.5">{stats.activeExecutivesCount} Execs</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px] uppercase tracking-wider">Resolution Rate</div>
                <div className="text-sm font-black text-slate-700 dark:text-slate-200 mt-0.5">{stats.taskResolutionRate}%</div>
              </div>
            </div>
          </div>

          {/* Today's Follow-up Action Items */}
          <div className={cn(
            "p-5 sm:p-6 rounded-2xl border transition-all shadow-xs",
            isDark ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
          )}>
            {/* Header & Filter Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className={cn("text-base font-bold flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                  <ListTodo className="w-4 h-4 text-[#F88020]" />
                  Priority Follow-Up Queue ({pendingTasksList.length})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Direct client commitments and upcoming deadlines
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Priority Selector */}
                <div className={cn(
                  "flex items-center gap-1 p-0.5 rounded-xl border text-[11px] font-bold",
                  isDark ? "bg-[#0B0B0E] border-[#2A2A38]" : "bg-slate-100 border-slate-200"
                )}>
                  {(['ALL', 'HIGH', 'MEDIUM'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setTaskPriorityFilter(p)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg transition-all cursor-pointer",
                        taskPriorityFilter === p
                          ? "bg-[#1848A0] text-white shadow-xs"
                          : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                      )}
                    >
                      {p === 'ALL' ? 'All' : p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Task Search Bar */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="Filter action items by name or client..."
                className={cn(
                  "w-full pl-9 pr-3 py-2 rounded-xl border text-xs font-medium outline-hidden transition-all",
                  isDark 
                    ? "bg-[#0B0B0E] border-[#2A2A38] text-white placeholder-slate-500 focus:border-[#1848A0]" 
                    : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-[#1848A0]"
                )}
              />
            </div>

            {/* Task Item List */}
            {pendingTasksList.length === 0 ? (
              <div className={cn(
                "p-8 text-center rounded-xl border font-medium text-xs flex flex-col items-center justify-center gap-2",
                isDark ? "border-[#2A2A35] bg-[#0B0B0E] text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"
              )}>
                <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mb-1" />
                <span className="font-bold text-slate-700 dark:text-slate-300">All caught up!</span>
                <span>No pending action items matching the current filter.</span>
                <button
                  onClick={() => setIsTaskModalOpen(true)}
                  className="mt-2 text-xs font-bold text-[#1848A0] dark:text-blue-400 hover:underline cursor-pointer"
                >
                  + Add New Action Item
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {pendingTasksList.map((task) => {
                  const isHigh = task.priority === 'HIGH';
                  const isOverdue = task.due_date && task.due_date < new Date().toISOString().split('T')[0];

                  return (
                    <div 
                      key={task.id}
                      className={cn(
                        "p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all",
                        isDark ? "bg-[#0B0B0E] border-[#2A2A38] hover:border-slate-700" : "bg-slate-50 border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          onClick={() => handleMarkTaskComplete(task.id)}
                          title="Click to Mark Completed"
                          className={cn(
                            "w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-colors cursor-pointer group",
                            isDark ? "border-slate-700 hover:border-emerald-500 hover:bg-emerald-500/10" : "border-slate-300 hover:border-emerald-500 hover:bg-emerald-50"
                          )}
                        >
                          <Check className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                        </button>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn("text-xs font-bold truncate", isDark ? "text-white" : "text-slate-900")}>
                              {task.title}
                            </span>
                            <span className={cn(
                              "text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0",
                              isHigh ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" :
                              task.priority === 'MEDIUM' ? "bg-orange-500/15 text-orange-600 dark:text-orange-400" :
                              "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                            )}>
                              {task.priority}
                            </span>
                            {isOverdue && (
                              <span className="bg-rose-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                                Overdue
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="font-semibold text-slate-600 dark:text-slate-300 truncate">
                              {task.organization?.name || 'Client Account'}
                            </span>
                            <span>• Due: <strong>{task.due_date || 'Upcoming'}</strong></span>
                            {task.employee && (
                              <span>• Assigned: {task.employee.name}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Done Button */}
                      <button
                        onClick={() => handleMarkTaskComplete(task.id)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600/10 hover:bg-emerald-600 text-emerald-600 hover:text-white border border-emerald-500/30 text-xs font-bold transition-all self-end sm:self-auto shrink-0 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Done</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* RIGHT COLUMN (5 COLS): RECENT CLIENT ACCOUNTS & WORKFLOW DISCIPLINE */}
        {/* ----------------------------------------------------------------------- */}
        <div className="lg:col-span-5 space-y-6">

          {/* Recent Client Organizations */}
          <div className={cn(
            "p-5 sm:p-6 rounded-2xl border transition-all shadow-xs flex flex-col justify-between",
            isDark ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
          )}>
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className={cn("text-base font-bold flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                    <Building2 className="w-4 h-4 text-[#1848A0]" />
                    Strategic Client Accounts
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Direct access to registered client profiles
                  </p>
                </div>
                <Link
                  to="/organizations"
                  className="text-xs font-bold text-[#1848A0] dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>View All</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Organization Cards Feed */}
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {organizations.length === 0 ? (
                  <div className={cn(
                    "p-6 text-center rounded-xl border text-xs font-medium",
                    isDark ? "border-[#2A2A35] bg-[#0B0B0E] text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"
                  )}>
                    No client organizations registered in database yet.
                  </div>
                ) : (
                  organizations.slice(0, 5).map((org) => (
                    <div 
                      key={org.id} 
                      className={cn(
                        "p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all",
                        isDark ? "bg-[#0B0B0E] border-[#2A2A38] hover:border-slate-700" : "bg-slate-50 border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[#1848A0]/10 text-[#1848A0] dark:text-blue-400 font-black flex items-center justify-center text-xs shrink-0">
                          {org.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className={cn("text-xs font-bold truncate", isDark ? "text-white" : "text-slate-900")}>
                            {org.name}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                            {org.type_of_business || 'Commercial Account'} • {org.district || org.city || 'Rwanda'}
                          </div>
                        </div>
                      </div>

                      {/* Direct Action Contacts */}
                      <div className="flex items-center gap-1 shrink-0">
                        {org.phone && (
                          <a
                            href={`tel:${org.phone}`}
                            className="p-1.5 rounded-lg border border-slate-700/30 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title={`Call ${org.phone}`}
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {org.email && (
                          <a
                            href={`mailto:${org.email}`}
                            className="p-1.5 rounded-lg border border-slate-700/30 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title={`Email ${org.email}`}
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => navigate('/organizations')}
                          className="p-1.5 rounded-lg border border-[#1848A0]/30 text-[#1848A0] dark:text-blue-400 hover:bg-[#1848A0]/10 transition-colors cursor-pointer"
                          title="Open details"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t dark:border-[#252530] flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-400">{organizations.length} Total Client Accounts</span>
              <Link 
                to="/organizations"
                className="text-[#1848A0] dark:text-blue-400 font-bold hover:underline"
              >
                + Register New Account
              </Link>
            </div>
          </div>

          {/* HIFI Field Discipline Stepper */}
          <div className={cn(
            "p-5 rounded-2xl border transition-all shadow-xs",
            isDark ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
          )}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-lg bg-[#1848A0] text-white flex items-center justify-center font-black text-xs shrink-0">
                1
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  HIFI ONE Methodology
                </div>
                <div className={cn("text-xs font-bold", isDark ? "text-white" : "text-slate-900")}>
                  Core Field Marketing Execution Loop
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-2">
              {[
                { step: '1', title: 'Plan & Go', desc: 'Schedule route' },
                { step: '2', title: 'Check In', desc: 'Record visit' },
                { step: '3', title: 'Follow Up', desc: 'Identify need' },
                { step: '4', title: 'Convert', desc: 'Close deals' },
              ].map((s, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    "p-2.5 rounded-xl border text-center flex flex-col items-center justify-center",
                    isDark ? "bg-[#0B0B0E] border-[#2A2A38]" : "bg-slate-50 border-slate-200"
                  )}
                >
                  <div className="w-5 h-5 rounded-full bg-[#1848A0]/20 text-[#1848A0] dark:text-blue-400 font-bold text-[10px] flex items-center justify-center mb-1">
                    {s.step}
                  </div>
                  <div className={cn("text-[11px] font-bold", isDark ? "text-white" : "text-slate-900")}>
                    {s.title}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">
                    {s.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}
      {isTaskModalOpen && (
        <QuickTaskModal
          organizations={organizations}
          executives={executives}
          onClose={() => setIsTaskModalOpen(false)}
          onTaskCreated={() => {
            fetchDashboardData();
            setActionSuccessMsg('New follow-up action created successfully!');
            setTimeout(() => setActionSuccessMsg(null), 3000);
          }}
        />
      )}

      {isVisitModalOpen && (
        <QuickVisitModal
          organizations={organizations}
          executives={executives}
          onClose={() => setIsVisitModalOpen(false)}
          onVisitCreated={() => {
            fetchDashboardData();
            setActionSuccessMsg('Field visit scheduled successfully!');
            setTimeout(() => setActionSuccessMsg(null), 3000);
          }}
        />
      )}

    </div>
  );
}

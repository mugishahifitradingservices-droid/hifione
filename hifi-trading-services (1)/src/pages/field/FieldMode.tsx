import React, { useState, useEffect, useMemo } from 'react';
import { 
  Compass, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  Plus, 
  Phone, 
  MessageSquare, 
  Navigation, 
  Building2, 
  User, 
  Briefcase, 
  Calendar, 
  AlertCircle, 
  ChevronRight, 
  Loader2, 
  Sparkles, 
  ShieldCheck, 
  ShieldAlert, 
  Play, 
  Square, 
  Check, 
  Search, 
  Filter, 
  ExternalLink,
  Flame,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Layers,
  Award,
  Cloud,
  CloudOff,
  Radio,
  Send,
  Zap,
  DollarSign,
  FileCheck2,
  Package,
  Mic
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { PlannedVisit, Organization, VisitStatus, Priority } from '../../types';
import { useFieldSession } from '../../hooks/useFieldSession';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { 
  cachePlannedVisits, 
  getCachedPlannedVisits, 
  cacheOrganizations, 
  getCachedOrganizations 
} from '../../lib/offlineSync';
import CheckInExecutionModal from '../../components/field/CheckInExecutionModal';
import WalkInVisitModal from '../../components/field/WalkInVisitModal';
import EndFieldDayModal from '../../components/field/EndFieldDayModal';
import FieldSituationModal from '../../components/field/FieldSituationModal';
import QuickVoiceMemoModal from '../../components/field/QuickVoiceMemoModal';
import OfflineSyncDrawer from '../../components/field/OfflineSyncDrawer';
import FieldMessagesDrawer from '../../components/field/FieldMessagesDrawer';
import { NavLink, Link } from 'react-router-dom';

export default function FieldMode() {
  const { appUser } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Role Access Guard: Field Mode is exclusively for Marketing Executives
  if (appUser && appUser.role !== 'MARKETING_EXECUTIVE') {
    const isManagerOrAdmin = appUser.role === 'MARKETING_MANAGER' || appUser.role === 'SYSTEM_ADMIN' || appUser.role === 'CEO' || appUser.role === 'SALES_MANAGER';

    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center animate-in fade-in duration-300">
        <div className={cn(
          "p-8 rounded-3xl border shadow-lg space-y-5",
          isDark ? "bg-[#14141B] border-[#252532]" : "bg-white border-slate-200"
        )}>
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center mx-auto shadow-xs">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <span>Role Access Notice</span>
            </div>
            <h2 className={cn("text-xl sm:text-2xl font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
              Field Mode is for Marketing Executives Only
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
              Field Mode is a dedicated mobile portal for on-the-ground Marketing Executives to start authorized GPS sessions, log client visits, and capture walk-in opportunities.
            </p>
          </div>

          <div className={cn(
            "p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between",
            isDark ? "bg-[#1B1B26] border-[#2E2E40] text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"
          )}>
            <span>Your Current Role:</span>
            <span className="font-extrabold text-[#1848A0] dark:text-blue-400 uppercase tracking-wider">
              {appUser.role.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
            {isManagerOrAdmin && (
              <Link
                to="/field/team-planning"
                className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-[#1848A0] hover:bg-[#143B85] text-white text-xs font-black transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                <span>Go to Team Planning</span>
              </Link>
            )}

            <Link
              to="/field/my-day"
              className={cn(
                "w-full sm:w-auto px-5 py-2.5 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                isDark ? "bg-[#1E1E28] border-[#2A2A38] text-slate-200 hover:bg-[#2A2A3A]" : "bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200"
              )}
            >
              <Calendar className="w-4 h-4 text-[#1848A0]" />
              <span>My Day Planner</span>
            </Link>

            <Link
              to="/"
              className={cn(
                "w-full sm:w-auto px-4 py-2.5 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                isDark ? "bg-transparent border-[#2A2A38] text-slate-400 hover:text-white" : "bg-transparent border-slate-200 text-slate-600 hover:text-slate-900"
              )}
            >
              <span>Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  // Field Session Hook
  const {
    activeSession,
    currentLocation,
    gpsActive,
    gpsError,
    loading: sessionLoading,
    formattedDuration,
    startSession,
    endSession,
    refreshSession
  } = useFieldSession();

  // Offline Sync Engine & Message Hook
  const {
    isOnline,
    isSyncing,
    pendingCount,
    queue,
    cachedMessages,
    syncNow
  } = useOfflineSync();

  // Visits & Data State (Init with local cache for instant offline rendering)
  const [visits, setVisits] = useState<PlannedVisit[]>(() => getCachedPlannedVisits());
  const [organizations, setOrganizations] = useState<Organization[]>(() => getCachedOrganizations());
  const [loading, setLoading] = useState(visits.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<{ title: string; subtitle?: string; type?: 'success' | 'info' | 'warning' } | null>(null);

  // Modals State
  const [activeVisitForExecution, setActiveVisitForExecution] = useState<PlannedVisit | null>(null);
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [isEndDayModalOpen, setIsEndDayModalOpen] = useState(false);
  const [isSituationModalOpen, setIsSituationModalOpen] = useState(false);
  const [isVoiceMemoModalOpen, setIsVoiceMemoModalOpen] = useState(false);
  const [situationTargetOrg, setSituationTargetOrg] = useState<Organization | null>(null);
  const [isOfflineDrawerOpen, setIsOfflineDrawerOpen] = useState(false);
  const [isMessagesDrawerOpen, setIsMessagesDrawerOpen] = useState(false);
  const [startingSession, setStartingSession] = useState(false);

  // Show auto-dismiss toast
  const triggerToast = (title: string, subtitle?: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToastMessage({ title, subtitle, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Fetch today's visits for this marketing executive
  const fetchFieldData = async () => {
    try {
      if (visits.length === 0) setLoading(true);

      // Check online status before network call
      if (!navigator.onLine) {
        // Load from local storage cache
        const cachedVisits = getCachedPlannedVisits();
        const cachedOrgs = getCachedOrganizations();
        setVisits(cachedVisits);
        setOrganizations(cachedOrgs);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // 1. Fetch Organizations
      const { data: orgsData } = await supabase
        .from('organizations')
        .select('*')
        .order('name');
      const loadedOrgs: Organization[] = (orgsData as Organization[]) || [];
      if (loadedOrgs.length > 0) {
        setOrganizations(loadedOrgs);
        cacheOrganizations(loadedOrgs);
      }

      // 2. Fetch Planned Visits for Today
      let query = supabase
        .from('planned_visits')
        .select('*')
        .eq('planned_date', todayStr)
        .order('planned_start_time', { ascending: true });

      if (appUser?.id) {
        query = query.eq('employee_id', appUser.id);
      }

      const { data: dbVisits, error: visitsErr } = await query;
      if (visitsErr) console.warn('Field visits notice:', visitsErr.message);

      let fetchedVisits: PlannedVisit[] = [];
      if (dbVisits && dbVisits.length > 0) {
        fetchedVisits = dbVisits.map(v => ({
          ...v,
          organization: loadedOrgs.find(o => o.id === v.organization_id)
        }));
      }

      setVisits(fetchedVisits);
      cachePlannedVisits(fetchedVisits);

    } catch (err) {
      console.error('Error loading field mode data (using offline fallback):', err);
      const cachedVisits = getCachedPlannedVisits();
      setVisits(cachedVisits);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFieldData();
  }, [appUser?.id, todayStr]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchFieldData();
    await refreshSession();
    if (isOnline && pendingCount > 0) {
      await syncNow();
    }
  };

  // Start authorized Field Day session
  const handleStartFieldDay = async () => {
    try {
      setStartingSession(true);
      const res = await startSession(`Authorized field day started by ${appUser?.name || 'Executive'}`);
      if (res.success) {
        fetchFieldData();
        triggerToast('Field Day Session Started', 'GPS tracking active during authorized field hours', 'success');
      }
    } catch (err) {
      console.error('Failed to start field day:', err);
    } finally {
      setStartingSession(false);
    }
  };

  // 1-Tap Check In to a visit
  const handleDirectCheckIn = async (visit: PlannedVisit) => {
    if (!activeSession) {
      await handleStartFieldDay();
    }

    try {
      if (navigator.onLine) {
        await supabase
          .from('planned_visits')
          .update({
            status: 'IN_PROGRESS',
            updated_at: new Date().toISOString()
          })
          .eq('id', visit.id);
      }

      // Update local state & cache
      const updatedVisits = visits.map(v => v.id === visit.id ? { ...v, status: 'IN_PROGRESS' as const } : v);
      setVisits(updatedVisits);
      cachePlannedVisits(updatedVisits);
      
      // Open execution modal
      setActiveVisitForExecution({
        ...visit,
        status: 'IN_PROGRESS'
      });
    } catch (err) {
      console.warn('Direct check-in network notice, proceeding in offline mode:', err);
      setActiveVisitForExecution(visit);
    }
  };

  // Callback when a visit is completed in the modal
  const handleVisitCompleted = () => {
    fetchFieldData();
    setActiveVisitForExecution(null);
    triggerToast('Visit Record Saved', !isOnline ? 'Queued in offline storage. Will sync when online.' : 'Synchronized with HIFI ONE cloud.');
  };

  // Callback when a walk in visit is created
  const handleWalkInCreated = (newVisit: PlannedVisit) => {
    const updated = [newVisit, ...visits];
    setVisits(updated);
    cachePlannedVisits(updated);
    setActiveVisitForExecution(newVisit);
    triggerToast('Walk-in Meeting Initialized', 'Visit is now in-progress with GPS coordinates');
  };

  // Open Situation Message modal
  const handleOpenSituationModal = (org?: Organization | null) => {
    setSituationTargetOrg(org || null);
    setIsSituationModalOpen(true);
  };

  // Filtered visits list
  const filteredVisits = useMemo(() => {
    return visits.filter(v => {
      const matchSearch = !searchQuery || 
        v.organization?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.purpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.organization?.district?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;

      if (filterTab === 'PENDING') {
        return v.status === 'PLANNED' || v.status === 'IN_PROGRESS';
      }
      if (filterTab === 'COMPLETED') {
        return v.status === 'COMPLETED';
      }
      return true;
    });
  }, [visits, filterTab, searchQuery]);

  // Find the next active target visit (first in-progress or first planned)
  const currentTargetVisit = useMemo(() => {
    const inProg = visits.find(v => v.status === 'IN_PROGRESS');
    if (inProg) return inProg;
    return visits.find(v => v.status === 'PLANNED') || null;
  }, [visits]);

  // Statistics for today
  const stats = useMemo(() => {
    const total = visits.length;
    const completed = visits.filter(v => v.status === 'COMPLETED').length;
    const inProgress = visits.filter(v => v.status === 'IN_PROGRESS').length;
    const remaining = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, remaining, completionRate };
  }, [visits]);

  return (
    <div className="space-y-4 pb-24 max-w-4xl mx-auto animate-in fade-in duration-200">
      
      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] animate-in slide-in-from-top duration-300">
          <div className={cn(
            "p-3.5 rounded-2xl shadow-2xl border flex items-center justify-between gap-3 text-white backdrop-blur-md",
            toastMessage.type === 'warning' ? "bg-amber-600/95 border-amber-500" :
            toastMessage.type === 'info' ? "bg-blue-600/95 border-blue-500" :
            "bg-[#1848A0]/95 border-[#1848A0]"
          )}>
            <div className="flex items-center gap-2.5 min-w-0">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-[#F88020]" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-extrabold truncate">{toastMessage.title}</p>
                {toastMessage.subtitle && (
                  <p className="text-[11px] opacity-90 truncate">{toastMessage.subtitle}</p>
                )}
              </div>
            </div>
            <button 
              onClick={() => setToastMessage(null)}
              className="text-white/80 hover:text-white text-xs font-bold shrink-0 cursor-pointer p-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Top Header / Mode Switcher & Offline Status Bar */}
      <div className={cn(
        "p-4 sm:p-5 rounded-3xl border shadow-sm transition-all space-y-4",
        isDark ? "bg-[#14141B] border-[#252532]" : "bg-white border-slate-200"
      )}>
        {/* Connection & Offline Status Strip */}
        <div className={cn(
          "px-3.5 py-2 rounded-2xl border flex flex-wrap items-center justify-between gap-2 text-xs",
          isOnline 
            ? isDark ? "bg-[#181824] border-[#272738]" : "bg-slate-50 border-slate-200"
            : "bg-amber-500/15 border-amber-500/40 text-amber-500"
        )}>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                isOnline ? "bg-emerald-400" : "bg-amber-400"
              )} />
              <span className={cn(
                "relative inline-flex rounded-full h-2.5 w-2.5",
                isOnline ? "bg-emerald-500" : "bg-amber-500"
              )} />
            </span>
            <span className="font-extrabold">
              {isOnline ? 'Online (Connected to HIFI ONE Cloud)' : 'Offline Mode (Local Storage & Cache Active)'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <button
                onClick={() => setIsOfflineDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-extrabold bg-[#1848A0] text-white hover:bg-[#143B85] transition-all cursor-pointer shadow-xs"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>{pendingCount} Pending Sync</span>
              </button>
            )}

            <button
              onClick={() => setIsOfflineDrawerOpen(true)}
              className={cn(
                "p-1.5 rounded-xl border text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer",
                isDark ? "bg-[#222230] border-[#2D2D3E] text-gray-300 hover:text-white" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              )}
              title="View Offline Queue"
            >
              <Layers className="w-3.5 h-3.5 text-[#1848A0]" />
              <span className="hidden sm:inline">Queue</span>
            </button>
          </div>
        </div>

        {/* Title Bar & Quick Situation Buttons */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#1848A0] text-white flex items-center justify-center font-extrabold shadow-md shrink-0">
              <Compass className="w-6 h-6 animate-spin-slow text-[#F88020]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={cn("text-lg sm:text-xl font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                  Field Mode
                </h1>
                <span className="bg-[#F88020]/20 text-[#F88020] border border-[#F88020]/30 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                  Mobile First
                </span>
              </div>
              <p className="text-xs text-slate-400">
                On-the-road execution for Marketing Executives • Kigali & Beats
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            {/* Quick Voice Memo Dictation Button */}
            <button
              onClick={() => setIsVoiceMemoModalOpen(true)}
              className="bg-[#1848A0] hover:bg-[#143B85] text-white px-3 py-1.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
              title="Dictate quick site notes or audio memo"
            >
              <Mic className="w-3.5 h-3.5 text-[#F88020] animate-pulse" />
              <span>Voice Note</span>
            </button>

            {/* Direct Situation Dispatch Button */}
            <button
              onClick={() => handleOpenSituationModal(currentTargetVisit?.organization || null)}
              className="bg-[#F88020] hover:bg-[#E07018] text-white px-3 py-1.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Situation Alert</span>
            </button>

            {/* View Messages Drawer */}
            <button
              onClick={() => setIsMessagesDrawerOpen(true)}
              className={cn(
                "px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer relative",
                isDark ? "bg-[#1E1E28] border-[#2A2A38] text-slate-300 hover:text-white" : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
              )}
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#1848A0]" />
              <span>Dispatches</span>
              {cachedMessages.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-[#F88020]" />
              )}
            </button>

            <NavLink
              to="/field/my-day"
              className={cn(
                "px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5",
                isDark ? "bg-[#1E1E28] border-[#2A2A38] text-slate-300 hover:text-white" : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
              )}
            >
              <Calendar className="w-3.5 h-3.5 text-[#1848A0]" />
              <span>Planner</span>
            </NavLink>

            <button
              onClick={handleRefresh}
              disabled={refreshing || isSyncing}
              className={cn(
                "p-2 rounded-xl border transition-all cursor-pointer",
                isDark ? "bg-[#1E1E28] border-[#2A2A38] text-slate-300 hover:text-white" : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
              )}
              title="Refresh / Sync Data"
            >
              <RefreshCw className={cn("w-4 h-4", (refreshing || isSyncing) && "animate-spin text-[#1848A0]")} />
            </button>
          </div>
        </div>

        {/* Live Field Session Banner */}
        <div className="pt-2 border-t dark:border-[#22222E] border-slate-100">
          {!activeSession ? (
            <div className={cn(
              "p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3",
              isDark ? "bg-[#191924] border-[#2D2D3D]" : "bg-blue-50/70 border-blue-200"
            )}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#1848A0]/20 text-[#1848A0] dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Play className="w-5 h-5 ml-0.5 fill-current" />
                </div>
                <div>
                  <h3 className={cn("text-xs sm:text-sm font-extrabold", isDark ? "text-white" : "text-slate-900")}>
                    Field Day Not Started Yet
                  </h3>
                  <p className="text-xs text-slate-400">
                    Tap to start your authorized session, enable GPS arrival stamps, and begin client visits.
                  </p>
                </div>
              </div>
              <button
                onClick={handleStartFieldDay}
                disabled={startingSession}
                className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-[#1848A0] hover:bg-[#143B85] text-white text-xs sm:text-sm font-black transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0 active:scale-95"
              >
                {startingSession ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting Session...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    Start Field Day
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className={cn(
              "p-3.5 sm:p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 shadow-xs",
              isDark ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-900"
            )}>
              <div className="flex items-center gap-3">
                <span className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                </span>
                <div>
                  <div className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                    <span>Field Session Active</span>
                    <span className="text-slate-400">•</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold">
                      {formattedDuration}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <MapPin className="w-3 h-3 text-[#F88020]" />
                    {gpsActive && currentLocation 
                      ? `GPS Active (±${currentLocation.accuracy}m accuracy)` 
                      : gpsError 
                        ? `GPS Alert: ${gpsError}` 
                        : 'Acquiring GPS location...'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsVoiceMemoModalOpen(true)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl border text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95",
                    isDark 
                      ? "bg-[#1848A0]/20 border-[#1848A0]/40 text-blue-300 hover:bg-[#1848A0]/30" 
                      : "bg-blue-100 border-blue-200 text-[#1848A0] hover:bg-blue-200"
                  )}
                  title="Record voice note"
                >
                  <Mic className="w-3.5 h-3.5 text-[#F88020]" />
                  <span>Voice Memo</span>
                </button>
                <button
                  onClick={() => setIsWalkInModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-[#F88020] hover:bg-[#E07018] text-white text-xs font-extrabold transition-all shadow-xs flex items-center gap-1 cursor-pointer active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Walk-in Visit</span>
                </button>
                <button
                  onClick={() => setIsEndDayModalOpen(true)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl border text-xs font-extrabold transition-all flex items-center gap-1 cursor-pointer active:scale-95",
                    isDark 
                      ? "bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30" 
                      : "bg-rose-100 border-rose-200 text-rose-700 hover:bg-rose-200"
                  )}
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>End Day</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Daily Progress HUD Bar */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className={cn(
          "p-3.5 rounded-2xl border text-center space-y-0.5 shadow-xs",
          isDark ? "bg-[#14141B] border-[#252532]" : "bg-white border-slate-200"
        )}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Visits</div>
          <div className="text-lg sm:text-xl font-black text-[#1848A0] dark:text-blue-400">
            {stats.total}
          </div>
        </div>

        <div className={cn(
          "p-3.5 rounded-2xl border text-center space-y-0.5 shadow-xs",
          isDark ? "bg-[#14141B] border-[#252532]" : "bg-white border-slate-200"
        )}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Completed</div>
          <div className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
            {stats.completed}
          </div>
        </div>

        <div className={cn(
          "p-3.5 rounded-2xl border text-center space-y-0.5 shadow-xs",
          isDark ? "bg-[#14141B] border-[#252532]" : "bg-white border-slate-200"
        )}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Adherence</div>
          <div className="text-lg sm:text-xl font-black text-[#F88020]">
            {stats.completionRate}%
          </div>
        </div>
      </div>

      {/* HERO SECTION: Current Active / Next Target Visit */}
      {currentTargetVisit && (
        <div className={cn(
          "p-5 rounded-3xl border shadow-lg relative overflow-hidden transition-all",
          currentTargetVisit.status === 'IN_PROGRESS'
            ? isDark ? "bg-gradient-to-br from-[#1848A0]/20 to-[#14141B] border-[#1848A0]" : "bg-blue-50/90 border-[#1848A0]/60"
            : isDark ? "bg-[#15151F] border-[#2A2A3D]" : "bg-white border-slate-200"
        )}>
          {/* Top Target Eyebrow */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1",
                currentTargetVisit.status === 'IN_PROGRESS'
                  ? "bg-emerald-500 text-white animate-pulse"
                  : "bg-[#1848A0] text-white"
              )}>
                {currentTargetVisit.status === 'IN_PROGRESS' ? '🔴 Live Meeting In Progress' : '⚡ Next Target Visit'}
              </span>
              <span className="text-xs text-slate-400 font-bold">
                {currentTargetVisit.planned_start_time} (~{currentTargetVisit.estimated_duration}m)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleOpenSituationModal(currentTargetVisit.organization)}
                className="px-2.5 py-1 rounded-xl text-[10px] font-extrabold bg-[#F88020]/15 text-[#F88020] border border-[#F88020]/30 hover:bg-[#F88020]/25 transition-all flex items-center gap-1 cursor-pointer"
                title="Send situation alert for this client"
              >
                <Radio className="w-3 h-3" />
                <span>Situation Alert</span>
              </button>

              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-md uppercase",
                currentTargetVisit.priority === 'HIGH' 
                  ? "bg-rose-500/20 text-rose-500 border border-rose-500/30" 
                  : "bg-blue-500/20 text-blue-500 border border-blue-500/30"
              )}>
                {currentTargetVisit.priority}
              </span>
            </div>
          </div>

          {/* Company & Details */}
          <div className="space-y-2 mb-4">
            <h2 className={cn("text-xl sm:text-2xl font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
              {currentTargetVisit.organization?.name || 'Client Site'}
            </h2>
            <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-[#1848A0]" />
                {currentTargetVisit.organization?.sector || 'Commercial'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#F88020]" />
                {currentTargetVisit.organization?.district || currentTargetVisit.organization?.address || 'Kigali'}
              </span>
            </div>

            <div className={cn(
              "p-2.5 rounded-2xl text-xs font-medium border",
              isDark ? "bg-[#0E0E14] border-[#222230] text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"
            )}>
              <span className="font-bold text-[#1848A0] dark:text-blue-400">Objective: </span>
              {currentTargetVisit.purpose}
            </div>
          </div>

          {/* Quick Action Touch Buttons (Call, WhatsApp, Maps) */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {currentTargetVisit.organization?.phone ? (
              <a
                href={`tel:${currentTargetVisit.organization.phone}`}
                className={cn(
                  "py-2.5 px-2 rounded-2xl border text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all text-center",
                  isDark ? "bg-[#1E1E28] border-[#2A2A38] text-slate-200 hover:bg-[#2A2A3A]" : "bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200"
                )}
              >
                <Phone className="w-4 h-4 text-emerald-500" />
                <span>Call Client</span>
              </a>
            ) : (
              <button
                disabled
                className="py-2.5 px-2 rounded-2xl border text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 opacity-40 cursor-not-allowed"
              >
                <Phone className="w-4 h-4" />
                <span>No Phone</span>
              </button>
            )}

            {currentTargetVisit.organization?.phone ? (
              <a
                href={`https://wa.me/${currentTargetVisit.organization.phone.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "py-2.5 px-2 rounded-2xl border text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all text-center",
                  isDark ? "bg-[#1E1E28] border-[#2A2A38] text-slate-200 hover:bg-[#2A2A3A]" : "bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200"
                )}
              >
                <MessageSquare className="w-4 h-4 text-emerald-500" />
                <span>WhatsApp</span>
              </a>
            ) : (
              <button
                disabled
                className="py-2.5 px-2 rounded-2xl border text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 opacity-40 cursor-not-allowed"
              >
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp</span>
              </button>
            )}

            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${currentTargetVisit.organization?.name || ''} ${currentTargetVisit.organization?.address || ''} ${currentTargetVisit.organization?.district || ''} Kigali Rwanda`
              )}`}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "py-2.5 px-2 rounded-2xl border text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all text-center",
                isDark ? "bg-[#1E1E28] border-[#2A2A38] text-slate-200 hover:bg-[#2A2A3A]" : "bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200"
              )}
            >
              <Navigation className="w-4 h-4 text-[#1848A0]" />
              <span>Map Route</span>
            </a>
          </div>

          {/* MAIN GIANT TOUCH BUTTON (Check-in or Record) */}
          {currentTargetVisit.status === 'IN_PROGRESS' ? (
            <button
              onClick={() => setActiveVisitForExecution(currentTargetVisit)}
              className="w-full py-4 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm sm:text-base transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>Meeting in Progress • Record Visit & Complete</span>
            </button>
          ) : (
            <button
              onClick={() => handleDirectCheckIn(currentTargetVisit)}
              className="w-full py-4 px-4 rounded-2xl bg-[#1848A0] hover:bg-[#143B85] text-white font-black text-sm sm:text-base transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <MapPin className="w-5 h-5" />
              <span>1-Tap GPS Check In & Start Meeting</span>
            </button>
          )}
        </div>
      )}

      {/* Itinerary Filter & Search */}
      <div className={cn(
        "p-4 sm:p-5 rounded-3xl border shadow-sm space-y-3",
        isDark ? "bg-[#14141B] border-[#252532]" : "bg-white border-slate-200"
      )}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className={cn(
            "p-1 rounded-2xl flex gap-1 border self-start sm:self-auto",
            isDark ? "bg-[#0B0B0E] border-[#2A2A38]" : "bg-slate-100 border-slate-200"
          )}>
            {(['ALL', 'PENDING', 'COMPLETED'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  filterTab === tab
                    ? "bg-[#1848A0] text-white shadow-xs"
                    : isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
                )}
              >
                {tab === 'ALL' ? `All Stops (${visits.length})` : tab === 'PENDING' ? `Pending (${stats.remaining})` : `Done (${stats.completed})`}
              </button>
            ))}
          </div>

          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search stops, sector, district..."
              className={cn(
                "w-full pl-8 pr-3 py-2 rounded-2xl border text-xs focus:outline-hidden focus:ring-2 focus:ring-[#1848A0]",
                isDark ? "bg-[#0B0B0E] border-[#2A2A38] text-white" : "bg-slate-50 border-slate-200 text-slate-900"
              )}
            />
          </div>
        </div>

        {/* Visits Itinerary List */}
        {loading ? (
          <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#1848A0]" />
            <span>Loading today's field route...</span>
          </div>
        ) : filteredVisits.length === 0 ? (
          <div className={cn(
            "p-8 rounded-2xl border border-dashed text-center space-y-2",
            isDark ? "border-[#2A2A38] text-slate-400" : "border-slate-200 text-slate-500"
          )}>
            <Building2 className="w-8 h-8 mx-auto text-slate-400 opacity-60" />
            <p className="text-xs sm:text-sm font-bold">No visits matching this filter</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Plan visits in My Day Planner or tap "+ Walk-in Visit" to log an on-the-spot meeting.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredVisits.map((visit, index) => {
              const isCompleted = visit.status === 'COMPLETED';
              const isInProg = visit.status === 'IN_PROGRESS';

              return (
                <div
                  key={visit.id}
                  className={cn(
                    "p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3",
                    isInProg
                      ? isDark ? "bg-[#1848A0]/15 border-[#1848A0]" : "bg-blue-50 border-blue-300"
                      : isCompleted
                        ? isDark ? "bg-[#0D0D12] border-[#22222E] opacity-75" : "bg-slate-50 border-slate-200 opacity-80"
                        : isDark ? "bg-[#121218] border-[#22222E] hover:border-[#2E2E3E]" : "bg-white border-slate-200 hover:border-slate-300"
                  )}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 mt-0.5",
                      isCompleted 
                        ? "bg-emerald-500 text-white" 
                        : isInProg 
                          ? "bg-[#1848A0] text-white animate-pulse" 
                          : isDark ? "bg-[#1E1E28] text-slate-300" : "bg-slate-100 text-slate-700"
                    )}>
                      {isCompleted ? <Check className="w-4 h-4" /> : index + 1}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={cn("text-xs sm:text-sm font-extrabold truncate", isDark ? "text-white" : "text-slate-900")}>
                          {visit.organization?.name || 'Unknown Client'}
                        </h4>
                        <span className={cn(
                          "text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase",
                          isCompleted
                            ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                            : isInProg
                              ? "bg-[#1848A0]/20 text-[#1848A0] dark:text-blue-400 border border-[#1848A0]/40"
                              : "bg-slate-500/15 text-slate-400 border border-slate-500/20"
                        )}>
                          {isCompleted ? 'Completed' : isInProg ? 'In Progress' : 'Planned'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-y-1 gap-x-2 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 font-semibold text-slate-500 dark:text-slate-400">
                          <Clock className="w-3 h-3 text-[#1848A0]" />
                          {visit.planned_start_time}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#F88020]" />
                          {visit.organization?.district || 'Kigali'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-400 truncate max-w-md">
                        {visit.purpose}
                      </p>
                    </div>
                  </div>

                  {/* Right Action Trigger */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 dark:border-[#22222E] border-slate-100">
                    <button
                      onClick={() => handleOpenSituationModal(visit.organization)}
                      className={cn(
                        "p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                        isDark ? "bg-[#1C1C26] border-[#2A2A38] text-gray-300 hover:text-white" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      )}
                      title="Dispatch situation alert"
                    >
                      <Radio className="w-3.5 h-3.5 text-[#F88020]" />
                    </button>

                    {isCompleted ? (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        Logged
                      </span>
                    ) : isInProg ? (
                      <button
                        onClick={() => setActiveVisitForExecution(visit)}
                        className="px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Complete Visit
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDirectCheckIn(visit)}
                        className="px-3.5 py-2 rounded-2xl bg-[#1848A0] hover:bg-[#143B85] text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        Check In
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Bottom Action Bar for Mobile Thumb Usage */}
      <div className={cn(
        "fixed bottom-16 sm:bottom-6 left-4 right-4 max-w-md mx-auto p-2 rounded-3xl shadow-2xl border backdrop-blur-md flex items-center justify-between gap-2 z-30 transition-all",
        isDark ? "bg-[#15151A]/95 border-[#2A2A38]" : "bg-white/95 border-slate-200 shadow-xl"
      )}>
        <button
          onClick={() => handleOpenSituationModal(currentTargetVisit?.organization || null)}
          className={cn(
            "py-2.5 px-3 rounded-2xl border font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0",
            isDark ? "bg-[#1F1F2C] border-[#2E2E40] text-[#F88020]" : "bg-slate-100 border-slate-200 text-[#F88020]"
          )}
          title="Send Situation Alert"
        >
          <Radio className="w-4 h-4 animate-pulse" />
          <span className="hidden xs:inline">Alert</span>
        </button>

        <button
          onClick={() => setIsWalkInModalOpen(true)}
          className="flex-1 py-2.5 px-3 rounded-2xl bg-[#F88020] hover:bg-[#E07018] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>+ Walk-in Visit</span>
        </button>

        {activeSession ? (
          <button
            onClick={() => setIsEndDayModalOpen(true)}
            className={cn(
              "py-2.5 px-3 rounded-2xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0",
              isDark ? "bg-rose-500/15 border-rose-500/30 text-rose-400 hover:bg-rose-500/25" : "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
            )}
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>End Day</span>
          </button>
        ) : (
          <button
            onClick={handleStartFieldDay}
            className="flex-1 py-2.5 px-3 rounded-2xl bg-[#1848A0] hover:bg-[#143B85] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Start Session</span>
          </button>
        )}
      </div>

      {/* Modals & Drawers */}
      {activeVisitForExecution && (
        <CheckInExecutionModal
          visit={activeVisitForExecution}
          currentLocation={currentLocation}
          onClose={() => setActiveVisitForExecution(null)}
          onComplete={handleVisitCompleted}
        />
      )}

      {isWalkInModalOpen && (
        <WalkInVisitModal
          organizations={organizations}
          currentLocation={currentLocation}
          onClose={() => setIsWalkInModalOpen(false)}
          onVisitCreated={handleWalkInCreated}
        />
      )}

      {isEndDayModalOpen && (
        <EndFieldDayModal
          session={activeSession}
          durationFormatted={formattedDuration}
          completedVisitsCount={stats.completed}
          totalVisitsCount={stats.total}
          opportunitiesCount={0}
          onClose={() => setIsEndDayModalOpen(false)}
          onConfirmEnd={async (notes) => {
            await endSession(notes);
            fetchFieldData();
            triggerToast('Field Day Ended', 'Authorized session closed & summary recorded');
          }}
        />
      )}

      {/* Field Situation Modal */}
      {isSituationModalOpen && (
        <FieldSituationModal
          currentLocation={currentLocation}
          linkedOrganization={situationTargetOrg}
          onClose={() => {
            setIsSituationModalOpen(false);
            setSituationTargetOrg(null);
          }}
          onSuccess={(msg, isOffline) => {
            triggerToast(
              isOffline ? 'Situation Queued Offline' : 'Situation Dispatched to Portal',
              isOffline ? 'Will auto-dispatch as soon as connection is restored.' : `Sent to ${msg.recipient_name}`,
              isOffline ? 'warning' : 'success'
            );
          }}
        />
      )}

      {/* Quick Voice Memo Dictation Modal */}
      {isVoiceMemoModalOpen && (
        <QuickVoiceMemoModal
          currentLocation={currentLocation}
          organizations={organizations}
          visits={visits}
          onClose={() => setIsVoiceMemoModalOpen(false)}
          onSendToSituation={(txt, orgId) => {
            const org = organizations.find(o => o.id === orgId) || currentTargetVisit?.organization || null;
            setSituationTargetOrg(org);
            setIsSituationModalOpen(true);
          }}
        />
      )}

      {/* Offline Queue Drawer */}
      <OfflineSyncDrawer
        isOpen={isOfflineDrawerOpen}
        onClose={() => setIsOfflineDrawerOpen(false)}
      />

      {/* Field Messages Drawer */}
      <FieldMessagesDrawer
        isOpen={isMessagesDrawerOpen}
        onClose={() => setIsMessagesDrawerOpen(false)}
        onOpenNewMessage={() => handleOpenSituationModal(currentTargetVisit?.organization || null)}
      />
    </div>
  );
}

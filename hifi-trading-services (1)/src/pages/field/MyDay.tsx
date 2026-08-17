import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  MapPin, 
  Calendar, 
  Clock, 
  CheckCircle, 
  Plus, 
  Building2, 
  User, 
  FileText, 
  ShieldAlert, 
  AlertTriangle, 
  Sparkles, 
  RotateCcw, 
  Trash2, 
  Bell, 
  Edit3, 
  CheckCircle2, 
  X,
  Lock,
  Smartphone
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { MyDaySkeleton } from '../../components/ui/Skeleton';
import { 
  PlannedVisit, 
  Organization, 
  NotificationItem, 
  VisitStatus, 
  Priority, 
  AssignmentType 
} from '../../types';
import VoiceDictationButton from '../../components/field/VoiceDictationButton';
import VoiceNoteTextarea from '../../components/field/VoiceNoteTextarea';

export default function MyDay() {
  const { appUser } = useAuth();
  const { theme } = useTheme();

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [visits, setVisits] = useState<PlannedVisit[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState<boolean>(false);
  const [activeVisitForReschedule, setActiveVisitForReschedule] = useState<PlannedVisit | null>(null);
  const [rescheduleReason, setRescheduleReason] = useState<string>('');

  // Note editing state
  const [editingNoteVisitId, setEditingNoteVisitId] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState<string>('');

  // Form states for adding self-planned visit
  const [formOrganizationId, setFormOrganizationId] = useState<string>('');
  const [formTime, setFormTime] = useState<string>('09:00');
  const [formDuration, setFormDuration] = useState<number>(60);
  const [formPurpose, setFormPurpose] = useState<string>('');
  const [formPriority, setFormPriority] = useState<Priority>('MEDIUM');
  const [formNotes, setFormNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Fetch real visits from Supabase
  const fetchMyDayData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Organizations
      const { data: orgsData } = await supabase.from('organizations').select('*').order('name');
      const loadedOrgs: Organization[] = (orgsData as Organization[]) || [];
      setOrganizations(loadedOrgs);

      // 2. Fetch Notifications for current user
      if (appUser?.id) {
        const { data: notifData } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', appUser.id)
          .eq('read', false)
          .order('created_at', { ascending: false });

        if (notifData) {
          setNotifications(notifData as NotificationItem[]);
        }
      }

      // 3. Fetch Planned Visits for current user on selectedDate
      let query = supabase
        .from('planned_visits')
        .select('*')
        .eq('planned_date', selectedDate);

      // Filter by user ID if logged in
      if (appUser?.id) {
        query = query.eq('employee_id', appUser.id);
      }

      const { data: dbVisits, error: visitsErr } = await query;

      if (visitsErr) console.warn('MyDay visits fetch notice:', visitsErr.message);

      let fetched: PlannedVisit[] = [];
      if (dbVisits && dbVisits.length > 0) {
        fetched = dbVisits.map(v => ({
          ...v,
          organization: loadedOrgs.find(o => o.id === v.organization_id)
        }));
      }
      setVisits(fetched);

    } catch (err) {
      console.error('Error loading MyDay data:', err);
      setVisits([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyDayData();
  }, [selectedDate, appUser?.id]);

  // Helper: Convert time string to minutes from midnight
  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const clean = timeStr.trim().toUpperCase();
    if (clean.includes('AM') || clean.includes('PM')) {
      const parts = clean.split(/\s+/);
      const timeParts = parts[0].split(':');
      let hours = parseInt(timeParts[0], 10) || 0;
      const minutes = parseInt(timeParts[1] || '0', 10) || 0;
      if (parts[1] === 'PM' && hours < 12) hours += 12;
      if (parts[1] === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    } else {
      const parts = clean.split(':');
      const hours = parseInt(parts[0], 10) || 0;
      const minutes = parseInt(parts[1], 10) || 0;
      return hours * 60 + minutes;
    }
  };

  // Helper: Format minutes to "HH:MM AM/PM"
  const minutesToFormattedTime = (totalMinutes: number): string => {
    let hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hours}:${minStr} ${ampm}`;
  };

  // Detect conflicts among executive's planned visits for today
  const myDayConflicts = useMemo(() => {
    const conflictsMap: { [visitId: string]: string } = {};
    const validVisits = visits.filter(v => v.status !== 'CANCELLED');

    for (let i = 0; i < validVisits.length; i++) {
      for (let j = i + 1; j < validVisits.length; j++) {
        const v1 = validVisits[i];
        const v2 = validVisits[j];

        const v1Start = timeToMinutes(v1.planned_start_time);
        const v1End = v1Start + (v1.estimated_duration || 60);

        const v2Start = timeToMinutes(v2.planned_start_time);
        const v2End = v2Start + (v2.estimated_duration || 60);

        if (v1Start < v2End && v2Start < v1End) {
          const org1Name = v1.organization?.name || 'Visit 1';
          const org2Name = v2.organization?.name || 'Visit 2';

          const v1TimeStr = v1.planned_start_time.includes('AM') || v1.planned_start_time.includes('PM')
            ? v1.planned_start_time
            : minutesToFormattedTime(v1Start);
          const v2TimeStr = v2.planned_start_time.includes('AM') || v2.planned_start_time.includes('PM')
            ? v2.planned_start_time
            : minutesToFormattedTime(v2Start);

          conflictsMap[v1.id] = `Overlaps with ${org2Name} (${v2TimeStr} - ${minutesToFormattedTime(v2End)})`;
          conflictsMap[v2.id] = `Overlaps with ${org1Name} (${v1TimeStr} - ${minutesToFormattedTime(v1End)})`;
        }
      }
    }

    return conflictsMap;
  }, [visits]);

  // Real-time conflict validation for Add Modal
  const realtimeConflict = useMemo(() => {
    if (!isAddModalOpen || !formTime) return null;

    const newStart = timeToMinutes(formTime);
    const newEnd = newStart + (Number(formDuration) || 60);

    const activeVisits = visits.filter(v => v.status !== 'CANCELLED');

    for (const v of activeVisits) {
      const vStart = timeToMinutes(v.planned_start_time);
      const vEnd = vStart + (v.estimated_duration || 60);

      if (newStart < vEnd && vStart < newEnd) {
        const orgName = v.organization?.name || 'another client';
        const formattedVStart = v.planned_start_time.includes('AM') || v.planned_start_time.includes('PM')
          ? v.planned_start_time
          : minutesToFormattedTime(vStart);
        const formattedVEnd = minutesToFormattedTime(vEnd);

        return {
          conflictingVisit: v,
          orgName,
          vStart: formattedVStart,
          vEnd: formattedVEnd,
          message: `You already have a visit scheduled at ${orgName} from ${formattedVStart} to ${formattedVEnd}. This creates a schedule overlap conflict.`
        };
      }
    }

    return null;
  }, [isAddModalOpen, formTime, formDuration, visits]);

  // Handle Status Update
  const handleStatusChange = async (visitId: string, newStatus: VisitStatus) => {
    try {
      await supabase
        .from('planned_visits')
        .update({ status: newStatus })
        .eq('id', visitId);

      setVisits(visits.map(v => v.id === visitId ? { ...v, status: newStatus } : v));
    } catch (err) {
      console.error('Error updating visit status:', err);
      setVisits(visits.map(v => v.id === visitId ? { ...v, status: newStatus } : v));
    }
  };

  // Handle Note Save
  const handleSaveNote = async (visitId: string) => {
    try {
      await supabase
        .from('planned_visits')
        .update({ notes: noteContent.trim() })
        .eq('id', visitId);

      setVisits(visits.map(v => v.id === visitId ? { ...v, notes: noteContent.trim() } : v));
      setEditingNoteVisitId(null);
    } catch (err) {
      console.error('Error saving note:', err);
      setVisits(visits.map(v => v.id === visitId ? { ...v, notes: noteContent.trim() } : v));
      setEditingNoteVisitId(null);
    }
  };

  // Submit Reschedule Request
  const handleRequestReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVisitForReschedule || !rescheduleReason.trim()) return;

    setSubmitting(true);
    try {
      const updateData = {
        status: 'RESCHEDULE_REQUESTED' as VisitStatus,
        reschedule_reason: rescheduleReason.trim()
      };

      await supabase
        .from('planned_visits')
        .update(updateData)
        .eq('id', activeVisitForReschedule.id);

      // Create Notification for Manager
      await supabase.from('notifications').insert({
        id: crypto.randomUUID(),
        user_id: activeVisitForReschedule.assigned_by || 'manager',
        type: 'RESCHEDULE_REQUESTED',
        title: 'Visit Reschedule Requested',
        message: `${appUser?.name || 'Executive'} requested to reschedule visit at ${activeVisitForReschedule.organization?.name || 'Client'}: "${rescheduleReason.trim()}"`,
        read: false,
        related_entity_type: 'planned_visits',
        related_entity_id: activeVisitForReschedule.id
      });

      setVisits(visits.map(v => v.id === activeVisitForReschedule.id ? { ...v, ...updateData } : v));
      setIsRescheduleModalOpen(false);
      setActiveVisitForReschedule(null);
      setRescheduleReason('');
    } catch (err) {
      console.error('Error submitting reschedule request:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Self-Planned Visit
  const handleDeleteVisit = async (visit: PlannedVisit) => {
    if (visit.assignment_type === 'MANAGER_ASSIGNED') {
      alert('🔒 Manager-assigned visits cannot be deleted by Marketing Executives.\n\nYou may request a reschedule or add field notes instead.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete this self-planned visit at ${visit.organization?.name}?`)) return;

    try {
      await supabase.from('planned_visits').delete().eq('id', visit.id);
      setVisits(visits.filter(v => v.id !== visit.id));
    } catch (err) {
      console.error('Error deleting visit:', err);
      setVisits(visits.filter(v => v.id !== visit.id));
    }
  };

  // Add Self-Planned Visit
  const handleAddSelfPlannedVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formOrganizationId) {
      alert('Please select an Organization.');
      return;
    }
    if (!formPurpose.trim()) {
      alert('Please enter a purpose for the visit.');
      return;
    }

    setSubmitting(true);
    const selectedOrg = organizations.find(o => o.id === formOrganizationId);

    const newVisitPayload = {
      id: crypto.randomUUID(),
      employee_id: appUser?.id || 'exec-1',
      organization_id: formOrganizationId,
      planned_date: selectedDate,
      planned_start_time: formTime,
      estimated_duration: Number(formDuration) || 60,
      purpose: formPurpose.trim(),
      priority: formPriority,
      assignment_type: 'SELF_PLANNED' as AssignmentType,
      status: 'PLANNED' as VisitStatus,
      notes: formNotes.trim()
    };

    try {
      await supabase.from('planned_visits').insert(newVisitPayload);

      const addedVisit: PlannedVisit = {
        ...newVisitPayload,
        organization: selectedOrg
      };

      setVisits([...visits, addedVisit]);
      setIsAddModalOpen(false);
      setFormPurpose('');
      setFormNotes('');
    } catch (err: any) {
      console.error('Error adding self planned visit:', err);
      alert('Error adding visit: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Dismiss Notification
  const dismissNotification = async (id: string) => {
    try {
      await supabase.from('notifications').update({ read: true }).eq('id', id);
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (err) {
      setNotifications(notifications.filter(n => n.id !== id));
    }
  };

  const cardBgClass = cn(
    "border rounded-2xl p-5 flex items-center gap-4 transition-all shadow-xs",
    theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
  );

  const inputClass = cn(
    "w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#1848A0]",
    theme === 'dark' 
      ? "bg-[#0B0B0E] border-[#2A2A35] text-white placeholder-gray-500" 
      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
  );

  const labelClass = cn(
    "block text-xs font-bold uppercase tracking-wider mb-1.5",
    theme === 'dark' ? "text-gray-400" : "text-slate-600"
  );

  if (loading) {
    return <MyDaySkeleton />;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Notifications Banner */}
      {notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map(notif => (
            <div
              key={notif.id}
              className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-900 dark:text-purple-200 flex items-start justify-between gap-3 shadow-xs animate-in slide-in-from-top-2"
            >
              <div className="flex items-start gap-3">
                <Bell className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold text-xs uppercase tracking-wide block">{notif.title}</span>
                  <p className="text-xs sm:text-sm font-medium mt-0.5">{notif.message}</p>
                </div>
              </div>
              <button
                onClick={() => dismissNotification(notif.id)}
                className="text-purple-600 dark:text-purple-300 hover:text-purple-900 font-bold text-xs shrink-0"
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className={cn("text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-3", theme === 'dark' ? "text-gray-100" : "text-slate-900")}>
            <MapPin className="w-7 h-7 text-[#1848A0]" /> My Day Planner
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">Field visit schedule and client interaction log for {appUser?.name || 'Executive'}.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5">
          {appUser?.role === 'MARKETING_EXECUTIVE' && (
            <Link
              to="/field/mode"
              className="bg-[#F88020] hover:bg-[#E07018] text-white px-3.5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-md active:scale-95"
            >
              <Smartphone className="w-4 h-4" />
              <span>Launch Field Mode</span>
            </Link>
          )}

          <div className="relative flex items-center">
            <Calendar className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className={cn(
                "border text-xs font-bold rounded-2xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1848A0] transition-all",
                theme === 'dark' ? "bg-[#15151A] border-[#2A2A35] text-gray-200" : "bg-white border-slate-200 text-slate-800 shadow-xs"
              )}
            />
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-[#1848A0] hover:bg-[#003880] text-white px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Self-Planned Visit
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={cardBgClass}>
          <div className="w-12 h-12 rounded-2xl bg-[#1848A0]/10 border border-[#1848A0]/20 flex items-center justify-center text-[#1848A0] shrink-0 font-black text-lg">
            {visits.length}
          </div>
          <div>
            <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Total Visits</div>
            <div className={cn("text-lg font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>Scheduled for {selectedDate}</div>
          </div>
        </div>

        <div className={cardBgClass}>
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 shrink-0 font-black text-lg">
            {visits.filter(v => v.assignment_type === 'MANAGER_ASSIGNED').length}
          </div>
          <div>
            <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Manager Assigned</div>
            <div className={cn("text-lg font-bold text-purple-600 dark:text-purple-400")}>Mandatory Field Visits</div>
          </div>
        </div>

        <div className={cardBgClass}>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shrink-0 font-black text-lg">
            {visits.filter(v => v.status === 'COMPLETED').length}
          </div>
          <div>
            <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Completed</div>
            <div className={cn("text-lg font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>Visits Executed</div>
          </div>
        </div>
      </div>

      {/* Main Itinerary */}
      <div className={cn(
        "border rounded-2xl p-6 shadow-xs transition-all space-y-4",
        theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
      )}>
        <div className="flex items-center justify-between border-b pb-4 dark:border-[#2A2A35]">
          <h2 className={cn("text-lg font-extrabold", theme === 'dark' ? "text-white" : "text-slate-900")}>
            Today's Field Itinerary
          </h2>
          <span className="text-xs font-semibold text-gray-400">
            {visits.length} Visit{visits.length === 1 ? '' : 's'} Total
          </span>
        </div>

        {/* Schedule Conflict Alert Banner */}
        {Object.keys(myDayConflicts).length > 0 && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-xs text-red-700 dark:text-red-300">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Schedule Overlap Alert:</span> You have overlapping tasks scheduled at the same time. Please review your itinerary and reschedule conflicting visits.
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(n => (
              <div key={n} className="h-28 rounded-2xl bg-slate-100 dark:bg-[#0B0B0E] animate-pulse" />
            ))}
          </div>
        ) : visits.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm font-medium">
            No field visits scheduled for {selectedDate}.
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="block mx-auto mt-2 text-[#1848A0] font-bold hover:underline"
            >
              + Plan a Visit
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {visits.map((visit) => {
              const isManagerAssigned = visit.assignment_type === 'MANAGER_ASSIGNED';
              const conflictMessage = myDayConflicts[visit.id];

              return (
                <div
                  key={visit.id}
                  className={cn(
                    "border rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all relative",
                    conflictMessage
                      ? "border-red-500 bg-red-500/[0.06] dark:bg-red-950/20 ring-2 ring-red-500/30"
                      : isManagerAssigned
                        ? "border-purple-500/40 bg-purple-500/5 dark:bg-purple-950/10"
                        : theme === 'dark' ? "bg-[#0B0B0E] border-[#2A2A35]" : "bg-slate-50 border-slate-200"
                  )}
                >
                  <div className="flex items-start gap-4 flex-1">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 border font-extrabold",
                      conflictMessage
                        ? "bg-red-500/20 text-red-600 border-red-500/40"
                        : isManagerAssigned
                          ? "bg-purple-500/15 text-purple-600 border-purple-500/30"
                          : "bg-[#1848A0]/10 text-[#1848A0] border-[#1848A0]/20"
                    )}>
                      <Building2 className="w-6 h-6" />
                    </div>

                    <div className="space-y-2 flex-1">
                      {/* Org Name + Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className={cn("font-extrabold text-base sm:text-lg", theme === 'dark' ? "text-white" : "text-slate-900")}>
                          {visit.organization?.name || 'Organization'}
                        </h3>

                        {/* Conflict Warning Tag */}
                        {conflictMessage && (
                          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-600 dark:text-red-300 border border-red-500/40 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-red-500" /> Time Conflict
                          </span>
                        )}

                        {isManagerAssigned ? (
                          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3 text-purple-600" /> Assigned by Manager
                          </span>
                        ) : visit.assignment_type === 'SYSTEM_RECOMMENDED' ? (
                          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-emerald-600" /> System Recommended
                          </span>
                        ) : (
                          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-[#1E1E28] text-slate-700 dark:text-gray-300 border border-slate-300 dark:border-[#2A2A38]">
                            Self Planned
                          </span>
                        )}

                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full",
                          visit.status === 'COMPLETED' ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" :
                          visit.status === 'IN_PROGRESS' ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" :
                          visit.status === 'RESCHEDULE_REQUESTED' ? "bg-rose-500/15 text-rose-600 border border-rose-500/30" :
                          "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                        )}>
                          {visit.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {/* Overlap Conflict Notice */}
                      {conflictMessage && (
                        <div className="text-xs p-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-700 dark:text-red-300 font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          <span>{conflictMessage}</span>
                        </div>
                      )}

                      {/* Time, Duration & Purpose */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 font-medium">
                        <span className="flex items-center gap-1 text-slate-700 dark:text-gray-300 font-semibold">
                          <Clock className="w-3.5 h-3.5" /> {visit.planned_start_time} ({visit.estimated_duration || 60} min)
                        </span>
                        {visit.organization?.district && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" /> {visit.organization.district}
                          </span>
                        )}
                      </div>

                      <p className={cn("text-sm font-medium", theme === 'dark' ? "text-gray-200" : "text-slate-800")}>
                        {visit.purpose}
                      </p>

                      {/* Notes Section */}
                      {editingNoteVisitId === visit.id ? (
                        <div className="mt-2 space-y-2">
                          <VoiceNoteTextarea
                            id={`visit-inline-note-${visit.id}`}
                            rows={3}
                            value={noteContent}
                            onChange={setNoteContent}
                            placeholder="Speak or type field visit observations or meeting notes..."
                            quickTags={['Met Decision Maker', 'Quotation Requested', 'Price Negotiation', 'Follow-up Needed']}
                          />
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => handleSaveNote(visit.id)}
                              className="bg-[#1848A0] text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs cursor-pointer hover:bg-[#143B85]"
                            >
                              Save Note
                            </button>
                            <button
                              onClick={() => setEditingNoteVisitId(null)}
                              className="text-xs text-gray-400 font-bold hover:text-white px-2 py-1 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : visit.notes ? (
                        <div className={cn(
                          "mt-2 text-xs p-2.5 rounded-xl border flex items-start justify-between gap-2",
                          theme === 'dark' ? "bg-[#15151A] border-[#2A2A35] text-gray-300" : "bg-white border-slate-200 text-slate-700"
                        )}>
                          <div className="flex items-start gap-2">
                            <FileText className="w-3.5 h-3.5 shrink-0 text-[#1848A0] mt-0.5" />
                            <span>{visit.notes}</span>
                          </div>
                          <button
                            onClick={() => {
                              setEditingNoteVisitId(visit.id);
                              setNoteContent(visit.notes || '');
                            }}
                            className="text-gray-400 hover:text-slate-900 dark:hover:text-white"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingNoteVisitId(visit.id);
                            setNoteContent('');
                          }}
                          className="text-xs text-[#1848A0] dark:text-blue-400 font-bold hover:underline flex items-center gap-1 mt-1"
                        >
                          + Add Field Notes / Observations
                        </button>
                      )}

                      {/* Reschedule Request Reason Notice */}
                      {visit.status === 'RESCHEDULE_REQUESTED' && (
                        <div className="text-xs p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 font-medium italic">
                          Reschedule requested: "{visit.reschedule_reason}"
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions & Status Control */}
                  <div className="flex flex-col sm:flex-row md:flex-col items-end gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 dark:border-[#2A2A35]">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-extrabold uppercase text-gray-400">Status:</label>
                      <select
                        value={visit.status}
                        onChange={(e) => handleStatusChange(visit.id, e.target.value as VisitStatus)}
                        className={cn(
                          "border text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1848A0]",
                          theme === 'dark' ? "bg-[#15151A] border-[#2A2A35] text-gray-200" : "bg-white border-slate-200 text-slate-800"
                        )}
                      >
                        <option value="PLANNED">Planned</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Request Reschedule */}
                      <button
                        onClick={() => {
                          setActiveVisitForReschedule(visit);
                          setRescheduleReason('');
                          setIsRescheduleModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white transition-all text-xs font-bold flex items-center gap-1"
                        title="Request Reschedule from Manager"
                      >
                        <RotateCcw className="w-3 h-3" /> Reschedule
                      </button>

                      {/* Delete Button (Disabled for Manager Assigned) */}
                      {isManagerAssigned ? (
                        <button
                          onClick={() => handleDeleteVisit(visit)}
                          className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#2A2A35] text-gray-300 dark:text-gray-600 cursor-not-allowed flex items-center gap-1 text-xs font-bold"
                          title="Manager-assigned visits cannot be deleted by Executive."
                        >
                          <Lock className="w-3 h-3 text-amber-500" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDeleteVisit(visit)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-slate-200 dark:hover:bg-[#2A2A38] transition-colors"
                          title="Delete Self-Planned Visit"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ADD SELF-PLANNED VISIT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className={cn(
            "w-full max-w-lg border rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150",
            theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
          )}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-[#2A2A35]">
              <h3 className={cn("font-bold text-lg", theme === 'dark' ? "text-white" : "text-slate-900")}>
                Add Self-Planned Field Visit
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Real-time Conflict Alert Banner */}
            {realtimeConflict && (
              <div className="p-3.5 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300 animate-in fade-in duration-200">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-extrabold uppercase text-[10px] tracking-wider text-red-700 dark:text-red-300">
                    Schedule Conflict Detected
                  </div>
                  <div>{realtimeConflict.message}</div>
                </div>
              </div>
            )}

            <form onSubmit={handleAddSelfPlannedVisit} className="space-y-4">
              <div>
                <label className={labelClass}>Client Organization *</label>
                <select
                  value={formOrganizationId}
                  onChange={(e) => setFormOrganizationId(e.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">Select Organization...</option>
                  {organizations.map(o => (
                    <option key={o.id} value={o.id}>{o.name} {o.district ? `(${o.district})` : ''}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={cn(
                    labelClass,
                    realtimeConflict && "text-red-600 dark:text-red-400"
                  )}>
                    Planned Start Time * {realtimeConflict && '(Conflict!)'}
                  </label>
                  <input
                    type="time"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className={cn(
                      inputClass,
                      realtimeConflict && "border-red-500 bg-red-500/10 text-red-600 dark:text-red-300 ring-2 ring-red-500/30 font-bold"
                    )}
                    required
                  />
                  {realtimeConflict && (
                    <span className="text-[10px] font-bold text-red-600 dark:text-red-400 mt-1 block">
                      ⚠️ Overlaps with {realtimeConflict.orgName} ({realtimeConflict.vStart} - {realtimeConflict.vEnd})
                    </span>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Planned Date</label>
                  <input disabled value={selectedDate} className={cn(inputClass, "opacity-60 cursor-not-allowed")} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelClass}>Visit Purpose *</label>
                  <VoiceDictationButton
                    size="sm"
                    label="Speak Purpose"
                    onAppendText={(txt) => setFormPurpose(prev => prev ? `${prev} ${txt}` : txt)}
                  />
                </div>
                <input
                  type="text"
                  placeholder="e.g. Needs Assessment & Product Catalog Delivery"
                  value={formPurpose}
                  onChange={(e) => setFormPurpose(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Priority</label>
                <select
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value as Priority)}
                  className={inputClass}
                >
                  <option value="HIGH">High Priority</option>
                  <option value="MEDIUM">Medium Priority</option>
                  <option value="LOW">Low Priority</option>
                </select>
              </div>

              <div>
                <VoiceNoteTextarea
                  id="self-planned-notes"
                  label="Initial Notes / Agenda"
                  rows={2}
                  value={formNotes}
                  onChange={setFormNotes}
                  placeholder="Speak or type initial agenda, items to deliver, or talking points..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t dark:border-[#2A2A35]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#1848A0] hover:bg-[#003880] text-white px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Add Visit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REQUEST RESCHEDULE MODAL */}
      {isRescheduleModalOpen && activeVisitForReschedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className={cn(
            "w-full max-w-md border rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150",
            theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
          )}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-[#2A2A35]">
              <h3 className={cn("font-bold text-base flex items-center gap-2", theme === 'dark' ? "text-white" : "text-slate-900")}>
                <RotateCcw className="w-5 h-5 text-rose-500" /> Request Visit Reschedule
              </h3>
              <button onClick={() => setIsRescheduleModalOpen(false)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Submit a reschedule request to your manager for visit at <strong className="text-slate-900 dark:text-white">{activeVisitForReschedule.organization?.name}</strong>.
            </p>

            <form onSubmit={handleRequestReschedule} className="space-y-4">
              <div>
                <VoiceNoteTextarea
                  id="reschedule-reason"
                  label="Reason & Proposed New Date/Time *"
                  required
                  rows={3}
                  value={rescheduleReason}
                  onChange={setRescheduleReason}
                  placeholder="Speak or type reason: e.g. Client executive unavailable today due to urgent board meeting. Requested moving to tomorrow 10:00 AM."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t dark:border-[#2A2A35]">
                <button
                  type="button"
                  onClick={() => setIsRescheduleModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md"
                >
                  {submitting ? 'Submitting...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

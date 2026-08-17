import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Calendar, 
  Clock, 
  MapPin, 
  Plus, 
  Search, 
  Building2, 
  User, 
  AlertTriangle, 
  CheckCircle2, 
  Edit3, 
  Trash2, 
  RotateCcw, 
  ShieldAlert, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  Bell, 
  Check, 
  X, 
  ArrowRight,
  UserCheck,
  CalendarDays,
  FileText,
  BadgeAlert,
  Clock3,
  FileDown
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { 
  exportTeamScheduleToPDF, 
  exportExecutiveItineraryPDF 
} from '../../lib/pdfExport';
import { TeamPlanningSkeleton } from '../../components/ui/Skeleton';
import { 
  AppUser, 
  Organization, 
  PlannedVisit, 
  FollowUp, 
  AssignmentType, 
  VisitStatus, 
  Priority 
} from '../../types';

// Standard field working hours (08:00 AM to 05:00 PM)
const WORKING_HOURS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', 
  '13:00', '14:00', '15:00', '16:00', '17:00'
];

export default function TeamPlanning() {
  const { appUser } = useAuth();
  const { theme } = useTheme();

  // Selected date state
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Data states
  const [executives, setExecutives] = useState<AppUser[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [visits, setVisits] = useState<PlannedVisit[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedExecutiveFilter, setSelectedExecutiveFilter] = useState<string>('ALL');
  const [selectedTerritoryFilter, setSelectedTerritoryFilter] = useState<string>('ALL');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'CARDS' | 'TIMELINE' | 'FOLLOWUPS'>('CARDS');

  // Modal states
  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);
  const [editingVisit, setEditingVisit] = useState<PlannedVisit | null>(null);
  const [reviewingReschedule, setReviewingReschedule] = useState<PlannedVisit | null>(null);
  
  // PDF Export Modal & options states
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportScope, setExportScope] = useState<'CURRENT_FILTERED' | 'ALL_DAY' | 'SINGLE_EXECUTIVE'>('CURRENT_FILTERED');
  const [exportExecutiveId, setExportExecutiveId] = useState<string>('');
  const [exportOrientation, setExportOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [exportIncludeKPIs, setExportIncludeKPIs] = useState<boolean>(true);
  const [exportIncludeSignOff, setExportIncludeSignOff] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  
  // Form states for Assign/Edit Visit
  const [formEmployeeId, setFormEmployeeId] = useState<string>('');
  const [formOrganizationId, setFormOrganizationId] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(selectedDate);
  const [formTime, setFormTime] = useState<string>('09:00');
  const [formDuration, setFormDuration] = useState<number>(60);
  const [formPurpose, setFormPurpose] = useState<string>('');
  const [formPriority, setFormPriority] = useState<Priority>('MEDIUM');
  const [formAssignmentType, setFormAssignmentType] = useState<AssignmentType>('MANAGER_ASSIGNED');
  const [formNotes, setFormNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Sync form date when selectedDate changes
  useEffect(() => {
    setFormDate(selectedDate);
  }, [selectedDate]);

  // Initial Data Fetching from Supabase
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Field Staff / Marketing Executives
      let loadedExecs: AppUser[] = [];
      const { data: profs, error: profsError } = await supabase
        .from('profiles')
        .select('*')
        .order('name');

      if (profs && profs.length > 0) {
        loadedExecs = profs as AppUser[];
      } else {
        const { data: usersData } = await supabase.from('app_users').select('*').order('name');
        if (usersData && usersData.length > 0) {
          loadedExecs = usersData as AppUser[];
        }
      }
      setExecutives(loadedExecs);

      // 2. Fetch Organizations
      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('*')
        .order('name');

      if (orgsError) console.warn('Orgs fetch notice:', orgsError.message);

      const loadedOrgs: Organization[] = (orgs as Organization[]) || [];
      setOrganizations(loadedOrgs);

      // 3. Fetch Planned Visits for Selected Date
      const { data: dbVisits, error: visitsError } = await supabase
        .from('planned_visits')
        .select('*')
        .eq('planned_date', selectedDate);

      if (visitsError) console.warn('Visits fetch notice:', visitsError.message);

      let fetchedVisits: PlannedVisit[] = [];
      if (dbVisits && dbVisits.length > 0) {
        fetchedVisits = dbVisits.map(v => {
          const org = loadedOrgs.find(o => o.id === v.organization_id);
          const exec = loadedExecs.find(e => e.id === v.employee_id);
          return {
            ...v,
            organization: org,
            employee: exec
          };
        });
      }
      setVisits(fetchedVisits);

      // 4. Fetch Overdue Follow-ups
      const { data: dbFollowUps, error: followUpsError } = await supabase
        .from('follow_ups')
        .select('*')
        .eq('status', 'PENDING');

      if (followUpsError) console.warn('Follow-ups fetch notice:', followUpsError.message);

      let fetchedFollowUps: FollowUp[] = [];
      if (dbFollowUps && dbFollowUps.length > 0) {
        fetchedFollowUps = dbFollowUps.map(f => ({
          ...f,
          organization: loadedOrgs.find(o => o.id === f.organization_id),
          employee: loadedExecs.find(e => e.id === f.assigned_to)
        }));
      }
      setFollowUps(fetchedFollowUps);

    } catch (err) {
      console.error('Error loading team planning data:', err);
      setVisits([]);
      setFollowUps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  // Helper: Convert time string "HH:MM", "HH:MM:SS", or "HH:MM AM/PM" to minutes from midnight
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

  // Visits for formDate in Assign/Edit Modal for real-time validation across dates
  const [modalDateVisits, setModalDateVisits] = useState<PlannedVisit[]>([]);

  useEffect(() => {
    if (!isAssignModalOpen || !formDate) return;

    if (formDate === selectedDate) {
      setModalDateVisits(visits);
    } else {
      const fetchFormDateVisits = async () => {
        const { data } = await supabase
          .from('planned_visits')
          .select('*')
          .eq('planned_date', formDate);

        if (data && data.length > 0) {
          const enriched = data.map(v => ({
            ...v,
            organization: organizations.find(o => o.id === v.organization_id),
            employee: executives.find(e => e.id === v.employee_id)
          }));
          setModalDateVisits(enriched);
        } else {
          setModalDateVisits([]);
        }
      };
      fetchFormDateVisits();
    }
  }, [isAssignModalOpen, formDate, selectedDate, visits, organizations, executives]);

  // Real-time Validation Check for Modal Form
  const realtimeConflict = useMemo(() => {
    if (!isAssignModalOpen || !formEmployeeId || !formTime || !formDate) return null;

    const newStart = timeToMinutes(formTime);
    const newEnd = newStart + (Number(formDuration) || 60);

    const execVisits = modalDateVisits.filter(v =>
      v.employee_id === formEmployeeId &&
      v.planned_date === formDate &&
      v.status !== 'CANCELLED' &&
      v.id !== editingVisit?.id
    );

    for (const v of execVisits) {
      const vStart = timeToMinutes(v.planned_start_time);
      const vEnd = vStart + (v.estimated_duration || 60);

      // Overlap check: (StartA < EndB) AND (StartB < EndA)
      if (newStart < vEnd && vStart < newEnd) {
        const orgName = v.organization?.name || 'another client';
        const execName = executives.find(e => e.id === formEmployeeId)?.name || 'Executive';
        
        const formattedVStart = v.planned_start_time.includes('AM') || v.planned_start_time.includes('PM')
          ? v.planned_start_time
          : minutesToFormattedTime(vStart);
        const formattedVEnd = minutesToFormattedTime(vEnd);

        const newFormattedStart = minutesToFormattedTime(newStart);
        const newFormattedEnd = minutesToFormattedTime(newEnd);

        return {
          conflictingVisit: v,
          execName,
          orgName,
          vStart: formattedVStart,
          vEnd: formattedVEnd,
          newStart: newFormattedStart,
          newEnd: newFormattedEnd,
          message: `${execName} already has a scheduled visit at ${orgName} from ${formattedVStart} to ${formattedVEnd} on ${formDate}. Assigning ${newFormattedStart} - ${newFormattedEnd} creates an overlapping time conflict.`
        };
      }
    }

    return null;
  }, [isAssignModalOpen, formEmployeeId, formDate, formTime, formDuration, modalDateVisits, editingVisit, executives]);

  // Detect Schedule Conflicts for each employee on selectedDate
  const scheduleConflicts = useMemo(() => {
    const conflictsMap: { [visitId: string]: string } = {};

    executives.forEach(exec => {
      const execVisits = visits.filter(
        v => v.employee_id === exec.id && v.status !== 'CANCELLED'
      );

      for (let i = 0; i < execVisits.length; i++) {
        for (let j = i + 1; j < execVisits.length; j++) {
          const v1 = execVisits[i];
          const v2 = execVisits[j];

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

            conflictsMap[v1.id] = `Overlap with ${org2Name} (${v2TimeStr} - ${minutesToFormattedTime(v2End)})`;
            conflictsMap[v2.id] = `Overlap with ${org1Name} (${v1TimeStr} - ${minutesToFormattedTime(v1End)})`;
          }
        }
      }
    });

    return conflictsMap;
  }, [visits, executives]);

  // List of executives with current schedule conflicts
  const conflictedExecutivesList = useMemo(() => {
    const set = new Set<string>();
    Object.keys(scheduleConflicts).forEach(vId => {
      const v = visits.find(item => item.id === vId);
      if (v?.employee?.name) {
        set.add(v.employee.name);
      }
    });
    return Array.from(set);
  }, [scheduleConflicts, visits]);

  // Existing visits for the selected executive on formDate (for modal preview & collision detection)
  const modalExecDayVisits = useMemo(() => {
    if (!formEmployeeId || !formDate) return [];
    return modalDateVisits
      .filter(v => v.employee_id === formEmployeeId && v.planned_date === formDate && v.status !== 'CANCELLED' && v.id !== editingVisit?.id)
      .sort((a, b) => timeToMinutes(a.planned_start_time) - timeToMinutes(b.planned_start_time));
  }, [formEmployeeId, formDate, modalDateVisits, editingVisit]);

  // Modal Available Free Slots
  const modalAvailableSlots = useMemo(() => {
    if (!formEmployeeId || !formDate) return [];
    const dayStart = 8 * 60; // 08:00 AM
    const dayEnd = 17 * 60;  // 05:00 PM

    const slots: { start: string; end: string; rawStart: string; startMins: number }[] = [];
    let current = dayStart;

    modalExecDayVisits.forEach(v => {
      const vStart = timeToMinutes(v.planned_start_time);
      const vEnd = vStart + (v.estimated_duration || 60);

      if (vStart > current + 15) {
        const rawH = Math.floor(current / 60);
        const rawM = current % 60;
        const rawStr = `${rawH < 10 ? '0' : ''}${rawH}:${rawM < 10 ? '0' : ''}${rawM}`;
        slots.push({
          start: minutesToFormattedTime(current),
          end: minutesToFormattedTime(vStart),
          rawStart: rawStr,
          startMins: current
        });
      }
      current = Math.max(current, vEnd);
    });

    if (current + 15 <= dayEnd) {
      const rawH = Math.floor(current / 60);
      const rawM = current % 60;
      const rawStr = `${rawH < 10 ? '0' : ''}${rawH}:${rawM < 10 ? '0' : ''}${rawM}`;
      slots.push({
        start: minutesToFormattedTime(current),
        end: minutesToFormattedTime(dayEnd),
        rawStart: rawStr,
        startMins: current
      });
    }

    return slots;
  }, [formEmployeeId, formDate, modalExecDayVisits]);

  // Calculate Available Free Working Windows for an employee
  const getAvailableSlots = (employeeId: string) => {
    const execVisits = visits
      .filter(v => v.employee_id === employeeId && v.status !== 'CANCELLED')
      .sort((a, b) => timeToMinutes(a.planned_start_time) - timeToMinutes(b.planned_start_time));

    const dayStart = 8 * 60; // 08:00 AM
    const dayEnd = 17 * 60;  // 05:00 PM

    const slots: { start: string; end: string; startMins: number }[] = [];
    let current = dayStart;

    execVisits.forEach(v => {
      const vStart = timeToMinutes(v.planned_start_time);
      const vEnd = vStart + (v.estimated_duration || 60);

      if (vStart > current + 30) {
        slots.push({
          start: minutesToFormattedTime(current),
          end: minutesToFormattedTime(vStart),
          startMins: current
        });
      }
      current = Math.max(current, vEnd);
    });

    if (current + 30 <= dayEnd) {
      slots.push({
        start: minutesToFormattedTime(current),
        end: minutesToFormattedTime(dayEnd),
        startMins: current
      });
    }

    return slots;
  };

  // Filtered visits
  const filteredVisits = useMemo(() => {
    return visits.filter(v => {
      if (selectedExecutiveFilter !== 'ALL' && v.employee_id !== selectedExecutiveFilter) return false;
      if (selectedPriorityFilter !== 'ALL' && v.priority !== selectedPriorityFilter) return false;
      if (selectedStatusFilter !== 'ALL' && v.status !== selectedStatusFilter) return false;

      if (selectedTerritoryFilter !== 'ALL') {
        const city = v.organization?.city?.toLowerCase() || '';
        const district = v.organization?.district?.toLowerCase() || '';
        if (!city.includes(selectedTerritoryFilter.toLowerCase()) && !district.includes(selectedTerritoryFilter.toLowerCase())) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const orgName = v.organization?.name?.toLowerCase() || '';
        const execName = v.employee?.name?.toLowerCase() || '';
        const purpose = v.purpose?.toLowerCase() || '';
        if (!orgName.includes(query) && !execName.includes(query) && !purpose.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [visits, selectedExecutiveFilter, selectedTerritoryFilter, selectedPriorityFilter, selectedStatusFilter, searchQuery]);

  // Unique Cities / Territories for filter
  const territories = useMemo(() => {
    const set = new Set<string>();
    organizations.forEach(o => {
      if (o.city) set.add(o.city);
      if (o.district) set.add(o.district);
    });
    return Array.from(set);
  }, [organizations]);

  // Metrics computation
  const totalVisitsCount = visits.length;
  const managerAssignedCount = visits.filter(v => v.assignment_type === 'MANAGER_ASSIGNED').length;
  const completedCount = visits.filter(v => v.status === 'COMPLETED').length;
  const conflictsCount = Object.keys(scheduleConflicts).length;
  const overdueFollowUpsCount = followUps.length;

  // Open Assign Visit Modal
  const openAssignModal = (execId?: string, prefillTime?: string, prefillOrgId?: string) => {
    setEditingVisit(null);
    setFormEmployeeId(execId || (executives[0]?.id || ''));
    setFormOrganizationId(prefillOrgId || (organizations[0]?.id || ''));
    setFormDate(selectedDate);
    setFormTime(prefillTime || '09:00');
    setFormDuration(60);
    setFormPurpose('');
    setFormPriority('MEDIUM');
    setFormAssignmentType('MANAGER_ASSIGNED');
    setFormNotes('');
    setIsAssignModalOpen(true);
  };

  // Open Edit Visit Modal
  const openEditModal = (visit: PlannedVisit) => {
    setEditingVisit(visit);
    setFormEmployeeId(visit.employee_id);
    setFormOrganizationId(visit.organization_id);
    setFormDate(visit.planned_date);
    setFormTime(visit.planned_start_time || '09:00');
    setFormDuration(visit.estimated_duration || 60);
    setFormPurpose(visit.purpose || '');
    setFormPriority(visit.priority || 'MEDIUM');
    setFormAssignmentType(visit.assignment_type || 'MANAGER_ASSIGNED');
    setFormNotes(visit.notes || '');
    setIsAssignModalOpen(true);
  };

  // Submit Assign / Edit Visit
  const handleSaveVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmployeeId) {
      alert('Please select a Marketing Executive.');
      return;
    }
    if (!formOrganizationId) {
      alert('Please select an Organization.');
      return;
    }
    if (!formPurpose.trim()) {
      alert('Please enter a Visit Purpose / Agenda.');
      return;
    }

    setSubmitting(true);
    setActionSuccess(null);

    const selectedOrg = organizations.find(o => o.id === formOrganizationId);
    const selectedExec = executives.find(e => e.id === formEmployeeId);

    const visitPayload = {
      id: editingVisit ? editingVisit.id : crypto.randomUUID(),
      employee_id: formEmployeeId,
      organization_id: formOrganizationId,
      planned_date: formDate,
      planned_start_time: formTime,
      estimated_duration: Number(formDuration) || 60,
      purpose: formPurpose.trim(),
      priority: formPriority,
      assignment_type: formAssignmentType,
      assigned_by: appUser?.id,
      status: editingVisit ? editingVisit.status : ('PLANNED' as VisitStatus),
      notes: formNotes.trim()
    };

    try {
      // 1. Save or Update in Supabase
      const { error: visitError } = await supabase
        .from('planned_visits')
        .upsert(visitPayload);

      if (visitError) {
        console.warn('Supabase save visit warning:', visitError.message);
      }

      // 2. Insert Persistent Notification for Executive
      const notifPayload = {
        id: crypto.randomUUID(),
        user_id: formEmployeeId,
        type: 'VISIT_ASSIGNED',
        title: editingVisit ? 'Visit Schedule Updated by Manager' : 'New Visit Assigned by Manager',
        message: `Manager ${appUser?.name || 'Manager'} ${editingVisit ? 'updated' : 'assigned'} visit at ${selectedOrg?.name || 'Organization'} on ${formDate} at ${formTime}.`,
        read: false,
        related_entity_type: 'planned_visits',
        related_entity_id: visitPayload.id
      };

      await supabase.from('notifications').insert(notifPayload);

      // 3. Log Audit Entry
      const auditPayload = {
        id: crypto.randomUUID(),
        user_id: appUser?.id,
        action: editingVisit ? 'VISIT_UPDATED' : 'VISIT_ASSIGNED',
        details: `${editingVisit ? 'Updated' : 'Assigned'} visit for ${selectedExec?.name} at ${selectedOrg?.name} on ${formDate}`,
        target_id: visitPayload.id
      };

      await supabase.from('audit_logs').insert(auditPayload);

      // 4. Update Local State
      const updatedVisitItem: PlannedVisit = {
        ...visitPayload,
        organization: selectedOrg,
        employee: selectedExec
      };

      if (editingVisit) {
        setVisits(visits.map(v => v.id === editingVisit.id ? updatedVisitItem : v));
      } else {
        setVisits([...visits, updatedVisitItem]);
      }

      setActionSuccess(editingVisit ? 'Visit schedule updated successfully!' : `Visit assigned to ${selectedExec?.name} successfully!`);
      setTimeout(() => {
        setIsAssignModalOpen(false);
        setActionSuccess(null);
      }, 1200);

    } catch (err: any) {
      console.error('Error saving visit:', err);
      alert('Failed to save visit: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Visit (Manager function)
  const handleDeleteVisit = async (visitId: string, orgName: string) => {
    if (!window.confirm(`Are you sure you want to cancel and remove the visit at ${orgName}?`)) return;

    try {
      await supabase.from('planned_visits').delete().eq('id', visitId);
      setVisits(visits.filter(v => v.id !== visitId));
    } catch (err) {
      console.error('Error deleting visit:', err);
      // Local removal fallback
      setVisits(visits.filter(v => v.id !== visitId));
    }
  };

  // Handle Reschedule Request Review
  const handleReviewReschedule = async (approve: boolean) => {
    if (!reviewingReschedule) return;

    setSubmitting(true);
    try {
      const newStatus: VisitStatus = approve ? 'PLANNED' : 'PLANNED';

      const updateData: any = {
        status: newStatus
      };

      if (approve) {
        updateData.reschedule_reason = null;
      }

      await supabase
        .from('planned_visits')
        .update(updateData)
        .eq('id', reviewingReschedule.id);

      // Send Notification to Executive
      await supabase.from('notifications').insert({
        id: crypto.randomUUID(),
        user_id: reviewingReschedule.employee_id,
        type: 'RESCHEDULE_RESPONSE',
        title: approve ? 'Reschedule Request Approved' : 'Reschedule Request Reviewed',
        message: approve
          ? `Your manager approved the reschedule request for ${reviewingReschedule.organization?.name}.`
          : `Your reschedule request for ${reviewingReschedule.organization?.name} was reviewed by manager.`,
        read: false,
        related_entity_type: 'planned_visits',
        related_entity_id: reviewingReschedule.id
      });

      setVisits(visits.map(v => v.id === reviewingReschedule.id ? { ...v, status: 'PLANNED', reschedule_reason: approve ? undefined : v.reschedule_reason } : v));
      setReviewingReschedule(null);
    } catch (err) {
      console.error('Error reviewing reschedule:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Schedule Overdue Follow-up
  const handleScheduleFollowUp = (fu: FollowUp) => {
    openAssignModal(fu.assigned_to, '10:00', fu.organization_id);
    setFormPurpose(`Follow-up: ${fu.title} - ${fu.description || ''}`);
    setFormPriority(fu.priority);
  };

  // Execute PDF Export with Modal Options
  const handleExecutePDFExport = () => {
    setIsExporting(true);
    try {
      if (exportScope === 'SINGLE_EXECUTIVE') {
        const targetId = exportExecutiveId || (executives[0]?.id || '');
        const targetExec = executives.find(e => e.id === targetId);
        if (!targetExec) {
          alert('Please select an executive to export itinerary for.');
          return;
        }
        const execVisits = visits.filter(v => v.employee_id === targetExec.id && v.status !== 'CANCELLED');
        exportExecutiveItineraryPDF({
          selectedDate,
          executive: targetExec,
          visits: execVisits,
          conflictsMap: scheduleConflicts,
          generatedBy: appUser
        });
      } else {
        const visitsToExport = exportScope === 'CURRENT_FILTERED' ? filteredVisits : visits;
        const execName = exportScope === 'CURRENT_FILTERED' && selectedExecutiveFilter !== 'ALL'
          ? (executives.find(e => e.id === selectedExecutiveFilter)?.name || 'Filtered')
          : 'All Executives';
        const territoryLabel = selectedTerritoryFilter === 'ALL' ? 'All Territories' : selectedTerritoryFilter;
        const priorityLabel = selectedPriorityFilter === 'ALL' ? 'All Priorities' : `${selectedPriorityFilter} Priority`;
        const statusLabel = selectedStatusFilter === 'ALL' ? 'All Statuses' : selectedStatusFilter.replace(/_/g, ' ');

        exportTeamScheduleToPDF({
          selectedDate,
          generatedBy: appUser,
          visits: visitsToExport,
          executives,
          conflictsMap: scheduleConflicts,
          filterExecutiveName: execName,
          filterTerritory: territoryLabel,
          filterPriority: priorityLabel,
          filterStatus: statusLabel,
          viewModeName: viewMode === 'CARDS' ? 'Executive Cards View' : viewMode === 'TIMELINE' ? 'Timeline Grid View' : 'Overdue Follow-ups View',
          orientation: exportOrientation,
          includeKPIs: exportIncludeKPIs,
          includeSignOff: exportIncludeSignOff
        });
      }
      setIsExportModalOpen(false);
    } catch (err: any) {
      console.error('Failed to export PDF:', err);
      alert('Failed to generate PDF: ' + err?.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Direct 1-Click Export of Individual Executive Itinerary
  const handleExportExecutiveItinerary = (exec: AppUser) => {
    try {
      const execVisits = visits.filter(v => v.employee_id === exec.id && v.status !== 'CANCELLED');
      exportExecutiveItineraryPDF({
        selectedDate,
        executive: exec,
        visits: execVisits,
        conflictsMap: scheduleConflicts,
        generatedBy: appUser
      });
    } catch (err: any) {
      console.error('Failed to export itinerary:', err);
      alert('Failed to generate itinerary PDF: ' + err?.message);
    }
  };

  // Quick Direct 1-Click Export of Current View
  const handleQuickExportPDF = () => {
    try {
      const execName = selectedExecutiveFilter === 'ALL' ? 'All Executives' : (executives.find(e => e.id === selectedExecutiveFilter)?.name || 'Filtered');
      const territoryLabel = selectedTerritoryFilter === 'ALL' ? 'All Territories' : selectedTerritoryFilter;
      const priorityLabel = selectedPriorityFilter === 'ALL' ? 'All Priorities' : `${selectedPriorityFilter} Priority`;
      const statusLabel = selectedStatusFilter === 'ALL' ? 'All Statuses' : selectedStatusFilter.replace(/_/g, ' ');

      exportTeamScheduleToPDF({
        selectedDate,
        generatedBy: appUser,
        visits: filteredVisits,
        executives,
        conflictsMap: scheduleConflicts,
        filterExecutiveName: execName,
        filterTerritory: territoryLabel,
        filterPriority: priorityLabel,
        filterStatus: statusLabel,
        viewModeName: viewMode === 'CARDS' ? 'Executive Cards View' : viewMode === 'TIMELINE' ? 'Timeline Grid View' : 'Overdue Follow-ups View',
        orientation: 'landscape',
        includeKPIs: true,
        includeSignOff: true
      });
    } catch (err: any) {
      console.error('Failed to quick export PDF:', err);
      alert('Failed to generate PDF: ' + err?.message);
    }
  };

  // Navigation date adjusters
  const shiftDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const cardBgClass = cn(
    "border rounded-2xl p-5 shadow-xs transition-all",
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
    return <TeamPlanningSkeleton />;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Date Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#1848A0]/10 text-[#1848A0] border border-[#1848A0]/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className={cn("text-2xl sm:text-3xl font-extrabold tracking-tight", theme === 'dark' ? "text-white" : "text-slate-900")}>
                Team Field Planning
              </h1>
              <p className="text-xs sm:text-sm text-gray-400 font-medium">
                Allocate field assignments, monitor schedule coverage, and prevent conflicts.
              </p>
            </div>
          </div>
        </div>

        {/* Date Navigator Bar */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <div className="flex items-center bg-slate-200/60 dark:bg-[#1A1A24] p-1 rounded-2xl border border-slate-200 dark:border-[#2A2A35]">
            <button
              onClick={() => shiftDate(-1)}
              className="p-2 rounded-xl hover:bg-white dark:hover:bg-[#2A2A38] text-slate-700 dark:text-gray-300 transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                selectedDate === new Date().toISOString().split('T')[0]
                  ? "bg-[#1848A0] text-white shadow-xs"
                  : "text-slate-700 dark:text-gray-300 hover:bg-white dark:hover:bg-[#2A2A38]"
              )}
            >
              Today
            </button>
            <button
              onClick={() => shiftDate(1)}
              className="p-2 rounded-xl hover:bg-white dark:hover:bg-[#2A2A38] text-slate-700 dark:text-gray-300 transition-colors"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

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

          {/* Export to PDF Button */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className={cn(
              "px-3.5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-xs border shrink-0",
              theme === 'dark'
                ? "bg-[#1A1A24] hover:bg-[#252533] text-gray-200 border-[#2A2A38]"
                : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
            )}
            title="Export Current Schedule to PDF Report"
          >
            <FileDown className="w-4 h-4 text-[#1848A0]" />
            <span className="hidden sm:inline">Export</span> PDF
          </button>

          <button
            onClick={() => openAssignModal()}
            className="bg-[#1848A0] hover:bg-[#003880] text-white px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md shrink-0"
          >
            <Plus className="w-4 h-4" /> Assign Visit
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className={cardBgClass}>
          <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Field Staff</div>
          <div className="flex items-center justify-between mt-1">
            <div className={cn("text-2xl font-black", theme === 'dark' ? "text-white" : "text-slate-900")}>
              {executives.length}
            </div>
            <Users className="w-5 h-5 text-[#1848A0]" />
          </div>
          <div className="text-[11px] text-gray-400 mt-1 font-medium">Executives active</div>
        </div>

        <div className={cardBgClass}>
          <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Planned Visits</div>
          <div className="flex items-center justify-between mt-1">
            <div className={cn("text-2xl font-black", theme === 'dark' ? "text-white" : "text-slate-900")}>
              {totalVisitsCount}
            </div>
            <CalendarDays className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-[11px] text-gray-400 mt-1 font-medium">Scheduled for {selectedDate}</div>
        </div>

        <div className={cardBgClass}>
          <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Manager Assigned</div>
          <div className="flex items-center justify-between mt-1">
            <div className={cn("text-2xl font-black text-purple-600 dark:text-purple-400")}>
              {managerAssignedCount}
            </div>
            <ShieldAlert className="w-5 h-5 text-purple-500" />
          </div>
          <div className="text-[11px] text-gray-400 mt-1 font-medium">Mandatory field visits</div>
        </div>

        <div className={cn(
          cardBgClass,
          conflictsCount > 0 && "border-red-500/50 bg-red-500/5 dark:bg-red-500/10"
        )}>
          <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Schedule Conflicts</div>
          <div className="flex items-center justify-between mt-1">
            <div className={cn("text-2xl font-black", conflictsCount > 0 ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-300")}>
              {conflictsCount}
            </div>
            <AlertTriangle className={cn("w-5 h-5", conflictsCount > 0 ? "text-red-500 animate-pulse" : "text-gray-400")} />
          </div>
          <div className="text-[11px] text-gray-400 mt-1 font-medium">Overlapping time slots</div>
        </div>

        <div className={cn(
          cardBgClass,
          overdueFollowUpsCount > 0 && "border-amber-500/50 bg-amber-500/5 dark:bg-amber-500/10"
        )}>
          <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Unscheduled Follow-ups</div>
          <div className="flex items-center justify-between mt-1">
            <div className={cn("text-2xl font-black text-amber-600 dark:text-amber-400")}>
              {overdueFollowUpsCount}
            </div>
            <Clock3 className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-[11px] text-gray-400 mt-1 font-medium">Pending allocation</div>
        </div>
      </div>

      {/* Schedule Conflicts Banner */}
      {conflictsCount > 0 && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <span className="font-extrabold uppercase tracking-wide block mb-0.5">Attention: Schedule Overlaps Detected</span>
            <p className="font-medium opacity-90">
              There {conflictsCount === 1 ? 'is' : 'are'} {conflictsCount} visit schedule conflict{conflictsCount > 1 ? 's' : ''} on {selectedDate}
              {conflictedExecutivesList.length > 0 && (
                <> affecting <strong className="underline">{conflictedExecutivesList.join(', ')}</strong></>
              )}. Review employee cards highlighted in red below to edit or reschedule.
            </p>
          </div>
        </div>
      )}

      {/* Filter and View Controls */}
      <div className={cn(
        "border rounded-2xl p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 shadow-xs",
        theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
      )}>
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search executive, org, or purpose..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(inputClass, "pl-9 text-xs")}
            />
          </div>

          {/* Filter Executive */}
          <select
            value={selectedExecutiveFilter}
            onChange={(e) => setSelectedExecutiveFilter(e.target.value)}
            className={cn(inputClass, "w-auto text-xs font-semibold py-2.5")}
          >
            <option value="ALL">All Executives</option>
            {executives.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>

          {/* Filter Territory */}
          <select
            value={selectedTerritoryFilter}
            onChange={(e) => setSelectedTerritoryFilter(e.target.value)}
            className={cn(inputClass, "w-auto text-xs font-semibold py-2.5")}
          >
            <option value="ALL">All Territories</option>
            {territories.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Filter Priority */}
          <select
            value={selectedPriorityFilter}
            onChange={(e) => setSelectedPriorityFilter(e.target.value)}
            className={cn(inputClass, "w-auto text-xs font-semibold py-2.5")}
          >
            <option value="ALL">All Priorities</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Low Priority</option>
          </select>

          {/* Filter Status */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className={cn(inputClass, "w-auto text-xs font-semibold py-2.5")}
          >
            <option value="ALL">All Statuses</option>
            <option value="PLANNED">Planned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="RESCHEDULE_REQUESTED">Reschedule Requested</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-[#0B0B0E] p-1 rounded-xl border border-slate-200 dark:border-[#2A2A35] shrink-0 self-end lg:self-auto">
          <button
            onClick={() => setViewMode('CARDS')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
              viewMode === 'CARDS'
                ? "bg-white dark:bg-[#1C1C26] text-[#1848A0] dark:text-blue-400 shadow-xs"
                : "text-slate-600 dark:text-gray-400 hover:text-slate-900"
            )}
          >
            <Users className="w-3.5 h-3.5" /> Executive Cards
          </button>
          <button
            onClick={() => setViewMode('TIMELINE')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
              viewMode === 'TIMELINE'
                ? "bg-white dark:bg-[#1C1C26] text-[#1848A0] dark:text-blue-400 shadow-xs"
                : "text-slate-600 dark:text-gray-400 hover:text-slate-900"
            )}
          >
            <Clock className="w-3.5 h-3.5" /> Timeline Grid
          </button>
          <button
            onClick={() => setViewMode('FOLLOWUPS')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 relative",
              viewMode === 'FOLLOWUPS'
                ? "bg-white dark:bg-[#1C1C26] text-[#1848A0] dark:text-blue-400 shadow-xs"
                : "text-slate-600 dark:text-gray-400 hover:text-slate-900"
            )}
          >
            <Clock3 className="w-3.5 h-3.5" /> Overdue ({overdueFollowUpsCount})
          </button>
        </div>
      </div>

      {/* Main Content Areas */}
      {loading ? (
        /* Skeleton Loading */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(n => (
            <div key={n} className={cn("border rounded-2xl p-6 space-y-4 animate-pulse", theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200")}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-[#2A2A35]" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-200 dark:bg-[#2A2A35] rounded-md w-3/4" />
                  <div className="h-3 bg-slate-200 dark:bg-[#2A2A35] rounded-md w-1/2" />
                </div>
              </div>
              <div className="h-20 bg-slate-100 dark:bg-[#0B0B0E] rounded-xl" />
              <div className="h-28 bg-slate-100 dark:bg-[#0B0B0E] rounded-xl" />
            </div>
          ))}
        </div>
      ) : viewMode === 'FOLLOWUPS' ? (
        /* Unscheduled Overdue Follow-ups Panel */
        <div className={cn("border rounded-2xl p-6 shadow-xs space-y-4", theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200")}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className={cn("text-lg font-bold flex items-center gap-2", theme === 'dark' ? "text-white" : "text-slate-900")}>
                <Clock3 className="w-5 h-5 text-amber-500" /> Unscheduled Overdue Follow-ups
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Client follow-ups past due that need to be assigned to field executives as scheduled visits.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
              {followUps.length} Pending
            </span>
          </div>

          {followUps.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm font-medium">
              🎉 Outstanding work! All follow-ups are currently scheduled or up to date.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {followUps.map(fu => (
                <div
                  key={fu.id}
                  className={cn(
                    "border rounded-xl p-4 flex flex-col justify-between gap-3 transition-all",
                    theme === 'dark' ? "bg-[#0B0B0E] border-[#2A2A35] hover:border-amber-500/40" : "bg-slate-50 border-slate-200 hover:border-amber-500/40"
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white block">
                        {fu.organization?.name || 'Organization'}
                      </span>
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                        fu.priority === 'HIGH' ? "bg-red-500/10 text-red-600 border border-red-500/20" : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                      )}>
                        {fu.priority} Priority
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-slate-700 dark:text-gray-300">
                      {fu.title}
                    </p>

                    {fu.description && (
                      <p className="text-xs text-gray-400 line-clamp-2">
                        {fu.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-gray-400 pt-1">
                      <span className="flex items-center gap-1 text-red-500 font-bold">
                        <Calendar className="w-3 h-3" /> Due: {fu.due_date}
                      </span>
                      {fu.employee && (
                        <span className="flex items-center gap-1 font-medium">
                          <User className="w-3 h-3" /> {fu.employee.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleScheduleFollowUp(fu)}
                    className="w-full bg-[#1848A0] hover:bg-[#003880] text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Assign as Visit on {selectedDate}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : viewMode === 'TIMELINE' ? (
        /* Timeline Grid View */
        <div className={cn("border rounded-2xl p-6 shadow-xs overflow-x-auto", theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200")}>
          <h2 className={cn("text-lg font-bold mb-4", theme === 'dark' ? "text-white" : "text-slate-900")}>
            Daily Schedule Timeline ({selectedDate})
          </h2>

          <div className="min-w-[900px] space-y-4">
            {/* Hour Header */}
            <div className="grid grid-cols-11 text-[11px] font-extrabold uppercase tracking-wider text-gray-400 border-b pb-2 dark:border-[#2A2A35]">
              <div className="col-span-2">Executive</div>
              {WORKING_HOURS.map(h => (
                <div key={h} className="text-center">{h}</div>
              ))}
            </div>

            {/* Rows per Executive */}
            {executives.map(exec => {
              const execVisits = visits.filter(v => v.employee_id === exec.id && v.status !== 'CANCELLED');

              return (
                <div key={exec.id} className="grid grid-cols-11 items-center py-3 border-b dark:border-[#2A2A35]/60 hover:bg-slate-50/50 dark:hover:bg-[#1C1C26]/50 rounded-xl transition-colors">
                  <div className="col-span-2 flex items-center gap-2.5 pr-2">
                    <div className="w-8 h-8 rounded-full bg-[#1848A0]/10 border border-[#1848A0]/20 text-[#1848A0] font-black flex items-center justify-center text-xs shrink-0">
                      {exec.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{exec.name}</div>
                      <div className="text-[10px] text-gray-400">{execVisits.length} Visits</div>
                    </div>
                  </div>

                  {/* Hour slots */}
                  {WORKING_HOURS.map((hour, idx) => {
                    const matchVisit = execVisits.find(v => {
                      const vStartMins = timeToMinutes(v.planned_start_time);
                      const hourMins = timeToMinutes(hour);
                      return Math.abs(vStartMins - hourMins) < 45;
                    });

                    const hasConflict = matchVisit && scheduleConflicts[matchVisit.id];

                    return (
                      <div key={hour} className="text-center px-1">
                        {matchVisit ? (
                          <div
                            onClick={() => openEditModal(matchVisit)}
                            className={cn(
                              "p-1.5 rounded-lg text-[10px] font-bold truncate cursor-pointer transition-all border shadow-2xs",
                              hasConflict
                                ? "bg-red-500/20 border-red-500 text-red-600 dark:text-red-300 animate-pulse"
                                : matchVisit.assignment_type === 'MANAGER_ASSIGNED'
                                ? "bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300"
                                : "bg-[#1848A0]/15 border-[#1848A0]/30 text-[#1848A0] dark:text-blue-300"
                            )}
                            title={`${matchVisit.organization?.name} - ${matchVisit.purpose}`}
                          >
                            {matchVisit.organization?.name?.split(' ')[0] || 'Visit'}
                          </div>
                        ) : (
                          <button
                            onClick={() => openAssignModal(exec.id, hour)}
                            className="w-full py-1.5 rounded-lg border border-dashed border-slate-200 dark:border-[#2A2A35] text-gray-300 dark:text-gray-600 hover:border-[#1848A0] hover:text-[#1848A0] transition-colors text-[10px]"
                            title={`Assign visit at ${hour}`}
                          >
                            +
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Cards View (Default) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {executives.map(exec => {
            const execVisits = filteredVisits.filter(v => v.employee_id === exec.id);
            const totalExecVisits = visits.filter(v => v.employee_id === exec.id && v.status !== 'CANCELLED');
            const availableSlots = getAvailableSlots(exec.id);
            const hasConflict = execVisits.some(v => Boolean(scheduleConflicts[v.id]));

            return (
              <div
                key={exec.id}
                className={cn(
                  "border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all",
                  hasConflict
                    ? "border-red-500/80 bg-red-500/[0.04] ring-2 ring-red-500/20"
                    : theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
                )}
              >
                <div className="space-y-4">
                  {/* Executive Header */}
                  <div className="flex items-center justify-between border-b pb-3.5 dark:border-[#2A2A35]">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full border font-black flex items-center justify-center text-sm",
                        hasConflict
                          ? "bg-red-500/15 border-red-500/30 text-red-600 dark:text-red-400"
                          : "bg-[#1848A0]/10 border-[#1848A0]/20 text-[#1848A0]"
                      )}>
                        {exec.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className={cn("font-bold text-sm sm:text-base", theme === 'dark' ? "text-white" : "text-slate-900")}>
                            {exec.name}
                          </h3>
                          {hasConflict && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-500/20 text-red-600 dark:text-red-300 border border-red-500/40 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-red-500" /> Conflict
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          {exec.role?.replace(/_/g, ' ') || 'Marketing Executive'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleExportExecutiveItinerary(exec)}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-[#1E1E28] hover:bg-slate-200 dark:hover:bg-[#282836] text-slate-700 dark:text-gray-300 transition-all text-xs font-bold flex items-center gap-1 border border-slate-200 dark:border-[#2A2A38]"
                        title={`Export Daily Itinerary PDF for ${exec.name}`}
                      >
                        <FileDown className="w-3.5 h-3.5 text-[#1848A0]" />
                      </button>
                      <button
                        onClick={() => openAssignModal(exec.id)}
                        className="p-2 rounded-xl bg-[#1848A0]/10 text-[#1848A0] hover:bg-[#1848A0] hover:text-white transition-all text-xs font-bold flex items-center gap-1 border border-[#1848A0]/20"
                        title="Assign New Visit"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Available Time Slots Indicator */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B0B0E] border border-slate-200 dark:border-[#2A2A35] space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      <span>Available Time Windows</span>
                      <span className="text-[#1848A0] dark:text-blue-400 font-extrabold">{availableSlots.length} Free Slot{availableSlots.length === 1 ? '' : 's'}</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {availableSlots.length === 0 ? (
                        <span className="text-xs text-gray-400 italic">Fully booked today</span>
                      ) : (
                        availableSlots.map((slot, idx) => (
                          <button
                            key={idx}
                            onClick={() => openAssignModal(exec.id, slot.start.split(' ')[0])}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-1"
                            title={`Click to schedule visit at ${slot.start}`}
                          >
                            <Clock className="w-2.5 h-2.5" /> {slot.start} - {slot.end}
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Planned Visits List for Executive */}
                  <div className="space-y-3">
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 flex items-center justify-between">
                      <span>Schedule ({execVisits.length})</span>
                      <span>{selectedDate}</span>
                    </div>

                    {execVisits.length === 0 ? (
                      <div className="p-6 text-center border border-dashed rounded-xl border-slate-200 dark:border-[#2A2A35] text-xs text-gray-400 font-medium">
                        No visits planned for this date.
                        <button
                          onClick={() => openAssignModal(exec.id)}
                          className="block mx-auto mt-2 text-[#1848A0] dark:text-blue-400 font-bold hover:underline"
                        >
                          + Assign First Visit
                        </button>
                      </div>
                    ) : (
                      execVisits.map(visit => {
                        const isConflict = scheduleConflicts[visit.id];

                        return (
                          <div
                            key={visit.id}
                            className={cn(
                              "p-3.5 rounded-xl border space-y-2.5 transition-all relative",
                              isConflict
                                ? "bg-red-500/10 border-red-500 dark:border-red-500/60"
                                : theme === 'dark' ? "bg-[#0B0B0E] border-[#2A2A35]" : "bg-slate-50/80 border-slate-200"
                            )}
                          >
                            {/* Conflict Warning */}
                            {isConflict && (
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 dark:text-red-400">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span>{isConflict}</span>
                              </div>
                            )}

                            {/* Org Name & Time */}
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className={cn("font-bold text-xs sm:text-sm", theme === 'dark' ? "text-white" : "text-slate-900")}>
                                  {visit.organization?.name || 'Organization'}
                                </h4>
                                <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                                  <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-gray-300">
                                    <Clock className="w-3 h-3" /> {visit.planned_start_time} ({visit.estimated_duration || 60}m)
                                  </span>
                                  {visit.organization?.district && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3" /> {visit.organization.district}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Priority Badge */}
                              <span className={cn(
                                "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0",
                                visit.priority === 'HIGH' ? "bg-red-500/10 text-red-600 border border-red-500/20" :
                                visit.priority === 'MEDIUM' ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" :
                                "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                              )}>
                                {visit.priority}
                              </span>
                            </div>

                            {/* Purpose */}
                            <p className="text-xs text-slate-600 dark:text-gray-300 line-clamp-2 font-medium">
                              {visit.purpose}
                            </p>

                            {/* Assignment Type & Status Badges */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t dark:border-[#2A2A35]">
                              <div className="flex items-center gap-1.5">
                                {visit.assignment_type === 'MANAGER_ASSIGNED' ? (
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 flex items-center gap-1">
                                    <ShieldAlert className="w-3 h-3 text-purple-600" /> Assigned by Manager
                                  </span>
                                ) : visit.assignment_type === 'SYSTEM_RECOMMENDED' ? (
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-emerald-600" /> Recommended
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-[#1E1E28] text-slate-700 dark:text-gray-300 border border-slate-300 dark:border-[#2A2A38]">
                                    Self Planned
                                  </span>
                                )}
                              </div>

                              <span className={cn(
                                "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                                visit.status === 'COMPLETED' ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" :
                                visit.status === 'IN_PROGRESS' ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" :
                                visit.status === 'RESCHEDULE_REQUESTED' ? "bg-rose-500/15 text-rose-600 border border-rose-500/30" :
                                "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                              )}>
                                {visit.status.replace(/_/g, ' ')}
                              </span>
                            </div>

                            {/* Reschedule Requested Notice */}
                            {visit.status === 'RESCHEDULE_REQUESTED' && (
                              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 space-y-1.5">
                                <div className="font-bold flex items-center justify-between">
                                  <span>Reschedule Requested by Executive</span>
                                </div>
                                {visit.reschedule_reason && (
                                  <p className="text-[11px] italic">"{visit.reschedule_reason}"</p>
                                )}
                                <button
                                  onClick={() => setReviewingReschedule(visit)}
                                  className="bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 rounded-md text-[11px] font-bold transition-all"
                                >
                                  Review Request
                                </button>
                              </div>
                            )}

                            {/* Actions for Manager */}
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                onClick={() => openEditModal(visit)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-[#1848A0] dark:text-gray-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1E1E28] transition-colors"
                                title="Edit Visit"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteVisit(visit.id, visit.organization?.name || 'Visit')}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-slate-200 dark:hover:bg-[#1E1E28] transition-colors"
                                title="Cancel / Remove Visit"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ASSIGN / EDIT VISIT MODAL */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className={cn(
            "w-full max-w-lg border rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150",
            theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
          )}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-[#2A2A35]">
              <h3 className={cn("font-extrabold text-lg flex items-center gap-2", theme === 'dark' ? "text-white" : "text-slate-900")}>
                <CalendarDays className="w-5 h-5 text-[#1848A0]" />
                {editingVisit ? 'Edit Planned Visit' : 'Assign Visit to Field Executive'}
              </h3>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-[#2A2A38] text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {actionSuccess}
              </div>
            )}

            {/* Real-time Time Conflict Validation Alert */}
            {realtimeConflict && (
              <div className="p-3.5 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5 shadow-xs animate-in fade-in slide-in-from-top-1">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold uppercase tracking-wide block mb-0.5 text-red-600 dark:text-red-400">
                    Schedule Overlap Detected
                  </span>
                  <p className="font-medium text-xs leading-relaxed opacity-95">
                    {realtimeConflict.message}
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveVisit} className="space-y-4">
              {/* Executive Select */}
              <div>
                <label className={labelClass}>Assign To Executive</label>
                <select
                  value={formEmployeeId}
                  onChange={(e) => setFormEmployeeId(e.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">Select Marketing Executive...</option>
                  {executives.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.role?.replace(/_/g, ' ')})</option>
                  ))}
                </select>
              </div>

              {/* Organization Select */}
              <div>
                <label className={labelClass}>Client Organization</label>
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

              {/* Date, Time, Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Date</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className={cn(
                    labelClass,
                    realtimeConflict && "text-red-600 dark:text-red-400"
                  )}>
                    Start Time {realtimeConflict && '(Conflict!)'}
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
                  <label className={labelClass}>Est. Duration</label>
                  <select
                    value={formDuration}
                    onChange={(e) => setFormDuration(Number(e.target.value))}
                    className={inputClass}
                  >
                    <option value={30}>30 mins</option>
                    <option value={45}>45 mins</option>
                    <option value={60}>1 hour</option>
                    <option value={90}>1.5 hours</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>
              </div>

              {/* Executive's Schedule for the Day & Free Slot Quick Pick */}
              {formEmployeeId && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0B0B0E] border border-slate-200 dark:border-[#2A2A35] space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5 text-slate-700 dark:text-gray-300">
                      <Clock className="w-3.5 h-3.5 text-[#1848A0]" />
                      Executive Schedule on {formDate}
                    </span>
                    <span>{modalExecDayVisits.length} Existing Visit{modalExecDayVisits.length === 1 ? '' : 's'}</span>
                  </div>

                  {modalExecDayVisits.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No existing visits booked on this date.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {modalExecDayVisits.map(v => {
                        const vStart = timeToMinutes(v.planned_start_time);
                        const vEnd = vStart + (v.estimated_duration || 60);
                        const curStart = timeToMinutes(formTime);
                        const curEnd = curStart + (Number(formDuration) || 60);
                        const isOverlapping = curStart < vEnd && vStart < curEnd;

                        return (
                          <div
                            key={v.id}
                            className={cn(
                              "p-2 rounded-xl text-xs flex items-center justify-between transition-all border",
                              isOverlapping
                                ? "bg-red-500/15 border-red-500 text-red-700 dark:text-red-300 font-bold"
                                : "bg-white dark:bg-[#15151A] border-slate-200 dark:border-[#2A2A35] text-slate-700 dark:text-gray-300"
                            )}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-semibold">{v.organization?.name || 'Client'}</span>
                              <span className="text-[10px] text-gray-400">({v.planned_start_time} - {minutesToFormattedTime(vEnd)})</span>
                            </div>
                            {isOverlapping ? (
                              <span className="text-[10px] uppercase font-extrabold text-red-600 dark:text-red-400 bg-red-500/20 px-2 py-0.5 rounded-md shrink-0">
                                ⚠️ Overlap
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-400 shrink-0 font-medium">{v.status}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Free slots */}
                  {modalAvailableSlots.length > 0 && (
                    <div className="pt-1.5 border-t dark:border-[#2A2A35]/60 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Available Windows:</span>
                      {modalAvailableSlots.map((slot, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setFormTime(slot.rawStart)}
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-all flex items-center gap-1",
                            formTime === slot.rawStart
                              ? "bg-[#1848A0] text-white border-[#1848A0]"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500 hover:text-white"
                          )}
                          title={`Click to set start time to ${slot.start}`}
                        >
                          {slot.start} - {slot.end}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Purpose */}
              <div>
                <label className={labelClass}>Visit Purpose / Agenda</label>
                <input
                  type="text"
                  placeholder="e.g. Commercial Needs Assessment & Quarterly SLA Review"
                  value={formPurpose}
                  onChange={(e) => setFormPurpose(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              {/* Priority & Assignment Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Priority Level</label>
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
                  <label className={labelClass}>Assignment Type</label>
                  <select
                    value={formAssignmentType}
                    onChange={(e) => setFormAssignmentType(e.target.value as AssignmentType)}
                    className={inputClass}
                  >
                    <option value="MANAGER_ASSIGNED">MANAGER ASSIGNED</option>
                    <option value="SYSTEM_RECOMMENDED">SYSTEM RECOMMENDED</option>
                    <option value="SELF_PLANNED">SELF PLANNED</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className={labelClass}>Manager Instructions / Notes</label>
                <textarea
                  placeholder="Additional context or key items executive should focus on..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className={cn(inputClass, "h-20 resize-none")}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t dark:border-[#2A2A35]">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border text-xs font-bold transition-all text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-[#2A2A38]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#1848A0] hover:bg-[#003880] text-white px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md flex items-center gap-2"
                >
                  {submitting ? 'Saving...' : editingVisit ? 'Update Schedule' : 'Assign Visit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVIEW RESCHEDULE MODAL */}
      {reviewingReschedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className={cn(
            "w-full max-w-md border rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150",
            theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
          )}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-[#2A2A35]">
              <h3 className={cn("font-bold text-base flex items-center gap-2", theme === 'dark' ? "text-white" : "text-slate-900")}>
                <RotateCcw className="w-5 h-5 text-rose-500" /> Review Reschedule Request
              </h3>
              <button onClick={() => setReviewingReschedule(null)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-gray-400 block font-semibold">Organization:</span>
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  {reviewingReschedule.organization?.name}
                </span>
              </div>

              <div>
                <span className="text-gray-400 block font-semibold">Assigned Executive:</span>
                <span className="font-semibold text-slate-800 dark:text-gray-200">
                  {reviewingReschedule.employee?.name}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
                <span className="font-bold text-rose-600 dark:text-rose-400 block mb-1">Executive Request Reason:</span>
                <p className="text-slate-700 dark:text-gray-300 italic">
                  "{reviewingReschedule.reschedule_reason || 'Client requested rescheduling.'}"
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t dark:border-[#2A2A35]">
              <button
                onClick={() => handleReviewReschedule(false)}
                disabled={submitting}
                className="px-4 py-2 rounded-xl border text-xs font-bold text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-[#2A2A38]"
              >
                Keep Current Date
              </button>
              <button
                onClick={() => handleReviewReschedule(true)}
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs"
              >
                Approve Reschedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXPORT TO PDF REPORT MODAL */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className={cn(
            "w-full max-w-lg border rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150",
            theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
          )}>
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3.5 dark:border-[#2A2A35]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-[#1848A0]/10 text-[#1848A0] border border-[#1848A0]/20">
                  <FileDown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={cn("font-bold text-base", theme === 'dark' ? "text-white" : "text-slate-900")}>
                    Export Schedule to PDF
                  </h3>
                  <p className="text-xs text-gray-400">
                    Generate an official field operations schedule report for {selectedDate}.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#2A2A38] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scope Selection */}
            <div className="space-y-2">
              <label className={labelClass}>Report Scope & Target Data</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setExportScope('CURRENT_FILTERED')}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all space-y-1",
                    exportScope === 'CURRENT_FILTERED'
                      ? "border-[#1848A0] bg-[#1848A0]/10 ring-2 ring-[#1848A0]/30"
                      : "border-slate-200 dark:border-[#2A2A35] hover:bg-slate-50 dark:hover:bg-[#1C1C26]"
                  )}
                >
                  <div className="font-bold text-xs text-slate-800 dark:text-gray-200 flex items-center justify-between">
                    <span>Filtered View</span>
                    {exportScope === 'CURRENT_FILTERED' && <Check className="w-3.5 h-3.5 text-[#1848A0]" />}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {filteredVisits.length} visible visits matching current filters
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setExportScope('ALL_DAY')}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all space-y-1",
                    exportScope === 'ALL_DAY'
                      ? "border-[#1848A0] bg-[#1848A0]/10 ring-2 ring-[#1848A0]/30"
                      : "border-slate-200 dark:border-[#2A2A35] hover:bg-slate-50 dark:hover:bg-[#1C1C26]"
                  )}
                >
                  <div className="font-bold text-xs text-slate-800 dark:text-gray-200 flex items-center justify-between">
                    <span>Full Team Day</span>
                    {exportScope === 'ALL_DAY' && <Check className="w-3.5 h-3.5 text-[#1848A0]" />}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {visits.length} total scheduled visits across all staff
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setExportScope('SINGLE_EXECUTIVE');
                    if (!exportExecutiveId && executives[0]) {
                      setExportExecutiveId(executives[0].id);
                    }
                  }}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all space-y-1",
                    exportScope === 'SINGLE_EXECUTIVE'
                      ? "border-[#1848A0] bg-[#1848A0]/10 ring-2 ring-[#1848A0]/30"
                      : "border-slate-200 dark:border-[#2A2A35] hover:bg-slate-50 dark:hover:bg-[#1C1C26]"
                  )}
                >
                  <div className="font-bold text-xs text-slate-800 dark:text-gray-200 flex items-center justify-between">
                    <span>Executive Plan</span>
                    {exportScope === 'SINGLE_EXECUTIVE' && <Check className="w-3.5 h-3.5 text-[#1848A0]" />}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    Individual field itinerary with contact details
                  </div>
                </button>
              </div>
            </div>

            {/* If Single Executive selected, show executive picker */}
            {exportScope === 'SINGLE_EXECUTIVE' && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0B0B0E] border border-slate-200 dark:border-[#2A2A35] space-y-2 animate-in fade-in duration-150">
                <label className={labelClass}>Select Field Executive *</label>
                <select
                  value={exportExecutiveId || (executives[0]?.id || '')}
                  onChange={(e) => setExportExecutiveId(e.target.value)}
                  className={inputClass}
                >
                  {executives.map(e => {
                    const execCount = visits.filter(v => v.employee_id === e.id && v.status !== 'CANCELLED').length;
                    return (
                      <option key={e.id} value={e.id}>
                        {e.name} ({execCount} visit{execCount === 1 ? '' : 's'} scheduled)
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Layout Orientation (for team schedule) */}
            {exportScope !== 'SINGLE_EXECUTIVE' && (
              <div className="space-y-2">
                <label className={labelClass}>Page Layout Orientation</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setExportOrientation('landscape')}
                    className={cn(
                      "p-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all",
                      exportOrientation === 'landscape'
                        ? "border-[#1848A0] bg-[#1848A0]/10 text-[#1848A0] dark:text-blue-300"
                        : "border-slate-200 dark:border-[#2A2A35] text-slate-700 dark:text-gray-300 hover:bg-slate-50"
                    )}
                  >
                    <span>Landscape (Wide Table)</span>
                    {exportOrientation === 'landscape' && <Check className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportOrientation('portrait')}
                    className={cn(
                      "p-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all",
                      exportOrientation === 'portrait'
                        ? "border-[#1848A0] bg-[#1848A0]/10 text-[#1848A0] dark:text-blue-300"
                        : "border-slate-200 dark:border-[#2A2A35] text-slate-700 dark:text-gray-300 hover:bg-slate-50"
                    )}
                  >
                    <span>Portrait (Compact)</span>
                    {exportOrientation === 'portrait' && <Check className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Inclusions Checkboxes */}
            <div className="space-y-2 pt-1">
              <label className={labelClass}>Document Options & Inclusions</label>
              <div className="space-y-2">
                {exportScope !== 'SINGLE_EXECUTIVE' && (
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-gray-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={exportIncludeKPIs}
                      onChange={(e) => setExportIncludeKPIs(e.target.checked)}
                      className="rounded text-[#1848A0] focus:ring-[#1848A0] w-4 h-4"
                    />
                    <span>Include Summary KPI cards (Total visits, active staff, conflicts status)</span>
                  </label>
                )}

                <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-gray-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={exportIncludeSignOff}
                    onChange={(e) => setExportIncludeSignOff(e.target.checked)}
                    className="rounded text-[#1848A0] focus:ring-[#1848A0] w-4 h-4"
                  />
                  <span>Include Manager Sign-Off & Verification lines for reporting audit</span>
                </label>
              </div>
            </div>

            {/* Summary preview badge */}
            <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#0B0B0E] border border-slate-200 dark:border-[#2A2A35] flex items-center justify-between text-xs">
              <span className="text-gray-400">Target Date: <strong className="text-slate-800 dark:text-gray-200">{selectedDate}</strong></span>
              <span className="font-bold text-[#1848A0] dark:text-blue-400">
                {exportScope === 'SINGLE_EXECUTIVE' ? '1 Executive Itinerary' : `${exportScope === 'CURRENT_FILTERED' ? filteredVisits.length : visits.length} Visits to Export`}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t dark:border-[#2A2A35]">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border text-xs font-bold transition-all text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-[#2A2A38]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecutePDFExport}
                disabled={isExporting}
                className="bg-[#1848A0] hover:bg-[#003880] text-white px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md flex items-center gap-2"
              >
                <FileDown className="w-4 h-4" />
                {isExporting ? 'Generating PDF...' : 'Download PDF Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

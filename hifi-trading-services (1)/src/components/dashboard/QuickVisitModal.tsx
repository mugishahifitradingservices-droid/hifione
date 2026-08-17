import React, { useState } from 'react';
import { X, Calendar, Clock, MapPin, Building2, User, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { Organization, AppUser, Priority, AssignmentType } from '../../types';

interface QuickVisitModalProps {
  organizations: Organization[];
  executives: AppUser[];
  onClose: () => void;
  onVisitCreated: () => void;
}

export default function QuickVisitModal({
  organizations,
  executives,
  onClose,
  onVisitCreated
}: QuickVisitModalProps) {
  const { appUser } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [organizationId, setOrganizationId] = useState(organizations[0]?.id || '');
  const [plannedDate, setPlannedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [plannedStartTime, setPlannedStartTime] = useState('10:00');
  const [duration, setDuration] = useState(60);
  const [purpose, setPurpose] = useState('');
  const [priority, setPriority] = useState<Priority>('HIGH');
  const [assignedEmployeeId, setAssignedEmployeeId] = useState(appUser?.id || executives[0]?.id || '');

  const isManagerOrAdmin = appUser?.role === 'MARKETING_MANAGER' || appUser?.role === 'SYSTEM_ADMIN' || appUser?.role === 'CEO';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) {
      setError('Please select an organization');
      return;
    }
    if (!purpose.trim()) {
      setError('Please specify the visit purpose');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const isSelfPlanned = assignedEmployeeId === appUser?.id;
      const assignmentType: AssignmentType = isSelfPlanned ? 'SELF_PLANNED' : 'MANAGER_ASSIGNED';

      const payload = {
        employee_id: assignedEmployeeId,
        organization_id: organizationId,
        planned_date: plannedDate,
        planned_start_time: plannedStartTime,
        estimated_duration: duration,
        purpose: purpose.trim(),
        priority: priority,
        assignment_type: assignmentType,
        assigned_by: isSelfPlanned ? null : appUser?.id,
        status: 'PLANNED'
      };

      const { error: insertError } = await supabase
        .from('planned_visits')
        .insert([payload]);

      if (insertError) {
        console.warn('Supabase visit insert notice:', insertError.message);
      }

      onVisitCreated();
      onClose();
    } catch (err: any) {
      console.error('Error creating planned visit:', err);
      setError(err.message || 'Failed to schedule visit');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = cn(
    "w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#1848A0]",
    isDark 
      ? "bg-[#0B0B0E] border-[#2A2A38] text-white placeholder-gray-500" 
      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
  );

  const labelClass = cn(
    "block text-xs font-bold uppercase tracking-wider mb-1.5",
    isDark ? "text-slate-300" : "text-slate-700"
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className={cn(
        "w-full max-w-lg rounded-2xl shadow-2xl border flex flex-col overflow-hidden transition-all",
        isDark ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
      )}>
        {/* Header */}
        <div className={cn(
          "px-6 py-4 border-b flex items-center justify-between",
          isDark ? "border-[#2A2A35]" : "border-slate-100"
        )}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1848A0]/10 text-[#1848A0] dark:text-blue-400 flex items-center justify-center font-bold shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className={cn("text-base sm:text-lg font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                Schedule Field Visit
              </h2>
              <p className="text-xs text-slate-400">Plan a targeted client meeting or site demonstration</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Target Organization */}
          <div>
            <label className={labelClass}>Target Client Organization *</label>
            <select
              required
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              className={inputClass}
            >
              {organizations.length === 0 ? (
                <option value="">No organizations available</option>
              ) : (
                organizations.map(org => (
                  <option key={org.id} value={org.id} className={isDark ? "bg-[#15151A] text-white" : "bg-white text-slate-900"}>
                    {org.name} {org.district ? `(${org.district})` : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Purpose */}
          <div>
            <label className={labelClass}>Visit Purpose & Agenda *</label>
            <input
              required
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Present commercial proposal & assess bulk requirement"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Planned Date */}
            <div>
              <label className={labelClass}>Date *</label>
              <input
                required
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Time */}
            <div>
              <label className={labelClass}>Time</label>
              <input
                type="time"
                value={plannedStartTime}
                onChange={(e) => setPlannedStartTime(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Duration */}
            <div>
              <label className={labelClass}>Duration (min)</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Priority */}
            <div>
              <label className={labelClass}>Priority</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['HIGH', 'MEDIUM', 'LOW'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={cn(
                      "py-2 px-1 rounded-xl text-xs font-bold transition-all border cursor-pointer text-center",
                      priority === p 
                        ? p === 'HIGH'
                          ? "bg-rose-500 text-white border-rose-600 shadow-xs"
                          : p === 'MEDIUM'
                            ? "bg-[#F88020] text-white border-orange-600 shadow-xs"
                            : "bg-[#0088D0] text-white border-blue-600 shadow-xs"
                        : isDark
                          ? "bg-[#0B0B0E] border-[#2A2A38] text-slate-400 hover:text-white"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Assigned Staff (Manager assignment) */}
            {isManagerOrAdmin && executives.length > 0 ? (
              <div>
                <label className={labelClass}>Field Staff</label>
                <select
                  value={assignedEmployeeId}
                  onChange={(e) => setAssignedEmployeeId(e.target.value)}
                  className={inputClass}
                >
                  {executives.map(exec => (
                    <option key={exec.id} value={exec.id} className={isDark ? "bg-[#15151A] text-white" : "bg-white text-slate-900"}>
                      {exec.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex flex-col justify-end">
                <div className={cn(
                  "px-3.5 py-2.5 rounded-xl border text-xs text-slate-400 flex items-center gap-2",
                  isDark ? "border-[#2A2A38] bg-[#0B0B0E]" : "border-slate-200 bg-slate-50"
                )}>
                  <User className="w-3.5 h-3.5 text-[#1848A0]" />
                  <span>Self-Assigned: <strong>{appUser?.name || 'Me'}</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer",
                isDark ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-[#1848A0] hover:bg-[#003880] text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                'Schedule Visit'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

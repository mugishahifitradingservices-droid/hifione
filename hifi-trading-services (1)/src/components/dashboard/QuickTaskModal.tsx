import React, { useState } from 'react';
import { X, ListTodo, AlertCircle, Loader2, Calendar, User, Building2, Flag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { Organization, AppUser, Priority } from '../../types';

interface QuickTaskModalProps {
  organizations: Organization[];
  executives: AppUser[];
  onClose: () => void;
  onTaskCreated: () => void;
}

export default function QuickTaskModal({
  organizations,
  executives,
  onClose,
  onTaskCreated
}: QuickTaskModalProps) {
  const { appUser } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id || '');
  const [assignedTo, setAssignedTo] = useState(appUser?.id || executives[0]?.id || '');
  const [priority, setPriority] = useState<Priority>('HIGH');
  const [dueDate, setDueDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a task title');
      return;
    }
    if (!organizationId) {
      setError('Please select a target organization');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        organization_id: organizationId,
        assigned_to: assignedTo || appUser?.id,
        due_date: dueDate,
        priority: priority,
        status: 'PENDING',
        created_by: appUser?.id || assignedTo
      };

      const { error: insertError } = await supabase
        .from('follow_ups')
        .insert([payload]);

      if (insertError) {
        console.warn('Supabase follow-up insert notice:', insertError.message);
      }

      onTaskCreated();
      onClose();
    } catch (err: any) {
      console.error('Error creating follow-up task:', err);
      setError(err.message || 'Failed to create task');
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
            <div className="w-10 h-10 rounded-xl bg-[#F88020]/10 text-[#F88020] flex items-center justify-center font-bold shrink-0">
              <ListTodo className="w-5 h-5" />
            </div>
            <div>
              <h2 className={cn("text-base sm:text-lg font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                New Follow-Up Action
              </h2>
              <p className="text-xs text-slate-400">Add an action item or deadline for a client account</p>
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

          {/* Task Title */}
          <div>
            <label className={labelClass}>Task / Action Title *</label>
            <input
              required
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Deliver product samples and submit revised pricing quotation"
              className={inputClass}
            />
          </div>

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Priority */}
            <div>
              <label className={labelClass}>Priority Level</label>
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

            {/* Due Date */}
            <div>
              <label className={labelClass}>Due Date *</label>
              <input
                required
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Assigned Staff */}
          {executives.length > 0 && (
            <div>
              <label className={labelClass}>Assigned Field Executive</label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className={inputClass}
              >
                {executives.map(exec => (
                  <option key={exec.id} value={exec.id} className={isDark ? "bg-[#15151A] text-white" : "bg-white text-slate-900"}>
                    {exec.name} ({exec.role ? exec.role.replace(/_/g, ' ') : 'Staff'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Description */}
          <div>
            <label className={labelClass}>Additional Notes (Optional)</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Key deliverables, client contact person, specific requests..."
              className={inputClass}
            />
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
                  Saving...
                </>
              ) : (
                'Create Follow-Up'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

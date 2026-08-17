import React, { useState, useEffect } from 'react';
import { 
  X, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  Building2, 
  User, 
  Phone, 
  FileText, 
  Briefcase, 
  Calendar, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  Plus, 
  DollarSign, 
  Flag,
  Navigation,
  Check
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { PlannedVisit, Organization, Contact, VisitOutcome, Priority, OpportunityStage } from '../../types';
import { LocationState } from '../../hooks/useFieldSession';
import { enqueueOfflineAction } from '../../lib/offlineSync';
import VoiceNoteTextarea from './VoiceNoteTextarea';
import VoiceDictationButton from './VoiceDictationButton';

interface CheckInExecutionModalProps {
  visit: PlannedVisit;
  currentLocation: LocationState | null;
  onClose: () => void;
  onComplete: () => void;
}

const QUICK_NOTES_TAGS = [
  'Decision Maker Met',
  'Product Demo Presented',
  'Pricing Negotiation',
  'Sample Delivered',
  'Bulk Need Identified',
  'Budget Approved',
  'Competitor Discussed',
  'Follow-up Required'
];

export default function CheckInExecutionModal({
  visit,
  currentLocation,
  onClose,
  onComplete
}: CheckInExecutionModalProps) {
  const { appUser } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check-in tracking state
  const [checkInTime, setCheckInTime] = useState<string>(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const [checkInLocation, setCheckInLocation] = useState<LocationState | null>(currentLocation);
  const [durationMinutes, setDurationMinutes] = useState<number>(1);

  // Meeting Form state
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState(visit.organization?.phone || '');
  const [selectedOutcome, setSelectedOutcome] = useState<VisitOutcome>('INTERESTED');
  const [meetingSummary, setMeetingSummary] = useState('');
  const [clientFeedback, setClientFeedback] = useState('');

  // Opportunity identifier toggle & fields
  const [hasOpportunity, setHasOpportunity] = useState(false);
  const [oppTitle, setOppTitle] = useState('');
  const [oppProduct, setOppProduct] = useState('');
  const [oppValue, setOppValue] = useState<number | ''>('');
  const [oppCurrency, setOppCurrency] = useState<'RWF' | 'USD'>('RWF');
  const [oppStage, setOppStage] = useState<OpportunityStage>('IDENTIFIED');
  const [oppCloseDate, setOppCloseDate] = useState(() => {
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 21);
    return nextMonth.toISOString().split('T')[0];
  });

  // Next Follow-up Commitment
  const [createFollowUp, setCreateFollowUp] = useState(true);
  const [followUpTitle, setFollowUpTitle] = useState('');
  const [followUpDate, setFollowUpDate] = useState(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 5);
    return nextWeek.toISOString().split('T')[0];
  });
  const [followUpPriority, setFollowUpPriority] = useState<Priority>('HIGH');

  // Timer for duration in meeting
  useEffect(() => {
    const timer = setInterval(() => {
      setDurationMinutes(prev => prev + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Update check in location if initially null
  useEffect(() => {
    if (!checkInLocation && currentLocation) {
      setCheckInLocation(currentLocation);
    }
  }, [currentLocation, checkInLocation]);

  // Set default follow up title based on outcome
  useEffect(() => {
    if (selectedOutcome === 'QUOTATION_REQUESTED') {
      setFollowUpTitle(`Submit pricing quotation to ${visit.organization?.name || 'Client'}`);
      setHasOpportunity(true);
      if (!oppTitle) setOppTitle(`Supply Contract - ${visit.organization?.name || 'Client'}`);
    } else if (selectedOutcome === 'INTERESTED') {
      setFollowUpTitle(`Follow up with ${visit.organization?.name || 'Client'} decision maker`);
    } else if (selectedOutcome === 'FOLLOW_UP_REQUIRED') {
      setFollowUpTitle(`Secondary meeting with ${visit.organization?.name || 'Client'}`);
    }
  }, [selectedOutcome, visit.organization?.name]);

  const handleAddTag = (tag: string) => {
    if (meetingSummary.includes(tag)) return;
    setMeetingSummary(prev => prev ? `${prev} • ${tag}` : tag);
  };

  const handleSaveAndComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingSummary.trim()) {
      setError('Please provide a brief meeting summary or key discussion points.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const now = new Date();
      const checkOutTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Build Opportunity Payload
      let oppPayload: any = null;
      let createdOppId: string | undefined;
      if (hasOpportunity && oppTitle.trim()) {
        createdOppId = `opp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        oppPayload = {
          id: createdOppId,
          organization_id: visit.organization_id,
          created_by: appUser?.id,
          title: oppTitle.trim(),
          product_or_service: oppProduct.trim() || 'General Procurement',
          estimated_value: Number(oppValue) || 0,
          currency: oppCurrency,
          stage: oppStage,
          expected_close_date: oppCloseDate,
          confidence_percentage: oppStage === 'WON' ? 100 : oppStage === 'NEGOTIATION' ? 80 : 50,
          notes: meetingSummary,
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        };
      }

      // Build Follow-up Payload
      let followUpPayload: any = null;
      let createdFollowUpId: string | undefined;
      if (createFollowUp && followUpTitle.trim()) {
        createdFollowUpId = `fu_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        followUpPayload = {
          id: createdFollowUpId,
          organization_id: visit.organization_id,
          assigned_to: appUser?.id,
          title: followUpTitle.trim(),
          description: `Follow-up from field visit on ${now.toISOString().split('T')[0]}. Outcome: ${selectedOutcome}`,
          due_date: followUpDate,
          priority: followUpPriority,
          status: 'PENDING',
          created_by: appUser?.id,
          created_at: now.toISOString()
        };
      }

      // Build Visit Log Payload
      const visitLogPayload = {
        id: `vl_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        planned_visit_id: visit.id,
        organization_id: visit.organization_id,
        employee_id: appUser?.id,
        check_in_time: checkInTime,
        check_out_time: checkOutTime,
        check_in_lat: checkInLocation?.lat || null,
        check_in_lng: checkInLocation?.lng || null,
        check_out_lat: currentLocation?.lat || null,
        check_out_lng: currentLocation?.lng || null,
        contact_person: contactName.trim() || null,
        contact_phone: contactPhone.trim() || null,
        meeting_summary: meetingSummary.trim(),
        client_feedback: clientFeedback.trim() || null,
        outcome: selectedOutcome,
        opportunity_created: hasOpportunity,
        opportunity_id: createdOppId || null,
        follow_up_id: createdFollowUpId || null,
        duration_minutes: durationMinutes,
        created_at: now.toISOString()
      };

      // Check if online vs offline
      if (!navigator.onLine) {
        // Enqueue offline action
        enqueueOfflineAction(
          'LOG_VISIT',
          {
            visitLog: visitLogPayload,
            plannedVisitId: visit.id,
            opportunity: oppPayload,
            followUp: followUpPayload
          },
          `Visit Log at ${visit.organization?.name || 'Client'} (${selectedOutcome})`
        );
        onComplete();
        onClose();
        return;
      }

      // If Online: Try direct Supabase writes
      try {
        if (oppPayload) {
          const { data: oppData } = await supabase.from('opportunities').insert([oppPayload]).select().single();
          if (oppData) createdOppId = oppData.id;
        }

        if (followUpPayload) {
          const { data: fuData } = await supabase.from('follow_ups').insert([followUpPayload]).select().single();
          if (fuData) createdFollowUpId = fuData.id;
        }

        await supabase.from('visit_logs').insert([{
          ...visitLogPayload,
          opportunity_id: createdOppId || null,
          follow_up_id: createdFollowUpId || null
        }]);

        await supabase
          .from('planned_visits')
          .update({
            status: 'COMPLETED',
            notes: `${visit.notes || ''} | Completed: ${selectedOutcome}. ${meetingSummary.slice(0, 100)}`,
            updated_at: now.toISOString()
          })
          .eq('id', visit.id);

        onComplete();
        onClose();

      } catch (networkErr) {
        console.warn('Network error saving visit, queueing offline fallback:', networkErr);
        enqueueOfflineAction(
          'LOG_VISIT',
          {
            visitLog: visitLogPayload,
            plannedVisitId: visit.id,
            opportunity: oppPayload,
            followUp: followUpPayload
          },
          `Visit Log at ${visit.organization?.name || 'Client'} (${selectedOutcome})`
        );
        onComplete();
        onClose();
      }

    } catch (err: any) {
      console.error('Error completing visit in field mode:', err);
      setError(err.message || 'Failed to complete visit record');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className={cn(
        "w-full max-w-xl rounded-2xl shadow-2xl border flex flex-col my-auto overflow-hidden transition-all",
        isDark ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
      )}>
        {/* Header with GPS badge */}
        <div className={cn(
          "px-5 py-4 border-b flex items-start justify-between gap-3",
          isDark ? "border-[#2A2A35] bg-[#121217]" : "border-slate-100 bg-slate-50/70"
        )}>
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Checked In Active
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold">
                <Clock className="w-3.5 h-3.5 text-[#1848A0]" />
                In Meeting: ~{durationMinutes} min
              </span>
            </div>
            <h2 className={cn("text-base sm:text-lg font-black tracking-tight truncate", isDark ? "text-white" : "text-slate-900")}>
              {visit.organization?.name || 'Client Visit Execution'}
            </h2>
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 truncate">
              <MapPin className="w-3.5 h-3.5 text-[#F88020] shrink-0" />
              {visit.organization?.district || visit.organization?.address || 'Site Location'}
              {checkInLocation && ` • GPS ±${checkInLocation.accuracy}m`}
            </p>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSaveAndComplete} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Contact Person Met */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Contact Person Met *</label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="e.g. Jean Pierre (Procurement Mgr)"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Direct Phone / WhatsApp</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+250 788 123 456"
                className={inputClass}
              />
            </div>
          </div>

          {/* 2. Visit Outcome Selector */}
          <div>
            <label className={labelClass}>Meeting Outcome *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {([
                { key: 'INTERESTED', label: 'Interested', color: 'bg-emerald-500 text-white border-emerald-600' },
                { key: 'QUOTATION_REQUESTED', label: 'Needs Quote', color: 'bg-[#1848A0] text-white border-blue-700' },
                { key: 'FOLLOW_UP_REQUIRED', label: 'Follow Up', color: 'bg-[#F88020] text-white border-orange-600' },
                { key: 'CLOSED_WON', label: 'Deal Won', color: 'bg-purple-600 text-white border-purple-700' },
                { key: 'RESCHEDULED', label: 'Rescheduled', color: 'bg-amber-500 text-white border-amber-600' },
                { key: 'NOT_INTERESTED', label: 'Not Interested', color: 'bg-slate-600 text-white border-slate-700' },
              ] as const).map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSelectedOutcome(item.key)}
                  className={cn(
                    "py-2 px-2 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer",
                    selectedOutcome === item.key
                      ? cn(item.color, "shadow-sm scale-[1.02]")
                      : isDark
                        ? "bg-[#0B0B0E] border-[#2A2A38] text-slate-400 hover:text-white"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Meeting Summary & Voice-to-Text Dictation */}
          <div>
            <VoiceNoteTextarea
              id="meeting-summary-field"
              label="Meeting Discussion & Summary"
              required
              rows={3}
              value={meetingSummary}
              onChange={setMeetingSummary}
              quickTags={QUICK_NOTES_TAGS}
              placeholder="Speak or type key topics discussed, client requirements, pricing expectations, and agreed milestones..."
              helperText="Tip: Tap Voice-to-Text to dictate immediately after leaving the client site."
            />
          </div>

          {/* 4. Opportunity Need Identifier (Collapsible Card) */}
          <div className={cn(
            "p-4 rounded-xl border transition-all space-y-3",
            hasOpportunity 
              ? isDark ? "bg-[#1848A0]/10 border-[#1848A0]/40" : "bg-blue-50/70 border-blue-200"
              : isDark ? "bg-[#0B0B0E] border-[#2A2A38]" : "bg-slate-50 border-slate-200"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className={cn("w-4 h-4", hasOpportunity ? "text-[#1848A0] dark:text-blue-400" : "text-slate-400")} />
                <span className={cn("text-xs font-bold uppercase tracking-wider", isDark ? "text-white" : "text-slate-900")}>
                  Identify Opportunity / Commercial Need
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasOpportunity}
                  onChange={(e) => setHasOpportunity(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1848A0]"></div>
              </label>
            </div>

            {hasOpportunity && (
              <div className="space-y-3 pt-2 border-t dark:border-blue-900/40 border-blue-200 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                        Requirement / Deal Title *
                      </label>
                      <VoiceDictationButton
                        size="sm"
                        label="Speak"
                        onAppendText={(txt) => setOppTitle(prev => prev ? `${prev} ${txt}` : txt)}
                      />
                    </div>
                    <input
                      required={hasOpportunity}
                      type="text"
                      value={oppTitle}
                      onChange={(e) => setOppTitle(e.target.value)}
                      placeholder="e.g. Annual Equipment Procurement"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                        Product / Service Line
                      </label>
                      <VoiceDictationButton
                        size="sm"
                        label="Speak"
                        onAppendText={(txt) => setOppProduct(prev => prev ? `${prev} ${txt}` : txt)}
                      />
                    </div>
                    <input
                      type="text"
                      value={oppProduct}
                      onChange={(e) => setOppProduct(e.target.value)}
                      placeholder="e.g. Industrial Supplies, PPE, Logistics"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Estimated Value</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={oppValue}
                        onChange={(e) => setOppValue(e.target.value ? Number(e.target.value) : '')}
                        placeholder="5,000,000"
                        className={cn(inputClass, "pr-14")}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                        {oppCurrency}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Pipeline Stage</label>
                    <select
                      value={oppStage}
                      onChange={(e) => setOppStage(e.target.value as OpportunityStage)}
                      className={inputClass}
                    >
                      <option value="IDENTIFIED">Identified</option>
                      <option value="QUALIFIED">Qualified</option>
                      <option value="PROPOSAL_SENT">Proposal Sent</option>
                      <option value="NEGOTIATION">Negotiation</option>
                      <option value="WON">Closed Won</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>Target Close Date</label>
                    <input
                      type="date"
                      value={oppCloseDate}
                      onChange={(e) => setOppCloseDate(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 5. Next Follow-Up Commitment */}
          <div className={cn(
            "p-4 rounded-xl border transition-all space-y-3",
            createFollowUp
              ? isDark ? "bg-[#F88020]/10 border-[#F88020]/40" : "bg-orange-50/70 border-orange-200"
              : isDark ? "bg-[#0B0B0E] border-[#2A2A38]" : "bg-slate-50 border-slate-200"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className={cn("w-4 h-4", createFollowUp ? "text-[#F88020]" : "text-slate-400")} />
                <span className={cn("text-xs font-bold uppercase tracking-wider", isDark ? "text-white" : "text-slate-900")}>
                  Schedule Next Follow-Up Action
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={createFollowUp}
                  onChange={(e) => setCreateFollowUp(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#F88020]"></div>
              </label>
            </div>

            {createFollowUp && (
              <div className="space-y-3 pt-2 border-t dark:border-orange-900/40 border-orange-200 animate-in fade-in duration-150">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                      Action Item Title *
                    </label>
                    <VoiceDictationButton
                      size="sm"
                      label="Speak"
                      onAppendText={(txt) => setFollowUpTitle(prev => prev ? `${prev} ${txt}` : txt)}
                    />
                  </div>
                  <input
                    required={createFollowUp}
                    type="text"
                    value={followUpTitle}
                    onChange={(e) => setFollowUpTitle(e.target.value)}
                    placeholder="e.g. Deliver revised technical catalog & discuss procurement timeline"
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Action Due Date *</label>
                    <input
                      required={createFollowUp}
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Action Priority</label>
                    <select
                      value={followUpPriority}
                      onChange={(e) => setFollowUpPriority(e.target.value as Priority)}
                      className={inputClass}
                    >
                      <option value="HIGH">High Priority</option>
                      <option value="MEDIUM">Medium Priority</option>
                      <option value="LOW">Low Priority</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t dark:border-[#252530] flex items-center justify-between gap-3">
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
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-black transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving & Checking Out...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Complete & Check Out Visit
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

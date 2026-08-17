import React, { useState, useEffect } from 'react';
import { 
  X, 
  Send, 
  AlertTriangle, 
  Zap, 
  DollarSign, 
  FileCheck2, 
  Package, 
  Clock, 
  ShieldAlert, 
  MessageSquare, 
  Building2, 
  MapPin, 
  User, 
  CheckCircle2, 
  Loader2, 
  Sparkles,
  WifiOff,
  Radio
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { 
  Role, 
  AppUser, 
  Organization, 
  MessageSituation, 
  MessageUrgency, 
  InternalMessage 
} from '../../types';
import { 
  sendSituationMessage, 
  getCachedTeamUsers, 
  cacheTeamUsers 
} from '../../lib/offlineSync';
import { LocationState } from '../../hooks/useFieldSession';
import VoiceNoteTextarea from './VoiceNoteTextarea';
import VoiceDictationButton from './VoiceDictationButton';

interface FieldSituationModalProps {
  currentLocation: LocationState | null;
  linkedOrganization?: Organization | null;
  onClose: () => void;
  onSuccess?: (msg: InternalMessage, isOffline: boolean) => void;
}

interface SituationPreset {
  id: MessageSituation;
  label: string;
  defaultRecipientRole: Role | 'ALL';
  defaultUrgency: MessageUrgency;
  icon: React.ElementType;
  badgeColor: string;
  templateTitle: string;
  templateBody: (orgName?: string) => string;
}

const SITUATION_PRESETS: SituationPreset[] = [
  {
    id: 'PRICING_APPROVAL',
    label: 'Urgent Pricing Approval',
    defaultRecipientRole: 'SALES_MANAGER',
    defaultUrgency: 'URGENT',
    icon: DollarSign,
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    templateTitle: 'Urgent Pricing & Quotation Approval Needed',
    templateBody: (orgName) => `In meeting with ${orgName || 'client'}. Client is ready to close if we can provide a volume discount or custom quote approval. Deal estimated value approx: `
  },
  {
    id: 'TENDER_ALERT',
    label: 'Tender / RFQ Identified',
    defaultRecipientRole: 'TENDER_OFFICER',
    defaultUrgency: 'HIGH' as MessageUrgency,
    icon: FileCheck2,
    badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
    templateTitle: 'High-Value Tender / RFQ Discovered on Field',
    templateBody: (orgName) => `Identified official tender/procurement requirement with ${orgName || 'client'}. Requires immediate spec review and bid preparation.`
  },
  {
    id: 'SAMPLE_REQUEST',
    label: 'Sample / Demo Delivery',
    defaultRecipientRole: 'MARKETING_MANAGER',
    defaultUrgency: 'NORMAL',
    icon: Package,
    badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
    templateTitle: 'Product Sample / Spec Sheet Request',
    templateBody: (orgName) => `${orgName || 'Client'} requested physical product sample and technical catalog for inspection before procurement board review.`
  },
  {
    id: 'CLIENT_OBJECTION',
    label: 'Competitor / Objection',
    defaultRecipientRole: 'SALES_MANAGER',
    defaultUrgency: 'HIGH' as MessageUrgency,
    icon: AlertTriangle,
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    templateTitle: 'Client Objection / Competitor Price Drop Alert',
    templateBody: (orgName) => `Key objection raised at ${orgName || 'client'}: Competitor offering alternative terms. Need guidance or counter-strategy.`
  },
  {
    id: 'ROUTE_DELAY',
    label: 'Route Delay / Traffic',
    defaultRecipientRole: 'MARKETING_MANAGER',
    defaultUrgency: 'NORMAL',
    icon: Clock,
    badgeColor: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30',
    templateTitle: 'Field Route & Schedule Delay Update',
    templateBody: (orgName) => `Running approx 30 minutes behind schedule at ${orgName || 'current location'} due to extended meeting/logistics. Adjusting subsequent planned stops.`
  },
  {
    id: 'FIELD_EMERGENCY',
    label: 'Field Escalation / Support',
    defaultRecipientRole: 'ALL',
    defaultUrgency: 'CRITICAL',
    icon: ShieldAlert,
    badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
    templateTitle: 'URGENT: Field Support / Escalation on Ground',
    templateBody: (orgName) => `Urgent managerial or operational assistance required immediately while at ${orgName || 'location'}.`
  },
  {
    id: 'DEAL_WON',
    label: 'Deal Won / Order Confirmed',
    defaultRecipientRole: 'CEO',
    defaultUrgency: 'HIGH' as MessageUrgency,
    icon: Sparkles,
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
    templateTitle: 'Commercial Deal Closed on Field',
    templateBody: (orgName) => `Successfully finalized agreement with ${orgName || 'client'}. Purchase order / contract confirmation in progress!`
  },
  {
    id: 'GENERAL',
    label: 'Direct Custom Message',
    defaultRecipientRole: 'MARKETING_MANAGER',
    defaultUrgency: 'NORMAL',
    icon: MessageSquare,
    badgeColor: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/30',
    templateTitle: 'Field Update',
    templateBody: (orgName) => `Field message regarding ${orgName || 'client operations'}: `
  }
];

export default function FieldSituationModal({
  currentLocation,
  linkedOrganization,
  onClose,
  onSuccess
}: FieldSituationModalProps) {
  const { appUser } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [teamUsers, setTeamUsers] = useState<AppUser[]>(() => getCachedTeamUsers());
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [selectedSituation, setSelectedSituation] = useState<MessageSituation>('PRICING_APPROVAL');
  const [targetType, setTargetType] = useState<'ROLE' | 'USER'>('ROLE');
  const [selectedRole, setSelectedRole] = useState<Role | 'ALL'>('SALES_MANAGER');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [urgency, setUrgency] = useState<MessageUrgency>('URGENT');
  const [title, setTitle] = useState<string>('Urgent Pricing & Quotation Approval Needed');
  const [body, setBody] = useState<string>(() => {
    const preset = SITUATION_PRESETS.find(p => p.id === 'PRICING_APPROVAL');
    return preset ? preset.templateBody(linkedOrganization?.name) : '';
  });

  // Load team users from Supabase or cache
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('name');
        
        if (!error && data && data.length > 0) {
          setTeamUsers(data as AppUser[]);
          cacheTeamUsers(data as AppUser[]);
        }
      } catch (err) {
        console.warn('Could not load online team members, using cached:', err);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, []);

  // Update template when situation preset changes
  const handleSelectSituation = (preset: SituationPreset) => {
    setSelectedSituation(preset.id);
    setSelectedRole(preset.defaultRecipientRole);
    setUrgency(preset.defaultUrgency);
    setTitle(preset.templateTitle);
    setBody(preset.templateBody(linkedOrganization?.name));
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) {
      setErrorMessage('Please type the situation details or message content.');
      return;
    }

    try {
      setSending(true);
      setErrorMessage(null);

      const targetUser = teamUsers.find(u => u.id === selectedUserId);
      const recipientName = targetType === 'USER' && targetUser 
        ? `${targetUser.name} (${targetUser.role.replace('_', ' ')})` 
        : `Role: ${selectedRole.replace('_', ' ')}`;

      const res = await sendSituationMessage({
        sender_id: appUser?.id || 'unknown_exec',
        sender_name: appUser?.name || 'Marketing Executive',
        sender_role: appUser?.role || 'MARKETING_EXECUTIVE',
        recipient_id: targetType === 'USER' ? selectedUserId : null,
        recipient_role: targetType === 'ROLE' ? selectedRole : (targetUser?.role || 'ALL'),
        recipient_name: recipientName,
        situation: selectedSituation,
        urgency,
        title: title.trim() || 'Field Situation Alert',
        body: body.trim(),
        organization_id: linkedOrganization?.id || undefined,
        organization_name: linkedOrganization?.name || undefined,
        latitude: currentLocation?.lat,
        longitude: currentLocation?.lng
      });

      setSentSuccess(true);
      if (onSuccess) {
        onSuccess(res.message, res.queuedOffline);
      }

      setTimeout(() => {
        onClose();
      }, 1400);

    } catch (err: any) {
      console.error('Error dispatching message:', err);
      setErrorMessage(err.message || 'Failed to dispatch message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div 
        className={cn(
          "w-full max-w-xl rounded-3xl border shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]",
          isDark ? "bg-[#15151C] border-[#2A2A38] text-white" : "bg-white border-slate-200 text-slate-900"
        )}
      >
        {/* Modal Header */}
        <div className={cn(
          "px-5 py-4 border-b flex items-center justify-between shrink-0",
          isDark ? "bg-[#1A1A24] border-[#2A2A38]" : "bg-blue-50/70 border-slate-100"
        )}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1848A0] text-white flex items-center justify-center shadow-md">
              <Radio className="w-5 h-5 animate-pulse text-[#F88020]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg tracking-tight">Field Situation Dispatch</h3>
                {!navigator.onLine && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-500 border border-amber-500/30">
                    <WifiOff className="w-3 h-3" /> Offline Queue
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                Direct portal broadcast to managers and team based on on-ground situation.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={cn(
              "p-2 rounded-xl border transition-all cursor-pointer",
              isDark ? "bg-[#222230] border-[#2E2E40] text-gray-400 hover:text-white" : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        {sentSuccess ? (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h4 className="text-xl font-extrabold text-emerald-500">
              {navigator.onLine ? 'Situation Dispatched to Portal!' : 'Saved to Offline Queue!'}
            </h4>
            <p className="text-sm text-gray-400 max-w-sm">
              {navigator.onLine 
                ? 'Your message has been sent directly to the targeted team members with your active client and GPS coordinates attached.'
                : 'Your message is safely stored in local device cache and will automatically dispatch as soon as network connectivity is restored.'
              }
            </p>
          </div>
        ) : (
          <form onSubmit={handleSend} className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
            {errorMessage && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* 1. Situation Quick Presets */}
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">
                1. Select Field Situation
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SITUATION_PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  const isSelected = selectedSituation === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectSituation(preset)}
                      className={cn(
                        "p-2.5 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer relative",
                        isSelected
                          ? isDark 
                            ? "bg-[#1848A0]/20 border-[#1848A0] text-white shadow-md ring-1 ring-[#1848A0]" 
                            : "bg-blue-50 border-[#1848A0] text-[#1848A0] font-bold shadow-xs ring-1 ring-[#1848A0]"
                          : isDark
                            ? "bg-[#1C1C26] border-[#2A2A38] text-gray-300 hover:bg-[#242432]"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <Icon className={cn("w-4 h-4", isSelected ? "text-[#F88020]" : "text-gray-400")} />
                        {isSelected && <span className="w-2 h-2 rounded-full bg-[#1848A0]" />}
                      </div>
                      <span className="text-[11px] font-bold leading-tight line-clamp-2">
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Recipient Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
                    2. Send To
                  </label>
                  <div className="flex items-center gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setTargetType('ROLE')}
                      className={cn(
                        "font-bold transition-colors cursor-pointer",
                        targetType === 'ROLE' ? "text-[#1848A0] dark:text-blue-400 underline" : "text-gray-400"
                      )}
                    >
                      By Role
                    </button>
                    <span className="text-gray-500">|</span>
                    <button
                      type="button"
                      onClick={() => setTargetType('USER')}
                      className={cn(
                        "font-bold transition-colors cursor-pointer",
                        targetType === 'USER' ? "text-[#1848A0] dark:text-blue-400 underline" : "text-gray-400"
                      )}
                    >
                      Specific Person
                    </button>
                  </div>
                </div>

                {targetType === 'ROLE' ? (
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as any)}
                    className={cn(
                      "w-full px-3 py-2.5 rounded-2xl border text-xs sm:text-sm font-semibold transition-colors outline-hidden",
                      isDark ? "bg-[#1C1C26] border-[#2A2A38] text-white focus:border-[#1848A0]" : "bg-slate-50 border-slate-200 text-slate-900 focus:border-[#1848A0]"
                    )}
                  >
                    <option value="MARKETING_MANAGER">Marketing Manager (Route & Team)</option>
                    <option value="SALES_MANAGER">Sales Manager (Quotes & Pricing)</option>
                    <option value="TENDER_OFFICER">Tender Officer (Bids & RFQ)</option>
                    <option value="SENIOR_MANAGER">Senior Management</option>
                    <option value="CEO">CEO (High-Value Escalations)</option>
                    <option value="ALL">Entire Field & Operations Team</option>
                  </select>
                ) : (
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className={cn(
                      "w-full px-3 py-2.5 rounded-2xl border text-xs sm:text-sm font-semibold transition-colors outline-hidden",
                      isDark ? "bg-[#1C1C26] border-[#2A2A38] text-white focus:border-[#1848A0]" : "bg-slate-50 border-slate-200 text-slate-900 focus:border-[#1848A0]"
                    )}
                  >
                    <option value="">Select Colleague...</option>
                    {teamUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role.replace('_', ' ')})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 3. Urgency Priority */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-gray-400 mb-1.5">
                  3. Urgency Level
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { val: 'NORMAL', label: 'Normal', color: 'text-slate-400 border-slate-500/30' },
                    { val: 'HIGH', label: 'High', color: 'text-amber-500 border-amber-500/40 bg-amber-500/10' },
                    { val: 'CRITICAL', label: 'Urgent', color: 'text-rose-500 border-rose-500/40 bg-rose-500/10' }
                  ].map(p => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setUrgency(p.val as MessageUrgency)}
                      className={cn(
                        "py-2 px-2 rounded-xl text-xs font-extrabold border transition-all text-center cursor-pointer",
                        urgency === p.val
                          ? isDark ? "bg-white/15 border-white text-white shadow-sm ring-1 ring-white/50" : "bg-slate-900 border-slate-900 text-white shadow-xs"
                          : isDark ? "bg-[#1C1C26] border-[#2A2A38] text-gray-400" : "bg-slate-50 border-slate-200 text-slate-600"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Context Attachment Preview */}
            <div className={cn(
              "p-2.5 rounded-2xl border flex flex-wrap items-center justify-between gap-2 text-[11px]",
              isDark ? "bg-[#191924] border-[#282836] text-gray-300" : "bg-slate-50 border-slate-200 text-slate-600"
            )}>
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#F88020]" />
                <span className="font-bold">Client Ref:</span>
                <span className="text-gray-400 truncate max-w-[160px]">
                  {linkedOrganization ? linkedOrganization.name : 'General Field Broadcast'}
                </span>
              </div>
              {currentLocation && (
                <div className="flex items-center gap-1.5 text-emerald-500 font-bold">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>GPS Tagged (±{currentLocation.accuracy}m)</span>
                </div>
              )}
            </div>

            {/* Subject Title */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
                  Subject / Title
                </label>
                <VoiceDictationButton
                  size="sm"
                  label="Speak"
                  onAppendText={(txt) => setTitle(prev => prev ? `${prev} ${txt}` : txt)}
                />
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief situation headline..."
                className={cn(
                  "w-full px-3.5 py-2.5 rounded-2xl border text-xs sm:text-sm font-semibold transition-colors outline-hidden",
                  isDark ? "bg-[#1C1C26] border-[#2A2A38] text-white focus:border-[#1848A0]" : "bg-slate-50 border-slate-200 text-slate-900 focus:border-[#1848A0]"
                )}
              />
            </div>

            {/* Message Body with Voice-to-Text */}
            <div>
              <VoiceNoteTextarea
                id="situation-details-field"
                label="Situation Details & Action Requested"
                required
                rows={3}
                value={body}
                onChange={setBody}
                placeholder="Speak or type situation details, client feedback, decision maker objections, or specific manager action requested..."
                helperText="Audio notes are transcribed in real time and attached with GPS coordinates."
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-gray-800/40">
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  "px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm border transition-all cursor-pointer",
                  isDark ? "bg-[#1F1F2C] border-[#2E2E40] text-gray-300 hover:bg-[#28283A]" : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                )}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className="bg-[#1848A0] hover:bg-[#003880] text-white px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Dispatching...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>{navigator.onLine ? 'Dispatch to Portal' : 'Queue Offline'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

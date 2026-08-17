import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  MapPin, 
  Clock, 
  Briefcase, 
  Calendar, 
  FileText, 
  Loader2, 
  AlertTriangle,
  Award,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import { FieldSession } from '../../types';
import VoiceNoteTextarea from './VoiceNoteTextarea';

interface EndFieldDayModalProps {
  session: FieldSession | null;
  durationFormatted: string;
  completedVisitsCount: number;
  totalVisitsCount: number;
  opportunitiesCount: number;
  onClose: () => void;
  onConfirmEnd: (notes: string) => Promise<void>;
}

export default function EndFieldDayModal({
  session,
  durationFormatted,
  completedVisitsCount,
  totalVisitsCount,
  opportunitiesCount,
  onClose,
  onConfirmEnd
}: EndFieldDayModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [closingNotes, setClosingNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onConfirmEnd(closingNotes.trim());
      onClose();
    } catch (err) {
      console.error('Error ending field day:', err);
    } finally {
      setLoading(false);
    }
  };

  const completionPct = totalVisitsCount > 0 ? Math.round((completedVisitsCount / totalVisitsCount) * 100) : 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className={cn(
        "w-full max-w-lg rounded-2xl shadow-2xl border flex flex-col my-auto overflow-hidden",
        isDark ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
      )}>
        {/* Header */}
        <div className={cn(
          "px-5 py-4 border-b flex items-center justify-between",
          isDark ? "border-[#2A2A35] bg-[#121217]" : "border-slate-100 bg-slate-50/70"
        )}>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h2 className={cn("text-base font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                End Active Field Day Session
              </h2>
              <p className="text-xs text-slate-400">
                Confirm day summary & stop GPS location tracking
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Day Metrics Summary Grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className={cn(
              "p-3 rounded-xl border text-center space-y-1",
              isDark ? "bg-[#0B0B0E] border-[#2A2A38]" : "bg-slate-50 border-slate-200"
            )}>
              <div className="text-[10px] uppercase font-bold text-slate-400">Time on Field</div>
              <div className="text-sm sm:text-base font-extrabold text-[#1848A0] dark:text-blue-400">
                {durationFormatted || '00:00:00'}
              </div>
            </div>

            <div className={cn(
              "p-3 rounded-xl border text-center space-y-1",
              isDark ? "bg-[#0B0B0E] border-[#2A2A38]" : "bg-slate-50 border-slate-200"
            )}>
              <div className="text-[10px] uppercase font-bold text-slate-400">Visits Done</div>
              <div className="text-sm sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                {completedVisitsCount} / {totalVisitsCount}
              </div>
            </div>

            <div className={cn(
              "p-3 rounded-xl border text-center space-y-1",
              isDark ? "bg-[#0B0B0E] border-[#2A2A38]" : "bg-slate-50 border-slate-200"
            )}>
              <div className="text-[10px] uppercase font-bold text-slate-400">Opportunities</div>
              <div className="text-sm sm:text-base font-extrabold text-[#F88020]">
                +{opportunitiesCount}
              </div>
            </div>
          </div>

          {/* Performance Milestone Pill */}
          <div className={cn(
            "p-3.5 rounded-xl border flex items-center gap-3",
            completionPct >= 80 
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" 
              : "bg-blue-500/10 border-blue-500/30 text-[#1848A0] dark:text-blue-400"
          )}>
            <TrendingUp className="w-5 h-5 shrink-0" />
            <div className="text-xs">
              <span className="font-extrabold block">
                {completionPct >= 100 ? '100% Target Met! Outstanding Day!' : `${completionPct}% Daily Plan Execution`}
              </span>
              <span className="opacity-80">
                All client interactions and GPS audit stamps are recorded in HIFI ONE.
              </span>
            </div>
          </div>

          {/* Closing Notes */}
          <div>
            <VoiceNoteTextarea
              id="end-day-debrief-notes"
              label="Daily Field Debrief & Executive Remarks"
              rows={3}
              value={closingNotes}
              onChange={setClosingNotes}
              placeholder="Dictate or type daily achievements, challenges, competitor intel, or managerial follow-ups..."
              helperText="Tap Voice-to-Text to quickly dictate your end-of-day summary while in transit."
              quickTags={[
                'All Planned Targets Met',
                'Follow-ups Scheduled',
                'Tender Submissions Prepared',
                'Need Technical Pricing Assistance',
                'High Conversion Day'
              ]}
            />
          </div>

          {/* Location Safety Notice */}
          <div className="p-3 rounded-xl bg-slate-500/10 border border-slate-500/20 text-slate-400 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>
              Per company privacy policy, GPS tracking terminates completely when this session is closed.
            </span>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t dark:border-[#252530] flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer",
                isDark ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
            >
              Cancel & Continue Session
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Closing Session...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  End Field Day & Submit
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

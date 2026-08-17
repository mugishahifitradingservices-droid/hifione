import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mic, 
  MicOff, 
  Copy, 
  Check, 
  Sparkles, 
  Trash2, 
  Radio, 
  Building2, 
  MapPin, 
  Save, 
  Clock,
  Volume2,
  FileText,
  Send,
  AlertCircle
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { LocationState } from '../../hooks/useFieldSession';
import { Organization, PlannedVisit } from '../../types';
import { cn } from '../../lib/utils';

export interface FieldVoiceMemo {
  id: string;
  text: string;
  timestamp: string;
  orgName?: string;
  location?: { lat: number; lng: number } | null;
  tags: string[];
}

interface QuickVoiceMemoModalProps {
  currentLocation: LocationState | null;
  organizations: Organization[];
  visits: PlannedVisit[];
  onClose: () => void;
  onSendToSituation?: (text: string, orgId?: string) => void;
  onAttachToVisit?: (text: string, visitId: string) => void;
}

const LOCAL_STORAGE_KEY = 'hifi_field_voice_memos_v1';

const MEMO_TAG_PRESETS = [
  'Procurement Intel',
  'Competitor Price',
  'Urgent Requirement',
  'Decision Maker Contact',
  'Sample Requested',
  'Follow-up Note'
];

export default function QuickVoiceMemoModal({
  currentLocation,
  organizations,
  visits,
  onClose,
  onSendToSituation,
  onAttachToVisit
}: QuickVoiceMemoModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [dictatedText, setDictatedText] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [savedMemos, setSavedMemos] = useState<FieldVoiceMemo[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const {
    isListening,
    interimTranscript,
    isSupported,
    error,
    startListening,
    stopListening
  } = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    onFinalResult: (text) => {
      setDictatedText(prev => prev ? `${prev} ${text}` : text);
    }
  });

  // Save to local storage whenever savedMemos updates
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(savedMemos));
    } catch (err) {
      console.error('Failed to store voice memos:', err);
    }
  }, [savedMemos]);

  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleCopy = () => {
    const fullText = dictatedText + (interimTranscript ? ` ${interimTranscript}` : '');
    if (!fullText) return;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveMemo = () => {
    const textToSave = (dictatedText + (interimTranscript ? ` ${interimTranscript}` : '')).trim();
    if (!textToSave) return;

    const org = organizations.find(o => o.id === selectedOrgId);
    const newMemo: FieldVoiceMemo = {
      id: `memo_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      text: textToSave,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      orgName: org ? org.name : undefined,
      location: currentLocation ? { lat: currentLocation.lat, lng: currentLocation.lng } : null,
      tags: selectedTags
    };

    setSavedMemos(prev => [newMemo, ...prev]);
    setDictatedText('');
    setSelectedTags([]);
  };

  const handleDeleteMemo = (id: string) => {
    setSavedMemos(prev => prev.filter(m => m.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className={cn(
        "w-full max-w-lg rounded-3xl shadow-2xl border flex flex-col my-auto overflow-hidden",
        isDark ? "bg-[#15151F] border-[#2B2B3E]" : "bg-white border-slate-200"
      )}>
        {/* Header */}
        <div className={cn(
          "px-5 py-4 border-b flex items-center justify-between",
          isDark ? "border-[#2A2A38] bg-[#12121A]" : "border-slate-100 bg-slate-50/70"
        )}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1848A0] text-white flex items-center justify-center font-bold shadow-md">
              <Mic className="w-5 h-5 animate-pulse text-[#F88020]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className={cn("text-base sm:text-lg font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                  Voice Dictation & Field Memos
                </h2>
                <span className="bg-[#1848A0]/20 text-[#1848A0] dark:text-blue-400 border border-[#1848A0]/30 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                  Speech AI
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Dictate site notes hands-free immediately after leaving client premises
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
              if (isListening) stopListening();
              onClose();
            }} 
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Support error check */}
          {!isSupported && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Voice recognition is not fully supported in this browser. You can still type notes or use Google Chrome / Safari.</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Speech Recognition Error: {error}</span>
            </div>
          )}

          {/* Master Voice Recording Action Banner */}
          <div className={cn(
            "p-5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center relative overflow-hidden",
            isListening 
              ? "bg-rose-950/20 border-rose-500/50 text-rose-300 ring-2 ring-rose-500/30" 
              : isDark ? "bg-[#0E0E15] border-[#242432]" : "bg-slate-50 border-slate-200"
          )}>
            {/* Pulsing visualizer when recording */}
            {isListening && (
              <div className="absolute inset-0 bg-rose-500/5 pointer-events-none animate-pulse" />
            )}

            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-95 cursor-pointer relative z-10",
                isListening
                  ? "bg-rose-600 text-white animate-bounce ring-8 ring-rose-500/20"
                  : "bg-gradient-to-tr from-[#1848A0] to-[#2563EB] hover:from-[#143B85] hover:to-[#1D4ED8] text-white"
              )}
            >
              {isListening ? (
                <MicOff className="w-9 h-9 animate-pulse" />
              ) : (
                <Mic className="w-9 h-9" />
              )}
            </button>

            <div className="mt-3 relative z-10">
              <span className={cn(
                "text-xs font-black uppercase tracking-wider block",
                isListening ? "text-rose-400" : isDark ? "text-slate-200" : "text-slate-800"
              )}>
                {isListening ? 'Listening & Transcribing Live... (Tap to Pause)' : 'Tap Microphone to Start Dictating'}
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Speak clearly in English. Punctuation commands: &quot;period&quot;, &quot;comma&quot;, &quot;new line&quot;.
              </p>
            </div>
          </div>

          {/* Quick Tags Bar */}
          <div>
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
              Quick Intel Tags:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {MEMO_TAG_PRESETS.map(tag => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleToggleTag(tag)}
                    className={cn(
                      "px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer",
                      active
                        ? "bg-[#1848A0] border-[#1848A0] text-white shadow-xs"
                        : isDark
                          ? "bg-[#1A1A26] border-[#29293B] text-slate-400 hover:text-slate-200"
                          : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                    )}
                  >
                    {active ? '✓ ' : '+ '}{tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Client Association */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
              Link to Client / Organization (Optional)
            </label>
            <div className="relative">
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className={cn(
                  "w-full px-3.5 py-2.5 rounded-xl border text-xs font-semibold appearance-none transition-colors",
                  isDark ? "bg-[#1C1C26] border-[#2A2A38] text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                )}
              >
                <option value="">-- General Field Note (No Client) --</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.district || org.sector || 'Kigali'})
                  </option>
                ))}
              </select>
              <Building2 className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Live Transcript / Editor Area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Dictated Transcript
              </label>
              <div className="flex items-center gap-2">
                {(dictatedText || interimTranscript) && (
                  <>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className={cn(
                        "text-[11px] font-bold px-2 py-0.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer",
                        copied 
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" 
                          : "text-slate-400 hover:text-white border-slate-700"
                      )}
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDictatedText('');
                      }}
                      className="text-[11px] font-bold px-2 py-0.5 rounded-lg text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:bg-rose-500/10 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className={cn(
              "w-full p-3.5 rounded-2xl border text-xs sm:text-sm transition-all min-h-[100px] max-h-[180px] overflow-y-auto font-medium",
              isDark ? "bg-[#0E0E15] border-[#262638] text-white" : "bg-slate-50 border-slate-200 text-slate-900"
            )}>
              {dictatedText ? (
                <span>{dictatedText}</span>
              ) : null}
              {interimTranscript ? (
                <span className="text-emerald-500 dark:text-emerald-400 italic">
                  {dictatedText ? ' ' : ''}{interimTranscript}
                </span>
              ) : null}
              {!dictatedText && !interimTranscript && (
                <span className="text-slate-400 italic">
                  Transcribed voice notes will stream here in real-time as you speak...
                </span>
              )}
            </div>
          </div>

          {/* Quick Actions (Save Note, Dispatch to Situation, Attach) */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t dark:border-[#262638] border-slate-100">
            <button
              type="button"
              onClick={handleSaveMemo}
              disabled={!dictatedText.trim() && !interimTranscript.trim()}
              className="flex-1 py-2.5 px-3 rounded-xl bg-[#1848A0] hover:bg-[#143B85] text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Voice Memo</span>
            </button>

            {onSendToSituation && (
              <button
                type="button"
                onClick={() => {
                  const txt = (dictatedText + (interimTranscript ? ` ${interimTranscript}` : '')).trim();
                  if (!txt) return;
                  if (isListening) stopListening();
                  onSendToSituation(txt, selectedOrgId);
                  onClose();
                }}
                disabled={!dictatedText.trim() && !interimTranscript.trim()}
                className="py-2.5 px-3 rounded-xl bg-[#F88020] hover:bg-[#E07018] text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Send as urgent situation alert to HQ"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Send Alert</span>
              </button>
            )}
          </div>

          {/* Saved Voice Memos Section */}
          {savedMemos.length > 0 && (
            <div className="pt-3 border-t dark:border-[#262638] border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Today&apos;s Field Voice Memos ({savedMemos.length})
                </span>
                <button
                  type="button"
                  onClick={() => setSavedMemos([])}
                  className="text-[10px] text-slate-400 hover:text-rose-400 cursor-pointer"
                >
                  Clear All
                </button>
              </div>

              <div className="space-y-2 max-h-[160px] overflow-y-auto">
                {savedMemos.map(memo => (
                  <div
                    key={memo.id}
                    className={cn(
                      "p-3 rounded-xl border text-xs transition-all space-y-1.5 relative group",
                      isDark ? "bg-[#181824] border-[#252535] text-slate-200" : "bg-slate-100 border-slate-200 text-slate-800"
                    )}
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Clock className="w-3 h-3 text-[#1848A0]" />
                        <span>{memo.timestamp}</span>
                        {memo.orgName && (
                          <>
                            <span>•</span>
                            <span className="text-[#F88020] truncate max-w-[140px]">{memo.orgName}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(memo.text);
                          }}
                          className="text-slate-400 hover:text-white cursor-pointer"
                          title="Copy text"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMemo(memo.id)}
                          className="text-slate-400 hover:text-rose-400 cursor-pointer"
                          title="Delete memo"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs font-medium line-clamp-3">
                      {memo.text}
                    </p>

                    {memo.tags && memo.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {memo.tags.map(t => (
                          <span
                            key={t}
                            className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-[#1848A0]/15 text-[#1848A0] dark:text-blue-300"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

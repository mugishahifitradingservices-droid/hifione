import React, { useState, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Sparkles, 
  Info, 
  Trash2, 
  Volume2, 
  Globe, 
  Check, 
  AlertCircle,
  HelpCircle,
  CornerDownLeft
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';

export interface VoiceNoteTextareaProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  quickTags?: string[];
  helperText?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

const SUPPORTED_LANGUAGES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'en-RW', label: 'English (East Africa)' },
  { code: 'fr-FR', label: 'Français (French)' }
];

export default function VoiceNoteTextarea({
  label,
  value,
  onChange,
  placeholder = 'Speak or type visit notes, meeting discussion, and client requirements...',
  rows = 3,
  required = false,
  quickTags,
  helperText,
  className,
  disabled = false,
  id
}: VoiceNoteTextareaProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleAppendVoiceText = (spokenText: string) => {
    if (!spokenText.trim()) return;

    const trimmed = (value || '').trim();
    let updated = '';
    if (!trimmed) {
      updated = spokenText.trim();
    } else {
      const lastChar = trimmed.slice(-1);
      if (['.', '!', '?', '\n', ';', ':'].includes(lastChar)) {
        updated = `${trimmed} ${spokenText.trim()}`;
      } else {
        updated = `${trimmed}. ${spokenText.trim()}`;
      }
    }
    onChange(updated);
  };

  const {
    isListening,
    isSupported,
    interimTranscript,
    error,
    selectedLanguage,
    toggleListening,
    changeLanguage,
    clearError
  } = useSpeechRecognition({
    language: 'en-US',
    onFinalResult: (text) => {
      handleAppendVoiceText(text);
    }
  });

  const handleAddTag = (tag: string) => {
    if (value.includes(tag)) return;
    onChange(value ? `${value.trim()} • ${tag}` : tag);
  };

  const handleClear = () => {
    if (confirm('Clear all written notes in this field?')) {
      onChange('');
    }
  };

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Top Header: Label & Voice Actions */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {label && (
          <label 
            htmlFor={id} 
            className={cn("block text-xs font-bold uppercase tracking-wider", isDark ? "text-slate-300" : "text-slate-700")}
          >
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
        )}

        {/* Voice Dictation Control Bar */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Main 1-Tap Mic Button */}
          <button
            type="button"
            onClick={() => toggleListening()}
            disabled={disabled}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95",
              isListening
                ? "bg-rose-500 hover:bg-rose-600 text-white animate-pulse shadow-md ring-2 ring-rose-400/50"
                : isDark
                  ? "bg-[#1C1C26] hover:bg-[#252535] text-slate-200 border border-[#2D2D3E]"
                  : "bg-blue-50 hover:bg-blue-100 text-[#1848A0] border border-blue-200"
            )}
            title={isListening ? "Tap to Stop Voice Dictation" : "Tap to Speak Notes"}
          >
            {isListening ? (
              <>
                <div className="flex items-center gap-0.5">
                  <span className="w-1 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-4 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span>Dictating... (Tap to Stop)</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5 text-[#F88020]" />
                <span>Voice-to-Text</span>
              </>
            )}
          </button>

          {/* Language Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowLangMenu(!showLangMenu)}
              className={cn(
                "p-1.5 rounded-xl border text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer",
                isDark ? "bg-[#181824] border-[#2B2B3D] text-slate-300 hover:text-white" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
              )}
              title="Select Voice Language"
            >
              <Globe className="w-3 h-3 text-[#1848A0]" />
              <span className="uppercase">{selectedLanguage.split('-')[0]}</span>
            </button>

            {showLangMenu && (
              <div className={cn(
                "absolute right-0 top-full mt-1.5 w-44 rounded-2xl shadow-xl border p-1.5 z-40 animate-in fade-in zoom-in-95",
                isDark ? "bg-[#14141B] border-[#2A2A38]" : "bg-white border-slate-200"
              )}>
                <div className="text-[9px] font-extrabold uppercase px-2 py-1 text-slate-400">
                  Voice Language
                </div>
                {SUPPORTED_LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      changeLanguage(lang.code);
                      setShowLangMenu(false);
                    }}
                    className={cn(
                      "w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer",
                      selectedLanguage === lang.code
                        ? "bg-[#1848A0] text-white font-bold"
                        : isDark ? "text-slate-300 hover:bg-[#1E1E28]" : "text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <span>{lang.label}</span>
                    {selectedLanguage === lang.code && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Voice Command Tips Toggle */}
          <button
            type="button"
            onClick={() => setShowTips(!showTips)}
            className={cn(
              "p-1.5 rounded-xl border text-[11px] transition-all cursor-pointer",
              showTips
                ? "bg-[#1848A0] text-white border-[#1848A0]"
                : isDark ? "bg-[#181824] border-[#2B2B3D] text-slate-400 hover:text-slate-200" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
            )}
            title="Voice Command Tips"
          >
            <Sparkles className="w-3 h-3 text-[#F88020]" />
          </button>

          {/* Clear Text Action */}
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className={cn(
                "p-1.5 rounded-xl border text-[11px] transition-all cursor-pointer text-slate-400 hover:text-rose-500",
                isDark ? "bg-[#181824] border-[#2B2B3D]" : "bg-slate-50 border-slate-200"
              )}
              title="Clear text"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Voice Tips Box */}
      {showTips && (
        <div className={cn(
          "p-2.5 rounded-2xl border text-xs space-y-1.5 animate-in fade-in duration-200",
          isDark ? "bg-[#181824] border-[#2A2A38] text-slate-300" : "bg-blue-50/80 border-blue-200 text-blue-950"
        )}>
          <div className="font-extrabold flex items-center justify-between text-xs text-[#1848A0] dark:text-blue-400">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#F88020]" />
              Voice Dictation Tips for Field Visits:
            </span>
            <button
              type="button"
              onClick={() => setShowTips(false)}
              className="text-slate-400 hover:text-slate-200 text-[11px] font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] opacity-90">
            <span>• Say <b>"period"</b> or <b>"full stop"</b> for <b>.</b></span>
            <span>• Say <b>"comma"</b> for <b>,</b></span>
            <span>• Say <b>"new line"</b> for line breaks</span>
            <span>• Say <b>"bullet"</b> for • list items</span>
          </div>
        </div>
      )}

      {/* Quick Tags (1-Tap Chips) */}
      {quickTags && quickTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {quickTags.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => handleAddTag(tag)}
              className={cn(
                "px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-all cursor-pointer active:scale-95",
                value.includes(tag)
                  ? "bg-[#1848A0]/15 border-[#1848A0] text-[#1848A0] dark:text-blue-300 font-bold"
                  : isDark 
                    ? "bg-[#0B0B0E] border-[#2A2A38] text-slate-400 hover:border-slate-600 hover:text-white" 
                    : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              )}
            >
              + {tag}
            </button>
          ))}
        </div>
      )}

      {/* Live Voice Recording Status HUD */}
      {isListening && (
        <div className={cn(
          "px-3.5 py-2.5 rounded-2xl border flex items-center justify-between gap-3 shadow-md animate-in slide-in-from-top duration-200",
          isDark ? "bg-[#1E1218] border-rose-500/40 text-rose-200" : "bg-rose-50 border-rose-200 text-rose-900"
        )}>
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
            </span>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-500 block">
                Dictating Live ({selectedLanguage.split('-')[0].toUpperCase()}):
              </span>
              <p className="text-xs font-semibold italic truncate">
                {interimTranscript ? `"${interimTranscript}"` : 'Listening... Speak your observations naturally'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => toggleListening()}
            className="px-3 py-1 rounded-xl bg-rose-500 text-white text-xs font-black shrink-0 hover:bg-rose-600 transition-colors cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      )}

      {/* Textarea Input */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          id={id}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={cn(
            "w-full px-3.5 py-2.5 rounded-2xl border text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#1848A0] leading-relaxed resize-y",
            isListening && "border-rose-400 ring-1 ring-rose-400",
            isDark 
              ? "bg-[#0B0B0E] border-[#2A2A38] text-white placeholder-gray-500" 
              : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
          )}
        />
      </div>

      {/* Footer Info: Word count & helper text */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
        <div>
          {helperText && <span>{helperText}</span>}
        </div>
        <div className="flex items-center gap-2 font-mono">
          <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
          <span>•</span>
          <span>{value.length} chars</span>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-start justify-between gap-2">
          <div className="flex items-start gap-1.5 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="text-[11px] font-medium leading-tight">{error}</span>
          </div>
          <button
            type="button"
            onClick={clearError}
            className="text-rose-400 hover:text-rose-200 text-xs font-bold shrink-0 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

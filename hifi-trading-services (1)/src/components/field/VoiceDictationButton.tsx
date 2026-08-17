import React, { useState } from 'react';
import { 
  Mic, 
  MicOff, 
  Loader2, 
  Volume2, 
  Globe, 
  Check, 
  AlertCircle,
  Sparkles,
  Info
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';

export interface VoiceDictationButtonProps {
  onAppendText: (dictatedText: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLanguageSelector?: boolean;
  label?: string;
}

const SUPPORTED_LANGUAGES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'en-RW', label: 'English (East Africa)' },
  { code: 'fr-FR', label: 'Français (French)' }
];

export default function VoiceDictationButton({
  onAppendText,
  className,
  size = 'md',
  showLanguageSelector = false,
  label = 'Voice Dictation'
}: VoiceDictationButtonProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showTips, setShowTips] = useState(false);

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
      if (text) {
        onAppendText(text);
      }
    }
  });

  return (
    <div className={cn("inline-flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Main 1-Tap Dictation Trigger */}
        <button
          type="button"
          onClick={() => toggleListening()}
          className={cn(
            "rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs active:scale-95",
            size === 'sm' ? "px-2.5 py-1 text-[11px]" : size === 'lg' ? "px-4 py-2.5 text-sm" : "px-3 py-1.5 text-xs",
            isListening
              ? "bg-rose-500 hover:bg-rose-600 text-white animate-pulse shadow-md ring-2 ring-rose-400/50"
              : isDark
                ? "bg-[#1C1C26] hover:bg-[#252535] text-slate-200 border border-[#2D2D3E]"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
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
              <span className="font-black">Recording... (Tap to Stop)</span>
            </>
          ) : (
            <>
              <Mic className={cn("text-[#F88020]", size === 'sm' ? "w-3.5 h-3.5" : "w-4 h-4")} />
              <span>{label}</span>
            </>
          )}
        </button>

        {/* Language Selector Dropdown (Optional) */}
        {showLanguageSelector && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowLangMenu(!showLangMenu)}
              className={cn(
                "p-1.5 rounded-xl border text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer",
                isDark ? "bg-[#181824] border-[#2B2B3D] text-slate-300 hover:text-white" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
              )}
              title="Change Voice Recognition Language"
            >
              <Globe className="w-3.5 h-3.5 text-[#1848A0]" />
              <span className="text-[10px] uppercase font-bold">{selectedLanguage.split('-')[0]}</span>
            </button>

            {showLangMenu && (
              <div className={cn(
                "absolute right-0 top-full mt-1.5 w-44 rounded-2xl shadow-xl border p-1.5 z-40 animate-in fade-in zoom-in-95",
                isDark ? "bg-[#14141B] border-[#2A2A38]" : "bg-white border-slate-200"
              )}>
                <div className="text-[10px] font-extrabold uppercase px-2 py-1 text-slate-400">
                  Select Language
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
        )}

        {/* Voice Tips Info Tooltip */}
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
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Voice Commands Guide Panel */}
      {showTips && (
        <div className={cn(
          "p-2.5 rounded-xl border text-[11px] space-y-1 animate-in fade-in duration-200",
          isDark ? "bg-[#181824] border-[#2A2A38] text-slate-300" : "bg-blue-50/70 border-blue-200 text-blue-900"
        )}>
          <div className="font-bold flex items-center gap-1.5 text-xs text-[#1848A0] dark:text-blue-400">
            <Sparkles className="w-3.5 h-3.5 text-[#F88020]" />
            <span>Voice Command Shortcuts:</span>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10.5px]">
            <span>• Say <b>"period"</b> for <b>.</b></span>
            <span>• Say <b>"comma"</b> for <b>,</b></span>
            <span>• Say <b>"new line"</b> for line break</span>
            <span>• Say <b>"bullet"</b> for • list items</span>
          </div>
        </div>
      )}

      {/* Active Listening / Interim Wave Bar */}
      {isListening && (
        <div className={cn(
          "px-3 py-2 rounded-xl border flex items-center gap-2 text-xs font-medium animate-in fade-in duration-200",
          isDark ? "bg-[#1A1A24] border-rose-500/30 text-rose-300" : "bg-rose-50 border-rose-200 text-rose-800"
        )}>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider block">
              Listening live:
            </span>
            <p className="italic text-xs truncate">
              {interimTranscript ? `"${interimTranscript}"` : 'Speak clearly into your phone or headset...'}
            </p>
          </div>
        </div>
      )}

      {/* Error Alert Bar */}
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

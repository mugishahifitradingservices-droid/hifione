import React, { useState } from 'react';
import { 
  X, 
  MessageSquare, 
  Send, 
  Clock, 
  Building2, 
  MapPin, 
  User, 
  AlertTriangle, 
  DollarSign, 
  FileCheck2, 
  Package, 
  ShieldAlert, 
  Sparkles,
  WifiOff,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import { InternalMessage, MessageSituation } from '../../types';
import { useOfflineSync } from '../../hooks/useOfflineSync';

interface FieldMessagesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNewMessage: () => void;
}

export default function FieldMessagesDrawer({
  isOpen,
  onClose,
  onOpenNewMessage
}: FieldMessagesDrawerProps) {
  const { appUser } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const { cachedMessages, isOnline } = useOfflineSync();
  const [filter, setFilter] = useState<'ALL' | 'URGENT' | 'MINE'>('ALL');

  if (!isOpen) return null;

  const filteredMessages = cachedMessages.filter(msg => {
    if (filter === 'URGENT') return msg.urgency === 'URGENT' || msg.urgency === 'CRITICAL';
    if (filter === 'MINE') return msg.sender_id === appUser?.id;
    return true;
  });

  const getSituationIcon = (situation: MessageSituation) => {
    switch (situation) {
      case 'PRICING_APPROVAL':
        return <DollarSign className="w-4 h-4 text-emerald-500" />;
      case 'TENDER_ALERT':
        return <FileCheck2 className="w-4 h-4 text-indigo-500" />;
      case 'SAMPLE_REQUEST':
        return <Package className="w-4 h-4 text-blue-500" />;
      case 'CLIENT_OBJECTION':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'ROUTE_DELAY':
        return <Clock className="w-4 h-4 text-slate-400" />;
      case 'FIELD_EMERGENCY':
        return <ShieldAlert className="w-4 h-4 text-rose-500" />;
      case 'DEAL_WON':
        return <Sparkles className="w-4 h-4 text-purple-500" />;
      default:
        return <MessageSquare className="w-4 h-4 text-[#1848A0]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className={cn(
          "w-full max-w-md h-full shadow-2xl border-l flex flex-col transition-all duration-300 animate-in slide-in-from-right duration-200",
          isDark ? "bg-[#14141B] border-[#22222E] text-white" : "bg-white border-slate-200 text-slate-900"
        )}
      >
        {/* Header */}
        <div className={cn(
          "p-4 px-5 border-b flex items-center justify-between shrink-0",
          isDark ? "bg-[#181822] border-[#242432]" : "bg-slate-50 border-slate-200"
        )}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1848A0] text-white flex items-center justify-center font-bold shadow-xs">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base leading-tight">
                Field Situation Messages
              </h3>
              <p className="text-[11px] text-gray-400">
                Direct portal dispatch history & communications
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

        {/* Filter and New Message Bar */}
        <div className={cn(
          "p-3.5 border-b flex items-center justify-between gap-2 shrink-0",
          isDark ? "bg-[#191924] border-[#252535]" : "bg-blue-50/50 border-blue-100"
        )}>
          <div className="flex items-center gap-1.5">
            {[
              { key: 'ALL', label: 'All' },
              { key: 'URGENT', label: 'Urgent' },
              { key: 'MINE', label: 'My Dispatches' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as any)}
                className={cn(
                  "px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer",
                  filter === tab.key
                    ? isDark ? "bg-white/20 text-white" : "bg-[#1848A0] text-white"
                    : isDark ? "text-gray-400 hover:text-gray-200" : "text-slate-600 hover:text-slate-900"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              onClose();
              onOpenNewMessage();
            }}
            className="bg-[#F88020] hover:bg-[#E07018] text-white px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>New Dispatch</span>
          </button>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredMessages.length === 0 ? (
            <div className="text-center py-14 px-4 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-[#1848A0] flex items-center justify-center mx-auto">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h4 className="font-extrabold text-sm">No Situation Messages</h4>
              <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
                Send a quick situation alert from the field for pricing approvals, tender discoveries, or route adjustments.
              </p>
              <button
                onClick={() => {
                  onClose();
                  onOpenNewMessage();
                }}
                className="bg-[#1848A0] hover:bg-[#003880] text-white px-4 py-2 rounded-2xl font-bold text-xs inline-flex items-center gap-1.5 shadow-md mt-2 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send First Dispatch</span>
              </button>
            </div>
          ) : (
            filteredMessages.map((msg) => {
              const Icon = getSituationIcon(msg.situation);
              const isUrgent = msg.urgency === 'URGENT' || msg.urgency === 'CRITICAL';
              const isQueued = msg.status === 'QUEUED_OFFLINE';

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "p-3.5 rounded-2xl border transition-all space-y-2 relative overflow-hidden",
                    isDark 
                      ? isUrgent ? "bg-rose-500/5 border-rose-500/30" : "bg-[#1B1B26] border-[#272738]"
                      : isUrgent ? "bg-rose-50/50 border-rose-200" : "bg-slate-50 border-slate-200"
                  )}
                >
                  {/* Top line: Situation Tag, Urgency & Timestamp */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {Icon}
                      <span className="text-xs font-extrabold tracking-tight">
                        {msg.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isQueued && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                          <WifiOff className="w-2.5 h-2.5" /> Offline
                        </span>
                      )}
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase",
                        msg.urgency === 'CRITICAL' ? "bg-rose-500 text-white" :
                        msg.urgency === 'URGENT' ? "bg-amber-500 text-white" :
                        "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      )}>
                        {msg.urgency}
                      </span>
                    </div>
                  </div>

                  {/* Body text */}
                  <p className="text-xs leading-relaxed font-normal text-gray-300 dark:text-gray-300 text-slate-700">
                    {msg.body}
                  </p>

                  {/* Context chips */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-800/30 text-[10px] text-gray-400">
                    {msg.organization_name && (
                      <span className="flex items-center gap-1 font-semibold text-blue-400">
                        <Building2 className="w-3 h-3" />
                        <span className="truncate max-w-[130px]">{msg.organization_name}</span>
                      </span>
                    )}

                    {msg.recipient_name && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-[#F88020]" />
                        <span>To: {msg.recipient_name}</span>
                      </span>
                    )}

                    <span className="ml-auto text-[9px] text-gray-400">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

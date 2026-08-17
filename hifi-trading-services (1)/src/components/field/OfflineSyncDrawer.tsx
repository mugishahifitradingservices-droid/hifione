import React, { useState } from 'react';
import { 
  X, 
  RefreshCw, 
  Cloud, 
  CloudOff, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Loader2, 
  Clock, 
  MapPin, 
  Briefcase, 
  Building2, 
  MessageSquare, 
  Send,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { OfflineAction } from '../../types';

interface OfflineSyncDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OfflineSyncDrawer({
  isOpen,
  onClose
}: OfflineSyncDrawerProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const {
    isOnline,
    isSyncing,
    queue,
    pendingCount,
    failedCount,
    lastSyncTime,
    syncNow,
    removeAction,
    clearCompleted,
    clearAll
  } = useOfflineSync();

  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleManualSync = async () => {
    setSyncFeedback(null);
    const result = await syncNow();
    if (result.synced > 0 && result.failed === 0) {
      setSyncFeedback(`Successfully synchronized ${result.synced} items to HIFI ONE cloud.`);
    } else if (result.failed > 0) {
      setSyncFeedback(`Synchronized ${result.synced} items. ${result.failed} items require attention.`);
    } else {
      setSyncFeedback(isOnline ? 'All items are already in sync.' : 'Device is offline. Connect to internet to sync.');
    }
  };

  const getActionIcon = (action: OfflineAction) => {
    switch (action.type) {
      case 'LOG_VISIT':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'CREATE_OPPORTUNITY':
        return <Briefcase className="w-4 h-4 text-amber-500" />;
      case 'CREATE_ORGANIZATION':
        return <Building2 className="w-4 h-4 text-blue-500" />;
      case 'SEND_MESSAGE':
        return <MessageSquare className="w-4 h-4 text-indigo-500" />;
      case 'START_SESSION':
      case 'END_SESSION':
        return <Clock className="w-4 h-4 text-purple-500" />;
      default:
        return <MapPin className="w-4 h-4 text-gray-400" />;
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
            <div className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-xs",
              isOnline ? "bg-emerald-600" : "bg-amber-600"
            )}>
              {isOnline ? <Cloud className="w-5 h-5" /> : <CloudOff className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base leading-tight">
                Offline Queue & Sync
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-gray-400">
                <span className="flex items-center gap-1 font-semibold">
                  <span className={cn("w-2 h-2 rounded-full", isOnline ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
                  {isOnline ? 'Online (Cloud Connected)' : 'Offline (Local Storage Active)'}
                </span>
              </div>
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

        {/* Sync Action Control Bar */}
        <div className={cn(
          "p-4 border-b space-y-3 shrink-0",
          isDark ? "bg-[#191924] border-[#252535]" : "bg-blue-50/50 border-blue-100"
        )}>
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-gray-400">Pending Sync Items:</span>
            <span className="font-extrabold px-2.5 py-0.5 rounded-full text-xs bg-[#1848A0] text-white">
              {pendingCount}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleManualSync}
              disabled={isSyncing || !isOnline}
              className="flex-1 bg-[#1848A0] hover:bg-[#003880] text-white py-2.5 px-4 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synchronizing...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Sync Now {pendingCount > 0 ? `(${pendingCount})` : ''}</span>
                </>
              )}
            </button>

            {queue.some(q => q.status === 'SYNCED') && (
              <button
                onClick={clearCompleted}
                className={cn(
                  "p-2.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer",
                  isDark ? "bg-[#222230] border-[#2E2E40] text-gray-300 hover:bg-[#2A2A3C]" : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                )}
                title="Clear Synced Items"
              >
                Clear Synced
              </button>
            )}
          </div>

          {syncFeedback && (
            <p className="text-[11px] font-semibold text-[#1848A0] dark:text-blue-400 animate-in fade-in">
              {syncFeedback}
            </p>
          )}

          {lastSyncTime && (
            <p className="text-[10px] text-gray-400">
              Last synced: {new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          )}
        </div>

        {/* Queue List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {queue.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-extrabold text-sm">All Field Data Synchronized</h4>
              <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
                When you make visits, log opportunities, or dispatch situation alerts with weak network, they will appear here and sync automatically.
              </p>
            </div>
          ) : (
            queue.map((action) => {
              const Icon = getActionIcon(action);
              const isPending = action.status === 'PENDING';
              const isFailed = action.status === 'FAILED';
              const isSynced = action.status === 'SYNCED';
              const isSyncInProgress = action.status === 'SYNCING';

              return (
                <div
                  key={action.id}
                  className={cn(
                    "p-3 rounded-2xl border transition-all space-y-1.5",
                    isDark 
                      ? isFailed ? "bg-rose-500/10 border-rose-500/30" : isSynced ? "bg-emerald-500/5 border-emerald-500/20" : "bg-[#1B1B26] border-[#272738]"
                      : isFailed ? "bg-rose-50 border-rose-200" : isSynced ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {Icon}
                      <span className="text-xs font-extrabold truncate">
                        {action.summaryText}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isSyncInProgress && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-blue-500">
                          <Loader2 className="w-3 h-3 animate-spin" /> Syncing
                        </span>
                      )}
                      {isPending && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-500">
                          Queued
                        </span>
                      )}
                      {isFailed && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/10 text-rose-500">
                          Failed
                        </span>
                      )}
                      {isSynced && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-500">
                          Synced
                        </span>
                      )}

                      <button
                        onClick={() => removeAction(action.id)}
                        className="text-gray-400 hover:text-rose-500 p-1 rounded-lg transition-colors cursor-pointer"
                        title="Remove from queue"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-gray-400">
                    <span>{new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="font-mono uppercase">{action.type.replace('_', ' ')}</span>
                  </div>

                  {action.lastError && (
                    <p className="text-[10px] text-rose-400 font-semibold bg-rose-500/5 p-1.5 rounded-lg">
                      Notice: {action.lastError}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className={cn(
          "p-3.5 px-5 border-t text-[11px] flex items-center justify-between text-gray-400 shrink-0",
          isDark ? "bg-[#181822] border-[#242432]" : "bg-slate-50 border-slate-200"
        )}>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#1848A0]" />
            <span>Local Encrypted Cache Active</span>
          </div>
          {queue.length > 0 && (
            <button
              onClick={clearAll}
              className="text-gray-400 hover:text-rose-500 transition-colors font-bold cursor-pointer"
            >
              Clear All
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

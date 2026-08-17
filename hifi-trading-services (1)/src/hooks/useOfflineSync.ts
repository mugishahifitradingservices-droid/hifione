import { useState, useEffect, useCallback } from 'react';
import { 
  getOfflineQueue, 
  syncAllPendingActions, 
  removeOfflineAction, 
  clearCompletedActions, 
  clearAllActions, 
  getCachedInternalMessages, 
  OFFLINE_EVENTS, 
  STORAGE_KEYS,
  SyncResult 
} from '../lib/offlineSync';
import { OfflineAction, InternalMessage } from '../types';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [queue, setQueue] = useState<OfflineAction[]>(() => getOfflineQueue());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => localStorage.getItem(STORAGE_KEYS.LAST_SYNC));
  const [cachedMessages, setCachedMessages] = useState<InternalMessage[]>(() => getCachedInternalMessages());

  // Listen to browser online / offline network events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-trigger sync when returning online
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Also periodic ping check for flaky connections
    const pingInterval = setInterval(() => {
      if (navigator.onLine !== isOnline) {
        setIsOnline(navigator.onLine);
      }
    }, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(pingInterval);
    };
  }, [isOnline]);

  // Listen to queue changes & message broadcasts
  useEffect(() => {
    const handleQueueChange = () => {
      setQueue(getOfflineQueue());
    };

    const handleSyncComplete = (e: any) => {
      setLastSyncResult(e.detail);
      setLastSyncTime(new Date().toISOString());
      setQueue(getOfflineQueue());
    };

    const handleMessageReceived = () => {
      setCachedMessages(getCachedInternalMessages());
    };

    window.addEventListener(OFFLINE_EVENTS.QUEUE_CHANGED, handleQueueChange);
    window.addEventListener(OFFLINE_EVENTS.SYNC_COMPLETED, handleSyncComplete);
    window.addEventListener(OFFLINE_EVENTS.MESSAGE_RECEIVED, handleMessageReceived);

    return () => {
      window.removeEventListener(OFFLINE_EVENTS.QUEUE_CHANGED, handleQueueChange);
      window.removeEventListener(OFFLINE_EVENTS.SYNC_COMPLETED, handleSyncComplete);
      window.removeEventListener(OFFLINE_EVENTS.MESSAGE_RECEIVED, handleMessageReceived);
    };
  }, []);

  // Trigger sync
  const triggerSync = useCallback(async (): Promise<SyncResult> => {
    if (isSyncing || !navigator.onLine) {
      return { total: 0, synced: 0, failed: 0, errors: [] };
    }

    try {
      setIsSyncing(true);
      const result = await syncAllPendingActions();
      setLastSyncResult(result);
      setLastSyncTime(new Date().toISOString());
      setQueue(getOfflineQueue());
      return result;
    } catch (err: any) {
      console.warn('Sync execution notice:', err);
      return { total: 0, synced: 0, failed: 0, errors: [err.message || 'Sync error'] };
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  const pendingCount = queue.filter(q => q.status === 'PENDING' || q.status === 'FAILED' || q.status === 'SYNCING').length;
  const failedCount = queue.filter(q => q.status === 'FAILED').length;

  return {
    isOnline,
    isSyncing,
    queue,
    pendingCount,
    failedCount,
    lastSyncResult,
    lastSyncTime,
    cachedMessages,
    syncNow: triggerSync,
    removeAction: removeOfflineAction,
    clearCompleted: clearCompletedActions,
    clearAll: clearAllActions,
    refreshQueue: () => setQueue(getOfflineQueue()),
    refreshMessages: () => setCachedMessages(getCachedInternalMessages())
  };
}

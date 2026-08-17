import { supabase } from './supabase';
import { 
  OfflineAction, 
  OfflineActionType, 
  PlannedVisit, 
  Organization, 
  Contact, 
  Opportunity, 
  FollowUp, 
  FieldSession, 
  InternalMessage, 
  AppUser 
} from '../types';

// Storage keys
export const STORAGE_KEYS = {
  OFFLINE_QUEUE: 'hifi_offline_action_queue',
  CACHED_ORGS: 'hifi_cached_organizations',
  CACHED_VISITS: 'hifi_cached_planned_visits',
  CACHED_CONTACTS: 'hifi_cached_contacts',
  CACHED_MESSAGES: 'hifi_cached_internal_messages',
  CACHED_USERS: 'hifi_cached_team_profiles',
  ACTIVE_SESSION: 'hifi_active_field_session',
  LAST_SYNC: 'hifi_last_sync_timestamp'
};

// Event names
export const OFFLINE_EVENTS = {
  QUEUE_CHANGED: 'hifi_offline_queue_changed',
  SYNC_COMPLETED: 'hifi_offline_sync_completed',
  MESSAGE_RECEIVED: 'hifi_internal_message_received'
};

// Helper: Safely get JSON from localStorage
function getLocalItem<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (err) {
    console.warn(`Error reading ${key} from storage:`, err);
    return fallback;
  }
}

// Helper: Safely set JSON in localStorage
function setLocalItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Error saving ${key} to storage:`, err);
  }
}

// ============================================================================
// 1. DATA CACHING
// ============================================================================

export function getCachedOrganizations(): Organization[] {
  return getLocalItem<Organization[]>(STORAGE_KEYS.CACHED_ORGS, []);
}

export function cacheOrganizations(orgs: Organization[]): void {
  if (Array.isArray(orgs) && orgs.length > 0) {
    setLocalItem(STORAGE_KEYS.CACHED_ORGS, orgs);
  }
}

export function getCachedPlannedVisits(): PlannedVisit[] {
  return getLocalItem<PlannedVisit[]>(STORAGE_KEYS.CACHED_VISITS, []);
}

export function cachePlannedVisits(visits: PlannedVisit[]): void {
  if (Array.isArray(visits)) {
    setLocalItem(STORAGE_KEYS.CACHED_VISITS, visits);
  }
}

export function getCachedTeamUsers(): AppUser[] {
  return getLocalItem<AppUser[]>(STORAGE_KEYS.CACHED_USERS, []);
}

export function cacheTeamUsers(users: AppUser[]): void {
  if (Array.isArray(users) && users.length > 0) {
    setLocalItem(STORAGE_KEYS.CACHED_USERS, users);
  }
}

export function getCachedInternalMessages(): InternalMessage[] {
  return getLocalItem<InternalMessage[]>(STORAGE_KEYS.CACHED_MESSAGES, []);
}

export function cacheInternalMessages(messages: InternalMessage[]): void {
  if (Array.isArray(messages)) {
    setLocalItem(STORAGE_KEYS.CACHED_MESSAGES, messages);
  }
}

// ============================================================================
// 2. OFFLINE ACTION QUEUE MANAGEMENT
// ============================================================================

export function getOfflineQueue(): OfflineAction[] {
  return getLocalItem<OfflineAction[]>(STORAGE_KEYS.OFFLINE_QUEUE, []);
}

export function enqueueOfflineAction(
  type: OfflineActionType, 
  payload: any, 
  summaryText: string
): OfflineAction {
  const queue = getOfflineQueue();
  const newAction: OfflineAction = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type,
    payload,
    timestamp: new Date().toISOString(),
    status: 'PENDING',
    retryCount: 0,
    summaryText
  };

  const updatedQueue = [newAction, ...queue];
  setLocalItem(STORAGE_KEYS.OFFLINE_QUEUE, updatedQueue);
  window.dispatchEvent(new CustomEvent(OFFLINE_EVENTS.QUEUE_CHANGED, { detail: { queue: updatedQueue } }));
  return newAction;
}

export function removeOfflineAction(id: string): void {
  const queue = getOfflineQueue();
  const updatedQueue = queue.filter(item => item.id !== id);
  setLocalItem(STORAGE_KEYS.OFFLINE_QUEUE, updatedQueue);
  window.dispatchEvent(new CustomEvent(OFFLINE_EVENTS.QUEUE_CHANGED, { detail: { queue: updatedQueue } }));
}

export function clearCompletedActions(): void {
  const queue = getOfflineQueue();
  const updatedQueue = queue.filter(item => item.status === 'PENDING' || item.status === 'FAILED');
  setLocalItem(STORAGE_KEYS.OFFLINE_QUEUE, updatedQueue);
  window.dispatchEvent(new CustomEvent(OFFLINE_EVENTS.QUEUE_CHANGED, { detail: { queue: updatedQueue } }));
}

export function clearAllActions(): void {
  setLocalItem(STORAGE_KEYS.OFFLINE_QUEUE, []);
  window.dispatchEvent(new CustomEvent(OFFLINE_EVENTS.QUEUE_CHANGED, { detail: { queue: [] } }));
}

// ============================================================================
// 3. BACKGROUND SYNCHRONIZATION ENGINE
// ============================================================================

export interface SyncResult {
  total: number;
  synced: number;
  failed: number;
  errors: string[];
}

export async function syncAllPendingActions(): Promise<SyncResult> {
  const queue = getOfflineQueue();
  const pendingActions = queue.filter(item => item.status === 'PENDING' || item.status === 'FAILED');

  if (pendingActions.length === 0) {
    return { total: 0, synced: 0, failed: 0, errors: [] };
  }

  const result: SyncResult = {
    total: pendingActions.length,
    synced: 0,
    failed: 0,
    errors: []
  };

  const updatedQueue = [...queue];

  for (const action of pendingActions) {
    const queueIndex = updatedQueue.findIndex(q => q.id === action.id);
    if (queueIndex !== -1) {
      updatedQueue[queueIndex].status = 'SYNCING';
      setLocalItem(STORAGE_KEYS.OFFLINE_QUEUE, updatedQueue);
    }

    try {
      await processSingleAction(action);
      
      // Mark as SYNCED
      if (queueIndex !== -1) {
        updatedQueue[queueIndex].status = 'SYNCED';
        updatedQueue[queueIndex].lastError = undefined;
      }
      result.synced++;
    } catch (err: any) {
      console.warn(`Sync failed for action ${action.id} (${action.type}):`, err);
      if (queueIndex !== -1) {
        updatedQueue[queueIndex].status = 'FAILED';
        updatedQueue[queueIndex].retryCount = (updatedQueue[queueIndex].retryCount || 0) + 1;
        updatedQueue[queueIndex].lastError = err.message || 'Sync failed';
      }
      result.failed++;
      result.errors.push(`${action.summaryText}: ${err.message || 'Network error'}`);
    }
  }

  // Update storage & fire sync complete event
  setLocalItem(STORAGE_KEYS.OFFLINE_QUEUE, updatedQueue);
  setLocalItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
  
  window.dispatchEvent(new CustomEvent(OFFLINE_EVENTS.SYNC_COMPLETED, { detail: result }));
  window.dispatchEvent(new CustomEvent(OFFLINE_EVENTS.QUEUE_CHANGED, { detail: { queue: updatedQueue } }));

  return result;
}

// Process a single action against Supabase
async function processSingleAction(action: OfflineAction): Promise<void> {
  const { type, payload } = action;

  switch (type) {
    case 'START_SESSION': {
      const { error } = await supabase.from('field_sessions').upsert([payload]);
      if (error) throw error;
      break;
    }

    case 'END_SESSION': {
      const { error } = await supabase
        .from('field_sessions')
        .update({
          end_time: payload.end_time,
          end_latitude: payload.end_latitude,
          end_longitude: payload.end_longitude,
          status: 'ENDED',
          notes: payload.notes,
          updated_at: payload.updated_at || new Date().toISOString()
        })
        .eq('id', payload.id);
      if (error) throw error;
      break;
    }

    case 'LOG_VISIT': {
      // 1. Insert into visit_logs
      const { visitLog, plannedVisitId, opportunity, followUp } = payload;
      
      if (visitLog) {
        const { error: visitErr } = await supabase.from('visit_logs').insert([visitLog]);
        if (visitErr) console.warn('Visit log table notice:', visitErr.message);
      }

      // 2. Update planned_visits status
      if (plannedVisitId) {
        const { error: planErr } = await supabase
          .from('planned_visits')
          .update({
            status: 'COMPLETED',
            actual_check_in_time: visitLog?.check_in_time,
            actual_check_out_time: visitLog?.check_out_time,
            actual_check_in_lat: visitLog?.check_in_lat,
            actual_check_in_lng: visitLog?.check_in_lng,
            actual_check_out_lat: visitLog?.check_out_lat,
            actual_check_out_lng: visitLog?.check_out_lng,
            outcome: visitLog?.outcome,
            meeting_notes: visitLog?.meeting_summary,
            updated_at: new Date().toISOString()
          })
          .eq('id', plannedVisitId);
        if (planErr) console.warn('Planned visit status update notice:', planErr.message);
      }

      // 3. Insert opportunity if created
      if (opportunity) {
        const { error: oppErr } = await supabase.from('opportunities').insert([opportunity]);
        if (oppErr) console.warn('Opportunity insert notice:', oppErr.message);
      }

      // 4. Insert follow-up task if created
      if (followUp) {
        const { error: followErr } = await supabase.from('follow_ups').insert([followUp]);
        if (followErr) console.warn('Follow up insert notice:', followErr.message);
      }
      break;
    }

    case 'CREATE_ORGANIZATION': {
      const { error } = await supabase.from('organizations').insert([payload]);
      if (error) throw error;
      break;
    }

    case 'CREATE_OPPORTUNITY': {
      const { error } = await supabase.from('opportunities').insert([payload]);
      if (error) throw error;
      break;
    }

    case 'CREATE_FOLLOW_UP': {
      const { error } = await supabase.from('follow_ups').insert([payload]);
      if (error) throw error;
      break;
    }

    case 'SEND_MESSAGE': {
      // Try internal_messages table
      try {
        const { error } = await supabase.from('internal_messages').insert([payload]);
        if (!error) break;
      } catch {
        // Fall back to notifications table
      }

      // Fallback: Store as a notification item in notifications table
      try {
        const notifPayload = {
          id: payload.id,
          user_id: payload.recipient_id || 'BROADCAST',
          type: `SITUATION_${payload.situation}`,
          title: `[${payload.urgency}] ${payload.title}`,
          message: `${payload.sender_name ? `${payload.sender_name}: ` : ''}${payload.body}${payload.organization_name ? ` (Client: ${payload.organization_name})` : ''}`,
          read: false,
          related_entity_type: 'ORGANIZATION',
          related_entity_id: payload.organization_id || undefined,
          created_at: payload.created_at || new Date().toISOString()
        };
        await supabase.from('notifications').insert([notifPayload]);
      } catch (notifErr) {
        console.warn('Notification fallback dispatch notice:', notifErr);
      }
      break;
    }

    default:
      console.warn('Unknown offline action type:', type);
  }
}

// ============================================================================
// 4. DIRECT SITUATION MESSAGING API
// ============================================================================

export async function sendSituationMessage(
  msgInput: Omit<InternalMessage, 'id' | 'created_at' | 'read' | 'status'>
): Promise<{ success: boolean; message: InternalMessage; queuedOffline: boolean; error?: string }> {
  const newMsg: InternalMessage = {
    ...msgInput,
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    created_at: new Date().toISOString(),
    read: false,
    status: 'SENT'
  };

  // Add to local cached messages immediately
  const cached = getCachedInternalMessages();
  const updatedMessages = [newMsg, ...cached];
  cacheInternalMessages(updatedMessages);

  // If browser is offline, queue directly
  if (!navigator.onLine) {
    newMsg.status = 'QUEUED_OFFLINE';
    enqueueOfflineAction(
      'SEND_MESSAGE',
      newMsg,
      `Situation Alert: ${newMsg.title} (${newMsg.urgency})`
    );
    window.dispatchEvent(new CustomEvent(OFFLINE_EVENTS.MESSAGE_RECEIVED, { detail: newMsg }));
    return { success: true, message: newMsg, queuedOffline: true };
  }

  // Attempt Supabase live delivery
  try {
    let delivered = false;

    // 1. Try internal_messages table
    try {
      const { data, error } = await supabase
        .from('internal_messages')
        .insert([newMsg])
        .select()
        .single();
      
      if (!error && data) {
        delivered = true;
      }
    } catch {
      // Table may not exist yet, fallback to notifications
    }

    // 2. Also create notification record for live notification badge
    try {
      const notifItem = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        user_id: newMsg.recipient_id || 'ALL_MANAGERS',
        type: `FIELD_SITUATION_${newMsg.situation}`,
        title: `⚡ [${newMsg.urgency}] ${newMsg.title}`,
        message: `${newMsg.sender_name || 'Field Rep'} (${newMsg.sender_role || 'Field'}): ${newMsg.body}${newMsg.organization_name ? ` • Ref: ${newMsg.organization_name}` : ''}`,
        read: false,
        related_entity_type: 'ORGANIZATION',
        related_entity_id: newMsg.organization_id || undefined,
        created_at: newMsg.created_at
      };
      await supabase.from('notifications').insert([notifItem]);
      delivered = true;
    } catch (notifErr) {
      console.warn('Live notification dispatch notice:', notifErr);
    }

    newMsg.status = delivered ? 'DELIVERED' : 'SENT';
    window.dispatchEvent(new CustomEvent(OFFLINE_EVENTS.MESSAGE_RECEIVED, { detail: newMsg }));
    return { success: true, message: newMsg, queuedOffline: false };

  } catch (err: any) {
    console.warn('Network send error, falling back to offline queue:', err);
    newMsg.status = 'QUEUED_OFFLINE';
    enqueueOfflineAction(
      'SEND_MESSAGE',
      newMsg,
      `Situation Alert: ${newMsg.title} (${newMsg.urgency})`
    );
    window.dispatchEvent(new CustomEvent(OFFLINE_EVENTS.MESSAGE_RECEIVED, { detail: newMsg }));
    return { success: true, message: newMsg, queuedOffline: true };
  }
}

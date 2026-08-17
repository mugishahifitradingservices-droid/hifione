import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { FieldSession } from '../types';

const SESSION_STORAGE_KEY = 'hifi_active_field_session';

export interface LocationState {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: string;
}

export function useFieldSession() {
  const { appUser } = useAuth();
  const [activeSession, setActiveSession] = useState<FieldSession | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationState | null>(null);
  const [gpsActive, setGpsActive] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  // Helper: Format seconds to HH:MM:SS
  const formatDuration = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 360);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Load existing active session from Supabase / localStorage
  const loadActiveSession = useCallback(async () => {
    if (!appUser?.id) {
      setActiveSession(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Check Supabase first
      const { data: dbSessions, error: sessionErr } = await supabase
        .from('field_sessions')
        .select('*')
        .eq('employee_id', appUser.id)
        .eq('session_date', todayStr)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false })
        .limit(1);

      if (dbSessions && dbSessions.length > 0) {
        const session = dbSessions[0] as FieldSession;
        setActiveSession(session);
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      } else {
        // Fallback to local storage if offline or table pending
        const local = localStorage.getItem(SESSION_STORAGE_KEY);
        if (local) {
          try {
            const parsed = JSON.parse(local) as FieldSession;
            if (parsed.employee_id === appUser.id && parsed.session_date === todayStr && parsed.status === 'ACTIVE') {
              setActiveSession(parsed);
            } else {
              setActiveSession(null);
              localStorage.removeItem(SESSION_STORAGE_KEY);
            }
          } catch {
            setActiveSession(null);
          }
        } else {
          setActiveSession(null);
        }
      }
    } catch (err) {
      console.warn('Field session load notice:', err);
    } finally {
      setLoading(false);
    }
  }, [appUser?.id, todayStr]);

  useEffect(() => {
    loadActiveSession();
  }, [loadActiveSession]);

  // GPS Location Watcher - ONLY active when activeSession is ACTIVE
  useEffect(() => {
    if (activeSession && activeSession.status === 'ACTIVE') {
      // Start GPS Tracking
      if ('geolocation' in navigator) {
        setGpsActive(true);
        setGpsError(null);

        // Immediate snapshot
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc: LocationState = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: Math.round(pos.coords.accuracy),
              timestamp: new Date().toISOString()
            };
            setCurrentLocation(loc);
          },
          (err) => {
            console.warn('Initial GPS check notice:', err.message);
            setGpsError(err.message);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
        );

        // Continuous watcher during active session
        try {
          watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
              const loc: LocationState = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: Math.round(pos.coords.accuracy),
                timestamp: new Date().toISOString()
              };
              setCurrentLocation(loc);
              setGpsError(null);
            },
            (err) => {
              console.warn('GPS Watch notice:', err.message);
              setGpsError(err.message);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
          );
        } catch (e: any) {
          console.warn('Failed to start geolocation watch:', e);
        }
      } else {
        setGpsError('Geolocation is not supported by your device browser');
      }
    } else {
      // STOP location tracking immediately when session ends or is inactive
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setGpsActive(false);
      setCurrentLocation(null);
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [activeSession]);

  // Live Timer for Active Session Duration
  useEffect(() => {
    if (activeSession && activeSession.status === 'ACTIVE') {
      const startTimeMs = new Date(`${activeSession.session_date}T${activeSession.start_time}`).getTime() || Date.now();
      
      const updateTimer = () => {
        const nowMs = Date.now();
        const diffSecs = Math.max(0, Math.floor((nowMs - startTimeMs) / 1000));
        setElapsedSeconds(diffSecs);
      };

      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
    } else {
      setElapsedSeconds(0);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [activeSession]);

  // Start a new authorized Field Day session
  const startSession = async (notes?: string): Promise<{ success: boolean; session?: FieldSession; error?: string }> => {
    if (!appUser?.id) return { success: false, error: 'User not authenticated' };

    try {
      setLoading(true);

      // Get starting GPS location
      let startLat: number | undefined;
      let startLng: number | undefined;

      if ('geolocation' in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 8000,
              maximumAge: 0
            });
          });
          startLat = pos.coords.latitude;
          startLng = pos.coords.longitude;
        } catch (gpsErr) {
          console.warn('Could not acquire GPS at session start:', gpsErr);
        }
      }

      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS

      const newSession: FieldSession = {
        id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        employee_id: appUser.id,
        session_date: todayStr,
        start_time: timeStr,
        start_latitude: startLat,
        start_longitude: startLng,
        current_latitude: startLat,
        current_longitude: startLng,
        last_location_time: now.toISOString(),
        status: 'ACTIVE',
        total_visits_planned: 0,
        total_visits_completed: 0,
        total_opportunities_created: 0,
        notes: notes || 'Authorized Field Day Started',
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      };

      // Attempt Supabase insert
      try {
        const { data, error } = await supabase
          .from('field_sessions')
          .insert([newSession])
          .select()
          .single();

        if (data && !error) {
          setActiveSession(data as FieldSession);
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
          return { success: true, session: data as FieldSession };
        }
      } catch (insertErr) {
        console.warn('Field session insert to Supabase notice:', insertErr);
      }

      // Local persistence fallback
      setActiveSession(newSession);
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
      return { success: true, session: newSession };

    } catch (err: any) {
      console.error('Error starting field session:', err);
      return { success: false, error: err.message || 'Failed to start field session' };
    } finally {
      setLoading(false);
    }
  };

  // End active Field Day session
  const endSession = async (summaryNotes?: string): Promise<{ success: boolean; error?: string }> => {
    if (!activeSession) return { success: false, error: 'No active session' };

    try {
      setLoading(true);

      // Get ending GPS location
      let endLat: number | undefined;
      let endLng: number | undefined;

      if ('geolocation' in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 6000,
              maximumAge: 0
            });
          });
          endLat = pos.coords.latitude;
          endLng = pos.coords.longitude;
        } catch (gpsErr) {
          console.warn('Could not acquire GPS at session end:', gpsErr);
        }
      }

      const now = new Date();
      const endTimeStr = now.toTimeString().split(' ')[0];

      const updatedSession: FieldSession = {
        ...activeSession,
        end_time: endTimeStr,
        end_latitude: endLat,
        end_longitude: endLng,
        status: 'ENDED',
        notes: summaryNotes ? `${activeSession.notes || ''} | Summary: ${summaryNotes}` : activeSession.notes,
        updated_at: now.toISOString()
      };

      // Update Supabase
      try {
        await supabase
          .from('field_sessions')
          .update({
            end_time: endTimeStr,
            end_latitude: endLat,
            end_longitude: endLng,
            status: 'ENDED',
            notes: updatedSession.notes,
            updated_at: now.toISOString()
          })
          .eq('id', activeSession.id);
      } catch (err) {
        console.warn('Field session update notice:', err);
      }

      // Stop tracking
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setGpsActive(false);
      setCurrentLocation(null);
      setActiveSession(null);
      localStorage.removeItem(SESSION_STORAGE_KEY);

      return { success: true };
    } catch (err: any) {
      console.error('Error ending field session:', err);
      return { success: false, error: err.message || 'Failed to end session' };
    } finally {
      setLoading(false);
    }
  };

  return {
    activeSession,
    currentLocation,
    gpsActive,
    gpsError,
    loading,
    elapsedSeconds,
    formattedDuration: formatDuration(elapsedSeconds),
    startSession,
    endSession,
    refreshSession: loadActiveSession
  };
}

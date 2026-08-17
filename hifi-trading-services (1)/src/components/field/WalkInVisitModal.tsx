import React, { useState } from 'react';
import { 
  X, 
  MapPin, 
  Building2, 
  User, 
  Phone, 
  Plus, 
  Loader2, 
  AlertCircle, 
  Clock, 
  Navigation,
  Compass
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { Organization, Priority, PlannedVisit } from '../../types';
import { LocationState } from '../../hooks/useFieldSession';
import { enqueueOfflineAction, cacheOrganizations, getCachedOrganizations } from '../../lib/offlineSync';
import VoiceDictationButton from './VoiceDictationButton';

interface WalkInVisitModalProps {
  organizations: Organization[];
  currentLocation: LocationState | null;
  onClose: () => void;
  onVisitCreated: (visit: PlannedVisit) => void;
}

export default function WalkInVisitModal({
  organizations,
  currentLocation,
  onClose,
  onVisitCreated
}: WalkInVisitModalProps) {
  const { appUser } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Toggle between existing organization vs new walk-in prospect
  const [isNewOrg, setIsNewOrg] = useState(false);
  
  // Existing Org state
  const [selectedOrgId, setSelectedOrgId] = useState('');
  
  // New Org fields
  const [orgName, setOrgName] = useState('');
  const [orgSector, setOrgSector] = useState('Commercial Trade');
  const [orgDistrict, setOrgDistrict] = useState('Nyarugenge');
  const [orgAddress, setOrgAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Visit details
  const [purpose, setPurpose] = useState('Spontaneous Prospecting / Walk-in Introduction');
  const [priority, setPriority] = useState<Priority>('HIGH');

  const handleCreateWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appUser?.id) return;

    try {
      setLoading(true);
      setError(null);

      let targetOrgId = selectedOrgId;
      let targetOrg: Organization | undefined;

      // 1. If new organization, insert into Supabase
      if (isNewOrg) {
        if (!orgName.trim()) {
          setError('Please provide the prospective company name');
          setLoading(false);
          return;
        }

        const newOrgId = `org_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const orgPayload: Organization = {
          id: newOrgId,
          name: orgName.trim(),
          sector: orgSector,
          district: orgDistrict,
          address: orgAddress.trim() || `${orgDistrict}, Kigali`,
          phone: contactPhone.trim() || undefined,
          latitude: currentLocation?.lat,
          longitude: currentLocation?.lng,
          relationship_status: 'PROSPECT',
          lead_source: 'FIELD_WALK_IN',
          priority: priority,
          created_by: appUser.id,
          created_at: new Date().toISOString()
        };

        targetOrgId = newOrgId;
        targetOrg = orgPayload;

        // Try online registration or queue offline
        if (navigator.onLine) {
          try {
            const { data: newOrgData } = await supabase
              .from('organizations')
              .insert([orgPayload])
              .select()
              .single();
            if (newOrgData) targetOrg = newOrgData as Organization;
          } catch (orgErr) {
            console.warn('Network issue adding org, saving to offline queue:', orgErr);
            enqueueOfflineAction('CREATE_ORGANIZATION', orgPayload, `Register Prospect Org: ${orgPayload.name}`);
          }
        } else {
          enqueueOfflineAction('CREATE_ORGANIZATION', orgPayload, `Register Prospect Org: ${orgPayload.name}`);
        }

        // Update local cached organizations
        const cached = getCachedOrganizations();
        cacheOrganizations([targetOrg, ...cached]);

      } else {
        if (!selectedOrgId) {
          setError('Please select an organization from the list');
          setLoading(false);
          return;
        }
        targetOrg = organizations.find(o => o.id === selectedOrgId);
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

      // 2. Create Planned Visit with status IN_PROGRESS
      const newVisitId = `pv_walkin_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const plannedVisitPayload: PlannedVisit = {
        id: newVisitId,
        employee_id: appUser.id,
        organization_id: targetOrgId,
        planned_date: todayStr,
        planned_start_time: nowTime,
        estimated_duration: 45,
        purpose: purpose.trim() || 'Walk-in Field Meeting',
        priority: priority,
        assignment_type: 'SELF_PLANNED',
        status: 'IN_PROGRESS',
        notes: `Walk-in visit logged directly in Field Mode. GPS ±${currentLocation?.accuracy || 10}m`,
        created_at: new Date().toISOString()
      };

      if (navigator.onLine) {
        try {
          const { data: visitData } = await supabase
            .from('planned_visits')
            .insert([plannedVisitPayload])
            .select()
            .single();
          if (visitData) {
            plannedVisitPayload.id = visitData.id;
          }
        } catch (vErr) {
          console.warn('Network issue creating visit, saved in session:', vErr);
        }
      }

      const completeVisit: PlannedVisit = {
        ...plannedVisitPayload,
        organization: targetOrg
      };

      onVisitCreated(completeVisit);
      onClose();

    } catch (err: any) {
      console.error('Error creating walk in visit:', err);
      setError(err.message || 'Failed to log walk-in visit');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = cn(
    "w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#1848A0]",
    isDark 
      ? "bg-[#0B0B0E] border-[#2A2A38] text-white placeholder-gray-500" 
      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
  );

  const labelClass = cn(
    "block text-xs font-bold uppercase tracking-wider mb-1.5",
    isDark ? "text-slate-300" : "text-slate-700"
  );

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
            <div className="w-9 h-9 rounded-xl bg-[#F88020]/15 text-[#F88020] flex items-center justify-center font-bold">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className={cn("text-base font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                Log Spontaneous Walk-in Visit
              </h2>
              <p className="text-xs text-slate-400">
                Instantly check-in to an unplanned client on your route
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch: Registered vs New */}
        <div className="p-4 pb-0">
          <div className={cn(
            "p-1 rounded-xl flex gap-1 border",
            isDark ? "bg-[#0B0B0E] border-[#2A2A38]" : "bg-slate-100 border-slate-200"
          )}>
            <button
              type="button"
              onClick={() => setIsNewOrg(false)}
              className={cn(
                "flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
                !isNewOrg 
                  ? "bg-[#1848A0] text-white shadow-xs" 
                  : isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
              )}
            >
              Registered Client
            </button>
            <button
              type="button"
              onClick={() => setIsNewOrg(true)}
              className={cn(
                "flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
                isNewOrg 
                  ? "bg-[#1848A0] text-white shadow-xs" 
                  : isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
              )}
            >
              + New Prospective Company
            </button>
          </div>
        </div>

        <form onSubmit={handleCreateWalkIn} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isNewOrg ? (
            <div>
              <label className={labelClass}>Select Organization *</label>
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className={inputClass}
                required={!isNewOrg}
              >
                <option value="">-- Choose from Directory --</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.district || org.sector || 'Kigali'})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Company / Client Name *
                  </label>
                  <VoiceDictationButton
                    size="sm"
                    label="Speak Name"
                    onAppendText={(txt) => setOrgName(prev => prev ? `${prev} ${txt}` : txt)}
                  />
                </div>
                <input
                  required={isNewOrg}
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Kigali Heights Pharmacy Ltd"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Sector / Industry</label>
                  <select
                    value={orgSector}
                    onChange={(e) => setOrgSector(e.target.value)}
                    className={inputClass}
                  >
                    <option value="Commercial Trade">Commercial Trade</option>
                    <option value="Construction & Engineering">Construction</option>
                    <option value="Healthcare & Pharma">Healthcare</option>
                    <option value="Hospitality & Hotels">Hospitality</option>
                    <option value="Manufacturing">Manufacturing</option>
                    <option value="Government & Public">Government</option>
                    <option value="Education">Education</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>District / Location</label>
                  <select
                    value={orgDistrict}
                    onChange={(e) => setOrgDistrict(e.target.value)}
                    className={inputClass}
                  >
                    <option value="Nyarugenge">Nyarugenge</option>
                    <option value="Gasabo">Gasabo</option>
                    <option value="Kicukiro">Kicukiro</option>
                    <option value="Bugesera">Bugesera</option>
                    <option value="Rwamagana">Rwamagana</option>
                    <option value="Musanze">Musanze</option>
                    <option value="Rubavu">Rubavu</option>
                    <option value="Huye">Huye</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                      Contact Person
                    </label>
                    <VoiceDictationButton
                      size="sm"
                      label="Speak"
                      onAppendText={(txt) => setContactName(prev => prev ? `${prev} ${txt}` : txt)}
                    />
                  </div>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g. Alex Ndayisaba"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Phone Number</label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+250 788 000 000"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Meeting Purpose */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Visit Purpose & Initial Notes
              </label>
              <VoiceDictationButton
                size="sm"
                label="Voice Dictation"
                onAppendText={(txt) => setPurpose(prev => prev ? `${prev} ${txt}` : txt)}
              />
            </div>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Spontaneous introductory pitch and catalog drop"
              className={inputClass}
            />
          </div>

          {/* GPS Info */}
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 text-xs flex items-center gap-2">
            <MapPin className="w-4 h-4 shrink-0 text-[#1848A0]" />
            <span>
              {currentLocation 
                ? `GPS Check-in will be stamped at Lat ${currentLocation.lat.toFixed(5)}, Lng ${currentLocation.lng.toFixed(5)} (±${currentLocation.accuracy}m)`
                : 'Current GPS coordinates will be captured upon starting'}
            </span>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t dark:border-[#252530] flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer",
                isDark ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-[#F88020] hover:bg-[#E07018] text-white text-xs font-black transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting Check-In...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Start Walk-In Check-In
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

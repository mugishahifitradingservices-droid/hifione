import React, { useState, useMemo } from 'react';
import { 
  Layers, 
  X, 
  Search, 
  Check, 
  Loader2, 
  AlertTriangle, 
  ArrowRight, 
  Users, 
  Calendar, 
  Phone, 
  Mail, 
  MapPin, 
  CheckCircle2,
  Sparkles,
  Building2
} from 'lucide-react';
import { OrganizationRecord } from '../../pages/Organizations';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import { 
  findDuplicateCandidates, 
  calculateCompanySimilarity, 
  mergeOrganizations 
} from '../../lib/deduplication';

interface MergeOrganizationModalProps {
  sourceOrg: OrganizationRecord;
  allOrganizations: OrganizationRecord[];
  onClose: () => void;
  onMerged: () => void;
}

export function MergeOrganizationModal({
  sourceOrg,
  allOrganizations,
  onClose,
  onMerged
}: MergeOrganizationModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTargetOrg, setSelectedTargetOrg] = useState<OrganizationRecord | null>(null);
  const [primaryOrgId, setPrimaryOrgId] = useState<string>(sourceOrg.id);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Auto-suggested duplicate candidates
  const autoCandidates = useMemo(() => {
    return findDuplicateCandidates(sourceOrg.name, allOrganizations, sourceOrg.id, {
      phone: sourceOrg.phone,
      email: sourceOrg.email,
      website: sourceOrg.website
    });
  }, [sourceOrg, allOrganizations]);

  // Search filtered candidates
  const filteredOrgs = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const q = searchTerm.toLowerCase().trim();
    return allOrganizations
      .filter(o => o.id !== sourceOrg.id && (
        o.name.toLowerCase().includes(q) ||
        (o.phone && o.phone.includes(q)) ||
        (o.email && o.email.toLowerCase().includes(q))
      ))
      .slice(0, 8);
  }, [searchTerm, allOrganizations, sourceOrg.id]);

  const similarityInfo = useMemo(() => {
    if (!selectedTargetOrg) return null;
    return calculateCompanySimilarity(
      sourceOrg.name,
      selectedTargetOrg.name,
      { phone: sourceOrg.phone, email: sourceOrg.email, website: sourceOrg.website },
      { phone: selectedTargetOrg.phone, email: selectedTargetOrg.email, website: selectedTargetOrg.website }
    );
  }, [sourceOrg, selectedTargetOrg]);

  const handleExecuteMerge = async () => {
    if (!selectedTargetOrg) return;

    const primary = primaryOrgId === sourceOrg.id ? sourceOrg : selectedTargetOrg;
    const duplicate = primaryOrgId === sourceOrg.id ? selectedTargetOrg : sourceOrg;

    setLoading(true);
    setErrorMessage(null);

    const res = await mergeOrganizations(primary, [duplicate]);

    if (res.success) {
      setSuccessMessage(`Merged successfully! Reassigned ${res.mergedContacts} contact(s) and ${res.mergedVisits} visit(s) to "${primary.name}".`);
      setTimeout(() => {
        onMerged();
      }, 1200);
    } else {
      setErrorMessage(res.error || 'Failed to merge organizations');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className={cn(
        "border rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] transition-all",
        isDark ? "bg-[#14141B] border-[#2A2A38]" : "bg-white border-slate-200"
      )}>
        {/* Header */}
        <div className={cn(
          "p-6 border-b flex items-center justify-between gap-4",
          isDark ? "border-[#22222E] bg-[#101016]" : "border-slate-100 bg-slate-50"
        )}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#1848A0]/10 border border-[#1848A0]/20 flex items-center justify-center text-[#1848A0]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-900")}>
                Merge Organization Records
              </h2>
              <p className="text-xs text-slate-400">Combine duplicate accounts, combine history, and clean directory</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMessage && (
          <div className="p-4 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-2 px-6">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 bg-rose-500/10 border-b border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-2 px-6">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="overflow-y-auto p-6 space-y-6 flex-1 text-xs">
          {/* Active Record being merged */}
          <div className={cn(
            "p-4 rounded-2xl border flex items-center justify-between gap-4",
            isDark ? "bg-[#181822] border-[#2A2A38]" : "bg-slate-50 border-slate-200"
          )}>
            <div className="space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#1848A0]">Selected Record</div>
              <div className={cn("text-base font-bold", isDark ? "text-white" : "text-slate-900")}>{sourceOrg.name}</div>
              <div className="text-slate-400 text-xs flex items-center gap-3">
                <span>{sourceOrg.contacts?.length || 0} Contacts</span>
                <span>•</span>
                <span>{sourceOrg.visits?.length || 0} Visits</span>
                {sourceOrg.phone && <span>• 📞 {sourceOrg.phone}</span>}
              </div>
            </div>
            <div className="text-right">
              <span className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-bold border",
                primaryOrgId === sourceOrg.id 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                  : "bg-slate-800 text-slate-400 border-slate-700"
              )}>
                {primaryOrgId === sourceOrg.id ? "Master (Survivor)" : "To be merged & removed"}
              </span>
            </div>
          </div>

          {/* Target Selection Step */}
          {!selectedTargetOrg ? (
            <div className="space-y-4">
              {/* Smart Suggestions */}
              {autoCandidates.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#F88020]">
                    <Sparkles className="w-4 h-4" />
                    <span>AI Detected Fuzzy Matches & Misspellings:</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    {autoCandidates.map((cand) => (
                      <div
                        key={cand.organization.id}
                        onClick={() => setSelectedTargetOrg(cand.organization)}
                        className={cn(
                          "p-3.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all hover:scale-[1.01]",
                          isDark ? "bg-[#181824] border-amber-500/30 hover:border-amber-500" : "bg-amber-50/40 border-amber-200 hover:border-amber-400"
                        )}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={cn("font-bold text-sm", isDark ? "text-white" : "text-slate-900")}>
                              {cand.organization.name}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              {cand.similarity}% Match
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 italic">{cand.reason}</p>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400">
                            <span>{cand.organization.contacts?.length || 0} Contacts</span>
                            <span>•</span>
                            <span>{cand.organization.visits?.length || 0} Visits</span>
                            {cand.organization.phone && <span>• 📞 {cand.organization.phone}</span>}
                          </div>
                        </div>

                        <button className="px-3.5 py-1.5 rounded-xl bg-[#1848A0] text-white text-xs font-bold hover:bg-[#003880] transition-colors cursor-pointer">
                          Select for Merge
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual Search */}
              <div className="space-y-2 pt-2">
                <label className={cn("block text-xs font-bold uppercase tracking-wider", isDark ? "text-slate-400" : "text-slate-600")}>
                  Or Search Another Organization to Merge With:
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search company name, phone or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={cn(
                      "w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#1848A0]",
                      isDark ? "bg-[#0B0B0E] border-[#2A2A38] text-white" : "bg-white border-slate-200 text-slate-900"
                    )}
                  />
                </div>

                {filteredOrgs.length > 0 && (
                  <div className={cn("border rounded-xl divide-y max-h-48 overflow-y-auto", isDark ? "border-[#2A2A38] divide-[#2A2A38]" : "border-slate-200 divide-slate-100")}>
                    {filteredOrgs.map((org) => (
                      <div
                        key={org.id}
                        onClick={() => setSelectedTargetOrg(org)}
                        className={cn(
                          "p-3 flex items-center justify-between cursor-pointer hover:bg-[#1848A0]/10 transition-colors",
                          isDark ? "text-slate-200" : "text-slate-800"
                        )}
                      >
                        <div>
                          <div className="font-bold">{org.name}</div>
                          <div className="text-[11px] text-slate-400">
                            {org.type_of_business || 'General Business'} • {org.phone || 'No phone'}
                          </div>
                        </div>
                        <button className="px-3 py-1 bg-slate-800 hover:bg-[#1848A0] text-white rounded-lg text-xs font-semibold cursor-pointer">
                          Select
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Comparison & Merge Execution View */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">Review & Select Master Survivor Record:</span>
                <button
                  onClick={() => setSelectedTargetOrg(null)}
                  className="text-xs text-[#1848A0] hover:underline font-bold cursor-pointer"
                >
                  Change Selected Organization
                </button>
              </div>

              {similarityInfo && (
                <div className={cn(
                  "p-3 rounded-xl border flex items-center gap-2.5",
                  similarityInfo.similarity >= 80 
                    ? (isDark ? "bg-amber-500/10 border-amber-500/20 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-800")
                    : (isDark ? "bg-blue-500/10 border-blue-500/20 text-blue-300" : "bg-blue-50 border-blue-200 text-blue-800")
                )}>
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>
                    <strong>{similarityInfo.similarity}% Similarity:</strong> {similarityInfo.reason}
                  </span>
                </div>
              )}

              {/* Side by side selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option 1: sourceOrg */}
                <div
                  onClick={() => setPrimaryOrgId(sourceOrg.id)}
                  className={cn(
                    "p-4 rounded-2xl border cursor-pointer transition-all relative",
                    primaryOrgId === sourceOrg.id
                      ? (isDark ? "bg-[#18241C] border-emerald-500 ring-2 ring-emerald-500/30" : "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20")
                      : (isDark ? "bg-[#161620] border-[#2A2A38] opacity-70" : "bg-white border-slate-200 opacity-70")
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase text-emerald-500">Record A</span>
                    {primaryOrgId === sourceOrg.id && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase flex items-center gap-1">
                        <Check className="w-3 h-3" /> Master
                      </span>
                    )}
                  </div>
                  <div className={cn("text-base font-bold", isDark ? "text-white" : "text-slate-900")}>
                    {sourceOrg.name}
                  </div>
                  <div className="mt-2 space-y-1 text-slate-400 text-xs">
                    <div>📞 {sourceOrg.phone || 'None'}</div>
                    <div>✉️ {sourceOrg.email || 'None'}</div>
                    <div>📍 {sourceOrg.address || 'None'}</div>
                    <div className="font-semibold text-slate-300 mt-2">
                      {sourceOrg.contacts?.length || 0} Contacts • {sourceOrg.visits?.length || 0} Visits
                    </div>
                  </div>
                </div>

                {/* Option 2: selectedTargetOrg */}
                <div
                  onClick={() => setPrimaryOrgId(selectedTargetOrg.id)}
                  className={cn(
                    "p-4 rounded-2xl border cursor-pointer transition-all relative",
                    primaryOrgId === selectedTargetOrg.id
                      ? (isDark ? "bg-[#18241C] border-emerald-500 ring-2 ring-emerald-500/30" : "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20")
                      : (isDark ? "bg-[#161620] border-[#2A2A38] opacity-70" : "bg-white border-slate-200 opacity-70")
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase text-emerald-500">Record B</span>
                    {primaryOrgId === selectedTargetOrg.id && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase flex items-center gap-1">
                        <Check className="w-3 h-3" /> Master
                      </span>
                    )}
                  </div>
                  <div className={cn("text-base font-bold", isDark ? "text-white" : "text-slate-900")}>
                    {selectedTargetOrg.name}
                  </div>
                  <div className="mt-2 space-y-1 text-slate-400 text-xs">
                    <div>📞 {selectedTargetOrg.phone || 'None'}</div>
                    <div>✉️ {selectedTargetOrg.email || 'None'}</div>
                    <div>📍 {selectedTargetOrg.address || 'None'}</div>
                    <div className="font-semibold text-slate-300 mt-2">
                      {selectedTargetOrg.contacts?.length || 0} Contacts • {selectedTargetOrg.visits?.length || 0} Visits
                    </div>
                  </div>
                </div>
              </div>

              {/* What will happen notice */}
              <div className={cn("p-4 rounded-xl border text-xs space-y-1.5", isDark ? "bg-[#121218] border-[#22222E] text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700")}>
                <div className="font-bold flex items-center gap-1.5 text-emerald-500">
                  <CheckCircle2 className="w-4 h-4" />
                  What happens when you merge:
                </div>
                <ul className="list-disc list-inside space-y-1 pl-1 text-slate-400 text-[11px]">
                  <li>All contacts from both records are combined under the Master record.</li>
                  <li>All planned field visits and activity history are transferred cleanly.</li>
                  <li>Any missing phone, email, or physical address fields are copied to the Master.</li>
                  <li>The duplicate record is cleanly removed to prevent database bloat.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={cn(
          "p-4 border-t flex justify-end gap-3",
          isDark ? "border-[#22222E] bg-[#101016]" : "border-slate-100 bg-slate-50"
        )}>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-slate-400 font-semibold hover:text-slate-200 rounded-xl transition-colors text-xs cursor-pointer"
          >
            Cancel
          </button>

          {selectedTargetOrg && (
            <button
              disabled={loading}
              onClick={handleExecuteMerge}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 text-xs flex items-center gap-2 shadow-md cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4" />
                  Confirm & Merge Records
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

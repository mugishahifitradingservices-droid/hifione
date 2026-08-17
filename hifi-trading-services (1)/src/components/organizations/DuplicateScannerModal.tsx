import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  X, 
  Building2, 
  ArrowRight, 
  Check, 
  AlertTriangle, 
  Trash2, 
  Loader2, 
  CheckCircle2, 
  Users, 
  Calendar, 
  Phone, 
  Mail, 
  MapPin, 
  Layers,
  ShieldCheck,
  RefreshCw,
  Info
} from 'lucide-react';
import { OrganizationRecord } from '../../pages/Organizations';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import { 
  detectAllDuplicateClusters, 
  mergeOrganizations, 
  DuplicateCluster 
} from '../../lib/deduplication';

interface DuplicateScannerModalProps {
  organizations: OrganizationRecord[];
  onClose: () => void;
  onMerged: () => void;
}

export function DuplicateScannerModal({
  organizations,
  onClose,
  onMerged
}: DuplicateScannerModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [mergingId, setMergingId] = useState<string | null>(null);
  const [batchMerging, setBatchMerging] = useState(false);
  const [selectedPrimaryMap, setSelectedPrimaryMap] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Detect all clusters
  const clusters = useMemo(() => {
    return detectAllDuplicateClusters(organizations);
  }, [organizations]);

  const highConfidenceClusters = useMemo(() => {
    return clusters.filter(c => c.confidence === 'HIGH');
  }, [clusters]);

  const handleMergeCluster = async (cluster: DuplicateCluster) => {
    const primaryId = selectedPrimaryMap[cluster.id] || cluster.primary.id;
    const allOrgsInCluster = [cluster.primary, ...cluster.duplicates];
    const primaryOrg = allOrgsInCluster.find(o => o.id === primaryId) || cluster.primary;
    const duplicateOrgs = allOrgsInCluster.filter(o => o.id !== primaryId);

    setMergingId(cluster.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    const result = await mergeOrganizations(primaryOrg, duplicateOrgs);

    if (result.success) {
      setSuccessMessage(`Successfully merged "${cluster.primary.name}" with ${duplicateOrgs.length} duplicate record(s). Preserved ${result.mergedContacts} contact(s) and ${result.mergedVisits} visit(s).`);
      setTimeout(() => {
        onMerged();
      }, 1000);
    } else {
      setErrorMessage(result.error || 'Failed to complete merge');
    }
    setMergingId(null);
  };

  const handleBatchMergeHighConfidence = async () => {
    if (highConfidenceClusters.length === 0) return;
    if (!window.confirm(`Are you sure you want to automatically merge all ${highConfidenceClusters.length} high-confidence duplicate groups? Contacts and visits will be safely preserved.`)) {
      return;
    }

    setBatchMerging(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    let mergedCount = 0;
    let totalContacts = 0;
    let totalVisits = 0;

    for (const cluster of highConfidenceClusters) {
      const primaryId = selectedPrimaryMap[cluster.id] || cluster.primary.id;
      const allOrgsInCluster = [cluster.primary, ...cluster.duplicates];
      const primaryOrg = allOrgsInCluster.find(o => o.id === primaryId) || cluster.primary;
      const duplicateOrgs = allOrgsInCluster.filter(o => o.id !== primaryId);

      const res = await mergeOrganizations(primaryOrg, duplicateOrgs);
      if (res.success) {
        mergedCount++;
        totalContacts += res.mergedContacts;
        totalVisits += res.mergedVisits;
      }
    }

    setSuccessMessage(`Auto-merged ${mergedCount} duplicate groups! Preserved ${totalContacts} contacts and ${totalVisits} visits.`);
    setBatchMerging(false);
    setTimeout(() => {
      onMerged();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className={cn(
        "border rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] transition-all",
        isDark ? "bg-[#14141B] border-[#2A2A38]" : "bg-white border-slate-200"
      )}>
        {/* Header */}
        <div className={cn(
          "p-6 border-b flex items-center justify-between gap-4",
          isDark ? "border-[#22222E] bg-[#101016]" : "border-slate-100 bg-slate-50"
        )}>
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#F88020]/10 border border-[#F88020]/20 flex items-center justify-center text-[#F88020] shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className={cn("text-lg sm:text-xl font-extrabold tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                  AI & Fuzzy Deduplication Engine
                </h2>
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full text-xs font-bold border",
                  clusters.length > 0
                    ? (isDark ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-amber-50 text-amber-700 border-amber-200")
                    : (isDark ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-emerald-50 text-emerald-700 border-emerald-200")
                )}>
                  {clusters.length} Duplicate Group{clusters.length !== 1 ? 's' : ''} Found
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Detects misspellings, suffix variants (Ltd vs Limited), and similar company records across your entire database.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notifications */}
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

        {/* Summary Metric Bar */}
        <div className={cn(
          "px-6 py-4 border-b flex flex-wrap items-center justify-between gap-4",
          isDark ? "bg-[#181822] border-[#22222E]" : "bg-slate-50/70 border-slate-200"
        )}>
          <div className="flex items-center gap-6 text-xs">
            <div>
              <span className="text-slate-400">Total Analyzed: </span>
              <strong className={isDark ? "text-white" : "text-slate-900"}>{organizations.length} Organizations</strong>
            </div>
            <div>
              <span className="text-slate-400">High Confidence: </span>
              <strong className="text-emerald-500">{highConfidenceClusters.length} Groups</strong>
            </div>
            <div>
              <span className="text-slate-400">Potential Variations: </span>
              <strong className="text-amber-500">{clusters.length - highConfidenceClusters.length} Groups</strong>
            </div>
          </div>

          {highConfidenceClusters.length > 0 && (
            <button
              onClick={handleBatchMergeHighConfidence}
              disabled={batchMerging}
              className="px-4 py-2 rounded-xl bg-[#1848A0] text-white hover:bg-[#003880] text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              {batchMerging ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Merging All...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  1-Click Auto-Merge All High Confidence ({highConfidenceClusters.length})
                </>
              )}
            </button>
          )}
        </div>

        {/* Cluster List */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-4 flex-1">
          {clusters.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-900")}>
                No Duplicate Organizations Detected!
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 max-w-md">
                Your database is completely clean. All company records have unique names, distinct corporate suffixes, and verified identities.
              </p>
              <button
                onClick={onClose}
                className="mt-5 px-5 py-2.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          ) : (
            clusters.map((cluster) => {
              const allOrgsInCluster = [cluster.primary, ...cluster.duplicates];
              const currentPrimaryId = selectedPrimaryMap[cluster.id] || cluster.primary.id;
              const primaryOrg = allOrgsInCluster.find(o => o.id === currentPrimaryId) || cluster.primary;
              const duplicateOrgs = allOrgsInCluster.filter(o => o.id !== currentPrimaryId);

              const isClusterMerging = mergingId === cluster.id;

              return (
                <div
                  key={cluster.id}
                  className={cn(
                    "p-4 sm:p-5 rounded-2xl border transition-all space-y-4 shadow-xs",
                    isDark ? "bg-[#181824] border-[#2A2A38]" : "bg-white border-slate-200"
                  )}
                >
                  {/* Cluster Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700/20">
                    <div className="flex items-center gap-2.5">
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-extrabold border",
                        cluster.confidence === 'HIGH'
                          ? (isDark ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-emerald-50 text-emerald-700 border-emerald-200")
                          : (isDark ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-amber-50 text-amber-700 border-amber-200")
                      )}>
                        {cluster.highestSimilarity}% Match ({cluster.confidence} Confidence)
                      </span>
                      <span className="text-xs text-slate-400 italic">
                        {cluster.reason}
                      </span>
                    </div>

                    <button
                      onClick={() => handleMergeCluster(cluster)}
                      disabled={isClusterMerging}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isClusterMerging ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Merging...
                        </>
                      ) : (
                        <>
                          <Layers className="w-3.5 h-3.5" />
                          Merge into Master
                        </>
                      )}
                    </button>
                  </div>

                  {/* Side-by-Side Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Primary (Survivor) Card */}
                    <div className={cn(
                      "p-4 rounded-xl border relative transition-all",
                      isDark ? "bg-[#121218] border-emerald-500/40" : "bg-emerald-50/40 border-emerald-300"
                    )}>
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase">
                        <Check className="w-3 h-3" />
                        Master Record (Keep)
                      </div>

                      <div className="text-[11px] uppercase font-bold text-emerald-500 mb-1">
                        Primary Record
                      </div>
                      <div className={cn("text-base font-bold", isDark ? "text-white" : "text-slate-900")}>
                        {primaryOrg.name}
                      </div>

                      <div className="mt-3 space-y-1.5 text-xs text-slate-400">
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-purple-400" />
                          <span>{primaryOrg.contacts?.length || 0} Contacts Linked</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{primaryOrg.visits?.length || 0} Field Visits Linked</span>
                        </div>
                        {primaryOrg.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-[#1848A0]" />
                            <span>{primaryOrg.phone}</span>
                          </div>
                        )}
                        {primaryOrg.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-cyan-400" />
                            <span>{primaryOrg.email}</span>
                          </div>
                        )}
                        {primaryOrg.address && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-[#F88020]" />
                            <span className="truncate">{primaryOrg.address}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Duplicate(s) (To Merge) */}
                    <div className={cn(
                      "p-4 rounded-xl border relative transition-all space-y-3",
                      isDark ? "bg-[#121218] border-rose-500/30" : "bg-rose-50/40 border-rose-200"
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] uppercase font-bold text-rose-500">
                          Duplicate Variation(s) (To Merge & Clean)
                        </div>
                      </div>

                      {duplicateOrgs.map((dup) => (
                        <div
                          key={dup.id}
                          className={cn(
                            "p-3 rounded-lg border text-xs",
                            isDark ? "bg-[#1A1A24] border-[#2A2A38]" : "bg-white border-slate-200"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className={cn("font-bold text-sm", isDark ? "text-slate-200" : "text-slate-800")}>
                              {dup.name}
                            </div>
                            <button
                              onClick={() => {
                                setSelectedPrimaryMap(prev => ({
                                  ...prev,
                                  [cluster.id]: dup.id
                                }));
                              }}
                              className="text-[10px] text-[#1848A0] hover:underline font-bold cursor-pointer"
                              title="Make this record the Master instead"
                            >
                              Set as Master
                            </button>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-400">
                            <span>{dup.contacts?.length || 0} Contacts</span>
                            <span>•</span>
                            <span>{dup.visits?.length || 0} Visits</span>
                            {dup.phone && (
                              <>
                                <span>•</span>
                                <span>📞 {dup.phone}</span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}

                      <div className="text-[11px] text-slate-400 flex items-start gap-1.5 pt-1">
                        <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                        <span>All contacts, visit logs, and phone/address details from duplicates will be automatically migrated to the master record before duplicate deletion.</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className={cn(
          "p-4 border-t flex items-center justify-between gap-3",
          isDark ? "border-[#22222E] bg-[#101016]" : "border-slate-100 bg-slate-50"
        )}>
          <div className="text-xs text-slate-400 hidden sm:block">
            Powered by Canonical Legal Normalization & Levenshtein-Jaro Composite Matching.
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 text-slate-200 font-bold hover:bg-slate-700 rounded-xl text-xs transition-colors cursor-pointer ml-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

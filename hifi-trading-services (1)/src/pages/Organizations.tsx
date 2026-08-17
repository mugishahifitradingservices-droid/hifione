import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Search, 
  Plus, 
  Upload, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X, 
  Phone, 
  Mail, 
  Globe, 
  MapPin, 
  Eye, 
  Edit3, 
  Trash2, 
  Users, 
  Calendar, 
  ArrowUpDown, 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  ExternalLink, 
  RefreshCw, 
  Briefcase, 
  TrendingUp, 
  CheckSquare, 
  Square,
  Sparkles,
  SlidersHorizontal,
  UserPlus,
  Clock,
  ShieldAlert,
  Layers,
  FileSpreadsheet,
  GitMerge
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth, getValidUserId } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';
import { downloadOrganizationTemplate, parseExcelFile, exportOrganizationsToExcel, ExcelOrgRow } from '../lib/excel';
import { OrganizationsSkeleton } from '../components/ui/Skeleton';
import { Contact, PlannedVisit, FollowUp } from '../types';
import { DuplicateScannerModal } from '../components/organizations/DuplicateScannerModal';
import { MergeOrganizationModal } from '../components/organizations/MergeOrganizationModal';
import { detectAllDuplicateClusters, findDuplicateCandidates, calculateCompanySimilarity } from '../lib/deduplication';

export interface OrganizationRecord {
  id: string;
  name: string;
  type_of_business?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  district?: string;
  created_at?: string;
  created_by?: string;
  contacts?: Contact[];
  visits?: PlannedVisit[];
  follow_ups?: FollowUp[];
}

type SortField = 'name' | 'created_at' | 'type_of_business' | 'contacts_count' | 'visits_count';
type SortOrder = 'asc' | 'desc';

// Helper to determine sector badge styling
const getSectorBadgeStyle = (type?: string, isDark?: boolean) => {
  const t = (type || '').toLowerCase();
  if (t.includes('health') || t.includes('med') || t.includes('pharma') || t.includes('clinic') || t.includes('hospital')) {
    return isDark 
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
      : "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (t.includes('distrib') || t.includes('wholesal') || t.includes('trad') || t.includes('fmcg')) {
    return isDark 
      ? "bg-blue-500/10 text-blue-400 border-blue-500/20" 
      : "bg-blue-50 text-blue-700 border-blue-200";
  }
  if (t.includes('gov') || t.includes('ministry') || t.includes('public') || t.includes('agency')) {
    return isDark 
      ? "bg-purple-500/10 text-purple-400 border-purple-500/20" 
      : "bg-purple-50 text-purple-700 border-purple-200";
  }
  if (t.includes('bank') || t.includes('financ') || t.includes('insur')) {
    return isDark 
      ? "bg-amber-500/10 text-amber-400 border-amber-500/20" 
      : "bg-amber-50 text-amber-700 border-amber-200";
  }
  if (t.includes('tech') || t.includes('soft') || t.includes('it ') || t.includes('telecom')) {
    return isDark 
      ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" 
      : "bg-cyan-50 text-cyan-700 border-cyan-200";
  }
  return isDark 
    ? "bg-slate-500/10 text-slate-300 border-slate-500/20" 
    : "bg-slate-100 text-slate-700 border-slate-200";
};

// Avatar color generator
const getAvatarColor = (name: string) => {
  const colors = [
    { bg: 'bg-[#1848A0]/10', border: 'border-[#1848A0]/20', text: 'text-[#1848A0]' },
    { bg: 'bg-[#F88020]/10', border: 'border-[#F88020]/20', text: 'text-[#F88020]' },
    { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-500' },
    { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-500' },
    { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-500' },
    { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-500' },
  ];
  const charCode = (name || 'A').charCodeAt(0);
  return colors[charCode % colors.length];
};

export default function Organizations() {
  const { user, appUser } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [visits, setVisits] = useState<PlannedVisit[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [activityFilter, setActivityFilter] = useState<'ALL' | 'WITH_CONTACTS' | 'WITH_VISITS' | 'NO_VISITS'>('ALL');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals & Drawers
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDuplicateScannerOpen, setIsDuplicateScannerOpen] = useState(false);
  const [mergingSourceOrg, setMergingSourceOrg] = useState<OrganizationRecord | null>(null);
  const [selectedOrgForDetails, setSelectedOrgForDetails] = useState<OrganizationRecord | null>(null);
  const [editingOrg, setEditingOrg] = useState<OrganizationRecord | null>(null);
  const [deletingOrg, setDeletingOrg] = useState<OrganizationRecord | null>(null);
  const [addingContactForOrg, setAddingContactForOrg] = useState<OrganizationRecord | null>(null);

  const isAdminOrManager = appUser?.role === 'SYSTEM_ADMIN' || appUser?.role === 'CEO' || appUser?.role === 'MARKETING_MANAGER';

  // Compute fuzzy duplicate clusters across all accounts
  const duplicateClusters = useMemo(() => {
    return detectAllDuplicateClusters(organizations);
  }, [organizations]);

  const fetchData = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const [orgsRes, contactsRes, visitsRes, followUpsRes] = await Promise.all([
        supabase.from('organizations').select('*').order('created_at', { ascending: false }),
        supabase.from('contacts').select('*'),
        supabase.from('planned_visits').select('*'),
        supabase.from('follow_ups').select('*')
      ]);

      const orgsData = orgsRes.data || [];
      const contactsData = contactsRes.data || [];
      const visitsData = visitsRes.data || [];
      const followUpsData = followUpsRes.data || [];

      setContacts(contactsData);
      setVisits(visitsData);
      setFollowUps(followUpsData);

      // Join relations
      const enrichedOrgs: OrganizationRecord[] = orgsData.map(org => ({
        ...org,
        contacts: contactsData.filter(c => c.organization_id === org.id),
        visits: visitsData.filter(v => v.organization_id === org.id),
        follow_ups: followUpsData.filter(f => f.organization_id === org.id)
      }));

      setOrganizations(enrichedOrgs);

      // Update selectedOrgForDetails if open
      if (selectedOrgForDetails) {
        const updated = enrichedOrgs.find(o => o.id === selectedOrgForDetails.id);
        if (updated) setSelectedOrgForDetails(updated);
      }
    } catch (err) {
      console.warn('Error fetching organizations data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Unique sector list
  const uniqueSectors = useMemo(() => {
    const set = new Set<string>();
    organizations.forEach(o => {
      if (o.type_of_business && o.type_of_business.trim() !== '') {
        set.add(o.type_of_business.trim());
      }
    });
    return Array.from(set).sort();
  }, [organizations]);

  // Filtered & Sorted Orgs
  const processedOrgs = useMemo(() => {
    return organizations.filter(org => {
      // Search
      const q = search.toLowerCase().trim();
      const matchesSearch = !q || (
        org.name.toLowerCase().includes(q) ||
        (org.type_of_business && org.type_of_business.toLowerCase().includes(q)) ||
        (org.phone && org.phone.toLowerCase().includes(q)) ||
        (org.email && org.email.toLowerCase().includes(q)) ||
        (org.address && org.address.toLowerCase().includes(q)) ||
        (org.city && org.city.toLowerCase().includes(q)) ||
        org.contacts?.some(c => c.name.toLowerCase().includes(q) || (c.email && c.email.toLowerCase().includes(q)))
      );

      // Sector Filter
      const matchesSector = selectedSector === 'ALL' || org.type_of_business === selectedSector;

      // Activity Filter
      let matchesActivity = true;
      if (activityFilter === 'WITH_CONTACTS') {
        matchesActivity = (org.contacts?.length || 0) > 0;
      } else if (activityFilter === 'WITH_VISITS') {
        matchesActivity = (org.visits?.length || 0) > 0;
      } else if (activityFilter === 'NO_VISITS') {
        matchesActivity = (org.visits?.length || 0) === 0;
      }

      return matchesSearch && matchesSector && matchesActivity;
    }).sort((a, b) => {
      let valA: any = a.name.toLowerCase();
      let valB: any = b.name.toLowerCase();

      if (sortField === 'created_at') {
        valA = a.created_at ? new Date(a.created_at).getTime() : 0;
        valB = b.created_at ? new Date(b.created_at).getTime() : 0;
      } else if (sortField === 'type_of_business') {
        valA = (a.type_of_business || '').toLowerCase();
        valB = (b.type_of_business || '').toLowerCase();
      } else if (sortField === 'contacts_count') {
        valA = a.contacts?.length || 0;
        valB = b.contacts?.length || 0;
      } else if (sortField === 'visits_count') {
        valA = a.visits?.length || 0;
        valB = b.visits?.length || 0;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [organizations, search, selectedSector, activityFilter, sortField, sortOrder]);

  // Paginated records
  const totalPages = Math.ceil(processedOrgs.length / pageSize) || 1;
  const paginatedOrgs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedOrgs.slice(start, start + pageSize);
  }, [processedOrgs, currentPage, pageSize]);

  // Adjust page if out of bounds
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  // Multi-select handlers
  const handleSelectAll = () => {
    if (selectedIds.size === paginatedOrgs.length && paginatedOrgs.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedOrgs.map(o => o.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleExportSelected = () => {
    const orgsToExport = organizations.filter(o => selectedIds.has(o.id));
    if (orgsToExport.length === 0) return;
    exportOrganizationsToExcel(orgsToExport, `HIFI_ONE_Selected_Organizations_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleExportAll = () => {
    exportOrganizationsToExcel(processedOrgs, `HIFI_ONE_Organizations_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // High level KPI calculations
  const totalOrganizations = organizations.length;
  const totalSectorsCount = uniqueSectors.length;
  const totalLinkedContacts = contacts.length;
  const totalCompletedVisits = visits.filter(v => v.status === 'COMPLETED').length;

  if (loading) {
    return <OrganizationsSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className={cn("text-2xl sm:text-3xl font-extrabold tracking-tight", isDark ? "text-white" : "text-slate-900")}>
              Organizations & Accounts
            </h1>
            <span className={cn(
              "px-2.5 py-0.5 rounded-full text-xs font-bold border",
              isDark ? "bg-[#1848A0]/15 text-blue-400 border-blue-500/20" : "bg-blue-50 text-[#1848A0] border-blue-200"
            )}>
              {organizations.length} Total
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Enterprise database of client organizations, distributors, healthcare institutions, and business accounts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className={cn(
              "p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border shadow-xs cursor-pointer",
              isDark ? "bg-[#1A1A24] border-[#2A2A38] text-slate-300 hover:bg-[#252535]" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            )}
            title="Refresh Data"
          >
            <RefreshCw className={cn("w-4 h-4 text-slate-400", refreshing && "animate-spin text-[#1848A0]")} />
          </button>

          <button
            onClick={() => setIsDuplicateScannerOpen(true)}
            className={cn(
              "px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border shadow-xs cursor-pointer",
              duplicateClusters.length > 0
                ? (isDark ? "bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25" : "bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100")
                : (isDark ? "bg-[#1A1A24] border-[#2A2A38] text-slate-300 hover:bg-[#252535]" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50")
            )}
            title="Scan, detect and merge duplicate organizations"
          >
            <Sparkles className={cn("w-4 h-4", duplicateClusters.length > 0 ? "text-amber-400 animate-pulse" : "text-[#F88020]")} />
            <span>
              {duplicateClusters.length > 0 ? `Duplicates (${duplicateClusters.length})` : 'Deduplicate'}
            </span>
          </button>

          <button
            onClick={downloadOrganizationTemplate}
            className={cn(
              "px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border shadow-xs cursor-pointer",
              isDark ? "bg-[#1A1A24] border-[#2A2A38] text-slate-300 hover:bg-[#252535]" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            )}
            title="Download Excel Template"
          >
            <Download className="w-4 h-4 text-[#F88020]" />
            <span className="hidden sm:inline">Template</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className={cn(
              "px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border shadow-xs cursor-pointer",
              isDark ? "bg-[#1A1A24] border-[#2A2A38] text-slate-300 hover:bg-[#252535]" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            )}
          >
            <Upload className="w-4 h-4 text-[#1848A0]" />
            <span>Import</span>
          </button>

          <button
            onClick={handleExportAll}
            className={cn(
              "px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border shadow-xs cursor-pointer",
              isDark ? "bg-[#1A1A24] border-[#2A2A38] text-slate-300 hover:bg-[#252535]" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            )}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span>Export ({processedOrgs.length})</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-[#1848A0] hover:bg-[#003880] text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Organization</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className={cn(
          "p-4 rounded-2xl border transition-all flex items-center gap-3.5 shadow-xs",
          isDark ? "bg-[#14141B] border-[#22222E]" : "bg-white border-slate-200/80"
        )}>
          <div className="w-11 h-11 rounded-xl bg-[#1848A0]/10 border border-[#1848A0]/20 flex items-center justify-center text-[#1848A0] shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Accounts</div>
            <div className={cn("text-xl font-extrabold tracking-tight", isDark ? "text-white" : "text-slate-900")}>
              {totalOrganizations}
            </div>
          </div>
        </div>

        <div className={cn(
          "p-4 rounded-2xl border transition-all flex items-center gap-3.5 shadow-xs",
          isDark ? "bg-[#14141B] border-[#22222E]" : "bg-white border-slate-200/80"
        )}>
          <div className="w-11 h-11 rounded-xl bg-[#F88020]/10 border border-[#F88020]/20 flex items-center justify-center text-[#F88020] shrink-0">
            <Briefcase className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Industry Sectors</div>
            <div className={cn("text-xl font-extrabold tracking-tight", isDark ? "text-white" : "text-slate-900")}>
              {totalSectorsCount} Active
            </div>
          </div>
        </div>

        <div className={cn(
          "p-4 rounded-2xl border transition-all flex items-center gap-3.5 shadow-xs",
          isDark ? "bg-[#14141B] border-[#22222E]" : "bg-white border-slate-200/80"
        )}>
          <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Linked Contacts</div>
            <div className={cn("text-xl font-extrabold tracking-tight", isDark ? "text-white" : "text-slate-900")}>
              {totalLinkedContacts} People
            </div>
          </div>
        </div>

        <div className={cn(
          "p-4 rounded-2xl border transition-all flex items-center gap-3.5 shadow-xs",
          isDark ? "bg-[#14141B] border-[#22222E]" : "bg-white border-slate-200/80"
        )}>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Visits Completed</div>
            <div className={cn("text-xl font-extrabold tracking-tight", isDark ? "text-white" : "text-slate-900")}>
              {totalCompletedVisits} Sessions
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Data Table Container */}
      <div className={cn(
        "rounded-2xl border shadow-sm overflow-hidden transition-all",
        isDark ? "bg-[#14141B] border-[#22222E]" : "bg-white border-slate-200"
      )}>
        {/* Table Filter & Search Controls */}
        <div className={cn("p-4 border-b space-y-3.5", isDark ? "border-[#22222E] bg-[#121218]" : "border-slate-100 bg-slate-50/50")}>
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by company name, contact, sector, phone, email, address..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className={cn(
                  "w-full pl-10 pr-10 py-2.5 rounded-xl border text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#1848A0]",
                  isDark 
                    ? "bg-[#0A0A0D] border-[#2A2A38] text-white placeholder-slate-500" 
                    : "bg-white border-slate-200 text-slate-900 placeholder-slate-400"
                )}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Sector Filter */}
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedSector}
                  onChange={(e) => {
                    setSelectedSector(e.target.value);
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "px-3 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1848A0] cursor-pointer",
                    isDark 
                      ? "bg-[#0A0A0D] border-[#2A2A38] text-slate-200" 
                      : "bg-white border-slate-200 text-slate-700"
                  )}
                >
                  <option value="ALL">All Sectors ({uniqueSectors.length})</option>
                  {uniqueSectors.map(sec => (
                    <option key={sec} value={sec}>{sec}</option>
                  ))}
                </select>
              </div>

              {/* Activity Filter */}
              <select
                value={activityFilter}
                onChange={(e: any) => {
                  setActivityFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className={cn(
                  "px-3 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1848A0] cursor-pointer",
                  isDark 
                    ? "bg-[#0A0A0D] border-[#2A2A38] text-slate-200" 
                    : "bg-white border-slate-200 text-slate-700"
                )}
              >
                <option value="ALL">All Activity</option>
                <option value="WITH_CONTACTS">Has Contacts</option>
                <option value="WITH_VISITS">Has Field Visits</option>
                <option value="NO_VISITS">Needs First Visit</option>
              </select>

              {/* Rows Per Page */}
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className={cn(
                  "px-3 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1848A0] cursor-pointer",
                  isDark 
                    ? "bg-[#0A0A0D] border-[#2A2A38] text-slate-200" 
                    : "bg-white border-slate-200 text-slate-700"
                )}
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>
          </div>

          {/* Active selection bar */}
          {selectedIds.size > 0 && (
            <div className={cn(
              "p-2.5 px-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold transition-all animate-fadeIn",
              isDark ? "bg-[#1848A0]/15 border-blue-500/30 text-blue-300" : "bg-blue-50 border-blue-200 text-blue-800"
            )}>
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-[#1848A0]" />
                <span>{selectedIds.size} organization{selectedIds.size > 1 ? 's' : ''} selected</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportSelected}
                  className="px-3 py-1.5 rounded-lg bg-[#1848A0] text-white hover:bg-[#003880] text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Export Selected
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs transition-colors cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 4. The Informative Enterprise Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={cn(
                "text-[11px] uppercase tracking-wider font-bold border-b",
                isDark ? "bg-[#161620] border-[#22222E] text-slate-400" : "bg-slate-100 border-slate-200 text-slate-600"
              )}>
                <th className="px-4 py-3.5 w-10 text-center">
                  <button 
                    onClick={handleSelectAll}
                    className="cursor-pointer text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {selectedIds.size === paginatedOrgs.length && paginatedOrgs.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-[#1848A0]" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                
                {/* Organization Identity */}
                <th className="px-5 py-3.5">
                  <button 
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200 transition-colors group"
                  >
                    <span>Organization</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
                  </button>
                </th>

                {/* Sector / Type */}
                <th className="px-4 py-3.5">
                  <button 
                    onClick={() => handleSort('type_of_business')}
                    className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200 transition-colors group"
                  >
                    <span>Sector / Industry</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
                  </button>
                </th>

                {/* Contact Channels */}
                <th className="px-4 py-3.5">Contact Channels</th>

                {/* Key Contacts */}
                <th className="px-4 py-3.5">
                  <button 
                    onClick={() => handleSort('contacts_count')}
                    className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200 transition-colors group"
                  >
                    <span>Contacts</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
                  </button>
                </th>

                {/* Field Activity / Visits */}
                <th className="px-4 py-3.5">
                  <button 
                    onClick={() => handleSort('visits_count')}
                    className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200 transition-colors group"
                  >
                    <span>Field Engagement</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
                  </button>
                </th>

                {/* Location */}
                <th className="px-4 py-3.5">Location</th>

                {/* Actions */}
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            
            <tbody className={cn("divide-y text-xs", isDark ? "divide-[#22222E]" : "divide-slate-100")}>
              {paginatedOrgs.map((org) => {
                const isSelected = selectedIds.has(org.id);
                const avatarTheme = getAvatarColor(org.name);
                const contactsCount = org.contacts?.length || 0;
                const visitsCount = org.visits?.length || 0;
                const completedVisits = org.visits?.filter(v => v.status === 'COMPLETED').length || 0;
                
                // Get latest visit
                const lastVisit = org.visits && org.visits.length > 0 
                  ? [...org.visits].sort((a, b) => new Date(b.planned_date).getTime() - new Date(a.planned_date).getTime())[0]
                  : null;

                return (
                  <tr 
                    key={org.id} 
                    className={cn(
                      "transition-colors duration-150 group",
                      isSelected 
                        ? (isDark ? "bg-[#1848A0]/10" : "bg-blue-50/60") 
                        : (isDark ? "hover:bg-[#1A1A24]" : "hover:bg-slate-50")
                    )}
                  >
                    {/* Select Checkbox */}
                    <td className="px-4 py-3.5 text-center">
                      <button 
                        onClick={() => handleToggleSelect(org.id)}
                        className="cursor-pointer text-slate-400 hover:text-slate-200"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#1848A0]" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>

                    {/* Organization Name & Web Identity */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl border flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs",
                          avatarTheme.bg, avatarTheme.border, avatarTheme.text
                        )}>
                          {org.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <button
                            onClick={() => setSelectedOrgForDetails(org)}
                            className={cn(
                              "font-bold text-sm text-left truncate block hover:text-[#1848A0] transition-colors cursor-pointer",
                              isDark ? "text-white" : "text-slate-900"
                            )}
                            title={org.name}
                          >
                            {org.name}
                          </button>
                          
                          <div className="flex items-center gap-2 mt-0.5 text-slate-400 text-[11px]">
                            {org.website ? (
                              <a
                                href={org.website.startsWith('http') ? org.website : `https://${org.website}`}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:text-[#1848A0] flex items-center gap-1 transition-colors truncate max-w-[140px]"
                                title={org.website}
                              >
                                <Globe className="w-3 h-3 shrink-0" />
                                <span>{org.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                              </a>
                            ) : (
                              org.created_at && <span>Added {format(new Date(org.created_at), 'MMM yyyy')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Sector Badge */}
                    <td className="px-4 py-3.5">
                      {org.type_of_business ? (
                        <span className={cn(
                          "inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border",
                          getSectorBadgeStyle(org.type_of_business, isDark)
                        )}>
                          {org.type_of_business}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic text-[11px]">Unspecified</span>
                      )}
                    </td>

                    {/* Direct Contact Channels */}
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        {org.phone ? (
                          <a 
                            href={`tel:${org.phone}`}
                            className={cn(
                              "flex items-center gap-1.5 font-medium hover:text-[#1848A0] transition-colors",
                              isDark ? "text-slate-300" : "text-slate-700"
                            )}
                          >
                            <Phone className="w-3 h-3 text-[#1848A0] shrink-0" />
                            <span>{org.phone}</span>
                          </a>
                        ) : null}

                        {org.email ? (
                          <a 
                            href={`mailto:${org.email}`}
                            className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-[#1848A0] transition-colors truncate max-w-[170px]"
                            title={org.email}
                          >
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{org.email}</span>
                          </a>
                        ) : null}

                        {!org.phone && !org.email && (
                          <span className="text-slate-500 italic text-[11px]">No contact info</span>
                        )}
                      </div>
                    </td>

                    {/* Linked Contacts */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedOrgForDetails(org)}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer",
                            contactsCount > 0
                              ? (isDark ? "bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20" : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100")
                              : (isDark ? "bg-[#1A1A24] text-slate-500 border-[#2A2A38]" : "bg-slate-100 text-slate-400 border-slate-200")
                          )}
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>{contactsCount} Contact{contactsCount !== 1 ? 's' : ''}</span>
                        </button>

                        <button
                          onClick={() => setAddingContactForOrg(org)}
                          className="p-1 rounded-md text-slate-400 hover:text-[#1848A0] hover:bg-[#1848A0]/10 transition-colors cursor-pointer"
                          title="Add new contact to this organization"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Field Engagement */}
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "px-2 py-0.5 rounded-md text-[10px] font-extrabold border",
                            completedVisits > 0 
                              ? (isDark ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-emerald-50 text-emerald-700 border-emerald-200")
                              : (isDark ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-amber-50 text-amber-700 border-amber-200")
                          )}>
                            {completedVisits} of {visitsCount} Visits Done
                          </span>
                        </div>

                        {lastVisit && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            <span>Last: {format(new Date(lastVisit.planned_date), 'MMM d, yyyy')}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Location */}
                    <td className="px-4 py-3.5 text-slate-400">
                      {org.address ? (
                        <div className="flex items-start gap-1.5 max-w-[180px]">
                          <MapPin className="w-3 h-3 text-[#F88020] shrink-0 mt-0.5" />
                          <span className="truncate" title={org.address}>{org.address}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic text-[11px]">-</span>
                      )}
                    </td>

                    {/* Action Hub */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedOrgForDetails(org)}
                          className={cn(
                            "p-1.5 rounded-lg border transition-colors cursor-pointer",
                            isDark 
                              ? "bg-[#1A1A24] border-[#2A2A38] text-slate-300 hover:text-white hover:bg-[#252535]" 
                              : "bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-200"
                          )}
                          title="View 360° Organization Profile"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#1848A0]" />
                        </button>

                        <button
                          onClick={() => setMergingSourceOrg(org)}
                          className={cn(
                            "p-1.5 rounded-lg border transition-colors cursor-pointer",
                            isDark 
                              ? "bg-[#1A1A24] border-[#2A2A38] text-slate-300 hover:text-indigo-400 hover:bg-[#252535]" 
                              : "bg-slate-100 border-slate-200 text-slate-700 hover:text-indigo-600 hover:bg-slate-200"
                          )}
                          title="Merge with duplicate organization"
                        >
                          <GitMerge className="w-3.5 h-3.5 text-indigo-400" />
                        </button>

                        <button
                          onClick={() => setEditingOrg(org)}
                          className={cn(
                            "p-1.5 rounded-lg border transition-colors cursor-pointer",
                            isDark 
                              ? "bg-[#1A1A24] border-[#2A2A38] text-slate-300 hover:text-white hover:bg-[#252535]" 
                              : "bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-200"
                          )}
                          title="Edit Organization Details"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#F88020]" />
                        </button>

                        {isAdminOrManager && (
                          <button
                            onClick={() => setDeletingOrg(org)}
                            className="p-1.5 rounded-lg border border-rose-500/20 text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Delete Organization"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paginatedOrgs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-[#1848A0]/10 border border-[#1848A0]/20 flex items-center justify-center text-[#1848A0] mb-3">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <h3 className={cn("text-base font-bold", isDark ? "text-white" : "text-slate-900")}>
                        No organizations found
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 mb-4">
                        {search || selectedSector !== 'ALL' || activityFilter !== 'ALL'
                          ? "No organizations match your current search or filter criteria. Try clearing filters."
                          : "Your organization directory is currently empty. Add your first organization or import an Excel spreadsheet."}
                      </p>
                      <div className="flex items-center gap-2.5">
                        {search || selectedSector !== 'ALL' || activityFilter !== 'ALL' ? (
                          <button
                            onClick={() => {
                              setSearch('');
                              setSelectedSector('ALL');
                              setActivityFilter('ALL');
                            }}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#1848A0] text-white hover:bg-[#003880] transition-colors cursor-pointer"
                          >
                            Clear All Filters
                          </button>
                        ) : (
                          <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1848A0] text-white hover:bg-[#003880] transition-colors cursor-pointer flex items-center gap-1.5 shadow-md"
                          >
                            <Plus className="w-4 h-4" />
                            Add Organization
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Responsive Mobile Cards View (shown on md:hidden) */}
        <div className="block md:hidden divide-y divide-slate-800/40">
          {paginatedOrgs.map((org) => {
            const isSelected = selectedIds.has(org.id);
            const avatarTheme = getAvatarColor(org.name);
            const contactsCount = org.contacts?.length || 0;
            const visitsCount = org.visits?.length || 0;
            const completedVisits = org.visits?.filter(v => v.status === 'COMPLETED').length || 0;

            return (
              <div 
                key={org.id} 
                className={cn(
                  "p-4 space-y-3 transition-colors",
                  isSelected 
                    ? (isDark ? "bg-[#1848A0]/15" : "bg-blue-50") 
                    : (isDark ? "bg-[#14141B]" : "bg-white")
                )}
              >
                {/* Header info */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <button 
                      onClick={() => handleToggleSelect(org.id)}
                      className="cursor-pointer text-slate-400 hover:text-slate-200 shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-[#1848A0]" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <div className={cn(
                      "w-10 h-10 rounded-xl border flex items-center justify-center font-bold text-sm shrink-0",
                      avatarTheme.bg, avatarTheme.border, avatarTheme.text
                    )}>
                      {org.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <button
                        onClick={() => setSelectedOrgForDetails(org)}
                        className={cn(
                          "font-bold text-sm text-left truncate block hover:text-[#1848A0] transition-colors cursor-pointer",
                          isDark ? "text-white" : "text-slate-900"
                        )}
                      >
                        {org.name}
                      </button>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {org.type_of_business && (
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border",
                            getSectorBadgeStyle(org.type_of_business, isDark)
                          )}>
                            {org.type_of_business}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Direct Communications */}
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-1">
                  {org.phone ? (
                    <a href={`tel:${org.phone}`} className="flex items-center gap-1.5 hover:text-[#1848A0] truncate">
                      <Phone className="w-3 h-3 text-[#1848A0] shrink-0" />
                      <span className="truncate">{org.phone}</span>
                    </a>
                  ) : (
                    <span className="text-slate-500 italic text-[11px]">No phone</span>
                  )}

                  {org.email ? (
                    <a href={`mailto:${org.email}`} className="flex items-center gap-1.5 hover:text-[#1848A0] truncate">
                      <Mail className="w-3 h-3 text-purple-400 shrink-0" />
                      <span className="truncate">{org.email}</span>
                    </a>
                  ) : (
                    <span className="text-slate-500 italic text-[11px]">No email</span>
                  )}
                </div>

                {org.address && (
                  <div className="flex items-start gap-1.5 text-xs text-slate-400">
                    <MapPin className="w-3 h-3 text-[#F88020] shrink-0 mt-0.5" />
                    <span className="truncate">{org.address}</span>
                  </div>
                )}

                {/* Engagement & Actions Bar */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/30">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedOrgForDetails(org)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 cursor-pointer",
                        contactsCount > 0
                          ? (isDark ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : "bg-purple-50 text-purple-700 border-purple-200")
                          : (isDark ? "bg-[#181822] text-slate-500 border-[#2A2A38]" : "bg-slate-100 text-slate-400 border-slate-200")
                      )}
                    >
                      <Users className="w-3 h-3" />
                      <span>{contactsCount}</span>
                    </button>

                    <span className={cn(
                      "px-2 py-1 rounded-lg text-[10px] font-bold border",
                      completedVisits > 0 
                        ? (isDark ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-emerald-50 text-emerald-700 border-emerald-200")
                        : (isDark ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-amber-50 text-amber-700 border-amber-200")
                    )}>
                      {completedVisits}/{visitsCount} Visits
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSelectedOrgForDetails(org)}
                      className="p-1.5 rounded-lg border border-slate-700/40 text-slate-300 hover:text-white bg-slate-800/50 cursor-pointer"
                      title="View Details"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#1848A0]" />
                    </button>
                    <button
                      onClick={() => setMergingSourceOrg(org)}
                      className="p-1.5 rounded-lg border border-slate-700/40 text-slate-300 hover:text-indigo-400 bg-slate-800/50 cursor-pointer"
                      title="Merge Duplicates"
                    >
                      <GitMerge className="w-3.5 h-3.5 text-indigo-400" />
                    </button>
                    <button
                      onClick={() => setEditingOrg(org)}
                      className="p-1.5 rounded-lg border border-slate-700/40 text-slate-300 hover:text-[#F88020] bg-slate-800/50 cursor-pointer"
                      title="Edit"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#F88020]" />
                    </button>
                    {isAdminOrManager && (
                      <button
                        onClick={() => setDeletingOrg(org)}
                        className="p-1.5 rounded-lg border border-rose-500/20 text-rose-500 hover:bg-rose-500/10 bg-slate-800/50 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {paginatedOrgs.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400">
              No organizations found matching search criteria.
            </div>
          )}
        </div>

        {/* 5. Pagination Footer */}
        <div className={cn(
          "p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold",
          isDark ? "border-[#22222E] bg-[#121218] text-slate-400" : "border-slate-100 bg-slate-50/50 text-slate-600"
        )}>
          <div>
            Showing <span className={isDark ? "text-white" : "text-slate-900"}>{processedOrgs.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> to{' '}
            <span className={isDark ? "text-white" : "text-slate-900"}>{Math.min(currentPage * pageSize, processedOrgs.length)}</span> of{' '}
            <span className={isDark ? "text-white" : "text-slate-900"}>{processedOrgs.length}</span> organizations
            {processedOrgs.length !== organizations.length && ` (filtered from ${organizations.length})`}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={cn(
                "p-2 rounded-xl border flex items-center gap-1 transition-all disabled:opacity-40 cursor-pointer",
                isDark ? "bg-[#1A1A24] border-[#2A2A38] hover:bg-[#252535] text-slate-300" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
              )}
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Previous</span>
            </button>

            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum = i + 1;
                if (totalPages > 5 && currentPage > 3) {
                  pageNum = currentPage - 2 + i;
                  if (pageNum > totalPages) pageNum = totalPages - 4 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={cn(
                      "w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer",
                      currentPage === pageNum
                        ? "bg-[#1848A0] text-white shadow-xs"
                        : (isDark ? "hover:bg-[#252535] text-slate-400" : "hover:bg-slate-100 text-slate-600")
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage >= totalPages}
              className={cn(
                "p-2 rounded-xl border flex items-center gap-1 transition-all disabled:opacity-40 cursor-pointer",
                isDark ? "bg-[#1A1A24] border-[#2A2A38] hover:bg-[#252535] text-slate-300" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
              )}
            >
              <span className="hidden sm:inline text-xs">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* MODALS */}

      {/* 1. Add Organization Modal with duplicate prevention */}
      {isAddModalOpen && (
        <AddOrganizationModal 
          allOrganizations={organizations}
          onClose={() => {
            setIsAddModalOpen(false);
            fetchData(true);
          }} 
          onUseExisting={(existingOrg) => {
            setIsAddModalOpen(false);
            setSelectedOrgForDetails(existingOrg);
          }}
        />
      )}

      {/* 2. Edit Organization Modal with duplicate alert */}
      {editingOrg && (
        <EditOrganizationModal
          organization={editingOrg}
          allOrganizations={organizations}
          onClose={() => {
            setEditingOrg(null);
            fetchData(true);
          }}
        />
      )}

      {/* 3. Delete Confirmation Modal */}
      {deletingOrg && (
        <DeleteOrganizationModal
          organization={deletingOrg}
          onClose={() => {
            setDeletingOrg(null);
            fetchData(true);
          }}
        />
      )}

      {/* 4. Import Excel Modal with duplicate detection */}
      {isImportModalOpen && (
        <ImportOrganizationsModal 
          existingOrganizations={organizations}
          onClose={() => {
            setIsImportModalOpen(false);
            fetchData(true);
          }} 
        />
      )}

      {/* 5. Organization 360° Profile Drawer / Modal */}
      {selectedOrgForDetails && (
        <OrganizationDetailsDrawer
          organization={selectedOrgForDetails}
          onClose={() => setSelectedOrgForDetails(null)}
          onAddContact={() => {
            setAddingContactForOrg(selectedOrgForDetails);
          }}
          onEdit={() => {
            setEditingOrg(selectedOrgForDetails);
          }}
          onMerge={() => {
            const orgToMerge = selectedOrgForDetails;
            setSelectedOrgForDetails(null);
            setMergingSourceOrg(orgToMerge);
          }}
        />
      )}

      {/* 6. Quick Add Contact to Organization Modal */}
      {addingContactForOrg && (
        <QuickAddContactModal
          organization={addingContactForOrg}
          onClose={() => {
            setAddingContactForOrg(null);
            fetchData(true);
          }}
        />
      )}

      {/* 7. Duplicate Scanner & Deduplication Center */}
      {isDuplicateScannerOpen && (
        <DuplicateScannerModal
          organizations={organizations}
          onClose={() => setIsDuplicateScannerOpen(false)}
          onMerged={() => {
            fetchData(true);
          }}
        />
      )}

      {/* 8. Dedicated Merge Account Modal */}
      {mergingSourceOrg && (
        <MergeOrganizationModal
          sourceOrg={mergingSourceOrg}
          allOrganizations={organizations}
          onClose={() => setMergingSourceOrg(null)}
          onMerged={() => {
            setMergingSourceOrg(null);
            fetchData(true);
          }}
        />
      )}
    </div>
  );
}

/* ==========================================================================
   360° ORGANIZATION DETAILS DRAWER / MODAL
   ========================================================================== */
function OrganizationDetailsDrawer({
  organization,
  onClose,
  onAddContact,
  onEdit,
  onMerge
}: {
  organization: OrganizationRecord;
  onClose: () => void;
  onAddContact: () => void;
  onEdit: () => void;
  onMerge?: () => void;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'CONTACTS' | 'VISITS' | 'TASKS'>('OVERVIEW');
  const avatarColor = getAvatarColor(organization.name);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className={cn(
        "border rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] transition-all",
        isDark ? "bg-[#14141B] border-[#2A2A38]" : "bg-white border-slate-200"
      )}>
        {/* Drawer Header */}
        <div className={cn("p-6 border-b flex items-start justify-between gap-4", isDark ? "border-[#22222E] bg-[#121218]" : "border-slate-100 bg-slate-50")}>
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-14 h-14 rounded-2xl border flex items-center justify-center text-xl font-black shadow-md shrink-0",
              avatarColor.bg, avatarColor.border, avatarColor.text
            )}>
              {organization.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className={cn("text-xl font-extrabold tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                  {organization.name}
                </h2>
                {organization.type_of_business && (
                  <span className={cn("px-2.5 py-0.5 rounded-lg text-xs font-bold border", getSectorBadgeStyle(organization.type_of_business, isDark))}>
                    {organization.type_of_business}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                <span>Account ID: {organization.id.slice(0, 8)}...</span>
                <span>•</span>
                <span>Added {organization.created_at ? format(new Date(organization.created_at), 'PPP') : 'Unknown date'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onMerge && (
              <button
                onClick={onMerge}
                className="p-2 rounded-xl border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                title="Merge duplicate record"
              >
                <GitMerge className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onEdit}
              className="p-2 rounded-xl border border-slate-700/30 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Edit details"
            >
              <Edit3 className="w-4 h-4 text-[#F88020]" />
            </button>
            <button 
              onClick={onClose} 
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className={cn("px-6 border-b flex items-center gap-2 text-xs font-bold", isDark ? "border-[#22222E] bg-[#101016]" : "border-slate-100 bg-white")}>
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={cn(
              "py-3 px-3.5 border-b-2 transition-all cursor-pointer flex items-center gap-1.5",
              activeTab === 'OVERVIEW'
                ? "border-[#1848A0] text-[#1848A0]"
                : "border-transparent text-slate-400 hover:text-slate-200"
            )}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Profile & Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('CONTACTS')}
            className={cn(
              "py-3 px-3.5 border-b-2 transition-all cursor-pointer flex items-center gap-1.5",
              activeTab === 'CONTACTS'
                ? "border-[#1848A0] text-[#1848A0]"
                : "border-transparent text-slate-400 hover:text-slate-200"
            )}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Contacts ({organization.contacts?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('VISITS')}
            className={cn(
              "py-3 px-3.5 border-b-2 transition-all cursor-pointer flex items-center gap-1.5",
              activeTab === 'VISITS'
                ? "border-[#1848A0] text-[#1848A0]"
                : "border-transparent text-slate-400 hover:text-slate-200"
            )}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Field Visits ({organization.visits?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('TASKS')}
            className={cn(
              "py-3 px-3.5 border-b-2 transition-all cursor-pointer flex items-center gap-1.5",
              activeTab === 'TASKS'
                ? "border-[#1848A0] text-[#1848A0]"
                : "border-transparent text-slate-400 hover:text-slate-200"
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Follow-ups ({organization.follow_ups?.length || 0})</span>
          </button>
        </div>

        {/* Drawer Body */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1 text-xs">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={cn("p-4 rounded-2xl border", isDark ? "bg-[#1A1A24] border-[#2A2A38]" : "bg-slate-50 border-slate-200")}>
                  <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-2">Direct Communications</div>
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5">
                      <Phone className="w-4 h-4 text-[#1848A0] shrink-0" />
                      <div>
                        <div className="text-[10px] text-slate-400">Phone</div>
                        <div className={cn("font-bold text-sm", isDark ? "text-white" : "text-slate-900")}>
                          {organization.phone ? (
                            <a href={`tel:${organization.phone}`} className="hover:underline">{organization.phone}</a>
                          ) : 'Not provided'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Mail className="w-4 h-4 text-purple-400 shrink-0" />
                      <div>
                        <div className="text-[10px] text-slate-400">Corporate Email</div>
                        <div className={cn("font-bold text-sm", isDark ? "text-white" : "text-slate-900")}>
                          {organization.email ? (
                            <a href={`mailto:${organization.email}`} className="hover:underline">{organization.email}</a>
                          ) : 'Not provided'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
                      <div>
                        <div className="text-[10px] text-slate-400">Official Website</div>
                        <div className={cn("font-bold text-sm", isDark ? "text-white" : "text-slate-900")}>
                          {organization.website ? (
                            <a 
                              href={organization.website.startsWith('http') ? organization.website : `https://${organization.website}`}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline text-[#1848A0] flex items-center gap-1"
                            >
                              <span>{organization.website}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : 'Not provided'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={cn("p-4 rounded-2xl border", isDark ? "bg-[#1A1A24] border-[#2A2A38]" : "bg-slate-50 border-slate-200")}>
                  <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-2">Location & Territory</div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-[#F88020] shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[10px] text-slate-400">Physical Address</div>
                        <div className={cn("font-semibold", isDark ? "text-white" : "text-slate-900")}>
                          {organization.address || 'Address not registered'}
                        </div>
                        {(organization.city || organization.district) && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {[organization.city, organization.district].filter(Boolean).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-700/20 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Industry / Sector</span>
                      <span className="font-bold text-[#F88020]">{organization.type_of_business || 'General Business'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Summary Numbers */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className={cn("p-3.5 rounded-2xl border", isDark ? "bg-[#1A1A24] border-[#2A2A38]" : "bg-slate-50 border-slate-200")}>
                  <div className="text-xl font-extrabold text-[#1848A0]">{organization.contacts?.length || 0}</div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">Decision Makers</div>
                </div>
                <div className={cn("p-3.5 rounded-2xl border", isDark ? "bg-[#1A1A24] border-[#2A2A38]" : "bg-slate-50 border-slate-200")}>
                  <div className="text-xl font-extrabold text-emerald-500">
                    {organization.visits?.filter(v => v.status === 'COMPLETED').length || 0}
                  </div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">Visits Completed</div>
                </div>
                <div className={cn("p-3.5 rounded-2xl border", isDark ? "bg-[#1A1A24] border-[#2A2A38]" : "bg-slate-50 border-slate-200")}>
                  <div className="text-xl font-extrabold text-[#F88020]">{organization.follow_ups?.length || 0}</div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">Pending Follow-ups</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONTACTS */}
          {activeTab === 'CONTACTS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm">Key Personnel & Contacts</div>
                <button
                  onClick={onAddContact}
                  className="px-3 py-1.5 rounded-xl bg-[#1848A0] text-white hover:bg-[#003880] text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Add Contact
                </button>
              </div>

              {organization.contacts && organization.contacts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {organization.contacts.map((c) => (
                    <div 
                      key={c.id}
                      className={cn(
                        "p-3.5 rounded-2xl border space-y-2 transition-all",
                        isDark ? "bg-[#1A1A24] border-[#2A2A38]" : "bg-slate-50 border-slate-200"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#F88020]/10 border border-[#F88020]/20 text-[#F88020] flex items-center justify-center font-bold text-xs shrink-0">
                          {c.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className={cn("font-bold truncate", isDark ? "text-white" : "text-slate-900")}>
                            {c.name}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {c.position || c.department || 'Contact'}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-700/20 space-y-1 text-[11px]">
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-slate-300 hover:text-[#1848A0]">
                            <Phone className="w-3 h-3 text-[#1848A0]" />
                            <span>{c.phone}</span>
                          </a>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-slate-400 hover:text-[#1848A0]">
                            <Mail className="w-3 h-3 text-purple-400" />
                            <span>{c.email}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center border rounded-2xl border-dashed border-slate-700/40 text-slate-400">
                  <Users className="w-8 h-8 mx-auto text-slate-500 mb-2 opacity-50" />
                  <p>No contacts linked to this organization yet.</p>
                  <button
                    onClick={onAddContact}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-[#1848A0] text-white text-xs font-bold cursor-pointer"
                  >
                    Add First Contact
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: VISITS */}
          {activeTab === 'VISITS' && (
            <div className="space-y-4">
              <div className="font-bold text-sm">Field Visit History</div>
              {organization.visits && organization.visits.length > 0 ? (
                <div className="space-y-2.5">
                  {organization.visits.map((v) => (
                    <div 
                      key={v.id}
                      className={cn(
                        "p-3.5 rounded-2xl border flex items-start justify-between gap-3",
                        isDark ? "bg-[#1A1A24] border-[#2A2A38]" : "bg-slate-50 border-slate-200"
                      )}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-2 py-0.5 rounded-md text-[10px] font-extrabold border uppercase",
                            v.status === 'COMPLETED' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          )}>
                            {v.status}
                          </span>
                          <span className={cn("font-bold", isDark ? "text-white" : "text-slate-900")}>
                            {v.purpose || 'Client Visit'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2">
                          <span>📅 {v.planned_date}</span>
                          {v.planned_start_time && <span>⏰ {v.planned_start_time}</span>}
                          {v.priority && <span>⚡ {v.priority} Priority</span>}
                        </div>
                        {v.notes && <p className="text-slate-300 text-[11px] italic mt-1">"{v.notes}"</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center border rounded-2xl border-dashed border-slate-700/40 text-slate-400">
                  <Calendar className="w-8 h-8 mx-auto text-slate-500 mb-2 opacity-50" />
                  <p>No planned or completed field visits recorded.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: TASKS */}
          {activeTab === 'TASKS' && (
            <div className="space-y-4">
              <div className="font-bold text-sm">Follow-up Items & Commercial Pipeline</div>
              {organization.follow_ups && organization.follow_ups.length > 0 ? (
                <div className="space-y-2.5">
                  {organization.follow_ups.map((f) => (
                    <div 
                      key={f.id}
                      className={cn(
                        "p-3.5 rounded-2xl border flex items-center justify-between gap-3",
                        isDark ? "bg-[#1A1A24] border-[#2A2A38]" : "bg-slate-50 border-slate-200"
                      )}
                    >
                      <div>
                        <div className={cn("font-bold", isDark ? "text-white" : "text-slate-900")}>{f.title}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">Due {f.due_date} • Priority: {f.priority}</div>
                      </div>
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-[10px] font-extrabold border uppercase",
                        f.status === 'COMPLETED' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      )}>
                        {f.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center border rounded-2xl border-dashed border-slate-700/40 text-slate-400">
                  <Layers className="w-8 h-8 mx-auto text-slate-500 mb-2 opacity-50" />
                  <p>No active follow-ups for this account.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className={cn("p-4 border-t flex justify-end gap-2.5", isDark ? "border-[#22222E] bg-[#121218]" : "border-slate-100 bg-slate-50")}>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 rounded-xl text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   ADD ORGANIZATION MODAL
   ========================================================================== */
function AddOrganizationModal({ 
  onClose,
  allOrganizations = [],
  onUseExisting
}: { 
  onClose: () => void;
  allOrganizations?: OrganizationRecord[];
  onUseExisting?: (org: OrganizationRecord) => void;
}) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');

  // Live duplicate detection
  const duplicateCandidates = useMemo(() => {
    if (!nameInput.trim() || nameInput.trim().length < 3) return [];
    return findDuplicateCandidates(nameInput, allOrganizations);
  }, [nameInput, allOrganizations]);

  const topCandidate = duplicateCandidates[0];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data: any = {
      name: (formData.get('name') as string || '').trim(),
      type_of_business: (formData.get('typeOfBusiness') as string || '').trim(),
      phone: (formData.get('phone') as string || '').trim(),
      email: (formData.get('email') as string || '').trim(),
      website: (formData.get('website') as string || '').trim(),
      address: (formData.get('address') as string || '').trim(),
      city: (formData.get('city') as string || '').trim(),
      district: (formData.get('district') as string || '').trim(),
      created_by: getValidUserId(user),
    };

    if (!data.name) {
      setError('Organization name is required');
      setLoading(false);
      return;
    }

    Object.keys(data).forEach(key => {
      if (data[key] === '') {
        delete data[key];
      }
    });

    try {
      const { error: insertError } = await supabase.from('organizations').insert([data]);
      if (insertError) throw insertError;
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save organization.');
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
    "block text-[11px] font-bold uppercase tracking-wider mb-1.5",
    isDark ? "text-gray-400" : "text-slate-600"
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className={cn(
        "border rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]",
        isDark ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
      )}>
        <div className={cn("p-6 border-b flex items-center justify-between", isDark ? "border-[#2A2A35]" : "border-slate-100")}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1848A0]/10 border border-[#1848A0]/20 flex items-center justify-center text-[#1848A0]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-900")}>
                Add New Organization
              </h2>
              <p className="text-xs text-slate-400">Register new enterprise account or business partner</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 flex flex-col gap-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
              {error}
            </div>
          )}

          <div>
            <label className={labelClass}>Organization Name *</label>
            <input 
              required 
              name="name" 
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Apex Health Logistics Ltd" 
              type="text" 
              className={inputClass} 
            />

            {/* Smart Duplicate Warning Card */}
            {topCandidate && topCandidate.similarity >= 70 && (
              <div className={cn(
                "mt-2.5 p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fadeIn",
                isDark ? "bg-amber-500/10 border-amber-500/30 text-amber-300" : "bg-amber-50 border-amber-300 text-amber-800"
              )}>
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold flex items-center gap-1.5 flex-wrap">
                      <span>Similar Account Found:</span>
                      <span className="underline decoration-amber-400/50">{topCandidate.organization.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 font-extrabold">
                        {topCandidate.similarity}% match
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-400/80 mt-0.5">
                      {topCandidate.reason} • Avoid creating duplicate business records.
                    </p>
                  </div>
                </div>

                {onUseExisting && (
                  <button
                    type="button"
                    onClick={() => onUseExisting(topCandidate.organization)}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 transition-colors shadow-xs cursor-pointer"
                  >
                    Open Existing
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={labelClass}>Business Sector / Type</label>
              <input name="typeOfBusiness" placeholder="e.g. Healthcare, Distributor, Retail" type="text" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Telephone / Mobile</label>
              <input name="phone" placeholder="e.g. +254 700 123456" type="tel" className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={labelClass}>Corporate Email</label>
              <input name="email" placeholder="e.g. info@company.com" type="email" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Website URL</label>
              <input name="website" placeholder="e.g. https://company.com" type="text" className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Physical Street Address</label>
            <textarea name="address" placeholder="e.g. Plot 45, Industrial Area, Enterprise Road" rows={2} className={inputClass}></textarea>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={labelClass}>City / Town</label>
              <input name="city" placeholder="e.g. Nairobi" type="text" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>District / Region</label>
              <input name="district" placeholder="e.g. Upper Hill / Industrial Area" type="text" className={inputClass} />
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/20">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-slate-400 font-semibold hover:text-slate-200 rounded-xl transition-colors text-xs cursor-pointer">
              Cancel
            </button>
            <button disabled={loading} type="submit" className="px-5 py-2.5 bg-[#1848A0] text-white font-bold hover:bg-[#003880] rounded-xl transition-all disabled:opacity-50 text-xs shadow-md flex items-center gap-2 cursor-pointer">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Organization'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ==========================================================================
   EDIT ORGANIZATION MODAL
   ========================================================================== */
function EditOrganizationModal({
  organization,
  onClose,
  allOrganizations = []
}: {
  organization: OrganizationRecord;
  onClose: () => void;
  allOrganizations?: OrganizationRecord[];
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState(organization.name);

  // Live duplicate detection ignoring current organization
  const duplicateCandidates = useMemo(() => {
    if (!nameInput.trim() || nameInput.trim().length < 3) return [];
    return findDuplicateCandidates(nameInput, allOrganizations, organization.id);
  }, [nameInput, allOrganizations, organization.id]);

  const topCandidate = duplicateCandidates[0];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data: any = {
      name: (formData.get('name') as string || '').trim(),
      type_of_business: (formData.get('typeOfBusiness') as string || '').trim(),
      phone: (formData.get('phone') as string || '').trim(),
      email: (formData.get('email') as string || '').trim(),
      website: (formData.get('website') as string || '').trim(),
      address: (formData.get('address') as string || '').trim(),
      city: (formData.get('city') as string || '').trim(),
      district: (formData.get('district') as string || '').trim(),
    };

    if (!data.name) {
      setError('Organization name is required');
      setLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('organizations')
        .update(data)
        .eq('id', organization.id);

      if (updateError) throw updateError;
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update organization.');
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
    "block text-[11px] font-bold uppercase tracking-wider mb-1.5",
    isDark ? "text-gray-400" : "text-slate-600"
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className={cn(
        "border rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]",
        isDark ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
      )}>
        <div className={cn("p-6 border-b flex items-center justify-between", isDark ? "border-[#2A2A35]" : "border-slate-100")}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F88020]/10 border border-[#F88020]/20 flex items-center justify-center text-[#F88020]">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-900")}>
                Edit Organization
              </h2>
              <p className="text-xs text-slate-400">Update company record and contact details</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 flex flex-col gap-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
              {error}
            </div>
          )}

          <div>
            <label className={labelClass}>Organization Name *</label>
            <input 
              required 
              name="name" 
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              type="text" 
              className={inputClass} 
            />

            {topCandidate && topCandidate.similarity >= 70 && (
              <div className={cn(
                "mt-2.5 p-3 rounded-2xl border flex items-center gap-2.5 text-xs animate-fadeIn",
                isDark ? "bg-amber-500/10 border-amber-500/30 text-amber-300" : "bg-amber-50 border-amber-300 text-amber-800"
              )}>
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <div>
                  <span className="font-bold">Caution: </span>
                  Another organization named <strong className="underline">{topCandidate.organization.name}</strong> ({topCandidate.similarity}% match) exists in database.
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={labelClass}>Business Sector / Type</label>
              <input name="typeOfBusiness" defaultValue={organization.type_of_business || ''} type="text" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Telephone / Mobile</label>
              <input name="phone" defaultValue={organization.phone || ''} type="tel" className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={labelClass}>Corporate Email</label>
              <input name="email" defaultValue={organization.email || ''} type="email" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Website URL</label>
              <input name="website" defaultValue={organization.website || ''} type="text" className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Physical Street Address</label>
            <textarea name="address" defaultValue={organization.address || ''} rows={2} className={inputClass}></textarea>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={labelClass}>City / Town</label>
              <input name="city" defaultValue={organization.city || ''} type="text" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>District / Region</label>
              <input name="district" defaultValue={organization.district || ''} type="text" className={inputClass} />
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/20">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-slate-400 font-semibold hover:text-slate-200 rounded-xl transition-colors text-xs cursor-pointer">
              Cancel
            </button>
            <button disabled={loading} type="submit" className="px-5 py-2.5 bg-[#1848A0] text-white font-bold hover:bg-[#003880] rounded-xl transition-all disabled:opacity-50 text-xs shadow-md flex items-center gap-2 cursor-pointer">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving Updates...
                </>
              ) : (
                'Update Organization'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ==========================================================================
   DELETE ORGANIZATION MODAL
   ========================================================================== */
function DeleteOrganizationModal({
  organization,
  onClose
}: {
  organization: OrganizationRecord;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', organization.id);

      if (error) throw error;
      onClose();
    } catch (err: any) {
      alert(`Failed to delete organization: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className={cn(
        "border rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col p-6 text-center space-y-4",
        isDark ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
      )}>
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>

        <div>
          <h3 className={cn("text-lg font-extrabold", isDark ? "text-white" : "text-slate-900")}>
            Delete Organization?
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Are you sure you want to permanently delete <strong className={isDark ? "text-white" : "text-slate-800"}>"{organization.name}"</strong>? This will remove all associated contact and visit references.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-slate-400 font-bold hover:text-slate-200 rounded-xl transition-colors text-xs cursor-pointer"
          >
            Cancel
          </button>
          <button
            disabled={loading}
            onClick={handleDelete}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-all text-xs flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Confirm Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   QUICK ADD CONTACT TO ORGANIZATION MODAL
   ========================================================================== */
function QuickAddContactModal({
  organization,
  onClose
}: {
  organization: OrganizationRecord;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data: any = {
      organization_id: organization.id,
      name: (formData.get('name') as string || '').trim(),
      position: (formData.get('position') as string || '').trim(),
      department: (formData.get('department') as string || '').trim(),
      phone: (formData.get('phone') as string || '').trim(),
      email: (formData.get('email') as string || '').trim(),
      created_by: getValidUserId(user),
    };

    Object.keys(data).forEach(key => {
      if (data[key] === '') delete data[key];
    });

    try {
      const { error } = await supabase.from('contacts').insert([data]);
      if (error) throw error;
      onClose();
    } catch (err: any) {
      alert(`Failed to add contact: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = cn(
    "w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#1848A0]",
    isDark 
      ? "bg-[#0B0B0E] border-[#2A2A35] text-white placeholder-gray-500" 
      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
  );

  const labelClass = cn(
    "block text-[11px] font-bold uppercase tracking-wider mb-1.5",
    isDark ? "text-gray-400" : "text-slate-600"
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className={cn(
        "border rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]",
        isDark ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
      )}>
        <div className={cn("p-6 border-b flex items-center justify-between", isDark ? "border-[#2A2A35]" : "border-slate-100")}>
          <div>
            <h3 className={cn("text-base font-bold", isDark ? "text-white" : "text-slate-900")}>
              Add Contact to {organization.name}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Directly attach executive or key decision maker</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3.5 overflow-y-auto">
          <div>
            <label className={labelClass}>Full Name *</label>
            <input required name="name" placeholder="e.g. Dr. Jane Kamau" type="text" className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Position / Title</label>
              <input name="position" placeholder="e.g. Procurement Head" type="text" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Department</label>
              <input name="department" placeholder="e.g. Supply Chain" type="text" className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Phone Number</label>
              <input name="phone" placeholder="e.g. +254 712 345678" type="tel" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email Address</label>
              <input name="email" placeholder="e.g. j.kamau@org.com" type="email" className={inputClass} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/20">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-400 font-semibold hover:text-slate-200 rounded-xl text-xs cursor-pointer">
              Cancel
            </button>
            <button disabled={loading} type="submit" className="px-5 py-2 bg-[#1848A0] text-white font-bold hover:bg-[#003880] rounded-xl text-xs flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Save Contact
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ==========================================================================
   IMPORT EXCEL MODAL
   ========================================================================== */
function ImportOrganizationsModal({ 
  onClose,
  existingOrganizations = []
}: { 
  onClose: () => void;
  existingOrganizations?: OrganizationRecord[];
}) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ExcelOrgRow[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  // Compute duplicates in parsed rows
  const analyzedRows = useMemo(() => {
    return parsedRows.map(row => {
      const candidates = findDuplicateCandidates(row.name, existingOrganizations);
      const topMatch = candidates[0];
      const isDuplicate = topMatch && topMatch.similarity >= 85;
      return {
        ...row,
        isDuplicate,
        duplicateMatch: topMatch
      };
    });
  }, [parsedRows, existingOrganizations]);

  const duplicateCount = useMemo(() => {
    return analyzedRows.filter(r => r.isDuplicate).length;
  }, [analyzedRows]);

  const rowsToImport = useMemo(() => {
    if (skipDuplicates) {
      return analyzedRows.filter(r => !r.isDuplicate);
    }
    return analyzedRows;
  }, [analyzedRows, skipDuplicates]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setLoading(true);
    setSuccessCount(null);

    try {
      const rows = await parseExcelFile(selectedFile);
      if (rows.length === 0) {
        setError('No valid organization rows found. Please check your Excel headers (e.g. Organization Name).');
        setParsedRows([]);
      } else {
        setParsedRows(rows);
      }
    } catch (err: any) {
      console.error('File parsing error:', err);
      setError(err.message || 'Failed to parse Excel file. Please ensure it is a valid .xlsx, .xls or .csv file.');
      setParsedRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (rowsToImport.length === 0) return;
    setImporting(true);
    setError(null);

    try {
      const insertPayload = rowsToImport.map(row => ({
        name: row.name,
        type_of_business: row.type_of_business || null,
        phone: row.phone || null,
        email: row.email || null,
        website: row.website || null,
        address: row.address || null,
        created_by: getValidUserId(user)
      }));

      const { error: insertError } = await supabase
        .from('organizations')
        .insert(insertPayload);

      if (insertError) {
        console.warn('Supabase bulk insert warning:', insertError.message);
      }

      setSuccessCount(rowsToImport.length);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Import error:', err);
      setError('Import encountered an issue: ' + (err.message || 'Unknown error'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className={cn(
        "border rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]",
        isDark ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
      )}>
        <div className={cn("p-6 border-b flex items-center justify-between", isDark ? "border-[#2A2A35]" : "border-slate-100")}>
          <div>
            <h2 className={cn("text-xl font-bold flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
              <FileSpreadsheet className="w-6 h-6 text-[#1848A0]" />
              Import Organizations from Excel
            </h2>
            <p className="text-xs text-slate-400 mt-1">Upload `.xlsx`, `.xls` or `.csv` files with automatic duplicate prevention.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6 flex-1 text-xs">
          {/* Template Download Banner */}
          <div className={cn(
            "p-4 rounded-2xl border flex items-center justify-between gap-4",
            isDark ? "bg-[#1C1C26] border-[#2A2A38]" : "bg-slate-50 border-slate-200"
          )}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#F88020]/10 border border-[#F88020]/20 text-[#F88020]">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <div className={cn("text-xs font-bold", isDark ? "text-white" : "text-slate-900")}>
                  Need the Excel Template?
                </div>
                <div className="text-[11px] text-slate-400">
                  Download our formatted template with sample data columns.
                </div>
              </div>
            </div>
            <button
              onClick={downloadOrganizationTemplate}
              className="bg-[#F88020] hover:bg-[#e06d00] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
            >
              Download Template
            </button>
          </div>

          {/* Upload Dropzone */}
          <div className="space-y-2">
            <label className={cn("block text-xs font-bold uppercase tracking-wider", isDark ? "text-slate-400" : "text-slate-600")}>
              Select Excel File
            </label>
            <label className={cn(
              "border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all",
              isDark
                ? "border-[#2A2A38] bg-[#0B0B0E] hover:border-[#1848A0]"
                : "border-slate-200 bg-slate-50 hover:border-[#1848A0]"
            )}>
              <Upload className="w-8 h-8 text-[#1848A0] mb-2" />
              <span className={cn("text-xs font-bold", isDark ? "text-white" : "text-slate-900")}>
                {file ? file.name : "Click to browse or drag & drop file here"}
              </span>
              <span className="text-[10px] text-slate-400 mt-1">
                Supports .xlsx, .xls, .csv files
              </span>
              <input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                onChange={handleFileChange} 
                className="hidden" 
              />
            </label>
          </div>

          {/* Loading Indicator */}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-[#1848A0] font-semibold">
              <Loader2 className="w-5 h-5 animate-spin" />
              Parsing Excel sheets and scanning duplicates...
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {successCount !== null && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              <span>Successfully imported {successCount} organizations! Closing...</span>
            </div>
          )}

          {/* Deduplication Filter Toggle */}
          {parsedRows.length > 0 && duplicateCount > 0 && !loading && (
            <div className={cn(
              "p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs",
              isDark ? "bg-amber-500/10 border-amber-500/30 text-amber-300" : "bg-amber-50 border-amber-300 text-amber-900"
            )}>
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <div>
                  <span className="font-bold">{duplicateCount} potential duplicate(s) detected</span> in your file against existing records.
                </div>
              </div>
              <label className="flex items-center gap-2 font-bold cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="rounded text-[#1848A0] focus:ring-[#1848A0] w-4 h-4"
                />
                <span>Skip existing</span>
              </label>
            </div>
          )}

          {/* Data Preview Table */}
          {parsedRows.length > 0 && !loading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={cn("text-xs font-bold", isDark ? "text-white" : "text-slate-900")}>
                  Previewing {parsedRows.length} Organizations ({rowsToImport.length} ready to import)
                </span>
                <span className="text-[10px] font-semibold text-[#1848A0] uppercase tracking-wider bg-[#1848A0]/10 px-2 py-0.5 rounded-full">
                  Valid Headers Detected
                </span>
              </div>

              <div className={cn("border rounded-xl overflow-hidden text-xs max-h-48 overflow-y-auto", isDark ? "border-[#2A2A38]" : "border-slate-200")}>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={cn("font-bold text-[10px] uppercase tracking-wider border-b", isDark ? "bg-[#1C1C26] border-[#2A2A38] text-slate-400" : "bg-slate-100 border-slate-200 text-slate-600")}>
                      <th className="px-3 py-2">Organization Name</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Duplicate Status</th>
                      <th className="px-3 py-2">Phone</th>
                    </tr>
                  </thead>
                  <tbody className={cn("divide-y", isDark ? "divide-[#2A2A38]" : "divide-slate-100")}>
                    {analyzedRows.slice(0, 8).map((row, i) => (
                      <tr key={i} className={row.isDuplicate && skipDuplicates ? "opacity-50 line-through" : ""}>
                        <td className="px-3 py-2 font-bold text-slate-100">{row.name}</td>
                        <td className="px-3 py-2 text-slate-400">{row.type_of_business || '-'}</td>
                        <td className="px-3 py-2">
                          {row.isDuplicate ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Matches: {row.duplicateMatch?.organization.name} ({row.duplicateMatch?.similarity}%)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" /> New
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-400">{row.phone || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 8 && (
                <div className="text-[10px] text-slate-400 text-right">
                  + {parsedRows.length - 8} more records will be processed
                </div>
              )}
            </div>
          )}
        </div>

        <div className={cn("p-4 border-t flex justify-end gap-3", isDark ? "border-[#2A2A35]" : "border-slate-100")}>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-slate-400 font-semibold hover:text-slate-200 rounded-xl transition-colors text-xs cursor-pointer"
          >
            Cancel
          </button>
          <button
            disabled={rowsToImport.length === 0 || importing}
            onClick={handleImport}
            className="px-5 py-2.5 bg-[#1848A0] hover:bg-[#003880] text-white font-bold rounded-xl transition-all disabled:opacity-50 text-xs flex items-center gap-2 shadow-md cursor-pointer"
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing...
              </>
            ) : (
              `Confirm & Import (${rowsToImport.length} Records)`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { cn } from '../../lib/utils';
import { useTheme } from '../../context/ThemeContext';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  key?: React.Key;
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  const { theme } = useTheme();

  return (
    <div
      className={cn(
        "animate-pulse rounded-lg transition-colors",
        theme === 'dark' 
          ? "bg-slate-800/80" 
          : "bg-slate-200/90",
        className
      )}
      {...props}
    />
  );
}

export function PageHeaderSkeleton({ hasButton = true }: { hasButton?: boolean }) {
  const { theme } = useTheme();
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56 rounded-xl" />
        <Skeleton className="h-4 w-72 rounded-md" />
      </div>
      {hasButton && (
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      )}
    </div>
  );
}

export function StatCardSkeleton() {
  const { theme } = useTheme();
  return (
    <div className={cn(
      "p-6 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center gap-4 transition-all shadow-xs",
      theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
    )}>
      <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
      <div className="space-y-2 flex-1 w-full">
        <Skeleton className="h-3 w-24 rounded-md" />
        <Skeleton className="h-7 w-16 rounded-lg" />
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  const { theme } = useTheme();

  return (
    <div className={cn(
      "w-full rounded-2xl border overflow-hidden shadow-xs transition-colors",
      theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
    )}>
      {/* Search Bar Skeleton */}
      <div className={cn(
        "p-4 border-b",
        theme === 'dark' ? "border-[#2A2A35]" : "border-slate-100"
      )}>
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>

      {/* Table Header Skeleton */}
      <div className={cn(
        "px-6 py-4 border-b flex items-center justify-between gap-4",
        theme === 'dark' ? "bg-[#1A1A22] border-[#2A2A35]" : "bg-slate-100 text-slate-600 border-slate-200"
      )}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 w-28 rounded-md" />
        ))}
      </div>

      {/* Table Body Skeleton Rows */}
      <div className="divide-y divide-slate-100 dark:divide-[#252530]">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="px-6 py-4.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 flex-1">
              <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
              <div className="space-y-2 flex-1 max-w-xs">
                <Skeleton className="h-4 w-3/4 rounded-md" />
                <Skeleton className="h-3 w-1/2 rounded-md" />
              </div>
            </div>
            <Skeleton className="h-4 w-28 rounded-md hidden sm:block" />
            <Skeleton className="h-4 w-24 rounded-md hidden md:block" />
            <Skeleton className="h-6 w-20 rounded-lg shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  const { theme } = useTheme();

  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors",
            theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
          )}
        >
          <div className="flex items-center gap-4 flex-1">
            <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-48 rounded-md" />
              <Skeleton className="h-3 w-32 rounded-md" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20 rounded-xl" />
            <Skeleton className="h-8 w-24 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Dashboard Full Skeleton */
export function DashboardSkeleton() {
  const { theme } = useTheme();

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Skeleton */}
      <div className={cn(
        "p-6 rounded-2xl border flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4",
        theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
      )}>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 rounded-full" />
          <Skeleton className="h-7 w-64 rounded-xl" />
          <Skeleton className="h-3.5 w-80 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-36 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
      </div>

      {/* 4 Quick Action Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cn(
            "p-3.5 rounded-2xl border flex items-center gap-3",
            theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
          )}>
            <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-3 w-16 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cn(
            "p-5 rounded-2xl border flex flex-col justify-between space-y-4",
            theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
          )}>
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <Skeleton className="h-3 w-28 rounded-md" />
                <Skeleton className="h-7 w-20 rounded-lg" />
              </div>
              <Skeleton className="w-11 h-11 rounded-xl shrink-0" />
            </div>
            <Skeleton className="h-3 w-full rounded-md" />
          </div>
        ))}
      </div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={cn(
          "lg:col-span-7 rounded-2xl border p-6 space-y-4",
          theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
        )}>
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-44 rounded-md" />
            <Skeleton className="h-8 w-40 rounded-xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>

        <div className={cn(
          "lg:col-span-5 rounded-2xl border p-6 space-y-4",
          theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
        )}>
          <Skeleton className="h-5 w-40 rounded-md" />
          <div className="space-y-3 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={cn(
                "p-3 rounded-xl border flex items-center justify-between",
                theme === 'dark' ? "bg-[#0B0B0E] border-[#2A2A38]" : "bg-slate-50 border-slate-200"
              )}>
                <div className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded-xl shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-32 rounded-md" />
                    <Skeleton className="h-2.5 w-24 rounded-md" />
                  </div>
                </div>
                <Skeleton className="h-6 w-14 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Organizations Page Skeleton */
export function OrganizationsSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 rounded-xl" />
          <Skeleton className="h-3.5 w-80 rounded-md" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </div>
      <TableSkeleton rows={6} cols={4} />
    </div>
  );
}

/** Contacts Page Skeleton */
export function ContactsSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36 rounded-xl" />
          <Skeleton className="h-3.5 w-64 rounded-md" />
        </div>
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>
      <TableSkeleton rows={6} cols={4} />
    </div>
  );
}

/** My Day Field Page Skeleton */
export function MyDaySkeleton() {
  const { theme } = useTheme();

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Date Navigation & Actions Skeleton */}
      <div className={cn(
        "border rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs",
        theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
      )}>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-10 w-44 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-10 w-20 rounded-xl" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={cn(
            "border rounded-2xl p-5 flex items-center gap-4 shadow-xs",
            theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
          )}>
            <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-20 rounded-md" />
              <Skeleton className="h-5 w-36 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* Field Itinerary Container */}
      <div className={cn(
        "border rounded-2xl p-6 shadow-xs space-y-4",
        theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
      )}>
        <div className="flex items-center justify-between border-b pb-4 dark:border-[#2A2A35]">
          <Skeleton className="h-6 w-48 rounded-lg" />
          <Skeleton className="h-4 w-20 rounded-md" />
        </div>
        <div className="space-y-4 pt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={cn(
              "border rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4",
              theme === 'dark' ? "bg-[#0B0B0E] border-[#2A2A35]" : "bg-slate-50 border-slate-200"
            )}>
              <div className="flex items-start gap-4 flex-1">
                <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4.5 w-48 rounded-md" />
                    <Skeleton className="h-4 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-3.5 w-64 rounded-md" />
                  <Skeleton className="h-3 w-40 rounded-md" />
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
                <Skeleton className="h-9 w-24 rounded-xl" />
                <Skeleton className="h-9 w-28 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Team Planning Skeleton */
export function TeamPlanningSkeleton() {
  const { theme } = useTheme();

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Date and View Bar */}
      <div className={cn(
        "border rounded-2xl p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 shadow-xs",
        theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
      )}>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-10 w-44 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-10 w-20 rounded-xl" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-10 w-40 rounded-2xl" />
          <Skeleton className="h-10 w-28 rounded-2xl" />
          <Skeleton className="h-10 w-32 rounded-2xl" />
        </div>
      </div>

      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={cn(
            "p-4 rounded-2xl border space-y-2 shadow-xs",
            theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
          )}>
            <Skeleton className="h-3 w-20 rounded-md" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-7 w-12 rounded-md" />
              <Skeleton className="w-5 h-5 rounded-full" />
            </div>
            <Skeleton className="h-2.5 w-24 rounded-md" />
          </div>
        ))}
      </div>

      {/* Search and Filters Bar */}
      <div className={cn(
        "border rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs",
        theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
      )}>
        <Skeleton className="h-10 flex-1 min-w-[200px] rounded-xl" />
        <Skeleton className="h-10 w-36 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      {/* Executive Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={cn(
            "border rounded-2xl p-5 shadow-xs space-y-4",
            theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
          )}>
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3.5 dark:border-[#2A2A35]">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32 rounded-md" />
                  <Skeleton className="h-3 w-24 rounded-md" />
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-8 w-8 rounded-xl" />
                <Skeleton className="h-8 w-8 rounded-xl" />
              </div>
            </div>

            {/* Visit Items */}
            <div className="space-y-2.5">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>

            {/* Footer slots */}
            <div className="pt-2 border-t dark:border-[#2A2A35] flex items-center justify-between">
              <Skeleton className="h-3.5 w-28 rounded-md" />
              <Skeleton className="h-7 w-20 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Full App / ProtectedRoute Loading Layout Skeleton */
export function AppLayoutSkeleton() {
  const { theme } = useTheme();

  return (
    <div className={cn(
      "min-h-screen flex font-sans transition-colors duration-200 antialiased",
      theme === 'dark' ? "bg-[#0B0B0E] text-slate-100" : "bg-slate-50 text-slate-900"
    )}>
      {/* Sidebar Skeleton */}
      <aside className={cn(
        "hidden md:flex flex-col w-64 border-r shrink-0 p-4 space-y-6 h-screen sticky top-0",
        theme === 'dark' ? "bg-[#14141B] border-[#22222E]" : "bg-white border-slate-200"
      )}>
        <div className="flex items-center gap-3 pb-2 border-b dark:border-[#22222E]">
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="h-5 w-32 rounded-md" />
        </div>
        <Skeleton className="h-9 w-full rounded-2xl" />
        <div className="space-y-3 flex-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-xl" />
          ))}
        </div>
        <div className="pt-4 border-t dark:border-[#22222E] space-y-2">
          <Skeleton className="h-9 w-full rounded-xl" />
          <Skeleton className="h-9 w-full rounded-xl" />
        </div>
      </aside>

      {/* Main Content Area Skeleton */}
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto">
          <DashboardSkeleton />
        </div>
      </main>
    </div>
  );
}



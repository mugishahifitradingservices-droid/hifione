import { PlannedVisit, FollowUp, Organization, AppUser, Priority } from '../types';

export interface MonthKPIStats {
  month: string; // e.g. "2026-08"
  monthLabel: string; // e.g. "August 2026"
  
  // 1. Total Visits Completed
  totalVisitsPlanned: number;
  totalVisitsCompleted: number;
  totalVisitsInProgress: number;
  totalVisitsRescheduled: number;
  visitCompletionRate: number; // percentage (0-100)
  targetVisits: number;

  // 2. Pending Tasks / Follow-ups
  totalTasks: number;
  pendingTasks: number;
  completedTasks: number;
  overdueTasks: number;
  highPriorityPendingTasks: number;
  taskResolutionRate: number; // percentage (0-100)

  // 3. Average Priority Score
  averagePriorityScore: number; // Scale 1.00 - 3.00
  priorityScorePercentage: number; // Scale 0-100%
  highPriorityCount: number;
  mediumPriorityCount: number;
  lowPriorityCount: number;
  highPriorityPercentage: number;

  // Supporting metrics
  totalOrganizationsCovered: number;
  activeExecutivesCount: number;
  pipelineOpportunitiesCount: number;
  estimatedPipelineValue: number;
}

export interface DailyVisitTrend {
  day: string; // e.g. "Aug 01"
  date: string; // YYYY-MM-DD
  completed: number;
  planned: number;
  inProgress: number;
  total: number;
}

export interface PriorityDistributionItem {
  name: string;
  count: number;
  weight: number;
  color: string;
  percentage: number;
}

export interface ExecutiveBenchmarkItem {
  id: string;
  name: string;
  role: string;
  completedVisits: number;
  plannedVisits: number;
  pendingTasks: number;
  averagePriorityScore: number;
  completionRate: number;
}

export interface TaskStatusBreakdownItem {
  category: string;
  high: number;
  medium: number;
  low: number;
  total: number;
}

/** Converts Priority enum to numerical weight (High=3, Medium=2, Low=1) */
export function getPriorityWeight(priority?: Priority | string): number {
  if (!priority) return 2.0;
  const p = priority.toUpperCase();
  if (p === 'HIGH') return 3.0;
  if (p === 'MEDIUM') return 2.0;
  if (p === 'LOW') return 1.0;
  return 2.0;
}

/** Calculates average priority score for a list of items having a priority property */
export function calculateAveragePriorityScore(items: { priority?: Priority | string }[]): number {
  if (!items || items.length === 0) return 0.0;
  const totalWeight = items.reduce((sum, item) => sum + getPriorityWeight(item.priority), 0);
  return Number((totalWeight / items.length).toFixed(2));
}

/** Generates real-time month KPI analytics strictly from Supabase visits, tasks, orgs, and users */
export function computeDashboardKPIs(
  month: string, // YYYY-MM
  visits: PlannedVisit[],
  tasks: FollowUp[],
  orgs: Organization[],
  execs: AppUser[],
  selectedExecutiveId: string = 'ALL'
): {
  stats: MonthKPIStats;
  dailyTrends: DailyVisitTrend[];
  priorityDistribution: PriorityDistributionItem[];
  executiveBenchmarks: ExecutiveBenchmarkItem[];
  taskBreakdown: TaskStatusBreakdownItem[];
} {
  // Filter visits for selected month and selected executive
  let monthVisits = visits.filter(v => v.planned_date && v.planned_date.startsWith(month));
  let monthTasks = tasks.filter(t => (t.due_date && t.due_date.startsWith(month)) || (t.created_at && t.created_at.startsWith(month)));

  if (selectedExecutiveId !== 'ALL') {
    monthVisits = monthVisits.filter(v => v.employee_id === selectedExecutiveId);
    monthTasks = monthTasks.filter(t => t.assigned_to === selectedExecutiveId);
  }

  // 1. Calculate Visit Metrics directly from Supabase
  const totalVisitsPlanned = monthVisits.length;
  const totalVisitsCompleted = monthVisits.filter(v => v.status === 'COMPLETED').length;
  const totalVisitsInProgress = monthVisits.filter(v => v.status === 'IN_PROGRESS').length;
  const totalVisitsRescheduled = monthVisits.filter(v => v.status === 'RESCHEDULE_REQUESTED' || v.status === 'CANCELLED').length;
  const visitCompletionRate = totalVisitsPlanned > 0 ? Math.round((totalVisitsCompleted / totalVisitsPlanned) * 100) : 0;

  // 2. Calculate Task & Follow-up Metrics directly from Supabase
  const totalTasks = monthTasks.length;
  const pendingTasks = monthTasks.filter(t => t.status === 'PENDING' || t.status === 'SCHEDULED').length;
  const completedTasks = monthTasks.filter(t => t.status === 'COMPLETED').length;
  const todayIso = new Date().toISOString().split('T')[0];
  const overdueTasks = monthTasks.filter(t => {
    if (t.status === 'COMPLETED' || t.status === 'CANCELLED') return false;
    return t.due_date && t.due_date < todayIso;
  }).length;
  const highPriorityPendingTasks = monthTasks.filter(t => (t.status === 'PENDING' || t.status === 'SCHEDULED') && t.priority === 'HIGH').length;
  const taskResolutionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // 3. Calculate Average Priority Score across all field visits & tasks
  const combinedItems = [...monthVisits, ...monthTasks];
  const avgPriority = calculateAveragePriorityScore(combinedItems);
  const priorityScorePercentage = avgPriority > 0 ? Math.round((avgPriority / 3.0) * 100) : 0;

  const highPriorityCount = combinedItems.filter(i => i.priority === 'HIGH').length;
  const mediumPriorityCount = combinedItems.filter(i => i.priority === 'MEDIUM').length;
  const lowPriorityCount = combinedItems.filter(i => i.priority === 'LOW').length;
  const totalItemsCount = combinedItems.length;
  const highPriorityPercentage = totalItemsCount > 0 ? Math.round((highPriorityCount / totalItemsCount) * 100) : 0;

  // 4. Compute Unique Orgs & Active Staff
  const uniqueOrgIds = new Set(monthVisits.map(v => v.organization_id));
  const uniqueExecIds = new Set(monthVisits.map(v => v.employee_id));

  // 5. Build Daily Trend Series (1st to end of month)
  const dailyTrends: DailyVisitTrend[] = [];
  const daysInMonth = 31;
  const [yearStr, monthNumStr] = month.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthAbbr = monthNames[parseInt(monthNumStr, 10) - 1] || 'Aug';

  // Group visits by day
  const visitsByDay: Record<number, { completed: number; planned: number; inProgress: number }> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    visitsByDay[d] = { completed: 0, planned: 0, inProgress: 0 };
  }

  monthVisits.forEach(v => {
    if (v.planned_date) {
      const dayNum = parseInt(v.planned_date.split('-')[2], 10);
      if (visitsByDay[dayNum]) {
        visitsByDay[dayNum].planned += 1;
        if (v.status === 'COMPLETED') visitsByDay[dayNum].completed += 1;
        if (v.status === 'IN_PROGRESS') visitsByDay[dayNum].inProgress += 1;
      }
    }
  });

  // Create formatted trend points
  for (let d = 1; d <= daysInMonth; d += 2) {
    const padDay = d < 10 ? `0${d}` : `${d}`;
    const dayLabel = `${monthAbbr} ${padDay}`;
    const isoDate = `${yearStr}-${monthNumStr}-${padDay}`;
    const dayData = visitsByDay[d] || { completed: 0, planned: 0, inProgress: 0 };
    
    dailyTrends.push({
      day: dayLabel,
      date: isoDate,
      completed: dayData.completed,
      planned: dayData.planned,
      inProgress: dayData.inProgress,
      total: dayData.planned
    });
  }

  // 6. Priority Distribution for Donut Chart
  const priorityDistribution: PriorityDistributionItem[] = [
    {
      name: 'High Priority (Weight 3.0)',
      count: highPriorityCount,
      weight: 3.0,
      color: '#EF4444',
      percentage: totalItemsCount > 0 ? Math.round((highPriorityCount / totalItemsCount) * 100) : 0
    },
    {
      name: 'Medium Priority (Weight 2.0)',
      count: mediumPriorityCount,
      weight: 2.0,
      color: '#F88020',
      percentage: totalItemsCount > 0 ? Math.round((mediumPriorityCount / totalItemsCount) * 100) : 0
    },
    {
      name: 'Low Priority (Weight 1.0)',
      count: lowPriorityCount,
      weight: 1.0,
      color: '#0088D0',
      percentage: totalItemsCount > 0 ? Math.round((lowPriorityCount / totalItemsCount) * 100) : 0
    }
  ];

  // 7. Executive Benchmarks from real Supabase profiles
  const executiveBenchmarks: ExecutiveBenchmarkItem[] = execs.map(e => {
    const eVisits = monthVisits.filter(v => v.employee_id === e.id);
    const eTasks = monthTasks.filter(t => t.assigned_to === e.id);
    const eCompleted = eVisits.filter(v => v.status === 'COMPLETED').length;
    const ePending = eTasks.filter(t => t.status === 'PENDING' || t.status === 'SCHEDULED').length;
    const eAvgScore = calculateAveragePriorityScore([...eVisits, ...eTasks]);
    const eRate = eVisits.length > 0 ? Math.round((eCompleted / eVisits.length) * 100) : 0;

    return {
      id: e.id,
      name: e.name || 'Field Executive',
      role: (e.role || 'MARKETING_EXECUTIVE').replace(/_/g, ' '),
      completedVisits: eCompleted,
      plannedVisits: eVisits.length,
      pendingTasks: ePending,
      averagePriorityScore: eAvgScore,
      completionRate: eRate
    };
  });

  // 8. Task Status Breakdown
  const taskBreakdown: TaskStatusBreakdownItem[] = [
    {
      category: 'Completed',
      high: monthTasks.filter(t => t.status === 'COMPLETED' && t.priority === 'HIGH').length,
      medium: monthTasks.filter(t => t.status === 'COMPLETED' && t.priority === 'MEDIUM').length,
      low: monthTasks.filter(t => t.status === 'COMPLETED' && t.priority === 'LOW').length,
      total: completedTasks
    },
    {
      category: 'Pending Active',
      high: highPriorityPendingTasks,
      medium: monthTasks.filter(t => (t.status === 'PENDING' || t.status === 'SCHEDULED') && t.priority === 'MEDIUM').length,
      low: monthTasks.filter(t => (t.status === 'PENDING' || t.status === 'SCHEDULED') && t.priority === 'LOW').length,
      total: pendingTasks
    },
    {
      category: 'Overdue Follow-up',
      high: monthTasks.filter(t => t.priority === 'HIGH' && t.status !== 'COMPLETED' && t.due_date && t.due_date < todayIso).length,
      medium: monthTasks.filter(t => t.priority === 'MEDIUM' && t.status !== 'COMPLETED' && t.due_date && t.due_date < todayIso).length,
      low: monthTasks.filter(t => t.priority === 'LOW' && t.status !== 'COMPLETED' && t.due_date && t.due_date < todayIso).length,
      total: overdueTasks
    }
  ];

  const monthLabel = `${monthNames[parseInt(monthNumStr, 10) - 1] || 'August'} ${yearStr}`;

  return {
    stats: {
      month,
      monthLabel,
      totalVisitsPlanned,
      totalVisitsCompleted,
      totalVisitsInProgress,
      totalVisitsRescheduled,
      visitCompletionRate,
      targetVisits: execs.length > 0 ? execs.length * 20 : totalVisitsPlanned,
      totalTasks,
      pendingTasks,
      completedTasks,
      overdueTasks,
      highPriorityPendingTasks,
      taskResolutionRate,
      averagePriorityScore: avgPriority,
      priorityScorePercentage,
      highPriorityCount,
      mediumPriorityCount,
      lowPriorityCount,
      highPriorityPercentage,
      totalOrganizationsCovered: uniqueOrgIds.size,
      activeExecutivesCount: uniqueExecIds.size || execs.length,
      pipelineOpportunitiesCount: 0,
      estimatedPipelineValue: 0
    },
    dailyTrends,
    priorityDistribution,
    executiveBenchmarks,
    taskBreakdown
  };
}

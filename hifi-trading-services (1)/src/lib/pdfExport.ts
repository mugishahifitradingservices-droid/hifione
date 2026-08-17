import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PlannedVisit, AppUser } from '../types';

export interface PDFExportOptions {
  selectedDate: string;
  generatedBy?: AppUser | null;
  visits: PlannedVisit[];
  executives: AppUser[];
  conflictsMap: { [visitId: string]: string };
  filterExecutiveName?: string;
  filterTerritory?: string;
  filterPriority?: string;
  filterStatus?: string;
  viewModeName?: string;
  orientation?: 'landscape' | 'portrait';
  includeSignOff?: boolean;
  includeKPIs?: boolean;
}

export interface ExecutiveItineraryExportOptions {
  selectedDate: string;
  executive: AppUser;
  visits: PlannedVisit[];
  conflictsMap: { [visitId: string]: string };
  generatedBy?: AppUser | null;
}

// Helper to convert time to minutes from midnight
const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const clean = timeStr.trim().toUpperCase();
  if (clean.includes('AM') || clean.includes('PM')) {
    const parts = clean.split(/\s+/);
    const timeParts = parts[0].split(':');
    let hours = parseInt(timeParts[0], 10) || 0;
    const minutes = parseInt(timeParts[1] || '0', 10) || 0;
    if (parts[1] === 'PM' && hours < 12) hours += 12;
    if (parts[1] === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  } else {
    const parts = clean.split(':');
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return hours * 60 + minutes;
  }
};

// Helper to format minutes into AM/PM
const minutesToFormattedTime = (totalMinutes: number): string => {
  let hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hours}:${minStr} ${ampm}`;
};

// Format nice readable date: e.g. "Friday, 14 August 2026"
const formatHumanDate = (dateStr: string): string => {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

/**
 * Exports the complete or filtered team field planning schedule to an executive-ready PDF report
 */
export const exportTeamScheduleToPDF = (options: PDFExportOptions) => {
  const {
    selectedDate,
    generatedBy,
    visits,
    executives,
    conflictsMap,
    filterExecutiveName = 'All Executives',
    filterTerritory = 'All Territories',
    filterPriority = 'All',
    filterStatus = 'All',
    viewModeName = 'Team Planning Schedule',
    orientation = 'landscape',
    includeSignOff = true,
    includeKPIs = true
  } = options;

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Colors
  const primaryNavy = [24, 72, 160] as [number, number, number]; // #1848A0
  const darkSlate = [30, 41, 59] as [number, number, number]; // #1E293B
  const textMuted = [100, 116, 139] as [number, number, number]; // #64748B
  const lightBg = [248, 250, 252] as [number, number, number]; // #F8FAFC
  const borderCol = [226, 232, 240] as [number, number, number]; // #E2E8F0
  const dangerRed = [220, 38, 38] as [number, number, number]; // #DC2626
  const purpleCol = [124, 58, 237] as [number, number, number]; // #7C3AED

  // 1. Header Banner
  doc.setFillColor(...primaryNavy);
  doc.rect(0, 0, pageWidth, 22, 'F');

  // Brand Name & Tagline
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('HIFI ONE', margin, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(220, 235, 255);
  doc.text('HIFI TRADING SERVICES LTD | One place. Every opportunity.', margin, 17);

  // Document Title on Right of Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('FIELD PLANNING & SCHEDULE REPORT', pageWidth - margin, 11, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(220, 235, 255);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, 17, { align: 'right' });

  // 2. Metadata Information Block
  let currentY = 27;

  doc.setFillColor(...lightBg);
  doc.setDrawColor(...borderCol);
  doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 17, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkSlate);
  doc.text('SCHEDULE DATE:', margin + 4, currentY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...primaryNavy);
  doc.text(formatHumanDate(selectedDate), margin + 35, currentY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkSlate);
  const midX = orientation === 'landscape' ? 120 : 100;
  doc.text('PREPARED BY:', midX, currentY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textMuted);
  doc.text(generatedBy?.name ? `${generatedBy.name} (${generatedBy.role.replace(/_/g, ' ')})` : 'Marketing Manager', midX + 27, currentY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkSlate);
  doc.text('VIEW MODE:', pageWidth - margin - 45, currentY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textMuted);
  doc.text(viewModeName, pageWidth - margin - 4, currentY + 5.5, { align: 'right' });

  // Row 2: Filters applied
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...darkSlate);
  doc.text('FILTERS:', margin + 4, currentY + 12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textMuted);
  const filterSummary = `Executive: ${filterExecutiveName}  |  Territory: ${filterTerritory}  |  Priority: ${filterPriority}  |  Status: ${filterStatus}`;
  doc.text(filterSummary, margin + 22, currentY + 12);

  currentY += 21;

  // 3. Summary Statistics Cards
  const totalVisits = visits.length;
  const managerAssigned = visits.filter(v => v.assignment_type === 'MANAGER_ASSIGNED').length;
  const conflictsCount = Object.keys(conflictsMap).length;
  const highPriorityCount = visits.filter(v => v.priority === 'HIGH').length;
  const activeExecsCount = new Set(visits.map(v => v.employee_id)).size;

  if (includeKPIs) {
    const cardCount = 5;
    const cardSpacing = 3.5;
    const cardWidth = (pageWidth - (margin * 2) - ((cardCount - 1) * cardSpacing)) / cardCount;
    const cardHeight = 13;

    const metrics = [
      { label: 'TOTAL VISITS', val: totalVisits.toString(), color: primaryNavy },
      { label: 'ACTIVE EXECUTIVES', val: activeExecsCount.toString(), color: darkSlate },
      { label: 'MANAGER ASSIGNED', val: managerAssigned.toString(), color: purpleCol },
      { label: 'HIGH PRIORITY', val: highPriorityCount.toString(), color: [234, 88, 12] as [number, number, number] },
      { label: 'SCHEDULE CONFLICTS', val: conflictsCount.toString(), color: conflictsCount > 0 ? dangerRed : textMuted }
    ];

    metrics.forEach((m, idx) => {
      const cardX = margin + (idx * (cardWidth + cardSpacing));
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...borderCol);
      doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(...textMuted);
      doc.text(m.label, cardX + 2.5, currentY + 4);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...m.color);
      doc.text(m.val, cardX + 2.5, currentY + 10);
    });

    currentY += cardHeight + 4.5;
  }

  // Conflict Warning Callout (if conflicts exist)
  if (conflictsCount > 0) {
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(252, 165, 165);
    doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 7.5, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...dangerRed);
    doc.text(
      `ATTENTION: ${conflictsCount} schedule overlap conflict(s) detected for ${selectedDate}. Review items flagged with [CONFLICT] in red below.`,
      margin + 3.5,
      currentY + 4.8
    );
    currentY += 10;
  }

  // Sort visits chronologically by executive name then start time
  const sortedVisits = [...visits].sort((a, b) => {
    const execA = a.employee?.name || '';
    const execB = b.employee?.name || '';
    if (execA !== execB) return execA.localeCompare(execB);
    return timeToMinutes(a.planned_start_time) - timeToMinutes(b.planned_start_time);
  });

  // Table Columns & Data
  const isLandscape = orientation === 'landscape';

  const tableData = sortedVisits.map((v, index) => {
    const startMins = timeToMinutes(v.planned_start_time);
    const endMins = startMins + (v.estimated_duration || 60);
    const timeFormatted = `${v.planned_start_time} - ${minutesToFormattedTime(endMins)}`;
    const orgName = v.organization?.name || 'Client';
    const city = v.organization?.city || v.organization?.district || v.organization?.address || '-';
    const execName = v.employee?.name || 'Unassigned';
    const isConflicted = Boolean(conflictsMap[v.id]);

    const statusLabel = v.status.replace(/_/g, ' ');
    const typeLabel = v.assignment_type === 'MANAGER_ASSIGNED' ? 'Manager' : 'Self-Planned';

    if (isLandscape) {
      return [
        (index + 1).toString(),
        timeFormatted + (isConflicted ? '\n[CONFLICT]' : ''),
        execName,
        `${orgName}\n(${city})`,
        v.purpose || 'Client Meeting & Requirement Identification',
        `${v.estimated_duration || 60}m`,
        v.priority || 'MED',
        typeLabel,
        statusLabel
      ];
    } else {
      return [
        timeFormatted + (isConflicted ? ' [!]' : ''),
        execName,
        `${orgName} (${city})`,
        v.purpose || 'Visit',
        v.priority || 'MED',
        statusLabel
      ];
    }
  });

  if (tableData.length === 0) {
    tableData.push(
      isLandscape
        ? ['-', '-', 'No scheduled visits found matching the active filters.', '-', '-', '-', '-', '-', '-']
        : ['-', 'No scheduled visits found matching the active filters.', '-', '-', '-', '-']
    );
  }

  const tableHeaders = isLandscape
    ? [['#', 'Time Window', 'Field Executive', 'Client & Location', 'Visit Purpose / Agenda', 'Dur.', 'Pri.', 'Type', 'Status']]
    : [['Time Window', 'Executive', 'Client & Location', 'Purpose', 'Pri.', 'Status']];

  autoTable(doc, {
    startY: currentY,
    head: tableHeaders,
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryNavy,
      textColor: [255, 255, 255],
      fontSize: 7.2,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 2
    },
    bodyStyles: {
      fontSize: 7,
      textColor: darkSlate,
      cellPadding: 2,
      lineColor: borderCol
    },
    alternateRowStyles: {
      fillColor: [250, 250, 252]
    },
    columnStyles: isLandscape ? {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 30, fontStyle: 'bold' },
      2: { cellWidth: 32, fontStyle: 'bold' },
      3: { cellWidth: 48 },
      4: { cellWidth: 'auto' },
      5: { cellWidth: 14, halign: 'center' },
      6: { cellWidth: 16, halign: 'center' },
      7: { cellWidth: 20, halign: 'center' },
      8: { cellWidth: 22, halign: 'center' }
    } : {
      0: { cellWidth: 30, fontStyle: 'bold' },
      1: { cellWidth: 32, fontStyle: 'bold' },
      2: { cellWidth: 44 },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 22, halign: 'center' }
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const rowIndex = data.row.index;
        const originalVisit = sortedVisits[rowIndex];

        if (originalVisit && conflictsMap[originalVisit.id]) {
          data.cell.styles.fillColor = [254, 242, 242];
          if ((isLandscape && data.column.index === 1) || (!isLandscape && data.column.index === 0)) {
            data.cell.styles.textColor = dangerRed;
            data.cell.styles.fontStyle = 'bold';
          }
        }

        // Priority Column styling
        const priColIdx = isLandscape ? 6 : 4;
        if (data.column.index === priColIdx) {
          const val = String(data.cell.raw);
          if (val.includes('HIGH')) {
            data.cell.styles.textColor = [194, 65, 12];
            data.cell.styles.fontStyle = 'bold';
          }
        }

        // Status Column styling
        const statusColIdx = isLandscape ? 8 : 5;
        if (data.column.index === statusColIdx) {
          const val = String(data.cell.raw);
          if (val.includes('COMPLETED')) {
            data.cell.styles.textColor = [5, 150, 105];
            data.cell.styles.fontStyle = 'bold';
          } else if (val.includes('IN PROGRESS')) {
            data.cell.styles.textColor = [2, 132, 199];
            data.cell.styles.fontStyle = 'bold';
          } else if (val.includes('RESCHEDULE')) {
            data.cell.styles.textColor = [217, 119, 6];
          }
        }
      }
    },
    margin: { left: margin, right: margin, bottom: includeSignOff ? 30 : 16 },
    didDrawPage: (data) => {
      const totalPages = (doc as any).internal.getNumberOfPages();
      const pageNum = data.pageNumber;

      // Draw Sign-off block on the final page if requested
      if (includeSignOff && pageNum === totalPages) {
        const signY = pageHeight - 24;
        doc.setDrawColor(...borderCol);
        doc.line(margin, signY, pageWidth - margin, signY);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...textMuted);

        const colW = (pageWidth - (margin * 2)) / 3;
        doc.text('Prepared By (Manager): ____________________', margin, signY + 6);
        doc.text('Reviewed By (Sales Lead): __________________', margin + colW, signY + 6);
        doc.text('Date & Signature: _________________________', margin + (colW * 2), signY + 6);
      }

      // Page Footer
      doc.setDrawColor(...borderCol);
      doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...textMuted);
      doc.text('HIFI ONE  •  Internal Operations & Field Planning  •  Confidential', margin, pageHeight - 6);

      doc.text(
        `Page ${pageNum} of ${totalPages}`,
        pageWidth - margin,
        pageHeight - 6,
        { align: 'right' }
      );
    }
  });

  const sanitizedDate = selectedDate.replace(/[^0-9-]/g, '_');
  const filename = `HIFI_ONE_Team_Schedule_${sanitizedDate}.pdf`;
  doc.save(filename);
};

/**
 * Exports a dedicated, single-executive daily itinerary sheet (Ideal for field printing/handout)
 */
export const exportExecutiveItineraryPDF = (options: ExecutiveItineraryExportOptions) => {
  const { selectedDate, executive, visits, conflictsMap, generatedBy } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 14;

  const primaryNavy = [24, 72, 160] as [number, number, number];
  const darkSlate = [30, 41, 59] as [number, number, number];
  const textMuted = [100, 116, 139] as [number, number, number];
  const lightBg = [248, 250, 252] as [number, number, number];
  const borderCol = [226, 232, 240] as [number, number, number];
  const dangerRed = [220, 38, 38] as [number, number, number];

  // Header Banner
  doc.setFillColor(...primaryNavy);
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('HIFI ONE', margin, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(220, 235, 255);
  doc.text('HIFI TRADING SERVICES LTD | Field Operations', margin, 17);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('DAILY FIELD ITINERARY', pageWidth - margin, 11, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(220, 235, 255);
  doc.text(formatHumanDate(selectedDate), pageWidth - margin, 17, { align: 'right' });

  // Executive Profile Card
  let currentY = 29;
  doc.setFillColor(...lightBg);
  doc.setDrawColor(...borderCol);
  doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 20, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryNavy);
  doc.text(executive.name, margin + 4, currentY + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...textMuted);
  doc.text(`Role: ${executive.role.replace(/_/g, ' ')}  |  Email: ${executive.email}`, margin + 4, currentY + 12);
  doc.text(`Supervisor: ${generatedBy?.name || 'Marketing Manager'}  |  Target Visits: ${visits.length}`, margin + 4, currentY + 16.5);

  currentY += 24;

  const sortedVisits = [...visits].sort(
    (a, b) => timeToMinutes(a.planned_start_time) - timeToMinutes(b.planned_start_time)
  );

  const tableData = sortedVisits.map((v, index) => {
    const startMins = timeToMinutes(v.planned_start_time);
    const endMins = startMins + (v.estimated_duration || 60);
    const timeFormatted = `${v.planned_start_time} - ${minutesToFormattedTime(endMins)}`;
    const orgName = v.organization?.name || 'Client';
    const address = v.organization?.address || v.organization?.city || 'On-site';
    const phone = v.organization?.phone || '-';
    const isConflicted = Boolean(conflictsMap[v.id]);

    return [
      (index + 1).toString(),
      timeFormatted + (isConflicted ? '\n[CONFLICT]' : ''),
      `${orgName}\nAddress: ${address}\nTel: ${phone}`,
      v.purpose || 'Client Requirement Identification',
      `${v.estimated_duration || 60}m`,
      v.priority || 'MED',
      v.assignment_type === 'MANAGER_ASSIGNED' ? 'Assigned by Manager' : 'Self-Planned'
    ];
  });

  if (tableData.length === 0) {
    tableData.push(['-', '-', 'No visits scheduled for this date.', '-', '-', '-', '-']);
  }

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Time Window', 'Client & Contact Details', 'Visit Purpose / Objective', 'Dur.', 'Pri.', 'Source']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryNavy,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 2.5
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: darkSlate,
      cellPadding: 2.5,
      lineColor: borderCol
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 32, fontStyle: 'bold' },
      2: { cellWidth: 55 },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 16, halign: 'center' },
      6: { cellWidth: 26, halign: 'center' }
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const originalVisit = sortedVisits[data.row.index];
        if (originalVisit && conflictsMap[originalVisit.id]) {
          data.cell.styles.fillColor = [254, 242, 242];
          if (data.column.index === 1) {
            data.cell.styles.textColor = dangerRed;
          }
        }
      }
    },
    margin: { left: margin, right: margin, bottom: 28 },
    didDrawPage: (data) => {
      const totalPages = (doc as any).internal.getNumberOfPages();
      const pageNum = data.pageNumber;

      if (pageNum === totalPages) {
        const signY = pageHeight - 22;
        doc.setDrawColor(...borderCol);
        doc.line(margin, signY, pageWidth - margin, signY);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...textMuted);
        doc.text('Executive Signature: _______________________', margin, signY + 6);
        doc.text('Date Verified: ____________________________', margin + 95, signY + 6);
      }

      doc.setDrawColor(...borderCol);
      doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...textMuted);
      doc.text('HIFI ONE  •  Field Operations Itinerary', margin, pageHeight - 6);
      doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
    }
  });

  const sanitizedDate = selectedDate.replace(/[^0-9-]/g, '_');
  const sanitizedName = executive.name.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `HIFI_ONE_Itinerary_${sanitizedName}_${sanitizedDate}.pdf`;
  doc.save(filename);
};

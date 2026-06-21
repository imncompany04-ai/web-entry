import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Trash2, Edit2, ArrowUpDown, Layout, Copy, X, Check,
  Search, ChevronDown, ChevronUp, Tag, Download, ChevronLeft, ChevronRight, GripVertical, FileText,
  Clock, Activity, Printer
} from 'lucide-react';
import { LoadingEntry, EntryStatus, Party, User, Permission, AppSettings } from '../types';
import EntryModal from './EntryModal';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface EntrySheetProps {
  currentUser: User;
  entries: LoadingEntry[];
  parties: Party[];
  settings: AppSettings;
  onAddEntry: (entry: Omit<LoadingEntry, 'id' | 'srNo' | 'entryTime' | 'date'>) => void;
  onDeleteEntries: (ids: string[]) => void;
  onUpdateEntry: (id: string, updates: Partial<LoadingEntry>) => void;
}

type SortConfig = { key: keyof LoadingEntry; direction: 'asc' | 'desc'; } | null;

interface Column {
  label: string;
  key: keyof LoadingEntry;
  width: string;
  visible: boolean;
}

const formatDate = (isoString: string) => {
  if (!isoString) return { table: '', header: '' };
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return { table: '', header: '' };
  
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const fullY = date.getFullYear();
  const formatted = `${fullY}-${m}-${d}`;
  return {
    table: formatted,
    header: formatted
  };
};

export const EntrySheet: React.FC<EntrySheetProps> = ({ currentUser, entries, parties, settings, onAddEntry, onDeleteEntries, onUpdateEntry }) => {
  const todayDate = new Date().toISOString().split('T')[0];
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [dateFilterType, setDateFilterType] = useState<'Today' | 'Yesterday' | 'This Month' | 'Last Month' | 'This Financial Year' | 'Custom'>('Today');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(50);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    if (dateFilterType === 'Today') {
      setStartDate(today);
      setEndDate(today);
    } else if (dateFilterType === 'Yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yStr = yesterday.toISOString().split('T')[0];
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (dateFilterType === 'This Month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(lastDay.toISOString().split('T')[0]);
    } else if (dateFilterType === 'Last Month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(lastDay.toISOString().split('T')[0]);
    } else if (dateFilterType === 'This Financial Year') {
      const currentYear = now.getFullYear();
      const startYear = now.getMonth() < 3 ? currentYear - 1 : currentYear;
      const firstDay = new Date(startYear, 3, 1);
      const lastDay = new Date(startYear + 1, 2, 31);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(lastDay.toISOString().split('T')[0]);
    }
  }, [dateFilterType]);

  const hasAdmin = currentUser.rights.includes(Permission.ADMIN_ACCESS);
  const canViewPast = hasAdmin || currentUser.rights.includes(Permission.VIEW_PAST_ENTRIES);
  const canAddEntry = hasAdmin || currentUser.rights.includes(Permission.ADD_ENTRY);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LoadingEntry | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('All Status');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; ids: string[]; message: string } | null>(null);
  
  const [startDate, setStartDate] = useState<string>(todayDate);
  const [endDate, setEndDate] = useState<string>(todayDate);
  
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [isColumnChooserOpen, setIsColumnChooserOpen] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // PDF, Print Modal & Toast UI States
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [pdfToast, setPdfToast] = useState<string | null>(null);

  useEffect(() => {
    if (pdfToast) {
      const timer = setTimeout(() => {
        setPdfToast(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [pdfToast]);

  // Lock scroll when modal is open
  useEffect(() => {
    if (isModalOpen || isColumnChooserOpen || isPrintModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen, isColumnChooserOpen, isPrintModalOpen]);

  const currentFontSize = settings.entryFontSize || 12;

  const [columns, setColumns] = useState<Column[]>(() => {
    const savedOrder = localStorage.getItem('mozart_columns_order');
    const savedVisibility = localStorage.getItem('mozart_columns_visibility');
    
    const defaultCols: Column[] = [
      { label: 'SR', key: 'srNo', width: 'w-12', visible: true },
      { label: 'DATE', key: 'date', width: 'w-24', visible: true },
      { label: 'TIME', key: 'entryTime', width: 'w-24', visible: true },
      { label: 'TRUCK NO.', key: 'truckNo', width: 'w-32', visible: true },
      { label: 'TEMPO NO.', key: 'tempoNumber', width: 'w-24', visible: true },
      { label: 'PARTY', key: 'partyName', width: '', visible: true },
      { label: 'ALLOW WT', key: 'allowedWeight', width: 'w-24 text-center', visible: true },
      { label: 'QTY', key: 'quantity', width: 'w-24 text-center', visible: true },
      { label: 'STATUS', key: 'status', width: 'w-32', visible: true },
      { label: 'REMARK', key: 'remarks', width: 'min-w-[150px]', visible: false }
    ];

    if (savedOrder) {
      try {
        const orderKeys = JSON.parse(savedOrder);
        const visibility = savedVisibility ? JSON.parse(savedVisibility) : {};
        const ordered = orderKeys.map((key: string) => {
          const col = defaultCols.find(c => key === c.key);
          return col ? { ...col, visible: visibility[key] ?? col.visible } : null;
        }).filter(Boolean);
        return ordered.length === defaultCols.length ? ordered : defaultCols;
      } catch { return defaultCols; }
    }
    return defaultCols;
  });

  useEffect(() => {
    const orderKeys = columns.map(c => c.key);
    const visibilityMap = columns.reduce((acc, col) => ({ ...acc, [col.key]: col.visible }), {});
    localStorage.setItem('mozart_columns_order', JSON.stringify(orderKeys));
    localStorage.setItem('mozart_columns_visibility', JSON.stringify(visibilityMap));
  }, [columns]);

  const toggleColumn = (key: keyof LoadingEntry) => {
    setColumns(prev => prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
  };

  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    const newCols = [...columns];
    const item = newCols.splice(draggedIdx, 1)[0];
    newCols.splice(idx, 0, item);
    setColumns(newCols);
    setDraggedIdx(idx);
  };

  const allFilteredEntries = useMemo(() => {
    let result = entries.filter(entry => {
      if (!canViewPast && entry.date !== todayDate) return false;
      
      const matchStatus = filterStatus === 'All Status' || entry.status === filterStatus;
      const matchDate = (!startDate || entry.date >= startDate) && (!endDate || entry.date <= endDate);
      
      const searchStr = searchTerm.toLowerCase();
      const matchSearch = !searchTerm || 
        entry.truckNo.toLowerCase().includes(searchStr) || 
        entry.partyName.toLowerCase().includes(searchStr) || 
        entry.tempoNumber.toLowerCase().includes(searchStr) ||
        entry.srNo.toString().includes(searchStr) ||
        (entry.remarks && entry.remarks.toLowerCase().includes(searchStr));

      return matchStatus && matchDate && matchSearch;
    });

    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (sortConfig.key === 'entryTime') {
          const parseTime = (s: string) => {
            const m = String(s || '').match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (!m) return 0;
            let [_, h, min, p] = m;
            let hours = parseInt(h, 10);
            const minutes = parseInt(min, 10);
            const isPM = p.toUpperCase() === 'PM';
            if (isPM && hours < 12) hours += 12;
            if (!isPM && hours === 12) hours = 0;
            return hours * 60 + minutes;
          };
          const aT = parseTime(String(aVal));
          const bT = parseTime(String(bVal));
          return sortConfig.direction === 'asc' ? aT - bT : bT - aT;
        }

        if (typeof aVal === 'number' && typeof bVal === 'number') return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        return sortConfig.direction === 'asc' ? String(aVal || '').localeCompare(String(bVal || '')) : String(bVal || '').localeCompare(String(aVal || ''));
      });
    }
    return result;
  }, [entries, filterStatus, startDate, endDate, searchTerm, sortConfig, canViewPast, todayDate]);

  const totalPages = pageSize === 'all' ? 1 : Math.ceil(allFilteredEntries.length / (pageSize as number));
  
  const filteredEntries = useMemo(() => {
    if (pageSize === 'all') return allFilteredEntries;
    const start = (currentPage - 1) * (pageSize as number);
    return allFilteredEntries.slice(start, start + (pageSize as number));
  }, [allFilteredEntries, currentPage, pageSize]);

  const stats = useMemo(() => ({
    count: allFilteredEntries.length,
    totalQuantity: allFilteredEntries.reduce((sum, e) => sum + e.quantity, 0)
  }), [allFilteredEntries]);

  const handleExport = () => {
    const dataToExport = allFilteredEntries.map((e, i) => ({
      "SR#": i + 1,
      "Date": formatDate(e.date).table,
      "Time": e.entryTime,
      "Truck No.": e.truckNo,
      "Tempo No.": e.tempoNumber,
      "Party Name": e.partyName,
      "Allowed Wt": e.allowedWeight,
      "Quantity": e.quantity,
      "Status": e.status,
      "Remarks": e.remarks || ""
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Entries");
    XLSX.writeFile(workbook, `Loading_Entries_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const copyAsBorderedTable = async (dataEntries: LoadingEntry[], label: string) => {
    const visibleCols = columns.filter(c => c.visible);
    if (visibleCols.length === 0) return;
    const colWidth = 18;
    const headersText = visibleCols.map(c => c.label.padEnd(colWidth)).join(' | ');
    const rowLinesText = dataEntries.map((entry, idx) => {
      return visibleCols.map(c => {
        const val = c.key === 'srNo' ? (idx + 1) : c.key === 'date' ? formatDate(String(entry[c.key])).table : entry[c.key];
        return String(val || '').padEnd(colWidth);
      }).join(' | ');
    }).join('\n');
    const textTable = `${headersText}\n${'-'.repeat(headersText.length)}\n${rowLinesText}`;
    try {
      await navigator.clipboard.writeText(textTable);
      alert(`${label} data copied to clipboard`);
    } catch (err) { console.error(err); }
  };

  const copyEntryAsImage = (entry: LoadingEntry, indexNumber: number) => {
    const canvas = document.createElement('canvas');
    const scale = 3; // Ultra High-DPI crisp scale (quality is big!)
    const widthVal = 1445;
    const heightVal = 100;
    canvas.width = widthVal * scale;
    canvas.height = heightVal * scale;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.scale(scale, scale);
    
    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, widthVal, heightVal);
    
    // Header row tint block (#f8fafc)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, widthVal, 42);
    
    // Borders
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;

    // Top horizontal border
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(widthVal, 0);
    ctx.stroke();

    // Middle separator border
    ctx.beginPath();
    ctx.moveTo(0, 42);
    ctx.lineTo(widthVal, 42);
    ctx.stroke();

    // Bottom horizontal border
    ctx.beginPath();
    ctx.moveTo(0, heightVal - 1);
    ctx.lineTo(widthVal, heightVal - 1);
    ctx.stroke();

    const cols = [
      { label: 'SR', width: 65, key: 'srNo' },
      { label: 'DATE', width: 130, key: 'date' },
      { label: 'TIME', width: 120, key: 'entryTime' },
      { label: 'PARTY', width: 230, key: 'partyName' },
      { label: 'TRUCK NO.', width: 200, key: 'truckNo' },
      { label: 'TEMPO NO.', width: 130, key: 'tempoNumber' },
      { label: 'ALLOW WT', width: 130, key: 'allowedWeight' },
      { label: 'QTY', width: 110, key: 'quantity' },
      { label: 'STATUS', width: 175, key: 'status' },
      { label: 'REMARK', width: 155, key: 'remarks' }
    ];

    let currentX = 0;
    cols.forEach(col => {
      const colWidth = col.width;
      const centerX = currentX + colWidth / 2;
      
      // Draw Header Text
      ctx.fillStyle = '#71717a'; // zinc-500
      ctx.font = '800 11px Inter, "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(col.label, centerX, 21);
      
      // Draw Column Value at Y = 71
      if (col.key === 'status') {
        const valStr = String(entry.status || '').toUpperCase();
        let bg = '#d1fae5';
        let txt = '#065f46';
        let brd = '#10b981';
        
        if (valStr === 'UNDERLOADING') {
          bg = '#e0e7ff';
          txt = '#3730a3';
          brd = '#6366f1';
        } else if (valStr === 'PENDING') {
          bg = '#fef3c7';
          txt = '#92400e';
          brd = '#fbbf24';
        }
        
        const badgeW = 110;
        const badgeH = 26;
        const badgeX = centerX - badgeW / 2;
        const badgeY = 71 - badgeH / 2;
        const radius = 13;
        
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, radius);
        } else {
          ctx.moveTo(badgeX + radius, badgeY);
          ctx.arcTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + badgeH, radius);
          ctx.arcTo(badgeX + badgeW, badgeY + badgeH, badgeX, badgeY + badgeH, radius);
          ctx.arcTo(badgeX, badgeY + badgeH, badgeX, badgeY, radius);
          ctx.arcTo(badgeX, badgeY, badgeX + badgeW, badgeY, radius);
        }
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.strokeStyle = brd;
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.fillStyle = txt;
        ctx.font = '800 10.5px Inter, "Helvetica Neue", Arial, sans-serif';
        ctx.fillText(valStr, centerX, 71);
      } else {
        let valText = '';
        if (col.key === 'srNo') {
          valText = String(indexNumber);
        } else if (col.key === 'date') {
          valText = formatDate(String(entry.date)).table;
        } else if (col.key === 'allowedWeight') {
          valText = entry.allowedWeight ? `${entry.allowedWeight} MT` : '—';
        } else if (col.key === 'quantity') {
          valText = Number(entry.quantity).toLocaleString();
        } else if (col.key === 'remarks') {
          valText = entry.remarks || '—';
        } else {
          valText = String(entry[col.key as keyof LoadingEntry] || '—');
        }
        
        if (!valText || valText.trim() === '') {
          valText = '—';
        }

        ctx.fillStyle = '#1c1917';
        
        if (col.key === 'truckNo' || col.key === 'allowedWeight' || col.key === 'srNo' || col.key === 'quantity') {
          ctx.font = '800 14px "JetBrains Mono", "Fira Code", monospace';
        } else if (col.key === 'partyName') {
          ctx.font = '800 14px Inter, "Helvetica Neue", Arial, sans-serif';
        } else {
          ctx.font = '600 14px Inter, "Helvetica Neue", Arial, sans-serif';
        }
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(valText, centerX, 71);
      }
      
      currentX += colWidth;
    });

    try {
      setPdfToast("Compiling high-resolution image...");
      canvas.toBlob((blob) => {
        if (blob) {
          try {
            navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]).then(() => {
              setPdfToast("Copied ultra high-quality Row Image to clipboard!");
            }).catch((err) => {
              console.error(err);
              setPdfToast("Failed to copy image. Please try again.");
            });
          } catch (e) {
            console.error(e);
            setPdfToast("Clipboard image writing not supported in this frame.");
          }
        } else {
          setPdfToast("Failed to compile image.");
        }
      }, 'image/png', 1.0);
    } catch (err) {
      console.error(err);
      setPdfToast("Failed to copy high-fidelity image.");
    }
  };

  const handlePrint = () => {
    try {
      setPdfToast("Compiling high-fidelity print document...");
      // Initialize portrait A4 document
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });

      const todayStr = formatDate(new Date().toISOString()).header;
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;

      // Draw top header branding
      doc.setFillColor(24, 24, 27); // stone-900 (almost black)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(24, 24, 27);
      doc.text("ITOLI GRANITO LLP", 30, 48);

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(115, 115, 115); // stone-500
      doc.text(`VEHICLE LOADING REGISTER | DOWNLOAD DATE: ${todayStr} (IST)`, 30, 66);

      // Add solid stylish bottom border line under title
      doc.setDrawColor(24, 24, 27);
      doc.setLineWidth(1.5);
      doc.line(30, 78, pageWidth - 30, 78);

      // Columns requested
      const tableHeaders = [
        ['SR', 'DATE', 'TIME', 'TRUCK NO.', 'TEMPO NO.', 'PARTY NAME', 'ALLOW WT', 'QUANTITY', 'STATUS', 'REMARKS']
      ];

      // Formulate dataset of all currently visible/filtered records
      const tableRows = allFilteredEntries.map((entry, idx) => {
        return [
          String(idx + 1),
          formatDate(entry.date).table,
          entry.entryTime || '-',
          entry.truckNo || '-',
          entry.tempoNumber || '-',
          entry.partyName || '-',
          Number(entry.allowedWeight || 0).toLocaleString(),
          Number(entry.quantity || 0).toLocaleString(),
          entry.status.toUpperCase(),
          entry.remarks || '-'
        ];
      });

      // Launch official jspdf-autotable rendering engine with Portrait-optimized layout
      autoTable(doc, {
        head: tableHeaders,
        body: tableRows,
        startY: 95,
        margin: { left: 30, right: 30, bottom: 44 },
        styles: {
          fontSize: 7.0,
          cellPadding: 4,
          font: "helvetica",
          textColor: [30, 30, 30],
          lineColor: [220, 220, 220],
          lineWidth: 0.5
        },
        headStyles: {
          fillColor: [24, 24, 27], // stone-900 header
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'left',
          valign: 'middle'
        },
        columnStyles: {
          0: { cellWidth: 22, halign: 'center' },  // SR
          1: { cellWidth: 50 },                  // DATE
          2: { cellWidth: 44 },                  // TIME
          3: { cellWidth: 62 },                  // TRUCK NO.
          4: { cellWidth: 54 },                  // TEMPO NO.
          5: { cellWidth: 105 },                 // PARTY NAME
          6: { cellWidth: 44, halign: 'right' },   // ALLOW WT
          7: { cellWidth: 44, halign: 'right' },   // QUANTITY
          8: { cellWidth: 58, halign: 'center' },  // STATUS
          9: { cellWidth: 'auto' }               // REMARKS
        },
        didParseCell: (data) => {
          // Soft-color badges inside status cells manually for gorgeous look
          if (data.column.index === 8 && data.cell.section === 'body') {
            const rawStatus = String(data.cell.raw).toLowerCase();
            if (rawStatus === 'completed') {
              data.cell.styles.textColor = [16, 124, 65]; // green-700
              data.cell.styles.fontStyle = 'bold';
            } else if (rawStatus === 'underloading') {
              data.cell.styles.textColor = [46, 117, 218]; // blue-700
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.textColor = [194, 84, 0]; // amber-700
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
        alternateRowStyles: {
          fillColor: [250, 250, 249] // stone-50 background for stripe grid contrast
        }
      });

      // Fetch last row positioning for totals footer box placement
      const finalY = (doc as any).lastAutoTable.finalY + 25;

      let totalsY = finalY;
      // If totals are pushed near page end boundary, allocate a clean final page
      if (totalsY > pageHeight - 44) {
        doc.addPage();
        totalsY = 50;
      }

      // Draw bottom divider line
      doc.setDrawColor(24, 24, 27);
      doc.setLineWidth(1);
      doc.line(30, totalsY - 10, pageWidth - 30, totalsY - 10);

      // Print left-aligned total record counts & right-aligned quantity weight sums
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(24, 24, 27);
      
      const totalRecordsText = `TOTAL RECORDS: ${stats.count}`;
      const totalQuantityText = `TOTAL QUANTITY VALUE: ${stats.totalQuantity.toLocaleString()} MT`;

      doc.text(totalRecordsText, 30, totalsY);
      doc.text(totalQuantityText, pageWidth - 30 - doc.getTextWidth(totalQuantityText), totalsY);

      // Prompt automatic print dialog on load
      doc.autoPrint();

      // Convert to blob URL
      const blobUrlObj = doc.output('bloburl');
      const blobUrl = blobUrlObj instanceof URL ? blobUrlObj.toString() : String(blobUrlObj);

      // Create a hidden print iframe
      const printIframe = document.createElement('iframe');
      printIframe.style.position = 'fixed';
      printIframe.style.right = '0';
      printIframe.style.bottom = '0';
      printIframe.style.width = '0';
      printIframe.style.height = '0';
      printIframe.style.border = 'none';
      printIframe.src = blobUrl;

      let isPrinted = false;
      const executePrint = () => {
        if (isPrinted) return;
        isPrinted = true;
        try {
          const iframeWindow = printIframe.contentWindow;
          if (!iframeWindow) {
            throw new Error("Iframe content window is not accessible");
          }
          iframeWindow.focus();
          iframeWindow.print();
          setPdfToast("Print-ready high-fidelity PDF opened successfully!");
        } catch (e) {
          console.warn("Iframe print activation fallback triggered:", e);
          setPdfToast("Opening print stream fallback...");
          // Fallback if browser's cross-origin iframe security rules prevent printing
          window.open(blobUrl, '_blank');
        }

        // Clean up the iframe and revoke blob url after print action has been handled
        setTimeout(() => {
          if (printIframe.parentNode) {
            document.body.removeChild(printIframe);
          }
          window.URL.revokeObjectURL(blobUrl);
        }, 5000);
      };

      printIframe.onload = executePrint;
      document.body.appendChild(printIframe);

      // Safe fallback automatic prompt trigger for browsers where onload doesn't fire on direct PDF rendering inside iframe
      setTimeout(executePrint, 1200);

    } catch (error) {
      console.error("PDF Print compilation error occurred:", error);
      setPdfToast("Standard window print fallback activated...");
      window.print();
    }
  };

  const handleDownloadPDF = () => {
    try {
      // Initialize portrait A4 document
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });

      const todayStr = formatDate(new Date().toISOString()).header;
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;

      // Draw top header branding
      doc.setFillColor(24, 24, 27); // stone-900 (almost black)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(24, 24, 27);
      doc.text("ITOLI GRANITO LLP", 30, 48);

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(115, 115, 115); // stone-500
      doc.text(`VEHICLE LOADING REGISTER | DOWNLOAD DATE: ${todayStr} (IST)`, 30, 66);

      // Add solid stylish bottom border line under title
      doc.setDrawColor(24, 24, 27);
      doc.setLineWidth(1.5);
      doc.line(30, 78, pageWidth - 30, 78);

      // Columns requested
      const tableHeaders = [
        ['SR', 'DATE', 'TIME', 'TRUCK NO.', 'TEMPO NO.', 'PARTY NAME', 'ALLOW WT', 'QUANTITY', 'STATUS', 'REMARKS']
      ];

      // Formulate dataset of all currently visible/filtered records
      const tableRows = allFilteredEntries.map((entry, idx) => {
        return [
          String(idx + 1),
          formatDate(entry.date).table,
          entry.entryTime || '-',
          entry.truckNo || '-',
          entry.tempoNumber || '-',
          entry.partyName || '-',
          Number(entry.allowedWeight || 0).toLocaleString(),
          Number(entry.quantity || 0).toLocaleString(),
          entry.status.toUpperCase(),
          entry.remarks || '-'
        ];
      });

      // Launch official jspdf-autotable rendering engine with Portrait-optimized layout
      autoTable(doc, {
        head: tableHeaders,
        body: tableRows,
        startY: 95,
        margin: { left: 30, right: 30, bottom: 44 },
        styles: {
          fontSize: 7.0,
          cellPadding: 4,
          font: "helvetica",
          textColor: [30, 30, 30],
          lineColor: [220, 220, 220],
          lineWidth: 0.5
        },
        headStyles: {
          fillColor: [24, 24, 27], // stone-900 header
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'left',
          valign: 'middle'
        },
        columnStyles: {
          0: { cellWidth: 22, halign: 'center' },  // SR
          1: { cellWidth: 50 },                  // DATE
          2: { cellWidth: 44 },                  // TIME
          3: { cellWidth: 62 },                  // TRUCK NO.
          4: { cellWidth: 54 },                  // TEMPO NO.
          5: { cellWidth: 105 },                 // PARTY NAME
          6: { cellWidth: 44, halign: 'right' },   // ALLOW WT
          7: { cellWidth: 44, halign: 'right' },   // QUANTITY
          8: { cellWidth: 58, halign: 'center' },  // STATUS
          9: { cellWidth: 'auto' }               // REMARKS
        },
        didParseCell: (data) => {
          // Soft-color badges inside status cells manually for gorgeous look
          if (data.column.index === 8 && data.cell.section === 'body') {
            const rawStatus = String(data.cell.raw).toLowerCase();
            if (rawStatus === 'completed') {
              data.cell.styles.textColor = [16, 124, 65]; // green-700
              data.cell.styles.fontStyle = 'bold';
            } else if (rawStatus === 'underloading') {
              data.cell.styles.textColor = [46, 117, 218]; // blue-700
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.textColor = [194, 84, 0]; // amber-700
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
        alternateRowStyles: {
          fillColor: [250, 250, 249] // stone-50 background for stripe grid contrast
        }
      });

      // Fetch last row positioning for totals footer box placement
      const finalY = (doc as any).lastAutoTable.finalY + 25;

      let totalsY = finalY;
      // If totals are pushed near page end boundary, allocate a clean final page
      if (totalsY > pageHeight - 44) {
        doc.addPage();
        totalsY = 50;
      }

      // Draw bottom divider line
      doc.setDrawColor(24, 24, 27);
      doc.setLineWidth(1);
      doc.line(30, totalsY - 10, pageWidth - 30, totalsY - 10);

      // Print left-aligned total record counts & right-aligned quantity weight sums
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(24, 24, 27);
      
      const totalRecordsText = `TOTAL RECORDS: ${stats.count}`;
      const totalQuantityText = `TOTAL QUANTITY VALUE: ${stats.totalQuantity.toLocaleString()} MT`;

      doc.text(totalRecordsText, 30, totalsY);
      doc.text(totalQuantityText, pageWidth - 30 - doc.getTextWidth(totalQuantityText), totalsY);

      // Save file dynamically
      doc.save(`Loading_Register_${todayStr}.pdf`);
      setPdfToast("PDF Register downloaded successfully!");
    } catch (error) {
      console.error("PDF generation error occurred:", error);
      setPdfToast("Failed to compile vector PDF. Launching browser print instead...");
      window.print();
    }
  };

  const canEditEntry = (entry: LoadingEntry) => {
    if (hasAdmin) return true;
    if (entry.date === todayDate) return currentUser.rights.includes(Permission.EDIT_TODAY_ENTRIES);
    return currentUser.rights.includes(Permission.EDIT_PAST_ENTRIES);
  };

  const canDeleteEntry = (entry: LoadingEntry) => {
    if (hasAdmin) return true;
    if (entry.date === todayDate) return currentUser.rights.includes(Permission.DELETE_TODAY_ENTRIES);
    return currentUser.rights.includes(Permission.DELETE_PAST_ENTRIES);
  };

  // The columns specifically allowed in the PDF layout (reference image)
  const pdfPrintAllowedKeys = ['date', 'entryTime', 'truckNo', 'tempoNumber', 'partyName', 'allowedWeight', 'quantity', 'status', 'remarks'];

  const colWidths: Record<string, string> = {
    date: '8%',
    entryTime: '6%',
    truckNo: '12%',
    tempoNumber: '10%',
    partyName: '25%',
    allowedWeight: '9%',
    quantity: '9%',
    status: '8%',
    remarks: '13%'
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredEntries.map(entry => entry.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectEntry = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    setDeleteConfirm({
      isOpen: true,
      ids: selectedIds,
      message: `Are you sure you want to permanently delete these ${selectedIds.length} selected records? This action cannot be undone.`
    });
  };

  return (
    <div className="space-y-4 md:space-y-6 print:p-0 pb-10">
      {pdfToast && (
        <div className="fixed top-6 right-6 z-[200] max-w-sm bg-stone-900 border border-white/10 text-white rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-top-4 duration-305 flex items-start gap-3 no-print">
          <div className="flex-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-mozart">System Instruction</span>
            <p className="text-xs font-semibold text-stone-200 mt-0.5 leading-relaxed">{pdfToast}</p>
          </div>
          <button onClick={() => setPdfToast(null)} className="text-stone-500 hover:text-white p-1 rounded-lg hover:bg-stone-855 transition-all">
            <X size={14} />
          </button>
        </div>
      )}
      <style>{`
        @media print {
          /* Hide all non-printable elements completely so they do NOT take up any physical page space */
          header, 
          nav, 
          footer, 
          aside, 
          button, 
          .no-print, 
          [class*="no-print"], 
          #activeMobileIndicator, 
          #activeTabBg {
            display: none !important;
          }

          /* Ensure html, body, and root do not add extra padding, scrolling and start clean */
          html, body, #root {
            background: white !important;
            color: #000000 !important;
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Clean printing margins for landscape A4 output */
          @page {
            size: A4 landscape;
            margin: 0.8cm;
          }

          /* Main wrapper for print layout */
          .print-only-table {
            display: block !important;
            visibility: visible !important;
            position: relative !important;
            width: 100% !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-top: 15px !important;
            page-break-inside: auto !important;
          }

          tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }

          thead {
            display: table-header-group !important;
          }

          tfoot {
            display: table-footer-group !important;
          }

          th, td {
            border: 1px solid #d6d3d1 !important;
            padding: 6px 5px !important;
            font-size: 8pt !important;
            color: #000000 !important;
            vertical-align: middle !important;
            word-break: break-all !important;
          }

          th {
            background-color: #181c20 !important;
            color: #ffffff !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            font-size: 8pt !important;
            letter-spacing: 0.02em !important;
            border: 1px solid #181c20 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          td {
            color: #1c1917 !important;
            font-weight: 600 !important;
          }

          tr:nth-child(even) {
            background-color: #f5f5f4 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .status-badge-print {
            border: 1px solid #d6d3d1 !important;
            padding: 1px 5px !important;
            border-radius: 4px !important;
            font-size: 7pt !important;
            font-weight: bold !important;
            display: inline-block !important;
            text-transform: uppercase !important;
          }

          .status-completed {
            background-color: #d1fae5 !important;
            color: #065f46 !important;
            border-color: #10b981 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .status-underloading {
            background-color: #e0e7ff !important;
            color: #3730a3 !important;
            border-color: #6366f1 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .status-pending {
            background-color: #fef3c7 !important;
            color: #92400e !important;
            border-color: #fbbf24 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .print-header {
            border-bottom: 2px solid #1c1917;
            padding-bottom: 10px;
            margin-bottom: 15px;
          }

          .print-header h1 {
            font-size: 20pt !important;
            font-weight: 950 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.1em !important;
            margin: 0 0 4px 0 !important;
            color: #1c1917 !important;
          }

          .print-header p {
            font-size: 9pt !important;
            font-weight: 750 !important;
            color: #57524e !important;
            margin: 0 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.05em !important;
          }

          .totals-section {
            margin-top: 15px;
            display: flex;
            justify-content: flex-end;
            gap: 24px;
            font-size: 10pt;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            border-top: 2px solid #1c1917;
            padding-top: 10px;
            color: #1c1917;
          }
        }
      `}</style>

      {/* Desktop Header Actions */}
      <div className="hidden md:flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">Entry Sheet</h2>
          <p className="text-stone-500 text-xs mt-0.5 font-medium tracking-wide">Daily loading logs and distribution tracking.</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <button 
              onClick={handleDeleteSelected}
              className="p-2 bg-red-50 border border-red-200 rounded-xl text-red-600 hover:bg-red-100 transition-all shadow-sm flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider"
            >
              <Trash2 size={14} /> Delete ({selectedIds.length})
            </button>
          )}
          {hasAdmin && (
            <button onClick={handleExport} className="p-2 bg-white border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 transition-all shadow-sm flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
              <Download size={14} className="text-black" /> Export
            </button>
          )}
          <button onClick={() => setIsColumnChooserOpen(true)} className="p-2 bg-white border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 transition-all shadow-sm flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
            <Layout size={14} /> Columns
          </button>
          <button 
            onClick={() => setIsPrintModalOpen(true)} 
            className="p-2 bg-stone-900 border border-stone-900 rounded-xl text-white hover:bg-stone-800 transition-all shadow-sm flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider focus:outline-none"
          >
            <FileText size={14} className="text-amber-400" /> PDF / Print
          </button>
          {canAddEntry && (
            <button onClick={() => { setEditingEntry(null); setIsModalOpen(true); }} className="bg-black hover:bg-stone-800 text-white px-5 py-2 rounded-xl flex items-center gap-2 font-black shadow-lg transition-all active:scale-95 uppercase tracking-widest text-[10px]">
              <Plus size={16} /> Add Entry
            </button>
          )}
        </div>
      </div>

      {/* Mobile Summary & Filters */}
      <div className="md:hidden space-y-2 mb-4 no-print px-1 -mt-7">
        {/* 2) Summary Cards at Top */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className="bg-white rounded-xl border border-stone-100 p-2.5 shadow-sm text-center">
            <p className="text-3xl font-black text-black leading-none mb-1">{stats.count}</p>
            <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest">Total Logs</p>
          </div>
          <div className="bg-white rounded-xl border border-stone-100 p-2.5 shadow-sm text-center">
            <p className="text-3xl font-black text-black leading-none mb-1">{stats.totalQuantity.toLocaleString()}</p>
            <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest">Total Quantity</p>
          </div>
        </div>

        {/* Mobile Action Pills */}
        <div className="grid grid-cols-2 gap-1.5">
          <button 
            type="button"
            onClick={() => setIsColumnChooserOpen(true)}
            className="py-2.5 bg-white border border-stone-150 rounded-xl text-stone-600 active:bg-stone-50 flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-wider shadow-sm"
          >
            <Layout size={12} /> Columns
          </button>
          <button 
            type="button"
            onClick={() => setIsPrintModalOpen(true)} 
            className="w-full py-2.5 bg-stone-900 border border-stone-900 rounded-xl text-white active:bg-stone-850 flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-wider shadow-sm focus:outline-none"
          >
            <FileText size={12} className="text-amber-400" /> PDF / Print
          </button>
        </div>

        {/* 3) Single Row Filter Bar */}
        <div className="flex items-center justify-between gap-1.5 bg-white p-1.5 rounded-xl border border-stone-100 shadow-sm">
          {/* Left: Date Filter */}
          <div className="relative flex-shrink-0">
            <select 
              value={dateFilterType} 
              onChange={(e) => setDateFilterType(e.target.value as any)}
              className="appearance-none bg-stone-50 border border-stone-100 text-stone-600 pl-2 pr-6 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest outline-none"
            >
              <option value="Today">Today</option>
              <option value="Yesterday">Yest.</option>
              <option value="This Month">Month</option>
              <option value="Last Month">L.Mon</option>
              <option value="This Financial Year">FY</option>
              <option value="Custom">Cust.</option>
            </select>
            <ChevronDown size={8} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400" />
          </div>

          {/* Middle: Status Filter (Icons for mobile to fit) */}
          <div className="flex-1 flex items-center justify-around gap-1 px-1 border-l border-r border-stone-100">
            {[
              { label: 'All', value: 'All Status', icon: <Layout size={14} /> },
              { label: 'Pnd', value: EntryStatus.PENDING, icon: <Clock size={14} /> },
              { label: 'Udl', value: EntryStatus.UNDERLOADING, icon: <Activity size={14} /> },
              { label: 'Cmp', value: EntryStatus.COMPLETED, icon: <Check size={14} /> }
            ].map(s => (
              <button
                key={s.label}
                onClick={() => setFilterStatus(s.value)}
                className={`p-1.5 rounded-lg transition-all flex flex-col items-center gap-0.5 ${
                  filterStatus === s.value
                    ? 'bg-black text-white shadow-sm'
                    : 'text-stone-400'
                }`}
                title={s.label}
              >
                {s.icon}
                <span className="text-[7px] font-black uppercase tracking-tighter">{s.label}</span>
              </button>
            ))}
          </div>

          {/* Right: Search Button */}
          <button 
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className={`p-1.5 rounded-lg transition-all ${isSearchOpen ? 'bg-black text-white' : 'bg-stone-50 text-stone-400'}`}
          >
            <Search size={14} />
          </button>
        </div>

        {/* Search Input (Toggled) */}
        {isSearchOpen && (
          <div className="animate-in slide-in-from-top-2 duration-200">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" />
              <input 
                type="text" 
                autoFocus
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                placeholder="Search truck, party..."
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm font-bold outline-none shadow-sm" 
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-300">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Custom Date Pickers */}
        {dateFilterType === 'Custom' && (
          <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-2 duration-200">
            <div className="space-y-1">
              <label className="text-[8px] font-black text-stone-400 uppercase tracking-widest ml-1">From</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-[10px] font-bold outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black text-stone-400 uppercase tracking-widest ml-1">To</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-[10px] font-bold outline-none" />
            </div>
          </div>
        )}
      </div>

      {/* Desktop Filter View */}
      <div className="hidden md:block bg-white rounded-2xl md:rounded-3xl shadow-sm border border-stone-200 p-3 md:p-4 no-print">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3 flex-1">
            <div className="flex-1 min-w-[150px]">
              <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-1">Search Database</label>
              <div className="relative group mt-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  placeholder="Truck, Party..."
                  className="w-full pl-9 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-bold focus:bg-white transition-all outline-none" 
                />
              </div>
            </div>
            <div>
              <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-1">From Date</label>
              <input type="date" value={startDate} disabled={!canViewPast} onChange={(e) => setStartDate(e.target.value)} className="block mt-1 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-bold outline-none" />
            </div>
            <div>
              <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-1">To Date</label>
              <input type="date" value={endDate} disabled={!canViewPast} onChange={(e) => setEndDate(e.target.value)} className="block mt-1 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-bold outline-none" />
            </div>
            <div>
              <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-1">Status</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="block mt-1 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-bold outline-none">
                <option>All Status</option>
                {Object.values(EntryStatus).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-6 px-4 py-2 bg-stone-50 rounded-xl border border-stone-100">
            <div className="text-center">
              <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-0.5">Logs</p>
              <p className="text-base font-black text-stone-900 leading-none">{stats.count}</p>
            </div>
            <div className="w-px h-6 bg-stone-200" />
            <div className="text-center">
              <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-0.5">Quantity</p>
              <p className="text-base font-black text-black leading-none">{stats.totalQuantity.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Data Table (Desktop UI only - no-print) */}
      <div className="hidden md:block bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden no-print">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-stone-50/50 border-b border-stone-200">
                  <th className="px-4 py-3 w-10">
                    <input 
                      type="checkbox" 
                      className="w-3.5 h-3.5 rounded border-stone-300 accent-black cursor-pointer" 
                      checked={filteredEntries.length > 0 && selectedIds.length === filteredEntries.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  {columns.map(col => {
                    if (!col.visible) return null;

                    return (
                      <th 
                        key={col.key} 
                        className={`px-4 py-3 cursor-pointer hover:bg-stone-100 transition-all ${col.width} whitespace-nowrap`}
                        onClick={() => setSortConfig({ key: col.key, direction: sortConfig?.key === col.key && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
                      >
                        <div className="flex items-center gap-1 font-black uppercase tracking-widest text-stone-400" style={{ fontSize: (currentFontSize - 1) + 'px' }}>
                          {col.label}
                          <ArrowUpDown size={currentFontSize} className="opacity-40" />
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-4 py-3 font-black text-stone-400 uppercase tracking-widest text-right actions-cell" style={{ fontSize: (currentFontSize - 1) + 'px' }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredEntries.length > 0 ? filteredEntries.map((entry, index) => (
                  <tr key={entry.id} className={`hover:bg-stone-50/30 transition-colors group ${selectedIds.includes(entry.id) ? 'bg-stone-50' : ''}`}>
                    <td className="px-4 py-2">
                      <input 
                        type="checkbox" 
                        className="w-3.5 h-3.5 rounded border-stone-300 accent-black cursor-pointer" 
                        checked={selectedIds.includes(entry.id)}
                        onChange={() => handleSelectEntry(entry.id)}
                      />
                    </td>
                    {columns.map(col => {
                      if (!col.visible) return null;

                      return (
                        <td 
                          key={col.key} 
                          className={`px-4 py-2 font-semibold text-stone-700 
                            ${col.key === 'remarks' ? 'max-w-[150px] truncate font-normal italic' : 
                            (col.key === 'date' || col.key === 'entryTime') ? 'whitespace-nowrap' : ''
                          }`} 
                          style={{ fontSize: currentFontSize + 'px' }}
                        >
                          {col.key === 'status' ? <StatusBadge status={entry.status} fontSize={currentFontSize - 3} /> : 
                           col.key === 'srNo' ? (pageSize === 'all' ? index + 1 : (currentPage - 1) * (pageSize as number) + index + 1) : 
                           col.key === 'date' ? formatDate(String(entry[col.key])).table :
                           entry[col.key]}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2 text-right actions-cell">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            const srVal = pageSize === 'all' ? index + 1 : (currentPage - 1) * (pageSize as number) + index + 1;
                            copyEntryAsImage(entry, srVal);
                          }} 
                          title="Copy high-quality Row Image" 
                          className="p-1 text-stone-400 hover:text-black hover:bg-black/10 rounded-lg transition-all"
                        >
                          <Copy size={13} />
                        </button>
                        {canEditEntry(entry) && (
                          <button onClick={() => { setEditingEntry(entry); setIsModalOpen(true); }} className="p-1 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-all"><Edit2 size={13} /></button>
                        )}
                        {canDeleteEntry(entry) && (
                          <button onClick={() => setDeleteConfirm({
                            isOpen: true,
                            ids: [entry.id],
                            message: `Are you sure you want to permanently delete the log entry for party "${entry.partyName}"? This action cannot be undone.`
                          })} className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={13} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={11} className="px-6 py-12 text-center text-stone-400 text-sm font-medium">
                      No logs found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      {/* Mobile Card List (RESTORED) */}
      {isMobile && (
        <div className="space-y-1.5 no-print">
          {filteredEntries.length > 0 ? filteredEntries.map((entry, index) => {
            const isExpanded = expandedEntryId === entry.id;
            return (
              <div key={entry.id} className="bg-white rounded-lg shadow-sm border border-stone-100 overflow-hidden">
                <div 
                  className="px-2.5 py-2 flex items-center cursor-pointer active:bg-stone-50"
                  onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-medium text-stone-800 truncate uppercase tracking-tight">{entry.partyName}</span>
                      <span className="text-[12px] font-black text-stone-900">{entry.quantity.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <div className="text-[8px] font-bold text-stone-400 uppercase">
                        {formatDate(entry.date).table} <span className="mx-1">|</span> {entry.entryTime}
                      </div>
                      <div className={`text-[8px] font-black uppercase tracking-widest flex items-center gap-1 ${
                        entry.status === EntryStatus.COMPLETED ? 'text-emerald-500' : 'text-amber-500'
                      }`}>
                        {entry.status} {isExpanded ? <ChevronUp size={8} /> : <ChevronDown size={8} />}
                      </div>
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <div className="bg-stone-50/50 px-4 py-4 space-y-3 border-t border-stone-50 animate-in slide-in-from-top-1">
                    <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-0.5"><p className="text-[9px] font-black text-stone-400 uppercase">Truck Number</p><p className="text-xs font-bold">{entry.truckNo}</p></div>
                       <div className="space-y-0.5"><p className="text-[9px] font-black text-stone-400 uppercase">Weight</p><p className="text-xs font-bold">{entry.allowedWeight} MT</p></div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                       <button 
                         onClick={() => {
                           const srVal = pageSize === 'all' ? index + 1 : (currentPage - 1) * (pageSize as number) + index + 1;
                           copyEntryAsImage(entry, srVal);
                         }} 
                         className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 py-2 rounded-xl text-[10px] font-black uppercase text-center"
                       >
                         Copy JPG
                       </button>
                       {canEditEntry(entry) && <button onClick={() => { setEditingEntry(entry); setIsModalOpen(true); }} className="flex-1 bg-black hover:bg-stone-800 text-white py-2 rounded-xl text-[10px] font-black uppercase">Edit</button>}
                       {canDeleteEntry(entry) && <button onClick={() => setDeleteConfirm({
                         isOpen: true,
                         ids: [entry.id],
                         message: `Are you sure you want to permanently delete the log entry for party "${entry.partyName}"? This action cannot be undone.`
                       })} className="flex-1 bg-red-50 text-red-500 py-2 rounded-xl text-[10px] font-black uppercase">Remove</button>}
                    </div>
                  </div>
                )}
              </div>
            );
          }) : (
            <div className="py-20 text-center flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center text-stone-200"><Tag size={32} /></div>
              <p className="text-sm font-black text-stone-400 uppercase">No entries found</p>
            </div>
          )}
        </div>
      )}

      {/* Print-Only Full List Table (Only visible when printing. Renders ALL matching/filtered entries across pages) */}
      <div className="hidden print:block w-full print-only-table">
        <div className="print-header mb-4">
          <h1 className="text-xl font-black uppercase tracking-widest text-black">itoli granito llp</h1>
          <p className="text-xs font-bold text-stone-700 tracking-wider">
            VEHICLE LOADING REGISTER | DATE: {formatDate(new Date().toISOString()).header}
          </p>
        </div>
        
        <table className="w-full text-left border-collapse border border-stone-300">
          <thead>
            <tr className="bg-stone-100 border-b border-stone-300">
              <th className="px-3 py-2 text-xs font-black uppercase tracking-wider text-black border border-stone-300 w-10 text-center" style={{ width: '4%' }}>SR</th>
              {columns.map(col => {
                const isPDFVisible = pdfPrintAllowedKeys.includes(col.key);
                if (!isPDFVisible) return null;
                const width = colWidths[col.key] || 'auto';
                const textAlign = (col.key === 'allowedWeight' || col.key === 'quantity') ? 'right' : (col.key === 'status' ? 'center' : 'left');
                return (
                  <th key={col.key} className="px-3 py-2 text-xs font-black uppercase tracking-wider text-black border border-stone-300" style={{ width, textAlign }}>
                    {col.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {allFilteredEntries.map((entry, index) => (
              <tr key={entry.id} className="border-b border-stone-200">
                <td className="px-3 py-2 text-[10px] text-stone-900 border border-stone-300 text-center font-bold" style={{ width: '4%' }}>{index + 1}</td>
                {columns.map(col => {
                  const isPDFVisible = pdfPrintAllowedKeys.includes(col.key);
                  if (!isPDFVisible) return null;
                  
                  let val = entry[col.key];
                  if (col.key === 'date') val = formatDate(String(val)).table;
                  if (col.key === 'allowedWeight' || col.key === 'quantity') val = Number(val).toLocaleString();
                  const textAlign = (col.key === 'allowedWeight' || col.key === 'quantity') ? 'right' : (col.key === 'status' ? 'center' : 'left');
                  const fontStyle = (col.key === 'truckNo' || col.key === 'allowedWeight' || col.key === 'quantity') ? 'font-mono' : '';
                  return (
                    <td key={col.key} className={`px-3 py-2 text-[10px] text-stone-900 border border-stone-300 font-medium ${fontStyle}`} style={{ textAlign }}>
                      {col.key === 'status' ? (
                        <span className={`status-badge-print font-black text-[9px] uppercase status-${String(val).toLowerCase()}`}>{String(val)}</span>
                      ) : (
                        String(val ?? '-')
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="totals-section">
          <span>Total Records: {stats.count}</span>
          <span>Total Quantity: {stats.totalQuantity.toLocaleString()} MT</span>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 mt-4 no-print">
        <div className="flex items-center gap-3">
           <span className="text-[9px] font-black uppercase tracking-widest text-stone-400">Rows per page:</span>
           <div className="flex border border-stone-200 rounded-lg overflow-hidden bg-white">
              {[50, 100, 'all'].map(size => (
                <button 
                  key={size}
                  onClick={() => { setPageSize(size === 'all' ? 'all' : (size as number)); setCurrentPage(1); }}
                  className={`px-3 py-1.5 text-[9px] font-black uppercase transition-all ${pageSize === size ? 'bg-stone-900 text-white' : 'text-stone-400 hover:bg-stone-50'}`}
                >
                  {size === 'all' ? 'All' : size}
                </button>
              ))}
           </div>
        </div>
        
        {pageSize !== 'all' && totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 bg-white border border-stone-200 rounded-lg text-stone-600 disabled:opacity-30"><ChevronLeft size={14} /></button>
            <div className="flex items-center gap-1">
               {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                 let pageNum = totalPages <= 5 ? i + 1 : (currentPage <= 3 ? i + 1 : (currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i));
                 return (
                   <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${currentPage === pageNum ? 'bg-black text-white' : 'bg-white border border-stone-100 text-stone-400'}`}>{pageNum}</button>
                 );
               })}
            </div>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-2 bg-white border border-stone-200 rounded-lg text-stone-600 disabled:opacity-30"><ChevronRight size={14} /></button>
          </div>
        )}
      </div>

      {/* Layout Chooser (MODAL) */}
      {isColumnChooserOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-lg no-print">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200">
             <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-xl font-black text-stone-900 tracking-tight">Layout</h3>
                   <button onClick={() => setIsColumnChooserOpen(false)} className="p-1 text-stone-400 hover:text-stone-900"><X size={20} /></button>
                </div>
                <div className="space-y-2">
                   {columns.map((col, idx) => (
                     <div 
                        key={col.key} 
                        draggable 
                        onDragStart={() => handleDragStart(idx)} 
                        onDragOver={(e) => handleDragOver(e, idx)} 
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-move group ${col.visible ? 'bg-white border-stone-200 shadow-sm' : 'bg-stone-50 border-stone-100 opacity-60'}`}
                     >
                        <GripVertical size={14} className="text-stone-300 group-hover:text-black" />
                        <div onClick={() => toggleColumn(col.key)} className="flex-1 flex items-center justify-between cursor-pointer">
                           <span className="text-[11px] font-black uppercase tracking-widest text-stone-600">{col.label}</span>
                           <div className={`w-4 h-4 rounded flex items-center justify-center border ${col.visible ? 'bg-black border-black text-white' : 'bg-white border-stone-200 text-transparent'}`}><Check size={10} /></div>
                        </div>
                     </div>
                   ))}
                </div>
                <button onClick={() => setIsColumnChooserOpen(false)} className="w-full mt-8 py-3.5 bg-stone-900 text-white font-black rounded-xl uppercase tracking-widest text-[11px] shadow-lg">Save Layout</button>
             </div>
          </div>
        </div>,
        document.body
      )}

      {isModalOpen && <EntryModal parties={parties} editingEntry={editingEntry} onClose={() => { setIsModalOpen(false); setEditingEntry(null); }} onAdd={onAddEntry} onUpdate={onUpdateEntry} />}

      {/* PRINT OPTS MODAL */}
      {isPrintModalOpen && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 no-print">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity"
            onClick={() => setIsPrintModalOpen(false)}
          />
          
          {/* Modal Box */}
          <div className="relative bg-white border border-stone-200 rounded-[28px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-sm overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200 p-6 text-stone-900">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <h3 className="text-xs font-black uppercase tracking-wider text-stone-900 flex items-center gap-2">
                <FileText size={16} className="text-mozart" />
                Print / Export Menu
              </h3>
              <button 
                onClick={() => setIsPrintModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-900 rounded-lg hover:bg-stone-50 transition-all"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="py-6 space-y-4">
              <p className="text-[10px] text-stone-500 font-bold uppercase tracking-wider leading-relaxed mb-1">
                Select an option to generate your files:
              </p>

              {/* Option 1: Print Register */}
              <button 
                type="button"
                onClick={() => {
                  setIsPrintModalOpen(false);
                  setTimeout(() => {
handlePrint();
                  }, 400)
                  
                }}
                
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-stone-150 hover:border-mozart hover:bg-mozart/[0.02] text-left transition-all duration-200 group"
              >
                <div className="p-3 bg-stone-50 group-hover:bg-mozart/10 rounded-xl text-stone-600 group-hover:text-mozart transition-all">
                  <Printer size={20} />
                </div>
                <div className="flex-1">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-stone-900 leading-none">Print Register</h4>
                  <p className="text-[9px] text-stone-400 font-bold normal-case mt-1.5">Directly print the formatted layout to your connected paper printer.</p>
                </div>
              </button>

              {/* Option 2: Save as PDF */}
              <button 
                type="button"
                onClick={() => {
                  setIsPrintModalOpen(false);
                  setPdfToast("Compiling and downloading high-fidelity PDF Register...");
                  setTimeout(() => {
                    handleDownloadPDF();
                  }, 400);
                }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-stone-150 hover:border-mozart hover:bg-mozart/[0.02] text-left transition-all duration-200 group"
              >
                <div className="p-3 bg-stone-50 group-hover:bg-mozart/10 rounded-xl text-stone-600 group-hover:text-mozart transition-all">
                  <FileText size={20} className="text-amber-500" />
                </div>
                <div className="flex-1">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-stone-900 leading-none">Save as PDF</h4>
                  <p className="text-[9px] text-stone-400 font-bold normal-case mt-1.5">Instantly download a neat, high-resolution vector PDF register of all entries.</p>
                </div>
              </button>
            </div>

            <div className="pt-4 border-t border-stone-100 flex justify-end">
              <button 
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="px-5 py-2 text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CUSTOM CONFIRM DELETE MODAL */}
      {deleteConfirm && deleteConfirm.isOpen && createPortal(
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 no-print">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
            onClick={() => setDeleteConfirm(null)}
          />
          <div className="relative bg-white border border-stone-200 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] w-full max-w-sm overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200 p-6 text-stone-900 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <Trash2 size={22} className="shrink-0" />
              <h4 className="text-sm font-black uppercase tracking-wider text-red-600">Confirm Deletion</h4>
            </div>
            
            <p className="text-stone-600 text-xs font-semibold leading-relaxed">
              {deleteConfirm.message}
            </p>
            
            <div className="flex items-center justify-end gap-3 pt-2">
              <button 
                type="button" 
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-xs font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={() => {
                  onDeleteEntries(deleteConfirm.ids);
                  if (deleteConfirm.ids.length > 1) {
                    setSelectedIds([]);
                  }
                  setDeleteConfirm(null);
                }}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all active:scale-95"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const StatusBadge: React.FC<{ status: EntryStatus; fontSize: number }> = ({ status, fontSize }) => {
  const styles = {
    [EntryStatus.PENDING]: 'bg-amber-50 text-amber-600 border-amber-100',
    [EntryStatus.COMPLETED]: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    [EntryStatus.UNDERLOADING]: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  };
  return <span className={`inline-flex px-2 py-0.5 rounded-md font-black uppercase tracking-widest border status-badge-print ${styles[status]}`} style={{ fontSize: fontSize + 'px' }}>{status}</span>;
};

export default EntrySheet;
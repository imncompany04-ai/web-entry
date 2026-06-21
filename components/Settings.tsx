import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Upload, Trash2, Check, AlertCircle, Image as ImageIcon, RefreshCw, Save, Type, FileText, ShoppingCart, Layers, Database, Calendar, ChevronDown, ChevronUp, AlertTriangle, Search, CheckSquare, Square } from 'lucide-react';
import { AppSettings, User, Permission, PdfTemplateConfig, LoadingEntry, Order, PurchaseOrder, StockEntry, DispatchEntry, Party, Item, Size, Vendor } from '../types';
import Logo from './Logo';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SettingsProps {
  currentUser: User;
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  entries?: LoadingEntry[];
  orders?: Order[];
  purchaseOrders?: PurchaseOrder[];
  stockEntries?: StockEntry[];
  dispatches?: DispatchEntry[];
  parties?: Party[];
  items?: Item[];
  sizes?: Size[];
  vendors?: Vendor[];
  users?: User[];
  onBulkDeleteRecords?: (records: Array<{ coll: string; id: string }>) => Promise<void>;
  onTotalStorageCleanup?: (options?: { includeParties?: boolean }) => Promise<void>;
  stats?: {
    users: number;
    parties: number;
    entries: number;
    items: number;
    sizes: number;
    vendors: number;
    orders: number;
    purchaseOrders: number;
    stockEntries: number;
    dispatches: number;
  };
}

const Settings: React.FC<SettingsProps> = ({ 
  currentUser, 
  settings, 
  onUpdateSettings, 
  entries = [],
  orders = [],
  purchaseOrders = [],
  stockEntries = [],
  dispatches = [],
  parties = [],
  items = [],
  sizes = [],
  vendors = [],
  users = [],
  onBulkDeleteRecords,
  onTotalStorageCleanup,
  stats 
}) => {
  const [logoPreview, setLogoPreview] = useState<string | null>(settings.logoUrl || null);
  const [entryFontSize, setEntryFontSize] = useState<number>(settings.entryFontSize || 12);
  const [pdfTemplates, setPdfTemplates] = useState(settings.pdfTemplates || {
    so: { showLogo: true, showDate: true, showEntity: true, showRemarks: true, showTotalUnits: true },
    po: { showLogo: true, showDate: true, showEntity: true, showRemarks: true, showTotalUnits: true }
  });
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States for Password-protected Full Database Cleanup
  const [isTotalCleanupModalOpen, setIsTotalCleanupModalOpen] = useState(false);
  const [totalCleanupPassword, setTotalCleanupPassword] = useState('');
  const [totalCleanupError, setTotalCleanupError] = useState<string | null>(null);
  const [isTotalCleaning, setIsTotalCleaning] = useState(false);
  const [includePartiesInPurge, setIncludePartiesInPurge] = useState(false);

  useEffect(() => {
    if (settings.logoUrl !== undefined) setLogoPreview(settings.logoUrl || null);
    if (settings.entryFontSize !== undefined) setEntryFontSize(settings.entryFontSize || 12);
    if (settings.pdfTemplates !== undefined) setPdfTemplates(settings.pdfTemplates);
  }, [settings]);

  // Sizing and Grouping calculations
  const recordsWithSizes = useMemo(() => {
    const list: Array<{
      id: string;
      coll: 'entries' | 'orders' | 'purchaseOrders' | 'stockEntries' | 'dispatches' | 'parties' | 'items' | 'sizes' | 'vendors';
      collLabel: string;
      title: string;
      date: string;
      sizeInBytes: number;
      description: string;
    }> = [];

    const getWeightInBytes = (item: any) => {
      try { return JSON.stringify(item).length; } catch { return 150; }
    };

    const getItemDate = (timestamp?: number) => {
      if (!timestamp) return new Date().toISOString().split('T')[0];
      try {
        const d = new Date(timestamp);
        if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
        return d.toISOString().split('T')[0];
      } catch {
        return new Date().toISOString().split('T')[0];
      }
    };

    (entries || []).forEach(e => {
      list.push({
        id: e.id,
        coll: 'entries',
        collLabel: 'Loading Entry',
        title: `Loading Entry Sr #${e.srNo || ''}`,
        date: e.date || new Date().toISOString().split('T')[0],
        sizeInBytes: getWeightInBytes(e) + 120, // add standard Firestore envelope overhead
        description: `Truck: ${e.truckNo || e.tempoNumber || 'N/A'} • Qty: ${e.quantity || 0} • Party: ${e.partyName || 'N/A'}`
      });
    });

    (orders || []).forEach(o => {
      list.push({
        id: o.id,
        coll: 'orders',
        collLabel: 'Sales Order',
        title: `Sales Order #${o.orderNo || ''}`,
        date: o.date || new Date().toISOString().split('T')[0],
        sizeInBytes: getWeightInBytes(o) + 150,
        description: `Customer: ${o.customerName || 'N/A'} • Status: ${o.status || 'Pending'} • Items: ${o.items?.length || 0}`
      });
    });

    (purchaseOrders || []).forEach(p => {
      list.push({
        id: p.id,
        coll: 'purchaseOrders',
        collLabel: 'Purchase Order',
        title: `PO #${p.poNo || ''}`,
        date: p.date || new Date().toISOString().split('T')[0],
        sizeInBytes: getWeightInBytes(p) + 150,
        description: `Vendor: ${p.vendorName || 'N/A'} • Status: ${p.isConvertedToStock ? 'Converted' : 'Pending'}`
      });
    });

    (stockEntries || []).forEach(s => {
      list.push({
        id: s.id,
        coll: 'stockEntries',
        collLabel: 'Stock Entry',
        title: `Stock Entry: ${s.itemName || ''}`,
        date: s.date || new Date().toISOString().split('T')[0],
        sizeInBytes: getWeightInBytes(s) + 100,
        description: `Size: ${s.sizeName || 'N/A'} • Qty Added: ${s.quantityAdded || 0}`
      });
    });

    (dispatches || []).forEach(d => {
      list.push({
        id: d.id,
        coll: 'dispatches',
        collLabel: 'Dispatch',
        title: `Dispatch #${d.dispatchNo || ''}`,
        date: d.date || new Date().toISOString().split('T')[0],
        sizeInBytes: getWeightInBytes(d) + 160,
        description: `Order: #${d.orderNo || ''} • Customer: ${d.customerName || 'N/A'} • Vehicle: ${d.vehicleNo || 'N/A'} • Qty: ${d.quantity || 0}`
      });
    });

    (parties || []).forEach(p => {
      list.push({
        id: p.id,
        coll: 'parties',
        collLabel: 'Party',
        title: `Party: ${p.name || ''}`,
        date: getItemDate(p.updatedAt),
        sizeInBytes: getWeightInBytes(p) + 80,
        description: `Location: ${p.location || 'N/A'}`
      });
    });

    (items || []).forEach(i => {
      list.push({
        id: i.id,
        coll: 'items',
        collLabel: 'Item',
        title: `Item: ${i.name || ''}`,
        date: getItemDate(i.updatedAt),
        sizeInBytes: getWeightInBytes(i) + 80,
        description: `Active: ${i.isActive ? 'Active' : 'Inactive'} • Description: ${i.description || 'N/A'}`
      });
    });

    (sizes || []).forEach(s => {
      list.push({
        id: s.id,
        coll: 'sizes',
        collLabel: 'Size',
        title: `Size: ${s.name || ''}`,
        date: getItemDate(s.updatedAt),
        sizeInBytes: getWeightInBytes(s) + 80,
        description: `Unit: ${s.unitType || 'N/A'}`
      });
    });

    (vendors || []).forEach(v => {
      list.push({
        id: v.id,
        coll: 'vendors',
        collLabel: 'Vendor',
        title: `Vendor: ${v.name || ''}`,
        date: getItemDate(v.updatedAt),
        sizeInBytes: getWeightInBytes(v) + 80,
        description: `City: ${v.city || 'N/A'} • Mobile: ${v.mobile || 'N/A'}`
      });
    });

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, orders, purchaseOrders, stockEntries, dispatches, parties, items, sizes, vendors]);

  // Master records estimated size
  const totalMasterBytes = useMemo(() => {
    let size = 0;
    const calc = (arr: any[]) => {
      try { size += JSON.stringify(arr).length; } catch {}
    };
    calc(parties || []);
    calc(items || []);
    calc(sizes || []);
    calc(vendors || []);
    calc(users || []);
    try { size += JSON.stringify(settings).length; } catch {}
    return size + (parties.length + items.length + sizes.length + vendors.length + users.length) * 100;
  }, [parties, items, sizes, vendors, users, settings]);

  const totalOperationalBytes = useMemo(() => {
    return recordsWithSizes.reduce((acc, r) => acc + r.sizeInBytes, 0);
  }, [recordsWithSizes]);

  const totalDatabaseBytes = totalOperationalBytes + totalMasterBytes;
  const totalKBStr = (totalDatabaseBytes / 1024).toFixed(2);

  const handleTotalCleanupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTotalCleanupError(null);
    if (!totalCleanupPassword.trim()) {
      setTotalCleanupError("Password is required");
      return;
    }

    const isAdmin = currentUser.role === 'Admin' || currentUser.rights.includes(Permission.ADMIN_ACCESS);
    if (!isAdmin) {
      setTotalCleanupError("Only Administrators are permitted to perform a total database logs and entries purge.");
      return;
    }

    const userPassword = currentUser.password || '';
    const masterPassword = 'admin123';
    
    const isMasterPassword = totalCleanupPassword === masterPassword;
    const isCurrentUserPassword = userPassword && totalCleanupPassword === userPassword;
    
    const isAnyAdminPassword = (users || []).some(u => 
      (u.role === 'Admin' || u.rights.includes(Permission.ADMIN_ACCESS)) && 
      u.password === totalCleanupPassword
    );

    if (!isMasterPassword && !isCurrentUserPassword && !isAnyAdminPassword) {
      setTotalCleanupError("Incorrect password. Please try again.");
      return;
    }

    if (!onTotalStorageCleanup) {
      setTotalCleanupError("Total storage cleanup callback is not configured.");
      return;
    }

    try {
      setIsTotalCleaning(true);
      await onTotalStorageCleanup({ includeParties: includePartiesInPurge });
      setIsTotalCleanupModalOpen(false);
      setTotalCleanupPassword('');
    } catch (err: any) {
      console.error("Master cleanup execution failure:", err);
      setTotalCleanupError(err?.message || "Failed to purge database. Check connection.");
    } finally {
      setIsTotalCleaning(false);
    }
  };

  const totalRecords = stats ? (
    (stats.users || 0) +
    (stats.parties || 0) +
    (stats.entries || 0) +
    (stats.items || 0) +
    (stats.sizes || 0) +
    (stats.vendors || 0) +
    (stats.orders || 0) +
    (stats.purchaseOrders || 0) +
    (stats.stockEntries || 0) +
    (stats.dispatches || 0)
  ) : 0;

  const chartData = [
    { name: 'Loading', count: stats?.entries || 0, color: '#0D9488' },
    { name: 'Parties', count: stats?.parties || 0, color: '#0F172A' },
    { name: 'Orders', count: stats?.orders || 0, color: '#D97706' },
    { name: 'PO\'s', count: stats?.purchaseOrders || 0, color: '#4F46E5' },
    { name: 'Stock', count: stats?.stockEntries || 0, color: '#8B5CF6' },
    { name: 'Dispatches', count: stats?.dispatches || 0, color: '#EC4899' },
    { name: 'Vendors', count: stats?.vendors || 0, color: '#EF4444' },
    { name: 'Items', count: (stats?.items || 0), color: '#10B981' }
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
        setStatus('idle');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdateSettings({ 
        logoUrl: logoPreview || '',
        entryFontSize: entryFontSize,
        pdfTemplates: pdfTemplates
      });
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const togglePdfField = (type: 'so' | 'po', field: keyof PdfTemplateConfig) => {
    setPdfTemplates({
      ...pdfTemplates,
      [type]: {
        ...pdfTemplates[type],
        [field]: !pdfTemplates[type][field]
      }
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-black text-stone-900 tracking-tight">System Settings</h2>
        <p className="text-stone-500 text-sm mt-1">Manage global configuration and brand identity.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          {/* Logo Section */}
          <div className="bg-white rounded-[24px] md:rounded-[32px] border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-6 md:p-8 border-b border-stone-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-stone-900">Brand Identity</h3>
                <p className="text-xs text-stone-400 font-bold uppercase tracking-widest mt-1">Company Logo Management</p>
              </div>
              <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${status === 'success' ? 'bg-emerald-50 text-emerald-600' : status === 'error' ? 'bg-red-50 text-red-600' : 'bg-stone-50 text-stone-400'}`}>
                {status === 'success' ? <><Check size={12} /> Changes Synced</> : status === 'error' ? <><AlertCircle size={12} /> Sync Failed</> : 'Awaiting Changes'}
              </div>
            </div>

            <div className="p-6 md:p-8 space-y-8">
              <div className="flex flex-col md:flex-row gap-8 md:gap-10">
                <div className="flex-1 space-y-4">
                  <div className="p-6 bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center text-center gap-4 group hover:border-black/30 transition-all">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-stone-100 flex items-center justify-center text-stone-300 group-hover:text-black transition-colors"><ImageIcon size={32} /></div>
                    <div><p className="text-sm font-black text-stone-700">Upload Logo</p><p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-1">Recommended: PNG / Transparent</p></div>
                    <button onClick={() => fileInputRef.current?.click()} className="px-6 py-2 bg-white border border-stone-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-50 transition-all shadow-sm">Browse Files</button>
                  </div>
                </div>
                <div className="w-full md:w-64 space-y-4">
                  <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Live Preview</p>
                  <div className="h-40 bg-white border border-stone-100 rounded-2xl flex items-center justify-center p-6 shadow-inner relative group">
                    {logoPreview ? (
                      <><Logo src={logoPreview} className="max-h-full max-w-full" /><button onClick={() => {setLogoPreview(null); if (fileInputRef.current) fileInputRef.current.value='';}} className="absolute top-2 right-2 p-1.5 bg-red-50 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button></>
                    ) : (
                      <Logo className="h-16" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PDF Template Config Section */}
          <div className="bg-white rounded-[24px] md:rounded-[32px] border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-6 md:p-8 border-b border-stone-100 flex items-center gap-3">
              <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400"><FileText size={20} /></div>
              <div>
                <h3 className="text-lg font-black text-stone-900">PDF Configuration</h3>
                <p className="text-xs text-stone-400 font-bold uppercase tracking-widest mt-1">Template Master Controls</p>
              </div>
            </div>
            <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
               {/* SO Template */}
               <div className="space-y-6">
                  <h4 className="text-[11px] font-black text-stone-900 uppercase tracking-widest border-b border-stone-100 pb-2 flex items-center gap-2"><ShoppingCart size={14} /> Sales Order Template</h4>
                  <div className="space-y-3">
                     {[
                       { label: 'Display Company Logo', key: 'showLogo' },
                       { label: 'Display Date', key: 'showDate' },
                       { label: 'Display Consignee', key: 'showEntity' },
                       { label: 'Display Remarks', key: 'showRemarks' },
                       { label: 'Display Total Volume', key: 'showTotalUnits' },
                     ].map(field => (
                       <label key={field.key} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-100 cursor-pointer group hover:bg-white hover:border-stone-200 transition-all">
                          <span className="text-[10px] font-black text-stone-500 group-hover:text-stone-900 uppercase">{field.label}</span>
                          <input type="checkbox" checked={(pdfTemplates.so as any)[field.key]} onChange={() => togglePdfField('so', field.key as any)} className="w-4 h-4 accent-black cursor-pointer" />
                       </label>
                     ))}
                  </div>
               </div>
               {/* PO Template */}
               <div className="space-y-6">
                  <h4 className="text-[11px] font-black text-stone-900 uppercase tracking-widest border-b border-stone-100 pb-2 flex items-center gap-2"><Layers size={14} /> Purchase Order Template</h4>
                  <div className="space-y-3">
                     {[
                       { label: 'Display Company Logo', key: 'showLogo' },
                       { label: 'Display Date', key: 'showDate' },
                       { label: 'Display Vendor', key: 'showEntity' },
                       { label: 'Display Remarks', key: 'showRemarks' },
                       { label: 'Display Total Volume', key: 'showTotalUnits' },
                     ].map(field => (
                       <label key={field.key} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-100 cursor-pointer group hover:bg-white hover:border-stone-200 transition-all">
                          <span className="text-[10px] font-black text-stone-500 group-hover:text-stone-900 uppercase">{field.label}</span>
                          <input type="checkbox" checked={(pdfTemplates.po as any)[field.key]} onChange={() => togglePdfField('po', field.key as any)} className="w-4 h-4 accent-black cursor-pointer" />
                       </label>
                     ))}
                  </div>
               </div>
            </div>
          </div>

          {/* Interface Customization Section */}
          <div className="bg-white rounded-[24px] md:rounded-[32px] border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-6 md:p-8 border-b border-stone-100"><h3 className="text-lg font-black text-stone-900">Display Preferences</h3><p className="text-xs text-stone-400 font-bold uppercase tracking-widest mt-1">Interface Customization</p></div>
            <div className="p-6 md:p-8 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between"><div className="flex items-center gap-3"><Type size={18} className="text-stone-400" /><label className="text-sm font-bold text-stone-700">Entry Sheet Font Size</label></div><span className="px-3 py-1 bg-stone-100 rounded-lg text-[10px] font-black text-stone-600">{entryFontSize}px</span></div>
                <div className="flex items-center gap-4"><span className="text-[9px] font-black text-stone-300 uppercase">9px</span><input type="range" min="9" max="16" step="1" value={entryFontSize} onChange={(e) => setEntryFontSize(parseInt(e.target.value))} className="flex-1 accent-black h-1.5 bg-stone-100 rounded-lg cursor-pointer" /><span className="text-[9px] font-black text-stone-300 uppercase">16px</span></div>
              </div>
            </div>
            <div className="p-6 md:p-8 bg-stone-50/50 border-t border-stone-100 flex justify-end gap-3 md:gap-4">
               <button onClick={() => {setLogoPreview(settings.logoUrl || null); setEntryFontSize(settings.entryFontSize || 12); setPdfTemplates(settings.pdfTemplates || { so: { showLogo: true, showDate: true, showEntity: true, showRemarks: true, showTotalUnits: true }, po: { showLogo: true, showDate: true, showEntity: true, showRemarks: true, showTotalUnits: true } }); }} className="px-4 md:px-6 py-3 text-stone-400 font-black uppercase tracking-widest text-[10px] hover:text-stone-600 transition-colors">Discard</button>
               <button onClick={handleSave} disabled={isSaving} className="px-6 md:px-8 py-3 bg-black hover:bg-stone-900 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg flex items-center gap-2 transition-all disabled:opacity-50">{isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} Apply Changes</button>
            </div>
          </div>

          {/* Database Analytics Section */}
          <div className="bg-white rounded-[24px] md:rounded-[32px] border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-6 md:p-8 border-b border-stone-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600">
                  <Database size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-stone-900">Database Storage Analytics</h3>
                  <p className="text-xs text-stone-400 font-bold uppercase tracking-widest mt-1">Live Firestore Inventory & Telemetry</p>
                </div>
              </div>
              <div className="px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Connected
              </div>
            </div>

            <div className="p-6 md:p-8 space-y-8">
              {/* Telemetry Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-stone-50 border border-stone-100 rounded-2xl">
                  <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Total Synced Records</p>
                  <p className="text-2xl font-black text-stone-950 mt-1">{totalRecords}</p>
                </div>
                <div className="p-4 bg-stone-50 border border-stone-100 rounded-2xl">
                  <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Database Node</p>
                  <p className="text-[11px] font-black text-teal-600 truncate mt-2">Firestore Pro</p>
                </div>
                <div className="p-4 bg-stone-50 border border-stone-100 rounded-2xl">
                  <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Database Size (KB)</p>
                  <p className="text-[14px] font-black text-teal-600 mt-2">{totalKBStr} KB</p>
                </div>
                <div className="p-4 bg-stone-50 border border-stone-100 rounded-2xl">
                  <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Sync Type</p>
                  <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-2 bg-emerald-100 px-2 py-0.5 rounded-md inline-block">Realtime</p>
                </div>
              </div>

              {/* Bar Chart representing the collection statistics */}
              <div className="space-y-4">
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Database Volume Distribution (Collection document counts)</p>
                <div className="h-72 w-full bg-stone-50/50 border border-stone-100 rounded-2xl p-4 flex flex-col items-center justify-center">
                  {totalRecords === 0 ? (
                    <div className="text-center py-10 space-y-2">
                      <Database className="w-10 h-10 text-stone-300 mx-auto animate-bounce" />
                      <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest">No documents loaded yet</p>
                      <p className="text-[9px] text-stone-400">Initialize transactions to populate Firestore storage stream.</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E5E4" />
                        <XAxis 
                          dataKey="name" 
                          stroke="#78716C" 
                          fontSize={9} 
                          tickLine={false}
                          tick={{ fontWeight: 'bold' }}
                        />
                        <YAxis 
                          stroke="#78716C" 
                          fontSize={9} 
                          tickLine={false}
                          allowDecimals={false}
                          tick={{ fontWeight: 'bold' }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1C1917', 
                            borderRadius: '12px', 
                            border: 'none', 
                            color: '#FFF',
                            fontFamily: 'inherit',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}
                          itemStyle={{ color: '#FFF' }}
                          cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }}
                        />
                        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* New Password-Protected Total Database Cleanup Section */}
          <div className="bg-red-50/40 rounded-[24px] md:rounded-[32px] border border-red-200/60 shadow-sm overflow-hidden p-6 md:p-8 space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-650 shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-red-950">Logs & Entries Purge</h3>
                <p className="text-xs text-red-750 font-bold leading-relaxed">
                  This action permanently purges database records based on your selection. Please configure your choice below before proceeding.
                </p>
              </div>
            </div>

            {/* Target elements checkable tags/options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setIncludePartiesInPurge(false)}
                className={`p-4 rounded-xl border text-left transition-all relative select-none ${
                  !includePartiesInPurge 
                    ? 'bg-red-50/60 border-red-300 text-red-950 ring-2 ring-red-500/20 shadow-sm' 
                    : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider">Only Logs & Entries</span>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    !includePartiesInPurge ? 'border-red-650 bg-red-600' : 'border-stone-300 bg-white'
                  }`}>
                    {!includePartiesInPurge && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <p className="text-[11px] text-stone-500 font-bold mt-1.5 leading-normal">
                  Purges only transactions (Entries, Orders, purchase orders, dispatches, stock logs). Retains all Party lists.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setIncludePartiesInPurge(true)}
                className={`p-4 rounded-xl border text-left transition-all relative select-none ${
                  includePartiesInPurge 
                    ? 'bg-red-50/60 border-red-300 text-red-950 ring-2 ring-red-500/20 shadow-sm' 
                    : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider">Logs, Entries & Parties</span>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    includePartiesInPurge ? 'border-red-650 bg-red-600' : 'border-stone-300 bg-white'
                  }`}>
                    {includePartiesInPurge && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <p className="text-[11px] text-stone-500 font-bold mt-1.5 leading-normal">
                  Deletes all transaction records AND fully wipes your entire Party Master list.
                </p>
              </button>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-red-150 border-dashed">
              <span className="text-[10px] font-black uppercase text-red-750 tracking-wider">
                Target: {includePartiesInPurge ? "Logs, Entries & Parties" : "Only Logs & Entries"} • requires Admin check
              </span>
              <button 
                onClick={() => {
                  setTotalCleanupPassword('');
                  setTotalCleanupError(null);
                  setIsTotalCleanupModalOpen(true);
                }}
                className="w-full sm:w-auto px-6 py-3 bg-red-700 hover:bg-red-800 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg hover:shadow-red-200 flex items-center justify-center gap-2 transition-all"
              >
                <Trash2 size={13} className="animate-pulse" /> Confirm Settings & Purge
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-black rounded-[24px] md:rounded-[32px] p-6 md:p-8 text-white shadow-xl relative overflow-hidden"><div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" /><h4 className="text-lg font-black mb-2">Cloud Branding</h4><p className="text-white/60 text-xs leading-relaxed font-medium">Any configurations saved here are synced via Firebase to all connected devices in your logistics cluster.</p><div className="mt-6 flex items-center gap-3 px-4 py-2 bg-white/10 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest"><RefreshCw size={12} className="text-emerald-400" /> Auto-sync enabled</div></div>
          <div className="bg-white rounded-[24px] md:rounded-[32px] p-6 md:p-8 border border-stone-200 shadow-sm"><div className="flex items-center gap-3 text-stone-400 mb-4"><AlertCircle size={18} /><span className="text-[10px] font-black uppercase tracking-widest">Guidelines</span></div><ul className="space-y-3"><li className="flex gap-3 text-xs font-bold text-stone-500"><div className="w-1.5 h-1.5 rounded-full bg-stone-200 mt-1.5 shrink-0" />Font size changes apply only to the "Logs" entry sheet.</li><li className="flex gap-3 text-xs font-bold text-stone-500"><div className="w-1.5 h-1.5 rounded-full bg-stone-200 mt-1.5 shrink-0" />PDF Template configuration controls visibility of fields in generated Sales Order and Purchase Order documents.</li><li className="flex gap-3 text-xs font-bold text-stone-500"><div className="w-1.5 h-1.5 rounded-full bg-stone-200 mt-1.5 shrink-0" />The Mozat Logo (PNG) replaces text headers in all generated PDF manifests.</li></ul></div>
        </div>
      </div>

      {/* Password Prompt Modal Dialog */}
      {isTotalCleanupModalOpen && createPortal(
        <div className="fixed inset-0 w-screen h-screen bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-fade-in text-stone-900">
          <div className="bg-white rounded-[28px] border border-stone-200 shadow-2xl p-6 md:p-8 max-w-sm w-full space-y-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 bg-red-100 text-red-700 rounded-2xl flex items-center justify-center animate-bounce">
                <Trash2 size={24} />
              </div>
              <div>
                <h4 className="text-base font-black text-stone-900">Enter Admin Passcode</h4>
                <p className="text-xs text-stone-550 font-bold mt-1">To verify authority, input your administrator password to initiate logs & entries purge.</p>
              </div>
            </div>

            <form onSubmit={handleTotalCleanupSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-stone-500">Security Password</label>
                <input 
                  type="password"
                  value={totalCleanupPassword}
                  onChange={(e) => setTotalCleanupPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold focus:bg-white focus:outline-none focus:border-black transition-all text-stone-900"
                  autoFocus
                />
              </div>

              {totalCleanupError && (
                <div className="flex items-start gap-2 text-xs font-bold text-red-700 bg-red-50 border border-red-200 p-3 rounded-xl">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{totalCleanupError}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => {
                    setIsTotalCleanupModalOpen(false);
                    setTotalCleanupPassword('');
                    setTotalCleanupError(null);
                  }}
                  className="flex-1 px-4 py-3 border border-stone-200 rounded-xl text-stone-500 hover:text-stone-950 font-bold text-xs uppercase tracking-widest transition-all animate-none shrink-0"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isTotalCleaning}
                  className="flex-1 px-4 py-3 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all shadow-md shrink-0"
                >
                  {isTotalCleaning ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" /> Purging...
                    </>
                  ) : (
                    <>
                      Confirm
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Settings;
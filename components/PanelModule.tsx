import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Edit2, Trash2, Box, Package, ShoppingCart, 
  Truck, ArrowRight, TrendingUp, Check, X, FileText, ChevronRight, AlertCircle, History, List, ChevronDown, Layers, Search, ArrowRightLeft, User as UserIcon, MapPin, Printer, Download, RotateCcw, FilePlus, Upload, FileJson, Calendar, Settings, Grid, Activity, Wrench, ShieldAlert, ArrowUpDown, ChevronUp, ChevronDown as ChevronDownIcon, Eye, Info, ExternalLink, MoveUpRight, MoveDownLeft, MessageSquare, CheckSquare, Square, SortAsc, SortDesc, CheckCircle2, ChevronLeft, PieChart, BarChart3
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  Item, Size, Vendor, Order, PurchaseOrder, StockEntry, DispatchEntry, User, OrderStatus, Party, OrderItem, AppSettings 
} from '../types';

interface PanelModuleProps {
  currentUser: User;
  settings: AppSettings;
  items: Item[];
  sizes: Size[];
  vendors: Vendor[];
  parties: Party[];
  orders: Order[];
  purchaseOrders: PurchaseOrder[];
  stockEntries: StockEntry[];
  dispatches: DispatchEntry[];
  onUpsert: (coll: string, data: any) => Promise<void>;
  onDelete: (coll: string, id: string) => Promise<void>;
}

type MainView = 'Dashboard' | 'Master' | 'Orders' | 'Purchase Orders' | 'Add Stock' | 'Dispatch' | 'Dispatch Report' | 'Maintenance';

interface SubViewState {
  main: MainView;
  sub: string;
  searchTerm?: string;
}

const Pagination = ({ totalItems, pageSize, setPageSize, currentPage, setCurrentPage }: any) => {
  const totalPages = pageSize === 'all' ? 1 : Math.ceil(totalItems / (pageSize as number));
  if (totalItems === 0) return null;
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-2 mt-2 no-print">
      <div className="flex items-center gap-3">
         <span className="text-[9px] font-black uppercase tracking-widest text-stone-400">Rows per page:</span>
         <div className="flex border border-stone-200 rounded-lg overflow-hidden bg-white">
            {[10, 50, 100, 'all'].map(size => (
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
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 bg-white border border-stone-200 rounded-lg text-stone-600 disabled:opacity-30 transition-all hover:bg-stone-50"><ChevronLeft size={14} /></button>
          <div className="flex items-center gap-1">
             {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
               let pageNum = totalPages <= 5 ? i + 1 : (currentPage <= 3 ? i + 1 : (currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i));
               return (
                 <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${currentPage === pageNum ? 'bg-mozart text-white shadow-md' : 'bg-white border border-stone-100 text-stone-400 hover:border-stone-300'}`}>{pageNum}</button>
               );
             })}
          </div>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-2 bg-white border border-stone-200 rounded-lg text-stone-600 disabled:opacity-30 transition-all hover:bg-stone-50"><ChevronRight size={14} /></button>
        </div>
      )}
    </div>
  );
};

const PanelModule: React.FC<PanelModuleProps> = (props) => {
  const [view, setView] = useState<SubViewState>({ main: 'Dashboard', sub: 'Overview' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingData, setEditingData] = useState<any>(null);
  const [viewingDetails, setViewingDetails] = useState<any>(null);
  const [dispatchPrompt, setDispatchPrompt] = useState<Order | null>(null);
  const [vehicleNo, setVehicleNo] = useState('');
  const itemFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isModalOpen || viewingDetails || dispatchPrompt) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen, viewingDetails, dispatchPrompt]);

  const inventory = useMemo(() => {
    const stock: Record<string, number> = {};
    (props.stockEntries || []).forEach(s => {
      const key = `${s.itemId}_${s.sizeId}`;
      stock[key] = (stock[key] || 0) + (Number(s.quantityAdded) || 0);
    });
    (props.dispatches || []).forEach(d => {
      const key = `${d.itemId}_${d.sizeId}`;
      stock[key] = (stock[key] || 0) - (Number(d.quantity) || 0);
    });
    return stock;
  }, [props.stockEntries, props.dispatches]);

  const openForm = (main: MainView, sub: string, data: any = null) => {
    let backgroundSub = sub;
    if (sub === 'New Order') backgroundSub = 'Manage Orders';
    if (sub === 'New Purchase Order') backgroundSub = 'Manage Purchase Orders';
    if (sub === 'New Add Stock') backgroundSub = 'Manage Stock';
    
    setView({ main, sub: backgroundSub });
    setEditingData(data);
    setIsModalOpen(true);
  };

  const handleDrillDown = (itemName: string) => {
    setViewingDetails(null);
    setView({ main: 'Master', sub: 'Item', searchTerm: itemName });
  };

  const handleConvertToPO = (order: Order) => {
    const poDraft = {
      vendorId: '', 
      date: new Date().toISOString().split('T')[0],
      globalSizeId: order.items?.[0]?.sizeId || '',
      items: (order.items || []).map(i => ({ ...i })),
      referenceOrderNo: order.orderNo,
      remarks: order.remarks || ''
    };
    openForm('Purchase Orders', 'New Purchase Order', poDraft);
  };

  const handleReceivePO = async (po: PurchaseOrder) => {
    if (po.isConvertedToStock) return;
    if (!confirm(`Finalize PO ${po.poNo}? This will automatically inject ${po.items.length} item types into your active stock balance.`)) return;

    try {
      const currentTimestamp = Date.now();
      const todayDate = new Date().toISOString().split('T')[0];

      // 1. Process items into Stock Entries
      for (const item of po.items) {
        await props.onUpsert('stockEntries', {
          id: Math.random().toString(36).substr(2, 9),
          date: todayDate,
          itemId: item.itemId,
          itemName: item.itemName,
          sizeId: item.sizeId,
          sizeName: item.sizeName,
          quantityAdded: Number(item.quantity),
          reference: `PO-RECV: ${po.poNo}`,
          updatedAt: currentTimestamp
        });
      }

      // 2. Mark PO as fulfilled
      await props.onUpsert('purchaseOrders', {
        ...po,
        isConvertedToStock: true,
        updatedAt: currentTimestamp
      });
    } catch (error) {
      console.error("Critical error during PO fulfillment:", error);
    }
  };

  const handleRevertDispatch = async (dispatchNo: string) => {
    const confirmMsg = `Revert shipment ${dispatchNo}? This will delete all item records for this load and mark the corresponding Order as Pending again.`;
    if (!confirm(confirmMsg)) return;

    try {
      const relatedDispatches = (props.dispatches || []).filter(d => d.dispatchNo === dispatchNo);
      const orderNo = relatedDispatches[0]?.orderNo;
      
      for (const d of relatedDispatches) {
        if (d.id) await props.onDelete('dispatches', d.id);
      }

      if (orderNo) {
        const order = (props.orders || []).find(o => o.orderNo === orderNo);
        if (order) {
          await props.onUpsert('orders', { 
            ...order, 
            status: OrderStatus.PENDING,
            updatedAt: Date.now() 
          });
        }
      }
    } catch (error) {
      console.error("Failed to revert dispatch:", error);
    }
  };

  const handleClearBalanceHistory = async (itemId: string, sizeId: string) => {
    if (!confirm('This will delete ALL movement history for this specific item and size. Continue?')) return;
    const stockEntriesToClear = (props.stockEntries || []).filter(se => se.itemId === itemId && se.sizeId === sizeId);
    for (const entry of stockEntriesToClear) {
      await props.onDelete('stockEntries', entry.id);
    }
    const dispatchesToClear = (props.dispatches || []).filter(d => d.itemId === itemId && d.sizeId === sizeId);
    for (const d of dispatchesToClear) {
      await props.onDelete('dispatches', d.id);
    }
  };

  const handleItemExport = () => {
    const dataToExport = props.items.map(item => ({
      "Item Name": item.name,
      "Description": item.description || "",
      "Is Active": item.isActive ? "Yes" : "No"
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Items");
    XLSX.writeFile(workbook, `Items_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleItemImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];
        let count = 0;
        for (const row of data) {
          const name = row["Item Name"];
          if (name) {
            await props.onUpsert('items', { 
              id: Math.random().toString(36).substr(2, 9),
              name: String(name), 
              description: String(row["Description"] || ""),
              isActive: row["Is Active"]?.toLowerCase() === "yes" || row["Is Active"] === true
            });
            count++;
          }
        }
        alert(`Successfully imported ${count} items.`);
      } catch (err) { console.error(err); }
    };
    reader.readAsBinaryString(file);
    if (itemFileInputRef.current) itemFileInputRef.current.value = '';
  };

  const handlePrint = (data: Order | PurchaseOrder, type: 'SO' | 'PO') => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const templateConfig = type === 'SO' 
      ? (props.settings?.pdfTemplates?.so || { showLogo: true, showDate: true, showEntity: true, showRemarks: true, showTotalUnits: true })
      : (props.settings?.pdfTemplates?.po || { showLogo: true, showDate: true, showEntity: true, showRemarks: true, showTotalUnits: true });
    const itemsHtml = (data.items || []).map(item => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${item.itemName || 'N/A'}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${item.sizeName || 'N/A'}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${(item.quantity || 0).toLocaleString()}</td>
      </tr>
    `).join('');
    
    let logoHtml = '';
    if (templateConfig.showLogo) {
      logoHtml = props.settings?.logoUrl 
        ? `<img src="${props.settings.logoUrl}" style="max-height: 60px; max-width: 250px; object-contain: contain;" />`
        : `<div style="font-size: 24px; font-weight: 900; color: #1a4d5c;">${(props.settings?.companyName || 'mozart').toLowerCase()}</div>`;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${type} - ${data.id}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #333; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1a4d5c; padding-bottom: 20px; margin-bottom: 30px; }
            .doc-type { font-size: 18px; font-weight: 800; text-transform: uppercase; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #f8f9fa; font-weight: 800; text-transform: uppercase; font-size: 12px; color: #1a4d5c; border: 1px solid #ddd; padding: 12px; text-align: left; }
            .meta-row { margin-bottom: 5px; font-size: 14px; }
            .meta-label { font-weight: 800; color: #888; text-transform: uppercase; width: 120px; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="header">${logoHtml}<div class="doc-type">${type === 'SO' ? 'Sales Order' : 'Purchase Order'}</div></div>
          <div class="meta">
            <div class="meta-row"><span class="meta-label">ID:</span> ${(data as any).orderNo || (data as any).poNo}</div>
            ${templateConfig.showDate ? `<div class="meta-row"><span class="meta-label">Date:</span> ${data.date || 'N/A'}</div>` : ''}
            ${templateConfig.showEntity ? `<div class="meta-row"><span class="meta-label">${type === 'SO' ? 'Customer' : 'Vendor'}:</span> ${type === 'SO' ? (data as Order).customerName : (data as PurchaseOrder).vendorName}</div>` : ''}
          </div>
          <table>
            <thead><tr><th>Item Particulars</th><th>Size / Specification</th><th style="text-align: center;">Total Units</th></tr></thead>
            <tbody>${itemsHtml}</tbody>
            ${templateConfig.showTotalUnits ? `<tfoot><tr><td colspan="2" style="padding: 12px; border: 1px solid #ddd; font-weight: 800; text-align: right;">Total Units</td><td style="padding: 12px; border: 1px solid #ddd; font-weight: 800; text-align: center;">${(data.items || []).reduce((acc, it) => acc + it.quantity, 0).toLocaleString()}</td></tr></tfoot>` : ''}
          </table>
          ${templateConfig.showRemarks && data.remarks ? `<div style="margin-top: 30px; padding: 15px; background: #f9f9f9; border: 1px solid #eee; border-radius: 8px;"><div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #888; margin-bottom: 5px;">Remarks</div><div style="font-size: 14px; color: #444; font-style: italic;">${data.remarks}</div></div>` : ''}
          <div style="margin-top: 50px; text-align: right; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 20px;">This is a computer generated document.</div>
          <script>window.print(); setTimeout(() => window.close(), 500);</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const executeDispatch = async () => {
    if (!dispatchPrompt || !vehicleNo) return;
    const items = dispatchPrompt.items || [];
    const sharedDispatchNo = `DSP-${Date.now().toString().slice(-6)}`;
    const sharedDate = new Date().toISOString().split('T')[0];
    const sharedTimestamp = Date.now();
    for (const item of items) {
      await props.onUpsert('dispatches', {
        id: Math.random().toString(36).substr(2, 9),
        dispatchNo: sharedDispatchNo,
        orderId: dispatchPrompt.id,
        orderNo: dispatchPrompt.orderNo,
        customerName: dispatchPrompt.customerName,
        itemId: item.itemId,
        itemName: item.itemName,
        sizeId: item.sizeId,
        sizeName: item.sizeName,
        quantity: item.quantity,
        vehicleNo: vehicleNo,
        date: sharedDate,
        remarks: dispatchPrompt.remarks,
        updatedAt: sharedTimestamp
      });
    }
    await props.onUpsert('orders', { ...dispatchPrompt, status: OrderStatus.COMPLETED });
    setDispatchPrompt(null);
    setVehicleNo('');
  };

  const renderContent = () => {
    switch (view.main) {
      case 'Dashboard': return <DashboardView {...props} inventory={inventory} setView={setView} openForm={openForm} />;
      case 'Master': return <MasterView initialSearch={view.searchTerm} items={props.items} sizes={props.sizes} vendors={props.vendors} activeSub={view.sub} onEdit={(data: any) => openForm('Master', view.sub, data)} onDelete={props.onDelete} />;
      case 'Orders': return <OrdersListView orders={props.orders} onDelete={props.onDelete} onEdit={(o: Order) => openForm('Orders', 'Manage Orders', o)} onViewDetails={(o: Order) => setViewingDetails({ type: 'SO', data: o })} onDispatchRequest={(o: Order) => setDispatchPrompt(o)} onPrint={(o: Order) => handlePrint(o, 'SO')} onConvertToPO={handleConvertToPO} />;
      case 'Purchase Orders': return <PurchaseOrdersListView purchaseOrders={props.purchaseOrders} onDelete={props.onDelete} onViewDetails={(po: PurchaseOrder) => setViewingDetails({ type: 'PO', data: po })} onEdit={(po: PurchaseOrder) => openForm('Purchase Orders', 'Manage Purchase Orders', po)} onPrint={(po: PurchaseOrder) => handlePrint(po, 'PO')} onReceive={handleReceivePO} />;
      case 'Add Stock': return <StockView settings={props.settings} items={props.items} sizes={props.sizes} inventory={inventory} dispatches={props.dispatches} stockEntries={props.stockEntries} onEdit={(se: StockEntry) => openForm('Add Stock', 'Manage Stock', se)} openForm={openForm} onDelete={props.onDelete} onClearBalance={handleClearBalanceHistory} />;
      case 'Dispatch': return <DispatchView dispatches={props.dispatches} onViewDetails={(dsp: any) => setViewingDetails({ type: 'DSP', data: dsp })} onRevert={handleRevertDispatch} onDelete={props.onDelete} />;
      case 'Dispatch Report': return <DispatchReportView dispatches={props.dispatches} sizes={props.sizes} items={props.items} />;
      case 'Maintenance': return <MaintenanceView {...props} />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-140px)] animate-in fade-in duration-500">
      <aside className="lg:w-72 shrink-0 no-print">
        <div className="bg-black rounded-[32px] border-2 border-black p-6 sticky top-4 space-y-6 shadow-2xl min-h-[calc(100vh-32px)]">
          <div className="mb-8">
            <h1 className="text-white font-black text-2xl tracking-tighter">ITOLI</h1>
            <p className="text-stone-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Granito LLP</p>
          </div>
          <div className="space-y-4">
            <div><NavHeader label="Intelligence" /><SidebarItem active={view.main === 'Dashboard'} onClick={() => setView({ main: 'Dashboard', sub: 'Overview' })} icon={<Activity size={20} />} label="Overview" /><SidebarItem active={view.main === 'Dispatch Report'} onClick={() => setView({ main: 'Dispatch Report', sub: 'Analytics' })} icon={<BarChart3 size={20} />} label="Dispatch Analytics" /></div>
            <div><NavHeader label="Registry" /><CollapsibleNavItem label="Master Hub" icon={<Grid size={20} />} isOpen={view.main === 'Master'} items={[{ label: 'Item Assets', active: view.main === 'Master' && view.sub === 'Item', onClick: () => setView({ main: 'Master', sub: 'Item' }) }, { label: 'Dimension Registry', active: view.main === 'Master' && view.sub === 'Size', onClick: () => setView({ main: 'Master', sub: 'Size' }) }, { label: 'Vendor Directory', active: view.main === 'Master' && view.sub === 'Vendor', onClick: () => setView({ main: 'Master', sub: 'Vendor' }) }]} /></div>
            <div><NavHeader label="Logistics" /><CollapsibleNavItem label="Commercial" icon={<ShoppingCart size={20} />} isOpen={view.main === 'Orders' || view.main === 'Purchase Orders'} items={[{ label: 'Sales Orders', active: view.main === 'Orders' && view.sub === 'Manage Orders', onClick: () => setView({ main: 'Orders', sub: 'Manage Orders' }) }, { label: 'Procurement', active: view.main === 'Purchase Orders' && view.sub === 'Manage Purchase Orders', onClick: () => setView({ main: 'Purchase Orders', sub: 'Manage Purchase Orders' }) }]} /><CollapsibleNavItem label="Inventory" icon={<Box size={20} />} isOpen={view.main === 'Add Stock'} items={[{ label: 'Stock Balance', active: view.main === 'Add Stock' && view.sub === 'Manage Stock', onClick: () => setView({ main: 'Add Stock', sub: 'Manage Stock' }) }]} /><SidebarItem active={view.main === 'Dispatch'} onClick={() => setView({ main: 'Dispatch', sub: 'List' })} icon={<Truck size={20} />} label="Shipment Log" /></div>
            <div><NavHeader label="System Tools" /><SidebarItem active={view.main === 'Maintenance'} onClick={() => setView({ main: 'Maintenance', sub: 'Registry' })} icon={<Wrench size={20} />} label="Data Maintenance" /></div>
          </div>
          <div className="pt-6 border-t border-stone-800"><div className="px-4 py-3 bg-stone-900 rounded-2xl border border-stone-700 shadow-sm"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center text-[10px] font-black">{props.currentUser.name.charAt(0)}</div><div className="flex-1 min-w-0"><p className="text-[10px] font-black text-white truncate uppercase tracking-wider">{props.currentUser.name}</p><p className="text-[8px] font-bold text-stone-500 uppercase tracking-widest">{props.currentUser.role}</p></div></div></div></div>
        </div>
      </aside>

      <div className="flex-1 space-y-3">
        <div className="bg-white rounded-[24px] border border-stone-200 shadow-sm p-3 lg:px-6 lg:py-3 flex justify-between items-center flex-wrap gap-4 sticky top-24 z-10 backdrop-blur-md bg-white/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-itoli/5 rounded-xl flex items-center justify-center text-itoli">
              {view.main === 'Dashboard' ? <Activity size={20} /> : view.main === 'Master' ? <Grid size={20} /> : view.main === 'Orders' ? <ShoppingCart size={20} /> : view.main === 'Add Stock' ? <Box size={20} /> : view.main === 'Maintenance' ? <Wrench size={20} /> : view.main === 'Dispatch Report' ? <BarChart3 size={20} /> : <Truck size={20} />}
            </div>
            <div><h2 className="text-lg font-black text-stone-900 tracking-tight leading-none">{view.main}</h2><p className="text-stone-400 text-[8px] font-black uppercase tracking-[0.2em] mt-1">{view.sub.replace('Manage ', '')}</p></div>
          </div>
          <div className="flex items-center gap-3">
            {view.main === 'Master' && view.sub === 'Item' && (<div className="flex items-center gap-2 pr-4 border-r border-stone-100"><input type="file" ref={itemFileInputRef} onChange={handleItemImport} className="hidden" accept=".xlsx, .xls" /><button onClick={() => itemFileInputRef.current?.click()} className="p-2 text-stone-500 hover:text-mozart hover:bg-stone-50 rounded-xl transition-all" title="Import Registry"><Upload size={16} /></button><button onClick={handleItemExport} className="p-2 text-stone-500 hover:text-mozart hover:bg-stone-50 rounded-xl transition-all" title="Export Assets"><Download size={16} /></button></div>)}
            {view.main !== 'Dashboard' && view.main !== 'Dispatch' && view.main !== 'Maintenance' && view.main !== 'Dispatch Report' && (<button onClick={() => openForm(view.main, view.sub.replace('Manage ', 'New '))} className="bg-stone-900 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] flex items-center gap-2 shadow-lg hover:bg-stone-800 transition-all active:scale-95"><Plus size={14} /> New Entry</button>)}
          </div>
        </div>
        <div className="bg-white rounded-[32px] border border-stone-200 shadow-sm p-4 lg:p-4 overflow-hidden">{renderContent()}</div>
      </div>

      {isModalOpen && (<PanelEntryModal view={view.main} sub={editingData?.id || editingData?.items ? view.sub : (view.sub.startsWith('Manage') ? view.sub.replace('Manage ', 'New ') : view.sub)} data={editingData} onClose={() => { setIsModalOpen(false); setEditingData(null); }} {...props} />)}
      {viewingDetails && (<DetailViewModal view={viewingDetails.type} data={viewingDetails.data} dispatches={props.dispatches} onClose={() => setViewingDetails(null)} onItemClick={handleDrillDown} />)}
      {dispatchPrompt && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/60 backdrop-blur-lg animate-in fade-in duration-300">
           <div className="bg-white rounded-[40px] shadow-2xl p-12 w-full max-w-md animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-mozart/10 text-mozart rounded-3xl flex items-center justify-center mb-6"><Truck size={32} /></div>
              <h3 className="text-2xl font-black text-stone-900 tracking-tight mb-2">Finalize Shipment</h3>
              <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest mb-8 border-b border-stone-100 pb-4">Transaction Reference: {dispatchPrompt.orderNo}</p>
              <div className="space-y-6">
                 <div className="space-y-2"><label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Vehicle License Plate</label><input autoFocus type="text" value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value.toUpperCase())} className="w-full px-6 py-4 bg-stone-50 border border-stone-200 rounded-2xl text-base font-black focus:bg-white focus:ring-4 focus:ring-mozart/5 outline-none transition-all placeholder:text-stone-300" placeholder="E.G. MH 01 AB 1234" /></div>
                 <div className="flex gap-4 pt-4"><button onClick={() => setDispatchPrompt(null)} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-600 transition-colors">Discard</button><button onClick={executeDispatch} disabled={!vehicleNo} className="flex-[2] py-4 bg-stone-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-stone-900/20 disabled:opacity-30 active:scale-95 transition-all">Authorize Dispatch</button></div>
              </div>
           </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const DetailViewModal = ({ view, data, dispatches, onClose, onItemClick }: any) => {
  const isDSP = view === 'DSP';
  const items = isDSP ? (dispatches || []).filter((d: DispatchEntry) => d.dispatchNo === data.dispatchNo) : (data.items || []);
  const headerLabel = view === 'SO' ? 'Sales Order Manifest' : view === 'PO' ? 'Procurement Details' : 'Logistics Shipment Log';
  const entityLabel = view === 'SO' ? 'Consignee' : view === 'PO' ? 'Vendor Partner' : 'Receiver';
  const entityName = view === 'SO' ? data.customerName : view === 'PO' ? data.vendorName : data.customerName;
  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-lg animate-in fade-in duration-300">
      <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-2xl p-10 max-h-[85vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-300">
        <div className="flex justify-between items-start mb-8 border-b border-stone-100 pb-6"><div><p className="text-[10px] font-black text-stone-300 uppercase tracking-widest mb-1">{headerLabel}</p><h3 className="text-3xl font-black text-stone-900 tracking-tight">{data.orderNo || data.poNo || data.dispatchNo}</h3></div><button onClick={onClose} className="p-3 text-stone-300 hover:text-stone-900 hover:bg-stone-50 rounded-2xl transition-all"><X size={24} /></button></div>
        <div className="grid grid-cols-2 gap-8 mb-10"><div className="space-y-1"><p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Transaction Date</p><p className="text-sm font-black text-stone-800">{data.date}</p></div><div className="space-y-1"><p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">{entityLabel}</p><p className="text-sm font-black text-stone-800 uppercase tracking-tight">{entityName}</p></div>{isDSP && (<div className="space-y-1 col-span-2 p-4 bg-stone-50 rounded-2xl border border-stone-200/60"><p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Logistic Unit Identified</p><p className="text-base font-black text-black uppercase tracking-widest">{data.vehicleNo}</p></div>)}</div>
        <div className="space-y-4">
           <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest border-l-2 border-black pl-3">Manifest Particulars</h4>
           <div className="overflow-hidden border border-stone-100 rounded-3xl shadow-sm"><table className="w-full text-left border-collapse"><thead className="bg-stone-50/50 text-[9px] font-black text-stone-400 uppercase tracking-widest"><tr><th className="px-6 py-1">Asset Identification</th><th className="px-6 py-1">Dimension</th><th className="px-6 py-1 text-right">Units</th></tr></thead><tbody className="divide-y divide-stone-50">{items.map((it: any, idx: number) => (<tr key={idx} className="hover:bg-stone-50/30 group transition-colors"><td className="px-6 py-1.5"><button onClick={() => onItemClick(it.itemName)} className="text-left group/link flex items-center gap-2 text-stone-900 hover:text-black transition-colors"><span className="font-black text-[13px] uppercase tracking-tight border-b-2 border-transparent group-hover/link:border-black/30">{it.itemName}</span><ExternalLink size={12} className="opacity-0 group-hover/link:opacity-100 text-black transition-all transform scale-75 group-hover/link:scale-100" /></button></td><td className="px-6 py-1.5 font-black text-[10px] text-stone-400 uppercase tracking-widest">{it.sizeName}</td><td className="px-6 py-1.5 text-right font-black text-stone-900 tabular-nums text-base">{it.quantity.toLocaleString()}</td></tr>))}</tbody><tfoot className="bg-stone-900 text-white font-black text-[10px] uppercase tracking-[0.2em]"><tr><td colSpan={2} className="px-6 py-3">Consolidated Shipment Volume</td><td className="px-6 py-3 text-right text-lg text-amber-400 tabular-nums">{items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0).toLocaleString()}</td></tr></tfoot></table></div>
        </div>
        {data.remarks && (<div className="mt-8 p-6 bg-stone-50 rounded-[32px] border border-stone-200"><p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-2 flex items-center gap-2"><MessageSquare size={14} className="text-black" /> Order Remarks</p><p className="text-sm font-medium text-stone-700 italic leading-relaxed">{data.remarks}</p></div>)}
      </div>
    </div>,
    document.body
  );
};

const NavHeader = ({ label }: { label: string }) => (<div className="pt-2 pb-1 px-4 text-[9px] font-black text-stone-500 uppercase tracking-[0.3em]">{label}</div>);
const SidebarItem = ({ active, onClick, icon, label }: any) => (<button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl transition-all ${active ? 'bg-white text-black shadow-sm' : 'text-stone-400 hover:text-white'}`}><span className={`${active ? 'text-black' : 'text-stone-500'}`}>{icon}</span><span className="text-[11px] font-black uppercase tracking-[0.1em]">{label}</span></button>);
const MaintenanceView = ({ orders, purchaseOrders, stockEntries, dispatches, onDelete }: any) => {
  const purgeCollection = async (coll: string, data: any[], label: string) => {
    if (!confirm(`CRITICAL ACTION: Are you sure you want to delete ALL records in "${label}"?`)) return;
    if (prompt("Type 'DELETE' to confirm:") !== 'DELETE') return;
    for (const item of data) await onDelete(coll, item.id);
    alert(`Successfully purged ${label}.`);
  };
  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="bg-red-50/50 border border-red-100 rounded-2xl p-4 flex items-start gap-4"><div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center shrink-0"><ShieldAlert size={24} /></div><div><h3 className="text-lg font-black text-stone-900 tracking-tight uppercase">System Data Purge Control</h3><p className="text-stone-500 text-xs mt-0.5 max-w-2xl font-medium">Use these tools to reset transaction history. These actions are destructive.</p></div></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><MaintenanceCard label="Sales Pipeline" count={orders.length} onPurge={() => purgeCollection('orders', orders, 'Sales Orders')} /><MaintenanceCard label="Procurement Logs" count={purchaseOrders.length} countLabel="POs" onPurge={() => purgeCollection('purchaseOrders', purchaseOrders, 'Purchase Orders')} /><MaintenanceCard label="Inventory History" count={stockEntries.length} onPurge={() => purgeCollection('stockEntries', stockEntries, 'Movement Logs')} /><MaintenanceCard label="Logistic Shipments" count={dispatches.length} onPurge={() => purgeCollection('dispatches', dispatches, 'Shipment Records')} /></div>
    </div>
  );
};
const MaintenanceCard = ({ label, count, onPurge }: any) => (<div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex flex-col justify-between group hover:border-red-100 transition-colors"><div className="mb-3 flex justify-between items-start"><h4 className="text-[10px] font-black text-stone-900 uppercase tracking-widest">{label}</h4><span className="px-2 py-0.5 bg-stone-50 rounded-full text-[9px] font-black text-stone-400">{count} Records</span></div><button onClick={onPurge} disabled={count === 0} className="w-full py-2 bg-stone-50 text-stone-600 border border-stone-100 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-600 transition-all disabled:opacity-30">Purge Data</button></div>);
const CollapsibleNavItem = ({ label, icon, items, isOpen }: any) => {
  const [collapsed, setCollapsed] = useState(!isOpen);
  return (
    <div className="space-y-1">
      <button onClick={() => setCollapsed(!collapsed)} className={`w-full flex items-center justify-between px-4 py-2 rounded-xl transition-all ${isOpen ? 'text-stone-900 font-bold' : 'text-stone-500 hover:text-stone-900'}`}><div className="flex items-center gap-3"><span className="text-stone-400">{icon}</span><span className="text-[11px] font-black uppercase tracking-[0.1em]">{label}</span></div><ChevronDown size={14} className={`transition-transform duration-300 text-stone-300 ${collapsed ? '' : 'rotate-180'}`} /></button>
      {!collapsed && (<div className="pl-12 space-y-1 animate-in slide-in-from-top-2 duration-300">{(items || []).map((item: any, idx: number) => (<button key={idx} onClick={item.onClick} className={`w-full text-left py-2 text-[10px] font-black uppercase tracking-wider transition-colors ${item.active ? 'text-black' : 'text-stone-400 hover:text-stone-700'}`}>{item.label}</button>))}</div>)}
    </div>
  );
};

const DashboardView = ({ items, orders, purchaseOrders, dispatches, inventory }: any) => {
  const pendingOrders = (orders || []).filter((o: Order) => o.status === OrderStatus.PENDING);
  const stats = [
    { label: 'Active Assets', value: (items || []).length, color: 'text-blue-600', bg: 'bg-blue-50/50', icon: <Package size={20} /> },
    { label: 'Pending Demand', value: pendingOrders.length, color: 'text-amber-600', bg: 'bg-amber-50/50', icon: <ShoppingCart size={20} /> },
    { label: 'Active Pipeline', value: (purchaseOrders || []).filter((po: any) => !po.isConvertedToStock).length, color: 'text-indigo-600', bg: 'bg-indigo-50/50', icon: <Layers size={20} /> },
    { label: 'Logistics Volume', value: (dispatches || []).length, color: 'text-stone-900', bg: 'bg-stone-50', icon: <Truck size={20} /> }
  ];
  return (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">{stats.map(s => (<div key={s.label} className={`${s.bg} p-4 rounded-2xl border border-stone-100 shadow-sm group hover:shadow-md transition-all`}><div className={`mb-2 ${s.color} opacity-60 group-hover:opacity-100 transition-opacity`}>{s.icon}</div><p className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1">{s.label}</p><p className="text-2xl font-black tabular-nums tracking-tighter text-stone-900">{s.value}</p></div>))}</div>);
};

const MasterView = ({ activeSub, items, sizes, vendors, onEdit, onDelete, initialSearch }: any) => {
  const [searchTerm, setSearchTerm] = useState(initialSearch || '');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const rawList = activeSub === 'Item' ? (items || []) : activeSub === 'Size' ? (sizes || []) : (vendors || []);
  const collectionName = activeSub.toLowerCase() + 's';
  
  const filtered = useMemo(() => {
    let result = rawList.filter((item: any) => (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()));
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const aVal = String(a[sortConfig.key] || '').toLowerCase();
        const bVal = String(b[sortConfig.key] || '').toLowerCase();
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [rawList, searchTerm, sortConfig]);

  const toggleSort = (key: string) => setSortConfig(prev => prev?.key === key ? (prev.direction === 'asc' ? { key, direction: 'desc' } : null) : { key, direction: 'asc' });
  const getSortIcon = (key: string) => sortConfig?.key !== key ? <ArrowUpDown size={12} className="opacity-20" /> : (sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-mozart" /> : <ChevronDownIcon size={12} className="text-mozart" />);

  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleSelectAll = () => setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map((f: any) => f.id));

  const handleBulkDelete = async () => {
    if (!confirm(`Permanently delete ${selectedIds.length} records?`)) return;
    for (const id of selectedIds) await onDelete(collectionName, id);
    setSelectedIds([]);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative group flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" />
          <input type="text" placeholder={`Lookup ${activeSub.toLowerCase()} records...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-xs font-black uppercase outline-none focus:ring-4 focus:ring-mozart/5 transition-all" />
        </div>
        {selectedIds.length > 0 && (
          <button onClick={handleBulkDelete} className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border border-red-100 animate-in fade-in slide-in-from-right-2">
            <Trash2 size={14} /> Delete Selected ({selectedIds.length})
          </button>
        )}
      </div>

      <div className="overflow-hidden border border-stone-100 rounded-[24px] shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-stone-50/50 text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] border-b border-stone-100">
            <tr>
              <th className="px-6 py-1.5 w-12 text-center"><button onClick={toggleSelectAll} className="text-stone-300 hover:text-mozart">{selectedIds.length === filtered.length && filtered.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}</button></th>
              <th className="px-6 py-1.5 w-16 text-center">S.R.</th>
              <th className="px-8 py-1.5 cursor-pointer hover:bg-stone-100" onClick={() => toggleSort('name')}><div className="flex items-center gap-2">Entity Identification {getSortIcon('name')}</div></th>
              <th className="px-8 py-1.5">Attributes</th>
              <th className="px-8 py-1.5 text-right">Controls</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {filtered.map((item: any, idx: number) => (
              <tr key={item.id} className={`hover:bg-stone-50/30 group transition-colors ${selectedIds.includes(item.id) ? 'bg-mozart/5' : ''}`}>
                <td className="px-6 py-1 text-center"><button onClick={() => toggleSelect(item.id)} className={`${selectedIds.includes(item.id) ? 'text-mozart' : 'text-stone-200'}`}>{selectedIds.includes(item.id) ? <CheckSquare size={18} /> : <Square size={18} />}</button></td>
                <td className="px-8 py-1 text-center font-black text-[10px] text-stone-300">{idx + 1}</td>
                <td className="px-8 py-1 text-[13px] font-black text-stone-900 uppercase">
                  {item.name}{activeSub === 'Item' && !item.isActive && <span className="ml-2 px-2 py-0.5 bg-red-50 text-red-500 rounded text-[8px] uppercase tracking-tighter">Inactive</span>}
                </td>
                <td className="px-8 py-1 text-[10px] font-black text-stone-400 uppercase tracking-widest">{activeSub === 'Item' ? item.description : activeSub === 'Size' ? item.unitType : `${item.city} • ${item.mobile}`}</td>
                <td className="px-8 py-1 text-right opacity-0 group-hover:opacity-100 transition-all"><button onClick={() => onEdit(item)} className="p-2 text-stone-400 hover:text-stone-900"><Edit2 size={16} /></button><button onClick={() => confirm(`Delete permanently?`) && onDelete(collectionName, item.id)} className="p-2 text-stone-400 hover:text-red-600 ml-1"><Trash2 size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DateRangeFilter = ({ startDate, endDate, setStartDate, setEndDate }: any) => {
  const setMonthRange = (monthOffset: number) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };
  return (
    <div className="flex flex-wrap items-end gap-2 p-3 bg-stone-50/50 rounded-2xl border border-stone-200/60 mb-3">
      <div className="space-y-1"><label className="text-[8px] font-black text-stone-400 uppercase tracking-widest ml-1">From Date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="block px-2 py-1 bg-white border border-stone-200 rounded-lg text-[10px] font-bold outline-none" /></div>
      <div className="space-y-1"><label className="text-[8px] font-black text-stone-400 uppercase tracking-widest ml-1">To Date</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="block px-2 py-1 bg-white border border-stone-200 rounded-lg text-[10px] font-bold outline-none" /></div>
      <div className="flex gap-1.5"><button onClick={() => setMonthRange(0)} className="px-2 py-1 bg-white border border-stone-200 rounded-lg text-[8px] font-black uppercase text-stone-400 hover:text-mozart transition-all">This Month</button><button onClick={() => setMonthRange(-1)} className="px-2 py-1 bg-white border border-stone-200 rounded-lg text-[8px] font-black uppercase text-stone-400 hover:text-mozart transition-all">Last Month</button></div>
    </div>
  );
};

const OrdersListView = ({ orders, onDelete, onEdit, onDispatchRequest, onPrint, onConvertToPO, onViewDetails }: any) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  const processedOrders = useMemo(() => {
    let result = (orders || []).filter((o: Order) => o.status === OrderStatus.PENDING);
    if (searchTerm) result = result.filter(o => o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || o.orderNo.toLowerCase().includes(searchTerm.toLowerCase()));
    if (startDate) result = result.filter(o => o.date >= startDate);
    if (endDate) result = result.filter(o => o.date <= endDate);
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const aVal = (a as any)[sortConfig.key] || '';
        const bVal = (b as any)[sortConfig.key] || '';
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [orders, searchTerm, startDate, endDate, sortConfig]);

  const paginatedOrders = useMemo(() => {
    if (pageSize === 'all') return processedOrders;
    const start = (currentPage - 1) * (pageSize as number);
    return processedOrders.slice(start, start + (pageSize as number));
  }, [processedOrders, currentPage, pageSize]);

  const totalUnits = processedOrders.reduce((sum, o) => sum + (o.items || []).reduce((acc, it) => acc + (it.quantity || 0), 0), 0);
  const toggleSort = (key: string) => setSortConfig(prev => prev?.key === key ? (prev.direction === 'asc' ? { key, direction: 'desc' } : null) : { key, direction: 'asc' });
  const getSortIcon = (key: string) => sortConfig?.key !== key ? <ArrowUpDown size={12} className="opacity-20" /> : (sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-mozart" /> : <ChevronDownIcon size={12} className="text-mozart" />);
  
  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleSelectAll = () => setSelectedIds(selectedIds.length === paginatedOrders.length ? [] : paginatedOrders.map((o: any) => o.id));
  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.length} orders?`)) return;
    for (const id of selectedIds) await onDelete('orders', id);
    setSelectedIds([]);
  };

  return (
    <div className="space-y-3">
      <DateRangeFilter startDate={startDate} endDate={endDate} setStartDate={setStartDate} setEndDate={setEndDate} />
      <div className="flex justify-between items-center gap-3">
        <div className="relative group flex-1"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" /><input type="text" placeholder="Search orders..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full pl-12 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-xs font-black uppercase outline-none focus:ring-4 focus:ring-mozart/5 transition-all" /></div>
        {selectedIds.length > 0 && <button onClick={handleBulkDelete} className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border border-red-100 animate-in fade-in"><Trash2 size={14} /> Delete ({selectedIds.length})</button>}
      </div>
      <div className="overflow-hidden border border-stone-100 rounded-[24px] shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-stone-50/50 text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] border-b border-stone-100">
            <tr>
              <th className="px-6 py-1.5 w-12 text-center"><button onClick={toggleSelectAll} className="text-stone-300 hover:text-mozart">{selectedIds.length === paginatedOrders.length && paginatedOrders.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}</button></th>
              <th className="px-6 py-1.5 w-16 text-center">S.R.</th>
              <th className="px-6 py-1.5 cursor-pointer" onClick={() => toggleSort('date')}>Timeline {getSortIcon('date')}</th>
              <th className="px-6 py-1.5 cursor-pointer" onClick={() => toggleSort('orderNo')}>Doc ID {getSortIcon('orderNo')}</th>
              <th className="px-6 py-1.5 cursor-pointer" onClick={() => toggleSort('customerName')}>Consignee {getSortIcon('customerName')}</th>
              <th className="px-6 py-1.5 text-right">Units</th>
              <th className="px-6 py-1.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {paginatedOrders.map((o: Order, idx: number) => {
              const units = (o.items || []).reduce((acc, it) => acc + (it.quantity || 0), 0);
              const sr = pageSize === 'all' ? idx + 1 : (currentPage - 1) * (pageSize as number) + idx + 1;
              return (
                <tr key={o.id} className={`hover:bg-stone-50/30 transition-colors ${selectedIds.includes(o.id) ? 'bg-mozart/5' : ''}`}>
                  <td className="px-6 py-1 text-center"><button onClick={() => toggleSelect(o.id)} className={`${selectedIds.includes(o.id) ? 'text-mozart' : 'text-stone-200'}`}>{selectedIds.includes(o.id) ? <CheckSquare size={18} /> : <Square size={18} />}</button></td>
                  <td className="px-6 py-1 text-center font-black text-[10px] text-stone-300">{sr}</td>
                  <td className="px-6 py-1 text-[11px] font-bold text-stone-400">{o.date}</td>
                  <td className="px-6 py-1 font-black text-[12px] text-stone-500">{o.orderNo}</td>
                  <td className="px-6 py-1 font-black text-[13px] text-stone-900 uppercase">{o.customerName}</td>
                  <td className="px-6 py-1 text-right font-black text-stone-900 tabular-nums">{units.toLocaleString()}</td>
                  <td className="px-6 py-1 text-right flex justify-end gap-1">
                    <button onClick={() => onViewDetails(o)} className="p-2 text-stone-400 hover:text-stone-900"><Eye size={16} /></button>
                    <button onClick={() => onEdit(o)} className="p-2 text-stone-400 hover:text-stone-900"><Edit2 size={16} /></button>
                    <button onClick={() => confirm(`Delete order?`) && onDelete('orders', o.id)} className="p-2 text-stone-400 hover:text-red-600"><Trash2 size={16} /></button>
                    <button onClick={() => onConvertToPO(o)} className="p-2 text-stone-400 hover:text-indigo-600" title="Generate PO"><FilePlus size={16} /></button>
                    <button onClick={() => onPrint(o, 'SO')} className="p-2 text-stone-400 hover:text-mozart"><Printer size={16} /></button>
                    <button onClick={() => onDispatchRequest(o)} className="p-2 bg-mozart text-white rounded-xl"><Truck size={16} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-stone-900 text-white font-black text-[11px] uppercase"><tr><td colSpan={4} className="px-10 py-3 text-white/40">Active Pipeline Volume: {processedOrders.length} Records</td><td colSpan={3} className="px-6 py-3 text-right text-xl text-amber-400 tabular-nums">{totalUnits.toLocaleString()} Units</td></tr></tfoot>
        </table>
      </div>
      <Pagination totalItems={processedOrders.length} pageSize={pageSize} setPageSize={setPageSize} currentPage={currentPage} setCurrentPage={setCurrentPage} />
    </div>
  );
};

const PurchaseOrdersListView = ({ purchaseOrders, onDelete, onEdit, onPrint, onViewDetails, onReceive }: any) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Pending' | 'Received' | 'All'>('Pending');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  const processedPOs = useMemo(() => {
    let result = [...(purchaseOrders || [])];
    if (statusFilter === 'Pending') result = result.filter(po => !po.isConvertedToStock);
    else if (statusFilter === 'Received') result = result.filter(po => po.isConvertedToStock);
    if (searchTerm) result = result.filter(po => po.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) || po.poNo.toLowerCase().includes(searchTerm.toLowerCase()));
    if (startDate) result = result.filter(po => po.date >= startDate);
    if (endDate) result = result.filter(po => po.date <= endDate);
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const aVal = (a as any)[sortConfig.key] || '';
        const bVal = (b as any)[sortConfig.key] || '';
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [purchaseOrders, searchTerm, startDate, endDate, statusFilter, sortConfig]);

  const paginatedPOs = useMemo(() => {
    if (pageSize === 'all') return processedPOs;
    const start = (currentPage - 1) * (pageSize as number);
    return processedPOs.slice(start, start + (pageSize as number));
  }, [processedPOs, currentPage, pageSize]);

  const toggleSort = (key: string) => setSortConfig(prev => prev?.key === key ? (prev.direction === 'asc' ? { key, direction: 'desc' } : null) : { key, direction: 'asc' });
  const getSortIcon = (key: string) => sortConfig?.key !== key ? <ArrowUpDown size={12} className="opacity-20" /> : (sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-mozart" /> : <ChevronDownIcon size={12} className="text-mozart" />);
  
  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleSelectAll = () => setSelectedIds(selectedIds.length === paginatedPOs.length ? [] : paginatedPOs.map((p: any) => p.id));
  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.length} POs?`)) return;
    for (const id of selectedIds) await onDelete('purchaseOrders', id);
    setSelectedIds([]);
  };

  const grandTotalUnits = processedPOs.reduce((sum: number, po: any) => sum + (po.items || []).reduce((acc: number, it: any) => acc + (Number(it.quantity) || 0), 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-col lg:flex-row gap-4 items-end">
        <div className="flex-1 w-full"><DateRangeFilter startDate={startDate} endDate={endDate} setStartDate={setStartDate} setEndDate={setEndDate} /></div>
        <div className="space-y-1 w-full lg:w-40 mb-3">
          <label className="text-[8px] font-black text-stone-400 uppercase tracking-widest ml-1">Lifecycle Status</label>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as any); setCurrentPage(1); }} className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-[10px] font-bold outline-none focus:ring-4 focus:ring-mozart/5 transition-all">
            <option value="All">All Transactions</option>
            <option value="Pending">Pending Fulfillment</option>
            <option value="Received">Received & Stocked</option>
          </select>
        </div>
      </div>
      <div className="flex justify-between items-center gap-3">
        <div className="relative flex-1"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" /><input type="text" placeholder="Search POs..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full pl-12 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-xs font-black uppercase outline-none focus:ring-4 focus:ring-mozart/5 transition-all" /></div>
        {selectedIds.length > 0 && <button onClick={handleBulkDelete} className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border border-red-100 animate-in fade-in"><Trash2 size={14} /> Delete ({selectedIds.length})</button>}
      </div>
      <div className="overflow-hidden border border-stone-100 rounded-[24px] shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-stone-50/50 text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] border-b border-stone-100">
            <tr>
              <th className="px-6 py-1.5 w-12 text-center"><button onClick={toggleSelectAll} className="text-stone-300 hover:text-mozart">{selectedIds.length === paginatedPOs.length && paginatedPOs.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}</button></th>
              <th className="px-6 py-1.5 w-16 text-center">S.R.</th>
              <th className="px-6 py-1.5 cursor-pointer" onClick={() => toggleSort('date')}>Date {getSortIcon('date')}</th>
              <th className="px-6 py-1.5 cursor-pointer" onClick={() => toggleSort('poNo')}>PO ID {getSortIcon('poNo')}</th>
              <th className="px-6 py-1.5 cursor-pointer" onClick={() => toggleSort('vendorName')}>Vendor {getSortIcon('vendorName')}</th>
              <th className="px-6 py-1.5 text-right">Units</th>
              <th className="px-6 py-1.5 text-center">Status</th>
              <th className="px-6 py-1.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {paginatedPOs.map((po: PurchaseOrder, idx: number) => {
              const units = (po.items || []).reduce((acc, it) => acc + (it.quantity || 0), 0);
              const sr = pageSize === 'all' ? idx + 1 : (currentPage - 1) * (pageSize as number) + idx + 1;
              return (
                <tr key={po.id} className={`hover:bg-stone-50/30 ${selectedIds.includes(po.id) ? 'bg-mozart/5' : ''}`}>
                  <td className="px-6 py-1 text-center"><button onClick={() => toggleSelect(po.id)} className={`${selectedIds.includes(po.id) ? 'text-mozart' : 'text-stone-200'}`}>{selectedIds.includes(po.id) ? <CheckSquare size={18} /> : <Square size={18} />}</button></td>
                  <td className="px-6 py-1 text-center font-black text-[10px] text-stone-300">{sr}</td>
                  <td className="px-6 py-1 text-[11px] font-bold text-stone-400">{po.date}</td>
                  <td className="px-6 py-1 font-black text-[12px] text-stone-500">{po.poNo}</td>
                  <td className="px-6 py-1 font-black text-[13px] text-stone-900 uppercase">{po.vendorName}</td>
                  <td className="px-6 py-1 text-right font-black text-stone-900 tabular-nums">{units.toLocaleString()}</td>
                  <td className="px-6 py-1 text-center">
                    <span className={`px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${po.isConvertedToStock ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                      {po.isConvertedToStock ? 'Received' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-1 text-right flex justify-end gap-1">
                    <button onClick={() => onViewDetails(po)} className="p-2 text-stone-400 hover:text-stone-900"><Eye size={16} /></button>
                    {!po.isConvertedToStock && (
                      <button onClick={() => onReceive(po)} className="p-2 text-stone-400 hover:text-emerald-600" title="Receive Stock"><CheckCircle2 size={16} /></button>
                    )}
                    <button onClick={() => onEdit(po)} className="p-2 text-stone-400 hover:text-stone-900"><Edit2 size={16} /></button>
                    <button onClick={() => confirm(`Delete PO?`) && onDelete('purchaseOrders', po.id)} className="p-2 text-stone-400 hover:text-red-600"><Trash2 size={16} /></button>
                    <button onClick={() => onPrint(po, 'PO')} className="p-2 text-stone-400 hover:text-mozart"><Printer size={16} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-stone-900 text-white font-black text-[11px] uppercase"><tr><td colSpan={5} className="px-10 py-3 text-white/40">Active Procurement Aggregate</td><td colSpan={3} className="px-6 py-3 text-right text-xl text-amber-400 tabular-nums">{grandTotalUnits.toLocaleString()} Units</td></tr></tfoot>
        </table>
      </div>
      <Pagination totalItems={processedPOs.length} pageSize={pageSize} setPageSize={setPageSize} currentPage={currentPage} setCurrentPage={setCurrentPage} />
    </div>
  );
};

const StockView = ({ items, sizes, inventory, stockEntries, dispatches, onDelete, onEdit, openForm, onClearBalance, settings }: any) => {
  const [activeTab, setActiveTab] = useState<'balance' | 'history'>('balance');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  const balanceData = useMemo(() => {
    const list: any[] = [];
    (items || []).forEach((item: Item) => {
      (sizes || []).forEach((size: Size) => {
        const qty = inventory[`${item.id}_${size.id}`] || 0;
        if (qty > 0) list.push({ item, size, qty, name: item.name });
      });
    });
    let result = list.filter(d => d.item.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const aVal = sortConfig.key === 'qty' ? a.qty : (a.name || '').toLowerCase();
        const bVal = sortConfig.key === 'qty' ? b.qty : (b.name || '').toLowerCase();
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [items, sizes, inventory, searchTerm, sortConfig]);

  const historyData = useMemo(() => {
    const inbound = (stockEntries || []).map((e: StockEntry) => ({
      id: e.id,
      date: e.date,
      type: 'IN',
      source: e.reference || 'MANUAL',
      itemName: e.itemName,
      sizeName: e.sizeName,
      delta: e.quantityAdded,
      updatedAt: e.updatedAt || 0
    }));

    const outbound = (dispatches || []).map((d: DispatchEntry) => ({
      id: d.id,
      date: d.date,
      type: 'OUT',
      source: `DISPATCH: ${d.dispatchNo}`,
      itemName: d.itemName,
      sizeName: d.sizeName,
      delta: -d.quantity,
      updatedAt: d.updatedAt || 0
    }));

    let result = [...inbound, ...outbound];
    if (searchTerm) result = result.filter(e => e.itemName.toLowerCase().includes(searchTerm.toLowerCase()) || e.source.toLowerCase().includes(searchTerm.toLowerCase()));
    if (startDate) result = result.filter(e => e.date >= startDate);
    if (endDate) result = result.filter(e => e.date <= endDate);
    result.sort((a, b) => b.updatedAt - a.updatedAt);
    
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const aVal = (a as any)[sortConfig.key] || '';
        const bVal = (b as any)[sortConfig.key] || '';
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [stockEntries, dispatches, searchTerm, startDate, endDate, sortConfig]);

  const paginatedData = useMemo(() => {
    const raw = activeTab === 'balance' ? balanceData : historyData;
    if (pageSize === 'all') return raw;
    const start = (currentPage - 1) * (pageSize as number);
    return raw.slice(start, start + (pageSize as number));
  }, [balanceData, historyData, activeTab, currentPage, pageSize]);

  const toggleSort = (key: string) => setSortConfig(prev => prev?.key === key ? (prev.direction === 'asc' ? { key, direction: 'desc' } : null) : { key, direction: 'asc' });
  const getSortIcon = (key: string) => sortConfig?.key !== key ? <ArrowUpDown size={12} className="opacity-20" /> : (sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-mozart" /> : <ChevronDownIcon size={12} className="text-mozart" />);

  const grandTotalBalance = balanceData.reduce((sum, d) => sum + d.qty, 0);

  const handlePrintBalance = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const rowsHtml = balanceData.map((d, idx) => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${d.item.name}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${d.size.name}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${d.qty.toLocaleString()}</td>
      </tr>
    `).join('');

    const logoHtml = settings?.logoUrl 
      ? `<img src="${settings.logoUrl}" style="max-height: 60px; max-width: 250px;" />`
      : `<div style="font-size: 24px; font-weight: 900; color: #1a4d5c;">${(settings?.companyName || 'mozart').toLowerCase()}</div>`;

    printWindow.document.write(`
      <html>
        <head>
          <title>Warehouse Balance Report</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #333; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1a4d5c; padding-bottom: 20px; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #f8f9fa; border: 1px solid #ddd; padding: 12px; text-align: left; font-size: 12px; font-weight: 800; text-transform: uppercase; }
            tfoot { font-weight: 800; }
          </style>
        </head>
        <body>
          <div class="header">${logoHtml}<div style="font-size: 18px; font-weight: 800; color: #666;">Warehouse Inventory Balance</div></div>
          <p style="font-size: 12px; color: #888; margin-bottom: 20px;">Report Generated: ${new Date().toLocaleString()}</p>
          <table>
            <thead><tr><th>S.R.</th><th>Asset Identification</th><th>Dimension</th><th style="text-align: right;">Available Units</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
            <tfoot><tr><td colspan="3" style="border: 1px solid #ddd; padding: 12px; text-align: right;">Consolidated Balance</td><td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${grandTotalBalance.toLocaleString()}</td></tr></tfoot>
          </table>
          <script>window.print(); setTimeout(() => window.close(), 500);</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleExportBalance = () => {
    const dataToExport = balanceData.map((d, i) => ({
      "S.R.": i + 1,
      "Asset Name": d.item.name,
      "Size": d.size.name,
      "Available Quantity": d.qty
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Balance");
    XLSX.writeFile(workbook, `Stock_Balance_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex gap-1.5 p-1 bg-stone-100/50 w-fit rounded-xl">
          <button onClick={() => { setActiveTab('balance'); setSortConfig(null); setCurrentPage(1); }} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase ${activeTab === 'balance' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400'}`}>Balance</button>
          <button onClick={() => { setActiveTab('history'); setSortConfig(null); setCurrentPage(1); }} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase ${activeTab === 'history' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400'}`}>History</button>
        </div>
        {activeTab === 'balance' && (
          <div className="flex items-center gap-2">
            <button onClick={handleExportBalance} className="p-1.5 text-stone-500 hover:text-mozart hover:bg-stone-50 rounded-lg transition-all border border-stone-200" title="Export Excel"><Download size={16} /></button>
            <button onClick={handlePrintBalance} className="p-1.5 text-stone-500 hover:text-mozart hover:bg-stone-50 rounded-lg transition-all border border-stone-200" title="Print Balance"><Printer size={16} /></button>
          </div>
        )}
      </div>
      <div className="relative group mb-3"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" /><input type="text" placeholder={`Lookup assets...`} value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full pl-12 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-xs font-black uppercase outline-none focus:ring-4 focus:ring-mozart/5 transition-all" /></div>
      <div className="border border-stone-100 rounded-[24px] overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-stone-50/50 text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] border-b border-stone-100">
            {activeTab === 'balance' ? (
              <tr><th className="px-8 py-1.5 w-16 text-center">S.R.</th><th className="px-8 py-1.5 cursor-pointer hover:bg-stone-100" onClick={() => toggleSort('item')}>Asset Identification {getSortIcon('item')}</th><th className="px-8 py-1.5">Dimension</th><th className="px-8 py-1.5 text-right cursor-pointer hover:bg-stone-100" onClick={() => toggleSort('qty')}>Units {getSortIcon('qty')}</th><th className="px-8 py-1.5 text-right">Actions</th></tr>
            ) : (
              <tr><th className="px-8 py-1.5 w-16 text-center">S.R.</th><th className="px-8 py-1.5 cursor-pointer hover:bg-stone-100" onClick={() => toggleSort('date')}>Timeline {getSortIcon('date')}</th><th className="px-8 py-1.5">Movement Source</th><th className="px-8 py-1.5">Asset Detail</th><th className="px-8 py-1.5 text-right">Delta Impact</th></tr>
            )}
          </thead>
          <tbody className="divide-y divide-stone-50">
            {activeTab === 'balance' ? paginatedData.map((d: any, idx: number) => {
              const sr = pageSize === 'all' ? idx + 1 : (currentPage - 1) * (pageSize as number) + idx + 1;
              return (
                <tr key={idx} className="hover:bg-stone-50/30 group transition-colors">
                  <td className="px-8 py-1 text-center font-black text-[10px] text-stone-300">{sr}</td>
                  <td className="px-8 py-1 font-black text-stone-900 uppercase text-[13px]">{d.item.name}</td>
                  <td className="px-8 py-1 text-stone-400 font-black uppercase text-[10px]">{d.size.name}</td>
                  <td className="px-8 py-1 text-right font-black text-stone-900 text-base">{d.qty.toLocaleString()}</td>
                  <td className="px-8 py-1 text-right opacity-0 group-hover:opacity-100 transition-opacity flex justify-end gap-1">
                    <button onClick={() => openForm('Add Stock', 'New Add Stock', { globalSizeId: d.size.id, items: [{ itemId: d.item.id, itemName: d.item.name, quantity: 0 }] })} className="p-2 text-stone-400 hover:text-stone-900"><Edit2 size={16} /></button>
                    <button onClick={() => onClearBalance(d.item.id, d.size.id)} className="p-2 text-stone-400 hover:text-red-600"><Trash2 size={16} /></button>
                  </td>
                </tr>
              );
            }) : paginatedData.map((entry: any, idx: number) => {
               const sr = pageSize === 'all' ? idx + 1 : (currentPage - 1) * (pageSize as number) + idx + 1;
               return (
                <tr key={entry.id} className="hover:bg-stone-50/30 group transition-colors">
                  <td className="px-8 py-1 text-center font-black text-[10px] text-stone-300">{sr}</td>
                  <td className="px-8 py-1 font-black text-stone-500 text-[11px]">{entry.date}</td>
                  <td className="px-8 py-1">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${entry.type === 'IN' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                        {entry.type === 'IN' ? 'Inbound' : 'Outbound'}
                      </span>
                      <span className="font-black text-stone-600 uppercase text-[10px] truncate max-w-[200px]">{entry.source}</span>
                    </div>
                  </td>
                  <td className="px-8 py-1">
                    <div className="flex flex-col">
                      <span className="font-black text-stone-900 uppercase text-[12px]">{entry.itemName}</span>
                      <span className="font-bold text-stone-400 text-[9px] uppercase tracking-widest">{entry.sizeName}</span>
                    </div>
                  </td>
                  <td className={`px-8 py-1 text-right font-black tabular-nums text-base ${entry.type === 'IN' ? 'text-emerald-600' : 'text-indigo-600'}`}>
                    {entry.delta > 0 ? '+' : ''}{entry.delta.toLocaleString()}
                  </td>
                </tr>
               );
            })}
          </tbody>
          {activeTab === 'balance' && (
            <tfoot className="bg-stone-900 text-white font-black text-[11px] uppercase"><tr><td colSpan={3} className="px-10 py-3 text-white/40">Warehouse Aggregation</td><td colSpan={2} className="px-8 py-3 text-right text-xl text-amber-400 tabular-nums">{grandTotalBalance.toLocaleString()} Units</td></tr></tfoot>
          )}
        </table>
      </div>
      <Pagination totalItems={activeTab === 'balance' ? balanceData.length : historyData.length} pageSize={pageSize} setPageSize={setPageSize} currentPage={currentPage} setCurrentPage={setCurrentPage} />
    </div>
  );
};

const DispatchView = ({ dispatches, onRevert, onDelete, onViewDetails }: any) => {
  const today = new Date().toISOString().split('T')[0];
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  const groupedData = useMemo(() => {
    const groups: Record<string, any> = {};
    (dispatches || []).forEach(d => {
        if (!groups[d.dispatchNo]) groups[d.dispatchNo] = { ...d, totalQuantity: 0, itemsCount: 0 };
        groups[d.dispatchNo].totalQuantity += (Number(d.quantity) || 0);
        groups[d.dispatchNo].itemsCount += 1;
    });
    let result = Object.values(groups);
    if (searchTerm) result = result.filter((d:any) => d.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || d.dispatchNo.toLowerCase().includes(searchTerm.toLowerCase()) || d.vehicleNo.toLowerCase().includes(searchTerm.toLowerCase()));
    if (startDate) result = result.filter((o:any) => o.date >= startDate);
    if (endDate) result = result.filter((o:any) => o.date <= endDate);
    if (sortConfig) {
      result = [...result].sort((a:any, b:any) => {
        const aVal = (a as any)[sortConfig.key === 'quantity' ? 'totalQuantity' : sortConfig.key] || '';
        const bVal = (b as any)[sortConfig.key === 'quantity' ? 'totalQuantity' : sortConfig.key] || '';
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [dispatches, searchTerm, startDate, endDate, sortConfig]);

  const paginatedData = useMemo(() => {
    if (pageSize === 'all') return groupedData;
    const start = (currentPage - 1) * (pageSize as number);
    return groupedData.slice(start, start + (pageSize as number));
  }, [groupedData, currentPage, pageSize]);

  const toggleSort = (key: string) => setSortConfig(prev => prev?.key === key ? (prev.direction === 'asc' ? { key, direction: 'desc' } : null) : { key, direction: 'asc' });
  const getSortIcon = (key: string) => sortConfig?.key !== key ? <ArrowUpDown size={12} className="opacity-20" /> : (sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-mozart" /> : <ChevronDownIcon size={12} className="text-mozart" />);
  
  const toggleSelect = (no: string) => setSelectedIds(prev => prev.includes(no) ? prev.filter(i => i !== no) : [...prev, no]);
  const toggleSelectAll = () => setSelectedIds(selectedIds.length === paginatedData.length ? [] : paginatedData.map((d: any) => d.dispatchNo));
  
  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.length} shipments?`)) return;
    const ids = (dispatches || []).filter(d => selectedIds.includes(d.dispatchNo)).map(d => d.id);
    for (const id of ids) await onDelete('dispatches', id);
    setSelectedIds([]);
  };

  const handleExportShipments = () => {
    const dataToExport = groupedData.map((d, i) => ({
      "S.R.": i + 1,
      "Date": d.date,
      "Dispatch ID": d.dispatchNo,
      "Consignee": d.customerName,
      "Vehicle": d.vehicleNo,
      "Total Units": d.totalQuantity
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Shipment Log");
    XLSX.writeFile(workbook, `Shipment_Log_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const grandTotalVolume = groupedData.reduce((sum, d: any) => sum + d.totalQuantity, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row justify-between items-end gap-3">
        <DateRangeFilter startDate={startDate} endDate={endDate} setStartDate={setStartDate} setEndDate={setEndDate} />
        <button onClick={handleExportShipments} className="mb-3 px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-[9px] font-black uppercase text-stone-500 hover:text-mozart hover:bg-stone-50 transition-all flex items-center gap-2 shadow-sm">
          <Download size={12} /> Export Log
        </button>
      </div>
      <div className="flex justify-between items-center gap-3">
        <div className="relative flex-1"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" /><input type="text" placeholder="Lookup shipments..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full pl-12 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-xs font-black uppercase outline-none focus:ring-4 focus:ring-mozart/5 transition-all" /></div>
        {selectedIds.length > 0 && <button onClick={handleBulkDelete} className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border border-red-100 animate-in fade-in"><Trash2 size={14} /> Delete ({selectedIds.length})</button>}
      </div>
      <div className="border border-stone-100 rounded-[24px] overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-stone-50/50 text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] border-b border-stone-100">
            <tr>
              <th className="px-6 py-1.5 w-12 text-center"><button onClick={toggleSelectAll} className="text-stone-300 hover:text-mozart">{selectedIds.length === paginatedData.length && paginatedData.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}</button></th>
              <th className="px-6 py-1.5 w-16 text-center">S.R.</th>
              <th className="px-6 py-1.5 cursor-pointer" onClick={() => toggleSort('date')}>Timeline {getSortIcon('date')}</th>
              <th className="px-6 py-1.5 cursor-pointer" onClick={() => toggleSort('dispatchNo')}>Shipment ID {getSortIcon('dispatchNo')}</th>
              <th className="px-6 py-1.5 cursor-pointer" onClick={() => toggleSort('customerName')}>Consignee {getSortIcon('customerName')}</th>
              <th className="px-6 py-1.5">Vehicle</th>
              <th className="px-6 py-1.5 text-right">Units</th>
              <th className="px-6 py-1.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {paginatedData.map((d: any, idx: number) => {
              const sr = pageSize === 'all' ? idx + 1 : (currentPage - 1) * (pageSize as number) + idx + 1;
              return (
                <tr key={d.dispatchNo} className={`hover:bg-stone-50/30 transition-colors ${selectedIds.includes(d.dispatchNo) ? 'bg-mozart/5' : ''}`}>
                  <td className="px-6 py-1 text-center"><button onClick={() => toggleSelect(d.dispatchNo)} className={`${selectedIds.includes(d.dispatchNo) ? 'text-mozart' : 'text-stone-200'}`}>{selectedIds.includes(d.dispatchNo) ? <CheckSquare size={18} /> : <Square size={18} />}</button></td>
                  <td className="px-6 py-1 text-center font-black text-[10px] text-stone-300">{sr}</td>
                  <td className="px-6 py-1 text-stone-400 font-black uppercase text-[9px]">{d.date}</td>
                  <td className="px-6 py-1 font-black text-stone-500 text-[12px]">{d.dispatchNo}</td>
                  <td className="px-6 py-1 font-black text-stone-900 uppercase text-[12px]">{d.customerName}</td>
                  <td className="px-6 py-1 font-black text-mozart text-[11px] uppercase tracking-wider">{d.vehicleNo}</td>
                  <td className="px-6 py-1 text-right font-black text-stone-900 tabular-nums text-base">{d.totalQuantity.toLocaleString()}</td>
                  <td className="px-6 py-1 text-right flex justify-end gap-1">
                    <button onClick={() => onViewDetails(d)} title="View Details" className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-all"><Eye size={16} /></button>
                    <button onClick={() => onRevert(d.dispatchNo)} className="p-2 text-mozart hover:bg-stone-100 rounded-xl transition-all" title="Revert to Pending"><RotateCcw size={16} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-stone-900 text-white font-black text-[11px] uppercase"><tr><td colSpan={6} className="px-10 py-3 text-white/40">Logistics Aggregate</td><td colSpan={2} className="px-6 py-3 text-right text-xl text-amber-400 tabular-nums">{grandTotalVolume.toLocaleString()} Units</td></tr></tfoot>
        </table>
      </div>
      <Pagination totalItems={groupedData.length} pageSize={pageSize} setPageSize={setPageSize} currentPage={currentPage} setCurrentPage={setCurrentPage} />
    </div>
  );
};

const DispatchReportView = ({ dispatches, sizes, items }: any) => {
  const getMonthStart = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  };
  const getMonthEnd = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState(getMonthStart());
  const [endDate, setEndDate] = useState(getMonthEnd());
  const [searchTerm, setSearchTerm] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  const setMonthRange = (monthOffset: number) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
    setCurrentPage(1);
  };

  const pivotData = useMemo(() => {
    const groups: Record<string, { itemName: string, sizeName: string, totalQty: number, shipments: number }> = {};
    
    (dispatches || []).forEach((d: DispatchEntry) => {
      const matchDate = (!startDate || d.date >= startDate) && (!endDate || d.date <= endDate);
      const matchSearch = !searchTerm || d.itemName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchSize = !sizeFilter || d.sizeId === sizeFilter;
      
      if (matchDate && matchSearch && matchSize) {
        const key = `${d.itemId}_${d.sizeId}`;
        if (!groups[key]) groups[key] = { itemName: d.itemName, sizeName: d.sizeName, totalQty: 0, shipments: 0 };
        groups[key].totalQty += Number(d.quantity);
        groups[key].shipments += 1;
      }
    });

    let result = Object.values(groups);
    
    if (sortConfig) {
      result = [...result].sort((a:any, b:any) => {
        const aVal = String(a[sortConfig.key] || '').toLowerCase();
        const bVal = String(b[sortConfig.key] || '').toLowerCase();
        if (sortConfig.key === 'totalQty' || sortConfig.key === 'shipments') {
           return sortConfig.direction === 'asc' ? a[sortConfig.key] - b[sortConfig.key] : b[sortConfig.key] - a[sortConfig.key];
        }
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
       result.sort((a, b) => b.totalQty - a.totalQty);
    }
    
    return result;
  }, [dispatches, startDate, endDate, searchTerm, sizeFilter, sortConfig]);

  const paginatedData = useMemo(() => {
    if (pageSize === 'all') return pivotData;
    const start = (currentPage - 1) * (pageSize as number);
    return pivotData.slice(start, start + (pageSize as number));
  }, [pivotData, currentPage, pageSize]);

  const totalReportQty = pivotData.reduce((sum, p) => sum + p.totalQty, 0);

  const toggleSort = (key: string) => {
    setSortConfig(prev => prev?.key === key ? (prev.direction === 'asc' ? { key, direction: 'desc' } : null) : { key, direction: 'asc' });
    setCurrentPage(1);
  };
  const getSortIcon = (key: string) => sortConfig?.key !== key ? <ArrowUpDown size={12} className="opacity-20" /> : (sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-mozart" /> : <ChevronDownIcon size={12} className="text-mozart" />);

  return (
    <div className="space-y-3 animate-in fade-in duration-500">
      <div className="bg-stone-50/50 border border-stone-200 p-4 rounded-2xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <label className="text-[8px] font-black text-stone-400 uppercase tracking-widest ml-1">Timeline Start</label>
            <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }} className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-[10px] font-bold outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-[8px] font-black text-stone-400 uppercase tracking-widest ml-1">Timeline End</label>
            <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }} className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-[10px] font-bold outline-none" />
          </div>
          <div className="flex gap-1.5 pb-0.5">
             <button onClick={() => setMonthRange(0)} className="px-2 py-1.5 bg-white border border-stone-200 rounded-lg text-[8px] font-black uppercase text-stone-500 hover:text-mozart hover:bg-stone-50 transition-all">This Month</button>
             <button onClick={() => setMonthRange(-1)} className="px-2 py-1.5 bg-white border border-stone-200 rounded-lg text-[8px] font-black uppercase text-stone-500 hover:text-mozart hover:bg-stone-50 transition-all">Last Month</button>
          </div>
          <div className="space-y-1"><label className="text-[8px] font-black text-stone-400 uppercase tracking-widest ml-1">Asset Search</label><div className="relative"><Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" /><input type="text" placeholder="Lookup item..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full pl-8 pr-3 py-1.5 bg-white border border-stone-200 rounded-lg text-[10px] font-bold outline-none" /></div></div>
        </div>
        <div className="w-full lg:w-1/4">
          <div className="space-y-1"><label className="text-[8px] font-black text-stone-400 uppercase tracking-widest ml-1">Size Filter</label><select value={sizeFilter} onChange={(e) => { setSizeFilter(e.target.value); setCurrentPage(1); }} className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-[10px] font-bold outline-none"><option value="">All Sizes</option>{(sizes || []).map((s: any) => (<option key={s.id} value={s.id}>{s.name}</option>))}</select></div>
        </div>
      </div>

      <div className="border border-stone-100 rounded-[24px] overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-stone-50/50 text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] border-b border-stone-100">
            <tr>
              <th className="px-10 py-2 cursor-pointer hover:bg-stone-100" onClick={() => toggleSort('itemName')}>Asset Particulars {getSortIcon('itemName')}</th>
              <th className="px-10 py-2 cursor-pointer hover:bg-stone-100" onClick={() => toggleSort('sizeName')}>Size Dimension {getSortIcon('sizeName')}</th>
              <th className="px-10 py-2 text-center cursor-pointer hover:bg-stone-100" onClick={() => toggleSort('shipments')}>Movement Frequency {getSortIcon('shipments')}</th>
              <th className="px-10 py-2 text-right cursor-pointer hover:bg-stone-100" onClick={() => toggleSort('totalQty')}>Consolidated Volume {getSortIcon('totalQty')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {paginatedData.map((row, idx) => (
              <tr key={idx} className="hover:bg-stone-50/30 transition-colors">
                <td className="px-10 py-1.5 font-black text-stone-900 uppercase text-[13px]">{row.itemName}</td>
                <td className="px-10 py-1.5 text-stone-400 font-black uppercase text-[10px]">{row.sizeName}</td>
                <td className="px-10 py-1.5 text-center"><span className="px-3 py-1 bg-stone-50 rounded-lg text-xs font-black text-stone-500">{row.shipments} Trips</span></td>
                <td className="px-10 py-1.5 text-right font-black text-stone-900 text-lg">{row.totalQty.toLocaleString()}</td>
              </tr>
            ))}
            {pivotData.length === 0 && (
              <tr><td colSpan={4} className="px-10 py-20 text-center text-stone-400 italic text-sm">No dispatch data found for the selected parameters.</td></tr>
            )}
          </tbody>
          <tfoot className="bg-stone-900 text-white font-black text-[11px] uppercase"><tr><td colSpan={3} className="px-10 py-6 text-white/40">Consolidated Shipping Performance</td><td colSpan={1} className="px-10 py-6 text-right text-2xl text-amber-400 tabular-nums">{totalReportQty.toLocaleString()} Units</td></tr></tfoot>
        </table>
      </div>
      <Pagination totalItems={pivotData.length} pageSize={pageSize} setPageSize={setPageSize} currentPage={currentPage} setCurrentPage={setCurrentPage} />
    </div>
  );
};

const PanelEntryModal = ({ view, sub, data, onClose, ...props }: any) => {
  const isMultiItemView = view === 'Orders' || view === 'Purchase Orders' || view === 'Add Stock';
  const [formData, setFormData] = useState<any>(data || { 
    date: new Date().toISOString().split('T')[0], 
    globalSizeId: data?.items?.[0]?.sizeId || data?.sizeId || '', 
    reference: data?.reference || '', 
    remarks: data?.remarks || '', 
    items: data?.items || [],
    isActive: true
  });
  const [partySearch, setPartySearch] = useState(data?.customerName || data?.name || '');
  const [itemPickerSearch, setItemPickerSearch] = useState('');
  const [itemSortDir, setItemSortDir] = useState<'asc' | 'desc'>('asc');
  const [isPartyListOpen, setIsPartyListOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsPartyListOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredParties = useMemo(() => {
    return props.parties.filter((p: Party) => 
      p.name.toLowerCase().includes(partySearch.toLowerCase()) ||
      (p.location && p.location.toLowerCase().includes(partySearch.toLowerCase()))
    );
  }, [props.parties, partySearch]);

  const selectedItemIds = useMemo(() => (formData.items || []).map((i: any) => i.itemId), [formData.items]);
  const activeItems = useMemo(() => (props.items || []).filter((i: Item) => i.isActive), [props.items]);
  
  const sortedAndFilteredPickerItems = useMemo(() => {
    let result = activeItems.filter((i: Item) => i.name.toLowerCase().includes(itemPickerSearch.toLowerCase()));
    result.sort((a, b) => {
      if (itemSortDir === 'asc') return a.name.localeCompare(b.name);
      return b.name.localeCompare(a.name);
    });
    return result;
  }, [activeItems, itemPickerSearch, itemSortDir]);

  const toggleItem = (item: Item) => {
    const exists = selectedItemIds.includes(item.id);
    if (exists) {
      setFormData({ ...formData, items: formData.items.filter((i: any) => i.itemId !== item.id) });
    } else {
      setFormData({ ...formData, items: [...formData.items, { itemId: item.id, itemName: item.name, quantity: 1 }] });
    }
  };

  const updateItemQty = (id: string, qty: number) => {
    setFormData({ ...formData, items: formData.items.map((i: any) => i.itemId === id ? { ...i, quantity: qty } : i) });
  };

  const handleSelectParty = (party: Party) => {
    setFormData({ ...formData, partyId: party.id });
    setPartySearch(party.name);
    setIsPartyListOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((view === 'Orders' || view === 'Purchase Orders') && (formData.items || []).length === 0) { alert("Please select at least one item."); return; }
    
    let coll = ''; let payload = { ...formData };
    const sizeObj = (props.sizes || []).find((s: any) => s.id === payload.globalSizeId);
    
    if (view === 'Orders') { 
      coll = 'orders'; 
      if (!payload.id) { payload.id = Math.random().toString(36).substr(2, 9); payload.orderNo = `ORD-${Date.now().toString().slice(-6)}`; payload.status = OrderStatus.PENDING; } 
      payload.customerName = partySearch; 
      payload.items = payload.items.map((it: any) => ({ ...it, sizeId: payload.globalSizeId, sizeName: sizeObj?.name || '', quantity: Number(it.quantity) })); 
    } else if (view === 'Purchase Orders') { 
      coll = 'purchaseOrders'; 
      if (!payload.id) { payload.id = Math.random().toString(36).substr(2, 9); payload.poNo = `PO-${Date.now().toString().slice(-6)}`; payload.isConvertedToStock = false; } 
      const vdr = (props.vendors || []).find((v: any) => v.id === payload.vendorId); 
      payload.vendorName = vdr?.name || ''; 
      payload.items = payload.items.map((it: any) => ({ ...it, sizeId: payload.globalSizeId, sizeName: sizeObj?.name || '', quantity: Number(it.quantity) })); 
    } else if (view === 'Add Stock') { 
      for (const it of payload.items) { const itm = (props.items || []).find((i: any) => i.id === it.itemId); await props.onUpsert('stockEntries', { id: Math.random().toString(36).substr(2, 9), date: payload.date, itemId: it.itemId, itemName: itm?.name || '', sizeId: payload.globalSizeId, sizeName: sizeObj?.name || '', quantityAdded: Number(it.quantity), reference: payload.reference || 'MANUAL', updatedAt: Date.now() }); } 
      onClose(); return; 
    } else if (view === 'Master') { 
      coll = sub.toLowerCase() + 's'; if (!payload.id) payload.id = Math.random().toString(36).substr(2, 9); payload.name = partySearch;
    }
    await props.onUpsert(coll, payload); onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl">
      <div className="bg-charcoal border border-white/[0.06] rounded-[32px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] w-full max-w-4xl p-6 md:p-8 max-h-[92vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 text-stone-100">
        <div className="flex justify-between items-center mb-6 border-b border-white/[0.04] pb-4">
          <h3 className="text-xl font-black text-white uppercase tracking-wider">{sub.replace('Manage ', '')} PROTOCOL</h3>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-white rounded-lg hover:bg-white/[0.03] transition-all"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h4 className="text-[10px] font-black text-mozart uppercase tracking-widest border-l-2 border-mozart pl-3">Standard Parameters</h4>
              {view === 'Master' ? (
                <>
                  <Field label="Identification Name *" value={partySearch} onChange={setPartySearch} />
                  {sub === 'Item' && <Field label="Description" value={formData.description} onChange={(v: string) => setFormData({...formData, description: v})} />}
                  {sub === 'Size' && <Field label="Unit Spec" value={formData.unitType} onChange={(v: string) => setFormData({...formData, unitType: v})} />}
                  {sub === 'Vendor' && <div className="grid grid-cols-2 gap-4"><Field label="Mobile" value={formData.mobile} onChange={(v: string) => setFormData({...formData, mobile: v})} /><Field label="City" value={formData.city} onChange={(v: string) => setFormData({...formData, city: v})} /></div>}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="System Date" type="date" value={formData.date} onChange={(v: string) => setFormData({...formData, date: v})} />
                    <Select label="Dimension" options={props.sizes || []} value={formData.globalSizeId} onChange={(v: string) => setFormData({...formData, globalSizeId: v})} />
                  </div>
                  {view === 'Orders' && (
                    <div className="space-y-1.5 relative select-none" ref={dropdownRef}>
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Consignee (Search Party) *</label>
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
                        <input 
                          type="text"
                          placeholder="Type name to lookup party..."
                          value={partySearch}
                          onFocus={() => setIsPartyListOpen(true)}
                          onChange={(e) => { setPartySearch(e.target.value); setIsPartyListOpen(true); }}
                          className="w-full pl-10 pr-8 py-3 bg-[#10141e] border border-white/[0.04] rounded-xl text-xs font-black uppercase text-stone-100 placeholder-stone-600 outline-none focus:border-mozart/50 focus:ring-4 focus:ring-mozart/5 transition-all"
                        />
                        <ChevronDown size={14} className={`absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 transition-transform ${isPartyListOpen ? 'rotate-180' : ''}`} />
                      </div>
                      {isPartyListOpen && partySearch.trim().length > 0 && (
                        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-charcoal border border-white/[0.08] rounded-xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar animate-in slide-in-from-top-1 duration-200">
                          {filteredParties.length > 0 ? filteredParties.map((p: Party) => (
                            <button key={p.id} type="button" onClick={() => handleSelectParty(p)} className="w-full text-left px-4 py-3 text-xs text-stone-300 hover:bg-mozart/10 border-b border-white/[0.04] last:border-none transition-colors group">
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex flex-col">
                                  <span className="font-extrabold text-[#F3F4F6] uppercase group-hover:text-mozart transition-colors">{p.name}</span>
                                  <div className="flex items-center gap-1.5 mt-1 text-[10px] font-black uppercase tracking-widest text-stone-450"><MapPin size={10} className="text-mozart" />{p.location || 'Location Not Set'}</div>
                                </div>
                                <div className="shrink-0 text-[9px] font-black uppercase tracking-widest bg-white/[0.03] border border-white/[0.06] px-2.5 py-1 rounded-md text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity">Select</div>
                              </div>
                            </button>
                          )) : <div className="px-4 py-6 text-center text-stone-500 italic text-xs font-bold uppercase">No matching partners found</div>}
                        </div>
                      )}
                    </div>
                  )}
                  {view === 'Orders' && <Field label="Remarks" value={formData.remarks} onChange={(v: string) => setFormData({...formData, remarks: v})} />}
                  {view === 'Purchase Orders' && <><Select label="Vendor *" options={props.vendors || []} value={formData.vendorId} onChange={(e) => setFormData({...formData, vendorId: e})} /><Field label="Remarks" value={formData.remarks} onChange={(v: string) => setFormData({...formData, remarks: v})} /></>}
                  {view === 'Add Stock' && <Field label="Batch Reference" value={formData.reference} onChange={(v: string) => setFormData({...formData, reference: v})} />}
                </>
              )}
            </div>

            {isMultiItemView && (
              <div className="space-y-6">
                <h4 className="text-[10px] font-black text-mozart uppercase tracking-widest border-l-2 border-mozart pl-3">Asset Allocation ({selectedItemIds.length})</h4>
                <div className="bg-[#10141e] rounded-[24px] border border-white/[0.04] p-5 space-y-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" />
                      <input type="text" placeholder="Filter item registry..." value={itemPickerSearch} onChange={(e) => setItemPickerSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-[#080b12] border border-white/[0.04] rounded-xl text-xs font-black uppercase outline-none text-stone-150 focus:border-mozart/50 focus:ring-4 focus:ring-mozart/5" />
                    </div>
                    <button type="button" onClick={() => setItemSortDir(d => d === 'asc' ? 'desc' : 'asc')} className="p-2.5 bg-[#080b12] border border-white/[0.04] rounded-xl text-stone-400 hover:text-mozart hover:border-mozart/30 transition-all shadow-sm" title={`Sort ${itemSortDir === 'asc' ? 'Z-A' : 'A-Z'}`}>
                      {itemSortDir === 'asc' ? <SortAsc size={16} /> : <SortDesc size={16} />}
                    </button>
                  </div>
                  <div className="max-h-[250px] overflow-y-auto custom-scrollbar pr-2 space-y-2">
                    {sortedAndFilteredPickerItems.map((item: Item) => {
                      const isSelected = selectedItemIds.includes(item.id);
                      const qty = (formData.items || []).find((i: any) => i.itemId === item.id)?.quantity || 0;
                      return (
                        <div key={item.id} className={`flex items-center gap-4 p-2.5 rounded-xl border transition-all ${isSelected ? 'bg-white/[0.02] border-mozart/30 shadow-sm' : 'bg-[#080b12]/50 border-transparent hover:bg-white/[0.01] hover:border-white/[0.04]'}`}>
                          <button type="button" onClick={() => toggleItem(item)} className={`transition-transform duration-100 active:scale-90 ${isSelected ? 'text-mozart' : 'text-stone-600'}`}>{isSelected ? <CheckSquare size={18} /> : <Square size={18} />}</button>
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleItem(item)}>
                            <p className="text-[11px] font-black text-white uppercase truncate leading-tight">{item.name}</p>
                            <p className="text-[8px] font-bold text-stone-500 uppercase truncate mt-0.5">{item.description || 'No Description'}</p>
                          </div>
                          {isSelected && (
                            <input 
                              type="number" 
                              min="1" 
                              required
                              value={qty} 
                              onChange={(e) => updateItemQty(item.id, parseInt(e.target.value) || 0)} 
                              className="w-20 px-2 py-1.5 bg-[#080b12] border border-white/[0.04] rounded-lg text-center text-xs font-black text-mozart outline-none focus:border-mozart/50" 
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="pt-6 border-t border-white/[0.04]">
            <button type="submit" className="w-full py-4.5 bg-gradient-to-r from-mozart to-[#0b766e] text-white rounded-[20px] font-black uppercase text-xs tracking-widest shadow-lg shadow-mozart/10 border border-white/10 hover:brightness-110 active:scale-[0.99] transition-all">
              Authorize & Sync Entry
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

const Field = ({ label, value, onChange, type = "text", placeholder = "" }: any) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">{label}</label>
    <input 
      required 
      type={type} 
      value={value || ''} 
      onChange={(e) => onChange(e.target.value)} 
      placeholder={placeholder} 
      className="w-full px-4 py-3 bg-[#10141e] border border-white/[0.04] rounded-xl text-sm font-bold text-white outline-none focus:border-mozart/50 focus:ring-4 focus:ring-mozart/5 transition-all placeholder:text-stone-700" 
    />
  </div>
);

const Select = ({ label, options, value, onChange }: any) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">{label}</label>
    <div className="relative">
      <select 
        required 
        value={value || ''} 
        onChange={(e) => onChange(e.target.value)} 
        className="w-full px-4 py-3 bg-[#10141e] border border-white/[0.04] rounded-xl text-sm font-bold text-white outline-none focus:border-mozart/50 focus:ring-4 focus:ring-mozart/5 transition-all cursor-pointer appearance-none"
      >
        <option value="" className="bg-[#10141e] text-stone-500">Select {label}</option>
        {(options || []).map((opt: any) => (
          <option key={opt.id} value={opt.id} className="bg-[#10141e] text-stone-150 font-bold">{opt.name}</option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
    </div>
  </div>
);

export default PanelModule;
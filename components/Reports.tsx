
import React, { useState, useMemo } from 'react';
import { Calendar, Hash, LayoutGrid, Filter, ArrowUpDown, PieChart, Table as TableIcon, Download } from 'lucide-react';
import { LoadingEntry, Party, EntryStatus } from '../types';
import * as XLSX from 'xlsx';

interface ReportsProps {
  entries: LoadingEntry[];
  parties: Party[];
}

type ReportView = 'standard' | 'pivot';

const Reports: React.FC<ReportsProps> = ({ entries, parties }) => {
  const [view, setView] = useState<ReportView>('standard');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [filterStatus, setFilterStatus] = useState<string>('All Status');

  // Pivot States
  const [groupBy, setGroupBy] = useState<keyof LoadingEntry>('partyName');
  const [pivotValue, setPivotValue] = useState<'quantity' | 'trips'>('quantity');

  const setMonthRange = (monthOffset: number) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const matchStart = !startDate || e.date >= startDate;
      const matchEnd = !endDate || e.date <= endDate;
      const matchStatus = filterStatus === 'All Status' || e.status === filterStatus;
      return matchStart && matchEnd && matchStatus;
    });
  }, [entries, startDate, endDate, filterStatus]);

  const partyData = useMemo(() => {
    return parties.map(party => {
      const partyEntries = filteredEntries.filter(e => e.partyId === party.id);
      return { id: party.id, name: party.name, quantity: partyEntries.reduce((sum, e) => sum + e.quantity, 0), count: partyEntries.length };
    }).filter(p => p.count > 0 || p.quantity > 0).sort((a, b) => b.quantity - a.quantity);
  }, [filteredEntries, parties]);

  const pivotData = useMemo(() => {
    const groups: Record<string, { label: string, quantity: number, trips: number }> = {};
    filteredEntries.forEach(entry => {
      const key = String(entry[groupBy]);
      if (!groups[key]) groups[key] = { label: key, quantity: 0, trips: 0 };
      groups[key].quantity += entry.quantity;
      groups[key].trips += 1;
    });
    return Object.values(groups).sort((a, b) => b[pivotValue === 'quantity' ? 'quantity' : 'trips'] - a[pivotValue === 'quantity' ? 'quantity' : 'trips']);
  }, [filteredEntries, groupBy, pivotValue]);

  const grandTotals = useMemo(() => partyData.reduce((acc, curr) => ({ quantity: acc.quantity + curr.quantity, count: acc.count + curr.count }), { quantity: 0, count: 0 }), [partyData]);

  const handleExport = (data: any[], fileName: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">Analytics & Reports</h2>
          <p className="text-stone-500 text-xs mt-0.5 font-medium tracking-wide">Aggregate performance analysis and customized loading metrics.</p>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => setView('standard')} 
             className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${view === 'standard' ? 'bg-black text-white' : 'bg-white border border-stone-200 text-stone-400'}`}
           >
             <TableIcon size={14} /> Party Summary
           </button>
           <button 
             onClick={() => setView('pivot')} 
             className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${view === 'pivot' ? 'bg-black text-white' : 'bg-white border border-stone-200 text-stone-400'}`}
           >
             <PieChart size={14} /> Pivot Report
           </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-stone-200 p-4 md:p-6">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-end justify-between gap-6">
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-4 flex-1">
            <div className="space-y-1.5 flex-1">
              <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-1">Date Range</label>
              <div className="flex items-center gap-2">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="flex-1 px-3 md:px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold outline-none" />
                <span className="text-stone-300 text-[10px] font-black">TO</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="flex-1 px-3 md:px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold outline-none" />
              </div>
            </div>
            <div className="space-y-1.5 min-w-[120px]">
              <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-1">Status Filter</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold outline-none">
                <option>All Status</option>
                {Object.values(EntryStatus).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex gap-2 mb-0.5">
              <button onClick={() => setMonthRange(0)} className="flex-1 sm:flex-none px-3 py-2 bg-stone-50 border border-stone-100 rounded-xl text-[9px] font-black uppercase tracking-widest text-stone-400 hover:text-black hover:border-stone-200 transition-all">This Month</button>
              <button onClick={() => setMonthRange(-1)} className="flex-1 sm:flex-none px-3 py-2 bg-stone-50 border border-stone-100 rounded-xl text-[9px] font-black uppercase tracking-widest text-stone-400 hover:text-black hover:border-stone-200 transition-all">Last Month</button>
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-start gap-6 px-6 py-3 bg-stone-50 rounded-2xl border border-stone-100">
             <div>
               <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest leading-none mb-1">Total Quantity</p>
               <p className="text-xl font-black text-black leading-none">{grandTotals.quantity.toLocaleString()}</p>
             </div>
             <button 
               onClick={() => handleExport(view === 'standard' ? partyData : pivotData, `Report_${view}`)}
               className="p-3 bg-white border border-stone-200 rounded-xl text-stone-400 hover:text-black hover:border-black hover:bg-stone-50 transition-all shadow-sm"
               title="Export Current View"
             >
               <Download size={18} />
             </button>
          </div>
        </div>
      </div>

      {view === 'standard' ? (
        <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-x-auto animate-in fade-in duration-300">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead>
              <tr className="bg-stone-50/50 border-b border-stone-200">
                <th className="px-4 md:px-8 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">Partner Identity</th>
                <th className="px-4 md:px-8 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest text-center">Trip Count</th>
                <th className="px-4 md:px-8 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest text-right">Aggregate Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {partyData.map((item) => (
                <tr key={item.id} className="hover:bg-stone-50/50 transition-colors group">
                  <td className="px-4 md:px-8 py-3"><div className="flex items-center gap-2 md:gap-3"><div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-400 font-black text-xs group-hover:bg-black group-hover:text-white transition-all">{item.name.charAt(0)}</div><span className="text-xs md:text-sm font-black text-stone-800 truncate max-w-[120px] md:max-w-none">{item.name}</span></div></td>
                  <td className="px-4 md:px-8 py-3 text-center"><span className="px-2 md:px-3 py-1 bg-stone-50 rounded-lg text-[10px] md:text-xs font-black text-stone-500">{item.count}</span></td>
                  <td className="px-4 md:px-8 py-3 text-right font-black text-stone-900 text-sm md:text-base">{item.quantity.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-black text-white">
              <tr>
                <td className="px-4 md:px-8 py-6 font-black uppercase tracking-widest text-[10px] md:text-xs">Grand Consolidated Totals</td>
                <td className="px-4 md:px-8 py-6 text-center text-base md:text-lg font-black">{grandTotals.count}</td>
                <td className="px-4 md:px-8 py-6 text-right text-lg md:text-xl font-black text-white">{grandTotals.quantity.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4">
                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Group Data By</label>
                <div className="flex flex-wrap gap-2">
                   {[
                     { label: 'Party', key: 'partyName' },
                     { label: 'Date', key: 'date' },
                     { label: 'Status', key: 'status' },
                     { label: 'Truck', key: 'truckNo' }
                   ].map(opt => (
                     <button 
                        key={opt.key}
                        onClick={() => setGroupBy(opt.key as any)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${groupBy === opt.key ? 'bg-black border-black text-white' : 'bg-white border-stone-200 text-stone-400'}`}
                      >
                       {opt.label}
                     </button>
                   ))}
                </div>
             </div>
             <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4">
                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Aggregate Values</label>
                <div className="flex gap-2">
                   {[
                     { label: 'Total Quantity', key: 'quantity' },
                     { label: 'Trip Count', key: 'trips' }
                   ].map(opt => (
                     <button 
                        key={opt.key}
                        onClick={() => setPivotValue(opt.key as any)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${pivotValue === opt.key ? 'bg-black border-black text-white' : 'bg-white border-stone-200 text-stone-400'}`}
                      >
                       {opt.label}
                     </button>
                   ))}
                </div>
             </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50/50 border-b border-stone-200">
                  <th className="px-8 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">
                    {groupBy.replace('Name', '').toUpperCase()}
                  </th>
                  <th className="px-8 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest text-center">
                    Trips
                  </th>
                  <th className="px-8 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest text-right">
                    Quantity
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {pivotData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-stone-50/50 transition-colors group">
                    <td className="px-8 py-3 font-black text-stone-800 text-sm uppercase tracking-tight">{item.label}</td>
                    <td className="px-8 py-3 text-center text-sm font-bold text-stone-500">{item.trips}</td>
                    <td className="px-8 py-3 text-right font-black text-stone-900">{item.quantity.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;


import React, { useState, useMemo } from 'react';
import { Calendar, Hash, LayoutGrid, Filter, ArrowUpDown } from 'lucide-react';
import { LoadingEntry, Party, EntryStatus } from '../types';

interface PartyWiseQuantityProps {
  entries: LoadingEntry[];
  parties: Party[];
}

const PartyWiseQuantity: React.FC<PartyWiseQuantityProps> = ({ entries, parties }) => {
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [filterStatus, setFilterStatus] = useState<string>('All Status');

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

  const grandTotals = useMemo(() => partyData.reduce((acc, curr) => ({ quantity: acc.quantity + curr.quantity, count: acc.count + curr.count }), { quantity: 0, count: 0 }), [partyData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">Party-wise Quantity Report</h2>
          <p className="text-stone-500 text-xs mt-0.5 font-medium tracking-wide">Aggregate performance analysis by distribution partner.</p>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setMonthRange(0)} className="px-4 py-2 bg-white border border-stone-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-stone-500 hover:bg-stone-50 transition-all">This Month</button>
           <button onClick={() => setMonthRange(-1)} className="px-4 py-2 bg-white border border-stone-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-stone-500 hover:bg-stone-50 transition-all">Last Month</button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-stone-200 p-6">
        <div className="flex flex-col lg:flex-row items-end justify-between gap-6">
          <div className="flex flex-wrap items-end gap-4 flex-1">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-1">Date Range</label>
              <div className="flex items-center gap-2">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold outline-none" />
                <span className="text-stone-300 text-[10px] font-black">TO</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold outline-none" />
              </div>
            </div>
            <div className="space-y-1.5 min-w-[150px]">
              <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-1">Status Filter</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold outline-none">
                <option>All Status</option>
                {Object.values(EntryStatus).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-6 px-6 py-3 bg-stone-50 rounded-2xl border border-stone-100">
             <div>
               <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest leading-none mb-1">Active Partners</p>
               <p className="text-xl font-black text-stone-900 leading-none">{partyData.length}</p>
             </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-stone-50/50 border-b border-stone-200">
              <th className="px-8 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">Partner Identity</th>
              <th className="px-8 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest text-center">Trip Count</th>
              <th className="px-8 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest text-right">Aggregate Quantity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {partyData.map((item) => (
              <tr key={item.id} className="hover:bg-stone-50/50 transition-colors group">
                <td className="px-8 py-3"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-400 font-black text-xs group-hover:bg-mozart group-hover:text-white transition-all">{item.name.charAt(0)}</div><span className="text-sm font-black text-stone-800">{item.name}</span></div></td>
                <td className="px-8 py-3 text-center"><span className="px-3 py-1 bg-stone-50 rounded-lg text-xs font-black text-stone-500">{item.count}</span></td>
                <td className="px-8 py-3 text-right font-black text-stone-900 text-base">{item.quantity.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-black text-white">
            <tr>
              <td className="px-8 py-6 font-black uppercase tracking-widest text-xs">Grand Consolidated Totals</td>
              <td className="px-8 py-6 text-center text-lg font-black">{grandTotals.count}</td>
              <td className="px-8 py-6 text-right text-xl font-black text-white">{grandTotals.quantity.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default PartyWiseQuantity;

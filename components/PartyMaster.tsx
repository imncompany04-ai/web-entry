
import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Trash2, Edit2, MapPin, X, AlertTriangle, ChevronLeft, ChevronRight, Lock, Info, CheckCircle2, Loader2, Download, Upload, FileJson } from 'lucide-react';
import { Party, User, Permission } from '../types';
import * as XLSX from 'xlsx';

interface PartyMasterProps {
  currentUser: User;
  parties: Party[];
  onAddParty: (party: Omit<Party, 'id' | 'updatedAt'>) => Promise<void>;
  onUpdateParty: (id: string, updates: Partial<Party>) => Promise<void>;
  onDeleteParty: (id: string) => void;
}

const PartyMaster: React.FC<PartyMasterProps> = ({ currentUser, parties, onAddParty, onUpdateParty, onDeleteParty }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [partyToDelete, setPartyToDelete] = useState<Party | null>(null);
  const [formData, setFormData] = useState({ name: '', location: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const hasAdmin = currentUser.rights.includes(Permission.ADMIN_ACCESS);
  
  const canViewScreen = hasAdmin || 
    currentUser.rights.includes(Permission.VIEW_PARTY_LIST) || 
    currentUser.rights.includes(Permission.MANAGE_PARTIES) || 
    currentUser.rights.includes(Permission.ADD_PARTY);

  const canViewList = hasAdmin || 
    currentUser.rights.includes(Permission.VIEW_PARTY_LIST) || 
    currentUser.rights.includes(Permission.MANAGE_PARTIES);

  const canAdd = hasAdmin || currentUser.rights.includes(Permission.ADD_PARTY);
  const canManage = hasAdmin || currentUser.rights.includes(Permission.MANAGE_PARTIES);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  if (!canViewScreen) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-6 bg-white rounded-[40px] border border-stone-200">
        <div className="w-20 h-20 bg-stone-50 rounded-[32px] flex items-center justify-center text-stone-200"><Lock size={40} /></div>
        <div>
          <h4 className="text-xl font-black text-stone-900 mb-2">Access Denied</h4>
          <p className="text-stone-400 text-sm max-w-sm">You do not have permission to access the Party Master. Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  const filteredParties = parties.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const totalPages = Math.ceil(filteredParties.length / pageSize);
  const paginatedParties = filteredParties.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSave = async () => {
    if (!formData.name || isSaving) return;
    setIsSaving(true);
    try {
      if (editingParty) {
        await onUpdateParty(editingParty.id, { name: formData.name, location: formData.location });
      } else {
        await onAddParty({ name: formData.name, location: formData.location });
      }
      
      setIsModalOpen(false);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (e) {
      console.error(e);
      alert("Error saving party. Please check your connection.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    const dataToExport = parties.map(({ name, location }) => ({
      "Party Name": name,
      "Location": location || "N/A"
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Parties");
    XLSX.writeFile(workbook, `Parties_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const downloadSample = () => {
    const sampleData = [
      { "Party Name": "Example Party A", "Location": "Mumbai" },
      { "Party Name": "Example Party B", "Location": "Delhi" }
    ];
    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sample");
    XLSX.writeFile(workbook, "Party_Import_Sample.xlsx");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          const name = row["Party Name"];
          const location = row["Location"] || "";
          if (name) {
            await onAddParty({ name: String(name), location: String(location) });
            count++;
          }
        }
        alert(`Successfully imported ${count} parties.`);
      } catch (err) {
        console.error(err);
        alert("Error importing file. Ensure the format is correct (Headers: 'Party Name', 'Location').");
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-8 max-w-[1500px] mx-auto relative pb-10">
      {showSuccessToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[120] bg-gradient-to-r from-mozart to-teal-600 text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 border border-white/10">
          <CheckCircle2 size={20} />
          <span className="text-sm font-black uppercase tracking-widest">Party Registered Successfully</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-stone-900 tracking-tight">Party Master</h2>
          <p className="text-stone-500 text-sm mt-1">Manage logistics partners and distribution centers.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {hasAdmin && (
            <>
              <button 
                onClick={handleExport}
                className="bg-stone-50 border border-stone-200 text-stone-700 active:scale-95 px-4 py-3 rounded-xl font-black flex items-center gap-2 uppercase tracking-widest text-[10px] shadow-sm hover:bg-stone-100 hover:text-black transition-all"
                title="Export Parties to Excel"
              >
                <Download size={14} /> Export
              </button>
              <div className="relative group">
                <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".xlsx, .xls, .csv" />
                <button 
                   onClick={() => fileInputRef.current?.click()}
                   className="bg-stone-50 border border-stone-200 text-stone-700 active:scale-95 px-4 py-3 rounded-xl font-black flex items-center gap-2 uppercase tracking-widest text-[10px] shadow-sm hover:bg-stone-100 hover:text-black transition-all"
                  title="Import Parties from Excel"
                >
                  <Upload size={14} /> Import
                </button>
              </div>
              <button 
                onClick={downloadSample}
                className="bg-stone-50 border border-stone-200 text-stone-500 active:scale-95 px-4 py-3 rounded-xl font-black flex items-center gap-2 uppercase tracking-widest text-[10px] shadow-sm hover:bg-stone-100 hover:text-black transition-all"
                title="Download Sample File"
              >
                <FileJson size={14} /> Sample
              </button>
            </>
          )}
          {canAdd && (
            <button 
              onClick={() => {
                setEditingParty(null);
                setFormData({ name: '', location: '' });
                setIsModalOpen(true);
              }} 
              className="bg-black hover:bg-stone-900 text-white px-6 py-3 rounded-xl font-black flex items-center gap-2 uppercase tracking-widest text-[10px] shadow-md border border-black transition-transform active:scale-95"
            >
              <Plus size={16} /> New Party
            </button>
          )}
        </div>
      </div>

      {canViewList ? (
        <div className="bg-white rounded-[32px] shadow-sm border border-stone-200 overflow-hidden animate-in fade-in duration-500">
          <div className="p-6 border-b border-stone-200 bg-stone-50/55">
            <div className="relative">
              <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input 
                type="text" 
                placeholder="Search parties..." 
                value={searchTerm} 
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                className="w-full pl-14 pr-6 py-4 bg-white border border-stone-200 text-stone-900 rounded-2xl text-base font-bold focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-all placeholder-stone-400" 
              />
            </div>
          </div>

          <div className="divide-y divide-stone-150 grid grid-cols-1 sm:block">
            {paginatedParties.length > 0 ? paginatedParties.map(party => (
              <div key={party.id} className="p-4 md:p-6 flex items-center justify-between hover:bg-stone-50/50 transition-colors group">
                <div className="flex items-center gap-3 md:gap-5">
                  <div className="w-10 h-10 md:w-14 md:h-14 bg-stone-50 border border-stone-200 rounded-xl md:rounded-2xl flex items-center justify-center text-black font-black text-lg md:text-2xl group-hover:bg-black group-hover:text-white transition-all">{party.name.charAt(0)}</div>
                  <div className="min-w-0">
                    <h4 className="font-black text-stone-900 text-sm md:text-lg truncate">{party.name}</h4>
                    <div className="flex items-center gap-2 text-[8px] md:text-[10px] font-black text-stone-500 uppercase tracking-widest mt-0.5 md:mt-1 truncate"><MapPin size={10} className="md:w-3 md:h-3 text-black" /> {party.location || 'Unknown Location'}</div>
                  </div>
                </div>
                <div className="flex gap-1 md:gap-2 shrink-0">
                  {canManage && (
                    <>
                      <button onClick={() => { setEditingParty(party); setFormData({ name: party.name, location: party.location || '' }); setIsModalOpen(true); }} className="p-2 md:p-3 text-stone-450 hover:text-black hover:bg-stone-100 rounded-xl md:rounded-2xl transition-all"><Edit2 size={18} /></button>
                      <button onClick={() => setPartyToDelete(party)} className="p-2 md:p-3 text-stone-450 hover:text-red-600 hover:bg-red-50 rounded-xl md:rounded-2xl transition-all"><Trash2 size={18} /></button>
                    </>
                  )}
                </div>
              </div>
            )) : (
              <div className="px-6 py-10 text-center text-stone-500 text-sm italic col-span-full">
                No parties found.
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="p-6 bg-stone-50/55 border-t border-stone-200 flex items-center justify-between">
              <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Page {currentPage} of {totalPages}</p>
              <div className="flex gap-2">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2.5 bg-white border border-stone-200 rounded-xl disabled:opacity-20 text-stone-500 hover:text-black hover:bg-stone-50 transition-all"><ChevronLeft size={20} /></button>
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-2.5 bg-white border border-stone-200 rounded-xl disabled:opacity-20 text-stone-500 hover:text-black hover:bg-stone-50 transition-all"><ChevronRight size={20} /></button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-[32px] p-16 border border-dashed border-stone-300 text-center flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="w-16 h-16 bg-stone-50 border border-stone-200 rounded-full flex items-center justify-center text-stone-400">
            <Info size={32} />
          </div>
          <div>
            <h4 className="text-xl font-black text-stone-900">Directory Hidden</h4>
            <p className="text-stone-500 text-sm max-w-sm mx-auto mt-2">
              You have permission to register new distribution partners, but viewing the existing party directory is restricted by your system rights.
            </p>
          </div>
          <button 
            onClick={() => {
              setEditingParty(null);
              setFormData({ name: '', location: '' });
              setIsModalOpen(true);
            }}
            className="mt-4 px-6 py-2.5 bg-black hover:bg-stone-900 text-white font-bold rounded-xl text-xs uppercase tracking-widest transition-all shadow-md active:scale-95"
          >
            Go to New Party Form
          </button>
        </div>
      )}

      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
          <div className="bg-white border border-stone-200 rounded-[40px] shadow-2xl w-full max-w-md p-10 animate-in zoom-in duration-200 text-stone-900">
            <h3 className="text-2xl font-black text-stone-900 mb-8">{editingParty ? 'Update Party' : 'Add New Party'}</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Company Name</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-5 py-4 bg-stone-50 border border-stone-200 text-stone-900 rounded-2xl text-base font-bold outline-none focus:border-black focus:ring-4 focus:ring-black/5 transition-all" placeholder="e.g. Royal Logistics" disabled={isSaving} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Operational Base</label>
                <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="w-full px-5 py-4 bg-stone-50 border border-stone-200 text-stone-900 rounded-2xl text-base font-bold outline-none focus:border-black focus:ring-4 focus:ring-black/5 transition-all" placeholder="e.g. Mumbai Hub" disabled={isSaving} />
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-stone-500 hover:text-black transition-colors" disabled={isSaving}>Cancel</button>
                <button 
                  onClick={handleSave} 
                  disabled={isSaving || !formData.name}
                  className="flex-2 px-10 py-4 bg-black hover:bg-stone-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-md disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  {isSaving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : 'Save Party'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {partyToDelete && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
          <div className="bg-white border border-stone-200 rounded-[40px] shadow-2xl p-10 w-full max-w-sm text-center text-stone-900">
            <div className="w-20 h-20 bg-red-50 text-red-600 border border-red-200 rounded-[28px] flex items-center justify-center mx-auto mb-6"><AlertTriangle size={40} /></div>
            <h4 className="text-2xl font-black text-stone-900 mb-2">Delete Party?</h4>
            <p className="text-stone-500 text-sm mb-8">This will permanently remove "{partyToDelete.name}" from the database. This action is irreversible.</p>
            <div className="space-y-3">
              <button onClick={() => { onDeleteParty(partyToDelete.id); setPartyToDelete(null); }} className="w-full py-4 bg-red-600 hover:bg-red-750 text-white font-black rounded-2xl uppercase tracking-widest text-xs shadow-sm active:scale-95 transition-all">Yes, Delete Permanently</button>
              <button onClick={() => setPartyToDelete(null)} className="w-full py-4 bg-stone-50 text-stone-500 hover:bg-stone-100 hover:text-stone-900 font-black rounded-2xl border border-stone-200 uppercase tracking-widest text-xs active:scale-95 transition-all">No, Keep Record</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default PartyMaster;

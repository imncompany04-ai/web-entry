
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, ChevronDown, MapPin, MessageSquare, Info } from 'lucide-react';
import { EntryStatus, Party, LoadingEntry } from '../types';

interface EntryModalProps {
  parties: Party[];
  editingEntry?: LoadingEntry | null;
  onClose: () => void;
  onAdd: (entry: Omit<LoadingEntry, 'id' | 'srNo' | 'entryTime' | 'date'>) => void;
  onUpdate: (id: string, updates: Partial<LoadingEntry>) => void;
}

/**
 * Validates the vehicle pattern: 2 Letters, 2 Numbers, 2 Letters, 4 Numbers
 */
const formatVehicleNumber = (val: string) => {
  // Remove non-alphanumeric characters and force uppercase
  let cleaned = val.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  
  // Cut to max 10 chars
  cleaned = cleaned.substring(0, 10);
  
  return cleaned;
};

export const EntryModal: React.FC<EntryModalProps> = ({ parties, editingEntry, onClose, onAdd, onUpdate }) => {
  const [formData, setFormData] = useState({
    partyId: '',
    status: EntryStatus.PENDING,
    truckNo: '',
    tempoNumber: '',
    allowedWeight: '',
    quantity: '',
    remarks: ''
  });

  const [partySearch, setPartySearch] = useState('');
  const [isPartyListOpen, setIsPartyListOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isEdit = !!editingEntry;

  useEffect(() => {
    if (editingEntry) {
      setFormData({
        partyId: editingEntry.partyId,
        status: editingEntry.status,
        truckNo: editingEntry.truckNo,
        tempoNumber: editingEntry.tempoNumber,
        allowedWeight: editingEntry.allowedWeight.toString(),
        quantity: editingEntry.quantity.toString(),
        remarks: editingEntry.remarks || ''
      });
      setPartySearch(editingEntry.partyName);
    }
  }, [editingEntry]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsPartyListOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredParties = parties.filter(p => 
    p.name.toLowerCase().includes(partySearch.toLowerCase()) ||
    (p.location && p.location.toLowerCase().includes(partySearch.toLowerCase()))
  );

  const shouldShowList = isPartyListOpen && !isEdit && partySearch.trim().length > 0;

  const handleSelectParty = (party: Party) => {
    setFormData({ ...formData, partyId: party.id });
    setPartySearch(party.name);
    setIsPartyListOpen(false);
  };

  const handleVehicleChange = (field: 'truckNo' | 'tempoNumber', value: string) => {
    setFormData(prev => ({ ...prev, [field]: formatVehicleNumber(value) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const party = parties.find(p => p.id === formData.partyId);
    if (!party) {
      alert("Please select a valid party from the search list.");
      return;
    }

    if (editingEntry) {
      onUpdate(editingEntry.id, {
        status: formData.status,
        quantity: parseInt(formData.quantity) || 0,
        remarks: formData.remarks
      });
    } else {
      onAdd({
        partyId: formData.partyId,
        partyName: party.name,
        status: formData.status,
        truckNo: formData.truckNo,
        tempoNumber: formData.tempoNumber,
        allowedWeight: parseFloat(formData.allowedWeight) || 0,
        quantity: parseInt(formData.quantity) || 0,
        remarks: formData.remarks
      });
    }
    onClose();
  };

  useEffect(() => {
    // Add scroll lock on body
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-all duration-300"
        onClick={onClose}
      />
      
      <div className="relative bg-white border border-stone-200 rounded-[32px] shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden transform transition-all animate-in fade-in zoom-in duration-200 text-stone-900">
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-200 shrink-0">
          <h3 className="text-xl font-black text-stone-900 uppercase tracking-wider">
            {isEdit ? 'Edit Loading Entry' : 'New Loading Entry'}
          </h3>
          <button 
            onClick={onClose}
            className="p-2 text-stone-500 hover:text-black rounded-lg hover:bg-stone-50 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5 relative col-span-1 sm:col-span-2" ref={dropdownRef}>
              <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1">Party Search {isEdit ? '' : '*'}</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
                <input 
                  type="text"
                  disabled={isEdit}
                  placeholder="Type name or location to find party..."
                  value={partySearch}
                  onFocus={() => !isEdit && setIsPartyListOpen(true)}
                  onChange={(e) => {
                    setPartySearch(e.target.value);
                    if (!isEdit) setIsPartyListOpen(true);
                  }}
                  className="w-full pl-10 pr-10 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-all placeholder-stone-400 disabled:opacity-50 text-stone-900"
                />
                {!isEdit && (
                  <ChevronDown 
                    size={16} 
                    className={`absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 transition-transform ${isPartyListOpen ? 'rotate-180' : ''}`} 
                  />
                )}
              </div>
              
              {shouldShowList && (
                <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-white border border-stone-200 rounded-2xl shadow-2xl max-h-64 overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2 duration-200">
                  {filteredParties.length > 0 ? (
                    filteredParties.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectParty(p)}
                        className="w-full text-left px-5 py-4 text-sm text-stone-600 hover:bg-stone-50 border-b border-stone-100 last:border-none transition-colors group"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-stone-900 group-hover:text-black transition-colors">{p.name}</span>
                            <div className="flex items-center gap-1.5 mt-1 text-[10px] font-black uppercase tracking-widest text-[#6B7280]">
                              <MapPin size={10} className="text-black" />
                              {p.location || 'Location Not Set'}
                            </div>
                          </div>
                          <div className="shrink-0 text-[9px] font-black uppercase tracking-widest bg-stone-100 border border-stone-200 px-2.5 py-1 rounded-md text-[#374151] opacity-0 group-hover:opacity-100 transition-all">Select</div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-5 py-8 text-center text-stone-500">
                      <p className="text-sm italic">No matching partners found</p>
                      <p className="text-[10px] text-stone-400 uppercase tracking-widest mt-1">Try another keyword</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1">Loading Status *</label>
              <select 
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as EntryStatus })}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-all text-stone-900"
              >
                {Object.values(EntryStatus).map(status => (
                  <option key={status} value={status} className="bg-white text-stone-900">{status}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 md:truncate flex gap-1">
                Truck No. {!isEdit && <span className="text-red-600">*</span>}
              </label>
              <input 
                disabled={isEdit}
                required={!isEdit}
                type="text"
                maxLength={10}
                placeholder="RJ14GN8600"
                value={formData.truckNo}
                onChange={(e) => handleVehicleChange('truckNo', e.target.value)}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-all text-stone-900 placeholder:text-stone-400 disabled:opacity-50"
              />
              {!isEdit && (
                <p className="text-[9px] font-black text-stone-500 uppercase tracking-widest flex items-center gap-1 mt-1">
                  <Info size={10} className="text-stone-600" /> Pattern: 2L-2N-2L-4N
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 md:truncate">Tempo Number</label>
              <input 
                disabled={isEdit}
                type="text"
                maxLength={10}
                placeholder="TMP001"
                value={formData.tempoNumber}
                onChange={(e) => handleVehicleChange('tempoNumber', e.target.value)}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-all text-stone-900 placeholder:text-stone-400 disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 select-none">Allowed Weight</label>
              <input 
                disabled={isEdit}
                required={!isEdit}
                type="number"
                step="0.01"
                placeholder="e.g. 24.20"
                value={formData.allowedWeight}
                onChange={(e) => setFormData({ ...formData, allowedWeight: e.target.value })}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-all text-stone-900 disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5 col-span-1 sm:col-span-2">
              <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 select-none">Actual Loading Quantity *</label>
              <input 
                required
                type="number"
                placeholder="e.g. 765"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="w-full px-4 py-3.5 bg-stone-50 border border-stone-300 rounded-xl text-base font-black text-black focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5 col-span-1 sm:col-span-2">
              <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                <MessageSquare size={14} className="text-black" />
                Remarks (Optional)
              </label>
              <textarea 
                rows={2}
                placeholder="Any additional notes or loading details..."
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-all text-stone-900 placeholder:text-stone-400 resize-none"
              />
            </div>
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-stone-200 bg-stone-50 shrink-0">
          <button 
            type="button"
            onClick={onClose}
            className="px-6 py-3 text-xs font-black uppercase tracking-widest text-stone-500 hover:text-black transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={(e) => {
              // Manually trigger form submit since button is outside form
              const form = (e.target as HTMLElement).closest('.relative')?.querySelector('form');
              if (form) form.requestSubmit();
            }}
            className="px-8 py-3.5 bg-black hover:bg-stone-900 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-md border border-black active:scale-95 transition-all"
          >
            {isEdit ? 'Save Changes' : 'Confirm Entry'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EntryModal;


import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { EntryStatus, Party, LoadingEntry } from '../types';

interface AddEntryModalProps {
  parties: Party[];
  onClose: () => void;
  onAdd: (entry: Omit<LoadingEntry, 'id' | 'srNo' | 'entryTime' | 'date'>) => void;
}

const AddEntryModal: React.FC<AddEntryModalProps> = ({ parties, onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    partyId: '',
    status: EntryStatus.PENDING,
    truckNo: '',
    tempoNumber: '',
    allowedWeight: '',
    quantity: ''
  });

  useEffect(() => {
    // Add scroll lock on body
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const party = parties.find(p => p.id === formData.partyId);
    if (!party) return;

    onAdd({
      partyId: formData.partyId,
      partyName: party.name,
      status: formData.status,
      truckNo: formData.truckNo,
      tempoNumber: formData.tempoNumber,
      allowedWeight: parseFloat(formData.allowedWeight) || 0,
      quantity: parseInt(formData.quantity) || 0
    });
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-all duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-white border border-stone-200 rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden transform transition-all animate-in fade-in zoom-in duration-200 text-stone-900">
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-200">
          <h3 className="text-xl font-black text-stone-900 uppercase tracking-wider">Add New Entry</h3>
          <button 
            onClick={onClose}
            className="p-2 text-stone-500 hover:text-black rounded-lg hover:bg-stone-50 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5 col-span-1 sm:col-span-2">
              <label className="text-[10px] font-black text-stone-450 uppercase tracking-widest ml-1">Party Name *</label>
              <select 
                required
                value={formData.partyId}
                onChange={(e) => setFormData({ ...formData, partyId: e.target.value })}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold focus:border-black focus:ring-4 focus:ring-black/5 transition-all text-stone-900 placeholder-stone-400 outline-none"
              >
                <option value="" className="text-stone-500 bg-white">Select distribution party</option>
                {parties.map(p => (
                  <option key={p.id} value={p.id} className="text-stone-900 bg-white font-bold">{p.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 col-span-1 sm:col-span-2">
              <label className="text-[10px] font-black text-stone-450 uppercase tracking-widest ml-1">Loading Status</label>
              <select 
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as EntryStatus })}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold focus:border-black focus:ring-4 focus:ring-black/5 transition-all text-stone-900 outline-none"
              >
                {Object.values(EntryStatus).map(status => (
                  <option key={status} value={status} className="text-stone-900 bg-white font-bold">{status}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-stone-450 uppercase tracking-widest ml-1 md:truncate">Truck No.</label>
              <input 
                type="text"
                placeholder="e.g. RJ14GN8600"
                value={formData.truckNo}
                onChange={(e) => setFormData({ ...formData, truckNo: e.target.value })}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold focus:border-black focus:ring-4 focus:ring-black/5 transition-all text-stone-900 outline-none placeholder:text-stone-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-stone-450 uppercase tracking-widest ml-1 md:truncate">Tempo Number</label>
              <input 
                type="text"
                placeholder="e.g. TMP001"
                value={formData.tempoNumber}
                onChange={(e) => setFormData({ ...formData, tempoNumber: e.target.value })}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold focus:border-black focus:ring-4 focus:ring-black/5 transition-all text-stone-900 outline-none placeholder:text-stone-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-stone-450 uppercase tracking-widest ml-1 select-none">Allowed Weight (MT) *</label>
              <input 
                required
                type="number"
                step="0.01"
                placeholder="e.g. 24.20"
                value={formData.allowedWeight}
                onChange={(e) => setFormData({ ...formData, allowedWeight: e.target.value })}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold focus:border-black focus:ring-4 focus:ring-black/5 transition-all text-stone-900 outline-none placeholder:text-stone-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-stone-450 uppercase tracking-widest ml-1 select-none">Box Quantity *</label>
              <input 
                required
                type="number"
                placeholder="e.g. 765"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold focus:border-black focus:ring-4 focus:ring-black/5 transition-all text-stone-900 outline-none placeholder:text-stone-400"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-8 pt-4 border-t border-stone-200">
            <button 
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-xs font-black uppercase tracking-widest text-stone-500 hover:text-black transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-8 py-3.5 bg-black hover:bg-stone-900 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-md border border-black active:scale-95 transition-all"
            >
              Create Entry
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default AddEntryModal;

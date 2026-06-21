
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Shield, UserPlus, Trash2, Edit2, CheckCircle2, Circle, X, Eye, EyeOff } from 'lucide-react';
import { User as UserType, Permission } from '../types';

interface UserMasterProps {
  currentUser: UserType;
  users: UserType[];
  setUsers: React.Dispatch<React.SetStateAction<UserType[]>>;
}

const UserMaster: React.FC<UserMasterProps> = ({ currentUser, users, setUsers }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<Partial<UserType>>({ username: '', name: '', password: '', role: 'Operator', rights: [Permission.VIEW_TODAY_ENTRIES] });
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const toggleRight = (permission: Permission) => {
    const currentRights = formData.rights || [];
    setFormData({ ...formData, rights: currentRights.includes(permission) ? currentRights.filter(r => r !== permission) : [...currentRights, permission] });
  };

  const handleSave = () => {
    if (!formData.username || !formData.password || !formData.name) return;
    const u = editingUser ? { ...editingUser, ...formData } : { id: Math.random().toString(36).substr(2, 9), ...formData };
    setUsers((prev: any) => editingUser ? prev.map((item: any) => item.id === u.id ? u : item) : [...prev, u]);
    setIsModalOpen(false);
  };

  const getPermissionLabel = (perm: Permission) => perm.replace(/_/g, ' ').toUpperCase();

  return (
    <div className="space-y-8">
      {deleteConfirm && createPortal(
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
            onClick={() => setDeleteConfirm(null)}
          />
          <div className="relative bg-white border border-stone-200 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] w-full max-w-sm overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200 p-6 text-stone-900 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <Trash2 size={22} className="shrink-0" />
              <h4 className="text-sm font-black uppercase tracking-wider text-red-600 font-bold mb-0 leading-none">Confirm Deletion</h4>
            </div>
            
            <p className="text-stone-605 text-xs font-semibold leading-relaxed">
              Are you sure you want to permanently delete staff member "{deleteConfirm.name}"? This will remove all their role permissions.
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
                  setUsers(prev => prev.filter(u => u.id !== deleteConfirm.id));
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

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-stone-900 tracking-tight">Staff Master</h2>
          <p className="text-stone-500 text-xs md:text-sm mt-1">Configure security and access protocols.</p>
        </div>
        <button 
          onClick={() => { setEditingUser(null); setShowPassword(false); setFormData({ username: '', name: '', password: '', role: 'Operator', rights: [Permission.VIEW_TODAY_ENTRIES] }); setIsModalOpen(true); }} 
          className="w-full sm:w-auto bg-black hover:bg-stone-900 text-white px-6 md:px-8 py-3 md:py-3.5 rounded-xl md:rounded-2xl font-black flex items-center justify-center gap-3 uppercase tracking-widest text-[10px] md:text-xs shadow-md border border-black active:scale-95 transition-all"
        >
          <UserPlus size={18} /> New Staff
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {users.map(user => (
          <div key={user.id} className="bg-white rounded-[24px] md:rounded-[32px] shadow-sm border border-stone-200 p-6 md:p-8 hover:border-black transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-stone-50 rounded-bl-[100px] pointer-events-none group-hover:bg-stone-100 transition-colors" />
            
            <div className="flex items-center gap-4 md:gap-5 mb-4 md:mb-6">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-stone-50 border border-stone-200 rounded-xl lg:rounded-2xl flex items-center justify-center text-black font-black text-xl md:text-2xl group-hover:bg-black group-hover:text-white transition-all">
                {user.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-stone-900 text-base md:text-lg truncate">{user.name}</h3>
                <p className="text-stone-500 text-[10px] md:text-xs font-bold truncate">@{user.username}</p>
                <span className="inline-block mt-1.5 px-2.5 py-0.5 bg-stone-50 border border-stone-200 text-stone-700 rounded-md text-[9px] font-bold uppercase tracking-widest">{user.role}</span>
              </div>
            </div>

            <div className="space-y-2 md:space-y-3 mb-6 md:mb-8">
              <p className="text-[9px] md:text-[10px] font-black text-stone-400 uppercase tracking-widest">Authorized Rights</p>
              <div className="flex flex-wrap gap-1.5 md:gap-2">
                {user.rights.slice(0, 5).map(r => (
                  <span key={r} className="px-2 md:px-3 py-1 bg-stone-50 border border-stone-200 text-[8px] md:text-[9px] font-black text-stone-700 rounded-lg uppercase tracking-tight">
                    {getPermissionLabel(r)}
                  </span>
                ))}
                {user.rights.length > 5 && (
                  <span className="px-2 md:px-3 py-1 bg-stone-100 text-[8px] md:text-[9px] font-black text-stone-500 uppercase tracking-tight">
                    +{user.rights.length - 5} More
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-1 md:gap-2 pt-4 border-t border-stone-150">
              <button 
                onClick={() => { setEditingUser(user); setShowPassword(false); setFormData({ ...user }); setIsModalOpen(true); }} 
                className="p-2 md:p-3 text-stone-500 hover:text-black hover:bg-stone-55 rounded-xl md:rounded-2xl transition-all"
              >
                <Edit2 size={18} />
              </button>
              <button 
                onClick={() => setDeleteConfirm({ id: user.id, name: user.name })} 
                className="p-2 md:p-3 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-xl md:rounded-2xl transition-all"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div 
            className="absolute inset-0" 
            onClick={() => setIsModalOpen(false)} 
          />
          <div className="relative bg-white border border-stone-200 rounded-[28px] md:rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-300 text-stone-900 max-h-[92vh] flex flex-col">
             {/* Modal Header */}
             <div className="px-6 py-5 md:px-10 md:py-6 border-b border-stone-100 flex items-center justify-between shrink-0">
                <h3 className="text-lg md:text-2xl font-black text-stone-900 tracking-tight">{editingUser ? 'Edit Staff' : 'Add Staff'}</h3>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="p-1.5 text-stone-400 hover:text-stone-900 rounded-lg hover:bg-stone-50 transition-colors"
                >
                  <X size={20} />
                </button>
             </div>

             {/* Modal Content Scrollable Area */}
             <div className="p-6 md:p-10 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 overflow-y-auto flex-1 min-h-0">
                <div className="space-y-4 md:space-y-6">
                   <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] md:text-[10px] font-black text-stone-450 uppercase tracking-widest ml-1 animate-pulse">Staff Name</label>
                        <input 
                          type="text" 
                          value={formData.name || ''} 
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                          className="w-full px-4 md:px-5 py-3 md:py-3.5 bg-stone-50 border border-stone-200 text-stone-900 rounded-xl md:rounded-2xl font-bold outline-none focus:border-black focus:ring-4 focus:ring-black/5 transition-all text-sm md:text-base" 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] md:text-[10px] font-black text-stone-450 uppercase tracking-widest ml-1">Username</label>
                        <input 
                          type="text" 
                          value={formData.username || ''} 
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })} 
                          className="w-full px-4 md:px-5 py-3 md:py-3.5 bg-stone-50 border border-stone-200 text-stone-900 rounded-xl md:rounded-2xl font-bold outline-none focus:border-black focus:ring-4 focus:ring-black/5 transition-all text-sm md:text-base" 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] md:text-[10px] font-black text-stone-450 uppercase tracking-widest ml-1">Password</label>
                        <div className="relative">
                          <input 
                            type={showPassword ? "text" : "password"} 
                            value={formData.password || ''} 
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })} 
                            className="w-full px-4 md:px-5 py-3 md:py-3.5 bg-stone-50 border border-stone-200 text-stone-900 rounded-xl md:rounded-2xl font-bold outline-none focus:border-black focus:ring-4 focus:ring-black/5 transition-all pr-12 text-sm md:text-base" 
                          />
                          <button 
                            type="button" 
                            onClick={() => setShowPassword(!showPassword)} 
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-450 hover:text-black transition-colors"
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                   </div>
                </div>
                <div className="space-y-4 md:space-y-6 flex flex-col min-h-0">
                   <h4 className="text-[9px] md:text-[10px] font-black text-stone-450 uppercase tracking-widest ml-1 shrink-0">System Permissions</h4>
                   <div className="space-y-2 overflow-y-auto pr-1 flex-1 max-h-[220px] md:max-h-[300px] custom-scrollbar">
                      {Object.values(Permission).map(p => (
                        <div 
                          key={p} 
                          onClick={() => toggleRight(p)} 
                          className={`flex items-center justify-between p-3.5 md:p-4 rounded-xl md:rounded-2xl border cursor-pointer select-none transition-all ${formData.rights?.includes(p) ? 'bg-black border-black text-white shadow-sm' : 'bg-stone-50 text-stone-650 border-stone-200 hover:bg-stone-100'}`}
                        >
                           <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest leading-none">{getPermissionLabel(p)}</span>
                           {formData.rights?.includes(p) && <CheckCircle2 size={15} className="text-white" />}
                        </div>
                      ))}
                   </div>
                </div>
             </div>

             {/* Modal Footer */}
             <div className="bg-stone-50 px-6 py-4 md:px-10 md:py-6 flex flex-col-reverse sm:flex-row justify-end gap-3 border-t border-stone-200 shrink-0">
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="w-full sm:w-auto px-6 py-2.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors font-black uppercase tracking-widest text-[10px] md:text-xs text-center"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave} 
                  className="w-full sm:w-auto px-8 py-3 bg-black hover:bg-stone-900 text-white rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-[10px] md:text-xs shadow-md border border-black active:scale-95 transition-all text-center"
                >
                  Apply Changes
                </button>
             </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default UserMaster;

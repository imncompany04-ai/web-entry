import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { 
  FileText, 
  Users, 
  BarChart3,
  LogOut,
  UserCheck,
  Settings as SettingsIcon,
  ShieldCheck,
  Activity,
  Database,
  Zap,
  Plus,
  LayoutDashboard,
  AlertCircle
} from 'lucide-react';
import { AppTab, LoadingEntry, Party, User, Permission, SyncStatus, AppSettings, Item, Size, Vendor, Order, PurchaseOrder, StockEntry, DispatchEntry } from './types';
import { db, auth } from './firebase';
import { signInAnonymously } from 'firebase/auth';
import { collection, doc, setDoc, deleteDoc, getDocs, onSnapshot } from 'firebase/firestore';
import EntrySheet from './components/EntrySheet';
import PartyMaster from './components/PartyMaster';
import Reports from './components/Reports';
import Login from './components/Login';
import UserMaster from './components/UserMaster';
import AIAssistant from './components/AIAssistant';
import Logo from './components/Logo';
import Settings from './components/Settings';
import EntryModal from './components/EntryModal';
import PanelModule from './components/PanelModule';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

const SESSION_EXPIRY = 3 * 24 * 60 * 60 * 1000;

const SYSTEM_ADMIN: User = {
  id: 'u-system-root',
  username: 'admin',
  name: 'Administrator',
  password: 'admin123',
  role: 'Admin',
  rights: Object.values(Permission),
  updatedAt: Date.now()
};

const App: React.FC = () => {
  // Persistence Helpers
  const saveLocal = (key: string, data: any) => {
    localStorage.setItem(`itoli_${key}`, JSON.stringify(data));
  };

  const loadLocal = (key: string, defaultValue: any) => {
    const saved = localStorage.getItem(`itoli_${key}`);
    return saved ? JSON.parse(saved) : defaultValue;
  };

  const [entries, setEntries] = useState<LoadingEntry[]>(() => loadLocal('entries', []));
  const [parties, setParties] = useState<Party[]>(() => loadLocal('parties', []));
  const [users, setUsers] = useState<User[]>(() => loadLocal('users', [SYSTEM_ADMIN]));
  const [settings, setSettings] = useState<AppSettings>(() => loadLocal('settings', { 
    companyName: 'Itoli Granito LLP', 
    entryFontSize: 12,
    logoUrl: '' 
  }));
  
  // New State for Panel Module
  const [items, setItems] = useState<Item[]>(() => loadLocal('items', []));
  const [sizes, setSizes] = useState<Size[]>(() => loadLocal('sizes', []));
  const [vendors, setVendors] = useState<Vendor[]>(() => loadLocal('vendors', []));
  const [orders, setOrders] = useState<Order[]>(() => loadLocal('orders', []));
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => loadLocal('purchaseOrders', []));
  const [stockEntries, setStockEntries] = useState<StockEntry[]>(() => loadLocal('stockEntries', []));
  const [dispatches, setDispatches] = useState<DispatchEntry[]>(() => loadLocal('dispatches', []));

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('itoli_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.loginTime && Date.now() - parsed.loginTime > SESSION_EXPIRY) {
        localStorage.removeItem('itoli_user');
        return null;
      }
      return parsed;
    }
    return null;
  });
  
  const [activeTab, setActiveTab] = useState<AppTab>('Entry Sheet');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('online');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleTabChange = (tab: AppTab) => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.scrollTo({ top: 0, behavior: 'instant' });
    document.body.scrollTo({ top: 0, behavior: 'instant' });
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTop = 0;
    }

    // Push the state to browser history for one-step-back native key support
    try {
      const currentHistState = window.history.state;
      if (!currentHistState || currentHistState.tab !== tab) {
        window.history.pushState({ tab }, '', '');
      }
    } catch (err) {
      console.warn("History pushState bypassed:", err);
    }

    setActiveTab(tab);
  };

  // Support mobile back key natively by listening to popstate state changes
  useEffect(() => {
    if (!currentUser) return;

    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.tab) {
        setActiveTab(event.state.tab);
      } else {
        setActiveTab('Entry Sheet');
      }
    };

    // Ensure the initial history entry has the current tab
    try {
      if (!window.history.state || !window.history.state.tab) {
        window.history.replaceState({ tab: activeTab }, '', '');
      }
    } catch (err) {
      console.warn("History replaceState bypassed:", err);
    }

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentUser]);

  // Scroll strictly to top on activeTab changes to prevent overlapping layout and clipping issues
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.scrollTo({ top: 0, behavior: 'instant' });
    document.body.scrollTo({ top: 0, behavior: 'instant' });
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTop = 0;
    }
  }, [activeTab]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Firebase auth & data synchronization
  useEffect(() => {
    let active = true;
    const unsubscribes: (() => void)[] = [];

    const setupAndSync = async () => {
      try {
        setSyncStatus('syncing');
        setSyncError(null);
        if (!auth.currentUser) {
          try {
            await signInAnonymously(auth);
            console.log("Firebase anonymous auth successful");
          } catch (authError) {
            console.warn("Firebase anonymous auth is disabled or restricted in this project. Proceeding using unauthenticated connection:", authError);
          }
        }

        if (!active) return;

        const fetchCollection = async (collName: string) => {
          const snap = await getDocs(collection(db, collName));
          return snap.docs.map(d => d.data());
        };

        const [
          fbUsers,
          fbEntries,
          fbParties,
          fbItems,
          fbSizes,
          fbVendors,
          fbOrders,
          fbPurchaseOrders,
          fbStockEntries,
          fbDispatches,
          fbSettingsSnap
        ] = await Promise.all([
          fetchCollection('users'),
          fetchCollection('entries'),
          fetchCollection('parties'),
          fetchCollection('items'),
          fetchCollection('sizes'),
          fetchCollection('vendors'),
          fetchCollection('orders'),
          fetchCollection('purchaseOrders'),
          fetchCollection('stockEntries'),
          fetchCollection('dispatches'),
          fetchCollection('settings')
        ]);

        if (!active) return;

        // Sync and back-populate collections bidirectionally so data is never lost or incorrectly restored
        const deletedKeys: string[] = JSON.parse(localStorage.getItem('itoli_deleted_doc_keys') || '[]');
        const filterDeleted = (list: any[], coll: string) => {
          return list.filter(item => !deletedKeys.includes(`${coll}:${item.id}`));
        };

        const syncAndResolve = async (fbList: any[], localList: any[], coll: string, setter: any) => {
          const cleanFb = filterDeleted(fbList, coll);
          const cleanLocal = filterDeleted(localList, coll);
          
          const mergedMap = new Map();
          // Seed with offline/local changes
          cleanLocal.forEach(item => mergedMap.set(item.id, item));
          // Overwrite with Firestore state as authority
          cleanFb.forEach(item => mergedMap.set(item.id, item));
          
          const mergedList = Array.from(mergedMap.values());
          setter(mergedList);
          saveLocal(coll, mergedList);
          
          // Back-populate only true missing active objects to Firestore instead of rewriting empty collections
          const fbIds = new Set(fbList.map(item => item.id));
          const toUpload = mergedList.filter(item => !fbIds.has(item.id));
          if (toUpload.length > 0) {
            await Promise.all(toUpload.map(item => setDoc(doc(db, coll, item.id), item)));
          }
        };

        // Run bidirectional sync-and-resolve
        await Promise.all([
          syncAndResolve(fbUsers, users, 'users', setUsers),
          syncAndResolve(fbEntries, entries, 'entries', setEntries),
          syncAndResolve(fbParties, parties, 'parties', setParties),
          syncAndResolve(fbItems, items, 'items', setItems),
          syncAndResolve(fbSizes, sizes, 'sizes', setSizes),
          syncAndResolve(fbVendors, vendors, 'vendors', setVendors),
          syncAndResolve(fbOrders, orders, 'orders', setOrders),
          syncAndResolve(fbPurchaseOrders, purchaseOrders, 'purchaseOrders', setPurchaseOrders),
          syncAndResolve(fbStockEntries, stockEntries, 'stockEntries', setStockEntries),
          syncAndResolve(fbDispatches, dispatches, 'dispatches', setDispatches)
        ]);

        const brandingDoc = fbSettingsSnap.find((d: any) => d.id === 'branding');
        if (brandingDoc) {
          setSettings(brandingDoc as AppSettings);
          saveLocal('settings', brandingDoc);
        } else {
          await setDoc(doc(db, 'settings', 'branding'), settings);
        }

        setSyncStatus('online');
        setLastSyncTime(Date.now());

        // Setup real-time snapshots listeners so updates instantly reflect across other PCs/devices!
        const setupListener = (coll: string, setter: any) => {
          const unsub = onSnapshot(collection(db, coll), (snapshot) => {
            const currentDeleted = JSON.parse(localStorage.getItem('itoli_deleted_doc_keys') || '[]');
            const updatedDocs = snapshot.docs
              .map(d => d.data())
              .filter(item => !currentDeleted.includes(`${coll}:${item.id}`));
            
            setter(updatedDocs);
            saveLocal(coll, updatedDocs);
            setLastSyncTime(Date.now());
          }, (err) => {
            console.error(`Real-time snapshot listener failed for ${coll}:`, err);
          });
          unsubscribes.push(unsub);
        };

        setupListener('users', setUsers);
        setupListener('entries', setEntries);
        setupListener('parties', setParties);
        setupListener('items', setItems);
        setupListener('sizes', setSizes);
        setupListener('vendors', setVendors);
        setupListener('orders', setOrders);
        setupListener('purchaseOrders', setPurchaseOrders);
        setupListener('stockEntries', setStockEntries);
        setupListener('dispatches', setDispatches);

        // Real-time settings listener
        const unsubSettings = onSnapshot(doc(db, 'settings', 'branding'), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as AppSettings;
            setSettings(data);
            saveLocal('settings', data);
            setLastSyncTime(Date.now());
          }
        });
        unsubscribes.push(unsubSettings);

      } catch (err: any) {
        console.error("Failed to connect or sync with Firebase:", err);
        setSyncStatus('offline');
        setSyncError(err?.message || String(err));
      }
    };

    if (isOnline) {
      setupAndSync();
    } else {
      setSyncStatus('offline');
    }

    return () => {
      active = false;
      unsubscribes.forEach(unsub => unsub());
    };
  }, [isOnline]);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem('itoli_user');
  }, []);

  const handleUpsert = async (coll: string, data: any) => {
    try {
      const docId = data.id || Math.random().toString(36).substr(2, 9);
      const finalData = { ...data, id: docId, updatedAt: Date.now() };
      
      // Update Local State Immediately for responsiveness and offline support
      const updateState = (setter: any, key: string) => {
        setter((prev: any[]) => {
          const next = prev.some(u => u.id === docId) ? prev.map(u => u.id === docId ? finalData : u) : [...prev, finalData];
          saveLocal(key, next);
          return next;
        });
      };

      if (coll === 'users') updateState(setUsers, 'users');
      else if (coll === 'entries') updateState(setEntries, 'entries');
      else if (coll === 'parties') updateState(setParties, 'parties');
      else if (coll === 'items') updateState(setItems, 'items');
      else if (coll === 'sizes') updateState(setSizes, 'sizes');
      else if (coll === 'vendors') updateState(setVendors, 'vendors');
      else if (coll === 'orders') updateState(setOrders, 'orders');
      else if (coll === 'purchaseOrders') updateState(setPurchaseOrders, 'purchaseOrders');
      else if (coll === 'stockEntries') updateState(setStockEntries, 'stockEntries');
      else if (coll === 'dispatches') updateState(setDispatches, 'dispatches');

      // Sync to Firebase if online in the background without blocking the responsive UI flow
      if (isOnline) {
        const docRef = coll === 'settings' ? doc(db, 'settings', 'branding') : doc(db, coll, docId);
        setDoc(docRef, finalData).catch(err => {
          console.error(`Firestore background sync failed for ${coll}:${docId}:`, err);
          setSyncError(err?.message || String(err));
          setSyncStatus('offline');
        });
      }
    } catch (e) { 
      console.error("Local state update/Firestore trigger failed:", e);
    }
  };

  const registerDeletedKey = (coll: string, id: string) => {
    try {
      const keys = JSON.parse(localStorage.getItem('itoli_deleted_doc_keys') || '[]');
      const key = `${coll}:${id}`;
      if (!keys.includes(key)) {
        keys.push(key);
        localStorage.setItem('itoli_deleted_doc_keys', JSON.stringify(keys));
      }
    } catch (e) {
      console.error("Failed to register deleted key:", e);
    }
  };

  const handleDelete = async (coll: string, id: string) => {
    if (!id) return;
    registerDeletedKey(coll, id);
    try { 
      const deleteState = (setter: any, key: string) => {
        setter((prev: any[]) => {
          const next = prev.filter(u => u.id !== id);
          saveLocal(key, next);
          return next;
        });
      };
      if (coll === 'users') deleteState(setUsers, 'users');
      else if (coll === 'entries') deleteState(setEntries, 'entries');
      else if (coll === 'parties') deleteState(setParties, 'parties');
      else if (coll === 'items') deleteState(setItems, 'items');
      else if (coll === 'sizes') deleteState(setSizes, 'sizes');
      else if (coll === 'vendors') deleteState(setVendors, 'vendors');
      else if (coll === 'orders') deleteState(setOrders, 'orders');
      else if (coll === 'purchaseOrders') deleteState(setPurchaseOrders, 'purchaseOrders');
      else if (coll === 'stockEntries') deleteState(setStockEntries, 'stockEntries');
      else if (coll === 'dispatches') deleteState(setDispatches, 'dispatches');

      // Sync to Firebase if online, catch errors individually to prevent local reversion
      if (isOnline) {
        try {
          await deleteDoc(doc(db, coll, id));
        } catch (e: any) {
          console.warn(`Could not delete doc ${coll}:${id} from Firestore, local deletion is preserved:`, e);
          setSyncError(e?.message || String(e));
          setSyncStatus('offline');
        }
      }
    } catch (e) { 
      console.error("Local delete state update failed:", e);
    }
  };

  const handleBulkDeleteRecords = async (recordsToDelete: Array<{ coll: string; id: string }>) => {
    try {
      // First register tombstones to ensure they are never synced back on refresh
      recordsToDelete.forEach(r => registerDeletedKey(r.coll, r.id));

      const byColl: { [coll: string]: string[] } = {};
      recordsToDelete.forEach(r => {
        if (!byColl[r.coll]) byColl[r.coll] = [];
        byColl[r.coll].push(r.id);
      });

      const settersMap: { [coll: string]: [any, string] } = {
        users: [setUsers, 'users'],
        entries: [setEntries, 'entries'],
        parties: [setParties, 'parties'],
        items: [setItems, 'items'],
        sizes: [setSizes, 'sizes'],
        vendors: [setVendors, 'vendors'],
        orders: [setOrders, 'orders'],
        purchaseOrders: [setPurchaseOrders, 'purchaseOrders'],
        stockEntries: [setStockEntries, 'stockEntries'],
        dispatches: [setDispatches, 'dispatches']
      };

      Object.keys(byColl).forEach(collName => {
        const ids = byColl[collName];
        const entry = settersMap[collName];
        if (entry) {
          const [setter, keyName] = entry;
          setter((prev: any[]) => {
            const next = prev.filter(u => !ids.includes(u.id));
            saveLocal(keyName, next);
            return next;
          });
        }
      });

      // Individual try catch so that any single document error (like permissions or rules error)
      // does not fail the entire process or cancel local removal.
      if (isOnline) {
        Promise.all(
          recordsToDelete.map(async r => {
            try {
              await deleteDoc(doc(db, r.coll, r.id));
            } catch (err) {
              console.warn(`Failed to delete document ${r.coll}:${r.id} from Firestore, local state is preserved:`, err);
            }
          })
        ).catch(err => {
          console.error("Background deletion processing error:", err);
        });
      }
    } catch (err) {
      console.error("Bulk delete handler failed:", err);
      // Do not throw back so that it fails gracefully in the UI while state is corrected locally
    }
  };

  const handleTotalStorageCleanup = async (options?: { includeParties?: boolean }) => {
    try {
      const allRecordsToDelete: Array<{ coll: string; id: string }> = [];
      
      (entries || []).forEach(e => e?.id && allRecordsToDelete.push({ coll: 'entries', id: e.id }));
      (orders || []).forEach(o => o?.id && allRecordsToDelete.push({ coll: 'orders', id: o.id }));
      (purchaseOrders || []).forEach(p => p?.id && allRecordsToDelete.push({ coll: 'purchaseOrders', id: p.id }));
      (stockEntries || []).forEach(s => s?.id && allRecordsToDelete.push({ coll: 'stockEntries', id: s.id }));
      (dispatches || []).forEach(d => d?.id && allRecordsToDelete.push({ coll: 'dispatches', id: d.id }));
      
      if (options?.includeParties) {
        (parties || []).forEach(p => p?.id && allRecordsToDelete.push({ coll: 'parties', id: p.id }));
      }
      
      await handleBulkDeleteRecords(allRecordsToDelete);
      
      // Flush deleted keys or subset as needed
      localStorage.setItem('itoli_deleted_doc_keys', JSON.stringify([]));
    } catch (err) {
      console.error("Logs and Entries cleanup failed:", err);
      throw err;
    }
  };

  const handleAddEntry = async (newEntry: any) => {
    const id = Math.random().toString(36).substr(2, 9);
    const entry: LoadingEntry = {
      ...newEntry,
      id,
      srNo: entries.length > 0 ? Math.max(...entries.map(e => e.srNo)) + 1 : 1,
      date: new Date().toISOString().split('T')[0],
      entryTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase(),
      updatedAt: Date.now()
    };
    await handleUpsert('entries', entry);
  };

  const handleUpdateEntry = (id: string, updates: Partial<LoadingEntry>) => {
    const entry = entries.find(e => e.id === id);
    if (entry) handleUpsert('entries', { ...entry, ...updates });
  };

  const handleDeleteEntries = async (ids: string[]) => {
    for (const id of ids) await handleDelete('entries', id);
  };

  const handleLogin = (user: User) => {
    const userWithTime = { ...user, loginTime: Date.now() };
    setCurrentUser(userWithTime);
    localStorage.setItem('itoli_user', JSON.stringify(userWithTime));
  };

  if (!currentUser) {
    return (
      <Login 
        onLogin={handleLogin} 
        users={users}
        logoUrl={settings.logoUrl}
        authError={null}
        isAuthenticated={true}
      />
    );
  }

  const hasAdminAccess = currentUser.rights.includes(Permission.ADMIN_ACCESS);
  const canViewLogs = hasAdminAccess || currentUser.rights.includes(Permission.VIEW_TODAY_ENTRIES) || currentUser.rights.includes(Permission.VIEW_PAST_ENTRIES);
  const canViewPanel = hasAdminAccess || currentUser.rights.includes(Permission.MANAGE_INVENTORY);
  const canViewParties = hasAdminAccess || currentUser.rights.includes(Permission.VIEW_PARTY_LIST) || currentUser.rights.includes(Permission.MANAGE_PARTIES) || currentUser.rights.includes(Permission.ADD_PARTY);
  const canViewReports = hasAdminAccess || currentUser.rights.includes(Permission.VIEW_REPORTS);
  const canManageSettings = hasAdminAccess || currentUser.rights.includes(Permission.MANAGE_SETTINGS);

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans text-base pb-24 md:pb-0 text-stone-900">
      <header className="bg-white/80 border-b border-stone-200/80 backdrop-blur-xl sticky top-0 z-50 shadow-sm print:hidden">
        <div className="max-w-[1800px] mx-auto px-6 h-20 md:h-24 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center select-none cursor-pointer group" onClick={() => handleTabChange('Entry Sheet')}>
              <Logo className="h-10 md:h-14 w-auto group-hover:opacity-80 transition-all" src={settings.logoUrl} />
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-1.5 bg-stone-100 border border-stone-200/60 p-1.5 rounded-[20px] relative">
            {canViewLogs && <NavButton active={activeTab === 'Entry Sheet'} onClick={() => handleTabChange('Entry Sheet')} icon={<FileText size={18} />} label="Logs" />}
            {canViewPanel && <NavButton active={activeTab === 'Panel'} onClick={() => handleTabChange('Panel')} icon={<LayoutDashboard size={18} />} label="Panel" />}
            {canViewParties && <NavButton active={activeTab === 'Party Master'} onClick={() => handleTabChange('Party Master')} icon={<Users size={18} />} label="Parties" />}
            {canViewReports && <NavButton active={activeTab === 'Reports'} onClick={() => handleTabChange('Reports')} icon={<BarChart3 size={18} />} label="Reports" />}
            {hasAdminAccess && <NavButton active={activeTab === 'Staff Master'} onClick={() => handleTabChange('Staff Master')} icon={<UserCheck size={18} />} label="Staff" />}
            {canManageSettings && <NavButton active={activeTab === 'Settings'} onClick={() => handleTabChange('Settings')} icon={<SettingsIcon size={18} />} label="Settings" />}
          </nav>
          
          <div className="flex items-center gap-4 border-l border-stone-200 pl-4 md:pl-6 relative">
            {/* Real-time Connection Status Indicator */}
            <div className="flex items-center gap-2 px-3 py-1 bg-stone-100 rounded-full border border-stone-200/60 select-none">
              <span className={`w-2.5 h-2.5 rounded-full ${syncStatus === 'online' ? 'bg-emerald-500 animate-pulse' : syncStatus === 'syncing' ? 'bg-amber-500 animate-bounce' : 'bg-rose-500'}`} />
              <span className="text-[9px] font-black uppercase tracking-wider text-stone-600">
                {syncStatus === 'online' ? 'Cloud Synced' : syncStatus === 'syncing' ? 'Syncing...' : 'Disconnected'}
              </span>
            </div>

            <button 
              id="profile-circle-btn"
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="w-10 h-10 md:w-11 md:h-11 bg-stone-900 hover:bg-stone-800 text-white rounded-full flex items-center justify-center font-bold text-sm md:text-base border border-stone-200 shadow-md transition-all active:scale-95 focus:outline-none"
              title={`${currentUser.name} (${currentUser.role})`}
            >
              {getInitials(currentUser.name)}
            </button>

            {isProfileMenuOpen && (
              <>
                {/* Backdrop overlay to close menu on outside click */}
                <div 
                  className="fixed inset-0 z-[60]" 
                  onClick={() => setIsProfileMenuOpen(false)} 
                />
                
                {/* Dropdown Menu Card */}
                <div className="absolute right-0 top-14 md:top-16 w-64 bg-white border border-stone-200 rounded-2xl shadow-xl py-3 z-[70] animate-fade-in text-stone-800">
                  <div className="px-4 py-2.5 border-b border-stone-100 flex items-center gap-3">
                    <div className="w-10 h-10 bg-stone-100 text-stone-800 border border-stone-200 rounded-full flex items-center justify-center font-black text-sm">
                      {getInitials(currentUser.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-stone-900 truncate">{currentUser.name}</p>
                      <p className="text-xs text-stone-500 font-mono font-semibold tracking-wider uppercase mt-0.5">{currentUser.role}</p>
                    </div>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    {canManageSettings && (
                      <button
                        onClick={() => {
                          handleTabChange('Settings');
                          setIsProfileMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-50 rounded-xl transition-colors text-left"
                      >
                        <SettingsIcon size={16} className="text-stone-400" />
                        <span>Settings</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors text-left"
                    >
                      <LogOut size={16} className="text-red-500" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {syncError && (
        <div className="border-b border-rose-100 bg-rose-50/80 py-4 px-6 animate-fade-in print:hidden">
          <div className="max-w-[1800px] mx-auto flex flex-col md:flex-row items-start md:items-start justify-between gap-6">
            <div className="flex gap-3 flex-1">
              <div className="p-2 text-rose-600 bg-rose-100 rounded-xl shrink-0 mt-0.5">
                <AlertCircle size={20} />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-black text-rose-950 uppercase tracking-widest flex items-center gap-2">
                  <span>Firebase Firestore Connection Error</span>
                  <span className="text-[10px] bg-rose-200/60 text-rose-900 px-2 py-0.5 rounded font-black">ACTION REQUIRED / પગલાં લેવા જરૂરી</span>
                </h4>
                
                <p className="text-xs text-rose-800 font-medium mt-1.5 leading-relaxed">
                  The application tried to connect, but Firebase returned: <code className="bg-rose-100 px-1.5 py-0.5 rounded font-mono font-bold text-[10px] text-rose-900 break-all">{syncError}</code>
                </p>

                {/* Specific custom troubleshooting steps for Database Not Found */}
                {syncError.toLowerCase().includes('not found') ? (
                  <div className="mt-4 bg-white/80 rounded-2xl p-4 border border-rose-100 space-y-4 shadow-sm">
                    <div>
                      <h5 className="text-xs font-black text-rose-950 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="text-amber-500">👉</span> 
                        <span>How to fix this in your Firebase Console (તમારા Firebase માં આ રીતે ચાલુ કરો):</span>
                      </h5>
                      <p className="text-[11px] text-stone-500 font-bold uppercase mt-1">
                        Your Firebase database is registered but you haven't clicked "Create Database" yet under Firestore. Let's do it now:
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-stone-700 leading-relaxed">
                      <div className="space-y-2 bg-stone-50/50 p-3 rounded-xl border border-stone-100">
                        <p className="font-extrabold text-stone-900 uppercase text-[10px] tracking-wider text-rose-600">🇬🇧 English Instructions</p>
                        <ol className="list-decimal pl-4 space-y-1.5">
                          <li>Go to <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-bold">console.firebase.google.com</a> & open project <strong className="font-bold text-stone-950">itoli-sheet-e0070</strong></li>
                          <li>On the left menu, click on <strong className="font-bold text-stone-950">Build ➜ Firestore Database</strong></li>
                          <li>Click the prominent <strong className="font-black text-stone-950 underline">"Create database"</strong> button</li>
                          <li>Select database ID <strong className="font-bold text-stone-950">(default)</strong> and click Next</li>
                          <li>Choose <strong className="font-bold text-stone-950">"Start in test mode"</strong> (so other PCs can write/read data) and enable it</li>
                          <li>Once created, come back here and click <strong className="font-bold text-stone-950">🔄 Retry Connection</strong>!</li>
                        </ol>
                      </div>

                      <div className="space-y-2 bg-rose-50/35 p-3 rounded-xl border border-rose-100/40">
                        <p className="font-extrabold text-stone-950 uppercase text-[10px] tracking-wider text-rose-600">🇮🇳 ગુજરાતી માર્ગદર્શન (Gujarati Instructions)</p>
                        <ol className="list-decimal pl-4 space-y-1.5 text-stone-600">
                          <li>સૌપ્રથમ <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-bold">console.firebase.google.com</a> ખોલો અને <strong className="font-bold text-stone-950">itoli-sheet-e0070</strong> પ્રોજેક્ટ પસંદ કરો.</li>
                          <li>ડાબી બાજુ ના મેનુમાંથી <strong className="font-bold text-stone-950">Build ➜ Firestore Database</strong> પર ક્લિક કરો.</li>
                          <li>ત્યાં દેખાતા મોટા <strong className="font-black text-stone-950 underline">"Create database"</strong> બટન પર ક્લિક કરો.</li>
                          <li>ડેટાબેઝ આઈડી <strong className="font-bold text-stone-950">(default)</strong> રાખીને Next કરો.</li>
                          <li>પછી <strong className="font-bold text-stone-950">"Start in test mode"</strong> સિલેક્ટ કરો જેથી બધા કમ્પ્યુટરમાંથી એન્ટ્રી થઈ શકે.</li>
                          <li>ડેટાબેઝ ચાલુ થઈ જાય એટલે અહીં આવીને નીચે આપેલું <strong className="font-bold text-stone-950">🔄 Retry Connection</strong> બટન દબાવો!</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-rose-800/90 font-extrabold uppercase tracking-widest mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 leading-relaxed">
                    <span className="text-stone-900">💡 CHECKLIST FOR MULTI-PC SYNC:</span>
                    <span>1. Enable Cloud Firestore in Test Mode</span>
                    <span>2. Ensure both PCs are connected to the internet</span>
                    <span>3. Changes on any PC will push to all screens instantly</span>
                  </div>
                )}
              </div>
            </div>
            <div className="shrink-0">
              <button 
                onClick={() => {
                  setSyncStatus('syncing');
                  setSyncError(null);
                  setTimeout(() => {
                    window.dispatchEvent(new Event('online'));
                  }, 100);
                }} 
                className="px-5 py-3.5 bg-stone-955 text-white hover:bg-stone-900 text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl active:scale-95 whitespace-nowrap flex items-center gap-2 border border-stone-800"
              >
                <span>🔄 Retry Connection</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-[1800px] mx-auto px-4 md:px-6 py-2 md:py-6 flex-1 w-full relative">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="w-full"
        >
          {activeTab === 'Entry Sheet' && <EntrySheet currentUser={currentUser} entries={entries} parties={parties} settings={settings} onAddEntry={handleAddEntry} onDeleteEntries={handleDeleteEntries} onUpdateEntry={handleUpdateEntry} />}
          {activeTab === 'Panel' && (
            <PanelModule 
              currentUser={currentUser} 
              settings={settings}
              items={items} 
              sizes={sizes} 
              vendors={vendors} 
              parties={parties}
              orders={orders} 
              purchaseOrders={purchaseOrders} 
              stockEntries={stockEntries} 
              dispatches={dispatches} 
              onUpsert={handleUpsert} 
              onDelete={handleDelete} 
            />
          )}
          {activeTab === 'Party Master' && <PartyMaster currentUser={currentUser} parties={parties} onAddParty={(p) => handleUpsert('parties', { ...p, id: Math.random().toString(36).substr(2, 9) })} onUpdateParty={(id, u) => handleUpsert('parties', { id, ...u })} onDeleteParty={(id) => handleDelete('parties', id)} />}
          {activeTab === 'Reports' && <Reports entries={entries} parties={parties} />}
          {activeTab === 'Staff Master' && hasAdminAccess && <UserMaster currentUser={currentUser} users={users} setUsers={(val: any) => {
              const newUsers = typeof val === 'function' ? val(users) : val;
              newUsers.forEach((u: User) => handleUpsert('users', u));
          }} />}
          {activeTab === 'Settings' && (
            <Settings 
              currentUser={currentUser} 
              settings={settings} 
              onUpdateSettings={async (u) => { 
                const newSet = { ...settings, ...u };
                setSettings(newSet); 
                saveLocal('settings', newSet); 
                setDoc(doc(db, 'settings', 'branding'), newSet).catch(err => {
                  console.error("Firestore settings sync background error:", err);
                });
              }} 
              entries={entries}
              orders={orders}
              purchaseOrders={purchaseOrders}
              stockEntries={stockEntries}
              dispatches={dispatches}
              parties={parties}
              items={items}
              sizes={sizes}
              vendors={vendors}
              users={users}
              onBulkDeleteRecords={handleBulkDeleteRecords}
              onTotalStorageCleanup={handleTotalStorageCleanup}
              stats={{
                users: users.length,
                parties: parties.length,
                entries: entries.length,
                items: items.length,
                sizes: sizes.length,
                vendors: vendors.length,
                orders: orders.length,
                purchaseOrders: purchaseOrders.length,
                stockEntries: stockEntries.length,
                dispatches: dispatches.length,
              }}
            />
          )}
        </motion.div>
      </main>

      {isMobile && (
        <MobileNav 
          activeTab={activeTab} 
          setActiveTab={handleTabChange}
          canViewLogs={canViewLogs}
          canViewPanel={canViewPanel}
          canViewParties={canViewParties}
          canViewReports={canViewReports}
          hasAdminAccess={hasAdminAccess}
          canManageSettings={canManageSettings}
          onAddClick={() => setIsAddModalOpen(true)}
        />
      )}

      {isAddModalOpen && (
        <EntryModal 
          parties={parties} 
          editingEntry={null} 
          onClose={() => setIsAddModalOpen(false)} 
          onAdd={handleAddEntry} 
          onUpdate={() => {}} 
        />
      )}
    </div>
  );
};

const MobileNav = ({ activeTab, setActiveTab, canViewLogs, canViewPanel, canViewParties, canViewReports, hasAdminAccess, canManageSettings, onAddClick }: any) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-stone-100 px-4 py-3 flex items-center justify-between z-[100] md:hidden">
      {canViewLogs && <MobileNavButton active={activeTab === 'Entry Sheet'} onClick={() => setActiveTab('Entry Sheet')} icon={<FileText size={22} />} label="Logs" />}
      {canViewReports && <MobileNavButton active={activeTab === 'Reports'} onClick={() => setActiveTab('Reports')} icon={<BarChart3 size={22} />} label="Reports" />}
      
      <button 
        onClick={onAddClick}
        className="w-12 h-12 bg-black text-white rounded-full shadow-lg flex items-center justify-center -mt-10 border-4 border-white active:scale-90 transition-all"
      >
        <Plus size={24} />
      </button>

      {canViewParties && <MobileNavButton active={activeTab === 'Party Master'} onClick={() => setActiveTab('Party Master')} icon={<Users size={22} />} label="Parties" />}
      {hasAdminAccess ? (
        <MobileNavButton active={activeTab === 'Staff Master'} onClick={() => setActiveTab('Staff Master')} icon={<UserCheck size={22} />} label="Staff" />
      ) : (
        canManageSettings && <MobileNavButton active={activeTab === 'Settings'} onClick={() => setActiveTab('Settings')} icon={<SettingsIcon size={22} />} label="More" />
      )}
    </div>
  );
};

const MobileNavButton = ({ active, onClick, icon, label }: any) => (
  <button 
    onClick={onClick} 
    className="relative isolate flex flex-col items-center justify-center gap-1.5 pb-2 pt-1 px-2.5 transition-all focus:outline-none"
  >
    <div className={`transition-all duration-300 transform ${active ? 'text-black -translate-y-0.5 scale-105' : 'text-stone-300 hover:text-stone-500'}`}>
      {icon}
    </div>
    <span className={`text-[9px] font-black uppercase tracking-[0.1em] transition-colors duration-300 ${active ? 'text-black' : 'text-stone-400'}`}>{label}</span>
    {active && (
      <motion.div 
        layoutId="activeMobileIndicator"
        className="absolute bottom-0 left-1 right-1 h-0.5 bg-black rounded-full"
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
      />
    )}
  </button>
);

const NavButton = ({ active, onClick, icon, label }: any) => (
  <button 
    onClick={onClick} 
    className={`relative isolate flex items-center gap-3 px-5 py-2.5 rounded-[14px] transition-all duration-300 text-xs font-black uppercase tracking-widest outline-none focus:outline-none ${active ? 'text-white' : 'text-stone-500 hover:text-stone-900'}`}
  >
    {active && (
      <motion.div 
        layoutId="activeTabBg"
        className="absolute inset-0 bg-black rounded-[14px] shadow-sm -z-10 border border-black/10"
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
      />
    )}
    <span className="relative z-10 flex items-center justify-center">{icon}</span>
    <span className="relative z-10 hidden lg:inline">{label}</span>
  </button>
);

export default App;

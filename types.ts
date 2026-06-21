export enum EntryStatus {
  PENDING = 'Pending',
  COMPLETED = 'Completed',
  UNDERLOADING = 'Underloading'
}

export enum OrderStatus {
  PENDING = 'Pending',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled'
}

export enum Permission {
  ADD_ENTRY = 'add_entry',
  VIEW_TODAY_ENTRIES = 'view_today_entries',
  EDIT_TODAY_ENTRIES = 'edit_today_entries',
  DELETE_TODAY_ENTRIES = 'delete_today_entries',
  VIEW_PAST_ENTRIES = 'view_past_entries',
  EDIT_PAST_ENTRIES = 'edit_past_entries',
  DELETE_PAST_ENTRIES = 'delete_past_entries',
  ADD_PARTY = 'add_party',
  VIEW_PARTY_LIST = 'view_party_list',
  MANAGE_PARTIES = 'manage_parties',
  VIEW_REPORTS = 'view_reports',
  ADMIN_ACCESS = 'admin_access',
  USE_AI = 'use_ai',
  MANAGE_SETTINGS = 'manage_settings',
  MANAGE_INVENTORY = 'manage_inventory'
}

export interface User {
  id: string;
  username: string;
  name: string;
  password?: string;
  role: 'Admin' | 'Operator' | 'Viewer';
  rights: Permission[];
  updatedAt?: number;
}

export interface Party {
  id: string;
  name: string;
  location?: string;
  updatedAt?: number;
}

export interface LoadingEntry {
  id: string;
  srNo: number;
  date: string;
  entryTime: string;
  truckNo: string;
  tempoNumber: string;
  partyId: string;
  partyName: string;
  allowedWeight: number;
  quantity: number;
  status: EntryStatus;
  remarks?: string;
  updatedAt?: number;
}

export interface Item {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  updatedAt?: number;
}

export interface Size {
  id: string;
  name: string;
  unitType: string;
  updatedAt?: number;
}

export interface Vendor {
  id: string;
  name: string;
  mobile?: string;
  city?: string;
  isActive: boolean;
  updatedAt?: number;
}

export interface OrderItem {
  itemId: string;
  itemName: string;
  sizeId: string;
  sizeName: string;
  quantity: number;
}

export interface Order {
  id: string;
  orderNo: string;
  customerName: string;
  partyId?: string;
  date: string;
  items: OrderItem[];
  status: OrderStatus;
  remarks?: string;
  updatedAt?: number;
}

export interface PurchaseOrder {
  id: string;
  poNo: string;
  vendorId: string;
  vendorName: string;
  date: string;
  items: OrderItem[];
  isConvertedToStock: boolean;
  remarks?: string;
  updatedAt?: number;
}

export interface StockEntry {
  id: string;
  date: string;
  itemId: string;
  itemName: string;
  sizeId: string;
  sizeName: string;
  quantityAdded: number;
  reference?: string;
  updatedAt?: number;
}

export interface DispatchEntry {
  id: string;
  dispatchNo: string;
  orderId: string;
  orderNo: string;
  customerName: string;
  itemId: string;
  itemName: string;
  sizeId: string;
  sizeName: string;
  quantity: number;
  vehicleNo: string;
  date: string;
  remarks?: string;
  updatedAt?: number;
}

export interface PdfTemplateConfig {
  showLogo: boolean;
  showDate: boolean;
  showEntity: boolean;
  showRemarks: boolean;
  showTotalUnits: boolean;
}

export interface AppSettings {
  logoUrl?: string;
  companyName: string;
  entryFontSize?: number;
  pdfTemplates?: {
    so: PdfTemplateConfig;
    po: PdfTemplateConfig;
  };
}

export type AppTab = 'Entry Sheet' | 'Panel' | 'Party Master' | 'Reports' | 'Staff Master' | 'Settings';

export type SyncStatus = 'online' | 'syncing' | 'offline' | 'error';
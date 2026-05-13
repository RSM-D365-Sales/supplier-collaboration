// Shared TypeScript types for the frontend

export type RFQStatus = 'LOGGED' | 'SENT' | 'RECEIVED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
export type ResponseStatus = 'replied' | 'declined' | 'no-reply' | 'pending';

export interface Vendor {
  vendorId: string;
  vendorName: string;
  email: string;
}

export interface RFQLineItem {
  itemNumber: number;
  itemId: string;
  description: string;
  quantity: number;
  unit: string;
  leadTimeDays: number;
  quotedUnitPrice: number;
  extendedPrice: number;
  notes?: string;
}

export interface RFQData {
  rfqNumber: string;
  rfqStatus: RFQStatus;
  entryDate: string;
  expirationDate: string;
  customerApprovalStatus: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string;
  companyName: string;
  instructions?: string;
  vendor: Vendor;
  items: RFQLineItem[];
}

export interface RFQMeta {
  responseStatus: ResponseStatus;
  submittedAt?: string;
  expiresAt: string;
  quoteValidDays: number;
  quotedDate: string;
  generalNotes: string;
}

export interface RFQPageData {
  rfq: RFQData;
  meta: RFQMeta;
}

export interface LineItemDraft {
  itemId: string;
  itemNumber: number;
  leadTimeDays: number;
  quotedUnitPrice: number;
  extendedPrice: number;
  notes: string;
}

export interface SubmitPayload {
  responseStatus: ResponseStatus;
  quoteValidDays: number;
  quotedDate: string;
  items: LineItemDraft[];
  generalNotes: string;
}

export interface Document {
  name: string;
  path: string;
  uploadedAt: string;
}

// ─── Portal Slot types ────────────────────────────────────────────────────────

export interface SlotVendor {
  vendorId: string;
  vendorName: string;
  email: string;
  token: string;
  portalUrl: string;
  responseStatus: ResponseStatus;
  emailSent: boolean;
}

export interface PortalSlot {
  slotId: string;
  label: string;
  status: 'empty' | 'active' | 'closed';
  rfqNumber?: string;
  rfqData?: Omit<RFQData, 'vendor'>;
  vendors: SlotVendor[];
  updatedAt?: string;
}

export interface SlotLineItemDraft {
  itemNumber: number;
  itemId: string;
  description: string;
  quantity: number;
  unit: string;
  leadTimeDays: number;
}

export interface ConfigureSlotPayload {
  label?: string;
  rfqNumber: string;
  rfqData: Omit<RFQData, 'vendor'>;
  vendors: Array<{ vendorId?: string; vendorName: string; email: string }>;
  sendEmails?: boolean;
  expiryDays?: number;
}

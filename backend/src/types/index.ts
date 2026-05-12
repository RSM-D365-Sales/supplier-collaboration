// Shared TypeScript interfaces for the Supplier Collaboration Portal

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
  rfqStatus: 'LOGGED' | 'SENT' | 'RECEIVED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  entryDate: string;            // ISO date string
  expirationDate: string;       // submission deadline
  customerApprovalStatus: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string;
  companyName: string;
  vendor: Vendor;
  items: RFQLineItem[];
  instructions?: string;
}

export type ResponseStatus = 'replied' | 'declined' | 'no-reply' | 'pending';

export interface LineItemResponse {
  itemId: string;
  itemNumber: number;
  leadTimeDays: number;
  quotedUnitPrice: number;
  extendedPrice: number;
  notes?: string;
}

export interface VendorResponsePayload {
  responseStatus: ResponseStatus;
  quoteValidDays: number;
  quotedDate: string;              // ISO date string
  items: LineItemResponse[];
  generalNotes?: string;
}

export interface TokenRecord {
  token: string;
  rfqId: string;
  rfqNumber: string;
  vendorId: string;
  vendorName: string;
  vendorEmail: string;
  createdAt: string;
  expiresAt: string;
  responseStatus: ResponseStatus;
  submittedAt?: string;
  lastResponse?: VendorResponsePayload;
  /** Full RFQ data stored at token-generation time (used in demo/mock mode) */
  rfqSnapshot?: Omit<RFQData, 'vendor'>;
}

export interface GenerateTokensRequest {
  rfqId: string;
  rfqNumber: string;
  vendors: Vendor[];
  expiryDays?: number;
  /**
   * Optional: supply the full RFQ data inline.
   * Used in demo/mock mode so each generated token carries its own RFQ.
   * In production (USE_MOCK_DATA=false) this is ignored — data is fetched live from D365.
   */
  rfqData?: Omit<RFQData, 'vendor'>;
}

export interface GenerateTokensResponse {
  tokens: Array<{
    vendorId: string;
    vendorName: string;
    token: string;
    portalUrl: string;
  }>;
}

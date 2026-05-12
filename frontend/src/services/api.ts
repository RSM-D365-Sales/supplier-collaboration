import axios from 'axios';
import { RFQPageData, SubmitPayload, Document } from '../types/rfq';

// Dev:  VITE_API_URL unset → BASE = '/api' → Vite proxy forwards to localhost:3001
// Prod: VITE_API_URL='https://portal-api.rsmd365.com' → BASE = absolute URL
const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const client = axios.create({ baseURL: BASE });

export const api = {
  /**
   * Fetch RFQ data for the given vendor token.
   */
  async getRFQ(token: string): Promise<RFQPageData> {
    const { data } = await client.get<RFQPageData>(`/rfq/${token}`);
    return data;
  },

  /**
   * Submit (or update) the vendor's response.
   */
  async submitResponse(token: string, payload: SubmitPayload): Promise<{ message: string }> {
    const { data } = await client.post<{ success: boolean; message: string }>(
      `/rfq/${token}/respond`,
      payload
    );
    return data;
  },

  /**
   * Fetch the list of documents attached to this token.
   */
  async getDocuments(token: string): Promise<Document[]> {
    const { data } = await client.get<{ documents: Document[] }>(`/rfq/${token}/documents`);
    return data.documents;
  },

  /**
   * Upload one or more files as attachments.
   */
  async uploadDocuments(token: string, files: FileList): Promise<Document[]> {
    const form = new FormData();
    Array.from(files).forEach((f) => form.append('files', f));
    const { data } = await client.post<{ documents: Document[] }>(
      `/rfq/${token}/documents`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return data.documents;
  },

  /**
   * Delete an uploaded document.
   */
  async deleteDocument(token: string, filename: string): Promise<Document[]> {
    const { data } = await client.delete<{ documents: Document[] }>(
      `/rfq/${token}/documents/${filename}`
    );
    return data.documents;
  },

  // ── Per-line-item document endpoints ───────────────────────────────────────

  /**
   * Fetch documents attached to a specific line item.
   */
  async getLineDocuments(token: string, itemId: string): Promise<Document[]> {
    const { data } = await client.get<{ documents: Document[] }>(
      `/rfq/${token}/lines/${encodeURIComponent(itemId)}/documents`
    );
    return data.documents;
  },

  /**
   * Upload files attached to a specific line item.
   */
  async uploadLineDocuments(token: string, itemId: string, files: FileList): Promise<Document[]> {
    const form = new FormData();
    Array.from(files).forEach((f) => form.append('files', f));
    const { data } = await client.post<{ documents: Document[] }>(
      `/rfq/${token}/lines/${encodeURIComponent(itemId)}/documents`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return data.documents;
  },

  /**
   * Delete a file from a specific line item.
   */
  async deleteLineDocument(token: string, itemId: string, filename: string): Promise<Document[]> {
    const { data } = await client.delete<{ documents: Document[] }>(
      `/rfq/${token}/lines/${encodeURIComponent(itemId)}/documents/${filename}`
    );
    return data.documents;
  },

  // ── Admin endpoints ────────────────────────────────────────────────────────

  /**
   * Trigger token generation + vendor emails for an RFQ number.
   * Resolves vendor list automatically from D365.
   */
  async sendRFQ(rfqNumber: string): Promise<AdminSendResult> {
    const { data } = await client.post<AdminSendResult>('/admin/rfq-sent', { rfqNumber });
    return data;
  },

  /**
   * Get all current tokens in the store (across all RFQs).
   */
  async getTokens(): Promise<TokenRecord[]> {
    const { data } = await client.get<{ tokens: TokenRecord[] }>('/admin/tokens');
    return data.tokens;
  },

  /**
   * Get vendor response summary for a specific RFQ.
   */
  async getRFQResponses(rfqNumber: string): Promise<VendorResponseSummary[]> {
    const { data } = await client.get<{ rfqNumber: string; vendors: VendorResponseSummary[] }>(
      `/admin/rfq/${rfqNumber}/responses`
    );
    return data.vendors;
  },
};

// ── Admin types ────────────────────────────────────────────────────────────

export interface AdminVendorResult {
  vendorId: string;
  vendorName: string;
  email: string;
  token: string;
  portalUrl: string;
  emailSent: boolean;
  messageId?: string;
  previewUrl?: string;
}

export interface AdminSendResult {
  rfqNumber: string;
  vendors: AdminVendorResult[];
}

export interface TokenRecord {
  token: string;
  rfqNumber: string;
  vendorId: string;
  vendorName: string;
  vendorEmail?: string;
  responseStatus: string;
  createdAt: string;
  expiresAt: string;
  submittedAt?: string;
}

export interface VendorResponseSummary {
  vendorId: string;
  vendorName: string;
  responseStatus: string;
  submittedAt?: string;
  expiresAt: string;
}

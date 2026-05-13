import axios from 'axios';
import { RFQPageData, SubmitPayload, Document, PortalSlot, ConfigureSlotPayload, RFQLookupResult, VendorLookupResult } from '../types/rfq';

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

  // ── Admin / Slot endpoints ─────────────────────────────────────────────────

  /** Get all 5 portal slots. */
  async getSlots(): Promise<PortalSlot[]> {
    const { data } = await client.get<{ slots: PortalSlot[] }>('/admin/slots');
    return data.slots;
  },

  /** Get a single slot (refreshes response statuses). */
  async getSlot(slotId: string): Promise<PortalSlot> {
    const { data } = await client.get<{ slot: PortalSlot }>(`/admin/slots/${slotId}`);
    return data.slot;
  },

  /** Configure a slot with RFQ data + vendors; optionally send emails. */
  async configureSlot(slotId: string, payload: ConfigureSlotPayload): Promise<PortalSlot> {
    const { data } = await client.post<{ slot: PortalSlot }>(
      `/admin/slots/${slotId}/configure`,
      payload
    );
    return data.slot;
  },

  /** (Re)send invitation emails to all vendors on a configured slot. */
  async sendSlotEmails(slotId: string): Promise<PortalSlot> {
    const { data } = await client.post<{ slot: PortalSlot }>(
      `/admin/slots/${slotId}/send-emails`
    );
    return data.slot;
  },

  /** Reset a slot back to empty. */
  async resetSlot(slotId: string): Promise<PortalSlot> {
    const { data } = await client.delete<{ slot: PortalSlot }>(`/admin/slots/${slotId}`);
    return data.slot;
  },

  /** Look up an RFQ in D365 by number — returns header, lines, and vendor list. */
  async lookupRFQ(rfqNumber: string): Promise<RFQLookupResult> {
    const { data } = await client.get<RFQLookupResult>(
      `/admin/rfq-lookup/${encodeURIComponent(rfqNumber)}`
    );
    return data;
  },

  /** Look up a vendor in D365 by account number — returns name and primary email. */
  async lookupVendor(vendorId: string): Promise<VendorLookupResult> {
    const { data } = await client.get<VendorLookupResult>(
      `/admin/vendor-lookup/${encodeURIComponent(vendorId)}`
    );
    return data;
  },
};

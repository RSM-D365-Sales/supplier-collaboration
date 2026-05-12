import { v4 as uuidv4 } from 'uuid';
import { RFQData, TokenRecord, Vendor, VendorResponsePayload } from '../types';
import { MOCK_TOKENS } from '../data/mockData';
import { addDays, isExpired } from '../utils/dateUtils';

// In-memory token store (replace with a database in production)
// Initialised with demo tokens for out-of-the-box demo experience
const tokenStore: Map<string, TokenRecord> = new Map(
  MOCK_TOKENS.map((t) => [t.token, t])
);

export const tokenService = {
  /**
   * Generate unique tokens for each vendor on an RFQ.
   * Pass rfqSnapshot to store the RFQ data on each token (used in mock/demo mode).
   */
  generateTokens(
    rfqId: string,
    rfqNumber: string,
    vendors: Vendor[],
    expiryDays: number = parseInt(process.env.TOKEN_EXPIRY_DAYS ?? '30', 10),
    rfqSnapshot?: Omit<RFQData, 'vendor'>
  ): TokenRecord[] {
    const now = new Date();
    const records: TokenRecord[] = vendors.map((vendor) => ({
      token: uuidv4(),
      rfqId,
      rfqNumber,
      vendorId: vendor.vendorId,
      vendorName: vendor.vendorName,
      vendorEmail: vendor.email,
      createdAt: now.toISOString(),
      expiresAt: addDays(now, expiryDays).toISOString(),
      responseStatus: 'pending',
      ...(rfqSnapshot ? { rfqSnapshot } : {}),
    }));

    records.forEach((r) => tokenStore.set(r.token, r));
    return records;
  },

  /**
   * Look up a token. Returns null if not found or expired.
   */
  findToken(token: string): TokenRecord | null {
    const record = tokenStore.get(token);
    if (!record) return null;
    if (isExpired(record.expiresAt)) return null;
    return record;
  },

  /**
   * Record a vendor's response against their token.
   */
  recordResponse(token: string, response: VendorResponsePayload): boolean {
    const record = tokenStore.get(token);
    if (!record) return false;

    record.responseStatus = response.responseStatus;
    record.submittedAt = new Date().toISOString();
    record.lastResponse = response;
    tokenStore.set(token, record);
    return true;
  },

  /**
   * Return all token records (for admin/audit view).
   */
  getAllTokens(): TokenRecord[] {
    return Array.from(tokenStore.values());
  },

  /**
   * Return all tokens for a specific RFQ.
   */
  getTokensByRFQ(rfqNumber: string): TokenRecord[] {
    return Array.from(tokenStore.values()).filter(
      (t) => t.rfqNumber === rfqNumber
    );
  },
};

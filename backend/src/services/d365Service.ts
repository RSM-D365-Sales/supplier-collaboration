import { ConfidentialClientApplication } from '@azure/msal-node';
import axios, { AxiosInstance } from 'axios';
import { RFQData, LineItemResponse } from '../types';
import { MOCK_RFQ } from '../data/mockData';

/**
 * D365Service – wraps the Dynamics 365 Finance & Supply Chain OData REST API.
 *
 * When USE_MOCK_DATA=true (or D365_BASE_URL is not configured) every method
 * falls back to in-memory mock data so the portal runs without a live D365
 * instance (ideal for demos).
 *
 * D365 OData reference:
 *   https://learn.microsoft.com/en-us/dynamics365/fin-ops-core/dev-itpro/data-entities/odata
 */
export class D365Service {
  private msalClient?: ConfidentialClientApplication;
  private baseUrl: string;
  private httpClient?: AxiosInstance;
  private useMock: boolean;

  constructor() {
    this.baseUrl = (process.env.D365_BASE_URL ?? '').replace(/\/$/, '');
    this.useMock =
      process.env.USE_MOCK_DATA === 'true' || !this.baseUrl;

    if (!this.useMock) {
      this.msalClient = new ConfidentialClientApplication({
        auth: {
          clientId: process.env.D365_CLIENT_ID!,
          authority: `https://login.microsoftonline.com/${process.env.D365_TENANT_ID}`,
          clientSecret: process.env.D365_CLIENT_SECRET!,
        },
      });

      this.httpClient = axios.create({ baseURL: this.baseUrl });

      // Attach a fresh Bearer token before every request
      this.httpClient.interceptors.request.use(async (config) => {
        const token = await this.acquireToken();
        config.headers['Authorization'] = `Bearer ${token}`;
        config.headers['OData-MaxVersion'] = '4.0';
        config.headers['OData-Version'] = '4.0';
        config.headers['Accept'] = 'application/json;odata.metadata=minimal';
        return config;
      });
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async acquireToken(): Promise<string> {
    const result = await this.msalClient!.acquireTokenByClientCredential({
      scopes: [`${this.baseUrl}/.default`],
    });
    if (!result?.accessToken) throw new Error('Failed to acquire D365 token');
    return result.accessToken;
  }

  private odata(path: string) {
    return `${this.baseUrl}/data/${path}`;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Fetch full RFQ data for a given RFQ number and vendor.
   * In mock mode, uses rfqSnapshot stored on the token (if present) so each
   * token can carry a different RFQ; falls back to the default MOCK_RFQ.
   * In live mode, fetches from D365 OData.
   */
  async getRFQ(
    rfqNumber: string,
    vendorId: string,
    vendorName: string,
    rfqSnapshot?: Omit<RFQData, 'vendor'>
  ): Promise<RFQData> {
    if (this.useMock) {
      const base = rfqSnapshot ?? MOCK_RFQ;
      return {
        ...base,
        vendor: { vendorId, vendorName, email: '' },
      };
    }

    // --- Live D365 call ---
    // Uses the published vendor-facing OData entities that are available in this environment.
    // Entity reference (confirmed via $metadata):
    //   Header: PublishedRequestForQuotationHeaders  (key: RFQCaseNumber)
    //   Lines:  PublishedRequestForQuotationLines    (key: PublishedRFQCaseNumber)
    //   Reply lines (read existing prices): RequestForQuotationReplyLines (keys: RFQCaseNumber + VendorAccountNumber + LineNumber)

    // 1. Fetch RFQ header
    const headerRes = await this.httpClient!.get(
      this.odata(
        `PublishedRequestForQuotationHeaders?cross-company=true` +
        `&$filter=RFQCaseNumber eq '${rfqNumber}'`
      )
    );
    const header = headerRes.data.value[0];
    if (!header) throw new Error(`RFQ ${rfqNumber} not found in D365 (not published or wrong number)`);

    // 2. Fetch RFQ lines
    const linesRes = await this.httpClient!.get(
      this.odata(
        `PublishedRequestForQuotationLines?cross-company=true` +
        `&$filter=PublishedRFQCaseNumber eq '${rfqNumber}'` +
        `&$orderby=LineNumber asc`
      )
    );
    const lines: Record<string, unknown>[] = linesRes.data.value;

    // 3. Fetch any existing vendor reply lines (for pre-populated prices)
    let replyLineMap: Record<number, Record<string, unknown>> = {};
    try {
      const replyRes = await this.httpClient!.get(
        this.odata(
          `RequestForQuotationReplyLines?cross-company=true` +
          `&$filter=RFQCaseNumber eq '${rfqNumber}' and VendorAccountNumber eq '${vendorId}'` +
          `&$orderby=LineNumber asc`
        )
      );
      for (const rl of replyRes.data.value as Record<string, unknown>[]) {
        replyLineMap[Number(rl['LineNumber'])] = rl;
      }
    } catch { /* vendor hasn't replied yet — that's fine */ }

    const items = lines.map((line) => {
      const lineNum = Number(line['LineNumber'] ?? 0);
      const reply = replyLineMap[lineNum];
      return {
        itemNumber: lineNum,
        itemId: String(line['ItemNumber'] ?? line['ExternalItemNumber'] ?? ''),
        description: String(line['ProductName'] ?? line['ExternalItemNumber'] ?? ''),
        quantity: Number(line['PurchaseQuantity'] ?? 0),
        unit: String(line['PurchaseUnitSymbol'] ?? 'ea'),
        leadTimeDays: Number(reply?.['ProcurementLeadTimeDays'] ?? 0),
        quotedUnitPrice: Number(reply?.['PurchasePrice'] ?? 0),
        extendedPrice: Number(reply?.['LineAmount'] ?? 0),
      };
    });

    const expiryRaw = String(header['RFQExpirationDateTime'] ?? '');
    const deliveryRaw = String(header['RFQDeliveryDate'] ?? '');

    return {
      rfqNumber: String(header['RFQCaseNumber']),
      rfqStatus: 'SENT',
      entryDate: deliveryRaw.split('T')[0] ?? '',
      expirationDate: expiryRaw.split('T')[0] ?? '',
      customerApprovalStatus: 'OPTIONAL',
      buyerName: String(header['RequesterName'] ?? ''),
      buyerPhone: '',
      buyerEmail: '',
      companyName: String(header['DeliveryAddressName'] ?? header['dataAreaId'] ?? ''),
      instructions: String(header['RFQCaseTitle'] ?? `Please provide pricing for RFQ ${rfqNumber}`),
      vendor: { vendorId, vendorName, email: '' },
      items,
    };
  }

  /**
   * Look up a single vendor by account number.
   * Returns vendorId, name, and primary email.
   */
  async lookupVendor(vendorId: string): Promise<{ vendorId: string; vendorName: string; email: string }> {
    if (this.useMock) {
      return { vendorId, vendorName: `Vendor ${vendorId}`, email: '' };
    }
    const res = await this.httpClient!.get(
      this.odata(
        `Vendors?cross-company=true` +
        `&$filter=VendorAccountNumber eq '${vendorId}'` +
        `&$select=VendorAccountNumber,VendorName,PrimaryEmailAddress&$top=1`
      )
    );
    const v = res.data.value[0];
    if (!v) throw new Error(`Vendor ${vendorId} not found in D365`);
    return {
      vendorId: String(v['VendorAccountNumber'] ?? vendorId),
      vendorName: String(v['VendorName'] ?? vendorId),
      email: String(v['PrimaryEmailAddress'] ?? ''),
    };
  }

  /**
   * Look up an RFQ by number for the admin configure form.
   * Returns the RFQ header, line items, and list of invited vendors.
   * In mock mode returns demo data so the form can be tested without D365.
   */
  async lookupRFQForAdmin(rfqNumber: string): Promise<{
    rfqData: Omit<RFQData, 'vendor'>;
    vendors: Array<{ vendorId: string; vendorName: string; email: string }>;
  }> {
    if (this.useMock) {
      return {
        rfqData: { ...MOCK_RFQ, rfqNumber },
        vendors: [
          { vendorId: 'V-001', vendorName: 'Flo-Tech Solutions', email: '' },
          { vendorId: 'V-002', vendorName: 'Tech Supplies Inc', email: '' },
          { vendorId: 'V-003', vendorName: 'Global Components', email: '' },
        ],
      };
    }

    // 1. Fetch RFQ header
    const headerRes = await this.httpClient!.get(
      this.odata(
        `PublishedRequestForQuotationHeaders?cross-company=true` +
        `&$filter=RFQCaseNumber eq '${rfqNumber}'`
      )
    );
    const header = headerRes.data.value[0];
    if (!header) throw new Error(`RFQ ${rfqNumber} not found in D365 (not published or wrong number)`);

    // 2. Fetch RFQ lines
    const linesRes = await this.httpClient!.get(
      this.odata(
        `PublishedRequestForQuotationLines?cross-company=true` +
        `&$filter=PublishedRFQCaseNumber eq '${rfqNumber}'` +
        `&$orderby=LineNumber asc`
      )
    );
    const lines: Record<string, unknown>[] = linesRes.data.value;

    // Try to get vendor account numbers from reply headers (may be empty if
    // no vendors have been invited/responded yet). Then look each one up.
    let vendors: Array<{ vendorId: string; vendorName: string; email: string }> = [];
    try {
      const replyHeadersRes = await this.httpClient!.get(
        this.odata(
          `RequestForQuotationReplyHeaders?cross-company=true` +
          `&$filter=RFQNumber eq '${rfqNumber}'` +
          `&$select=VendorAccountNumber&$top=20`
        )
      );
      const vendorIds = (replyHeadersRes.data.value as Record<string, unknown>[]).map(
        (v) => String(v['VendorAccountNumber'])
      ).filter(Boolean);

      for (const vid of vendorIds) {
        try {
          vendors.push(await this.lookupVendor(vid));
        } catch { /* skip vendors that can't be resolved */ }
      }
    } catch { /* reply headers may not exist yet — admin will add vendors manually */ }

    const items = lines.map((line) => ({
      itemNumber: Number(line['LineNumber'] ?? 0),
      itemId: String(line['ItemNumber'] ?? line['ExternalItemNumber'] ?? ''),
      description: String(line['ProductName'] ?? line['ExternalItemNumber'] ?? ''),
      quantity: Number(line['PurchaseQuantity'] ?? 0),
      unit: String(line['PurchaseUnitSymbol'] ?? 'ea'),
      leadTimeDays: 0,
      quotedUnitPrice: 0,
      extendedPrice: 0,
    }));

    const expiryRaw = String(header['RFQExpirationDateTime'] ?? '');
    const deliveryRaw = String(header['RFQDeliveryDate'] ?? '');

    return {
      rfqData: {
        rfqNumber: String(header['RFQCaseNumber']),
        rfqStatus: 'SENT',
        entryDate: deliveryRaw.split('T')[0] ?? '',
        expirationDate: expiryRaw.split('T')[0] ?? '',
        customerApprovalStatus: 'OPTIONAL',
        buyerName: String(header['RequesterName'] ?? ''),
        buyerPhone: '',
        buyerEmail: '',
        companyName: String(header['DeliveryAddressName'] ?? header['dataAreaId'] ?? ''),
        instructions: String(header['RFQCaseTitle'] ?? `Please provide pricing for RFQ ${rfqNumber}`),
        items,
      },
      vendors,
    };
  }

  /**
   * Write a vendor's reply back to D365.
   * Uses RequestForQuotationReplyHeaders and RequestForQuotationReplyLines.
   */
  async submitVendorReply(
    rfqNumber: string,
    vendorId: string,
    responseStatus: string,
    quoteValidDays: number,
    quotedDate: string,
    lineResponses: LineItemResponse[]
  ): Promise<void> {
    if (this.useMock) {
      // In mock mode just log — no actual D365 call
      console.log('[MOCK] D365 write-back:', { rfqNumber, vendorId, responseStatus, lineResponses });
      return;
    }

    // 1. PATCH the reply header (update existing reply record)
    // RequestForQuotationReplyHeaders key: RFQNumber + VendorAccountNumber
    try {
      await this.httpClient!.patch(
        this.odata(`RequestForQuotationReplyHeaders(RFQNumber='${rfqNumber}',VendorAccountNumber='${vendorId}')`),
        {
          QuoteValidDays: quoteValidDays,
          QuoteDate: quotedDate || undefined,
        }
      );
    } catch {
      // Header record may not exist yet for this vendor — log and continue to line updates
      console.warn(`[D365] Could not PATCH reply header for RFQ ${rfqNumber} vendor ${vendorId} — may not exist yet`);
    }

    // 2. PATCH each reply line with the vendor's price.
    // Rejected lines are skipped — the vendor has indicated they cannot supply
    // that item, so we leave the existing D365 record untouched.
    for (const line of lineResponses) {
      if (line.rejected) {
        console.log(`[D365] Skipping rejected line ${line.itemNumber} for RFQ ${rfqNumber}`);
        continue;
      }
      try {
        await this.httpClient!.patch(
          this.odata(
            `RequestForQuotationReplyLines(RFQNumber='${rfqNumber}',` +
            `VendorAccountNumber='${vendorId}',LineNumber=${line.itemNumber})`
          ),
          {
            PurchasePrice: line.quotedUnitPrice,
            ProcurementLeadTimeDays: line.leadTimeDays,
            LineAmount: line.extendedPrice,
            LineDescription: line.notes ?? '',
          }
        );
      } catch (lineErr: unknown) {
        const e = lineErr as unknown as Record<string,unknown>;
        const resp = e['response'] as Record<string,unknown> | undefined;
        console.warn(`[D365] Could not PATCH reply line ${line.itemNumber} for RFQ ${rfqNumber}:`, resp?.['data'] ?? e['message']);
      }
    }
  }

  /**
   * Return the list of vendors invited to an RFQ.
   * Queries RequestForQuotationReplyHeaders (one record per vendor per RFQ case).
   * NOTE: filter must use RFQCaseNumber (the original RFQ case), NOT RFQNumber (the vendor reply number).
   */
  async getVendorsForRFQ(rfqNumber: string): Promise<Array<{
    vendorId: string;
    vendorName: string;
    email: string;
  }>> {
    if (this.useMock) {
      return []; // mock mode: caller should supply vendors in the request body
    }

    const res = await this.httpClient!.get(
      this.odata(
        `RequestForQuotationReplyHeaders?cross-company=true` +
        `&$filter=RFQCaseNumber eq '${rfqNumber}'` +
        `&$select=VendorAccountNumber,RFQName,VendorEmailAddress,HighestRFQStatus`
      )
    );
    return (res.data.value as Record<string, unknown>[]).map((v) => ({
      vendorId: String(v['VendorAccountNumber'] ?? ''),
      vendorName: String(v['RFQName'] ?? v['VendorAccountNumber'] ?? ''),
      email: String(v['VendorEmailAddress'] ?? ''),
    }));
  }

  /**
   * Fetch just the header metadata for an RFQ (title, buyer, expiry, etc.).
   * Used to populate email templates when we don't need full line-item data.
   */
  async getRFQHeader(rfqNumber: string): Promise<{
    rfqTitle: string;
    buyerName: string;
    buyerPhone: string;
    buyerEmail: string;
    companyName: string;
    expirationDate: string;
  }> {
    if (this.useMock) {
      return {
        rfqTitle: MOCK_RFQ.instructions ?? '',
        buyerName: MOCK_RFQ.buyerName,
        buyerPhone: MOCK_RFQ.buyerPhone,
        buyerEmail: MOCK_RFQ.buyerEmail,
        companyName: MOCK_RFQ.companyName,
        expirationDate: MOCK_RFQ.expirationDate,
      };
    }

    const res2 = await this.httpClient!.get(
      this.odata(
        `PublishedRequestForQuotationHeaders?cross-company=true` +
        `&$filter=RFQCaseNumber eq '${rfqNumber}'`
      )
    );
    const header = res2.data.value[0] as Record<string, unknown> | undefined;
    if (!header) throw new Error(`RFQ ${rfqNumber} not found in D365`);

    const expiryRaw = String(header['RFQExpirationDateTime'] ?? '');
    return {
      rfqTitle: String(header['RFQCaseTitle'] ?? ''),
      buyerName: String(header['RequesterName'] ?? ''),
      buyerPhone: '',
      buyerEmail: '',
      companyName: String(header['DeliveryAddressName'] ?? header['dataAreaId'] ?? ''),
      expirationDate: expiryRaw.split('T')[0] ?? '',
    };
  }
}

// Singleton
export const d365Service = new D365Service();

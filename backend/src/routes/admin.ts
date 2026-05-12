import { Router, Request, Response } from 'express';
import { tokenService } from '../services/tokenService';
import { emailService } from '../services/emailService';
import { d365Service } from '../services/d365Service';
import { GenerateTokensRequest, GenerateTokensResponse } from '../types';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

/**
 * POST /api/admin/generate-tokens
 *
 * Called by D365 Business Event / Power Automate when an RFQ is sent to vendors.
 * Returns a tokenized portal URL per vendor — these URLs are included in vendor emails.
 *
 * Body: {
 *   rfqId: string;
 *   rfqNumber: string;
 *   vendors: Array<{ vendorId, vendorName, email }>;
 *   expiryDays?: number;
 * }
 */
router.post('/generate-tokens', (req: Request, res: Response) => {
  const body: GenerateTokensRequest = req.body;

  if (!body.rfqId || !body.rfqNumber || !Array.isArray(body.vendors) || body.vendors.length === 0) {
    res.status(400).json({
      error: 'rfqId, rfqNumber, and at least one vendor are required.',
    });
    return;
  }

  const records = tokenService.generateTokens(
    body.rfqId,
    body.rfqNumber,
    body.vendors,
    body.expiryDays,
    body.rfqData  // optional inline RFQ payload stored on each token
  );

  const response: GenerateTokensResponse = {
    tokens: records.map((r) => ({
      vendorId: r.vendorId,
      vendorName: r.vendorName,
      token: r.token,
      portalUrl: `${FRONTEND_URL}/rfq/${r.token}`,
    })),
  };

  res.json(response);
});

/**
 * GET /api/admin/rfq/:rfqNumber/responses
 *
 * Returns all vendor response statuses for an RFQ (for buyer visibility).
 */
router.get('/rfq/:rfqNumber/responses', (req: Request, res: Response) => {
  const { rfqNumber } = req.params;
  const tokens = tokenService.getTokensByRFQ(rfqNumber);

  const summary = tokens.map((t) => ({
    vendorId: t.vendorId,
    vendorName: t.vendorName,
    responseStatus: t.responseStatus,
    submittedAt: t.submittedAt,
    expiresAt: t.expiresAt,
    response: t.lastResponse,
  }));

  res.json({ rfqNumber, vendors: summary });
});

/**
 * GET /api/admin/tokens
 *
 * Returns all tokens in the store (for debugging / admin UI).
 */
router.get('/tokens', (_req: Request, res: Response) => {
  res.json({ tokens: tokenService.getAllTokens() });
});

/**
 * POST /api/admin/rfq-sent
 *
 * Business Event endpoint — called by D365 / Power Automate when an RFQ is sent to vendors.
 * Looks up the invited vendors in D365, generates a unique portal token per vendor,
 * and sends each vendor a branded invitation email.
 *
 * Body: { rfqNumber: string }
 * The vendor list is resolved automatically from D365 (RequestForQuotationReplyHeaders).
 */
router.post('/rfq-sent', async (req: Request, res: Response) => {
  const { rfqNumber } = req.body as { rfqNumber?: string };

  if (!rfqNumber) {
    res.status(400).json({ error: 'rfqNumber is required' });
    return;
  }

  try {
    // 1. Resolve vendors invited to this RFQ from D365
    const vendors = await d365Service.getVendorsForRFQ(rfqNumber);
    if (!vendors.length) {
      res.status(404).json({ error: `No vendors found for RFQ ${rfqNumber} in D365` });
      return;
    }

    // 2. Fetch RFQ header metadata (title, buyer, expiry) for email content
    const header = await d365Service.getRFQHeader(rfqNumber);

    // 3. Generate a token and send an email for each vendor
    const results = [];
    for (const vendor of vendors) {
      const [record] = tokenService.generateTokens(
        rfqNumber,
        rfqNumber,
        [{ vendorId: vendor.vendorId, vendorName: vendor.vendorName, email: vendor.email }],
      );

      const portalUrl = `${FRONTEND_URL}/rfq/${record.token}`;

      let messageId: string | undefined;
      let previewUrl: string | undefined;

      if (vendor.email) {
        const sent = await emailService.sendRFQInvite({
          toEmail: vendor.email,
          toName: vendor.vendorName,
          rfqNumber,
          rfqTitle: header.rfqTitle,
          vendorName: vendor.vendorName,
          buyerName: header.buyerName,
          buyerPhone: header.buyerPhone,
          buyerEmail: header.buyerEmail,
          companyName: header.companyName,
          expirationDate: header.expirationDate,
          portalUrl,
        });
        messageId = sent.messageId;
        previewUrl = sent.previewUrl;
      }

      results.push({
        vendorId: vendor.vendorId,
        vendorName: vendor.vendorName,
        email: vendor.email || '(no email on record)',
        token: record.token,
        portalUrl,
        emailSent: !!vendor.email,
        ...(messageId ? { messageId } : {}),
        ...(previewUrl ? { previewUrl } : {}),
      });
    }

    res.json({ rfqNumber, vendors: results });
  } catch (err: unknown) {
    const e = err as Error;
    console.error('[rfq-sent]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/admin/email-preview/:token
 *
 * Renders the invitation email for a given token as HTML in the browser.
 * Useful for previewing the email without sending it.
 */
router.get('/email-preview/:token', async (req: Request, res: Response) => {
  const record = tokenService.findToken(req.params.token);
  if (!record) {
    res.status(404).send('<p>Token not found or expired.</p>');
    return;
  }

  try {
    const header = await d365Service.getRFQHeader(record.rfqNumber);
    const portalUrl = `${FRONTEND_URL}/rfq/${record.token}`;

    const html = emailService.buildEmailHtml({
      rfqNumber: record.rfqNumber,
      rfqTitle: header.rfqTitle,
      vendorName: record.vendorName,
      buyerName: header.buyerName,
      buyerPhone: header.buyerPhone,
      buyerEmail: header.buyerEmail,
      companyName: header.companyName,
      expirationDate: header.expirationDate,
      portalUrl,
    });

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err: unknown) {
    const e = err as Error;
    res.status(500).send(`<p>Error: ${e.message}</p>`);
  }
});

export { router as adminRouter };

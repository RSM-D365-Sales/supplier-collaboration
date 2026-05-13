import { Router, Request, Response } from 'express';
import { tokenService } from '../services/tokenService';
import { emailService } from '../services/emailService';
import { slotService } from '../services/slotService';
import { d365Service } from '../services/d365Service';
import { ConfigureSlotRequest } from '../types';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

// ─── Portal Slot endpoints ────────────────────────────────────────────────────

/**
 * GET /api/admin/slots
 * Returns all 5 portal slots with current status.
 */
router.get('/slots', (_req: Request, res: Response) => {
  res.json({ slots: slotService.getAll() });
});

/**
 * GET /api/admin/slots/:slotId
 * Returns a single slot, refreshing vendor response statuses from the token store.
 */
router.get('/slots/:slotId', (req: Request, res: Response) => {
  const slot = slotService.syncResponseStatuses(req.params.slotId);
  if (!slot) { res.status(404).json({ error: 'Slot not found' }); return; }
  res.json({ slot });
});

/**
 * POST /api/admin/slots/:slotId/configure
 * Configure (or reconfigure) a slot with manually-entered RFQ data + vendor list.
 * Generates one token per vendor. Pass sendEmails:true to dispatch invitations.
 */
router.post('/slots/:slotId/configure', async (req: Request, res: Response) => {
  const { slotId } = req.params;
  const body = req.body as ConfigureSlotRequest;

  if (!body.rfqNumber || !body.rfqData || !Array.isArray(body.vendors) || body.vendors.length === 0) {
    res.status(400).json({ error: 'rfqNumber, rfqData, and at least one vendor are required.' });
    return;
  }

  try {
    const slot = await slotService.configure(slotId, body);
    res.json({ slot });
  } catch (err: unknown) {
    const e = err as Error;
    res.status(400).json({ error: e.message });
  }
});

/**
 * POST /api/admin/slots/:slotId/send-emails
 * (Re)send invitation emails to all vendors on an already-configured slot.
 */
router.post('/slots/:slotId/send-emails', async (req: Request, res: Response) => {
  try {
    const slot = await slotService.sendEmails(req.params.slotId);
    res.json({ slot });
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message });
  }
});

/**
 * DELETE /api/admin/slots/:slotId
 * Reset a slot back to empty.
 */
router.delete('/slots/:slotId', (req: Request, res: Response) => {
  try {
    const slot = slotService.reset(req.params.slotId);
    res.json({ slot });
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message });
  }
});

/**
 * GET /api/admin/vendor-lookup/:vendorId
 * Queries D365 Vendors entity for name and primary email by account number.
 */
router.get('/vendor-lookup/:vendorId', async (req: Request, res: Response) => {
  const { vendorId } = req.params;
  if (!/^[A-Za-z0-9\-_.]+$/.test(vendorId)) {
    res.status(400).json({ error: 'Invalid vendor ID format.' });
    return;
  }
  try {
    const result = await d365Service.lookupVendor(vendorId);
    res.json(result);
  } catch (err: unknown) {
    res.status(404).json({ error: (err as Error).message });
  }
});

/**
 * GET /api/admin/rfq-lookup/:rfqNumber
 * Queries D365 for the RFQ header, line items, and invited vendors.
 * Returns data suitable for pre-filling the admin configure form.
 */
router.get('/rfq-lookup/:rfqNumber', async (req: Request, res: Response) => {
  const { rfqNumber } = req.params;
  // Validate: only allow safe characters to prevent OData injection
  if (!/^[A-Za-z0-9\-_.]+$/.test(rfqNumber)) {
    res.status(400).json({ error: 'Invalid RFQ number format.' });
    return;
  }
  try {
    const result = await d365Service.lookupRFQForAdmin(rfqNumber);
    res.json(result);
  } catch (err: unknown) {
    res.status(404).json({ error: (err as Error).message });
  }
});

/**
 * GET /api/admin/tokens
 * Returns all tokens in the store (for debugging).
 */
router.get('/tokens', (_req: Request, res: Response) => {
  res.json({ tokens: tokenService.getAllTokens() });
});

/**
 * GET /api/admin/email-preview/:token
 * Renders the invitation email for a given token as HTML in the browser.
 */
router.get('/email-preview/:token', (req: Request, res: Response) => {
  const record = tokenService.findToken(req.params.token);
  if (!record) {
    res.status(404).send('<p>Token not found or expired.</p>');
    return;
  }

  const rfqData = record.rfqSnapshot;
  if (!rfqData) {
    res.status(400).send('<p>No RFQ data stored on this token.</p>');
    return;
  }

  const portalUrl = `${FRONTEND_URL}/rfq/${record.token}`;
  const html = emailService.buildEmailHtml({
    rfqNumber: record.rfqNumber,
    rfqTitle: `RFQ ${record.rfqNumber} – ${rfqData.companyName}`,
    vendorName: record.vendorName,
    buyerName: rfqData.buyerName,
    buyerPhone: rfqData.buyerPhone,
    buyerEmail: rfqData.buyerEmail,
    companyName: rfqData.companyName,
    expirationDate: rfqData.expirationDate,
    portalUrl,
  });

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

export { router as adminRouter };

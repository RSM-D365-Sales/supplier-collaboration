import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { validateToken } from '../middleware/validateToken';
import { d365Service } from '../services/d365Service';
import { tokenService } from '../services/tokenService';
import { TokenRecord, VendorResponsePayload } from '../types';

const router = Router();

// ─── File upload configuration ────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /pdf|docx?|xlsx?|png|jpe?g/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Allowed: PDF, Word, Excel, PNG, JPEG'));
    }
  },
});

// Simple in-memory document store per token (swap for Azure Blob in production)
const documentStore: Map<string, Array<{ name: string; path: string; uploadedAt: string }>> =
  new Map();

// Per-line-item document store: key = `${token}:${itemId}`
const lineDocumentStore: Map<string, Array<{ name: string; path: string; uploadedAt: string }>> =
  new Map();

function lineKey(token: string, itemId: string): string {
  return `${token}:${itemId}`;
}

// ─── GET /api/rfq/:token ──────────────────────────────────────────────────────
// Returns the RFQ data for the vendor identified by the token
router.get('/:token', validateToken, async (req: Request, res: Response) => {
  const record: TokenRecord = res.locals.tokenRecord;
  try {
    const rfq = await d365Service.getRFQ(
      record.rfqNumber,
      record.vendorId,
      record.vendorName,
      record.rfqSnapshot
    );

    // Merge any previously saved response back into the items
    if (record.lastResponse) {
      const saved = record.lastResponse;
      rfq.items = rfq.items.map((item) => {
        const savedItem = saved.items.find((i) => i.itemId === item.itemId);
        return savedItem
          ? {
              ...item,
              leadTimeDays: savedItem.leadTimeDays,
              quotedUnitPrice: savedItem.quotedUnitPrice,
              extendedPrice: savedItem.extendedPrice,
              notes: savedItem.notes ?? item.notes,
              rejected: savedItem.rejected ?? false,
            }
          : item;
      });
    }

    res.json({
      rfq,
      meta: {
        responseStatus: record.responseStatus,
        submittedAt: record.submittedAt,
        expiresAt: record.expiresAt,
        quoteValidDays: record.lastResponse?.quoteValidDays ?? 0,
        quotedDate: record.lastResponse?.quotedDate ?? '',
        generalNotes: record.lastResponse?.generalNotes ?? '',
      },
    });
  } catch (err) {
    console.error('Error fetching RFQ:', err);
    res.status(500).json({ error: 'Failed to retrieve RFQ data.' });
  }
});

// ─── POST /api/rfq/:token/respond ────────────────────────────────────────────
// Vendor submits or updates their response
router.post('/:token/respond', validateToken, async (req: Request, res: Response) => {
  const record: TokenRecord = res.locals.tokenRecord;
  const payload: VendorResponsePayload = req.body;

  if (!payload.responseStatus) {
    res.status(400).json({ error: 'responseStatus is required.' });
    return;
  }

  const validStatuses = ['replied', 'declined', 'no-reply'];
  if (!validStatuses.includes(payload.responseStatus)) {
    res.status(400).json({ error: `responseStatus must be one of: ${validStatuses.join(', ')}` });
    return;
  }

  // Preserve the client-computed extendedPrice (frontend multiplied unitPrice × quantity).
  // We keep the value as-is; D365 will recompute on its side from price × qty.
  // Rejected lines come through with their flag intact — submitVendorReply skips patching them.
  if (payload.items) {
    payload.items = payload.items.map((item) => ({
      ...item,
      extendedPrice: item.rejected ? 0 : parseFloat((item.extendedPrice ?? 0).toFixed(2)),
    }));
  }

  try {
    // 1. Write back to D365
    await d365Service.submitVendorReply(
      record.rfqNumber,
      record.vendorId,
      payload.responseStatus,
      payload.quoteValidDays,
      payload.quotedDate,
      payload.items ?? []
    );

    // 2. Update token store
    tokenService.recordResponse(record.token, payload);

    res.json({ success: true, message: 'Your response has been recorded successfully.' });
  } catch (err) {
    console.error('Error submitting response:', err);
    res.status(500).json({ error: 'Failed to submit your response. Please try again.' });
  }
});

// ─── GET /api/rfq/:token/documents ───────────────────────────────────────────
router.get('/:token/documents', validateToken, (req: Request, res: Response) => {
  const record: TokenRecord = res.locals.tokenRecord;
  const docs = documentStore.get(record.token) ?? [];
  res.json({ documents: docs });
});

// ─── POST /api/rfq/:token/documents ──────────────────────────────────────────
router.post(
  '/:token/documents',
  validateToken,
  upload.array('files', 10),
  (req: Request, res: Response) => {
    const record: TokenRecord = res.locals.tokenRecord;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files received.' });
      return;
    }

    const existing = documentStore.get(record.token) ?? [];
    const newDocs = files.map((f) => ({
      name: f.originalname,
      path: f.filename,
      uploadedAt: new Date().toISOString(),
    }));
    documentStore.set(record.token, [...existing, ...newDocs]);

    res.json({ success: true, documents: documentStore.get(record.token) });
  }
);

// ─── DELETE /api/rfq/:token/documents/:filename ───────────────────────────────
router.delete('/:token/documents/:filename', validateToken, (req: Request, res: Response) => {
  const record: TokenRecord = res.locals.tokenRecord;
  const { filename } = req.params;

  const existing = documentStore.get(record.token) ?? [];
  const updated = existing.filter((d) => d.path !== filename);
  documentStore.set(record.token, updated);

  res.json({ success: true, documents: updated });
});

// ─── GET /api/rfq/:token/lines/:itemId/documents ──────────────────────────────
router.get('/:token/lines/:itemId/documents', validateToken, (req: Request, res: Response) => {
  const record: TokenRecord = res.locals.tokenRecord;
  const itemId = decodeURIComponent(req.params['itemId']);
  const docs = lineDocumentStore.get(lineKey(record.token, itemId)) ?? [];
  res.json({ documents: docs });
});

// ─── POST /api/rfq/:token/lines/:itemId/documents ─────────────────────────────
router.post(
  '/:token/lines/:itemId/documents',
  validateToken,
  upload.array('files', 10),
  (req: Request, res: Response) => {
    const record: TokenRecord = res.locals.tokenRecord;
    const itemId = decodeURIComponent(req.params['itemId']);
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files received.' });
      return;
    }

    const key = lineKey(record.token, itemId);
    const existing = lineDocumentStore.get(key) ?? [];
    const newDocs = files.map((f) => ({
      name: f.originalname,
      path: f.filename,
      uploadedAt: new Date().toISOString(),
    }));
    lineDocumentStore.set(key, [...existing, ...newDocs]);

    res.json({ success: true, documents: lineDocumentStore.get(key) });
  }
);

// ─── DELETE /api/rfq/:token/lines/:itemId/documents/:filename ─────────────────
router.delete(
  '/:token/lines/:itemId/documents/:filename',
  validateToken,
  (req: Request, res: Response) => {
    const record: TokenRecord = res.locals.tokenRecord;
    const itemId = decodeURIComponent(req.params['itemId']);
    const { filename } = req.params;

    const key = lineKey(record.token, itemId);
    const existing = lineDocumentStore.get(key) ?? [];
    const updated = existing.filter((d) => d.path !== filename);
    lineDocumentStore.set(key, updated);

    res.json({ success: true, documents: updated });
  }
);

export { router as rfqRouter };

import { PortalSlot, SlotVendor, ConfigureSlotRequest, RFQData } from '../types';
import { tokenService } from './tokenService';
import { emailService } from './emailService';

const MAX_SLOTS = 5;
const FRONTEND_URL = () => process.env.FRONTEND_URL ?? 'http://localhost:5175';

// ─── In-memory slot store ─────────────────────────────────────────────────────
const slots: Map<string, PortalSlot> = new Map();

for (let i = 1; i <= MAX_SLOTS; i++) {
  const slotId = `slot-${i}`;
  slots.set(slotId, {
    slotId,
    label: `Portal ${i}`,
    status: 'empty',
    vendors: [],
  });
}

export const slotService = {
  getAll(): PortalSlot[] {
    return Array.from(slots.values());
  },

  getById(slotId: string): PortalSlot | null {
    return slots.get(slotId) ?? null;
  },

  /**
   * Configure a slot with RFQ data + vendor list.
   * Generates a unique token per vendor. Optionally sends invitation emails.
   */
  async configure(
    slotId: string,
    req: ConfigureSlotRequest
  ): Promise<PortalSlot> {
    const slot = slots.get(slotId);
    if (!slot) throw new Error(`Slot ${slotId} not found`);

    // Normalise vendors — assign a vendorId if not provided
    const vendors = req.vendors.map((v, idx) => ({
      vendorId: v.vendorId ?? `${slotId}-vendor-${idx + 1}`,
      vendorName: v.vendorName,
      email: v.email,
    }));

    // Generate tokens (store rfqSnapshot so the RFQ page can load data)
    const rfqSnapshot: Omit<RFQData, 'vendor'> = req.rfqData;
    const records = tokenService.generateTokens(
      slotId,
      req.rfqNumber,
      vendors,
      req.expiryDays,
      rfqSnapshot
    );

    const slotVendors: SlotVendor[] = [];

    for (const record of records) {
      const portalUrl = `${FRONTEND_URL()}/rfq/${record.token}`;
      let emailSent = false;

      if (req.sendEmails && record.vendorEmail) {
        try {
          await emailService.sendRFQInvite({
            toEmail: record.vendorEmail,
            toName: record.vendorName,
            rfqNumber: req.rfqNumber,
            rfqTitle: req.rfqData.companyName
              ? `RFQ ${req.rfqNumber} – ${req.rfqData.companyName}`
              : `RFQ ${req.rfqNumber}`,
            vendorName: record.vendorName,
            buyerName: req.rfqData.buyerName,
            buyerPhone: req.rfqData.buyerPhone,
            buyerEmail: req.rfqData.buyerEmail,
            companyName: req.rfqData.companyName,
            expirationDate: req.rfqData.expirationDate,
            portalUrl,
          });
          emailSent = true;
        } catch (e) {
          console.error(`[slotService] Email failed for ${record.vendorEmail}:`, (e as Error).message);
        }
      }

      slotVendors.push({
        vendorId: record.vendorId,
        vendorName: record.vendorName,
        email: record.vendorEmail,
        token: record.token,
        portalUrl,
        responseStatus: record.responseStatus,
        emailSent,
      });
    }

    const updated: PortalSlot = {
      slotId,
      label: req.label ?? slot.label,
      status: 'active',
      rfqNumber: req.rfqNumber,
      rfqData: req.rfqData,
      vendors: slotVendors,
      updatedAt: new Date().toISOString(),
    };

    slots.set(slotId, updated);
    return updated;
  },

  /**
   * Send (or resend) invitation emails for all vendors on an already-configured slot.
   */
  async sendEmails(slotId: string): Promise<PortalSlot> {
    const slot = slots.get(slotId);
    if (!slot || slot.status === 'empty') throw new Error(`Slot ${slotId} is not configured`);

    const rfqData = slot.rfqData!;

    for (const v of slot.vendors) {
      if (!v.email) continue;
      try {
        await emailService.sendRFQInvite({
          toEmail: v.email,
          toName: v.vendorName,
          rfqNumber: slot.rfqNumber!,
          rfqTitle: `RFQ ${slot.rfqNumber} – ${rfqData.companyName}`,
          vendorName: v.vendorName,
          buyerName: rfqData.buyerName,
          buyerPhone: rfqData.buyerPhone,
          buyerEmail: rfqData.buyerEmail,
          companyName: rfqData.companyName,
          expirationDate: rfqData.expirationDate,
          portalUrl: v.portalUrl,
        });
        v.emailSent = true;
      } catch (e) {
        console.error(`[slotService] Resend failed for ${v.email}:`, (e as Error).message);
      }
    }

    slot.updatedAt = new Date().toISOString();
    slots.set(slotId, slot);
    return slot;
  },

  /** Sync response statuses from the token store into the slot vendor list */
  syncResponseStatuses(slotId: string): PortalSlot | null {
    const slot = slots.get(slotId);
    if (!slot) return null;
    for (const v of slot.vendors) {
      const record = tokenService.findToken(v.token);
      if (record) v.responseStatus = record.responseStatus;
    }
    slots.set(slotId, slot);
    return slot;
  },

  reset(slotId: string): PortalSlot {
    const slot = slots.get(slotId);
    if (!slot) throw new Error(`Slot ${slotId} not found`);
    const label = slot.label; // preserve the human-readable label
    const reset: PortalSlot = { slotId, label, status: 'empty', vendors: [] };
    slots.set(slotId, reset);
    return reset;
  },
};

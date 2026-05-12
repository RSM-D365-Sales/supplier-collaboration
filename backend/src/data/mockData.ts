import { RFQData, TokenRecord } from '../types';
import { addDays } from '../utils/dateUtils';

// ─────────────────────────────────────────────────────────────────────────────
// Mock RFQ data – mirrors what D365 F&SC OData would return for RFQ 000334
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_RFQ: Omit<RFQData, 'vendor'> = {
  rfqNumber: '000334',
  rfqStatus: 'SENT',
  entryDate: '2025-05-22',
  expirationDate: '2025-06-22',
  customerApprovalStatus: 'OPTIONAL',
  buyerName: 'Mike Smith',
  buyerPhone: '+1 (549) 853-1234',
  buyerEmail: 'sara@eyvo.com',
  companyName: 'Stark Industries',
  instructions:
    'Please provide your best price(s) for the following items and submit your quote no later than 22-Jun-2025. ' +
    'In the event of a query please contact Mike Smith.',
  items: [
    {
      itemNumber: 1,
      itemId: 'ITEM-001',
      description: 'HP, Server Hard Drive, 60GB ATA Hard Drive, 354052',
      quantity: 2.0,
      unit: 'ea',
      leadTimeDays: 1,
      quotedUnitPrice: 0.0,
      extendedPrice: 0.0,
    },
    {
      itemNumber: 2,
      itemId: 'ITEM-002',
      description: 'HP Inkjet 2280TN',
      quantity: 2.0,
      unit: 'ea',
      leadTimeDays: 1,
      quotedUnitPrice: 0.0,
      extendedPrice: 0.0,
    },
    {
      itemNumber: 3,
      itemId: 'ITEM-003',
      description: 'Lenovo Thinkpad Convertible Monitor Stand',
      quantity: 3.0,
      unit: 'ea',
      leadTimeDays: 1,
      quotedUnitPrice: 0.0,
      extendedPrice: 0.0,
    },
    {
      itemNumber: 4,
      itemId: 'ITEM-004',
      description: 'Lenovo Thinkpad T61 6459CTO',
      quantity: 2.0,
      unit: 'ea',
      leadTimeDays: 2,
      quotedUnitPrice: 0.0,
      extendedPrice: 0.0,
    },
    {
      itemNumber: 5,
      itemId: 'ITEM-005',
      description: 'Maxtor, Memory Storage, Personal Storage 3000LS External Hard Drive',
      quantity: 3.0,
      unit: 'ea',
      leadTimeDays: 2,
      quotedUnitPrice: 0.0,
      extendedPrice: 0.0,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Pre-seeded demo tokens (3 vendors for the same RFQ)
// These are used when USE_MOCK_DATA=true so demos work out of the box
// ─────────────────────────────────────────────────────────────────────────────

const now = new Date().toISOString();
const expiry = addDays(new Date(), 30).toISOString();

export const MOCK_TOKENS: TokenRecord[] = [
  {
    token: 'demo-token-flotech-001',
    rfqId: 'RFQ-000334',
    rfqNumber: '000334',
    vendorId: 'VEND-001',
    vendorName: 'Flo-Tech',
    vendorEmail: 'quotes@flo-tech.com',
    createdAt: now,
    expiresAt: expiry,
    responseStatus: 'pending',
    rfqSnapshot: MOCK_RFQ,
  },
  {
    token: 'demo-token-techsol-002',
    rfqId: 'RFQ-000334',
    rfqNumber: '000334',
    vendorId: 'VEND-002',
    vendorName: 'Tech Solutions Inc',
    vendorEmail: 'rfq@techsolutions.com',
    createdAt: now,
    expiresAt: expiry,
    responseStatus: 'pending',
    rfqSnapshot: MOCK_RFQ,
  },
  {
    token: 'demo-token-globsup-003',
    rfqId: 'RFQ-000334',
    rfqNumber: '000334',
    vendorId: 'VEND-003',
    vendorName: 'Global Supplies Co',
    vendorEmail: 'purchasing@globalsupplies.com',
    createdAt: now,
    expiresAt: expiry,
    responseStatus: 'pending',
    rfqSnapshot: MOCK_RFQ,
  },
];

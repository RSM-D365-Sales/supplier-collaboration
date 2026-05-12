import { RFQData } from '../types/rfq';

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface RFQInfoProps {
  rfq: RFQData;
}

export default function RFQInfo({ rfq }: RFQInfoProps) {
  return (
    <div className="bg-white border-b border-gray-200">
      {/* Title bar */}
      <div className="bg-brand-600 text-white px-6 py-2 text-center text-sm font-semibold tracking-wide">
        Request for Quotation – Response
      </div>

      {/* Info row */}
      <div className="flex divide-x divide-gray-200 px-6 py-3 text-sm">
        <div className="pr-8">
          <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">RFQ Number</p>
          <p className="font-semibold text-gray-800">{rfq.rfqNumber}</p>
        </div>
        <div className="px-8">
          <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Supplier Name</p>
          <p className="font-bold text-brand-700 text-base">{rfq.vendor.vendorName}</p>
          <p className="text-xs text-gray-400 mt-0.5">ID: {rfq.vendor.vendorId}</p>
        </div>
        <div className="px-8">
          <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">RFQ Status</p>
          <p className="font-semibold text-gray-800">{rfq.rfqStatus}</p>
        </div>
        <div className="px-8">
          <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Entry Date</p>
          <p className="font-semibold text-gray-800">{formatDate(rfq.entryDate)}</p>
        </div>
        <div className="pl-8">
          <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Customer Approval Status</p>
          <p className="font-semibold text-gray-800">{rfq.customerApprovalStatus}</p>
        </div>
      </div>
    </div>
  );
}

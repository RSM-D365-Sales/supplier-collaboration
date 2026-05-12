import { CheckCircle, X } from 'lucide-react';

interface SuccessModalProps {
  vendorName: string;
  rfqNumber: string;
  onClose: () => void;
}

export default function SuccessModal({ vendorName, rfqNumber, onClose }: SuccessModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto mb-4">
            <CheckCircle size={36} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Response Submitted</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            Thank you, <strong>{vendorName}</strong>. Your quotation response for RFQ{' '}
            <strong>{rfqNumber}</strong> has been recorded and sent back to the buyer.
          </p>
          <p className="text-gray-400 text-xs mt-3">
            You may return to this page at any time to update your response before the deadline.
          </p>
          <button
            onClick={onClose}
            className="mt-6 w-full bg-brand-700 hover:bg-brand-800 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

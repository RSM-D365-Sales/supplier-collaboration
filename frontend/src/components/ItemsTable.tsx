import { XCircle } from 'lucide-react';
import { RFQLineItem, LineItemDraft, Document } from '../types/rfq';
import LineAttachmentPanel from './LineAttachmentPanel';

interface ItemsTableProps {
  items: RFQLineItem[];
  drafts: LineItemDraft[];
  onChange: (index: number, field: keyof LineItemDraft, value: number | string | boolean) => void;
  lineDocuments: Record<string, Document[]>;
  onLineUpload: (itemId: string, files: FileList) => Promise<void>;
  onLineDelete: (itemId: string, filename: string) => Promise<void>;
  lineUploading: Record<string, boolean>;
  disabled?: boolean;
}

export default function ItemsTable({
  items,
  drafts,
  onChange,
  lineDocuments,
  onLineUpload,
  onLineDelete,
  lineUploading,
  disabled = false,
}: ItemsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100 border-y border-gray-300">
            <th className="text-left px-4 py-2 font-semibold text-gray-700 w-16">Item No</th>
            <th className="text-left px-4 py-2 font-semibold text-gray-700">Description</th>
            <th className="text-right px-4 py-2 font-semibold text-gray-700 w-24">Quantity</th>
            <th className="text-right px-4 py-2 font-semibold text-gray-700 w-32">Lead Time (days)</th>
            <th className="text-right px-4 py-2 font-semibold text-gray-700 w-36">Quoted Unit Price</th>
            <th className="text-right px-4 py-2 font-semibold text-gray-700 w-32">Extended Price</th>
            <th className="text-center px-4 py-2 font-semibold text-gray-700 w-28">Attachments</th>
            <th className="text-center px-4 py-2 font-semibold text-gray-700 w-28">Reject</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const draft = drafts[idx];
            const isRejected = draft?.rejected ?? false;
            const extended = isRejected ? 0 : (draft?.quotedUnitPrice ?? 0) * item.quantity;

            return (
              <tr
                key={item.itemId}
                className={`border-b border-gray-200 ${isRejected ? 'opacity-60 bg-red-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
              >
                <td className="px-4 py-2 text-gray-600">{item.itemNumber}</td>
                <td className="px-4 py-2 text-gray-800 max-w-xs">
                  <span title={item.description}>
                    {item.description.length > 60
                      ? item.description.slice(0, 60) + ' …'
                      : item.description}
                  </span>
                </td>
                <td className="px-4 py-2 text-right text-gray-700">{item.quantity.toFixed(2)}</td>

                {/* Lead time – editable */}
                <td className="px-4 py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    disabled={disabled || isRejected}
                    value={draft?.leadTimeDays ?? item.leadTimeDays}
                    onChange={(e) => onChange(idx, 'leadTimeDays', parseInt(e.target.value, 10) || 0)}
                    className="price-input w-20 text-right"
                  />
                </td>

                {/* Unit price – editable */}
                <td className="px-4 py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    disabled={disabled || isRejected}
                    value={draft?.quotedUnitPrice ?? 0}
                    onChange={(e) => onChange(idx, 'quotedUnitPrice', parseFloat(e.target.value) || 0)}
                    className="price-input w-28"
                  />
                </td>

                {/* Extended price – read-only, computed */}
                <td className="px-4 py-2 text-right text-gray-700 font-medium">
                  {isRejected ? <span className="text-red-500 text-xs font-semibold">Rejected</span> : extended.toFixed(2)}
                </td>

                {/* Per-line attachments */}
                <td className="px-3 py-2 text-center align-top">
                  <LineAttachmentPanel
                    itemId={item.itemId}
                    documents={lineDocuments[item.itemId] ?? []}
                    onUpload={onLineUpload}
                    onDelete={onLineDelete}
                    uploading={lineUploading[item.itemId] ?? false}
                  />
                </td>

                {/* Reject item */}
                <td className="px-3 py-2 text-center align-middle">
                  <label className="inline-flex flex-col items-center gap-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={isRejected}
                      onChange={(e) => onChange(idx, 'rejected', e.target.checked)}
                      className="sr-only"
                    />
                    <span
                      className={`flex items-center justify-center w-6 h-6 rounded border-2 transition-colors ${
                        isRejected
                          ? 'bg-red-100 border-red-500'
                          : 'bg-white border-gray-300 hover:border-red-400'
                      }`}
                    >
                      {isRejected && <XCircle size={14} className="text-red-600" />}
                    </span>
                    <span className={`text-xs ${isRejected ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                      Reject item
                    </span>
                  </label>
                </td>
              </tr>
            );
          })}
        </tbody>

        {/* Totals */}
        <tfoot>
          <tr className="bg-gray-50 border-t-2 border-gray-300">
            <td colSpan={6} className="px-4 py-2 text-right font-semibold text-gray-700">
              Total
            </td>
            <td className="px-4 py-2 text-right font-bold text-brand-700">
              {items
                .reduce((sum, item, idx) => {
                  if (drafts[idx]?.rejected) return sum;
                  return sum + (drafts[idx]?.quotedUnitPrice ?? 0) * item.quantity;
                }, 0)
                .toFixed(2)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

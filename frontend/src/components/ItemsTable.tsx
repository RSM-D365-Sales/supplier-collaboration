import { RFQLineItem, LineItemDraft, Document } from '../types/rfq';
import LineAttachmentPanel from './LineAttachmentPanel';

interface ItemsTableProps {
  items: RFQLineItem[];
  drafts: LineItemDraft[];
  onChange: (index: number, field: keyof LineItemDraft, value: number | string) => void;
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
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const draft = drafts[idx];
            const extended = (draft?.quotedUnitPrice ?? 0) * item.quantity;

            return (
              <tr
                key={item.itemId}
                className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
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
                    disabled={disabled}
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
                    disabled={disabled}
                    value={draft?.quotedUnitPrice ?? 0}
                    onChange={(e) => onChange(idx, 'quotedUnitPrice', parseFloat(e.target.value) || 0)}
                    className="price-input w-28"
                  />
                </td>

                {/* Extended price – read-only, computed */}
                <td className="px-4 py-2 text-right text-gray-700 font-medium">
                  {extended.toFixed(2)}
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
                .reduce((sum, item, idx) => sum + (drafts[idx]?.quotedUnitPrice ?? 0) * item.quantity, 0)
                .toFixed(2)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

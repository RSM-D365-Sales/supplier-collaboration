import { useState, useRef } from 'react';
import { Paperclip, Upload, Trash2, FileText, ChevronDown, ChevronUp, Loader } from 'lucide-react';
import { Document } from '../types/rfq';

interface LineAttachmentPanelProps {
  itemId: string;
  documents: Document[];
  onUpload: (itemId: string, files: FileList) => Promise<void>;
  onDelete: (itemId: string, filename: string) => Promise<void>;
  uploading: boolean;
}

export default function LineAttachmentPanel({
  itemId,
  documents,
  onUpload,
  onDelete,
  uploading,
}: LineAttachmentPanelProps) {
  const [open, setOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const count = documents.length;

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) onUpload(itemId, e.dataTransfer.files);
  }

  return (
    <div className="mt-1">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 text-xs font-medium rounded px-2 py-1 transition-colors
          ${count > 0
            ? 'text-brand-700 bg-brand-50 border border-brand-200 hover:bg-brand-100'
            : 'text-gray-400 bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:text-gray-600'
          }`}
        title="Attach files to this line item"
      >
        <Paperclip size={12} />
        {count > 0 ? `${count} file${count !== 1 ? 's' : ''}` : 'Attach'}
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>

      {/* Expandable panel */}
      {open && (
        <div className="mt-2 rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-gray-100
              ${dragOver ? 'bg-brand-50 border-brand-300' : 'bg-gray-50 hover:bg-brand-50'}`}
          >
            {uploading ? (
              <Loader size={14} className="text-brand-600 animate-spin flex-shrink-0" />
            ) : (
              <Upload size={14} className="text-brand-500 flex-shrink-0" />
            )}
            <span className="text-xs text-gray-500">
              {uploading ? 'Uploading…' : 'Drop files here or click to browse'}
            </span>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              className="sr-only"
              onChange={(e) => e.target.files && onUpload(itemId, e.target.files)}
            />
          </div>

          {/* File list */}
          {documents.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {documents.map((doc) => (
                <li key={doc.path} className="flex items-center justify-between px-4 py-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={13} className="text-brand-500 flex-shrink-0" />
                    <span className="truncate text-gray-700 font-medium max-w-[240px]" title={doc.name}>
                      {doc.name}
                    </span>
                    <span className="text-gray-400 flex-shrink-0">{formatDate(doc.uploadedAt)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDelete(itemId, doc.path); }}
                    className="text-gray-300 hover:text-red-500 transition-colors ml-2 flex-shrink-0"
                    title="Remove"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-400 text-center py-3">No files attached to this line yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

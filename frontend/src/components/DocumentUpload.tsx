import { useState, useCallback } from 'react';
import { Upload, FileText, Trash2, Loader } from 'lucide-react';
import { Document } from '../types/rfq';

interface DocumentUploadProps {
  token: string;
  documents: Document[];
  onUpload: (files: FileList) => Promise<void>;
  onDelete: (filename: string) => Promise<void>;
  uploading?: boolean;
}

export default function DocumentUpload({
  documents,
  onUpload,
  onDelete,
  uploading = false,
}: DocumentUploadProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) onUpload(e.dataTransfer.files);
    },
    [onUpload]
  );

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  return (
    <div className="p-6 space-y-6">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors
          ${dragOver ? 'border-brand-500 bg-brand-50' : 'border-gray-300 bg-gray-50 hover:border-brand-400'}`}
      >
        <Upload
          size={36}
          className={`mx-auto mb-3 ${dragOver ? 'text-brand-600' : 'text-gray-400'}`}
        />
        <p className="text-gray-600 text-sm mb-2">
          Drag &amp; drop files here, or{' '}
          <label className="text-brand-600 font-medium cursor-pointer hover:underline">
            browse
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              className="sr-only"
              onChange={(e) => e.target.files && onUpload(e.target.files)}
            />
          </label>
        </p>
        <p className="text-gray-400 text-xs">PDF, Word, Excel, PNG, JPEG — max 10 MB per file</p>
        {uploading && (
          <div className="flex items-center justify-center gap-2 mt-3 text-brand-600 text-sm">
            <Loader size={14} className="animate-spin" />
            Uploading…
          </div>
        )}
      </div>

      {/* Document list */}
      {documents.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-700">
            Attached Documents ({documents.length})
          </p>
          {documents.map((doc) => (
            <div
              key={doc.path}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-2.5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-brand-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-800">{doc.name}</p>
                  <p className="text-xs text-gray-400">Uploaded {formatDate(doc.uploadedAt)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDelete(doc.path)}
                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                title="Remove attachment"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 text-center">No documents attached yet.</p>
      )}
    </div>
  );
}

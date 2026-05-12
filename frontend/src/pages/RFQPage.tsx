import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Save, Loader, AlertCircle, Clock } from 'lucide-react';

import { api } from '../services/api';
import { RFQPageData, LineItemDraft, ResponseStatus, Document } from '../types/rfq';

import Header from '../components/Header';
import RFQInfo from '../components/RFQInfo';
import ResponseStatusSelector from '../components/ResponseStatusSelector';
import ItemsTable from '../components/ItemsTable';
import DocumentUpload from '../components/DocumentUpload';
import SuccessModal from '../components/SuccessModal';

type Tab = 'response' | 'documents';

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function RFQPage() {
  const { token } = useParams<{ token: string }>();

  // ── Data state ─────────────────────────────────────────────────────────────
  const [pageData, setPageData] = useState<RFQPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('response');
  const [responseStatus, setResponseStatus] = useState<ResponseStatus>('pending');
  const [quoteValidDays, setQuoteValidDays] = useState(0);
  const [quotedDate, setQuotedDate] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [drafts, setDrafts] = useState<LineItemDraft[]>([]);

  // ── Document state ─────────────────────────────────────────────────────────
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  // Per-line-item attachments
  const [lineDocuments, setLineDocuments] = useState<Record<string, Document[]>>({});
  const [lineUploading, setLineUploading] = useState<Record<string, boolean>>({});
  // ── Submission state ───────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Load RFQ on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;

    async function load() {
      try {
        setLoading(true);
        const [data, docs] = await Promise.all([
          api.getRFQ(token!),
          api.getDocuments(token!),
        ]);

        setPageData(data);
        setDocuments(docs);

        // Load per-line documents for all items in parallel
        const lineDocs = await Promise.all(
          data.rfq.items.map((item) =>
            api.getLineDocuments(token!, item.itemId).then((d) => ({ itemId: item.itemId, docs: d }))
          )
        );
        const lineDocsMap: Record<string, Document[]> = {};
        lineDocs.forEach(({ itemId, docs: d }) => { lineDocsMap[itemId] = d; });
        setLineDocuments(lineDocsMap);

        // Seed form from saved response (or defaults)
        const { meta, rfq } = data;
        setResponseStatus(meta.responseStatus === 'pending' ? 'pending' : meta.responseStatus);
        setQuoteValidDays(meta.quoteValidDays);
        setQuotedDate(meta.quotedDate || new Date().toISOString().slice(0, 10));
        setGeneralNotes(meta.generalNotes ?? '');
        setDrafts(
          rfq.items.map((item) => ({
            itemId: item.itemId,
            itemNumber: item.itemNumber,
            leadTimeDays: item.leadTimeDays,
            quotedUnitPrice: item.quotedUnitPrice,
            extendedPrice: item.extendedPrice,
            notes: item.notes ?? '',
          }))
        );
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Failed to load RFQ. Your link may be invalid or expired.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token]);

  // ── Draft line item update ─────────────────────────────────────────────────
  const handleDraftChange = useCallback(
    (index: number, field: keyof LineItemDraft, value: number | string) => {
      setDrafts((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    []
  );

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!token || responseStatus === 'pending') {
      setSubmitError('Please select a response status (Replied, Declined, or No Reply).');
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      await api.submitResponse(token, {
        responseStatus,
        quoteValidDays,
        quotedDate,
        items: drafts,
        generalNotes,
      });
      setShowSuccess(true);
    } catch {
      setSubmitError('Submission failed. Please try again or contact the buyer.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Document handlers ──────────────────────────────────────────────────────
  const handleUpload = useCallback(
    async (files: FileList) => {
      if (!token) return;
      setUploading(true);
      try {
        const updated = await api.uploadDocuments(token, files);
        setDocuments(updated);
      } finally {
        setUploading(false);
      }
    },
    [token]
  );

  const handleDelete = useCallback(
    async (filename: string) => {
      if (!token) return;
      const updated = await api.deleteDocument(token, filename);
      setDocuments(updated);
    },
    [token]
  );

  // ── Per-line document handlers ──────────────────────────────────────
  const handleLineUpload = useCallback(
    async (itemId: string, files: FileList) => {
      if (!token) return;
      setLineUploading((prev) => ({ ...prev, [itemId]: true }));
      try {
        const updated = await api.uploadLineDocuments(token, itemId, files);
        setLineDocuments((prev) => ({ ...prev, [itemId]: updated }));
      } finally {
        setLineUploading((prev) => ({ ...prev, [itemId]: false }));
      }
    },
    [token]
  );

  const handleLineDelete = useCallback(
    async (itemId: string, filename: string) => {
      if (!token) return;
      const updated = await api.deleteLineDocument(token, itemId, filename);
      setLineDocuments((prev) => ({ ...prev, [itemId]: updated }));
    },
    [token]
  );

  // ── Render states ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 gap-4">
        <Loader size={36} className="animate-spin text-brand-600" />
        <p className="text-gray-600">Loading your quotation request…</p>
      </div>
    );
  }

  if (error || !pageData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 gap-4 px-4">
        <div className="bg-white rounded-xl shadow p-10 max-w-md w-full text-center">
          <AlertCircle size={40} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">Link Not Found</h1>
          <p className="text-gray-600 text-sm">
            {error ??
              'This link is invalid or has expired. Please contact your buyer for a new invitation.'}
          </p>
        </div>
      </div>
    );
  }

  const { rfq, meta } = pageData;
  const isDeclined = responseStatus === 'declined';

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header
        companyName={rfq.companyName}
        vendorName={rfq.vendor.vendorName}
        vendorId={rfq.vendor.vendorId}
      />

      {/* Vendor welcome bar */}
      <div className="bg-brand-800 border-b border-brand-900">
        <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center justify-between">
          <p className="text-white/90 text-sm">
            This quotation request is addressed to{' '}
            <span className="font-bold text-white">{rfq.vendor.vendorName}</span>
          </p>
          <p className="text-white/50 text-xs">
            Vendor account: {rfq.vendor.vendorId}
          </p>
        </div>
      </div>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 space-y-4">
        {/* RFQ header info */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <RFQInfo rfq={rfq} />
        </div>

        {/* Deadline banner */}
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-700">
          <Clock size={16} />
          <span>
            Please submit your quotation by{' '}
            <strong>{formatDate(rfq.expirationDate)}</strong>.{' '}
            {rfq.buyerName && (
              <>
                For queries, contact{' '}
                <a href={`mailto:${rfq.buyerEmail}`} className="underline font-medium">
                  {rfq.buyerName}
                </a>{' '}
                {rfq.buyerPhone && `on ${rfq.buyerPhone}`}.
              </>
            )}
          </span>
        </div>

        {/* Main card */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              type="button"
              onClick={() => setActiveTab('response')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'response' ? 'tab-active' : 'tab-inactive'
              }`}
            >
              Response
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('documents')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'documents' ? 'tab-active' : 'tab-inactive'
              }`}
            >
              Attach Documents ({documents.length})
            </button>
          </div>

          {activeTab === 'response' && (
            <div className="p-6 space-y-6">
              {/* Instructions */}
              {rfq.instructions && (
                <p className="text-gray-600 text-sm italic">{rfq.instructions}</p>
              )}

              {/* Controls row */}
              <div className="flex flex-wrap items-center gap-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
                <ResponseStatusSelector
                  value={responseStatus}
                  onChange={setResponseStatus}
                />

                <div className="flex items-center gap-3 ml-auto">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Quote Valid Days</label>
                    <input
                      type="number"
                      min={0}
                      value={quoteValidDays}
                      onChange={(e) => setQuoteValidDays(parseInt(e.target.value, 10) || 0)}
                      className="price-input w-24"
                      disabled={isDeclined}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Quote Dated</label>
                    <input
                      type="date"
                      value={quotedDate}
                      onChange={(e) => setQuotedDate(e.target.value)}
                      className="price-input w-40"
                      disabled={isDeclined}
                    />
                  </div>
                </div>
              </div>

              {/* Items table */}
              {!isDeclined ? (
                <ItemsTable
                  items={rfq.items}
                  drafts={drafts}
                  onChange={handleDraftChange}
                  lineDocuments={lineDocuments}
                  onLineUpload={handleLineUpload}
                  onLineDelete={handleLineDelete}
                  lineUploading={lineUploading}
                />
              ) : (
                <div className="text-center py-12 text-gray-400 text-sm">
                  You have indicated that you are declining this RFQ. No line item pricing is
                  required.
                </div>
              )}

              {/* General notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Notes / Comments
                </label>
                <textarea
                  rows={3}
                  value={generalNotes}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  maxLength={500}
                  placeholder="Any terms, conditions, or clarifications…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
                <p className="text-xs text-gray-400 text-right mt-1">
                  {generalNotes.length}/500 characters
                </p>
              </div>

              {/* Previously submitted badge */}
              {meta.submittedAt && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2">
                  <Clock size={14} />
                  Last submitted: {formatDate(meta.submittedAt)}. You can update and resubmit until
                  the deadline.
                </div>
              )}

              {/* Error */}
              {submitError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
                  <AlertCircle size={14} />
                  {submitError}
                </div>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <DocumentUpload
              token={token!}
              documents={documents}
              onUpload={handleUpload}
              onDelete={handleDelete}
              uploading={uploading}
            />
          )}

          {/* Sticky footer / action bar */}
          {activeTab === 'response' && (
            <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || responseStatus === 'pending'}
                className="flex items-center gap-2 bg-brand-700 hover:bg-brand-800 disabled:bg-gray-300 disabled:cursor-not-allowed
                           text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
              >
                {submitting ? (
                  <Loader size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                {submitting ? 'Submitting…' : 'Update'}
              </button>
            </div>
          )}
        </div>
      </main>

      {showSuccess && (
        <SuccessModal
          vendorName={rfq.vendor.vendorName}
          rfqNumber={rfq.rfqNumber}
          onClose={() => setShowSuccess(false)}
        />
      )}
    </div>
  );
}

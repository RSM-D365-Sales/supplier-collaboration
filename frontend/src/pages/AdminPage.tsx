import { useState } from 'react';
import {
  Send, ChevronRight, CheckCircle2, XCircle, Clock, RefreshCw,
  ExternalLink, Mail, AlertCircle, Eye, Loader,
} from 'lucide-react';
import { api, AdminSendResult, VendorResponseSummary } from '../services/api';

type SendState = 'idle' | 'loading' | 'success' | 'error';
type ResponsesState = 'idle' | 'loading' | 'success' | 'error';

function statusBadge(status: string) {
  const map: Record<string, string> = {
    replied: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-700',
    'no-reply': 'bg-gray-100 text-gray-600',
    pending: 'bg-amber-100 text-amber-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-500';
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'replied') return <CheckCircle2 size={14} className="text-green-600" />;
  if (status === 'declined') return <XCircle size={14} className="text-red-500" />;
  return <Clock size={14} className="text-amber-500" />;
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminPage() {
  const [rfqInput, setRfqInput] = useState('');

  // ── Send flow ──────────────────────────────────────────────────────────────
  const [sendState, setSendState] = useState<SendState>('idle');
  const [sendResult, setSendResult] = useState<AdminSendResult | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // ── Responses lookup ───────────────────────────────────────────────────────
  const [responsesRfq, setResponsesRfq] = useState('');
  const [responsesState, setResponsesState] = useState<ResponsesState>('idle');
  const [responses, setResponses] = useState<VendorResponseSummary[]>([]);
  const [responsesError, setResponsesError] = useState<string | null>(null);

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleSend() {
    const rfqNumber = rfqInput.trim();
    if (!rfqNumber) return;
    setSendState('loading');
    setSendResult(null);
    setSendError(null);
    try {
      const result = await api.sendRFQ(rfqNumber);
      setSendResult(result);
      setSendState('success');
      // Pre-fill responses lookup with the same RFQ
      setResponsesRfq(rfqNumber);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      // Axios wraps the body in err.response.data.error
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setSendError(axiosErr.response?.data?.error ?? msg);
      setSendState('error');
    }
  }

  async function handleLoadResponses() {
    const rfqNumber = responsesRfq.trim();
    if (!rfqNumber) return;
    setResponsesState('loading');
    setResponses([]);
    setResponsesError(null);
    try {
      const data = await api.getRFQResponses(rfqNumber);
      setResponses(data);
      setResponsesState('success');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setResponsesError(axiosErr.response?.data?.error ?? 'Failed to load responses');
      setResponsesState('error');
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">

      {/* Header */}
      <header className="bg-brand-700 text-white">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-5 bg-white rounded-sm" />
              <div className="w-2 h-5 bg-white/60 rounded-sm" />
              <div className="w-2 h-5 bg-white/30 rounded-sm" />
            </div>
            <span className="text-white font-bold text-lg tracking-wide ml-1">PORTAL</span>
          </div>
          <span className="text-white/70 text-sm font-medium tracking-wide uppercase">
            Admin Console
          </span>
          <div className="w-24" /> {/* spacer */}
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 space-y-6">

        {/* ── Section 1: Send RFQ ──────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="bg-brand-600 text-white px-6 py-3 flex items-center gap-2">
            <Send size={16} />
            <h2 className="font-semibold text-sm tracking-wide uppercase">
              Send RFQ to Vendors
            </h2>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600">
              Enter an RFQ case number. The portal will look up the invited vendors in D365,
              generate a unique secure link for each one, and send them invitation emails.
            </p>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                  RFQ Case Number
                </label>
                <input
                  type="text"
                  value={rfqInput}
                  onChange={(e) => setRfqInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="e.g. 000460"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!rfqInput.trim() || sendState === 'loading'}
                  className="flex items-center gap-2 bg-brand-700 hover:bg-brand-800
                             disabled:bg-gray-300 disabled:cursor-not-allowed
                             text-white font-semibold px-5 py-2 rounded-lg
                             transition-colors text-sm"
                >
                  {sendState === 'loading'
                    ? <><Loader size={15} className="animate-spin" /> Sending…</>
                    : <><Send size={15} /> Send</>}
                </button>
              </div>
            </div>

            {/* Error */}
            {sendState === 'error' && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{sendError}</span>
              </div>
            )}

            {/* Results table */}
            {sendState === 'success' && sendResult && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
                  <CheckCircle2 size={16} />
                  RFQ {sendResult.rfqNumber} — {sendResult.vendors.length} vendor(s) processed
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden text-sm">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                        <th className="text-left px-4 py-2.5 font-medium">Vendor</th>
                        <th className="text-left px-4 py-2.5 font-medium">Email</th>
                        <th className="text-left px-4 py-2.5 font-medium">Email sent</th>
                        <th className="text-left px-4 py-2.5 font-medium">Portal link</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sendResult.vendors.map((v) => (
                        <tr key={v.vendorId} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-800">{v.vendorName}</p>
                            <p className="text-xs text-gray-400">{v.vendorId}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{v.email}</td>
                          <td className="px-4 py-3">
                            {v.emailSent ? (
                              <div className="flex flex-col gap-1">
                                <span className="flex items-center gap-1 text-green-600 font-medium">
                                  <Mail size={13} /> Sent
                                </span>
                                {v.previewUrl && (
                                  <a
                                    href={v.previewUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1 text-xs text-brand-600 underline"
                                  >
                                    <Eye size={11} /> Preview
                                  </a>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">No email on record</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <a
                              href={v.portalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-brand-600 hover:underline text-xs font-mono"
                            >
                              <ExternalLink size={11} />
                              Open portal
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Section 2: Response status ───────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gray-700 text-white px-6 py-3 flex items-center gap-2">
            <ChevronRight size={16} />
            <h2 className="font-semibold text-sm tracking-wide uppercase">
              Vendor Response Status
            </h2>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600">
              Check the current response status for all vendors on an RFQ.
            </p>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                  RFQ Case Number
                </label>
                <input
                  type="text"
                  value={responsesRfq}
                  onChange={(e) => setResponsesRfq(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLoadResponses()}
                  placeholder="e.g. 000460"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleLoadResponses}
                  disabled={!responsesRfq.trim() || responsesState === 'loading'}
                  className="flex items-center gap-2 bg-gray-700 hover:bg-gray-800
                             disabled:bg-gray-300 disabled:cursor-not-allowed
                             text-white font-semibold px-5 py-2 rounded-lg
                             transition-colors text-sm"
                >
                  {responsesState === 'loading'
                    ? <><Loader size={15} className="animate-spin" /> Loading…</>
                    : <><RefreshCw size={15} /> Load</>}
                </button>
              </div>
            </div>

            {/* Error */}
            {responsesState === 'error' && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{responsesError}</span>
              </div>
            )}

            {/* Results */}
            {responsesState === 'success' && (
              responses.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No vendor tokens found for this RFQ.</p>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden text-sm">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                        <th className="text-left px-4 py-2.5 font-medium">Vendor</th>
                        <th className="text-left px-4 py-2.5 font-medium">Status</th>
                        <th className="text-left px-4 py-2.5 font-medium">Submitted</th>
                        <th className="text-left px-4 py-2.5 font-medium">Link expires</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {responses.map((v) => (
                        <tr key={v.vendorId} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-800">{v.vendorName}</p>
                            <p className="text-xs text-gray-400">{v.vendorId}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(v.responseStatus)}`}>
                              <StatusIcon status={v.responseStatus} />
                              {v.responseStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {formatDate(v.submittedAt)}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {formatDate(v.expiresAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>

      </main>
    </div>
  );
}

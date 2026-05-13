import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2, XCircle, Clock, ExternalLink, Mail, AlertCircle,
  Loader, Plus, Trash2, ChevronDown, ChevronUp, Send, RefreshCw,
  Settings, RotateCcw, Search, UserSearch,
} from 'lucide-react';
import { api } from '../services/api';
import {
  PortalSlot, SlotVendor, RFQLineItem, ConfigureSlotPayload,
} from '../types/rfq';

// ── helpers ──────────────────────────────────────────────────────────────────

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
  if (status === 'replied') return <CheckCircle2 size={13} className="text-green-600" />;
  if (status === 'declined') return <XCircle size={13} className="text-red-500" />;
  return <Clock size={13} className="text-amber-500" />;
}

function slotStatusColor(slot: PortalSlot) {
  if (slot.status === 'active') return 'border-green-400 bg-green-50';
  if (slot.status === 'closed') return 'border-gray-300 bg-gray-50';
  return 'border-dashed border-gray-300 bg-white';
}

// ── blank RFQ data used when opening a fresh configure form ──────────────────
function blankRfqData() {
  return {
    rfqNumber: '',
    rfqStatus: 'SENT' as const,
    entryDate: new Date().toISOString().slice(0, 10),
    expirationDate: '',
    customerApprovalStatus: 'OPTIONAL',
    buyerName: '',
    buyerPhone: '',
    buyerEmail: '',
    companyName: import.meta.env.VITE_COMPANY_NAME ?? '',
    instructions: '',
    items: [] as RFQLineItem[],
  };
}

function blankItem(): RFQLineItem {
  return {
    itemNumber: 1, itemId: '', description: '',
    quantity: 1, unit: 'ea', leadTimeDays: 1,
    quotedUnitPrice: 0, extendedPrice: 0,
  };
}

// ── SlotCard ─────────────────────────────────────────────────────────────────

interface SlotCardProps {
  slot: PortalSlot;
  onUpdate: (updated: PortalSlot) => void;
}

function SlotCard({ slot, onUpdate }: SlotCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [configuring, setConfiguring] = useState(false);

  // form state
  const [label, setLabel] = useState(slot.label);
  const [rfqNumber, setRfqNumber] = useState(slot.rfqNumber ?? '');
  const [rfqData, setRfqData] = useState(slot.rfqData ?? blankRfqData());
  const [vendors, setVendors] = useState<Array<{ vendorId: string; vendorName: string; email: string }>>(

    slot.vendors.map((v) => ({ vendorId: v.vendorId ?? '', vendorName: v.vendorName, email: v.email }))
  );
  const [items, setItems] = useState<RFQLineItem[]>(rfqData.items ?? []);
  const [sendEmails, setSendEmails] = useState(false);

  const [saving, setSaving] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookingUpVendorIdx, setLookingUpVendorIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openConfigure = () => {
    // reset form to current slot state
    setLabel(slot.label);
    setRfqNumber(slot.rfqNumber ?? '');
    const rd = slot.rfqData ?? blankRfqData();
    setRfqData(rd);
    setItems(rd.items ?? []);
    setVendors(slot.vendors.map((v) => ({ vendorId: v.vendorId ?? '', vendorName: v.vendorName, email: v.email })));
    setSendEmails(false);
    setError(null);
    setConfiguring(true);
    setExpanded(true);
  };

  async function handleLookup() {
    if (!rfqNumber.trim()) { setError('Enter an RFQ Number first'); return; }
    setLookingUp(true);
    setError(null);
    try {
      const result = await api.lookupRFQ(rfqNumber.trim());
      setRfqData({ ...result.rfqData, rfqNumber: rfqNumber.trim() });
      setItems(result.rfqData.items);
      setVendors(result.vendors.map((v) => ({ vendorId: v.vendorId, vendorName: v.vendorName, email: v.email })));
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error ?? 'RFQ not found in D365');
    } finally {
      setLookingUp(false);
    }
  }

  async function handleSave() {
    if (!rfqNumber.trim()) { setError('RFQ Number is required'); return; }
    if (vendors.length === 0) { setError('Add at least one vendor'); return; }
    setError(null);
    setSaving(true);
    try {
      const payload: ConfigureSlotPayload = {
        label: label || undefined,
        rfqNumber: rfqNumber.trim(),
        rfqData: { ...rfqData, rfqNumber: rfqNumber.trim(), items },
        vendors,
        sendEmails,
      };
      const updated = await api.configureSlot(slot.slotId, payload);
      onUpdate(updated);
      setConfiguring(false);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error ?? (e instanceof Error ? e.message : 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSendEmails() {
    setSendingEmails(true);
    setError(null);
    try {
      const updated = await api.sendSlotEmails(slot.slotId);
      onUpdate(updated);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error ?? 'Email send failed');
    } finally {
      setSendingEmails(false);
    }
  }

  async function handleReset() {
    if (!confirm(`Reset "${slot.label}"? All vendor links will stop working.`)) return;
    setResetting(true);
    try {
      const updated = await api.resetSlot(slot.slotId);
      onUpdate(updated);
      setConfiguring(false);
      setExpanded(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Reset failed');
    } finally {
      setResetting(false);
    }
  }

  // item helpers
  const addItem = () => setItems((prev) => [...prev, { ...blankItem(), itemNumber: prev.length + 1 }]);
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof RFQLineItem, value: string | number) =>
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it));

  // vendor helpers
  const addVendor = () => setVendors((prev) => [...prev, { vendorId: '', vendorName: '', email: '' }]);
  const removeVendor = (i: number) => setVendors((prev) => prev.filter((_, idx) => idx !== i));
  const updateVendor = (i: number, field: 'vendorId' | 'vendorName' | 'email', value: string) =>
    setVendors((prev) => prev.map((v, idx) => idx === i ? { ...v, [field]: value } : v));

  async function handleVendorLookup(i: number) {
    const vid = vendors[i].vendorId.trim();
    if (!vid) return;
    setLookingUpVendorIdx(i);
    try {
      const result = await api.lookupVendor(vid);
      setVendors((prev) => prev.map((v, idx) => idx === i
        ? { vendorId: result.vendorId, vendorName: result.vendorName, email: result.email || v.email }
        : v));
    } catch {
      setError(`Vendor "${vid}" not found in D365`);
    } finally {
      setLookingUpVendorIdx(null);
    }
  }

  return (
    <div className={`border-2 rounded-xl overflow-hidden transition-colors ${slotStatusColor(slot)}`}>

      {/* ── Card header ── */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
        onClick={() => { if (!configuring) setExpanded((e) => !e); }}
      >
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${slot.status === 'active' ? 'bg-green-500' : slot.status === 'closed' ? 'bg-gray-400' : 'bg-gray-300'}`} />
          <div>
            <p className="font-semibold text-gray-800 text-sm">{slot.label}</p>
            {slot.rfqNumber
              ? <p className="text-xs text-gray-500">RFQ {slot.rfqNumber} · {slot.vendors.length} vendor(s)</p>
              : <p className="text-xs text-gray-400 italic">Not configured</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {slot.status === 'empty' && (
            <button
              onClick={(e) => { e.stopPropagation(); openConfigure(); }}
              className="flex items-center gap-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg font-medium"
            >
              <Settings size={13} /> Configure
            </button>
          )}
          {slot.status === 'active' && !configuring && (
            <button
              onClick={(e) => { e.stopPropagation(); openConfigure(); }}
              className="flex items-center gap-1.5 text-xs bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-300 px-3 py-1.5 rounded-lg font-medium"
            >
              <Settings size={13} /> Edit
            </button>
          )}
          {!configuring && (
            expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />
          )}
        </div>
      </div>

      {/* ── Expanded: vendor status view (non-configure mode) ── */}
      {expanded && !configuring && slot.status === 'active' && (
        <div className="border-t border-gray-200 px-5 py-4 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Vendor Responses</p>
            <button
              onClick={handleSendEmails}
              disabled={sendingEmails}
              className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 font-medium disabled:opacity-50"
            >
              {sendingEmails ? <Loader size={12} className="animate-spin" /> : <Mail size={12} />}
              Resend Emails
            </button>
          </div>
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden text-sm">
              {slot.vendors.map((v: SlotVendor) => {
                const vendorUrl = `${window.location.origin}${import.meta.env.BASE_URL}rfq/${v.token}`;
                return (
                  <div key={v.token} className="flex items-center justify-between px-4 py-2.5 bg-white hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-gray-800">{v.vendorName}</p>
                      <p className="text-xs text-gray-400">{v.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(v.responseStatus)}`}>
                        <StatusIcon status={v.responseStatus} />
                        {v.responseStatus}
                      </span>
                      <a
                        href={vendorUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-600 hover:text-brand-800"
                        title={vendorUrl}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                );
              })}
          </div>
          {error && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle size={13} />{error}</p>}
        </div>
      )}

      {/* ── Configure form ── */}
      {expanded && configuring && (
        <div className="border-t border-gray-200 bg-white px-5 py-5 space-y-6">

          {/* Label + RFQ Number */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Portal Label</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">RFQ Number <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <input value={rfqNumber} onChange={(e) => setRfqNumber(e.target.value)}
                  placeholder="e.g. 000460"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500" />
                <button
                  onClick={handleLookup}
                  disabled={lookingUp || !rfqNumber.trim()}
                  className="flex items-center gap-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 px-3 py-2 rounded-lg font-medium disabled:opacity-50 whitespace-nowrap"
                >
                  {lookingUp ? <Loader size={13} className="animate-spin" /> : <Search size={13} />}
                  {lookingUp ? 'Looking up…' : 'Fetch from D365'}
                </button>
              </div>
            </div>
          </div>

          {/* Buyer info */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Buyer / Company</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Company Name', field: 'companyName' as const },
                { label: 'Buyer Name', field: 'buyerName' as const },
                { label: 'Buyer Email', field: 'buyerEmail' as const },
                { label: 'Buyer Phone', field: 'buyerPhone' as const },
              ].map(({ label: lbl, field }) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{lbl}</label>
                  <input value={(rfqData as unknown as Record<string, string>)[field] ?? ''}
                    onChange={(e) => setRfqData((d) => ({ ...d, [field]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Entry Date</label>
                <input type="date" value={rfqData.entryDate}
                  onChange={(e) => setRfqData((d) => ({ ...d, entryDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Expiration Date</label>
                <input type="date" value={rfqData.expirationDate}
                  onChange={(e) => setRfqData((d) => ({ ...d, expirationDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">Instructions</label>
              <textarea value={rfqData.instructions ?? ''}
                onChange={(e) => setRfqData((d) => ({ ...d, instructions: e.target.value }))}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Line Items</p>
              <button onClick={addItem} className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium">
                <Plus size={13} /> Add Item
              </button>
            </div>
            {items.length === 0
              ? <p className="text-xs text-gray-400 italic">No items added yet</p>
              : (
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg px-3 py-2">
                      <div className="col-span-1">
                        <label className="block text-[10px] text-gray-400 mb-0.5">#</label>
                        <input type="number" value={item.itemNumber} onChange={(e) => updateItem(i, 'itemNumber', +e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-center" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] text-gray-400 mb-0.5">Item ID</label>
                        <input value={item.itemId} onChange={(e) => updateItem(i, 'itemId', e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs font-mono" />
                      </div>
                      <div className="col-span-4">
                        <label className="block text-[10px] text-gray-400 mb-0.5">Description</label>
                        <input value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs" />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-[10px] text-gray-400 mb-0.5">Qty</label>
                        <input type="number" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', +e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-center" />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-[10px] text-gray-400 mb-0.5">Unit</label>
                        <input value={item.unit} onChange={(e) => updateItem(i, 'unit', e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-center" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] text-gray-400 mb-0.5">Lead Days</label>
                        <input type="number" value={item.leadTimeDays} onChange={(e) => updateItem(i, 'leadTimeDays', +e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-center" />
                      </div>
                      <div className="col-span-1 flex items-end justify-center pb-0.5">
                        <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 mt-4">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>

          {/* Vendors */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Vendors <span className="text-red-500">*</span></p>
              <button onClick={addVendor} className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium">
                <Plus size={13} /> Add Vendor
              </button>
            </div>
            {vendors.length === 0
              ? <p className="text-xs text-gray-400 italic">No vendors added yet</p>
              : (
                <div className="space-y-2">
                  {vendors.map((v, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-3">
                        <label className="block text-[10px] text-gray-400 mb-0.5">D365 Vendor ID</label>
                        <div className="flex gap-1">
                          <input value={v.vendorId} onChange={(e) => updateVendor(i, 'vendorId', e.target.value)}
                            placeholder="e.g. US-001"
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500" />
                          <button
                            onClick={() => handleVendorLookup(i)}
                            disabled={!v.vendorId.trim() || lookingUpVendorIdx === i}
                            title="Lookup vendor in D365"
                            className="shrink-0 flex items-center justify-center w-8 h-8 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 rounded-lg disabled:opacity-40"
                          >
                            {lookingUpVendorIdx === i ? <Loader size={12} className="animate-spin" /> : <UserSearch size={12} />}
                          </button>
                        </div>
                      </div>
                      <div className="col-span-4">
                        <label className="block text-[10px] text-gray-400 mb-0.5">Vendor Name</label>
                        <input value={v.vendorName} onChange={(e) => updateVendor(i, 'vendorName', e.target.value)}
                          placeholder="Acme Corp"
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      </div>
                      <div className="col-span-4">
                        <label className="block text-[10px] text-gray-400 mb-0.5">Email</label>
                        <input type="email" value={v.email} onChange={(e) => updateVendor(i, 'email', e.target.value)}
                          placeholder="quotes@vendor.com"
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button onClick={() => removeVendor(i)} className="text-red-400 hover:text-red-600">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>

          {/* Send emails toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={sendEmails} onChange={(e) => setSendEmails(e.target.checked)}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
            <span className="text-sm text-gray-700">Send invitation emails to vendors now</span>
          </label>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              <AlertCircle size={15} className="shrink-0" /> {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-1">
            <button onClick={handleReset} disabled={resetting || slot.status === 'empty'}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 disabled:opacity-40 font-medium">
              {resetting ? <Loader size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              Reset Slot
            </button>
            <div className="flex items-center gap-3">
              <button onClick={() => { setConfiguring(false); setExpanded(slot.status === 'active'); }}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium px-3 py-1.5">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 bg-brand-700 hover:bg-brand-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-lg transition-colors text-sm">
                {saving ? <><Loader size={14} className="animate-spin" /> Saving…</> : <><Send size={14} /> Activate Portal</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AdminPage ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [slots, setSlots] = useState<PortalSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSlots = useCallback(async () => {
    try {
      const data = await api.getSlots();
      setSlots(data);
    } catch {
      setLoadError('Could not load portal slots — is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  function handleSlotUpdate(updated: PortalSlot) {
    setSlots((prev) => prev.map((s) => s.slotId === updated.slotId ? updated : s));
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">

      {/* Header */}
      <header className="bg-brand-700 text-white">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-5 bg-white rounded-sm" />
              <div className="w-2 h-5 bg-white/60 rounded-sm" />
              <div className="w-2 h-5 bg-white/30 rounded-sm" />
            </div>
            <span className="text-white font-bold text-lg tracking-wide ml-1">PORTAL</span>
          </div>
          <span className="text-white/70 text-sm font-medium tracking-wide uppercase">Admin Console</span>
          <button onClick={loadSlots} className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-medium">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">

        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-800">Portal Slots</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure up to {slots.length || 5} simultaneous vendor portals. Each slot has its own RFQ data and per-vendor secure links.
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader size={24} className="animate-spin mr-3" /> Loading slots…
          </div>
        )}

        {loadError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            <AlertCircle size={16} className="shrink-0" /> {loadError}
          </div>
        )}

        {!loading && !loadError && (
          <div className="space-y-4">
            {slots.map((slot) => (
              <SlotCard key={slot.slotId} slot={slot} onUpdate={handleSlotUpdate} />
            ))}
          </div>
        )}

      </main>
    </div>
  );
}



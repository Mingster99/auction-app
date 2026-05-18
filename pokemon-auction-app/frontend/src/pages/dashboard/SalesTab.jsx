import React, { useEffect, useState, useCallback } from 'react';
import { sellerService } from '../../services/sellerService';
import InvoiceDetailModal from '../../components/invoices/InvoiceDetailModal';

const PAGE_SIZE = 25;
const fmtMoney = (v) => `$${parseFloat(v || 0).toFixed(2)}`;

const STATUS_BADGE = {
  pending:          'bg-amber-500/20 text-amber-400',
  paid:             'bg-blue-500/20 text-blue-400',
  pickup_scheduled: 'bg-violet-500/20 text-violet-400',
  picked_up:        'bg-orange-500/20 text-orange-400',
  delivered:        'bg-green-500/20 text-green-400',
  failed:           'bg-red-500/20 text-red-400',
  refunded:         'bg-gray-500/20 text-gray-400',
};

const STATUS_LABEL = {
  pending:          'Awaiting Scheduling',
  paid:             'Paid — Awaiting Scheduling',
  pickup_scheduled: 'Pickup Scheduled',
  picked_up:        'Picked Up — Payout Released',
  delivered:        'Delivered',
  failed:           'Failed',
  refunded:         'Refunded',
};

const STATUS_OPTIONS = [
  { value: 'all',              label: 'All statuses' },
  { value: 'pending',          label: 'Awaiting Scheduling' },
  { value: 'pickup_scheduled', label: 'Pickup Scheduled' },
  { value: 'picked_up',        label: 'Picked Up' },
  { value: 'delivered',        label: 'Delivered' },
  { value: 'refunded',         label: 'Refunded' },
];

export default function SalesTab() {
  const [data, setData] = useState({ invoices: [], total: 0, pending_payouts: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [offset, setOffset] = useState(0);
  const [openInvoiceId, setOpenInvoiceId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { limit: PAGE_SIZE, offset };
      if (status !== 'all') params.status = status;
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await sellerService.getInvoices(params);
      setData(res);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [status, from, to, offset]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setOffset(0); }, [status, from, to]);

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-4">
      {/* Pending payouts summary */}
      <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Pending payouts</p>
          <p className="text-2xl font-black text-amber-400 mt-1">{fmtMoney(data.pending_payouts)}</p>
        </div>
        <p className="text-xs text-gray-500 max-w-xs text-right">
          Payout is released when our team picks up your card. No action required from you.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[10px] text-gray-500 uppercase font-medium mb-1">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-white text-sm focus:border-violet-500 outline-none">
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[10px] text-gray-500 uppercase font-medium mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-white text-sm focus:border-violet-500 outline-none" />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[10px] text-gray-500 uppercase font-medium mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-white text-sm focus:border-violet-500 outline-none" />
        </div>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-300 p-4 rounded-xl">{error}</div>
      )}

      {/* Table */}
      <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-800">
                <th className="px-4 py-3 font-medium">Card</th>
                <th className="px-4 py-3 font-medium">Buyer</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium text-right">Payout</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-800 last:border-0 animate-pulse">
                    {[...Array(6)].map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3 bg-gray-800 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : data.invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">No invoices match these filters.</td>
                </tr>
              ) : (
                data.invoices.map((inv) => (
                  <tr key={inv.id} onClick={() => setOpenInvoiceId(inv.id)}
                    className="border-b border-gray-800 last:border-0 hover:bg-gray-800/30 transition-colors cursor-pointer">
                    <td className="px-4 py-3 text-white">
                      {inv.card_name}
                      {inv.status === 'pickup_scheduled' && inv.pickup_note && (
                        <p className="text-xs text-violet-300 mt-1 bg-violet-500/10 rounded px-2 py-1 max-w-xs">
                          {inv.pickup_note}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400">@{inv.buyer_username}</td>
                    <td className="px-4 py-3 text-right text-white font-medium">{fmtMoney(inv.amount)}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{fmtMoney(inv.seller_payout_amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${STATUS_BADGE[inv.status] || 'bg-gray-500/20 text-gray-400'}`}>
                        {STATUS_LABEL[inv.status] || inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(inv.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && data.total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800 text-xs text-gray-400">
            <span>Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)} of {data.total}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} disabled={offset === 0}
                className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-1 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                ← Prev
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button onClick={() => setOffset(offset + PAGE_SIZE)} disabled={offset + PAGE_SIZE >= data.total}
                className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-1 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {openInvoiceId && (
        <InvoiceDetailModal invoiceId={openInvoiceId} onClose={() => setOpenInvoiceId(null)} />
      )}
    </div>
  );
}

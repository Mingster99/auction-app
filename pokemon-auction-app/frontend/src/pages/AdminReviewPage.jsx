import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { adminService } from '../services/adminService';
import { formatDistanceToNow } from 'date-fns';

const fmtMoney = (v) => `$${parseFloat(v || 0).toFixed(2)}`;

export default function AdminReviewPage() {
  const [data, setData] = useState({ invoices: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actioningId, setActioningId] = useState(null);
  const [rejectFor, setRejectFor] = useState(null);
  const [rejectNotes, setRejectNotes] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminService.getPendingReview({ limit: 100 });
      setData(res);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleApprove = async (inv) => {
    if (!window.confirm(`Approve and release ${fmtMoney(inv.seller_payout_amount)} to @${inv.seller_username}?`)) return;
    setActioningId(inv.id);
    try {
      await adminService.approveShipment(inv.id);
      toast.success('Approved — payout released');
      await refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approve failed');
    } finally {
      setActioningId(null);
    }
  };

  const submitReject = async () => {
    if (!rejectNotes.trim()) {
      toast.error('Please add a rejection note');
      return;
    }
    setActioningId(rejectFor.id);
    try {
      await adminService.rejectShipment(rejectFor.id, rejectNotes.trim());
      toast.success('Rejected — sent back to seller');
      setRejectFor(null);
      setRejectNotes('');
      await refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reject failed');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1419] text-white">
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <div>
          <h1 className="text-3xl font-black">Shipment Review Queue</h1>
          <p className="text-gray-400 text-sm mt-1">
            {data.total} invoice{data.total === 1 ? '' : 's'} awaiting review.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-300 p-4 rounded-xl">{error}</div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-32 bg-[#1a1f2e] rounded-2xl border border-gray-800 animate-pulse" />
            ))}
          </div>
        ) : data.invoices.length === 0 ? (
          <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-12 text-center">
            <p className="text-5xl mb-3">✓</p>
            <p className="text-white font-bold">Queue is empty</p>
            <p className="text-gray-500 text-sm mt-1">No shipments waiting on you right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.invoices.map((inv) => (
              <ReviewRow
                key={inv.id}
                invoice={inv}
                actioning={actioningId === inv.id}
                onApprove={() => handleApprove(inv)}
                onReject={() => { setRejectFor(inv); setRejectNotes(''); }}
              />
            ))}
          </div>
        )}
      </div>

      {rejectFor && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setRejectFor(null)}
        >
          <div
            className="bg-[#1a1f2e] rounded-2xl border border-gray-800 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-800">
              <h2 className="text-xl font-bold text-white">Reject shipment</h2>
              <p className="text-xs text-gray-500 mt-0.5">@{rejectFor.seller_username} · {rejectFor.card_name}</p>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-300">
                The invoice will go back to <span className="text-amber-400 font-bold">pending</span>. The tracking
                you reject will be cleared, and the seller will see your note when resubmitting.
              </p>
              <textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Reason (e.g. tracking number doesn't match carrier scan, photo unclear, etc.)"
                rows={4}
                maxLength={1000}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:border-violet-500 outline-none resize-none"
                autoFocus
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setRejectFor(null)}
                  className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitReject}
                  disabled={actioningId === rejectFor.id}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2 rounded-xl text-sm disabled:opacity-50"
                >
                  {actioningId === rejectFor.id ? 'Rejecting…' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewRow({ invoice, actioning, onApprove, onReject }) {
  const thumb = invoice.card_image_front || invoice.image_url;
  const submittedAgo = invoice.shipped_at
    ? formatDistanceToNow(new Date(invoice.shipped_at), { addSuffix: true })
    : '—';

  return (
    <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-4 flex flex-col sm:flex-row gap-4">
      <div className="w-24 h-24 sm:w-20 sm:h-20 bg-gray-900 rounded-lg overflow-hidden shrink-0">
        {thumb ? (
          <img src={thumb} alt={invoice.card_name} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl text-gray-700">🎴</div>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <p className="font-bold text-white truncate">{invoice.card_name}</p>
        <p className="text-xs text-gray-400">
          @{invoice.seller_username} → @{invoice.buyer_username} · {fmtMoney(invoice.amount)} ·
          payout {fmtMoney(invoice.seller_payout_amount)}
        </p>
        <div className="text-sm text-violet-300 font-mono">
          {invoice.tracking_carrier} · {invoice.tracking_number}
        </div>
        <p className="text-xs text-gray-500">Submitted {submittedAgo}</p>
      </div>

      <div className="flex sm:flex-col gap-2 sm:w-28">
        <button
          onClick={onApprove}
          disabled={actioning}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-2 rounded-xl text-sm transition-colors disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={onReject}
          disabled={actioning}
          className="flex-1 bg-gray-800 hover:bg-red-600 text-white font-bold px-3 py-2 rounded-xl text-sm transition-colors disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

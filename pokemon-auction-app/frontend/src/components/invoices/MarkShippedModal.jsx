import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { invoiceService, CARRIERS } from '../../services/invoiceService';

export default function MarkShippedModal({ invoice, onClose, onShipped }) {
  const [carrier, setCarrier] = useState(invoice?.tracking_carrier || '');
  const [trackingNumber, setTrackingNumber] = useState(invoice?.tracking_number || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!invoice) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const tn = trackingNumber.trim();
    if (!tn) return setError('Tracking number is required');
    if (tn.length > 100) return setError('Tracking number too long (max 100)');
    if (!CARRIERS.includes(carrier)) return setError('Please pick a carrier');

    setSubmitting(true);
    try {
      const res = await invoiceService.markShipped(invoice.id, {
        tracking_number: tn,
        tracking_carrier: carrier,
      });
      toast.success('Tracking submitted — awaiting admin review');
      onShipped?.(res.invoice);
      onClose();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to submit tracking';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1f2e] rounded-2xl border border-gray-800 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-bold text-white">Mark as shipped</h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{invoice.card_name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white bg-gray-800 hover:bg-gray-700 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {invoice.review_notes && (
            <div className="bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs p-3 rounded-lg">
              <span className="font-bold">Previous review note:</span> {invoice.review_notes}
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Carrier</label>
            <select
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none"
            >
              <option value="">Select carrier…</option>
              {CARRIERS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Tracking number</label>
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="e.g. SG123456789"
              maxLength={100}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none"
              autoFocus
            />
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs p-3 rounded-lg">
            Your shipment will be reviewed by our team before payout is released. Usually within 24 hours.
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-300 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-5 py-2 rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit tracking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

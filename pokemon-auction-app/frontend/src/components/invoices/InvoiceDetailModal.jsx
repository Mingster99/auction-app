import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { invoiceService } from '../../services/invoiceService';

const fmtMoney = (v) => `$${parseFloat(v || 0).toFixed(2)}`;

const STATUS_BADGE = {
  pending: 'bg-amber-500/20 text-amber-400',
  awaiting_review: 'bg-blue-500/20 text-blue-400',
  processing: 'bg-blue-500/20 text-blue-400',
  paid: 'bg-green-500/20 text-green-400',
  shipped: 'bg-green-500/20 text-green-400',
  failed: 'bg-red-500/20 text-red-400',
  refunded: 'bg-gray-500/20 text-gray-400',
};

const STATUS_LABEL = {
  pending: 'Pending shipment',
  awaiting_review: 'Awaiting review',
  shipped: 'Shipped',
  paid: 'Paid',
  processing: 'Processing',
  failed: 'Failed',
  refunded: 'Refunded',
};

export default function InvoiceDetailModal({ invoiceId, onClose }) {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await invoiceService.getOne(invoiceId);
        if (active) setInvoice(data);
      } catch (err) {
        if (active) setError(err.response?.data?.message || 'Failed to load invoice');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [invoiceId]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1f2e] rounded-2xl border border-gray-800 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">Invoice #{invoiceId}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white bg-gray-800 hover:bg-gray-700 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {loading && <p className="text-gray-400 p-6">Loading…</p>}

        {error && (
          <div className="m-5 bg-red-500/20 border border-red-500/50 text-red-300 p-4 rounded-xl">{error}</div>
        )}

        {invoice && (
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ImageBlock label="FRONT" src={invoice.card_image_front || invoice.image_url} />
              <ImageBlock label="BACK" src={invoice.card_image_back} fallbackText="No back image" />
            </div>

            <div className="bg-gray-900/50 rounded-xl p-4 space-y-2">
              <Row label="Card" value={invoice.card_name} />
              <Row label="Grade" value={invoice.psa_grade ? `PSA ${invoice.psa_grade}` : invoice.condition || '—'} />
              <Row
                label="Seller"
                value={
                  <Link to={`/seller/${invoice.seller_username}`} className="text-violet-400 hover:text-violet-300">
                    @{invoice.seller_username}
                  </Link>
                }
              />
              <Row label="Amount" value={<span className="font-bold">{fmtMoney(invoice.amount)}</span>} />
              <Row
                label="Status"
                value={
                  <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${STATUS_BADGE[invoice.status] || 'bg-gray-500/20 text-gray-400'}`}>
                    {STATUS_LABEL[invoice.status] || invoice.status}
                  </span>
                }
              />
              <Row label="Created" value={new Date(invoice.created_at).toLocaleString()} />
              {invoice.shipped_at && (
                <Row label="Shipped" value={new Date(invoice.shipped_at).toLocaleString()} />
              )}
              {invoice.tracking_number && (
                <Row label="Tracking" value={`${invoice.tracking_carrier} · ${invoice.tracking_number}`} />
              )}
              {invoice.released_at && (
                <Row label="Payout released" value={new Date(invoice.released_at).toLocaleString()} />
              )}
              {invoice.review_notes && invoice.status === 'pending' && (
                <Row
                  label="Review note"
                  value={<span className="text-amber-300">{invoice.review_notes}</span>}
                />
              )}
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs p-3 rounded-lg">
              Stripe charging is stubbed — no real charge will occur yet.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ImageBlock({ label, src, fallbackText }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-2 font-medium">{label}</p>
      {src ? (
        <img src={src} alt={label} className="w-full rounded-xl bg-gray-900 object-contain max-h-[400px]" />
      ) : (
        <div className="w-full aspect-[3/4] bg-gray-900 rounded-xl flex items-center justify-center text-gray-700">
          <span className="text-xs text-gray-600">{fallbackText || '🎴'}</span>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <span className="text-xs text-gray-500 uppercase font-medium pt-0.5">{label}</span>
      <span className="text-sm text-white text-right min-w-0">{value}</span>
    </div>
  );
}

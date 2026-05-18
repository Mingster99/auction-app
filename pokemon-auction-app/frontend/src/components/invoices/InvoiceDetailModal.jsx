import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { invoiceService } from '../../services/invoiceService';

const fmtMoney = (v) => `$${parseFloat(v || 0).toFixed(2)}`;
const fmtDate = (d) => d ? new Date(d).toLocaleString() : null;

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
  pending:          'Awaiting Payment',
  paid:             'Paid',
  pickup_scheduled: 'Pickup Scheduled',
  picked_up:        'On Its Way',
  delivered:        'Delivered',
  failed:           'Failed',
  refunded:         'Refunded',
};

// Delivery timeline steps
const STEPS = [
  { key: 'ordered',  label: 'Order placed',      dateKey: 'created_at' },
  { key: 'scheduled', label: 'Pickup scheduled', dateKey: 'pickup_scheduled_at' },
  { key: 'picked_up', label: 'Picked up',        dateKey: 'picked_up_at' },
  { key: 'delivered', label: 'Delivered',         dateKey: 'delivered_at' },
];

function statusToStep(status) {
  if (status === 'delivered') return 3;
  if (status === 'picked_up') return 2;
  if (status === 'pickup_scheduled') return 1;
  return 0;
}

function DeliveryTimeline({ invoice }) {
  const reached = statusToStep(invoice.status);

  return (
    <div className="space-y-1">
      {STEPS.map((step, i) => {
        const done = i <= reached;
        const date = invoice[step.dateKey];
        return (
          <div key={step.key} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full mt-0.5 shrink-0 ${done ? 'bg-violet-500' : 'bg-gray-700'}`} />
              {i < STEPS.length - 1 && (
                <div className={`w-px flex-1 min-h-[16px] ${done && i < reached ? 'bg-violet-500/50' : 'bg-gray-800'}`} />
              )}
            </div>
            <div className="pb-3">
              <p className={`text-sm font-medium ${done ? 'text-white' : 'text-gray-600'}`}>{step.label}</p>
              {date && <p className="text-xs text-gray-500">{fmtDate(date)}</p>}
              {step.key === 'scheduled' && invoice.pickup_note && done && (
                <p className="text-xs text-violet-300 mt-0.5 max-w-xs">{invoice.pickup_note}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">Order #{invoiceId}</h2>
          <button onClick={onClose}
            className="text-gray-500 hover:text-white bg-gray-800 hover:bg-gray-700 w-8 h-8 rounded-lg flex items-center justify-center transition-colors">
            ✕
          </button>
        </div>

        {loading && <p className="text-gray-400 p-6">Loading…</p>}

        {error && (
          <div className="m-5 bg-red-500/20 border border-red-500/50 text-red-300 p-4 rounded-xl">{error}</div>
        )}

        {invoice && (
          <div className="p-5 space-y-5">
            {/* Card images */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ImageBlock label="FRONT" src={invoice.card_image_front || invoice.image_url} />
              <ImageBlock label="BACK" src={invoice.card_image_back} fallbackText="No back image" />
            </div>

            {/* Order details */}
            <div className="bg-gray-900/50 rounded-xl p-4 space-y-2">
              <Row label="Card" value={invoice.card_name || '—'} />
              <Row label="Grade" value={invoice.psa_grade ? `PSA ${invoice.psa_grade}` : invoice.condition || '—'} />
              <Row label="Seller" value={
                <Link to={`/seller/${invoice.seller_username}`} className="text-violet-400 hover:text-violet-300">
                  @{invoice.seller_username}
                </Link>
              } />
              <Row label="Amount" value={<span className="font-bold">{fmtMoney(invoice.amount)}</span>} />
              <Row label="Status" value={
                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${STATUS_BADGE[invoice.status] || 'bg-gray-500/20 text-gray-400'}`}>
                  {STATUS_LABEL[invoice.status] || invoice.status}
                </span>
              } />
              <Row label="Order date" value={fmtDate(invoice.created_at)} />
            </div>

            {/* Delivery timeline */}
            <div className="bg-gray-900/50 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase font-medium mb-4">Delivery Progress</p>
              <DeliveryTimeline invoice={invoice} />
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
        <div className="w-full aspect-[3/4] bg-gray-900 rounded-xl flex items-center justify-center">
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

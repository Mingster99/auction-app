import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { adminService } from '../services/adminService';
import { formatDistanceToNow, format } from 'date-fns';

const fmtMoney = (v) => `$${parseFloat(v || 0).toFixed(2)}`;
const fmtDate = (d) => d ? format(new Date(d), 'dd MMM yyyy, HH:mm') : '—';
const fmtAgo = (d) => d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : '—';

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
  pending:          'Pending',
  paid:             'Paid',
  pickup_scheduled: 'Pickup Scheduled',
  picked_up:        'Picked Up',
  delivered:        'Delivered',
  failed:           'Failed',
  refunded:         'Refunded',
};

const TABS = [
  { key: 'all',              label: 'All Sales' },
  { key: 'pending',         label: 'Awaiting Scheduling' },
  { key: 'pickup_scheduled', label: 'Scheduled Pickups' },
  { key: 'picked_up',        label: 'In Transit' },
  { key: 'delivered',        label: 'Delivered' },
  { key: 'audit',            label: 'Audit Log' },
];

// ── TOTP Validation Modal ─────────────────────────────────────────────────

function TotpValidationModal({ onVerified, onSetupNeeded }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await adminService.validateTotp(code.trim());
      toast.success('Admin session verified');
      onVerified();
    } catch (error) {
      const data = error.response?.data;
      if (data?.code === 'TOTP_NOT_SETUP') {
        onSetupNeeded();
      } else {
        setErr(data?.message || 'Invalid code');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 max-w-sm w-full p-8 space-y-5">
        <div className="text-center">
          <div className="text-4xl mb-3">🔐</div>
          <h2 className="text-xl font-black text-white">Admin Verification</h2>
          <p className="text-gray-400 text-sm mt-1">Enter your 6-digit authenticator code to continue.</p>
        </div>
        {err && (
          <div className="bg-red-500/20 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm">{err}</div>
        )}
        <form onSubmit={submit} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            autoFocus
            className="w-full bg-gray-900 border border-gray-700 text-white text-center text-2xl font-mono rounded-xl px-4 py-3 tracking-widest focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
          />
          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold transition-all"
          >
            {loading ? 'Verifying…' : 'Verify'}
          </button>
        </form>
        <p className="text-center text-xs text-gray-600">
          Need to set up 2FA?{' '}
          <button onClick={onSetupNeeded} className="text-violet-400 hover:text-violet-300">Set up now</button>
        </p>
      </div>
    </div>
  );
}

// ── TOTP Setup Page ───────────────────────────────────────────────────────

function TotpSetupPage({ onDone }) {
  const [data, setData] = useState(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    adminService.setupTotp().then(setData).catch(() => setErr('Failed to load TOTP setup'));
  }, []);

  const activate = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await adminService.activateTotp(code.trim());
      setActivated(true);
    } catch (error) {
      setErr(error.response?.data?.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  if (activated) {
    return (
      <div className="min-h-screen bg-[#0f1419] flex items-center justify-center">
        <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 max-w-sm w-full p-8 text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h2 className="text-xl font-black text-white">2FA Activated!</h2>
          <p className="text-gray-400 text-sm">Your admin account is now secured with TOTP.</p>
          <button onClick={onDone} className="w-full bg-violet-600 hover:bg-violet-500 text-white py-3 rounded-xl font-bold">
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1419] flex items-center justify-center p-4">
      <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 max-w-md w-full p-8 space-y-6">
        <div>
          <h2 className="text-2xl font-black text-white">Set up Admin 2FA</h2>
          <p className="text-gray-400 text-sm mt-1">
            Scan this QR code with Google Authenticator, Authy, or any TOTP app.
          </p>
        </div>

        {err && <div className="bg-red-500/20 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm">{err}</div>}

        {data ? (
          <>
            <div className="flex justify-center">
              <img src={data.qr_data_url} alt="TOTP QR Code" className="w-48 h-48 rounded-xl bg-white p-2" />
            </div>
            <div className="bg-gray-900 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Manual entry key</p>
              <p className="font-mono text-sm text-violet-300 break-all">{data.secret}</p>
            </div>
            <form onSubmit={activate} className="space-y-3">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter the 6-digit code to verify"
                autoFocus
                className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm font-mono text-center tracking-widest focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              />
              <button
                type="submit"
                disabled={loading || code.length < 6}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold"
              >
                {loading ? 'Activating…' : 'Activate 2FA'}
              </button>
            </form>
          </>
        ) : (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Schedule Pickup Modal ─────────────────────────────────────────────────

function SchedulePickupModal({ invoice, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!note.trim()) { toast.error('Please add a pickup note'); return; }
    setLoading(true);
    try {
      await adminService.schedulePickup(invoice.id, note.trim());
      toast.success('Pickup scheduled — seller notified');
      onDone();
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'TOTP_REQUIRED' || code === 'TOTP_EXPIRED') {
        toast.error('Admin session expired — re-validate your 2FA code');
      } else {
        toast.error(err.response?.data?.message || 'Failed to schedule pickup');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">Schedule Pickup</h2>
          <p className="text-xs text-gray-500 mt-0.5">@{invoice.seller_username} · {invoice.card_name}</p>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="bg-gray-900 rounded-xl p-3 text-sm space-y-1">
            <p className="text-gray-400">Seller address:</p>
            <p className="text-white font-medium">
              {[invoice.seller_address_line1, invoice.seller_address_line2, invoice.seller_city, invoice.seller_postal_code, invoice.seller_country]
                .filter(Boolean).join(', ')}
            </p>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. I will come by on Friday 23 May between 2–4pm. Please have the card ready."
            rows={4}
            maxLength={500}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:border-violet-500 outline-none resize-none"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium">Cancel</button>
            <button type="submit" disabled={loading}
              className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-5 py-2 rounded-xl text-sm disabled:opacity-50">
              {loading ? 'Scheduling…' : 'Notify Seller'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Confirm Pickup Modal (requires typing CONFIRM) ────────────────────────

function ConfirmPickupModal({ invoice, onClose, onDone }) {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await adminService.confirmPickup(invoice.id);
      toast.success('Pickup confirmed — payout released to seller');
      onDone();
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'TOTP_REQUIRED' || code === 'TOTP_EXPIRED') {
        toast.error('Admin session expired — re-validate your 2FA code');
      } else {
        toast.error(err.response?.data?.message || 'Confirm pickup failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">Confirm Pickup & Release Payout</h2>
          <p className="text-xs text-gray-500 mt-0.5">@{invoice.seller_username} · {invoice.card_name}</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-1 text-sm">
            <p className="text-amber-300 font-bold">This will immediately:</p>
            <p className="text-gray-300">• Release <strong className="text-white">{fmtMoney(invoice.seller_payout_amount)}</strong> to @{invoice.seller_username}</p>
            <p className="text-gray-300">• Notify the buyer their card has been picked up and is on its way</p>
            <p className="text-gray-500 text-xs pt-1">The card is removed from the seller's inventory when you confirm delivery.</p>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-2">Type <strong className="text-white font-mono">CONFIRM</strong> to proceed:</p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="CONFIRM"
              autoFocus
              className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium">Cancel</button>
            <button
              onClick={submit}
              disabled={loading || confirmText !== 'CONFIRM'}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-5 py-2 rounded-xl text-sm"
            >
              {loading ? 'Processing…' : 'Confirm Pickup & Release Payout'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Confirm Delivery Modal ────────────────────────────────────────────────

function ConfirmDeliveryModal({ invoice, onClose, onDone }) {
  const [loading, setLoading] = useState(false);

  const confirm = async () => {
    setLoading(true);
    try {
      await adminService.confirmDelivery(invoice.id);
      toast.success('Delivery confirmed — buyer notified');
      onDone();
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'TOTP_REQUIRED' || code === 'TOTP_EXPIRED') {
        toast.error('Admin session expired — re-validate your 2FA code');
      } else {
        toast.error(err.response?.data?.message || 'Confirm delivery failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">Confirm Delivery</h2>
          <p className="text-xs text-gray-500 mt-0.5">@{invoice.buyer_username} · {invoice.card_name}</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-gray-900 rounded-xl p-3 text-sm space-y-1">
            <p className="text-gray-400">Delivery address:</p>
            <p className="text-white font-medium">
              {[invoice.buyer_address_line1, invoice.buyer_address_line2, invoice.buyer_city, invoice.buyer_postal_code, invoice.buyer_country]
                .filter(Boolean).join(', ')}
            </p>
          </div>
          <p className="text-sm text-gray-300">
            This will mark the order as <strong className="text-green-400">Delivered</strong> and notify the buyer by email.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium">Cancel</button>
            <button onClick={confirm} disabled={loading}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-xl text-sm">
              {loading ? 'Confirming…' : 'Mark as Delivered'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Invoice Row ───────────────────────────────────────────────────────────

function InvoiceRow({ invoice, onAction }) {
  const thumb = invoice.card_image_front || invoice.image_url;
  const status = invoice.status;

  return (
    <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-4 flex flex-col sm:flex-row gap-4">
      <div className="w-16 h-16 sm:w-14 sm:h-14 bg-gray-900 rounded-lg overflow-hidden shrink-0">
        {thumb
          ? <img src={thumb} alt={invoice.card_name} className="w-full h-full object-contain" />
          : <div className="w-full h-full flex items-center justify-center text-xl text-gray-700">🎴</div>}
      </div>

      <div className="flex-1 min-w-0 space-y-1 text-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-white truncate">{invoice.card_name || '(card deleted)'}</p>
          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${STATUS_BADGE[status] || 'bg-gray-500/20 text-gray-400'}`}>
            {STATUS_LABEL[status] || status}
          </span>
        </div>
        <p className="text-xs text-gray-400">
          Seller: <strong className="text-gray-200">@{invoice.seller_username}</strong> →
          Buyer: <strong className="text-gray-200">@{invoice.buyer_username}</strong>
        </p>
        <p className="text-xs text-gray-400">
          Sale: <strong className="text-white">{fmtMoney(invoice.amount)}</strong> ·
          Payout: <strong className="text-amber-400">{fmtMoney(invoice.seller_payout_amount)}</strong>
        </p>
        {status === 'pickup_scheduled' && invoice.pickup_note && (
          <p className="text-xs text-violet-300 bg-violet-500/10 rounded-lg px-2 py-1 mt-1">
            Pickup note: {invoice.pickup_note}
          </p>
        )}
        {invoice.pickup_scheduled_at && (
          <p className="text-xs text-gray-500">Scheduled {fmtAgo(invoice.pickup_scheduled_at)}</p>
        )}
        {invoice.picked_up_at && (
          <p className="text-xs text-gray-500">Picked up {fmtAgo(invoice.picked_up_at)}</p>
        )}
        {invoice.delivered_at && (
          <p className="text-xs text-gray-500">Delivered {fmtDate(invoice.delivered_at)}</p>
        )}
      </div>

      <div className="flex sm:flex-col gap-2 sm:w-36 shrink-0">
        {(status === 'pending' || status === 'paid') && (
          <button onClick={() => onAction('schedule', invoice)}
            className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold px-3 py-2 rounded-xl text-sm transition-colors">
            Schedule Pickup
          </button>
        )}
        {status === 'pickup_scheduled' && (
          <button onClick={() => onAction('pickup', invoice)}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-2 rounded-xl text-sm transition-colors">
            Confirm Pickup
          </button>
        )}
        {status === 'picked_up' && (
          <button onClick={() => onAction('deliver', invoice)}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-2 rounded-xl text-sm transition-colors">
            Confirm Delivery
          </button>
        )}
      </div>
    </div>
  );
}

// ── Audit Log Tab ─────────────────────────────────────────────────────────

function AuditLogTab() {
  const [data, setData] = useState({ entries: [], total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService.getAuditLog({ limit: 100 }).then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  const ACTION_LABEL = {
    schedule_pickup:  'Scheduled Pickup',
    confirm_pickup:   'Confirmed Pickup (Payout Released)',
    confirm_delivery: 'Confirmed Delivery',
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">{data.total} admin actions logged</p>
      {loading ? (
        <div className="h-32 bg-[#1a1f2e] rounded-2xl animate-pulse" />
      ) : data.entries.length === 0 ? (
        <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-12 text-center text-gray-500">No audit entries yet.</div>
      ) : (
        <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-800">
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e) => (
                <tr key={e.id} className="border-b border-gray-800 last:border-0">
                  <td className="px-4 py-3 text-white">{ACTION_LABEL[e.action] || e.action}</td>
                  <td className="px-4 py-3 text-gray-400">#{e.invoice_id || '—'}</td>
                  <td className="px-4 py-3 text-violet-400">@{e.admin_username}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(e.created_at)}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{e.ip_address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Batch schedule pickup modal ───────────────────────────────────────────

function BatchScheduleModal({ seller, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!note.trim()) { toast.error('Please add a pickup note'); return; }
    setLoading(true);
    try {
      const res = await adminService.scheduleBatchPickup(seller.id, note.trim());
      toast.success(res.message);
      onDone();
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'TOTP_REQUIRED' || code === 'TOTP_EXPIRED') {
        toast.error('Admin session expired — re-validate your 2FA code');
      } else {
        toast.error(err.response?.data?.message || 'Failed to schedule pickup');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">Schedule all pickups from @{seller.name}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{seller.count} order{seller.count !== 1 ? 's' : ''} will be scheduled in one trip</p>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {seller.addr && (
            <div className="bg-gray-900 rounded-xl p-3 text-sm space-y-1">
              <p className="text-gray-400">Pickup address:</p>
              <p className="text-white font-medium">{seller.addr}</p>
              {seller.phone && <p className="text-violet-300">{seller.phone}</p>}
            </div>
          )}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Coming Friday 23 May between 2–4pm. All cards in one trip."
            rows={4}
            maxLength={500}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:border-violet-500 outline-none resize-none"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium">Cancel</button>
            <button type="submit" disabled={loading}
              className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-5 py-2 rounded-xl text-sm disabled:opacity-50">
              {loading ? 'Scheduling…' : `Schedule ${seller.count} Pickup${seller.count !== 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Grouped invoice list ──────────────────────────────────────────────────
// groupBy: 'seller' (pickup tabs) | 'buyer' (delivery tabs)

function GroupedList({ invoices, onAction, groupBy, onBatchSchedule }) {
  const isBuyer  = groupBy === 'buyer';
  const getName  = (inv) => isBuyer ? inv.buyer_username   : inv.seller_username;
  const getId    = (inv) => isBuyer ? inv.buyer_id          : inv.seller_id;
  const getPhone = (inv) => isBuyer ? inv.buyer_phone       : inv.seller_phone;
  const getAddr  = (inv) => isBuyer
    ? [inv.buyer_address_line1,  inv.buyer_address_line2,  inv.buyer_city,  inv.buyer_postal_code].filter(Boolean).join(', ')
    : [inv.seller_address_line1, inv.seller_address_line2, inv.seller_city, inv.seller_postal_code].filter(Boolean).join(', ');
  const dotColor = isBuyer ? 'bg-blue-500' : 'bg-violet-500';
  const roleLabel = isBuyer ? 'Delivering to' : 'Picking up from';

  const groups = [];
  let current = null;
  for (const inv of invoices) {
    const key = getName(inv);
    if (!current || current.name !== key) {
      current = { name: key, id: getId(inv), addr: getAddr(inv), phone: getPhone(inv), invoices: [] };
      groups.push(current);
    }
    current.invoices.push(inv);
  }

  // Count how many in each group can still be batch-scheduled (pending/paid only)
  const batchCount = (group) => group.invoices.filter(i => i.status === 'pending' || i.status === 'paid').length;

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const eligible = !isBuyer ? batchCount(group) : 0;
        return (
          <div key={group.name}>
            <div className="flex items-start gap-3 mb-2">
              <div className={`w-2 h-2 rounded-full ${dotColor} shrink-0 mt-2`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-white">@{group.name}</p>
                  <span className="text-xs text-gray-500">{group.invoices.length} order{group.invoices.length !== 1 ? 's' : ''}</span>
                  <span className="text-[10px] text-gray-600 uppercase tracking-wide">{roleLabel}</span>
                  {eligible > 1 && (
                    <button
                      onClick={() => onBatchSchedule({ id: group.id, name: group.name, addr: group.addr, phone: group.phone, count: eligible })}
                      className="ml-auto text-[11px] bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 border border-violet-600/40 px-2.5 py-0.5 rounded-lg transition-colors"
                    >
                      Schedule all {eligible} →
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {group.addr && <p className="text-xs text-gray-500">{group.addr}</p>}
                  {group.phone && (
                    <a href={`tel:${group.phone}`} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                      {group.phone}
                    </a>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-2 pl-5">
              {group.invoices.map((inv) => (
                <InvoiceRow key={inv.id} invoice={inv} onAction={onAction} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function AdminReviewPage() {
  const [totpState, setTotpState] = useState(() =>
    adminService.isTotpVerified() ? 'verified' : 'needs_validation'
  );
  const [activeTab, setActiveTab] = useState('all');
  const [sortByPostal, setSortByPostal] = useState(false);
  const [data, setData] = useState({ invoices: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { type: 'schedule'|'pickup'|'deliver'|'batch', invoice|seller }
  const [batchSeller, setBatchSeller] = useState(null);

  const refresh = useCallback(async () => {
    if (activeTab === 'audit') return;
    setLoading(true);
    setError('');
    try {
      const statusParam = activeTab === 'all' ? undefined : activeTab;
      const res = await adminService.getAllSales({
        limit: 100,
        status: statusParam,
        sort: sortByPostal ? 'postal_code' : undefined,
      });
      setData(res);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load sales');
    } finally {
      setLoading(false);
    }
  }, [activeTab, sortByPostal]);

  useEffect(() => {
    if (totpState === 'verified') refresh();
  }, [totpState, refresh]);

  const handleAction = (type, invoice) => setModal({ type, invoice });

  const closeModal = () => setModal(null);
  const afterAction = () => { setModal(null); refresh(); };

  if (totpState === 'needs_validation') {
    return (
      <TotpValidationModal
        onVerified={() => setTotpState('verified')}
        onSetupNeeded={() => setTotpState('setup')}
      />
    );
  }

  if (totpState === 'setup') {
    return <TotpSetupPage onDone={() => setTotpState('needs_validation')} />;
  }

  return (
    <div className="min-h-screen bg-[#0f1419] text-white">
      <div className="max-w-6xl mx-auto p-6 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-black">Delivery Dashboard</h1>
            <p className="text-gray-400 text-sm mt-1">{data.total} order{data.total === 1 ? '' : 's'} · Admin session active</p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab !== 'audit' && (
              <button
                onClick={() => setSortByPostal((v) => !v)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  sortByPostal
                    ? 'bg-violet-600/20 border-violet-500/50 text-violet-300'
                    : 'border-gray-800 text-gray-500 hover:text-gray-300'
                }`}
              >
                {sortByPostal ? 'Sorted by postal code' : 'Sort by postal code'}
              </button>
            )}
            <button
              onClick={() => { adminService.clearAdminToken(); setTotpState('needs_validation'); }}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors border border-gray-800 hover:border-red-500/40 px-3 py-1.5 rounded-lg"
            >
              Clear Session
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-gray-800 pb-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'text-violet-400 border-violet-500'
                  : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'audit' ? (
          <AuditLogTab />
        ) : (
          <>
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-300 p-4 rounded-xl">{error}</div>
            )}

            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-28 bg-[#1a1f2e] rounded-2xl border border-gray-800 animate-pulse" />
                ))}
              </div>
            ) : data.invoices.length === 0 ? (
              <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-12 text-center">
                <p className="text-4xl mb-3">📦</p>
                <p className="text-white font-bold">Nothing here</p>
                <p className="text-gray-500 text-sm mt-1">No orders in this category.</p>
              </div>
            ) : (
              <GroupedList
                invoices={data.invoices}
                onAction={handleAction}
                groupBy={activeTab === 'picked_up' || activeTab === 'delivered' ? 'buyer' : 'seller'}
                onBatchSchedule={(seller) => setBatchSeller(seller)}
              />
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {modal?.type === 'schedule' && (
        <SchedulePickupModal invoice={modal.invoice} onClose={closeModal} onDone={afterAction} />
      )}
      {modal?.type === 'pickup' && (
        <ConfirmPickupModal invoice={modal.invoice} onClose={closeModal} onDone={afterAction} />
      )}
      {modal?.type === 'deliver' && (
        <ConfirmDeliveryModal invoice={modal.invoice} onClose={closeModal} onDone={afterAction} />
      )}
      {batchSeller && (
        <BatchScheduleModal
          seller={batchSeller}
          onClose={() => setBatchSeller(null)}
          onDone={() => { setBatchSeller(null); refresh(); }}
        />
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { profileService } from '../services/profileService';

const fmtMoney = (v) => `$${parseFloat(v || 0).toFixed(2)}`;

const COUNTRIES = [
  'Singapore','Malaysia','Indonesia','Thailand','Philippines',
  'Vietnam','Australia','United States','United Kingdom','Other',
];

// ── Edit Details Panel ────────────────────────────────────────────────────

function EditDetailsPanel({ user, onSaved, onCancel }) {
  const [form, setForm] = useState({
    phone:         user.phone         || '',
    address_line1: user.address_line1 || '',
    address_line2: user.address_line2 || '',
    city:          user.city          || '',
    state:         user.state         || '',
    postal_code:   user.postal_code   || '',
    country:       user.country       || 'Singapore',
  });
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await profileService.updateDetails(form);
      toast.success('Profile updated');
      onSaved(res.user);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full bg-gray-900 border border-gray-800 text-white rounded-xl px-3 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all disabled:opacity-50';
  const labelCls = 'block text-xs text-gray-500 uppercase font-medium mb-1';

  return (
    <form onSubmit={handleSubmit} className="mt-5 border-t border-gray-800 pt-5 space-y-5">
      <p className="text-sm font-bold text-white">Edit details</p>

      {/* Contact */}
      <div>
        <label className={labelCls}>Phone number (optional)</label>
        <input type="tel" value={form.phone} onChange={set('phone')} disabled={saving} className={inputCls} placeholder="+65 9123 4567" />
      </div>

      {/* Address */}
      <div className="space-y-3">
        <p className="text-xs text-gray-500 uppercase font-medium">Delivery / Pickup Address</p>
        <div>
          <label className={labelCls}>Address line 1</label>
          <input type="text" value={form.address_line1} onChange={set('address_line1')} disabled={saving} className={inputCls} placeholder="123 Orchard Road" />
        </div>
        <div>
          <label className={labelCls}>Address line 2 / Unit (optional)</label>
          <input type="text" value={form.address_line2} onChange={set('address_line2')} disabled={saving} className={inputCls} placeholder="#05-01" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>City</label>
            <input type="text" value={form.city} onChange={set('city')} disabled={saving} className={inputCls} placeholder="Singapore" />
          </div>
          <div>
            <label className={labelCls}>Postal code</label>
            <input type="text" value={form.postal_code} onChange={set('postal_code')} disabled={saving} className={inputCls} placeholder="238801" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>State / Region (optional)</label>
            <input type="text" value={form.state} onChange={set('state')} disabled={saving} className={inputCls} placeholder="—" />
          </div>
          <div>
            <label className={labelCls}>Country</label>
            <select value={form.country} onChange={set('country')} disabled={saving} className={inputCls}>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={saving}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}
          className="text-gray-400 hover:text-white text-sm font-medium px-4 py-2.5 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Details display (read mode) ───────────────────────────────────────────

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-4 py-1.5">
      <span className="text-xs text-gray-500 uppercase font-medium w-24 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-white">{value}</span>
    </div>
  );
}

// ── Header card with inline edit ─────────────────────────────────────────

function Header({ user: initialUser, updateUser }) {
  const [user, setUser] = useState(initialUser);
  const [editing, setEditing] = useState(false);

  const address = [user.address_line1, user.address_line2, user.city, user.postal_code, user.country]
    .filter(Boolean).join(', ');

  const handleSaved = (updated) => {
    setUser(updated);
    updateUser(updated);
    setEditing(false);
  };

  return (
    <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-6">
      <div className="flex items-start sm:items-center gap-4 flex-col sm:flex-row">
        <div className="w-16 h-16 rounded-full bg-violet-600 flex items-center justify-center text-2xl font-bold text-white shrink-0">
          {user?.username?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-black truncate">@{user.username}</h1>
            {user.is_verified_seller && (
              <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-0.5 rounded-md">
                ✓ Verified Seller
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Member since {new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!editing && (
            <button onClick={() => setEditing(true)}
              className="border border-gray-700 hover:border-gray-600 text-gray-400 hover:text-white font-medium px-4 py-2 rounded-xl text-sm transition-colors">
              Edit details
            </button>
          )}
          {user.is_verified_seller && (
            <Link to="/dashboard"
              className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors">
              Seller dashboard →
            </Link>
          )}
        </div>
      </div>

      {/* Read-mode details */}
      {!editing && (user.email || user.phone || address) && (
        <div className="mt-4 pt-4 border-t border-gray-800">
          <DetailRow label="Email"   value={user.email} />
          <DetailRow label="Phone"   value={user.phone} />
          <DetailRow label="Address" value={address} />
        </div>
      )}

      {editing && (
        <EditDetailsPanel
          user={user}
          onSaved={handleSaved}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { isAuthenticated, loading: authLoading, updateUser } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    (async () => {
      try {
        const res = await profileService.getOverview();
        if (active) setData(res);
      } catch (err) {
        if (active) setError(err.response?.data?.message || 'Failed to load profile');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [isAuthenticated]);

  if (authLoading) return <PageShell><p className="text-gray-400">Loading…</p></PageShell>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (loading) return <PageShell><p className="text-gray-400">Loading…</p></PageShell>;
  if (error) return <PageShell><div className="bg-red-500/20 border border-red-500/50 text-red-300 p-4 rounded-xl">{error}</div></PageShell>;

  const { user, my_cards, my_bids, won_cards } = data;

  return (
    <PageShell>
      <Header user={user} updateUser={updateUser} />

      <CardRow
        title="My cards"
        cards={my_cards}
        emptyText="No cards listed yet"
        viewAllLink="/my-cards"
        renderMeta={(c) => (
          <span className="text-violet-400 font-bold text-xs">
            {parseFloat(c.starting_bid) > 0 ? fmtMoney(c.starting_bid) : '—'}
          </span>
        )}
      />

      <CardRow
        title="My bids"
        cards={my_bids.map((b) => ({
          id: b.card_id,
          name: b.card_name,
          card_image_front: b.card_image_front,
          image_url: b.image_url,
          psa_grade: b.psa_grade,
          _bid_amount: b.amount,
          _is_winning: b.is_winning_bid,
        }))}
        emptyText="No bids placed yet"
        viewAllLink="/my-bids"
        renderMeta={(c) => (
          <span className={`text-xs font-bold ${c._is_winning ? 'text-green-400' : 'text-gray-400'}`}>
            {fmtMoney(c._bid_amount)} {c._is_winning && '· winning'}
          </span>
        )}
      />

      <CardRow
        title="Won cards"
        cards={won_cards}
        emptyText="No wins yet"
        viewAllLink="/my-cards"
        renderMeta={(c) => (
          <span className="text-green-400 font-bold text-xs">{fmtMoney(c.current_bid)}</span>
        )}
      />
    </PageShell>
  );
}

function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-[#0f1419] text-white">
      <div className="max-w-7xl mx-auto p-6 space-y-6">{children}</div>
    </div>
  );
}

function CardRow({ title, cards, emptyText, viewAllLink, renderMeta }) {
  return (
    <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wide">{title}</h3>
        {viewAllLink && cards.length > 0 && (
          <Link to={viewAllLink} className="text-xs text-violet-400 hover:text-violet-300">View all →</Link>
        )}
      </div>
      {cards.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">{emptyText}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {cards.map((c) => (
            <CardThumb key={`${title}-${c.id}-${c._bid_amount ?? ''}`} card={c} meta={renderMeta?.(c)} />
          ))}
        </div>
      )}
    </div>
  );
}

function CardThumb({ card, meta }) {
  const thumb = card.card_image_front || card.image_url;
  return (
    <Link to={`/card/${card.id}`}
      className="block bg-gray-900/50 rounded-xl border border-gray-800 hover:border-gray-700 overflow-hidden group transition-colors">
      <div className="relative aspect-[3/4] bg-gray-900 overflow-hidden">
        {thumb ? (
          <img src={thumb} alt={card.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-700"><span className="text-3xl">🎴</span></div>
        )}
        {card.psa_grade && (
          <span className="absolute top-1.5 left-1.5 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            PSA {card.psa_grade}
          </span>
        )}
      </div>
      <div className="p-2.5">
        <p className="text-xs text-white font-medium truncate group-hover:text-violet-300 transition-colors">{card.name}</p>
        {meta && <div className="mt-0.5">{meta}</div>}
      </div>
    </Link>
  );
}

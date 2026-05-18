import React, { useEffect, useState, useCallback } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const PAGE_SIZE = 25;
const fmtMoney = (v) => `$${parseFloat(v || 0).toFixed(2)}`;

const FILTERS = [
  { value: 'all',    label: 'All bids' },
  { value: 'won',    label: 'Won' },
  { value: 'outbid', label: 'Outbid' },
  { value: 'active', label: 'Active' },
];

function outcomeLabel(bid) {
  if (bid.auction_status === 'active') return { text: 'Active',  cls: 'bg-blue-500/20 text-blue-400' };
  if (bid.is_winning_bid && bid.auction_status === 'sold') return { text: 'Won', cls: 'bg-green-500/20 text-green-400' };
  if (!bid.is_winning_bid && ['sold','ended'].includes(bid.auction_status)) return { text: 'Outbid', cls: 'bg-red-500/20 text-red-400' };
  return { text: bid.auction_status, cls: 'bg-gray-500/20 text-gray-400' };
}

export default function MyBidsPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [data, setData]       = useState({ bids: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [outcome, setOutcome] = useState('all');
  const [offset, setOffset]   = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: PAGE_SIZE, offset });
      if (outcome !== 'all') params.set('outcome', outcome);
      const res = await api.get(`/bids/user?${params}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load bids');
    } finally {
      setLoading(false);
    }
  }, [outcome, offset]);

  useEffect(() => { if (isAuthenticated) load(); }, [isAuthenticated, load]);
  useEffect(() => { setOffset(0); }, [outcome]);

  if (authLoading) return <Shell><p className="text-gray-400">Loading…</p></Shell>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const totalPages  = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <Shell>
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/profile')}
          className="text-gray-500 hover:text-white transition-colors text-sm flex items-center gap-1"
        >
          ← Back to profile
        </button>
      </div>

      <div>
        <h1 className="text-3xl font-black">My Bids</h1>
        <p className="text-gray-400 text-sm mt-1">{data.total} bid{data.total !== 1 ? 's' : ''} total</p>
      </div>

      {/* Outcome filter tabs */}
      <div className="flex gap-1 border-b border-gray-800 pb-0">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setOutcome(f.value)}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
              outcome === f.value
                ? 'text-violet-400 border-violet-500'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-300 p-4 rounded-xl">{error}</div>
      )}

      {/* Bid list */}
      <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 overflow-hidden">
        {loading ? (
          <div className="space-y-px">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 animate-pulse border-b border-gray-800 last:border-0">
                <div className="w-12 h-16 bg-gray-800 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-800 rounded w-1/3" />
                  <div className="h-2 bg-gray-800 rounded w-1/4" />
                </div>
                <div className="h-3 bg-gray-800 rounded w-16" />
              </div>
            ))}
          </div>
        ) : data.bids.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-4xl mb-3">🎯</p>
            <p className="text-white font-bold">No bids here</p>
            <p className="text-gray-500 text-sm mt-1">
              {outcome === 'all' ? "You haven't placed any bids yet." : `No ${outcome} bids.`}
            </p>
            <Link to="/cards" className="inline-block mt-4 text-violet-400 hover:text-violet-300 text-sm">
              Browse cards →
            </Link>
          </div>
        ) : (
          <div>
            {data.bids.map((bid) => {
              const { text, cls } = outcomeLabel(bid);
              const thumb = bid.card_image_front || bid.image_url;
              return (
                <Link
                  key={bid.id}
                  to={`/card/${bid.card_id}`}
                  className="flex items-center gap-4 p-4 border-b border-gray-800 last:border-0 hover:bg-gray-800/30 transition-colors"
                >
                  {/* Card thumbnail */}
                  <div className="w-12 h-16 bg-gray-900 rounded-lg overflow-hidden shrink-0">
                    {thumb
                      ? <img src={thumb} alt={bid.card_name} className="w-full h-full object-contain" />
                      : <div className="w-full h-full flex items-center justify-center text-gray-700 text-xl">🎴</div>}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-white text-sm truncate">{bid.card_name}</p>
                      {bid.psa_grade && (
                        <span className="text-[10px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded shrink-0">
                          PSA {bid.psa_grade}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      @{bid.seller_username} · {formatDistanceToNow(new Date(bid.placed_at), { addSuffix: true })}
                    </p>
                    {bid.auction_status === 'sold' && !bid.is_winning_bid && bid.current_bid && (
                      <p className="text-xs text-gray-600 mt-0.5">Winning bid: {fmtMoney(bid.current_bid)}</p>
                    )}
                  </div>

                  {/* Right side */}
                  <div className="text-right shrink-0 space-y-1.5">
                    <p className="font-bold text-white text-sm">{fmtMoney(bid.amount)}</p>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${cls}`}>
                      {text}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && data.total > PAGE_SIZE && (
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
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-[#0f1419] text-white">
      <div className="max-w-3xl mx-auto p-6 space-y-4">{children}</div>
    </div>
  );
}

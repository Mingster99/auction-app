import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { sellerService } from '../../services/sellerService';

const fmtMoney = (v) => `$${parseFloat(v || 0).toFixed(2)}`;

const STATUS_BADGE = {
  pending: 'bg-amber-500/20 text-amber-400',
  processing: 'bg-blue-500/20 text-blue-400',
  paid: 'bg-green-500/20 text-green-400',
  failed: 'bg-red-500/20 text-red-400',
  refunded: 'bg-gray-500/20 text-gray-400',
};

export default function OverviewTab({ onNavigateTab }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await sellerService.getOverview();
        if (active) setData(res);
      } catch (err) {
        if (active) setError(err.response?.data?.message || 'Failed to load overview');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-6 animate-pulse">
            <div className="h-3 bg-gray-800 rounded w-1/2 mb-3" />
            <div className="h-8 bg-gray-800 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/20 border border-red-500/50 text-red-300 p-4 rounded-xl">
        {error}
      </div>
    );
  }

  const { stats, recent_sales, recent_bids, upcoming_streams } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Pending payouts"
          value={fmtMoney(stats.pending_payouts)}
          accent="text-amber-400"
        />
        <StatCard
          label="Sales this month"
          value={fmtMoney(stats.sales_this_month)}
          accent="text-green-400"
        />
        <StatCard
          label="Active listings"
          value={stats.active_listings_count}
          accent="text-violet-400"
          onClick={() => onNavigateTab?.('inventory')}
        />
        <StatCard
          label="Upcoming streams"
          value={stats.upcoming_streams_count}
          accent="text-blue-400"
          onClick={() => onNavigateTab?.('streams')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Widget title="Recent sales" emptyText="No sales yet">
          {recent_sales.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-800 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white truncate">{s.card_name}</p>
                <p className="text-xs text-gray-500">to {s.buyer_username} · {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-white">{fmtMoney(s.amount)}</p>
                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${STATUS_BADGE[s.status] || 'bg-gray-500/20 text-gray-400'}`}>
                  {s.status}
                </span>
              </div>
            </div>
          ))}
        </Widget>

        <Widget title="Recent bids on your cards" emptyText="No recent bids">
          {recent_bids.map((b, i) => (
            <Link
              key={`${b.card_id}-${b.placed_at}-${i}`}
              to={`/card/${b.card_id}`}
              className="flex items-center justify-between gap-3 py-2 border-b border-gray-800 last:border-0 hover:bg-gray-800/30 -mx-2 px-2 rounded transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white truncate">{b.card_name}</p>
                <p className="text-xs text-gray-500">{b.bidder_username} · {formatDistanceToNow(new Date(b.placed_at), { addSuffix: true })}</p>
              </div>
              <p className="text-sm font-bold text-violet-400 shrink-0">{fmtMoney(b.amount)}</p>
            </Link>
          ))}
        </Widget>

        <Widget title="Upcoming streams" emptyText="None scheduled" action={
          <button onClick={() => onNavigateTab?.('streams')} className="text-xs text-violet-400 hover:text-violet-300">
            Manage →
          </button>
        }>
          {upcoming_streams.map((s) => (
            <div key={s.id} className="py-2 border-b border-gray-800 last:border-0">
              <p className="text-sm text-white truncate">{s.title}</p>
              <p className="text-xs text-gray-500">
                {new Date(s.scheduled_start_time).toLocaleString()}
                {s.queued_card_count > 0 && ` · ${s.queued_card_count} card${s.queued_card_count === 1 ? '' : 's'} queued`}
              </p>
            </div>
          ))}
        </Widget>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent = 'text-white', onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`bg-[#1a1f2e] rounded-2xl border border-gray-800 p-6 text-left ${onClick ? 'hover:border-gray-700 transition-colors cursor-pointer' : ''}`}
    >
      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</p>
      <p className={`text-2xl font-black mt-1 ${accent}`}>{value}</p>
    </Tag>
  );
}

function Widget({ title, children, emptyText, action }) {
  const items = React.Children.toArray(children);
  return (
    <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white uppercase tracking-wide">{title}</h3>
        {action}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">{emptyText}</p>
      ) : (
        <div>{items}</div>
      )}
    </div>
  );
}

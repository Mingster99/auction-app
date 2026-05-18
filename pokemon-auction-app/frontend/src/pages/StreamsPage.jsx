import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { streamService } from '../services/streamService';

const fmtMoney = (v) => `$${parseFloat(v || 0).toFixed(2)}`;

// ── Countdown timer ───────────────────────────────────────────────────────

function Countdown({ targetDate }) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    const tick = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) { setLabel('Starting soon'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000)  / 60000);
      const s = Math.floor((diff % 60000)    / 1000);
      setLabel(d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return <span>{label}</span>;
}

// ── Live stream card (horizontal row item) ────────────────────────────────

function LiveCard({ stream }) {
  const navigate = useNavigate();
  const thumb = stream.active_card?.card_image_front
    || stream.active_card?.image_url
    || stream.preview_cards?.[0]?.card_image_front
    || stream.preview_cards?.[0]?.image_url;

  return (
    <div
      onClick={() => navigate(`/livestream/${stream.id}`)}
      className="relative flex-shrink-0 w-72 bg-[#1a1f2e] rounded-2xl border border-gray-800 hover:border-red-500/50 overflow-hidden cursor-pointer group transition-colors"
    >
      {/* Banner */}
      <div className="h-36 bg-gradient-to-br from-gray-900 to-[#0f1419] flex items-center justify-center gap-3 px-4 overflow-hidden">
        {thumb ? (
          <img
            src={thumb}
            alt={stream.active_card?.name || 'Card'}
            className="h-28 w-auto object-contain group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="text-gray-700 text-4xl">🎴</div>
        )}
        {stream.preview_cards?.length > 0 && stream.active_card && (
          <div className="flex flex-col gap-1.5 opacity-40">
            {stream.preview_cards.slice(0, 2).map((c) => (
              <img
                key={c.id}
                src={c.card_image_front || c.image_url}
                alt={c.name}
                className="h-12 w-auto object-contain rounded"
              />
            ))}
          </div>
        )}
      </div>

      {/* LIVE badge */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 text-white text-[11px] font-black px-2 py-0.5 rounded-md">
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        LIVE
      </div>

      {/* Cards sold badge */}
      {stream.cards_sold > 0 && (
        <div className="absolute top-3 right-3 bg-black/60 text-gray-300 text-[10px] font-medium px-2 py-0.5 rounded-md">
          {stream.cards_sold} sold
        </div>
      )}

      <div className="p-4">
        {/* Host */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
            {stream.host_name?.[0]?.toUpperCase()}
          </div>
          <span className="text-violet-400 text-xs font-medium">@{stream.host_name}</span>
        </div>

        <h3 className="font-bold text-white text-sm truncate mb-1">{stream.title}</h3>

        {/* Currently auctioning */}
        {stream.active_card && (
          <p className="text-xs text-amber-400 truncate">
            Now: {stream.active_card.name}
            {stream.active_card.current_bid
              ? ` · ${fmtMoney(stream.active_card.current_bid)}`
              : stream.active_card.starting_bid
              ? ` · from ${fmtMoney(stream.active_card.starting_bid)}`
              : ''}
          </p>
        )}

        <button className="w-full mt-3 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl transition-colors">
          Watch Live
        </button>
      </div>
    </div>
  );
}

// ── Scheduled stream card ─────────────────────────────────────────────────

function ScheduledCard({ stream, subscribed, onToggleNotify }) {
  const navigate = useNavigate();

  return (
    <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 hover:border-violet-600/40 overflow-hidden transition-colors">
      {/* Card previews */}
      <div className="h-32 bg-[#0f1419] flex items-center justify-center gap-2 px-4">
        {stream.preview_cards?.length > 0 ? (
          stream.preview_cards.map((c) => (
            <img
              key={c.id}
              src={c.card_image_front || c.image_url}
              alt={c.name}
              className="h-24 w-auto object-contain rounded"
            />
          ))
        ) : (
          <p className="text-gray-700 text-sm">No cards queued yet</p>
        )}
      </div>

      <div className="p-4">
        {/* Host */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {stream.host_name?.[0]?.toUpperCase()}
          </div>
          <span
            onClick={() => navigate(`/seller/${stream.host_name}`)}
            className="text-violet-400 text-sm font-medium cursor-pointer hover:underline"
          >
            @{stream.host_name}
          </span>
        </div>

        <h3 className="font-bold text-white truncate mb-1">{stream.title}</h3>
        {stream.description && (
          <p className="text-gray-500 text-sm mb-3 line-clamp-2">{stream.description}</p>
        )}

        {/* Countdown */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-gray-400 text-xs">Starts in</span>
          <span className="bg-violet-600/20 text-violet-400 text-xs font-mono font-bold px-2 py-0.5 rounded">
            <Countdown targetDate={stream.scheduled_start_time} />
          </span>
        </div>

        <div className="flex items-center justify-between mb-4 text-xs text-gray-500">
          <span>{stream.preview_cards?.length || 0} card{(stream.preview_cards?.length || 0) !== 1 ? 's' : ''} queued</span>
          <span>{stream.subscriber_count || 0} notified</span>
        </div>

        <button
          onClick={() => onToggleNotify(stream.id)}
          className={`w-full py-2.5 rounded-xl font-bold text-sm transition-colors ${
            subscribed
              ? 'bg-violet-600/20 text-violet-400 border border-violet-600/50 hover:bg-violet-600/30'
              : 'bg-violet-600 hover:bg-violet-700 text-white'
          }`}
        >
          {subscribed ? "✓ You'll be notified" : 'Get Notified'}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function StreamsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [liveStreams,      setLiveStreams]      = useState([]);
  const [scheduledStreams, setScheduledStreams] = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [subscribedStreams, setSubscribedStreams] = useState(new Set());

  useEffect(() => {
    const load = async () => {
      try {
        const [live, scheduled] = await Promise.all([
          streamService.getActiveStreams(),
          streamService.getUpcomingStreams(),
        ]);
        setLiveStreams(Array.isArray(live) ? live : []);
        setScheduledStreams(Array.isArray(scheduled) ? scheduled : []);
      } catch (err) {
        console.error('Failed to load streams', err);
      } finally {
        setLoading(false);
      }
    };
    load();
    // Refresh live streams every 30 s to catch new ones going live
    const id = setInterval(() => streamService.getActiveStreams()
      .then((d) => setLiveStreams(Array.isArray(d) ? d : []))
      .catch(() => {}), 30000);
    return () => clearInterval(id);
  }, []);

  // Check notification subscriptions for scheduled streams
  useEffect(() => {
    if (!user || scheduledStreams.length === 0) return;
    (async () => {
      const subscribed = new Set();
      for (const s of scheduledStreams) {
        try {
          const { subscribed: isSub } = await streamService.getNotificationStatus(s.id);
          if (isSub) subscribed.add(s.id);
        } catch {}
      }
      setSubscribedStreams(subscribed);
    })();
  }, [user, scheduledStreams]);

  const handleToggleNotify = useCallback(async (streamId) => {
    if (!user) { navigate('/login'); return; }
    try {
      const { subscribed } = await streamService.toggleNotification(streamId);
      setSubscribedStreams((prev) => {
        const next = new Set(prev);
        subscribed ? next.add(streamId) : next.delete(streamId);
        return next;
      });
    } catch {}
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1419] flex items-center justify-center">
        <p className="text-gray-400">Loading streams…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1419] text-white">
      <div className="max-w-6xl mx-auto p-6 space-y-10">

        {/* ── Live now ── */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="flex items-center gap-1.5 bg-red-600/20 text-red-400 text-xs font-black px-2.5 py-1 rounded-lg border border-red-600/30">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              LIVE NOW
            </span>
            <span className="text-gray-500 text-sm">
              {liveStreams.length === 0 ? 'No streams live right now' : `${liveStreams.length} stream${liveStreams.length !== 1 ? 's' : ''}`}
            </span>
          </div>

          {liveStreams.length === 0 ? (
            <div className="bg-[#1a1f2e] border border-gray-800 rounded-2xl p-10 text-center">
              <p className="text-3xl mb-3">📡</p>
              <p className="text-gray-400 font-medium">No one is live right now</p>
              <p className="text-gray-600 text-sm mt-1">Check the scheduled streams below to see what's coming up</p>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: 'thin' }}>
              {liveStreams.map((s) => <LiveCard key={s.id} stream={s} />)}
            </div>
          )}
        </section>

        {/* ── Scheduled ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-black">Upcoming Streams</h2>
              <p className="text-gray-500 text-sm mt-0.5">Scheduled auctions from verified sellers</p>
            </div>
            <span className="text-gray-600 text-sm">{scheduledStreams.length} scheduled</span>
          </div>

          {scheduledStreams.length === 0 ? (
            <div className="bg-[#1a1f2e] border border-gray-800 rounded-2xl p-10 text-center">
              <p className="text-3xl mb-3">📅</p>
              <p className="text-gray-400 font-medium">No streams scheduled</p>
              <p className="text-gray-600 text-sm mt-1">Check back soon</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {scheduledStreams.map((s) => (
                <ScheduledCard
                  key={s.id}
                  stream={s}
                  subscribed={subscribedStreams.has(s.id)}
                  onToggleNotify={handleToggleNotify}
                />
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}

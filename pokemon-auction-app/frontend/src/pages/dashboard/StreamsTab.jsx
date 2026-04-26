import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { sellerService } from '../../services/sellerService';
import { streamService } from '../../services/streamService';
import ScheduleStreamModal from '../../components/seller/ScheduleStreamModal';

const fmtMoney = (v) => `$${parseFloat(v || 0).toFixed(2)}`;

export default function StreamsTab() {
  const navigate = useNavigate();
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [actioningId, setActioningId] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await sellerService.getStreams();
      setStreams(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load streams');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Re-render every 30s so countdowns stay reasonably current
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const handleGoLive = async (id) => {
    setActioningId(id);
    try {
      await streamService.goLive(id);
      navigate('/stream/host');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to go live');
      setActioningId(null);
    }
  };

  const handleCancel = async (id, title) => {
    if (!window.confirm(`Cancel "${title}"?`)) return;
    setActioningId(id);
    try {
      await streamService.endStream(id);
      toast.success('Stream cancelled');
      await refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel');
    } finally {
      setActioningId(null);
    }
  };

  const live = streams.filter((s) => s.status === 'live');
  const scheduled = streams.filter((s) => s.status === 'scheduled');
  const past = streams.filter((s) => s.status === 'ended' || s.status === 'cancelled');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {scheduled.length} scheduled · {live.length} live · {past.length} past
        </p>
        <button
          onClick={() => setScheduleOpen(true)}
          className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-5 py-2.5 rounded-xl transition-colors text-sm"
        >
          + Schedule new stream
        </button>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-300 p-4 rounded-xl">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-20 bg-[#1a1f2e] rounded-2xl border border-gray-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {live.length > 0 && (
            <Section title="Live now">
              {live.map((s) => (
                <LiveRow key={s.id} stream={s} onResume={() => navigate('/stream/host')} />
              ))}
            </Section>
          )}

          <Section title="Scheduled" emptyText="No upcoming streams. Schedule one to let subscribers know.">
            {scheduled.map((s) => (
              <ScheduledRow
                key={s.id}
                stream={s}
                actioning={actioningId === s.id}
                onGoLive={() => handleGoLive(s.id)}
                onCancel={() => handleCancel(s.id, s.title)}
              />
            ))}
          </Section>

          <Section title="Past" emptyText="No past streams yet.">
            {past.map((s) => <PastRow key={s.id} stream={s} />)}
          </Section>
        </>
      )}

      <ScheduleStreamModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onScheduled={refresh}
      />
    </div>
  );
}

function Section({ title, children, emptyText }) {
  const items = React.Children.toArray(children);
  return (
    <div>
      <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{title}</h2>
      {items.length === 0 ? (
        emptyText && (
          <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-6 text-center text-sm text-gray-500">
            {emptyText}
          </div>
        )
      ) : (
        <div className="space-y-2">{items}</div>
      )}
    </div>
  );
}

function LiveRow({ stream, onResume }) {
  return (
    <div className="bg-[#1a1f2e] rounded-2xl border border-red-500/40 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-bold text-red-400 uppercase">Live</span>
        </div>
        <p className="font-bold text-white truncate mt-0.5">{stream.title}</p>
        <p className="text-xs text-gray-500">{stream.viewer_count || 0} viewer{stream.viewer_count === 1 ? '' : 's'}</p>
      </div>
      <button
        onClick={onResume}
        className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2 rounded-xl text-sm shrink-0"
      >
        ↩ Resume host view
      </button>
    </div>
  );
}

function ScheduledRow({ stream, actioning, onGoLive, onCancel }) {
  const start = new Date(stream.scheduled_start_time);
  const minsUntil = Math.round((start.getTime() - Date.now()) / 60000);
  const canGoLive = minsUntil <= 15;

  let countdown = '';
  if (minsUntil > 60 * 24) countdown = `in ${Math.round(minsUntil / 60 / 24)}d`;
  else if (minsUntil > 60) countdown = `in ${Math.round(minsUntil / 60)}h`;
  else if (minsUntil > 0) countdown = `in ${minsUntil}m`;
  else countdown = 'now';

  return (
    <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="font-bold text-white truncate">{stream.title}</p>
        <p className="text-xs text-gray-500">
          {start.toLocaleString()} <span className="text-violet-400">· {countdown}</span>
          {stream.queued_card_count > 0 && ` · ${stream.queued_card_count} card${stream.queued_card_count === 1 ? '' : 's'} queued`}
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        {canGoLive && (
          <button
            onClick={onGoLive}
            disabled={actioning}
            className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            Go live
          </button>
        )}
        <button
          onClick={onCancel}
          disabled={actioning}
          className="bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-4 py-2 rounded-xl text-sm transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function PastRow({ stream }) {
  const when = stream.ended_at || stream.started_at || stream.scheduled_start_time;
  return (
    <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="font-bold text-white truncate">{stream.title}</p>
        <p className="text-xs text-gray-500">
          {when ? new Date(when).toLocaleString() : '—'}
          {stream.status === 'cancelled' && ' · cancelled'}
        </p>
      </div>
      <div className="flex gap-6 text-sm shrink-0">
        <Stat label="Viewers" value={stream.viewer_count || 0} />
        <Stat label="Sold" value={stream.cards_sold || 0} />
        <Stat label="Revenue" value={fmtMoney(stream.total_revenue)} accent="text-green-400" />
      </div>
    </div>
  );
}

function Stat({ label, value, accent = 'text-white' }) {
  return (
    <div>
      <p className="text-[10px] text-gray-500 uppercase font-medium">{label}</p>
      <p className={`font-bold ${accent}`}>{value}</p>
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { streamService } from '../services/streamService';

function CountdownTimer({ targetDate }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const tick = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Starting soon...');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return <span>{timeLeft}</span>;
}

function UpcomingStreamsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subscribedStreams, setSubscribedStreams] = useState(new Set());

  useEffect(() => {
    const fetchStreams = async () => {
      try {
        const data = await streamService.getUpcomingStreams();
        setStreams(data);
      } catch (err) {
        setError('Failed to load upcoming streams');
      } finally {
        setLoading(false);
      }
    };
    fetchStreams();
  }, []);

  // Check notification status for each stream if user is logged in
  useEffect(() => {
    if (!user || streams.length === 0) return;

    const checkSubscriptions = async () => {
      const subscribed = new Set();
      for (const stream of streams) {
        try {
          const { subscribed: isSub } = await streamService.getNotificationStatus(stream.id);
          if (isSub) subscribed.add(stream.id);
        } catch {
          // ignore
        }
      }
      setSubscribedStreams(subscribed);
    };
    checkSubscriptions();
  }, [user, streams]);

  const handleToggleNotify = useCallback(async (streamId) => {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      const { subscribed } = await streamService.toggleNotification(streamId);
      setSubscribedStreams((prev) => {
        const next = new Set(prev);
        if (subscribed) {
          next.add(streamId);
        } else {
          next.delete(streamId);
        }
        return next;
      });
    } catch (err) {
      console.error('Failed to toggle notification:', err);
    }
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1419] flex items-center justify-center">
        <p className="text-gray-400 text-lg">Loading upcoming streams...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1419] text-white">
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-3xl font-black mb-2">Upcoming Streams</h1>
        <p className="text-gray-400 mb-8">Browse scheduled livestream auctions from verified sellers</p>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 p-4 rounded-xl mb-6">
            {error}
          </div>
        )}

        {streams.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">No upcoming streams scheduled</p>
            <p className="text-gray-600 text-sm mt-2">Check back later for scheduled auctions</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {streams.map((stream) => (
              <div
                key={stream.id}
                className="bg-[#1a1f2e] rounded-2xl border border-gray-800 overflow-hidden hover:border-violet-600/50 transition-colors"
              >
                {/* Preview card thumbnails */}
                <div className="h-36 bg-[#0f1419] flex items-center justify-center gap-2 p-4">
                  {stream.preview_cards && stream.preview_cards.length > 0 ? (
                    stream.preview_cards.map((card) => (
                      <img
                        key={card.id}
                        src={card.card_image_front || card.image_url}
                        alt={card.name}
                        className="h-28 w-auto object-cover rounded-lg"
                      />
                    ))
                  ) : (
                    <p className="text-gray-600 text-sm">No cards queued yet</p>
                  )}
                </div>

                <div className="p-4">
                  {/* Host info */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold">
                      {stream.host_name?.charAt(0).toUpperCase()}
                    </div>
                    <span
                      className="text-violet-400 text-sm font-medium cursor-pointer hover:underline"
                      onClick={() => navigate(`/seller/${stream.host_name}`)}
                    >
                      {stream.host_name}
                    </span>
                  </div>

                  {/* Stream title & description */}
                  <h3 className="font-bold text-lg mb-1 truncate">{stream.title}</h3>
                  {stream.description && (
                    <p className="text-gray-500 text-sm mb-3 line-clamp-2">{stream.description}</p>
                  )}

                  {/* Countdown */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-gray-400 text-sm">Starts in</span>
                    <span className="bg-violet-600/20 text-violet-400 text-sm font-mono font-bold px-2 py-0.5 rounded">
                      <CountdownTimer targetDate={stream.scheduled_start_time} />
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-gray-500 text-xs">
                      {stream.preview_cards?.length || 0} card{(stream.preview_cards?.length || 0) !== 1 ? 's' : ''} queued
                    </span>
                    <span className="text-gray-500 text-xs">
                      {stream.subscriber_count || 0} subscriber{(stream.subscriber_count || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Notify button */}
                  <button
                    onClick={() => handleToggleNotify(stream.id)}
                    className={`w-full py-2.5 rounded-xl font-medium text-sm transition-colors ${
                      subscribedStreams.has(stream.id)
                        ? 'bg-violet-600/20 text-violet-400 border border-violet-600/50 hover:bg-violet-600/30'
                        : 'bg-violet-600 hover:bg-violet-700 text-white'
                    }`}
                  >
                    {subscribedStreams.has(stream.id) ? "You'll be notified" : 'Get Notified'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default UpcomingStreamsPage;

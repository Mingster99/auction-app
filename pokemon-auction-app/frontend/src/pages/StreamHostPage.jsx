import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLiveKit } from '../hooks/useLiveKit';
import { useWebSocket } from '../hooks/useWebSocket';
import { streamService } from '../services/streamService';
import api from '../services/api';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ── Card Detail Modal ────────────────────────────────────
function CardDetailModal({ card, onClose, onStartAuction, canStartAuction }) {
  if (!card) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-[#1a1f2e] rounded-2xl border border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Card images */}
        <div className="flex gap-4 p-6 pb-0 justify-center">
          {(card.card_image_front || card.image_url) && (
            <div className="flex-shrink-0">
              <p className="text-xs text-gray-500 mb-1 text-center">Front</p>
              <img
                src={card.card_image_front || card.image_url}
                alt={`${card.name} front`}
                className="w-48 h-auto rounded-lg border border-gray-700 object-contain"
              />
            </div>
          )}
          {card.card_image_back && (
            <div className="flex-shrink-0">
              <p className="text-xs text-gray-500 mb-1 text-center">Back</p>
              <img
                src={card.card_image_back}
                alt={`${card.name} back`}
                className="w-48 h-auto rounded-lg border border-gray-700 object-contain"
              />
            </div>
          )}
        </div>

        {/* Card details */}
        <div className="p-6 space-y-4">
          <h2 className="text-xl font-black text-white">{card.name}</h2>

          <div className="grid grid-cols-2 gap-3">
            {card.psa_grade && (
              <div className="bg-blue-600/10 border border-blue-600/20 rounded-xl px-4 py-3">
                <p className="text-xs text-blue-400 mb-0.5">PSA Grade</p>
                <p className="text-lg font-black text-blue-300">{card.psa_grade}</p>
              </div>
            )}
            {card.set && (
              <div className="bg-gray-800 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-500 mb-0.5">Set</p>
                <p className="text-sm font-medium text-white">{card.set}</p>
              </div>
            )}
            {card.rarity && (
              <div className="bg-gray-800 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-500 mb-0.5">Rarity</p>
                <p className="text-sm font-medium text-white">{card.rarity}</p>
              </div>
            )}
            {card.condition && (
              <div className="bg-gray-800 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-500 mb-0.5">Condition</p>
                <p className="text-sm font-medium text-white">{card.condition}</p>
              </div>
            )}
            <div className="bg-violet-600/10 border border-violet-600/20 rounded-xl px-4 py-3">
              <p className="text-xs text-violet-400 mb-0.5">Starting Bid</p>
              <p className="text-lg font-black text-violet-300">
                ${parseFloat(card.starting_bid || 0).toFixed(2)}
              </p>
            </div>
            {card.buyout_price && (
              <div className="bg-amber-600/10 border border-amber-600/20 rounded-xl px-4 py-3">
                <p className="text-xs text-amber-400 mb-0.5">Buyout Price</p>
                <p className="text-lg font-black text-amber-300">
                  ${parseFloat(card.buyout_price).toFixed(2)}
                </p>
              </div>
            )}
            {card.auction_duration_seconds && (
              <div className="bg-gray-800 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-500 mb-0.5">Auction Duration</p>
                <p className="text-sm font-medium text-white">{card.auction_duration_seconds}s</p>
              </div>
            )}
            {card.cert_number && (
              <div className="bg-gray-800 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-500 mb-0.5">PSA Cert #</p>
                <p className="text-sm font-medium text-white">{card.cert_number}</p>
              </div>
            )}
          </div>

          {card.description && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Description</p>
              <p className="text-sm text-gray-300">{card.description}</p>
            </div>
          )}

          {/* Auction status */}
          {card.auction_status && card.auction_status !== 'idle' && (
            <div className={`rounded-xl px-4 py-3 ${
              card.auction_status === 'sold'
                ? 'bg-green-600/10 border border-green-600/20'
                : card.auction_status === 'active'
                  ? 'bg-red-600/10 border border-red-600/20'
                  : 'bg-gray-800 border border-gray-700'
            }`}>
              <p className="text-xs text-gray-400 mb-0.5">Auction Status</p>
              <p className={`text-sm font-bold ${
                card.auction_status === 'sold' ? 'text-green-400'
                  : card.auction_status === 'active' ? 'text-red-400'
                    : 'text-gray-400'
              }`}>
                {card.auction_status.toUpperCase()}
              </p>
            </div>
          )}

          {/* Start Auction button */}
          {canStartAuction && (
            <button
              onClick={() => {
                onStartAuction(card.id);
                onClose();
              }}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Start Auction
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sortable Queue Card ──────────────────────────────────
function SortableCard({ card, isNext, onStartAuction, auctionActive, onCardClick }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // 'ended' means no sale — card is still available for re-auction
  const isAuctionable = !card.auction_status || card.auction_status === 'idle' || card.auction_status === 'ended';

  const statusBadge = card.auction_status === 'sold'
    ? 'bg-green-600/20 text-green-400'
    : card.auction_status === 'active'
      ? 'bg-red-600/20 text-red-400'
      : '';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer hover:bg-white/5 ${
        isNext ? 'border-violet-600/50 bg-violet-600/5' : 'border-gray-800 bg-[#0f1419]'
      }`}
      onClick={() => onCardClick(card)}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 px-1"
        onClick={(e) => e.stopPropagation()}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="3" r="1.5" />
          <circle cx="11" cy="3" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="13" r="1.5" />
          <circle cx="11" cy="13" r="1.5" />
        </svg>
      </div>

      {/* Card image */}
      {(card.card_image_front || card.image_url) && (
        <img
          src={card.card_image_front || card.image_url}
          alt={card.name}
          className="w-10 h-14 object-cover rounded"
        />
      )}

      {/* Card info */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{card.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {card.psa_grade && (
            <span className="text-blue-400 text-xs font-bold">PSA {card.psa_grade}</span>
          )}
          <span className="text-gray-500 text-xs">${parseFloat(card.starting_bid || 0).toFixed(2)}</span>
          {card.buyout_price && (
            <span className="text-amber-400 text-xs">BO: ${parseFloat(card.buyout_price).toFixed(2)}</span>
          )}
        </div>
      </div>

      {/* Status badge or action */}
      {!isAuctionable ? (
        <span className={`text-xs font-bold px-2 py-1 rounded ${statusBadge}`}>
          {card.auction_status.toUpperCase()}
        </span>
      ) : isNext && !auctionActive ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStartAuction(card.id);
          }}
          className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
        >
          Start Auction
        </button>
      ) : null}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────
function StreamHost() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef(null);

  const {
    isJoined,
    isPublishing,
    isMicMuted,
    isCameraMuted,
    localVideoTrack,
    error: livekitError,
    joinAsHost,
    leave,
    toggleMic,
    toggleCamera,
  } = useLiveKit();

  // Stream state
  const [streamId, setStreamId] = useState(null);
  const [streamTitle, setStreamTitle] = useState('');
  const [streamDescription, setStreamDescription] = useState('');
  const [streamStatus, setStreamStatus] = useState('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Queue state
  const [queue, setQueue] = useState([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);

  // Auction state (from WebSocket)
  const {
    connected: wsConnected,
    auctionState,
    currentBid,
    auctionError,
    joinAuction,
    leaveAuction,
  } = useWebSocket(streamId);

  const [timeRemaining, setTimeRemaining] = useState(null);
  const [bidHistory, setBidHistory] = useState([]);

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Socket ref for emitting events
  const socketRef = useRef(null);

  // Get raw socket for emitting seller events
  useEffect(() => {
    if (!streamId) return;
    const io = require('socket.io-client');
    const WS_URL = process.env.REACT_APP_WS_URL || 'http://localhost:5000';
    const socket = io(WS_URL, {
      auth: { token: localStorage.getItem('token') },
    });
    socket.on('connect', () => {
      socket.emit('join-auction', streamId);
    });

    // Listen for auction events on this socket too
    socket.on('auction-started', (data) => {
      setBidHistory([]);
      setQueue((prev) =>
        prev.map((c) => (c.id === data.card?.id ? { ...c, auction_status: 'active' } : c))
      );
    });
    socket.on('new-bid', (bid) => {
      setBidHistory((prev) => [
        { username: bid.bidderUsername, amount: bid.amount, timestamp: bid.timestamp || Date.now() },
        ...prev,
      ].slice(0, 20));
    });
    socket.on('auction-ended', (data) => {
      setQueue((prev) =>
        prev.map((c) => {
          if (c.id === data.cardId) {
            return { ...c, auction_status: data.winner ? 'sold' : 'ended' };
          }
          return c;
        })
      );
    });
    socket.on('card-skipped', (data) => {
      setQueue((prev) => prev.filter((c) => c.id !== data.cardId));
    });
    socket.on('auction-error', (data) => {
      setError(data.message);
      setTimeout(() => setError(''), 3000);
    });

    socketRef.current = socket;
    return () => {
      socket.close();
    };
  }, [streamId]);

  // Check for existing live stream on mount
  useEffect(() => {
    const checkExistingStream = async () => {
      try {
        const response = await streamService.getActiveStreams();
        const streams = response.data || response;
        const myStream = streams.find(
          (s) => s.host_name === user?.username && s.status === 'live'
        );
        if (myStream) {
          setStreamId(myStream.id);
          setStreamTitle(myStream.title);
          setStreamStatus('existing');
        }
      } catch (err) {
        console.log('No existing stream found');
      }
    };
    if (user) checkExistingStream();
  }, [user]);

  // Fetch queue when stream is set
  useEffect(() => {
    if (!streamId) return;
    const fetchQueue = async () => {
      setQueueLoading(true);
      try {
        const response = await api.get('/inventory/queue');
        const cards = response.data;
        setQueue(cards);
      } catch (err) {
        console.error('Failed to fetch queue:', err);
      } finally {
        setQueueLoading(false);
      }
    };
    fetchQueue();
  }, [streamId]);

  // Drop back to 'existing' (Rejoin) if LiveKit disconnects unexpectedly mid-stream
  useEffect(() => {
    if (streamStatus === 'live' && !isJoined && !loading) {
      setStreamStatus('existing');
    }
  }, [isJoined, streamStatus, loading]);

  // Disconnect from LiveKit when host navigates away
  useEffect(() => {
    return () => {
      leave();
    };
  }, [leave]);

  // Play local video when track is available
  useEffect(() => {
    if (localVideoTrack && videoRef.current) {
      localVideoTrack.attach(videoRef.current);
      return () => {
        localVideoTrack.detach(videoRef.current);
      };
    }
  }, [localVideoTrack]);

  // Client-side countdown
  useEffect(() => {
    if (!auctionState?.auction_ends_at || auctionState?.auction_status !== 'active') {
      setTimeRemaining(null);
      return;
    }
    const endTime = new Date(auctionState.auction_ends_at).getTime();
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setTimeRemaining(remaining);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [auctionState?.auction_ends_at, auctionState?.auction_status]);

  // Create Stream
  const handleCreateStream = async (e) => {
    e.preventDefault();
    if (!streamTitle.trim()) {
      setError('Please enter a stream title');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await streamService.createStream({
        title: streamTitle,
        description: streamDescription,
      });
      const stream = response.data || response;
      const newId = stream.id || stream.streamId;
      setStreamId(newId);
      setStreamStatus('created');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create stream');
    } finally {
      setLoading(false);
    }
  };

  // Go Live
  const handleGoLive = async () => {
    if (!streamId) return;
    setLoading(true);
    setError('');
    try {
      const response = await streamService.startStream(streamId);
      const data = response.data || response;
      const { token, wsUrl } = data.livekit;
      await joinAsHost(wsUrl, token);
      setStreamStatus('live');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to go live');
    } finally {
      setLoading(false);
    }
  };

  // End Stream
  const handleEndStream = async () => {
    try {
      await leave();
      await streamService.endStream(streamId);
      setStreamStatus('idle');
      setStreamId(null);
      navigate('/');
    } catch (err) {
      console.error('Error ending stream:', err);
    }
  };

  // Start auction for a card
  const handleStartAuction = useCallback(
    (cardId) => {
      if (socketRef.current) {
        socketRef.current.emit('start-auction', { streamId, cardId });
      }
    },
    [streamId]
  );

  // End auction early
  const handleEndAuctionEarly = useCallback(() => {
    if (socketRef.current && auctionState?.card?.id) {
      socketRef.current.emit('end-auction-early', { cardId: auctionState.card.id });
    }
  }, [auctionState]);

  // Skip card
  const handleSkipCard = useCallback(
    (cardId) => {
      if (socketRef.current) {
        socketRef.current.emit('skip-card', { streamId, cardId });
      }
    },
    [streamId]
  );

  // Drag end handler for queue reordering
  const handleDragEnd = useCallback(
    async (event) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = queue.findIndex((c) => c.id === active.id);
      const newIndex = queue.findIndex((c) => c.id === over.id);
      const newQueue = arrayMove(queue, oldIndex, newIndex);
      setQueue(newQueue);

      try {
        await api.patch('/inventory/queue-order', {
          cardIds: newQueue.map((c) => c.id),
        });
      } catch (err) {
        console.error('Failed to save queue order:', err);
        // Revert on failure
        setQueue(queue);
      }
    },
    [queue]
  );

  const auctionActive = auctionState?.auction_status === 'active';
  // Cards that are idle or ended-without-sale can be auctioned again
  const canAuction = (c) => !c.auction_status || c.auction_status === 'idle' || c.auction_status === 'ended';
  const nextCard = queue.find(canAuction);

  return (
    <div className="min-h-screen bg-[#0f1419] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-black mb-6">
          {streamStatus === 'live' ? "You're Live!" : 'Start a Stream'}
        </h1>

        {(error || livekitError || auctionError) && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 p-4 rounded-xl mb-6">
            {error || livekitError || auctionError}
          </div>
        )}

        {/* Step 1: Create Stream Form */}
        {streamStatus === 'idle' && (
          <form onSubmit={handleCreateStream} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Stream Title</label>
              <input
                type="text"
                value={streamTitle}
                onChange={(e) => setStreamTitle(e.target.value)}
                placeholder="e.g., Opening Vintage Pokemon Packs!"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Description (optional)</label>
              <textarea
                value={streamDescription}
                onChange={(e) => setStreamDescription(e.target.value)}
                placeholder="What cards will you be auctioning?"
                rows={3}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-6 py-3 rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Stream'}
            </button>
          </form>
        )}

        {/* Existing Stream: Rejoin or End */}
        {streamStatus === 'existing' && (
          <div className="space-y-4">
            <p className="text-gray-400">
              You have an active stream:{' '}
              <span className="text-white font-semibold">"{streamTitle}"</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleGoLive}
                disabled={loading}
                className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-8 py-4 rounded-xl text-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Reconnecting...' : 'Rejoin Stream'}
              </button>
              <button
                onClick={handleEndStream}
                className="bg-gray-800 hover:bg-red-600 text-white font-medium px-6 py-4 rounded-xl transition-colors"
              >
                End Stream
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Go Live Button */}
        {streamStatus === 'created' && (
          <div className="space-y-4">
            <p className="text-gray-400">
              Stream "<span className="text-white">{streamTitle}</span>" is ready.
              Click below to go live!
            </p>
            <button
              onClick={handleGoLive}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-4 rounded-xl text-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Connecting...' : 'Go Live'}
            </button>
          </div>
        )}

        {/* Step 3: Live Stream View */}
        {streamStatus === 'live' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Video + Controls */}
            <div className="lg:col-span-2 space-y-4">
              <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                {!localVideoTrack && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                    {isPublishing ? 'Audio-only (no camera detected)' : 'Connecting...'}
                  </div>
                )}
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 px-3 py-1.5 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-sm font-bold">LIVE</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleMic()}
                  className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                    isMicMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  {isMicMuted ? 'Unmute' : 'Mute'}
                </button>
                <button
                  onClick={() => toggleCamera()}
                  className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                    isCameraMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  {isCameraMuted ? 'Camera On' : 'Camera Off'}
                </button>
                <button
                  onClick={handleEndStream}
                  className="bg-gray-800 hover:bg-red-600 px-4 py-2 rounded-xl font-medium transition-colors ml-auto"
                >
                  End Stream
                </button>
              </div>

              <div className="text-sm text-gray-500 space-y-1">
                <p>Connected: {isJoined ? 'Yes' : 'No'} | Publishing: {isPublishing ? 'Yes' : 'No'}</p>
                <p>
                  Share link:{' '}
                  <code className="text-violet-400">
                    {`${window.location.origin}/livestream/${streamId}`}
                  </code>
                </p>
              </div>
            </div>

            {/* Right: Auction + Queue */}
            <div className="lg:col-span-1 space-y-4">
              {/* Active Auction Card */}
              {auctionActive && auctionState?.card && (
                <div className="bg-[#1a1f2e] rounded-2xl border border-violet-600/30 p-4">
                  {/* Header + Timer */}
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-sm text-gray-400">ACTIVE AUCTION</h3>
                    <div
                      className={`px-3 py-1 rounded-lg font-mono font-bold text-lg ${
                        timeRemaining !== null && timeRemaining <= 10
                          ? 'bg-red-600/30 text-red-400 animate-pulse'
                          : timeRemaining !== null && timeRemaining <= 30
                            ? 'bg-yellow-600/30 text-yellow-400'
                            : 'bg-violet-600/30 text-violet-400'
                      }`}
                    >
                      {timeRemaining !== null ? `${timeRemaining}s` : '--'}
                    </div>
                  </div>

                  {/* Card Images — front + back side by side */}
                  <div className="flex gap-3 justify-center mb-3">
                    {(auctionState.card.card_image_front || auctionState.card.image_url) && (
                      <img
                        src={auctionState.card.card_image_front || auctionState.card.image_url}
                        alt={`${auctionState.card.name} front`}
                        className="w-32 h-auto rounded-lg border border-gray-700 object-contain"
                      />
                    )}
                    {auctionState.card.card_image_back && (
                      <img
                        src={auctionState.card.card_image_back}
                        alt={`${auctionState.card.name} back`}
                        className="w-32 h-auto rounded-lg border border-gray-700 object-contain"
                      />
                    )}
                  </div>

                  {/* Card Name + Info */}
                  <div className="mb-3">
                    <h4 className="font-bold text-white text-lg">{auctionState.card.name}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      {auctionState.card.psa_grade && (
                        <span className="text-blue-400 text-xs font-bold">PSA {auctionState.card.psa_grade}</span>
                      )}
                      {auctionState.card.set && (
                        <span className="text-gray-500 text-xs">{auctionState.card.set}</span>
                      )}
                    </div>
                  </div>

                  {/* Current Bid */}
                  <div className="bg-[#0f1419] rounded-xl p-3 mb-3">
                    <p className="text-xs text-gray-500 mb-1">Current Bid</p>
                    <p className="text-2xl font-black text-white">
                      ${parseFloat(
                        auctionState.current_bid ||
                          auctionState.card.current_bid ||
                          auctionState.card.starting_bid ||
                          0
                      ).toFixed(2)}
                    </p>
                    {(currentBid?.bidderUsername || auctionState.current_bidder) && (
                      <p className="text-violet-400 text-sm font-medium mt-0.5">
                        by {currentBid?.bidderUsername || auctionState.current_bidder}
                      </p>
                    )}
                    {auctionState.card.buyout_price && (
                      <p className="text-amber-400 text-xs mt-1">
                        Buyout: ${parseFloat(auctionState.card.buyout_price).toFixed(2)}
                      </p>
                    )}
                  </div>

                  {/* Live Bid Feed */}
                  {bidHistory.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-2">LIVE BIDS</p>
                      <div className="bg-[#0f1419] rounded-xl p-2 max-h-[140px] overflow-y-auto space-y-1">
                        {bidHistory.map((bid, i) => {
                          const secsAgo = Math.round((Date.now() - new Date(bid.timestamp).getTime()) / 1000);
                          return (
                            <div key={i} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg hover:bg-white/5">
                              <span className="text-white font-medium truncate mr-2">{bid.username}</span>
                              <span className="text-green-400 font-bold whitespace-nowrap">${parseFloat(bid.amount).toFixed(2)}</span>
                              <span className="text-gray-600 ml-2 whitespace-nowrap">{secsAgo}s ago</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Host Controls */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleEndAuctionEarly}
                      className="flex-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 font-medium py-2 rounded-xl transition-colors text-sm"
                    >
                      End Early
                    </button>
                    <button
                      onClick={() => handleSkipCard(auctionState.card.id)}
                      className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2 rounded-xl transition-colors text-sm"
                    >
                      Skip Card
                    </button>
                  </div>
                </div>
              )}

              {/* Auction Result */}
              {auctionState?.auction_status === 'ended' && auctionState?.result && (
                <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-4">
                  <h3 className="font-bold text-sm text-gray-400 mb-2">
                    {auctionState.result.isCancelled
                      ? 'AUCTION CANCELLED'
                      : auctionState.result.winner
                        ? 'SOLD!'
                        : 'NO BIDS'}
                  </h3>
                  {auctionState.result.winner && (
                    <p className="text-green-400">
                      <span className="font-bold">{auctionState.result.winner}</span> won for{' '}
                      <span className="font-black text-lg">
                        ${parseFloat(auctionState.result.amount || 0).toFixed(2)}
                      </span>
                      {auctionState.result.isBuyout && (
                        <span className="ml-2 text-amber-400 text-sm">(Buyout)</span>
                      )}
                    </p>
                  )}
                </div>
              )}

              {/* Stream Queue */}
              <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-4">
                <h3 className="font-bold text-sm text-gray-400 mb-4">
                  STREAM QUEUE ({queue.length} card{queue.length !== 1 ? 's' : ''})
                </h3>

                {queueLoading ? (
                  <p className="text-gray-500 text-sm">Loading queue...</p>
                ) : queue.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm">No cards in queue</p>
                    <p className="text-gray-600 text-xs mt-1">
                      Add cards from your{' '}
                      <span
                        className="text-violet-400 cursor-pointer hover:underline"
                        onClick={() => navigate('/my-cards')}
                      >
                        inventory
                      </span>
                    </p>
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={queue.map((c) => c.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2 max-h-[500px] overflow-y-auto">
                        {queue.map((card) => (
                          <SortableCard
                            key={card.id}
                            card={card}
                            isNext={nextCard?.id === card.id}
                            onStartAuction={handleStartAuction}
                            auctionActive={auctionActive}
                            onCardClick={setSelectedCard}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Card Detail Modal */}
      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onStartAuction={handleStartAuction}
          canStartAuction={
            streamStatus === 'live' &&
            !auctionActive &&
            (!selectedCard.auction_status || selectedCard.auction_status === 'idle' || selectedCard.auction_status === 'ended')
          }
        />
      )}
    </div>
  );
}

export default StreamHost;

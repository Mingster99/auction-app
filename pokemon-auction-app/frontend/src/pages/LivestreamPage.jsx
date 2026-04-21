import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLiveKit } from '../hooks/useLiveKit';
import { useWebSocket } from '../hooks/useWebSocket';
import { streamService } from '../services/streamService';

function StreamViewer() {
  const { id } = useParams();
  const streamId = id;
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef(null);

  const {
    isJoined,
    remoteVideoTrack,
    isHostPresent,
    error: livekitError,
    joinAsViewer,
    leave,
  } = useLiveKit();

  const {
    connected: wsConnected,
    auctionState,
    currentBid,
    auctionError,
    placeBid,
    buyout,
    joinAuction,
    leaveAuction,
    clearAuctionError,
  } = useWebSocket(streamId);

  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [streamEnded, setStreamEnded] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [showBuyoutConfirm, setShowBuyoutConfirm] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);

  // Fetch stream info
  useEffect(() => {
    const fetchStream = async () => {
      try {
        const response = await streamService.getStreamById(streamId);
        const data = response.data || response;
        setStream(data);
      } catch (err) {
        setError('Stream not found or no longer available');
      } finally {
        setLoading(false);
      }
    };

    if (streamId) fetchStream();
  }, [streamId]);

  // Auto-join if stream is live
  useEffect(() => {
    if (stream?.status === 'live' && user && !isJoined) {
      handleJoinStream();
    }
  }, [stream, user]);

  // When the host disappears, check if they ended the stream or just navigated away
  useEffect(() => {
    if (!isJoined || isHostPresent) return;

    const checkIfEnded = async () => {
      try {
        const response = await streamService.getStreamById(streamId);
        const data = response.data || response;
        if (data.status === 'ended') {
          setStreamEnded(true);
        }
      } catch {
        setStreamEnded(true);
      }
    };

    checkIfEnded();
  }, [isHostPresent, isJoined, streamId]);

  // Attach remote video when track arrives
  useEffect(() => {
    if (remoteVideoTrack && videoRef.current) {
      remoteVideoTrack.attach(videoRef.current);
      return () => {
        remoteVideoTrack.detach(videoRef.current);
      };
    }
  }, [remoteVideoTrack]);

  // Join stream
  const handleJoinStream = async () => {
    if (!streamId || !user) return;
    setError('');

    try {
      const response = await streamService.joinStream(streamId);
      const data = response.data || response;
      const { token, wsUrl } = data.livekit;

      console.log('🔑 Got LiveKit viewer credentials, connecting...');
      await joinAsViewer(wsUrl, token);
      console.log('✅ Joined as viewer!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join stream');
      console.error('❌ Join failed:', err);
    }
  };

  // Leave stream
  const handleLeave = async () => {
    await leave();
    navigate('/');
  };

  // Join auction room when connected
  useEffect(() => {
    if (wsConnected && streamId) {
      joinAuction(streamId);
    }
    return () => {
      if (wsConnected && streamId) {
        leaveAuction(streamId);
      }
    };
  }, [wsConnected, streamId, joinAuction, leaveAuction]);

  // Client-side countdown from server's auction_ends_at
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

  // Auto-clear auction error after 3 seconds
  useEffect(() => {
    if (auctionError) {
      const timeout = setTimeout(clearAuctionError, 3000);
      return () => clearTimeout(timeout);
    }
  }, [auctionError, clearAuctionError]);

  // Handle bid submission
  const handlePlaceBid = useCallback(() => {
    const amount = parseFloat(bidAmount);
    if (!amount || !auctionState?.card?.id) return;
    placeBid(auctionState.card.id, amount);
    setBidAmount('');
  }, [bidAmount, auctionState, placeBid]);

  // Handle buyout
  const handleBuyout = useCallback(() => {
    if (!auctionState?.card?.id) return;
    buyout(auctionState.card.id);
    setShowBuyoutConfirm(false);
  }, [auctionState, buyout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leave();
    };
  }, [leave]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1419] flex items-center justify-center">
        <p className="text-gray-400 text-lg">Loading stream...</p>
      </div>
    );
  }

  if (error && !stream) {
    return (
      <div className="min-h-screen bg-[#0f1419] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-2 rounded-xl"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1419] text-white">
      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video area */}
          <div className="lg:col-span-2">
            <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  isJoined && !isHostPresent ? 'opacity-20' : 'opacity-100'
                }`}
              />

              {/* Host disconnected overlay */}
              {isJoined && !isHostPresent && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
                  {streamEnded ? (
                    <>
                      <p className="text-white font-semibold text-lg">Stream has ended</p>
                      <p className="text-gray-400 text-sm">Thanks for watching!</p>
                      <button
                        onClick={() => navigate('/')}
                        className="mt-2 bg-violet-600 hover:bg-violet-700 text-white px-6 py-2 rounded-xl text-sm font-medium transition-colors"
                      >
                        Back to Home
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-white font-semibold text-lg">Waiting for host to reconnect...</p>
                      <p className="text-gray-400 text-sm">The stream will resume shortly</p>
                    </>
                  )}
                </div>
              )}

              {/* Connecting state */}
              {!remoteVideoTrack && isHostPresent && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                  {isJoined
                    ? 'Waiting for host to start broadcasting...'
                    : 'Connecting to stream...'}
                </div>
              )}

              {stream?.status === 'live' && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 px-3 py-1.5 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-sm font-bold">LIVE</span>
                </div>
              )}
            </div>

            <div className="mt-4">
              <h1 className="text-2xl font-bold">{stream?.title}</h1>
              <p className="text-gray-400 mt-1">
                Hosted by <span className="text-violet-400">{stream?.host_name}</span>
              </p>
              {stream?.description && (
                <p className="text-gray-500 mt-2">{stream.description}</p>
              )}
            </div>

            <div className="mt-4">
              {!isJoined && stream?.status === 'live' && (
                <button
                  onClick={handleJoinStream}
                  className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-6 py-3 rounded-xl"
                >
                  Join Stream
                </button>
              )}
              {isJoined && (
                <button
                  onClick={handleLeave}
                  className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl"
                >
                  Leave Stream
                </button>
              )}
            </div>

            {(error || livekitError) && (
              <p className="text-red-400 mt-3">{error || livekitError}</p>
            )}
          </div>

          {/* Sidebar — Auction Panel */}
          <div className="lg:col-span-1 space-y-4">
            {/* Auction error toast */}
            {auctionError && (
              <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-2 rounded-xl text-sm">
                {auctionError}
              </div>
            )}

            {/* Active Auction */}
            {auctionState?.auction_status === 'active' && auctionState?.card && (
              <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-4">
                {/* Timer */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm text-gray-400">AUCTION LIVE</h3>
                  <div className={`px-3 py-1 rounded-lg font-mono font-bold text-lg ${
                    timeRemaining !== null && timeRemaining <= 10
                      ? 'bg-red-600/30 text-red-400 animate-pulse'
                      : timeRemaining !== null && timeRemaining <= 30
                        ? 'bg-yellow-600/30 text-yellow-400'
                        : 'bg-violet-600/30 text-violet-400'
                  }`}>
                    {timeRemaining !== null ? `${timeRemaining}s` : '--'}
                  </div>
                </div>

                {/* Card info */}
                <div className="flex gap-3 mb-4">
                  {(auctionState.card.card_image_front || auctionState.card.image_url) && (
                    <img
                      src={auctionState.card.card_image_front || auctionState.card.image_url}
                      alt={auctionState.card.name}
                      className="w-20 h-28 object-cover rounded-lg"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-white truncate">{auctionState.card.name}</h4>
                    {auctionState.card.psa_grade && (
                      <span className="inline-block bg-blue-600/30 text-blue-400 text-xs font-bold px-2 py-0.5 rounded mt-1">
                        PSA {auctionState.card.psa_grade}
                      </span>
                    )}
                    {auctionState.card.set && (
                      <p className="text-gray-500 text-xs mt-1 truncate">{auctionState.card.set}</p>
                    )}
                  </div>
                </div>

                {/* Current bid */}
                <div className="bg-[#0f1419] rounded-xl p-3 mb-4">
                  <p className="text-gray-400 text-xs mb-1">Current Bid</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-white">
                      ${parseFloat(auctionState.current_bid || auctionState.card.current_bid || auctionState.card.starting_bid || 0).toFixed(2)}
                    </span>
                    {(currentBid?.username || auctionState.current_bidder) && (
                      <span className="text-violet-400 text-sm">
                        by {currentBid?.username || auctionState.current_bidder}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bid input */}
                <div className="flex gap-2 mb-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handlePlaceBid()}
                      placeholder="Enter bid"
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-7 pr-3 py-2.5 text-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm"
                    />
                  </div>
                  <button
                    onClick={handlePlaceBid}
                    disabled={!bidAmount || !wsConnected}
                    className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-4 py-2.5 rounded-xl transition-colors text-sm whitespace-nowrap"
                  >
                    Bid
                  </button>
                </div>

                {/* Buyout button */}
                {auctionState.card.buyout_price && (
                  <>
                    {!showBuyoutConfirm ? (
                      <button
                        onClick={() => setShowBuyoutConfirm(true)}
                        disabled={!wsConnected}
                        className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors text-sm"
                      >
                        Buy Now — ${parseFloat(auctionState.card.buyout_price).toFixed(2)}
                      </button>
                    ) : (
                      <div className="bg-amber-600/10 border border-amber-600 rounded-xl p-3">
                        <p className="text-amber-400 text-sm font-medium mb-2">
                          Confirm buyout for ${parseFloat(auctionState.card.buyout_price).toFixed(2)}?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={handleBuyout}
                            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded-lg transition-colors text-sm"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setShowBuyoutConfirm(false)}
                            className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Auction ended result */}
            {auctionState?.auction_status === 'ended' && auctionState?.result && (
              <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-4">
                <h3 className="font-bold text-sm text-gray-400 mb-3">
                  {auctionState.result.isCancelled ? 'AUCTION CANCELLED' : 'AUCTION ENDED'}
                </h3>
                {auctionState.result.isBuyout && (
                  <div className="bg-amber-600/10 border border-amber-600/30 rounded-xl p-3 mb-2">
                    <p className="text-amber-400 font-bold text-sm">Bought out!</p>
                  </div>
                )}
                {auctionState.result.winner && (
                  <div className="bg-green-600/10 border border-green-600/30 rounded-xl p-3">
                    <p className="text-green-400 text-sm">
                      Won by <span className="font-bold">{auctionState.result.winner}</span>
                    </p>
                    <p className="text-green-300 text-lg font-black mt-1">
                      ${parseFloat(auctionState.result.amount || 0).toFixed(2)}
                    </p>
                  </div>
                )}
                {!auctionState.result.winner && !auctionState.result.isCancelled && (
                  <p className="text-gray-500 text-sm">No bids placed</p>
                )}
              </div>
            )}

            {/* No active auction */}
            {(!auctionState || auctionState?.auction_status === 'idle') && (
              <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-4 h-48 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-gray-500 text-sm">Waiting for auction to start...</p>
                  {wsConnected && (
                    <p className="text-gray-700 text-xs mt-2">Connected</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StreamViewer;

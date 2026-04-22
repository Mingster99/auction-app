import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useLiveKit } from '../hooks/useLiveKit';
import { useWebSocket } from '../hooks/useWebSocket';
import { streamService } from '../services/streamService';

const QUICK_BID_DELTAS = [1, 5, 10];

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
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [pendingBid, setPendingBid] = useState(false);
  const [bidHistory, setBidHistory] = useState([]);
  const [previewQueue, setPreviewQueue] = useState([]);
  const [winModal, setWinModal] = useState(null);
  const [inlineError, setInlineError] = useState('');

  const wasLeaderRef = useRef(false);
  const auctionSocketRef = useRef(null);
  const activeCardRef = useRef(null);
  const joinAttemptedRef = useRef(null);

  const currentBidAmount = parseFloat(
    auctionState?.current_bid || auctionState?.card?.current_bid || auctionState?.card?.starting_bid || 0
  );

  // Keep a ref of the currently-active card so socket handlers (with stale closures) can read it
  useEffect(() => {
    if (auctionState?.auction_status === 'active' && auctionState?.card) {
      activeCardRef.current = auctionState.card;
    }
  }, [auctionState?.auction_status, auctionState?.card]);

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

  // Auto-join if stream is live.
  // We gate on joinAttemptedRef (not isJoined) because isJoined only flips
  // to true AFTER room.connect() resolves — which can take several seconds
  // when the first region fails. During that window any re-render that
  // changes `stream` or `user` would otherwise kick off a second join.
  useEffect(() => {
    if (
      stream?.status === 'live' &&
      user &&
      joinAttemptedRef.current !== streamId
    ) {
      joinAttemptedRef.current = streamId;
      handleJoinStream();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, user, streamId]);

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

  // Fetch queue preview
  const refreshPreview = useCallback(async () => {
    try {
      const data = await streamService.getStreamQueue(streamId);
      setPreviewQueue(data || []);
    } catch {
      /* best-effort */
    }
  }, [streamId]);

  useEffect(() => {
    if (streamId) refreshPreview();
  }, [streamId, refreshPreview]);

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

  // Auction errors (bid-error / buyout-error) — only the emitting socket receives these,
  // so we surface them via the useWebSocket hook's auctionError rather than auctionSocketRef.
  useEffect(() => {
    if (!auctionError) return;
    toast.error(auctionError);
    setPendingBid(false);
    setShowBuyoutConfirm(false);
    const timeout = setTimeout(clearAuctionError, 3000);
    return () => clearTimeout(timeout);
  }, [auctionError, clearAuctionError]);

  // Separate socket just for toast/win hooks — listens to the same events on the auction room.
  // We keep this separate so useWebSocket stays generic.
  useEffect(() => {
    if (!streamId || !user?.id) return;
    const ioLib = require('socket.io-client');
    const WS_URL = process.env.REACT_APP_WS_URL || 'http://localhost:5000';
    const socket = ioLib(WS_URL, { auth: { token: localStorage.getItem('token') } });

    socket.on('connect', () => {
      socket.emit('join-auction', streamId);
    });

    socket.on('auction-started', (data) => {
      setBidHistory([]);
      wasLeaderRef.current = false;
      setPendingBid(false);
      setInlineError('');
      refreshPreview();
    });

    socket.on('auction-state', (data) => {
      if (data?.bid_history?.length) {
        setBidHistory(
          data.bid_history.map((b) => ({
            username: b.username,
            amount: b.amount,
            timestamp: b.placed_at,
          }))
        );
      }
    });

    socket.on('new-bid', (bid) => {
      setBidHistory((prev) =>
        [
          {
            username: bid.bidderUsername,
            amount: bid.amount,
            timestamp: bid.timestamp || new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 10)
      );

      if (bid.bidderId === user.id) {
        toast.success(`Bid placed: $${parseFloat(bid.amount).toFixed(2)}`);
        setPendingBid(false);
        wasLeaderRef.current = true;
      } else if (wasLeaderRef.current) {
        toast(`Outbid by ${bid.bidderUsername}`, { icon: '⚠️' });
        wasLeaderRef.current = false;
      }
    });

    socket.on('auction-time-extended', () => {
      toast('Auction extended by 30s', { icon: '⏰' });
    });

    socket.on('auction-ended', (data) => {
      setPendingBid(false);
      if (data?.winnerId === user.id && !data.isCancelled) {
        setWinModal({
          card: activeCardRef.current,
          amount: data.amount,
          isBuyout: !!data.isBuyout,
        });
      }
      refreshPreview();
    });

    socket.on('bid-error', (data) => {
      if (pendingBid) {
        toast.error(data.message || 'Bid failed');
        setPendingBid(false);
      }
    });

    socket.on('buyout-error', (data) => {
      toast.error(data.message || 'Buyout failed');
    });

    auctionSocketRef.current = socket;
    return () => {
      socket.close();
      auctionSocketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId, user?.id]);

  // Auto-dismiss win modal
  useEffect(() => {
    if (!winModal) return;
    const t = setTimeout(() => setWinModal(null), 5000);
    return () => clearTimeout(t);
  }, [winModal]);

  const ensurePaymentMethod = () => {
    if (!user?.has_payment_method) {
      setShowPaymentModal(true);
      return false;
    }
    return true;
  };

  const submitBid = useCallback(
    (amount) => {
      if (!auctionState?.card?.id) return;
      if (!ensurePaymentMethod()) return;

      const bid = parseFloat(amount);
      if (isNaN(bid) || bid <= currentBidAmount) {
        setInlineError(`Bid must be higher than $${currentBidAmount.toFixed(2)}`);
        return;
      }
      setInlineError('');
      setPendingBid(true);
      placeBid(auctionState.card.id, bid);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [auctionState, currentBidAmount, placeBid, user?.has_payment_method]
  );

  const handleCustomBid = useCallback(() => {
    submitBid(bidAmount);
    setBidAmount('');
  }, [bidAmount, submitBid]);

  const handleQuickBid = useCallback(
    (delta) => {
      const target = (currentBidAmount + delta).toFixed(2);
      submitBid(target);
    },
    [currentBidAmount, submitBid]
  );

  const handleBuyout = useCallback(() => {
    if (!auctionState?.card?.id) return;
    if (!ensurePaymentMethod()) return;
    buyout(auctionState.card.id);
    setShowBuyoutConfirm(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionState, buyout, user?.has_payment_method]);

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

  const card = auctionState?.card;
  const auctionActive = auctionState?.auction_status === 'active' && card;

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

              {!remoteVideoTrack && isHostPresent && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                  {isJoined ? 'Waiting for host to start broadcasting...' : 'Connecting to stream...'}
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
              {stream?.description && <p className="text-gray-500 mt-2">{stream.description}</p>}
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

          {/* Sidebar — Auction + Queue */}
          <div className="lg:col-span-1 space-y-4">
            {/* Active auction */}
            {auctionActive && (
              <div className="bg-[#1a1f2e] rounded-2xl border border-violet-600/30 p-4">
                {/* Header + Timer */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm text-gray-400">AUCTION LIVE</h3>
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

                {/* Card Images */}
                <div className="flex gap-3 justify-center mb-3">
                  {(card.card_image_front || card.image_url) && (
                    <img
                      src={card.card_image_front || card.image_url}
                      alt={`${card.name} front`}
                      className="w-28 h-auto rounded-lg border border-gray-700 object-contain"
                    />
                  )}
                  {card.card_image_back && (
                    <img
                      src={card.card_image_back}
                      alt={`${card.name} back`}
                      className="w-28 h-auto rounded-lg border border-gray-700 object-contain"
                    />
                  )}
                </div>

                {/* Card info */}
                <div className="mb-3">
                  <h4 className="font-bold text-white text-base truncate">{card.name}</h4>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {card.psa_grade && (
                      <span className="text-blue-400 text-xs font-bold">PSA {card.psa_grade}</span>
                    )}
                    {card.set && <span className="text-gray-500 text-xs">{card.set}</span>}
                    {card.rarity && <span className="text-gray-500 text-xs">· {card.rarity}</span>}
                  </div>
                </div>

                {/* Current bid */}
                <div className="bg-[#0f1419] rounded-xl p-3 mb-3">
                  <p className="text-gray-400 text-xs mb-1">Current Bid</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-white">
                      ${currentBidAmount.toFixed(2)}
                    </span>
                    {(currentBid?.bidderUsername || auctionState.current_bidder) && (
                      <span className="text-violet-400 text-sm">
                        by {currentBid?.bidderUsername || auctionState.current_bidder}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick bids */}
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {QUICK_BID_DELTAS.map((delta) => (
                    <button
                      key={delta}
                      onClick={() => handleQuickBid(delta)}
                      disabled={!wsConnected || pendingBid}
                      className="bg-violet-600/20 hover:bg-violet-600/40 disabled:opacity-50 disabled:cursor-not-allowed text-violet-300 border border-violet-600/30 font-bold py-2 rounded-xl transition-colors text-sm"
                    >
                      +${delta}
                    </button>
                  ))}
                </div>

                {/* Custom bid + Place */}
                <div className="flex gap-2 mb-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min={currentBidAmount + 0.01}
                      value={bidAmount}
                      onChange={(e) => {
                        setBidAmount(e.target.value);
                        setInlineError('');
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleCustomBid()}
                      placeholder={`> ${currentBidAmount.toFixed(2)}`}
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-7 pr-3 py-2.5 text-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm"
                    />
                  </div>
                  <button
                    onClick={handleCustomBid}
                    disabled={!bidAmount || !wsConnected || pendingBid}
                    className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-4 py-2.5 rounded-xl transition-colors text-sm whitespace-nowrap"
                  >
                    {pendingBid ? '…' : 'Place Bid'}
                  </button>
                </div>

                {inlineError && (
                  <p className="text-red-400 text-xs mb-2">{inlineError}</p>
                )}

                {/* Buyout */}
                {card.buyout_price && (
                  <div className="mb-3">
                    {!showBuyoutConfirm ? (
                      <button
                        onClick={() => setShowBuyoutConfirm(true)}
                        disabled={!wsConnected || pendingBid}
                        className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors text-sm"
                      >
                        Buy Now — ${parseFloat(card.buyout_price).toFixed(2)}
                      </button>
                    ) : (
                      <div className="bg-amber-600/10 border border-amber-600 rounded-xl p-3">
                        <p className="text-amber-400 text-sm font-medium mb-2">
                          Confirm buyout for ${parseFloat(card.buyout_price).toFixed(2)}?
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
                  </div>
                )}

                {/* Recent bids feed */}
                <div>
                  <p className="text-xs text-gray-500 mb-2">RECENT BIDS</p>
                  <div className="bg-[#0f1419] rounded-xl p-2 max-h-[160px] overflow-y-auto space-y-1">
                    {bidHistory.length === 0 ? (
                      <p className="text-gray-600 text-xs text-center py-3">No bids yet — be the first!</p>
                    ) : (
                      bidHistory.map((b, i) => {
                        const secsAgo = Math.max(0, Math.round((Date.now() - new Date(b.timestamp).getTime()) / 1000));
                        return (
                          <div
                            key={`${b.username}-${b.timestamp}-${i}`}
                            className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg"
                          >
                            <span className="text-white font-medium truncate mr-2">{b.username}</span>
                            <span className="text-green-400 font-bold whitespace-nowrap">
                              ${parseFloat(b.amount).toFixed(2)}
                            </span>
                            <span className="text-gray-600 ml-2 whitespace-nowrap">{secsAgo}s ago</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Auction ended (waiting for next) */}
            {auctionState?.auction_status === 'ended' && auctionState?.result && !auctionActive && (
              <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-4">
                <h3 className="font-bold text-sm text-gray-400 mb-3">
                  {auctionState.result.isCancelled ? 'AUCTION CANCELLED' : 'AUCTION ENDED'}
                </h3>
                {auctionState.result.winner && (
                  <div className="bg-green-600/10 border border-green-600/30 rounded-xl p-3">
                    <p className="text-green-400 text-sm">
                      Won by <span className="font-bold">{auctionState.result.winner}</span>
                      {auctionState.result.isBuyout && (
                        <span className="ml-2 text-amber-400 text-xs">(Buyout)</span>
                      )}
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
            {!auctionActive && (!auctionState || auctionState?.auction_status === 'idle') && (
              <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-4 h-32 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-gray-500 text-sm">Waiting for auction to start...</p>
                  {wsConnected && <p className="text-gray-700 text-xs mt-2">Connected</p>}
                </div>
              </div>
            )}

            {/* Up Next queue preview */}
            {previewQueue.length > 0 && (
              <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-4">
                <h3 className="font-bold text-sm text-gray-400 mb-3">
                  UP NEXT ({previewQueue.length})
                </h3>
                <div className="space-y-2 max-h-[320px] overflow-y-auto">
                  {previewQueue.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 p-2 rounded-xl bg-[#0f1419] border border-gray-800"
                    >
                      {(c.card_image_front || c.image_url) && (
                        <img
                          src={c.card_image_front || c.image_url}
                          alt={c.name}
                          className="w-10 h-14 object-cover rounded flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{c.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {c.psa_grade && (
                            <span className="text-blue-400 text-xs font-bold">PSA {c.psa_grade}</span>
                          )}
                          <span className="text-gray-500 text-xs">
                            ${parseFloat(c.starting_bid || 0).toFixed(2)}
                          </span>
                          {c.buyout_price && (
                            <span className="text-amber-400 text-xs">
                              BO: ${parseFloat(c.buyout_price).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment method modal */}
      {showPaymentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowPaymentModal(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative bg-[#1a1f2e] border border-gray-700 rounded-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-black text-white mb-2">Add a payment method to bid</h3>
            <p className="text-gray-400 text-sm mb-6">
              You need a payment method on file before you can place bids. Winning bidders are
              charged automatically after an auction ends.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  navigate('/settings/payment');
                }}
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl transition-colors"
              >
                Add Payment Method
              </button>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Win modal */}
      {winModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setWinModal(null)}
        >
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
          <div
            className="relative bg-gradient-to-br from-violet-900 via-[#1a1f2e] to-[#0f1419] border border-violet-500/50 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-5xl mb-2">🎉</p>
            <h2 className="text-3xl font-black text-white mb-1">You Won!</h2>
            {winModal.isBuyout && (
              <p className="text-amber-400 text-sm font-medium mb-4">Instant buyout</p>
            )}
            {winModal.card && (
              <div className="flex justify-center my-4">
                {(winModal.card.card_image_front || winModal.card.image_url) && (
                  <img
                    src={winModal.card.card_image_front || winModal.card.image_url}
                    alt={winModal.card.name}
                    className="w-32 h-auto rounded-xl border border-gray-700"
                  />
                )}
              </div>
            )}
            {winModal.card?.name && (
              <p className="text-white font-bold text-lg">{winModal.card.name}</p>
            )}
            <p className="text-4xl font-black text-green-400 mt-2">
              ${parseFloat(winModal.amount || 0).toFixed(2)}
            </p>
            <p className="text-gray-400 text-xs mt-4">
              Invoice created — payment will be charged to your card on file.
            </p>
            <button
              onClick={() => setWinModal(null)}
              className="mt-4 text-gray-500 hover:text-white text-xs"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default StreamViewer;

import { useEffect, useState, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import api from '../services/api';

const WS_URL = process.env.REACT_APP_WS_URL || 'http://localhost:5000';

export const useWebSocket = (streamId) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [currentBid, setCurrentBid] = useState(null);
  const [auctionState, setAuctionState] = useState(null);
  const [auctionError, setAuctionError] = useState(null);
  const [chatError, setChatError] = useState(null);
  const [moderationStatus, setModerationStatus] = useState({
    isBanned: false,
    isSilenced: false,
    silenceExpiresAt: null,
  });

  // Track which message ids have already been loaded from history
  // so we don't duplicate them when the socket fires the same message
  const seenMessageIds = useRef(new Set());
  const chatErrorTimer = useRef(null);

  // Load chat history when stream is known
  useEffect(() => {
    if (!streamId) return;
    setMessages([]);
    seenMessageIds.current.clear();

    api.get(`/streams/${streamId}/chat`)
      .then((res) => {
        const history = res.data.map((m) => ({
          id: m.id,
          userId: m.user_id,
          username: m.username,
          message: m.message,
          timestamp: m.created_at,
        }));
        seenMessageIds.current = new Set(history.map((m) => m.id));
        setMessages(history);
      })
      .catch(() => { /* best-effort — chat still works without history */ });
  }, [streamId]);

  useEffect(() => {
    const newSocket = io(WS_URL, {
      auth: {
        token: localStorage.getItem('token')
      }
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);

      if (streamId) {
        newSocket.emit('join-stream', streamId);
        newSocket.emit('join-auction', streamId);
      }
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    // Listen for new bids
    newSocket.on('new-bid', (bid) => {
      setCurrentBid(bid);
      setAuctionState(prev => prev ? {
        ...prev,
        current_bid: bid.amount,
        current_bidder: bid.bidderUsername,
        auction_ends_at: bid.newEndTime || prev.auction_ends_at,
      } : prev);
    });

    // Chat messages — deduplicate against history
    newSocket.on('chat-message', (message) => {
      if (message.id && seenMessageIds.current.has(message.id)) return;
      if (message.id) seenMessageIds.current.add(message.id);
      setMessages(prev => [...prev, message]);
    });

    // Chat errors (rate limit, banned, silenced)
    newSocket.on('chat-error', (data) => {
      setChatError(data);
      if (chatErrorTimer.current) clearTimeout(chatErrorTimer.current);
      chatErrorTimer.current = setTimeout(() => setChatError(null), 3000);
    });

    // Moderation events targeted at this user
    newSocket.on('you-were-banned', (data) => {
      if (String(data.streamId) === String(streamId)) {
        setModerationStatus(prev => ({ ...prev, isBanned: true }));
      }
    });

    newSocket.on('you-were-unbanned', (data) => {
      if (String(data.streamId) === String(streamId)) {
        setModerationStatus(prev => ({ ...prev, isBanned: false }));
      }
    });

    newSocket.on('you-were-silenced', (data) => {
      if (String(data.streamId) === String(streamId)) {
        setModerationStatus(prev => ({
          ...prev,
          isSilenced: true,
          silenceExpiresAt: data.expiresAt,
        }));
      }
    });

    newSocket.on('you-were-unsilenced', (data) => {
      if (String(data.streamId) === String(streamId)) {
        setModerationStatus(prev => ({ ...prev, isSilenced: false, silenceExpiresAt: null }));
      }
    });

    // Auction events
    newSocket.on('auction-started', (data) => {
      console.log('Auction started:', data);
      setAuctionState(data);
    });

    newSocket.on('auction-ended', (data) => {
      console.log('Auction ended:', data);
      setAuctionState(prev => prev ? { ...prev, auction_status: 'ended', result: data } : data);
    });

    newSocket.on('auction-time-extended', (data) => {
      console.log('Auction time extended:', data);
      setAuctionState(prev => prev ? { ...prev, auction_ends_at: data.auction_ends_at } : prev);
    });

    newSocket.on('auction-state', (data) => {
      console.log('Auction state sync:', data);
      setAuctionState(data);
    });

    newSocket.on('bid-error', (data) => {
      console.error('Bid error:', data);
      setAuctionError(data.message || 'Bid failed');
    });

    newSocket.on('buyout-error', (data) => {
      console.error('Buyout error:', data);
      setAuctionError(data.message || 'Buyout failed');
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
      if (chatErrorTimer.current) clearTimeout(chatErrorTimer.current);
    };
  }, [streamId]);

  const sendMessage = useCallback((message) => {
    if (socket && connected) {
      socket.emit('chat-message', { streamId, message });
    }
  }, [socket, connected, streamId]);

  const placeBid = useCallback((cardId, amount) => {
    if (socket && connected) {
      socket.emit('place-bid', { streamId, cardId, amount });
    }
  }, [socket, connected, streamId]);

  const joinAuction = useCallback((auctionStreamId) => {
    if (socket && connected) {
      socket.emit('join-auction', auctionStreamId || streamId);
    }
  }, [socket, connected, streamId]);

  const leaveAuction = useCallback((auctionStreamId) => {
    if (socket && connected) {
      socket.emit('leave-auction', auctionStreamId || streamId);
    }
  }, [socket, connected, streamId]);

  const buyout = useCallback((cardId) => {
    if (socket && connected) {
      setAuctionError(null);
      socket.emit('buyout', { streamId, cardId });
    }
  }, [socket, connected, streamId]);

  const clearAuctionError = useCallback(() => {
    setAuctionError(null);
  }, []);

  const clearChatError = useCallback(() => {
    setChatError(null);
    if (chatErrorTimer.current) clearTimeout(chatErrorTimer.current);
  }, []);

  // ── Moderation actions (host only — server enforces) ───
  const banUser = useCallback((targetUserId) => {
    if (socket && connected) {
      socket.emit('ban-user', { streamId, targetUserId });
    }
  }, [socket, connected, streamId]);

  const unbanUser = useCallback((targetUserId) => {
    if (socket && connected) {
      socket.emit('unban-user', { streamId, targetUserId });
    }
  }, [socket, connected, streamId]);

  const silenceUser = useCallback((targetUserId, durationMinutes = 5) => {
    if (socket && connected) {
      socket.emit('silence-user', { streamId, targetUserId, durationMinutes });
    }
  }, [socket, connected, streamId]);

  const unsilenceUser = useCallback((targetUserId) => {
    if (socket && connected) {
      socket.emit('unsilence-user', { streamId, targetUserId });
    }
  }, [socket, connected, streamId]);

  return {
    connected,
    messages,
    currentBid,
    auctionState,
    auctionError,
    chatError,
    moderationStatus,
    sendMessage,
    placeBid,
    joinAuction,
    leaveAuction,
    buyout,
    clearAuctionError,
    clearChatError,
    banUser,
    unbanUser,
    silenceUser,
    unsilenceUser,
  };
};

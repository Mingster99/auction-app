import { useEffect, useState, useCallback } from 'react';
import io from 'socket.io-client';

const WS_URL = process.env.REACT_APP_WS_URL || 'http://localhost:5000';

export const useWebSocket = (streamId) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [currentBid, setCurrentBid] = useState(null);
  const [auctionState, setAuctionState] = useState(null);
  const [auctionError, setAuctionError] = useState(null);

  useEffect(() => {
    // Initialize socket connection
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
        // Also join the auction room so we receive auction-started / new-bid / auction-ended events
        newSocket.emit('join-auction', streamId);
      }
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    // Listen for new bids — update both currentBid and auctionState
    newSocket.on('new-bid', (bid) => {
      setCurrentBid(bid);
      setAuctionState(prev => prev ? {
        ...prev,
        current_bid: bid.amount,
        current_bidder: bid.bidderUsername,
        auction_ends_at: bid.newEndTime || prev.auction_ends_at,
      } : prev);
    });

    // Listen for chat messages
    newSocket.on('chat-message', (message) => {
      setMessages(prev => [...prev, message]);
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

    // Cleanup on unmount
    return () => {
      newSocket.close();
    };
  }, [streamId]);

  // Send chat message
  const sendMessage = useCallback((message) => {
    if (socket && connected) {
      socket.emit('chat-message', { streamId, message });
    }
  }, [socket, connected, streamId]);

  // Place bid
  const placeBid = useCallback((cardId, amount) => {
    if (socket && connected) {
      socket.emit('place-bid', { streamId, cardId, amount });
    }
  }, [socket, connected, streamId]);

  // Join auction room for a stream
  const joinAuction = useCallback((auctionStreamId) => {
    if (socket && connected) {
      socket.emit('join-auction', auctionStreamId || streamId);
    }
  }, [socket, connected, streamId]);

  // Leave auction room
  const leaveAuction = useCallback((auctionStreamId) => {
    if (socket && connected) {
      socket.emit('leave-auction', auctionStreamId || streamId);
    }
  }, [socket, connected, streamId]);

  // Buyout the current auction card
  const buyout = useCallback((cardId) => {
    if (socket && connected) {
      setAuctionError(null);
      socket.emit('buyout', { streamId, cardId });
    }
  }, [socket, connected, streamId]);

  // Clear auction error
  const clearAuctionError = useCallback(() => {
    setAuctionError(null);
  }, []);

  return {
    connected,
    messages,
    currentBid,
    auctionState,
    auctionError,
    sendMessage,
    placeBid,
    joinAuction,
    leaveAuction,
    buyout,
    clearAuctionError
  };
};

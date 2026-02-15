import { useEffect, useState, useCallback } from 'react';
import io from 'socket.io-client';

const WS_URL = process.env.REACT_APP_WS_URL || 'http://localhost:5000';

export const useWebSocket = (streamId) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [currentBid, setCurrentBid] = useState(null);

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
      
      // Join stream room
      if (streamId) {
        newSocket.emit('join-stream', streamId);
      }
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    // Listen for new bids
    newSocket.on('new-bid', (bid) => {
      setCurrentBid(bid);
    });

    // Listen for chat messages
    newSocket.on('chat-message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    // Listen for auction events
    newSocket.on('auction-started', (data) => {
      console.log('Auction started:', data);
    });

    newSocket.on('auction-ended', (data) => {
      console.log('Auction ended:', data);
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

  return {
    connected,
    messages,
    currentBid,
    sendMessage,
    placeBid
  };
};

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { streamService } from '../services/streamService';
import { useWebSocket } from '../hooks/useWebSocket';

function LivestreamPage() {
  const { streamId } = useParams();
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(true);
  const { connected, messages, currentBid, sendMessage, placeBid } = useWebSocket(streamId);
  const [chatMessage, setChatMessage] = useState('');
  const [bidAmount, setBidAmount] = useState('');

  useEffect(() => {
    const fetchStream = async () => {
      try {
        const data = await streamService.getStreamById(streamId);
        setStream(data);
      } catch (error) {
        console.error('Error fetching stream:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStream();
  }, [streamId]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (chatMessage.trim()) {
      sendMessage(chatMessage);
      setChatMessage('');
    }
  };

  const handlePlaceBid = (e) => {
    e.preventDefault();
    const amount = parseFloat(bidAmount);
    if (amount && stream?.currentCard) {
      placeBid(stream.currentCard.id, amount);
      setBidAmount('');
    }
  };

  if (loading) {
    return <div className="loading">Loading stream...</div>;
  }

  if (!stream) {
    return <div className="error">Stream not found</div>;
  }

  return (
    <div className="livestream-page">
      <div className="stream-layout">
        {/* Video Player */}
        <div className="video-section card">
          <div className="video-player">
            {/* Video player component will go here */}
            <div className="video-placeholder">
              <p>📹 Video Player</p>
              <p className={connected ? 'status-online' : 'status-offline'}>
                {connected ? '🟢 Connected' : '🔴 Disconnected'}
              </p>
            </div>
          </div>
          
          <div className="stream-info">
            <h2>{stream.title}</h2>
            <p>Host: {stream.hostName}</p>
            <p>Viewers: {stream.viewerCount}</p>
          </div>
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          {/* Current Auction */}
          <div className="auction-section card">
            <h3>Current Auction</h3>
            {stream.currentCard ? (
              <>
                <img src={stream.currentCard.imageUrl} alt={stream.currentCard.name} />
                <h4>{stream.currentCard.name}</h4>
                <p>{stream.currentCard.set}</p>
                <p className="current-bid">
                  Current Bid: ${currentBid?.amount || stream.currentCard.startingBid}
                </p>
                
                <form onSubmit={handlePlaceBid}>
                  <input
                    type="number"
                    className="input"
                    placeholder="Enter bid amount"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    min={currentBid?.amount || stream.currentCard.startingBid}
                    step="0.01"
                  />
                  <button type="submit" className="btn btn-primary">
                    Place Bid
                  </button>
                </form>
              </>
            ) : (
              <p>No active auction</p>
            )}
          </div>

          {/* Chat */}
          <div className="chat-section card">
            <h3>Chat</h3>
            <div className="chat-messages">
              {messages.map((msg, index) => (
                <div key={index} className="chat-message">
                  <strong>{msg.username}:</strong> {msg.message}
                </div>
              ))}
            </div>
            <form onSubmit={handleSendMessage}>
              <input
                type="text"
                className="input"
                placeholder="Type a message..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">Send</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LivestreamPage;

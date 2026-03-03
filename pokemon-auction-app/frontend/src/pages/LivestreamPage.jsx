import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAgora } from '../hooks/useAgora';
import { streamService } from '../services/streamService';

function StreamViewer() {
  // Route is defined as /livestream/:id in App.jsx
  const { id } = useParams();
  const streamId = id;
  const [stream, setStream] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  
  const remoteVideoRef = useRef(null);
  
  const {
    joinAsViewer,
    leave,
    remoteUsers,
    isJoined
  } = useAgora();

  // Fetch stream info
  useEffect(() => {
    const fetchStream = async () => {
      try {
        const data = await streamService.getStreamById(streamId);
        setStream(data);

        // Auto-join if stream is live
        if (data.status === 'live') {
          await handleJoinStream();
        }
      } catch (err) {
        console.error('Failed to fetch stream:', err);
        setError('Stream not found or no longer available');
      } finally {
        setLoading(false);
      }
    };

    fetchStream();

    return () => {
      leave();
    };
  }, [streamId]);

  // Play remote video when user is available
  useEffect(() => {
    if (remoteUsers.length > 0 && remoteVideoRef.current) {
      const remoteUser = remoteUsers[0];
      if (remoteUser.videoTrack) {
        remoteUser.videoTrack.play(remoteVideoRef.current);
      }
    }
  }, [remoteUsers]);

  const handleJoinStream = async () => {
    setError('');
    setLoading(true);

    try {
      // Get Agora credentials from backend
      const response = await streamService.joinStream(streamId);
      const { channelName, agora } = response;

      console.log('Joining stream:', channelName);

      // Join Agora channel as viewer
      await joinAsViewer(channelName, agora.token, agora.uid);

      setJoined(true);
      console.log('Joined stream successfully');
    } catch (err) {
      console.error('Failed to join stream:', err);
      setError(err.response?.data?.message || 'Failed to join stream');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !stream) {
    return <div className="loading">Loading stream...</div>;
  }

  if (error && !stream) {
    return <div className="error-page card"><h2>Error</h2><p>{error}</p></div>;
  }

  if (!stream) {
    return <div className="error-page card"><p>Stream not found</p></div>;
  }

  // Stream is not live yet
  if (stream.status !== 'live') {
    return (
      <div className="stream-viewer-page">
        <div className="stream-offline card">
          <h2>{stream.title}</h2>
          <p>This stream is currently offline.</p>
          <p>Host: {stream.host_name}</p>
          <p>Status: {stream.status}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stream-viewer-page">
      <div className="stream-container">
        <div className="video-section">
          <h2>🔴 LIVE: {stream.title}</h2>
          
          {/* Remote video player */}
          <div className="video-player-container">
            {remoteUsers.length > 0 ? (
              <div ref={remoteVideoRef} className="video-player" />
            ) : (
              <div className="video-placeholder">
                <p>Waiting for host to start broadcasting...</p>
                {isJoined && <p>✅ Connected to stream</p>}
              </div>
            )}
          </div>

          {/* Stream info */}
          <div className="stream-details">
            <p><strong>Host:</strong> {stream.host_name}</p>
            <p><strong>Viewers:</strong> {stream.viewer_count || 0}</p>
            {stream.description && <p>{stream.description}</p>}
          </div>

          {error && <div className="error">{error}</div>}

          {!joined && (
            <button 
              onClick={handleJoinStream} 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Joining...' : 'Join Stream'}
            </button>
          )}
        </div>

        {/* Sidebar for chat/bidding (you can add this later) */}
        <div className="stream-sidebar">
          <div className="card">
            <h3>Chat</h3>
            <p>Chat coming soon...</p>
          </div>
          
          <div className="card">
            <h3>Current Auction</h3>
            <p>Bidding panel coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StreamViewer;

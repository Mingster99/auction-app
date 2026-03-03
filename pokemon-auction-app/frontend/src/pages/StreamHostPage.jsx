import React, { useEffect, useRef, useState } from 'react';
import { useAgora } from '../hooks/useAgora';
import { streamService } from '../services/streamService';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function StreamHost() {
  const { user } = useAuth();
  const [streamTitle, setStreamTitle] = useState('');
  const [streamDescription, setStreamDescription] = useState('');
  const [streamId, setStreamId] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const videoRef = useRef(null);
  const navigate = useNavigate();
  
  const {
    joinAsHost,
    leave,
    toggleMic,
    toggleCamera,
    localTracks,
    isJoined
  } = useAgora();

  // On mount, if user already has a live stream, allow resuming it
  useEffect(() => {
    const checkExistingStream = async () => {
      try {
        const activeStreams = await streamService.getActiveStreams();
        if (!Array.isArray(activeStreams) || !user) return;

        // Find a live stream hosted by the current user
        const myLiveStream = activeStreams.find(
          (s) => s.host_name === user.username
        );

        if (myLiveStream) {
          setStreamId(myLiveStream.id);
          setStreamTitle(myLiveStream.title);
          setIsLive(true);
        }
      } catch (err) {
        console.error('Failed to check existing streams', err);
      }
    };

    checkExistingStream();
  }, [user]);

  // Play local video when track is available
  useEffect(() => {
    if (localTracks.videoTrack && videoRef.current) {
      localTracks.videoTrack.play(videoRef.current);
    }
  }, [localTracks.videoTrack]);

  const handleCreateStream = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Create stream in database
      const stream = await streamService.createStream({
        title: streamTitle,
        description: streamDescription
      });
      
      // Support different possible id field names from backend
      const createdStreamId = stream.id ?? stream.stream_id ?? stream.streamId;
      console.log('Stream created:', stream, 'using id:', createdStreamId);
      setStreamId(createdStreamId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create stream');
    } finally {
      setLoading(false);
    }
  };

  const handleGoLive = async () => {
    setError('');
    setLoading(true);

    try {
      // Start stream and get Agora credentials
      const response = await streamService.startStream(streamId);
      const { channelName, agora } = response;

      console.log('Starting stream:', channelName);

      // Join Agora channel as host
      await joinAsHost(channelName, agora.token, agora.uid);

      setIsLive(true);
      console.log('Stream is now live!');
    } catch (err) {
      console.error('Failed to go live:', err);
      setError(err.response?.data?.message || 'Failed to start stream');
    } finally {
      setLoading(false);
    }
  };

  const handleEndStream = async () => {
    try {
      // Leave Agora channel
      await leave();

      // End stream in database
      if (streamId) {
        await streamService.endStream(streamId);
      }

      setIsLive(false);
      navigate('/');
    } catch (err) {
      console.error('Failed to end stream:', err);
      setError('Failed to end stream');
    }
  };

  const handleToggleMic = async () => {
    const enabled = await toggleMic();
    console.log('Microphone:', enabled ? 'ON' : 'OFF');
  };

  const handleToggleCamera = async () => {
    const enabled = await toggleCamera();
    console.log('Camera:', enabled ? 'ON' : 'OFF');
  };

  // Not streaming yet - show setup form
  if (!streamId) {
    return (
      <div className="stream-host-page">
        <div className="stream-setup card">
          <h1>Create Livestream</h1>
          
          <form onSubmit={handleCreateStream}>
            <div className="form-group">
              <label>Stream Title *</label>
              <input
                type="text"
                className="input"
                value={streamTitle}
                onChange={(e) => setStreamTitle(e.target.value)}
                placeholder="e.g., Charizard Collection Auction"
                required
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                className="input"
                value={streamDescription}
                onChange={(e) => setStreamDescription(e.target.value)}
                placeholder="Tell viewers what you'll be auctioning..."
                rows={4}
              />
            </div>

            {error && <div className="error">{error}</div>}

            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Stream'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Stream created but not live yet
  if (!isLive) {
    return (
      <div className="stream-host-page">
        <div className="stream-preview card">
          <h1>Ready to Go Live</h1>
          <p>Stream: <strong>{streamTitle}</strong></p>
          
          {error && <div className="error">{error}</div>}

          <button 
            onClick={handleGoLive}
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Starting...' : '🔴 Go Live'}
          </button>
        </div>
      </div>
    );
  }

  // Currently live
  return (
    <div className="stream-host-page">
      <div className="stream-live-container">
        <div className="video-section">
          <h2>🔴 LIVE: {streamTitle}</h2>
          
          {/* Local video preview */}
          <div className="video-preview">
            <div ref={videoRef} className="video-player" />
          </div>

          {/* Controls */}
          <div className="stream-controls">
            <button onClick={handleToggleMic} className="btn btn-secondary">
              🎤 Toggle Mic
            </button>
            <button onClick={handleToggleCamera} className="btn btn-secondary">
              📹 Toggle Camera
            </button>
            <button onClick={handleEndStream} className="btn btn-danger">
              ⏹️ End Stream
            </button>
          </div>

          {error && <div className="error">{error}</div>}
        </div>

        <div className="stream-info">
          <h3>Stream Info</h3>
          <p>Status: <span className="live-badge">LIVE</span></p>
          <p>Connected: {isJoined ? 'Yes' : 'No'}</p>
          <p>Share this link with viewers:</p>
          <code>
            {`${window.location.origin}/livestream/${streamId}`}
          </code>
        </div>
      </div>
    </div>
  );
}

export default StreamHost;

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLiveKit } from '../hooks/useLiveKit';
import { streamService } from '../services/streamService';

function StreamHost() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef(null);

  // LiveKit hook (replaces useAgora)
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

  // Drop back to 'existing' (Rejoin) if LiveKit disconnects unexpectedly mid-stream
  useEffect(() => {
    if (streamStatus === 'live' && !isJoined && !loading) {
      setStreamStatus('existing');
    }
  }, [isJoined, streamStatus, loading]);

  // Play local video when track is available
  useEffect(() => {
    if (localVideoTrack && videoRef.current) {
      localVideoTrack.attach(videoRef.current);
      return () => {
        localVideoTrack.detach(videoRef.current);
      };
    }
  }, [localVideoTrack]);

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
      console.log('✅ Stream created:', newId);
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

      console.log('🔑 Got LiveKit credentials, connecting...');
      await joinAsHost(wsUrl, token);

      setStreamStatus('live');
      console.log('✅ Now live!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to go live');
      console.error('❌ Go live failed:', err);
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

  const handleToggleMic = async () => await toggleMic();
  const handleToggleCamera = async () => await toggleCamera();

  return (
    <div className="min-h-screen bg-[#0f1419] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-black mb-6">
          {streamStatus === 'live' ? '🔴 You\'re Live!' : '🎥 Start a Stream'}
        </h1>

        {(error || livekitError) && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 p-4 rounded-xl mb-6">
            {error || livekitError}
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
                placeholder="e.g., Opening Vintage Pokémon Packs!"
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
                {loading ? 'Reconnecting...' : '↩ Rejoin Stream'}
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
              {loading ? 'Connecting...' : '🔴 Go Live'}
            </button>
          </div>
        )}

        {/* Step 3: Live Stream View */}
        {streamStatus === 'live' && (
          <div className="space-y-4">
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
                onClick={handleToggleMic}
                className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                  isMicMuted
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-gray-800 hover:bg-gray-700'
                }`}
              >
                {isMicMuted ? '🔇 Unmute' : '🎤 Mute'}
              </button>

              <button
                onClick={handleToggleCamera}
                className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                  isCameraMuted
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-gray-800 hover:bg-gray-700'
                }`}
              >
                {isCameraMuted ? '📷 Turn On' : '📷 Turn Off'}
              </button>

              <button
                onClick={handleEndStream}
                className="bg-gray-800 hover:bg-red-600 px-4 py-2 rounded-xl font-medium transition-colors ml-auto"
              >
                End Stream
              </button>
            </div>

            <div className="text-sm text-gray-500 space-y-1">
              <p>Connected: {isJoined ? '✅ Yes' : '❌ No'}</p>
              <p>Publishing: {isPublishing ? '✅ Yes' : '❌ No'}</p>
              <p>
                Share link:{' '}
                <code className="text-violet-400">
                  {`${window.location.origin}/livestream/${streamId}`}
                </code>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StreamHost;

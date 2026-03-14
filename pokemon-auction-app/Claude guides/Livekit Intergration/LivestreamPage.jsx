import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLiveKit } from '../hooks/useLiveKit';
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
    error: livekitError,
    joinAsViewer,
    leave,
  } = useLiveKit();

  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
                className="w-full h-full object-cover"
              />
              {!remoteVideoTrack && (
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

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-4 h-96">
              <h3 className="font-bold text-sm text-gray-400 mb-3">LIVE CHAT</h3>
              <p className="text-gray-600 text-sm">Chat coming soon...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StreamViewer;

import { useState, useEffect, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';

const APP_ID = process.env.REACT_APP_AGORA_APP_ID;

export const useAgora = () => {
  const [localTracks, setLocalTracks] = useState({ videoTrack: null, audioTrack: null });
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [isJoined, setIsJoined] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const clientRef = useRef(null);

  useEffect(() => {
    // Initialize Agora client
    if (!clientRef.current) {
      clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

      // Event listeners
      clientRef.current.on('user-published', async (user, mediaType) => {
        await clientRef.current.subscribe(user, mediaType);
        console.log('Subscribed to user:', user.uid);

        if (mediaType === 'video') {
          setRemoteUsers(prev => {
            const exists = prev.find(u => u.uid === user.uid);
            if (exists) {
              return prev.map(u => u.uid === user.uid ? user : u);
            }
            return [...prev, user];
          });
        }

        if (mediaType === 'audio') {
          user.audioTrack?.play();
        }
      });

      clientRef.current.on('user-unpublished', (user, mediaType) => {
        console.log('User unpublished:', user.uid, mediaType);
        if (mediaType === 'video') {
          setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
        }
      });

      clientRef.current.on('user-left', (user) => {
        console.log('User left:', user.uid);
        setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
      });
    }

    return () => {
      // Cleanup on unmount
      leave();
    };
  }, []);

  /**
   * Join a channel as host (with camera and mic if available)
   */
  const joinAsHost = async (channelName, token, uid) => {
    try {
      if (!APP_ID) {
        throw new Error('Agora App ID not configured');
      }

      // Join the channel
      await clientRef.current.join(APP_ID, channelName, token, uid);
      console.log('Joined channel as host:', channelName);

      // Try to create and publish local tracks (mic + camera)
      let audioTrack = null;
      let videoTrack = null;

      try {
        const tracks = await AgoraRTC.createMicrophoneAndCameraTracks();
        [audioTrack, videoTrack] = tracks;
        setLocalTracks({ audioTrack, videoTrack });

        await clientRef.current.publish(
          [audioTrack, videoTrack].filter(Boolean)
        );
        console.log('Published local tracks');
      } catch (trackError) {
        console.error('Failed to create mic+cam tracks, trying audio-only.', trackError);

        try {
          // Fallback: try to create microphone-only track
          audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
          setLocalTracks({ audioTrack, videoTrack: null });

          await clientRef.current.publish([audioTrack]);
          console.log('Published audio-only track');
        } catch (audioError) {
          console.error('Failed to create audio-only track. Joining without local media.', audioError);
          // Still consider the host joined to the channel, just without local media
          setLocalTracks({ audioTrack: null, videoTrack: null });
        }
      }

      setIsJoined(true);
      setIsPublishing(!!(audioTrack || videoTrack));

      return { audioTrack, videoTrack };
    } catch (error) {
      console.error('Failed to join as host:', error);
      throw error;
    }
  };

  /**
   * Join a channel as viewer (watch only)
   */
  const joinAsViewer = async (channelName, token, uid) => {
    try {
      if (!APP_ID) {
        throw new Error('Agora App ID not configured');
      }

      // Join the channel
      await clientRef.current.join(APP_ID, channelName, token, uid);
      console.log('Joined channel as viewer:', channelName);

      setIsJoined(true);

      return true;
    } catch (error) {
      console.error('Failed to join as viewer:', error);
      throw error;
    }
  };

  /**
   * Leave the channel and clean up
   */
  const leave = async () => {
    try {
      // Stop and close local tracks
      if (localTracks.audioTrack) {
        localTracks.audioTrack.stop();
        localTracks.audioTrack.close();
      }
      if (localTracks.videoTrack) {
        localTracks.videoTrack.stop();
        localTracks.videoTrack.close();
      }

      // Leave the channel
      if (clientRef.current && isJoined) {
        await clientRef.current.leave();
        console.log('Left channel');
      }

      setLocalTracks({ audioTrack: null, videoTrack: null });
      setRemoteUsers([]);
      setIsJoined(false);
      setIsPublishing(false);
    } catch (error) {
      console.error('Failed to leave:', error);
    }
  };

  /**
   * Mute/unmute microphone
   */
  const toggleMic = async () => {
    if (localTracks.audioTrack) {
      await localTracks.audioTrack.setEnabled(!localTracks.audioTrack.enabled);
      return localTracks.audioTrack.enabled;
    }
    return false;
  };

  /**
   * Turn camera on/off
   */
  const toggleCamera = async () => {
    if (localTracks.videoTrack) {
      await localTracks.videoTrack.setEnabled(!localTracks.videoTrack.enabled);
      return localTracks.videoTrack.enabled;
    }
    return false;
  };

  return {
    joinAsHost,
    joinAsViewer,
    leave,
    toggleMic,
    toggleCamera,
    localTracks,
    remoteUsers,
    isJoined,
    isPublishing
  };
};

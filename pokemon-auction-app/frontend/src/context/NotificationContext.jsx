import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { userService } from '../services/userService';

const WS_URL = process.env.REACT_APP_WS_URL || 'http://localhost:5000';
const NotificationContext = createContext(null);

const storageKey = (userId) => `vaultive_notifications_${userId}`;

export const NotificationProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const socketRef = useRef(null);

  // Load from localStorage when user changes
  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }
    try {
      const cached = localStorage.getItem(storageKey(user.id));
      if (cached) setNotifications(JSON.parse(cached));
    } catch {
      /* ignore */
    }
  }, [user?.id]);

  // Persist to localStorage
  useEffect(() => {
    if (!user?.id) return;
    try {
      localStorage.setItem(storageKey(user.id), JSON.stringify(notifications));
    } catch {
      /* ignore */
    }
  }, [notifications, user?.id]);

  // Hydrate from backend on login
  useEffect(() => {
    if (!isAuthenticated) return;
    userService.getNotifications()
      .then((fired) => {
        if (!fired?.length) return;
        setNotifications((prev) => {
          const existing = new Set(prev.map((n) => n.streamId));
          const fresh = fired
            .filter((f) => !existing.has(f.stream_id))
            .map((f) => ({
              streamId: f.stream_id,
              title: f.title,
              host_name: f.host_name,
              timestamp: f.started_at,
              read: true, // historical — don't mark as unread
            }));
          return [...fresh, ...prev].slice(0, 50);
        });
      })
      .catch(() => {
        /* best-effort hydration */
      });
  }, [isAuthenticated]);

  // Global socket — listens for stream-going-live on user:{id} room
  useEffect(() => {
    if (!isAuthenticated) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = io(WS_URL, { auth: { token } });
    socketRef.current = socket;

    socket.on('stream-going-live', (data) => {
      const entry = {
        streamId: data.streamId,
        title: data.title,
        host_name: data.host_name,
        timestamp: new Date().toISOString(),
        read: false,
      };
      setNotifications((prev) => [entry, ...prev.filter((n) => n.streamId !== entry.streamId)].slice(0, 50));

      toast((t) => (
        <div className="flex items-start gap-3">
          <span className="text-xl">🔴</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">{data.host_name} is live</p>
            <p className="text-xs text-gray-400 truncate">{data.title}</p>
            <Link
              to={`/livestream/${data.streamId}`}
              onClick={() => toast.dismiss(t.id)}
              className="text-violet-400 hover:text-violet-300 text-xs font-medium mt-1 inline-block"
            >
              Watch now →
            </Link>
          </div>
        </div>
      ), { duration: 6000 });
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [isAuthenticated]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clear = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAllRead, clear }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};

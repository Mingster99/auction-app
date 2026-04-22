import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { streamService } from '../../services/streamService';
import { formatDistanceToNow } from 'date-fns';

// ============================================================
// NAVBAR COMPONENT
// ============================================================
// This component appears at the TOP of every page.
// It's rendered once in App.jsx, outside the page routes,
// so it stays consistent no matter which page you're on.
//
// useLocation() tells us what page we're currently on,
// so we can highlight the active nav link.
// ============================================================

function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hasActiveStream, setHasActiveStream] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef(null);
  const { user, isAuthenticated, logout } = useAuth();
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation(); // Gets current URL path

  // Close bell dropdown on outside click
  useEffect(() => {
    if (!bellOpen) return;
    const handleClick = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [bellOpen]);

  const toggleBell = () => {
    const next = !bellOpen;
    setBellOpen(next);
    if (next && unreadCount > 0) markAllRead();
  };

  // Check if the logged-in user is hosting an active stream
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setHasActiveStream(false);
      return;
    }
    const check = async () => {
      try {
        const streams = await streamService.getActiveStreams();
        const list = streams.data || streams;
        setHasActiveStream(
          list.some((s) => s.host_name === user.username && s.status === 'live')
        );
      } catch {
        setHasActiveStream(false);
      }
    };
    check();
  }, [isAuthenticated, user, location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // Helper: is this link the current page?
  const isActive = (path) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 bg-gray-950/90 backdrop-blur-md border-b border-gray-800/50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">

          {/* ── LOGO ── */}
          <Link
            to="/"
            className="font-black text-xl bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
          >
            Vaultive Auctions
          </Link>

          {/* ── DESKTOP NAV LINKS ── */}
          <div className="hidden md:flex items-center gap-1">
            {[
              { to: '/', label: 'Home' },
              { to: '/cards', label: 'Browse Cards' },
              { to: '/streams', label: 'Live Streams' },
            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive(link.to)
                    ? 'text-white bg-gray-800'           // Active page
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'  // Inactive
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* ── RIGHT SIDE: Auth buttons or user menu ── */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                {/* List a card button */}
                <Link
                  to="/cards/new"
                  className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
                >
                  + List Card
                </Link>
                {/* PSA scan button */}
                <Link
                  to="/psa-import"
                  className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
                >
                  Scan PSA
                </Link>

                {/* Notification bell */}
                <div className="relative" ref={bellRef}>
                  <button
                    onClick={toggleBell}
                    className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
                    aria-label="Notifications"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {bellOpen && (
                    <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-xl overflow-hidden z-50">
                      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                        <span className="text-sm font-bold text-white">Notifications</span>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <p className="text-gray-500 text-sm px-4 py-8 text-center">No notifications yet</p>
                        ) : (
                          notifications.map((n) => (
                            <Link
                              key={`${n.streamId}-${n.timestamp}`}
                              to={`/livestream/${n.streamId}`}
                              onClick={() => setBellOpen(false)}
                              className="block px-4 py-3 hover:bg-gray-800 border-b border-gray-800/50 last:border-b-0 transition-colors"
                            >
                              <div className="flex items-start gap-3">
                                <span className="text-lg leading-none">🔴</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white truncate">
                                    {n.host_name} is live
                                  </p>
                                  <p className="text-xs text-gray-400 truncate">{n.title}</p>
                                  <p className="text-xs text-gray-600 mt-0.5">
                                    {(() => {
                                      try {
                                        return formatDistanceToNow(new Date(n.timestamp), { addSuffix: true });
                                      } catch {
                                        return '';
                                      }
                                    })()}
                                  </p>
                                </div>
                              </div>
                            </Link>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Go live / Rejoin stream button */}
                <Link
                  to="/stream/host"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                    hasActiveStream
                      ? 'bg-violet-600/20 hover:bg-violet-600/30 border-violet-500/30 text-violet-400'
                      : 'bg-red-600/20 hover:bg-red-600/30 border-red-500/30 text-red-400'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${hasActiveStream ? 'bg-violet-400' : 'bg-red-500'}`} />
                  {hasActiveStream ? 'Rejoin Stream' : 'Go Live'}
                </Link>

                {/* User dropdown */}
                <div className="relative group">
                  {/* User avatar button */}
                  <button className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-2 rounded-xl transition-all">
                    {/* Avatar circle with initial */}
                    <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold text-white">
                      {user?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="text-white text-sm font-medium">{user?.username}</span>
                    <span className="text-gray-500 text-xs">▾</span>
                  </button>

                  {/* Dropdown menu - appears on hover */}
                  <div className="absolute right-0 top-full mt-2 w-48 bg-gray-900 border border-gray-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <div className="p-1">
                      <Link
                        to="/profile"
                        className="block px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        👤 My Profile
                      </Link>
                      <Link
                        to="/my-cards"
                        className="block px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        🎴 My Cards
                      </Link>
                      <Link
                        to="/my-bids"
                        className="block px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        💰 My Bids
                      </Link>
                      <div className="h-px bg-gray-800 my-1" />
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        🚪 Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Not logged in */}
                <Link
                  to="/login"
                  className="text-gray-400 hover:text-white text-sm font-medium transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* ── MOBILE MENU BUTTON ── */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-gray-400 hover:text-white transition-colors"
          >
            {/* Hamburger / X icon */}
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* ── MOBILE MENU ── */}
        {/* Only shown on mobile when mobileOpen is true */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-800 py-4 space-y-2">
            {[
              { to: '/', label: '🏠 Home' },
              { to: '/cards', label: '🎴 Browse Cards' },
              { to: '/streams', label: '📡 Live Streams' },
            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
              >
                {link.label}
              </Link>
            ))}

            <div className="h-px bg-gray-800 my-2" />

            {isAuthenticated ? (
              <>
                <Link
                  to="/cards/new"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
                >
                  + List a Card
                </Link>
                <Link
                  to="/psa-import"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
                >
                  Scan PSA
                </Link>
                <Link
                  to="/stream/host"
                  onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-3 rounded-xl transition-colors font-medium ${
                    hasActiveStream
                      ? 'text-violet-400 hover:bg-gray-800'
                      : 'text-red-400 hover:bg-gray-800'
                  }`}
                >
                  {hasActiveStream ? '↩ Rejoin Stream' : '🔴 Go Live'}
                </Link>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    if (notifications[0]) navigate(`/livestream/${notifications[0].streamId}`);
                    markAllRead();
                  }}
                  className="w-full text-left px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl transition-colors flex items-center gap-2"
                >
                  🔔 Notifications
                  {unreadCount > 0 && (
                    <span className="ml-auto min-w-[20px] h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1.5">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                <Link
                  to="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
                >
                  👤 {user?.username}
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-3 text-red-400 hover:bg-gray-800 rounded-xl transition-colors"
                >
                  🚪 Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="block bg-violet-600 text-white px-4 py-3 rounded-xl font-bold text-center transition-all"
                >
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cardService } from '../services/cardService';
import { streamService } from '../services/streamService';

// ============================================================
// HOW THIS FILE WORKS (React Explanation for Beginners)
// ============================================================
//
// 1. COMPONENT: A React component is just a JavaScript function
//    that returns HTML-like code (called JSX). This file exports
//    one component called "HomePage".
//
// 2. STATE (useState): State is data that can change over time.
//    When state changes, React automatically re-renders the page.
//    Example: When cards load from the database, featuredCards
//    state updates, and React shows them on screen automatically.
//
// 3. EFFECTS (useEffect): Runs code AFTER the page renders.
//    We use it to fetch data from the backend when the page loads.
//    The empty [] means "only run this once when page first loads".
//
// 4. JSX: The HTML-like code inside return(). It looks like HTML
//    but it's actually JavaScript. Key differences:
//    - class → className (class is a reserved word in JS)
//    - onclick → onClick (camelCase)
//    - {variable} → Shows JS variable value inside HTML
//
// 5. TAILWIND: Instead of writing CSS files, we put class names
//    directly on elements. "bg-gray-900" means background gray-900.
//    "text-white" means white text. "px-4" means padding-x 16px.
// ============================================================

// This is the main HomePage component
function HomePage() {

  // ── STATE ──────────────────────────────────────────────
  // These are variables that React "watches".
  // When they change, the page updates automatically.

  const [featuredCards, setFeaturedCards] = useState([]);
  // featuredCards = current value (starts as empty array [])
  // setFeaturedCards = function to UPDATE the value

  const [activeStreams, setActiveStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // useAuth() gives us the currently logged-in user
  const { user, isAuthenticated } = useAuth();

  // ── EFFECT ─────────────────────────────────────────────
  // Runs once when the page first loads.
  // Fetches cards and streams from our backend API.

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Call backend: GET /api/cards?limit=8
        const cards = await cardService.getAllCards({ limit: 8 });
        // Update state → React re-renders with the cards
        setFeaturedCards(Array.isArray(cards) ? cards : []);

        // Call backend: GET /api/streams/active
        const streams = await streamService.getActiveStreams();
        setActiveStreams(Array.isArray(streams) ? streams : []);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError('Failed to load content');
        setFeaturedCards([]);
        setActiveStreams([]);
      } finally {
        // Whether success or fail, stop the loading spinner
        setLoading(false);
      }
    };

    fetchData();
  }, []); // Empty [] = run once on page load

  // ── RENDER ─────────────────────────────────────────────
  // Everything inside return() is what appears on screen.
  // This is JSX - looks like HTML, but runs in JavaScript.

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── HERO SECTION ─────────────────────────────── */}
      {/* This is the big banner at the top of the page */}
      <section className="relative overflow-hidden">

        {/* Background gradient effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/40 via-gray-950 to-blue-900/30" />

        {/* Decorative glowing circles in background */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-violet-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />

        {/* Hero content - sits on top of the background effects */}
        <div className="relative max-w-7xl mx-auto px-6 py-28 text-center">

          {/* Badge above the title */}
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-2 mb-8">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-violet-300 text-sm font-medium">Live Auctions Happening Now</span>
          </div>

          {/* Main heading */}
          <h1 className="text-6xl md:text-7xl font-black tracking-tight mb-6 leading-none">
            {/* This span creates the gradient text effect */}
            <span className="bg-gradient-to-r from-violet-400 via-purple-300 to-blue-400 bg-clip-text text-transparent">
              Pokémon Card
            </span>
            <br />
            <span className="text-white">Auctions</span>
          </h1>

          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Buy and sell rare Pokémon cards through live, interactive auctions. 
            Watch streams, place bids, and win the cards you've always wanted.
          </p>

          {/* Call to action buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">

            {/* Show different buttons based on if user is logged in */}
            {/* isAuthenticated = true if user is logged in */}
            {isAuthenticated ? (
              <>
                {/* If logged in: show these buttons */}
                <Link
                  to="/stream/host"
                  className="bg-violet-600 hover:bg-violet-500 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all hover:scale-105 hover:shadow-lg hover:shadow-violet-500/25"
                >
                  🎥 Start Streaming
                </Link>
                <Link
                  to="/cards/new"
                  className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all hover:scale-105"
                >
                  + List a Card
                </Link>
              </>
            ) : (
              <>
                {/* If NOT logged in: show these buttons */}
                <Link
                  to="/signup"
                  className="bg-violet-600 hover:bg-violet-500 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all hover:scale-105 hover:shadow-lg hover:shadow-violet-500/25"
                >
                  Get Started Free
                </Link>
                <Link
                  to="/login"
                  className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all hover:scale-105"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>

          {/* Stats row */}
          <div className="flex justify-center gap-12 mt-16 pt-12 border-t border-gray-800/50">
            {[
              { label: 'Active Users', value: '2,400+' },
              { label: 'Cards Sold', value: '18,000+' },
              { label: 'Live Auctions', value: '24/7' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-black text-white">{stat.value}</div>
                <div className="text-gray-500 text-sm mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LIVE STREAMS SECTION ──────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-20">

        {/* Section header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            {/* Pulsing red dot = "LIVE" indicator */}
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <h2 className="text-3xl font-black text-white">Live Now</h2>
          </div>
          <Link to="/streams" className="text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors">
            View all streams →
          </Link>
        </div>

        {/* Loading state */}
        {loading ? (
          <StreamSkeleton />
        ) : activeStreams.length > 0 ? (
          /* Grid of stream cards */
          /* grid-cols-3 = 3 columns on desktop, 1 on mobile */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* .map() loops through each stream and renders a card */}
            {activeStreams.map((stream) => (
              <StreamCard key={stream.id} stream={stream} />
            ))}
          </div>
        ) : (
          /* Empty state - shown when no streams are live */
          <EmptyState
            icon="📡"
            title="No live streams right now"
            subtitle="Check back soon or be the first to go live!"
            action={isAuthenticated ? { label: 'Start Streaming', to: '/stream/host' } : { label: 'Sign Up to Stream', to: '/signup' }}
          />
        )}
      </section>

      {/* ── FEATURED CARDS SECTION ────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-20 border-t border-gray-800/50">

        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-3xl font-black text-white">Featured Cards</h2>
            <p className="text-gray-500 mt-1">Browse the latest listings from our sellers</p>
          </div>
          {/* Link to view ALL cards */}
          <Link to="/cards" className="text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors">
            View all cards →
          </Link>
        </div>

        {loading ? (
          <CardSkeleton />
        ) : featuredCards.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {featuredCards.map((card) => (
              <CardItem key={card.id} card={card} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="🎴"
            title="No cards listed yet"
            subtitle="Be the first to list a card for auction!"
            action={isAuthenticated ? { label: 'List a Card', to: '/cards/new' } : { label: 'Sign Up to Sell', to: '/signup' }}
          />
        )}
      </section>

      {/* ── HOW IT WORKS SECTION ──────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-20 border-t border-gray-800/50">
        <h2 className="text-3xl font-black text-white text-center mb-4">How It Works</h2>
        <p className="text-gray-400 text-center mb-16 max-w-xl mx-auto">
          Three simple steps to start buying or selling
        </p>

        {/* Three columns of steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              step: '01',
              icon: '🎥',
              title: 'Go Live',
              desc: 'Sellers start a livestream and showcase their Pokémon cards to viewers in real-time.',
            },
            {
              step: '02',
              icon: '💰',
              title: 'Place Bids',
              desc: 'Viewers watch the stream and place bids on cards they want. Highest bid wins!',
            },
            {
              step: '03',
              icon: '📦',
              title: 'Win & Receive',
              desc: 'Winners pay securely and sellers ship the cards. Simple, safe, and fun.',
            },
          ].map((item) => (
            <div key={item.step} className="relative bg-gray-900 border border-gray-800 rounded-2xl p-8 hover:border-violet-500/50 transition-all">
              {/* Step number in top right corner */}
              <span className="absolute top-6 right-6 text-5xl font-black text-gray-800">{item.step}</span>
              <div className="text-4xl mb-4">{item.icon}</div>
              <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
              <p className="text-gray-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CALL TO ACTION BANNER ─────────────────────── */}
      {!isAuthenticated && (
        <section className="max-w-7xl mx-auto px-6 py-20">
          <div className="relative overflow-hidden bg-gradient-to-r from-violet-900/50 to-blue-900/50 border border-violet-500/20 rounded-3xl p-16 text-center">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 to-transparent" />
            <div className="relative">
              <h2 className="text-4xl font-black text-white mb-4">Ready to start bidding?</h2>
              <p className="text-gray-400 mb-8 text-lg">Join thousands of Pokémon collectors buying and selling on our platform.</p>
              <Link
                to="/signup"
                className="inline-block bg-violet-600 hover:bg-violet-500 text-white px-10 py-4 rounded-xl font-bold text-lg transition-all hover:scale-105 hover:shadow-xl hover:shadow-violet-500/30"
              >
                Create Free Account
              </Link>
            </div>
          </div>
        </section>
      )}

    </div>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================
// These are smaller components used inside HomePage above.
// Breaking the page into smaller pieces keeps code organised.
// ============================================================

// ── STREAM CARD ─────────────────────────────────────────────
// Renders a single live stream card in the grid
function StreamCard({ stream }) {
  // { stream } = "destructuring" - takes stream out of the props object
  // Props are data passed from parent component to child component
  return (
    <Link
      to={`/livestream/${stream.id}`}
      className="group block bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-violet-500/50 transition-all hover:shadow-xl hover:shadow-violet-500/10 hover:-translate-y-1"
    >
      {/* Thumbnail area */}
      <div className="relative h-48 bg-gradient-to-br from-violet-900/50 to-blue-900/50 flex items-center justify-center">
        <span className="text-6xl opacity-30">📹</span>
        {/* LIVE badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          LIVE
        </div>
        {/* Viewer count */}
        <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
          👁 {stream.viewer_count || 0}
        </div>
      </div>

      {/* Stream info */}
      <div className="p-5">
        <h3 className="font-bold text-white group-hover:text-violet-300 transition-colors mb-1 truncate">
          {stream.title}
        </h3>
        <p className="text-gray-500 text-sm">by {stream.host_name}</p>
      </div>
    </Link>
  );
}

// ── CARD ITEM ────────────────────────────────────────────────
// Renders a single Pokémon card listing
function CardItem({ card }) {
  return (
    <Link
      to={`/card/${card.id}`}
      className="group block bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-violet-500/50 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/10"
    >
      {/* Card image */}
      <div className="relative overflow-hidden bg-gray-800 h-64">
        {card.image_url ? (
          <img
            src={card.image_url}
            alt={card.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          /* Placeholder if no image */
          <div className="w-full h-full flex items-center justify-center text-6xl opacity-20">
            🎴
          </div>
        )}

        {/* Rarity badge in top right */}
        {card.rarity && (
          <div className="absolute top-2 right-2 bg-black/70 text-yellow-400 text-xs font-bold px-2 py-1 rounded-full">
            {card.rarity}
          </div>
        )}
      </div>

      {/* Card details */}
      <div className="p-4">
        <h3 className="font-bold text-white group-hover:text-violet-300 transition-colors truncate">
          {card.name}
        </h3>
        {card.set && (
          <p className="text-gray-500 text-xs mt-0.5 truncate">{card.set}</p>
        )}
        {/* Price */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
          <div>
            <p className="text-gray-500 text-xs">Starting bid</p>
            <p className="text-violet-400 font-black text-lg">${parseFloat(card.starting_bid || 0).toFixed(2)}</p>
          </div>
          {card.condition && (
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full">
              {card.condition}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── EMPTY STATE ──────────────────────────────────────────────
// Shown when there's no data to display
function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="text-center py-20 border border-dashed border-gray-800 rounded-2xl">
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-500 mb-8">{subtitle}</p>
      {action && (
        <Link
          to={action.to}
          className="inline-block bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 rounded-xl font-semibold transition-all hover:scale-105"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

// ── SKELETON LOADERS ─────────────────────────────────────────
// Animated placeholders shown while data is loading
// The animate-pulse class makes them fade in/out

function StreamSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Create 3 skeleton placeholders */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden animate-pulse">
          <div className="h-48 bg-gray-800" />
          <div className="p-5 space-y-3">
            <div className="h-4 bg-gray-800 rounded w-3/4" />
            <div className="h-3 bg-gray-800 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden animate-pulse">
          <div className="h-64 bg-gray-800" />
          <div className="p-4 space-y-3">
            <div className="h-4 bg-gray-800 rounded w-3/4" />
            <div className="h-3 bg-gray-800 rounded w-1/2" />
            <div className="h-5 bg-gray-800 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Export makes this component available to import in other files
export default HomePage;

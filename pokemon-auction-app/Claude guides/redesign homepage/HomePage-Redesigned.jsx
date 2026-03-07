import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cardService } from '../services/cardService';
import { streamService } from '../services/streamService';

// ============================================================
// IMPROVED HOMEPAGE - Inspired by Collektr & Gaming UIs
// ============================================================
// Key improvements from reference designs:
// 1. Cleaner card layouts with better spacing
// 2. Category sidebar navigation
// 3. Better visual hierarchy
// 4. Auction badges on cards
// 5. Improved search and filters
// 6. Large hero section
// ============================================================

function HomePage() {
  const [featuredCards, setFeaturedCards] = useState([]);
  const [activeStreams, setActiveStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const { user, isAuthenticated } = useAuth();

  // Categories inspired by gaming UI sidebar
  const categories = [
    { id: 'all', name: 'All Cards', icon: '🎴' },
    { id: 'rare', name: 'Rare', icon: '💎' },
    { id: 'holo', name: 'Holo Rare', icon: '✨' },
    { id: 'ultra', name: 'Ultra Rare', icon: '🌟' },
    { id: 'secret', name: 'Secret Rare', icon: '🔮' },
    { id: 'graded', name: 'Graded', icon: '🏆' },
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const cards = await cardService.getAllCards({ limit: 20 });
        setFeaturedCards(Array.isArray(cards) ? cards : []);

        const streams = await streamService.getActiveStreams();
        setActiveStreams(Array.isArray(streams) ? streams : []);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError('Failed to load content');
        setFeaturedCards([]);
        setActiveStreams([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter and sort cards
  const filteredCards = featuredCards
    .filter(card => {
      const matchesSearch = card.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || 
        card.rarity?.toLowerCase().includes(selectedCategory);
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at);
      if (sortBy === 'price-low') return parseFloat(a.starting_bid) - parseFloat(b.starting_bid);
      if (sortBy === 'price-high') return parseFloat(b.starting_bid) - parseFloat(a.starting_bid);
      return 0;
    });

  return (
    <div className="min-h-screen bg-[#0f1419]">
      
      {/* ── ENHANCED HERO SECTION ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1a1f2e] via-[#0f1419] to-[#1a1f2e] border-b border-gray-800">
        {/* Animated background effects */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-20">
          <div className="text-center max-w-3xl mx-auto">
            {/* Live indicator badge */}
            <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-4 py-2 mb-6">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-red-400 text-sm font-bold">
                {activeStreams.length} Live Auctions
              </span>
            </div>

            {/* Main heading */}
            <h1 className="text-6xl md:text-7xl font-black mb-6 leading-tight">
              <span className="text-white">Collect, Trade &</span>
              <br />
              <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
                Win Pokémon Cards
              </span>
            </h1>

            <p className="text-xl text-gray-400 mb-10 leading-relaxed">
              Join live auctions, bid on rare cards, and build your ultimate collection.
              Real-time bidding. Verified sellers. Secure transactions.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/cards/new"
                    className="group relative bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all hover:scale-105 hover:shadow-xl hover:shadow-violet-500/50"
                  >
                    <span className="relative z-10">+ List Your Card</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-400 to-purple-400 rounded-2xl blur opacity-0 group-hover:opacity-30 transition-opacity" />
                  </Link>
                  <Link
                    to="/streams"
                    className="bg-gray-800 hover:bg-gray-700 border-2 border-gray-700 hover:border-gray-600 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all hover:scale-105"
                  >
                    🎥 Browse Streams
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/signup"
                    className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all hover:scale-105 hover:shadow-xl hover:shadow-violet-500/50"
                  >
                    Get Started Free
                  </Link>
                  <Link
                    to="/login"
                    className="bg-gray-800 hover:bg-gray-700 border-2 border-gray-700 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all hover:scale-105"
                  >
                    Sign In
                  </Link>
                </>
              )}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-8 mt-16 pt-8 border-t border-gray-800/50">
              <div>
                <div className="text-3xl font-black text-white mb-1">2.4K+</div>
                <div className="text-sm text-gray-500">Active Users</div>
              </div>
              <div>
                <div className="text-3xl font-black text-white mb-1">18K+</div>
                <div className="text-sm text-gray-500">Cards Sold</div>
              </div>
              <div>
                <div className="text-3xl font-black text-white mb-1">24/7</div>
                <div className="text-sm text-gray-500">Live Auctions</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MAIN CONTENT AREA WITH SIDEBAR ── */}
      <div className="max-w-[1600px] mx-auto px-6 py-12">
        <div className="flex gap-8">

          {/* ── LEFT SIDEBAR (Category Navigation) ── */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-6 space-y-6">
              
              {/* Categories */}
              <div className="bg-[#1a1f2e] rounded-2xl p-6 border border-gray-800">
                <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">
                  Categories
                </h3>
                <nav className="space-y-1">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        selectedCategory === cat.id
                          ? 'bg-violet-600 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800'
                      }`}
                    >
                      <span className="text-xl">{cat.icon}</span>
                      <span>{cat.name}</span>
                    </button>
                  ))}
                </nav>
              </div>

              {/* Quick actions */}
              {isAuthenticated && (
                <div className="bg-gradient-to-br from-violet-600/10 to-purple-600/10 border border-violet-500/20 rounded-2xl p-6">
                  <h3 className="text-white font-bold mb-3">Quick Actions</h3>
                  <div className="space-y-2">
                    <Link
                      to="/cards/new"
                      className="block text-sm text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      + List a card
                    </Link>
                    <Link
                      to="/my-bids"
                      className="block text-sm text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      📊 My bids
                    </Link>
                    <Link
                      to="/stream/host"
                      className="block text-sm text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      🎥 Go live
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* ── MAIN CONTENT ── */}
          <main className="flex-1 min-w-0">

            {/* ── SEARCH & FILTERS BAR ── */}
            <div className="bg-[#1a1f2e] rounded-2xl p-6 border border-gray-800 mb-8">
              <div className="flex flex-col md:flex-row gap-4">
                
                {/* Search input */}
                <div className="flex-1 relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                    🔍
                  </span>
                  <input
                    type="text"
                    placeholder="Search cards..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                  />
                </div>

                {/* Sort dropdown */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                >
                  <option value="newest">Newest First</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                </select>

                {/* Mobile category filter */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="lg:hidden bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Active filters */}
              {(searchQuery || selectedCategory !== 'all') && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-800">
                  <span className="text-sm text-gray-500">Active filters:</span>
                  {searchQuery && (
                    <span className="bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full">
                      Search: {searchQuery}
                      <button
                        onClick={() => setSearchQuery('')}
                        className="ml-2 text-gray-500 hover:text-white"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {selectedCategory !== 'all' && (
                    <span className="bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full">
                      {categories.find(c => c.id === selectedCategory)?.name}
                      <button
                        onClick={() => setSelectedCategory('all')}
                        className="ml-2 text-gray-500 hover:text-white"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* ── LIVE STREAMS SECTION ── */}
            {activeStreams.length > 0 && (
              <section className="mb-12">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <h2 className="text-2xl font-black text-white">Live Auctions</h2>
                  </div>
                  <Link
                    to="/streams"
                    className="text-violet-400 hover:text-violet-300 text-sm font-semibold transition-colors"
                  >
                    View All →
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeStreams.slice(0, 3).map(stream => (
                    <StreamCard key={stream.id} stream={stream} />
                  ))}
                </div>
              </section>
            )}

            {/* ── FEATURED CARDS GRID ── */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black text-white">
                  {selectedCategory === 'all' ? 'All Cards' : categories.find(c => c.id === selectedCategory)?.name}
                </h2>
                <span className="text-sm text-gray-500">
                  {filteredCards.length} {filteredCards.length === 1 ? 'card' : 'cards'}
                </span>
              </div>

              {loading ? (
                <CardGridSkeleton />
              ) : filteredCards.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {filteredCards.map(card => (
                    <CardItem key={card.id} card={card} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon="🔍"
                  title="No cards found"
                  subtitle="Try adjusting your filters or search query"
                />
              )}
            </section>

          </main>
        </div>
      </div>

    </div>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

// ── STREAM CARD (Inspired by gaming UI large previews) ──
function StreamCard({ stream }) {
  return (
    <Link
      to={`/livestream/${stream.id}`}
      className="group block bg-[#1a1f2e] rounded-2xl overflow-hidden border border-gray-800 hover:border-violet-500/50 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-violet-500/10"
    >
      {/* Thumbnail */}
      <div className="relative h-48 bg-gradient-to-br from-violet-900/30 to-blue-900/30 flex items-center justify-center overflow-hidden">
        <span className="text-6xl opacity-20">📹</span>
        
        {/* LIVE badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          LIVE
        </div>

        {/* Viewer count */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/70 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg backdrop-blur-sm">
          <span>👁</span>
          <span>{stream.viewer_count || 0}</span>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-bold text-white group-hover:text-violet-300 transition-colors mb-1 truncate">
          {stream.title}
        </h3>
        <p className="text-gray-500 text-sm">by {stream.host_name}</p>
      </div>
    </Link>
  );
}

// ── CARD ITEM (Inspired by Collektr clean cards) ──
function CardItem({ card }) {
  return (
    <Link
      to={`/card/${card.id}`}
      className="group block bg-[#1a1f2e] rounded-2xl overflow-hidden border border-gray-800 hover:border-violet-500/50 transition-all hover:scale-[1.05] hover:shadow-xl hover:shadow-violet-500/20"
    >
      {/* Card image */}
      <div className="relative h-64 bg-gray-900 overflow-hidden">
        {card.image_url ? (
          <img
            src={card.image_url}
            alt={card.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl opacity-10">
            🎴
          </div>
        )}

        {/* Auction badge (like Collektr) */}
        <div className="absolute top-2 right-2 bg-pink-600 text-white text-xs font-bold px-3 py-1 rounded-full">
          Auction
        </div>

        {/* Rarity badge */}
        {card.rarity && (
          <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-yellow-400 text-xs font-bold px-2.5 py-1 rounded-lg">
            {card.rarity}
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1f2e] via-transparent to-transparent opacity-60" />
      </div>

      {/* Card details */}
      <div className="p-4">
        <h3 className="font-bold text-white group-hover:text-violet-300 transition-colors truncate mb-1">
          {card.name}
        </h3>
        
        {card.set && (
          <p className="text-gray-500 text-xs truncate mb-3">{card.set}</p>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-gray-800">
          <div>
            <p className="text-gray-500 text-xs mb-0.5">Starting bid</p>
            <p className="text-violet-400 font-black text-lg">
              ${parseFloat(card.starting_bid || 0).toFixed(2)}
            </p>
          </div>
          {card.condition && (
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-lg">
              {card.condition}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── EMPTY STATE ──
function EmptyState({ icon, title, subtitle }) {
  return (
    <div className="text-center py-20 border border-dashed border-gray-800 rounded-2xl bg-[#1a1f2e]">
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-500">{subtitle}</p>
    </div>
  );
}

// ── SKELETON LOADERS ──
function CardGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
        <div key={i} className="bg-[#1a1f2e] border border-gray-800 rounded-2xl overflow-hidden animate-pulse">
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

export default HomePage;

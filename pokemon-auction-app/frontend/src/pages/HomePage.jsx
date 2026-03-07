import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cardService } from '../services/cardService';
import { streamService } from '../services/streamService';

function HomePage() {
  const [featuredCards, setFeaturedCards] = useState([]);
  const [activeStreams, setActiveStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const cards = await cardService.getAllCards({ limit: 8 });
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

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── HERO SECTION ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-950 to-gray-900 border-b border-gray-800">
        
        {/* Background decorative blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
        </div>

        {/* Hero content */}
        <div className="relative max-w-7xl mx-auto px-6 py-20">
          <div className="text-center max-w-3xl mx-auto">
            
            {/* Live badge */}
            <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-4 py-2 mb-8">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-red-400 text-sm font-bold">Live Auctions Happening Now</span>
            </div>

            {/* Main heading */}
            <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
              <span className="bg-gradient-to-r from-violet-400 via-purple-300 to-blue-400 bg-clip-text text-transparent">
                Vaultive
              </span>
              <br />
              <span className="text-white">Auctions</span>
            </h1>

            <p className="text-xl text-gray-400 mb-10 leading-relaxed max-w-2xl mx-auto">
              Buy and sell rare Pokémon cards through live, interactive auctions. 
              Watch streams, place bids, and win the cards you've always wanted.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/cards/new"
                    className="bg-violet-600 hover:bg-violet-500 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all hover:scale-105 hover:shadow-lg hover:shadow-violet-500/25"
                  >
                    + List a Card
                  </Link>
                  <Link
                    to="/stream/host"
                    className="bg-gray-800 hover:bg-gray-700 border-2 border-gray-700 hover:border-gray-600 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all hover:scale-105"
                  >
                    🎥 Start Streaming
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/signup"
                    className="bg-violet-600 hover:bg-violet-500 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all hover:scale-105 hover:shadow-lg hover:shadow-violet-500/25"
                  >
                    Get Started Free
                  </Link>
                  <Link
                    to="/login"
                    className="bg-gray-800 hover:bg-gray-700 border-2 border-gray-700 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all hover:scale-105"
                  >
                    Sign In
                  </Link>
                </>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 mt-16 pt-8 border-t border-gray-800/50">
              <div>
                <div className="text-3xl font-black text-white mb-1">2,400+</div>
                <div className="text-sm text-gray-500">Active Users</div>
              </div>
              <div>
                <div className="text-3xl font-black text-white mb-1">18,000+</div>
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

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-7xl mx-auto px-6 py-16">

        {/* ── LIVE STREAMS ── */}
        {activeStreams.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                <h2 className="text-3xl font-black text-white">Live Now</h2>
              </div>
              <Link
                to="/streams"
                className="text-violet-400 hover:text-violet-300 text-sm font-semibold transition-colors"
              >
                View all streams →
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeStreams.map(stream => (
                <StreamCard key={stream.id} stream={stream} />
              ))}
            </div>
          </section>
        )}

        {/* Empty state for no streams */}
        {activeStreams.length === 0 && !loading && (
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-2 h-2 rounded-full bg-gray-600"></div>
              <h2 className="text-3xl font-black text-white">Live Now</h2>
            </div>
            
            <div className="text-center py-16 border border-dashed border-gray-800 rounded-2xl bg-gray-900">
              <div className="text-6xl mb-4">📡</div>
              <h3 className="text-xl font-bold text-white mb-2">No live streams right now</h3>
              <p className="text-gray-500 mb-6">Check back soon or be the first to go live!</p>
              {isAuthenticated && (
                <Link
                  to="/stream/host"
                  className="inline-block bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 rounded-xl font-semibold transition-all"
                >
                  Sign Up to Stream
                </Link>
              )}
            </div>
          </section>
        )}

        {/* ── FEATURED CARDS ── */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-black text-white">Featured Cards</h2>
              <p className="text-gray-500 mt-1">Browse the latest listings from our sellers</p>
            </div>
            <Link
              to="/cards"
              className="text-violet-400 hover:text-violet-300 text-sm font-semibold transition-colors"
            >
              View all cards →
            </Link>
          </div>

          {loading ? (
            <CardSkeleton />
          ) : featuredCards.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {featuredCards.map(card => (
                <CardItem key={card.id} card={card} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border border-dashed border-gray-800 rounded-2xl bg-gray-900">
              <div className="text-6xl mb-4">🎴</div>
              <h3 className="text-xl font-bold text-white mb-2">No cards listed yet</h3>
              <p className="text-gray-500 mb-6">Be the first to list a card for auction!</p>
              {isAuthenticated && (
                <Link
                  to="/cards/new"
                  className="inline-block bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 rounded-xl font-semibold transition-all"
                >
                  List a Card
                </Link>
              )}
            </div>
          )}
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="mb-16">
          <h2 className="text-3xl font-black text-white text-center mb-4">How It Works</h2>
          <p className="text-gray-400 text-center mb-12 max-w-xl mx-auto">
            Three simple steps to start buying or selling
          </p>

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
            ].map(item => (
              <div
                key={item.step}
                className="relative bg-gray-900 border border-gray-800 rounded-2xl p-8 hover:border-violet-500/50 transition-all"
              >
                <span className="absolute top-6 right-6 text-5xl font-black text-gray-800/50">
                  {item.step}
                </span>
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                <p className="text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA BANNER ── */}
        {!isAuthenticated && (
          <section className="mb-16">
            <div className="relative overflow-hidden bg-gradient-to-r from-violet-900/50 to-blue-900/50 border border-violet-500/20 rounded-3xl p-16 text-center">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 to-transparent"></div>
              <div className="relative">
                <h2 className="text-4xl font-black text-white mb-4">Ready to start bidding?</h2>
                <p className="text-gray-400 mb-8 text-lg">
                  Join thousands of Pokémon collectors buying and selling on our platform.
                </p>
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
    </div>
  );
}

// ── SUB-COMPONENTS ──

function StreamCard({ stream }) {
  return (
    <Link
      to={`/livestream/${stream.id}`}
      className="group block bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-violet-500/50 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-violet-500/10"
    >
      <div className="relative h-48 bg-gradient-to-br from-violet-900/30 to-blue-900/30 flex items-center justify-center">
        <span className="text-6xl opacity-20">📹</span>
        
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
          LIVE
        </div>

        <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white text-xs px-2.5 py-1.5 rounded-full">
          👁 {stream.viewer_count || 0}
        </div>
      </div>

      <div className="p-5">
        <h3 className="font-bold text-white group-hover:text-violet-300 transition-colors mb-1 truncate">
          {stream.title}
        </h3>
        <p className="text-gray-500 text-sm">by {stream.host_name}</p>
      </div>
    </Link>
  );
}

function CardItem({ card }) {
  return (
    <Link
      to={`/card/${card.id}`}
      className="group block bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-violet-500/50 transition-all hover:scale-[1.05] hover:shadow-xl hover:shadow-violet-500/20"
    >
      <div className="relative h-64 bg-gray-800 overflow-hidden">
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

        <div className="absolute top-2 right-2 bg-pink-600 text-white text-xs font-bold px-3 py-1 rounded-full">
          Auction
        </div>

        {card.rarity && (
          <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-yellow-400 text-xs font-bold px-2.5 py-1 rounded-lg">
            {card.rarity}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-60"></div>
      </div>

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

function CardSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
      {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
        <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden animate-pulse">
          <div className="h-64 bg-gray-800"></div>
          <div className="p-4 space-y-3">
            <div className="h-4 bg-gray-800 rounded w-3/4"></div>
            <div className="h-3 bg-gray-800 rounded w-1/2"></div>
            <div className="h-5 bg-gray-800 rounded w-1/3"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default HomePage;

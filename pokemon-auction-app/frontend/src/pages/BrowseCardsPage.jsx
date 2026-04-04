import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';

const GAME_LABELS = {
  pokemon: 'Pokémon',
  onepiece: 'One Piece',
  yugioh: 'Yu-Gi-Oh!',
  mtg: 'Magic: The Gathering',
  dbs: 'Dragon Ball Super',
  digimon: 'Digimon',
  cardfight: 'Cardfight!! Vanguard',
  weiss: 'Weiss Schwarz',
  lorcana: 'Disney Lorcana',
  flesh: 'Flesh and Blood',
  union: 'Union Arena',
  other: 'Other TCG',
};

function BrowseCardsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [cards, setCards] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCard, setSelectedCard] = useState(null);

  // Filters (initialize from URL params for shareable links)
  const [view, setView] = useState(searchParams.get('view') || 'all');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [game, setGame] = useState(searchParams.get('game') || 'all');
  const [grade, setGrade] = useState(searchParams.get('grade') || 'all');
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest');

  // Available filter options (loaded from backend)
  const [availableGames, setAvailableGames] = useState([]);
  const [availableGrades, setAvailableGrades] = useState([]);

  // ── Load filter options ─────────────────────────────────
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [gamesRes, gradesRes] = await Promise.all([
          api.get('/browse/games'),
          api.get('/browse/grades'),
        ]);
        setAvailableGames(gamesRes.data);
        setAvailableGrades(gradesRes.data);
      } catch (err) {
        console.log('Failed to load filter options');
      }
    };
    loadFilters();
  }, []);

  // ── Fetch cards ─────────────────────────────────────────
  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (game !== 'all') params.set('game', game);
      if (grade !== 'all') params.set('grade', grade);
      if (sort !== 'newest') params.set('sort', sort);
      if (view === 'upcoming') params.set('upcoming', 'true');
      params.set('limit', '40');

      const response = await api.get(`/browse/cards?${params.toString()}`);
      setCards(response.data.cards);
      setTotal(response.data.total);
    } catch (err) {
      setError('Failed to load cards');
    } finally {
      setLoading(false);
    }
  }, [search, game, grade, sort, view]);

  // Refetch when filters change
  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  // Update URL params when filters change (shareable links)
  useEffect(() => {
    const params = new URLSearchParams();
    if (view !== 'all') params.set('view', view);
    if (search) params.set('search', search);
    if (game !== 'all') params.set('game', game);
    if (grade !== 'all') params.set('grade', grade);
    if (sort !== 'newest') params.set('sort', sort);
    setSearchParams(params, { replace: true });
  }, [view, search, game, grade, sort, setSearchParams]);

  // ── Search handler (debounced with Enter key) ──────────
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  // ── Clear all filters ──────────────────────────────────
  const clearFilters = () => {
    setSearch('');
    setSearchInput('');
    setGame('all');
    setGrade('all');
    setSort('newest');
    setView('all');
  };

  const hasActiveFilters = search || game !== 'all' || grade !== 'all' || sort !== 'newest' || view !== 'all';

  // ── RENDER ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0f1419] text-white">
      <div className="max-w-7xl mx-auto p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black">Browse Cards</h1>
            <p className="text-gray-400 mt-1">
              {total} card{total !== 1 ? 's' : ''} available
            </p>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-300 p-4 rounded-xl mb-6">
            {error}
          </div>
        )}

        {/* Filters Bar */}
        <div className="space-y-4 mb-6">
          {/* Top row: View toggle + Search */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* View Toggle */}
            <div className="flex gap-1 bg-[#1a1f2e] p-1 rounded-xl shrink-0">
              <button
                onClick={() => setView('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  view === 'all' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                All Cards
              </button>
              <button
                onClick={() => setView('upcoming')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  view === 'upcoming' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Upcoming Auctions
              </button>
            </div>

            {/* Search */}
            <form onSubmit={handleSearchSubmit} className="flex-1">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search cards..."
                  className="w-full bg-[#1a1f2e] border border-gray-800 rounded-xl pl-11 pr-4 py-2.5 text-white text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => { setSearchInput(''); setSearch(''); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Bottom row: Dropdowns */}
          <div className="flex flex-wrap gap-3">
            {/* Game filter */}
            <select
              value={game}
              onChange={(e) => setGame(e.target.value)}
              className="bg-[#1a1f2e] border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-violet-500 outline-none"
            >
              <option value="all">All Games</option>
              {availableGames.map((g) => (
                <option key={g} value={g}>{GAME_LABELS[g] || g}</option>
              ))}
            </select>

            {/* Grade filter */}
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="bg-[#1a1f2e] border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-violet-500 outline-none"
            >
              <option value="all">All Grades</option>
              {availableGrades.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-[#1a1f2e] border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-violet-500 outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-[#1a1f2e] rounded-2xl border border-gray-800 animate-pulse">
                <div className="h-48 bg-gray-800 rounded-t-2xl" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-800 rounded w-3/4" />
                  <div className="h-3 bg-gray-800 rounded w-1/2" />
                  <div className="h-8 bg-gray-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && cards.length === 0 && (
          <div className="text-center py-16">
            <span className="text-5xl block mb-4">🔍</span>
            <h2 className="text-xl font-bold mb-2">No cards found</h2>
            <p className="text-gray-500 mb-6">
              {hasActiveFilters
                ? 'Try adjusting your filters or search terms.'
                : 'No cards are listed for sale yet. Check back soon!'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-6 py-3 rounded-xl"
              >
                Clear All Filters
              </button>
            )}
          </div>
        )}

        {/* Card Grid */}
        {!loading && cards.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {cards.map((card) => (
              <BrowseCardItem
                key={card.id}
                card={card}
                onClick={() => setSelectedCard(card)}
              />
            ))}
          </div>
        )}

        {/* Card Detail Modal */}
        {selectedCard && (
          <BrowseCardDetailModal
            card={selectedCard}
            onClose={() => setSelectedCard(null)}
          />
        )}
      </div>
    </div>
  );
}


// ── BROWSE CARD ITEM ─────────────────────────────────────
function BrowseCardItem({ card, onClick }) {
  const thumbnail = card.card_image_front || card.image_url;

  return (
    <div
      onClick={onClick}
      className="bg-[#1a1f2e] rounded-2xl border border-gray-800 hover:border-gray-700 transition-colors overflow-hidden cursor-pointer group"
    >
      {/* Image */}
      <div className="relative h-48 bg-gray-900 overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={card.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-700">
            <span className="text-4xl">🎴</span>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
          {card.tcg_game && (
            <span className="w-fit bg-gray-900/80 backdrop-blur-sm text-white text-xs font-bold px-2 py-0.5 rounded-md">
              {GAME_LABELS[card.tcg_game] || card.tcg_game}
            </span>
          )}
          {card.is_psa_verified && (
            <span className="w-fit bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-md">
              PSA {card.psa_grade}
            </span>
          )}
          {card.queued_for_stream && (
            <span className="w-fit bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              UPCOMING
            </span>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="p-4 space-y-2">
        <div>
          <h3 className="font-bold text-white truncate group-hover:text-violet-300 transition-colors">
            {card.name}
          </h3>
          <p className="text-gray-500 text-xs truncate">
            {card.grading || card.condition}
            {card.seller_name && ` · ${card.seller_name}`}
          </p>
        </div>

        <div className="pt-2 border-t border-gray-800">
          <p className="text-gray-500 text-xs">Starting bid</p>
          <p className="text-violet-400 font-black text-lg">
            ${parseFloat(card.starting_bid).toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}


// ── BROWSE CARD DETAIL MODAL ─────────────────────────────
function BrowseCardDetailModal({ card, onClose }) {
  const frontImage = card.card_image_front || card.image_url;
  const backImage = card.card_image_back;

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1f2e] rounded-2xl border border-gray-800 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-bold text-white">{card.name}</h2>
            <p className="text-gray-400 text-sm mt-0.5">
              {card.grading || card.condition}
              {card.psa_cert_number && ` · Cert #${card.psa_cert_number}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white bg-gray-800 hover:bg-gray-700 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Images */}
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-2 font-medium">FRONT</p>
              {frontImage ? (
                <img src={frontImage} alt="Front" className="w-full rounded-xl bg-gray-900 object-contain max-h-[500px]" />
              ) : (
                <div className="w-full aspect-[3/4] bg-gray-900 rounded-xl flex items-center justify-center text-gray-700">
                  <span className="text-3xl">🎴</span>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2 font-medium">BACK</p>
              {backImage ? (
                <img src={backImage} alt="Back" className="w-full rounded-xl bg-gray-900 object-contain max-h-[500px]" />
              ) : (
                <div className="w-full aspect-[3/4] bg-gray-900 rounded-xl flex items-center justify-center text-gray-700">
                  <span className="text-xs text-gray-600">No back image</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card Details */}
        <div className="px-5 pb-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-gray-900/50 rounded-xl">
            {card.tcg_game && (
              <div>
                <p className="text-xs text-gray-500">Card Game</p>
                <p className="text-sm text-white font-bold">{GAME_LABELS[card.tcg_game] || card.tcg_game}</p>
              </div>
            )}
            {card.psa_grade && (
              <div>
                <p className="text-xs text-gray-500">Grade</p>
                <p className="text-sm text-white font-bold">{card.psa_grade}</p>
              </div>
            )}
            {card.psa_year && (
              <div>
                <p className="text-xs text-gray-500">Year</p>
                <p className="text-sm text-white">{card.psa_year}</p>
              </div>
            )}
            {card.psa_brand && (
              <div>
                <p className="text-xs text-gray-500">Brand</p>
                <p className="text-sm text-white">{card.psa_brand}</p>
              </div>
            )}
            {card.condition && (
              <div>
                <p className="text-xs text-gray-500">Condition</p>
                <p className="text-sm text-white">{card.condition}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500">Starting Bid</p>
              <p className="text-sm text-violet-400 font-bold">
                ${parseFloat(card.starting_bid).toFixed(2)}
              </p>
            </div>
            {card.psa_population && (
              <div>
                <p className="text-xs text-gray-500">Population</p>
                <p className="text-sm text-white">{card.psa_population}</p>
              </div>
            )}
          </div>
        </div>

        {/* Seller Info */}
        {card.seller_name && (
          <div className="px-5 pb-5">
            <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-sm font-bold text-white">
                  {card.seller_name[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm text-white font-medium">{card.seller_name}</p>
                  <p className="text-xs text-gray-500">Verified Seller</p>
                </div>
              </div>
              <Link
                to={`/seller/${card.seller_name}`}
                onClick={onClose}
                className="bg-gray-800 hover:bg-gray-700 text-white text-sm px-4 py-2 rounded-xl transition-colors"
              >
                View Inventory
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


export default BrowseCardsPage;

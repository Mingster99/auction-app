import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

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

const DURATION_PRESETS = [
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '2m', value: 120 },
  { label: '5m', value: 300 },
  { label: '10m', value: 600 },
  { label: '30m', value: 1800 },
];

function formatDuration(seconds) {
  if (!seconds) return '60s';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export default function MyCardsContent() {
  const { user } = useAuth();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('all');
  const [togglingQueue, setTogglingQueue] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [editingCard, setEditingCard] = useState(null);

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [game, setGame] = useState('all');
  const [grade, setGrade] = useState('all');
  const [sort, setSort] = useState('newest');

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    try {
      setLoading(true);
      const response = await api.get('/inventory');
      setCards(response.data);
    } catch (err) {
      setError('Failed to load your cards');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAuctionSettings = async (cardId, settings) => {
    const response = await api.patch(`/inventory/${cardId}/auction-settings`, settings);
    setCards(cards.map(c => c.id === cardId ? response.data.card : c));
    setEditingCard(null);
  };

  const handleToggleQueue = async (cardId, currentQueued) => {
    setTogglingQueue(cardId);
    try {
      const response = await api.patch(`/inventory/${cardId}/queue`, { queued: !currentQueued });
      setCards(cards.map(c => c.id === cardId ? response.data.card : c));
    } catch (err) {
      setError('Failed to update queue status');
    } finally {
      setTogglingQueue(null);
    }
  };

  const handleDelete = async (cardId, cardName) => {
    if (!window.confirm(`Delete "${cardName}" from your inventory?`)) return;
    try {
      await api.delete(`/inventory/${cardId}`);
      setCards(cards.filter(c => c.id !== cardId));
      if (selectedCard?.id === cardId) setSelectedCard(null);
    } catch (err) {
      setError('Failed to delete card');
    }
  };

  const queueCount = cards.filter(c => c.queued_for_stream).length;

  // Derive filter options from loaded cards
  const availableGames = [...new Set(cards.map(c => c.tcg_game).filter(Boolean))].sort();
  const availableGrades = [...new Set(cards.map(c => c.psa_grade).filter(Boolean))].sort();
  const hasActiveFilters = search || game !== 'all' || grade !== 'all' || sort !== 'newest';

  const baseCards = view === 'queue' ? cards.filter(c => c.queued_for_stream) : cards;

  const displayedCards = baseCards
    .filter(c => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !c.name?.toLowerCase().includes(q) &&
          !c.psa_brand?.toLowerCase().includes(q) &&
          !c.psa_subject?.toLowerCase().includes(q)
        ) return false;
      }
      if (game !== 'all' && c.tcg_game !== game) return false;
      if (grade !== 'all' && c.psa_grade !== grade) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === 'price_asc') return parseFloat(a.starting_bid) - parseFloat(b.starting_bid);
      if (sort === 'price_desc') return parseFloat(b.starting_bid) - parseFloat(a.starting_bid);
      return new Date(b.created_at) - new Date(a.created_at); // newest
    });

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg mb-4">Please log in to view your cards</p>
        <Link to="/login" className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-xl font-bold">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Stats + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <p className="text-gray-400">
          {cards.length} card{cards.length !== 1 ? 's' : ''} in your inventory
          {queueCount > 0 && ` · ${queueCount} queued for stream`}
          {hasActiveFilters && ` · ${displayedCards.length} shown`}
        </p>
        <div className="flex gap-3">
          <Link
            to="/psa-import"
            className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-5 py-2.5 rounded-xl transition-colors text-sm"
          >
            📱 Scan PSA
          </Link>
          <Link
            to="/cards/new"
            className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl transition-colors text-sm"
          >
            + List Card
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-300 p-4 rounded-xl mb-6">
          {error}
          <button onClick={() => setError('')} className="ml-3 text-red-400 hover:text-red-200">✕</button>
        </div>
      )}

      <div className="space-y-4 mb-6">
        {/* View toggle + Search */}
        <div className="flex flex-col sm:flex-row gap-4">
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
              onClick={() => setView('queue')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                view === 'queue' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Stream Queue
              {queueCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {queueCount}
                </span>
              )}
            </button>
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); }}
            className="flex-1"
          >
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search your cards..."
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

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          {availableGames.length > 0 && (
            <select
              value={game}
              onChange={(e) => setGame(e.target.value)}
              className="bg-[#1a1f2e] border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-violet-500 outline-none"
            >
              <option value="all">All Games</option>
              {availableGames.map(g => (
                <option key={g} value={g}>{GAME_LABELS[g] || g}</option>
              ))}
            </select>
          )}

          {availableGrades.length > 0 && (
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="bg-[#1a1f2e] border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-violet-500 outline-none"
            >
              <option value="all">All Grades</option>
              {availableGrades.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          )}

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="bg-[#1a1f2e] border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-violet-500 outline-none"
          >
            <option value="newest">Newest First</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={() => { setSearch(''); setSearchInput(''); setGame('all'); setGrade('all'); setSort('newest'); }}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
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

      {!loading && displayedCards.length === 0 && (
        <div className="text-center py-16">
          <span className="text-5xl block mb-4">
            {view === 'queue' ? '📋' : '🎴'}
          </span>
          <h2 className="text-xl font-bold mb-2">
            {view === 'queue' ? 'No cards queued for stream' : 'No cards yet'}
          </h2>
          <p className="text-gray-500 mb-6">
            {view === 'queue'
              ? 'Toggle the stream icon on any card to add it to your next stream.'
              : 'Scan a PSA slab or list a card manually to get started.'}
          </p>
          {view !== 'queue' && (
            <div className="flex gap-3 justify-center">
              <Link to="/psa-import" className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-6 py-3 rounded-xl">
                📱 Scan PSA Card
              </Link>
              <Link to="/cards/new" className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl">
                + List Manually
              </Link>
            </div>
          )}
        </div>
      )}

      {!loading && displayedCards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayedCards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              togglingQueue={togglingQueue}
              onCardClick={setSelectedCard}
              onEdit={setEditingCard}
              onToggleQueue={handleToggleQueue}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {view === 'queue' && queueCount > 0 && (
        <div className="mt-8 bg-[#1a1f2e] rounded-2xl border border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg">Ready to Go Live</h3>
              <p className="text-gray-400 text-sm mt-1">
                {queueCount} card{queueCount !== 1 ? 's' : ''} queued for your next stream
              </p>
            </div>
            <Link
              to="/stream/host"
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-3 rounded-xl transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Start Stream
            </Link>
          </div>
        </div>
      )}

      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
        />
      )}

      {editingCard && (
        <EditCardModal
          card={editingCard}
          onClose={() => setEditingCard(null)}
          onSave={handleSaveAuctionSettings}
        />
      )}
    </>
  );
}


const isSold = (card) => card.status === 'sold' || card.auction_status === 'sold';

function CardItem({
  card,
  togglingQueue,
  onCardClick,
  onEdit,
  onToggleQueue,
  onDelete,
}) {
  const isToggling = togglingQueue === card.id;
  const sold = isSold(card);
  const thumbnail = card.card_image_front || card.image_url;

  return (
    <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 hover:border-gray-700 transition-colors overflow-hidden group">
      <div
        className="relative h-48 bg-gray-900 overflow-hidden cursor-pointer"
        onClick={() => onCardClick(card)}
      >
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={card.name}
            className={`w-full h-full object-contain ${sold ? 'opacity-50' : ''}`}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-700">
            <span className="text-4xl">🎴</span>
          </div>
        )}

        {sold && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
            <span className="text-white font-black text-2xl tracking-widest opacity-50 rotate-[-20deg]">SOLD</span>
          </div>
        )}

        <div className="absolute top-2 left-2 flex flex-col gap-1">
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
          {sold ? (
            <span className="w-fit bg-gray-700 text-gray-300 text-xs font-bold px-2 py-0.5 rounded-md">
              ✓ SOLD
            </span>
          ) : card.queued_for_stream ? (
            <span className="w-fit bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              QUEUED
            </span>
          ) : null}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(card.id, card.name);
          }}
          className="absolute top-2 right-2 bg-black/60 hover:bg-red-600 text-white w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-xs"
          title="Delete card"
        >
          ✕
        </button>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-bold text-white truncate">{card.name}</h3>
          <p className="text-gray-500 text-xs truncate">
            {card.grading || card.condition}
            {card.set && ` · ${card.set}`}
          </p>
        </div>

        <div className="pt-3 border-t border-gray-800 space-y-2">
          <div className="flex items-end justify-between">
            <div className={`space-y-1 min-w-0 ${sold ? 'opacity-50' : ''}`}>
              <div className="flex items-baseline gap-3 flex-wrap">
                <div>
                  <p className="text-gray-500 text-xs">Start</p>
                  <p className="text-violet-400 font-black text-lg leading-none">
                    {parseFloat(card.starting_bid) > 0
                      ? `$${parseFloat(card.starting_bid).toFixed(2)}`
                      : '—'}
                  </p>
                </div>
                {card.reserve_price && parseFloat(card.reserve_price) > 0 && (
                  <div>
                    <p className="text-gray-500 text-xs">Reserve</p>
                    <p className="text-yellow-400 font-bold text-sm leading-none">
                      ${parseFloat(card.reserve_price).toFixed(2)}
                    </p>
                  </div>
                )}
                {card.buyout_price && parseFloat(card.buyout_price) > 0 && (
                  <div>
                    <p className="text-gray-500 text-xs">Buyout</p>
                    <p className="text-green-400 font-bold text-sm leading-none">
                      ${parseFloat(card.buyout_price).toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
              <p className="text-gray-600 text-xs">{formatDuration(card.auction_duration_seconds)}</p>
            </div>

            {!sold && (
              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                <button
                  onClick={() => onEdit(card)}
                  className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-all"
                  title="Edit auction settings"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={() => onToggleQueue(card.id, card.queued_for_stream)}
                  disabled={isToggling}
                  className={`p-2 rounded-lg transition-all ${
                    card.queued_for_stream
                      ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                      : 'bg-gray-800 text-gray-500 hover:text-white hover:bg-gray-700'
                  } disabled:opacity-50`}
                  title={card.queued_for_stream ? 'Remove from stream queue' : 'Add to next stream'}
                >
                  {isToggling ? (
                    <span className="inline-block w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  ) : (
                    <span className="text-base">📡</span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


function EditCardModal({ card, onClose, onSave }) {
  const [startingBid, setStartingBid] = useState(String(card.starting_bid ?? ''));
  const [reservePrice, setReservePrice] = useState(card.reserve_price ? String(card.reserve_price) : '');
  const [buyoutPrice, setBuyoutPrice] = useState(card.buyout_price ? String(card.buyout_price) : '');
  const [auctionDuration, setAuctionDuration] = useState(String(card.auction_duration_seconds ?? 60));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSave(card.id, {
        startingBid: parseFloat(startingBid),
        reservePrice: reservePrice !== '' ? parseFloat(reservePrice) : null,
        buyoutPrice: buyoutPrice !== '' ? parseFloat(buyoutPrice) : null,
        auctionDurationSeconds: parseInt(auctionDuration, 10),
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save changes');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1f2e] rounded-2xl border border-gray-800 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-white">Edit Auction Settings</h2>
            <p className="text-gray-400 text-sm mt-0.5 truncate max-w-[260px]">{card.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white bg-gray-800 hover:bg-gray-700 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-300 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Starting Bid <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
              <input
                type="number"
                value={startingBid}
                onChange={(e) => setStartingBid(e.target.value)}
                required
                min="0"
                step="0.01"
                className="w-full bg-gray-900 border border-gray-700 focus:border-violet-500 rounded-lg pl-7 pr-3 py-2 text-white text-sm outline-none focus:ring-2 focus:ring-violet-500/20 transition-colors"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Reserve Price <span className="text-gray-600">optional</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <input
                  type="number"
                  value={reservePrice}
                  onChange={(e) => setReservePrice(e.target.value)}
                  min="0"
                  step="0.01"
                  className="w-full bg-gray-900 border border-gray-700 focus:border-violet-500 rounded-lg pl-7 pr-3 py-2 text-white text-sm outline-none focus:ring-2 focus:ring-violet-500/20 transition-colors"
                  placeholder="Not set"
                />
              </div>
              {reservePrice && (
                <button
                  type="button"
                  onClick={() => setReservePrice('')}
                  className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg text-xs transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-gray-600 text-xs mt-1">Minimum price before a sale is committed.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Buyout Price <span className="text-gray-600">optional</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <input
                  type="number"
                  value={buyoutPrice}
                  onChange={(e) => setBuyoutPrice(e.target.value)}
                  min="0"
                  step="0.01"
                  className="w-full bg-gray-900 border border-gray-700 focus:border-violet-500 rounded-lg pl-7 pr-3 py-2 text-white text-sm outline-none focus:ring-2 focus:ring-violet-500/20 transition-colors"
                  placeholder="Not set"
                />
              </div>
              {buyoutPrice && (
                <button
                  type="button"
                  onClick={() => setBuyoutPrice('')}
                  className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg text-xs transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-gray-600 text-xs mt-1">Instant-purchase price that ends the auction immediately.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Auction Duration</label>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {DURATION_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setAuctionDuration(String(p.value))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    auctionDuration === String(p.value)
                      ? 'bg-violet-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={auctionDuration}
                onChange={(e) => setAuctionDuration(e.target.value)}
                min="30"
                max="86400"
                className="w-28 bg-gray-900 border border-gray-700 focus:border-violet-500 rounded-lg px-3 py-2 text-white text-sm outline-none focus:ring-2 focus:ring-violet-500/20 transition-colors"
              />
              <span className="text-gray-500 text-sm">seconds</span>
              <span className="text-gray-600 text-xs">({formatDuration(parseInt(auctionDuration, 10) || 0)})</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


function CardDetailModal({ card, onClose }) {
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

        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-2 font-medium">FRONT</p>
              {frontImage ? (
                <img
                  src={frontImage}
                  alt="Front"
                  className="w-full rounded-xl bg-gray-900 object-contain max-h-[500px]"
                />
              ) : (
                <div className="w-full aspect-[3/4] bg-gray-900 rounded-xl flex items-center justify-center text-gray-700">
                  <span className="text-3xl">🎴</span>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2 font-medium">BACK</p>
              {backImage ? (
                <img
                  src={backImage}
                  alt="Back"
                  className="w-full rounded-xl bg-gray-900 object-contain max-h-[500px]"
                />
              ) : (
                <div className="w-full aspect-[3/4] bg-gray-900 rounded-xl flex items-center justify-center text-gray-700">
                  <span className="text-xs text-gray-600">No back image</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 pb-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-gray-900/50 rounded-xl">
            {card.tcg_game && (
              <div>
                <p className="text-xs text-gray-500">Card Game</p>
                <p className="text-sm text-white font-bold">{GAME_LABELS[card.tcg_game] || card.tcg_game}</p>
              </div>
            )}
            {card.grading && (
              <div>
                <p className="text-xs text-gray-500">Grade</p>
                <p className="text-sm text-white font-bold">{card.grading}</p>
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
                {parseFloat(card.starting_bid) > 0
                  ? `$${parseFloat(card.starting_bid).toFixed(2)}`
                  : 'Not set'}
              </p>
            </div>
            {card.reserve_price && parseFloat(card.reserve_price) > 0 && (
              <div>
                <p className="text-xs text-gray-500">Reserve Price</p>
                <p className="text-sm text-yellow-400 font-bold">${parseFloat(card.reserve_price).toFixed(2)}</p>
              </div>
            )}
            {card.buyout_price && parseFloat(card.buyout_price) > 0 && (
              <div>
                <p className="text-xs text-gray-500">Buyout Price</p>
                <p className="text-sm text-green-400 font-bold">${parseFloat(card.buyout_price).toFixed(2)}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500">Auction Duration</p>
              <p className="text-sm text-white">{formatDuration(card.auction_duration_seconds)}</p>
            </div>
            {card.psa_population && (
              <div>
                <p className="text-xs text-gray-500">Population</p>
                <p className="text-sm text-white">{card.psa_population}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

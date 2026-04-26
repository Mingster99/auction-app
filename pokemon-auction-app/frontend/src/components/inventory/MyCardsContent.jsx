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

export default function MyCardsContent() {
  const { user } = useAuth();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('all');
  const [editingPrice, setEditingPrice] = useState(null);
  const [priceInput, setPriceInput] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);
  const [togglingQueue, setTogglingQueue] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);

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

  const handlePriceSave = async (cardId) => {
    const bid = parseFloat(priceInput);
    if (isNaN(bid) || bid < 0) {
      setError('Please enter a valid price');
      return;
    }
    setSavingPrice(true);
    try {
      const response = await api.patch(`/inventory/${cardId}/price`, { startingBid: bid });
      setCards(cards.map(c => c.id === cardId ? response.data.card : c));
      setEditingPrice(null);
      setPriceInput('');
    } catch (err) {
      setError('Failed to update price');
    } finally {
      setSavingPrice(false);
    }
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

  const displayedCards = view === 'queue'
    ? cards.filter(c => c.queued_for_stream)
    : cards;

  const queueCount = cards.filter(c => c.queued_for_stream).length;

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

      <div className="flex gap-1 bg-[#1a1f2e] p-1 rounded-xl w-fit mb-6">
        <button
          onClick={() => setView('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            view === 'all'
              ? 'bg-violet-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          All Cards
        </button>
        <button
          onClick={() => setView('queue')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            view === 'queue'
              ? 'bg-violet-600 text-white'
              : 'text-gray-400 hover:text-white'
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
              editingPrice={editingPrice}
              priceInput={priceInput}
              savingPrice={savingPrice}
              togglingQueue={togglingQueue}
              onCardClick={setSelectedCard}
              onStartEdit={(id, currentBid) => {
                setEditingPrice(id);
                setPriceInput(String(currentBid || ''));
              }}
              onCancelEdit={() => {
                setEditingPrice(null);
                setPriceInput('');
              }}
              onPriceChange={setPriceInput}
              onPriceSave={handlePriceSave}
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
    </>
  );
}


function CardItem({
  card,
  editingPrice,
  priceInput,
  savingPrice,
  togglingQueue,
  onCardClick,
  onStartEdit,
  onCancelEdit,
  onPriceChange,
  onPriceSave,
  onToggleQueue,
  onDelete,
}) {
  const isEditing = editingPrice === card.id;
  const isToggling = togglingQueue === card.id;
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
            className="w-full h-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-700">
            <span className="text-4xl">🎴</span>
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
          {card.queued_for_stream && (
            <span className="w-fit bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              QUEUED
            </span>
          )}
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

        <div className="pt-3 border-t border-gray-800">
          {isEditing ? (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <input
                  type="number"
                  value={priceInput}
                  onChange={(e) => onPriceChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onPriceSave(card.id);
                    if (e.key === 'Escape') onCancelEdit();
                  }}
                  className="w-full bg-gray-900 border border-violet-500 rounded-lg pl-6 pr-2 py-1.5 text-white text-sm focus:ring-2 focus:ring-violet-500/20 outline-none"
                  autoFocus
                  min="0"
                  step="0.01"
                />
              </div>
              <button
                onClick={() => onPriceSave(card.id)}
                disabled={savingPrice}
                className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-3 rounded-lg transition-colors disabled:opacity-50"
              >
                {savingPrice ? '...' : '✓'}
              </button>
              <button
                onClick={onCancelEdit}
                className="text-gray-500 hover:text-white text-xs px-2 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs">Starting bid</p>
                <button
                  onClick={() => onStartEdit(card.id, card.starting_bid)}
                  className="text-violet-400 font-black text-lg hover:text-violet-300 transition-colors"
                  title="Click to edit price"
                >
                  {parseFloat(card.starting_bid) > 0
                    ? `$${parseFloat(card.starting_bid).toFixed(2)}`
                    : 'Set price'}
                </button>
              </div>
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
                {parseFloat(card.starting_bid) > 0
                  ? `$${parseFloat(card.starting_bid).toFixed(2)}`
                  : 'Not set'}
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
      </div>
    </div>
  );
}

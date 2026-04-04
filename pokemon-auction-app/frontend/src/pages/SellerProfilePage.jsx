import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
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

function SellerProfilePage() {
  const { username } = useParams();
  const [seller, setSeller] = useState(null);
  const [cards, setCards] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCard, setSelectedCard] = useState(null);

  useEffect(() => {
    const fetchSeller = async () => {
      try {
        const response = await api.get(`/browse/seller/${username}`);
        setSeller(response.data.seller);
        setCards(response.data.cards);
        setStats(response.data.stats);
      } catch (err) {
        if (err.response?.status === 404) {
          setError('Seller not found');
        } else if (err.response?.status === 403) {
          setError('This user is not a verified seller');
        } else {
          setError('Failed to load seller profile');
        }
      } finally {
        setLoading(false);
      }
    };

    if (username) fetchSeller();
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1419] flex items-center justify-center">
        <p className="text-gray-400 text-lg">Loading seller profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f1419] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">{error}</p>
          <Link to="/cards" className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-xl font-bold">
            Browse Cards
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1419] text-white">
      <div className="max-w-7xl mx-auto p-6">

        {/* Seller Header */}
        <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-violet-600 flex items-center justify-center text-2xl font-bold text-white">
              {seller?.username?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black">{seller?.username}</h1>
                <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                  <span className="w-3 h-3 flex items-center justify-center text-[8px]">✓</span>
                  Verified Seller
                </span>
              </div>
              <p className="text-gray-400 text-sm mt-1">
                Member since {new Date(seller?.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="flex gap-6 mt-5 pt-5 border-t border-gray-800">
              <div>
                <p className="text-2xl font-black text-white">{stats.total_cards}</p>
                <p className="text-xs text-gray-500">Listed Cards</p>
              </div>
              <div>
                <p className="text-2xl font-black text-red-400">{stats.queued_cards}</p>
                <p className="text-xs text-gray-500">Upcoming Auctions</p>
              </div>
            </div>
          )}
        </div>

        {/* Back link */}
        <div className="mb-6">
          <Link to="/cards" className="text-sm text-gray-400 hover:text-white transition-colors">
            ← Back to Browse Cards
          </Link>
        </div>

        {/* Cards */}
        {cards.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-5xl block mb-4">🎴</span>
            <h2 className="text-xl font-bold mb-2">No cards listed</h2>
            <p className="text-gray-500">This seller hasn't listed any cards yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {cards.map((card) => (
              <SellerCardItem
                key={card.id}
                card={card}
                onClick={() => setSelectedCard(card)}
              />
            ))}
          </div>
        )}

        {/* Card Detail Modal */}
        {selectedCard && (
          <SellerCardDetailModal
            card={selectedCard}
            sellerName={seller?.username}
            onClose={() => setSelectedCard(null)}
          />
        )}
      </div>
    </div>
  );
}


// ── SELLER CARD ITEM ─────────────────────────────────────
function SellerCardItem({ card, onClick }) {
  const thumbnail = card.card_image_front || card.image_url;

  return (
    <div
      onClick={onClick}
      className="bg-[#1a1f2e] rounded-2xl border border-gray-800 hover:border-gray-700 transition-colors overflow-hidden cursor-pointer group"
    >
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

      <div className="p-4 space-y-2">
        <div>
          <h3 className="font-bold text-white truncate group-hover:text-violet-300 transition-colors">{card.name}</h3>
          <p className="text-gray-500 text-xs truncate">{card.grading || card.condition}</p>
        </div>
        <div className="pt-2 border-t border-gray-800">
          <p className="text-gray-500 text-xs">Starting bid</p>
          <p className="text-violet-400 font-black text-lg">${parseFloat(card.starting_bid).toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}


// ── SELLER CARD DETAIL MODAL ─────────────────────────────
function SellerCardDetailModal({ card, sellerName, onClose }) {
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
              <p className="text-sm text-violet-400 font-bold">${parseFloat(card.starting_bid).toFixed(2)}</p>
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


export default SellerProfilePage;

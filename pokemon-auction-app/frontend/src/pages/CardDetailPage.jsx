import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { cardService } from '../services/cardService';

function CardDetailPage() {
  const { cardId } = useParams();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCard = async () => {
      try {
        const data = await cardService.getCardById(cardId);
        setCard(data);
      } catch (error) {
        console.error('Error fetching card:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCard();
  }, [cardId]);

  if (loading) {
    return <div className="loading">Loading card...</div>;
  }

  if (!card) {
    return <div className="error">Card not found</div>;
  }

  return (
    <div className="card-detail-page">
      <div className="card-detail-container card">
        <div className="card-image-section">
          <img src={card.imageUrl} alt={card.name} />
        </div>

        <div className="card-info-section">
          <h1>{card.name}</h1>
          
          <div className="card-details">
            <div className="detail-row">
              <strong>Set:</strong>
              <span>{card.set}</span>
            </div>
            <div className="detail-row">
              <strong>Rarity:</strong>
              <span>{card.rarity}</span>
            </div>
            <div className="detail-row">
              <strong>Condition:</strong>
              <span>{card.condition}</span>
            </div>
            {card.grading && (
              <div className="detail-row">
                <strong>Grading:</strong>
                <span>{card.grading}</span>
              </div>
            )}
            <div className="detail-row">
              <strong>Starting Bid:</strong>
              <span className="price">${card.startingBid}</span>
            </div>
          </div>

          {card.description && (
            <div className="card-description">
              <h3>Description</h3>
              <p>{card.description}</p>
            </div>
          )}

          <div className="card-seller">
            <h3>Seller Information</h3>
            <p>Seller: {card.sellerName}</p>
            <p>Rating: ⭐ {card.sellerRating || 'New seller'}</p>
          </div>

          <button className="btn btn-primary">Watch Livestream</button>
        </div>
      </div>
    </div>
  );
}

export default CardDetailPage;

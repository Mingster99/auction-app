import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { streamService } from '../services/streamService';
import { cardService } from '../services/cardService';

function HomePage() {
  const [activeStreams, setActiveStreams] = useState([]);
  const [featuredCards, setFeaturedCards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [streams, cards] = await Promise.all([
          streamService.getActiveStreams(),
          cardService.getAllCards({ limit: 8 })
        ]);
        setActiveStreams(streams);
        setFeaturedCards(cards);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="home-page">
      <section className="hero">
        <h1>Welcome to Pokémon Card Auctions</h1>
        <p>Buy and sell Pokémon cards through live, interactive auctions</p>
        <Link to="/signup" className="btn btn-primary">Get Started</Link>
      </section>

      <section className="active-streams">
        <h2>🔴 Live Auctions</h2>
        {activeStreams.length > 0 ? (
          <div className="stream-grid">
            {activeStreams.map(stream => (
              <Link key={stream.id} to={`/livestream/${stream.id}`} className="stream-card card">
                <div className="stream-thumbnail">
                  <span className="live-badge">LIVE</span>
                </div>
                <h3>{stream.title}</h3>
                <p>Viewers: {stream.viewerCount}</p>
                <p>Host: {stream.hostName}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p>No live auctions at the moment. Check back soon!</p>
        )}
      </section>

      <section className="featured-cards">
        <h2>Featured Cards</h2>
        <div className="card-grid">
          {featuredCards.map(card => (
            <Link key={card.id} to={`/card/${card.id}`} className="card-item card">
              <img src={card.imageUrl} alt={card.name} />
              <h3>{card.name}</h3>
              <p>{card.set} • {card.rarity}</p>
              <p className="price">Starting bid: ${card.startingBid}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

export default HomePage;

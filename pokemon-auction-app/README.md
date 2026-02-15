# 🎴 Pokémon Card Livestream Auction App

A real-time livestream auction platform for buying and selling Pokémon cards.

## 🚀 Quick Start

### Prerequisites
- Node.js v20+ and npm
- PostgreSQL database
- Git

### Installation

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd pokemon-auction-app
```

2. **Install dependencies**
```bash
# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

3. **Set up environment variables**
```bash
# Copy example env files
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env

# Edit the .env files with your actual values
```

4. **Run the application**
```bash
# Terminal 1 - Start backend
cd backend
npm run dev

# Terminal 2 - Start frontend
cd frontend
npm start
```

Frontend: http://localhost:3000
Backend: http://localhost:5000

## 📁 Project Structure

```
pokemon-auction-app/
├── frontend/          # React web application
├── backend/           # Node.js API server
├── shared/            # Shared code between frontend & backend
└── README.md
```

## 🛠️ Tech Stack

**Frontend:**
- React 18
- React Router (navigation)
- Tailwind CSS (styling)
- Socket.IO Client (real-time updates)
- Axios (API calls)

**Backend:**
- Node.js + Express
- PostgreSQL (database)
- Socket.IO (WebSockets)
- JWT (authentication)

## 📋 Features Roadmap

- [ ] User authentication (signup/login)
- [ ] User profiles
- [ ] Card listing management
- [ ] Livestream viewing
- [ ] Real-time bidding
- [ ] Chat functionality
- [ ] Payment processing (Stripe)
- [ ] Escrow system
- [ ] Shipping integration

## 🤝 Contributing

This is a learning project. Feel free to experiment and break things!

## 📝 License

MIT

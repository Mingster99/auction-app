# 🚀 Quick Setup Instructions

## Step 1: Install Dependencies

### Frontend
```bash
cd frontend
npm install
```

### Backend
```bash
cd backend
npm install
```

## Step 2: Set Up Environment Variables

### Frontend
```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env` and add:
```
REACT_APP_API_URL=http://localhost:5000
REACT_APP_WS_URL=http://localhost:5000
```

### Backend
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and add:
```
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://username:password@localhost:5432/pokemon_auction
JWT_SECRET=your-super-secret-key-change-this
FRONTEND_URL=http://localhost:3000
```

## Step 3: Set Up PostgreSQL Database

### Install PostgreSQL
- **Mac:** `brew install postgresql`
- **Windows:** Download from https://www.postgresql.org/download/
- **Linux:** `sudo apt-get install postgresql`

### Create Database
```bash
# Start PostgreSQL service
# Mac: brew services start postgresql
# Windows: Use pgAdmin or Services
# Linux: sudo service postgresql start

# Create database
psql postgres
CREATE DATABASE pokemon_auction;
\q
```

### Run Migrations
```bash
cd backend
psql -d pokemon_auction -f src/database/migrations/001_initial_schema.sql
```

## Step 4: Run the Application

### Terminal 1 - Backend
```bash
cd backend
npm run dev
```
Server runs on: http://localhost:5000

### Terminal 2 - Frontend
```bash
cd frontend
npm start
```
Frontend runs on: http://localhost:3000

## Step 5: Test It Works

1. Open http://localhost:3000 in your browser
2. You should see the homepage
3. Try signing up with a test account
4. Check backend terminal for logs

## 🎉 You're Done!

The skeleton is ready. Now you can start building features!

---

## Common Issues

**"npm: command not found"**
- Install Node.js from https://nodejs.org/

**"ECONNREFUSED localhost:5432"**
- PostgreSQL is not running. Start it with your OS's service manager

**"JWT_SECRET is not defined"**
- You forgot to create the .env file or didn't add JWT_SECRET

**Port already in use**
- Change the PORT in .env file to something else (e.g., 5001)

---

## Next Steps

After setup works, you can:
1. Add real card data to the database
2. Implement card CRUD operations
3. Add livestream integration (Daily.co)
4. Build the bidding system
5. Add Stripe payments

Check the Getting Started Guide for detailed development workflow!

# 🎨 UI Redesign Setup Guide

Complete guide to install Tailwind and apply the new modern UI.

---

## Step 1: Install Tailwind CSS (5 minutes)

Open terminal in Cursor, navigate to your frontend folder:

```bash
cd frontend
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

This creates two files automatically:
- `tailwind.config.js`
- `postcss.config.js`

---

## Step 2: Replace Files

Copy each file from this folder to your project.
Here's exactly where each file goes:

| File (this folder) | Goes to (your project) |
|--------------------|----------------------|
| `tailwind.config.js` | `frontend/tailwind.config.js` (REPLACE) |
| `index.css` | `frontend/src/styles/index.css` (REPLACE) |
| `App.jsx` | `frontend/src/App.jsx` (REPLACE) |
| `Navbar.jsx` | `frontend/src/components/common/Navbar.jsx` (REPLACE) |
| `HomePage.jsx` | `frontend/src/pages/HomePage.jsx` (REPLACE) |
| `LoginPage.jsx` | `frontend/src/pages/LoginPage.jsx` (REPLACE) |
| `ListCardPage.jsx` | `frontend/src/pages/ListCardPage.jsx` (NEW FILE - create this) |

---

## Step 3: Create ListCardPage

This is a NEW file. Create it at:
```
frontend/src/pages/ListCardPage.jsx
```

Copy the content from `ListCardPage.jsx` in this folder.

---

## Step 4: Update Backend Cards Endpoint

The homepage now fetches real cards. Update your backend:

**File:** `backend/src/modules/cards/cards.routes.js`

Replace the placeholder with:

```javascript
const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const authMiddleware = require('../../middleware/auth.middleware');

// Get all cards
router.get('/', async (req, res, next) => {
  try {
    const limit = req.query.limit || 8;
    const result = await pool.query(
      `SELECT c.*, u.username as seller_name
       FROM cards c
       JOIN users u ON c.seller_id = u.id
       WHERE c.status = 'active'
       ORDER BY c.created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get card by ID
router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.username as seller_name
       FROM cards c
       JOIN users u ON c.seller_id = u.id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Card not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Create a card (protected - must be logged in)
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { name, set, rarity, condition, grading, description, imageUrl, startingBid } = req.body;

    if (!name || !startingBid) {
      return res.status(400).json({ message: 'Name and starting bid required' });
    }

    const result = await pool.query(
      `INSERT INTO cards (seller_id, name, set, rarity, condition, grading, description, image_url, starting_bid, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
       RETURNING *`,
      [req.user.id, name, set, rarity, condition, grading, description, imageUrl, startingBid]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
```

---

## Step 5: Restart Your App

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
cd frontend
npm start
```

---

## Step 6: Test It

1. Go to http://localhost:3000 → See new dark homepage
2. Go to http://localhost:3000/login → See new login page
3. Login → Click "+ List Card" in navbar → See listing form
4. Fill in form → Submit → Card appears on homepage!

---

## What Each File Does

### HomePage.jsx
- Hero banner with gradient text
- Live streams grid (shows active streams)
- Featured cards grid (shows listed cards)
- How It Works section
- Call to action banner

### LoginPage.jsx
- Dark themed login form
- Password show/hide toggle
- Loading spinner on submit
- Error message display
- Link to signup

### ListCardPage.jsx
- 2-step form (Details → Pricing)
- Card condition selector (visual buttons)
- Image upload with preview
- Pricing tips
- Sends data to backend API

### Navbar.jsx
- Sticky top navigation
- Logo with gradient text
- Desktop and mobile responsive
- User dropdown menu when logged in
- "Go Live" and "+ List Card" buttons

### tailwind.config.js
- Tells Tailwind where to look for classes
- Custom colors (primary purple)
- Custom animations

### index.css
- Imports Tailwind
- Dark scrollbar styles
- Reusable component classes

---

## How React Works (Quick Reference)

```jsx
// STATE - variables React watches
const [cards, setCards] = useState([]);
//      ↑               ↑         ↑
//  current value    setter    starting value

// When setCards([...]) is called, React re-renders the component

// EFFECT - run code after page loads
useEffect(() => {
  fetchCards(); // This runs once when page loads
}, []); // Empty [] = run once only

// JSX - HTML inside JavaScript
return (
  <div className="bg-gray-900"> {/* className not class */}
    <h1>{cards.length} cards</h1> {/* {} for JS values */}
    {cards.map(card => (          {/* .map() to render lists */}
      <div key={card.id}>{card.name}</div>
    ))}
    {cards.length === 0 && <p>No cards</p>} {/* Conditional render */}
  </div>
);
```

---

## Common Tailwind Classes Used

| Class | What it does |
|-------|-------------|
| `bg-gray-950` | Very dark background |
| `text-white` | White text |
| `text-gray-400` | Muted gray text |
| `rounded-2xl` | Rounded corners |
| `p-6` | Padding 24px all sides |
| `px-6 py-3` | Padding x:24px y:12px |
| `flex items-center` | Flexbox, vertically centred |
| `grid grid-cols-3` | 3 column grid |
| `gap-6` | 24px gap between grid items |
| `hover:bg-violet-500` | Changes bg on hover |
| `transition-all` | Smooth transitions |
| `animate-pulse` | Pulsing animation |
| `border border-gray-800` | Subtle dark border |
| `max-w-7xl mx-auto` | Centered, max width container |
| `hidden md:flex` | Hidden on mobile, flex on desktop |

---

## Troubleshooting

### "Tailwind classes not working"
Make sure you ran:
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```
And that `index.css` has the three `@tailwind` lines at the top.

### "Cannot find module ListCardPage"
Make sure you created the file at exactly:
`frontend/src/pages/ListCardPage.jsx`

### "Card listing not saving"
Make sure you updated `backend/src/modules/cards/cards.routes.js`
and restarted the backend with `npm run dev`.

### "Homepage still shows old design"
Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

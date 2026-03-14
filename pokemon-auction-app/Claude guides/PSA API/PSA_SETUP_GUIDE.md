# PSA Card Scanner — Setup Guide

## Files Delivered

| File | Place at | Action |
|------|----------|--------|
| `003_add_psa_fields.sql` | `backend/src/database/migrations/003_add_psa_fields.sql` | NEW — run this migration |
| `psaService.js` | `backend/src/services/psaService.js` | NEW |
| `psa.routes.js` | `backend/src/modules/cards/psa.routes.js` | NEW |
| `PSAImportPage.jsx` | `frontend/src/pages/PSAImportPage.jsx` | NEW |

## Step 1: Get PSA API Access

1. Go to https://www.psacard.com/publicapi
2. Sign in or register (free PSA account)
3. Generate an access token from the documentation page
4. Add to `backend/.env`:

```env
PSA_API_TOKEN=your_bearer_token_here
```

## Step 2: Install Dependencies

### Backend
```bash
cd backend
npm install axios
# multer is already installed in your package.json
```

### Frontend
```bash
cd frontend
npm install html5-qrcode
```

## Step 3: Run Database Migration

```bash
psql -d pokemon_auction -f backend/src/database/migrations/003_add_psa_fields.sql
```

## Step 4: Place Files

Copy the 4 delivered files to their locations listed in the table above.

## Step 5: Register the Routes

Edit `backend/src/app.js` — add the PSA routes alongside your existing card routes:

```javascript
const psaRoutes = require('./modules/cards/psa.routes');

// Add this alongside your existing route registrations:
app.use('/api/cards', psaRoutes);
```

**IMPORTANT:** Make sure the PSA routes are registered BEFORE the generic cards routes, because `/api/cards/psa-lookup` and `/api/cards/inventory` need to match before `/api/cards/:id` catches them as a param.

## Step 6: Serve Uploaded Images

Add static file serving for uploads in `backend/src/app.js`:

```javascript
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
```

## Step 7: Add Frontend Route

Edit `frontend/src/App.jsx` — add the PSA import page:

```jsx
import PSAImportPage from './pages/PSAImportPage';

// Inside <Routes>:
<Route path="/psa-import" element={<PSAImportPage />} />
```

## Step 8: Add Navigation Link

In your `Navbar.jsx`, add a link to the PSA import page. You could add it next to "+ List Card":

```jsx
<Link to="/psa-import" className="...your existing button classes...">
  📱 Scan PSA
</Link>
```

## Step 9: Test

1. Restart both servers
2. Go to http://localhost:3000/psa-import
3. Enter a known PSA cert number (e.g. `79721014`)
4. You should see the card data preview
5. Click "Add to My Cards"
6. Check your inventory

## How It Works

### User Flow
1. Seller navigates to `/psa-import`
2. Scans QR code (opens camera) or types cert number manually
3. Frontend calls `POST /api/cards/psa-lookup` with the cert number
4. Backend calls PSA API, gets card data, attempts to find images
5. Frontend shows confirmation screen with card details
6. Seller clicks "Add to My Cards"
7. Frontend calls `POST /api/cards/psa-import`
8. Backend saves card to database with PSA data
9. If no images: seller is prompted to upload their own photos

### Image Priority
1. **PSA API images** — checked first (only available for cards graded after Oct 2021)
2. **PSA cert page scrape** — fallback, scrapes psacard.com/cert/{certNumber}
3. **User upload** — last resort, seller uploads their own slab photos

### Duplicate Prevention
- Before lookup: checks if cert number already exists for this user
- Before import: checks again (race condition protection)
- `psa_cert_number` column has a UNIQUE constraint in the database

## Notes

- PSA API requires authentication (bearer token from your PSA account)
- QR scanning requires HTTPS or localhost (browser security requirement)
- Images from PSA are only available for cards graded after October 2021
- The adapter pattern in `psaService.js` makes it easy to adjust field mappings if PSA changes their API

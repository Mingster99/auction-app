const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../../config/database');
const authMiddleware = require('../../middleware/auth.middleware');
const psaService = require('../../services/psaService');

// ============================================================
// PSA CARD ROUTES
// ============================================================
// POST /api/cards/psa-lookup      — Look up cert (preview, no save)
// POST /api/cards/psa-import      — Import cert to user's inventory
// POST /api/cards/:id/upload-images — Upload front/back slab photos
// GET  /api/cards/inventory        — Get user's card inventory
// ============================================================

// ── Multer config for image uploads ──────────────────────
const uploadsDir = path.join(__dirname, '..', '..', '..', 'uploads', 'cards');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `card_${req.params.id || 'new'}_${file.fieldname}_${Date.now()}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});


// ── PSA LOOKUP (preview only, doesn't save) ──────────────
// POST /api/cards/psa-lookup
// Body: { certNumber: "12345678" }
// Returns PSA data for confirmation screen before import
router.post('/psa-lookup', authMiddleware, async (req, res, next) => {
  try {
    const { certNumber } = req.body;

    if (!certNumber) {
      return res.status(400).json({ message: 'Cert number is required' });
    }

    console.log('🔍 Looking up PSA cert:', certNumber);

    // Check if this cert is already in user's inventory
    const existing = await pool.query(
      'SELECT id, name, psa_grade FROM cards WHERE psa_cert_number = $1 AND seller_id = $2',
      [String(certNumber), req.user.id]
    );

    if (existing.rows.length > 0) {
      return res.json({
        alreadyImported: true,
        card: existing.rows[0],
        message: 'This card is already in your inventory',
      });
    }

    // Call PSA API
    const psaData = await psaService.lookupCert(certNumber);

    if (!psaData) {
      return res.status(404).json({
        message: 'No card found for this cert number',
      });
    }

    // If PSA API didn't return images, try scraping the cert page
    if (!psaData.hasImages) {
      console.log('📸 No API images, attempting cert page scrape...');
      const scraped = await psaService.scrapeCertImages(certNumber);
      if (scraped.frontImage) {
        psaData.frontImage = scraped.frontImage;
        psaData.backImage = scraped.backImage;
        psaData.hasImages = true;
        psaData.imageSource = 'psa_scrape';
      }
    }

    console.log('✅ PSA lookup successful:', psaData.description);

    res.json({
      alreadyImported: false,
      psaData,
      needsImageUpload: !psaData.hasImages,
    });
  } catch (error) {
    console.error('❌ PSA lookup error:', error.message);

    if (error.message.includes('Invalid cert')) {
      return res.status(400).json({ message: error.message });
    }
    if (error.message.includes('authentication')) {
      return res.status(503).json({ message: 'PSA service temporarily unavailable' });
    }
    if (error.message.includes('rate limit')) {
      return res.status(429).json({ message: error.message });
    }

    next(error);
  }
});


// ── PSA IMPORT (save to inventory) ───────────────────────
// POST /api/cards/psa-import
// Body: { certNumber, startingBid?, overrides? }
// Saves the PSA card to user's cards table
router.post('/psa-import', authMiddleware, async (req, res, next) => {
  try {
    const { certNumber, startingBid, overrides } = req.body;

    if (!certNumber) {
      return res.status(400).json({ message: 'Cert number is required' });
    }

    // Check for duplicate
    const existing = await pool.query(
      'SELECT * FROM cards WHERE psa_cert_number = $1 AND seller_id = $2',
      [String(certNumber), req.user.id]
    );

    if (existing.rows.length > 0) {
      return res.json({
        message: 'Card already in your inventory',
        card: existing.rows[0],
        isDuplicate: true,
      });
    }

    // Fetch PSA data
    const psaData = await psaService.lookupCert(certNumber);
    if (!psaData) {
      return res.status(404).json({ message: 'No card found for this cert number' });
    }

    // Try scraping images if API didn't provide them
    if (!psaData.hasImages) {
      const scraped = await psaService.scrapeCertImages(certNumber);
      if (scraped.frontImage) {
        psaData.frontImage = scraped.frontImage;
        psaData.backImage = scraped.backImage;
        psaData.imageSource = 'psa_scrape';
      }
    }

    // Build card name from PSA data
    const cardName = overrides?.name
      || `${psaData.subject || 'Unknown Card'} ${psaData.cardNumber ? '#' + psaData.cardNumber : ''}`.trim();

    // Map PSA grade to our condition field
    const gradeNum = parseFloat(psaData.grade);
    let condition = 'Raw';
    if (gradeNum >= 9) condition = 'Mint';
    else if (gradeNum >= 7) condition = 'Near Mint';
    else if (gradeNum >= 5) condition = 'Excellent';
    else if (gradeNum >= 3) condition = 'Good';
    else if (gradeNum >= 1) condition = 'Poor';

    // Insert into cards table
    const result = await pool.query(
      `INSERT INTO cards (
        seller_id, name, set, rarity, condition, grading, description,
        image_url, starting_bid, status,
        psa_cert_number, psa_grade, psa_year, psa_brand, psa_category,
        psa_subject, psa_card_number, psa_variety, psa_label_type,
        is_psa_verified, card_image_front, card_image_back, image_source
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19,
        $20, $21, $22, $23
      ) RETURNING *`,
      [
        req.user.id,                                    // seller_id
        cardName,                                       // name
        overrides?.set || psaData.variety || null,       // set
        overrides?.rarity || null,                       // rarity
        condition,                                      // condition
        `PSA ${psaData.grade}`,                         // grading
        psaData.description,                            // description
        psaData.frontImage || null,                     // image_url (thumbnail)
        startingBid || 0,                               // starting_bid
        'pending',                                      // status
        psaData.certNumber,                             // psa_cert_number
        psaData.grade,                                  // psa_grade
        psaData.year,                                   // psa_year
        psaData.brand,                                  // psa_brand
        psaData.category,                               // psa_category
        psaData.subject,                                // psa_subject
        psaData.cardNumber,                             // psa_card_number
        psaData.variety,                                // psa_variety
        psaData.labelType,                              // psa_label_type
        true,                                           // is_psa_verified
        psaData.frontImage || null,                     // card_image_front
        psaData.backImage || null,                      // card_image_back
        psaData.imageSource || null,                    // image_source
      ]
    );

    console.log('✅ PSA card imported:', result.rows[0].id, cardName);

    res.status(201).json({
      message: 'Card imported successfully',
      card: result.rows[0],
      needsImageUpload: !psaData.hasImages,
    });
  } catch (error) {
    console.error('❌ PSA import error:', error.message);
    next(error);
  }
});


// ── UPLOAD IMAGES (fallback for cards without PSA images) ─
// POST /api/cards/:id/upload-images
// Multipart form: front (file), back (file)
router.post(
  '/:id/upload-images',
  authMiddleware,
  upload.fields([
    { name: 'front', maxCount: 1 },
    { name: 'back', maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const cardId = req.params.id;

      // Verify card belongs to user
      const card = await pool.query(
        'SELECT id FROM cards WHERE id = $1 AND seller_id = $2',
        [cardId, req.user.id]
      );

      if (card.rows.length === 0) {
        return res.status(404).json({ message: 'Card not found or not yours' });
      }

      const frontFile = req.files?.front?.[0];
      const backFile = req.files?.back?.[0];

      if (!frontFile && !backFile) {
        return res.status(400).json({ message: 'At least one image is required' });
      }

      // Build file URLs (relative to uploads directory)
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const frontUrl = frontFile ? `${baseUrl}/uploads/cards/${frontFile.filename}` : null;
      const backUrl = backFile ? `${baseUrl}/uploads/cards/${backFile.filename}` : null;

      // Update card with image URLs
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (frontUrl) {
        updates.push(`card_image_front = $${paramIndex}`);
        values.push(frontUrl);
        paramIndex++;
        updates.push(`image_url = $${paramIndex}`);
        values.push(frontUrl);
        paramIndex++;
      }
      if (backUrl) {
        updates.push(`card_image_back = $${paramIndex}`);
        values.push(backUrl);
        paramIndex++;
      }
      updates.push(`image_source = $${paramIndex}`);
      values.push('user_upload');
      paramIndex++;

      values.push(cardId);

      const result = await pool.query(
        `UPDATE cards SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      console.log('📸 Images uploaded for card:', cardId);

      res.json({
        message: 'Images uploaded successfully',
        card: result.rows[0],
      });
    } catch (error) {
      console.error('❌ Image upload error:', error.message);
      next(error);
    }
  }
);


// ── USER'S CARD INVENTORY ────────────────────────────────
// GET /api/cards/inventory
// Returns all cards belonging to the logged-in user
router.get('/inventory', authMiddleware, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM cards
       WHERE seller_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});


module.exports = router;

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../../config/database');
const authMiddleware = require('../../middleware/auth.middleware');
const psaService = require('../../services/psaService');

// ── Multer config ────────────────────────────────────────
const uploadsDir = path.join(__dirname, '..', '..', '..', 'uploads', 'cards');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `card_${req.params.id || 'new'}_${file.fieldname}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});


// ── PSA LOOKUP (preview, no save) ────────────────────────
router.post('/psa-lookup', authMiddleware, async (req, res, next) => {
  try {
    const { certNumber } = req.body;
    if (!certNumber) {
      return res.status(400).json({ message: 'Cert number is required' });
    }

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

    const psaData = await psaService.lookupCert(certNumber);
    if (!psaData) {
      return res.status(404).json({ message: 'No card found for this cert number' });
    }

    res.json({
      alreadyImported: false,
      psaData,
      needsImageUpload: !psaData.hasImages,
    });
  } catch (error) {
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
router.post('/psa-import', authMiddleware, async (req, res, next) => {
  try {
    const { certNumber, startingBid, tcgGame, overrides, buyoutPrice, auctionDurationSeconds } = req.body;
    if (!certNumber) {
      return res.status(400).json({ message: 'Cert number is required' });
    }

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

    const psaData = await psaService.lookupCert(certNumber);
    if (!psaData) {
      return res.status(404).json({ message: 'No card found for this cert number' });
    }

    const cardName = overrides?.name
      || `${psaData.subject || 'Unknown Card'} ${psaData.cardNumber ? '#' + psaData.cardNumber : ''}`.trim();

    let condition = 'Graded';
    if (psaData.grade.includes('10')) condition = 'Gem Mint';
    else if (parseFloat(psaData.grade) >= 9) condition = 'Mint';
    else if (parseFloat(psaData.grade) >= 7) condition = 'Near Mint';
    else if (parseFloat(psaData.grade) >= 5) condition = 'Excellent';
    else if (parseFloat(psaData.grade) >= 3) condition = 'Good';
    else if (parseFloat(psaData.grade) >= 1) condition = 'Poor';

    // Use user-selected game, fall back to auto-detected
    const gameValue = tcgGame || psaData.detectedGame || 'other';

    const result = await pool.query(
      `INSERT INTO cards (
        seller_id, name, set, rarity, condition, grading, description,
        image_url, starting_bid, status,
        psa_cert_number, psa_grade, psa_grade_description,
        psa_year, psa_brand, psa_category,
        psa_subject, psa_card_number, psa_variety, psa_label_type,
        is_psa_verified, psa_population, psa_population_higher,
        card_image_front, card_image_back, image_source,
        tcg_game, buyout_price, auction_duration_seconds
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10,
        $11, $12, $13,
        $14, $15, $16,
        $17, $18, $19, $20,
        $21, $22, $23,
        $24, $25, $26,
        $27, $28, $29
      ) RETURNING *`,
      [
        req.user.id,
        cardName,
        overrides?.set || psaData.variety || null,
        overrides?.rarity || null,
        condition,
        psaData.gradeDescription || psaData.grade,
        psaData.description,
        psaData.frontImage || null,
        startingBid || 0,
        'pending',
        psaData.certNumber,
        psaData.grade,
        psaData.gradeDescription,
        psaData.year,
        psaData.brand,
        psaData.category,
        psaData.subject,
        psaData.cardNumber,
        psaData.variety,
        psaData.labelType,
        true,
        psaData.totalPopulation,
        psaData.populationHigher,
        psaData.frontImage || null,
        psaData.backImage || null,
        psaData.imageSource || null,
        gameValue,
        buyoutPrice || null,
        auctionDurationSeconds || 60,
      ]
    );

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


// ── UPLOAD IMAGES ────────────────────────────────────────
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

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const frontUrl = frontFile ? `${baseUrl}/uploads/cards/${frontFile.filename}` : null;
      const backUrl = backFile ? `${baseUrl}/uploads/cards/${backFile.filename}` : null;

      const updates = [];
      const values = [];
      let i = 1;

      if (frontUrl) {
        updates.push(`card_image_front = $${i}`, `image_url = $${i}`);
        values.push(frontUrl);
        i++;
      }
      if (backUrl) {
        updates.push(`card_image_back = $${i}`);
        values.push(backUrl);
        i++;
      }
      updates.push(`image_source = $${i}`);
      values.push('user_upload');
      i++;
      values.push(cardId);

      const result = await pool.query(
        `UPDATE cards SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
        values
      );

      res.json({ message: 'Images uploaded successfully', card: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
);


// ── USER INVENTORY ───────────────────────────────────────
router.get('/inventory', authMiddleware, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM cards WHERE seller_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});


module.exports = router;

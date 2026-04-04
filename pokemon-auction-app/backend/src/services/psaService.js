const axios = require('axios');

// ============================================================
// PSA SERVICE
// ============================================================
// Two endpoints:
//   1. GET /cert/GetByCertNumber/{certNumber}       → card data
//   2. GET /cert/GetImagesByCertNumber/{certNumber}  → slab images
//
// Also includes TCG game auto-detection from the Brand field.
// ============================================================

const PSA_API_BASE = 'https://api.psacard.com/publicapi';
const PSA_API_TOKEN = process.env.PSA_API_TOKEN;

const headers = {
  'Authorization': `bearer ${PSA_API_TOKEN}`,
  'Accept': 'application/json',
};

// ── TCG GAME DETECTION ───────────────────────────────────
// Maps keywords found in PSA's Brand field to game identifiers.
// Checked top-to-bottom — first match wins.
// Add new games here as you expand.
const GAME_KEYWORDS = [
  { game: 'pokemon',    keywords: ['pokemon', 'pokémon', 'nintendo', 'pikachu', 'charizard'] },
  { game: 'onepiece',   keywords: ['one piece', 'onepiece'] },
  { game: 'yugioh',     keywords: ['yu-gi-oh', 'yugioh', 'yu gi oh', 'konami'] },
  { game: 'mtg',        keywords: ['magic', 'mtg', 'wizards of the coast', 'gathering'] },
  { game: 'dbs',        keywords: ['dragon ball', 'dragonball', 'bandai dragon'] },
  { game: 'digimon',    keywords: ['digimon'] },
  { game: 'cardfight',  keywords: ['cardfight', 'vanguard'] },
  { game: 'weiss',      keywords: ['weiss schwarz', 'weiss'] },
  { game: 'lorcana',    keywords: ['lorcana', 'disney lorcana'] },
  { game: 'flesh',      keywords: ['flesh and blood', 'flesh & blood'] },
  { game: 'union',      keywords: ['union arena'] },
];

// Display names for the frontend
const GAME_LABELS = {
  pokemon:   'Pokémon',
  onepiece:  'One Piece',
  yugioh:    'Yu-Gi-Oh!',
  mtg:       'Magic: The Gathering',
  dbs:       'Dragon Ball Super',
  digimon:   'Digimon',
  cardfight: 'Cardfight!! Vanguard',
  weiss:     'Weiss Schwarz',
  lorcana:   'Disney Lorcana',
  flesh:     'Flesh and Blood',
  union:     'Union Arena',
  other:     'Other TCG',
};

function detectGame(brand, category) {
  if (!brand) return null;
  const lower = brand.toLowerCase();

  for (const entry of GAME_KEYWORDS) {
    for (const keyword of entry.keywords) {
      if (lower.includes(keyword)) {
        return entry.game;
      }
    }
  }

  return null; // No match — user will select manually
}


const psaService = {

  // Expose game labels so routes can send them to frontend
  GAME_LABELS,

  lookupCert: async (certNumber) => {
    const cleaned = String(certNumber).replace(/\D/g, '');
    if (!cleaned || cleaned.length < 5) {
      throw new Error('Invalid cert number format');
    }

    try {
      const [certResponse, images] = await Promise.all([
        axios.get(`${PSA_API_BASE}/cert/GetByCertNumber/${cleaned}`, {
          headers,
          timeout: 10000,
        }),
        psaService.fetchImages(cleaned),
      ]);

      const data = certResponse.data;

      if (!data) return null;
      if (data.IsValidRequest === false) {
        throw new Error(data.ServerMessage || 'Invalid request to PSA');
      }
      if (data.ServerMessage === 'No data found') {
        return null;
      }

      return psaService.adaptResponse(data, images);
    } catch (error) {
      if (error.message === 'Invalid cert number format') throw error;

      if (error.response) {
        const status = error.response.status;
        if (status === 401 || status === 500) {
          throw new Error('PSA API authentication failed — check your API token');
        }
        if (status === 204) return null;
        if (status === 429) {
          throw new Error('PSA API rate limit exceeded — please try again later');
        }
      }

      if (error.code === 'ECONNABORTED') {
        throw new Error('PSA API request timed out');
      }

      throw new Error(`PSA API error: ${error.message}`);
    }
  },

  fetchImages: async (certNumber) => {
    try {
      const response = await axios.get(
        `${PSA_API_BASE}/cert/GetImagesByCertNumber/${certNumber}`,
        { headers, timeout: 10000 }
      );
      return response.data;
    } catch (error) {
      console.log('⚠️ PSA images fetch failed (non-critical):', error.message);
      return null;
    }
  },

  adaptResponse: (raw, imageData) => {
    const cert = raw.PSACert || raw;

    const descriptionParts = [
      cert.Year,
      cert.Brand,
      cert.Subject,
      cert.CardNumber ? `#${cert.CardNumber}` : null,
      cert.Variety || null,
    ].filter(Boolean);

    // Extract images: [{ IsFrontImage: bool, ImageURL: string }]
    let frontImage = null;
    let backImage = null;

    if (Array.isArray(imageData)) {
      const front = imageData.find(i => i.IsFrontImage === true);
      const back = imageData.find(i => i.IsFrontImage === false);
      frontImage = front?.ImageURL || null;
      backImage = back?.ImageURL || null;
    }

    // Auto-detect TCG game from Brand field
    const detectedGame = detectGame(cert.Brand, cert.Category);

    return {
      certNumber: String(cert.CertNumber || ''),
      grade: String(cert.CardGrade || ''),
      gradeDescription: String(cert.GradeDescription || ''),
      year: String(cert.Year || ''),
      brand: String(cert.Brand || ''),
      category: String(cert.CardCategory || cert.Category || ''),
      subject: String(cert.Subject || ''),
      cardNumber: String(cert.CardNumber || ''),
      variety: String(cert.Variety || ''),
      labelType: String(cert.LabelType || ''),
      description: descriptionParts.join(' ') || 'PSA Graded Card',
      isDNA: Boolean(cert.IsPSADNA),
      isDualCert: Boolean(cert.IsDualCert),
      totalPopulation: cert.TotalPopulation || 0,
      totalPopulationWithQualifier: cert.TotalPopulationWithQualifier || 0,
      populationHigher: cert.PopulationHigher || 0,
      frontImage,
      backImage,
      hasImages: Boolean(frontImage || backImage),
      imageSource: frontImage ? 'psa_api' : null,
      // TCG game detection
      detectedGame,
      detectedGameLabel: detectedGame ? GAME_LABELS[detectedGame] : null,
      gameLabels: GAME_LABELS,
    };
  },
};

module.exports = psaService;

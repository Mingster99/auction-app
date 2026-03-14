const axios = require('axios');

// ============================================================
// PSA SERVICE
// ============================================================
// Handles all communication with the PSA public API.
// Uses an adapter pattern so field mappings are easy to adjust
// if the PSA API response shape changes.
//
// PSA API docs: https://www.psacard.com/publicapi/documentation
// Auth: OAuth 2 bearer token
// Endpoint: GET /publicapi/cert/GetByCertNumber/{certNumber}
//
// IMPORTANT: PSA only started adding images to their cert
// database in October 2021. Older cards won't have images.
// ============================================================

const PSA_API_BASE = 'https://api.psacard.com/publicapi';
const PSA_API_TOKEN = process.env.PSA_API_TOKEN;

const psaService = {

  /**
   * Look up a card by PSA certification number.
   * Returns normalized card data or null if not found.
   *
   * @param {string} certNumber - PSA cert number (numeric string)
   * @returns {object|null} Normalized card data
   */
  lookupCert: async (certNumber) => {
    // Validate cert number format
    const cleaned = String(certNumber).replace(/\D/g, '');
    if (!cleaned || cleaned.length < 5) {
      throw new Error('Invalid cert number format');
    }

    try {
      const response = await axios.get(
        `${PSA_API_BASE}/cert/GetByCertNumber/${cleaned}`,
        {
          headers: {
            'Authorization': `bearer ${PSA_API_TOKEN}`,
            'Accept': 'application/json',
          },
          timeout: 10000, // 10 second timeout
        }
      );

      const data = response.data;

      // Check if PSA returned a valid response
      if (!data) {
        return null;
      }

      // Handle PSA error responses
      if (data.IsValidRequest === false) {
        throw new Error(data.ServerMessage || 'Invalid request to PSA');
      }

      if (data.ServerMessage === 'No data found') {
        return null;
      }

      // Normalize the response through our adapter
      return psaService.adaptResponse(data);
    } catch (error) {
      // Re-throw our own errors
      if (error.message === 'Invalid cert number format') {
        throw error;
      }

      // Handle HTTP errors
      if (error.response) {
        const status = error.response.status;
        if (status === 401 || status === 500) {
          throw new Error('PSA API authentication failed — check your API token');
        }
        if (status === 204) {
          return null; // Empty/missing cert number
        }
        if (status === 429) {
          throw new Error('PSA API rate limit exceeded — please try again later');
        }
      }

      // Network/timeout errors
      if (error.code === 'ECONNABORTED') {
        throw new Error('PSA API request timed out');
      }

      throw new Error(`PSA API error: ${error.message}`);
    }
  },

  /**
   * ADAPTER — Maps raw PSA API response to our internal schema.
   *
   * The PSA API response contains a PSACert object with these known fields:
   *   CertNumber, CardGrade, Year, Brand, CardCategory, Subject,
   *   CardNumber, Variety, LabelType, IsDNACert, ImageURL (front/back)
   *
   * If the PSA API changes field names, update ONLY this function.
   *
   * @param {object} raw - Raw PSA API response
   * @returns {object} Normalized card data for our app
   */
  adaptResponse: (raw) => {
    // The PSA API may nest data under PSACert or return it flat
    // Handle both shapes for resilience
    const cert = raw.PSACert || raw;

    // Build a description from available fields
    const descriptionParts = [
      cert.Year,
      cert.Brand,
      cert.Subject,
      cert.CardNumber ? `#${cert.CardNumber}` : null,
      cert.Variety,
    ].filter(Boolean);

    // Extract images if available
    // PSA sometimes provides image URLs in different fields
    const frontImage = cert.ImageURL
      || cert.FrontImageURL
      || cert.CertImageFront
      || null;
    const backImage = cert.BackImageURL
      || cert.CertImageBack
      || null;

    return {
      certNumber: String(cert.CertNumber || ''),
      grade: String(cert.CardGrade || cert.Grade || ''),
      year: String(cert.Year || ''),
      brand: String(cert.Brand || ''),
      category: String(cert.CardCategory || cert.Category || ''),
      subject: String(cert.Subject || ''),
      cardNumber: String(cert.CardNumber || ''),
      variety: String(cert.Variety || ''),
      labelType: String(cert.LabelType || ''),
      description: descriptionParts.join(' ') || 'PSA Graded Card',
      isDNA: Boolean(cert.IsDNACert),
      frontImage,
      backImage,
      hasImages: Boolean(frontImage || backImage),
      imageSource: frontImage ? 'psa_api' : null,
      // Store raw response for debugging
      _raw: cert,
    };
  },

  /**
   * Attempt to scrape front/back images from PSA's cert page.
   * This is the fallback when the API doesn't return images.
   *
   * Scrapes: https://www.psacard.com/cert/{certNumber}
   *
   * NOTE: Only do this server-side. Respect rate limits.
   * PSA cards graded before Oct 2021 likely won't have images
   * on the cert page either.
   *
   * @param {string} certNumber
   * @returns {object} { frontImage, backImage } or nulls
   */
  scrapeCertImages: async (certNumber) => {
    try {
      const response = await axios.get(
        `https://www.psacard.com/cert/${certNumber}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; VaultiveAuctions/1.0)',
          },
          timeout: 10000,
        }
      );

      const html = response.data;

      // Look for image URLs in the cert page HTML
      // PSA uses various patterns for cert images
      let frontImage = null;
      let backImage = null;

      // Pattern 1: Look for cert image URLs in img tags
      const imgPattern = /https?:\/\/[^"'\s]+(?:cert|slab|card)[^"'\s]*\.(?:jpg|jpeg|png|webp)/gi;
      const matches = html.match(imgPattern);

      if (matches && matches.length > 0) {
        frontImage = matches[0];
        if (matches.length > 1) {
          backImage = matches[1];
        }
      }

      // Pattern 2: Look for data-src or src attributes with cert images
      if (!frontImage) {
        const srcPattern = /(?:data-src|src)=["'](https?:\/\/[^"']*(?:front|obverse|image)[^"']*)["']/gi;
        const srcMatches = [...html.matchAll(srcPattern)];
        if (srcMatches.length > 0) {
          frontImage = srcMatches[0][1];
        }
      }

      if (!backImage) {
        const backPattern = /(?:data-src|src)=["'](https?:\/\/[^"']*(?:back|reverse)[^"']*)["']/gi;
        const backMatches = [...html.matchAll(backPattern)];
        if (backMatches.length > 0) {
          backImage = backMatches[0][1];
        }
      }

      return {
        frontImage,
        backImage,
        imageSource: frontImage ? 'psa_scrape' : null,
      };
    } catch (error) {
      console.log('PSA cert page scrape failed (non-critical):', error.message);
      return {
        frontImage: null,
        backImage: null,
        imageSource: null,
      };
    }
  },
};

module.exports = psaService;

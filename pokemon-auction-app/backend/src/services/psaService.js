const axios = require('axios');

// ============================================================
// PSA SERVICE
// ============================================================
// Two endpoints:
//   1. GET /cert/GetByCertNumber/{certNumber}       → card data
//   2. GET /cert/GetImagesByCertNumber/{certNumber}  → slab images
//
// Image response shape (confirmed):
//   [{ IsFrontImage: boolean, ImageURL: string }, ...]
//
// Cert response shape (confirmed):
//   { PSACert: { CertNumber, CardGrade, Year, Brand, Category,
//     CardNumber, Subject, Variety, LabelType, GradeDescription,
//     TotalPopulation, PopulationHigher, IsPSADNA, IsDualCert } }
// ============================================================

const PSA_API_BASE = 'https://api.psacard.com/publicapi';
const PSA_API_TOKEN = process.env.PSA_API_TOKEN;

const headers = {
  'Authorization': `bearer ${PSA_API_TOKEN}`,
  'Accept': 'application/json',
};

const psaService = {

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

    // Build description
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
    };
  },
};

module.exports = psaService;
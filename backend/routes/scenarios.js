const express = require('express');
const axios = require('axios');
const router = express.Router();
const auth = require('../middleware/auth');

router.post('/simulate', auth, async (req, res) => {
  const baseUrl = process.env.PYTHON_ML_SERVICE_URL || 'http://ml-service:8000';
  const apiKey = process.env.ML_SERVICE_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Scenario service is not configured.' });
  try {
    const response = await axios.post(`${baseUrl}/simulate-scenario`, req.body, {
      headers: { 'X-ML-API-Key': apiKey },
      timeout: 15000,
      maxBodyLength: 64 * 1024,
      maxContentLength: 64 * 1024
    });
    return res.json(response.data);
  } catch (err) {
    if (err.response) return res.status(err.response.status).json({ error: err.response.data?.detail || 'Scenario request was rejected.' });
    if (err.code === 'ECONNABORTED') return res.status(504).json({ error: 'Scenario analysis timed out.' });
    console.error('Scenario service unavailable:', err.message);
    return res.status(503).json({ error: 'Scenario analysis is temporarily unavailable.' });
  }
});

module.exports = router;

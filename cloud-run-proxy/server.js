const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8080;

// Get backend host from environment variable
const BACKEND_HOST = process.env.BACKEND_HOST || 'api.example.com';
// CORS origin - can be configured via environment variable for production
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Enable JSON body parsing
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }
  next();
});

// Reverse proxy for /api/generate
app.all('/api/generate', async (req, res) => {
  try {
    console.log(`Proxying request to https://${BACKEND_HOST}/api/generate`);
    
    // Forward only safe headers to backend
    const safeHeaders = {
      'content-type': req.headers['content-type'],
      'authorization': req.headers['authorization'],
      'user-agent': req.headers['user-agent'] || 'bhashya-ai-proxy/1.0',
      'host': BACKEND_HOST,
    };
    
    const response = await axios({
      method: req.method,
      url: `https://${BACKEND_HOST}/api/generate`,
      data: req.body,
      headers: safeHeaders,
      params: req.query,
      validateStatus: () => true, // Accept any status code
    });

    // Forward response headers
    Object.keys(response.headers).forEach(key => {
      if (key !== 'content-encoding' && key !== 'transfer-encoding') {
        res.set(key, response.headers[key]);
      }
    });

    res.status(response.status).send(response.data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({
      error: 'Proxy error',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', backend: BACKEND_HOST });
});

app.listen(PORT, () => {
  console.log(`Reverse proxy server running on port ${PORT}`);
  console.log(`Proxying /api/generate to https://${BACKEND_HOST}/api/generate`);
});

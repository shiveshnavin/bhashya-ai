const functions = require('firebase-functions');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

try {
    require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (err) {
    console.warn('dotenv not loaded:', err && err.message);
}

const app = express();

// Parse JSON and urlencoded bodies so we can log and forward them
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

const proxyTarget = process.env.PROXY_TARGET || process.env.TARGET || 'http://192.168.1.17:8080';
console.log('apiGenerateProxy target:', proxyTarget);

app.use('/api/generate', createProxyMiddleware({
    target: proxyTarget,
    changeOrigin: true,
    pathRewrite: {
        '^/api/generate': '/api/generate',
    },
    onProxyReq(proxyReq, req, res) {
        try {
            console.log('Proxying request to:', proxyTarget);
            console.log('Incoming request:', {
                method: req.method,
                url: req.originalUrl,
                headers: req.headers
            });

            if (req.body && Object.keys(req.body).length) {
                const bodyData = JSON.stringify(req.body);
                console.log('Request body:', req.body);
                // If the proxy request is writable, write the body to it
                proxyReq.setHeader('Content-Type', 'application/json');
                proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                proxyReq.write(bodyData);
            }
        } catch (err) {
            console.warn('Error logging proxy request:', err && err.message);
        }
    },
    onError(err, req, res) {
        console.error('Proxy error:', err && err.message);
        if (!res.headersSent) {
            res.status(502).json({ error: 'Bad gateway - target unreachable', details: err && err.message });
        }
    },
    timeout: 10000,
    proxyTimeout: 10000,
}));

exports.apiGenerateProxy = functions.https.onRequest(app);
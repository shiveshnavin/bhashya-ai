const { onRequest } = require('firebase-functions/v2/https');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const admin = require('firebase-admin');
const { Service } = require('./service');

admin.initializeApp();
const db = admin.firestore();


const service = new Service(admin,
    process.env.HOST,
    process.env.PAYSERVICEACCESS_TOKEN,
    process.env.PAYSERVICE_URL,
    process.env.PAYSERVICE_WEBHOOK_SECRET
);

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


app.post('/webhook/generation/:id', (req, res, next) => {
    // recieves Generation document in req.body
    //  if success, deduct credits using calculateRequiredCredits
    // the original generation inputs are in `raw` field inside the Generation document

});


app.post('/webhook/add-credits/:secret', (req, res, next) => {
    // validate secret
    // then call service

});


app.post('/create-payment-link', (req, res, next) => {
    // accept email, name, either packId or credits, and stateObj in the body

});


app.get('/credits', (req, res, next) => {


});


app.get('/get-packs', (req, res, next) => {


});


// Mount the proxy at `/api` so any `/api/*` path (e.g. /api/generate/:id, /api/health)
// is forwarded to the target backend unchanged.
app.use('/api', createProxyMiddleware({
    target: proxyTarget,
    changeOrigin: true,
    // NOTE: Do not rewrite the path — forward the original `/api/...` path to the target.
    onProxyReq(proxyReq, req, res) {
        try {
            console.log('Proxying request to:', proxyTarget);
            console.log('Incoming request:', {
                method: req.method,
                url: req.originalUrl,
                headers: req.headers
            });

            let allowedUrls = ['/api/generate'];
            if (!allowedUrls.some(url => req.originalUrl.startsWith(url))) {
                console.warn('Blocked request to disallowed URL:', req.originalUrl);
                res.status(403).json({ error: 'Forbidden - URL not allowed' });
                return;
            }

            if (req.body && Object.keys(req.body).length) {
                const bodyData = JSON.stringify(req.body);
                // console.log('Request body:', req.body);
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

exports.apiGenerateProxy = onRequest(app);
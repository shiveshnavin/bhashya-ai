const { onRequest } = require('firebase-functions/v2/https');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const admin = require('firebase-admin');
const { Service } = require('./service');

admin.initializeApp();
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


app.post('/api/webhook/generation/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const payload = req.body || {};
        await service.processGenerationUpdate(id, payload);
        res.json({ ok: true });
    } catch (err) {
        console.error('webhook/generation error', err && err.message || err);
        res.status(500).json({ error: 'processing error' });
    }
});


app.post('/api/webhook/add-credits/:secret', async (req, res) => {
    try {
        const secret = req.params.secret;
        if (service.payserviceWebhookSecret && String(secret) !== String(service.payserviceWebhookSecret)) {
            return res.status(403).json({ error: 'Invalid webhook secret' });
        }
        const paymentObj = req.body || {};
        const email = paymentObj.email || (paymentObj.extra && paymentObj.extra.email) || null;
        let credits = Number(paymentObj.credits || paymentObj.credits_added || paymentObj.amount || 0);
        if (!credits || credits <= 0) credits = Number(paymentObj.amount || 0) || 0;
        if (!email) return res.status(400).json({ error: 'email required' });
        await service.addCredits(email, credits, paymentObj);
        res.json({ ok: true });
    } catch (err) {
        console.error('webhook/add-credits error', err && err.message || err);
        res.status(500).json({ error: 'processing error' });
    }
});


app.post('/api/create-payment-link', async (req, res) => {
    try {
        let originalHost = req.get('origin') || req.get('referer') || '';
        if (originalHost.endsWith('/')) originalHost = originalHost.slice(0, -1);
        const { email, name, packId, credits, stateObj } = req.body || {};
        if (!email) return res.status(400).json({ error: 'email required' });
        const result = await service.createPaymentLink(email, name || email?.split('@')[0], packId, credits, stateObj, originalHost);
        console.log('createPaymentLink result', result);
        res.json(result);
    } catch (err) {
        console.error('create-payment-link error', err && err.message || err);
        res.status(500).json({ error: 'failed' });
    }
});


app.post('/api/password-reset', async (req, res) => {
    try {
        let originalHost = req.get('origin') || req.get('referer') || '';
        if (originalHost.endsWith('/')) originalHost = originalHost.slice(0, -1);
        const { email } = req.body || {};
        if (!email) return res.status(400).json({ error: 'email required' });
        const result = await service.requestPasswordReset(email, originalHost);
        if (result && result.sent) return res.json({ ok: true });
        return res.status(500).json({ error: 'failed to send' });
    } catch (err) {
        console.error('password-reset error', err && err.message || err);
        res.status(500).json({ error: 'failed' });
    }
});

app.post('/api/password-reset/confirm', async (req, res) => {
    try {
        const { email, token, newPassword } = req.body || {};
        if (!email || !token || !newPassword) return res.status(400).json({ error: 'email, token and newPassword required' });
        const result = await service.confirmPasswordReset(email, token, newPassword);
        if (result && result.ok) return res.json({ ok: true });
        return res.status(400).json({ error: result && result.reason || 'invalid token' });
    } catch (err) {
        console.error('password-reset-confirm error', err && err.message || err);
        res.status(500).json({ error: 'failed' });
    }
});

app.get('/api/credits', async (req, res) => {
    try {
        const email = req.query.email;
        if (!email) return res.status(400).json({ error: 'email required' });
        const password = req.query.password || (req.body && req.body.password) || null;
        if (password) {
            const ok = await service.verifyPassword(email, password);
            if (!ok) return res.status(403).json({ error: 'invalid password' });
            const data = await service.getCredits(email);
            if (data && typeof data === 'object') {
                delete data.passwordHash;
                delete data.passwordSalt;
            }
            return res.json(data);
        } else {
            const data = await service.getCredits(email);
            const available = (data.credits || 0) - (data.held || 0);
            return res.json({ email, credits: available });
        }
    } catch (err) {
        console.error('get credits err', err && err.message || err);
        res.status(500).json({ error: 'failed' });
    }
});


app.get('/api/get-packs', async (req, res) => {
    try {
        const packs = await service.getPacks();
        res.json(packs);
    } catch (err) {
        console.error('get packs err', err && err.message || err);
        res.status(500).json({ error: 'failed' });
    }
});

app.get('/api/avatars', async (req, res) => {
    try {
        const avatars = await service.getAvatars();
        res.json(avatars);
    } catch (err) {
        console.error('get avatars err', err && err.message || err);
        res.status(500).json({ error: 'failed' });
    }
});


// Mount the proxy at `/api` so any `/api/*` path (e.g. /api/generate/:id, /api/health)
// is forwarded to the target backend unchanged.
app.post('/api/generate', async (req, res, next) => {
    try {
        const payload = req.body || {};
        const email = payload.delivery_email || payload.email;
        if (!email) return res.status(400).json({ error: 'delivery_email required' });

        // Require account password to prevent unauthorized holds
        const password = payload.delivery_password || payload.password;
        if (!password) return res.status(400).json({ error: 'password required' });
        const authOk = await service.verifyPassword(email, password);
        if (!authOk) return res.status(403).json({ error: 'invalid password' });

        // If the request contains payment return params (ORDERID/status), try to fetch payment and apply credits
        const orderId = payload.ORDERID || payload.ORDER_ID || payload.orderId || payload.paymentOrderId || payload.TXNID || payload.txnId || payload.txn_id;
        const payStatus = payload.status || payload.STATUS || payload.paymentStatus || payload.STATE || '';
        if (orderId && String(payStatus).toUpperCase().includes('TXN_SUCCESS')) {
            try {
                const payment = await service.getPaymentStatus(orderId);
                if (payment) {
                    console.log('Fetched payment for orderId', orderId, payment);
                    const creditsToAdd = await service.deduceCreditsFromPayment(payment);
                    if (creditsToAdd && creditsToAdd > 0) {
                        try { await service.addCredits(email, creditsToAdd, payment); } catch (e) { console.warn('addCredits during generate pre-check failed', e); }
                    }
                }
            } catch (e) {
                console.warn('payment pre-check failed', e);
            }
        }

        const check = await service.canGenerate(email, payload);
        if (!check.allowed) {
            const packs = await service.getPacks();
            return res.status(402).json({ error: 'Insufficient credits', requiredCredits: check.requiredCredits, availableCredits: check.availableCredits || 0, packs });
        }
        req._creditCheck = check;
        return next();
    } catch (err) {
        console.error('Error in /api/generate precheck', err && err.message || err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

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
                proxyReq.setHeader('Content-Type', 'application/json');
                proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                proxyReq.write(bodyData);
            }
        } catch (err) {
            console.warn('Error logging proxy request:', err && err.message);
        }
    },
    onProxyRes(proxyRes, req, res) {
        const chunks = [];
        proxyRes.on('data', chunk => chunks.push(chunk));
        proxyRes.on('end', async () => {
            try {
                const bodyStr = Buffer.concat(chunks).toString('utf8');
                let parsed = null;
                try { parsed = JSON.parse(bodyStr); } catch (e) { /* ignore non-json responses */ parsed = null; }

                // recursively search for an id-like field in the response body
                function findId(obj, depth = 0) {
                    if (!obj || typeof obj !== 'object' || depth > 4) return null;
                    const keys = ['id', '_id', 'documentId', 'document_id', 'orderId', 'ORDERID', 'name'];
                    for (const k of keys) {
                        if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k]) {
                            let val = obj[k];
                            if (k === 'name' && typeof val === 'string' && val.includes('/')) {
                                try { const parts = String(val).split('/'); val = parts[parts.length - 1]; } catch (e) { }
                            }
                            return String(val);
                        }
                    }
                    for (const k of Object.keys(obj)) {
                        try {
                            const v = obj[k];
                            if (v && typeof v === 'object') {
                                const f = findId(v, depth + 1);
                                if (f) return f;
                            }
                        } catch (e) { /* ignore nested errors */ }
                    }
                    return null;
                }

                const id = parsed ? findId(parsed) : null;

                // Always attempt to place a hold when the pre-check allowed generation (even if backend didn't return an id)
                if (req._creditCheck && req._creditCheck.allowed && !req._creditCheck.free) {
                    try {
                        await service.holdCredits(req.body.delivery_email || req.body.email, req._creditCheck.requiredCredits, id, req.body.delivery_password || req.body.password);
                    } catch (e) {
                        console.warn('holdCredits failed', e && e.message || e);
                    }
                }
            } catch (e) {
                console.warn('onProxyRes parse error', e && e.message || e);
            }
        });
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
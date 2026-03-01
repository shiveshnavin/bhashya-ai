const { FireStoreDB } = require('multi-db-orm')
const crypto = require('crypto')


const DISABLED_FREE_TIER = true; // set to true to disable free tier (for testing purposes)
class Service {

    db
    host
    payServiceAccessToken
    payserviceUrl
    payserviceWebhookSecret
    constructor(admin, host, payServiceAccessToken, payserviceUrl, payserviceWebhookSecret) {
        this.admin = admin
        this.db = new FireStoreDB(undefined, 'payments', admin)
        this.host = host
        this.payServiceAccessToken = payServiceAccessToken
        this.payserviceUrl = payserviceUrl
        this.payserviceWebhookSecret = payserviceWebhookSecret
    }

    _hashPassword(password) {
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
        return { salt, hash };
    }

    async verifyPassword(email, password) {
        if (!email) return false;
        const existing = await this.db.getOne(TABLE_CREDITS, {}, email);
        // if no existing doc and password provided, create new credits doc with password
        if (!existing) {
            if (!password) return false;
            const { salt, hash } = this._hashPassword(password);
            const doc = { email, credits: 0, held: 0, freeCount: 0, passwordHash: hash, passwordSalt: salt, updatedAt: Date.now() };
            try { await this.db.insert(TABLE_CREDITS, doc, email); } catch (e) { /* ignore */ }
            return true;
        }
        // if existing but no password set, set it
        if (!existing.passwordHash || !existing.passwordSalt) {
            if (!password) return false;
            const { salt, hash } = this._hashPassword(password);
            const newDoc = { ...existing, passwordHash: hash, passwordSalt: salt, updatedAt: Date.now() };
            try { await this.db.update(TABLE_CREDITS, {}, newDoc, email); } catch (e) { try { await this.db.insert(TABLE_CREDITS, newDoc, email); } catch (e2) { } }
            return true;
        }
        if (!password) return false;
        try {
            const derived = crypto.scryptSync(String(password), existing.passwordSalt, 64).toString('hex');
            return derived === existing.passwordHash;
        } catch (e) { return false; }
    }

    async requestPasswordReset(email, returnHost) {
        // generate reset token and send notification
        if (!email) throw new Error('email required');
        try {
            const token = crypto.randomBytes(24).toString('hex');
            const { salt: resetTokenSalt, hash: resetTokenHash } = this._hashPassword(token);
            const expires = Date.now() + 3600 * 1000; // 1 hour
            const existing = await this.db.getOne(TABLE_CREDITS, {}, email) || { credits: 0, held: 0, freeCount: 0 };
            const newDoc = { ...existing, resetTokenHash, resetTokenSalt, resetTokenExpires: expires, updatedAt: Date.now(), email };
            try {
                if (existing) await this.db.update(TABLE_CREDITS, {}, newDoc, email);
                else await this.db.insert(TABLE_CREDITS, newDoc, email);
            } catch (e) { console.warn('requestPasswordReset db write failed', e); }

            const host = (returnHost || this.host || '').replace(/\/$/, '');
            const resetUrl = `${host}/?reset=true&email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;

            const payload = {
                channel: {
                    id: 'bhashy-ai',
                    userId: 'bhashy-ai',
                    deviceId: 'mail',
                    platform: 'mail',
                    target: email
                },
                message: {
                    id: 'bhashy-ai',
                    refId: 'bhashy-ai',
                    mediaUrls: [],
                    type: 'text',
                    title: 'Password Reset Link',
                    text: `You requested a password reset for InReelio.\n\nClick Reset to reset your password.`,
                    level: 'info',
                    status: 'in_progress',
                    actions: [{ name: 'Reset', ctaUrl: resetUrl }]
                }
            };

            const notifyUrl = (process.env.NOTIFICATION_SERVICE_URL || '').replace(/\/$/, '') + '/api/v1/messaging/send-direct';
            const headers = { 'Content-Type': 'application/json' };
            if (process.env.NOTIFICATION_SERVICE_ACCESS_TOKEN) headers['Authorization'] = `Bearer ${process.env.NOTIFICATION_SERVICE_ACCESS_TOKEN}`;
            try {
                const resp = await fetch(notifyUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
                if (!resp.ok) {
                    console.warn('notification service responded with', resp.status);
                    return { sent: false, reason: 'notify_failed', status: resp.status };
                }
            } catch (e) {
                console.warn('notification send failed', e);
                return { sent: false, reason: 'notify_error' };
            }
            return { sent: true };
        } catch (e) { console.warn('requestPasswordReset error', e); throw e; }
    }

    async confirmPasswordReset(email, token, newPassword) {
        if (!email || !token || !newPassword) throw new Error('email, token and newPassword required');
        const existing = await this.db.getOne(TABLE_CREDITS, {}, email);
        if (!existing || !existing.resetTokenHash || !existing.resetTokenSalt || !existing.resetTokenExpires) return { ok: false, reason: 'no_token' };
        if (Date.now() > (existing.resetTokenExpires || 0)) return { ok: false, reason: 'expired' };
        try {
            const derived = crypto.scryptSync(String(token), existing.resetTokenSalt, 64).toString('hex');
            if (derived !== existing.resetTokenHash) return { ok: false, reason: 'invalid' };
            // set new password hash
            const { salt, hash } = this._hashPassword(newPassword);
            const newDoc = { ...existing, passwordHash: hash, passwordSalt: salt, updatedAt: Date.now() };
            try { delete newDoc.resetTokenHash; delete newDoc.resetTokenSalt; delete newDoc.resetTokenExpires; } catch (e) { }
            try { await this.db.update(TABLE_CREDITS, {}, newDoc, email); } catch (e) { try { await this.db.insert(TABLE_CREDITS, newDoc, email); } catch (e2) { } }
            return { ok: true };
        } catch (e) { console.warn('confirmPasswordReset error', e); return { ok: false, reason: 'error' }; }
    }

    async getPacks() {
        const now = Date.now();
        const ttl = 60 * 60 * 1000; // cache TTL 1 hour
        try {
            if (this._packsCache && (now - (this._packsCache.ts || 0)) < ttl) {
                return this._packsCache.packs;
            }
        } catch (e) { /* ignore cache read errors */ }

        let packs;
        try {
            packs = await this.db.get(TABLE_PACKAGES, {});
        } catch (e) {
            packs = [];
        }

        if (!Array.isArray(packs) || packs.length === 0) {
            const defaultPack = { id: 'credit_1', label: '1 Credit', credits: 1, amount: 10, currency: 'INR' };
            try {
                await this.db.insert(TABLE_PACKAGES, defaultPack, defaultPack.id);
            } catch (e) {
                // ignore insert errors (possible race if another instance inserted simultaneously)
            }
            packs = [defaultPack];
        }

        try {
            this._packsCache = { packs, ts: now };
        } catch (e) { /* ignore cache write errors */ }

        return packs;
    }

    async getAvatars() {
        const now = Date.now();
        const ttl = 60 * 60 * 1000; // cache TTL 1 hour
        try {
            if (this._avatarsCache && (now - (this._avatarsCache.ts || 0)) < ttl) {
                return this._avatarsCache.avatars;
            }
        } catch (e) { /* ignore cache read errors */ }

        try {
            const url = 'https://bhashya-ai-default-rtdb.firebaseio.com/avatars.json';
            const resp = await fetch(url, { method: 'GET' });
            if (!resp.ok) {
                console.warn('getAvatars fetch failed', resp.status);
                if (this._avatarsCache && this._avatarsCache.avatars) return this._avatarsCache.avatars;
                return [];
            }
            const data = await resp.json();
            let result = [];
            if (!data) result = [];
            else if (Array.isArray(data)) {
                result = data.filter(Boolean).map((v, idx) => (v && typeof v === 'object') ? ({ id: v.id || String(idx), ...v }) : ({ id: String(idx), value: v }));
            } else if (typeof data === 'object') {
                result = Object.entries(data).map(([k, v]) => (v && typeof v === 'object') ? ({ id: k, ...v }) : ({ id: k, value: v }));
            } else {
                result = [];
            }

            try { this._avatarsCache = { avatars: result, ts: now }; } catch (e) { /* ignore cache write errors */ }
            return result;
        } catch (e) {
            console.warn('getAvatars error', e);
            if (this._avatarsCache && this._avatarsCache.avatars) return this._avatarsCache.avatars;
            return [];
        }
    }

    // Fetch full payment status from configured payservice
    async getPaymentStatus(orderId) {
        if (!orderId) return null;
        if (!this.payserviceUrl) {
            console.warn('payserviceUrl not configured');
            return null;
        }
        try {
            const url = `${this.payserviceUrl.replace(/\/$/, '')}/pay/api/status?ORDER_ID=${encodeURIComponent(orderId)}`;
            const headers = { 'Content-Type': 'application/json' };
            if (this.payServiceAccessToken) headers['Authorization'] = `Bearer ${this.payServiceAccessToken}`;
            const resp = await fetch(url, { method: 'GET', headers });
            if (!resp.ok) {
                console.warn('getPaymentStatus fetch failed', resp.status);
                return null;
            }
            const data = await resp.json();
            const normalized = { ...(data || {}) };
            normalized.status = (data && (data.status || data.STATUS || data.STATUS_TEXT)) || '';
            normalized.id = data && (data.id || data.orderId || data.ORDERID || data.ORDER_ID || data.txnId || data.TXNID) || orderId;
            normalized.amount = Number(data && (data.amount || data.TXN_AMOUNT || data.AMOUNT || data.txn_amount)) || 0;
            normalized.product = data && (data.PRODUCT_NAME || data.product || data.pname || data.pname || data.pname) || (data && data.product_name) || '';
            if (data && data.payurl) normalized.paymentUrl = data.payurl;
            return normalized;
        } catch (e) {
            console.warn('getPaymentStatus error', e);
            return null;
        }
    }

    // Deduce how many credits a payment should add based on product/amount information
    async deduceCreditsFromPayment(paymentObj) {
        if (!paymentObj) return 0;
        // check product string first (expected formats: 'packId_20' or 'credits_20')
        const prod = String(paymentObj.product || paymentObj.PRODUCT_NAME || paymentObj.pname || '').trim();
        try {
            if (prod) {
                const m = prod.match(/^(.+?)_(\d+)$/);
                if (m) {
                    const left = m[1];
                    const right = Number(m[2]);
                    // left may be packId or the word 'credits'
                    if (/^credits$/i.test(left)) return right;
                    // treat left as packId
                    try {
                        const pack = await this.db.getOne(TABLE_PACKAGES, {}, left);
                        if (pack && typeof pack.credits !== 'undefined') return Number(pack.credits);
                    } catch (e) { /* ignore db lookup errors */ }
                    return right;
                }
                const m2 = prod.match(/^credits_(\d+)$/i);
                if (m2) return Number(m2[1]);
            }
        } catch (e) { /* ignore */ }

        // fallback: try numeric amount -> match a pack by amount
        const amt = Number(paymentObj.amount || paymentObj.TXN_AMOUNT || paymentObj.AMOUNT || 0) || 0;
        if (amt > 0) {
            try {
                const packs = await this.getPacks();
                const found = (packs || []).find(p => {
                    const pa = Number(p.amount || p.price || 0) || 0;
                    return pa > 0 && Math.abs(pa - amt) < 0.001;
                });
                if (found && typeof found.credits !== 'undefined') return Number(found.credits);
            } catch (e) { /* ignore */ }
            // final fallback: assume 1 price = 1 credit
            return Math.max(0, Math.round(amt));
        }

        return 0;
    }

    async createPaymentLink(email, name, packId, credits, stateObj, returnHost) {
        let amount = 0;
        let resolvedCredits = credits || 0;
        if (packId) {
            const pack = await this.db.getOne(TABLE_PACKAGES, {}, packId);
            if (!pack) throw new Error('pack not found');
            amount = pack.amount || pack.price || 0;
            resolvedCredits = pack.credits || resolvedCredits;
        } else if (resolvedCredits) {
            const pricePerCredit = 1; // fallback price
            amount = resolvedCredits * pricePerCredit;
        } else {
            throw new Error('packId or credits required');
        }

        const stateB64 = Buffer.from(JSON.stringify(stateObj || {})).toString('base64');
        const returnUrl = `${returnHost || ''}?state=${encodeURIComponent(stateB64)}`;
        const webhookUrl = `${this.host || ''}/api/webhook/add-credits/${this.payserviceWebhookSecret || ''}`;

        // Try using external payservice if configured
        if (this.payserviceUrl && this.payServiceAccessToken) {
            try {
                const body = {
                    NAME: name || '',
                    CLIENT_ID: 'inreelio-prod',
                    EMAIL: email,
                    TXN_AMOUNT: amount,
                    PRODUCT_NAME: packId ? `${packId}_${resolvedCredits}` : `credits_${resolvedCredits}`,
                    RETURN_URL: returnUrl,
                    WEBHOOK_URL: webhookUrl,
                    STATE: JSON.stringify(stateObj || {})
                };
                const resp = await fetch(`${this.payserviceUrl.replace(/\/$/, '')}/pay/api/createTxn`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.payServiceAccessToken}`
                    },
                    body: JSON.stringify(body)
                });
                const data = await resp.json();
                console.log('createPaymentLink external service response', data);
                // Normalize remote payservice response to expected shape
                const normalized = { ...(data || {}) };
                if (data) {
                    if (data.payurl) normalized.paymentUrl = data.payurl;
                    if (data.payUrl) normalized.paymentUrl = data.payUrl;
                    if (!normalized.paymentUrl && data.payment && (data.payment.url || data.payment.paymentUrl)) normalized.paymentUrl = data.payment.url || data.payment.paymentUrl;
                    if (data.id) normalized.paymentId = data.id;
                    if (data.orderId && !normalized.paymentId) normalized.paymentId = data.orderId;
                }
                if (normalized.paymentUrl && !normalized.payment) normalized.payment = { url: normalized.paymentUrl };
                return normalized;
            } catch (e) {
                console.warn('createPaymentLink external service error', e);
                // fallback to returning direct return url
                return { paymentUrl: `${returnUrl}&mock=true` };
            }
        }

        // Fallback: return direct return URL (useful for testing)
        return { paymentUrl: `${returnUrl}&mock=true` };
    }

    async getCredits(email) {
        if (!email) return null;
        const doc = await this.db.getOne(TABLE_CREDITS, {}, email);
        if (!doc) return { email, credits: 0, held: 0, freeCount: 0 };
        return { email, ...(doc || {}) };
    }


    /**
     * Recieves @Payment document in the param, validates it, and adds credits to the user's account accordingly. If the lastPaymentId in the user's credits document matches the incoming payment id, it should not add credits again to prevent duplicates.
     */
    async addCredits(email, credits, paymentObj) {
        if (!email || !credits) throw new Error('email and credits required');
        const existing = await this.db.getOne(TABLE_CREDITS, {}, email);
        const data = existing || { credits: 0, held: 0, lastPaymentId: null, freeCount: 0 };
        const incomingPaymentId = (paymentObj && (paymentObj.id || paymentObj.orderId || paymentObj.txnId || paymentObj.txn_id)) || null;
        if (incomingPaymentId && data.lastPaymentId === incomingPaymentId) {
            return { applied: false, reason: 'duplicate' };
        }
        const newCredits = (data.credits || 0) + Number(credits);
        const newDoc = { ...data, credits: newCredits, lastPaymentId: incomingPaymentId, updatedAt: Date.now() };
        if (existing) {
            await this.db.update(TABLE_CREDITS, {}, newDoc, email);
        } else {
            await this.db.insert(TABLE_CREDITS, newDoc, email);
        }
        return { applied: true, credits: newCredits };
    }

    async holdCredits(email, credits, generationId, password) {
        if (!email || !credits) throw new Error('email and credits required');
        // require password verification to prevent unauthorized holds
        const ok = await this.verifyPassword(email, password);
        if (!ok) throw new Error('invalid password');

        // If generationId provided and generation already has creditsHeld, avoid double-hold
        if (generationId) {
            try {
                const genExists = await this.db.getOne(TABLE_GENERATIONS, {}, generationId);
                if (genExists && (genExists.creditsHeld || genExists.creditsHeld === 0)) {
                    // already associated with a hold - no-op to avoid duplicating held credits
                    return;
                }
            } catch (e) { /* ignore lookup errors, proceed */ }
        }

        const existing = await this.db.getOne(TABLE_CREDITS, {}, email);
        const data = existing || { credits: 0, held: 0, freeCount: 0 };
        const available = (data.credits || 0) - (data.held || 0);
        if (available < credits) throw new Error('Insufficient credits to hold');
        const newHeld = (data.held || 0) + Number(credits);
        const newDoc = { ...data, held: newHeld, updatedAt: Date.now() };
        if (existing) {
            await this.db.update(TABLE_CREDITS, {}, newDoc, email);
        } else {
            await this.db.insert(TABLE_CREDITS, newDoc, email);
        }
        if (generationId) {
            const genDoc = { creditsHeld: Number(credits), creditsHeldBy: email, creditsHoldTimestamp: Date.now() };
            const genExists = await this.db.getOne(TABLE_GENERATIONS, {}, generationId);
            if (genExists) await this.db.update(TABLE_GENERATIONS, {}, genDoc, generationId);
            else await this.db.insert(TABLE_GENERATIONS, genDoc, generationId);
        }
    }

    // Attach hold metadata to a generation without modifying user's credits (useful when hold was placed earlier without generation id)
    async attachHoldToGeneration(generationId, credits, email) {
        if (!generationId) return;
        const genDoc = { creditsHeld: Number(credits) || 0, creditsHeldBy: email || null, creditsHoldTimestamp: Date.now() };
        const genExists = await this.db.getOne(TABLE_GENERATIONS, {}, generationId);
        if (genExists) await this.db.update(TABLE_GENERATIONS, {}, genDoc, generationId);
        else await this.db.insert(TABLE_GENERATIONS, genDoc, generationId);
    }

    async deductCredits(email, credits, generationId) {
        if (!email || !credits) throw new Error('email and credits required');
        const existing = await this.db.getOne(TABLE_CREDITS, {}, email);
        const data = existing || { credits: 0, held: 0 };
        const held = data.held || 0;
        const current = data.credits || 0;
        const toDeduct = Number(credits) || 0;
        const newHeld = Math.max(0, held - toDeduct);
        const newCredits = Math.max(0, current - toDeduct);
        const newDoc = { ...data, credits: newCredits, held: newHeld, updatedAt: Date.now() };
        if (existing) await this.db.update(TABLE_CREDITS, {}, newDoc, email);
        else await this.db.insert(TABLE_CREDITS, newDoc, email);
        if (generationId) {
            const genUpdate = { creditsDeducted: toDeduct, creditsFinalizedAt: Date.now() };
            const genExists = await this.db.getOne(TABLE_GENERATIONS, {}, generationId);
            if (genExists) await this.db.update(TABLE_GENERATIONS, {}, genUpdate, generationId);
            else await this.db.insert(TABLE_GENERATIONS, genUpdate, generationId);
        }
    }


    async canGenerate(email, generationInput) {

        const maxFreeGenerationsPerUser = 10;
        const required = this.calculateRequiredCredits(generationInput || {});

        let isFreeFormFactor = (Number(generationInput?.duration || 0) <= 1)
            && (String(generationInput?.resolution || '').toLowerCase() === '360p')
            && (String(generationInput?.graphics_quality || '').toLowerCase() === 'low')
            && (String(generationInput?.speech_quality || '').toLowerCase() === 'neural');

        isFreeFormFactor = isFreeFormFactor && DISABLED_FREE_TIER; // disable free tier for now

        const data = (await this.db.getOne(TABLE_CREDITS, {}, email)) || { credits: 0, held: 0, freeCount: 0 };
        const available = (data.credits || 0) - (data.held || 0);

        if (isFreeFormFactor) {
            const used = data.freeCount || 0;
            if (used < maxFreeGenerationsPerUser) {
                return { allowed: true, free: true, requiredCredits: 0 };
            }
        }

        if (available >= required) {
            return { allowed: true, free: false, requiredCredits: required, availableCredits: available };
        }

        return { allowed: false, requiredCredits: required, availableCredits: available };

    }

    calculateRequiredCredits(generationInput) {
        const input = generationInput || {};
        const duration = Math.max(1, Number(input.duration || 1));
        const basePerMinute = 40; // baseline cost per minute
        const resolutionMap = { '360p': 0.6, 'sd': 1, 'sd': 1, 'hd': 1.8 };
        const resKey = (String(input.resolution || '360p') || '360p').toLowerCase();
        const resFactor = resolutionMap[resKey] || 1;
        const graphicsFactor = (String(input.graphics_quality || 'low').toLowerCase() === 'high') ? 1.4 : 0.6;
        const speech = (String(input.speech_quality || 'low-ai').toLowerCase());
        const speechFactor = (speech === 'neural') ? 1.0 : (speech === 'high-ai' ? 1.6 : 0.6);
        const raw = basePerMinute * duration * resFactor * graphicsFactor * speechFactor;
        return Math.max(0, Math.ceil(raw));
    }


    getGenerations(email) {
        // get all generations for the user, excluding soft-deleted ones

    }

    deleteGeneration(email, generationId) {
        // soft delete by setting deletedAt timestamp

    }

    async processGenerationUpdate(generationId, updateObj) {
        const gen = (await this.db.getOne(TABLE_GENERATIONS, {}, generationId)) || (updateObj || {});

        // If already finalized, do nothing (idempotent)
        if (gen && gen.creditsFinalizedAt) {
            return { processed: false, reason: 'already_finalized' };
        }

        const raw = (gen && gen.raw) ? gen.raw : (updateObj && updateObj.raw) ? updateObj.raw : {};
        const email = (gen && gen.email) || raw.delivery_email || raw.email;
        const required = this.calculateRequiredCredits(raw || {});
        const status = (updateObj && updateObj.status) ? String(updateObj.status).toUpperCase() : (gen && gen.status ? String(gen.status).toUpperCase() : '');

        if (!email) {
            // cannot resolve email - persist the update and abort
            const exists = await this.db.getOne(TABLE_GENERATIONS, {}, generationId);
            if (exists) await this.db.update(TABLE_GENERATIONS, {}, updateObj || {}, generationId);
            else await this.db.insert(TABLE_GENERATIONS, updateObj || {}, generationId);
            return { processed: false, reason: 'no_email' };
        }

        if (status === 'SUCCESS' || status === 'PARTIAL_SUCCESS') {
            // Deduct permanently
            try {
                await this.deductCredits(email, required, generationId);
                const genUpdate = { creditsFinalizedAt: Date.now(), creditsDeducted: required };
                const exists = await this.db.getOne(TABLE_GENERATIONS, {}, generationId);
                if (exists) await this.db.update(TABLE_GENERATIONS, {}, genUpdate, generationId);
                else await this.db.insert(TABLE_GENERATIONS, genUpdate, generationId);
                return { processed: true, action: 'deducted', credits: required };
            } catch (e) {
                console.warn('deductCredits failed', e);
                throw e;
            }
        } else {
            // Release held credits (best-effort)
            const existingCred = await this.db.getOne(TABLE_CREDITS, {}, email);
            const data = existingCred || { credits: 0, held: 0 };
            const held = data.held || 0;
            const toRelease = Math.min(held, required);
            const newHeld = Math.max(0, held - toRelease);
            const newCredDoc = { ...data, held: newHeld, updatedAt: Date.now() };
            if (existingCred) await this.db.update(TABLE_CREDITS, {}, newCredDoc, email);
            else await this.db.insert(TABLE_CREDITS, newCredDoc, email);
            const genUpdate = { creditsFinalizedAt: Date.now(), creditsReleased: required };
            const exists = await this.db.getOne(TABLE_GENERATIONS, {}, generationId);
            if (exists) await this.db.update(TABLE_GENERATIONS, {}, genUpdate, generationId);
            else await this.db.insert(TABLE_GENERATIONS, genUpdate, generationId);
            return { processed: true, action: 'released', credits: required };
        }
    }




}


/**
 * {id, label, amount, credits, hold,  currency}
 */
const TABLE_PACKAGES = 'packages'

/**
 * {email, id, credits, createdAt, updatedAt, lastPaymentId}
 */
const TABLE_CREDITS = 'credits'

/**
 * 
 * 
 * GenerationInput
 *         
         inputs {
                prompt: string
                token: string | 'free'
                orientation: 'landscape' | 'portrait'
                theme: 'general' | 'hindu' | 'educational'
                duration: number | 1 | 2 // in minutes
                language: 'hindi' | 'english'
                speech_quality: 'neural' | 'low-ai' | 'high-ai'
                graphics_quality: 'high' | 'low'
                resolution: '360p' | 'SD' | 'HD'
                delivery_email: string
                video_type?: 'avatar' | 'slideshow'
            }
  

 * Generation document schema
 * 
 * {
 *   id: string,                    // e.g. "daily-gen-video-general-1772293253295"
 *   name: string,                  // e.g. "daily-gen-video-general"
 *   email: string,                 // user email
 *   
 *   status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "PARTIAL_SUCCESS",
 *   isRunning: boolean,
 *   
 *   currentTaskIdx: number,        // current task index (0-based)
 *   tasks: Task[],                 // queued tasks
 *   executedTasks: Task[],         // completed tasks
 *   
 *   startTime: string,             // epoch ms (string)
 *   endTime: string,               // epoch ms (string)
 *   
 *   output: {
 *     url: string,                 // final video URL
 *     caption: string,             // full caption
 *     caption_small: string        // short caption
 *   },
 *   
 *   raw: GenerationInput,              // raw generation input for reference
 *   
 *   createdAt?: string,
 *   updatedAt?: string
 * }
 */
const TABLE_GENERATIONS = 'generations'



/**
 * Payment document schema
 * {
    "id": "order_SLTBRa1FoMDCQN",
    "orderId": "order_SLTBRa1FoMDCQN",
    "cusId": "user_SGnPOmzPxi",
    "time": 1772260742971,
    "name": "Shivesh",
    "email": "shivesahnavin@gmail.com",
    "phone": null,
    "amount": 10,
    "pname": "TEST",
    "returnUrl": "host/?state=base64(JSON.stringify(stateObj))",
    "webhookUrl": "host/webhook/add-credits/{payserviceWebhookSecret}",
    "clientId": "finalflagger-prod",
    "extra": "{\"razorpay_payment_id\":\"pay_SLTCDJgD6t3ygo\",\"razorpay_order_id\":\"order_SLTBRa1FoMDCQN\",\"razorpay_signature\":\"f24b7be21c7cd7cfa129c664a8508e1f5dc1ceabb79ea6673997db3f72bd041e\",\"ORDERID\":\"order_SLTBRa1FoMDCQN\",\"extras\":{\"amount\":1000,\"amount_due\":0,\"amount_paid\":1000,\"attempts\":1,\"created_at\":1772260742,\"currency\":\"INR\",\"entity\":\"order\",\"id\":\"order_SLTBRa1FoMDCQN\",\"notes\":[],\"offer_id\":null,\"receipt\":\"user_SGnPOmzPxi_1772260733988\",\"status\":\"paid\"},\"STATUS\":\"TXN_SUCCESS\",\"TXNID\":\"pay_SLTCDJgD6t3ygo\"}",
    "status": "TXN_SUCCESS",
    "txnId": "pay_SLTCDJgD6t3ygo"
}
 */


module.exports = { Service }
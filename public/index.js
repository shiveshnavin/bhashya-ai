// Collects form values using listeners and generates the required object
function setupFormListeners() {
    // Language buttons
    const obj = {
        token: 'free',
        orientation: 'portrait',
        video_type: 'avatar',
        theme: 'general',
        duration: 1,
        language: 'english',
        speech_quality: 'neural',
        graphics_quality: 'low',
        resolution: '360p',
        delivery_email: ''
    };


    // Use setupToggleActive for all applicable button groups
    setupToggleActive('[data-orientation]', 'data-orientation', 'orientation', null, obj);
    setupToggleActive('[data-theme]', 'data-theme', 'theme', null, obj);
    setupToggleActive('[data-resolution]', 'data-resolution', 'resolution', null, obj);
    setupToggleActive('[data-speech-quality]', 'data-speech-quality', 'speech_quality', null, obj);
    setupToggleActive('[data-graphics-quality]', 'data-graphics-quality', 'graphics_quality', null, obj);
    setupToggleActive('[data-duration]', 'data-duration', 'duration', v => Number(v), obj);
    setupToggleActive('[data-language]', 'data-language', 'language', null, obj);
    setupToggleActive('[data-video-type]', 'data-video-type', 'video_type', null, obj);

    // Content Category Select
    const categorySelect = document.querySelector('[data-content-category]');
    if (categorySelect) {
        categorySelect.addEventListener('change', () => {
            // Map option text to theme value
            const valueMap = {
                'General': 'general',
                'Mythological': 'hindu'
            };
            const selectedText = categorySelect.options[categorySelect.selectedIndex].text;
            obj.theme = valueMap[selectedText] || 'general';
            console.log(JSON.stringify(obj, null, 2));
        });
    }

    // Token input (optional)
    const tokenInput = document.querySelector('[data-token-input]');
    // If a token is provided in the URL query params (e.g. ?token=XYZ), apply it
    // only in the frontend / HTML (do not send to server automatically).
    const _urlParams = new URLSearchParams(window.location.search || '');
    const _urlToken = (_urlParams.get('token') || '').trim();
    if (tokenInput) {
        if (_urlToken) {
            try {
                tokenInput.value = _urlToken;
            } catch (e) { /* ignore */ }
            obj.token = _urlToken;
        }
        tokenInput.addEventListener('input', () => {
            obj.token = (tokenInput.value || '').trim() || 'free';
            updatePremiumUI();
        });
    } else {
        // No token input in DOM, but still respect URL token for frontend state
        if (_urlToken) obj.token = _urlToken;
    }

    // Delivery Email
    const emailInput = document.querySelector('[data-delivery-email]');
    if (emailInput) {
        // Try to prefill from localStorage first, then from any hardcoded/prefilled value
        try {
            const stored = (() => {
                try { return localStorage.getItem('bhashya_delivery_email'); } catch (e) { return null; }
            })();
            const initial = (emailInput.value || '').trim();
            if (!initial && stored) {
                try { emailInput.value = stored; } catch (e) { }
                obj.delivery_email = (stored || '').trim();
            } else if (initial) {
                obj.delivery_email = initial;
            }
        } catch (e) { }
        // ensure any lingering error UI is cleared on load
        const _emailErrorInit = document.getElementById('delivery-email-error');
        if (_emailErrorInit) {
            _emailErrorInit.classList.add('hidden');
        }
        emailInput.classList.remove('ring-2', 'ring-red-500', 'border-red-500');
        emailInput.setAttribute('aria-invalid', 'false');
        const emailErrorEl = document.getElementById('delivery-email-error');
        emailInput.addEventListener('input', () => {
            obj.delivery_email = (emailInput.value || '').trim();
            try { localStorage.setItem('bhashya_delivery_email', obj.delivery_email || ''); } catch (e) { }
            // clear inline error and visual highlight
            if (emailErrorEl) emailErrorEl.classList.add('hidden');
            emailInput.classList.remove('ring-2', 'ring-red-500', 'border-red-500');
            emailInput.setAttribute('aria-invalid', 'false');
        });
    }

    // Token (example: set from elsewhere)
    // obj.token = ...

    // Prompt textarea: update object as text changes and show character counter
    const promptEl = document.querySelector('[data-prompt]');
    const PROMPT_MAX = 500;
    const promptCounter = document.querySelector('[data-prompt-counter]');
    if (promptEl) {
        try { promptEl.setAttribute('maxlength', String(PROMPT_MAX)); } catch (e) { /* ignore */ }
        const updateCounter = () => {
            try {
                if (promptEl.value.length > PROMPT_MAX) {
                    promptEl.value = promptEl.value.slice(0, PROMPT_MAX);
                }
                if (promptCounter) promptCounter.textContent = `${promptEl.value.length} / ${PROMPT_MAX} characters`;
            } catch (e) { /* ignore */ }
        };
        // initialize
        updateCounter();
        promptEl.addEventListener('input', () => {
            updateCounter();
            obj.prompt = promptEl.value;
            console.log(JSON.stringify(obj, null, 2));
        });
    }

    // Generate button: POST to /api/generate, show spinner, navigate on success
    const genBtn = document.getElementById('generate-btn');
    if (genBtn) {
        // Error/modal helpers
        const showErrorModal = (message) => {
            const modal = document.getElementById('error-modal');
            const msgEl = document.getElementById('error-modal-message');
            if (msgEl) msgEl.textContent = (message || 'Unknown error');
            if (modal) modal.classList.remove('hidden');
        };
        const hideErrorModal = () => {
            const modal = document.getElementById('error-modal');
            if (modal) modal.classList.add('hidden');
        };
        const showInlineEmailError = (message) => {
            const emailErrorEl = document.getElementById('delivery-email-error');
            if (emailErrorEl) {
                emailErrorEl.textContent = message || 'Please enter a valid email address.';
                emailErrorEl.classList.remove('hidden');
            }
            if (emailInput) {
                emailInput.classList.add('ring-2', 'ring-red-500', 'border-red-500');
                emailInput.setAttribute('aria-invalid', 'true');
                try { emailInput.focus(); } catch (e) { }
            }
        };
        const closeBtn = document.getElementById('error-modal-close');
        if (closeBtn) closeBtn.addEventListener('click', hideErrorModal);

        genBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            // prevent double clicks
            if (genBtn.disabled) return;
            const spinner = genBtn.querySelector('.generate-spinner');
            const genText = genBtn.querySelector('.generate-text');
            // simple frontend delivery email validation
            const emailVal = emailInput ? (emailInput.value || '').trim() : (obj.delivery_email || '').trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailVal || !emailRegex.test(emailVal)) {
                showInlineEmailError('Invalid delivery email');
                return;
            }

            try {
                genBtn.disabled = true;
                if (spinner) spinner.classList.remove('hidden');
                if (genText) genText.classList.add('hidden');

                const payload = { ...obj };
                // ensure prompt included
                payload.prompt = payload.prompt || (promptEl ? promptEl.value : '');

                const res = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    let errMsg = res.statusText || 'Request failed';
                    try {
                        const errBody = await res.json();
                        errMsg = errBody.reason || errBody.error || errBody.message || JSON.stringify(errBody);
                    } catch (e) {
                        const text = await res.text();
                        errMsg = text || errMsg;
                    }
                    // restore button state
                    if (spinner) spinner.classList.add('hidden');
                    if (genText) genText.classList.remove('hidden');
                    genBtn.disabled = false;
                    // If the error seems related to the delivery email, show inline error, otherwise show modal
                    if (errMsg && /email/i.test(errMsg)) {
                        showInlineEmailError(errMsg);
                    } else {
                        showErrorModal(errMsg);
                    }
                    return;
                }

                const body = await res.json();
                const id = body && (body.id || body.name || body.documentId);
                if (!id) throw new Error('No id returned from API');

                // navigate to generate with id
                window.location.href = `generate?id=${encodeURIComponent(id)}`;
            } catch (err) {
                console.error(err);
                alert('Generation failed: ' + (err.message || err));
                // restore button state
                if (spinner) spinner.classList.add('hidden');
                if (genText) genText.classList.remove('hidden');
                genBtn.disabled = false;
            }
        });
    }

    // --- Premium feature locking ---
    const premiumSelectors = ['[data-resolution]', '[data-speech-quality]', '[data-graphics-quality]', '[data-duration]'];
    const premiumButtons = Array.from(document.querySelectorAll(premiumSelectors.join(',')));
    // Values that are allowed for free (not premium)
    const exemptValues = {
        'data-resolution': ['360p'],
        'data-speech-quality': ['neural'],
        'data-duration': ['1'],
        'data-graphics-quality': ['low']
    };

    function isExempt(btn) {
        for (const attr of Object.keys(exemptValues)) {
            if (btn.hasAttribute(attr)) {
                const v = btn.getAttribute(attr);
                if (exemptValues[attr].includes(v)) return true;
            }
        }
        return false;
    }
    const detailsEl = document.querySelector('details');
    const premiumHandlerMap = new WeakMap();

    function expandAndHighlightPremium() {
        if (!detailsEl) return;
        detailsEl.open = true;
        detailsEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        detailsEl.classList.add('premium-highlight');
        setTimeout(() => detailsEl.classList.remove('premium-highlight'), 1600);
    }

    function lockPremiumButton(btn) {
        // skip exempted values
        if (isExempt(btn)) return;
        // add visual badge
        btn.classList.add('premium-locked');
        if (!btn.querySelector('.premium-icon')) {
            try {
                const span = document.createElement('span');
                span.className = 'premium-icon';
                span.textContent = '★';
                btn.appendChild(span);
            } catch (e) { }
        }
        if (premiumHandlerMap.has(btn)) return;
        const handler = (ev) => {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            expandAndHighlightPremium();
        };
        premiumHandlerMap.set(btn, handler);
        btn.addEventListener('click', handler, true);
    }

    function unlockPremiumButton(btn) {
        btn.classList.remove('premium-locked');
        const icon = btn.querySelector('.premium-icon');
        if (icon) try { icon.remove(); } catch (e) { }
        const handler = premiumHandlerMap.get(btn);
        if (handler) {
            btn.removeEventListener('click', handler, true);
            premiumHandlerMap.delete(btn);
        }
    }

    function updatePremiumUI() {
        const hasToken = !!(obj.token && obj.token !== 'free');
        premiumButtons.forEach(btn => {
            // don't show golden outline when active
            if (!hasToken) {
                if (!btn.classList.contains('is-active')) lockPremiumButton(btn);
                else unlockPremiumButton(btn);
            } else {
                unlockPremiumButton(btn);
            }
        });
    }

    // run once on load
    setTimeout(updatePremiumUI, 50);

    // defensive check: if the email input is prefilled and is valid, ensure any inline error UI is cleared
    setTimeout(() => {
        try {
            if (emailInput) {
                const valid = typeof emailInput.checkValidity === 'function' ? emailInput.checkValidity() : true;
                if (valid) {
                    const emailErrorEl2 = document.getElementById('delivery-email-error');
                    if (emailErrorEl2) {
                        emailErrorEl2.classList.add('hidden');
                        emailErrorEl2.style.display = 'none';
                        emailErrorEl2.textContent = 'Please enter a valid email address.';
                    }
                    emailInput.classList.remove('ring-2', 'ring-red-500', 'border-red-500');
                    emailInput.setAttribute('aria-invalid', 'false');
                }
            }
        } catch (e) { /* ignore */ }
    }, 120);

    // No free badges appended — UI decision to keep clean

    // Expose a getter for the object
    return () => ({ ...obj });
}


function setupToggleActive(selector, valueKey, objKey, valueTransform, obj) {
    // Define the correct classes for each group type
    const groupActiveClass = {
        orientation: 'flex-1 flex flex-col items-center gap-2 py-3 rounded-lg border-2 border-primary bg-primary/10 text-primary',
        resolution: 'flex-1 py-2 text-xs font-bold rounded bg-primary/20 border border-primary/50 text-primary',
        speech_quality: 'py-2 text-xs font-bold rounded bg-primary/20 border border-primary/50 text-primary',
        graphics_quality: 'py-2 text-xs font-bold rounded bg-primary/20 border border-primary/50 text-primary',
        duration: 'flex-1 py-2 text-sm font-bold rounded-lg bg-primary text-background-dark',
        theme: 'flex-1 py-2 text-xs font-bold rounded bg-primary/20 border border-primary/50 text-primary',
        language: 'text-sm font-semibold text-primary bg-transparent px-2 py-1 rounded',
        video_type: 'flex-1 flex flex-col items-center gap-2 py-3 rounded-lg border-2 border-primary bg-primary/10 text-primary',
    };
    const groupInactiveClass = {
        orientation: 'flex-1 flex flex-col items-center gap-2 py-3 rounded-lg border-2 border-transparent bg-slate-100 dark:bg-background-dark hover:bg-slate-200 dark:hover:bg-border-muted transition-all',
        resolution: 'flex-1 py-2 text-xs font-bold rounded bg-slate-100 dark:bg-background-dark border border-transparent',
        speech_quality: 'py-2 text-xs font-bold rounded bg-slate-100 dark:bg-background-dark border border-transparent',
        graphics_quality: 'py-2 text-xs font-bold rounded bg-slate-100 dark:bg-background-dark border border-transparent',
        duration: 'flex-1 py-2 text-sm font-bold rounded-lg bg-slate-100 dark:bg-background-dark text-slate-500',
        theme: 'flex-1 py-2 text-xs font-bold rounded bg-slate-100 dark:bg-background-dark border border-transparent',
        language: 'text-sm font-semibold text-slate-500 bg-transparent px-2 py-1 rounded',
        video_type: 'flex-1 flex flex-col items-center gap-2 py-3 rounded-lg border-2 border-transparent bg-slate-100 dark:bg-background-dark hover:bg-slate-200 dark:hover:bg-border-muted transition-all',
    };
    document.querySelectorAll(selector).forEach(btn => {
        btn.addEventListener('click', () => {
            let group = btn.parentElement;
            while (group && group.querySelectorAll(selector).length < 2) {
                group = group.parentElement;
            }
            if (group) {
                group.querySelectorAll(selector).forEach(b => {
                    b.className = groupInactiveClass[objKey] || b.className;
                    b.classList.remove('is-active');
                });
            }
            btn.className = groupActiveClass[objKey] || btn.className;
            btn.classList.add('is-active');
            obj[objKey] = valueTransform ? valueTransform(btn.getAttribute(valueKey)) : btn.getAttribute(valueKey);
            console.log(JSON.stringify(obj, null, 2));
        });
    });
}
// Usage:
// const getFormData = setupFormListeners();
// ... later: const data = getFormData();

// Lazy-init sample video players after full page load to avoid blocking rendering
function initSampleVideos() {
    const cards = Array.from(document.querySelectorAll('[data-video-src]'));
    if (!cards.length) return;

    const io = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const card = entry.target;
            observer.unobserve(card);
            try {
                const src = card.getAttribute('data-video-src');
                if (!src) return;
                // create video element
                const video = document.createElement('video');
                video.className = 'absolute inset-0 w-full h-full object-cover';
                video.setAttribute('playsinline', '');
                video.muted = false; // user requested audio on
                video.loop = true;
                video.controls = false; // use custom play overlay instead of native controls
                // start preloading so the browser fetches metadata/initial segments (do NOT autoplay)
                video.preload = 'auto';
                video.setAttribute('aria-label', 'Sample generated video preview');

                // set source on demand to avoid network usage until visible
                const source = document.createElement('source');
                source.type = 'video/mp4';
                source.src = src;
                video.appendChild(source);

                // insert video as first child so it covers the card background
                const firstChild = card.firstElementChild;
                if (firstChild) card.insertBefore(video, firstChild);
                else card.appendChild(video);

                // Remove/hide any hard-coded poster (either inline background-image or <img data-poster>) so the video is visible
                try {
                    const imgPoster = card.querySelector('img[data-poster]');
                    if (imgPoster) {
                        imgPoster.classList.add('hidden');
                    } else {
                        const bgEl = card.querySelector('[style*="background-image"]');
                        if (bgEl) {
                            bgEl.style.backgroundImage = 'none';
                            bgEl.classList.add('hidden');
                        }
                    }
                } catch (e) { /* ignore */ }

                // register this player globally so we can pause others when one plays
                try { window._sampleVideoPlayers = window._sampleVideoPlayers || []; } catch (e) { window._sampleVideoPlayers = []; }

                // create centered play overlay button (small control only — don't block underlying buttons)
                const playBtn = document.createElement('button');
                playBtn.type = 'button';
                playBtn.setAttribute('aria-label', 'Play preview');
                playBtn.className = '';
                // center the small circular control
                playBtn.style.position = 'absolute';
                playBtn.style.left = '50%';
                playBtn.style.top = '50%';
                playBtn.style.transform = 'translate(-50%, -50%)';
                playBtn.style.zIndex = '10';
                playBtn.style.width = '72px';
                playBtn.style.height = '72px';
                playBtn.style.padding = '0';
                playBtn.style.background = 'transparent';
                playBtn.style.border = 'none';
                playBtn.style.cursor = 'pointer';
                playBtn.style.pointerEvents = 'auto';
                playBtn.innerHTML = `
                                        <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <circle cx="36" cy="36" r="36" fill="rgba(0,0,0,0.45)"/>
                                            <path d="M29 24L49 36L29 48V24Z" fill="white"/>
                                        </svg>`;

                // ensure the overlay control is above the video but does not block other interactive elements in the card
                card.appendChild(playBtn);

                // create loader overlay (hidden by default)
                const loader = document.createElement('div');
                loader.className = 'absolute inset-0 flex items-center justify-center z-20';
                loader.style.pointerEvents = 'none';
                loader.style.display = 'none';
                loader.innerHTML = `
                                    <div style="width:56px;height:56px;border-radius:9999px;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;">
                                        <svg class="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)" stroke-width="4"></circle>
                                            <path d="M22 12a10 10 0 00-10-10" stroke="white" stroke-width="4" stroke-linecap="round"></path>
                                        </svg>
                                    </div>`;
                card.appendChild(loader);

                function showPlayOverlay() { playBtn.style.display = ''; }
                function hidePlayOverlay() { playBtn.style.display = 'none'; }

                // change icon to pause
                function setPauseIcon() {
                    playBtn.innerHTML = `
                      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="36" cy="36" r="36" fill="rgba(0,0,0,0.45)"/>
                        <rect x="24" y="22" width="8" height="28" fill="white"/>
                        <rect x="40" y="22" width="8" height="28" fill="white"/>
                      </svg>`;
                }
                function setPlayIcon() {
                    playBtn.innerHTML = `
                      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="36" cy="36" r="36" fill="rgba(0,0,0,0.45)"/>
                        <path d="M29 24L49 36L29 48V24Z" fill="white"/>
                      </svg>`;
                }

                // helper: pause other players
                function pauseOtherPlayers() {
                    try {
                        (window._sampleVideoPlayers || []).forEach(p => {
                            if (p.video && p.video !== video) {
                                try { p.video.pause(); } catch (e) { }
                                if (p.playBtn) p.playBtn.style.display = '';
                                if (p.setPlayIcon) p.setPlayIcon();
                            }
                        });
                    } catch (e) { /* ignore */ }
                }

                // helper: start playback for this video (with loader)
                function startPlayback() {
                    pauseOtherPlayers();
                    if (video._loading) return;
                    loader.style.display = '';
                    video._loading = true;
                    const onPlayable = () => {
                        video._loading = false;
                        loader.style.display = 'none';
                        hidePlayOverlay();
                        setPauseIcon();
                        video.removeEventListener('canplay', onPlayable);
                        video.removeEventListener('playing', onPlayable);
                    };
                    video.addEventListener('canplay', onPlayable);
                    video.addEventListener('playing', onPlayable);
                    video.play().then(() => {
                        // on success, handlers above will hide loader
                    }).catch(() => {
                        video._loading = false;
                        loader.style.display = 'none';
                        showPlayOverlay();
                        setPlayIcon();
                    });
                }

                // helper: pause this video
                function pausePlayback() {
                    try { video.pause(); } catch (e) { }
                    video._loading = false;
                    loader.style.display = 'none';
                    showPlayOverlay();
                    setPlayIcon();
                }

                // clicking overlay toggles playback (start playing if paused)
                playBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    if (video._loading) {
                        // cancel loading
                        pausePlayback();
                        return;
                    }
                    if (video.paused) startPlayback();
                    else pausePlayback();
                });

                // update overlay and icon based on play/pause
                video.addEventListener('play', () => { loader.style.display = 'none'; hidePlayOverlay(); setPauseIcon(); });
                video.addEventListener('playing', () => { loader.style.display = 'none'; hidePlayOverlay(); setPauseIcon(); });
                video.addEventListener('pause', () => { loader.style.display = 'none'; showPlayOverlay(); setPlayIcon(); });

                // clicking the video itself should toggle playback (pause if playing)
                video.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    if (video._loading) {
                        pausePlayback();
                        return;
                    }
                    if (video.paused) startPlayback();
                    else pausePlayback();
                });

                // clicking anywhere on the card (except interactive controls) should also toggle playback
                card.addEventListener('click', (ev) => {
                    // ignore clicks on interactive elements
                    if (ev.target.closest('button, a, input, select, textarea')) return;
                    if (video._loading) {
                        pausePlayback();
                        return;
                    }
                    if (video.paused) startPlayback();
                    else pausePlayback();
                });

                // Wire the "Use Prompt" button: populate the prompt and select but do not trigger playback
                try {
                    const useBtn = Array.from(card.querySelectorAll('button')).find(b => (b.textContent || '').trim().includes('Use Prompt'));
                    if (useBtn) {
                        useBtn.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // extract sample prompt text from the card
                            const sampleP = card.querySelector('p');
                            const sampleText = sampleP ? (sampleP.textContent || '').trim().replace(/^"|"$/g, '') : '';
                            const promptElMain = document.querySelector('[data-prompt]');
                            if (promptElMain) {
                                promptElMain.value = sampleText;
                                promptElMain.dispatchEvent(new Event('input', { bubbles: true }));
                                try {
                                    promptElMain.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    promptElMain.focus({ preventScroll: true });
                                } catch (e) { /* ignore */ }
                            }

                            // Prefill content category: prefer explicit card attribute, fall back to top-left tag
                            const categorySelect = document.querySelector('[data-content-category]');
                            const explicitCategory = card.getAttribute('data-content-category');
                            if (categorySelect) {
                                if (explicitCategory) {
                                    categorySelect.value = explicitCategory;
                                } else {
                                    const tagSpan = card.querySelector('.absolute.top-4.left-4 span');
                                    if (tagSpan) {
                                        const tag = (tagSpan.textContent || '').trim().toLowerCase();
                                        if (tag.includes('myth') || tag.includes('mythic')) categorySelect.value = 'Mythological';
                                        else categorySelect.value = 'General';
                                    }
                                }
                                categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
                            }

                            // Prefill language: if card has data-language, simulate clicking matching language button
                            const lang = (card.getAttribute('data-language') || '').trim().toLowerCase();
                            if (lang) {
                                const langBtn = document.querySelector(`[data-language="${lang}"]`);
                                if (langBtn) {
                                    try { langBtn.click(); } catch (e) { /* ignore */ }
                                }
                            } else {
                                // If no explicit data-language set on the card, detect mythological category
                                // and set language to Hindi when the sample is Mythological.
                                try {
                                    const selectedCategoryText = categorySelect ? (categorySelect.options[categorySelect.selectedIndex].text || '').toLowerCase() : '';
                                    if (selectedCategoryText.includes('myth')) {
                                        const hindiBtn = document.querySelector('[data-language="hindi"]');
                                        if (hindiBtn) {
                                            try { hindiBtn.click(); } catch (e) { /* ignore */ }
                                        }
                                    }
                                } catch (e) { /* ignore */ }
                            }
                        });
                    }
                } catch (e) { /* ignore */ }

                // ensure icon state functions are available in registry
                const playerEntry = { video, playBtn, setPlayIcon, setPauseIcon };
                window._sampleVideoPlayers.push(playerEntry);

                // load the video now that the source is set (do NOT autoplay)
                try { video.load(); showPlayOverlay(); setPlayIcon(); } catch (e) { /* ignore */ }
            } catch (e) {
                // fail silently — leave the card fallback background-image intact
                console.error('Video init error', e);
            }
        });
    }, { rootMargin: '200px', threshold: 0.05 });

    cards.forEach(c => io.observe(c));
}

// Ensure videos initialize after the page has fully loaded
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        try { initSampleVideos(); } catch (e) { console.error(e); }
    });
}

// --- Firestore realtime listener for generation document ---
// Extract `id` from URL (e.g. ?id=daily-gen-video-general-1768676687638)
(async function initGenerationSnapshotListener() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        const id = params.get('id');
        if (!id) return; // nothing to do on pages without an id param

        // dynamic import of modular SDK (keeps main bundle light)
        const appMod = await import('https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js');
        const fsMod = await import('https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js');
        const { initializeApp, getApps } = appMod;
        const { getFirestore, doc, onSnapshot } = fsMod;

        const firebaseConfig = {
            apiKey: "AIzaSyAf0qWODcuFljpgCt56WEY-fo-fsqByKF8",
            authDomain: "bhashya-ai.firebaseapp.com",
            projectId: "bhashya-ai",
            storageBucket: "bhashya-ai.firebasestorage.app",
            messagingSenderId: "525738664258",
            appId: "1:525738664258:web:fcd30efa7b433af364a8db",
            measurementId: "G-B25TV25F1X"
        };

        let app;
        try {
            app = (getApps && getApps().length) ? getApps()[0] : initializeApp(firebaseConfig);
        } catch (e) {
            // fallback: try to initialize
            app = initializeApp(firebaseConfig);
        }

        const db = getFirestore(app);
        const docRef = doc(db, 'generations', id);

        // attach snapshot listener and log updates (extend to update UI as needed)
        const unsubscribe = onSnapshot(docRef, (snapshot) => {
            if (!snapshot.exists()) {
                console.warn('Generation document removed:', id);
                return;
            }
            const data = snapshot.data();
            console.log('Generation snapshot', snapshot.id, data);

            // Example: update a status element if present
            try {
                const statusEl = document.querySelector('[data-generation-status]');
                if (statusEl) statusEl.textContent = data.status || 'UNKNOWN';

                // Populate captions (replace newlines with <br>) — escape HTML first
                try {
                    const captionEl = document.querySelector('[data-generation-caption]');
                    const captionSmallEl = document.querySelector('[data-generation-caption-small]');
                    const escapeHtml = (str) => String(str || '')
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#39;');
                    if (captionEl && typeof data.output?.caption !== 'undefined') {
                        captionEl.innerHTML = escapeHtml(String(data.output?.caption)).replace(/\n/g, '<br>');
                    }
                    if (captionSmallEl && typeof data.output?.caption_small !== 'undefined') {
                        captionSmallEl.innerHTML = escapeHtml(String(data.output?.caption_small)).replace(/\n/g, '<br>');
                    }
                } catch (e) { /* ignore caption wiring errors */ }

                // Update page title and hide current-step when finished
                try {
                    const pageTitle = document.querySelector('main h1');
                    const currentStepSpan = document.querySelector('[data-generation-current-step]');
                    const currentStepWrapper = currentStepSpan ? currentStepSpan.closest('div') : null;
                    const statusRawLocal = (data && data.status) ? String(data.status).toUpperCase() : '';
                    if (statusRawLocal === 'SUCCESS' || statusRawLocal === 'PARTIAL_SUCCESS') {
                        if (pageTitle) pageTitle.textContent = 'Video Generated';
                        if (currentStepWrapper) currentStepWrapper.style.display = 'none';
                    } else {
                        if (pageTitle) pageTitle.textContent = 'Generating Your Reel';
                        if (currentStepWrapper) currentStepWrapper.style.display = '';
                    }
                } catch (e) { /* ignore title/step update errors */ }

                // Example: show current task index
                const taskIdxEl = document.querySelector('[data-generation-task-idx]');
                if (taskIdxEl && typeof data.currentTaskIdx !== 'undefined') taskIdxEl.textContent = String(data.currentTaskIdx);

                // Example: show current step — prefer tasks[currentTaskIdx], fallback to last executedTasks entry
                const currentStepEl = document.querySelector('[data-generation-current-step]');
                try {
                    if (currentStepEl) {
                        const totalTasks = Array.isArray(data.tasks) ? data.tasks.length : 0;
                        let isExecuting = false;
                        let executingName = null;

                        // Determine currently executing task using executedTasks -> tasks mapping
                        try {
                            const execTask = getCurrentlyExecutingTask(data);
                            if (execTask) {
                                executingName = execTask.uniqueStepName || execTask.unique_step_name || execTask.name;
                                isExecuting = true;
                            }
                        } catch (e) { /* ignore */ }

                        // If that failed, fall back to inferring from executedTasks entries with IN_PROGRESS
                        if (!executingName) {
                            const executed = Array.isArray(data.executedTasks) ? data.executedTasks : [];
                            const inProg = executed.find(e => (String(e.status || '').toUpperCase() === 'IN_PROGRESS'));
                            if (inProg) {
                                executingName = inProg.uniqueStepName || inProg.unique_step_name || inProg.name;
                                isExecuting = !!executingName;
                            }
                        }

                        // If we still don't have an executing name, fall back to last executed step for display
                        if (executingName) {
                            currentStepEl.textContent = formatTaskLabel(executingName);
                        } else {
                            const executed = Array.isArray(data.executedTasks) ? data.executedTasks : [];
                            if (executed.length) {
                                const last = executed[executed.length - 1];
                                const rawLastName = last.uniqueStepName || last.unique_step_name || last.name || '—';
                                currentStepEl.textContent = formatTaskLabel(rawLastName);
                            } else {
                                currentStepEl.textContent = '—';
                            }
                        }

                        // Mirror the current step into the main view under the progress bar
                        try {
                            const mainStepEl = document.querySelector('[data-generation-current-step-main]');
                            if (mainStepEl) {
                                mainStepEl.textContent = currentStepEl.textContent;
                                if (isExecuting) {
                                    mainStepEl.classList.add('text-primary');
                                    mainStepEl.classList.remove('text-white');
                                } else {
                                    mainStepEl.classList.remove('text-primary');
                                    mainStepEl.classList.add('text-white');
                                }
                            }
                        } catch (e) { /* ignore main step mirroring errors */ }

                        // Update the description under the overall progress bar to reflect the
                        // currently executing step (prefer task.description from `tasks` array)
                        try {
                            const descEl = document.querySelector('[data-generation-current-step-desc]');
                            if (descEl) {
                                let descText = '';
                                const tasksArr = Array.isArray(data.tasks) ? data.tasks : [];

                                // If we have an executingName, prefer the description from the matching task
                                if (executingName) {
                                    const matched = tasksArr.find(tt => {
                                        const n = tt && (tt.uniqueStepName || tt.unique_step_name || tt.name);
                                        return n === executingName;
                                    });
                                    if (matched && (matched.description || matched.desc)) {
                                        descText = matched.description || matched.desc;
                                    } else {
                                        // fall back to heuristics
                                        descText = getDefaultDescriptionFor(executingName) || '';
                                    }
                                } else {
                                    // No explicit executingName: try to use the mainStep text to find a matching task
                                    const mainText = (document.querySelector('[data-generation-current-step-main]') || { textContent: '' }).textContent || '';
                                    const matched = tasksArr.find(tt => formatTaskLabel(tt.uniqueStepName || tt.unique_step_name || tt.name) === (mainText || '').trim());
                                    if (matched && (matched.description || matched.desc)) descText = matched.description || matched.desc;
                                    else descText = data.status || '';
                                }

                                descEl.textContent = descText || '';
                            }
                        } catch (e) { /* ignore description wiring errors */ }

                        // Toggle dot and highlight color for the currently executing step (dot lives in Overall Progress)
                        try {
                            const dot = document.querySelector('[data-generation-exec-dot]');
                            if (dot) {
                                if (isExecuting) dot.classList.remove('hidden');
                                else dot.classList.add('hidden');
                            }
                            if (isExecuting) {
                                currentStepEl.classList.add('text-primary');
                                currentStepEl.classList.remove('text-white');
                            } else {
                                currentStepEl.classList.remove('text-primary');
                                currentStepEl.classList.add('text-white');
                            }
                        } catch (e) { /* ignore dot toggling errors */ }
                    }
                } catch (e) { /* ignore */ }

                // Update overall percent and progress bar if tasks/currentTaskIdx available
                try {
                    const percentEl = document.querySelector('[data-generation-percent]');
                    const barEl = document.querySelector('[data-generation-bar]');
                    const msgEl = document.querySelector('[data-generation-message]');

                    const totalTasks = Array.isArray(data.tasks) ? data.tasks.length : 0;
                    // Special-case: when status is PAUSED, show 'Queued' instead of numeric percent
                    const statusRawShort = (data && data.status) ? String(data.status).toUpperCase() : '';
                    if (statusRawShort === 'PAUSED') {
                        if (percentEl) percentEl.textContent = 'Queued';
                        if (barEl) {
                            barEl.style.width = '0%';
                            barEl.classList.remove('hidden');
                        }
                    } else {
                        let pct = null;
                        if (typeof data.currentTaskIdx === 'number' && totalTasks > 0) {
                            // currentTaskIdx may be 0-based index of current task; clamp
                            pct = Math.round(Math.max(0, Math.min(100, (data.currentTaskIdx / Math.max(1, totalTasks)) * 100)));
                        } else if (Array.isArray(data.executedTasks) && totalTasks > 0) {
                            pct = Math.round((data.executedTasks.length / totalTasks) * 100);
                        }

                        if (pct !== null) {
                            if (percentEl) percentEl.textContent = pct + '%';
                            if (barEl) barEl.style.width = pct + '%';
                        }
                    }

                    // Manage preview video visibility and status-driven UI updates
                    try {
                        const previewRoot = document.querySelector('[data-alt="Abstract blurry neon cyberpunk background"]');
                        const previewVideo = document.getElementById('generation-preview-video');

                        // Consolidated status UI handling
                        try {
                            const stoppedEl = document.getElementById('generation-stopped');
                            const isFailed = (statusRawShort === 'FAILED' || statusRawShort === 'ERROR');
                            const isSuccess = (statusRawShort === 'SUCCESS' || statusRawShort === 'PARTIAL_SUCCESS');
                            const isInProgress = (statusRawShort === 'IN_PROGRESS');
                            const isPaused = (statusRawShort === 'PAUSED');
                            const isSkipped = (statusRawShort === 'SKIPPED');

                            // Reset inline styles/classes
                            try {
                                if (barEl) { barEl.style.background = ''; barEl.style.boxShadow = ''; }
                                if (percentEl) { percentEl.classList.remove('text-red-400', 'text-red-500', 'text-primary'); }
                            } catch (e) { }

                            if (isFailed) {
                                try { if (percentEl) { percentEl.textContent = 'Failed'; percentEl.classList.add('text-red-400'); } } catch (e) { }
                                try { if (barEl) { barEl.style.width = (typeof pct !== 'undefined' && pct !== null) ? (pct + '%') : '100%'; barEl.style.background = '#ef4444'; barEl.style.boxShadow = '0 0 20px rgba(239,68,68,0.4)'; } } catch (e) { }
                                if (stoppedEl) { try { stoppedEl.classList.remove('hidden'); const titleEl = stoppedEl.querySelector('.font-bold'); const subEl = stoppedEl.querySelector('div.text-xs'); if (titleEl) titleEl.textContent = 'Generation failed'; if (subEl) subEl.textContent = 'An error occurred during generation.'; } catch (e) { } }
                                try { const dot = document.querySelector('[data-generation-exec-dot]'); if (dot) dot.classList.add('hidden'); } catch (e) { }

                            } else if (isSuccess) {
                                try { if (percentEl) percentEl.textContent = 'Success'; } catch (e) { }
                                try { if (barEl) barEl.style.width = '100%'; } catch (e) { }
                                try { if (stoppedEl) stoppedEl.classList.add('hidden'); } catch (e) { }
                                try { const dot = document.querySelector('[data-generation-exec-dot]'); if (dot) dot.classList.add('hidden'); } catch (e) { }

                            } else if (isInProgress) {
                                try { if (percentEl && pct !== null) { percentEl.textContent = pct + '%'; percentEl.classList.add('text-primary'); } } catch (e) { }
                                try { if (barEl && pct !== null) barEl.style.width = pct + '%'; } catch (e) { }
                                try { const dot = document.querySelector('[data-generation-exec-dot]'); if (dot) dot.classList.remove('hidden'); } catch (e) { }
                                try { if (stoppedEl) stoppedEl.classList.add('hidden'); } catch (e) { }

                            } else if (isPaused) {
                                try { if (percentEl) percentEl.textContent = 'Queued'; } catch (e) { }
                                try { if (barEl) barEl.style.width = (pct !== null ? (pct + '%') : '0%'); } catch (e) { }
                                try { const dot = document.querySelector('[data-generation-exec-dot]'); if (dot) dot.classList.add('hidden'); } catch (e) { }
                                try { if (stoppedEl) stoppedEl.classList.add('hidden'); } catch (e) { }

                            } else if (isSkipped) {
                                try { if (percentEl) percentEl.textContent = 'Stopped'; } catch (e) { }
                                try { if (barEl) barEl.style.width = (pct !== null ? (pct + '%') : '0%'); } catch (e) { }
                                if (stoppedEl) { try { stoppedEl.classList.remove('hidden'); const titleEl = stoppedEl.querySelector('.font-bold'); const subEl = stoppedEl.querySelector('div.text-xs'); if (titleEl) titleEl.textContent = 'Generation stopped'; if (subEl) subEl.textContent = 'This generation was cancelled.'; } catch (e) { } }
                                try { const dot = document.querySelector('[data-generation-exec-dot]'); if (dot) dot.classList.add('hidden'); } catch (e) { }

                            } else {
                                try { if (percentEl && pct !== null) percentEl.textContent = pct + '%'; } catch (e) { }
                                try { if (barEl && pct !== null) barEl.style.width = pct + '%'; } catch (e) { }
                                try { if (stoppedEl) stoppedEl.classList.add('hidden'); } catch (e) { }
                            }
                        } catch (e) { /* ignore status wiring errors */ }

                        if (previewVideo && previewRoot) {
                            if (statusRawShort !== 'SUCCESS' && statusRawShort !== 'PARTIAL_SUCCESS') {
                                try { previewVideo.pause(); } catch (e) { }
                                previewVideo.classList.add('hidden');
                                try { previewVideo.removeAttribute('src'); previewVideo.load(); } catch (e) { }
                                const spinner = previewRoot.querySelector('.size-16');
                                if (spinner) {
                                    // show spinner only while actively generating or queued
                                    if (statusRawShort === 'IN_PROGRESS' || statusRawShort === 'QUEUED' || statusRawShort === 'PAUSED') spinner.classList.remove('hidden');
                                    else spinner.classList.add('hidden');
                                }

                                // restore overlays when not playing; adjust center overlay on failure
                                try {
                                    const scan = previewRoot.querySelector('.scanline');
                                    const darkBackdrop = previewRoot.querySelector('.backdrop-blur-sm');
                                    const centerOverlay = previewRoot.querySelector('.relative.z-10');
                                    const rightOverlay = previewRoot.querySelector('.absolute.bottom-10.right-4');
                                    const leftOverlay = previewRoot.querySelector('.absolute.bottom-10.left-4');
                                    if (scan) scan.style.display = '';
                                    if (darkBackdrop) darkBackdrop.style.display = '';
                                    if (centerOverlay) {
                                        centerOverlay.style.display = '';
                                        try {
                                            const h4 = centerOverlay.querySelector('h4');
                                            const p = centerOverlay.querySelector('p');
                                            if (statusRawShort === 'FAILED' || statusRawShort === 'ERROR') {
                                                if (h4) h4.textContent = 'Failed';
                                                if (p) p.textContent = 'Preview unavailable due to an error';
                                            } else if (statusRawShort === 'IN_PROGRESS') {
                                                if (h4) h4.textContent = 'Generating';
                                                if (p) p.textContent = 'Waiting for preview';
                                            } else {
                                                if (h4) h4.textContent = 'Visualizing';
                                                if (p) p.textContent = 'PREVIEW UNAVAILABLE DURING\n HIGH-DENSITY RENDERING';
                                            }
                                        } catch (e) { }
                                    }
                                    if (rightOverlay) rightOverlay.style.display = '';
                                    if (leftOverlay) leftOverlay.style.display = '';
                                    try { const unmute = document.getElementById('generation-unmute-btn'); if (unmute) unmute.classList.add('hidden'); } catch (e) { }
                                } catch (e) { }
                            }
                        }
                    } catch (e) { /* ignore preview visibility */ }

                    // Update progress message to reflect the user-facing current step (or status)
                    try {
                        if (msgEl) {
                            // Prefer the main mirrored current-step (human-friendly) if present,
                            // otherwise fall back to status or the raw last executed task name.
                            const mainStepEl = document.querySelector('[data-generation-current-step-main]');
                            const mainText = mainStepEl ? (mainStepEl.textContent || '').trim() : '';
                            if (mainText && mainText !== '—') {
                                msgEl.textContent = mainText;
                            } else {
                                const executed = Array.isArray(data.executedTasks) ? data.executedTasks : [];
                                const lastName = (executed.length ? (executed[executed.length - 1].uniqueStepName || executed[executed.length - 1].unique_step_name || executed[executed.length - 1].name) : null) || data.status || 'Processing...';
                                msgEl.textContent = String(lastName);
                            }
                        }
                    } catch (e) { /* ignore */ }
                } catch (e) { /* ignore progress update errors */ }

                // If doc contains a `raw` object with original submission fields, populate matching UI elements
                try {
                    const raw = (data && typeof data.raw === 'object') ? data.raw : null;
                    if (raw) {
                        const rawFields = ['delivery_email', 'duration', 'language', 'orientation', 'video_type', 'prompt', 'resolution', 'speech_quality', 'theme', 'token'];
                        rawFields.forEach(k => {
                            try {
                                const el = document.querySelector(`[data-raw-${k}]`);
                                if (!el) return;
                                const v = raw[k];
                                if (typeof v === 'undefined' || v === null) {
                                    el.textContent = '—';
                                    return;
                                }
                                // Small formatting rules for nicer UI
                                if (k === 'duration') {
                                    // show as minutes when numeric
                                    if (typeof v === 'number') el.textContent = `${v} minutes`;
                                    else el.textContent = String(v);
                                    return;
                                }
                                if (k === 'orientation') {
                                    if ((String(v)).toLowerCase() === 'portrait') el.textContent = '9:16 Vertical';
                                    else if ((String(v)).toLowerCase() === 'landscape') el.textContent = '16:9 Horizontal';
                                    else el.textContent = String(v);
                                    return;
                                }
                                if (k === 'speech_quality') {
                                    // present more friendly
                                    el.textContent = String(v).replace(/[_-]/g, ' ');
                                    return;
                                }
                                // default
                                el.textContent = String(v);
                            } catch (e) { /* ignore per-field */ }
                        });
                    }
                } catch (e) { /* ignore raw handling */ }

                // Estimate wait time from queue information in output (if present).
                try {
                    const out = data && (data.output || data.result || null);
                    const queueKeys = ['queue', 'queueLength', 'queue_length', 'queuePosition', 'queue_position', 'position', 'queuePos'];
                    let q = null;
                    if (out && typeof out === 'object') {
                        for (const k of queueKeys) {
                            if (typeof out[k] !== 'undefined' && out[k] !== null) {
                                const n = Number(out[k]);
                                if (!Number.isNaN(n)) { q = n; break; }
                            }
                        }
                    }

                    const etaEl = document.querySelector('[data-generation-estimate]');
                    if (etaEl) {
                        const statusRawShort2 = (data && data.status) ? String(data.status).toUpperCase() : '';
                        // If completed, prefer showing time taken using startTime
                        if ((statusRawShort2 === 'SUCCESS' || statusRawShort2 === 'PARTIAL_SUCCESS') && data && data.startTime) {
                            const st = Number(data.startTime);
                            // Prefer explicit endTime provided by the document rather than using current time
                            const et = (typeof data.endTime !== 'undefined' && data.endTime !== null) ? Number(data.endTime) : NaN;
                            if (!Number.isNaN(st) && st > 0 && !Number.isNaN(et) && et > 0 && et >= st) {
                                const mins = Math.max(0, Math.round((et - st) / 60000));
                                etaEl.textContent = `Time taken: ~${mins} minute${mins === 1 ? '' : 's'}`;
                            } else {
                                etaEl.textContent = 'Time taken: —';
                            }
                        } else if (q && q > 0) {
                            const minutes = Math.max(0, Math.round(q * 5));
                            etaEl.textContent = `Estimated wait: ~${minutes} minute${minutes === 1 ? '' : 's'} (queue: ${q})`;
                        } else {
                            etaEl.textContent = 'Estimated wait: —';
                        }
                    }
                } catch (e) { /* ignore ETA wiring */ }

                // If the document status indicates success, force overall UI to success and show output URL if present
                try {
                    const statusRaw = (data && data.status) ? String(data.status).toUpperCase() : '';
                    if (statusRaw === 'SUCCESS' || statusRaw === 'PARTIAL_SUCCESS') {
                        const percentEl = document.querySelector('[data-generation-percent]');
                        const barEl = document.querySelector('[data-generation-bar]');
                        const msgEl = document.querySelector('[data-generation-message]');
                        if (percentEl) percentEl.textContent = 'Success';
                        if (barEl) {
                            barEl.style.width = '100%';
                            barEl.classList.remove('hidden');
                        }
                        if (msgEl) msgEl.textContent = 'Completed';

                        // show output URL if available at data.output.url or data.output.downloadUrl
                        try {
                            const out = data.output || (data.result || null);
                            const url = out && (out.url || out.downloadUrl || out.download_url || out.output_url);
                            const outPanel = document.getElementById('generation-output');
                            const outAnchor = outPanel ? outPanel.querySelector('[data-output-url]') : null;
                            const openBtn = document.getElementById('open-output-btn');
                            const downloadBigBtn = document.getElementById('download-output-big-btn');
                            if (url && outPanel && outAnchor) {
                                outAnchor.href = url;
                                outAnchor.textContent = url.length > 60 ? (url.slice(0, 60) + '…') : url;
                                outPanel.classList.remove('hidden');
                                if (openBtn) {
                                    openBtn.classList.remove('hidden');
                                    openBtn.onclick = () => { try { window.open(url, '_blank'); } catch (e) { window.location.href = url; } };
                                }

                                if (downloadBigBtn) {
                                    downloadBigBtn.classList.remove('hidden');
                                    // For large videos, avoid fetching the whole file in-page; let the browser handle download/streaming.
                                    downloadBigBtn.onclick = () => {
                                        try {
                                            // Open in a new tab so the user can stream or save using browser controls
                                            const opened = window.open(url, '_blank');
                                            if (!opened) window.location.href = url;
                                        } catch (e) {
                                            try { window.location.href = url; } catch (e2) { /* ignore */ }
                                        }
                                    };
                                }
                            }
                            // Also wire the preview player: insert or update a video element in the preview area and play it
                            try {
                                const previewRoot = document.querySelector('[data-alt="Abstract blurry neon cyberpunk background"]');
                                if (previewRoot && url) {
                                    let videoEl = document.getElementById('generation-preview-video');
                                    if (!videoEl) {
                                        videoEl = document.createElement('video');
                                        videoEl.id = 'generation-preview-video';
                                        videoEl.className = 'absolute inset-0 w-full h-full object-cover hidden';
                                        videoEl.setAttribute('playsinline', '');
                                        videoEl.controls = true;
                                        previewRoot.insertBefore(videoEl, previewRoot.firstChild);
                                    }
                                    try { videoEl.pause(); } catch (e) { }
                                    videoEl.src = url;
                                    videoEl.classList.remove('hidden');
                                    try {
                                        // Prefer to autoplay unmuted — set up and try to play with audio.
                                        videoEl.autoplay = true;
                                        videoEl.loop = false;
                                        videoEl.muted = false;
                                        videoEl.load();
                                        // Attempt to play unmuted. If the browser blocks autoplay with audio,
                                        // fall back to muted autoplay and show the Unmute button.
                                        const tryUnmutedPlay = async () => {
                                            let playedUnmuted = false;
                                            try {
                                                await videoEl.play();
                                                playedUnmuted = true;
                                            } catch (err) {
                                                try {
                                                    // fallback: allow muted autoplay so user sees video, then show unmute control
                                                    videoEl.muted = true;
                                                    await videoEl.play().catch(() => { /* ignore */ });
                                                } catch (e) { /* ignore */ }
                                            }

                                            // create or show the Unmute button only if playback ended up muted
                                            try {
                                                let unmute = document.getElementById('generation-unmute-btn');
                                                if (!unmute) {
                                                    unmute = document.createElement('button');
                                                    unmute.id = 'generation-unmute-btn';
                                                    unmute.type = 'button';
                                                    unmute.className = 'absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/60 text-white text-sm backdrop-blur-sm';
                                                    unmute.style.zIndex = '40';
                                                    unmute.textContent = 'Unmute';
                                                    unmute.addEventListener('click', (ev) => {
                                                        ev.stopPropagation();
                                                        try { videoEl.muted = false; videoEl.volume = 1.0; videoEl.play().catch(() => { /* ignore */ }); } catch (e) { }
                                                        try { unmute.classList.add('hidden'); } catch (e) { }
                                                    });
                                                    previewRoot.appendChild(unmute);
                                                }
                                                if (playedUnmuted) {
                                                    // no need to show unmute control
                                                    unmute.classList.add('hidden');
                                                } else {
                                                    unmute.classList.remove('hidden');
                                                }
                                            } catch (e) { /* ignore unmute wiring */ }
                                            // allow clicking anywhere in the preview to unmute (first user gesture)
                                            try {
                                                if (!previewRoot.__unmuteClickAdded) {
                                                    previewRoot.addEventListener('click', (ev) => {
                                                        try {
                                                            if (videoEl && videoEl.muted) {
                                                                videoEl.muted = false;
                                                                videoEl.volume = 1.0;
                                                                videoEl.play().catch(() => { /* ignore */ });
                                                                const unmuteBtn = document.getElementById('generation-unmute-btn');
                                                                if (unmuteBtn) unmuteBtn.classList.add('hidden');
                                                            }
                                                        } catch (e) { /* ignore */ }
                                                    }, { once: false });
                                                    previewRoot.__unmuteClickAdded = true;
                                                }
                                            } catch (e) { }
                                        };
                                        tryUnmutedPlay();
                                    } catch (e) { }

                                    // hide preview overlays (scanline, dark backdrop, spinner, mock UI) when playing
                                    try {
                                        const scan = previewRoot.querySelector('.scanline');
                                        const darkBackdrop = previewRoot.querySelector('.backdrop-blur-sm');
                                        const centerOverlay = previewRoot.querySelector('.relative.z-10');
                                        const rightOverlay = previewRoot.querySelector('.absolute.bottom-10.right-4');
                                        const leftOverlay = previewRoot.querySelector('.absolute.bottom-10.left-4');
                                        if (scan) scan.style.display = 'none';
                                        if (darkBackdrop) darkBackdrop.style.display = 'none';
                                        if (centerOverlay) centerOverlay.style.display = 'none';
                                        if (rightOverlay) rightOverlay.style.display = 'none';
                                        if (leftOverlay) leftOverlay.style.display = 'none';
                                    } catch (e) { }

                                    const spinner = previewRoot.querySelector('.size-16');
                                    if (spinner) spinner.classList.add('hidden');
                                }
                            } catch (e) { /* ignore preview wiring */ }
                        } catch (e) { /* ignore output wiring */ }

                        // hide cancel button (if present)
                        try { const cb = document.getElementById('cancel-generation-btn'); if (cb) cb.classList.add('hidden'); } catch (e) { }

                        // once complete, unsubscribe from realtime updates (we still expose unsubscribe for debugging)
                        // try { if (window.__generationSnapshotUnsubscribe) { window.__generationSnapshotUnsubscribe(); } } catch (e) { /* ignore */ }
                        // no need to continue with other rendering for completed status
                    }
                } catch (e) { /* ignore status handling */ }

                // Render pipeline tasks: uses `tasks` array as source of truth and `executedTasks` for status
                try {
                    const pipelineContainer = document.getElementById('generation-pipeline');
                    // Determine active executing name for deduping the pipeline title
                    let activeExecutingName = null;
                    let isActiveExecuting = false;
                    try {
                        const tasksLocal = Array.isArray(data.tasks) ? data.tasks : [];
                        if (typeof data.currentTaskIdx === 'number' && tasksLocal.length > 0 && data.currentTaskIdx >= 0 && data.currentTaskIdx < tasksLocal.length) {
                            const tcur = tasksLocal[data.currentTaskIdx];
                            activeExecutingName = tcur && (tcur.uniqueStepName || tcur.unique_step_name || tcur.name) || null;
                            isActiveExecuting = !!activeExecutingName;
                        }
                        if (!activeExecutingName) {
                            const executedLocal = Array.isArray(data.executedTasks) ? data.executedTasks : [];
                            const inProgLocal = executedLocal.find(e => (String(e.status || '').toUpperCase() === 'IN_PROGRESS'));
                            if (inProgLocal) {
                                activeExecutingName = inProgLocal.uniqueStepName || inProgLocal.unique_step_name || inProgLocal.name || null;
                                isActiveExecuting = !!activeExecutingName;
                            }
                        }
                    } catch (e) { /* ignore dedupe errors */ }
                    if (pipelineContainer && Array.isArray(data.tasks)) {
                        // Build a map of executed task statuses by uniqueStepName for quick lookup
                        const executed = Array.isArray(data.executedTasks) ? data.executedTasks : [];
                        const execMap = new Map();
                        executed.forEach(e => {
                            const key = e.uniqueStepName || e.unique_step_name || e.name;
                            if (key) execMap.set(key, e.status || 'UNKNOWN');
                        });

                        // currentTaskIdx relates to `tasks` array
                        const currentIdx = (typeof data.currentTaskIdx === 'number') ? data.currentTaskIdx : -1;

                        // render
                        // Build a filtered list of tasks to render (exclude SKIPPED) so we can correctly
                        // determine the last visible node and avoid rendering a connector below it.
                        const tasksArr = Array.isArray(data.tasks) ? data.tasks : [];
                        const renderList = [];
                        tasksArr.forEach((t, idx) => {
                            const name = t.uniqueStepName || t.unique_step_name || t.name || `step-${idx}`;
                            const status = execMap.get(name) || (idx < currentIdx ? 'SUCCESS' : (idx === currentIdx ? 'IN_PROGRESS' : 'PENDING'));
                            if (status === 'SKIPPED') return;
                            renderList.push({ t, idx, name, status });
                        });

                        pipelineContainer.innerHTML = '';
                        renderList.forEach((item, rIdx) => {
                            const { t, idx, name, status } = item;
                            // left column: icon / connector
                            const leftCol = document.createElement('div');
                            leftCol.className = 'flex flex-col items-center';
                            const circle = document.createElement('div');
                            circle.className = 'size-8 rounded-full flex items-center justify-center';
                            const connector = document.createElement('div');
                            connector.className = 'w-1 h-12 grow';

                            if (status === 'SUCCESS') {
                                circle.classList.add('bg-primary', 'text-background-dark');
                                circle.innerHTML = '<span class="material-symbols-outlined text-sm font-bold">check</span>';
                                connector.classList.add('bg-primary');
                            } else if (status === 'IN_PROGRESS') {
                                circle.classList.add('bg-background-dark', 'border-2', 'border-primary', 'text-primary');
                                circle.innerHTML = '<span class="material-symbols-outlined text-xl animate-spin">refresh</span>';
                                connector.classList.add('bg-border-dark');
                            } else {
                                // pending or unknown
                                circle.classList.add('bg-background-dark', 'border-2', 'border-border-dark', 'text-white/20');
                                circle.innerHTML = '<span class="material-symbols-outlined text-sm">schedule</span>';
                                connector.classList.add('bg-border-dark');
                            }

                            leftCol.appendChild(circle);
                            // connector for all except last visible node
                            if (rIdx !== renderList.length - 1) leftCol.appendChild(connector);

                            // right column: text
                            const rightCol = document.createElement('div');
                            rightCol.className = 'flex flex-col pb-6';
                            const title = document.createElement('p');
                            const hideDuplicate = (isActiveExecuting && activeExecutingName && (activeExecutingName === name));
                            title.className = (status === 'SUCCESS' ? 'text-white text-lg font-bold leading-none' : (status === 'IN_PROGRESS' ? 'text-primary text-lg font-bold leading-none' : 'text-white/40 text-lg font-bold leading-none')) + (hideDuplicate ? ' hidden' : '');
                            title.textContent = formatTaskLabel(name);
                            const subtitle = document.createElement('p');
                            subtitle.className = (status === 'SUCCESS' ? 'text-[#9abcbc] text-sm mt-1' : 'text-white/20 text-sm mt-1');
                            subtitle.textContent = (t.description || getDefaultDescriptionFor(name) || '');
                            rightCol.appendChild(title);
                            rightCol.appendChild(subtitle);

                            pipelineContainer.appendChild(leftCol);
                            pipelineContainer.appendChild(rightCol);
                        });
                    }
                } catch (e) { console.error('Pipeline render error', e); }
            } catch (e) { /* silent */ }
        }, (err) => {
            console.error('Snapshot listener error for', id, err);
        });

        // expose for debugging/unsubscribe later
        window.__generationSnapshotUnsubscribe = unsubscribe;
    } catch (e) {
        console.error('Failed to initialize generation snapshot listener', e);
    }
})();

// small helpers used when rendering pipeline
const stepDescriptions = {
    "load-topic": "Loading the next topic for generation",
    "notify-topics-exhausted": "No more topics available; notifying handler",
    "prepare-caption-and-category-generation": "Preparing to generate the captions and predict the adjusted category from topic",
    "generate-reel-caption": "Generating a social-ready caption for the reel",
    "prepare-script-prompt-epic-style": "Preparing an epic-style script prompt for narration",
    "generate-script": "Generating the narration script",
    "parse-script-response": "Parsing script output into structured frames and timings",
    "generate-audio-groq": "Synthesizing high-quality voiceover audio",
    "generate-audio": "Synthesizing high-quality voiceover audio",
    "generate-captions": "Generating subtitle captions from script",
    "generate-image-prompts-hindu": "Building image prompts",
    "generate-image-prompts-rel": "Building image prompts",
    "generate-image-prompts-default": "Building image prompts",
    "generate-images-pollinations": "Generating visual assets using Pollinations",
    "generate-images": "Generating visual assets using Pollinations",
    "prep-animation": "Preparing animation parameters and keyframes",
    "generate-depth-animation": "Generating depth-aware parallax animations",
    "generate-avatar-animation": "Generating avatar animations",
    "load-template": "Loading video template and layout",
    "load-audio-assets-meta": "Loading metadata for audio assets",
    "select-assets": "Selecting the best matching assets for each shot",
    "download-assets": "Downloading selected assets to local workspace",
    "generate-manuscript": "Compiling manuscript and shot list",
    "prepare-assets-to-export": "Packaging assets and timelines for export",
    "export-assets": "Exporting final video assets",
    "trigger-render": "Triggering rendering job on render farm",
    "notify": "Sending notifications about generation progress",
    "prepare-schedule-post": "Preparing social post metadata for scheduling",
    "schedule": "Scheduling the post for publishing",
    "update-topic": "Marking topic as completed",
};

function formatTaskLabel(name) {
    // humanize common step keys
    return String(name).replace(/[-_]/g, ' ').replace(/\b(load|generate|prepare|select|download|export|trigger|notify|schedule|update)\b/gi, function (m) { return m.charAt(0).toUpperCase() + m.slice(1); });
}

function getDefaultDescriptionFor(name) {
    const key = String(name).toLowerCase();
    if (stepDescriptions[key]) return stepDescriptions[key];
    // fallback heuristics
    if (key.includes('script')) return 'AI Storyboard and voiceover script finalized.';
    if (key.includes('voice')) return 'Realistic narration synthesized with background mix.';
    if (key.includes('asset') || key.includes('image') || key.includes('generate-images')) return 'Rendering frames and visual assets...';
    if (key.includes('synth') || key.includes('export')) return 'Merging layers, applying transitions and FX.';
    return '';
}

// Determine the currently executing task using executedTasks -> tasks mapping.
// Logic: take the last entry in `executedTasks`, find that task in `tasks`,
// and return the task immediately after it (the next task) as the current executing task.
// If there are no executedTasks, return the first task. Returns the task object or null.
function getCurrentlyExecutingTask(data) {
    try {
        const tasks = Array.isArray(data.tasks) ? data.tasks : [];
        const executed = Array.isArray(data.executedTasks) ? data.executedTasks : [];
        if (!tasks.length) return null;
        if (!executed.length) return tasks[0] || null;

        const last = executed[executed.length - 1];
        const lastKey = last && (last.uniqueStepName || last.unique_step_name || last.name);
        if (!lastKey) return tasks[0] || null;

        const idx = tasks.findIndex(t => {
            const n = t && (t.uniqueStepName || t.unique_step_name || t.name);
            return n === lastKey;
        });

        if (idx === -1) return tasks[0] || null;
        if (idx < tasks.length - 1) return tasks[idx + 1] || null;
        // last executed is the final task — return it as current (or null)
        return tasks[idx] || null;
    } catch (e) {
        return null;
    }
}

// Setup Cancel Generation button handler: calls DELETE /api/generate/<id>, hides button, shows stopped UI
(function setupCancelGeneration() {
    try {
        const btn = document.getElementById('cancel-generation-btn');
        if (!btn) return;

        btn.addEventListener('click', async (ev) => {
            ev.preventDefault();
            try {
                btn.disabled = true;
                const params = new URLSearchParams(window.location.search || '');
                const id = params.get('id');
                if (!id) {
                    alert('No generation id found in URL');
                    btn.disabled = false;
                    return;
                }

                const res = await fetch(`/api/generate/${encodeURIComponent(id)}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (!res.ok) {
                    let bodyText = await res.text().catch(() => res.statusText || '');
                    console.error('Cancel failed', res.status, bodyText);
                    alert('Failed to cancel generation: ' + (bodyText || res.status));
                    btn.disabled = false;
                    return;
                }

                // success: update UI
                try {
                    // hide the cancel button
                    btn.classList.add('hidden');

                    // hide or reset progress visuals
                    const percentEl = document.querySelector('[data-generation-percent]');
                    const barEl = document.querySelector('[data-generation-bar]');
                    const msgEl = document.querySelector('[data-generation-message]');
                    const stoppedEl = document.getElementById('generation-stopped');

                    if (percentEl) percentEl.textContent = 'Stopped';
                    if (barEl) {
                        barEl.style.width = '0%';
                        barEl.classList.add('hidden');
                    }
                    if (msgEl) msgEl.textContent = 'Generation stopped';
                    if (stoppedEl) stoppedEl.classList.remove('hidden');

                    // unsubscribe from realtime updates if available
                    if (window.__generationSnapshotUnsubscribe) {
                        try { window.__generationSnapshotUnsubscribe(); } catch (e) { /* ignore */ }
                    }
                } catch (e) { console.error('UI update after cancel failed', e); }

            } catch (e) {
                console.error('Cancel error', e);
                alert('Cancel request failed');
                try { btn.disabled = false; } catch (e) { }
            }
        });
    } catch (e) { /* ignore setup */ }
})();

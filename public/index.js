// Collects form values using listeners and generates the required object
function setupFormListeners() {
    // Language buttons
    const obj = {
        token: 'free',
        orientation: 'portrait',
        theme: 'general',
        duration: 1,
        language: 'english',
        speech_quality: 'neural',
        resolution: '360p',
        delivery_email: ''
    };


    // Use setupToggleActive for all applicable button groups
    setupToggleActive('[data-orientation]', 'data-orientation', 'orientation', null, obj);
    setupToggleActive('[data-theme]', 'data-theme', 'theme', null, obj);
    setupToggleActive('[data-resolution]', 'data-resolution', 'resolution', null, obj);
    setupToggleActive('[data-speech-quality]', 'data-speech-quality', 'speech_quality', null, obj);
    setupToggleActive('[data-duration]', 'data-duration', 'duration', v => Number(v), obj);
    setupToggleActive('[data-language]', 'data-language', 'language', null, obj);

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
    if (tokenInput) {
        tokenInput.addEventListener('input', () => {
            obj.token = (tokenInput.value || '').trim() || 'free';
            updatePremiumUI();
        });
    }

    // Delivery Email
    const emailInput = document.querySelector('[data-delivery-email]');
    if (emailInput) {
        // initialize object from prefilled value (avoid false-invalid state on load)
        try {
            const initial = (emailInput.value || '').trim();
            if (initial) obj.delivery_email = initial;
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
            obj.delivery_email = emailInput.value;
            // clear inline error and visual highlight
            if (emailErrorEl) emailErrorEl.classList.add('hidden');
            emailInput.classList.remove('ring-2', 'ring-red-500', 'border-red-500');
            emailInput.setAttribute('aria-invalid', 'false');
        });
    }

    // Token (example: set from elsewhere)
    // obj.token = ...

    // Prompt textarea: update object as text changes
    const promptEl = document.querySelector('[data-prompt]');
    if (promptEl) {
        promptEl.addEventListener('input', () => {
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

                // navigate to generate.html with id
                window.location.href = `generate.html?id=${encodeURIComponent(id)}`;
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
    const premiumSelectors = ['[data-resolution]', '[data-speech-quality]', '[data-duration]'];
    const premiumButtons = Array.from(document.querySelectorAll(premiumSelectors.join(',')));
    // Values that are allowed for free (not premium)
    const exemptValues = {
        'data-resolution': ['360p'],
        'data-speech-quality': ['neural'],
        'data-duration': ['1']
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
        duration: 'flex-1 py-2 text-sm font-bold rounded-lg bg-primary text-background-dark',
        theme: 'flex-1 py-2 text-xs font-bold rounded bg-primary/20 border border-primary/50 text-primary',
        language: 'text-sm font-semibold text-primary bg-transparent px-2 py-1 rounded',
    };
    const groupInactiveClass = {
        orientation: 'flex-1 flex flex-col items-center gap-2 py-3 rounded-lg border-2 border-transparent bg-slate-100 dark:bg-background-dark hover:bg-slate-200 dark:hover:bg-border-muted transition-all',
        resolution: 'flex-1 py-2 text-xs font-bold rounded bg-slate-100 dark:bg-background-dark border border-transparent',
        speech_quality: 'py-2 text-xs font-bold rounded bg-slate-100 dark:bg-background-dark border border-transparent',
        duration: 'flex-1 py-2 text-sm font-bold rounded-lg bg-slate-100 dark:bg-background-dark text-slate-500',
        theme: 'flex-1 py-2 text-xs font-bold rounded bg-slate-100 dark:bg-background-dark border border-transparent',
        language: 'text-sm font-semibold text-slate-500 bg-transparent px-2 py-1 rounded',
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

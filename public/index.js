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
                'General / Cinematic': 'general',
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
        btn.classList.add('premium-outline');
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
        btn.classList.remove('premium-outline');
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

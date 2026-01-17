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
        resolution: 'HD',
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

    // Delivery Email
    const emailInput = document.querySelector('[data-delivery-email]');
    if (emailInput) {
        emailInput.addEventListener('input', () => {
            obj.delivery_email = emailInput.value;
        });
    }

    // Token (example: set from elsewhere)
    // obj.token = ...

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
                });
            }
            btn.className = groupActiveClass[objKey] || btn.className;
            obj[objKey] = valueTransform ? valueTransform(btn.getAttribute(valueKey)) : btn.getAttribute(valueKey);
            console.log(JSON.stringify(obj, null, 2));
        });
    });
}
// Usage:
// const getFormData = setupFormListeners();
// ... later: const data = getFormData();

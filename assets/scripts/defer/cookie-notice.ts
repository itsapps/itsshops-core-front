// --- INTERFACES AND CONSTANTS ---

interface CookieConsent {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
  version: number;
}

const COOKIE_CONSENT_KEY = 'cookie-consent';
const COOKIE_CONSENT_VERSION = 1;

// --- DOM ELEMENTS ---

let cookieNotice: HTMLElement | null;
let cookieDetails: HTMLElement | null;
let analyticsCheckbox: HTMLInputElement | null;
let marketingCheckbox: HTMLInputElement | null;
let rejectAllBtn: HTMLButtonElement | null;
let acceptAllBtn: HTMLButtonElement | null;
let savePreferencesBtn: HTMLButtonElement | null;
let openSettingsBtn: HTMLButtonElement | null;
let closeSettingsBtn: HTMLButtonElement | null;
let editCookiesBtn: HTMLButtonElement | null;
let acceptAllSettingsBtn: HTMLButtonElement | null;

const getDOMElements = () => {
  cookieNotice = document.getElementById('cookie-notice') as HTMLElement;
  cookieDetails = document.querySelector('.cookie-notice--details') as HTMLElement;
  analyticsCheckbox = document.getElementById('analytics-consent') as HTMLInputElement;
  marketingCheckbox = document.getElementById('marketing-consent') as HTMLInputElement;
  rejectAllBtn = document.getElementById('cookie-reject-all') as HTMLButtonElement;
  acceptAllBtn = document.getElementById('cookie-accept-all') as HTMLButtonElement;
  savePreferencesBtn = document.getElementById('cookie-save-preferences') as HTMLButtonElement;
  openSettingsBtn = document.getElementById('cookie-open-settings') as HTMLButtonElement;
  closeSettingsBtn = document.getElementById('cookie-close-settings') as HTMLButtonElement;
  editCookiesBtn = document.getElementById('edit-cookies-button') as HTMLButtonElement;
  acceptAllSettingsBtn = document.getElementById('cookie-accept-all-settings') as HTMLButtonElement;
};

// --- FOCUS TRAP (for accessibility) ---

let focusableElements: HTMLElement[] = [];
let firstFocusableElement: HTMLElement | null;
let lastFocusableElement: HTMLElement | null;
let previouslyFocusedElement: HTMLElement | null;

const setupFocusTrap = () => {
  if (!cookieDetails) return;
  
  focusableElements = Array.from(
    cookieDetails.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );

  firstFocusableElement = focusableElements[0];
  lastFocusableElement = focusableElements[focusableElements.length - 1];
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key !== 'Tab') return;

  if (e.shiftKey) { // Shift + Tab
    if (document.activeElement === firstFocusableElement) {
      lastFocusableElement?.focus();
      e.preventDefault();
    }
  } else { // Tab
    if (document.activeElement === lastFocusableElement) {
      firstFocusableElement?.focus();
      e.preventDefault();
    }
  }
};

const activateFocusTrap = () => {
  previouslyFocusedElement = document.activeElement as HTMLElement;
  setupFocusTrap();
  firstFocusableElement?.focus();
  document.addEventListener('keydown', handleKeyDown);
};

const deactivateFocusTrap = () => {
  document.removeEventListener('keydown', handleKeyDown);
  previouslyFocusedElement?.focus();
};


// --- COOKIE CONSENT LOGIC ---

const getSavedConsent = (): CookieConsent | null => {
  try {
    const saved = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!saved) return null;
    const parsed: CookieConsent = JSON.parse(saved);
    if (parsed.version !== COOKIE_CONSENT_VERSION) {
      localStorage.removeItem(COOKIE_CONSENT_KEY);
      return null;
    }
    return parsed;
  } catch (error) {
    console.error('Error reading cookie consent:', error);
    return null;
  }
};

const saveConsent = (consent: Partial<CookieConsent>) => {
  try {
    const consentData: CookieConsent = {
      essential: true,
      analytics: consent.analytics ?? false,
      marketing: consent.marketing ?? false,
      timestamp: Date.now(),
      version: COOKIE_CONSENT_VERSION,
    };
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consentData));
    return consentData;
  } catch (error) {
    console.error('Error saving cookie consent:', error);
    return null;
  }
};

const hasConsentDecision = (): boolean => getSavedConsent() !== null;

const initConsentMode = () => {
  (window as any).dataLayer = (window as any).dataLayer || [];
  function gtag(...args: any[]) {
    (window as any).dataLayer.push(args);
  }
  (window as any).gtag = gtag;

  // Default: deny everything
  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    wait_for_update: 500
  });
};

const applyConsent = (consent: CookieConsent) => {
  if (!(window as any).gtag) return;

  (window as any).gtag('consent', 'update', {
    analytics_storage: consent.analytics ? 'granted' : 'denied',
    ad_storage: consent.marketing ? 'granted' : 'denied'
  });
};


// --- ANALYTICS SCRIPT LOADER ---

const loadGTM = () => {
  const gtmId = cookieNotice?.dataset?.gtmId || (window as any).__GTM_ID;
  if (!gtmId) return;

  if (document.querySelector(`script[src*="gtm.js?id=${gtmId}"]`)) return;

  (function(w: any, d: Document, s: string, l: string, i: string) {
    w[l] = w[l] || [];
    w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    const f = d.getElementsByTagName(s)[0];
    const j = d.createElement(s) as HTMLScriptElement;
    const dl = l !== 'dataLayer' ? '&l=' + l : '';
    j.async = true;
    j.src = `https://www.googletagmanager.com/gtm.js?id=${i}${dl}`;
    f.parentNode?.insertBefore(j, f);
  })(window, document, 'script', 'dataLayer', gtmId);
};

// const loadAnalytics = () => {
//   const consent = getSavedConsent() || { analytics: false };
//   const gtmId = cookieNotice?.dataset?.gtmId || (window as any).__GTM_ID || '';

//   if (!gtmId) return;

//   if (!consent.analytics) {
//     try {
//       (window as any)[`ga-disable-${gtmId}`] = true;
//     } catch (e) {}
//     return;
//   }
  
//   if (document.querySelector(`script[src*="${gtmId}"]`)) return;

//   // const script = document.createElement('script');
//   // script.async = true;
//   // script.src = `https://www.googletagmanager.com/gtag/js?id=${gtmId}`;
//   // document.head.appendChild(script);

//   // (window as any).dataLayer = (window as any).dataLayer || [];
//   // const gtag = (...args: any[]) => { (window as any).dataLayer.push(args); };
//   // (window as any).gtag = gtag;
//   // gtag('js', new Date());
//   // gtag('config', gtmId);

//   // GTM snippet
//   (function(w: any, d: Document, s: string, l: string, i: string) {
//     w[l] = w[l] || [];
//     w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
//     const f = d.getElementsByTagName(s)[0];
//     const j = d.createElement(s) as HTMLScriptElement;
//     const dl = l != 'dataLayer' ? '&l=' + l : '';
//     j.async = true;
//     j.src = `https://www.googletagmanager.com/gtm.js?id=${i}${dl}`;
//     f.parentNode?.insertBefore(j, f);
//   })(window, document, 'script', 'dataLayer', gtmId);

//   (window as any).dataLayer = (window as any).dataLayer || [];

//   // Optional noscript
//   const ns = document.createElement('noscript');
//   ns.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
//   document.body.insertBefore(ns, document.body.firstChild);
// };


// --- UI CONTROL ---

const showCookieNotice = () => {
  if (!cookieNotice) return;
  cookieNotice.removeAttribute('hidden');
};

const hideCookieNotice = () => {
  if (!cookieNotice) return;
  cookieNotice.setAttribute('hidden', '');
  hideDetails();
};

const showDetails = () => {
  if (!cookieNotice) return;
  cookieNotice.classList.add('is-expanded');
  activateFocusTrap();
};

const hideDetails = () => {
  if (!cookieNotice) return;
  cookieNotice.classList.remove('is-expanded');
  deactivateFocusTrap();
};

const hide = () => {
  if (hasConsentDecision()) {
    hideCookieNotice();
  } else {
    hideDetails();
  }
}

const handleAcceptAll = () => {
  const consent = saveConsent({ analytics: true, marketing: true });
  applyConsent(consent!);
  loadGTM();
  hideCookieNotice();
}

const updateCheckboxStates = () => {
  const consent = getSavedConsent();
  if (!consent) {
    if (analyticsCheckbox) analyticsCheckbox.checked = false;
    if (marketingCheckbox) marketingCheckbox.checked = false;
    return;
  }

  if (analyticsCheckbox) analyticsCheckbox.checked = consent.analytics;
  if (marketingCheckbox) marketingCheckbox.checked = consent.marketing;
};


const setupEventListeners = () => {
  acceptAllBtn?.addEventListener('click', handleAcceptAll);
  acceptAllSettingsBtn?.addEventListener('click', handleAcceptAll);

  rejectAllBtn?.addEventListener('click', () => {
    const consent = saveConsent({ analytics: false, marketing: false });
    applyConsent(consent!);
    loadGTM(); // OK: GTM loads but fires nothing
    hideCookieNotice();

    // saveConsent({ analytics: false, marketing: false });

    // const gtmId = cookieNotice?.dataset?.gtmId || (window as any).__GTM_ID;
    // if (gtmId) {
    //   (window as any)[`ga-disable-${gtmId}`] = true;
    // }

    // hideCookieNotice();
    // loadAnalytics();
  });

  savePreferencesBtn?.addEventListener('click', () => {
    const consent = saveConsent({
      analytics: analyticsCheckbox?.checked ?? false,
      marketing: marketingCheckbox?.checked ?? false,
    });

    applyConsent(consent!);
    loadGTM();
    hideCookieNotice();
  });
  
  openSettingsBtn?.addEventListener('click', () => {
    updateCheckboxStates();
    showDetails();
  });

  closeSettingsBtn?.addEventListener('click', hide);
  
  editCookiesBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    showCookieNotice();
    updateCheckboxStates();
    showDetails();
  });

  // Also hide details if user clicks overlay
  cookieNotice?.querySelector('.cookie-notice--overlay')?.addEventListener('click', hide);
  
  // Hide notice entirely if escape key is pressed while details are open
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && cookieNotice?.classList.contains('is-expanded')) {
      hide();
    }
  });
};

// --- INITIALIZATION ---

const init = () => {
  getDOMElements();
  if (!cookieNotice) return;

  initConsentMode();

  const consent = getSavedConsent();
  if (consent) {
    applyConsent(consent);
    loadGTM();
  } else {
    showCookieNotice();
  }

  updateCheckboxStates();
  setupEventListeners();
};


if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

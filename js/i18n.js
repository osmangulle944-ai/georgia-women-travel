/* =========================================================
   Language engine + flag switcher
   - Dictionaries live in i18n/<code>.js and register on window.I18N.<code>
   - English is always the default; a visitor's choice is remembered
     (localStorage) and shareable (?lang=xx).
   - Every element with data-i18n / data-i18n-placeholder / data-i18n-aria /
     data-i18n-alt is re-rendered on every switch; missing keys fall back to English.
   ========================================================= */
(function () {
  'use strict';

  /* Ordered by likelihood of luxury travellers to Georgia (English is default). */
  var LANGS = [
    { code: 'en', html: 'en',    dir: 'ltr', flag: 'us', native: 'English',          label: 'English' },
    { code: 'ar', html: 'ar',    dir: 'rtl', flag: 'sa', native: 'العربية',           label: 'Arabic' },
    { code: 'ru', html: 'ru',    dir: 'ltr', flag: 'ru', native: 'Русский',          label: 'Russian' },
    { code: 'tr', html: 'tr',    dir: 'ltr', flag: 'tr', native: 'Türkçe',           label: 'Turkish' },
    { code: 'de', html: 'de',    dir: 'ltr', flag: 'de', native: 'Deutsch',          label: 'German' },
    { code: 'uk', html: 'uk',    dir: 'ltr', flag: 'ua', native: 'Українська',       label: 'Ukrainian' },
    { code: 'zh', html: 'zh-CN', dir: 'ltr', flag: 'cn', native: '中文',              label: 'Chinese' },
    { code: 'ko', html: 'ko',    dir: 'ltr', flag: 'kr', native: '한국어',             label: 'Korean' },
    { code: 'hi', html: 'hi',    dir: 'ltr', flag: 'in', native: 'हिन्दी',             label: 'Hindi' },
    { code: 'fr', html: 'fr-CH', dir: 'ltr', flag: 'ch', native: 'Français (Suisse)', label: 'Swiss French' },
    { code: 'ka', html: 'ka',    dir: 'ltr', flag: 'ge', native: 'ქართული',          label: 'Georgian' }
  ];

  /* Extra Google Fonts for scripts the Latin fonts do not cover. */
  var FONTS = {
    ka: 'family=Noto+Sans+Georgian:wght@300;400;500;600&family=Noto+Serif+Georgian:wght@400;500',
    ar: 'family=Noto+Naskh+Arabic:wght@400;500;600&family=Noto+Sans+Arabic:wght@300;400;500;600',
    hi: 'family=Noto+Sans+Devanagari:wght@300;400;500;600&family=Noto+Serif+Devanagari:wght@400;500',
    zh: 'family=Noto+Sans+SC:wght@300;400;500&family=Noto+Serif+SC:wght@400;500',
    ko: 'family=Noto+Sans+KR:wght@300;400;500&family=Noto+Serif+KR:wght@400;500'
  };

  var DEFAULT = 'en';
  var STORAGE_KEY = 'gwtc.lang';
  var ALIASES = { ua: 'uk', ge: 'ka', cn: 'zh', kr: 'ko', sa: 'ar', ch: 'fr', us: 'en', gb: 'en' };

  var dicts = window.I18N = window.I18N || {};
  var pending = {};
  var current = null;
  var requestId = 0;
  var root = document.documentElement;

  /* Resolve the i18n folder from the en.js <script> so it works on file:// and in sub-folders. */
  var EN_SCRIPT = document.querySelector('script[src*="i18n/en.js"]');
  var BASE = EN_SCRIPT ? EN_SCRIPT.src.replace(/en\.js(\?.*)?$/, '') : 'i18n/';
  /* Cache-busting: language files reuse the ?v=… query of en.js. */
  var VERSION = EN_SCRIPT ? (EN_SCRIPT.src.match(/\?.*$/) || [''])[0] : '';

  function find(code) {
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === code) return LANGS[i];
    return null;
  }

  function normalize(value) {
    if (!value) return null;
    var c = String(value).trim().toLowerCase().replace('_', '-');
    if (find(c)) return c;
    if (ALIASES[c]) return ALIASES[c];
    var base = c.split('-')[0];
    if (find(base)) return base;
    return ALIASES[base] || null;
  }

  function loadDict(code) {
    if (dicts[code]) return Promise.resolve(dicts[code]);
    if (pending[code]) return pending[code];
    pending[code] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = BASE + code + '.js' + VERSION;
      s.async = true;
      s.onload = function () {
        delete pending[code];
        if (dicts[code]) resolve(dicts[code]);
        else reject(new Error('[i18n] ' + code + '.js loaded but did not register window.I18N.' + code));
      };
      s.onerror = function () {
        delete pending[code];
        if (s.parentNode) s.parentNode.removeChild(s);
        reject(new Error('[i18n] could not load ' + s.src));
      };
      document.head.appendChild(s);
    });
    return pending[code];
  }

  function ensureFonts(code) {
    if (!FONTS[code] || document.getElementById('font-' + code)) return;
    var link = document.createElement('link');
    link.id = 'font-' + code;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?' + FONTS[code] + '&display=swap';
    document.head.appendChild(link);
  }

  var warned = {};
  function translate(dict, key) {
    var v = dict && dict[key];
    if (typeof v === 'string' && v !== '') return v;
    if (!warned[key] && dict !== dicts.en) {
      warned[key] = true;
      if (window.console) console.warn('[i18n] missing "' + key + '" in ' + current + ' — using English');
    }
    v = dicts.en && dicts.en[key];
    return typeof v === 'string' ? v : null;
  }

  function each(selector, fn) {
    var list = document.querySelectorAll(selector);
    for (var i = 0; i < list.length; i++) fn(list[i]);
  }

  /* Re-render every translatable node on the page. */
  function render(dict) {
    each('[data-i18n]', function (el) {
      var v = translate(dict, el.getAttribute('data-i18n'));
      if (v !== null && el.textContent !== v) el.textContent = v;
    });
    each('[data-i18n-placeholder]', function (el) {
      var v = translate(dict, el.getAttribute('data-i18n-placeholder'));
      if (v !== null) el.setAttribute('placeholder', v);
    });
    each('[data-i18n-aria]', function (el) {
      var v = translate(dict, el.getAttribute('data-i18n-aria'));
      if (v !== null) el.setAttribute('aria-label', v);
    });
    each('[data-i18n-alt]', function (el) {
      var v = translate(dict, el.getAttribute('data-i18n-alt'));
      if (v !== null) el.setAttribute('alt', v);
    });
    var title = translate(dict, 'meta.title');
    if (title) document.title = title;
    var desc = translate(dict, 'meta.description');
    var meta = document.querySelector('meta[name="description"]');
    if (desc && meta) meta.setAttribute('content', desc);
  }

  function persist(code) {
    try { window.localStorage.setItem(STORAGE_KEY, code); } catch (e) { /* storage blocked */ }
  }
  function readStored() {
    try { return window.localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function updateUrl(code) {
    try {
      var url = new URL(window.location.href);
      if (code === DEFAULT) url.searchParams.delete('lang');
      else url.searchParams.set('lang', code);
      if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url.href);
    } catch (e) { /* file:// or sandbox: ignore */ }
  }

  /* Public: switch the whole site to a language. Returns a Promise. */
  function setLanguage(code, opts) {
    opts = opts || {};
    var lang = find(normalize(code)) || find(DEFAULT);
    var id = ++requestId;
    root.classList.add('is-switching');
    setBusy(true);

    return loadDict(lang.code).then(function (dict) {
      if (id !== requestId) return;               // a newer click won
      ensureFonts(lang.code);
      current = lang.code;
      root.setAttribute('lang', lang.html);
      root.setAttribute('dir', lang.dir);
      render(dict);
      updateSwitcher(lang);
      if (opts.persist !== false) persist(lang.code);
      if (opts.url !== false) updateUrl(lang.code);
      document.dispatchEvent(new CustomEvent('site:languagechange', { detail: { lang: lang.code, html: lang.html, dir: lang.dir } }));
    }).catch(function (err) {
      if (window.console) console.error(err);
      if (id === requestId && lang.code !== DEFAULT) return setLanguage(DEFAULT, { persist: false });
    }).then(function () {
      if (id === requestId) { root.classList.remove('is-switching'); setBusy(false); }
    });
  }

  function t(key) { return translate(dicts[current] || dicts.en, key) || ''; }

  /* ---------------- Switcher UI ---------------- */
  var btn = document.getElementById('langButton');
  var list = document.getElementById('langList');
  var flagEl = document.getElementById('langCurrentFlag');
  var nameEl = document.getElementById('langCurrentName');
  var options = [];
  var activeIndex = 0;

  function buildList() {
    if (!list) return;
    var frag = document.createDocumentFragment();
    LANGS.forEach(function (lang, i) {
      var li = document.createElement('li');
      li.className = 'lang__option';
      li.id = 'lang-opt-' + lang.code;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      li.setAttribute('data-lang', lang.code);
      li.setAttribute('data-script', lang.code);
      li.setAttribute('lang', lang.html);
      // Row layout stays LTR for every language (flag left, label right);
      // only the native name itself gets its own text direction.
      li.setAttribute('dir', 'ltr');

      var flag = document.createElement('span');
      flag.className = 'fi fi-' + lang.flag;
      flag.setAttribute('aria-hidden', 'true');
      var nat = document.createElement('span');
      nat.className = 'lang__option-native';
      nat.textContent = lang.native;
      nat.setAttribute('dir', lang.dir);
      var en = document.createElement('span');
      en.className = 'lang__option-en';
      en.setAttribute('lang', 'en');
      en.setAttribute('aria-hidden', 'true');
      en.textContent = lang.label;

      li.appendChild(flag); li.appendChild(nat); li.appendChild(en);
      li.addEventListener('click', function () { choose(i); });
      li.addEventListener('mousemove', function () { focusOption(i); });
      frag.appendChild(li);
      options.push(li);
    });
    list.appendChild(frag);
  }

  function updateSwitcher(lang) {
    if (flagEl) flagEl.className = 'fi fi-' + lang.flag + ' lang__flag';
    if (nameEl) { nameEl.textContent = lang.native; nameEl.setAttribute('lang', lang.html); }
    options.forEach(function (li) {
      li.setAttribute('aria-selected', li.getAttribute('data-lang') === lang.code ? 'true' : 'false');
    });
  }

  function setBusy(on) { if (btn) btn.setAttribute('aria-busy', on ? 'true' : 'false'); }

  function focusOption(i) {
    if (!options.length) return;
    activeIndex = (i + options.length) % options.length;
    options.forEach(function (li, j) { li.classList.toggle('is-focused', j === activeIndex); });
    list.setAttribute('aria-activedescendant', options[activeIndex].id);
    var li = options[activeIndex];
    if (li.offsetTop < list.scrollTop) list.scrollTop = li.offsetTop;
    else if (li.offsetTop + li.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = li.offsetTop + li.offsetHeight - list.clientHeight;
  }

  function isOpen() { return list && !list.hidden; }

  function open() {
    if (!list || isOpen()) return;
    list.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    var idx = 0;
    options.forEach(function (li, j) { if (li.getAttribute('data-lang') === current) idx = j; });
    focusOption(idx);
    list.focus({ preventScroll: true });
  }

  function close(returnFocus) {
    if (!isOpen()) return;
    list.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    if (returnFocus) btn.focus({ preventScroll: true });
  }

  function choose(i) {
    var code = options[i] && options[i].getAttribute('data-lang');
    close(true);
    if (code && code !== current) setLanguage(code);
  }

  function bindSwitcher() {
    if (!btn || !list) return;
    btn.addEventListener('click', function () { isOpen() ? close(false) : open(); });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); }
    });
    list.addEventListener('keydown', function (e) {
      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); focusOption(activeIndex + 1); break;
        case 'ArrowUp': e.preventDefault(); focusOption(activeIndex - 1); break;
        case 'Home': e.preventDefault(); focusOption(0); break;
        case 'End': e.preventDefault(); focusOption(options.length - 1); break;
        case 'Enter': case ' ': e.preventDefault(); choose(activeIndex); break;
        case 'Escape': e.preventDefault(); close(true); break;
        case 'Tab': close(false); break;
      }
    });
    document.addEventListener('click', function (e) {
      if (isOpen() && !document.getElementById('langSwitcher').contains(e.target)) close(false);
    });
    window.addEventListener('blur', function () { close(false); });
  }

  /* ---------------- Boot ---------------- */
  function initialLanguage() {
    var fromUrl = null;
    try { fromUrl = new URL(window.location.href).searchParams.get('lang'); } catch (e) { /* ignore */ }
    return normalize(fromUrl) || normalize(readStored()) || DEFAULT;   // English for everyone by default
  }

  window.SiteI18n = {
    languages: LANGS.slice(),
    setLanguage: setLanguage,
    t: t,
    current: function () { return current; }
  };

  buildList();
  bindSwitcher();

  var first = initialLanguage();
  if (first === DEFAULT || dicts[first]) {
    // Synchronous first paint — no flash of untranslated text.
    var lang = find(first);
    current = lang.code;
    root.setAttribute('lang', lang.html);
    root.setAttribute('dir', lang.dir);
    ensureFonts(lang.code);
    render(dicts[lang.code] || {});
    updateSwitcher(lang);
    document.addEventListener('DOMContentLoaded', function () {
      document.dispatchEvent(new CustomEvent('site:languagechange', { detail: { lang: lang.code, html: lang.html, dir: lang.dir } }));
    });
  } else {
    current = DEFAULT;
    render(dicts.en || {});
    updateSwitcher(find(DEFAULT));
    setLanguage(first, { url: false });
  }
})();

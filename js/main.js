/* =========================================================
   Site behaviour: header, menu, hero video, photo faders,
   rotating words, FAQ, photo slots, contact form.
   ========================================================= */
(function () {
  'use strict';

  /* ---------- CONFIG ----------
     Paste your form service URL here (for example a Formspree endpoint
     "https://formspree.io/f/xxxxxxx"). While it is empty the form only
     validates and shows the success message — nothing is sent anywhere. */
  var FORM_ENDPOINT = '';
  var MAX_PHOTO_MB = 8;

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var t = function (key) { return window.SiteI18n ? window.SiteI18n.t(key) : key; };
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* Set a translatable message: the engine re-renders it if the language changes later. */
  function setI18nText(el, key) {
    el.setAttribute('data-i18n', key);
    el.textContent = t(key);
  }

  /* ---------- Header ---------- */
  var header = $('#siteHeader');
  function onScroll() { if (header) header.classList.toggle('is-solid', window.scrollY > 40); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Menu overlay ---------- */
  var menu = $('#siteMenu');
  var openBtn = $('#menuOpen');
  var closeBtn = $('#menuClose');

  function openMenu() {
    menu.hidden = false;
    document.body.classList.add('is-locked');
    openBtn.setAttribute('aria-expanded', 'true');
    closeBtn.focus();
  }
  function closeMenu(returnFocus) {
    if (menu.hidden) return;
    menu.hidden = true;
    document.body.classList.remove('is-locked');
    openBtn.setAttribute('aria-expanded', 'false');
    if (returnFocus) openBtn.focus();
  }
  if (menu && openBtn && closeBtn) {
    openBtn.addEventListener('click', openMenu);
    closeBtn.addEventListener('click', function () { closeMenu(true); });
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { closeMenu(false); }); });
    document.addEventListener('keydown', function (e) {
      if (menu.hidden) return;
      if (e.key === 'Escape') { closeMenu(true); return; }
      if (e.key === 'Tab') {                         // keep focus inside the menu
        var f = $$('button, a[href]', menu);
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ---------- Hero video: always autoplay (muted, inline) ---------- */
  var video = $('#heroVideo');
  if (video) {
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute('muted', '');
    var tryPlay = function () {
      var p = video.play();
      if (p && typeof p.catch === 'function') p.catch(function () { /* blocked: poster stays visible */ });
    };
    if (reduceMotion) {
      video.removeAttribute('autoplay');
      video.pause();
    } else {
      tryPlay();
      // Some browsers (low-power mode) block autoplay until the first interaction.
      var kick = function () {
        if (video.paused) tryPlay();
        ['touchstart', 'click', 'scroll', 'keydown'].forEach(function (ev) { window.removeEventListener(ev, kick); });
      };
      ['touchstart', 'click', 'scroll', 'keydown'].forEach(function (ev) { window.addEventListener(ev, kick, { passive: true }); });
      document.addEventListener('visibilitychange', function () { if (!document.hidden && video.paused) tryPlay(); });
    }
  }

  /* ---------- Faders: continuously changing photos ---------- */
  function Fader(el) {
    this.el = el;
    this.imgs = $$('.fader__img', el);
    this.index = Math.max(0, this.imgs.findIndex(function (i) { return i.classList.contains('is-active'); }));
    this.interval = parseInt(el.getAttribute('data-interval'), 10) || 5500;
    this.delay = parseInt(el.getAttribute('data-delay'), 10) || 0;
    this.visible = true;
    this.timer = null;
  }
  Fader.prototype.ready = function (img) { return img.complete && img.naturalWidth > 0; };
  Fader.prototype.next = function () {
    var self = this;
    if (!this.visible || document.hidden) return this.schedule(this.interval);
    var n = (this.index + 1) % this.imgs.length;
    var img = this.imgs[n];
    if (!this.ready(img)) {
      img.loading = 'eager';                        // make sure it is fetched, try again shortly
      return this.schedule(1200);
    }
    this.imgs[this.index].classList.remove('is-active');
    img.classList.add('is-active');
    this.index = n;
    // Warm up the following image so the next change is instant.
    var after = this.imgs[(n + 1) % this.imgs.length];
    if (after) after.loading = 'eager';
    self.schedule(this.interval);
  };
  Fader.prototype.schedule = function (ms) {
    var self = this;
    clearTimeout(this.timer);
    this.timer = setTimeout(function () { self.next(); }, ms);
  };
  Fader.prototype.start = function () {
    if (this.imgs.length < 2) return;
    this.schedule(this.interval + this.delay);
  };

  var faders = $$('[data-fader]').map(function (el) { return new Fader(el); });
  if (!reduceMotion) {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          faders.forEach(function (f) { if (f.el === entry.target) f.visible = entry.isIntersecting; });
        });
      }, { rootMargin: '200px 0px' });
      faders.forEach(function (f) { io.observe(f.el); });
    }
    faders.forEach(function (f) { f.start(); });
  }

  /* ---------- Rotating words ("This is travel, safe / private / …") ---------- */
  var words = $$('#rotator .rotator__word');
  if (words.length > 1 && !reduceMotion) {
    var w = 0;
    setInterval(function () {
      if (document.hidden) return;
      words[w].classList.remove('is-active');
      w = (w + 1) % words.length;
      words[w].classList.add('is-active');
    }, 2400);
  }

  /* ---------- FAQ accordion ---------- */
  $$('.faq__q').forEach(function (q) {
    q.addEventListener('click', function () {
      var expanded = q.getAttribute('aria-expanded') === 'true';
      var panel = document.getElementById(q.getAttribute('aria-controls'));
      q.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      if (panel) panel.hidden = expanded;
    });
  });

  /* ---------- Photo slots (companions + planner) ----------
     Set data-src="images/companions/companion-N.jpg" (etc.) on a slot to show
     a real photo. Empty data-src = "Add photo" placeholder (local preview only),
     so no requests are made for photos that do not exist yet. */
  function isImage(file) { return file && /^image\//.test(file.type); }
  function tooBig(file) { return file.size > MAX_PHOTO_MB * 1024 * 1024; }

  $$('[data-photo-slot]').forEach(function (slot) {
    var img = $('.photo-slot__img', slot);
    var add = $('.photo-slot__add', slot);
    var input = $('input[type="file"]', slot);
    var src = slot.getAttribute('data-src');
    var objectUrl = null;

    function show(url) {
      img.src = url;
      img.hidden = false;
      slot.classList.add('has-photo');
    }

    if (src) {
      var probe = new Image();
      probe.onload = function () {
        show(src);
        if (add) add.parentNode.removeChild(add);   // real photo in place: no upload control for visitors
      };
      probe.src = src;
    }

    if (input) {
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!isImage(file) || tooBig(file)) { input.value = ''; return; }
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(file);
        show(objectUrl);
      });
    }
  });

  /* ---------- Companion request buttons ---------- */
  var companionField = $('#companionField');
  var firstName = $('#firstName');
  $$('[data-companion]').forEach(function (b) {
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', function () {
      $$('[data-companion]').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); o.classList.remove('is-selected'); });
      b.setAttribute('aria-pressed', 'true');
      b.classList.add('is-selected');
      if (companionField) companionField.value = 'Companion ' + b.getAttribute('data-companion');
      var join = document.getElementById('join');
      if (join) join.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      if (firstName) setTimeout(function () { firstName.focus({ preventScroll: true }); }, reduceMotion ? 0 : 700);
    });
  });

  /* ---------- Contact form ---------- */
  var form = $('#joinForm');
  if (form) {
    var status = $('#formStatus');
    var submit = $('#submitBtn');
    var photo = $('#photo');
    var preview = $('#photoPreview');
    var photoName = $('#photoName');
    var langField = $('#languageField');
    var previewUrl = null;

    document.addEventListener('site:languagechange', function (e) {
      if (langField && e.detail) langField.value = e.detail.lang;
    });
    if (langField && window.SiteI18n) langField.value = window.SiteI18n.current() || 'en';

    function clearPhoto() {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = null;
      preview.hidden = true;
      preview.removeAttribute('src');
      photoName.textContent = '';
    }

    photo.addEventListener('change', function () {
      var file = photo.files && photo.files[0];
      clearPhoto();
      if (!file) return;
      if (!isImage(file) || tooBig(file)) { photo.value = ''; return; }
      previewUrl = URL.createObjectURL(file);
      preview.src = previewUrl;
      preview.hidden = false;
      photoName.textContent = file.name;
    });

    function showStatus(key, type) {
      status.hidden = false;
      status.className = 'form__status ' + (type === 'error' ? 'is-error' : 'is-success');
      setI18nText(status, key);
    }

    function fieldOf(input) { return input.closest('.field'); }
    function markInvalid(input, bad) { var f = fieldOf(input); if (f) f.classList.toggle('is-invalid', bad); input.setAttribute('aria-invalid', bad ? 'true' : 'false'); }

    $$('input, textarea', form).forEach(function (input) {
      input.addEventListener('input', function () { markInvalid(input, false); });
      input.addEventListener('change', function () { markInvalid(input, false); });
    });

    function validate() {
      var bad = [];
      ['firstName', 'lastName'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el.value.trim()) bad.push(el);
      });
      var phone = $('#phone');
      var digits = (phone.value.match(/\d/g) || []).length;
      if (digits < 7 || digits > 15 || /[^\d\s()+\-.]/.test(phone.value)) bad.push(phone);
      var email = $('#email');
      if (email.value.trim() && !email.checkValidity()) bad.push(email);
      var consent = $('#consent');
      if (!consent.checked) bad.push(consent);
      $$('input, textarea', form).forEach(function (el) { markInvalid(el, bad.indexOf(el) !== -1); });
      return bad;
    }

    function setSending(on) {
      submit.disabled = on;
      setI18nText(submit, on ? 'join.sending' : 'join.submit');
    }

    function done() {
      form.reset();
      clearPhoto();
      if (companionField) companionField.value = '';
      $$('[data-companion]').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); o.classList.remove('is-selected'); });
      if (langField && window.SiteI18n) langField.value = window.SiteI18n.current() || 'en';
      showStatus('join.success', 'success');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submit.disabled) return;
      var bad = validate();
      if (bad.length) {
        showStatus('join.error', 'error');
        bad[0].focus();
        return;
      }
      status.hidden = true;
      setSending(true);

      if (!FORM_ENDPOINT) {
        if (window.console) console.info('[form] FORM_ENDPOINT is empty in js/main.js — the request was validated but not sent.');
        setTimeout(function () { setSending(false); done(); }, 600);
        return;
      }

      fetch(FORM_ENDPOINT, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); })
        .then(function () { setSending(false); done(); })
        .catch(function (err) {
          if (window.console) console.error('[form]', err);
          setSending(false);
          showStatus('join.failed', 'error');
        });
    });
  }

  /* ---------- Footer year ---------- */
  var year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
})();

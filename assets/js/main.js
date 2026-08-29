/* ==========================================================================
   Olive Grey School — motion engine
   Vanilla JS. No dependencies. Everything degrades with prefers-reduced-motion.
   ========================================================================== */
(function () {
  'use strict';

  /* One source of truth, resolved in the <head> before first paint and
     recorded on <html data-motion>. Reading it here rather than the media
     query directly means the CSS and the JS can never disagree, and the
     ?motion= override reaches both.

       full — nothing was asked for; everything runs
       calm — the device asked for less motion
       off  — no JavaScript; the page is complete and entirely still

     "Less motion" is not "no motion". What the preference exists to prevent
     is movement that can make a reader ill: parallax, drifting layers, a
     photograph slowly zooming behind text, letters flying in from the side —
     large or scroll-coupled movement nobody asked for. A carousel turning in
     its own frame and a strip of type drifting at a constant rate are
     contained and predictable, so they stay. Fades stay too; opacity is not
     motion. */
  var mode   = document.documentElement.getAttribute('data-motion') || 'off';
  var motion = mode !== 'off';
  var calm   = mode === 'calm';
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ------------------------------------------------------------------------
     1. Split text — wraps each letter/word so it can be staggered in.
        data-split="letters" | "words"   data-stagger="0.03"
     ------------------------------------------------------------------------ */
  function splitText(el) {
    var mode = el.getAttribute('data-split') || 'words';
    var step = parseFloat(el.getAttribute('data-stagger')) || (mode === 'letters' ? 0.03 : 0.055);
    var base = parseFloat(el.getAttribute('data-delay')) || 0;
    var source = el.textContent.trim().replace(/\s+/g, ' ');
    var tokens = mode === 'letters' ? source.split('') : source.split(' ');
    var frag = document.createDocumentFragment();
    var i = 0;

    tokens.forEach(function (token, idx) {
      if (token === ' ') { frag.appendChild(document.createTextNode(' ')); return; }
      var line = document.createElement('span');
      line.className = 'split-line';
      var unit = document.createElement('span');
      unit.className = 'split-unit';
      unit.textContent = token;
      unit.style.setProperty('--d', (base + i * step).toFixed(3) + 's');
      line.appendChild(unit);
      frag.appendChild(line);
      if (mode === 'words' && idx < tokens.length - 1) frag.appendChild(document.createTextNode(' '));
      i++;
    });

    el.setAttribute('aria-label', source);
    el.textContent = '';
    el.appendChild(frag);
    // The visible text is now decorative spans; the label carries it for AT.
    $$('.split-unit', el).forEach(function (u) { u.setAttribute('aria-hidden', 'true'); });
  }

  $$('[data-split]').forEach(splitText);

  /* ------------------------------------------------------------------------
     2. Reveal observer — fires .is-revealed once, on entry.
     ------------------------------------------------------------------------ */
  var revealTargets = $$('[data-split], [data-reveal], [data-clip], [data-draw]');
  var pending = revealTargets.slice();

  /* Revealing means adding a class and letting a transition carry the element
     to visible. If that transition never resolves the element stays hidden —
     so every reveal schedules its own check. The one-shot sweep this replaces
     ran at 3s and could not cover anything scrolled into view later. */
  function reveal(el) {
    el.classList.add('is-revealed');
    if (!motion || el.__checked) return;
    el.__checked = true;
    setTimeout(function () {
      var cs = getComputedStyle(el);
      var faded = parseFloat(cs.opacity) <= 0.5;
      var clipped = /inset\([^)]*?(9\d|100)%/.test(cs.clipPath || '');
      if (!faded && !clipped) return;          // arrived normally
      el.style.transition = 'none';
      el.style.opacity = '1';
      el.style.transform = 'none';
      if (el.hasAttribute('data-clip')) el.style.clipPath = 'none';
      var units = el.querySelectorAll('.split-unit');
      for (var u = 0; u < units.length; u++) {
        units[u].style.transition = 'none';
        units[u].style.opacity = '1';
        units[u].style.transform = 'none';
      }
    }, 1800);   // longer than the 1.3s clip transition
  }
  function revealAll() { pending.forEach(reveal); pending = []; }

  /* Reveal anything whose band of the page has been reached. This tests
     VERTICAL overlap only, on purpose: the campus rail scrolls horizontally,
     and items parked off to the right never intersect the viewport — gating
     them on full intersection left their images clipped and invisible. */
  function revealInView() {
    if (!pending.length) return;
    var vh = window.innerHeight;
    var still = [];
    for (var i = 0; i < pending.length; i++) {
      var el = pending[i];
      // One-way "has been reached": no lower bound, because a fast flick can
      // carry an element from below the fold to above it between two frames,
      // and requiring it to still be on screen would strand it hidden.
      if (el.getBoundingClientRect().top < vh * 0.92) reveal(el);
      else still.push(el);
    }
    pending = still;
  }

  if (!motion) {
    revealAll();
  } else {
    // IntersectionObserver is the efficient path, but it is not the only one:
    // content must never be left stranded at opacity 0 because an observer
    // failed to deliver, so revealInView() runs from the scroll loop too.
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          reveal(entry.target);
          pending = pending.filter(function (p) { return p !== entry.target; });
          io.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
      revealTargets.forEach(function (el) { io.observe(el); });
    }

    revealInView();
    window.addEventListener('load', revealInView);

    // Last resort: if anything on the first screen is somehow still hidden a
    // few seconds in, show it rather than leaving a blank page.
    setTimeout(revealInView, 1200);
    setTimeout(function () {
      var vh = window.innerHeight;
      /* Every target, not only those still pending: an element can carry
         .is-revealed and remain invisible if its transition never ran. */
      revealTargets.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top >= vh || r.bottom <= 0) return;
        var cs = getComputedStyle(el);
        /* Two ways to be invisible, not one: faded out, or clipped away.
           Checking opacity alone let clip-path'd elements through — which is
           how a fully loaded video ended up showing nothing. */
        var faded = parseFloat(cs.opacity) <= 0.5;
        var clipped = /inset\([^)]*?(9\d|100)%/.test(cs.clipPath || '');
        if (!faded && !clipped) return;
        reveal(el);
        el.style.transition = 'none';    // or the value below is merely a target
        el.style.opacity = '1';
        el.style.transform = 'none';
        if (el.hasAttribute('data-clip')) el.style.clipPath = 'none';
        // split text hides its own letters, so release those too
        var units = el.querySelectorAll('.split-unit');
        for (var u = 0; u < units.length; u++) {
          units[u].style.transition = 'none';
          units[u].style.opacity = '1';
          units[u].style.transform = 'none';
        }
      });
      pending = pending.filter(function (el) { return !el.classList.contains('is-revealed'); });
    }, 3000);
  }

  /* ------------------------------------------------------------------------
     3. Preloader — counts to 100, then lifts away and releases the hero.
     ------------------------------------------------------------------------ */
  var pre = $('.preloader');
  var hero = $('.hero');

  function releaseHero() {
    if (!hero) return;
    $$('[data-split], [data-reveal]', hero).forEach(function (el) { el.classList.add('is-revealed'); });
  }

  var preDone = false;

  function finishPreloader() {
    if (preDone) return;
    preDone = true;
    // The scroll lock lives here, so this must run even if rAF never did.
    document.documentElement.classList.remove('is-loading');
    if (pre) {
      pre.classList.add('is-done');
      setTimeout(function () { if (pre.parentNode) pre.remove(); }, 1600);
    }
    setTimeout(releaseHero, 260);
  }

  if (!pre || !motion) {
    finishPreloader();
  } else {
    var counter = $('.preloader__count');
    var bar = $('.preloader__bar i');
    var t0 = null;
    var DURATION = 1500;

    (function tick(now) {
      if (preDone) return;
      if (t0 === null) t0 = now;
      var p = Math.min((now - t0) / DURATION, 1);
      // ease-out so it decelerates into 100
      var pct = Math.round((1 - Math.pow(1 - p, 3)) * 100);
      if (counter) counter.textContent = pct;
      if (bar) bar.style.width = pct + '%';
      if (p < 1) { requestAnimationFrame(tick); return; }
      finishPreloader();
    })(performance.now());

    // Safety net: requestAnimationFrame is paused in background tabs, so a
    // visitor who opens the site in a background tab would otherwise return to
    // a page still locked behind the preloader. Release it on a plain timer,
    // and the moment the tab becomes visible.
    setTimeout(finishPreloader, DURATION + 900);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) setTimeout(finishPreloader, DURATION);
    });
  }

  /* ------------------------------------------------------------------------
     4. Navigation — hide on scroll down, show on scroll up.
     ------------------------------------------------------------------------ */
  var nav = $('.nav');
  var menu = $('.menu');
  var toggle = $('.nav__toggle');
  var lastY = window.scrollY;
  var menuOpen = false;

  function onScrollNav() {
    var y = window.scrollY;
    if (!nav || menuOpen) { lastY = y; return; }
    if (y > 140 && y > lastY) nav.classList.add('is-hidden');
    else nav.classList.remove('is-hidden');
    lastY = y;
  }

  function setMenu(open) {
    menuOpen = open;
    if (menu) menu.classList.toggle('is-open', open);
    if (nav) nav.classList.toggle('is-open', open);
    document.body.classList.toggle('no-scroll', open);
    if (toggle) {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Close' : 'Menu';
    }
    if (open && nav) nav.classList.remove('is-hidden');
  }

  if (toggle) toggle.addEventListener('click', function () { setMenu(!menuOpen); });
  if (menu) {
    $$('.menu__list a', menu).forEach(function (a, i) {
      a.style.setProperty('--d', (0.08 + i * 0.06).toFixed(2) + 's');
      a.addEventListener('click', function () { setMenu(false); });
    });
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menuOpen) setMenu(false); });

  /* ------------------------------------------------------------------------
     5. Sticky stack — cards shrink and dim as the next one covers them.
     ------------------------------------------------------------------------ */
  var stackItems = $$('.stack__item');
  // Below this width the cards run edge to edge (see the 1024px block in the
  // stylesheet), so they must not be scaled.
  var fullBleedStack = window.matchMedia('(max-width: 1024px)');

  function onScrollStack() {
    if (!motion || calm || !stackItems.length) return;

    // Below 1024px the cards are no longer sticky (they are taller than a phone
    // viewport). Leaving the scale/opacity on would dim them permanently.
    if (getComputedStyle(stackItems[0]).position !== 'sticky') {
      stackItems.forEach(function (item) {
        var c = $('.stack__card', item);
        if (c && c.style.transform) { c.style.transform = ''; c.style.opacity = ''; }
      });
      return;
    }

    stackItems.forEach(function (item, i) {
      if (i === stackItems.length - 1) return;
      var card = $('.stack__card', item);
      if (!card) return;
      var next = stackItems[i + 1];
      var rect = next.getBoundingClientRect();
      var start = window.innerHeight;
      var end = window.innerHeight * 0.25;
      var p = (start - rect.top) / (start - end);
      p = Math.max(0, Math.min(1, p));
      // Scaling a card insets it from the screen edges, which breaks the
      // full-bleed cards on narrow screens — there, recede with opacity alone.
      if (fullBleedStack.matches) {
        card.style.transform = '';
        card.style.opacity = (1 - p * 0.55).toFixed(3);
      } else {
        card.style.transform = 'scale(' + (1 - p * 0.07).toFixed(4) + ')';
        card.style.opacity = (1 - p * 0.45).toFixed(3);
      }
    });
  }

  /* ------------------------------------------------------------------------
     6. Parallax on media plates — subtle drift as they cross the viewport.
     ------------------------------------------------------------------------ */
  /* Resolved once. Querying for .plate-inner and re-parsing the speed
     attribute inside the loop meant a DOM lookup per plate per frame, for
     values that never change. */
  var parallaxEls = $$('[data-parallax]').map(function (el) {
    return {
      el: el,
      inner: $('.plate-inner', el) || el,
      speed: parseFloat(el.getAttribute('data-parallax')) || 0.08
    };
  });

  function onScrollParallax() {
    if (!motion || calm || !parallaxEls.length) return;
    var vh = window.innerHeight;
    parallaxEls.forEach(function (p) {
      var el = p.el;
      var rect = el.getBoundingClientRect();
      if (rect.bottom < -200 || rect.top > vh + 200) return;
      var speed = p.speed;
      var centre = rect.top + rect.height / 2 - vh / 2;
      var inner = p.inner;

      // The layer is overscanned by 12% top and bottom. Travel works out at
      // (vh + h) / 2 * speed, which outgrows that budget whenever the element
      // is short relative to the viewport — so clamp rather than trust the
      // ratio, otherwise the layer's own edge slides into frame.
      var limit = rect.height * 0.10;
      var offset = Math.max(-limit, Math.min(limit, -centre * speed));
      var t = '0 ' + offset.toFixed(1) + 'px';
      if (p.last !== t) { p.last = t; inner.style.translate = t; }
    });
  }

  /* ------------------------------------------------------------------------
     6b. Scroll progress bar
     ------------------------------------------------------------------------ */
  var progress = $('.progress i');

  function onScrollProgress() {
    if (!progress) return;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? window.scrollY / max : 0;
    progress.style.transform = 'scaleX(' + Math.max(0, Math.min(1, p)).toFixed(4) + ')';
  }

  /* ------------------------------------------------------------------------
     6c. Hero scroll-out — the wordmark sinks, scales and fades as you leave.
     ------------------------------------------------------------------------ */
  // The hero is pinned (see the stylesheet) and holds still while the section
  // below climbs over it, so it must NOT animate on scroll: sinking or fading
  // it fights the cover-over and reads as the hero running away.

  /* ------------------------------------------------------------------------
     6d. Scroll-linked word fill — words brighten one by one as the block
         travels through the viewport. [data-fill] on the heading.
     ------------------------------------------------------------------------ */
  var fillBlocks = $$('[data-fill]').map(function (el) {
    var source = el.textContent.trim().replace(/\s+/g, ' ');
    var words = source.split(' ');
    el.setAttribute('aria-label', source);
    el.textContent = '';
    words.forEach(function (w, i) {
      var span = document.createElement('span');
      span.className = 'fill-word';
      span.textContent = w;
      span.setAttribute('aria-hidden', 'true');
      el.appendChild(span);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    return { el: el, words: $$('.fill-word', el) };
  });

  if (!motion) {
    fillBlocks.forEach(function (b) { b.words.forEach(function (w) { w.style.opacity = 1; }); });
  }

  function onScrollFill() {
    if (!motion || !fillBlocks.length) return;
    var vh = window.innerHeight;
    fillBlocks.forEach(function (b) {
      var rect = b.el.getBoundingClientRect();
      // 0 when the block enters from the bottom, 1 once it clears the upper
      // quarter. A wide window keeps the word-by-word fill legible rather than
      // completing it in a flick of the wheel.
      var start = vh * 0.96;
      var end = vh * 0.22;
      var p = (start - rect.top) / (start - end);
      p = Math.max(0, Math.min(1, p));
      var n = b.words.length;
      b.words.forEach(function (w, i) {
        var wp = Math.max(0, Math.min(1, p * n - i));
        w.style.opacity = (0.16 + wp * 0.84).toFixed(3);
      });
    });
  }

  /* ------------------------------------------------------------------------
     6e. Rail — drifts horizontally as the section passes, on top of drag.
     ------------------------------------------------------------------------ */
  var railEl = $('.rail__track');
  var railDragging = false;

  function onScrollRail() {
    if (!motion || !railEl || railDragging) return;
    var section = railEl.closest('section');
    if (!section) return;
    var rect = section.getBoundingClientRect();
    var vh = window.innerHeight;
    if (rect.bottom < 0 || rect.top > vh) {
      railEl.classList.remove('is-auto');
      return;
    }
    var p = (vh - rect.top) / (vh + rect.height);
    p = Math.max(0, Math.min(1, p));
    var span = railEl.scrollWidth - railEl.clientWidth;
    if (span <= 0) return;
    // Snap has to be off while we set scrollLeft ourselves, or it pulls back
    // against every write.
    railEl.classList.add('is-auto');
    railEl.scrollLeft = span * p * 0.85;
  }

  /* ------------------------------------------------------------------------
     6f. Marquee — a transform loop whose speed and direction follow scroll
     velocity. Driven here rather than by a CSS animation because rewriting
     animation-duration/-direction every frame restarts the animation.
     ------------------------------------------------------------------------ */
  var marqueeUnits = [];
  var marqueeV = 0;
  var lastMarqueeY = window.scrollY;
  var MARQUEE_BASE = 0.9; // px per frame at rest

  function onScrollMarquee() {
    var y = window.scrollY;
    marqueeV = y - lastMarqueeY;
    lastMarqueeY = y;
  }

  /* ------------------------------------------------------------------------
     6g. Active section in the nav + back-to-top
     ------------------------------------------------------------------------ */
  var navLinks = $$('.nav__links a');
  var sectionsById = navLinks
    .map(function (a) {
      var id = a.getAttribute('href');
      return id && id.charAt(0) === '#' ? { link: a, el: document.querySelector(id) } : null;
    })
    .filter(function (x) { return x && x.el; });

  var toTop = $('.totop');

  function onScrollSections() {
    var y = window.scrollY + window.innerHeight * 0.35;
    var current = null;
    sectionsById.forEach(function (s) {
      var top = s.el.getBoundingClientRect().top + window.scrollY;
      if (y >= top) current = s;
    });
    sectionsById.forEach(function (s) { s.link.classList.toggle('is-current', s === current); });
    if (toTop) toTop.classList.toggle('is-on', window.scrollY > window.innerHeight * 1.2);
  }

  /* ------------------------------------------------------------------------
     6h. Wordstrips — oversized display type running sideways as the section
     crosses the viewport. The unit is repeated enough times to cover the
     screen twice, so the wrap point never comes into view.
     ------------------------------------------------------------------------ */
  var wordstrips = $$('[data-wordstrip]').map(function (el) {
    var inner = $('.wordstrip__inner', el);
    var unit = inner && $('.wordstrip__unit', inner);
    return inner && unit ? { el: el, inner: inner, unitW: 0 } : null;
  }).filter(Boolean);

  function buildWordstrips() {
    wordstrips.forEach(function (w) {
      // Collapse back to the original unit before re-measuring, so a resize
      // does not keep stacking clones.
      while (w.inner.children.length > 1) w.inner.removeChild(w.inner.lastChild);
      var unit = w.inner.firstElementChild;
      var unitW = unit.getBoundingClientRect().width;
      if (!unitW) return;
      w.unitW = unitW;
      var need = Math.ceil((w.el.clientWidth + unitW * 2) / unitW);
      for (var i = 1; i < need; i++) {
        var clone = unit.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        w.inner.appendChild(clone);
      }
    });
  }

  buildWordstrips();
  // Glyph widths change once the display face swaps in, so measure again.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(buildWordstrips);
  }
  window.addEventListener('resize', buildWordstrips);

  /* ------------------------------------------------------------------------
     6i. Gallery strip — on narrow screens the gallery is a swipeable row of
     cards. The one nearest the centre comes forward, so there is always a
     clear subject rather than a wall of equal thumbnails.
     ------------------------------------------------------------------------ */
  var galleryStrip = $('.gallery__grid');
  var galleryCards = galleryStrip ? $$('.gallery__item', galleryStrip) : [];

  function centreGalleryCard() {
    if (!motion || calm || !galleryStrip || !galleryCards.length) return;
    // only while it is actually a strip; above the breakpoint it is a grid
    if (getComputedStyle(galleryStrip).display !== 'flex') {
      galleryCards.forEach(function (c) { c.classList.remove('is-centred'); });
      return;
    }
    var mid = galleryStrip.getBoundingClientRect().left + galleryStrip.clientWidth / 2;
    var best = null, bestDist = Infinity;
    galleryCards.forEach(function (c) {
      var r = c.getBoundingClientRect();
      var d = Math.abs((r.left + r.width / 2) - mid);
      if (d < bestDist) { bestDist = d; best = c; }
    });
    galleryCards.forEach(function (c) { c.classList.toggle('is-centred', c === best); });
  }

  /* The strip advances on its own so the photographs are seen without anyone
     having to discover that it swipes. Any touch hands control back. */
  var galleryTimer = 0;
  var galleryPausedUntil = 0;
  // Starts true on purpose: the observer may never deliver, and a strip that
  // only moves once something confirms it is visible would then never move.
  var galleryVisible = true;

  function galleryIsStrip() {
    return galleryStrip && getComputedStyle(galleryStrip).display === 'flex';
  }

  function advanceGallery() {
    if (!motion || !galleryIsStrip() || !galleryVisible) return;
    if (Date.now() < galleryPausedUntil) return;

    var span = galleryStrip.scrollWidth - galleryStrip.clientWidth;
    if (span <= 4) return;

    var card = galleryCards[0];
    var step = card ? card.getBoundingClientRect().width + 12 : galleryStrip.clientWidth * 0.8;
    // at the end, wind back to the start rather than stalling
    var from = galleryStrip.scrollLeft;
    var next = from + step > span - 4 ? 0 : from + step;
    galleryStrip.scrollTo({ left: next, behavior: 'smooth' });

    /* Smooth scrolling is not universally honoured — some browsers ignore it,
       and it does not animate at all without a compositor. If nothing has
       moved shortly after, place the strip directly so it never sits stuck. */
    setTimeout(function () {
      if (Math.abs(galleryStrip.scrollLeft - from) < 4) {
        galleryStrip.scrollLeft = next;
      }
    }, 420);
  }

  function holdGallery() { galleryPausedUntil = Date.now() + 7000; }

  if (galleryStrip) {
    galleryStrip.addEventListener('scroll', centreGalleryCard, { passive: true });
    window.addEventListener('resize', centreGalleryCard, { passive: true });
    centreGalleryCard();

    // a real interaction pauses the rotation for a while
    ['pointerdown', 'touchstart', 'wheel'].forEach(function (evt) {
      galleryStrip.addEventListener(evt, holdGallery, { passive: true });
    });

    if (motion) {
      // only tick while the strip is actually on screen
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (e) { galleryVisible = e.isIntersecting; });
        }, { threshold: 0.25 }).observe(galleryStrip);
      }
      galleryTimer = setInterval(advanceGallery, 3800);
    }
  }

  /* ------------------------------------------------------------------------
     6j. Layered lift — elements drift at slightly different rates as their
     section crosses the viewport. Unlike a fade, this keeps moving the whole
     time the section is on screen, which is what makes a page feel alive
     rather than just "animated on arrival".
     ------------------------------------------------------------------------ */
  var liftEls = $$('[data-lift]');

  function onScrollLift() {
    if (!motion || calm || !liftEls.length) return;
    var vh = window.innerHeight;
    for (var i = 0; i < liftEls.length; i++) {
      var el = liftEls[i];
      var r = el.getBoundingClientRect();
      if (r.bottom < -120 || r.top > vh + 120) continue;
      // Parsed once and kept on the element, not re-read every frame.
      var depth = el.__depth;
      if (depth === undefined) {
        depth = el.__depth = parseFloat(el.getAttribute('data-lift')) || 0.05;
      }
      // -0.5..0.5 as the element crosses, so it settles level mid-viewport
      var p = (r.top + r.height / 2 - vh / 2) / vh;
      // clamped so a tall element near the edges cannot fling far
      var offset = Math.max(-70, Math.min(70, p * vh * depth));
      var t = '0 ' + offset.toFixed(1) + 'px';
      if (el.__lift !== t) { el.__lift = t; el.style.translate = t; }
    }
  }

  /* ------------------------------------------------------------------------
     7. Scroll dispatcher — one rAF loop for every scroll-linked effect.
     ------------------------------------------------------------------------ */
  var ticking = false;

  function runScrollEffects() {
    ticking = false;
    revealInView();
    if (window.__stageCourses) window.__stageCourses();
    centreGalleryCard();
    onScrollLift();
    onScrollNav();
    onScrollProgress();
    onScrollStack();
    onScrollParallax();
    onScrollFill();
    onScrollRail();
    onScrollMarquee();
    onScrollSections();
  }

  var safety = 0;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(runScrollEffects);
    // rAF is paused in hidden tabs; without a fallback the `ticking` latch
    // would stay stuck and every later scroll would be dropped. One timer,
    // reset each time — not one per scroll event.
    clearTimeout(safety);
    safety = setTimeout(function () { if (ticking) runScrollEffects(); }, 300);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  /* ------------------------------------------------------------------------
     8. Academics tabs
     ------------------------------------------------------------------------ */
  var tabBtns = $$('.tabs__btn');
  var tabPanels = $$('.tabs__panel');

  function stageCourses(panel) {
    $$('.course', panel).forEach(function (row, i) {
      row.classList.remove('is-in');
      row.style.setProperty('--d', (i * 0.06).toFixed(2) + 's');
      // force reflow so the transition replays on tab switch
      void row.offsetWidth;
      row.classList.add('is-in');
    });
  }

  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-tab');
      tabBtns.forEach(function (b) {
        var on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', String(on));
      });
      tabPanels.forEach(function (p) {
        var on = p.id === id;
        p.classList.toggle('is-active', on);
        if (on) stageCourses(p);
      });
    });
  });

  // Stage the first panel when the tab block scrolls in.
  var firstPanel = $('.tabs__panel.is-active');
  var firstPanelStaged = false;

  /* The rows sit at opacity 0.001 until staged, so if the observer never
     delivers they are not merely un-animated — they are invisible. This runs
     from the scroll loop as the guaranteed path; the observer is only the
     fast one. */
  function maybeStageCourses() {
    if (firstPanelStaged || !firstPanel) return;
    var r = firstPanel.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.95) {
      firstPanelStaged = true;
      stageCourses(firstPanel);
    }
  }
  window.__stageCourses = maybeStageCourses;

  if (firstPanel) {
    if (!motion || !('IntersectionObserver' in window)) {
      $$('.course', firstPanel).forEach(function (r) { r.classList.add('is-in'); });
      firstPanelStaged = true;
    } else {
      // Last resort: never leave the rows invisible.
      /* Judged on what is actually on screen, not on whether staging was
         attempted. Staging can succeed and the rows still be invisible if the
         transition never resolves — which is the case this exists to catch. */
      setTimeout(function () {
        $$('.course', firstPanel).forEach(function (r) {
          if (parseFloat(getComputedStyle(r).opacity) > 0.5) return;
          firstPanelStaged = true;
          r.classList.add('is-in');
          r.style.transition = 'none';   // or the value below is merely a target
          r.style.opacity = '1';
          r.style.transform = 'none';
        });
      }, 4000);

      var tabsIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting || firstPanelStaged) return;
          firstPanelStaged = true;
          stageCourses(firstPanel);
          tabsIO.disconnect();
        });
      }, { threshold: 0.1 });
      tabsIO.observe(firstPanel);
    }
  }

  /* ------------------------------------------------------------------------
     9. Campus rail — click-and-drag horizontal scrolling.
     ------------------------------------------------------------------------ */
  var rail = railEl;
  if (rail) {
    var down = false, startX = 0, startScroll = 0, moved = 0, releaseTimer = null;

    rail.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;
      down = true; moved = 0;
      // hand control to the pointer; the scroll-driven drift stands down and
      // snap comes back so manual dragging still settles on a card
      railDragging = true;
      rail.classList.remove('is-auto');
      clearTimeout(releaseTimer);
      startX = e.clientX;
      startScroll = rail.scrollLeft;
      rail.classList.add('is-dragging');
    });
    rail.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      moved = Math.abs(dx);
      rail.scrollLeft = startScroll - dx;
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (evt) {
      rail.addEventListener(evt, function () {
        if (!down) return;
        down = false;
        rail.classList.remove('is-dragging');
        // give the reader a beat before scroll takes the rail back
        releaseTimer = setTimeout(function () { railDragging = false; }, 2500);
      });
    });
    // Wheel and touch scrolling inside the rail should also win over the drift.
    ['wheel', 'touchstart'].forEach(function (evt) {
      rail.addEventListener(evt, function () {
        railDragging = true;
        rail.classList.remove('is-auto');
        clearTimeout(releaseTimer);
        releaseTimer = setTimeout(function () { railDragging = false; }, 2500);
      }, { passive: true });
    });
    rail.addEventListener('click', function (e) {
      if (moved > 6) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  }

  /* ------------------------------------------------------------------------
     10. Counting stats
     ------------------------------------------------------------------------ */
  var stats = $$('[data-count]');
  if (stats.length) {
    if (!motion || !('IntersectionObserver' in window)) {
      stats.forEach(function (el) { el.textContent = el.getAttribute('data-count') + (el.getAttribute('data-suffix') || ''); });
    } else {
      var countIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          countIO.unobserve(el);
          var target = parseFloat(el.getAttribute('data-count'));
          var suffix = el.getAttribute('data-suffix') || '';
          var prefix = el.getAttribute('data-prefix') || '';
          var dec = (el.getAttribute('data-count').split('.')[1] || '').length;
          var s0 = null;

          (function run(now) {
            if (s0 === null) s0 = now;
            var p = Math.min((now - s0) / 1600, 1);
            var eased = 1 - Math.pow(1 - p, 4);
            el.textContent = prefix + (target * eased).toFixed(dec) + suffix;
            if (p < 1) requestAnimationFrame(run);
            else el.textContent = prefix + target.toFixed(dec) + suffix;
          })(performance.now());
        });
      }, { threshold: 0.5 });
      stats.forEach(function (el) { countIO.observe(el); });

      /* If the observer never delivers, the numbers keep their authored text
         so nothing is lost — but they never animate either. Nudge them. */
      setTimeout(function () {
        stats.forEach(function (el) {
          if (el.dataset.counted) return;
          if (el.getBoundingClientRect().top < window.innerHeight) {
            countIO.unobserve(el);
            el.dataset.counted = '1';
            el.textContent = (el.getAttribute('data-prefix') || '') +
              el.getAttribute('data-count') + (el.getAttribute('data-suffix') || '');
          }
        });
      }, 5000);
    }
  }

  /* ------------------------------------------------------------------------
     11. Magnetic buttons
     ------------------------------------------------------------------------ */
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (fine && motion && !calm) {
    $$('[data-magnetic]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var x = e.clientX - r.left - r.width / 2;
        var y = e.clientY - r.top - r.height / 2;
        el.style.transform = 'translate(' + x * 0.22 + 'px, ' + y * 0.3 + 'px)';
      });
      el.addEventListener('pointerleave', function () {
        el.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
        el.style.transform = '';
        setTimeout(function () { el.style.transition = ''; }, 620);
      });
    });
  }

  /* ------------------------------------------------------------------------
     12. Marquee — duplicate the row so the loop is seamless.
     ------------------------------------------------------------------------ */
  $$('.marquee').forEach(function (m) {
    var row = $('.marquee__row', m);
    if (!row) return;
    var clone = row.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    m.appendChild(clone);
    // Both rows carry the same offset, so the pair travels as one strip and
    // wraps seamlessly when it has moved exactly one row width.
    marqueeUnits.push({ targets: [row, clone], measure: row, base: MARQUEE_BASE, x: 0, w: 0, paused: false });

    // Match on `measure` — the unit has no `rows` property, and reaching for
    // one threw on every hover and every touch.
    m.addEventListener('pointerenter', function () { marqueeUnits.forEach(function (u) { if (u.measure === row) u.paused = true; }); });
    m.addEventListener('pointerleave', function () { marqueeUnits.forEach(function (u) { if (u.measure === row) u.paused = false; }); });
  });

  /* The oversized wordstrips ride the same loop. They drift under their own
     steam rather than being pinned to scroll position: the footer strip sits at
     the very bottom of the page, where there is almost no scroll left to drive
     it, and it would arrive parked. */
  wordstrips.forEach(function (w) {
    var unit = w.inner.firstElementChild;
    if (!unit) return;
    var speed = parseFloat(w.el.getAttribute('data-speed')) || 1;
    marqueeUnits.push({
      targets: [w.inner],
      measure: unit,
      base: MARQUEE_BASE * speed,
      x: 0,
      w: 0,
      paused: false
    });
  });

  /* Row widths are measured here and on resize, never in the loop. Reading a
     rect mid-animation forces the browser to re-run layout for the whole
     document, once per strip, sixty times a second. */
  function measureMarquee() {
    for (var i = 0; i < marqueeUnits.length; i++) {
      var u = marqueeUnits[i];
      u.w = u.measure.getBoundingClientRect().width;
    }
  }
  measureMarquee();
  window.addEventListener('resize', measureMarquee, { passive: true });
  if (document.fonts && document.fonts.ready) {
    // A late webfont reflows the strip and changes its width.
    document.fonts.ready.then(measureMarquee);
  }

  if (motion && marqueeUnits.length) {
    var lastFrame = performance.now();
    (function marqueeTick(now) {
      // Normalise to 60fps so speed is frame-rate independent, and clamp so a
      // backgrounded tab does not resume with one enormous jump.
      var dt = Math.min((now - lastFrame) / 16.667, 3);
      lastFrame = now;

      var boost = Math.min(Math.abs(marqueeV) / 7, 7);
      var dir = marqueeV < -0.5 ? -1 : 1;
      marqueeV *= 0.9; // let the velocity kick decay back to the resting speed

      marqueeUnits.forEach(function (u) {
        if (u.paused) return;
        var w = u.w;
        if (!w) return;
        u.x -= (u.base + boost) * dir * dt;
        if (u.x <= -w) u.x += w;
        if (u.x > 0) u.x -= w;
        var t = 'translate3d(' + u.x.toFixed(2) + 'px,0,0)';
        for (var i = 0; i < u.targets.length; i++) u.targets[i].style.transform = t;
      });
      requestAnimationFrame(marqueeTick);
    })(performance.now());
  }

  /* ------------------------------------------------------------------------
     13. Enquiry form — client-side validation only. Wire up a real endpoint
         before launch; see README.
     ------------------------------------------------------------------------ */
  var form = $('#enquiry');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var status = $('.form__status', form);
      var name = form.querySelector('[name="name"]');
      var email = form.querySelector('[name="email"]');

      if (!name.value.trim() || !email.value.trim()) {
        if (status) status.textContent = 'Please add your name and email so we can reply.';
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
        if (status) status.textContent = 'That email address does not look right.';
        return;
      }
      if (status) status.textContent = 'Thank you — the admissions office will reply within two working days.';
      form.reset();
    });
  }

  /* ------------------------------------------------------------------------
     14. Footer year
     ------------------------------------------------------------------------ */
  var year = $('#year');
  if (year) year.textContent = new Date().getFullYear();
})();

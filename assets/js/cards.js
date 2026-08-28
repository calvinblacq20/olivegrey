/* ==========================================================================
   3D card carousel — vanilla port

   A continuous cylinder of volumetric cards. The original spec was a React
   component; the logic is plain DOM writes on refs inside a requestAnimation-
   Frame loop, so nothing here needed React. Same math, no build step.

   Each card is five slices stacked a fraction of a pixel apart along Z: the
   outer two are the printed faces, the inner three are the grey "edge" that
   gives the card real thickness when it rotates.
   ========================================================================== */
(function () {
  'use strict';

  var stage = document.querySelector('.cards__stage');
  var viewport = document.querySelector('.cards__viewport');
  if (!stage || !viewport) return;

  var reduced = document.documentElement.getAttribute('data-motion') !== 'on';

  /* Each card is a place on the campus rather than a payment card.
     `img` keys resolve against the manifest in images.js — change photos
     there, not here. `art` is the SVG illustration kept underneath as a
     fallback for when a photo fails to load. */
  var CARDS = [
    { img: 'ballet',    art: 'sc-art',     kind: 'Club', label: 'Ballet',    fact: 'Posture and performance', meta: 'Shown to parents each term' },
    { img: 'robotics',  art: 'sc-ict',     kind: 'Club', label: 'Robotics',  fact: 'Build it, then program it', meta: 'Follows on from computing' },
    { img: 'abacus',    art: 'sc-class',   kind: 'Club', label: 'Abacus',    fact: 'Mental arithmetic at speed', meta: 'A club and a subject' },
    { img: 'taekwondo', art: 'sc-field',   kind: 'Club', label: 'Taekwondo', fact: 'Control before contact',   meta: 'Belts are earned here' },
    { img: 'cadet',     art: 'sc-assembly', kind: 'Club', label: 'Cadet',     fact: 'Drill and bearing',        meta: 'Responsibility, practised' }
  ];

  var CARD_COUNT = 5;
  var THICKNESS = [-1.47, -0.73, 0, 0.73, 1.47];   // slice offsets along Z
  var GAP = 36;
  var PEEK = -55;      // push the edge past the boundary so cards hide gracefully
  var D = 1350;        // must match the CSS perspective distance

  var cards = [];
  var metrics = { cardW: 336, cardH: 211 };
  var progress = 0;
  var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  var frame = 0;

  // Side label — names whichever club is at the front
  var nowKind = document.querySelector('.cards__nowKind');
  var nowName = document.querySelector('.cards__nowName');
  var nowFact = document.querySelector('.cards__nowFact');
  var nowIndex = -1;

  function setNow(i) {
    if (i === nowIndex || !nowName) return;
    nowIndex = i;
    var d = CARDS[((i % CARDS.length) + CARDS.length) % CARDS.length];
    // restart the entrance animation on each change
    [nowKind, nowName, nowFact].forEach(function (el) {
      if (!el) return;
      el.classList.remove('is-in');
      void el.offsetWidth;
      el.classList.add('is-in');
    });
    if (nowKind) nowKind.textContent = d.kind || 'Club';
    nowName.textContent = d.label;
    if (nowFact) nowFact.textContent = d.fact;
  }

  /* ---------------------------------------------------------------- build */

  /* Photo layered over the illustration. The SVG stays underneath as a
     fallback, and the <img> strips itself out if the source fails. */
  function art(d) {
    var svg = '<svg class="card3d__art" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
                '<use href="#' + d.art + '"></use>' +
              '</svg>';
    var rec = (window.SCHOOL_IMAGES || {})[d.img];
    if (!rec) return svg;
    return svg +
      '<img class="card3d__art card3d__photo" src="' + rec.src + '" alt="" ' +
      'loading="lazy" decoding="async" onerror="this.remove()">';
  }

  function build() {
    var html = '';
    for (var i = 0; i < CARD_COUNT; i++) {
      var d = CARDS[i % CARDS.length];
      var slices = '';

      for (var L = 0; L < THICKNESS.length; L++) {
        var z = THICKNESS[L];
        var isFront = L === THICKNESS.length - 1;
        var isBack = L === 0;

        if (!isFront && !isBack) {
          slices += '<div class="card3d__layer card3d__mid" style="transform:translateZ(' + z + 'px)"></div>';
          continue;
        }

        if (isFront) {
          slices +=
            '<div class="card3d__layer card3d__face" style="transform:translateZ(' + z + 'px)">' +
              art(d) +
              '<div class="card3d__tint"></div>' +
              '<div class="card3d__mark">' +
                '<svg viewBox="0 0 48 48" aria-hidden="true"><use href="#ic-fern"></use></svg>' +
                '<span>OLIVE GREY</span>' +
              '</div>' +
              '<div class="card3d__label">' + d.label + '</div>' +
              '<div class="card3d__kind">' + (d.kind || 'Club') + '</div>' +
            '</div>';
          continue;
        }

        // Back face — the same art, blurred, behind a woven band
        slices +=
          '<div class="card3d__layer card3d__face" style="transform:translateZ(' + z + 'px) rotateX(180deg)">' +
            '<div class="card3d__blur">' + art(d) + '</div>' +
            '<div class="card3d__band"></div>' +
            '<div class="card3d__details">' +
              '<div class="card3d__cat">' + d.label + '</div>' +
              '<div class="card3d__fact">' + d.fact + '</div>' +
              '<div class="card3d__meta"><span>' + d.meta + '</span><i>&bull;</i><span>Gyedu Junction</span></div>' +
            '</div>' +
          '</div>';
      }

      html += '<div class="card3d">' + slices + '</div>';
    }
    viewport.innerHTML = html;
    cards = Array.prototype.slice.call(viewport.querySelectorAll('.card3d'));
  }

  /* ------------------------------------------------------------- measure */

  function resize() {
    var w = window.innerWidth;
    var h = window.innerHeight;

    /* The original formula (w * 0.16 + 130, capped at 336) left the card at
       ~190px on a phone — under half the screen. Narrow and wide viewports
       need different rules: a phone wants a share of its width, a desktop
       wants a gentler slope so the card does not become a billboard. */
    var cardW = w < 760
      ? Math.round(w * 0.66)
      : Math.round(w * 0.20 + 190);

    var heightFactor = Math.min(1.0, Math.max(0.7, h / 850));
    cardW = Math.round(cardW * heightFactor);
    cardW = Math.min(470, Math.max(240, cardW));
    var cardH = Math.round(cardW / 1.5925);   // standard card ratio

    metrics = { cardW: cardW, cardH: cardH };
    viewport.style.width = cardW + 'px';
    viewport.style.height = cardH + 'px';
    for (var i = 0; i < cards.length; i++) {
      cards[i].style.width = cardW + 'px';
      cards[i].style.height = cardH + 'px';
    }
  }

  /* ---------------------------------------------------------------- loop */

  function smoothstep(t) { return t * t * (3 - 2 * t); }

  function layout() {
    var h = stage.clientHeight || window.innerHeight;
    var cardH = metrics.cardH;

    // A non-linear step: the card dwells briefly at front centre, then
    // accelerates away to the next one.
    var rounded = Math.round(progress);
    var diff = progress - rounded;                       // [-0.5, 0.5]
    var eased = Math.sign(diff) * Math.pow(Math.abs(diff) * 2, 2.6) / 2;
    var active = rounded + eased;
    setNow(rounded);

    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];

      // Closest circular representation of this card's distance from centre
      var offset = i - active;
      var half = CARD_COUNT / 2;
      while (offset > half) offset -= CARD_COUNT;
      while (offset < -half) offset += CARD_COUNT;

      var abs = Math.abs(offset);
      var sign = Math.sign(offset);

      if (abs > 3.0) { card.style.visibility = 'hidden'; continue; }
      card.style.visibility = 'visible';

      var y = 0, z = 0, rot = 0, t, e;

      if (abs <= 1) {
        // Centre card out to the first neighbour
        e = smoothstep(abs);
        y = -sign * (e * (cardH + GAP));
        z = 400 + e * (220 - 400);
        rot = e * 132;
      } else if (abs <= 2) {
        // Neighbour out to the card peeking at the screen edge
        t = abs - 1; e = smoothstep(t);
        var yStart = cardH + GAP, zStart = 220, rotStart = 132;
        var zEnd = -60, rotEnd = 175;
        // Perspective-aware, so the edge lands exactly on the boundary
        var sEnd = D / (D - zEnd);
        var yEnd = (h / 2 - PEEK) / sEnd - (cardH / 2);
        y = -sign * (yStart + e * (yEnd - yStart));
        z = zStart + e * (zEnd - zStart);
        rot = rotStart + e * (rotEnd - rotStart);
      } else {
        // Peeking card out to fully off-screen
        t = Math.min(abs - 2, 1); e = smoothstep(t);
        var z2 = -60, rot2 = 175, z3 = -250, rot3 = 195;
        var s2 = D / (D - z2);
        var y2 = (h / 2 - PEEK) / s2 - (cardH / 2);
        var s3 = D / (D - z3);
        var y3 = (h / 2 + 100) / s3 + (cardH / 2);
        y = -sign * (y2 + e * (y3 - y2));
        z = z2 + e * (z3 - z2);
        rot = rot2 + e * (rot3 - rot2);
      }

      var localRot = -sign * rot;

      // Mouse parallax only bites on the card nearest the centre
      var centreFactor = Math.max(0, 1 - abs);
      var tiltX = -mouse.y * 12 * centreFactor;
      var tiltY = mouse.x * 15 * centreFactor;

      card.style.zIndex = Math.round(z).toString();
      card.style.opacity = '1';
      card.style.transform =
        'translateY(' + y.toFixed(2) + 'px) translateZ(' + z.toFixed(2) + 'px) ' +
        'rotateX(' + (localRot + tiltX).toFixed(2) + 'deg) ' +
        'rotateY(' + tiltY.toFixed(2) + 'deg) rotateZ(-3deg)';
    }
  }

  var RATE = 0.00016;   // cards per millisecond — one turn every ~6 seconds
  var last = 0;
  var beat = 0;         // when the loop last ran, for the watchdog below

  /* Cheap visibility test, done inside the loop rather than by an observer.
     An IntersectionObserver that never delivers would leave the carousel
     frozen for good; a rect read cannot fail that way. */
  function onScreen() {
    var r = stage.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    return r.bottom > -200 && r.top < vh + 200;
  }

  function tick(now) {
    frame = requestAnimationFrame(tick);

    /* Time-based, not per-frame. iOS runs this at 30fps under load and stops
       it outright while a finger is on the screen, so a fixed step per frame
       would drift to half speed. Clamped, so coming back to a backgrounded
       page does not jump the carousel forward by a minute. */
    var dt = Math.min(now - last, 100);
    last = now;
    beat = now;

    if (!onScreen()) return;   // still turning over, just not doing the work

    progress += dt * RATE;
    // Inertia: the tilt lags slightly behind the cursor
    mouse.x += (mouse.tx - mouse.x) * 0.08;
    mouse.y += (mouse.ty - mouse.y) * 0.08;
    layout();
  }

  function start() {
    last = beat = (window.performance && performance.now()) || Date.now();
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
  }

  /* Safari suspends requestAnimationFrame when the page goes to the back-
     ground, when it is restored from the back/forward cache, and sometimes
     after a long scroll — and does not reliably resume it. So the loop is
     never trusted to keep itself alive: a slow timer checks it is still
     beating and starts it again if it is not. */
  function watchdog() {
    if (document.hidden) return;
    var now = (window.performance && performance.now()) || Date.now();
    if (now - beat > 1200) start();
  }

  /* --------------------------------------------------------------- input */

  window.addEventListener('mousemove', function (e) {
    var rx = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
    var ry = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
    mouse.tx = Math.max(-1, Math.min(1, rx));
    mouse.ty = Math.max(-1, Math.min(1, ry));
  }, { passive: true });

  document.addEventListener('mouseleave', function () { mouse.tx = 0; mouse.ty = 0; });

  window.addEventListener('resize', function () { resize(); layout(); }, { passive: true });

  /* ---------------------------------------------------------------- init */

  build();
  resize();
  layout();

  if (reduced) {
    // Hold a static arrangement rather than looping.
    progress = 0;
    layout();
  } else {
    start();
    setInterval(watchdog, 2000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) start();
    });
    // Back/forward cache restore — Safari hands the page back with its
    // animation frames already cancelled.
    window.addEventListener('pageshow', start);
  }
})();

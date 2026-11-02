/* ==========================================================================
   IMAGE MANIFEST — the only place photo sources live.

   These are Olive Grey School's own photographs, taken from their site and
   served locally from assets/img/ rather than hotlinked.

   A slot can hold a photograph OR a video:

     classroom: { src:   'assets/img/class-a.webp', alt: '...' }
     openday:   { video: 'assets/img/openday.mp4',
                  poster:'assets/img/openday.webp', alt: '...' }

   Videos play muted, looped and inline — they are backdrops, not media the
   visitor operates, so they carry no controls. Always give a `poster`: it is
   what shows while the video loads, and on a slow connection it may be all a
   visitor ever sees.

   As more arrive: drop them into assets/img/, add a line below, and point the
   slots at the new file. Nothing in the markup needs touching — it refers to
   these by key.

   Every photo is layered OVER the inline SVG artwork rather than replacing
   it, so if a file ever goes missing the illustration shows through instead
   of a broken image.
   ========================================================================== */
(function () {
  'use strict';

  var DIR = 'assets/img/';

  /* Every media URL carries this. Assets are cached hard by the CDN — which is
     what makes the site quick on a Ghanaian mobile connection — so a file
     replaced under the same name would otherwise keep showing the old picture.
     Bump it whenever a photograph or video is swapped, exactly like the ?v= on
     the stylesheet. */
  var V = '?v=58';

  /* Photographs taken from the school's own site and served locally.
     Filenames prefixed by what they show, so a slot can be repointed at a
     glance. Activity names are the school's own. */
  function img(f) { return DIR + f + V; }

  window.SCHOOL_IMAGES = {
    // --- pupils and classrooms ---
    assembly:  { src: img('DSF0429.webp'), alt: 'Pupils of Olive Grey School in uniform' },
    classroom: { src: img('class-a.webp'), alt: 'A pupil working through a numeracy book at his desk' },
    library:   { src: img('class-b.webp'), alt: 'Pupils reading and writing in class' },
    reading:   { src: img('class-c.webp'), alt: 'Pupils at work during a lesson' },
    lab:       { src: img('class-d.webp'), alt: 'A lesson in progress' },
    lab2:      { src: img('class-e.webp'), alt: 'Pupils concentrating on classwork' },
    court:     { src: img('DSF0527.webp'), alt: 'A class at their desks, the teacher alongside' },

    // --- clubs and activities, named by the school ---
    ballet:    { src: img('ballet.webp'),    alt: 'The ballet club' },
    robotics:  { src: img('robotics.webp'),  alt: 'The robotics club' },
    abacus:    { src: img('abacus.webp'),    alt: 'An abacus session' },
    taekwondo: { src: img('taekwondo.webp'), alt: 'The taekwondo club' },
    cadet:     { src: img('cadet.webp'),     alt: 'A pupil in cadet uniform' },
    training:  { src: img('DSF0211.webp'),   alt: 'Pupils in martial arts training kit' },

    /* Video slot. Plays muted, looped and inline; the poster is what shows
       while it loads, and on a slow connection may be all a visitor sees. */
    craft:     { video: img('craft.mp4'), poster: img('craft-poster.webp'),
                 alt: 'Children working on crochet and craft with a teacher' },

    // --- prize-giving and the cultural parade ---
    evSpeech:  { src: img('event-speech.webp'),   alt: 'An address from the podium on prize-giving day' },
    evAddress: { src: img('event-address.webp'),  alt: 'A speaker addressing pupils and parents' },
    evParadeA: { src: img('event-parade-a.webp'), alt: 'Two pupils in costume on the parade stage' },
    evParadeB: { src: img('event-parade-b.webp'), alt: 'Pupils in costume before the decorated stage' },
    evParadeC: { src: img('event-parade-c.webp'), alt: 'Pupils parading in bright costume' },
    evParadeD: { src: img('event-parade-d.webp'), alt: 'Pupils in Ghanaian print on the parade stage' },
    evParadeE: { src: img('event-parade-e.webp'), alt: 'Two pupils dressed for the parade' },
    evParadeF: { src: img('event-parade-f.webp'), alt: 'Pupils in formal dress at prize-giving' },

    // --- gallery ---
    art:       { src: img('gal-d.webp'), alt: 'Pupils of Olive Grey School' },
    field:     { src: img('gal-a.webp'), alt: 'Pupils of Olive Grey School' },
    drum:      { src: img('gal-c.webp'), alt: 'Pupils of Olive Grey School' },
    ict:       { src: img('gal-b.webp'), alt: 'Pupils of Olive Grey School' },
    farm:      { src: img('gal-e.webp'), alt: 'Pupils of Olive Grey School' },
    plant:     { src: img('gal-f.webp'), alt: 'Pupils of Olive Grey School' }
  };

  /* Hydrate anything carrying data-img="<key>" with a photograph. The photo is
     appended above the existing SVG; on error it removes itself so the
     illustration underneath remains visible. */
  function hydrate(el) {
    var rec = window.SCHOOL_IMAGES[el.getAttribute('data-img')];
    if (!rec) return;
    var host = el.querySelector('.plate-inner') || el;

    /* The hero fills the first screen, so it is the page's largest contentful
       paint. Deferring it would leave visitors — many on Ghanaian mobile data
       — staring at an empty header. Everything below the fold stays lazy. */
    var isHero = !!el.closest('.hero');

    if (rec.video) {
      var v = document.createElement('video');
      v.className = 'plate-img plate-video';
      v.muted = true;          // set before autoplay, or iOS refuses to start
      v.autoplay = true;
      v.loop = true;
      v.playsInline = true;
      v.setAttribute('muted', '');
      v.setAttribute('playsinline', '');
      v.preload = isHero ? 'auto' : 'metadata';
      if (rec.poster) v.poster = rec.poster;
      // A video conveys no text, so it is decorative to a screen reader; the
      // surrounding copy carries the meaning.
      v.setAttribute('aria-hidden', 'true');
      v.addEventListener('error', function () { v.remove(); });
      v.src = rec.video;
      host.appendChild(v);

      /* Autoplay can be refused (data saver, low power mode) or deferred until
         the element is on screen. Try now, again when it scrolls into view,
         and once more on the first interaction anywhere on the page. */
      function tryPlay() {
        if (!v.paused) return;
        var pr = v.play();
        if (pr && pr.catch) pr.catch(function () {});
      }
      tryPlay();

      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (es) {
          es.forEach(function (e) { if (e.isIntersecting) tryPlay(); });
        }, { threshold: 0.15 }).observe(v);
      }
      ['pointerdown', 'touchstart', 'scroll'].forEach(function (evt) {
        window.addEventListener(evt, tryPlay, { once: true, passive: true });
      });
      return;
    }

    var img = document.createElement('img');
    img.className = 'plate-img';
    img.alt = rec.alt || '';

    if (isHero) {
      img.loading = 'eager';
      img.fetchPriority = 'high';
    } else {
      img.loading = 'lazy';
    }

    img.decoding = 'async';
    img.addEventListener('error', function () { img.remove(); });
    img.src = rec.src;
    host.appendChild(img);
  }

  function run() {
    var nodes = document.querySelectorAll('[data-img]');
    for (var i = 0; i < nodes.length; i++) hydrate(nodes[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();

# Olive Grey School — website

Race Course, Gyedu Junction, Accra. Pre-School (ages 0–5) and iPrimary (6–11),
teaching Pearson Edexcel alongside the GES curriculum. Opened January 2019.

No build step, no framework, no dependencies. Upload the folder to any static
host and it runs.

```
index.html            markup + the inline SVG fallback artwork
assets/css/style.css  design tokens and all styling
assets/js/images.js   PHOTO MANIFEST — every image source lives here
assets/js/main.js     the motion engine
assets/js/cards.js    the 3D card carousel
assets/img/           the school's logo, crest and photographs
```

## Run it

```bash
python -m http.server 5178
```

Then open <http://localhost:5178>.

**When you change CSS or JS, bump the `?v=` number on the tags at the bottom of
`index.html` and in `<head>`.** Browsers cache these aggressively — a stale
copy is why a change can appear to do nothing.

---

## Brand

The palette is sampled from the school crest, not chosen. The name says olive;
the mark is red and grey, and the mark wins.

| Token | Value | Source |
|---|---|---|
| `--brand` | `#E41824` | the crest's outer ring, and the uniform |
| `--brand-deep` | `#9C1520` | deepened, for full-panel use |
| `--muted` | `#786C6C` | the crest's inner disc, sampled exactly |
| `--ink` | `#241F1F` | the crest lettering, warmed |
| `--cream` | `#F5F2F1` | off-white carrying the grey's warmth |

Type is Aboreto for display and Zalando Sans for body, both from Google Fonts.

## Images

**Every photo source is in `assets/js/images.js` — that is the only file to
edit.** Markup refers to pictures by key (`data-img="classroom"`), so adding a
photograph never means touching `index.html`.

There are four photographs so far, taken from the school's own site and served
locally rather than hotlinked, so several slots reuse the same picture. To add
more: drop files into `assets/img/`, add a line to the manifest, point the
slots at them.

Each photo is layered **over** an inline SVG illustration. If a file goes
missing the `<img>` removes itself and the illustration shows through, so a
broken path never leaves a broken-image icon.

## Motion

| Effect | How to use it |
|---|---|
| Per-letter / per-word entrance | `data-split="letters"` or `"words"`, `data-stagger="0.04"` |
| Fade-and-rise on entry | `data-reveal` (add `style="--d:.2s"` to delay) |
| Media wipe-in | `data-clip` on a `.plate` |
| Scroll-linked word fill | `data-fill` on a heading |
| Parallax drift | `data-parallax="0.06"` |
| Magnetic hover | `data-magnetic` on a button |

Everything is disabled under `prefers-reduced-motion: reduce`, and all content
is readable with JavaScript switched off.

### Implementation notes worth keeping

These look odd until you know why. Please don't "tidy" them:

- **The hero is pinned** (`position: sticky`) so the section below climbs over
  it. That means the hero sits beneath the *whole* page, so **every section
  needs an opaque background** or the hero bleeds through.
- **Reveals are driven by scroll position, not only IntersectionObserver.**
  Elements start at `opacity: 0.001`; if the observer fails, the page is blank.
  `revealInView()` is the guaranteed path. It tests *vertical* overlap only
  (the campus rail scrolls horizontally) and has no lower bound (a fast flick
  can carry a section past the fold between two frames).
- **Wordstrips and the marquee drift on their own**, not pinned to scroll. A
  strip at the very bottom of the page has no scroll left to drive it and would
  arrive parked.
- **The card stage is `overflow: hidden`.** Cards travel past its edge before
  disappearing; without the clip they reach into the heading and footnote rows.
- **Parallax offset is clamped to 10% of element height**, because travel is
  `(viewport + height) / 2 × speed` and outgrows the 12% overscan on tall
  screens.
- **Card stacking is desktop-only.** Below 1024px the cards run edge to edge
  and scroll normally — pinned, they were taller than a phone viewport and got
  clipped.

---

## Before this goes live

1. **Confirm the facts.** Everything on the page comes from the school's own
   website. Fees, term dates, staff numbers, class sizes and room counts are
   not published anywhere, so they are simply absent rather than guessed. Get
   them from the school and fill the gaps.
2. **Resolve the collection time.** Their current site says 17:30 on one page
   and 18:00 on another. This site uses 18:00 throughout.
3. **Wire the enquiry form.** `#enquiry` validates in the browser and shows a
   confirmation; it sends nothing. Point it at a real endpoint and add
   server-side validation and a spam guard.
4. **Photo consent.** Pupils' faces appear here and on three social channels.
   Ghana's Data Protection Act 2012 (Act 843) applies and these are minors —
   consent should be recorded per child before launch.
5. **Add an OG image** (1200×630) for link previews.

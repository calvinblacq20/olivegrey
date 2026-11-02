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

The photographs are the school's own, served locally rather than hotlinked. To
add more: drop files into `assets/img/`, add a line to the manifest, point the
slots at them. A slot can hold a video instead of a photograph — give it a
`poster`, which on a slow connection may be all a visitor ever sees.

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

### Motion is one switch

`<html data-motion>` is the single source of truth, resolved by an inline
script in `<head>` before first paint. Both the stylesheet and the JavaScript
read that one attribute, so they cannot disagree.

| Value | When | What runs |
|---|---|---|
| `full` | nothing was asked for | everything |
| `calm` | the device asked for less motion | fades, the carousel, the drifting type |
| `off` | no JavaScript | nothing moves; the page is complete and readable |

**`calm` is less motion, not none.** What the preference exists to prevent is
movement that can make a reader ill — parallax, layers drifting against the
scroll, a photograph zooming slowly behind text, letters flying in from off to
one side. A carousel turning in its own frame at a constant rate is contained
and predictable, so it stays, and so do fades: opacity is not motion.

Killing everything was the first implementation, and it made the site look
broken on any handset with Reduce Motion switched on — which on iOS includes
every phone in Low Power Mode.

**iOS reports `prefers-reduced-motion: reduce` under Low Power Mode**, not only
under the Reduce Motion accessibility toggle. So an iPhone can arrive with every
animation silenced and nothing on screen saying why; it reads as a broken site.
That is worth knowing before debugging anything else.

`?motion=full`, `?motion=calm` and `?motion=off` force it. Use them to tell a device
setting apart from a real bug without touching the handset's settings:

```
olivegrey.vercel.app/?motion=full
```

If it animates with the flag and not without, the phone asked for stillness.

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
- **The carousel loop is time-based and self-restarting.** Safari stops
  `requestAnimationFrame` while a finger is on the screen, when the page is
  backgrounded, and when it comes back from the back/forward cache — and does
  not reliably resume. So a watchdog checks the loop is still beating, and the
  on-screen test is a rect read inside the loop rather than an observer that
  can fail to deliver.
- **Card stacking is desktop-only.** Below 1024px the cards run edge to edge
  and scroll normally — pinned, they were taller than a phone viewport and got
  clipped.

---

## Before this goes live

1. **Confirm the facts.** Everything on the page comes from the school's own
   website, or from photographs of its premises and paperwork: the signboard,
   the fee sheet, the Arsenic 5(A) timetable, the term calendar and the office
   door. The class names, the virtues on the doors, the shape of the school
   day and the mission and vision are quoted from those, not paraphrased.

   **Fees are now known but deliberately not on the page.** The sheet gives
   registration, admission, termly tuition, lunch, breakfast, books and
   uniform. Publishing them would qualify enquiries before they arrive, which
   is worth doing — but it is a commercial decision for the school to make,
   not one to make on their behalf.

   **The iPrimary fee sheet is still missing**; the one photographed covers
   Pre-School only. Staff numbers and class sizes remain unpublished and so
   remain absent rather than guessed.
2. **Resolve the collection time.** Their current site says 17:30 on one page
   and 18:00 on another. This site uses 18:00 throughout.
3. **Wire the enquiry form.** `#enquiry` validates in the browser and shows a
   confirmation; it sends nothing. Point it at a real endpoint and add
   server-side validation and a spam guard.
4. **Photo consent.** Pupils' faces appear here and on three social channels.
   Ghana's Data Protection Act 2012 (Act 843) applies and these are minors —
   consent should be recorded per child before launch.
5. **Add an OG image** (1200×630) for link previews.

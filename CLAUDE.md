# LITALK Education — public website

Conventions for anyone (person or agent) changing this repo. Written from what
the code actually does, not from a generic checklist: where a rule exists here,
it is because something already broke without it.

## What this is

Plain static HTML, CSS and JavaScript. **No bundler, no framework, no build
step.** Files are served exactly as they sit in the repo.

That is a deliberate constraint, not an oversight. Do not introduce React, a
component folder tree, npm scripts, or a compile step "to make it cleaner" —
the hosting serves static files and a build step would have to be run and
committed by hand on every change.

```
*.html            one file per page, hand-written
css/style.css     the marketing site
css/student-portal.css   the signed-in student pages + /checkin
css/fonts.css     @font-face only
js/*.js           one file per concern, plain scripts, no modules
img/              static assets
```

Reuse happens by **copying a block between pages and keeping it identical**.
That is the trade for having no build step, and it is why several rules below
are about "change it in all N places".

## Cache busting — read this first

Every asset is referenced with a version query: `style.css?v=20260728a`.

**If you change a file in `css/` or `js/`, you must bump its token in every
HTML file that references it.** There is nothing to catch this for you.
Returning visitors keep the old file otherwise, and the failure is confusing:
the page half-works, styled by yesterday's CSS.

```bash
# after editing css/style.css
sed -i 's|style.css?v=20260728a|style.css?v=20260728b|g' *.html
grep -rho "style.css?v=[0-9a-z]*" *.html | sort -u   # expect exactly one
```

## Design tokens

Defined in `:root` in `css/style.css`, with dark values under
`@media (prefers-color-scheme: dark)` and `:root[data-theme=...]`.

| Group | Tokens |
| --- | --- |
| Colour | `--clr-black --clr-bg --clr-border --clr-muted --clr-light-bg` … |
| Spacing | `--space-1`…`--space-7` (4→48px), `--section-py`, `--section-head-gap` |
| Radius | `--radius --radius-sm --radius-lg --radius-pill` |
| Shadow | `--shadow-sm --shadow-md` |
| Motion | `--transition-fast` (150ms) `--transition` (250ms) `--transition-md` (300ms), plus per-component `--*-dur` / `--*-ease` |
| Stacking | `--z-raised --z-sticky --z-nav --z-drawer --z-overlay --z-modal --z-notice` |

Rules:

- **Never write a raw colour outside `:root`.** A literal `#FFFFFF` is not
  white in dark mode. There are still ~30 such literals in the file; do not
  add to them, and convert the ones you touch.
- **Never invent a z-index.** Pick the rung that describes what the thing *is*.
  Choosing a number big enough to win today is how this file ended up with
  twelve unrelated values. Older rules still carry raw numbers that map onto
  the ladder; they are documented, not yet rewritten.
- `--section-head-gap` is the gap from a section's heading block to its
  content. It has drifted twice (one section at 64px, another at 48px, against
  56px everywhere else), which is why it is a named token rather than a number
  repeated in ten rules.

## Bilingual content

Every user-visible string carries `data-en` and `data-th`; `applyLang()` in
`js/main.js` swaps them.

**`applyLang()` assigns `textContent`.** Anything nested inside an element that
has `data-en` is destroyed the first time someone switches language. If a
sentence needs a link or a `<strong>` inside it, put the markup in a sibling
element, not inside the translated node. This has bitten twice.

The language switch appears three times per page — header bar, mobile drawer,
footer. On phones the header one is hidden; the drawer is where it lives.
`js/main.js` binds every instance independently, so adding a fourth needs no
JS change.

## The two menus must match

The header bar and the mobile drawer are separate markup. When you add, remove
or rename a nav item, **do it in both, on all 14 pages.** They currently carry
the same six links — Online Learning, LITALK+, 1-on-1 Tutoring, About, Ask,
Blog — the same two login options and the same call to action.

A drawer that quietly lacks something the bar has is invisible on desktop,
where you are probably testing.

**The bar is full.** At 1200px — the narrowest width where it renders at all,
below that `.nav__links` is `display: none` — the logo, the language toggle,
the login menu and the CTA take 601px of the 1152px container, leaving 551px
for the links. In English they need 517px, so there are **33px spare**. Thai
is roomier (66px). A seventh item does not fit, and tightening the gaps far
enough to force one in leaves zero slack, which the next label edit breaks;
that is already why the gap went 36px → 28px. Contact left the bar to make
room for LITALK+ — it was a `/#contact` jump the footer carries on every page.
Measure before adding anything here.

## Motion

- 150ms for a control reacting to a press or hover, 250ms for most things,
  300ms for larger movements. Use the tokens.
- Open and close can differ; see `--panel-open-dur` / `--panel-close-dur`.
- **`prefers-reduced-motion` is already handled globally** by a reset with
  `!important` at the top of the file. You do not need a per-component block —
  the existing ones are belt-and-braces. Do not remove the global reset.
- `.animate` holds an element 28px lower until it scrolls into view. **When
  measuring layout, force `.in-view` first**, or every gap reads 28px short.
  A spacing audit here reported four false inconsistencies before this was
  noticed.

## Media queries and specificity

Mobile overrides live in one `@media (max-width: …)` block near the end. Two
bugs have come from the same trap:

- A rule in that block matching a broader selector than intended **beats an
  earlier, equally specific rule**. `.svc-layer { inset: … }` in the mobile
  block overrode `.svc-layer--blocking { inset: 0 }` above it and stopped a
  full-screen overlay covering anything.
- `.booking-wrap > *` ties with `.step-indicator`, which is defined later and
  won.

When a rule should not reach a variant, say so — `:not(.x)` or one class
deeper — rather than relying on source order.

## States every view needs

Loading, empty, error, and no-results. The blog list has a skeleton
(`blog-shimmer`); prefer a skeleton over a spinner when content takes more than
~300ms. There is currently **no offline state and no debounce on the blog
search** — both are worth adding, neither exists yet, so do not assume a
helper is available.

## Security

- Anything derived from user input or from the API is escaped before it reaches
  `innerHTML`. `js/markdown.js` escapes first, extracts inline code first, and
  allows only `http(s)` and `mailto` URLs. Reuse it rather than writing a
  second renderer — there used to be three copies.
- No API keys, tokens or secrets in this repo. It is a public static site;
  everything here ships to the browser. The Worker holds the secrets.
- The service-notice bypass token is verified server-side and never compared
  in the browser.

## SEO — current state

Every page has `<title>`, a description, Open Graph and a Twitter card.
**No page has a canonical URL, and none has structured data.** New pages should
carry both; the blog especially wants `Article` / `BlogPosting` JSON-LD.

## Performance — current state

`font-display: swap` is set on every `@font-face`. Fonts are **not** preloaded.
Of 48 `<img>` elements, 5 are lazy-loaded, none use `srcset`, and 30 declare
width and height. New images should set `loading="lazy"` (except above the
fold), intrinsic `width`/`height` so the layout does not shift, and a
`srcset` where a large asset is scaled down.

## Accessibility — current state

A skip link exists on 9 of 16 pages (missing on 404, error, blog, blog-post,
checkin, and the two legal pages). `aria-label` is used widely. There are only
four `:focus-visible` rules — new interactive elements need a visible focus
ring. Tap targets are 44px minimum.

## Before you change anything

1. Read the surrounding code and match it — naming, comment density, and the
   way the neighbouring block is written.
2. Reuse what is there. Three Markdown renderers existed before they were
   merged into one.
3. Change only what the task needs. Working code that is merely old is not a
   reason to rewrite it.
4. If you touch `css/` or `js/`, bump the cache token.
5. Verify by measuring, not by looking. Every layout claim in this file came
   from a number read out of a browser, and several "obvious" readings were
   wrong until the reveal animation was accounted for.

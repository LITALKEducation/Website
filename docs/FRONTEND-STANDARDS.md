# LITALK Website Frontend Standards

This document defines the shared implementation contract for the public LITALK Education website. New public features should extend these primitives instead of creating page-specific alternatives.

## 1. Navigation

- Public pages use the shared site navigation implemented by `js/site-nav.js`.
- Standard classes are `.nav`, `.nav__inner`, `.nav__links`, `.nav__actions`, `.nav__drawer`, `.login-menu`, and `.nav__hamburger`.
- Public navigation routes use root-relative URLs (`/courses`, `/blog`, `/portal/student`, etc.) so nested pages behave identically.
- Active navigation uses `.nav__link--active` and `aria-current="page"`.
- Mobile drawers must release body scroll on close, link navigation, outside click, Escape, rotation, and desktop resize.
- Do not create a page-specific navbar class unless the page is an authenticated application with a deliberately separate shell.

## 2. Language

- `.lang-toggle` is the only user-facing language control on the public website.
- Language values are only `en` or `th`.
- The persisted key is `localStorage['litalk-lang']`.
- The document state is mirrored to both `<html lang>` and `<html data-lang>`.
- Shared APIs are `window.litalkGetLang()` and `window.litalkSetLang(lang)`.
- Dynamic features subscribe to `litalk:langchange` instead of creating independent language buttons or storage keys.
- Static localized copy uses paired `data-en` and `data-th` attributes.
- Localized placeholders use paired `data-en-placeholder` and `data-th-placeholder` attributes.

## 3. Styling and themes

- Public pages inherit tokens from `css/style.css`.
- Dark mode follows `@media (prefers-color-scheme: dark)` on the public website.
- Feature styles should consume shared variables such as `--clr-bg`, `--clr-black`, `--clr-muted`, `--clr-border`, spacing, radius, transition, shadow, and z-index tokens.
- Do not duplicate `.lang-toggle`, navigation, login-menu, button, or global accessibility styles in feature CSS.
- Touch-only controls must provide at least a 44px hit target on coarse pointers.
- Motion must respect `prefers-reduced-motion`.

## 4. Buttons and interaction states

- Use shared `.btn` variants for primary site actions.
- Icon-only controls require an accessible name.
- Toggle controls expose state with `aria-expanded` or `aria-pressed` as appropriate.
- Hidden content uses the native `hidden` attribute unless animation requires an explicit transition state.
- Keyboard Escape should dismiss drawers, menus, and dismissible overlays where applicable.

## 5. Dynamic content and security

- Never place unsanitized external, AI, Markdown, CMS, or admin-authored HTML into `innerHTML`.
- Shared Markdown rendering/hardening lives in `js/markdown.js`.
- `marked.parse()` output must remain behind the shared sanitizer boundary.
- Prefer `textContent`, DOM element construction, and allowlisted attributes for dynamic output.
- External links opened in a new tab use `rel="noopener noreferrer"`.

## 6. API and identity behavior

- Authenticated identity comes from the authenticated server mapping (`/portal/whoami`), not inferred email formats or query-string identifiers.
- Client UI must not display raw authentication/debug payloads in production.
- API failures should fail explicitly and provide recoverable UI rather than silently guessing identity or reporting false success.

## 7. Shared public bootstrap

`js/service-notice.js` is loaded broadly across public pages and bootstraps `js/site-nav.js`. Pages that do not use the standard public bootstrap (for example a standalone feature entry) must load `site-nav.js` directly.

The Student Portal is an authenticated application shell and may intentionally retain its own navigation/theme controls. Public website components must not fork into additional competing implementations.
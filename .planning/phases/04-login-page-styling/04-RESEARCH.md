# Phase 04: Login Page Styling - Research

**Researched:** 2026-03-01
**Domain:** CSS theming / Tailwind v4 custom properties / React component styling
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-07 | Login page uses existing Tailwind dark theme to match app aesthetic | Fully mapped — th-* CSS custom properties, bd-input, bd-btn-primary classes all documented below |
</phase_requirements>

---

## Summary

The login page (`app/login/page.tsx`) was built with hardcoded Tailwind color utilities (`bg-gray-900`, `border-gray-700`, `bg-blue-600`, etc.). The rest of the app uses a theming system built on CSS custom properties (`--th-*` variables) defined in `app/globals.css`, exposed as Tailwind v4 color tokens (`color-th-*`), and wrapped in reusable component classes (`bd-input`, `bd-btn-primary`, `bd-panel`). The login page does not use any of these.

The fix is purely a class substitution in a single 100-line file. No new libraries, no new files, no logic changes — only the JSX className strings need updating. The page structure (centered card, label/input/button layout) is already correct and matches what the app uses elsewhere.

**Primary recommendation:** Replace all hardcoded color utilities in `app/login/page.tsx` with `th-*` Tailwind color utilities and `bd-*` component classes. No other files need to change.

---

## Current Login Page — Audit

The existing `app/login/page.tsx` uses these hardcoded classes that must be replaced:

| Element | Current classes | Problem |
|---------|-----------------|---------|
| Page wrapper | `flex items-center justify-center min-h-screen` | No background set — inherits `body` background (OK, body uses `var(--background)`) |
| Card container | `p-8 rounded-lg max-w-sm w-full border border-gray-700 bg-gray-900` | Hardcoded dark colors — breaks in light mode |
| Heading | `text-xl font-semibold mb-6 text-white` | `text-white` hardcoded — breaks in light mode |
| Label | `block text-sm font-medium text-gray-300 mb-1` | `text-gray-300` hardcoded |
| Input | `w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent` | Entirely hardcoded — duplicates what `bd-input` already does |
| Error text | `text-red-500 text-sm` | `text-red-500` hardcoded instead of `text-th-danger` |
| Submit button | `w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors` | Duplicates what `bd-btn-primary` already does |
| Suspense fallback | `flex items-center justify-center min-h-screen text-gray-400` | `text-gray-400` hardcoded |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | v4 (^4) | Utility-first CSS framework | Already in use project-wide |
| CSS Custom Properties (th-*) | N/A | Theme tokens for colors, surfaces, text | Defined in globals.css, consumed everywhere |

### Component Classes Available

Defined in `app/globals.css`:

| Class | What it styles | CSS variables used |
|-------|---------------|--------------------|
| `bd-panel` | Card/panel surface with border and shadow | `--th-card`, `--th-border`, `--th-shadow` |
| `bd-input` | Form input field | `--th-card`, `--th-border`, `--th-text`, `--th-text-muted` (placeholder), `--th-accent` (focus border), `--th-ring` (focus ring) |
| `bd-btn-primary` | Primary action button | `--th-accent`, `--th-text-inverse`, `--th-accent-hover` |
| `bd-chip` | Small tag/chip element | `--th-border`, `--th-card-alt`, `--th-text-secondary` |

### Tailwind v4 Theme Color Tokens

These are usable as `bg-th-*`, `text-th-*`, `border-th-*` Tailwind utilities because they are registered under `@theme inline` in globals.css:

**Surface tokens:**
- `bg-th-bg` — page background (`--th-bg`)
- `bg-th-card` — card/panel background
- `bg-th-card-alt` — alternate card surface
- `bg-th-card-hover` — hover state surface
- `bg-th-sidebar` — sidebar background
- `bg-th-inset` — inset/inner section background

**Text tokens:**
- `text-th-text` — primary text
- `text-th-text-secondary` — secondary/subdued text
- `text-th-text-muted` — muted/placeholder text
- `text-th-text-accent` — accent-colored text (red `#FF3349`)
- `text-th-text-inverse` — inverted text (used on colored buttons)

**Border tokens:**
- `border-th-border` — standard border
- `border-th-border-subtle` — very subtle border
- `border-th-border-hover` — border on hover
- `border-th-accent` — accent-colored border

**Status tokens:**
- `text-th-danger` — danger/error text (`--th-danger`)
- `text-th-success` — success text
- `text-th-warning` — warning text

### Theme Switching

`app/layout.tsx` includes an inline script that reads `localStorage.getItem('sovereign-theme')` and conditionally applies the `.dark` class to `<html>`. This means:
- Light theme: `:root` CSS variables are active (warm off-white palette)
- Dark theme: `.dark` CSS variables override `:root` (deep navy palette)

All `th-*` custom properties are defined for both themes. The `bd-*` component classes reference these variables and therefore automatically adapt.

The `body` base style sets `background: var(--background)` and `color: var(--foreground)`, so the page wrapper div does not need an explicit background if it fills the viewport via `min-h-screen`.

---

## Architecture Patterns

### How the App Styles Inputs and Buttons

From the component files (13 found with bd-* classes), the consistent pattern is:

```tsx
// Input
<input className="bd-input w-full rounded-lg px-3 py-2 text-sm" />

// Button
<button className="bd-btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-60">
  Submit
</button>

// Card/panel container
<div className="bd-panel rounded-lg p-6">
```

The `bd-*` class provides color/border/shadow; Tailwind utilities add spacing, rounding, and size. This is the separation of concerns used everywhere.

### Recommended Replacement Structure for login/page.tsx

```tsx
// Outer wrapper — no change needed; body handles background
<div className="flex items-center justify-center min-h-screen">

  // Card — replace hardcoded colors with bd-panel
  <div className="bd-panel rounded-lg p-8 max-w-sm w-full">

    // Heading — replace text-white with text-th-text
    <h1 className="text-xl font-semibold mb-6 text-th-text">Sign in</h1>

    // Label — replace text-gray-300 with text-th-text-secondary
    <label className="block text-sm font-medium text-th-text-secondary mb-1">

    // Input — replace all hardcoded classes with bd-input + sizing
    <input className="bd-input w-full rounded-md px-3 py-2" />

    // Error — replace text-red-500 with text-th-danger
    <p className="text-th-danger text-sm">{error}</p>

    // Button — replace hardcoded colors with bd-btn-primary + sizing
    <button className="bd-btn-primary w-full rounded-md py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed">

  </div>
</div>

// Suspense fallback — replace text-gray-400 with text-th-text-muted
<div className="flex items-center justify-center min-h-screen text-th-text-muted">
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Themed input styling | Custom input CSS | `bd-input` class | Already handles focus ring, border, placeholder color, light/dark |
| Themed button styling | Custom button CSS | `bd-btn-primary` class | Already handles hover, accent color, inverse text |
| Card surface styling | Inline style or custom class | `bd-panel` class | Already handles card bg, border, shadow, light/dark |
| Danger/error text color | `text-red-500` | `text-th-danger` | Adapts to theme; `text-red-500` is wrong shade in dark mode |

**Key insight:** Every hardcoded color in the login page already has an exact equivalent in the theme system. This is a pure substitution with zero net new code.

---

## Common Pitfalls

### Pitfall 1: Not Adding `bd-panel` — Using raw Tailwind bg instead
**What goes wrong:** Card uses `bg-th-card` directly but misses the border and shadow that `bd-panel` includes.
**How to avoid:** Use the composite `bd-panel` class; don't reconstruct it manually.

### Pitfall 2: Leaving `text-white` on the heading
**What goes wrong:** Heading is invisible in light mode (white text on white/cream background).
**How to avoid:** Replace with `text-th-text` which maps to `#002C48` in light and `#e2e8f0` in dark.

### Pitfall 3: Forgetting the Suspense fallback text
**What goes wrong:** The fallback div at line 96 also has a hardcoded `text-gray-400` — easy to miss since it only shows during the brief Suspense window.
**How to avoid:** Update the fallback className too (`text-th-text-muted`).

### Pitfall 4: Adding `focus:` utilities on top of `bd-input`
**What goes wrong:** `bd-input` already defines focus state (border-color + ring via `--th-ring`). Adding `focus:ring-2 focus:ring-blue-500 focus:border-transparent` on top creates conflicting styles.
**How to avoid:** Remove all `focus:` utilities when applying `bd-input`.

### Pitfall 5: Not testing light mode
**What goes wrong:** Developer only tests in dark mode; light mode is broken but undetected.
**How to avoid:** Toggle theme via `localStorage.setItem('sovereign-theme', 'light')` in browser console and reload to verify.

---

## Code Examples

### bd-input definition (from globals.css)
```css
/* Source: app/globals.css lines 225-238 */
.bd-input {
  background: var(--th-card);
  border: 1px solid var(--th-border);
  color: var(--th-text);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.bd-input::placeholder {
  color: var(--th-text-muted);
}
.bd-input:focus {
  outline: none;
  border-color: var(--th-accent);
  box-shadow: 0 0 0 3px var(--th-ring);
}
```

### bd-btn-primary definition (from globals.css)
```css
/* Source: app/globals.css lines 212-223 */
.bd-btn-primary {
  background: var(--th-accent);
  color: var(--th-text-inverse);
  border: 1px solid var(--th-accent);
  box-shadow: 0 1px 3px rgba(59, 130, 246, 0.25);
  font-weight: 500;
  transition: background-color 0.15s, box-shadow 0.15s;
}
.bd-btn-primary:hover {
  background: var(--th-accent-hover);
  box-shadow: 0 2px 6px rgba(59, 130, 246, 0.35);
}
```

Note: The `disabled:opacity-50 disabled:cursor-not-allowed` utilities from the current button can be kept as-is; they are Tailwind state variants, not color overrides, so they are safe alongside `bd-btn-primary`.

### bd-panel definition (from globals.css)
```css
/* Source: app/globals.css lines 195-199 */
.bd-panel {
  background: var(--th-card);
  border: 1px solid var(--th-border);
  box-shadow: var(--th-shadow);
}
```

### Real usage example from the app (prompt-hub-tab.tsx)
```tsx
// Source: components/dashboard/tabs/prompt-hub-tab.tsx
<input
  className="bd-input w-full rounded-lg px-3 py-2 text-sm"
  placeholder="Enter prompt..."
/>
<button
  className="bd-btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-60"
>
  Add
</button>
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Hardcoded `bg-gray-*` / `text-gray-*` utilities | `th-*` token utilities + `bd-*` component classes | Theme-adaptive — works in light and dark without duplication |
| Tailwind v3 `tailwind.config.js` with `theme.extend.colors` | Tailwind v4 `@theme inline` block in CSS | No config file needed; tokens defined in CSS |

---

## Open Questions

None — research is conclusive. All elements map cleanly to existing theme tokens.

---

## Sources

### Primary (HIGH confidence)
- `app/globals.css` — all `th-*` custom properties, `bd-*` component classes (direct file read)
- `app/login/page.tsx` — current implementation, all hardcoded classes (direct file read)
- `app/layout.tsx` — theme switching mechanism via inline script (direct file read)
- `components/dashboard/tabs/*.tsx` — 13 files confirming `bd-input` / `bd-btn-primary` usage patterns (direct grep)

### Secondary (MEDIUM confidence)
- None required — all evidence is from project source files

---

## Metadata

**Confidence breakdown:**
- Current login page state: HIGH — direct file read
- Available theme tokens: HIGH — direct globals.css read
- Component class behaviour: HIGH — CSS definitions read, usage patterns confirmed across 13 files
- Required changes: HIGH — complete mapping established

**Research date:** 2026-03-01
**Valid until:** Stable until globals.css theme system changes (low churn area)

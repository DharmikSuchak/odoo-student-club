# Design System — Student Club Platform

> This document is the single source of truth for the visual language of the
> application. Every UI contribution must follow it exactly. When in doubt,
> derive rather than invent.

---

## 1. Typography

### Font Families

| Role | Family | Fallbacks |
|------|--------|-----------|
| Body, UI chrome, navigation | **Inter** | `system-ui, -apple-system, sans-serif` |
| Headings, page titles, large numbers, auth title | **Outfit** | `Inter, system-ui, sans-serif` |

**Google Fonts import (place in `index.html` or global CSS):**

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@700;800&display=swap"
  rel="stylesheet"
/>
```

### Type Scale

| Token | Size | Weight | Family | Tracking | Usage |
|-------|------|--------|--------|----------|-------|
| `text-badge` | 9 px | 700 (bold) | Inter | uppercase | Tiny status badges |
| `text-table-header` | 12 px | 600 (semibold) | Inter | uppercase + wide | Table column headers |
| `text-body` | 14 px | 500 (medium) | Inter | normal | Body copy, nav items |
| `text-tab` | 14 px | 700 (bold) | Inter | normal | Tab labels, section labels |
| `text-card-title` | 18 px | 700 (bold) | Outfit | normal | Card and panel titles |
| `text-page-heading` | 24 px | 700 (bold) | Outfit | normal | Page headings (`<h1>`) |
| `text-stat` | 30 px | 700 (bold) | Outfit | normal | Dashboard statistics |
| `text-auth-title` | 36 px | 800 (extrabold) | Outfit | normal | Auth screen hero title |

---

## 2. Color Tokens

### Brand (Sky)

| Token | Hex | Usage |
|-------|-----|-------|
| `brand-50` | `#f0f9ff` | Tinted active backgrounds, subtle fills |
| `brand-100` | `#e0f2fe` | Hover backgrounds, info fills |
| `brand-500` | `#0ea5e9` | Primary actions, links, focus rings |
| `brand-600` | `#0284c7` | Button hover state |
| `brand-700` | `#0369a1` | Button active / pressed state |

### Slate (Neutral)

| Token | Hex | Usage |
|-------|-----|-------|
| `slate-50` | `#f8fafc` | Table header background |
| `slate-100` | `#f1f5f9` | Page background, subtle fills |
| `slate-200` | `#e2e8f0` | Borders, dividers, input borders |
| `slate-400` | `#94a3b8` | Placeholder text, inactive icons |
| `slate-500` | `#64748b` | Secondary / muted text |
| `slate-700` | `#334155` | Primary body text |
| `slate-800` | `#1e293b` | Sidebar background, strong headings |

### Status

| Token | Background | Text | Usage |
|-------|-----------|------|-------|
| `success` | `#dcfce7` | `#15803d` | Paid, active, confirmed |
| `warning` | `#fef3c7` | `#b45309` | Pending, expiring soon |
| `info` | `#dbeafe` | `#1d4ed8` | Informational, new |
| `danger` | `#fee2e2` | `#dc2626` | Error, overdue, banned |

---

## 3. Shadows

```css
/* Card resting */
box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.03), 0 2px 8px rgba(0, 0, 0, 0.04);

/* Card hover */
box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.03), 0 8px 16px rgba(0, 0, 0, 0.06);
```

Transition the second shadow value on `hover`, not the ring.

---

## 4. Border Radii

| Token | Value | Usage |
|-------|-------|-------|
| `radius-pill` | `9999px` | Nav items, badges |
| `radius-auth` | `24px` | Auth card |
| `radius-card` | `16px` | Cards, inputs, tab containers |
| `radius-dropdown` | `12px` | Tab buttons, dropdowns, modals |
| `radius-btn-sm` | `8px` | Small buttons, avatars, icon boxes |

---

## 5. Layout

### Spacing

| Context | Value |
|---------|-------|
| Desktop page padding | `32px` |
| Mobile page padding | `16px` |
| Card padding | `24px` |
| Card grid gap | `24px` |

### Shell Structure

```
┌─────────────────────────────────────────────────────┐
│  Sticky Header (full width)                         │
├────────────┬────────────────────────────────────────┤
│            │  Sticky Tab Bar (optional, per page)   │
│  240px     ├────────────────────────────────────────┤
│  Fixed     │                                        │
│  Sidebar   │  Scrollable Content Area               │
│            │                                        │
└────────────┴────────────────────────────────────────┘
```

- **Sidebar**: 240 px fixed, never collapses on desktop.  
- **Header**: sticky, `z-index: 50`; contains global nav, notifications, user avatar.  
- **Tab bar**: sticky below header when a page uses tabs; `z-index: 40`.  
- **Content area**: `overflow-y: auto`; full remaining height.  
- **Page background**: subtle diagonal slate pattern on `slate-100`.

### Mobile

- Sidebar becomes a **slide-in drawer** (off-canvas, `transform: translateX`).
- A hamburger button in the header opens/closes the drawer.
- Drawer closes on backdrop click or `Escape`.
- All touch targets ≥ 44 × 44 px.

---

## 6. Sidebar Component

- Nav items: pill shape (`radius-pill`), full-width.
- **Inactive**: slate text (`slate-500`), transparent background.
- **Active**: `brand-50` background, `brand-700` text, left border `3px solid brand-500`, small `8px` brand dot on the right.
- Section labels: `text-table-header` style — 12 px, semibold, uppercase, wide tracking, `slate-400`.
- Footer user card: compact (avatar + name + role tag); sits at the bottom of the sidebar.
- Sidebar scrolls independently if nav items overflow.

---

## 7. Cards and Tables

### Cards

- Background: white.
- Border: `1px solid slate-200`.
- Shadow: card resting shadow (see §3).
- Radius: `radius-card` (16 px).
- Padding: 24 px.
- On hover: transition to card hover shadow over `200ms ease`.
- Stat icon: faint, placed in the far corner of the card at ~40 % opacity.

### Tables

- Outer container: white, `radius-card`, card shadow.
- Header row: `slate-50` background; cells use `text-table-header` style.
- Body rows: separated by `1px solid slate-100`.
- Row hover: `slate-50` tint, `150ms ease`.

---

## 8. Inputs

```
┌──────────────────────────────────────────────┐
│ 🔍  Placeholder text                         │
└──────────────────────────────────────────────┘
```

- Background: white.
- Border: `1px solid slate-200`, radius `radius-card` (16 px).
- Focus ring: `0 0 0 3px rgba(14,165,233,0.25)` (brand-500 at 25 %).
- Leading icon: 16 px icon, `slate-400` color, padded `12px` from edge.
- Error state: border `danger` color, focus ring uses danger color.

---

## 9. Badges

```css
/* base */
display: inline-flex;
align-items: center;
padding: 2px 8px;
border-radius: 9999px;      /* pill */
font-size: 9px;
font-weight: 700;
text-transform: uppercase;
letter-spacing: 0.05em;
```

Apply status color pairs (background / text) from §2.

---

## 10. Motion

| Context | Duration | Easing |
|---------|----------|--------|
| Page transition | `350ms` | `ease-in-out` |
| Card/button entry | `200ms` | `ease-out` |
| Hover transitions | `200–300ms` | `ease` |
| Skeleton shimmer | `2s` | `linear` (infinite) |

**Always** include:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Use **one consistent icon library** across the entire application (e.g.
`lucide-react` — do not mix icon sets).

### Scrollbars

```css
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.2); }
```

---

## 11. Auth Screen

- Same white/blue visual language as the rest of the application.
- Auth card: `radius-auth` (24 px), white background, card shadow.
- Title: `text-auth-title` — 36 px, Outfit, extrabold.
- Restrained **purple accent or gradient** on the sign-in screen only
  (e.g. a subtle background gradient or a decorative element).  
  Do **not** create a separate dark visual identity.
- Do **not** add a dark theme unless explicitly requested.

---

## 12. Implementation Notes

1. Define all tokens as CSS custom properties on `:root`.
2. Never hard-code hex values in component styles; always reference a token.
3. Use `rem` for font sizes (base `16px` → `1rem`). Pixel values in this doc
   are design targets; convert: `9px → 0.5625rem`, `14px → 0.875rem`, etc.
4. Validate any new component against WCAG 2.1 AA contrast ratios.
5. All interactive elements must have a visible focus indicator.

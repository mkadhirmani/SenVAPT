# Sennovate Color System

**Authority:** `[OFFICIAL BRAND RULE]` for Core Brand Colors, Supporting Colors, and Variations; `[PRODUCT UI STANDARD]` for Application UI Tokens.  
**Source:** Sennovate Brand Guidelines (Slides 12–15)

---

## 1. Core Brand Colors `[OFFICIAL BRAND RULE]`

Directly extracted from **Slide 12** (*Color Palette*):

| Color Name | Swatch | HEX | RGB | CMYK | Pantone |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **Sennovate Blue** | 🟦 | `#006FE3` | `rgb(0, 111, 227)` | `100%, 51%, 0%, 11%` | `285 C` |
| **Sennovate Dark Blue** | ⬛ | `#001B41` | `rgb(0, 27, 65)` | `100%, 58%, 0%, 75%` | `295 C` |
| **Sennovate White** | ⬜ | `#FFFFFF` | `rgb(255, 255, 255)` | `0%, 0%, 0%, 0%` | `White` |

---

## 2. Supporting Colors `[OFFICIAL BRAND RULE]`

Directly extracted from **Slide 14** (*Supporting Colors*):

Supporting colors extend the Sennovate palette, adding flexibility, clarity, and visual balance across different applications.

| Color Role | Swatch | HEX | RGB | CMYK |
| :--- | :---: | :--- | :--- | :--- |
| **Green** | 🟩 | `#299346` | `rgb(41, 147, 70)` | `72, 0, 53, 42` |
| **Purple / Indigo** | 🟪 | `#3C2C86` | `rgb(60, 44, 134)` | `55, 67, 0, 47` |
| **Terra Cotta / Rust** | 🟧 | `#B9623C` | `rgb(185, 98, 60)` | `0, 47, 67, 27` |

---

## 3. Official Color Variations (Tints) `[OFFICIAL BRAND RULE]`

Directly extracted from **Slides 13 & 15** (*Color Variations*):

Both Core and Supporting colors have approved tint variations:
* **100%** — Full saturation (Primary)
* **70%** — Medium-high tint
* **50%** — Mid tint
* **30%** — Soft background / container tint
* **10%** — Subtle surface / hover tint

---

## 4. Proposed Product UI Tokens `[PRODUCT UI STANDARD]`

> **Clarification:** The Brand Guidelines do not define application-level UI canvas colors, borders, or semantic alerts. The following tokens are **Product UI Standards** created for software engineering consistency, NOT official Sennovate brand colors.

```css
/* Neutral Canvas & Surfaces [PRODUCT UI STANDARD] */
--color-bg-canvas: #F8FAFC;        /* Light mode application canvas */
--color-bg-surface: #FFFFFF;       /* Card and container surface */
--color-border-subtle: #E2E8F0;    /* Card and input borders */
--color-border-strong: #CBD5E1;    /* Divider and emphasized borders */
--color-text-primary: #001B41;     /* Primary text (using Sennovate Dark Blue) */
--color-text-secondary: #4A5568;   /* Secondary body / labels */
--color-text-muted: #94A3B8;       /* Placeholders and timestamps */

/* Semantic Status Tokens [PRODUCT UI STANDARD] */
--color-status-success: #299346;   /* Aligned with official Supporting Green */
--color-status-warning: #B9623C;   /* Aligned with official Supporting Terra Cotta */
--color-status-danger: #DC2626;    /* Standard application error red */
--color-status-info: #006FE3;      /* Sennovate Blue */
```

---

## 5. What is NOT in the Brand Guidelines

* **The 60-30-10 Rule:** This is an interior/graphic design heuristic. It is **NOT** an official Sennovate brand rule. It may be considered an optional layout suggestion, but must never be cited as an official brand requirement.
* **Electric Cyan (`#00F0FF`):** Not defined in the official Brand Guidelines. If used as an accent in a specific UI prototype, it must be labeled as a local product exception.
* **Undefined Colors:** When an application requires a color not specified in the Brand Guidelines or Product UI Tokens, developers and agents must mark it as `TO BE DEFINED` rather than inventing an official Sennovate color.

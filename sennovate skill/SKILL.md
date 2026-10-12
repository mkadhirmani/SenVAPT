---
name: sennovate-product-skill
description: "Authoritative product development skill for Sennovate developers, interns, and AI coding agents. Enforces official brand rules (exact colors, typography, logo clear space, official iconography) and standardizes product UI systems, design tokens, AI interfaces, and security patterns for building MVPs, dashboards, and SaaS applications."
version: 1.1.0
---

# Sennovate Product Development Skill (v1.1.0)

This skill is the master orchestration guide for AI coding agents and developers building Sennovate MVPs, internal tools, dashboards, AI applications, and enterprise products.

---

## 1. Source-of-Truth Hierarchy

Every design decision and code implementation must respect this strict priority:

1. `[OFFICIAL BRAND RULE]` — Directly supported by the **Sennovate Brand Guidelines**.
   * *Rule:* **Never alter, ignore, or invent alternatives to official brand specifications.**
   * *Scope:* Logo usage, clear space, exact brand colors, official typography, official icon styles, and image direction.
2. `[PRODUCT UI STANDARD]` — Application engineering standards established for software consistency.
   * *Rule:* Follow unless an explicit product exception is justified.
   * *Scope:* Spacing scale (4px grid), border radius, elevation, layout containers, responsive breakpoints, component states, AI UI patterns, and security masking.
3. `[IMPLEMENTATION RECOMMENDATION]` — Technical recommendations (e.g. Lucide Icons for missing UI glyphs, Fontshare CDN).
4. `[EXAMPLE]` — Demonstration patterns. **Examples are illustrative and NOT mandatory official designs.**

---

## 2. The "TO BE DEFINED" Protocol (Handling Undefined Requirements)

When designing or implementing UI, if a specification, color, icon, or behavior is **not defined** in the Brand Guidelines:
1. Check if an existing approved pattern exists in `components/`, `tokens/`, or `layout/`.
2. **DO NOT invent a specification and claim it is an official Sennovate standard.**
3. Explicitly mark the requirement as **`TO BE DEFINED`** and keep any interim implementation localized and clearly documented.

---

## 3. Brand Foundation Overview

| Dimension | Specification | Authority | Deep Dive |
| :--- | :--- | :--- | :--- |
| **Primary Logo** | Lowercase `sennovate` with embedded shield in `o` | `[OFFICIAL BRAND RULE]` | [brand/logo.md](brand/logo.md) |
| **Logo Clear Space** | **`1X`** exclusion zone (height of inner shield) | `[OFFICIAL BRAND RULE]` | [brand/logo.md](brand/logo.md) |
| **Minimum Sizes** | Digital Wordmark $\ge 120\text{px}$, Icon $\ge 32\text{px}$ | `[OFFICIAL BRAND RULE]` | [brand/logo.md](brand/logo.md) |
| **Core Blue** | `#006FE3` (Pantone 285 C, RGB: 0, 111, 227) | `[OFFICIAL BRAND RULE]` | [brand/colors.md](brand/colors.md) |
| **Dark Blue** | `#001B41` (Pantone 295 C, RGB: 0, 27, 65) | `[OFFICIAL BRAND RULE]` | [brand/colors.md](brand/colors.md) |
| **White** | `#FFFFFF` (Pantone White) | `[OFFICIAL BRAND RULE]` | [brand/colors.md](brand/colors.md) |
| **Supporting Colors** | Green `#299346`, Purple `#3C2C86`, Terra Cotta `#B9623C` | `[OFFICIAL BRAND RULE]` | [brand/colors.md](brand/colors.md) |
| **Color Variations** | 100%, 70%, 50%, 30%, 10% official tint scales | `[OFFICIAL BRAND RULE]` | [brand/colors.md](brand/colors.md) |
| **Primary Typeface** | **Satoshi** (Main Headings: `Satoshi 32PT Bold`) | `[OFFICIAL BRAND RULE]` | [brand/typography.md](brand/typography.md) |
| **Secondary Typeface** | **Inter** (Sub Headings: `24PT`, Body: `18PT`, Sub Text: `14PT`) | `[OFFICIAL BRAND RULE]` | [brand/typography.md](brand/typography.md) |
| **Iconography** | Sennovate Filled (Slide 19) & Outline (Slide 20) | `[OFFICIAL BRAND RULE]` | [brand/iconography.md](brand/iconography.md) |

---

## 4. Design Tokens & Modular Architecture

To prevent bloated context and ensure precision, consult the dedicated module files:

* **Design Tokens:**
  * Official Brand Tokens: [`tokens/brand-tokens.json`](tokens/brand-tokens.json)
  * Proposed Product UI Tokens: [`tokens/product-tokens.json`](tokens/product-tokens.json)
  * Master CSS Variables: [`tokens/tokens.css`](tokens/tokens.css)
* **Assets:**
  * Vector Logos & Shield Icons: [`assets/logos/`](assets/logos/)
  * Official Filled & Outline Icons: [`assets/icons/`](assets/icons/)
  * Font Access Guide: [`assets/fonts/FONTS.md`](assets/fonts/FONTS.md)
  * Virtual Backgrounds: [`assets/backgrounds/`](assets/backgrounds/)
* **Component Standards:**
  * Buttons: [`components/buttons.md`](components/buttons.md)
  * Forms & Inputs: [`components/forms.md`](components/forms.md)
  * Cards & Containers: [`components/cards.md`](components/cards.md)
  * Data Tables: [`components/tables.md`](components/tables.md)
  * Navigation & Shell: [`components/navigation.md`](components/navigation.md)
  * Feedback & Modals: [`components/feedback.md`](components/feedback.md)
* **Layout & UX:**
  * Spacing Scale (4px Base Grid): [`layout/spacing.md`](layout/spacing.md)
  * Responsive Breakpoints: [`layout/responsive.md`](layout/responsive.md)
  * The 10 Mandatory States: [`ux/states.md`](ux/states.md)
  * Core UX Principles: [`ux/principles.md`](ux/principles.md)
* **AI & Security UI:**
  * AI Chat, Streaming & Tool Cards: [`ai/ai-ui.md`](ai/ai-ui.md)
  * Secret Masking, RBAC & Audit Trails: [`security/security-ui.md`](security/security-ui.md)

---

## 5. Agent Rules of Engagement

When assigned a task to design, build, or modify a Sennovate interface:
1. **Read Relevant Modules First:** Consult the specific `components/`, `tokens/`, or `brand/` file before writing code.
2. **Icon Priority:** Sennovate's official filled and outline icons (Slides 19 & 20 in `assets/icons/`) take priority. Lucide / Tabler line icons (`1.5px` stroke) are an `[IMPLEMENTATION RECOMMENDATION]` used ONLY for generic UI controls where an official brand icon does not exist. Emojis are strictly banned as UI icons.
3. **Enforce Token Usage:** ALWAYS use CSS Custom Properties (`var(--sennovate-blue)`, `var(--sennovate-dark-blue)`, `var(--color-bg-canvas)`, etc.) rather than hard-coding raw HEX or RGB values in application code.
4. **Typeface vs. Delivery Mechanism:** The `[OFFICIAL BRAND RULE]` mandates **Satoshi** (Headings) and **Inter** (Body). CDN imports (Fontshare / Google Fonts) are `[IMPLEMENTATION RECOMMENDATION]` delivery mechanisms, not brand rules.
5. **Implement All 10 Mandatory UI States:** Every interactive view and container must handle: (1) Default, (2) Hover, (3) Active/Pressed, (4) Focus, (5) Disabled, (6) Loading, (7) Success, (8) Error, (9) Empty, and (10) Unauthorized (401/403). See [`ux/states.md`](ux/states.md).
6. **Mask Sensitive Credentials:** Always mask API keys and secrets (`sen_live_••••••••3f8a`) by default with reveal/copy actions.
7. **Examples are Non-Mandatory:** Files in `examples/` are reference demonstrations, not rigid constraints.
8. **Product UI Standards Separation:** The 4px grid, component heights, radius, and elevation are proposed `[PRODUCT UI STANDARD]` rules for engineering consistency, never to be confused with official Brand Guidelines.

---

## 6. Pre-Completion Quality Checklist

Before considering any UI task complete, verify:

- [ ] Correct official Sennovate logo used (light or dark depending on background)
- [ ] Exact official brand colors applied (`#006FE3`, `#001B41`, `#FFFFFF`, supporting colors)
- [ ] Typography follows Satoshi (headings) and Inter (body)
- [ ] No emojis used as UI icons (official icons or Lucide line icons used)
- [ ] Spacing strictly adheres to the 4px base grid (`8px`, `16px`, `24px`, `32px`)
- [ ] Responsive behavior verified across mobile, tablet, and desktop
- [ ] Loading, empty, and error states implemented
- [ ] Sensitive security credentials masked by default
- [ ] Undefined requirements marked as `TO BE DEFINED` rather than invented as brand rules
- [ ] UI looks consistent with the Sennovate product ecosystem

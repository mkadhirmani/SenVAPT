# Changelog

All notable changes to the **Sennovate Product Development Skill** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-09-19

### Added
* **Exact Brand Colors Restored & Fully Propagated:** 
  * Extracted exact brand colors directly from Slide 12:
    * Sennovate Blue: `#006FE3` (Pantone 285 C, RGB: 0, 111, 227, CMYK: 100%, 51%, 0%, 11%)
    * Sennovate Dark Blue: `#001B41` (Pantone 295 C, RGB: 0, 27, 65, CMYK: 100%, 58%, 0%, 75%)
    * Sennovate White: `#FFFFFF`
  * Extracted supporting colors from Slide 14:
    * Green: `#299346`
    * Purple / Indigo: `#3C2C86`
    * Terra Cotta / Rust: `#B9623C`
    * Official 100%, 70%, 50%, 30%, 10% tint variations from Slides 13 & 15.
  * **Completed 100% Propagation:** Eliminated all old color references (`#0066FF`, `#0A192F`, `#0B1E3D`, `#00F0FF`, `#E6F0FA`, `#0052CC`) across all component specs (`buttons.md`, `cards.md`, `forms.md`, `tables.md`, `navigation.md`, `feedback.md`), UX files (`accessibility.md`, `states.md`), brand docs (`logo.md`, `imagery.md`), and HTML examples (`dashboard.html`, `login.html`).
* **Enforced Token Usage:** Added a mandatory rule in `SKILL.md` requiring agents to use CSS variables (`var(--sennovate-blue)`, `var(--sennovate-dark-blue)`, `var(--color-bg-canvas)`) rather than hard-coding raw hex codes.
* **Deleted Competing Token Source:** Removed `tokens/colors.json` so that `tokens/brand-tokens.json` is the sole authoritative source for official brand colors and `tokens/product-tokens.json` is the sole source for product UI tokens.
* **Official Icon Assets & Priority:**
  * Extracted custom Filled Iconography (Slide 19) and Outline Iconography (Slide 20) into `assets/icons/sennovate-filled-icons.png` and `assets/icons/sennovate-outline-icons.png`.
  * Clarified in `SKILL.md` and `brand/iconography.md` that official brand icons take priority, and Lucide is strictly an `[IMPLEMENTATION RECOMMENDATION]` for missing generic UI controls.
* **Typeface Requirement vs. Delivery Mechanism:**
  * Clarified that Satoshi and Inter are the `[OFFICIAL BRAND RULE]` typeface requirements.
  * Clarified that Fontshare CDN and Google Fonts CDN (detailed in `assets/fonts/FONTS.md`) are `[IMPLEMENTATION RECOMMENDATION]` delivery mechanisms, not brand rules.
* **The "TO BE DEFINED" Protocol:** Added explicit rule: If a requirement is missing from the Brand Guidelines, mark it as `TO BE DEFINED` rather than inventing an official standard.
* **Unified 10 Mandatory States:** Aligned `SKILL.md` and `ux/states.md` on the exact 10 mandatory UI states (Default, Hover, Active/Pressed, Focus, Disabled, Loading, Success, Error, Empty, Unauthorized).
* **Non-Mandatory Example Disclaimers:** Added explicit disclaimer banners to all HTML files in `examples/`.

### Changed
* **De-bloated `SKILL.md`:** Refactored `SKILL.md` into a lean master orchestration index that routes agents to modular topic files.
* **Reclassified 60-30-10 Rule:** Removed from `[OFFICIAL BRAND RULE]` classification (clarified that it is an optional design heuristic, not an official brand rule).

---

## [1.0.0] - 2026-09-19

### Added
* Initial draft of the Sennovate Product Development Skill.
* Basic component guidelines for buttons, forms, cards, tables, navigation, and feedback.
* Baseline HTML examples for login, dashboard, forms, tables, and AI chat.

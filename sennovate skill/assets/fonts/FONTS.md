# Sennovate Font Assets & Setup Guide

**Authority:** `[OFFICIAL BRAND RULE]` for Typefaces; `[IMPLEMENTATION RECOMMENDATION]` for Font Loading.  
**Source:** Sennovate Brand Guidelines (Slides 16–18)

---

## 1. Official Typefaces

1. **Primary Typeface: Satoshi**
   * **Role:** Display, Main Headings (Slide 18: `Satoshi 32PT Bold`).
   * **Weights:** Bold (700), Medium (500), Regular (400).
   * **Designer / Foundry:** Indian Type Foundry (ITF) / Fontshare.
   * **License:** Free for commercial and personal use under the Fontshare license.
   * **CDN Import:**
     ```html
     <link href="https://api.fontshare.com/v2/css?f[]=satoshi@700,500,400&display=swap" rel="stylesheet">
     ```
   * **Direct Download:** [https://www.fontshare.com/fonts/satoshi](https://www.fontshare.com/fonts/satoshi)

2. **Secondary Typeface: Inter**
   * **Role:** Sub Headings (Inter 24PT Regular), Body (Inter 18PT Regular), Sub Text (Inter 14PT Regular).
   * **Weights:** Light (300), Regular (400), Medium (500).
   * **Designer / Foundry:** Rasmus Andersson.
   * **License:** SIL Open Font License (OFL).
   * **Google Fonts CDN Import:**
     ```html
     <link rel="preconnect" href="https://fonts.googleapis.com">
     <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
     <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
     ```

---

## 2. CSS Font Stack Declaration

```css
:root {
  --font-family-display: 'Satoshi', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-family-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-family-mono: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
}
```

# Sennovate Iconography System

**Authority:** `[OFFICIAL BRAND RULE]` for Brand Shield & Official Icon Sets; `[IMPLEMENTATION RECOMMENDATION]` for General Application Icons.  
**Source:** Sennovate Brand Guidelines (Slides 12, 19, 20)

---

## 1. Official Brand Iconography `[OFFICIAL BRAND RULE]`

The Sennovate Brand Guidelines define two official icon styles:

### 1.1 Filled Iconography (Slide 19)
* **Design Philosophy:** Light and versatile icons offering a detailed, solid alternative to flat icons for diagrams, infographics, and key interface highlights.
* **Defined Symbols:** Cloud, Shield with Alert, Shield with Check, User with Badge, Database, Server nodes, Rocket, Globe with Shield, Metric charts, Clocks, Briefcases.
* **Asset Location:** [`assets/icons/sennovate-filled-icons.png`](../assets/icons/sennovate-filled-icons.png)

### 1.2 Outline Iconography (Slide 20)
* **Design Philosophy:** Modern, monoline, geometric icons for web interfaces, data visualizations, and system diagrams.
* **Defined Symbols:** Cloud storage, User profile, Security shield with avatar, Cube/Asset, Calendar, Lightning/Compute, Refresh/Sync, Sliders/Settings, Search, Network graph.
* **Asset Location:** [`assets/icons/sennovate-outline-icons.png`](../assets/icons/sennovate-outline-icons.png)

### 1.3 Brand Shield Emblem (Slides 12 & Favicon)
* The primary brand emblem: A geometric shield with diagonal security bars.
* Assets: [`assets/logos/sennovate-icon-dark.svg`](../assets/logos/sennovate-icon-dark.svg) and [`assets/logos/sennovate-icon-white.svg`](../assets/logos/sennovate-icon-white.svg).

---

## 2. General Product UI Icons `[IMPLEMENTATION RECOMMENDATION]`

The Brand Guidelines define custom icons for core concepts, but do not provide an exhaustive 500-icon library for every edge-case UI requirement (e.g. pagination arrows, sorting chevrons, close buttons).

When a required UI icon is not covered by the official Sennovate iconography:
* **Recommended Library:** **Lucide Icons** or **Tabler Icons**.
* **Style:** Outline style with `1.5px` stroke width to match the official Outline Iconography aesthetic.
* **Color:** Use `--sennovate-dark-blue` (`#001B41`) or `--color-text-secondary` (`#4A5568`).

---

## 3. Strict Prohibitions (Agent Rules)

* ❌ **NEVER use Emojis as UI icons.** Emojis (e.g. ⚙️, 🗑️, 🔍, 🔔) are strictly forbidden in production UI.
* ❌ **DO NOT invent an icon and claim it is an official brand standard.** If an icon is needed and neither the brand set nor Lucide covers it, mark it as `TO BE DEFINED`.

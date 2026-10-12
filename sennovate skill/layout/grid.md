# Sennovate Layout: Grid & Container System

**Authority:** `[PRODUCT UI STANDARD]`  
**Purpose:** Structure multi-column dashboards, KPI metric rows, and card grids.

---

## 1. Containers

* **Max Page Width:** `1400px` (centered with `margin: 0 auto;`).
* **Page Padding:**
  * Mobile (`< 640px`): `16px` (`--space-4`)
  * Tablet (`640px – 1023px`): `24px` (`--space-6`)
  * Desktop (`≥ 1024px`): `32px` (`--space-8`)

---

## 2. Standard Dashboard Grid

Use CSS Grid with 12 columns or auto-fit responsive columns:

```css
/* Metric KPI Cards (4 cards on desktop, 2 on tablet, 1 on mobile) */
.grid-kpi {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4);
}

@media (max-width: 1023px) {
  .grid-kpi {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 639px) {
  .grid-kpi {
    grid-template-columns: 1fr;
  }
}

/* 2-Column Split (e.g. Main Chart 2/3, Live Alerts 1/3) */
.grid-dashboard-split {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--space-6);
}

@media (max-width: 1023px) {
  .grid-dashboard-split {
    grid-template-columns: 1fr;
  }
}
```

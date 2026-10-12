# Sennovate Component: Cards & Containers

**Authority:** `[PRODUCT UI STANDARD]`  
**Purpose:** Group related content, display metrics, render AI response containers, and structure dashboard widgets.

---

## 1. Card Variants

| Variant | Background | Border | Elevation | Typical Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Standard Card** | `#FFFFFF` | `1px solid #E2E8F0` | `--shadow-sm` | Dashboard widgets, configuration panels |
| **Interactive Card** | `#FFFFFF` | `1px solid #E2E8F0` | Hover: `--shadow-md` | Clickable resource items, integration selectors |
| **Metric / KPI Card** | `#FFFFFF` | `1px solid #E2E8F0` | `--shadow-sm` | Security score, active incidents, audited users |
| **Dark Container** | `var(--sennovate-dark-blue)` (`#001B41`) | `1px solid rgba(255,255,255,0.1)` | `--shadow-sm` | Terminal logs, AI chat container, code previews |

---

## 2. Card Anatomy

```
+--------------------------------------------------------+
| Card Header                                            |
| [Icon] Card Title (Satoshi 18px)       [Action/Badge]  |
| Subtitle or description (Inter 13px)                   |
+--------------------------------------------------------+
| Card Body                                              |
| Content, metrics, charts, form fields, or table        |
+--------------------------------------------------------+
| Card Footer (Optional)                                 |
| Secondary info / Link / Action Buttons                 |
+--------------------------------------------------------+
```

---

## 3. Code Example: Metric Card `[EXAMPLE]`

```html
<div class="card metric-card">
  <div class="card-header">
    <span class="metric-label">MFA Adoption Rate</span>
    <span class="badge badge-success">+4.2%</span>
  </div>
  <div class="metric-value">98.4%</div>
  <div class="card-footer">
    <span class="metric-subtext">2,410 of 2,450 enterprise users</span>
  </div>
</div>
```

```css
.card {
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
}

.metric-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.metric-value {
  font-family: var(--font-family-display);
  font-size: var(--font-size-3xl);
  font-weight: 700;
  color: var(--color-text-primary);
  margin: var(--space-2) 0;
}
```

# Sennovate Component: Buttons

**Authority:** `[PRODUCT UI STANDARD]`  
**Purpose:** Trigger actions, submit forms, open dialogs, and confirm operations.

---

## 1. Variants

| Variant | Role | Background | Text / Icon | Border | Hover State |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary** | Major action (Max 1 per section) | `var(--sennovate-blue)` (`#006FE3`) | `#FFFFFF` | None | `#005BC0` |
| **Secondary** | Supporting / default actions | `var(--color-bg-surface)` (`#FFFFFF`) | `var(--sennovate-dark-blue)` (`#001B41`) | `1px solid var(--color-border-subtle)` | `#F8FAFC`, border `var(--color-border-strong)` |
| **Ghost / Tertiary** | Low-emphasis, toolbars, icon actions | `transparent` | `var(--color-text-secondary)` | None | `rgba(0, 111, 227, 0.08)`, text `var(--sennovate-blue)` |
| **Destructive** | Irreversible actions (Delete, Revoke) | `var(--color-status-danger)` (`#DC2626`) | `#FFFFFF` | None | `#B91C1C` |
| **Outline Destructive** | Subtle destructive trigger | `transparent` | `var(--color-status-danger)` | `1px solid #FECACA` | `#FEF2F2`, border `var(--color-status-danger)` |

---

## 2. Sizes

| Size | Height | Padding | Font Size | Icon Size | Border Radius |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Small (`sm`)** | 28px | `0 10px` | 12px | 14px | `4px` (`--radius-sm`) |
| **Medium (`md` - Default)** | 36px | `0 14px` | 14px | 16px | `8px` (`--radius-md`) |
| **Large (`lg`)** | 44px | `0 20px` | 15px | 18px | `8px` (`--radius-md`) |

---

## 3. Interactive States

Every button must implement all 6 states:
1. **Default:** Baseline styling.
2. **Hover:** Smooth background change (`transition: all 0.15s ease`).
3. **Active / Pressed:** `transform: scale(0.98)` or deeper background shade.
4. **Focus-Visible:** `outline: 2px solid var(--sennovate-blue); outline-offset: 2px;`.
5. **Disabled:** `opacity: 0.5; cursor: not-allowed; pointer-events: none;`.
6. **Loading:** Replaces icon/text with a small spinner; retains button width.

---

## 4. Code Snippet `[EXAMPLE]`

```html
<!-- Primary Button -->
<button class="btn btn-primary">
  <svg class="icon" ...><!-- Lucide or Sennovate icon --></svg>
  <span>Deploy Policy</span>
</button>

<!-- Secondary Button -->
<button class="btn btn-secondary">Cancel</button>

<!-- Destructive Button -->
<button class="btn btn-danger">Revoke API Key</button>
```

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  height: 36px;
  padding: 0 var(--space-4);
  font-family: var(--font-family-body);
  font-size: var(--font-size-base);
  font-weight: 500;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition-fast);
  border: 1px solid transparent;
  text-decoration: none;
}
.btn-primary {
  background-color: var(--sennovate-blue);
  color: var(--sennovate-white);
}
.btn-primary:hover {
  background-color: #005BC0;
}
.btn:focus-visible {
  outline: 2px solid var(--sennovate-blue);
  outline-offset: 2px;
}
```

---

## 5. Do's & Don'ts

* ✔️ Limit **one primary button** per screen/dialog to preserve clear visual hierarchy.
* ✔️ Always pair Destructive buttons with a secondary "Cancel" button.
* ❌ DO NOT use emojis inside buttons.
* ❌ DO NOT use full-width buttons on desktop screens (reserve full-width for mobile).

# Sennovate Component: Feedback & Dialogs

**Authority:** `[PRODUCT UI STANDARD]`  
**Purpose:** Communicate system status, confirm destructive operations, display alerts, and provide inline feedback.

---

## 1. Modals & Dialogs

* **Backdrop:** `rgba(0, 27, 65, 0.65)` with subtle `backdrop-filter: blur(4px)`.
* **Container:** `var(--color-bg-surface)` (`#FFFFFF`) on light mode; `var(--sennovate-dark-blue)` (`#001B41`) on dark mode, `border-radius: 12px`, box-shadow `--shadow-lg`.
* **Widths:**
  * Confirmation / Small: `400px`
  * Standard: `560px`
  * Large / Detailed: `720px`
* **Confirmation Dialog (Destructive Operations):**
  * Red danger badge or icon.
  * Explicit headline explaining the permanent consequence.
  * For critical security operations (e.g. deleting an identity pool), require typing the resource name to unlock the submit button.

---

## 2. Toasts & Banners

* **Position:** Fixed top-right or bottom-right, `16px` offset.
* **Duration:** Auto-dismiss after 4–5 seconds (except for errors, which persist until dismissed).
* **Variants:**
  * **Success:** Green icon, `var(--color-status-success-bg)` (`#ECFDF5`) background, `var(--color-status-success)` (`#299346`) text.
  * **Error:** Red icon, `var(--color-status-danger-bg)` (`#FEF2F2`) background, `var(--color-status-danger)` (`#DC2626`) text, includes "View Log" or "Retry" link.
  * **Warning:** Amber icon, `var(--color-status-warning-bg)` (`#FFFBEB`) background, `var(--color-status-warning)` (`#B9623C`) text.
  * **Info:** Blue icon, `var(--color-status-info-bg)` (`#EFF6FF`) background, `var(--sennovate-blue)` (`#006FE3`) text.

---

## 3. Inline Alerts

```html
<div class="alert alert-warning">
  <svg class="alert-icon" ...></svg>
  <div class="alert-content">
    <h4 class="alert-title">Security Key Expiring Soon</h4>
    <p class="alert-desc">The SAML signing certificate for Tenant A will expire in 3 days.</p>
  </div>
  <button class="btn btn-sm btn-secondary">Renew Now</button>
</div>
```

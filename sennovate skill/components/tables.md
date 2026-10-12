# Sennovate Component: Data Tables

**Authority:** `[PRODUCT UI STANDARD]`  
**Purpose:** Display structured data, audit logs, user permissions, security incidents, and API keys.

---

## 1. Table Architecture

* **Container:** Wrapped in a card container (`border-radius: 12px; overflow: hidden; border: 1px solid #E2E8F0`).
* **Header (`<thead>`):**
  * Background: `var(--color-bg-canvas)` (`#F8FAFC`) on light mode; `var(--sennovate-dark-blue)` (`#001B41`) on dark mode.
  * Typography: `12px` Inter SemiBold, uppercase, letter-spacing `0.05em`.
  * Height: `40px`.
* **Rows (`<tbody> tr`):**
  * Height: `48px` (Standard) or `40px` (Dense mode).
  * Border-bottom: `1px solid var(--color-border-subtle)` (`#E2E8F0`).
  * Hover state: Background `#F8FAFC` (or `rgba(0, 111, 227, 0.04)`).
* **Alignment Rules:**
  * Text columns: Left-aligned.
  * Numerical columns & metrics: Right-aligned.
  * Status badges & actions: Center-aligned or right-aligned.
  * Monospace columns (IPs, hashes, tokens): Left-aligned with monospace font.

---

## 2. Mandatory Table Features

Every production table in a Sennovate application **MUST** support:
1. **Empty State:** Clean centered icon, message (e.g. *"No security events recorded in the last 24 hours"*), and a primary CTA if applicable.
2. **Loading State:** Skeleton shimmer rows matching column structure.
3. **Pagination / Infinite Scroll:** Displaying `Showing 1–25 of 142 results` with Previous/Next buttons.

---

## 3. Code Example: Audit Log Table `[EXAMPLE]`

```html
<div class="table-container">
  <table class="data-table">
    <thead>
      <tr>
        <th>Timestamp (UTC)</th>
        <th>Actor</th>
        <th>Event</th>
        <th>Target</th>
        <th>IP Address</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="font-mono text-muted">2026-09-19 20:30:14</td>
        <td class="font-medium">admin@sennovate.com</td>
        <td>Revoked API Key</td>
        <td class="font-mono">sen_live_...4a2b</td>
        <td class="font-mono">198.51.100.42</td>
        <td><span class="badge badge-danger">Revoked</span></td>
      </tr>
      <tr>
        <td class="font-mono text-muted">2026-09-19 20:15:02</td>
        <td class="font-medium">system_agent</td>
        <td>Auto-Quarantine Incident</td>
        <td class="font-mono">node-eu-west-01</td>
        <td class="font-mono">203.0.113.19</td>
        <td><span class="badge badge-success">Success</span></td>
      </tr>
    </tbody>
  </table>
</div>
```

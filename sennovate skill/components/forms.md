# Sennovate Component: Forms & Inputs

**Authority:** `[PRODUCT UI STANDARD]`  
**Purpose:** Collect user input, configure security policies, search logs, and manage accounts.

---

## 1. Input Fields

* **Height:** Standard `36px` (`md`), Compact `30px` (`sm`), Large `44px` (`lg`).
* **Background:** `var(--color-bg-surface)` on light canvas; `var(--sennovate-dark-blue)` on dark canvas.
* **Border:** `1px solid var(--color-border-subtle)` (`#E2E8F0`).
* **Border Radius:** `8px` (`--radius-md`).
* **Typography:** `14px` Inter Regular, text color `var(--color-text-primary)` (`var(--sennovate-dark-blue)`).
* **Placeholder:** `var(--color-text-muted)` (`#94A3B8`). (Never use placeholder as the label).

---

## 2. Form States

1. **Default:** Subtle gray border `var(--color-border-subtle)`.
2. **Hover:** Border `var(--color-border-strong)`.
3. **Focus:** `border-color: var(--sennovate-blue); outline: 2px solid rgba(0, 111, 227, 0.2); outline-offset: 1px;`.
4. **Error:** `border-color: var(--color-status-danger); outline: 2px solid rgba(220, 38, 38, 0.2);`.
   * Display red alert icon and clear error text directly below the input.
5. **Disabled:** `background-color: #F8FAFC; color: var(--color-text-muted); cursor: not-allowed;`.

---

## 3. Checkboxes, Radios & Toggles

* **Checkbox:**
  * Dimensions: `16px × 16px`, `border-radius: 4px`.
  * Checked: Background `var(--sennovate-blue)`, white checkmark icon.
* **Radio:**
  * Dimensions: `16px × 16px`, `border-radius: 9999px`.
  * Checked: Background `var(--sennovate-blue)` with white inner dot.
* **Toggle / Switch:**
  * Track: `36px × 20px`, `border-radius: 9999px`.
  * Inactive track: `#CBD5E1`.
  * Active track: `var(--sennovate-blue)` (or `var(--color-status-success)` for active system state).
  * Thumb: `16px × 16px` white circle with smooth slide transition.

---

## 4. Code Example `[EXAMPLE]`

```html
<div class="form-group">
  <label for="tenant-id" class="form-label">
    Tenant Identifier
    <span class="required">*</span>
  </label>
  <div class="input-wrapper">
    <input 
      id="tenant-id" 
      type="text" 
      class="form-input" 
      placeholder="e.g. sennovate-corp-prod"
      required 
    />
  </div>
  <p class="form-helper">Unique domain identifier for zero-trust routing.</p>
</div>

<!-- Error State Example -->
<div class="form-group has-error">
  <label for="api-key" class="form-label">API Key</label>
  <input id="api-key" type="password" class="form-input" value="invalid_key" />
  <p class="form-error">
    <svg class="icon-error" ...></svg>
    <span>API key must start with 'sen_live_' or 'sen_test_'</span>
  </p>
</div>
```

---

## 5. Do's & Don'ts

* ✔️ Always place `<label>` tags above inputs for accessibility and clear scanning.
* ✔️ Use sensitive field masking (with an explicit show/hide eye toggle) for API keys and secrets.
* ❌ NEVER use floating labels that shrink or disappear.
* ❌ NEVER disable submit buttons without explaining why the form is invalid.

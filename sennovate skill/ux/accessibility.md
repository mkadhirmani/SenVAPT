# Sennovate UX: Accessibility Standards (WCAG 2.1 AA)

**Authority:** `[PRODUCT UI STANDARD]`  
**Purpose:** Ensure all Sennovate products are usable by people with disabilities and fully accessible via keyboard.

---

## 1. Contrast Ratios

* **Body Text (Normal):** Minimum contrast ratio of **`4.5:1`** against background.
* **Large Text / Headings:** Minimum contrast ratio of **`3.0:1`**.
* **UI Components & Graphical Objects:** Minimum **`3.0:1`** against adjacent colors.
* *Note:* Ensure text on Sennovate Dark Blue (`#001B41`) achieves at least 4.5:1 contrast (Pure White `#FFFFFF` provides >14:1 contrast). Small body text in Sennovate Blue (`#006FE3`) on white must be avoided for long-form reading; use it for headings, buttons, or links with sufficient weight.

---

## 2. Keyboard Navigation

* All interactive elements (`<button>`, `<a>`, `<input>`, `<select>`, `<textarea>`) must be reachable via `Tab` key.
* Never remove outline without providing a high-contrast replacement:
  ```css
  *:focus-visible {
    outline: 2px solid var(--sennovate-blue);
    outline-offset: 2px;
  }
  ```

---

## 3. ARIA & Screen Readers

* Always provide `aria-label` for icon-only buttons (e.g. `<button aria-label="Copy API Key">`).
* Forms must associate inputs with labels using `id` and `for` attributes.
* Use `aria-live="polite"` for dynamic content updates (e.g. streaming AI responses, live audit logs).

# Sennovate Layout: Responsive Design

**Authority:** `[PRODUCT UI STANDARD]`  
**Purpose:** Ensure seamless, touch-friendly, and readable layouts across all device sizes.

---

## 1. Breakpoint Standards

| Breakpoint Name | Media Query | Target Devices | Shell Behavior |
| :--- | :--- | :--- | :--- |
| **Mobile (`sm`)** | `< 640px` | Phones | Sidebar hidden in drawer; single column; full-width buttons |
| **Tablet (`md`)** | `640px – 1023px` | Tablets, foldables | Collapsed icon sidebar (64px); 2-column cards; condensed tables |
| **Desktop (`lg`)** | `1024px – 1439px` | Laptops, monitors | Persistent 240px sidebar; standard multi-column layouts |
| **Large Desktop (`xl`)** | `≥ 1440px` | Wide monitors, 4K | Centered 1400px container; expanded multi-column data views |

---

## 2. Table & Form Responsive Strategies

* **Tables on Mobile:**
  * Wrap in an `overflow-x: auto` container with subtle visual scroll indicators.
  * Alternatively, transform each row into a compact card on screens `< 640px`.
* **Modals on Mobile:**
  * Convert centered modals into bottom-sheet drawers (`border-radius: 16px 16px 0 0`) for natural thumb reachability.
* **Touch Targets:**
  * Interactive elements on mobile/tablet must have a minimum touch area of **`44px × 44px`**.

# Sennovate Layout: Spacing System

**Authority:** `[PRODUCT UI STANDARD]`  
**Purpose:** Establish predictable rhythm, consistent padding, and visual hierarchy across all interfaces.

---

## 1. The 4px Base Grid

All spacing in Sennovate applications derives from a base unit of **4px**:

| Token | Value | rem | Common Use Case |
| :--- | :--- | :--- | :--- |
| `--space-1` | 4px | 0.25rem | Badge padding, micro gap between icon and counter |
| `--space-2` | 8px | 0.5rem | Button internal padding, input vertical padding, icon-text gap |
| `--space-3` | 12px | 0.75rem | Compact card padding, dense table cell padding |
| `--space-4` | 16px | 1.0rem | Standard card padding, form group vertical gap |
| `--space-5` | 20px | 1.25rem | Medium widget padding, header element separation |
| `--space-6` | 24px | 1.5rem | Section padding, modal header gap |
| `--space-8` | 32px | 2.0rem | Dashboard grid gap, page content top margin |
| `--space-10` | 40px | 2.5rem | Major view divider gap |
| `--space-12` | 48px | 3.0rem | Landing hero section padding |
| `--space-16` | 64px | 4.0rem | Large marketing section spacer |

---

## 2. Invariable Rules for Agents

* ❌ **NEVER use arbitrary pixel values** like `margin: 13px;` or `padding: 7px;`. Always snap to the 4px scale.
* ✔️ Use CSS flexbox `gap` or CSS grid `gap` instead of manual margin chaining between sibling elements.

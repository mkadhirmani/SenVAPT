# Sennovate Component: Navigation & Layout Shell

**Authority:** `[PRODUCT UI STANDARD]`  
**Purpose:** Provide consistent product navigation, app shell, header bars, breadcrumbs, and tabs.

---

## 1. Application Shell Structure

A standard Sennovate enterprise dashboard consists of:
1. **Left Sidebar:**
    * Width: `240px` (Expanded) or `64px` (Collapsed).
    * Background: Sennovate Dark Blue (`var(--sennovate-dark-blue)`, `#001B41`) or White (`#FFFFFF`) with subtle border.
    * Top: Sennovate Logo (`sennovate-logo-white.svg` or `sennovate-icon-white.svg`).
    * Middle: Navigation items with icons and labels.
    * Bottom: Tenant/Organization switcher and User Profile.
2. **Top Header:**
    * Height: `56px` or `64px`.
    * Left: Breadcrumbs or View Title.
    * Right: Search input (`Cmd+K`), Environment Badge (`Production` / `Staging`), Notifications icon, and Help.
3. **Main Content Canvas:**
    * Background: `var(--color-bg-canvas)` (`#F8FAFC`) on light mode; `var(--sennovate-dark-blue)` (`#001B41`) on dark mode.
    * Max width: `1400px` centered with responsive padding.

---

## 2. Navigation Items

* **Height:** `36px` to `40px`.
* **Border Radius:** `8px` (`--radius-md`).
* **Active State:**
  * Dark Sidebar: Background `rgba(0, 111, 227, 0.15)`, text `#FFFFFF`, left accent bar `var(--sennovate-blue)` (`#006FE3`).
  * Light Sidebar: Background `var(--color-status-info-bg)` (`#EFF6FF`), text `var(--sennovate-blue)` (`#006FE3`), icon `var(--sennovate-blue)`.
* **Hover State:** Background `rgba(255, 255, 255, 0.06)` (dark) or `#F1F5F9` (light).

---

## 3. Breadcrumbs & Tabs

* **Breadcrumbs:**
  * Separator: `ChevronRight` (`14px`) or `/`.
  * Inactive items: `var(--color-text-secondary)` (`#4A5568`) with link hover.
  * Active (current) item: `var(--sennovate-dark-blue)` (`#001B41`), font-weight 500, no link.
* **Tabs:**
  * Underline Style: Clean 2px border on active tab (`var(--sennovate-blue)`, `#006FE3`).
  * Pill Style: Background `var(--color-border-subtle)` (`#E2E8F0`), active pill `#FFFFFF` with `--shadow-sm`.

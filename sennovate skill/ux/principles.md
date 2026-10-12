# Sennovate UX Principles

**Authority:** `[PRODUCT UI STANDARD]`  
**Purpose:** Guide product decisions so Sennovate applications feel cohesive, efficient, and enterprise-grade.

---

## 1. Core UX Principles

1. **Clarity Over Cleverness:**
   * Make actions and security implications immediately obvious.
   * Avoid cryptic icons without tooltips, ambiguous toggle labels, or hidden menus.
2. **Security Without Friction:**
   * Guide users through secure defaults (MFA, least privilege, session limits) with clear explanations rather than opaque errors.
3. **One Primary Action Per View:**
   * Every page, modal, or section must have a single dominant visual focal point (Primary CTA).
4. **Predictable & Reversible Interactions:**
   * For non-destructive actions, provide instant execution with "Undo" toasts.
   * For destructive actions, demand deliberate confirmation.
5. **Progressive Disclosure:**
   * Show critical information first; keep advanced configurations, raw JSON payloads, and deep metadata behind collapsible panels or tabs.
6. **No Silent Failures:**
   * If an API call or background job fails, explain **why** it failed and **what the user can do** to fix it.

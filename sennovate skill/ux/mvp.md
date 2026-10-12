# Sennovate MVP & Fast-Paced Prototyping

**Authority:** `[PRODUCT UI STANDARD]`  
**Purpose:** Guide developers and AI agents to move fast without sacrificing Sennovate's identity.

---

## 1. How to Build an MVP Without Visual Debt

When building rapid prototypes, internal tools, or hackathon MVPs:

1. **Start with the Tokens:**
   * Import `brand-tokens.css` immediately. By sticking to `--sennovate-blue`, `--sennovate-deep-navy`, and the 4px spacing scale, even a bare-bones HTML page will look like a Sennovate product.
2. **Use Pre-styled Core Components:**
   * Standard buttons (`.btn-primary`, `.btn-secondary`).
   * Standard cards (`.card`).
   * Standard tables (`.data-table`).
3. **Cut Complexity, Not Quality:**
   * **Do NOT build:** Custom drag-and-drop builders, complex nested modal trees, or unnecessary micro-animations.
   * **Do build:** Complete happy-path flows with realistic loading, empty, and error feedback.
4. **Mock Data Quality:**
   * Use realistic cybersecurity/enterprise mock data (e.g. `audit-log-2026`, `sen_live_9a...`, realistic user emails, ISO timestamps) rather than `foo`, `bar`, `test1`.

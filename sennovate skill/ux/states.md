# Sennovate UX: The Mandatory UI States

**Authority:** `[PRODUCT UI STANDARD]`  
**Purpose:** Prevent "happy-path only" development and ensure complete UX coverage.

---

## The 10 Mandatory States

Every interactive view or data container in a Sennovate application **MUST** address these 10 states:

| State | Visual Treatment | Example Scenario |
| :--- | :--- | :--- |
| **1. Default** | Standard baseline styles | Initial screen load with active items |
| **2. Hover** | Subtle background shift, cursor pointer | Hovering over table row or secondary button |
| **3. Active** | Visual depression (`scale(0.98)` or darker fill) | Clicking a button or selecting a tab |
| **4. Focus** | `2px solid var(--sennovate-blue)`, `outline-offset: 2px` | Tabbing through form fields with keyboard |
| **5. Disabled** | 50% opacity, `cursor: not-allowed` | Save button when no changes were made |
| **6. Loading** | Skeleton shimmer or spinner | Fetching identity audit logs from server |
| **7. Success** | Green badge/toast, checkmark icon | "API key generated successfully" |
| **8. Error** | Red border/banner, clear recovery action | "Invalid certificate format. Upload .pem or .crt" |
| **9. Empty** | Centered icon, helpful explanation, primary CTA | "No security tools configured yet. [Add Tool]" |
| **10. Unauthorized** | Padlock icon, 403 status, "Request Access" button | Non-admin user visiting billing or IAM settings |

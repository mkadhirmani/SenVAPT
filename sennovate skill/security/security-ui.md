# Sennovate Security Product UI Standards

**Authority:** `[PRODUCT UI STANDARD]`  
**Purpose:** Guide UI patterns for cybersecurity, identity governance, access management, secret handling, and audit trails.

---

## 1. Secret & Sensitive Data Handling

* **Default State:** All API keys, client secrets, access tokens, and passwords must be masked:
  ```html
  <div class="secret-field">
    <span class="font-mono">sen_live_••••••••••••••••3f8a</span>
    <button class="btn-icon" aria-label="Reveal secret">👁️</button>
    <button class="btn-icon" aria-label="Copy secret">📋</button>
  </div>
  ```
* **Copy Feedback:** When a secret is copied, display a brief inline tooltip or toast: `"Copied to clipboard!"`.
* **Expiry Warnings:** Highlight credentials nearing expiration:
  * `< 30 days`: Warning badge (Amber `#F59E0B`).
  * `< 7 days`: Urgent alert banner (Red `#EF4444`).

---

## 2. Role-Based Access Control (RBAC) Badges

Standardize role visual indicators across all identity tables:

| Role Name | Badge Color | Class | Permissions Level |
| :--- | :--- | :--- | :--- |
| **Global Admin** | Deep Navy / Purple | `badge-admin` | Full control across all tenants |
| **Security Officer** | Sennovate Blue | `badge-secops` | Manage policies, revoke tokens, view logs |
| **Auditor** | Amber | `badge-auditor` | Read-only access to audit logs and compliance data |
| **Developer / User** | Gray / Slate | `badge-user` | Standard API usage and personal credentials |

---

## 3. Destructive Action Confirmation

For high-impact security operations (e.g. revoking master keys, deleting identity pools, terminating sessions):
1. **Trigger:** Red Destructive Button (`.btn-danger`).
2. **Dialog:** Explicit confirmation modal detailing:
   * Affected users or services.
   * Irreversibility of the action.
   * An input requiring the user to type the resource name or `REVOKE` to enable the confirmation button.

---

## 4. Audit Log Integrity

* Display all timestamps in UTC with ISO 8601 formatting (`YYYY-MM-DD HH:mm:ss UTC`) and relative time on hover.
* Include Actor (who triggered), Action (what happened), Target (which resource), IP Address, and Status.

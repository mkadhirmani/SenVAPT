# Sennovate AI Product UI Standards

**Authority:** `[PRODUCT UI STANDARD]`  
**Purpose:** Standardize AI chat interfaces, LLM streaming, agentic workflows, tool executions, and human-in-the-loop approvals across Sennovate AI solutions (Senoptic, AI Internal Audit, etc.).

---

## 1. Visual Hierarchy in AI Interfaces

In any Sennovate AI application, users must immediately distinguish between:
1. **User Prompt:** Clean, right-aligned or neutral container with user avatar.
2. **AI Response:** Left-aligned card with Sennovate shield avatar, Satoshi headings, and Inter body.
3. **Agent Thought / Reasoning:** Collapsible "Thinking" accordion with pulsing status badge.
4. **Tool Execution:** Monospace structured card showing tool name, input arguments, and result.
5. **Retrieved Knowledge / Sources:** Numbered citation pills with confidence ratings.
6. **Human Approval:** High-visibility banner requiring explicit confirmation before dangerous actions.

---

## 2. Core AI Component Patterns

### 2.1 Thinking & Streaming State
* Display a subtle pulsing pill badge:
  ```html
  <div class="ai-status-pill">
    <span class="pulse-dot"></span>
    <span>Analyzing security posture...</span>
  </div>
  ```
* Text streaming should appear smoothly without layout jump.

### 2.2 Tool Execution Card
```html
<div class="tool-card tool-success">
  <div class="tool-header">
    <svg class="tool-icon" ...></svg>
    <span class="tool-name">vanta_audit_check</span>
    <span class="badge badge-success">Completed</span>
  </div>
  <div class="tool-body">
    <div class="tool-args font-mono">{ "framework": "SOC2", "control": "CC6.1" }</div>
    <div class="tool-result font-mono">14 controls verified, 0 critical findings</div>
  </div>
</div>
```

### 2.3 Citations & Confidence
* Render citations as clickable pills: `[1: SOC2 Policy Doc]` or `[2: IAM Guide]`.
* Show confidence bar when assessing threat levels or compliance scores (e.g. `98% Confidence`).

### 2.4 Human-in-the-Loop Approval Banner
```html
<div class="approval-banner">
  <div class="approval-info">
    <h4 class="approval-title">Permission Required</h4>
    <p>The agent is requesting to revoke inactive session tokens for 18 users.</p>
  </div>
  <div class="approval-actions">
    <button class="btn btn-secondary">Reject</button>
    <button class="btn btn-primary">Approve & Execute</button>
  </div>
</div>
```

### 2.5 Feedback & Retry
* Provide thumbs up / thumbs down buttons on every AI response for continuous model alignment.
* Provide a "Retry" or "Regenerate" button if an error occurs.

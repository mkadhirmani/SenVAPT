# Sennovate Product Development Skill (v1.1.0)

> A practical, authoritative AI coding agent skill and developer system for building Sennovate MVPs, internal tools, dashboards, AI applications, and enterprise products.

---

## 🌟 Overview

This skill establishes an authoritative, actionable bridge between the **Sennovate Brand Guidelines** and **practical application development**. It equips developers, interns, and AI coding agents (Antigravity, Claude Code, Cursor, Copilot) with:

1. **Official Brand Rules (Directly from Brand Guidelines):** Exact logo usage, clear space (`1X`), exact brand colors (Sennovate Blue `#006FE3`, Dark Blue `#001B41`, White `#FFFFFF`, supporting colors), official typography, and custom filled/outline iconography.
2. **Product UI Standards:** Spacing scales (4px grid), border radius, elevation, layout containers, and responsive breakpoints.
3. **Strictly Separated Design Tokens:** Machine-readable `tokens/brand-tokens.json` (official) and `tokens/product-tokens.json` (application UI).
4. **Interactive Component Specs:** Standard patterns for buttons, forms, cards, tables, navigation, and dialogs.
5. **AI & Security UI Standards:** Patterns for AI chat, thinking states, tool execution cards, secret masking, RBAC badges, and audit trails.
6. **The "TO BE DEFINED" Protocol:** When a specification is missing from the Brand Guidelines, agents must never invent an official standard—they must mark it as `TO BE DEFINED`.
7. **Live Working Examples:** Non-mandatory reference implementations for Login, Dashboard, Forms, Tables, and AI Chat.

---

## 🏛️ Rule Authority Classification

Every rule in this skill is classified under one of four explicit levels:

* `[OFFICIAL BRAND RULE]` — Mandated by the official Sennovate Brand Guidelines (Slides 1–50). Never alter or invent alternatives.
* `[PRODUCT UI STANDARD]` — Application design system standard established for software consistency.
* `[IMPLEMENTATION RECOMMENDATION]` — Recommended technical approach (e.g. Lucide line icons for general UI, Fontshare CDN).
* `[EXAMPLE]` — Illustrative demonstration patterns (non-mandatory).

---

## 📂 Directory Layout

```
sennovate-product-skill/
├── SKILL.md                  <-- Master orchestration file for AI coding agents
├── README.md                 <-- Developer documentation & getting started guide
├── CHANGELOG.md              <-- Semantic versioning and change history
├── FORWARDING.md             <-- Guide for sharing and installing across IDEs
│
├── brand/                    <-- Core Brand Guidelines extraction
│   ├── logo.md               <-- Logo variants, clear space (1X), sizes, misuse
│   ├── colors.md             <-- Exact brand colors, supporting colors, variations
│   ├── typography.md         <-- Satoshi (Display) & Inter (Body) hierarchy
│   ├── iconography.md        <-- Shield emblem, custom filled/outline sets, Lucide rule
│   └── imagery.md            <-- Professional aesthetic, avatars, visual rules
│
├── tokens/                   <-- Strictly separated design tokens
│   ├── brand-tokens.json     <-- Strictly official brand colors and typography
│   ├── product-tokens.json   <-- Proposed application UI tokens (canvas, borders, status)
│   ├── typography.json       <-- Typeface, weight, and size scales
│   ├── spacing.json          <-- 4px base grid spacing tokens
│   ├── radius.json           <-- Border radius tokens
│   ├── shadows.json          <-- Elevation & shadow tokens
│   └── tokens.css            <-- Master CSS Custom Properties
│
├── assets/                   <-- Reusable brand media
│   ├── logos/                <-- SVGs, PNGs, and PDFs of official wordmarks & shields
│   ├── icons/                <-- Official Sennovate filled & outline icon sheets
│   ├── fonts/                <-- FONTS.md with Fontshare & Google Fonts setup
│   └── backgrounds/          <-- High-res office meeting backgrounds
│
├── components/               <-- UI Component specifications
│   ├── buttons.md            <-- Primary, secondary, ghost, destructive buttons
│   ├── forms.md              <-- Inputs, secret boxes, toggles, validation
│   ├── cards.md              <-- Metric cards, containers, interactive widgets
│   ├── tables.md             <-- Data tables, audit streams, pagination
│   ├── navigation.md         <-- Sidebar, app header, breadcrumbs, tabs
│   └── feedback.md           <-- Modals, toasts, inline alerts, confirmation
│
├── layout/                   <-- Layout & responsive design
│   ├── spacing.md            <-- 4px grid rules
│   ├── grid.md               <-- Dashboard grids & container widths
│   └── responsive.md         <-- Mobile, tablet, desktop breakpoints
│
├── ux/                       <-- User experience guidelines
│   ├── principles.md         <-- Core UX tenets for enterprise software
│   ├── mvp.md                <-- Fast-paced prototyping without visual debt
│   ├── states.md             <-- The 10 mandatory UI states
│   └── accessibility.md      <-- WCAG 2.1 AA compliance & keyboard navigation
│
├── ai/                       <-- AI product UI patterns
│   └── ai-ui.md              <-- Thinking states, tool cards, citations, approvals
│
├── security/                 <-- Security product UI patterns
│   └── security-ui.md        <-- Secret masking, RBAC badges, audit logs
│
└── examples/                 <-- Non-mandatory reference implementations
    ├── login/login.html      <-- Enterprise login with SSO
    ├── dashboard/dashboard.html <-- Multi-metric security dashboard
    ├── forms/forms.html      <-- Credential & policy configuration form
    ├── tables/tables.html    <-- Identity governance audit log table
    └── ai-interface/ai-chat.html <-- Senoptic AI assistant interface
```

---

## 🔄 Continuous Testing & Improvement Protocol

To ensure the skill remains effective:
1. **Periodic Testing:** Test the skill against real MVP and internal tool development tasks.
2. **Identifying Failure Modes:** Observe where AI agents make inconsistent UI decisions (e.g. using unapproved colors, skipping loading states, inventing icons).
3. **Refining the Skill:** Convert recurring agent mistakes into explicit rules, tokens, or examples in the next version bump (`v1.2.0`).

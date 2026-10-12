# How to Forward & Install the Sennovate Product Development Skill

This package is **100% standalone, self-contained, and portable**. All paths, assets, tokens, and component guidelines use relative references, meaning it can be moved, zipped, or cloned to any computer, project, or repository without breaking.

---

## 📦 What's in the Forwardable Package?

The package includes:
* `SKILL.md` — Master instruction file for AI coding agents.
* `sennovate-product-skill.zip` — A single compressed archive of the entire skill (1.1 MB).
* `brand/` — Official Brand Guidelines (Logos, Colors, Typography, Iconography, Imagery).
* `tokens/` — JSON and CSS design tokens (colors, typography, 4px grid spacing, radius, shadows).
* `assets/` — Vector SVG logos, icons, and virtual meeting backgrounds.
* `components/` — Production UI patterns (Buttons, Forms, Cards, Tables, Navigation, Feedback).
* `layout/` & `ux/` — Grid, responsive breakpoints, UX principles, the 10 mandatory states, accessibility.
* `ai/` & `security/` — AI assistant patterns (Senoptic) and cybersecurity UI (secrets, audit logs, RBAC).
* `examples/` — Zero-dependency, runnable HTML/CSS templates.

---

## 🚀 How to Forward / Share with Others

### Option 1: Share the Pre-packaged Zip File
Forward the file **`sennovate-product-skill.zip`** via:
* Slack / Microsoft Teams
* Email attachment
* Google Drive / OneDrive
* GitHub Release / Repository

### Option 2: Copy the Folder Directly
Simply copy the entire `sennovate-product-skill/` folder to the target project or machine.

---

## 💻 How to Install in AI Development Environments

### 1. In Google Antigravity IDE
* **Workspace-level (Recommended for a specific project):**
  Unzip or copy into your repository's `.agents/skills/` folder:
  ```
  your-project/
  └── .agents/
      └── skills/
          └── sennovate-product-skill/
              ├── SKILL.md
              ├── brand/
              ├── tokens/
              └── ...
  ```
* **Global-level (Available in all workspaces on your machine):**
  Copy to:
  * Windows: `C:\Users\<YourUsername>\.gemini\config\skills\sennovate-product-skill\`
  * Mac/Linux: `~/.gemini/config/skills/sennovate-product-skill/`

---

### 2. In Anthropic Claude Code
Place the skill inside your project's `.claude/skills/` directory or reference `SKILL.md` directly:
```bash
claude --skill .agents/skills/sennovate-product-skill/SKILL.md
```
Or add to your project's `CLAUDE.md`:
```markdown
# Sennovate Brand & UI Guidelines
Please read and adhere to the rules in `.agents/skills/sennovate-product-skill/SKILL.md`.
```

---

### 3. In Cursor / VS Code / GitHub Copilot
* Place the folder in your project root or `.cursor/skills/`.
* In `.cursorrules` or `.github/copilot-instructions.md`, add:
  ```markdown
  When designing or implementing any UI, component, MVP, dashboard, or AI interface for Sennovate, 
  strictly follow the design tokens, brand rules, and patterns in:
  `sennovate-product-skill/SKILL.md`
  ```

---

### 4. For Frontend Developers & Interns (No AI)
You don't need an AI agent to use this skill! Any developer or intern can:
1. Import the CSS tokens into their web app:
   ```html
   <link rel="stylesheet" href="sennovate-product-skill/tokens/tokens.css">
   ```
2. Copy SVG logos from `sennovate-product-skill/assets/logos/`.
3. Open `sennovate-product-skill/examples/` in any browser to copy-paste pre-built UI components.

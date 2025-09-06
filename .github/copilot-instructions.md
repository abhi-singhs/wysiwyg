# GitHub Copilot Project Instructions

Purpose: Provide consistent guidance to AI assistants contributing to this repo.

## 1. Project Overview
A Next.js (App Router) TypeScript app for quickly creating GitHub issues or adding comments/notes. Implements GitHub API interactions via route handlers under `src/app/api/github/*`.

## 2. Stack & Key Conventions
- Framework: Next.js App Router (server + client components). Default export `page.tsx` is a Client Component (`'use client'`).
- Styling: Tailwind (via `@import "tailwindcss"`) plus custom CSS variables in `globals.css`.
- Icons: `lucide-react`.
- Types: Keep lightweight inline interfaces in components unless reused broadly.
- Theme: Manual light/dark via `<html class="light|dark">` (default light). CSS variables drive colors; `.light` blocks dark media query overrides.

## 3. Theming Guidelines
Use semantic CSS custom properties already defined:
- Background: `var(--background)` / surfaces `--surface`, `--surface-subtle`.
- Text: `--foreground`, muted `--text-muted`, placeholder `--text-placeholder`.
- Borders: `--border`, `--border-strong`.
- Accent: `--accent`, hover `--accent-hover`.

When adding components:
- Never hard-code hex colors; prefer Tailwind classes that map well in both themes OR inline style referencing the existing CSS variables.
- For conditional dark styles prefer `.dark :where(...)` overrides rather than duplicating large blocks.
- Keep accessible contrast (WCAG AA). Use accent color only for interactive affordances.

## 4. Accessibility
- Maintain minimum hit target: buttons >= 40px height (or 32px with sufficient padding).
- Provide `aria-label` where icon-only buttons appear (e.g., theme toggle, logout).
- Keep keyboard navigation: focusable elements must show focus ring (Tailwind `focus:ring-2 focus:ring-blue-500` or custom ring using `--focus-ring`).
- Dropdown lists: use `role="listbox"` and `role="option"` as already established if enhancing.

## 5. API Route Patterns
Each GitHub API route under `src/app/api/github` expects Authorization header `Bearer <PAT>`.
Add new routes by:
1. Validating presence of `Authorization` header.
2. Extracting token safely (`const token = auth.split(' ')[1]`).
3. Propagating minimal necessary JSON to GitHub REST endpoints (do not forward unnecessary user input).
4. Returning JSON with only required fields for UI (avoid leaking large payloads).
5. Handling error states with appropriate HTTP status and a JSON `{ error: string }` body.

## 6. Error Handling & Notifications
- Use the existing `showNotification(message, type, link?)` for user feedback.
- Prefer descriptive but concise user messages; log raw errors to console only.

## 7. State & Performance
- Debounce network searches (pattern shown for issue search). Keep debounce of 250–350ms.
- Avoid storing large objects in state; extract only fields needed by UI.

## 8. Code Style
- Functional React with hooks; no class components.
- Keep functions pure (avoid side effects beyond network calls / localStorage updates placed inside `useEffect` or event handlers).
- Type narrow quickly; return early on invalid state.
- Prefer `useCallback` for functions passed deeply or used in effects; do not overuse.

## 9. Adding Components / Features
Include:
- Types (inline or in a local `types.ts` if shared).
- Minimal tests if logic becomes non-trivial (e.g., label filtering, debouncing). (Tests infra not yet present—if adding, propose a lightweight setup.)
- Consider extracting reusable UI atoms once duplicated 3+ times.

## 10. Do / Don't
**Do**
- Reuse existing CSS variables.
- Keep accessibility in mind (labels, roles, color contrast, focus states).
- Minimize bundle growth (lazy-load heavy, seldom-used components if introduced).
- Maintain idempotent server handlers.

**Don't**
- Introduce new design tokens without mapping to an existing semantic meaning.
- Hardcode theme-specific colors in components.
- Use `Math.random()` or `Date.now()` in rendered output without stabilizing (causes hydration mismatch).
- Store secrets in the repo.

## 11. Theme Toggle Logic
- Theme selection persisted in `localStorage('theme')`.
- On mount: `<html>` gets either `light` or `dark`. Hydration mismatch avoided by gating text/icon changes behind a `mounted` flag.
- If adding an "Auto" option, implement: when auto selected remove both classes and allow media query to drive (do not set `.light`).

## 12. Security
- PAT never logged. Only minimal error messages surfaced to user.
- Sanitize/validate all user-supplied inputs before sending to GitHub (strip newlines if used in simple text fields if needed).

## 13. Future Enhancements (Optional Roadmap)
- Add tests (Playwright or Jest + React Testing Library) around issue search and comment creation flows.
- Add keyboard navigation for dropdown (arrow keys) & active item styling.
- Provide offline draft persistence (localStorage key per selected issue).
- Implement "Auto" theme mode.

---
These instructions guide AI-generated changes for coherence, accessibility, and security. Keep this file concise—update when architectural decisions change.

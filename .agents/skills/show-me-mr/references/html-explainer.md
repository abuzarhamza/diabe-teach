# Interactive HTML explainer

Write one file: `.show-me/mr-{id}/index.html`. It is a disposable page that helps one reviewer understand one change. Make it good enough to be worth opening, and then stop.

## Constraints

- **Self-contained.** Inline all CSS and JS. The only allowed CDN script is Mermaid (`https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs`). The page must still be readable if that script fails to load.
- **Works offline after load, on desktop and mobile, in light and dark mode** (`prefers-color-scheme`).
- **Real data only.** Use the actual file paths, identifiers, line counts, and diff hunks. Do not use placeholders or lorem ipsum.
- **Match the product** when the repo has a clear design system (Tailwind config, CSS variables, a component library). Otherwise use a plain, neutral style with a system font stack and a monospace font for code.
- **Escape code.** HTML-escape every diff line and identifier you embed.

## Sections

Include only the sections that help. Use this order:

1. **Header**: title, PR/MR link, author, base ← head, and a `+added / −removed` count
2. **Summary**: the level 1 STE text, with warnings styled as callouts
3. **Map**: a clickable file tree or a box diagram of the changed modules. Size each module by lines changed and color it by kind (added, modified, deleted, test). Clicking a module scrolls to its walkthrough step.
4. **Walkthrough**: a stepper (← → keys and buttons) that follows the review order. Each step shows:
   - one STE sentence that says what to look for
   - the relevant hunk with syntax-colored `+`/`−` lines (keep it short and link to the full file on the host)
   - an optional small diagram from level 2
5. **Behavior**: for changes to control flow or state, an animated before/after. Example: a Mermaid sequence diagram whose messages appear one by one when the user presses Play, or a toggle between the old and new state machine.
6. **Checklist**: 3 to 6 review checkboxes taken from the warnings and risky hunks. Keep their state in `localStorage` with a key that includes the MR id.

## Interaction rules

- Animate only to show order or cause and effect. Do not add decorative motion, and respect `prefers-reduced-motion`.
- Every interactive control needs a keyboard path and a visible focus state.
- Keep the page under ~150 KB. Truncate very large hunks and say how many lines you left out.

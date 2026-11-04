# Aptagrim HRMS — Prototype

A clickable HRMS prototype covering the **Admin**, **HR** and **Employee** workspaces.
It runs as plain static files: no build step, no bundler, no package manager.

React is loaded as a UMD bundle from a CDN, the design system and application code are
hand-written ES5-compatible scripts, and all data comes from an in-memory seed, so the
whole thing opens straight from a web server.

## Running it

Any static file server will do. From the repository root:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/index.html>.

Opening `index.html` directly from the filesystem also mostly works, but a server is
recommended so the font and CSS `@import` requests resolve consistently.

> **Note:** `index.html` pulls `react` and `react-dom` 18.3.1 from `cdnjs.cloudflare.com`.
> The page needs network access to that host on first load, or the app will not mount.
> To run fully offline, download the two UMD bundles into the repository and repoint the
> two `<script>` tags at the local copies.

## Layout

```
index.html                 Entry point. Loads every stylesheet and script, in order.
admin/people.html          Legacy URL; redirects into the workspace at #/admin/people.

css/
  prototype.css            Application-specific styles.

design-system/
  css/index.css            The one stylesheet to link. @imports everything below it.
  css/violet-*.css         Base layer: design tokens and components.
  css/tracklivo-*.css      Restyle layer on top of the base.
  css/app.css              App shell: side rail, top bar, cards, stat tiles, modal, toast.
  css/auth.css, auth-b.css Sign-in surfaces (two options).
  css/admin*.css           Admin console and editing surfaces.
  css/dashboard.css        Dashboard shell.
  css/wizard.css           Multi-step flows.
  css/ai-beam.css          Motion for surfaces the assistant is working on.
  css/fonts.css            Google Sans / Google Sans Flex @font-face rules.
  fonts/*.woff2            The font files themselves.
  js/violet.js             Component library (Button, Select, Chip, Avatar, ...).
  js/icons.js              Icon set.

js/
  data/seed.js             All seeded demo data.
  store.js                 State, collections, overrides, preferences.
  rules.js                 Domain rules.
  actions.js               Mutations and workflows.
  permissions.js           Resolves a role's access level per module.
  nav.js                   Information architecture and navigation model.
  router.js                Hash routing.
  ui.js                    Shared app primitives (Card, PageHead, DataTable, Modal, ...).
  charts.js                Chart rendering.
  perf.js, payroll.js      Domain helpers.
  shell.js                 The workspace frame.
  screens.js               Screen registry plus the first set of screens.
  screens/*.js             One file per module; each registers into `HRMS.screens`.
  app.js                   Boot.
```

## Load order

`index.html` loads scripts in a deliberate order — **data, then state, then IA, then
views** — because the modules attach themselves to a global `HRMS` namespace rather than
importing each other. Moving a `<script>` tag earlier than its dependencies will break
the boot. Each file under `js/screens/` registers its routes into `HRMS.screens`, so new
screens are added by dropping in a file and adding one `<script>` tag before `js/app.js`.

## Status

This is a prototype: data is seeded in the browser and nothing is persisted. Reloading
the page resets every change.

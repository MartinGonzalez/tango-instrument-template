---
name: tango-instrument
description: Reference for developing this Tango instrument — architecture, APIs, UI components, permissions, and dev workflow.
---

# Tango Instrument Development

You are developing a Tango instrument. This is a plugin that runs inside the Tango desktop app. Use this reference to write correct code.

## Documentation

Full docs: https://tango-app-docs.example.com (TODO: replace with real URL)

## Architecture

An instrument has two optional parts:

- **Frontend** (`src/index.tsx`) — React components that render in panel slots inside Tango's WebKit webview. Imported from `"tango-api"`.
- **Backend** (`src/backend.ts`) — Runs in the host Bun process. Handles data fetching, heavy logic, and side effects. Imported from `"tango-api/backend"`.

### Mandatory rules

1. **NEVER poll, fetch, or run timers in the frontend.** The backend owns all data fetching and scheduling.
2. **Backend pushes data to the frontend via `ctx.emit()`** — the frontend listens with `useHostEvent`.
3. **Frontend fetches data on mount and on user action only** — never on a timer.
4. **Every panel component must be wrapped in `<UIRoot>`.**

## Panel slots

| Slot | Description |
|------|-------------|
| `sidebar` | Left sidebar panel |
| `first` | Main content area (center-left) |
| `second` | Secondary content area (center-right) |
| `right` | Right sidebar panel |

Enable/disable slots in `package.json` under `tango.instrument.panels`.

## Frontend

### Entry point (`src/index.tsx`)

Must default-export a definition created by `defineReactInstrument`:

```tsx
import { defineReactInstrument } from "tango-api";

export default defineReactInstrument({
  panels: {
    sidebar: SidebarPanel,
    first: MainPanel,
  },
  defaults: {
    visible: { sidebar: true, first: true },
  },
  lifecycle: {
    onStart: async (api) => {},
    onStop: async () => {},
  },
});
```

### Hooks

```tsx
import {
  useInstrumentApi,       // Full API object (storage, sessions, actions, etc.)
  useHostEvent,           // Subscribe to host events
  useInstrumentAction,    // Shorthand for calling a backend action
  useSession,             // Managed Claude session with streaming
  useInstrumentSettings,  // Read/write instrument settings
  usePanelVisibility,     // Which panels are currently visible
} from "tango-api";
```

**`useInstrumentApi()`** — Returns the full API:
- `api.storage` — Key-value, file, and SQLite storage
- `api.sessions` — Start/query/follow-up Claude sessions
- `api.actions` — Call backend actions
- `api.stages` — Read active stage path
- `api.connectors` — OAuth connectors (Slack, Jira)
- `api.events` — Subscribe to host events
- `api.settings` — Read/write instrument settings
- `api.ui.renderMarkdown(text)` — Render markdown to HTML
- `api.ui.openUrl(url)` — Open URL externally
- `api.emit(event)` — Emit custom events

**`useHostEvent(eventId, callback)`** — Subscribe to events:
- `snapshot.update` — Full system snapshot
- `session.stream` — Claude streaming chunks
- `session.ended` — Session finished
- `instrument.event` — Cross-instrument / backend events
- `stage.added` / `stage.removed` — Stage changes

**`useInstrumentAction(name)`** — Call a backend action:
```tsx
const greet = useInstrumentAction<{ name: string }, { greeting: string }>("hello");
const result = await greet({ name: "World" });
```

**`useSession(opts)`** — Managed Claude session:
```tsx
const { send, reset, response, isResponding, loaded } = useSession({
  id: "my-session",
  persist: true,
});
```

### UI components

All imported from `"tango-api"`. Use `tui-col` / `tui-row` CSS classes for layout.

| Component | Key props |
|-----------|-----------|
| `UIRoot` | `className?`, `fixed?` — **Required wrapper for every panel** |
| `UIPanelHeader` | `title`, `subtitle?`, `rightActions?`, `onBack?` |
| `UISection` | `title?`, `description?` |
| `UICard` | `className?` |
| `UIButton` | `label`, `variant?`, `size?`, `icon?`, `onClick?` |
| `UIIconButton` | `icon`, `label`, `title?`, `variant?`, `onClick?` |
| `UIBadge` | `label`, `tone?` |
| `UIEmptyState` | `title`, `description?`, `action?` |
| `UIInput` | `value?`, `placeholder?`, `onInput?` |
| `UITextarea` | `value?`, `placeholder?`, `rows?`, `onInput?` |
| `UISelect` | `options`, `value?`, `onChange?` |
| `UIDropdown` | `options`, `value?`, `placeholder?`, `onChange?` |
| `UIToggle` | `label`, `checked?`, `onChange?` |
| `UICheckbox` | `label`, `checked?`, `onChange?` |
| `UIRadioGroup` | `name`, `options`, `value?`, `onChange?` |
| `UISegmentedControl` | `options`, `value?`, `onChange?` |
| `UIList` / `UIListItem` | List container + rows |
| `UITabs` | `tabs`, `value?`, `onChange?` |
| `UIGroup` | Collapsible group with `title`, `expanded?`, `onToggle?` |
| `UISelectionList` | `items`, `selected`, `multiple?`, `onChange?` |
| `UIMarkdownRenderer` | `content` |
| `UILink` | `href`, `label` |
| `UIKeyValue` | `items: { label, value }[]` |
| `UIScrollArea` | Scrollable container |
| `UIIcon` | `name`, `size?` |

**Button variants:** `"primary"` | `"secondary"` | `"ghost"` | `"danger"` | `"success"`

**Badge tones:** `"neutral"` | `"info"` | `"success"` | `"warning"` | `"danger"`

### CSS variables

```css
--tui-bg, --tui-bg-secondary, --tui-bg-card, --tui-bg-hover
--tui-text, --tui-text-secondary
--tui-border, --tui-primary
--tui-blue, --tui-green, --tui-amber, --tui-red
```

## Backend

### Entry point (`src/backend.ts`)

Must default-export a definition created by `defineBackend`:

```ts
import { defineBackend, type InstrumentBackendContext } from "tango-api/backend";

export default defineBackend({
  kind: "tango.instrument.backend.v2",
  onStart: async (ctx) => { /* initialize */ },
  onStop: async () => { /* cleanup */ },
  actions: {
    myAction: {
      input: { type: "object", properties: { name: { type: "string" } } },
      output: { type: "object", properties: { result: { type: "string" } } },
      handler: async (ctx, input) => {
        return { result: `Hello ${input.name}` };
      },
    },
  },
});
```

### Backend context (`ctx`)

- `ctx.instrumentId` — This instrument's ID
- `ctx.permissions` — Granted permissions
- `ctx.emit({ event, payload? })` — Push data to frontend
- `ctx.logger.info/warn/error(msg)` — Logging
- `ctx.host.storage` — Storage API (same as frontend)
- `ctx.host.sessions` — Sessions API
- `ctx.host.connectors` — Connectors API
- `ctx.host.stages` — Stages API
- `ctx.host.settings` — Settings API

### Backend → Frontend communication pattern

```ts
// Backend: emit event when data changes
ctx.emit({ event: "data.updated", payload: { items } });

// Frontend: listen and update UI
useHostEvent("instrument.event", (payload) => {
  if (payload.event === "data.updated") {
    setItems(payload.payload.items);
  }
});
```

## Permissions

Declared in `package.json` under `tango.instrument.permissions`. Only request what you need.

| Permission | What it unlocks |
|------------|----------------|
| `storage.properties` | Key-value storage |
| `storage.files` | File read/write |
| `storage.db` | SQLite queries |
| `sessions` | Claude sessions (start, query, stream) |
| `stages.read` | Read stage metadata |
| `stages.observe` | Stage change events |
| `connectors.read` | List connectors |
| `connectors.credentials.read` | Read OAuth tokens |
| `connectors.connect` | Initiate OAuth flow |

## Background refresh

For instruments that need periodic data updates, use `backgroundRefresh` in the manifest:

```json
{
  "tango": {
    "instrument": {
      "backgroundRefresh": {
        "intervalMs": 60000
      }
    }
  }
}
```

Then handle it in the backend:

```ts
export default defineBackend({
  onBackgroundRefresh: async (ctx) => {
    const data = await fetchLatestData();
    ctx.emit({ event: "data.refreshed", payload: data });
  },
});
```

## Settings

Define user-configurable settings in `package.json`:

```json
{
  "tango": {
    "instrument": {
      "settings": [
        { "key": "apiKey", "type": "string", "title": "API Key", "required": true, "secret": true },
        { "key": "count", "type": "number", "title": "Max Results", "default": 10, "min": 1, "max": 100 },
        { "key": "enabled", "type": "boolean", "title": "Enable Feature", "default": false },
        { "key": "format", "type": "select", "title": "Output Format", "options": [{"value":"json","label":"JSON"}] }
      ]
    }
  }
}
```

Run `bun run sync` to regenerate `tango-env.d.ts` with typed setting keys.

Read settings from frontend: `const { values, setValue } = useInstrumentSettings();`

## Dev workflow

```bash
bun run dev       # Build + watch + hot-reload (connects to Tango on port 4243)
bun run build     # One-off production build
bun run validate  # Check manifest and project structure
bun run sync      # Regenerate tango-env.d.ts from settings schema
```

Edits to `src/` auto-rebuild and hot-reload in Tango. Changes to `package.json` trigger a fresh `bun install` + rebuild.

---
name: tango-instrument
description: Reference for developing this Tango instrument — architecture, APIs, UI components, permissions, and dev workflow.
---

# Tango Instrument Development

You are developing a Tango instrument — a plugin that runs inside the Tango desktop app.

**Docs:** [AI Overview](https://martingonzalez.github.io/tango-app/reference/ai-overview/) — full SDK reference in one page, with deep links to each topic.

## How instruments work

An instrument has two parts, both optional:

- **Frontend** (`src/index.tsx`) — React components rendered in panel slots inside Tango's WebKit webview. Everything you import from `"tango-api"`.
- **Backend** (`src/backend.ts`) — Code that runs in the host Bun process. This is where you do data fetching, heavy computation, file I/O, API calls, timers — anything that shouldn't run in a browser. Import from `"tango-api/backend"`.

**When do you need a backend?** If your instrument just displays static UI or reads from Tango's built-in storage, frontend-only is fine. Add a backend when you need to: fetch external APIs, run periodic tasks, process large data, or do anything you wouldn't do in a browser.

### The golden rules

1. **The frontend is dumb.** It renders UI and responds to user actions. It does NOT fetch data, poll, or run timers.
2. **The backend is the brain.** It owns all data fetching, scheduling, and side effects. It pushes data to the frontend via events.
3. **Panels cannot talk to each other directly.** Each panel slot (sidebar, first, second, right) is a separate React root — they share NO state. All panel-to-panel communication MUST go through the backend.
4. **`api.emit()` (frontend) is ONLY for cross-instrument communication** — talking to OTHER instruments. To send data between your own panels, call a backend action, then have the backend use `ctx.emit()` to broadcast to all your panels.
5. **Every panel component must be wrapped in `<UIRoot>`.** This injects the Tango theme.

### Panel communication pattern (IMPORTANT)

Panels cannot share React state. Use the backend as a hub:

```
Sidebar panel ──→ calls backend action ──→ Backend processes
                                              │
                                              ├── ctx.emit("items.loaded", { items })
                                              │
First panel ←── useHostEvent("instrument.event") listens
Second panel ←── useHostEvent("instrument.event") listens
```

```tsx
// Sidebar: user clicks an item → call backend action
const selectItem = useInstrumentAction("selectItem");
<UIListItem onClick={() => selectItem({ id: item.id })} />

// Backend: fetch data and broadcast to all panels
actions: {
  selectItem: {
    handler: async (ctx, input) => {
      const detail = await fetchDetail(input.id);
      ctx.emit({ event: "item.selected", payload: { detail } });
      return { ok: true };
    },
  },
},

// First panel: listen for the event
useHostEvent("instrument.event", useCallback((payload) => {
  if (payload.event === "item.selected") {
    setDetail(payload.payload.detail);
  }
}, []));
```

**NEVER use `api.emit()` to communicate between your own panels — it won't work.**

### Loading states with ctx.emit() (GOTCHA)

`ctx.emit()` events are delivered immediately, BUT if you emit multiple events in rapid succession within a single action handler (e.g., a "loading" event followed by a "loaded" event), React 18 may batch the state updates and only render the final state. The user will never see the loading indicator.

**DON'T do this — loading state will be invisible:**
```ts
handler: async (ctx, input) => {
  ctx.emit({ event: "tickets.loading" });      // React batches this...
  const tickets = await fetchTickets(input.id);
  ctx.emit({ event: "tickets.loaded", payload: { tickets } }); // ...with this
  return { ok: true };
}
```

**DO this instead — set loading state in the frontend before calling the action:**
```tsx
// Frontend: set loading LOCALLY, then call the backend
const [loading, setLoading] = useState(false);
const fetchTickets = useInstrumentAction("fetchTickets");

async function handleClick(id: string) {
  setLoading(true);                         // Immediate local state
  await fetchTickets({ id });               // Backend fetches and emits result
}

// Listen for the result event
useHostEvent("instrument.event", useCallback((payload) => {
  if (payload.event === "tickets.loaded") {
    setTickets(payload.payload.tickets);
    setLoading(false);                      // Clear loading when data arrives
  }
}, []));
```

**Rule of thumb:** Frontend owns loading/UI state. Backend owns data. Don't try to drive UI state from the backend.

## Panel slots

Your instrument can render into up to 4 slots:

| Slot | Where it appears | Common use |
|------|-----------------|------------|
| `sidebar` | Left sidebar | Navigation, lists, quick actions |
| `first` | Center-left main area | Primary content |
| `second` | Center-right | Secondary/detail view |
| `right` | Right sidebar | Context panels, settings |

Enable slots in `package.json` under `tango.instrument.panels`. Only create panel components for slots you enable.

## Frontend guide

### Entry point

`src/index.tsx` must default-export a `defineReactInstrument` call:

```tsx
import { defineReactInstrument } from "tango-api";

export default defineReactInstrument({
  panels: {
    sidebar: SidebarPanel,    // React component for each slot
    first: MainPanel,
  },
  defaults: {
    visible: { sidebar: true, first: true },  // Which panels show by default
  },
});
```

### Choosing the right hook

| You want to... | Use this |
|----------------|----------|
| Access storage, sessions, actions, UI utils | `useInstrumentApi()` — returns the full API object |
| Call a single backend action | `useInstrumentAction("actionName")` — cleaner than `api.actions.call()` |
| Run a Claude session with streaming | `useSession({ id, persist? })` — manages state, streaming, and persistence |
| React to host events (stage changes, sessions, backend pushes) | `useHostEvent("eventName", callback)` |
| Read/write user settings | `useInstrumentSettings()` |
| Check which panels are visible | `usePanelVisibility()` |

### The API object (`useInstrumentApi()`)

```tsx
const api = useInstrumentApi();

// Storage — persist instrument data
await api.storage.getProperty<MyType>("key");
await api.storage.setProperty("key", value);

// Backend actions — call your backend handlers
const result = await api.actions.call("myAction", { input: "data" });

// Sessions — interact with Claude
await api.sessions.start({ prompt: "Help me with...", cwd: "/path" });

// UI utilities
api.ui.openUrl("https://example.com");
const html = api.ui.renderMarkdown("# Hello");

// Custom events — communicate with other instruments
api.emit({ event: "my-custom-event", payload: { data } });
```

### UI components

All imported from `"tango-api"`. Build layouts with `tui-col` and `tui-row` CSS classes.

**Layout & structure:**
`UIRoot` (required wrapper), `UIScrollArea`, `UIPanelHeader`, `UISection`, `UICard`, `UIContainer`, `UIFooter`

**Actions:**
`UIButton` (variants: `primary`, `secondary`, `ghost`, `danger`, `success`), `UIIconButton`, `UILink`

**Data display:**
`UIBadge` (tones: `neutral`, `info`, `success`, `warning`, `danger`), `UIKeyValue`, `UIMarkdownRenderer`, `UIInlineCode`, `UIIcon`, `UIEmptyState`

**Lists & groups:**
`UIList` + `UIListItem`, `UIGroup` (collapsible), `UISelectionList`, `UITreeView`

**Forms:**
`UIInput`, `UITextarea`, `UISelect`, `UIDropdown`, `UIToggle`, `UICheckbox`, `UIRadioGroup`, `UISegmentedControl`

**Navigation:**
`UITabs`

### Theme CSS variables

Use these for custom styling that respects Tango's dark theme:

```css
--tui-bg               /* Main background */
--tui-bg-secondary     /* Subtle background */
--tui-bg-card          /* Card surfaces */
--tui-text             /* Primary text */
--tui-text-secondary   /* Muted text */
--tui-border           /* Borders */
--tui-primary          /* Accent color */
```

## Backend guide

### Entry point

`src/backend.ts` must default-export a `defineBackend` call:

```ts
import { defineBackend, type InstrumentBackendContext } from "tango-api/backend";

export default defineBackend({
  kind: "tango.instrument.backend.v2",

  onStart: async (ctx) => {
    ctx.logger.info("Instrument started");
    // Initialize state, start subscriptions, etc.
  },

  onStop: async () => {
    // Clean up resources
  },

  actions: {
    fetchItems: {
      input: { type: "object", properties: { query: { type: "string" } } },
      output: { type: "object", properties: { items: { type: "array" } } },
      handler: async (ctx, input) => {
        const items = await fetchFromApi(input.query);
        return { items };
      },
    },
  },
});
```

### The backend context (`ctx`)

- `ctx.emit({ event, payload? })` — **This is how you talk to the frontend.** Push data updates, status changes, anything.
- `ctx.logger.info/warn/error(msg)` — Structured logging
- `ctx.instrumentId` — Your instrument's ID
- `ctx.host.storage` — Same storage API as frontend
- `ctx.host.sessions` — Start Claude sessions from the backend
- `ctx.host.settings` — Read instrument settings

### Pattern: Backend pushes data, frontend listens

This is the core pattern for any instrument that fetches data:

```ts
// Backend — fetch and push
actions: {
  refresh: {
    handler: async (ctx) => {
      const data = await fetchLatestData();
      ctx.emit({ event: "data.updated", payload: { data } });
      return { ok: true };
    },
  },
},

// Frontend — listen and render
function MainPanel() {
  const [data, setData] = useState(null);
  const refresh = useInstrumentAction("refresh");

  useHostEvent("instrument.event", useCallback((payload) => {
    if (payload.event === "data.updated") {
      setData(payload.payload.data);
    }
  }, []));

  useEffect(() => { refresh(); }, []);  // Fetch on mount

  return (
    <UIRoot>
      <UIPanelHeader title="My Data" rightActions={
        <UIIconButton icon="refresh" label="Refresh" onClick={() => refresh()} />
      } />
      {data ? <DataView data={data} /> : <UIEmptyState title="Loading..." />}
    </UIRoot>
  );
}
```

### Background refresh

If your instrument needs periodic data updates (e.g., polling an API every minute), don't build your own timer. Use the built-in background refresh:

```json
// In package.json → tango.instrument
"backgroundRefresh": { "intervalMs": 60000 }
```

```ts
// In backend
onBackgroundRefresh: async (ctx) => {
  const data = await fetchLatestData();
  ctx.emit({ event: "data.refreshed", payload: data });
},
```

Tango manages the timer lifecycle for you — it pauses when the app is idle and resumes when active.

## Permissions

Declared in `package.json` under `tango.instrument.permissions`. **You MUST declare every permission your code uses** — Tango will throw a runtime error if you call an API without the matching permission.

**IMPORTANT: When you write code that uses any API or event listed below, ALWAYS add the corresponding permission to `package.json` immediately. Do not wait until the end.**

### API → Required permission mapping

| You use this in your code | You MUST add this permission |
|--------------------------|------------------------------|
| `api.storage.getProperty()`, `api.storage.setProperty()`, `api.storage.deleteProperty()` | `storage.properties` |
| `api.storage.readFile()`, `api.storage.writeFile()`, `api.storage.deleteFile()`, `api.storage.listFiles()` | `storage.files` |
| `api.storage.sqlQuery()`, `api.storage.sqlExecute()` | `storage.db` |
| `api.sessions.start()`, `api.sessions.query()`, `api.sessions.sendFollowUp()`, `api.sessions.kill()`, `useSession()` | `sessions` |
| `useHostEvent("session.stream", ...)`, `useHostEvent("session.ended", ...)` | `sessions` |
| `api.stages.list()`, `api.stages.active()` | `stages.read` |
| `useHostEvent("stage.added", ...)`, `useHostEvent("stage.removed", ...)` | `stages.observe` |
| `api.connectors.listStageConnectors()`, `api.connectors.isAuthorized()` | `connectors.read` |
| `api.connectors.getCredential()` | `connectors.credentials.read` |
| `api.connectors.connect()`, `api.connectors.disconnect()` | `connectors.connect` |

### Example

If your instrument reads the active stage and listens for stage changes:

```json
// package.json → tango.instrument
"permissions": ["stages.read", "stages.observe"]
```

```tsx
// Frontend — this requires BOTH permissions
const stage = await api.stages.active();           // needs stages.read
useHostEvent("stage.added", (p) => { /* ... */ }); // needs stages.observe
```

## Settings

When your instrument needs user configuration (API keys, preferences, limits), define a settings schema:

```json
// In package.json → tango.instrument
"settings": [
  { "key": "apiKey", "type": "string", "title": "API Key", "required": true, "secret": true },
  { "key": "maxResults", "type": "number", "title": "Max Results", "default": 10, "min": 1, "max": 100 },
  { "key": "enabled", "type": "boolean", "title": "Auto-refresh", "default": false },
  { "key": "format", "type": "select", "title": "Output", "options": [{"value":"json","label":"JSON"},{"value":"csv","label":"CSV"}] }
]
```

After changing settings, run `bun run sync` to regenerate `tango-env.d.ts` with typed keys.

```tsx
// Frontend — read settings
const { values, setValue, loading } = useInstrumentSettings();
if (values?.apiKey) { /* configured */ }
```

## Manifest quick reference

The full manifest lives in `package.json` under `tango.instrument`:

```json
{
  "tango": {
    "instrument": {
      "id": "my-instrument",           // Unique kebab-case ID
      "name": "My Instrument",          // Display name in Tango UI
      "description": "What it does",    // Shown in marketplace
      "category": "developer-tools",    // developer-tools | productivity | media | communication | finance | utilities
      "group": "Custom",                // Sidebar grouping
      "runtime": "react",               // react | vanilla
      "entrypoint": "./dist/index.js",
      "backendEntrypoint": "./dist/backend.js",  // Remove if no backend
      "hostApiVersion": "2.0.0",
      "launcher": {
        "sidebarShortcut": { "enabled": true, "label": "My Tool", "icon": "puzzle", "order": 50 }
      },
      "panels": { "sidebar": true, "first": true, "second": false, "right": false },
      "permissions": [],
      "settings": []
    }
  }
}
```

## Dev workflow

```bash
bun run dev       # Build + watch + hot-reload (Tango must be running on port 4243)
bun run build     # One-off production build → dist/
bun run validate  # Check manifest, entry points, permissions are valid
bun run sync      # Regenerate tango-env.d.ts from settings schema
```

- Edits to `src/` auto-rebuild and hot-reload — no restart needed
- Changes to `package.json` or lockfile trigger a fresh `bun install` + rebuild
- Your instrument shows a `[dev]` badge in Tango's sidebar while dev mode is active

## Distribution

To share your instrument:

1. Push to a GitHub repository
2. Make sure `tango.json` exists at the repo root (already included in this template)
3. Users add your repo as a source in Tango and install from the browse panel

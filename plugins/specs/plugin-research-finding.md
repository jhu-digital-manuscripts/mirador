# Plugin: Research Finding

## Summary

Tracks user research actions within Mirador, maintains an editable list of those actions, supports URL fragment-based browser history, and provides export to HTML and RMap DiSCO formats. Optionally integrates with Mirador's built-in state export to enable resumable research sessions.

## Motivation

- Researchers using the original Mirador 2 viewer could capture their research path (pages viewed, searches performed, annotations examined) and export it as a citable scholarly object.
- The HTML export produced a standalone document recording the research session that could be shared or archived.
- The RMap export translated the research path into a DiSCO (Digital Scholarly Communication Object) for deposit into the RMap ecosystem.
- URL fragment history allowed browser back/forward navigation through the research session and provided a shareable (partial) link to a viewer state.
- This feature had no equivalent in any Mirador version and was entirely custom.

## Scope

### In scope

- Automatic tracking of configurable user actions:
  - Canvas navigation (page turns)
  - Manifest/window opens
  - Search queries executed
  - Annotation views
  - Collection browsing
- Tracked action list stored in plugin state (client-side, session-scoped)
- Editable action entries: user can edit label and description for each entry
- Removable entries: user can delete entries from the list
- Free-form description field for the session as a whole
- URL fragment synchronization:
  - State changes write a minimal parsable fragment to `window.location.hash`
  - Creates browser history entries for back/forward navigation
  - On load, parse fragment to restore partial viewer state
- Export to HTML:
  - Standalone HTML document with embedded CSS
  - Lists all tracked actions with labels, descriptions, timestamps
  - Includes session description
  - Optionally embeds a Mirador state snapshot for resumability
- Export to RMap DiSCO:
  - Translates action list into an RMap DiSCO payload
  - Submits to RMap API
- UI for managing the action list (companion window or dialog)
- Export trigger button in workspace control panel
- Configurable: feature can be entirely disabled, or individual export formats disabled

### Out of scope

- Server-side persistence of research sessions (this is client-only)
- Persisting the action list across browser refreshes (unless localStorage augmentation is added later)
- Collaborative/shared research sessions
- Undo/redo of viewer actions (this only tracks, it doesn't control)

## Architecture

### Plugin type

- **Companion window or dialog:** UI for viewing/editing the action list
- **Add to `WorkspaceControlPanelButtons`:** Export button
- **Custom reducer:** Action list and session metadata
- **Custom saga:** Action observation, URL fragment sync, export logic

### Plugin definition (grouped)

```js
export default [
  researchFindingReducerPlugin,
  researchFindingSagaPlugin,
  actionListPanelPlugin,
  exportButtonPlugin
];
```

### State

Custom reducer (`researchFinding`):

```
{
  enabled: boolean,
  session: {
    id: string,
    description: string,           // User-editable session description
    startedAt: string              // ISO timestamp
  },
  actions: [{
    id: string,
    type: 'navigate' | 'search' | 'openManifest' | 'viewAnnotation' | 'browseCollection',
    timestamp: string,
    label: string,                 // Auto-generated, user-editable
    description: string,           // User-editable, initially empty
    context: {
      manifestId: string | null,
      canvasId: string | null,
      windowId: string | null,
      query: string | null,        // For search actions
      annotationId: string | null  // For annotation view actions
    }
  }],
  export: {
    formats: {
      html: { enabled: boolean },
      rmap: { enabled: boolean, apiUrl: string | null }
    },
    includeStateSnapshot: boolean  // Whether to embed resumable state in HTML export
  },
  urlFragment: {
    enabled: boolean,
    lastWritten: string | null
  }
}
```

### Saga

The saga is the core of this plugin, responsible for three concerns:

#### 1. Action observation

```js
function* watchResearchActions() {
  yield takeEvery([
    'mirador/SET_CANVAS',
    'mirador/ADD_WINDOW',
    'mirador/REQUEST_SEARCH',
    // Custom action types from other plugins:
    'jhu/ANNOTATION_VIEWED',
    'jhu/COLLECTION_BROWSED'
  ], trackAction);
}
```

The `trackAction` handler creates an entry with an auto-generated label (e.g. "Viewed folio 23r" derived from canvas label) and appends it to the action list.

**Deduplication/collapsing:** Sequential canvas navigations within the same manifest within a short time window (e.g. rapid page turning) should be collapsed into a single "Browsed pages X–Y" entry to avoid list bloat.

#### 2. URL fragment synchronization

```js
function* watchStateForFragment() {
  yield takeEvery([
    'mirador/SET_CANVAS',
    'mirador/ADD_WINDOW',
    'mirador/SET_WORKSPACE_ADD_VISIBILITY'
  ], writeUrlFragment);
}

function* initFromUrlFragment() {
  const fragment = window.location.hash;
  if (fragment) {
    const partialState = parseFragment(fragment);
    // Dispatch actions to restore: open manifest, navigate to canvas, etc.
  }
}
```

Fragment format (minimal, parsable):
```
#manifest=<uri>&canvas=<index>&view=<type>
```

This is intentionally lossy — it captures enough to get back to approximately the right place, not to fully restore a complex multi-window layout. Full restoration uses the state snapshot in the HTML export.

#### 3. Export generation

```js
function* handleExport({ format }) {
  const state = yield select(getResearchFindingState);
  const miradorState = yield select(getExportableState);  // Mirador's built-in

  if (format === 'html') {
    const html = generateHtmlExport(state, miradorState);
    downloadAsFile(html, 'research-session.html', 'text/html');
  } else if (format === 'rmap') {
    const disco = buildDiSCO(state);
    yield call(submitToRMap, disco, state.export.formats.rmap.apiUrl);
  }
}
```

### HTML export structure

```html
<!DOCTYPE html>
<html>
<head>
  <title>Research Session - [session description]</title>
  <style>/* researchFindingExport.css embedded */</style>
</head>
<body>
  <header>
    <h1>[Session description]</h1>
    <p>Started: [timestamp] | Actions: [count]</p>
  </header>
  <main>
    <ol class="action-list">
      <li>
        <time>[timestamp]</time>
        <h3>[label]</h3>
        <p>[description]</p>
        <details><summary>Context</summary>
          <code>[manifest/canvas URIs]</code>
        </details>
      </li>
      ...
    </ol>
  </main>
  <!-- Optional: embedded state snapshot for resumability -->
  <script type="application/json" id="mirador-state">
    { ... serialized Mirador state ... }
  </script>
</body>
</html>
```

The embedded state snapshot (~15–25 KB JSON) enables a future "resume session" feature: load the HTML export, extract the JSON, and pass it to `Mirador.viewer(config, { store: rehydratedStore })`.

### RMap DiSCO structure

The DiSCO represents the research session as a linked set of IIIF resources:

```json
{
  "@context": "https://rmap-project.atlassian.net/...",
  "@type": "disco:DiSCO",
  "dcterms:creator": "[researcher]",
  "dcterms:description": "[session description]",
  "ore:aggregates": [
    { "@id": "[manifest URI]", "dcterms:description": "[action label]" },
    { "@id": "[canvas URI]", "dcterms:description": "[action label]" }
  ]
}
```

## Configuration

```js
{
  researchFinding: {
    enabled: true,
    trackedActions: ['navigate', 'search', 'openManifest', 'viewAnnotation'],
    collapseSequentialNavigations: true,
    collapseThresholdMs: 2000,        // Collapse navigations within 2s
    urlFragment: {
      enabled: true
    },
    export: {
      html: {
        enabled: true,
        includeStateSnapshot: true,
        cssUrl: null                   // Use bundled CSS if null
      },
      rmap: {
        enabled: true,
        apiUrl: 'https://rmap-hub.example.org/api/discos'
      }
    }
  }
}
```

## UI behavior

### Action list panel

1. User clicks the "Research" button in the workspace control panel to open the action list.
2. The panel displays a scrollable list of tracked actions in chronological order.
3. Each entry shows: timestamp, auto-generated label, and optional user description.
4. User can click an entry's label or description to edit inline.
5. User can delete entries via a remove button on each entry.
6. A text area at the top allows editing the overall session description.
7. At the bottom: export buttons for enabled formats (HTML, RMap).
8. For long sessions, actions can be filtered/grouped:
   - Group by manifest
   - Collapse sequential page turns
   - Filter by action type

### Export flow

1. User clicks "Export" and selects format.
2. For HTML: file is generated and downloaded immediately (no server roundtrip).
3. For RMap: a confirmation dialog shows the DiSCO preview, then submits to the API on confirm. Success/failure feedback displayed.

### URL fragment

- As the user navigates, the URL fragment updates silently (replaceState for minor changes, pushState for significant ones like opening a new manifest).
- Browser back/forward restores the approximate viewer state (manifest + canvas).
- Fragment is minimal and human-readable for shareability.

## Data growth expectations

| Session type | Tracked actions | Action list size | Full export (HTML + snapshot) |
|---|---|---|---|
| Quick browse (15 min) | 20–50 | 8–20 KB | ~30–50 KB |
| Moderate research (1–2 hr) | 100–300 | 40–120 KB | ~70–150 KB |
| Deep research (full day) | 500–1500 | 200–600 KB | ~250–650 KB |
| Extreme/extended | 2000+ | 800 KB–1.5 MB | ~850 KB–1.6 MB |

The Mirador state snapshot adds a fixed ~15–25 KB regardless of session length. All sizes are well within browser memory and download limits.

## Interaction with other plugins

- **Plugin 1 (Collection Browser):** Saga observes collection browsing actions to track them.
- **Plugin 2 (Advanced Search):** Saga observes search execution actions.
- **Plugin 3 (Annotations):** Saga observes annotation view actions (requires Plugin 3 to dispatch a trackable action type).
- **Plugin 4 (Window Chrome):** Home button clicks could optionally be tracked as "returned to collection."

All observation is passive (takeEvery on action types). No coupling — if a plugin isn't installed, those action types simply never fire and nothing is tracked for that category.

## Resumability feature (augmentation)

The embedded Mirador state snapshot in the HTML export enables future resumability:

1. User opens a previously exported HTML file.
2. A "Resume in Mirador" link/button is present in the HTML.
3. Clicking it navigates to the Mirador instance with the state JSON as a URL parameter or passed via postMessage.
4. The Mirador instance rehydrates from the snapshot: windows, canvas positions, companion window states all restored.

This is additive and does not replace the tracked action list. The action list is the human-readable scholarly record; the state snapshot is the machine-readable session restoration data.

**Implementation note:** Resumability requires a hosted Mirador instance to receive the state. The HTML export alone cannot spin up Mirador — it would need to link to a deployed viewer URL that accepts state import.

## Isolation constraint

This plugin must remain fully isolated from the Mirador base codebase. See the [codebase isolation policy](./README.md#codebase-isolation) in the overview spec. In particular:

- Import only from Mirador's public exports (selectors like `getExportableState`, action type constants for observation).
- Do not modify Mirador's reducers, sagas, or state shape. This plugin observes Mirador actions passively via `takeEvery` in its own saga; it does not intercept or alter them.
- The plugin must be extractable to a standalone package at any time with zero Mirador source changes.

## Risks and open questions

- **Action type stability:** This plugin depends on specific Redux action type strings from Mirador core (`mirador/SET_CANVAS`, etc.) and from other plugins. If action types change across versions, the saga breaks silently (no crash, just no tracking). Pin to known action types and test on upgrade.
- **localStorage augmentation:** The spec currently says no persistence across refreshes. Adding localStorage auto-save is straightforward (saga writes on every state change, reads on init) but introduces questions about stale sessions, storage limits, and multi-tab conflicts. Consider as a follow-up.
- **RMap API availability:** The RMap project's API may have availability or authentication requirements. The export should handle network failures gracefully and allow retry.
- **Privacy/consent:** Tracking all user actions could raise privacy concerns in some deployment contexts. The `enabled` config flag and per-action-type configuration address this, but consider whether explicit user opt-in UI is needed.
- **Action list UX at scale:** A 1000+ entry list is unwieldy to review manually. The grouping/collapsing UI is important for usability. Consider whether a "summary view" (grouped by manifest, showing only key actions) should be the default display.
- **URL fragment conflicts:** If the hosting page uses hash routing for other purposes, fragment sync could conflict. Make it opt-out via config.

## Complexity estimate

**High.** Multiple concerns (observation saga, URL sync, export generation, RMap integration, editable UI) in a single plugin. Each concern is individually straightforward but the combination requires careful state management and testing. Recommend implementing in phases: tracking + UI first, then HTML export, then URL fragment, then RMap.

# Plugin: Annotations & Book Description

## Summary

Adds two custom companion window panels to Mirador 4: one for displaying IIIF annotation lists as interactive HTML content, and one for rendering TEI/XML book descriptions. Includes sidebar buttons to open each panel and interactive behaviors on rendered content (internal navigation, triggering searches, filtering by annotation type).

## Motivation

- The original Mirador 2 viewer had a custom annotation tab that rendered full-canvas annotation content as HTML — distinct from Mirador's built-in annotation display which focuses on highlighting regions on the canvas.
- Our annotations contain rich scholarly text (transcriptions, marginalia commentary) with interactive elements: internal references that navigate between canvases, searchable terms that trigger queries, and type-based filtering.
- Book descriptions are provided as TEI/XML documents at `manifest.related` and need custom rendering with dedicated CSS. Mirador 4 has no built-in mechanism for this.
- The "Reader" field (identifying who annotated a page) was surfaced per-canvas in the original viewer and needs to be preserved.

## Scope

### In scope

- Custom annotation companion window panel
  - Fetches annotation lists from `canvas.otherContent` URIs
  - Renders annotation text content as sanitized HTML
  - Displays "Reader" field from annotation list metadata
  - Interactive elements:
    - `.internal-ref` links navigate to referenced canvases within the manifest
    - `.searchable` elements trigger a search (via Plugin 2) for that term
  - Filter annotations by type (annotation types defined within the annotation lists)
  - Updates when canvas changes (shows annotations for current canvas)
- Custom book description companion window panel
  - Fetches TEI/XML from `manifest.related` (where `format: 'application/xml'`)
  - Transforms XML to HTML for display
  - Applies scoped TEI CSS for rendering
- Sidebar buttons for both panels added to `WindowSideBarButtons`

### Out of scope

- Canvas-region annotation overlays (Mirador 4 handles these natively)
- Search execution logic (delegated to Plugin 2 via dispatched actions)
- Annotation creation or editing
- Persisting annotation state across sessions

## Architecture

### Plugin type

- **Companion windows:**
  - `companionWindowKey: 'jhuAnnotations'` — annotation display panel
  - `companionWindowKey: 'bookDescription'` — TEI book description panel
- **Add-mode plugins:**
  - Target `WindowSideBarButtons` — two buttons to open each panel

### Plugin definition (grouped)

Since these panels are closely related (both are per-window scholarly content displays), they should be registered as a single grouped plugin array:

```js
export default [
  annotationPanelPlugin,
  annotationButtonPlugin,
  bookDescriptionPanelPlugin,
  bookDescriptionButtonPlugin
];
```

### State

Custom reducer (`scholarlyContent`) managing per-window panel state:

```
{
  [windowId]: {
    annotations: {
      [canvasId]: {
        lists: [{
          id: string,
          reader: string | null,
          annotations: [{
            id: string,
            type: string,
            content: string,        // HTML content
            motivation: string
          }]
        }],
        isFetching: boolean,
        error: string | null
      }
    },
    activeTypeFilter: string | null,  // null = show all
    availableTypes: string[],
    bookDescription: {
      html: string | null,
      isFetching: boolean,
      error: string | null
    }
  }
}
```

### Saga

- On annotation panel open (or canvas change while panel is open): fetch annotation lists from `canvas.otherContent` URIs. Parse annotations, extract reader metadata, store in state.
- On book description panel open: fetch TEI/XML from `manifest.related`, transform to HTML, store.
- On internal-ref click: resolve the target canvas URI within the current manifest, dispatch `setCanvas` to navigate.
- On searchable click: dispatch `SEARCH_TERM_REQUESTED` with the clicked term and `scope: 'all'`. Plugin 2's saga picks this up to open the search panel, set cross-collection scope, and execute the search — allowing the researcher to find the term across all available material without leaving their current view.

### Annotation list fetching

Mirador 4's `MiradorCanvas` already exposes `annotationListUris` which parses `otherContent` entries (both string URIs and objects with `@type: 'sc:AnnotationList'`). The plugin can reuse this logic or access the raw canvas JSON from state.

Fetch flow:
1. Get current canvas ID from window state
2. Get canvas JSON → extract `otherContent` URIs
3. Fetch each annotation list URI
4. Parse annotations, extract `reader` from list-level metadata
5. Store parsed annotations keyed by canvas ID (cache for revisited canvases)

### TEI/XML rendering

1. Fetch XML from `manifest.related[].@id` where `format === 'application/xml'`
2. Transform to HTML (XSLT or simple DOM manipulation — TBD based on TEI complexity)
3. Sanitize with DOMPurify (already a Mirador dependency)
4. Render in a scoped container with TEI CSS applied

CSS scoping approach:
- Use a CSS class prefix (e.g. `.tei-content`) on the container
- All TEI CSS rules scoped under that class to prevent bleed
- TEI stylesheet loaded as part of the plugin bundle

## Configuration

```js
{
  scholarlyContent: {
    annotations: {
      enabled: true,
      readerField: 'reader',           // Metadata key for reader identification
      interactiveClasses: {
        internalRef: 'internal-ref',   // CSS class triggering navigation
        searchable: 'searchable'       // CSS class triggering search
      },
      typeFilterEnabled: true
    },
    bookDescription: {
      enabled: true,
      relatedFormat: 'application/xml', // Format to match in manifest.related
      cssPath: null                     // Optional external CSS URL; uses bundled default if null
    }
  }
}
```

## UI behavior

### Annotation panel

1. User clicks the annotation icon in the sidebar to open the panel.
2. Panel displays annotations for the current canvas, grouped by annotation list.
3. If a "Reader" field is present on the annotation list, it's displayed as a header (e.g. "Reader: Gabriel Harvey").
4. Annotation content is rendered as HTML. Interactive elements are styled distinctly:
   - Internal references appear as links (underlined, pointer cursor)
   - Searchable terms appear highlighted or with a subtle indicator
5. Type filter dropdown/chips at the top of the panel allow narrowing to specific annotation types.
6. When the user navigates to a different canvas, the panel updates (fetching if needed, using cache if available).
7. Clicking an internal reference navigates to the target canvas without closing the panel.
8. Clicking a searchable term opens Plugin 2's advanced search panel (if not already open) with that term pre-filled.

### Book description panel

1. User clicks the book icon in the sidebar to open the panel.
2. Panel fetches and renders the TEI document as styled HTML.
3. Content is scrollable within the companion window.
4. If no `manifest.related` with XML format exists, the button is hidden or the panel shows an "unavailable" message.

## Interaction with other plugins

- **Plugin 2 (Advanced Search):** This plugin dispatches `SEARCH_TERM_REQUESTED` with `{ term, scope: 'all', windowId }` when a `.searchable` element is clicked. Plugin 2's saga handles this by opening the search companion window (if not already open), setting scope to cross-collection, pre-filling the term, and executing the search. The researcher sees results from all available collections without navigating away from their current manuscript view.
- **Plugin 4 (Window Chrome):** Independent. Both operate on window-level targets but don't conflict.
- **Plugin 5 (Research Finding):** The research finding saga can observe annotation panel interactions (canvas navigations from internal-ref clicks, search triggers) as trackable research actions.

## Isolation constraint

This plugin must remain fully isolated from the Mirador base codebase. See the [codebase isolation policy](./README.md#codebase-isolation) in the overview spec. In particular:

- Import only from Mirador's public exports (`mirador/src` — actions, selectors, lib utilities like `MiradorCanvas`).
- Do not modify Mirador's annotation reducers, companion window factory, or sidebar components. This plugin registers new companion windows and sidebar buttons via the plugin API.
- The plugin must be extractable to a standalone package at any time with zero Mirador source changes.

## Risks and open questions

- **Annotation list size:** Some canvases may have very large annotation lists. Consider virtualization or pagination within the panel for canvases with 50+ annotations.
- **HTML sanitization:** Annotation content is rendered as HTML. DOMPurify handles XSS prevention, but ensure the allowed tag/attribute set is permissive enough for scholarly content (e.g. `<sup>`, `<sub>`, `<span>` with classes).
- **TEI transformation complexity:** If the TEI documents are highly structured, a simple XSLT may not suffice. Evaluate whether a lightweight JS-based TEI-to-HTML library is needed, or if the existing server-side transform is adequate.
- **Canvas navigation from internal-ref:** The target canvas URI must resolve to a canvas within the current manifest. Cross-manifest references would require opening a new window — determine if this is a requirement.
- **Caching strategy:** Annotation lists are cached per canvas per window for the session. If annotations change server-side during a session, stale data will be shown. Acceptable for our use case.

## Complexity estimate

**Medium.** Two companion windows with straightforward fetch-and-render logic. The interactive behaviors add some complexity but are well-defined. The main engineering effort is in robust HTML rendering and the TEI transformation pipeline.

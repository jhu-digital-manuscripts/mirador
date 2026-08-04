# Plugin: Advanced Search

## Summary

Provides a per-window search sidebar that integrates with the JHU search service (and future OpenSearch) to support advanced querying both within the current manifest and across collections. Features include boolean multi-term search, category-scoped terms, configurable search scope (current manifest, a specific collection, or all collections), sort options, paged results, and the ability to open results in the current or a new window slot.

The cross-collection capability allows researchers to conduct complex searches without leaving their current work context (no need to navigate back to the WorkspaceAdd panel). It also enables patterns like click-to-search from the annotation display (Plugin 3), where a researcher can search across all available material for a term found in an annotation.

## Motivation

- Mirador 4's built-in search panel implements basic IIIF Content Search (single query string, no advanced operators). Our manuscripts require multi-term boolean search scoped to categories defined by the search service.
- The original Mirador 2 viewer used a shared search component across the landing page and per-window views. That shared component could search across collections or within a single manifest from anywhere in the UI.
- Researchers need to sort results by relevance or page order, page through large result sets, and quickly navigate to or compare results across windows.
- A researcher reading an annotation may encounter a term they want to search across all collections — forcing them to navigate to the landing page and lose their place is disruptive. The per-window search must support this workflow directly.

## Scope

### In scope

- Advanced search UI in a companion window panel (per-window)
- Boolean search with configurable operators (AND, OR, NOT)
- Multiple search terms that users can add/remove freely
- Each term scoped to a search category defined by the search service configuration
- **Configurable search scope:**
  - Current manifest (default when panel is opened manually)
  - A specific collection (user-selectable from loaded collections)
  - All collections (broadest scope)
- Sort results by: relevance, page order
- Paged result display
- Clicking a result navigates to that canvas in the current window (if same manifest) or opens the target manifest
- Option to open a result in a new window slot
- Search service configuration fetched at panel open (categories, available operators)
- Defaults to the search service associated with the window's manifest (`manifest.service`), but can target collection-level or global services
- Pre-population of search terms from external triggers (e.g. Plugin 3's click-to-search dispatches a term with cross-collection scope)

### Out of scope

- Collection browsing/faceted filtering of the manifest list (Plugin 1's concern)
- Annotation display from search results (Plugin 3 handles annotation rendering)
- Interaction with research finding tracking (Plugin 5 independently observes search actions)

## Architecture

### Plugin type

- **Companion window:** `companionWindowKey: 'advancedSearch'`
- **Additional:** Add-mode plugin on `WindowSideBarButtons` for the panel toggle button

### State

Custom reducer (`advancedSearch`) managing per-window search state:

```
{
  [windowId]: {
    serviceConfig: {
      categories: [{ id: string, label: string }],
      operators: string[],
      isFetching: boolean,
      error: string | null
    },
    scope: {
      type: 'manifest' | 'collection' | 'all',
      targetId: string | null    // manifestId or collectionId; null when type='all'
    },
    terms: [{
      id: string,
      value: string,
      category: string | null,   // null = all fields
      operator: 'AND' | 'OR' | 'NOT'
    }],
    sort: 'relevance' | 'pageOrder',
    results: {
      items: [{
        manifestId: string,      // Which manifest this result belongs to
        canvasId: string,
        label: string,
        snippet: string,
        score: number | null,
        collectionId: string | null  // Parent collection, if cross-collection search
      }],
      total: number,
      page: number,
      pageSize: number
    },
    isSearching: boolean,
    error: string | null
  }
}
```

### Saga

- On companion window open: fetch search service config from `manifest.service` (or collection/global service depending on scope) to populate categories and available operators.
- On scope change: re-fetch service config if the target service differs (collection-level services may offer different categories than manifest-level ones).
- On search submit: build query from terms array, call search service with the appropriate scope, store paginated results.
- On page change: fetch next/previous page of results.
- On result click (same manifest): dispatch `setCanvas` to navigate within the current window.
- On result click (different manifest): dispatch `addWindow` with the target manifest and canvas.
- On external trigger (`SEARCH_TERM_REQUESTED` from Plugin 3): set scope to the requested level (typically 'all' for cross-collection), populate the term, and execute the search automatically.

### Search service integration

Shares the same adapter interface as Plugin 1:

```js
interface SearchAdapter {
  getConfig(serviceUrl): Promise<SearchServiceConfig>
  search(serviceUrl, query, options): Promise<SearchResults>
}
```

The `options` parameter includes scope information:

```js
options: {
  scope: 'manifest' | 'collection' | 'all',
  targetId: string | null,       // Manifest or collection URI to scope to
  facets: Object | null,         // For Plugin 1's faceted search
  sort: 'relevance' | 'pageOrder',
  page: number,
  pageSize: number
}
```

The adapter resolves which service endpoint to call based on scope:
- `scope: 'manifest'` → the manifest's search service
- `scope: 'collection'` → the collection's search service
- `scope: 'all'` → a configured global/root search endpoint

This unified adapter means the same infrastructure supports Plugin 1's collection-level faceted search and Plugin 2's cross-scope advanced search.

## Configuration

```js
{
  advancedSearch: {
    enabled: true,
    defaultSort: 'relevance',
    defaultScope: 'manifest',          // Default scope when panel opens manually
    pageSize: 20,
    serviceAdapter: 'jhu',             // matches Plugin 1's adapter key
    globalSearchServiceUrl: null,      // Endpoint for scope='all' searches
    allowOpenInNewWindow: true,
    allowCrossCollectionSearch: true    // Enable the scope selector UI
  }
}
```

## UI behavior

1. User clicks the search icon in the window sidebar to open the advanced search panel.
2. Panel fetches the search service config for the current scope and displays available categories.
3. **Scope selector** at the top of the panel allows switching between:
   - "This manuscript" (current manifest)
   - A specific collection (dropdown of loaded collections from Plugin 1's state)
   - "All collections" (global search)
4. User adds one or more search terms, each optionally scoped to a category and joined by a boolean operator.
5. User can add/remove terms freely. At least one term is required to submit.
6. Results display below with snippet context. For cross-collection results, results are grouped or labeled by manifest/collection.
7. Sort toggle and paging controls available.
8. Clicking a result:
   - If the result is in the current manifest: navigates to that canvas in the current window.
   - If the result is in a different manifest: opens that manifest in a new window at the target canvas.
9. **When triggered externally** (e.g. click-to-search from annotations): the panel opens with the term pre-filled, scope set to "All collections", and search executes automatically. The researcher stays in their current window and sees cross-collection results without navigating away.

## Interaction with other plugins

- **Plugin 1 (Collection Browser):** This plugin reads from Plugin 1's state to populate the collection scope selector (list of loaded collections with their search service URLs). The shared search adapter handles the actual service calls for both plugins.
- **Plugin 3 (Annotations):** The annotations panel dispatches `SEARCH_TERM_REQUESTED` with a term value and a requested scope (typically `'all'`). This plugin's saga handles the action by opening the search panel (if not already open), setting the scope, populating the term, and executing the search. This is the primary mechanism for click-to-search from annotations.
- **Plugin 5 (Research Finding):** The research finding saga independently observes search actions dispatched by this plugin to log them in the tracked action list. Cross-collection searches are particularly valuable research events to track.

## Shared code with Plugin 1

The search service adapter (client, response parsing, error handling) should live in a shared utility module importable by both plugins. This keeps the service abstraction DRY and ensures a future migration to OpenSearch only requires changes in one place.

Recommended structure:

```
src/
  plugins/
    shared/
      searchAdapter.js          // Adapter interface + factory
      adapters/
        jhuSearchAdapter.js     // Current JHU service implementation
        openSearchAdapter.js    // Future implementation
    collection-browser/
      ...
    advanced-search/
      ...
```

## Isolation constraint

This plugin must remain fully isolated from the Mirador base codebase. See the [codebase isolation policy](./README.md#codebase-isolation) in the overview spec. In particular:

- Import only from Mirador's public exports (`mirador/src` — actions, selectors, components).
- Do not modify Mirador's built-in SearchPanel or search saga. This plugin registers its own companion window alongside (not replacing) the built-in search.
- Depends on Mirador action types for result navigation (`setCanvas`, `addWindow`). Document these dependencies for upgrade verification.
- The plugin must be extractable to a standalone package at any time with zero Mirador source changes.

## Risks and open questions

- **Search service per manifest:** Not all manifests may advertise a search service. The plugin should hide the sidebar button or show a "no search available" state when `manifest.service` lacks a search endpoint.
- **Category drift:** If the search service changes its category definitions, previously saved/shared searches may reference invalid categories. Consider graceful handling (ignore unknown categories, show a warning).
- **Result freshness:** If annotations or indexing changes server-side, cached results may be stale. No local caching of results beyond the current session.
- **Performance with many terms:** Boolean queries with 5+ terms may be slow depending on the search service. Consider a loading state and possibly a term limit in config.

## Complexity estimate

**Medium–high.** The UI is more complex than a basic search panel, but the architecture is straightforward: one companion window, one reducer, one saga, and a shared adapter.

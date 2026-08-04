# Plugin: Collection Browser & Search

## Summary

Replaces the default Mirador 4 `WorkspaceAdd` panel with a collection-driven browsing and search experience. Manifests are displayed using data already present in IIIF collections (thumbnails, labels, metadata) without fetching individual manifests until a user explicitly opens one. Integrates a search service (currently JHU custom, future OpenSearch) to filter and navigate collections and manifests.

## Motivation

- The default `WorkspaceAdd` triggers a full manifest fetch for every catalog entry just to display a title and thumbnail. Our IIIF collections already provide this data inline, so hundreds of unnecessary network requests are made on load.
- The original Mirador 2 viewer had a "landing page" driven entirely by collection data. This plugin recreates that experience in Mirador 4's plugin architecture.
- Collection-level search with facets was a core feature of the previous viewer and has no equivalent in Mirador 4's built-in (manifest-level) search.

## Scope

### In scope

- Rendering the manifest/collection list from parsed collection JSON (no individual manifest fetches)
- Displaying per-manifest thumbnails from the collection's `thumbnails` array
- Displaying per-manifest metadata (e.g. repository, reader) from `collection.manifests[].metadata`
- Custom icons per manifest based on metadata fields (e.g. `metadata.reader`)
- Configurable thumbnail count per manifest entry
- Label customization ("## images" instead of "## items")
- Lazy-loading manifests only on user click (opening a window)
- Collection-level search via configurable search service
- Faceted search with facets defined by the search service
- Facet selection/clearing to narrow the displayed list
- Search results that can match collections or manifests
- Ability to choose which loaded collection to search against
- Navigating into sub-collections from search results

### Out of scope

- Advanced boolean/multi-term search (handled by Plugin 2: Advanced Search)
- Cross-collection search from within a window (handled by Plugin 2 — researchers can search across collections without navigating back to this panel)
- Annotations, TEI display, research tracking

## Architecture

### Plugin type

- **Mode:** `wrap`
- **Target:** `WorkspaceAdd`
- **Additional components:** Add-mode plugins for any supplementary UI if needed

### State

Custom reducer (`collectionBrowser`) managing:

```
{
  collections: {
    [collectionId]: {
      json: Object,           // Raw collection JSON
      members: [{             // Parsed member data (no manifest fetch needed)
        id: string,           // Manifest or collection URI
        type: 'manifest' | 'collection',
        label: string,
        thumbnails: string[],
        metadata: Object,
        reader: string | null
      }],
      isFetching: boolean,
      error: string | null
    }
  },
  activeCollectionId: string | null,
  search: {
    query: string,
    facets: { [facetName]: string[] },   // Selected facet values
    availableFacets: Object,             // From search service config
    results: Object[],
    paging: { page: number, totalPages: number },
    isSearching: boolean
  },
  config: {
    searchServiceUrl: string | null,
    maxThumbnails: number,
    showMetadataFields: string[]
  }
}
```

### Saga

- On init: fetch and parse the configured IIIF collection(s). Extract member data (labels, thumbnails, metadata) and store without triggering individual manifest fetches.
- On search: query the search service, update results, derive available facets from service config.
- On facet change: re-query or client-side filter depending on service capabilities.
- On manifest open: dispatch Mirador's `addWindow({ manifestId })` action, which triggers the standard manifest fetch flow.

### Search service integration

The search service client should be abstracted behind an adapter interface:

```js
interface SearchAdapter {
  getConfig(serviceUrl): Promise<SearchServiceConfig>
  search(serviceUrl, query, facets, options): Promise<SearchResults>
}
```

This allows swapping from the JHU custom service to OpenSearch in the future without changing plugin logic.

## Configuration

```js
{
  collectionBrowser: {
    collections: ['https://example.org/iiif/collection/top'],
    searchService: {
      url: 'https://example.org/search',
      adapter: 'jhu'  // or 'opensearch' in future
    },
    maxThumbnailsPerEntry: 3,
    metadataFields: ['repository', 'reader'],
    readerIconMapping: {
      'Gabriel Harvey': '/icons/harvey.png',
      'John Dee': '/icons/dee.png'
    },
    itemLabel: 'images'  // replaces "items" in count display
  }
}
```

## UI behavior

1. On load, the plugin renders the collection member list using inline collection data. No manifest fetches.
2. Search input and facet panel are displayed above or alongside the list.
3. When search is active, results replace or filter the list. Collection-level results can be "drilled into."
4. Clicking a manifest entry dispatches `addWindow` and closes the panel (standard Mirador behavior).
5. A "clear search / show all" action resets to the full collection view.

## Extension points for other plugins

- Plugin 2 (Advanced Search) reads from this plugin's state to populate its collection scope selector (list of loaded collections and their search service URLs). Plugin 2 handles all advanced and cross-collection search; this plugin exposes the collection data it needs.
- Plugin 2 may also dispatch actions to open a manifest from cross-collection search results. This works through the standard `addWindow` flow.
- Plugin 5 (Research Finding) may track which manifests were opened from the browser.

## Isolation constraint

This plugin must remain fully isolated from the Mirador base codebase. See the [codebase isolation policy](./README.md#codebase-isolation) in the overview spec. In particular:

- Import only from Mirador's public exports (`mirador/src` — actions, selectors, components).
- Do not modify Mirador's catalog reducer, manifest fetching saga, or WorkspaceAdd component source. This plugin wraps WorkspaceAdd via the plugin API; it does not patch it.
- The plugin must be extractable to a standalone package at any time with zero Mirador source changes.

## Risks and open questions

- **Collection structure variability:** Collections may be nested or flat. The plugin needs to handle recursive collection browsing.
- **Search service availability:** If the search service is down or not configured, the plugin should degrade gracefully to a browse-only mode.
- **Large collections:** If a collection has thousands of members, the list needs virtualization (react-window or similar). Mirador already depends on react-window.
- **Manifest pre-fetch data:** What happens if collection members lack thumbnails? Fallback to placeholder, or trigger a manifest fetch for just those entries?

## Complexity estimate

**High.** This is the most architecturally significant plugin — it replaces a core panel and manages its own data lifecycle independent of Mirador's manifest store.

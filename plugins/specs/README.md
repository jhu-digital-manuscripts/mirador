# Mirador 4 Plugin Migration — Draft Specs

## Overview

This document provides a high-level map of the planned Mirador 4 plugins that will replace the customizations made to our Mirador 2 viewer. The original customizations are documented in [customizations.md](../customizations.md).

## Background

Mirador 4 has a fundamentally different extension model from Mirador 2. Where Mirador 2 required direct source modification (forking), Mirador 4 provides a plugin architecture that allows extension through composition:

- **Wrap mode** — wrap an existing component to modify or replace its rendering
- **Add mode** — inject new components alongside existing ones
- **Companion windows** — register entirely new sidebar panels
- **Custom reducers** — add new state slices to the Redux store
- **Custom sagas** — add background processes (data fetching, action observation, side effects)
- **Config merging** — provide default configuration that consumers can override

All customizations are implemented as plugins passed to the viewer at instantiation. No Mirador source modification is required.

## Plugin summary

| # | Plugin | Spec | Complexity | Has reducer | Has saga |
|---|--------|------|------------|-------------|----------|
| 1 | Collection Browser & Search | [spec](./plugin-collection-browser-search.md) | High | Yes | Yes |
| 2 | Advanced Search | [spec](./plugin-advanced-manifest-search.md) | Medium–High | Yes | Yes |
| 3 | Annotations & Book Description | [spec](./plugin-annotations-book-description.md) | Medium | Yes | Yes |
| 4 | Window Chrome | [spec](./plugin-window-chrome.md) | Low | No | No |
| 5 | Research Finding | [spec](./plugin-research-finding.md) | High | Yes | Yes |

Additionally, general look-and-feel changes (fonts, colors, branding) are handled through Mirador 4's native theme configuration with no plugin needed.

## Architecture diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Mirador 4 Core                                                 │
│                                                                 │
│  ┌───────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │ Redux Store   │  │ Saga Middle- │  │ React Component     │  │
│  │               │  │ ware         │  │ Tree                │  │
│  └───┬───────┬───┘  └──────┬───────┘  └──────────┬──────────┘  │
│      │       │              │                     │             │
└──────┼───────┼──────────────┼─────────────────────┼─────────────┘
       │       │              │                     │
  ┌────┴──┐ ┌──┴────┐  ┌─────┴─────┐  ┌────────────┴───────────┐
  │Plugin │ │Plugin  │  │Plugin     │  │Plugin components       │
  │reduc- │ │config  │  │sagas      │  │(wrap / add / companion)│
  │ers    │ │        │  │           │  │                        │
  └───────┘ └────────┘  └───────────┘  └────────────────────────┘
```

## Shared code

Plugins 1 and 2 share a **search service adapter** module:

```
plugins/
  shared/
    searchAdapter.js            # Adapter interface + factory
    adapters/
      jhuSearchAdapter.js       # Current JHU custom service
      openSearchAdapter.js      # Future implementation
```

This abstraction allows the search backend to change without modifying plugin logic. Both plugins import from the shared module but are otherwise independent.

## Plugin interactions

```
Plugin 1 (Collection Browser)
    │
    │ dispatches addWindow ──────────────────────► Mirador core
    │                                                   │
    │ exposes collection state ──► Plugin 2 (scope selector)
    │                                                   │
    │                                                   ▼
    │                              Plugin 5 (Research Finding) observes
    │
Plugin 2 (Advanced Search) ◄── SEARCH_TERM_REQUESTED ── Plugin 3 (Annotations)
    │                           (with scope='all')          │
    │ searches across collections or within manifest        │
    │ dispatches setCanvas / addWindow                      │
    │                                                       │
    ▼                                                       ▼
Plugin 5 observes search actions              Plugin 5 observes annotation views

Plugin 4 (Window Chrome)
    │
    │ Home button dispatches setWorkspaceAddVisibility
    │
    ▼
Plugin 1 renders (wraps WorkspaceAdd)
```

Key points:
- Plugin 2 handles all search (within-manifest, within-collection, and cross-collection) from the per-window sidebar. This means researchers never need to leave their work context to search broadly.
- Plugin 1 exposes its collection state (loaded collections and their service URLs) for Plugin 2's scope selector.
- Plugin 3 triggers cross-collection search via `SEARCH_TERM_REQUESTED` with `scope: 'all'`, which Plugin 2 handles by opening/populating the search panel.
- Plugin 5 passively observes actions from all other plugins (no coupling required — if a plugin isn't installed, those action types simply never fire).
- Plugin 4 communicates with Plugin 1 indirectly through Mirador's native `setWorkspaceAddVisibility` action.
- No plugin directly imports or depends on another plugin's code (Plugin 2 reads Plugin 1's state via selectors, not direct imports).

## Configuration structure

All plugin configuration is passed via the standard Mirador config object:

```js
Mirador.viewer({
  id: 'mirador',
  // Standard Mirador config...
  theme: { /* MUI theme overrides */ },
  selectedTheme: 'light',

  // Plugin configurations (merged via plugin.config):
  collectionBrowser: { /* Plugin 1 config */ },
  advancedSearch: { /* Plugin 2 config */ },
  scholarlyContent: { /* Plugin 3 config */ },
  windowChrome: { /* Plugin 4 config */ },
  researchFinding: { /* Plugin 5 config */ }
}, [
  collectionBrowserPlugin,
  advancedSearchPlugin,
  annotationsPlugin,
  windowChromePlugin,
  researchFindingPlugin
]);
```

## Implementation order recommendation

1. **Plugin 4 (Window Chrome)** — simplest, establishes plugin development patterns and build tooling
2. **Plugin 3 (Annotations & Book Description)** — medium complexity, companion window pattern reused by others
3. **Plugin 1 (Collection Browser & Search)** — high complexity but foundational to the user experience
4. **Plugin 2 (Advanced Manifest Search)** — depends on shared search adapter established by Plugin 1
5. **Plugin 5 (Research Finding)** — can be developed in parallel but benefits from other plugins being in place to observe their actions

Plugins 4 and 3 can be developed in parallel. Plugin 5 can begin development (tracking core Mirador actions) before other plugins are complete.

## Mirador 4 targets used

Complete list of Mirador component targets used across all plugins:

| Target | Plugin | Mode |
|--------|--------|------|
| `WorkspaceAdd` | 1 | wrap |
| `WindowSideBarButtons` | 2, 3 | add |
| `WindowTopBarTitle` | 4 | wrap |
| `WindowTopBarPluginArea` | 4 | add |
| `WorkspaceControlPanelButtons` | 5 | add |

Companion windows registered:

| Key | Plugin | Purpose |
|-----|--------|---------|
| `advancedSearch` | 2 | Multi-scope search panel (manifest, collection, or cross-collection) |
| `jhuAnnotations` | 3 | Annotation display |
| `bookDescription` | 3 | TEI/XML rendering |

## Codebase isolation

All plugin code must remain fully isolated from the Mirador base codebase. Plugins may import from Mirador's public API (actions, selectors, components, utilities exported via `mirador` or `mirador/src`) but must never modify, patch, or depend on Mirador internals that are not part of the published interface.

**Why this matters:** We have no control over the Mirador core repository. Our plugins will eventually be consumed against a published `mirador` npm package. The fact that plugin development happens inside a local clone of Mirador is solely to give tooling (including Kiro) access to the full Mirador source as context — it does not imply permission to modify that source or rely on implementation details that could change without notice.

**Rules for all plugins:**

1. **No Mirador source modifications.** Do not edit any file outside the plugin directories (and specs/config). The base Mirador code is read-only reference material.
2. **Import only from public exports.** Use `mirador/src` (actions, selectors, components, lib utilities) as documented in `package.json` exports. Do not deep-import from internal paths like `mirador/src/state/reducers/someInternal.js` unless it is explicitly exported.
3. **Depend on stable contracts.** Action type strings (`mirador/SET_CANVAS`, etc.), selector function signatures, and component target names (`withPlugins('ComponentName')`) are the plugin API surface. Document which ones each plugin depends on so they can be verified on Mirador upgrades.
4. **No monkey-patching.** Do not override prototypes, replace Redux middleware, or mutate Mirador's internal registries outside of the plugin registration API (`companionWindowKey`, `reducers`, `saga`, etc.).
5. **Plugins must be extractable.** At any point, the plugin directories should be movable to a separate repository and buildable against `mirador` as an npm dependency with zero changes to plugin source.

**Development structure within this repo:**

```
mirador/                        ← Mirador base (read-only, no modifications)
  src/
  __tests__/
  ...
  plugins/                      ← Our plugin code (fully owned)
    shared/
    collection-browser/
    advanced-search/
    annotations/
    window-chrome/
    research-finding/
  specs/                        ← These spec documents
```

The `plugins/` directory is ours. Everything else in the repo is upstream Mirador context.

## Open cross-cutting questions

1. **Monorepo vs. separate packages:** Should all plugins live in a single repository (monorepo with shared build) or be published as separate npm packages? Monorepo simplifies the shared search adapter and coordinated versioning.

2. **Testing strategy:** Each plugin should have unit tests for reducers/sagas and integration tests using Mirador's test utilities. The test fixtures in this repository (version-2 and version-3 manifests) can be reused.

3. **Mirador version pinning:** Plugins depend on specific internal action types and component target names. Pin to a specific Mirador 4.x minor version and test on upgrade.

4. **Build and distribution:** Plugins can be distributed as ES modules importable by the consuming application. No UMD bundle needed if the consumer uses a modern bundler.

5. **Accessibility:** All custom UI must meet WCAG 2.1 AA. Companion window panels inherit Mirador's accessibility patterns (keyboard navigation, ARIA labels). Custom rendering (TEI, annotations) needs manual review.

# Plugin: Window Chrome Customization

## Summary

Customizes the window title bar to display a reader logo alongside the book title and adds a "Home" button that returns the user to the collection browser. This is a thin presentation-layer plugin with no custom state management.

## Motivation

- The original Mirador 2 viewer displayed a logo identifying the primary "reader" (historical annotator) of each manuscript next to the book title. This provided immediate visual context for which annotated copy the researcher was viewing.
- A "Home" button was essential for navigating back to the manifest list without using browser navigation, particularly important for the single-page-app experience.
- These are small but high-visibility UX elements that researchers relied on.

## Scope

### In scope

- Display a reader logo/icon in the window title bar, derived from manifest metadata
- Configurable metadata field for reader identification
- Configurable mapping from reader names to logo image URLs
- "Home" button in the window title bar area that navigates back to the collection browser (WorkspaceAdd)
- Graceful handling when no reader metadata is present (no logo shown, no empty space)

### Out of scope

- Custom title text formatting beyond what Mirador already provides (manifest.label is shown natively)
- Modifying the workspace-level header or branding (use `config.theme` for that)
- Any state persistence or saga logic

## Architecture

### Plugin type

- **Wrap `WindowTopBarTitle`** — injects the reader logo alongside the existing title rendering
- **Add to `WindowTopBarPluginArea`** — adds the Home button

### Plugin definition (grouped)

```js
export default [
  readerLogoPlugin,
  homeButtonPlugin
];
```

### Reader logo plugin

```js
const readerLogoPlugin = {
  component: ReaderLogo,
  mapStateToProps,
  mode: 'wrap',
  target: 'WindowTopBarTitle'
};
```

The wrap component renders the reader logo before the `TargetComponent` (original title):

```jsx
function ReaderLogo({ TargetComponent, targetProps, readerLogo, readerName }) {
  return (
    <>
      {readerLogo && (
        <img
          src={readerLogo}
          alt={readerName || ''}
          style={{ height: '1.5rem', marginRight: '0.5rem', objectFit: 'contain' }}
        />
      )}
      <TargetComponent {...targetProps} />
    </>
  );
}
```

### Home button plugin

```js
const homeButtonPlugin = {
  component: HomeButton,
  mapDispatchToProps,
  mode: 'add',
  target: 'WindowTopBarPluginArea'
};
```

The button dispatches `setWorkspaceAddVisibility(true)` to show the collection browser panel.

### State access (mapStateToProps)

The reader logo plugin reads from the manifest's metadata to find the reader field:

```js
function mapStateToProps(state, { windowId }) {
  const manifestId = getWindowManifest(state, { windowId });
  const metadata = getManifestMetadata(state, { manifestId });
  const config = getConfig(state).windowChrome || {};

  const readerField = config.readerField || 'reader 1';
  const readerValue = findMetadataValue(metadata, readerField);
  const readerLogo = config.readerIconMapping?.[readerValue] || null;

  return {
    readerLogo,
    readerName: readerValue
  };
}
```

No custom reducer needed — all data comes from existing Mirador state (manifest metadata) and plugin configuration.

## Configuration

```js
{
  windowChrome: {
    readerField: 'reader 1',        // Metadata key to look up in manifest.metadata
    readerIconMapping: {            // Map reader names to logo URLs
      'Gabriel Harvey': '/assets/icons/harvey.png',
      'John Dee': '/assets/icons/dee.png'
    },
    showReaderLogo: true,           // Toggle logo display
    showHomeButton: true            // Toggle home button
  }
}
```

## UI behavior

### Reader logo

1. When a window loads a manifest, the plugin reads the configured metadata field from the manifest's metadata.
2. If a matching reader is found in the icon mapping, the logo is displayed to the left of the book title.
3. If no reader metadata exists or no mapping matches, nothing is rendered (no empty placeholder).
4. The logo scales to fit the title bar height (~1.5rem).

### Home button

1. An icon button (e.g. Home icon from MUI) appears in the window's top bar plugin area.
2. Clicking it shows the WorkspaceAdd panel (collection browser), equivalent to clicking the main "+" button.
3. Tooltip reads "Return to collection" or similar (translatable via i18n).

## Interaction with other plugins

- **Plugin 1 (Collection Browser):** The Home button navigates to Plugin 1's UI by toggling workspace add visibility. If Plugin 1 wraps WorkspaceAdd, it renders instead of the default.
- **Plugin 3 (Annotations):** The reader field displayed here may correspond to the same reader shown in annotation list headers. Both read from manifest metadata but independently.
- **No conflicts** with other plugins targeting `WindowTopBar` — this plugin targets `WindowTopBarTitle` (wrap) and `WindowTopBarPluginArea` (add), which are distinct slots.

## Isolation constraint

This plugin must remain fully isolated from the Mirador base codebase. See the [codebase isolation policy](./README.md#codebase-isolation) in the overview spec. In particular:

- Import only from Mirador's public exports (selectors like `getManifestMetadata`, actions like `setWorkspaceAddVisibility`).
- Do not modify `WindowTopBarTitle` or `WindowTopBarPluginArea` source. This plugin uses wrap and add modes through the plugin API.
- The plugin must be extractable to a standalone package at any time with zero Mirador source changes.

## Risks and open questions

- **Metadata field naming:** The reader field name may vary across collections (`reader 1`, `Reader`, `annotator`, etc.). The config makes this flexible, but it requires knowing the field name per collection. Could support an array of field names to try in order.
- **Logo availability:** If logo image URLs are broken or slow to load, the title bar shouldn't shift layout. Use fixed dimensions on the `<img>` element and a fallback (hide on error).
- **Multiple readers:** Some manifests may have multiple readers. Current spec shows only the primary one. Decide whether to show multiple logos or just the first match.
- **Home button vs. workspace state:** If the workspace is in mosaic mode with multiple windows, "Home" shows the add panel overlay. This is consistent with Mirador 4's existing behavior for the add button.

## Complexity estimate

**Low.** No custom state, no sagas, no companion windows. Two simple components reading from existing state and config.

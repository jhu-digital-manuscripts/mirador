Sample IIIF collection: [https://gist.github.com/jabrah/3fad65842a21ff2bd9080831352dca66](https://gist.github.com/jabrah/3fad65842a21ff2bd9080831352dca66)

* General look and feel changes such as font, colors, etc. Largely focused on the landing page

## Search Widget

* When a IIIF object is loaded into the landing page (collection) or a book/image view (manifest), the search widget looks for a search service at \<iiif\_obj\>.service. When it finds a search service, it requests the service’s configuration ([https://github.com/jhu-digital-manuscripts/rosa2/wiki/JH-IIIF-Search-Service](https://github.com/jhu-digital-manuscripts/rosa2/wiki/JH-IIIF-Search-Service)) to get the ball rolling.  
* Ability to choose between collections that have been loaded  
  * Defaults to whichever object is being focused. For example, in the sidebar of a page view, the default will be the search service for the appropriate manifest. In the landing page, the search service should default to the initial collection  
* Sort results by: relevance, page order  
* Basic search across the chosen collection  
* Advanced search:  
  * Boolean search with multiple search terms  
  * User can add/remove search terms freely  
  * Search terms limited to a search category defined by the search service  
* Search results display  
  * Paging  
  * Clicking result will open the given object  
  * User can open a search result in current or new slot

## Landing Page (Book/manifest list)

* All the data displayed here comes from a IIIF collection  
* Add search feature  
* Change icon that displays to the left of each manifest  
  * Bad hack that relies on the name given for each manifest.metadata.reader  
  * Manifests come from collection.manifests array  
* Change number of thumbnails displayed per book  
  * Make this configurable  
  * Each manifest in the collection has a set number of thumbnails that it can provide to the UI (manifest.thumbnails). The configuration can be used to limit the number of thumbnails further  
* Change labeling (“\#\# items” to “\#\# images”)  
* Lazy load thumbnails (not sure if this was a customization or part of base Mirador)  
* Lazy load manifests  
  * Display only data found in collection. Only load a manifest when the user clicks on the manifest to view it  
* Add ability to display extra metadata for each book. For example, we can show current repository for each book  
  * This information taken from the manifest’s metadata (collection.manifests\[\].metadata) found in our collection

### Landing Page Search

* Can be configured to be/not be used in the UI  
* Facets come from the IIIF object’s JHU Search Service  
* Add facet search  
  * Click button to clear selected facets  
  * Facets defined by search service  
  * Clicking on a facet will narrow displayed manifests to only those that match

## Header

* Change the title of the viewer seen in the header to “THE ARCHAEOLOGY OF READING”  
  * This is a client side configuration  
* Add “Export current research” button. This was an actual code change, not a user configuration  
* DLMM has a client side configuration “About the Viewer” button that links to an external page

### Manifest Views Titlebar

* Current book title (manifest.label)  
* Show logo for the book’s primary “reader” along with the title of the book  
  * Must be configurable  
  * (manifest.metadata\[‘reader 1’\]?)  
* Add “Home” button that will bring up the Manifest List

## Book Views Sidebar

* Add image rotation buttons to the viewer “HUD”  
  * Also needed to reset rotation when clicking the HUD reset button  
* Custom tab to display our annotations  
  * This tab is given a IIIF annotation list and displays the text content (as HTML)  
    * manifest.sequences\[\].canvases\[\].otherContent : this array contains references to the array lists associated with the canvas  
  * When we started using Mirador, it had no way to display annotations in the sidebar, or annotations that targeted the whole canvas  
  * The tab has custom hooks to act on user interaction with specially formatted elements  
    * Click to navigate to internal references (class=”internal-ref”)  
    * Click to search certain terms (class=”searchable”)  
    * Filter by annotation type  
  * When invoked, the tab can pick up a “reader” field from annotation list change events to provide the user with the name of the “Reader” on the displayed page  
* Custom “Book Description View”  
  * Accepts a blob of TEI XML from the backend and displays this as HTML  
    * When this exists, it is at manifest.related, with format: application/xml  
  * Relies on custom CSS to render in an OK way (tei.css)

## Metadata panel

* Explicitly hide “within” links  
  * Mirador originally had links to parent collections and things that served no purpose for us

## Research Finding

* Somewhat configurable  
  * Can elect to NOT have this feature  
  * Can selectively disable HTML or RMap exports  
* The research finding (export) button was already mentioned above  
* User actions tracked client side  
* User actions for tracked events update URL fragment in order to create a browser history entry  
* URL made somewhat parsable to recreate a partial viewer state  
* New UI to display list of user actions to the user  
  * User must be able to edit the label and create/edit a description for each entry in this list  
  * User must be able to remove entries from the list  
  * User can enter free form description of the list as a whole  
  * User can click to export to HTML or RMap  
    * HTML export has (researchFindingExport.css) to mostly recreate the look and feel of the export page if a user were to open the exported HTML document in a browser  
    * RMap export translates list of actions into a DiSCO, then uses the RMap API to send the data  
* Our implementation does not persist this list past refreshes or closing the browser

## Other features

* Custom history handling to restore browser state
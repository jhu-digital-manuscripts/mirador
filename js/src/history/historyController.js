(function ($) {
  $.HistoryController = function(options) {
    jQuery.extend(true, this, {
      eventEmitter: null,
      urlSlicer: null,
      historyList: [] // TODO Potentially use browser's local storage to hold history list so viewer state
                      // can be recreated when the browser buttons are used to navigate history?
    }, options);

    this.init();
  };

  $.HistoryController.prototype = {
    init: function () {
      this.bindEvents();
    },

    bindEvents: function() {
      var _this = this;

      /**
       * Fires when the "manifests panel" (book browser) is shown or hidden. "manifestPanelVisible"
       * is a boolean value describing the panel's visibility (true = visible)
       */
      _this.eventEmitter.subscribe('manifestsPanelVisible.set', function(event, manifestPanelVisible) {
        // console.log(' >> manifestsPanelVisible.set');
        // console.log(manifestPanelVisible);
      });

      /**
       * Fired every time a window changes, including when a new canvas is displayed, when the view
       * type changes (image view to book view for example). This seems to be a "catch-all" event
       * that captures all changes done to windows.
       * 
       * The following information _MAY_ be available in this event.
       * 
       * [viewType, canvasID, loadedManifest, slotAddress] all seem to be available together
       * 
       *  options: {
            id: "5fa67f8e-622c-4a49-b720-bc87ea45bb92",
            viewType: "ThumbnailsView",
            canvasID: "http://localhost:8080/iiif-pres/aorcollection.RCP7997/canvas/binding%20front%20cover",
            imageMode: "ImageView",
            loadedManifest: "http://localhost:8080/iiif-pres/aorcollection.RCP7997/manifest",
            slotAddress: "row1",
            bottomPanelVisible: true|false,
            sidePanelVisible: true|false,
            annotationsAvailable: {}, // Will ignore this...used for annotation authoring
          }
       */
      _this.eventEmitter.subscribe('windowUpdated', function(event, options) {
        
      });

      /**
       * Does not seem to be used in general. Better to use 'slotsUpdated'.
       * This event is used to spawn a new window.
       * 
       *  options: {
       *    appendTo: {}, // the Slot jQuery element that the window is attached
       *    canvasID: "", // If available
       *    eventEmitter: {}, // Why does it include the event emitter ...?
       *    id: "", // New window's ID
       *    manifest: {}, // The manifest object
       *    viewType: "", // ThumbnailsView, ImageView, BookView
       *  }
       */
      // _this.eventEmitter.subscribe('ADD_WINDOW', function (event, options) {
      //   console.log(' >> HISTORY ADD_WINDOW');
      //   moo6 = options;
      // });

      // _this.eventEmitter.subscribe("imageBoundsUpdated", function(event, options) {
      //   console.log(' >> HISTORY imageBoundsUpdated');
      // });

      // _this.eventEmitter.subscribe('ANNOTATIONS_LIST_UPDATED', function(event, options) {
      //   console.log(' >> HISTORY ANNOTATIONS_LIST_UPDATED');
      // });

      /**
       *  options: {
       *    windowId: "", // ID of window
       *    element: {}, // the jQuery window element
       *  }
       */
      _this.eventEmitter.subscribe('WINDOW_ELEMENT_UPDATED', function(event, options) {
        
      });

      _this.eventEmitter.subscribe('windowSlotAddressUpdated', function(event, options) {
        
      });

      // _this.eventEmitter.subscribe('manifestQueued', function(event, manifestObject, repository) {
      //   console.log(' >> HISTORY manifestQueued');
      // });

      // _this.eventEmitter.subscribe("manifestReferenced", function(event, manifestObject, repository) {
      //   console.log(' >> HISTORY manifestReferenced');
      // });

      // _this.eventEmitter.subscribe("collectionQueued", function(event, colObj, location) {
      //   console.log(' >> HISTORY collectionQueued');
      // });

      /**
       *  options: {
       *    "slots": [
       *      {}, // $.Slot
       *    ]
       *  }
       */
      _this.eventEmitter.subscribe("slotsUpdated", function(event, options) {
        
      });

      /**
       *  layoutDescription: 
            "type": "row",
            "depth": 0,
            "value": 0,
            "x": 3,
            "y": 3,
            "dx": 2481,
            "dy": 873,
            "address": "row1",
            "id": "fc06f74b-d2ef-4f2d-9bd2-2c66a0232543"
          }
       */
      _this.eventEmitter.subscribe("layoutChanged", function(event, layoutDescription) {
        
      });

      _this.eventEmitter.subscribe("windowSlotAdded", function(event, options) {
        
      });

      _this.eventEmitter.subscribe("windowsRemoved", function(event) {
        
      });

      _this.eventEmitter.subscribe("windowRemoved", function(event, windowID) {
        
      });

      /**
       * In terms of the UI context, the 'advanced' property always takes precedence over 'basic.'
       * When 'advanced' is defined, always show the advanced search widget, no matter the value 
       * of 'basic.'
       * 
       * @param data {
       *    origin: '', // window ID for source. NULL or UNDEFINED if source is manifests panel
       *    query: '', // search query executed
       *    maxPerPage: -1, // (OPTIONAL) Integer, page size. 
       *    offset: -1, // (OPTIONAL) Integer, start index for results
       *    sortOrder: (OPTIONAL) ('relevance'|'index'), 
       *    service: '', // URI of search service
       *    ui: {
       *      advanced: {
       *        rows: [{
       *          row: 0, // index (redundant)
       *          category: '', // search category, must be found in search service config
       *          operation: 'and'|'or', 
       *          term: '', // The search term
       *          type: 'input'|'select', // UI element type - freeform text input, or enumerated dropdown
       *        }]
       *      },
       *      basic: '', // A basic search term
       *    }
       * }
       */
      _this.eventEmitter.subscribe('SEARCH', function (event, data) {
        
      });

      _this.eventEmitter.subscribe('GET_FACETS', function (event, data) {
        
      });

      /**
       *  data: {
       *    "origin": "id of originating component",
       *    "canvasId": "IIIF-canvas-URI",
       *    "manifest": {} // Manifest object
       *  }
       */
      _this.eventEmitter.subscribe('CANVAS_ID_UPDATED', function (event, data) {
        
      });

      /**
       * data: {
       *    "windowId":"f51774c0-97ec-4881-8d87-2362756155aa",
       *    "tabId":"searchTab",
       *    "tabIndex":1
       * }
       */
      _this.eventEmitter.subscribe('TAB_SELECTED', function (event, data) { 
        
      });
    },

    addHistory: function(event) {

    },

    /**
     * @param {string} url
     */
    handleUrls: function (url) {
      // TODO respond to changes in browser location such as browser back button
    }
  };
}(Mirador));
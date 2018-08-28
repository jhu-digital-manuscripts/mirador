(function ($) {
  $.HistoryController = function(options) {
    jQuery.extend(true, this, {
      eventEmitter: null
    }, options);

    this.init();
  };

  $.HistoryController.prototype = {
    init: function () {
      console.log(' >> This is a history MOOOO ');
      this.bindEvents();
    },

    bindEvents: function() {
      var _this = this;

      /**
       * Fires when the "manifests panel" (book browser) is shown or hidden. "manifestPanelVisible"
       * is a boolean value describing the panel's visibility (true = visible)
       */
      _this.eventEmitter.subscribe('manifestsPanelVisible.set', function(event, manifestPanelVisible) {
        console.log(' >> HISTORY manifestsPanelVisible.set');
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
        console.log(' >> HISTORY windowUpdated');
        moo1 = options;
        console.log(' ## ' + JSON.stringify(options, null, 2));
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
        console.log(' >> HISTORY WINDOW_ELEMENT_UPDATED');
        moo2 = options;
      });

      _this.eventEmitter.subscribe('windowSlotAddressUpdated', function(event, options) {
        console.log(' >> HISTORY windowSlotAddressUpdated');
        moo3 = options;
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
        console.log(' >> HISTORY slotsUpdated');
        moo4 = options;
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
        console.log(' >> HISTORY layoutChanged');
        moo7 = layoutDescription;
      });

      _this.eventEmitter.subscribe("windowSlotAdded", function(event, options) {
        console.log(' >> HISTORY windowSlotAdded');
        moo5 = options;
      });

      _this.eventEmitter.subscribe("windowsRemoved", function(event) {
        console.log(' >> HISTORY windowsRemoved');
      });

      _this.eventEmitter.subscribe("windowRemoved", function(event, windowID) {
        console.log(' >> HISTORY windowRemoved');
      });

      _this.eventEmitter.subscribe('SEARCH', function (event, data) {
        console.log(' >> HISTORY SEARCH');
      });

      _this.eventEmitter.subscribe('GET_FACETS', function (event, data) {
        console.log(' >> HISTORY GET_FACETS'); // another search
      });

      /**
       *  data: {
       *    "origin": "id of originating component",
       *    "canvasId": "IIIF-canvas-URI",
       *    "manifest": {} // Manifest object
       *  }
       */
      _this.eventEmitter.subscribe('CANVAS_ID_UPDATED', function (event, data) {
        console.log(' >> HISTORY CANVAS_ID_UPDATED');
        moo8 = data;
      });

      /**
       * data: {
       *    "windowId":"f51774c0-97ec-4881-8d87-2362756155aa",
       *    "tabId":"searchTab",
       *    "tabIndex":1
       * }
       */
      _this.eventEmitter.subscribe('TAB_SELECTED', function (event, data) { 
        console.log(' >> HISTORY TAB_SELECTED ' + JSON.stringify(data));
      });
    }
  };
}(Mirador));
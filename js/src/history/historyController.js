(function ($) {
  /**
   * EVENTS
   * subscriptions
   *  > SWITCH_SEARCH_SERVICE
   *  > manifestsPanelVisible.set
   *  > windowUpdated
   *  > search
   *  > SEARCH_RESULTS_CLOSED
   * 
   * publish
   *  > SWITCH_SEARCH_SERVICE (changes search context to use a particular search service)
   *  > PICK_SEARCH_SERVICE (tells the search picker to select a collection in the UI)
   *  > ADD_WINDOW (spawns window of a known configuration, such as to a particular page in a book)
   */
  $.HistoryController = function (options) {
    jQuery.extend(true, this, {
      eventEmitter: null,
      urlSlicer: null,
      saveController: null,
      historyList: [] // TODO Potentially use browser's session storage to hold history list so viewer state
                      // can be recreated when the browser buttons are used to navigate history?
    }, options);

    // Since history will be empty at this point, it will default to getting the initially loaded
    // collection from the Mirador config
    this.initialCollection = this.getLastCollection();
    let uri = new URI(this.initialCollection);
    uri.path(uri.path().split('/')[1]);

    this.urlSlicer = new $.JHUrlSlicer({
      baseUrl: uri.toString()
    });

    this.init();
  };

  $.HistoryController.prototype = {
    init: function () {
      let _this = this;

      this.listenForStart().then(() => {
        _this.bindEvents();
        _this.handleUrl();
      });

      window.onpopstate = (event) => {
        _this.handleUrl(event);
      };
    },

    /*
     * One issue to address is when to start this history controller. We can't simply start listening 
     * for history events when Mirador is initially rendered. Instead, we have to wait until we know
     * data is loaded, so that various context changes can be applied to the UI correctly.
     * 
     * We have access to the list of data that Mirador was initially configured to load. This controller
     * can then listen for 'manifestReceived' and 'collectionReceived' events until all of the
     * initially configured data has been fulfilled. At that point, the controller can start listening
     * for events.
     */
    listenForStart: function () {
      const _this = this;
      const url = this.urlSlicer.url(window.location.hash, window.location.search);
      const initCol = window.location.hash ? 
          this.urlSlicer.parseUrl(url).data.collection : 
          this.initialCollection;
      
      let data = this.saveController.get('data', 'originalConfig');
      return new Promise((resolve, reject) => {
        const colHandler = (event, collection) => {
          // console.log('   >>> ' + collection.getId());
          const index = data.findIndex(el => el.collectionUri === collection.getId());
          if (index !== -1) {
            data.splice(index, 1);
            // if (data.length === 0) {
            //   resolve();
            // }
          }
          if (data.length === 0 && collection.getId() === initCol) {
            resolve();
          }
        };
        // const manHandler = (event, manifest) => {
        //   const index = data.findIndex(el => el.manifestUri === manifest.getId());
        //   if (index !== -1) {
        //     data.splice(index, 1);
        //     if (data.length === 0) {
        //       resolve();
        //     }
        //   }
        // };

        _this.eventEmitter.subscribe('collectionReceived', colHandler);
        // _this.eventEmitter.subscribe('manifestHandler', manHandler);
      });
    },

    bindEvents: function () {
      var _this = this;

      _this.eventEmitter.subscribe('SWITCH_SEARCH_SERVICE', (event, data) => {
        if (!data.origin && !data.ignoreHistory) { // undefined origin equates to collection search
          // 'data.service' is the search service ID, strip out the search part of the URL to get the collection
          let url = typeof data.service === 'string' ? data.service : data.service.id;
          _this.triggerCollectionHistory(url.substring(0, url.lastIndexOf('/')));
        }
      });

      _this.eventEmitter.subscribe('SEARCH_RESULTS_CLOSED', (event, data) => {
        if (!data.origin) {
          _this.triggerCollectionHistory();
        }
      });

      /**
       * This will generally be used to change the history state to denote when a user is looking
       * at the collection page. This event cannot tell what collection is being looked at. 
       * 
       * Fires when the "manifests panel" (book browser) is shown or hidden. "manifestPanelVisible"
       * is a boolean value describing the panel's visibility (true = visible)
       * 
       * The 'data' param can take two forms, normally, this event sourced from the viewer itself
       * will set data to a boolean value. If this event is published from this controller, it will
       * be set to an object: {
       *    visible: {boolean},
       *    ignoreHistory: {boolean}
       * }
       */
      _this.eventEmitter.subscribe('manifestsPanelVisible.set', function (event, data) {
        // if TRUE, then user opened the Manifest Browser :: is looking at the collection
        if (data.ignoreHistory) {
          return;
        }
        if (data === true) {
          _this.triggerCollectionHistory();
        }
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
            annotationState: 'off', // Ignore this as well, used for annotation authoring
          }
       */
      _this.eventEmitter.subscribe('windowUpdated', function (event, options) {
        _this.processWindowUpdated(event, options);
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
        /*
         * In order to initialize a search, we will first need to WAIT for the UI to init
         * and settle. Likely we can wait for SEARCH_SERVICE_FOUND event for the search
         * service that matches the service of the current URL fragment.
         * 
         * We will need to know the state to leave the viewer panel (image view, book view, thumbnails, etc).
         * Can we do this simply by inspecting the 'historyList' - looking backwards for the last event
         * that involved the particular collection, manifest, and canvas? I think that a history state would
         * _always_ be found, as a user must do something in the viewer to initiate a search.
         * 
         * In the case of a collection search, we will need to determine the ID used by the search widget
         * for search events. This is a UUID generated when the collection search widget is created
         */
        // console.log(' ### SEARCH');
        // console.log(data);
        _this.processSearch(data);
      });

      _this.eventEmitter.subscribe('GET_FACETS', function (event, data) {

      });
    },

    triggerCollectionHistory: function (collection) {
      if (!collection) {
        collection = this.getLastCollection();
      }
      // console.log('Trigger collection history :: ' + collection);
      this.addHistory(new $.HistoryState({
        type: $.HistoryStateType.collection,
        fragment: window.location.hash,
        data: {
          collection
        }
      }));
    },

    /**
     * Event notes:
     * 'id' (windowId) is always present
     * Seems like whenever 'viewType' is present, the following are also present:
     *    - canvasID
     *    - imageMode (what is the difference between this and 'viewType' ???)
     *    - loadedManifest
     *    - slotAddress
     * 
     * @param e the WindowUpdated event object
     * @param event windowUpdated event data
     */
    processWindowUpdated: function (e, event) {
      if (!event.viewType) {
        // Not concerned with events not related to view changes
        return;
      }

      const manifest = event.loadedManifest;
      const canvas = event.canvasID;
      const windowId = event.id;

      let eventType = null;
      let viewType = null;
      switch (event.viewType) {
        case 'ThumbnailsView':
          eventType = $.HistoryStateType.thumb_view;
          viewType = 'thumb';
          break;
        case 'ImageView':
          eventType = $.HistoryStateType.image_view;
          viewType = 'image';
          break;
        case 'BookView':
          eventType = $.HistoryStateType.opening_view;
          viewType = 'opening';
          break;
        case 'ScrollView':
          eventType = $.HistoryStateType.scroll_view;
          viewType = 'scroll';
          break;
        default: // Bail if no view type found
          return;
      }

      const freshState = new $.HistoryState({
        type: eventType,
        fragment: window.location.hash,
        data: {
          ignoreHistory: true,
          collection: this.urlSlicer.collectionName(manifest),
          windowId,
          manifest,
          canvas,
          viewType
        }
      });

      if (!event.ignoreHistory) {
        this.addHistory(freshState);
      }
    },

    /**
     * When a user first flips to the collection panel (ManifestsPanel), the application event does 
     * not have enough information to determine the collection being looked at. In this case, we must
     * determine the collection by investigating the application history. If no collection is found
     * in the history, then we can assume that the initially loaded collection is being looked at.
     */
    getLastCollection: function () {
      let collections = this.historyList.filter(state => state.type === $.HistoryStateType.collection);
      if (collections.length > 0) {
        return collections[collections.length - 1].data.collection;
      }
      // Ugh, we have to assume that the input data is the initial collection :(
      return this.saveController.getStateProperty('data')[0].collectionUri;
    },

    addHistory: function (event) {
      let title = this.urlSlicer.stateTitle(event);
      let url = this.urlSlicer.toUrl(event);

      const alreadyCurrent = event.equals(this.historyList[this.historyList.length - 1]);
console.log(event);
      if (url && !alreadyCurrent) {
        window.history.pushState(event, title, url);
        this.historyList.push(event);
      } else {
        window.alert('sad moo');
        console.log('%c[HistoryController] No URL specified when changing history.', 'color: red');
        console.log(event);
      }
    },

    /**
     * Contains handlers to initialize the viewer based on the URL path when the page is 
     * initially loaded. This should happen whenever the browser navigation buttons are
     * used, or when a user loads a bookmark.
     * 
     * Book thumb view  ::	#COL_ID/BOOK_ID/thumb	            ::  #aor/Douce195/thumb
     * Book scroll view	::  #COL_ID/BOOK_ID/scroll	          ::  #aor/Douce195/scroll
     * Single page view	::  #COL_ID/BOOK_ID/IMAGE_ID/image	  ::  #aor/Douce195/001r/image
     * Opening view	    ::  #COL_ID/BOOK_ID/IMAGE_ID/opening	::  #aor/Douce195/001r/opening
     * Search in a book	::  #COL_ID/BOOK_ID/search?q=query	  ::  #aor/Douce195/search?q=query
     * Search across	  ::  #COL_ID/search?q=query	          ::  #aor/search?q=query
     * 
     * EVENTS::
     * 
     * SET_COLLECTION
     * 
     * @param event popstate event {
     *    state: {}, // HistoryState object
     * }
     */
    handleUrl: function (event) {
      const url = this.urlSlicer.url(window.location.hash, window.location.search);
      if (!url || url === '') {
        this.triggerCollectionHistory();
        return;
      }

      const lastHistory = this.historyList[this.historyList.length - 1];

      // If history list is empty, or no event is provided, initialize the viewer to the
      // state described by the current URL hash
      if (!event || this.historyList.indexOf(event.state) === -1) {
        this.applyState(this.urlSlicer.parseUrl(url));
        return;
      }

      // If history list contains this event, pop states off the history list until you 
      // have popped this event off. Each state should be applied to the viewer in the
      // order it pops off the list
      console.log(' ### ');



    },

    applyState: function (state) {
      const _this = this;
      const url = state.fragment;
      if (!state.type) {
        window.alert('Unable to moo this URL: [' + url + ']');
        return;
      }

      const collection = this.urlSlicer.collectionFromUri(url);
      // let windowConfig = {
      //   id: state.data.windowId,
      //   canavsID: state.data.canvas,
      //   ignoreHistory: true
      // };
      switch (state.type) {
        case $.HistoryStateType.collection:
          this.initToCollection(collection);
          break;
        case $.HistoryStateType.image_view:
          this.getCollection(state.data.collection);
          this.getManifest(state.data.manifest).done(function (manifest) {
            _this.eventEmitter.publish('ADD_WINDOW', {
              id: state.data.windowId,
              manifest,
              canvasID: state.data.canvas,
              viewType: 'ImageView',
              ignoreHistory: true
            });
          });
          break;
        case $.HistoryStateType.opening_view:
          this.getCollection(state.data.collection);
          this.getManifest(state.data.manifest).done(function (manifest) {
            _this.eventEmitter.publish('ADD_WINDOW', {
              id: state.data.windowId,
              manifest,
              canvasID: state.data.canvas,
              viewType: 'OpeningView',
              ignoreHistory: true
            });
          });
          break;
        case $.HistoryStateType.thumb_view:
          this.getCollection(state.data.collection);
          this.getManifest(state.data.manifest).done(manifest => {
            _this.eventEmitter.publish('ADD_WINDOW', {
              id: state.data.windowId,
              manifest,
              viewType: 'ThumbnailsView',
              ignoreHistory: true
            });
          });
          break;
        case $.HistoryStateType.collection_search:
          this.initToCollection(collection);
          this.collectionSearch(state, collection);
          break;
        default:
          break;
      }
    },

    initToCollection: function (collection) {
      const service = this.urlSlicer.uriToSearchUri(this.urlSlicer.collectionUri(collection));
      this.eventEmitter.publish('CLOSE_SEARCH_RESULTS', {
        origin: undefined
      });
      this.eventEmitter.publish('SWITCH_SEARCH_SERVICE', {
        service,
        ignoreHistory: true
      });
      this.eventEmitter.publish('PICK_SEARCH_SERVICE', {
        origin: undefined,    // Make this relationship explicit
        service
      });
      this.eventEmitter.publish('manifestsPanelVisible.set', {
        visible: true,
        ignoreHistory: true
      });
    },

    /**
     * 1) Update search context for relevant UI component
     *   > Are we sure that the search service has already been loaded?
     *   > context.search is equivalent to historyState.search
     *   > context.ui must be derived from historyState.search
     *     - historyState.search.type === basic ? 
     *       * ui.basic = historyState.search.query
     *       * historyState.search.query must be adjusted now :|
     *     - historyState.search.type === advanced ?
     *       * ui.advanced must be derived from historyState.search.query
     * 2) Request search for that component
     */
    collectionSearch: function (state, object) {
      const _this = this;
      const serviceUrl = this.urlSlicer.uriToSearchUri(this.urlSlicer.collectionUri(object));
      
      let context = {
        searchService: {
          id: serviceUrl,
          config: new $.JhiiifSearchService({ id: serviceUrl })
        },
        search: state.data.search,
        ui: {}
      };

      context.searchService.config.initializer.done(service => {
        if (state.data.search.type === 'basic') {
          // Need to modify search context query here
          context.ui.basic = state.data.search.query;
          context.search.isBasic = true;

          context.search.query = $.generateBasicQuery(
            context.ui.basic,
            context.searchService.config.getDefaultFields(),
            context.searchService.config.query.delimiters.or
          );
          
        } else {
          /*
            {category: "description", term: "one", row: 0, operation: "and", type: "input"},
            {category: "title", term: "two", operation: "and", row: 1, type: "input"}
           */
          const query = state.data.search.query;
          let rows = [];
          $.parseQuery(query).forEach((r, i) => {
            r.row = i;

            // Find search field from info.json from row.category (should match a field.query)
            //    - Define row.type
            //      * If row.term is found in field.values[].value, type === select
            //      * Else type = field.type
            const match = context.searchService.config.search.settings.fields
                .filter(field => field.query === r.category);
            if (match.length === 0) {
              return;
            }

            const field = match[0];

            if (field.values && field.values.some(val => val.value === r.term)) {
              r.type = 'select';
            } else {
              r.type = 'input';
            }

            rows.push(r);
          });

          // Need to parse the search query to generate ui.advanced.rows D:
          context.search.isBasic = false;
          context.ui.advanced = {
            rows
          };
        }

        _this.eventEmitter.publish('SEARCH_CONTEXT_UPDATED', {
          origin: undefined,
          context
        });
  
        _this.eventEmitter.publish('SEARCH_REQUESTED', {
          origin: undefined,
          ignoreHistory: true
        });
      });
      
      
    },

    getCollection: function (collectionId) {
      const _this = this;
      let id = $.genUUID();

      const result = jQuery.Deferred();

      let collectionReturn = (event, data) => {
        if (data.origin === id) {
          _this.eventEmitter.unsubscribe('COLLECTION_FOUND', collectionReturn);
          result.resolve(data.collection);
        }
      };

      this.eventEmitter.subscribe('COLLECTION_FOUND', collectionReturn);
      this.eventEmitter.publish('COLLECTION_REQUESTED', {
        origin: id,
        id: collectionId
      });
    },

    getManifest: function (manifestId) {
      const _this = this;
      let id = $.genUUID();

      const result = jQuery.Deferred();

      let manifestReturn = function (event, data) {
        if (data.origin === id) {
          _this.eventEmitter.unsubscribe('MANIFEST_FOUND', manifestReturn);
          result.resolve(data.manifest);
        }
      };

      this.eventEmitter.subscribe('MANIFEST_FOUND', manifestReturn);
      this.eventEmitter.publish('MANIFEST_REQUESTED', {
        origin: id,
        manifestId
      });

      return result;
    },

    processSearch: function(data) {
      if (data.ignoreHistory) {
        return;
      }
      const context = data.context;

      const searchedObject = context.searchService.id.substring(0, context.searchService.id.length - 9);
      const searchManifest = searchedObject.includes('manifest');
      const isBasic = context.search.isBasic;

      this.addHistory(new $.HistoryState({
        type: searchManifest ? $.HistoryStateType.manifest_search : $.HistoryStateType.collection_search,
        fragment: window.location.hash,
        data: {
          windowId: context.origin,
          collection: !searchManifest ? searchedObject : 'moo',
          manifest: searchManifest ? searchedObject : undefined,
          search: {
            query: isBasic ? context.ui.basic : context.search.query,
            offset: context.search.offset,
            maxPerPage: context.search.maxPerPage,
            sortOrder: context.search.sortOrder,
            type: isBasic ? 'basic' : 'advanced',
            rows: context.ui.advanced ? context.ui.advanced.rows : undefined
          }
        }
      }));
    }
  };
}(Mirador));
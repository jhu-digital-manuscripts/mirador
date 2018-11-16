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
   * 
   * @param options {
   *    eventEmitter: {},
   *    urlSlicer: {},
   *    saveController: {},
   *    history: [],        // Keeps list of history states the viewer has gone through
   *    goBackLimit: 1,     // Limit for how far back to look when resetting to old states.
   *                        // By default, this is set to 1, meaning the user can only go
   *                        // back by 1 step at a time
   * }
   */
  $.HistoryController = function (options) {
    jQuery.extend(true, this, {
      eventEmitter: null,
      urlSlicer: null,
      saveController: null,
      history: new $.History(),
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
      this.eventEmitter.subscribe('manifestsPanelVisible.set', (event, data) => {
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
      this.eventEmitter.subscribe('windowUpdated', (event, options) => {
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
      this.eventEmitter.subscribe('SEARCH', (event, data) => {
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
        _this.processSearch(data);
      });

      this.eventEmitter.subscribe('GET_FACETS', (event, data) => {
        // TODO: possibly needed for DLMM, but not AOR
      });

      this.eventEmitter.subscribe('RESET_WORKSPACE_LAYOUT', (event, data) => {
        console.log('RESET_WORKSPACE_LAYOUT');
        console.log(data);
      });

      /**
       * This event is fired when the user closes a window.
       * 
       * @param data {
       *    ignoreHistory: true|false, 
       *    slot: {}, slot object, of which we can get the slotID and layoutAddress
       * }
       */
      this.eventEmitter.subscribe('slotRemoved', (event, data) => {
        if (data.ignoreHistory) {
          return;
        }

        _this.addHistory(new $.HistoryState({
          type: $.HistoryStateType.slot_change,
          data: {
            slot: {
              id: data.slot.slotID
            },
            modType: $.SlotChangeType.remove
          }
        }));
      });

      /**
       * This event fires when a single slot is added to the workspace by means of "splitting"
       * from a panel. This happens when a user selects options such as "Add slot right" or
       * right clicks a search result and "Open in slot above"
       * 
       * @param data {
       *    ignoreHistory: true|false, 
       *    slot: {}, // the new slot that was created by this operation
       *    target: {}, 
       * }
       */
      this.eventEmitter.subscribe('slotAdded', (event, data) => {
        if (data.ignoreHistory) {
          return;
        }

        _this.addHistory(new $.HistoryState({
          type: $.HistoryStateType.slot_change,
          data: {
            slot: {
              id: data.slot.slotID
            },
            modType: $.SlotChangeType.add
          }
        }));
      });
    },

    triggerCollectionHistory: function (collection) {
      if (!collection) {
        collection = this.getLastCollection();
      }

      const fragment = window.location.hash || this.urlSlicer.collectionName(collection);

      this.addHistory(new $.HistoryState({
        type: $.HistoryStateType.collection,
        fragment,
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
      for (let i = 0; i < this.history.length(); i++) {
        const state = this.history.peekBack(i);
        if (state && state.type === $.HistoryStateType.collection) {
          return state.data.collection;
        }
      }
      // Ugh, we have to assume that the input data is the initial collection :(
      return this.saveController.getStateProperty('data')[0].collectionUri;
    },

    addHistory: function (event) {
      const alreadyCurrent = event.equals(this.history.current());

      event.index = this.history.length();

      if (alreadyCurrent) {
        return;
      } else if (event.type === $.HistoryStateType.slot_change) {
        // Modifications to slot layouts should be recorded, but do not effect the viewer URL
        this.history.add(event);
        return;
      }

      let title = this.urlSlicer.stateTitle(event);
      let url = this.urlSlicer.toUrl(event);

      if (url) {
        this.history.add(event);
        window.history.pushState(event, title, url);
      } else {
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
      const _this = this;

      const url = this.urlSlicer.url(window.location.hash, window.location.search);
      if (!url || url === '') {
        this.triggerCollectionHistory();
        return;
      }

      // If history list is empty, or no event is provided, initialize the viewer to the
      // state described by the current URL hash
      if (event && event.state) {
        console.log('%cEvented URL', 'color:blue;');
        // If history list contains this event, pop states off the history list until you 
        // have popped this event off. Each state should be applied to the viewer in the
        // order it pops off the list
        // const backHistory = this.historyList.slice().reverse();
        // const lastIndex = backHistory.findIndex(hist => hist.equals(event.state));

        // if (lastIndex >= 0 /* && lastIndex < this.goBackLimit */) {
        //   let last;
        //   do {
        //     // last = this.historyList.pop();
        //     last = this.previousState();
        //     this.maybeModifySlotConfig(last);
        //   } while (last && last.equals(event.state));
        // } else {
        //   // TODO: what if the specified event is not found in historyList???
        //   console.log('State not found :: MOO');
        //   this.applyState(this.urlSlicer.parseUrl(url));
        // }

        const historyMatch = this.history.search(event.state);
        if (!historyMatch) {
          console.log('%c   >> Not found in history', 'color:lightblue;');
          console.log(event.state);
          // this.addHistory(event.state);
          this.applyState(event.state);
          return;
        }

        console.log('%c   >> Found in history (' + historyMatch + ')', 'color:green;');
        const isBack = historyMatch < 0;
        for (let i = 0; i < Math.abs(historyMatch); i++) {
          let state;
          
          if (isBack) {
            state = this.history.previousState();
          } else {
            state = this.history.nextState();
          }

          console.log(i);
          console.log(state);

          if (state) {
            this.modifySlotOrApplyState(state);
          }
          // this.applyState(event.state);
        }
        
      } else {
        console.log('%cnon-Evented URL', 'color:brown;');
        const state = this.urlSlicer.parseUrl(url);
        this.addHistory(state);
        this.applyState(state);
      }
    },

    addSlot: function (state) {

    },

    removeSlot: function (state) {
      // console.log('   >>> Added Slot, must now REMOVE a slot!');
      // console.log(state);
      const node = state.data.slot;
      node.slotID = node.id;
      this.eventEmitter.publish('REMOVE_NODE', {
        node,
        ignoreHistory: true
      });
    },

    applyState: function (state) {
      const _this = this;
      const url = state.fragment;
      if (!state.type) {
        console.log('%cUnable to moo this URL: [' + url + ']', 'color: red;');
        return;
      }

      const collection = this.urlSlicer.collectionFromUri(state.collection);
      const viewType = this.urlSlicer.stateTypeToViewType(state.type);

      switch (state.type) {
        case $.HistoryStateType.collection:
          this.initToCollection(collection);
          break;
        case $.HistoryStateType.scroll_view:
        case $.HistoryStateType.image_view:
        case $.HistoryStateType.opening_view:
        case $.HistoryStateType.thumb_view:
          jQuery.when(
            this.getCollection(state.data.collection),
            this.getManifest(state.data.manifest)
          ).done((collection, manifest) => {
            const config = {
              id: state.data.windowId,
              manifest,
              canvasID: state.data.canvas,
              viewType,
              ignoreHistory: true
            };
            _this.eventEmitter.publish('ADD_WINDOW', config);
          });
          break;
        case $.HistoryStateType.collection_search:
          this.initToCollection(collection);
          this.collectionSearch(state, collection);
          break;
        case $.HistoryStateType.manifest_search:
          jQuery.when(
            this.getCollection(state.data.collection),
            this.getManifest(state.data.manifest)
          ).done((collection, manifest) => {
            const config = {
              id: state.data.windowId,
              manifest,
              canvasID: state.data.canvas,
              viewType,
              ignoreHistory: true
            };
            _this.eventEmitter.publish('ADD_WINDOW', config);
            _this.manifestSearch(state, manifest);
          });
          break;
        default:
          break;
      }
    },

    /** TODO
     * When navigating through history states, sometimes events occur in different Mirador windows.
     * When recreating old states, we should maintain the placement of these windows as much as
     * possible.
     * 
     * @param {HistoryState} state 
     */
    modifySlotOrApplyState: function (state) {
      // console.log('   #### ');
      // console.log(state);
      if (state.type === $.HistoryStateType.slot_change) {
        switch (state.data.modType) {
          case $.SlotChangeType.add:
            console.log('   >>> Add slot event');
            this.removeSlot(state);  
            break;
          case $.SlotChangeType.remove:
            console.log('   <<< Remove Slot event ');
            break;
          default:
            break;
        }
      } else {
        this.applyState(state);
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
      this.eventEmitter.publish('SEARCH_SIZE_UPDATED.undefined');
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
      const serviceUrl = this.urlSlicer.uriToSearchUri(this.urlSlicer.collectionUri(object));
      this.doSearch(state, serviceUrl);
    },

    manifestSearch: function (state, manifest) {
      // Need to find windowId by matching manifest ID and matching canvas ID if possible
      // TODO: what if more than one window is open to the same book and page? Current behavior is to pick the first match...
      const match = this.saveController.getStateProperty('windowObjects').filter(window =>
        (state.data.windowId && state.data.windowId === window.id) ||
        window.loadedManifest === manifest.getId() && 
          (state.data.canvas ? window.canvasID === state.data.canvas : true)
      );

      if (match.length === 0) {
        console.log('%c[HistoryController#manifestSearch] Failed to find window for this manifest (' +
            manifest.getId() + ')', 'color:red;');
        return;
      }

      const windowId = match[0].id;
      // Now that we know the windowId, we can open the search tab of the sidepanel!
      // const tabIndex = match[0].element.find('.tabGroup .tab[data-tabid=searchTab]').index();
      // TODO: hard coded way to "get" tab index. To do it for real, you will need to get the Slot object element,
      //        then find '.tabGroup .tab[data-tabid=searchTab]'
      const tabIndex = 1;
      this.eventEmitter.publish('tabSelected.' + windowId, tabIndex);

      const serviceUrl = this.urlSlicer.uriToSearchUri(state.data.search.service);
      this.doSearch(state, serviceUrl, windowId);
    },

    doSearch: function (state, serviceUrl, windowId) {
      const _this = this;

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
          origin: windowId,
          context
        });

        _this.eventEmitter.publish('SEARCH_REQUESTED', {
          origin: windowId,
          ignoreHistory: true
        });
      });
    },

    /**
     * Get a Deferred object that contains a collection object when the data request returns.
     * To use, chain this function call with a callback.
     * 
     *    getCollection('col').done(collection => { ... })
     *    getCollection('col').then(collection => { ... })
     * 
     * @param {string} collectionId URI of a collection
     * @returns {Deferred} a jQuery.Deferred object that resolves when the collection
     *          data is returned
     */
    getCollection: function (collectionId) {
      const _this = this;
      let id = $.genUUID();

      if (!this.urlSlicer.isUri(collectionId)) {
        collectionId = this.urlSlicer.collectionUri(collectionId);
      }

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

    /**
     * Get a Deferred object that contains a manifest object when the data request returns.
     * To use, chain this function call with a callback.
     * 
     *    getManifest('mani').done(manifest => { ... })
     *    getManifest('mani').then(manifest => { ... })
     * 
     * @param {string} manifestId URI of a manifest
     * @returns {Deferred} a jQuery.Deferred object that resolves when the manifest data
     *          is returned
     */
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
      const isBasic = context.search.isBasic;
      const service = data.context.searchService.id;

      let collection;
      let manifest;
      let canvas;
      let searchManifest;
      let viewType;

      // Searches from book list will have origin === undefined
      if (data.origin) {
        /*
        * If the search event comes from a sidepanel, 'data.context.baseObject' will be defined and set
        * to be the manifest that was being viewed in the particular window. We can use this information
        * as well as 'data.origin' to recreate the window state in order to generate a complete search
        * state.
        */
        const window = this.saveController.getWindowObjectById(data.origin);
        const uri = (typeof data.context.baseObject === 'string') ? data.context.baseObject : data.context.baseObject.getId();

        viewType = $.getViewName(this.urlSlicer.viewTypeToStateType(window.viewType));
        collection = data.context.baseObject.jsonLd.within['@id'];
        manifest = uri;
        canvas = window.canvasID;
        searchManifest = true;
      } else {
        collection = context.searchService.id.substring(0, context.searchService.id.length - 9);
        searchManifest = false;
      }

      this.addHistory(new $.HistoryState({
        type: searchManifest ? $.HistoryStateType.manifest_search : $.HistoryStateType.collection_search,
        fragment: window.location.hash,
        data: {
          windowId: data.origin,
          viewType,
          collection,
          manifest,
          canvas,
          search: {
            service,
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
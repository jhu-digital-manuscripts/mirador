(function ($) {
  /**
   * This component is meant to contain and coordinate the different search elements,
   * whether it sits in a window's side panel, or the viewer's book browser. The various
   * child components bubble context update events up to this container, where the overall
   * context is maintained. When a search is initiated, a SEARCH_REQUESTED event is made
   * and picked up by this container, which then issues a search request based on the 
   * search context at the time the SEARCH_REQUESTED event is picked up.
   * 
   * See below for the structure of the search context.
   * 
   * EVENTS:
   *  subscribe:
   *    > SEARCH_CONTEXT_UPDATED : the current context must be updated. This can be because of
   *            a changed history state, or user interacting with the UI.
   *    > SEARCH_REQUESTED : request that this container issue a search request to the server
   *            based on the current search context
   *    > ADD_IIIF_OBJECT : add a search service for a IIIF object to the search-service-picker,
   *            making the search service available for a user to search. Most often comes from
   *            a parent component that contains this container
   *    > SWITCH_SEARCH_SERVICE : change the active search service in the search context
   *    > REQUEST_FACETS : request that this container get facets for the current search context
   *    > FACETS_COMPLETE.<windowId> : completion event for the facet request that includes facet data. This
   *            is a hold-over from the un-refactored facet component, in the future should 
   *            probably be handled with a Promise
   *    > tabStateUpdated.<windowId> : another remnant of the old design, put in here to handle 
   *            the search container as a search tab. In the future, a dedicated search tab component
   *            should probably be created.
   * 
   *  publish:
   *    > SEARCH_CONTEXT_UPDATED : this is generally only emitted when the search context is updated
   *            from this container itself. 
   *    > GET_FACETS : issue this event for the SearchController to kick off a facet request to the server.
   *            This follows an older paradigm, and should be replaced with a Promise in the future, directly
   *            accessing the appropriate searchController function
   */
  $.SearchContainer = function (options) {
    jQuery.extend(true, this, {
      id: $.genUUID(),  // ID for this component
      windowId: undefined,
      tabId: null,
      parent: null,
      element: null,
      appendTo: null,
      state: null,
      eventEmitter: null,
      searchContext: null,
      searchConfig: null, // Default config found in settings.js
      
      baseObject: null,

      searchController: null,
      facetContainer: null,
      searchWidget: null,
      searchPicker: null,
      searchResults: null,

      /**
       * @param context {
       *    searchService: {
       *      id,
       *      query: {
       *        operators,
       *        delimiteres
       *      },
       *      search: {
       *        settings: {
       *          fields: [],
       *          'default-fields': []
       *        }
       *      }
       *    },
       *    search: {
       *      query: '',
       *      offset: -1, 
       *      maxPerPage: -1,
       *      resumeToken: '',  // NOT USED
       *      sortOrder: '',    // relevance|index
       *      selected: -1,     // Index of selected search result
       *      facetQuery: ''    
       *    },
       *    ui: {
       *      basic: '',        // Basic search term seen in the UI
       *      advanced: {       // This property will always override 'basic'
       *        rows: [
       *          {
       *            operator: '',   // and|or
       *            field: '',
       *            term: '',
       *            type: '',       // input|select
       *          },
       *          ...
       *        ]
       *      }
       *    }
       * }
       */
      context: null,
      config: {
        startHidden: true,
        advancedSearchActive: false,
        animated: false,
        hasContextMenu: true,
        allowFacets: true,
        inSidebar: false,
        showDescription: true,
        showCollectionPicker: true,
        showHideAnimation: {
          duration: 'fast'
        }
      }
    }, options);

    this.faceted = !this.config.inSidebar && this.config.allowFacets;

    this.init();
  };

  $.SearchContainer.prototype = {
    init: function () {
      this.element = jQuery(this.template({
        hidden: this.startHidden
      })).appendTo(this.appendTo);

      const baseConfig = {
        eventEmitter: this.eventEmitter,
        state: this.state,
        windowId: this.windowId,
        parent: this,
        appendTo: this.element,
        config: this.config,
        searchController: this.searchController
      };

      this.searchPicker = new $.SearchPicker(jQuery.extend(true, baseConfig, {
        baseObject: this.baseObject
      }));

      this.searchWidget = new $.SearchWidget(jQuery.extend(true, baseConfig, {
        context: this.context
      }));

      this.searchResults = new $.SearchResultsContainer(jQuery.extend(true, baseConfig, {
        context: this.context
      }));

      if (this.faceted) {
        this.facetContainer = new $.FacetContainer(jQuery.extend(true, baseConfig, {}));
      }

      this.bindEvents();

      if (this.baseObject) {
        this.addIIIFObject(this.baseObject);
      }
    },

    bindEvents: function () {
      const _this = this;

      this.eventEmitter.subscribe('SEARCH_CONTEXT_UPDATED', (event, data) => {
        if (data.origin !== _this.windowId) {
          return;
        }
        _this.changeContext(data.context, true, true);
      });

      this.eventEmitter.subscribe('SEARCH_REQUESTED', (event, data) => {
        if (data.origin !== _this.windowId) {
          return;
        }
        console.log('Search Container :: search requested');
        _this.doSearch();
      });

      this.eventEmitter.subscribe('ADD_IIIF_OBJECT', (event, data) => {
        if (data.origin === _this.windowId) {
          _this.addIIIFObject(data.object);
        }
      });

      this.eventEmitter.subscribe('SWITCH_SEARCH_SERVICE', (event, data) => {
        if (data.origin === _this.windowId) {
          _this.switchSearchService(data.service);
        }
      });

      // Facet search requested - update current search context and use it to issue a search request
      this.eventEmitter.subscribe('REQUEST_FACETS', (event, data) => {
        if (data.origin === _this.windowId) {
          _this.context.search.facetQuery = data.facets;
          _this.getFacets(data.facets);
        }
      });

      this.eventEmitter.subscribe('FACETS_COMPLETE.' + this.windowId, (event, data) => {
        _this.facetContainer.handleFacets(data.results, data.append);
      });

      if (this.tabId) {
        this.eventEmitter.subscribe('tabStateUpdated.' + this.windowId, function (event, data) {
          if (data.tabs[data.selectedTabIndex].options.id === _this.tabId) {
            _this.element.show();
          } else {
            _this.element.hide();
          }
        });
      }
    },

    changeContext: function (context, init, suppressEvent) {
        // On search service switch, clear advanced search rows
        // if (data.context.hasOwnProperty('searchService')) {
        //   delete _this.context.ui.advanced;
        // }
        jQuery.extend(true, this.context, context);
        this.searchWidget.changeContext(this.context, init, suppressEvent);
        if (this.faceted) {
          this.facetContainer.changeContext(this.context);
        }
        this.searchResults.changeContext(this.context);

        if (!suppressEvent) {
          this.eventEmitter.publish('SEARCH_CONTEXT_UPDATED', {
            origin: this.windowId
          });
        }
    },

    /**
     * Add an object to this widget that you potentially want to search.
     * This object must be a JSON object of a IIIF object.
     *
     * @param object : IIIF object as JSON
     */
    addIIIFObject: function(object) {
      const _this = this;

      if (!object || typeof object !== "object") {
        return;
      }

      // At this point, the services are discovered, but not resolved. We do not
      // have the full service configurations yet.
      const searchSerivces = this.searchController.searchServicesInObject(object);
      searchSerivces.forEach(service => _this.searchPicker.addSearchService(service));
    },

    /**
     * @param {string|object} service the search service ID, or search service object with an 'id' property
     */
    getSearchService: function (service) {
      if (typeof service === 'object') {
        service = service.id;
      }
      const result = jQuery.Deferred();
      this.searchController.getSearchService(service)
        .done(s => result.resolve(s))
        .fail(() => result.reject());
      return result;
    },

    switchSearchService: function (service) {
      const _this = this;
      this.getSearchService(service).done(searchService => {
        _this.searchWidget.changeContext({
          searchService
        }, true, false);
      });
    },

    doSearch: function () {
      const _this = this;

      const context = this.context;
      const searchRequest = {
        origin: this.windowId,
        query: context.search.query,
        service: context.searchService,
        offset: context.search.offset || 0,
        maxPerPage: context.search.maxPerPage || 30,
        sortOrder: context.search.sortOrder,
        facets: context.search.facetQuery,
        context
      };
      this.eventEmitter.publish('SEARCH', searchRequest);
      this.searchController.doSearch(searchRequest).done((data) => {
        _this.handleSearchResults(data);
      });
      this.searchResults.clear();
    },

    handleSearchResults: function (data) {
      console.log('Search Container :: handle search results');
      this.changeContext({
        search: {
          results: data
        }
      }, false, true);
      this.searchResults.handleSearchResults(data);
    },

    getFacets: function (facetQuery) {
      this.eventEmitter.publish('GET_FACETS', {
        origin: this.windowId,
        service: this.context.searchService,
        facets: facetQuery
      });
    },

    template: Handlebars.compile([
      '<div class="search-container" {{#if hidden}}style="display:none;"{{/if}}>',
      '</div>'
    ].join(''))
  };
}(Mirador));
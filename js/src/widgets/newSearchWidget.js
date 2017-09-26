(function($){
  /**
   * This object is responsible for creating the basic and advanced search UI
   * anywhere in Mirador. This object is responsible for forming and sending
   * search requests to the appropriate search services and recieving the
   * responses. Responses will then be passed to a SearchResults widget.
   *
   * Search results paging is handled in this widget. Changing pages will
   * result in a new SearchResults widget being spawned and added to the UI.
   */
  $.NewSearchWidget = function(options) {
    jQuery.extend(true, this, {
      startHidden: false,
      tabId: null,
      windowId: null,
      state: null,
      slotAddress: null,
      eventEmitter: null,
      baseObject: null,
      searchService: null,    // Current search service displayed in UI
      searchServices: [],     // SearchServices object, used to cache search services
      element: null,            // Base jQuery object for this widget
      appendTo: null,           // jQuery object in base Mirador that this widget lives
      advancedSearch: null,     // Advanced search widget
      advancedSearchSet: false,        // has the advanced search UI been created?
      searchResults: null,            // UI holding search results
      context: {
        /*
          {
            "searchService": { ... },   // Search service object that includes info.json configs
            "search": {
              "query": "",              // String query
              "offset": "",             // Results offset for paging
              "maxPerPage": "",         // Number of results per page
              "resumeToken": "",        // String token for resuming a search
              "sortOrder": "",          // Sort order value
              "selected": -1,           // Index of the search result that is selected
            }
          }
         */
        search: {
          "offset": 0,
          "maxPerPage": 30
        },
        ui: {}
      },
      config: {                       // Will hold config information for the search UI
        pinned: false,  // Is this search widget pinned to the UI? Only matters if widget is part of a window
        advancedSearchActive: false,
        animated: false,
        hasContextMenu: true,
        allowFacets: true,
        searchBooks: false,     // Will individual books be searchable? Or search only through collections
        inSidebar: false
      },
      facetPanel: null,
      /**
       * Callback function to be executed when a facet is selected that
       * allows the parent object to interact with facets.
       *
       * @param selected - array of facet objects
       *        {
       *          "dim": "facet category id",
       *          "path": ["facet", "values"],
       *          "ui_id": "string ID of the facet UI element"
       *        }
       * Function (selected)
       */
      onFacetSelect: null,
      selectedFacets: {},
      showHideAnimation: "fast"
    }, options);
    if (!this.context) {
      this.context = { search: {"offset": 0, "maxPerPage": 30}, ui: {}};
    }

    this.messages = {
      "no-term": "<span class=\"error\">No search term was found.</span>",
      "no-defaults": "<span class=\"error\">No fields defined for basic search.</span>",
    };
    this.init();
  };

  $.NewSearchWidget.prototype = {
    init: function() {
      var _this = this;

      // Template takes no data. Data added asyncronously later.
      this.element = jQuery(this.template({
        "hidden": this.startHidden,
        "inSidebar": this.config.inSidebar
      })).appendTo(this.appendTo);

      // Do jQuery UI magic to turn dropdown into jQuery SelectMenu
      if (!this.config.inSidebar) {
        this.element.find(".search-within-object-select")
          .iconselectmenu()
          .iconselectmenu("menuWidget")
          .addClass("ui-menu-icons customicons");
      }

      if (this.context) {
        // Handle any context info passed into widget
        this.initFromContext();
      }

      this.initFacets();
      this.bindEvents();

      // Request search services for this manifest, and related
      // As those services are discovered, request info.json configs
      // Populate search dropdowns (done in event handler in #bindEvents)
      if (this.baseObject) {
        console.log("[SW] Getting services related to [" + (this.baseObject["@id"]) + "]");
        this.eventEmitter.publish("GET_RELATED_SEARCH_SERVICES", {
          "origin": _this.windowId,
          "baseObject": _this.baseObject
        });
      }
    },

    bindEvents: function() {
      var _this = this;

      // For now, eagerly fetch info.json for search services as they are discovered :::: This is the cause of the bad performance of the search widget!
      this.eventEmitter.subscribe("RELATED_SEARCH_SERVICES_FOUND." + this.windowId, function(event, data) {
        /*
         * Add search service ID to list.
         * Fetch info.json only when that service is selected for the first time.
         */
        data.services.forEach(function(service) {
          _this.addSearchService(service);
        });
      });

      this.eventEmitter.subscribe("SEARCH_COMPLETE." + this.windowId, function(event, data) {
        _this.handleSearchResults(data.results);
      });

      this.eventEmitter.subscribe("FACETS_COMPLETE." + this.windowId, function(event, data) {
        _this.handleFacets(data.results, data.append);
      });

      this.eventEmitter.subscribe("FACET_SELECTED", function(event, data) {
        if (_this.facetPanel && _this.facetPanel.id === data.origin) {
          _this.facetSelected(data.selected);
        }
      });

      this.eventEmitter.subscribe("windowPinned", function(event, data) {
        if (data.windowId === _this.windowId) {
          _this.config.pinned = data.status;
        }
      });

      this.eventEmitter.subscribe("tabStateUpdated." + this.windowId, function(event, data) {
        if (data.tabs[data.selectedTabIndex].options.id === _this.tabId) {
          _this.element.show();
        } else {
          _this.element.hide();
        }
      });
    },

    listenForActions: function() {
      var _this = this;

      if (typeof this.showHideAnimation === "object") {
        this.showHideAnimation.progress = function() {
          _this.eventEmitter.publish("SEARCH_SIZE_UPDATED." + _this.windowId);
        };
      }

      this.element.find(".search-within-form").on("submit", function(event){
        event.preventDefault();
        var messages = _this.element.find(".pre-search-message");

        messages.empty();

        jQuery.when(_this.currentSearchService()).then(function(service) {
          // Basic search
          if (_this.searchService.config.getDefaultFields().length === 0) {
            jQuery(_this.messages["no-defaults"]).appendTo(messages);
          }

          var query = _this.getSearchQuery();
          if (query && query.length > 0) {
            _this.doSearch(_this.searchService, query, _this.getSortOrder(),
              _this.getFacetsQuery());
          } else {
            jQuery(_this.messages["no-term"]).appendTo(messages);
          }
        });
      });

      function selectChange() {
        var selected = jQuery(this).val();
        _this.getSearchService(selected).done(function(s) {
          _this.switchSearchServices(s);
          _this.eventEmitter.publish("SEARCH_SIZE_UPDATED." + _this.windowId);
        });
      }
      this.element.find(".search-within-object-select").on("change", selectChange);
      if (!this.config.inSidebar) {
        this.element.find(".search-within-object-select").iconselectmenu({
          change: selectChange
        });
      }

      this.element.find(".search-results-close").on("click", function() {
        _this.appendTo.find(".search-results-display").fadeOut(160);
      });

      // if (this.searchService.config.search.settings.fields.length > 0) {
      this.element.find(".search-disclose-btn-more").on("click", function() {
        _this.config.advancedSearchActive = true;
        _this.element.find(".search-disclose-btn-more").hide(0);
        _this.element.find(".search-disclose-btn-less").show(0);
        _this.element.find("#search-form").hide(_this.showHideAnimation);
        _this.element.find(".search-disclose").show(_this.showHideAnimation);
        _this.eventEmitter.publish("SEARCH_SIZE_UPDATED." + _this.windowId);
      });

      this.element.find(".search-disclose-btn-less").on("click", function() {
        _this.config.advancedSearchActive = false;
        _this.element.find(".search-disclose-btn-less").hide(0);
        _this.element.find(".search-disclose-btn-more").show(0);
        _this.element.find("#search-form").show(_this.showHideAnimation);
        _this.element.find(".search-disclose").hide(_this.showHideAnimation);
        _this.eventEmitter.publish("SEARCH_SIZE_UPDATED." + _this.windowId);
      });
      // }
    },

    /**
     * Get the current search query string from the UI. Try to detect
     * where the query will come from, either basic or advanced
     * search widgets.
     *
     * Modify the query to account for any selected facets that would
     * narrow the search results.
     */
    getSearchQuery: function() {
      var query;

      var config = this.searchService.config;
      var delimiters = config.query.delimiters;

      if (this.element.find(".search-disclosure-btn-less").css("display") != "none") {
        // Basic search is active
        query = $.generateBasicQuery(
          this.element.find(".js-query").val(),
          this.searchService.config.getDefaultFields(),
          delimiters.or
        );
      } else {
        query = this.advancedSearch.getQuery();    // Advanced search is active
      }

      // query = this.appendBookList(query);

      return query;
    },

    getFacetsQuery: function() {
      if (!this.searchService.config) {
        console.log("[SW] No search service config info found ... MOOO");
        return;
      } else if (!this.facetPanel) {
        return;
      }

      var query;
      var facets = this.facetPanel.getSelectedNodes();

      if (facets && facets.length > 0) {
        var delimiters = this.searchService.config.query.delimiters;
        var facetParts = [];
        facets
        .forEach(function(f) {
          facetParts.push({
            "op": delimiters.or,
            "category": f.category,
            "term": f.value
          });
        });
        query = $.toTermList(facetParts);
      }

      return query;
    },

    /**
     * Add an object to this widget that you potentially want to search.
     * This object must be a JSON object of a IIIF object.
     *
     * @param object : IIIF object as JSON
     */
    addIIIFObject: function(object) {
      if (!object || typeof object !== "object") {
        return;
      }

      this.eventEmitter.publish("GET_RELATED_SEARCH_SERVICES", {
        "origin": this.windowId,
        "baseObject": object
      });
    },

    addSearchService: function(service) {
      if (!this.config.searchBooks && service["@id"].indexOf("manifest") >= 0) {
        console.log("[SW] Found a book, but ignoring it.");
        return; // End early if encountering a service for a book when they should not be included.
      }

      var _this = this;
      var id = service.id || service["@id"];
      // Search service will likely NOT have an 'id' property, but instead
      //  have a '@id' property. Change this to 'id' for things to work.
      service.id = id;

      // First check search services for duplicates. If service already present
      // with desired ID of this service, update its entry. Otherwise, add it.
      var found = this.searchServices.filter(function(s) {
        return s.id === id;
      });

      if (found.length === 0) {
        // If this is a new service, add it to the UI and push it to
        // the list of known services.
        this.searchServices.push(service);
        this.addServiceToDropdown(id);
      } else {
        found.forEach(function(s) {
          jQuery.extend(true, s, service);  // This will not overwrite any currently present properties.
        });
      }
      // Initialize advanced search with first encountered search service.
      // For subsequent services, if the service is supposed to be selected
      // according to a previous context, switch to it.
      var initialCol = this.state.getStateProperty("initialCollection");
      if (initialCol) {
        if (initialCol && id.indexOf(initialCol) >= 0) {
          // If there is an initialCollection to view, switch to it
          this.getSearchService(id).done(function(s) {
            _this.switchSearchServices(s);
            if (!_this.advancedSearchSet) { _this.listenForActions(); }
            _this.advancedSearchSet = true;
          });
        }
      } else if (this.context.searchService === id) {
        // When adding a search service, if the ID of the service matches the ID of the initialization value, switch to it.
        this.getSearchService(id).done(function(s) {
          _this.switchSearchServices(s);
          if (!_this.advancedSearchSet) { _this.listenForActions(); }
          _this.advancedSearchSet = true;
        });
      } else if (!this.advancedSearchSet) {
        this.getSearchService(id).done(function(s) {
          _this.switchSearchServices(s);
          _this.listenForActions();
        });
        _this.advancedSearchSet = true;
      }
    },

    /**
     * Use knowlege of the DOM structure to insert an element for the
     * input collection in the correct place.
     *
     * @param id {string} ID search service
     */
    addServiceToDropdown: function(id) {
      var _this = this;
      var stylized = !this.config.inSidebar;  // Should do setup for fancy dropdown?
      var col = this.state.getObjFromSearchService(id);
      if (!col) {
        return false;
      }

      var template = {
        "objId": id,
        // ID here is a search service ID, so strip off the trailing portion
        "cssClass": $.Iiif.getCollectionName(id.substring(0, id.lastIndexOf("/"))),
        "label": col.jsonLd.label,
        "inSidebar": stylized
      };

      var moo = this.element.find(".search-within-object-select");
      if (moo.children().length === 0) {  // If no children exist in the dropdown, add it immediately
        moo.append(jQuery(_this.optionTemplate(template)));
        if (stylized) moo.iconselectmenu("refresh");
        return;
      }

      // Make sure we don't add duplicate entries. Match by ID
      var duplicateMatches = moo.children().filter(function(opt) {
        opt = jQuery(opt);
        return opt.attr("value") ? opt.attr("value").substring(0, opt.attr("value").lastIndexOf("/")) == id : false;
      });
      if (duplicateMatches.length > 0) {
        // Desired ID already in dropdown
        return;
      }
      /*
       * We must first get the collection object. From there, we can inspect
       * some metadata. Initial design will not support deeply nested collections.
       *
       * Iterate through all <option>s in the select.
       *   > If the current option data-name matches collection _parent_
       *      - append optionEl after the option, add 'child' css class to optionEl
       *   > If the current option data-name matches collection _child_
       *      - Number of 'child' css classes to add to optionEl = number of
       *        'child' css classes on current option
       *      - Add 'child' css class to current option
       *      - Prepend optionEl before curren option
       *   > If current option data-name matches optionEl name, terminate immediately,
       *     as duplicates must not be added to the list
       */
      moo.children().each(function(index, el) {
        el = jQuery(el);
        var elId = el.attr("value").substring(0, el.attr("value").lastIndexOf("/"));
        var elObj = _this.state.getObjFromSearchService(el.attr("value"));

        if (col.isWithin(elId)) { // Is the object to add a child of this <option>?
          template.cssClass += " child";
          jQuery(_this.optionTemplate(template)).insertAfter(el);
          if (stylized) moo.iconselectmenu("refresh");
        } else if (elObj && elObj.isWithin(id.substring(0, id.lastIndexOf('/')))) { // Is the object to add a parent of this <option>?
          jQuery(_this.optionTemplate(template)).insertBefore(el);
        } else {
          var elCollection = $.Iiif.getCollectionName(elId);
          // Find all children of 'col' that match the current <option>
          var numChildMatches =
            (col.getCollectionUris ? col.getCollectionUris().filter(function(uri) {
              return uri === elId;
            }).length : 0) ||
            (col.getManifestUris ? col.getManifestUris().filter(function(uri) {
              return uri === elId;
            }).length : 0);

          if (numChildMatches > 0) {
            // Count # of times 'child' class appears in current <option>
            var numChilds = (el.attr("class").match(/child/g) || []).length;
            if (numChilds > 0) {
              template.cssClass += " child-" + numChilds;
            }
            jQuery(_this.optionTemplate(template)).insertBefore(el);
            if (stylized) moo.iconselectmenu("refresh");
          }
        }
      });
    },

    /**
     * @param id {string} IIIF object ID
     * @return {object} { type: "object type", name: "object name"}
     */
    getObjectType: function(id) {
      var parts = URI(id).segmentCoded();
      var type;
      var name;

      parts.forEach(function(p, i, arr) {
        if (p === "collection") {
          type = "collection";
          name = arr[i+1];
        } else if (p === "manifest") {
          type = "manifest";
          name = arr[i-1];
        }
      });

      return {
        "type": type,
        "name": name
      };
    },

    /**
     * TODO should not maintain list of search services here, as it duplicates items
     *      already present in the SearchController
     *
     * @param service {string} search service ID
     * @return Deferred that resolves to the service block with info.json data
     */
    getSearchService: function(service) {
      var _this = this;
      var result = jQuery.Deferred();

      this.eventEmitter.subscribe("SEARCH_SERVICE_FOUND." + this.windowId, function(event, data) {
        _this.eventEmitter.unsubscribe("SEARCH_SERVICE_FOUND." + this.windowId);
        if (data.service.id === service) {
          result.resolve(data.service);
        }
      });

      this.eventEmitter.publish("GET_SEARCH_SERVICE", {
        "origin": this.windowId,
        "serviceId": service
      });
      return result;
    },

    currentSearchService: function() {
      if (!this.searchService) {  // Do nothing if no search service has been defined
        return undefined;
      } else if (this.searchService.config) { // Do nothing if search service has already been retrieved.
        return this.searchService;
      }

      var _this = this;
      var result = jQuery.Deferred();

      jQuery.when(this.getSearchService(this.searchService.id)).then(function(service) {
        result.resolve(service);
      }).fail(function() {
        result.reject();
      });

      return result;
    },

    /**
     * Change the UI in response to the user selecting a different search
     * service. Expect that the search service has already been
     * initialized with its info.json configuration information.
     *
     * @param newService {string} ID of the new search service
     */
    switchSearchServices: function(newService) {
      var _this = this;
      this.searchService = newService;

      // Ensure the correct value appears in the 'search-within' dropdown.
      this.element.find(".search-within-object-select").val(newService.id);
      if (!this.config.inSidebar) {
        this.element.find(".search-within-object-select").iconselectmenu("refresh");
      }

      // Switch advanced search UI as needed
      if (this.advancedSearch) {
        this.advancedSearch.destroy();
      }
      _this.advancedSearch = new $.AdvancedSearchWidget({
        "windowId": _this.windowId,
        "slotAddress": _this.slotAddress,
        "searchService": newService,
        "appendTo": _this.element.find(".search-disclose"),
        "eventEmitter": _this.eventEmitter,
        "config": {
          "pinned": _this.config.pinned
        },
        "performAdvancedSearch": function() {
          if (!_this.advancedSearch) {
            console.log("%c No advanced search widget found. Cannot do advanced search.", "color: red;");
            return;
          }
          var facetable = _this.config.allowFacets;
          jQuery.when(_this.currentSearchService()).then(function(s) {
            if (_this.advancedSearch.hasQuery()) {
              var query = _this.advancedSearch.getQuery();

              if (facetable) {
                _this.doSearch(_this.searchService, query, _this.getSortOrder(), _this.getFacetsQuery());
              } else {
                _this.doSearch(_this.searchService, query, _this.getSortOrder());
              }
            }
          });
        },
        "clearMessages": function() { _this.element.find(".pre-search-message").empty(); },
        "context": _this.context,
      });

      this.getFacets();
      this.setDescription();
    },

    /**
     * Change description in UI to the description in currently selected
     * manifest or collection. The appropriate object is found from the
     * current search service.
     */
    setDescription: function() {
      var current = this.state.getObjFromSearchService(this.searchService.id);

      if (current && typeof current.description === "function" && current.description()) {
        this.element.find(".manifest-picker-desc").html(current.description());
      } else {
        this.element.find(".manifest-picker-desc").empty();
      }
    },

    /**
     *
     * @param searchService : search service object
     * @param query : search query
     * @param sortOrder : (OPTIONAL) string specifying sort order of results
     * @param facets : (OPTIONAL) array of facet objects
     * @param page : (OPTIONAL) offset within results set
     * @param maxPerPage : (OPTIONAL) results to display per page
     * @param resumeToken : (OPTIONAL) string token possibly used by a search service
     */
    doSearch: function(searchService, query, sortOrder, facets, offset, maxPerPage, resumeToken) {
      this.context = this.searchState();

      this.context.searchService = searchService;
      this.context.search = {
        "query": query,
        "sortOrder": sortOrder,
        "offset": offset,
        "maxPerPage": maxPerPage,
        "resumeToken": resumeToken,
        "facets": facets
      };

      this.element.find(".search-results-list").empty();
      // TODO show loading icon

      this.eventEmitter.publish("SEARCH", {
        "origin": this.windowId,
        "service": typeof searchService === "object" ? searchService : searchService.id,
        "query": query,
        "offset": offset,
        "maxPerPage": maxPerPage,
        "resumeToken": resumeToken,
        "sortOrder": sortOrder,
        "facets": facets
      });

      this.eventEmitter.publish("SEARCH_SIZE_UPDATED." + this.windowId);
    },

    handleSearchResults: function(searchResults) {
      var _this = this;
      this.element.find(".search-results-list").empty();

      if (!this.perPageCount) {
        this.perPageCount = searchResults.max_matches || searchResults.matches.length;
      }

      this.context.search.results = searchResults;

      this.searchResults = new $.SearchResults({
        "parentId": _this.windowId,
        "slotAddress": _this.slotAddress,
        // "currentObject": _this.context.search.object,
        "currentObject": _this.baseObject,
        "appendTo": _this.element.find(".search-results-list"),
        "eventEmitter": _this.eventEmitter,
        "context": _this.context,
        "config": _this.config
      });

      var last = parseInt(searchResults.offset) + this.perPageCount;
      if (last > searchResults.total) {
        last = searchResults.total;
      }

      if (this.needsPager(searchResults)) {
        var pagerText = this.element.find(".results-pager-text");
        pagerText.empty();
        pagerText.append(this.resultsPagerText({
          "offset": (searchResults.offset + 1),
          "total": searchResults.total,
          "last": last
        }));

        this.setPager(searchResults);
        this.showPager();
      } else {
        this.hidePager();
      }

      this.appendTo.find(".search-results-display").fadeIn(160);
    },

    showAdvancedSearch: function() {
      this.advancedSearchActive = true;
      this.element.find("#search-form").hide("fast");
      this.element.find(".search-disclose").show("fast");
      this.element.find(".search-disclose-btn-more").hide();
      this.element.find(".search-disclose-btn-less").show();
    },

    hideAdvancedSearch: function() {
      this.advancedSearchActive = false;
      this.element.find("#search-form").show("fast");
      this.element.find(".search-disclose").hide("fast");
      this.element.find(".search-disclose-btn-less").hide();
      this.element.find(".search-disclose-btn-more").show();
    },

    showPager: function() {
      this.pagerVisible = true;
      this.element.find(".results-pager").show();
      this.element.find(".results-pager-text").show();
      this.element.find(".results-items").css("top", this.getResultsTop() + "px");
    },

    hidePager: function() {
      this.pagerVisible = false;
      this.element.find(".results-pager").hide();
      this.element.find(".results-pager-text").hide();
      this.element.find(".results-items").css("top", this.getResultsTop() + "px");
    },

    getResultsTop: function() {
      var h = this.element.find(".controls").outerHeight(true);

      if (this.pagerVisible) {
        h += this.element.find(".results-pager").outerHeight(true) +
            this.element.find(".results-pager-text").outerHeight(true);
      }

      return h;
    },

    getSortOrder: function() {
      return this.element.find(".search-results-sorter select").val();
    },

    /**
     * Look for necessary properties that point to the need for paging.
     *
     * @param  results IIIF Search results
     * @return TRUE if paging is needed
     */
    needsPager: function(results) {
      return results.offset > 0 ||
          results.offset + (results.max_matches || results.matches.length) < results.total;
    },

    /**
     * Initialize search results pager. It is assumed that it has already
     * been determined whether or not the pager needs to be created.
     * If a pager is created, it will be inserted into the DOM.
     *
     * @param  results - IIIF Search results
     */
    setPager: function(results) {
      var _this = this;
      var onPageCount = this.perPageCount;

      this.element.find(".results-pager").pagination({
        items: results.total,
        itemsOnPage: onPageCount,
        currentPage: this.float2int(1 + results.offset / onPageCount),
        displayedPages: 2,
        edges: 1,
        cssStyle: "compact-theme",
        ellipsePageSet: true,
        prevText: '<i class="fa fa-lg fa-angle-left"></i>',
        nextText: '<i class="fa fa-lg fa-angle-right"></i>',
        onPageClick: function(pageNumber, event) {
          event.preventDefault();

          var newOffset = (pageNumber - 1) * onPageCount;
          jQuery.when(_this.currentSearchService()).then(function(s) {
            _this.doSearch(
              _this.context.searchService,
              _this.context.search.query,
              _this.context.search.sortOrder,
              _this.config.allowFacets ? _this.getFacetsQuery() : undefined,
              newOffset,
              _this.context.search.numExpected
            );
          });
        }
      });
    },

    /**
     * Do a Bitwise OR to truncate decimal
     *
     * @param  num original number, could be integer or decimal
     * @return integer with any decimal part of input truncated (no rounding)
     */
    float2int: function(num) {
      return num | 0;
    },

    /*
      What information is needed to preserve search UI state?
        * Stuff in UI fields
          - Text in basic search input
          - Selected search service
          - Advanced search:
            > # rows
            > selected boolean op
            > selected category
            > input text/dropdown values
        * Search results
          - Plus selected search result (index in result list?)
     */
    searchState: function() {
      var showAdvanced = this.element.find(".search-disclose-btn-more").css("display") == "none";
      return {
        "searchService": this.element.find(".search-within-object-select").val(),
        "search": {
          "sortOrder": this.getSortOrder(),
          "showAdvanced": showAdvanced,
          "selectedIndex": this.searchResults ? this.searchResults.element.find(".selected").index() : undefined
        },
        "ui": {
          "basic": this.element.find(".js-query").val(),
          "advanced": showAdvanced ? this.advancedSearch.searchState() : undefined
        }
      };
    },

    initFromContext: function() {
      // this.element.find(".search-within-object-select").val(this.context.search.searchService);

      if (this.context.search.sortOrder) {
        this.element.find(".search-results-sorter select").val(this.context.search.sortOrder);
      }
      if (this.context.ui.advanced) {
        this.showAdvancedSearch();
      } else {
        this.element.find(".js-query").val(this.context.ui.basic);
      }

      if (this.context.searchService && this.context.search.query) {
        this.addSearchService(this.context.searchService);
        if (this.context.search.results) {
          this.handleSearchResults(this.context.search.results);
        }
      }
    },

    /**
     * Initialize the facet widget to enable facet search.
     */
    initFacets: function() {
      var _this = this;

      if (this.config.allowFacets) {
        if (this.facetPanel) {
          this.facetPanel.destroy();
        }

        this.facetPanel = new $.FacetPanel({
          "eventEmitter": this.eventEmitter,
          "parentId": this.windowId,
          "appendTo": this.appendTo,
          "state": this.state
        });
      }
    },

    /**
     * Get the label corresponding to the category ID.
     *
     * @param catId {string} category ID
     */
    getCategoryLabel: function(catId) {
      var catConfig = this.searchService.config.search.settings.categories;
      if (!catId || catConfig.filter(function(c) { return c.name === catId; }).length === 0) {
        return;   // Do nothing if there is no matching category
      }

      return catConfig.filter(function(c) {
        return c.name === catId;
      })[0].label;
    },

    /**
     * Get the category ID for a given label. If more than one match
     * is found, return the first possibility.
     *
     * @param catLabel {string} label for a category
     */
    getCategoryId: function(catLabel) {
      var catConfig = this.searchService.config.search.settings.categories;
      if (!catLabel || catConfig.filter(function(c) { return c.label === catLabel; }).length === 0) {
        return;   // Do nothing if there is no matching category
      }

      return catConfig.filter(function(c) {
        return c.label === catLabel;
      })[0].name;
    },

    /**
     * When a facet is selected in the facet panel, do a facet search
     * against the current search service. Repopulate the facet UI
     * with the returned facets. The facet search will also return
     * a list of matching books that should be displayed in the
     * manifests panel.
     *
     * @param selected {array}
     *  {
     *    "category": "...",    // selected category ID
     *    "value": "...",       // selected value, undefined should be treated as empty string
     *    "ui_id": "...",       //
     *    "children": [],       // Any child nodes (only applicable for root nodes)
     *    "isRoot": true|false  // Category that was selected?
     *  }
     */
    facetSelected: function(selected) {
      var _this = this;
      if (!this.facetPanel) {
        return;
      }
      this.getFacets(this.facetPanel.getSelectedNodes());
    },

    getFacets: function(facets) {
      var _this = this;
      if (!this.config.allowFacets) {
        return;
      }

      jQuery.when(this.currentSearchService()).then(function(service) {
        var query;

        if (facets && facets.length > 0) {
          var delimiters = service.config.query.delimiters;
          var facetParts = [];
          facets.forEach(function(f) {
            facetParts.push({
              "op": delimiters.or,
              "category": f.category,
              "term": f.value
            });
          });
          query = $.toTermList(facetParts);
        }

        _this.eventEmitter.publish("GET_FACETS", {
          "origin": _this.windowId,
          "service": service,
          "facets": query
        });
      });
    },

    handleFacets: function(searchResults, append) {
      var _this = this;

      // Update visibility of manifests
      this.bookList = this.getManifestList(searchResults);
      if (this.onFacetSelect) {
        this.onFacetSelect(this.bookList);
      }

      if (!searchResults.categories) {
        console.log("[SW] No categories found in search results. " + searchResults["@id"]);
        return;
      }

      if (this.config.allowFacets && this.facetPanel) {
        jQuery.when(this.resultsCategoriesToFacets(searchResults)).then(function(sr) {
          if (append) {
            sr.categories.forEach(function(cat) {
              _this.facetPanel.addValues(cat.name, cat.values);
            });
          } else {
            _this.facetPanel.setFacets(sr.categories);
          }
          _this.eventEmitter.publish("SEARCH_SIZE_UPDATED." + this.windowId);
        });

      }
    },

    resultsCategoriesToFacets: function(searchResults) {
      if (!searchResults || !Array.isArray(searchResults.categories)) {
        return searchResults;
      }
      var _this = this;
      var result = jQuery.Deferred();
      jQuery.when(this.currentSearchService()).then(function(s) {
        var categoryConfig = s.config.search.settings.categories;

        searchResults.categories.forEach(function(cat) {
          jQuery.extend(cat, {
            "label": _this.getCategoryLabel(cat.name)
          });
        });

        // Filter out any categories that have no label
        searchResults.categories = searchResults.categories.filter(function(cat) {
          return cat.label && cat.label.length > 0;
        });

        result.resolve(searchResults);
      }).fail(function() {
        result.reject();
      });

      return result;
    },

    /**
     * Update the list of valid books from search results. This is
     * designed to be used with search results from facet requests.
     *
     * @param searchResults {object} search results object
     * @returns array of manifest IDs
     */
    getManifestList: function(searchResults) {
      // Create a list of manifests to pass back to to parent, if applicable
      return searchResults.matches.filter(function(m) {
        return m.object["@type"] === "sc:Manifest";
      }).map(function(m) {
        return m.object["@id"];
      });
    },

    resultsPagerText: Handlebars.compile([
      '{{#if last}}',
        'Showing {{offset}} - {{last}} {{#if total}}out of {{total}}{{/if}}',
      '{{/if}}',
    ].join('')),

    // TODO why the heck does this 'if' match to the opposite of what is intended?
    // in Manifest browser, 'inSidebar' === false, but goes through the render path of #if inSidebar
    optionTemplate: Handlebars.compile([
      '{{#if inSidebar}}',
        '<option value="{{objId}}" {{#if cssClass}}data-class="{{cssClass}}"{{/if}}>{{label}}</option>',
      '{{else}}',
        '<option value="{{objId}}">{{label}}</option>',
      '{{/if}}'
    ].join('')),

    template: Handlebars.compile([
      '<div class="searchResults" {{#if hidden}}style="display: none;"{{/if}}>',
        // SearchWithin selector
        '<div class="{{#if inSidebar}}manifest-picker-sidebar{{else}}manifest-picker{{/if}}">',
          '<label>{{#if inSidebar}}Search Within:{{else}}Choose Collection:{{/if}}',
            '<select class="search-within-object-select"></select>',
          '</label>',
          '<div class="manifest-picker-desc"></div>',
        '</div>',
        '<div class="search-widget">',
          '<form id="search-form" class="search-within-form">',
            '<input class="js-query" type="text" aria-label="Enter search query:" placeholder="search"/>',
            '<input type="submit" value="Search"/>',
          '</form>',
          '<div class="search-disclose-btn-more">Advanced Search</div>',
          '<div class="search-disclose-btn-less" style="display: none;">Basic Search</div>',
          '<div class="search-results-sorter">',
            '<label>Sort results by: ',
              '<select>',
                '<option value="relevance">Relevance</option>',
                '<option value="index">Page Order</option>',
              '</select>',
            '</label>',
          '</div>',
          '<div class="search-disclose-container">',
            '<div class="search-disclose" style="display: none;"></div>',
          '</div>',
        '</div>',
        '<div class="search-results-display" style="display:none;">',
          '<div class="search-results-close"><i class="fa fa-2x fa-caret-up" title="Close results"></i>Close results</div>',
          '<div class="results-pager"></div>',
          '<p class="results-pager-text"></p>',
          '<div class="search-results-list"></div>',
        '</div>',
      '</div>',
    ].join(''))
  };

}(Mirador));

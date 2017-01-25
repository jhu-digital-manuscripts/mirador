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
      slotAddress: null,
      eventEmitter: null,
      baseObject: null,
      searchService: null,    // Current search service displayed in UI
      searchServices: [],     // SearchServices object, used to cache search services
      element: null,            // Base jQuery object for this widget
      appendTo: null,           // jQuery object in base Mirador that this widget lives
      advancedSearch: null,     // Advanced search widget
      advancedSearchSet: false,        // has the advanced search UI been created?
      advancedSearchActive: false,
      /*
        {
          "searchService": { ... },   // Search service object that includes info.json configs
          "object": "",               // ID of object being searched
          "search": {
            "query": "",              // String query
            "offset": "",             // Results offset for paging
            "maxPerPage": "",         // Number of results per page
            "resumeToken": "",        // String token for resuming a search
            "selected": -1,           // Index of the search result that is selected
          }
        }
       */
      currentSearch: {},
      searchResults: null,            // UI holding search results
      showHideAnimation: null,        // The actual animation object for jQuery
      config: {                       // Will hold config information for the search UI
        pinned: false,
        advancedSearchActive: false,
        animated: false,
        hasContextMenu: true
      }
    }, options);

    this.messages = {
      "no-term": "<span class=\"error\">No search term was found.</span>",
      "no-defaults": "<span class=\"error\">No fields defined for basic search.</span>",
    };

    this.init();
  };

  $.NewSearchWidget.prototype = {
    init: function() {
      var _this = this;

      if (!this.showHideAnimation) {
        this.showHideAnimation = "fast";
      }

      // Template takes no data. Data added asyncronously later.
      this.element = jQuery(this.template({
        "hidden": this.startHidden
      })).appendTo(this.appendTo);

      this.bindEvents();

      // Request search services for this manifest, and related
      // As those services are discovered, request info.json configs
      // Populate search dropdowns (done in event handler in #bindEvents)
      if (this.baseObject) {
        this.eventEmitter.publish("GET_RELATED_SEARCH_SERVICES", {
          "origin": _this.windowId,
          "baseObject": _this.baseObject
        });
      }
    },

    bindEvents: function() {
      var _this = this;

      // For now, eagerly fetch info.json for search services as they are discovered
      this.eventEmitter.subscribe("RELATED_SEARCH_SERVICES_FOUND", function(event, data) {
        if (data.origin === _this.windowId) {
          data.services.forEach(function(service) {
            _this.eventEmitter.publish("GET_SEARCH_SERVICE", {
              "origin": _this.windowId,
              "serviceId": service.id || service["@id"]
            });
          });
        }
      });

      this.eventEmitter.subscribe("SEARCH_COMPLETE", function(event, data) {
        if (data.origin === _this.windowId) {
          _this.handleSearchResults(data.results);
        }
      });

      // As info.json data is recieved for search services, add them to the UI
      this.eventEmitter.subscribe("SEARCH_SERVICE_FOUND", function(event, data) {
        if (data.origin === _this.windowId) {
          _this.addSearchService(data.service);
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
        var searchTerm = _this.element.find(".js-query").val();

        messages.empty();

        // Basic search
        if (_this.searchService.config.getDefaultFields().length === 0) {
          jQuery(_this.messages["no-defaults"]).appendTo(messages);
        }

        if (searchTerm && searchTerm.length > 0) {
          var query = $.generateBasicQuery(
            searchTerm,
            _this.searchService.config.getDefaultFields(),
            _this.searchService.config.query.delimiters.or
          );
          if (query && query.length > 0) {
            _this.doSearch(_this.searchService, query, _this.getSortOrder());
          }
        } else {
          jQuery(_this.messages["no-term"]).appendTo(messages);
        }
      });

      this.element.find(".search-within-object-select").on("change", function() {
        var selected = jQuery(this).val();
        _this.switchSearchServices(_this.getSearchService(selected));
        _this.eventEmitter.publish("SEARCH_SIZE_UPDATED." + _this.windowId);
      });

      this.element.find(".search-results-close").on("click", function() {
        _this.appendTo.find(".search-results-display").fadeOut(160);
      });

      if (this.searchService.config.search.settings.fields.length > 0) {
        this.element.find(".search-disclose-btn-more").on("click", function() {
          _this.advancedSearchActive = true;
          _this.element.find(".search-disclose-btn-more").hide(0);
          _this.element.find(".search-disclose-btn-less").show(0);
          _this.element.find("#search-form").hide(_this.showHideAnimation);
          _this.element.find(".search-disclose").show(_this.showHideAnimation);
          _this.eventEmitter.publish("SEARCH_SIZE_UPDATED." + _this.windowId);
        });

        this.element.find(".search-disclose-btn-less").on("click", function() {
          _this.advancedSearchActive = false;
          _this.element.find(".search-disclose-btn-less").hide(0);
          _this.element.find(".search-disclose-btn-more").show(0);
          _this.element.find("#search-form").show(_this.showHideAnimation);
          _this.element.find(".search-disclose").hide(_this.showHideAnimation);
          _this.eventEmitter.publish("SEARCH_SIZE_UPDATED." + _this.windowId);
        });
      }
    },

    /**
     * Add an object to this widget that you potentially want to search.
     * Thist object must be a JSON object of a IIIF object.
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
      var _this = this;
      var id = service.id || service["@id"];
      var label = service.service.label || id;

      // Search service will likely NOT have an 'id' property, but instead
      //  have a '@id' property. Change this to 'id' for things to work.
      service.id = id;

      // First check search services for duplicates. If service already present
      // with desired ID of this service, update its entry. Otherwise, add it.
      var found = this.searchServices.filter(function(s) {
        return s.id === id;
      });

      if (found.length === 0) {
        var selectEl = this.element.find(".search-within-object-select");
        // If this is a new service, add it to the UI and push it to
        // the list of known services.
        this.searchServices.push(service);
        selectEl.append(jQuery("<option value=\"" + id + "\">" + label + "</option>"));

        var my_options = this.element.find(".search-within-object-select option");
        var selected = selectEl.val();

        /*
         * Hacky way of sorting by type and name. The drop down is then sorted
         * first by type, then each type will be sorted by its search ID. IIIF
         * Collections are placed at the top.
         *
         * For the JHU IIIF service, this works out because each book name
         * contains information about its containing collection:
         *    JHU Name: <collectionName>.<bookName>
         *
         * NOTE: this can not be used generally. The IIIF spec RECOMMENDS the URL
         *       structure that this relies on, but does not make it required.
         *       Other IIIF services could potentially use different URL schemes.
         */
        my_options.sort(function(a,b) {
          var objA = _this.getObjectType(a.value);
          var objB = _this.getObjectType(b.value);

          if (objA.type === objB.type) {
            return a.value.toLowerCase().localeCompare(b.value.toLowerCase());
          } else if (objA.type === "collection") {
            return -1;
          } else if (objB.type === "collection") {
            return 1;
          }

          return 0;
        });

        selectEl.empty().append( my_options );
        selectEl.val(selected);

      } else {
        found.forEach(function(s) {
          jQuery.extend(true, s, service);  // This will not overwrite any currently present properties.
        });
      }

      if (!this.advancedSearchSet) {
        this.switchSearchServices(service);
        this.advancedSearchSet = true;
        this.listenForActions();
      }
    },

    /**
     * @param id {string} IIIF object ID
     * @return {object} { type: "object type", name: "object name"}
     */
    getObjectType: function(id) {
      var parts = id.split("/");
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
     *
     *
     * @param service {string} search service ID
     * @return the service block with info.json data
     */
    getSearchService: function(service) {
      var res = this.searchServices.filter(function(s) {
        return s.id === service;
      });

      if (res.length > 1) {
        console.log("[SearchWidget] duplicate search services found. " + service);
      }

      return res.length === 0 ? null : res[0];
    },

    /**
     * Change the UI in response to the user selecting a different search
     * service.
     *
     * @param newService {string} ID of the new search service
     */
    switchSearchServices: function(newService) {
      var _this = this;
      this.searchService = newService;

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
          if (_this.advancedSearch.hasQuery()) {
            _this.doSearch(_this.searchService, _this.advancedSearch.getQuery(), _this.getSortOrder());
          }
        },
        "clearMessages": function() { _this.element.find(".pre-search-message").empty(); },
      });
    },

    /**
     *
     * @param searchService : search service object
     * @param query : search query
     * @param sortOrder : (OPTIONAL) string specifying sort order of results
     * @param page : (OPTIONAL) offset within results set
     * @param maxPerPage : (OPTIONAL) results to display per page
     * @param resumeToken : (OPTIONAL) string token possibly used by a search service
     */
    doSearch: function(searchService, query, sortOrder, offset, maxPerPage, resumeToken) {
      this.currentSearch = {
        "searchService": searchService,
        "object": this.element.find(".search-within-object-select").val(),
        "search": {
          "query": query,
          "sortOrder": sortOrder,
          "offset": offset,
          "maxPerPage": maxPerPage,
          "resumeToken": resumeToken
        }
      };

      this.element.find(".search-results-list").empty();
      // TODO show loading icon

      this.eventEmitter.publish("SEARCH", {
        "origin": this.windowId,
        "serviceId": searchService.id,
        "query": query,
        "offset": offset,
        "maxPerPage": maxPerPage,
        "resumeToken": resumeToken,
        "sortOrder": sortOrder
      });

      this.eventEmitter.publish("SEARCH_SIZE_UPDATED." + this.windowId);
    },

    handleSearchResults: function(searchResults) {
      var _this = this;

      if (!this.perPageCount) {
        this.perPageCount = searchResults.max_matches || searchResults.matches.length;
      }

      this.currentSearch.results = searchResults;

      this.searchResults = new $.SearchResults({
        "parentId": _this.windowId,
        "slotAddress": _this.slotAddress,
        "currentObject": _this.currentSearch.object,
        "appendTo": _this.element.find(".search-results-list"),
        "searchResults": searchResults,
        "eventEmitter": _this.eventEmitter,
        "config": {
          "hasContextMenu": _this.config.hasContextMenu
        }
      });

      if (this.needsPager(searchResults)) {
        var pagerText = this.element.find(".results-pager-text");
        pagerText.empty();
        pagerText.append(this.resultsPagerText({
          "offset": (searchResults.offset + 1),
          "total": searchResults.total,
          "last": (parseInt(searchResults.offset) + this.perPageCount)
        }));

        this.setPager(searchResults);
        this.showPager();
      } else {
        this.hidePager();
      }

      this.appendTo.find(".search-results-display").fadeIn(160);
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
          _this.doSearch(
            _this.currentSearch.searchService,
            _this.currentSearch.search.query,
            _this.currentSearch.search.sortOrder,
            newOffset,
            _this.currentSearch.search.numExpected
          );
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

    resultsPagerText: Handlebars.compile([
      '{{#if last}}',
        'Showing {{offset}} - {{last}} {{#if total}}out of {{total}}{{/if}}',
      '{{/if}}',
    ].join('')),

    template: Handlebars.compile([
      '<div class="searchResults" {{#if hidden}}style="display: none;"{{/if}}>',
        // SearchWithin selector
        '<div>',
          'Search within: ',
          '<select class="search-within-object-select"></select>',
        '</div>',
        '<form id="search-form" class="search-within-form">',
          '<input class="js-query" type="text" placeholder="search"/>',
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
        '<div class="search-results-close"><i class="fa fa-2x fa-caret-up" title="Close results"></i></div>',
        '<div class="results-pager"></div>',
        '<p class="results-pager-text"></p>',
        '<div class="search-results-list"></div>',
      '</div>'
    ].join(''))
  };

}(Mirador));

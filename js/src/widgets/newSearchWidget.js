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
      tabId: null,
      windowId: null,
      slotAddress: null,
      eventEmitter: null,
      manifest: null,
      searchService: null,    // Current search service displayed in UI
      searchServices: [],     // SearchServices object, used to cache search services
      element: null,            // Base jQuery object for this widget
      appendTo: null,           // jQuery object in base Mirador that this widget lives
      advancedSearch: null,     // Advanced search widget
      advancedSearchSet: false,        // has the advanced search UI been created?
      advancedSearchActive: false,
      pinned: false,            // Is this search widget pinned to the UI? Only matters if widget is part of a window
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
        currentSearch: {},
        ui: {}
      }
    }, options);

    this.messages = {
      "no-term": "<span class=\"error\">No search term was found.</span>",
      "no-defaults": "<span class=\"error\">No fields defined for basic search.</span>",
    };
if (this.searchContext) {
  console.log("Existing search context found. " + JSON.stringify(this.searchContext, null, 2));
}
    this.init();
  };

  $.NewSearchWidget.prototype = {
    init: function() {
      var _this = this;

      // Template takes no data. Data added asyncronously later.
      this.element = jQuery(this.template()).appendTo(this.appendTo);

      this.bindEvents();

      // Request search services for this manifest, and related
      // As those services are discovered, request info.json configs
      // Populate search dropdowns (done in event handler in #bindEvents)
      this.eventEmitter.publish("GET_RELATED_SEARCH_SERVICES", {
        "origin": _this.windowId,
        "manifest": _this.manifest
      });
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
          _this.pinned = data.status;
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
      });

      if (this.searchService.config.search.settings.fields.length > 0) {
        this.element.find(".search-disclose-btn-more").on("click", function() {
          _this.advancedSearchActive = true;
          _this.element.find("#search-form").hide("fast");
          _this.element.find(".search-disclose").show("fast");
          _this.element.find(".search-disclose-btn-more").hide();
          _this.element.find(".search-disclose-btn-less").show();
        });

        this.element.find(".search-disclose-btn-less").on("click", function() {
          _this.advancedSearchActive = false;
          _this.element.find("#search-form").show("fast");
          _this.element.find(".search-disclose").hide("fast");
          _this.element.find(".search-disclose-btn-less").hide();
          _this.element.find(".search-disclose-btn-more").show();
        });
      }
    },

    addSearchService: function(service) {
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
        // If this is a new service, add it to the UI and push it to
        // the list of known services.
        this.searchServices.push(service);
        this.element.find(".search-within-object-select")
          .append(jQuery("<option value=\"" + id + "\">" + label + "</option>"));
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
        "windowPinned": _this.pinned,
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

      // Assuming the UI was created successfully, set the current
      // search service to the one provided to this function
      // this.listenForActions();
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
        "currentObject": _this.manifest.getId(),
        "appendTo": _this.element.find(".search-results-list"),
        "searchResults": searchResults,
        "eventEmitter": _this.eventEmitter,
        "context": _this.context
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
        * Search services? (so we don't have to go through the crawl/request crap again)
     */
    state: function() {
      return {
        "search": {
          "searchService": this.element.find(".searech-within-object-select").val(),
          "sortOrder": this.element.find(".search-results-sorter select").val(),
          "selectedIndex": this.searchResults.searchResults ? this.searchResults.element.find(".selected").index() : undefined
        },
        "ui": {
          "basic": this.element.find(".js-query").val(),
          "advanced": this.advancedSearch.state()
        }
      };
    },

    resultsPagerText: Handlebars.compile([
      '{{#if last}}',
        'Showing {{offset}} - {{last}} {{#if total}}out of {{total}}{{/if}}',
      '{{/if}}',
    ].join('')),

    template: Handlebars.compile([
      '<div class="searchResults" style="display: none;">',
        // SearchWithin selector
        '<div class="">',
          '<p>',
            'Search within: ',
            '<select class="search-within-object-select"></select>',
          '</p>',
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
        '<p class="pre-search-message"></p>',
        '<div class="results-pager"></div>',
        '<p class="results-pager-text"></p>',
        '<div class="search-results-list"></div>',
      '</div>',
    ].join(''))
  };

}(Mirador));

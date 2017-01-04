(function($){
  /**
   * This object is responsible for creating the basic and advanced search UI
   * anywhere in Mirador. This object is responsible for forming and sending
   * search requests to the appropriate search services and recieving the
   * responses. Responses will then be passed to a SearchResults widget.
   */
  $.NewSearchWidget = function(options) {
    jQuery.extend(true, this, {
      tabId: null,
      windowId: null,
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

      // Template takes no data. Data added asyncronously later.
      this.element = jQuery(this.template()).appendTo(this.appendTo);

      this.bindEvents();

      // Request search services for this manifest, and related
      // As those services are discovered, request info.json configs
      // Populate search dropdowns (done in event handler in #bindEvents)
      this.eventEmitter.publish("GET_RELATED_SEARCH_SERVICES", {
        "id": _this.windowId,
        "manifest": _this.manifest
      });
    },

    bindEvents: function() {
      var _this = this;

      // For now, eagerly fetch info.json for search services as they are discovered
      this.eventEmitter.subscribe("RELATED_SEARCH_SERVICES_FOUND", function(event, data) {
        if (data.id === _this.windowId) {
          data.services.forEach(function(service) {
            _this.eventEmitter.publish("GET_SEARCH_SERVICE", {
              "id": _this.windowId,
              "serviceId": service.id || service["@id"]
            });
          });
        }
      });

      // As info.json data is recieved for search services, add them to the UI
      this.eventEmitter.subscribe("SEARCH_SERVICE_FOUND", function(event, data) {
        if (data.id === _this.windowId) {
          _this.addSearchService(data.service);
        }
      });

      this.eventEmitter.subscribe('windowPinned', function(event, data) {
        if (data.windowId === _this.windowId) {
          _this.pinned = data.status;
        }
      });

      this.eventEmitter.subscribe('tabStateUpdated.' + this.windowId, function(event, data) {
        if (data.tabs[data.selectedTabIndex].options.id === _this.tabId) {
          _this.element.show();
        } else {
          _this.element.hide();
        }
      });
    },

    listenForActions: function() {
      var _this = this;
      this.element.find(".search-within-form").on('submit', function(event){
        event.preventDefault();
        var messages = _this.element.find('.pre-search-message');
        var searchTerm = _this.element.find('.js-query').val();

        messages.empty();

        if (_this.advancedSearchActive) {
          // Advanced search
          console.log("[AdvancedSearch] " + _this.advancedSearch.getQuery());

        } else {
          console.log("[SW] Basic search.");
          // Basic search
          if (_this.searchService.config.getDefaultFields().length === 0) {
            jQuery(_this.messages['no-defaults']).appendTo(messages);
          }

          if (searchTerm && searchTerm.length > 0) {
            var query = $.generateBasicQuery(
              searchTerm,
              _this.searchService.config.getDefaultFields(),
              _this.searchService.config.query.delimiters.or
            );
            if (query && query.length > 0) {
              // TODO do search
              console.log("[Search] " + query);
            }
          } else {
            jQuery(_this.messages['no-term']).appendTo(messages);
          }
        }
      });

      this.element.find(".search-within-object-select").on("change", function() {
        var selected = jQuery(this).val();
        _this.switchSearchServices(_this.getSearchService(selected));
      });

      if (this.searchService.config.search.settings.fields.length > 0) {
        this.element.find('.search-disclose-btn-more').on('click', function() {
          _this.advancedSearchActive = true;
          _this.element.find('#search-form').hide('fast');
          _this.element.find('.search-disclose').show('fast');
          _this.element.find('.search-disclose-btn-more').hide();
          _this.element.find('.search-disclose-btn-less').show();
        });

        this.element.find('.search-disclose-btn-less').on('click', function() {
          _this.advancedSearchActive = false;
          _this.element.find('#search-form').show('fast');
          _this.element.find('.search-disclose').hide('fast');
          _this.element.find('.search-disclose-btn-less').hide();
          _this.element.find('.search-disclose-btn-more').show();
        });
      }
    },

    clearMessages: function() {
      this.element.find(".pre-search-message").empty();
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
        this.searchServices.push(service);
      } else {
        found.forEach(function(s) {
          jQuery.extend(true, s, service);  // This will not overwrite any currently present properties.
        });
      }

      if (!this.advancedSearchSet) {
        this.switchSearchServices(service);
        this.advancedSearchSet = true;
      }

      this.element.find(".search-within-object-select")
        .append(jQuery("<option value=\"" + id + "\">" + label + "</option>"));
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
        "searchService": newService,
        "appendTo": _this.element.find(".search-disclose"),
        "eventEmitter": _this.eventEmitter,
        "windowPinned": _this.pinned,
        "performAdvancedSearch": _this.performAdvancedSearch,
        "clearMessages": _this.clearMessages,
      });

      // Assuming the UI was created successfully, set the current
      // search service to the one provided to this function
      this.listenForActions();
    },

    /**
     * Potentially called from within an instance of $.AdvancedSearchWidget
     * "this" will not behave as expected. It will take the scope of the
     * calling object, not the $.NewSearchWidget object.
     */
    performAdvancedSearch: function(advancedSearchObj) {
      _aso = advancedSearchObj;
      if (!advancedSearchObj) {
        console.log("[SW] No advanced search widget has been set.");
        return;
      }
      console.log("[SW] Will perform advanced search here. " + advancedSearchObj + " ::: " + this.searchService);
      if (!advancedSearchObj.hasQuery()) {
        console.log("[SW] No advanced search query!");
      }
    },

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
        '<div class="search-results-list"></div>',
      '</div>',
    ].join(''))
  };

}(Mirador));

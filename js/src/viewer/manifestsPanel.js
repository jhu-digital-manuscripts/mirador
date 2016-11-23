(function($) {

  $.ManifestsPanel = function(options) {

    jQuery.extend(true, this, {
      element:                    null,
      listItems:                  null,
      appendTo:                   null,
      parent:                     null,
      manifestListItems:          [],
      manifestListElement:        null,
      manifestLoadStatusIndicator: null,
      resultsWidth:               0,
      searchServices: [],
      cachedKeys: []
    }, options);

    var _this = this;
    _this.init();

  };

  $.ManifestsPanel.prototype = {

    init: function() {
      var _this = this;

      jQuery.unsubscribe("searchServiceDiscovered");
      this.element = jQuery(this.template({
        showURLBox : this.parent.showAddFromURLBox
      })).appendTo(this.appendTo);
      this.manifestListElement = this.element.find('ul');

      //this code gives us the max width of the results area, used to determine how many preview images to show
      //cloning the element and adjusting the display and visibility means it won't break the normal flow
      var clone = this.element.clone().css("visibility","hidden").css("display", "block").appendTo(this.appendTo);
      this.resultsWidth = clone.find('.select-results').outerWidth();
      this.controlsHeight = clone.find('.manifest-panel-controls').outerHeight();
      this.paddingListElement = this.controlsHeight;
      this.manifestListElement.css("padding-bottom", this.paddingListElement);
      clone.remove();

// -----------------------------------------------------------------------------
// ----- REMOVE ----------------------------------------------------------------
      this.addSearchService({
        "id": "http://localhost:8080/iiif-pres/collection/top/jhsearch",
        // "id": "http://rosetest.library.jhu.edu/iiif-pres/collection/top/jhsearch",
        "label": "All JHU collections"
      });
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------

      this.bindEvents();
    },

    /**
     * @returns jQuery promise that resolves when a search service with the
     *          desired ID is found. The service may be cached in memory, or
     *          it may be retrieved by following the ID to get the service info.json
     *          #getService("service-url-id").done(function(jhiiifSearchService) { ... });
     */
    getSearchService: function(id) {
      if (!id) {
        console.log("[ManifestsPanel] Failed to get search service, no ID provided.");
        return;
      }

      var service = jQuery.Deferred();

      var s = this.searchServices.filter(function(service) {
        return service.id === id;
      });
      if (s.length === 1 && s[0].service) {
        service.resolve(s[0].service);
      } else if (s.length > 0) {
        // Only ONE should appear here, as it matches IDs, however, if
        // for some reason, more than one are matched, just pick the first
        var _this = this;
        var jhservice = new $.JhiiifSearchService({ "id": s[0].id });
        jhservice.initializer.done(function() {
          s[0].service = jhservice;
          service.resolve(jhservice);
        });
      } else {
        console.log("[ManifestsPanel] No search service found for ID: " + id);
      }

      return jQuery.when(service);
    },

    bindEvents: function() {
      var _this = this;
      // handle interface events
      this.element.find('form#url-load-form').on('submit', function(event) {
        event.preventDefault();
        var url = jQuery(this).find('input').val();
        _this.parent.addManifestFromUrl(url, "(Added from URL)");
        //console.log('trying to add from URL');
      });

      this.element.find('.remove-object-option').on('click', function() {
        _this.parent.toggleLoadWindow();
      });

      // handle subscribed events
      jQuery.subscribe("searchServiceDiscovered", function(event, data) {
        _this.addSearchService(data);
      });

      jQuery.subscribe('manifestsPanelVisible.set', function(_, stateValue) {
         if (stateValue) { _this.show(); return; }
          _this.hide();
      });

      jQuery.subscribe('manifestReceived', function(event, newManifest) {
        _this.manifestListItems.push(new $.ManifestListItem({ parent: _this, manifest: newManifest, resultsWidth: _this.resultsWidth }));
        _this.element.find('#manifest-search').keyup();
      });

      this.element.find(".browser-search-results .controls .close").on("click", function() {
        _this.element.find(".browser-search-results").hide();
      });

      // Filter manifests based on user input
      // this.element.find('#manifest-search').on('keyup input', function() {
      //  if (this.value.length > 0) {
      //   _this.element.find('.items-listing li').show().filter(function() {
      //    return jQuery(this).text().toLowerCase().indexOf(_this.element.find('#manifest-search').val().toLowerCase()) === -1;
      //   }).hide();
      //  } else {
      //   _this.element.find('.items-listing li').show();
      //  }
      // });

      this.element.find('#manifest-search-form').on('submit', function(event) {
        event.preventDefault();
        var searchTerm = jQuery("#manifest-search").val();

        if (!searchTerm || searchTerm.length === 0) {
          return;
        }

        // Do searchy stuff
        var serviceId = jQuery("#search-service-select").val();
        var serviceReq = _this.getSearchService(serviceId);

        serviceReq.done(function(service) {
          if (service.getDefaultFields().length === 0) {
            // jQuery(_this.messages['no-defaults']).appendTo(messages);
            console.log("[ManifestsPanel] No default search fields specified " +
                "for this service. Cannot do search.\nID: " + serviceId);
          }

          var query = $.generateBasicQuery(
            searchTerm,
            service.getDefaultFields(),
            service.query.delimiters.or
          );

          if (query && query.length > 0) {
            // _this.displaySearchWithin(query);
            console.log("### " + query);
            _this.doSearch(service, query);
          }
        });

      });

      jQuery(window).resize($.throttle(function(){
        var clone = _this.element.clone().css("visibility","hidden").css("display", "block").appendTo(_this.appendTo);
        _this.resultsWidth = clone.find('.select-results').outerWidth();
        clone.remove();
        jQuery.publish("manifestPanelWidthChanged", _this.resultsWidth);
      }, 50, true));
    },

    /**
     * @param searchService service block { "id": "...", "@context": "...", ... }
     * @param query search query {string}
     * @param (optional) offset {int} results offset for paging
     * @param (optional) numExpected {int} number of results to return for paging
     * @param (optional) sortOrder {string} (index|relevance) Default value: relevance
     */
    doSearch: function(searchService, query, offset, numExpected, sortOrder) {
      var _this = this;
      var queryUrl = searchService.id + "?q=" + encodeURIComponent(query);

      if (offset && typeof offset === 'number') {
        queryUrl += "&o=" + offset;
      }
      if (numExpected && typeof numExpected === 'number') {
        queryUrl += "&m=" + numExpected;
      }
      if (sortOrder) {
        queryUrl += "&so=" + (sortOrder === "index" ? sortOrder : "relevance");
      }

      // Can cache search results here
      var cached = this.cache(queryUrl);
      if (cached) {
        // If result already cached, use that result
        this.handleResults(JSON.parse(cached));
        return;
      }

      // Make the request if not found in cache
      var request = jQuery.ajax({
        url:   queryUrl,
        dataType: 'json',
        cache: true,
      })
      .done(function(searchResults) {
        _this.cache(queryUrl, JSON.stringify(searchResults), true);
        _this.handleResults(searchResults);
      })
      .fail(function(jqXHR, textStatus, errorThrown) {
        console.log("[SearchResults] window=" + _this.parent.parent.id + " search query failed (" + queryUrl + ") \n" + errorThrown);
      });
    },

    addSearchService: function(service) {
      var id = service.id || service["@id"];
      var label = service.label || id;

      // Search service will likely NOT have an 'id' property, but instead
      //  have a '@id' property. Change this to 'id' for things to work.
      service.id = id;
      this.searchServices.push(service);

      this.element.find("#manifest-search-form select")
        .append(jQuery("<option value=\"" + id + "\">" + label + "</option>"));
    },

    /**
     * Read from or write to cache.
     *
     * If 'value' is provided, it will be stored in cache under key = id.
     * If no 'value' is provided, it is read from cache using the provided
     * id as the key.
     *
     * When writing to cache, it is possible that storate will be full. If this
     * is the case, the write can be forced, which will clear the cache and
     * attempt the write again.
     *
     * @param  (string) id    ID of object in cache
     * @param  (string) value value to put into cache
     * @param  (boolean) force - if writing, this will retry attempt if an error occurs
     * @return cached object if reading from cache
     */
    cache: function(id, value, force) {
      console.assert(id, '[SearchResults] cache ID must be provided');
      var _this = this;

      if (!value) {
        // No value provided, read this ID from cache
        return sessionStorage.getItem(id);

      } else {
        // Value provided, add this to cache
        try {
          this.cachedKeys.push(id);
          sessionStorage.setItem(id, value);
        } catch (e) {
          if (e === 'QuotaExceededError' && force) {
            // sessionStorage.clear();
            this.cachedKeys.forEach(function(key) { sessionStorage.removeItem(key); });
            this.cachedKeys = [];
            _this.cache(id, value, false);
          } else {
            console.log('[SearchResults] Unexpected error encountered while writing search result to cache. ' + e);
          }
        }
      }
    },

    handleResults: function(searchResults) {
      if (!searchResults) {
        return;
      }

      var _this = this;
      this.element.find(".browser-search-results").show();
      new $.BrowserSearchResults({
        appendTo: _this.element.find(".results-items"),
        viewer: _this.parent,
        searchResults: searchResults
      });
    },

    hide: function() {
      var _this = this;
      jQuery(this.element).hide({effect: "fade", duration: 160, easing: "easeOutCubic"});
    },

    show: function() {
      var _this = this;
      jQuery(this.element).show({effect: "fade", duration: 160, easing: "easeInCubic"});
    },

    template: Handlebars.compile([
      '<div id="manifest-select-menu">',
      '<div class="container">',
        '<div class="manifest-panel-controls">',
          '<a class="remove-object-option"><i class="fa fa-times fa-lg fa-fw"></i>{{t "close"}}</a>',
          '<div id="load-controls">',
            '{{#if showURLBox}}',
              '<form action="" id="url-load-form">',
                '<label for="url-loader">{{t "addNewObject"}}:</label>',
                '<input type="text" id="url-loader" name="url-load" placeholder="http://...">',
                '<input type="submit" value="Load">',
              '</form>',
            '{{/if}}',
            '<form action="" id="manifest-search-form">',
              '<label for="manifest-search">Search: </label>',
              '<input id="manifest-search" type="text" name="manifest-filter">',
              '<label for="search-service-select">Within: </label>',
              '<select id="search-service-select" name="service-picker"></select>',
              '<button type="submit">',
                '<i class="fa fa-lg fa-search"></i>',
              '</button>',
            '</form>',
          '</div>',
        '</div>',
          '<div class="select-results">',
            '<ul class="items-listing">',
            '</ul>',
          '</div>',
      '</div>',
      // New search results modal
      '<div class="browser-search-results">',
        '<div class="controls">',
          '<i class="fa fa-2x fa-times close"></i>',
        '</div>',
        '<div class="results-items"></div>',
      '</div>',
      '</div>'
    ].join(''))
  };

}(Mirador));

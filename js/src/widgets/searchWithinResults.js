(function($) {

  /**
   * UI + logic to get search results for a given search query. On initialization,
   * the provided search query is given tothe provided IIIF Search service.
   * The response is displayed as a list.
   *
   * Currently follows IIIF Search API v0.9.1-draft
   * (http://iiif.io/api/search/0.9/)
   */
  $.SearchWithinResults = function(options) {

    jQuery.extend(this, {
      appendTo:             null,
      manifest:             null,
      element:              null,
      parent:               null,
      metadataTypes:        null,
      metadataListingCls:   'metadata-listing',
      query:                null,
      results:              null,
      searchPrefix:         'jhsearch',
      searchCollection:     null,
      baseUrl:              null,
      searchContext:        {},
      pinned:               false,
      loading:              '<i class="fa fa-fw fa-2x fa-spinner fa-spin"></i>',
    }, options);

    this.init();
  };

  $.SearchWithinResults.prototype = {

    init: function() {
      this.registerHandlebars();

      this.element = jQuery(this.wrapper()).appendTo(this.appendTo);

      if (this.query) {
        // Query from UI
        this.search(this.query);
      } else if (this.searchContext.queryUrl) {
        // Initial URL value from changing manifests during a search
        this.initFromUrl(this.searchContext.queryUrl);
      }
    },

    /**
     * Perform search from a URL. The URL parameter is parsed to obtain
     * necessary information:
     *  - baseUrl of search (which IIIF object is being searched in)
     *  - search parameters (q, o, m, r)
     *
     * From this information, the search is conducted in the usual way
     * in order to maintain paging functionality.
     *
     * TODO this could become obsolete if the Window is given a way to change
     * 			manifests without clearing all window content
     *
     * @param  (string) url search ID
     * @return none
     */
    initFromUrl: function(url) {
      console.assert(url, '[SearchResults#initFromUrl] provided URL must exist.');

      // Parse URL with <a>
      var parser = document.createElement('a');
      parser.href = url;

      var parts = parser.search.split('&');
      var q = {};
      parts.forEach(function(part, index, array) {
        var moreParts = part.split('=');
        if (moreParts.length !== 2) {
          console.log('[SearchResults] malformed query string found in search URL: ' + url);
          return;
        }

        if (moreParts[0].charAt(0) === '?') {
          moreParts[0] = moreParts[0].substring(1);
        }
        q[moreParts[0]] = moreParts[1];
      });

      var baseUrl = url.substring(0, url.indexOf('?'));

      // Remove trailing slash
      if (baseUrl.charAt(baseUrl.length - 1) === '/') {
        baseUrl = baseUrl.slice(0, baseUrl.length - 1);
      }
      // Remove search prefix if necessary
      if (baseUrl.slice(baseUrl.lastIndexOf('/')+1) === this.searchPrefix) {
        baseUrl = baseUrl.slice(0, baseUrl.length - this.searchPrefix.length);
      }

      this.baseUrl = baseUrl;
      this.search(q.q, parseInt(q.o), parseInt(q.m), q.so);
    },

    /**
     * Submit AJAX request to search service. The returned results are displayed
     * in the results '.search-results-container'
     *
     * @param  'string' query       query string, using server query syntax
     * @param  'number' offset      (OPTIONAL) offset within total results list, if paged
     * @param  'number' numExpected (OPTIONAL) number of results to return, if results are paged
     * @param  'string' resumeToken (OPTIONAL) resume token for the search service to resume a paged search
     * @return                      the JSON-LD search results from the search service
     */
    search: function(query, offset, numExpected, sortOrder) {
      console.assert(query && typeof query === 'string', "Query must exist and must be a String");
      console.assert(offset ? typeof offset === 'number' : true, "Offset value provided must be a number.");
      console.assert(numExpected ? typeof numExpected === 'number' : true, "numExpected value provided must be a number.");
      console.assert(sortOrder ? typeof sortOrder === 'string' : true, "sortOrder value provided must be a string.");
      var _this = this;

      this.query = query;

      // Create request URL from parameters
      var queryUrl = this.baseUrl +
          (this.baseUrl.charAt(this.baseUrl.length - 1) !== '/' ? '/' : '');

      queryUrl += this.searchPrefix + '?q=' + this.query;
      if (numExpected) {
        queryUrl += '&m=' + numExpected;
      }
      if (sortOrder) {
        queryUrl += '&so=' + sortOrder;
      } else {
        queryUrl += '&so=' + _this.searchContext.sortOrder;
      }
      if (offset) {
        queryUrl += '&o=' + offset;
      }

      this.queryUrl = queryUrl;
      this.searchFromUrl(queryUrl);
    },

    searchFromUrl: function(queryUrl) {
      var _this = this;
      // Clear search related stuff
      this.searchResults = null;
console.log('[Searching] ' + queryUrl);
      jQuery(this.appendTo).find('.search-results-container').empty();
      var loader = jQuery(this.loading).appendTo(this.element.find('.search-results-container'));

      var cached = this.cache(queryUrl);
      if (cached) {
        // If result already cached, use that result
        this.processResults(JSON.parse(cached));
        loader.remove();
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
        _this.processResults(searchResults);
      })
      .fail(function(jqXHR, textStatus, errorThrown) {
        console.log("[SearchResults] window=" + _this.parent.parent.id + " search query failed (" + queryUrl + ") \n" + errorThrown);
        jQuery(_this.errorMessage()).appendTo(_this.appendTo);
      })
      .always(function() {
        loader.remove();
      });
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
          sessionStorage.setItem(id, value);
        } catch (e) {
          if (e === 'QuotaExceededError' && force) {
            sessionStorage.clear();
            _this.cache(id, value, false);
          } else {
            console.log('[SearchResults] Unexpected error encountered while writing search result to cache. ' + e);
          }
        }
      }
    },

    processResults: function(searchResults) {
      this.searchResults = searchResults;

      // TODO this should be changed when proper perPage max is implemented in search service.
      if (this.perPageCount === undefined) {
        this.perPageCount = searchResults.max_matches || searchResults.matches.length;
      }

      // Check for bad or no results.
      if (!searchResults || !searchResults.matches || searchResults.matches.length === 0) {
        jQuery(this.noResultsMessage()).appendTo(this.appendTo);
      }

      searchResults = this.selectResults(searchResults, this.searchContext.selectedResult);
      searchResults = this.massageForHandlebars(searchResults);

      jQuery(Handlebars.compile('{{> resultsList }}')(searchResults)).appendTo(this.element.find('.search-results-container'));

      this.bindEvents();

      if (this.needsPager(searchResults)) {
        this.setPager(searchResults);
      }

      this.setupContextMenu();
    },

    /**
     * If there is a previously selected result, say from clicking on a
     * search result pointing to a different manifest, select that result
     *
     * @param  {object} searchResults
     * @param  {object} selectedResult
     * @return search results with on set as selected
     */
    selectResults: function(searchResults, selectedResult) {
      if (!searchResults || !selectedResult) {
        return searchResults;
      }

      jQuery.grep(searchResults.matches, function(match, index) {
        return match.object['@id'] === selectedResult.objectid &&
          match.manifest ?
            match.manifest['@id'] === selectedResult.manifestid :
            selectedResult.manifestid === undefined;
      })
      .forEach(function(match) {
        match.selected = true;
      });

      return searchResults;
    },

    /**
     *
     *  Need to massage results slightly to make it parsable by Handlebars -
     *  @id cannot be parsed. Move this value to property "id" IDs must be
     *  stripped of any fragment selectors if necessary
     *
     *  Also add index within total results list in order to display result number.
     *
     * @param  searchResults
     * @return                massaged results
     */
    massageForHandlebars: function(searchResults) {
      searchResults.matches.forEach(function(match, index) {
        match.offset = index + searchResults.offset + 1;

        match.object.id = match.object['@id'].split('#')[0];
        if (match.manifest) {
          match.manifest.id = match.manifest['@id'].split('#')[0];
        }
      });

      // Need to specify index of last result in total results
      var length = searchResults.max_matches || searchResults.matches.length;
      if (searchResults.offset >= 0 && length > 0) {
        searchResults.last = parseInt(searchResults.offset) + parseInt(length);
      }
      searchResults.offset += 1;

      return searchResults;
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
      // var onPageCount = results.max_matches || results.matches.length;
      var onPageCount = this.perPageCount;

      this.element.find('.search-results-pager').pagination({
        items: results.total,
        itemsOnPage: onPageCount,
        currentPage: this.float2int(1 + results.offset / onPageCount),
        displayedPages: 2,
        edges: 1,
        cssStyle: 'compact-theme',
        ellipsePageSet: true,
        prevText: '<i class="fa fa-lg fa-angle-left"></i>',
        nextText: '<i class="fa fa-lg fa-angle-right"></i>',
        onPageClick: function(pageNumber, event) {
          event.preventDefault();

          var newOffset = (pageNumber - 1) * onPageCount;
          _this.search(_this.query, newOffset, results.max_matches, results.resume);
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

    bindEvents: function() {
      var _this = this;
      var window = this.parent.parent;

      jQuery.subscribe('windowPinned', function(event, data) {
        if (window.id === data.windowId) {
          _this.pinned = status;
        }
      });

      this.element.find('.js-show-canvas').on("click", function(event) {
        if (_this.pinned) {
          return;
        }

        var currentWindow = _this.parent.parent;
        var canvasid = jQuery(this).data('objectid');
        var manifestid = jQuery(this).data('manifestid');

        // Escape early if invalid data is found
        if (!canvasid) {
          console.log("[SearchResult] No object to navigate to.");
          return;
        } else if (typeof canvasid !== 'string') {
          console.log("[SearchResult] Result clicked object ID not a string. (" + canvasid + ")");
        }

        // Select only the clicked result.
        _this.element.find('.selected').removeClass('selected');
        jQuery(this).addClass('selected');

        if (event.which === 1) { // Left click
          _this.resultClicked({
            canvasid: canvasid,
            manifestid: manifestid,
            onThisManifest: function() { _this.parent.parent.setCurrentCanvasID(canvasid); },
            onDifferentManifest: function(manifest) {
              currentWindow.element.remove();
              currentWindow.update({
                manifest: manifest,
                currentCanvasID: canvasid,
                searchWidgetAvailable: true,
                searchContext: _this.buildContext(),
              });
              currentWindow.setCurrentCanvasID(canvasid); // This is needed ONLY for setting correct scroll position of thumbnails
            }
          });
        }
      });
    },

    resultClicked: function(options) {
      var manifestid = options.manifestid;

      if (manifestid && manifestid !== this.manifest.getId()) {
        // Load manifest
        var manifest = new $.Manifest(manifestid, '');
        manifest.request.done(function(data) {
          options.onDifferentManifest(manifest);
        });

      } else {
        options.onThisManifest();
      }
    },

    setupContextMenu: function() {
      var _this = this;
      var currentWindow = this.parent.parent;
      var currentSlot = currentWindow.parent;

      this.element.find('.search-results-container').contextMenu({
        selector: '.result-wrapper',
        items: {
          'above': {name: 'Open in slot above'},
          'below': {name: 'Open in slot below'},
          'left': {name: 'Open in slot left'},
          'right': {name: 'Open in slot right'},
        },
        callback: function(key, options) {
          var canvasid = jQuery(this).data('objectid');
          var manifestid = jQuery(this).data('manifestid');

          switch (key) {
            case 'above':
              $.viewer.workspace.splitUp(currentSlot);
              break;
            case 'below':
              $.viewer.workspace.splitDown(currentSlot);
              break;
            case 'left':
              $.viewer.workspace.splitLeft(currentSlot);
              break;
            case 'right':
              $.viewer.workspace.splitRight(currentSlot);
              break;
            default:  // Do nothing
              return;
          }

          var windowConfig = {
            manifest: _this.manifest,
            currentCanvasID: canvasid,
            currentFocus: currentWindow.currentFocus,
            slotAddress: $.viewer.workspace.getAvailableSlot().layoutAddress
          };

          if (_this.manifest['@id'] !== manifestid) {
            var manifest = new $.Manifest(manifestid, '');
            manifest.request.done(function(data) {
              windowConfig.manifest = manifest;
              $.viewer.workspace.addWindow(windowConfig);
            });
          } else {
            $.viewer.workspace.addWindow(windowConfig);
          }
        }
      });
    },

    /**
     * Build the context for the current state of this search.
     *
     * @return {[type]} [description]
     */
    buildContext: function() {
      var _this = this;

      var selectedEl = this.element.find('.search-results-container .selected');
      var selected = {};
      if (selectedEl) {
        selected = {
          objectid: selectedEl.data('objectid'),
          manifestid: selectedEl.data('manifestid')
        };
      }

      return {
        queryUrl: _this.queryUrl,
        selectedResult: selected,
      };
    },

    registerHandlebars: function() {
      Handlebars.registerPartial('resultsList', [
        '<p>',
          '{{#if last}}',
          'Showing {{offset}} - {{last}} {{#if total}}out of {{total}}{{/if}}',
          '{{/if}}',
        '</p>',
        '{{#each matches}}',
          '<div class="result-wrapper js-show-canvas{{#if selected}} selected{{/if}}" data-objectid="{{object.id}}" {{#if manifest}}data-manifestid="{{manifest.id}}"{{/if}}>',
            '<a class="search-result search-title">',
              '{{offset}}) ',
              '{{#if manifest}}',
                '{{manifest.label}} : ',
              '{{/if}}',
              '{{object.label}}',
            '</a>',
            '<div class="search-result result-paragraph">',
              '{{{context}}}',
            '</div>',
          '</div>',
        '{{/each}}',
      ].join(''));
    },

    queryMessage: Handlebars.compile('<p class="query">Query: {{this}}</p>'),

    noResultsMessage: Handlebars.compile('<h1>No results found.</h1>'),

    errorMessage: Handlebars.compile('<h1>An error occurred while searching.</h1>'),

    /**
     * Handlebars template. Accepts data and formats appropriately. To use,
     * just pass in the template data and this will return a String with
     * the formatted HTML which can then be inserted into the DOM.
     *
     * This template expects a IIIF AnnotationList formatted to represent
     * IIIF Search results.
     *
     * EX: assume context:
     * 	var templateData = { template data goes here }
     * 	var htmlString = template(templateData);
     */
    wrapper: Handlebars.compile([
      '<div>',
        '<div class="search-results-pager"></div>',
        '<div class="search-results-container">',
          '{{> resultsList }}',
        '</div>',
      '</div>'
    ].join(""))};

}(Mirador));

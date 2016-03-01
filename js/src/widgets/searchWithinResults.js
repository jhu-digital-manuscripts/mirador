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
      manifest:             null,
      element:              null,
      parent:               null,
      metadataTypes:        null,
      metadataListingCls:   'metadata-listing',
      query:                null,
      results:              null,
      searchPrefix:         'jhsearch',
      searchCollection:     null,
      baseUrl:              null
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
      } else if (this.queryUrl) {
        // Initial URL value from changing manifests during a search
        this.initFromUrl(this.queryUrl);
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
      this.search(q.q, parseInt(q.o), parseInt(q.m), q.r);
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
    search: function(query, offset, numExpected, resumeToken) {
      console.assert(query && typeof query === 'string', "Query must exist and must be a String");
      console.assert(offset ? typeof offset === 'number' : true, "Offset value provided must be a number.");
      console.assert(numExpected ? typeof numExpected === 'number' : true, "numExpected value provided must be a number.");
      console.assert(resumeToken ? typeof resumeToken === 'string' : true, "Resume token value provided must be a string.");
      var _this = this;

      this.query = query;

      // Create request URL from parameters
      var queryUrl = this.baseUrl +
          (this.baseUrl.charAt(this.baseUrl.length - 1) !== '/' ? '/' : '');

      queryUrl += this.searchPrefix + '?q=' + this.query;
      if (numExpected) {
        queryUrl += '&m=' + numExpected;
      }
      // if (resumeToken) {
      //   queryUrl += '&r=' + resumeToken;
      // }
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

      jQuery(this.appendTo).find('.search-results-container').empty();

      // Make the request
      var request = jQuery.ajax({
        url:   queryUrl,
        dataType: 'json'
      })
      .done(function(searchResults) {
        _this.searchResults = searchResults;

        // TODO this should be changed when proper perPage max is implemented in search service.
        if (_this.perPageCount === undefined) {
          _this.perPageCount = searchResults.max_matches || searchResults.matches.length;
        }

        // Check for bad or no results.
        if (!searchResults || !searchResults.matches || searchResults.matches.length === 0) {
          jQuery(_this.noResultsMessage()).appendTo(_this.appendTo);
        }

        searchResults = _this.selectResults(searchResults, _this.selectedResult);
        searchResults = _this.massageForHandlebars(searchResults);

        jQuery(Handlebars.compile('{{> resultsList }}')(searchResults)).appendTo(_this.element.find('.search-results-container'));

        _this.bindEvents();

        if (_this.needsPager(searchResults)) {
          _this.setPager(searchResults);
        }
      })
      .fail(function(jqXHR, textStatus, errorThrown) {
        console.log("[SearchResults] window=" + _this.parent.parent.id + " search query failed (" + queryUrl + ") \n" + errorThrown);
        jQuery(_this.errorMessage()).appentTo(_this.appentTo);
      })
      .always(function() {
        // console.log('[SearchResults] query done.');
      });
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

      this.element.find('.js-show-canvas').on("click", function() {
        var canvasid = jQuery(this).attr('data-objectid');

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

        // Navigate to clicked object
        var manifestid = jQuery(this).data('manifestid');

        if (manifestid && manifestid !== _this.manifest.getId()) {
          // Load manifest
          var manifest = new $.Manifest(manifestid, '');
          manifest.request.done(function(data) {
            var currentWindow = _this.parent.parent;
            currentWindow.element.remove();
            currentWindow.update({
              manifest: manifest,
              currentCanvasID: canvasid,
              searchWidgetAvailable: true,
              queryUrl: _this.queryUrl,
              selectedResult: {
                objectid: canvasid,
                manifestid: manifestid
              },
            });
            currentWindow.setCurrentCanvasID(canvasid);
          });

        } else {
          _this.parent.parent.setCurrentCanvasID(canvasid);
        }
      });
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

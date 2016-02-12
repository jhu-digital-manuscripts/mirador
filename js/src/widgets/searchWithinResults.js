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
      searchService:        null,
    }, options);

    this.init();
  };

  $.SearchWithinResults.prototype = {

    init: function() {
      this.registerHandlebars();
      this.searchService = this.manifest.getSearchWithinService();

      this.search(this.query);
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
      var queryUrl = this.searchService['@id'] + "?q=" + query;
      if (numExpected) {
        queryUrl += '&m=' + numExpected;
      }
      if (resumeToken) {
        queryUrl += '&r=' + resumeToken;
      }
      if (offset) {
        queryUrl += '&o=' + offset;
      }

      // Clear search related stuff
      this.searchResults = null;

      jQuery(this.appendTo).empty();
      jQuery(this.queryMessage(query)).appendTo(_this.appendTo);

      // Make the request
      jQuery.ajax({
        url:   queryUrl,
        dataType: 'json',
        async: true
      })
      .done(function(searchResults) {
        _this.searchResults = searchResults;
        // Need to massage results slightly to make it parsable by Handlebars -
        // @id cannot be parsed. Move this value to property "id"
        // IDs must be stripped of any fragment selectors if necessary
        searchResults.matches.forEach(function(match) {
          match.object.id = match.object['@id'].split('#')[0];
          if (match.manifest) {
            match.manifest.id = match.manifest['@id'].split('#')[0];
          }
        });

        _this.element = jQuery(_this.template(searchResults.matches)).appendTo(_this.appendTo);

        _this.bindEvents();

        if (_this.needsPager(searchResults)) {
          _this.setPager(searchResults);
        }
      })
      .fail(function() {
        console.log("[SearchResults] window=" + _this.parent.parent.id + " search query failed (" + queryUrl + ")");
      })
      .always(function() {

      });

    },

  /**
   * Look for necessary properties that point to the need for paging.
   *
   * @param  results IIIF Search results
   * @return TRUE if paging is needed
   */
  needsPager: function(results) {
    return results.offset + results.max_matches < results.total;
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
    var onPageCount = results.max_matches;

    this.element.find('.search-results-pager').pagination({
        items: results.total,
        itemsOnPage: onPageCount,
        currentPage: this.float2int(results.offset / onPageCount),
        cssStyle: 'compact-theme',
        ellipsePageSet: true,
        onPageClick: function(pageNumber, event) {
          event.preventDefault();

          var newOffset = (pageNumber - 1) * results.max_matches;
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
      _this.parent.parent.setCurrentCanvasID(canvasid);
    });
  },

  registerHandlebars: function() {
    Handlebars.registerPartial('resultsList', [
      '<div class="search-results-container">',
        '{{#each this}}',
          '<div class="result-wrapper js-show-canvas" data-objectid="{{object.id}}" {{#if manifest}}data-manifestid="{{manifest.id}}"{{/if}}>',
            '<a class="search-result search-title">',
              '{{object.label}}',
            '</a>',
            '<div class="search-result result-paragraph">',
              '{{{context}}}',
            '</div>',
          '</div>',
        '{{/each}}',
      '</div>',
    ].join(''));
  },

  queryMessage: Handlebars.compile('<h1>Query: {{this}}</h1>'),

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
  template: Handlebars.compile([
    '<div>',
      '<div class="search-results-pager"></div>',
      '{{> resultsList }}',
    '</div>'
  ].join(""))};

}(Mirador));

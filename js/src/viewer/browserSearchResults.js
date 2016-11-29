(function($) {

  $.BrowserSearchResults = function(options) {
    jQuery.extend(true, this, {
      viewer: null,
      hideParent: null,
      appendTo: null,
      element: null,
      searchResults: null,
      manifestListItems: null,
    }, options);

    this.init();
  };

  $.BrowserSearchResults.prototype = {
    init: function() {
      jQuery(this.appendTo).empty();
      this.searchResults = this.massageForHandlebars(this.searchResults);

      // Check for bad or no results.
      if (!this.searchResults || !this.searchResults.matches || this.searchResults.matches.length === 0) {
        jQuery(this.noResultsMessage()).appendTo(this.appendTo);
      }

      // this.searchResults = this.selectResults(searchResults, this.searchContext.selectedResult);
      this.searchResults = this.massageForHandlebars(this.searchResults);

      this.element = jQuery(this.template(this.searchResults)).appendTo(this.appendTo);

      this.bindEvents();
      // this.setupContextMenu();
    },

    /**
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
        match.offset = index + searchResults.offset;

        match.object.id = match.object['@id'].split('#')[0];
        if (match.manifest) {
          match.manifest.id = match.manifest['@id'].split('#')[0];
        }

        match.object.type = match.object["@type"];
      });

      // Need to specify index of last result in total results
      var length = searchResults.max_matches || searchResults.matches.length;
      if (searchResults.offset >= 0 && length > 0) {
        searchResults.last = parseInt(searchResults.offset) + parseInt(length);
      }
      searchResults.offset += 1;

      return searchResults;
    },

    bindEvents: function() {
      var _this = this;

      this.appendTo.find("#results-to-top").on("click", function(event) {
        _this.appendTo.scrollTop();
      });

      this.appendTo.find(".js-show-canvas").on("click", function(event) {
        var clickedEl = jQuery(this);

        // First unselect any previously selected items, then select this item
        _this.appendTo.find(".selected").removeClass("selected");
        clickedEl.addClass("selected");

        var canvasId = clickedEl.data("objectid");
        var manifestId = clickedEl.data("manifestid");
        var type = clickedEl.data("objecttype");

        // Open search result in currently selected window
        var windowConfig = {
          manifest: _this.findManifest(manifestId)
        };

        if (type === "sc:Manifest") {
          windowConfig.currentFocus = "ThumbnailsView";
        } else if (type === "sc:Canvas") {
          windowConfig.currentCanvasID = canvasId;
          windowConfig.currentFocus = "ImageView";
        }

        $.viewer.workspace.addWindow(windowConfig);
        _this.hideParent();
      });
    },

    findManifest: function(manifestId) {
      var relevant = this.manifestListItems.filter(function(listItem) {
        return listItem.manifest.getId() === manifestId;
      });

      if (relevant && relevant.length > 0) {
        return relevant[0].manifest;
      } else {
        // TODO Will there be cases where results are from manifests not already included in 'manifestListItems' ?
        return null;
      }
    },

    queryMessage: Handlebars.compile('<p class="query">Query: {{this}}</p>'),

    noResultsMessage: Handlebars.compile('<h1>No results found.</h1>'),

    errorMessage: Handlebars.compile('<h1>An error occurred while searching.</h1>'),

    template: Handlebars.compile([
      '{{#each matches}}',
        '<div class="result-wrapper js-show-canvas{{#if selected}} selected{{/if}}" data-objectid="{{object.id}}" ',
                '{{#if manifest}}data-manifestid="{{manifest.id}}"{{/if}} data-objecttype="{{object.type}}">',
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
      '<p><a id="results-to-top">Back to top</a></p>'
    ].join(''))

  };

}(Mirador));

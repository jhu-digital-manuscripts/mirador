/**
 * Widget to display one set of search results. This could be all search results
 * if paging is disabled, or a single page of results otherwise. This widget is
 * designed to handle events dealing with this particular set of results such
 * as user clicks on result entries. This is not designed to resume searches
 * for paging or other reasons, which should be handled in a search widget
 * separately from these results.
 */
(function($) {

  $.SearchResults = function(options) {
    jQuery.extend(true, this, {
      parentId: null,
      state: null,
      viewer: null,
      hideParent: null,
      appendTo: null,
      element: null,
      manifestListItems: null,
      eventEmitter: null,
      /**
       * Holds data necessary for handling interactions with search results
       * queuedAction: {
       *   "manifestId": "manifestId",  // ID of result manifest
       *   "canvasId": "canvasId",      // ID of result canvas, if applicable
       *   "type": "type",              // Result type, sc:Canvas or sc:Manifest
       *   "windowConfig": {windowConfig} // Config for updating or creating a window
       * }
       */
      queuedAction: {},
      context: null,
      config: {
        hasContextMenu: true
      }
    }, options);
    this.id = $.genUUID();

    this.init();
  };

  $.SearchResults.prototype = {
    init: function() {
      jQuery(this.appendTo).empty();

      // Check for bad or no results.
      if (!this.context.search.results || !this.context.search.results.matches || this.context.search.results.matches.length === 0) {
        jQuery(this.noResultsMessage()).appendTo(this.appendTo);
      }

      this.context.search.results = this.massageForHandlebars(this.context.search.results);
      this.element = jQuery(this.template(this.context.search.results)).appendTo(this.appendTo);

      this.bindEvents();
      if (this.config.hasContextMenu) {
        this.setupContextMenu();
      }

      this.eventEmitter.publish('SEARCH_SIZE_UPDATED.' + this.parentId);
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
        if (searchResults.selected && index === searchResults.index) {
          match.selected = true;
        }
        match.offset = index + searchResults.offset + 1;

        match.object.id = match.object["@id"].split("#")[0];
        if (match.manifest) {
          match.manifest.id = match.manifest["@id"].split("#")[0];
        }

        match.object.type = match.object["@type"];
      });

      return searchResults;
    },

    bindEvents: function() {
      var _this = this;

      this.appendTo.find(".results-to-top").on("click", function(event) {
        _this.appendTo.parent().animate({scrollTop:0}, 150);
      });

      this.appendTo.find(".js-show-canvas").on("click", function(event) {
        var clickedEl = jQuery(this);

        // First unselect any previously selected items, then select this item
        _this.appendTo.find(".selected").removeClass("selected");
        clickedEl.addClass("selected");
        _this.context.search.results.selected = clickedEl.index();

        var canvasId = clickedEl.data("objectid");
        var manifestId = clickedEl.data("manifestid");
        var type = clickedEl.data("objecttype");

        // Same manifest, change pages and exit
        if (_this.parentId && _this.currentObject && manifestId === _this.currentObject) {
          _this.eventEmitter.publish("SET_CURRENT_CANVAS_ID." + _this.parentId, canvasId);
          return;
        }

        // Open search result in currently selected window
        var windowConfig = {
          "slotAddress": _this.state.getSlotAddress(_this.parentId),
          "context": _this.context
        };

        if (type === "sc:Manifest") {
          windowConfig.currentFocus = "ThumbnailsView";
        } else if (type === "sc:Canvas") {
          windowConfig.canvasID = canvasId;
          windowConfig.currentFocus = "ImageView";
        }

        _this.queuedAction = {
          "manifestId": manifestId,
          "canvasId": canvasId,
          "type": type,
          "windowConfig": windowConfig,
          "target": "here",
          // "targetId": _this.parentId        // Target window to put results, if applicable
        };

        _this.eventEmitter.publish("MANIFEST_REQUESTED", {
          "origin": _this.id,
          "manifestId": manifestId
        });
      });

      this.eventEmitter.subscribe("MANIFEST_FOUND", function(event, data) {
        if (data.origin !== _this.id || !_this.queuedAction) {
          return;
        }

        var windowConfig = _this.queuedAction.windowConfig;
        windowConfig.manifest = data.manifest;
        windowConfig.searchContext = _this.context;

        switch (_this.queuedAction.target) {
          case "above":
            _this.eventEmitter.publish(
              "SPLIT_UP_FROM_WINDOW",
              { "id": _this.parentId, "windowConfig": windowConfig }
            );
            break;
          case "below":
            _this.eventEmitter.publish(
              "SPLIT_DOWN_FROM_WINDOW",
              { "id": _this.parentId, "windowConfig": windowConfig }
            );
            break;
          case "left":
            _this.eventEmitter.publish(
              "SPLIT_LEFT_FROM_WINDOW",
              { "id": _this.parentId, "windowConfig": windowConfig }
            );
            break;
          case "right":
            _this.eventEmitter.publish(
              "SPLIT_RIGHT_FROM_WINDOW",
              { "id": _this.parentId, "windowConfig": windowConfig }
            );
            break;
          case "here":
            _this.eventEmitter.publish("ADD_WINDOW", windowConfig);
            break;
          default:  // Do nothing
            return;
        }
      });
    },

    setupContextMenu: function() {
      var _this = this;

      this.appendTo.contextMenu({
        selector: ".result-wrapper",
        items: {
          "here": {name: "Open in this slot"},
          "sep1": "---------",
          "above": {name: "Open in slot above"},
          "below": {name: "Open in slot below"},
          "left": {name: "Open in slot left"},
          "right": {name: "Open in slot right"},
        },
        callback: function(key, options) {
          var canvasId = jQuery(this).data("objectid");
          var manifestId = jQuery(this).data("manifestid");
          var type = jQuery(this).data("objecttype");

          _this.context.search.results.selected = jQuery(this).index();

          var windowConfig = {
            canvasId: canvasId,
            searchContext: _this.context
            // Any way to get the exact slot address of the newly created window?
          };

          if (type === "sc:Manifest") {
            windowConfig.currentFocus = "ThumbnailsView";
          } else if (type === "sc:Canvas") {
            windowConfig.canvasID = canvasId;
            windowConfig.currentFocus = "ImageView";
          }

          _this.queuedAction = {
            "manifestId": manifestId,
            "canvasId": canvasId,
            "type": type,
            "windowConfig": windowConfig,
            "target": key
          };

          _this.eventEmitter.publish("MANIFEST_REQUESTED", {
            "origin": _this.id,
            "manifestId": manifestId
          });
        }
      });
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
      '<p><a class="results-to-top">Back to top</a></p>'
    ].join(''))

  };

}(Mirador));

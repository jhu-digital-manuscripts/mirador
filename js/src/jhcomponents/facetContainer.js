(function ($) {
  /**
   * Events:
   *    >> REQUEST_FACETS ::  data: {
   *                            origin: '',
   *                            facets: '',   // facets query
   *                          }
   *    >> UPDATE_FACET_BOOK_LIST ::  data: {
   *                                    origin: '',
   *                                    bookList: [],   // array of manifest IDs that match the facet search
   *                                  }
   */
  $.FacetContainer = function (options) {
    jQuery.extend(true, this, {
      windowId: undefined,
      eventEmitter: null,
      state: null,
      element: null,
      appendTo: null,

      facetPanel: null,

      context: null,    // Current search context, see SearchContainer.context for documentation
      config: null,
    }, options);

    this.init();
  };

  $.FacetContainer.prototype = {
    init: function () {
      this.bindEvents();
      this.listenForActions();

      this.initFacets();
    },

    bindEvents: function () {
      const _this = this;

      this.eventEmitter.subscribe("FACET_SELECTED", (event, data) => {
        if (_this.facetPanel && _this.facetPanel.id === data.origin) {
          _this.facetSelected(data.selected);
        }
      });
    },

    listenForActions: function () {

    },

    changeContext: function (context) {
      this.context = context;
      this.initFacets();
      this.getFacets();
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
     * Initialize the facet widget to enable facet search.
     */
    initFacets: function() {
      if (this.facetPanel) {
        this.facetPanel.destroy();
      }

      this.facetPanel = new $.FacetPanel({
        eventEmitter: this.eventEmitter,
        parentId: this.windowId,
        appendTo: this.appendTo,
        state: this.state,
        top: (this.config.showCollectionPicker ? "199px" : "143px"),
      });
    },

    /**
     * Get the label corresponding to the category ID.
     *
     * @param catId {string} category ID
     */
    getCategoryLabel: function(catId) {
      const catConfig = this.context.searchService.config.search.settings.categories;
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
      const catConfig = this.context.searchService.config.search.settings.categories;
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
      if (!this.facetPanel) {
        return;
      }
      this.getFacets(this.facetPanel.getSelectedNodes());
    },

    getFacets: function(facets) {
      if (!this.config.allowFacets) {
        return;
      }

      // This assumes that this.context.searchService is always up-to-date
      const service = this.context.searchService;

      let query;

      if (facets && facets.length > 0) {
        const delimiters = service.config.query.delimiters;
        let facetParts = [];

        facets.forEach(function(f) {
          facetParts.push({
            op: delimiters.or,
            category: f.category,
            term: f.value
          });
        });

        query = $.toTermList(facetParts);
      }

      this.eventEmitter.publish('REQUEST_FACETS', {
        origin: this.windowId,
        facets: query
      });
    },

    handleFacets: function(searchResults, append) {
      // Update visibility of manifests
      // debugger;
      this.bookList = this.getManifestList(searchResults);
      this.eventEmitter.publish('UPDATE_FACET_BOOK_LIST', {
        origin: this.windowId,
        bookList: this.bookList
      });

      if (!searchResults.categories) {
        console.log("[SW] No categories found in search results. " + searchResults["@id"]);
        return;
      }

      if (this.config.allowFacets && this.facetPanel) {
        const sr = this.resultsCategoriesToFacets(searchResults);
        if (append) {
          sr.categories.forEach(function(cat) {
            this.facetPanel.addValues(cat.name, cat.values);
          });
        } else {
          this.facetPanel.setFacets(sr.categories);
        }
        this.eventEmitter.publish("SEARCH_SIZE_UPDATED." + this.windowId);
      }
    },

    resultsCategoriesToFacets: function(searchResults) {
      const _this = this;

      if (!searchResults || !Array.isArray(searchResults.categories)) {
        return searchResults;
      }
      // const categoryConfig = this.context.searchService.config.search.settings.categories;
      searchResults.categories.forEach(function(cat) {
        jQuery.extend(cat, {
          "label": _this.getCategoryLabel(cat.name)
        });
      });

      // Filter out any categories that have no label
      searchResults.categories = searchResults.categories.filter(function(cat) {
        return cat.label && cat.label.length > 0;
      });

      return searchResults;
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

  };
}(Mirador));
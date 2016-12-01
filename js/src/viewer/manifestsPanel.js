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
      cachedKeys: [],
      /*    searchService, query, offset, numExpected, sortOrder
       * Search currently displayed. Useful for paging.
       * {
       *  "service": { "ID of search service" },
       *  "query": "String query",
       *  "offset": {integer} offset of currently displayed results page,
       *  "numExpected": {integer} max number of results per page,
       *  "sortOrder": "String: sort order of results. (index|relevance)"
       * }
       */
      currentSearch: null
    }, options);

    var _this = this;
    _this.init();

  };

  $.ManifestsPanel.prototype = {

    init: function() {
      var _this = this;
      this.registerWidget();

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
        // "id": "http://localhost:8080/iiif-pres/collection/top/jhsearch",
        "id": "http://rosetest.library.jhu.edu/iiif-pres-cni/collection/top/jhsearch",
        "label": "All JHU collections"
      });
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------

      this.bindEvents();
      this.listenForActions();
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

    /**
     * Reset advanced search UI and rebuild using settings from
     * the provided search service.
     */
    switchSearchServices: function(service) {
      var _this = this;

      if (typeof service === 'string') {
        this.getSearchService(service).always(function(service) {
          _this.switchSearchServices(service);
        });
        return;
      }
      this.searchService = service;

      /*
        Template data: {
          "search": jhiiifSearchService.search,
          "otherServices": _this.searchServices     // Should this be trimmed? (does it matter?)
        }
       */
      var templateData = {
        "search": service.search,
        "otherServices": _this.searchServices
      };

      if (!this.element) {
        // Widget has not been initialized
        this.element = jQuery(this.template(templateData)).appendTo(this.appendTo);
      } else {
        var advancedSearchEl = this.element.find(".search-disclose");

        advancedSearchEl.empty();
        advancedSearchEl.append(
          Handlebars.compile("{{> advancedSearch}}")(templateData)
        );
      }

      var description_template = Handlebars.compile('{{> searchDescription}}');

      this.element.tooltip({
        items: '.search-description-icon',
        content: description_template(service.search.settings.fields),
        position: { my: "left+20 top", at: "right top-50" },
      });

      // Assuming the UI was created successfully, set the current
      // search service to the one provided to this function
      this.listenForActions();
      this.addAdvancedSearchLine();
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

      this.element.find('#manifest-search-form').on('submit', function(event) {
        event.preventDefault();
        var searchTerm = jQuery("#manifest-search").val();
        var doAdvancedSearch = _this.element.find(".search-disclose").css("display") !== "none";

        if (doAdvancedSearch) {
          _this.performAdvancedSearch();
          return;
        }
        if (!searchTerm || searchTerm.length === 0) {
          return;
        }

        // Do searchy stuff
        var serviceId = jQuery("#search-service-select").val();
        _this.getSearchService(serviceId).done(function(service) {
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
            _this.doSearch(service, query);
          }
        });

      });

// -----------------------------------------------------------------------------
// ----- Advanced search stuff -------------------------------------------------
// -----------------------------------------------------------------------------
      this.element.find("#search-service-select").on("change", function() {
        _this.switchSearchServices(jQuery(this).val());
      });

      jQuery(window).resize($.throttle(function(){
        var clone = _this.element.clone().css("visibility","hidden").css("display", "block").appendTo(_this.appendTo);
        _this.resultsWidth = clone.find('.select-results').outerWidth();
        clone.remove();
        jQuery.publish("manifestPanelWidthChanged", _this.resultsWidth);
      }, 50, true));

      this.element.find('.search-disclose-btn-more').on('click', function() {
        _this.element.find('.search-disclose-btn-more').hide();
        _this.element.find('.search-disclose-btn-less').show();
        _this.element.find(".search-disclose").css({"display": "block"});
        _this.setResultsContainerPosition();
      });

      this.element.find('.search-disclose-btn-less').on('click', function() {
        _this.element.find('.search-disclose-btn-less').hide();
        _this.element.find('.search-disclose-btn-more').show();
        _this.element.find(".search-disclose").css({"display": "none"});
        _this.setResultsContainerPosition();
      });
    },

    listenForActions: function() {
      var _this = this;

      this.element.find('.advanced-search-add-btn').on('click', function(e) {
        e.preventDefault();
        _this.addAdvancedSearchLine();
      });

      this.element.find('.advanced-search-reset-btn').on('click', function(e) {
        e.preventDefault();
        _this.element.find('.advanced-search-line').each(function(index, line) {
          jQuery(line).remove();
        });
        _this.addAdvancedSearchLine();
      });
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

      // Set this search as the current search, so that it can be re-used
      // by the pager
      _this.currentSearch = {
        "service": searchService,
        "query": query,
        "offset": offset,
        "numExpected": numExpected,
        "sortOrder": sortOrder
      };

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
        console.log("[ManifestBrowser] search query failed (" + queryUrl + ") \n" + errorThrown);
      });
    },

    performAdvancedSearch: function() {
      var _this = this;
      var parts = [];

      this.getSearchService(this.element.find("#search-service-select").val()).done(function(service) {
        _this.element.find('.advanced-search-line').each(function(index, line) {
          line = jQuery(line);
          var category = line.find('.advanced-search-categories').val();
          var operation = line.find('.advanced-search-operators').val();

          var inputs = line.find('.advanced-search-inputs').children()
          .filter(function(index, child) {
            child = jQuery(child);
            return child.css('display') != 'none' && child.val() && child.val() !== '';
          })
          .each(function(index, child) {
            child = jQuery(child);

            parts.push({
              op: service.query.delimiters[operation],
              category: child.data('query'),
              term: child.val()
            });
          });
        });

        var finalQuery = $.generateQuery(parts, service.query.delimiters.field);

        if (finalQuery && finalQuery.length > 0) {
          _this.doSearch(service, finalQuery);
        }
      });
    },

    addSearchService: function(service) {
      var _this = this;

      var id = service.id || service["@id"];
      var label = service.label || id;

      // Search service will likely NOT have an 'id' property, but instead
      //  have a '@id' property. Change this to 'id' for things to work.
      service.id = id;
      this.searchServices.push(service);

      this.element.find("#manifest-search-form select")
        .append(jQuery("<option value=\"" + id + "\">" + label + "</option>"));

      if (!this.advancedSearchSet) {
        this.getSearchService(id).done(function(searchService) {
          _this.addAdvancedSearchLine();
        });
        this.advancedSearchSet = true;
      }
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
      if (!this.perPageCount) {
        this.perPageCount = searchResults.max_matches || searchResults.matches.length;
      }

      this.element.find(".browser-search-results").show();
      new $.BrowserSearchResults({
        appendTo: _this.element.find(".results-items"),
        viewer: _this.parent,
        searchResults: searchResults,
        hideParent: _this.hide,
        manifestListItems: _this.manifestListItems
      });
      this.setResultsContainerPosition();

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

    setResultsContainerPosition: function() {
      this.element.find(".browser-search-results")
        .css("top", this.element.find(".manifest-panel-controls").outerHeight(true)+"px");
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

      this.element.find('.results-pager').pagination({
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
          _this.element.find(".browser-search-results .results-items").scrollTop(0);
          _this.doSearch(
            _this.currentSearch.service,
            _this.currentSearch.query,
            newOffset,
            _this.currentSearch.numExpected,
            _this.currentSearch.sortOrder
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

    /**
     * Add a new line to the Advanced Search widget.
     */
    addAdvancedSearchLine: function() {
      var _this = this;
      var template = Handlebars.compile('{{> advancedSearchLine }}');

      this.getSearchService(this.element.find("#search-service-select").val()).done(function(searchService) {
        var templateData = {
          'search': searchService.search,
          'query': searchService.query
        };
        // templateData.search.categories.choices = this.searchService.query.fields;

        var line = template(templateData);

        line = jQuery(line).insertAfter(
          _this.element.find('.advanced-search-lines table tbody').children().last()
        );

        // For only the first line, hide the boolean operator
        var num_lines = _this.element.find('.advanced-search-line').length;
        if (num_lines === 1) {
          line.find('.advanced-search-operators').hide();
        }

        // Hide all inputs except for the Default choice
        // Makes sure ENTER key presses activate advanced search
        searchService.search.settings.fields.forEach(function (field) {
          var element = line.find(_this.classNamesToSelector(field.class));

          element.keypress(function(event) {
            if (event.which == 13) {
              event.preventDefault();
              _this.performAdvancedSearch();
            }
          });

          if (!field.default && field.class && field.class !== '') {
            element.hide();
          }
        });

        // Add functionality to 'remove' button
        line.find('.advanced-search-remove').on('click', function() {
          line.remove();

          // Make sure 1st line has boolean operator hidden
          _this.element.find('.advanced-search-line').each(function(index, element) {
            if (index === 0) {
              jQuery(element).find('.advanced-search-operators').hide();
            } else {
              jQuery(element).find('.advanced-search-operators').show();
            }
          });
        });

        line.find('.advanced-search-categories').on('change', function(event) {
          var jSelector = jQuery(event.target);
          var user_inputs = line.find('.advanced-search-inputs');

          // Hide all input/select fields
          user_inputs.children().hide();
          user_inputs
              .find(_this.classNamesToSelector(searchService.getField(jSelector.val()).class))
              .show();
        });
      });

      this.setResultsContainerPosition();
    },

    classNamesToSelector: function(name) {
      // Convert class name(s) to CSS selectors
      var selector = '';
      name.split(/\s+/).forEach(function(str) {
        if (str.charAt(0) !== '.') {
          selector += '.';
        }
        selector += str + ' ';
      });

      return selector;
    },

    hide: function() {
      var _this = this;
      jQuery(this.element).hide({effect: "fade", duration: 160, easing: "easeOutCubic"});
    },

    show: function() {
      var _this = this;
      jQuery(this.element).show({effect: "fade", duration: 160, easing: "easeInCubic"});
    },

    resultsPagerText: Handlebars.compile([
      '{{#if last}}',
        'Showing {{offset}} - {{last}} {{#if total}}out of {{total}}{{/if}}',
      '{{/if}}',
    ].join('')),

    registerWidget: function() {
      $.registerHandlebarsHelpers();

      Handlebars.registerPartial('advancedSearch', [
        '<div class="advanced-search">',
          '<i class="fa fa-2x fa-question-circle search-description-icon" title="This is a title."></i>',
          '<form id="advanced-search-form" class="perform-advanced-search">',
            '<div class="advanced-search-lines">',
              '<table><tbody>',
                '<tr></tr>',
              '</tbody></table>',
            '</div>',
            '<div class="advanced-search-btn-container">',
              '<button type="button" class="advanced-search-add-btn" value="add">Add Term</button>',
              '<button type="button" class="advanced-search-reset-btn">Reset</button>',
            '</div>',
          '</form>',
        '</div>'
      ].join(''));

      Handlebars.registerPartial('advancedSearchLine', [
        // Select search category
        '<tr class="advanced-search-line"><td>',
          '<div class="advanced-search-selector">',
            '{{> searchDropDown query.operators}}',
            '{{> searchDropDown search.categories }}',
          '</div>',
        '</td>',
        '<td>',
          '<div class="advanced-search-inputs">',
          '{{#each search.settings.fields}}',
            '{{#ifCond type "===" "dropdown"}}',
              '{{> searchDropDown this}}',
            '{{/ifCond}}',
            '<input type="text" class="{{class}}" placeholder="{{placeholder}}" {{#if name}}data-query="{{name}}"{{/if}}/>',
          '{{/each}}',
          '</div>',
        '</td>',
        '<td>',
          '<button class="advanced-search-remove" type="button"><i class="fa fa-times"></i></button>',
        '</td></tr>',
      ].join(''));

      /**
       * Create a drop down. Required context:
       * {
       *   'label': human readable label for the dropdown
       *   'class': CSS class for the dropdown
       *   'choices': array of string options for the dropdown
       *   'query': OPTIONAL will go in data-query attribute
       *   'addBlank': OPTIONAL set to TRUE to add a blank option at the top
       * }
       */
      Handlebars.registerPartial('searchDropDown', [
        '<select class="{{class}}" {{#if name}}data-query="{{name}}"{{/if}}>',
          '{{#if addBlank}}',
            '<option></option>',
          '{{/if}}',
          '{{#each choices}}',
            '<option value="{{#if value}}{{value}}{{else}}{{value}}{{/if}}" {{#if description}}title="{{description}}"{{/if}}>',
              '{{label}}',
            '</option>',
          '{{/each}}',
        '</select>'
      ].join(''));

      Handlebars.registerPartial('searchDescription', [
        '<p>',
          '<p>',
            'The <i>Advanced Search</i> tool allows a user to create a query focused on specific search fields. Different terms ',
            'can be combined in a complex boolean query to yield more precise results. The following fields are available to search: ',
          '</p>',
          '<ul>',
          '{{#each this}}',
            '<li>',
              '<b>{{label}}</b>',
              '{{#if description}}',
                ': {{description}}',
              '{{/if}}',
              '{{#if values}}',
                '<br>Can take values: ',
                '<i>',
                  '{{#each values}}',
                    '{{#if @first}}{{else}},{{/if}} {{label}}',
                  '{{/each}}',
                '</i>',
              '{{/if}}',
            '</li>',
          '{{/each}}',
          '</ul>',
        '</p>'
      ].join(''));
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
            '<div class="search-disclose-btn-more">Advanced Search</div>',
            '<div class="search-disclose-btn-less" style="display: none;">Basic Search</div>',
            '<div class="search-disclose-container">',
              '<div class="search-disclose" style="display: none;">',
                '{{> advancedSearch }}',
              '</div>',
            '</div>',
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
        '<div class="results-pager"></div>',
        '<p class="results-pager-text"></p>',
        '<div class="results-items"></div>',
      '</div>',
      '</div>'
    ].join(''))
  };

}(Mirador));

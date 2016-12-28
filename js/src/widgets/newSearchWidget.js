(function($){
  /**
   * This object is responsible for creating the basic and advanced search UI
   * anywhere in Mirador. This object is responsible for forming and sending
   * search requests to the appropriate search services and recieving the
   * responses. Responses will then be passed to a SearchResults widget.
   */
  $.NewSearchWidget = function(options) {
    jQuery.extend(true, this, {
      windowId: null,
      eventEmitter: null,
      manifest: null,
      searchServices: [],     // SearchServices object, used to cache search services
      element: null,            // Base jQuery object for this widget
      appendTo: null,           // jQuery object in base Mirador that this widget lives
    }, options);

    this.init();
  };

  $.NewSearchWidget.prototype = {
    init: function() {
      // Request search services for this manifest, and related
      // As those services are discovered, request info.json configs
      // Populate search dropdowns
    },

    /**
     * First check this.searchServices for service config. If it is not
     * present, request the service from the search controller.
     *
     * @param service {string} search service ID
     * @return Deferred
     */
    getSearchService: function(service) {

    },

    bindEvents: function() {
      var _this = this;

      this.eventEmitter.subscribe("RELATED_SEARCH_SERVICES_FOUND", function(event, data) {
        if (data.id === _this.windowId) {
          searchServices.push(data.service);
        }
      });

    },

    /**
     * Change the UI in response to the user selecting a different search
     * service.
     *
     * @param newService {string} ID of the new search service
     */
    switchSearchServices: function(newService) {
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
          Handlebars.compile("{{> browserAdvancedSearch}}")(templateData)
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

    registerWidget: function() {
      $.registerHandlebarsHelpers();
    },

    template: Handlebars.compile([
      '<div class="searchResults" style="display: none;">',
        // SearchWithin selector
        '<div class="">',
          '<p>',
            'Search within: ',
            '<select class="search-within-object-select">',
              '{{#each otherServices}}',
                '<option value="{{id}}">{{label}}</option>',
              '{{/each}}',
            '</select>',
          '</p>',
        '</div>',
        '<form id="search-form" class="js-perform-query">',
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
          '<div class="search-disclose" style="display: none;">',
            '{{> advancedSearch }}',
          '</div>',
        '</div>',
        '<p class="pre-search-message"></p>',
        '<div class="search-results-list"></div>',
      '</div>',
    ].join(''))
  };

}(Mirador));

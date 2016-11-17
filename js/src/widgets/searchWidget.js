(function($) {

$.SearchWidget = function(options) {

  this.element = null;
  this.parent = options.parent;
  this.windowId = options.windowId;
  this.widgetId = options.widgetId;
  this.appendTo = jQuery(options.appendTo);
  this.element = null;
  this.width = 330;
  this.manifest = options.manifest;
  /*
   * Array holding all search services. Not all services are necessarily
   * fully initialized.
   *
   * [
   *    {   // Service 1, already initialized, ready to use
   *      "label": "Search service 1",
   *      "id": "service-1-id",
   *      "service": { ... }   // This will be an instance of JhiiifSearchService
   *    },
   *    {   // Service 2, not initialized, not ready to use
   *      "label": "Search service 2",
   *      "id": "service-2-id"
   *    }
   * ]
   *
   */
  this.searchServices = options.searchServices || {};
  this.searchService = null;
  this.searchContext = {};
  this.messages = {
    'no-term': '<span class="error">No search term was found.</span>',
    'no-defaults': '<span class="error">No fields defined for basic search.</span>',
  };

// -----------------------------------------------------------------------------
// ----- REMOVE ----------------------------------------------------------------
  // this.searchServices.push({
  //   "id": "http://rosetest.library.jhu.edu/iiif-pres/collection/rosecollection/jhsearch",
  //   "label": "Roman de la Rose collection"
  // });
  this.searchServices.push({
    "id": "http://localhost:8080/iiif-pres/collection/top/jhsearch",
    "label": "All JHU collections"
  });
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------

  this.registerWidget();    // Register the Handlerbars partials
  this.init();
};

$.SearchWidget.prototype = {

  init: function() {
    var _this = this;

    // Initialize this.searchService using the first value in searchServiceIds array
    if (this.searchServices.length > 0) {
      this.getService(this.searchServices[0].id).done(function(service) {
        _this.switchSearchServices(service);
        _this.bindEvents();
      });
    }
  },

  /**
   * Reset advanced search UI and rebuild using settings from
   * the provided search service.
   */
  switchSearchServices: function(service) {
    var _this = this;

    if (typeof service === 'string') {
      this.getService(service).always(function(service) {
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
  },

  /**
   * @returns jQuery promise that resolves when a search service with the
   *          desired ID is found. The service may be cached in memory, or
   *          it may be retrieved by following the ID to get the service info.json
   *          #getService("service-url-id").done(function(jhiiifSearchService) { ... });
   */
  getService: function(id) {
    if (!id) {
      console.log("[SearchTab](window:" + this.windowId + ") failed to get search service, no ID provided.");
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
    }

    return jQuery.when(service);
  },

  toggle: function() {
    this.element.stop().slideFadeToggle(300);
  },

  /**
   * Bind handlers to all events in this widget.
   * * Handlers are bound to application events through the application
   * event bus.
   * * Add a handler to deal with switching search services
   *
   * @return nothing
   */
  bindEvents: function() {
    var _this = this;

    jQuery.subscribe('windowPinned', function(event, data) {
      if (data.windowId === _this.windowId) {
        _this.pinned = data.status;
      }
    });

    jQuery.subscribe('tabSelected.' + this.windowId, function(event, data) {
      if (data.id === _this.widgetId) {
        _this.element.show();
      } else {
        _this.element.hide();
      }
    });

    this.element.find(".search-within-object-select").on("change", function() {
      var selected = jQuery(this).val();
      _this.switchSearchServices(selected);
    });
  },

  /**
   * Bind handlers to listen for UI actions.
   */
  listenForActions: function() {
    var _this = this;

    this.element.find(".js-perform-query").on('submit', function(event){
        event.preventDefault();
        var messages = _this.element.find('.pre-search-message');
        var searchTerm = _this.element.find('.js-query').val();

        messages.empty();

        if (_this.searchService.getDefaultFields().length === 0) {
          jQuery(_this.messages['no-defaults']).appendTo(messages);
        }

        if (searchTerm && searchTerm.length > 0) {
          var query = $.generateBasicQuery(
            searchTerm,
            _this.searchService.getDefaultFields(),
            _this.searchService.query.delimiters.or
          );
          if (query && query.length > 0) {
            _this.displaySearchWithin(query);
          }
        } else {
          jQuery(_this.messages['no-term']).appendTo(messages);
        }
    });

    if (this.searchService.search.settings.fields.length > 0) {
      this.element.find('.search-disclose-btn-more').on('click', function() {
        _this.element.find('#search-form').hide('fast');
        _this.element.find('.search-disclose').show('fast');
        _this.element.find('.search-disclose-btn-more').hide();
        _this.element.find('.search-disclose-btn-less').show();
      });

      this.element.find('.search-disclose-btn-less').on('click', function() {
        _this.element.find('#search-form').show('fast');
        _this.element.find('.search-disclose').hide('fast');
        _this.element.find('.search-disclose-btn-less').hide();
        _this.element.find('.search-disclose-btn-more').show();
      });

      this.addAdvancedSearchLine();

      this.element.find(".perform-advanced-search").on('submit', function(event) {
        event.preventDefault();
        _this.element.find('.pre-search-message').empty();
        _this.performAdvancedSearch();
      });

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
    }
  },

  /**
   * Execute the search by making a request to the search service.
   * The query fragments from the UI elements must first be adapted
   * into the standard query format before being sent to the server.
   */
  performAdvancedSearch: function() {
    var _this = this;
    var parts = [];

    this.element.find('.advanced-search-line').each(function(index, line) {
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
          op: _this.searchService.query.delimiters[operation],
          category: child.data('query'),
          term: child.val()
        });
      });
    });

    var finalQuery = $.generateQuery(parts, this.searchService.query.delimiters.field);

    if (finalQuery && finalQuery.length > 0) {
      this.displaySearchWithin(finalQuery, _this.searchService.query.delimiters.and);
    }
  },

  searchFromUrl: function(url) {
    console.assert(url && url.length > 0, '[SearchWidget#searchFromUrl] Must provide a URL.');
    if (!url || url.length === 0) {
      return;
    }
    var _this = this;
    this.searchContext.sortOrder = this.element.find('.search-results-sorter select').val();

    this.element.find('.search-results-list').empty();
    new $.SearchWithinResults({
      manifest: _this.manifest,
      appendTo: _this.element.find('.search-results-list'),
      parent: _this,
      canvasID: _this.parent.currentCanvasID,
      baseUrl: _this.element.find('.search-within-object-select').val(),
      searchContext: _this.searchContext,
      pinned: _this.pinned,
      searchPrefix: ""
      // queryUrl: url,
      // selectedResult: _this.selectedResult,
    });
  },

  displaySearchWithin: function(query){
    var _this = this;
    if (query !== "") {
console.log("[SearchWidget] original : " + query);
      query = encodeURIComponent(query);
      this.searchContext.sortOrder = this.element.find('.search-results-sorter select').val();

      this.element.find('.search-results-list').empty();
      new $.SearchWithinResults({
        manifest: _this.manifest,
        appendTo: _this.element.find(".search-results-list"),
        parent: _this,
        panel: true,
        canvasID: _this.parent.currentCanvasID,
        imagesList: _this.imagesList,
        thumbInfo: {thumbsHeight: 80, listingCssCls: 'panel-listing-thumbs', thumbnailCls: 'panel-thumbnail-view'},
        query: query,
        searchContext: _this.searchContext,
        baseUrl: _this.element.find('.search-within-object-select').val(),
        pinned: _this.pinned,
        searchPrefix: ""
        // selectedResult: _this.searchContext.selectedResult
      });
    }
  },

  /**
   * Add a new line to the Advanced Search widget.
   */
  addAdvancedSearchLine: function() {
    var _this = this;
    var template = Handlebars.compile('{{> advancedSearchLine }}');

    var templateData = {
      'search': this.searchService.search,
      'query': this.searchService.query
    };
    // templateData.search.categories.choices = this.searchService.query.fields;

    var line = template(templateData);

    line = jQuery(line).insertAfter(
      this.element.find('.advanced-search-lines table tbody').children().last()
    );

    // For only the first line, hide the boolean operator
    var num_lines = this.element.find('.advanced-search-line').length;
    if (num_lines === 1) {
      line.find('.advanced-search-operators').hide();
    }

    // Hide all inputs except for the Default choice
    // Makes sure ENTER key presses activate advanced search
    this.searchService.search.settings.fields.forEach(function (field) {
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
          .find(_this.classNamesToSelector(_this.searchService.getField(jSelector.val()).class))
          .show();
    });

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

  registerWidget: function() {
    /*
     * Search within widget template
     * Uses default Window context.
     *
     * Example usage: {{> searchWithinWidget }}
     */
    Handlebars.registerPartial('searchWithinWidget',[
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
    ].join(''));

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
            '<button class="advanced-search-add-btn" value="add">Add Term</button>',
            '<button class="advanced-search-reset-btn">Reset</button>',
          '</div>',
          '<input type="submit" value="Search"/>',
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

    $.registerHandlebarsHelpers();
  },

  template: Handlebars.compile([
    '{{> searchWithinWidget }}'
  ].join(''))

};

}(Mirador));

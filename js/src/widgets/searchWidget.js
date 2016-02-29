(function($) {

/**
 * @param  {[type]} options init params, required
 *                          {
 *                          	parent: parent window that contains this widget,
 *                          	appendTo: the element in the parent to attach this widget,
 *                          	manifest: the Manifest object, containing manifest data/helper functions
 *                          	search: widget configs     ** TODO currently hardcoded below
 *                          }
 * @return {[type]}         Search Within widget
 */
$.SearchWidget = function(options) {

  jQuery.extend(this, {
    parent: null,   // Window object. To get window ID: this.parent.id
    windowId: null,
    widgetId: null,
    appendTo: null,
    element: null,
    width: 330,
    manifest: null, // Manifest object. To get search service: this.manifest.getSearchWithinService()
    searchService: null
  }, options);

  this.init();
};

$.SearchWidget.prototype = {

  init: function() {
    console.assert(this.searchService, '[SearchWidget] searchService MUST be supplied when creating this widget.');
    var _this = this;
    this.registerWidget();

    var templateData = {};
    templateData.search = this.searchService.search;
    templateData.search.manifest = {
      'id': this.manifest.getId(),
      'label': this.manifest.getLabel()
    };

    this.element = jQuery(this.template(templateData)).appendTo(this.appendTo);

    this.bindEvents();
  },

  toggle: function() {
    this.element.stop().slideFadeToggle(300);
  },

  bindEvents: function() {
    var _this = this;

    jQuery.subscribe('tabSelected.' + this.windowId, function(event, data) {
      if (data.id === _this.widgetId) {
        _this.element.show();
      } else {
        _this.element.hide();
      }
    });

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

    this.element.find(".js-perform-query").on('submit', function(event){
        event.preventDefault();

        var query = $.generateQuery(
          _this.generateAllQuery(_this.element.find('.js-query').val())
        );
        if (query && query.length > 0) {
          _this.displaySearchWithin(query);
        }
    });

    this.addAdvancedSearchLine();
    this.element.find(".perform-advanced-search").on('submit', function(event) {
      event.preventDefault();
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
  },

  /**
   * Get an array for a search on all fields ORed together.
   *
   * @param  (string) value string search term
   * @return array of objects:  {
   *                  						op: (operation = |)
   *                  						category: (search category),
   *                  						term: (search term = input value)
   *                  					}
   */
  generateAllQuery: function(value) {
    var _this = this;
    var query = [];

    this.searchService.query.fields.forEach(function(field) {
      query.push({
        op: _this.searchService.query.delimiters.or,
        category: _this.searchService.search.inputs[field].query,
        term: value
      });
    });

    return query;
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



  displaySearchWithin: function(query){
    var _this = this;
    if (query !== "") {
console.log("[SearchWidget] original : " + query);
      query = encodeURIComponent(query);

      new $.SearchWithinResults({
        manifest: _this.manifest,
        appendTo: _this.element.find(".search-results-list"),
        parent: _this,
        panel: true,
        canvasID: _this.parent.currentCanvasID,
        imagesList: _this.imagesList,
        thumbInfo: {thumbsHeight: 80, listingCssCls: 'panel-listing-thumbs', thumbnailCls: 'panel-thumbnail-view'},
        query: query,
        baseUrl: _this.element.find('.search-within-object-select').val()
      });
    }
  },

  isValidInput: function(input) {
    return input && input !== '';
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
    templateData.search.categories.choices = this.searchService.query.fields;

    var line = template(templateData);

    line = jQuery(line).insertAfter(
      this.element.find('.advanced-search-lines table tbody').children().last()
    );

    // Hide all inputs except for the Default choice
    // Makes sure ENTER key presses activate advanced search
    Object.keys(this.searchService.search.inputs).forEach(function (key) {
      var input = _this.searchService.search.inputs[key];
      var element = line.find(_this.classNamesToSelector(input.class));

      element.keypress(function(event) {
        if (event.which == 13) {
          event.preventDefault();
          _this.performAdvancedSearch();
        }
      });

      if (!input.default && input.class && input.class !== '') {
        element.hide();
      }
    });

    // Add functionality to 'remove' button
    line.find('.advanced-search-remove').on('click', function() {
      line.remove();
    });

    line.find('.advanced-search-categories').on('change', function(event) {
      var jSelector = jQuery(event.target);
      var user_inputs = line.find('.advanced-search-inputs');

      // Hide all input/select fields
      user_inputs.find('select').hide();
      user_inputs.find('input').hide();

      user_inputs.find(_this.classNamesToSelector(_this.searchService.search.inputs[jSelector.val()].class)).show();
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
              '<option value="{{search.manifest.id}}">{{search.manifest.label}}</option>',
              '<option value="{{search.collection.id}}">{{search.collection.label}}</option>',
            '</select>',
          '</p>',
        '</div>',
        '<form id="search-form" class="js-perform-query">',
          '<input class="js-query" type="text" placeholder="search"/>',
          '<input type="submit"/>',
        '</form>',
        '<div class="search-disclose-btn-more">Advanced Search</div>',
        '<div class="search-disclose-btn-less" style="display: none;">Basic Search</div>',
        '<div class="search-disclose-container">',
          '<div class="search-disclose" style="display: none;">',
            '{{> advancedSearch }}',
          '</div>',
        '</div>',
        '<div class="search-results-list"></div>',
      '</div>',
    ].join(''));

    Handlebars.registerPartial('advancedSearch', [
      '<div class="advanced-search">',
        '<form id="advanced-search-form" class="perform-advanced-search">',
          '<div class="advanced-search-lines">',
            '<table><tbody>',
              '<tr></tr>',
            '</tbody></table>',
          '</div>',
          '<div class="advanced-search-btn-container">',
            '<button class="advanced-search-add-btn" value="add">Add Line</button>',
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
        '{{#each search.inputs}}',
          '{{#ifCond type "===" "dropdown"}}',
            '{{> searchDropDown this}}',
          '{{/ifCond}}',
          '<input type="text" class="{{class}}" placeholder="{{placeholder}}" {{#if query}}data-query="{{query}}"{{/if}}/>',
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
      '<select class="{{class}}" {{#if query}}data-query="{{query}}{{/if}}">',
        '{{#if addBlank}}',
          '<option></option>',
        '{{/if}}',
        '{{#each choices}}',
          '<option value="{{#if value}}{{value}}{{else}}{{this}}{{/if}}">{{#if label}}{{label}}{{else}}{{this}}{{/if}}</option>',
        '{{/each}}',
      '</select>'
    ].join(''));

    $.registerHandlebarsHelpers();
  },

  template: Handlebars.compile([
    '{{> searchWithinWidget }}'
  ].join(''))

};

}(Mirador));

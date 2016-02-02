(function($) {

/**
 * [function description]
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
    appendTo: null,
    element: null,
    searchObject: null,
    manifest: null, // Manifest object. To get search service: this.manifest.getSearchWithinService()
    search : {
      'categories': {
        'label': 'Categories',
        'class': 'advanced-search-categories',
        'choices': ['all', 'marginalia', 'underlines', 'symbols', 'marks']
      },
      'inputs': {
        'all': {
          'label': 'All',
          'class': 'advanced-search-all',
          'type': 'text',
          'placeholder': 'Search across all categories',
          'query': 'all',
          'default': true
        },
        'symbols': {
          "label": "Symbols",
          "class": "advanced-search-symbols",
          "type": "dropdown",
          "choices": ['Asterisk', 'Bisectedcircle', 'Crown', 'JC', 'HT', 'LL', 'Mars', 'Mercury', 'Moon', 'Opposite_planets', 'Saturn', 'Square', 'SS', 'Sun', 'Venus'],
          'addBlank': true,
          'query': 'symbol'
        },
        'marks': {
          "label": "Marks",
          "class": "advanced-search-marks",
          "type": "dropdown",
          "choices": [
            'apostrophe', 'box', 'bracket', 'circumflex', 'colon', 'comma', 'dash', 'diacritic', 'dot', 'double_vertical_bar', 'equal_sign',
            'est_mark', 'hash', 'horizontal_bar', 'page_break', 'pen_trial', 'plus_sign', 'quotation_mark', 'scribble', 'section_sign',
            'semicolon', 'slash', 'straight_quotation_mark', 'tick', 'tilde', 'triple_dash', 'vertical_bar', 'X-sign'
          ],
          'addBlank': true,
          'query': 'mark'
        },
        'marginalia': {
          'label': "Marginalia",
          'class': 'advanced-search-marginalia',
          'type': 'text',
          'placeholder': 'Search marginalia text',
          'query': 'marginalia'
        },
        'underlines': {
          'label': 'Underlines',
          'class': 'advanced-search-underlines',
          'type': 'text',
          'placeholder': 'Search underlined text',
          'query': 'underline'
        }
      }
    }
  }, options);

  this.init();

};

$.SearchWidget.prototype = {

  init: function() {
    var _this = this;
    this.registerWidget();

    var templateData = {};
    templateData.search = this.search;

    this.element = jQuery(this.template(templateData)).appendTo(this.appendTo);

    this.bindEvents();
  },

  bindEvents: function() {
    var _this = this;

    this.parent.element.find('.mirador-icon-search-within').on('click', function() {
      _this.parent.element.find('.mirador-icon-search-within').toggleClass('selected');
      _this.element.stop().slideFadeToggle(300);
    });

    this.parent.element.find('.mirador-btn.js-close-search-within').on('click', function() {
      _this.parent.element.find('.mirador-icon-search-within').removeClass('selected');
      _this.element.stop().slideFadeToggle(300);
    });

    this.element.find('.search-disclose-btn-more').on('click', function() {
      _this.element.find('.search-disclose').show('fast');
      _this.element.find('.search-disclose-btn-more').hide();
      _this.element.find('.search-disclose-btn-less').show();
    });

    this.element.find('.search-disclose-btn-less').on('click', function() {
      _this.element.find('.search-disclose').hide('fast');
      _this.element.find('.search-disclose-btn-less').hide();
      _this.element.find('.search-disclose-btn-more').show();
    });

    this.element.find(".js-perform-query").on('submit', function(event){
        event.preventDefault();
        var query = _this.element.find(".js-query").val();
        _this.displaySearchWithin(query);
    });

    this.addAdvancedSearchLine();
    this.element.find(".perform-advanced-search").on('submit', function(event) {
      event.preventDefault();

      var total = '';
      _this.element.find('.advanced-search-line').each(function(index, line) {
        line = jQuery(line);
        var category = line.find('.advanced-search-categories').val();

        var data = '';
        switch (category) {
          case 'marginalia':
            data = line.find('.advanced-search-marginalia').val();
            if (_this.isValidInput(data)) {
              data.split(/\s+/).forEach(function(str) {
                total += 'marginalia:' + str + ' ';
              });
            }
            break;
          case 'underlines':
            data = line.find('.advanced-search-underlines').val();
            if (_this.isValidInput(data)) {
              data.split(/\s+/).forEach(function(str) {
                total += 'underline:' + str + ' ';
              });
            }
            break;
          case 'symbols':
            data = line.find('.advanced-search-symbols').val();
            if (_this.isValidInput(data)) {
              total += 'symbol:' + data + ' ';
            }
            break;
          case 'marks':
            data = line.find('.advanced-search-marks').val();
            if (_this.isValidInput(data)) {
              total += 'mark:' + data + ' ';
            }
            break;
          default:
            data = line.find('.advanced-search-all').val();
            if (_this.isValidInput(data)) {
              data.split(/\s+/).forEach(function(str) {
                total += 'all:' + data + ' ';
              });
            }
            break;
        }
      });

      if (_this.isValidInput(total)) {
        _this.displaySearchWithin(total);
      }
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

  displaySearchWithin: function(query){
    var _this = this;
    if (query !== ""){
      searchService = (_this.manifest.getSearchWithinService());
      this.searchObject = new $.SearchWithinResults({
            manifest: _this.manifest,
            appendTo: _this.element.find(".search-results-list"),
            parent: _this,
            panel: true,
            canvasID: _this.parent.currentCanvasID,
            imagesList: _this.imagesList,
            thumbInfo: {thumbsHeight: 80, listingCssCls: 'panel-listing-thumbs', thumbnailCls: 'panel-thumbnail-view'},
            query: query
          });
    }
  },

  isValidInput: function(input) {
    return input && input !== '';
  },

  /**
   * Add a new line to the Advanced Search widget.
   * @return {[type]} [description]
   */
  addAdvancedSearchLine: function() {
    var _this = this;
    var template = Handlebars.compile('{{> advancedSearchLine }}');

    var templateData = {"search": this.search};
    var line = template(templateData);

    line = jQuery(line).insertAfter(
      this.element.find('.advanced-search-lines table tbody').children().last()
    );

    // Hide all inputs except for the Default choice
    Object.keys(this.search.inputs).forEach(function (key) {
      var input = _this.search.inputs[key];
      if (!input.default && input.class && input.class !== '') {
        line.find(_this.classNamesToSelector(input.class)).hide();
      }
    });

    line.find('.advanced-search-categories').on('change', function(event) {
      var jSelector = jQuery(event.target);
      var user_inputs = jSelector.parent().parent().find('div');

      // Hide all input/select fields
      user_inputs.find('select').hide();
      user_inputs.find('input').hide();

      user_inputs.find(_this.classNamesToSelector(_this.search.inputs[jSelector.val()].class)).show();
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
        '<a href="javascript:;" class="mirador-btn js-close-search-within" title="close">',
         '<i class="fa fa-times fa-lg"></i>',
        '</a>',  // Close button
        '<form id="search-form" class="js-perform-query">',
          '<input class="js-query" type="text" placeholder="search"/>',
          '<input type="submit"/>',
        '</form>',
        '<div class="search-disclose-btn-more">Advanced Search</div>',
        '<div class="search-disclose-btn-less" style="display: none;">Hide</div>',
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
        '{{> searchDropDown search.categories }}',
      '</td>',
      '<td>',
        '<div>',
        '{{#each search.inputs}}',
          '{{#ifCond type "===" "text"}}',
            '<input type="text" class="{{class}}" placeholder="{{placeholder}}"/>',
          '{{else}}{{#ifCond type "===" "dropdown"}}',
            '{{> searchDropDown this}}',
          '{{/ifCond}}{{/ifCond}}',
        '{{/each}}',
        '</div>',
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
          '<option value="{{this}}">{{this}}</option>',
        '{{/each}}',
      '</select>'
    ].join(''));

    /**
     * Handlebars helper that allows the evaluation of 2 input boolean comparisons.
     * Follows standard JS rules. Due to the way Handlebars helpers handles
     * parameters, the operator must be surrounded by quotes, either double or
     * single.
     *
     * Possible operators:
     * 	* '=='    equals
     * 	* '==='   strict equals
     * 	* '<'     less than
     * 	* '<='    less than or equal to
     * 	* '>'     greater than
     * 	* '>='    greater than or equal to
     * 	* '&&'    AND
     * 	* '||'    OR
     *
     * To use, in a Handlebars template:
     * 		{{#ifCond var1 OPERATOR var2}}
     * Example:
     * 		{{#ifCond v1 '===' v2}}
     */
    Handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
      switch (operator) {
        case '==':
          return (v1 == v2) ? options.fn(this) : options.inverse(this);
        case '===':
          return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case '<':
          return (v1 < v2) ? options.fn(this) : options.inverse(this);
        case '<=':
          return (v1 <= v2) ? options.fn(this) : options.inverse(this);
        case '>':
          return (v1 > v2) ? options.fn(this) : options.inverse(this);
        case '>=':
          return (v1 >= v2) ? options.fn(this) : options.inverse(this);
        case '&&':
          return (v1 && v2) ? options.fn(this) : options.inverse(this);
        case '||':
          return (v1 || v2) ? options.fn(this) : options.inverse(this);
        default:
          return options.inverse(this);
      }
    });
  },

  template: Handlebars.compile([
    '{{> searchWithinWidget }}'
  ].join(''))

};

}(Mirador));

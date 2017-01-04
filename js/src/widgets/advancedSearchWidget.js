(function($){

  /**
   * This object is resposible for the UI and actions of an advanced search
   * widget.
   *
   * Public functions:
   *  #hasQuery() :: has a user input a query into this widget?
   *  #getQuery() :: get the user query from the UI
   *  #destroy() :: unbind all event listeners in preparation for this widget to be removed from the DOM
   */
  $.AdvancedSearchWidget = function(options) {
    jQuery.extend(true, this, {
      windowId: null,
      searchService: null,    // Search service with configs
      appendTo: null,
      element: null,
      hasDescription: true,
      eventEmitter: null,
      windowPinned: false,
      performAdvancedSearch: null,
      clearMessages: null,
    }, options);

    this.init();
  };

  $.AdvancedSearchWidget.prototype = {
    init: function() {
      var _this = this;
      this.registerPartials();

      this.element = jQuery(Handlebars.compile("{{> advancedSearch}}")({
        "search": _this.searchService
      })).appendTo(this.appendTo);

      this.element.tooltip({
        items: ".search-description-icon",
        content: Handlebars.compile("{{> searchDescription}}"),
        position: { my: "left+20 top", at: "right top-50" }
      });

      this.bindEvents();
      this.listenForActions();
      this.addAdvancedSearchLine();
    },

    bindEvents: function() {
      var _this = this;

      this.eventEmitter.subscribe('windowPinned', function(event, data) {
        if (data.windowId === _this.windowId) {
          _this.windowPinned = data.status;
        }
      });
    },

    listenForActions: function() {
      var _this = this;

      this.element.find(".advanced-search-add-btn").on("click", function(e) {
        e.preventDefault();
        _this.clearMessages();
        _this.addAdvancedSearchLine();
      });

      this.element.find(".advanced-search-reset-btn").on("click", function(e) {
        e.preventDefault();
        _this.clearMessages();

        _this.element.find(".advanced-search-line").each(function(index, line) {
          jQuery(line).remove();
        });
        _this.addAdvancedSearchLine();
      });

      this.element.find(".perform-advanced-search").on("submit", function(event) {
        event.preventDefault();
        _this.performAdvancedSearch(_this);
      });
    },

    destroy: function() {
      // TODO only need to worry about those listeners bound to eventEmitter.
      // Those DOM event handlers set in #bindEvents should unbind on removal from DOM
      this.appendTo.empty();
      this.element = null;
    },

    hasQuery: function() {
      var result = false;
console.log("[ASW] Checking if there is an advanced search query. ");
      this.element.find(".advanced-search-line").each(function(index, line) {
        result = result || jQuery(line).find(".advanced-search-inputs").children()
        .filter(function(index, child) {
          child = jQuery(child);
          return child.css("display") != "none" && child.val()&& child.val() !== "";
        })
        .length > 0;
      });

      return result;
    },

    getQuery: function() {
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
            op: _this.searchService.config.query.delimiters[operation],
            category: child.data('query'),
            term: child.val()
          });
        });
      });

      return $.generateQuery(parts, this.searchService.config.query.delimiters.field);
    },

    /**
     * Add a new line to the Advanced Search widget.
     */
    addAdvancedSearchLine: function() {
      var _this = this;
      var template = Handlebars.compile('{{> advancedSearchLine }}');

      var templateData = {
        'search': this.searchService.config.search,
        'query': this.searchService.config.query
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
      this.searchService.config.search.settings.fields.forEach(function (field) {
        var element = line.find(_this.classNamesToSelector(field.class));

        element.keypress(function(event) {
          if (event.which == 13) {
            event.preventDefault();
            _this.performAdvancedSearch(_this);
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
            .find(_this.classNamesToSelector(_this.searchService.config.getField(jSelector.val()).class))
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

    registerPartials: function() {
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
    }
  };

}(Mirador));

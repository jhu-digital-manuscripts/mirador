(function($){

  /**
   * This object is resposible for the UI and actions of an advanced search
   * widget.
   *
   * Public functions:
   *  #hasQuery() :: has a user input a query into this widget?
   *  #getQuery() :: get the user query from the UI
   *  #state()  ::  get the state of the advanced search widget
   *  #destroy() :: unbind all event listeners in preparation for this widget to be removed from the DOM
   */
  $.AdvancedSearchWidget = function(options) {
    jQuery.extend(true, this, {
      windowId: undefined,
      searchService: null,    // Search service with configs
      appendTo: null,
      element: null,
      hasDescription: true,
      eventEmitter: null,
      performAdvancedSearch: null,
      clearMessages: null,
      context: null,
    }, options);

    this.init();
  };

  $.AdvancedSearchWidget.prototype = {
    init: function() {
      var _this = this;
      this.registerPartials();

      this.element = jQuery(Handlebars.compile("{{> advancedSearch}}")({
        "search": _this.context.searchService
      })).appendTo(this.appendTo);

      this.bindEvents();
      this.listenForActions();

      if (this.context && this.context.ui && this.context.ui.advanced) {
        this.initFromContext();
      }
    },

    setTooltip: function (searchService) {
      this.element.tooltip({
        items: ".search-description-icon",
        content: Handlebars.compile("{{> searchDescription}}")(searchService.config.search.settings.fields),
        position: { my: "left+20 top", at: "right top-50" }
      });
    },

    bindEvents: function() {
      var _this = this;

      this.eventEmitter.subscribe('windowPinned', function(event, data) {
        if (data.windowId === _this.windowId) {
          _this.config.pinned = data.status;
        }
      });
    },

    listenForActions: function() {
      var _this = this;

      this.element.find(".advanced-search-add-btn").on("click", function(e) {
        e.preventDefault();
        _this.clearMessages();
        _this.addAdvancedSearchLine();
        _this.eventEmitter.publish("SEARCH_SIZE_UPDATED." + _this.windowId);
      });

      this.element.find(".advanced-search-reset-btn").on("click", function(e) {
        e.preventDefault();
        _this.clearMessages();

        _this.element.find(".advanced-search-line").each(function(index, line) {
          jQuery(line).remove();
        });
        _this.addAdvancedSearchLine();
        _this.eventEmitter.publish("SEARCH_SIZE_UPDATED." + _this.windowId);
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

    /**
     * 
     * @param context the new context
     * @param {boolean} refresh should this context change rerender the widget?
     */
    setContext: function(context, refresh) {
      this.context = context;
      if (context.searchService) {
        this.setTooltip(context.searchService);
      }
      if (refresh) {
        this.initFromContext();
      }
    },

    hasQuery: function() {
      var result = false;

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
            op: _this.context.searchService.config.query.delimiters[operation],
            category: child.data('query'),
            term: child.val()
          });
        });
      });

      return $.generateQuery(parts, this.context.searchService.config.query.delimiters.field);
    },

    /**
     * @returns array of rows active in the widget
     */
    searchState: function() {
      var adv = [];
      this.element.find(".advanced-search-line").each(function(row, line) {
        line = jQuery(line);

        line.find(".advanced-search-inputs").children()
        .filter(function(index, child) {
          child = jQuery(child);
          return child.css("display") != "none" && child.val() && child.val() !== "";
        })
        .each(function(index, child) {
          child = jQuery(child);
          adv.push({
            row: row,
            category: line.find(".advanced-search-categories").val(),
            operation: line.find(".advanced-search-operators").val(),
            term: child.val(),
            type: child.is("select") ? "select" : "input"
          });
        });
      });

      return {
        rows: adv
      };
    },

    initFromContext: function() {
      var _this = this;
      this.clearRows();
      const ui = this.context.ui;

      if (ui && ui.advanced && ui.advanced.rows &&ui.advanced.rows.length > 0) {
        var rowNums = [];
        ui.advanced.rows.forEach(function(input, index, arr) {
          if (rowNums.indexOf(input.row) < 0) {   // Add new line if needed
            _this.addAdvancedSearchLine();
            rowNums.push(input.row);
          }

          var theRow = _this.element.find(".advanced-search-line").last();
          var user_inputs = theRow.find('.advanced-search-inputs');
          var inputClass = ".advanced-search-" + input.category;

          theRow.find(".advanced-search-operators").val(input.operation);
          theRow.find(".advanced-search-categories").val(input.category);
          theRow.find(input.type + inputClass).val(input.term);

          // Hide all input/select fields
          user_inputs.children().hide();
          user_inputs
              .find(_this.classNamesToSelector(_this.context.searchService.config.getField(input.category).class))
              .show();
        });
      } else if (this.context.searchService && this.context.searchService.config) {
        this.addAdvancedSearchLine();
      }
    },

    clearRows: function () {
      this.element.find('.advanced-search-line').remove();
    },

    /**
     * Add a new line to the Advanced Search widget.
     */
    addAdvancedSearchLine: function() {
      var _this = this;
      var template = Handlebars.compile('{{> advancedSearchLine }}');

      var templateData = {
        'classes': this.lineClasses(),
        'search': this.context.searchService.config.search,
        'query': this.context.searchService.config.query
      };
      // templateData.search.categories.choices = this.searchService.query.fields;

      var line = jQuery(template(templateData));

      this.element.find('.advanced-search-lines').append(line);

      // For only the first line, hide the boolean operator
      var num_lines = this.element.find('.advanced-search-line').length;
      if (num_lines === 1) {
        line.find('.advanced-search-operators').hide();
      }

      // Hide all inputs except for the Default choice
      // Makes sure ENTER key presses activate advanced search
      this.context.searchService.config.search.settings.fields.forEach(function (field) {
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
            .find(_this.classNamesToSelector(_this.context.searchService.config.getField(jSelector.val()).class))
            .show();

        _this.eventEmitter.publish("SEARCH_SIZE_UPDATED." + _this.windowId);
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

    lineClasses: function () {
      if (this.config.inSidebar) {
        return {
          line: 'w-100'
        };
      } else {
        return {
          line: 'col-xl-3 border-right'
        };
      }
    },

    registerPartials: function() {
      Handlebars.registerPartial('advancedSearch', [
        '<div class="advanced-search container-fluid p-0">',
          '<i class="fa fa-2x fa-question-circle search-description-icon" title="Moo"></i>',
          '<form id="advanced-search-form" class="perform-advanced-search">',
            '<div class="advanced-search-lines row mr-0"></div>',

            '<div class="advanced-search-btn-container row mb-2">',
              '<button class="btn advanced-search-add-btn mx-2" value="add" aria-label="Add advanced search term">',
                '<i class="fa fa-fw fa-plus"></i> Add Term',
              '</button>',
              '<button class="btn advanced-search-reset-btn mx-2" aria-label="Reset advanced search form">',
                '<i class="fa fa-fw fa-ban"></i> Reset',
              '</button>',
              '<button class="btn mx-2" type="submit" aria-label="Do the search">',
                '<i class="fa fa-fw fa-search"></i> Search',
              '</button>',
            '</div>',

          '</form>',
        '</div>'
      ].join(''));

      Handlebars.registerPartial('advancedSearchLine', [
        // Select search category

        '<div class="advanced-search-line mb-2 {{classes.line}}">',
          '<div class="input-group">',

            '<div class="input-group-prepend col-5 p-0">',
              '{{> searchDropDown query.operators}}',
              '{{> searchDropDown search.categories}}',
            '</div>',

            '<div class="advanced-search-inputs col p-0">',
              '{{#each search.settings.fields}}',
                '{{#ifCond type "===" "dropdown"}}',
                  '{{> categoryDropdown this}}',
                  '<input type="text" class="{{class}} col-6" placeholder="{{placeholder}} (optional)" aria-label="{{#if name}}Search {{name}}" ',
                    'data-query="{{name}}"{{else}}"Search {{placeholder}}"{{/if}}/>',
                '{{else}}',
                  '<input type="text" class="{{class}} col" placeholder="{{placeholder}}" aria-label="{{#if name}}Search {{name}}" ',
                    'data-query="{{name}}"{{else}}"Search {{placeholder}}"{{/if}}/>',
                '{{/ifCond}}',
              '{{/each}}',
            '</div>',

            '<div class="input-group-append col-1 p-0">',
              '<button class="advanced-search-remove btn btn-outline-danger" type="button" aria-label="Remove row">',
                '<i class="fa fa-times"></i>',
              '</button>',
            '</div>',

          '</div>',
        '</div>',
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
        '<select class="{{class}}" aria-label="{{#if name}}Pick a specific {{name}}" data-query="{{name}}"{{else}}{{placeholder}}" {{/if}}>',
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

      Handlebars.registerPartial('categoryDropdown', [
        '<select class="{{class}} col-6" aria-label="{{#if name}}Pick a specific {{name}}" data-query="{{name}}"{{else}}{{placeholder}}" {{/if}}>',
          '{{#if addBlank}}',
            '<option></option>',
          '{{/if}}',
          '{{#each choices}}',
            '<option value="{{#if value}}{{value}}{{else}}{{value}}{{/if}}" {{#if description}}title="{{description}}"{{/if}}>',
              '{{label}}',
            '</option>',
          '{{/each}}',
        '</select>'
      ].join('')),

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
                ': {{{description}}}',
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

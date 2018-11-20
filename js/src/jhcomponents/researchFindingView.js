(function ($) {
  $.ResearchFindingView = function (options) {
    jQuery.extend(this, {
      eventEmitter: null,
      state: null,
      element: null,
      appendTo: null,
      viewData: [],
      utils: null,
    }, options);
    this.init();
  };

  $.ResearchFindingView.prototype = {
    init: function () {
      this.utils = new $.ResearchFindingUtils({
        saveController: this.state
      });

      this.element = jQuery(this.containerTemplate(
        this.containerTemplateData()
      )).appendTo(this.appendTo);

      this.bindEvents();
      this.listenForActions();

      this.element.outerHeight(this.appendTo.innerHeight());
    },

    listenForActions: function () {

    },

    bindEvents: function () {
      this.eventEmitter.subscribe('TOGGLE_RESEARCH_FINDING_VIEW', () => this.toggle());
      this.eventEmitter.subscribe('HERE_IS_HISTORY', (event, data) => this.updateHistoryList(data));
    },

    updateHistoryList: function (list) {
      this.historyList = list.history;
      this.historyList.forEach((item, index) => this.addRowData(item, index));
    },

    addRowData: function (item, index) {
      const templateData = this.rowTemplateData(item, index);
      this.viewData.push(templateData);

      const moo = jQuery(this.rowTemplate(templateData));
      this.element.find('.history-list').append(moo);
    },

    /**
     * @param {HistoryState} item 
     */
    rowTemplateData: function (item, index) {
      index++;    // 1 based index, instead of 0 based index
      return {
        index,
        item,
        label: this.utils.historyStateLabel(item),
        description: undefined
      };
    },

    containerTemplateData: function () {
      const config = this.state.getStateProperty('researchFinding');
      return {
        enableRMap: config.export.rmap,
        enableHtml: config.export.html
      };
    },

    toggle: function () {
      this.element.toggle();
      if (this.element.is(':visible')) {
        // Ask for current history
        this.element.find('.history-list').empty();
        this.eventEmitter.publish('REQUEST_HISTORY');
      }
    },

    /**
     * Template: {
     *    index: -1,          // integer, step number
     *    label: '',          // History step label
     *    description: '',    // Description for step, will come from the user
     * }
     */
    rowTemplate: Handlebars.compile([
      '<div class="row border border-dark rounded mx-4 py-2 d-flex align-items-center">',
        '<div class="col-1">',
          '<h2>{{index}}</h2>',
        '</div>',
        '<div class="col">',
          '<div class="row item-title">{{label}}</div>',
          '<div class="row item-description">Description: {{description}}</div>',
        '</div>',
        '<div class="col-2 d-flex justify-content-end">',
          '<button type="button" class="edit-history btn btn-info rounded-circle mx-2">',
            '<i class="fa fa-lg fa-pencil"></i>',
          '</button>',
          '<button type="button" class="remove-history btn btn-danger rounded-circle">',
            '<i class="fa fa-lg fa-times"></i>',
          '</button>',
        '</div>',
      '</div>'
    ].join('')),

    containerTemplate: Handlebars.compile([
      '<div class="research-finding-container container-fluid p-2" style="display: none;">',
      // '<div class="research-finding-container container-fluid p-2">',
        '<div class="row">',
          '<div class="col-9">',
            '<p>',
              'Review actions you took while navigating the Archaeology of Reading. You can add descriptions or remove any steps shown.',
            '</p>',
            '<div class="history-list"></div>',
          '</div>',
          '<div class="col">',
            '<div class="form-group">',
              '<label for="research-finding-description">Enter a description of what you found</label>',
              '<textarea class="form-control" id="research-finding-description" rows="8"></textarea>',
            '</div>',
            '<div class="form-group border border-warning rounded" style="height:250px;border-style:dashed !important">',
            '</div>',
            '<div class="form-group">',
              '{{#if enableHtml}}',
                '<button type="button" class="w-100 btn btn-primary">',
                  '<i class="fa fa-lg fa-download"></i>',
                  ' Export as HTML',
                '</button>',
              '{{/if}}',
            '</div>',
            '<div class="form-group">',
              '{{#if enableRMap}}',
                '<button type="button" class="w-100 btn btn-success">',
                  '<i class="fa fa-lg fa-external-link"></i>',
                  ' Send to RMap',
                '</button>',
              '{{/if}}',
            '</div>',
          '</div>',
        '</div>',
      '</div>'
    ].join(''))
  };
} (Mirador));
(function ($) {
  $.ResearchFindingView = function (options) {
    jQuery.extend(this, {
      eventEmitter: null,
      state: null,
      element: null,
      appendTo: null,
      historyList: [],
      viewData: [],   // [ {ViewStep}, ... ]
      utils: null,
      editDialog: null,
      edit: {
        item: null,
        row: null
      },
      htmlExport: null,     // Html Export Modal
      // baseUrl: null,
      urlSlicer: null,
    }, options);
    this.init();
  };

  $.ResearchFindingView.prototype = {
    init: function () {
      this.utils = new $.ResearchFindingUtils({
        saveController: this.state,
        eventEmitter: this.eventEmitter
      });

      this.registerHandlebarsUtils();

      this.element = jQuery(this.containerTemplate(
        this.containerTemplateData()
      )).appendTo(this.appendTo);

      this.setEditDialog();

      this.bindEvents();
      this.listenForActions();

      this.urlSlicer = new $.JHUrlSlicer();
      // this.baseUrl = new URI().query('').fragment('').toString();

      const rfConfig = this.state.getStateProperty('researchFinding');

      this.htmlExport = new $.HtmlExportModal({
        appendTo: this.element,
        cssUri: rfConfig.html.css,
        utils: this.utils
      });

      this.rmapExport = new $.RmapExportModal({
        appendTo: this.element,
        utils: this.utils,
        rmapUrl: rfConfig.rmap.url,
        rmapApi: rfConfig.rmap.url + rfConfig.rmap.api,
        context: rfConfig.rmap.context,
        resolver: rfConfig.rmap.resolver
      });
    },

    listenForActions: function () {
      this.element.find('.export-html').click(() => this.exportToHtml());
      this.element.find('.export-rmap').click(() => this.exportToRmap());
    },

    bindEvents: function () {
      this.eventEmitter.subscribe('TOGGLE_RESEARCH_FINDING_VIEW', () => this.toggle());
      this.eventEmitter.subscribe('ADDED_HISTORY', (event, data) => this.addHistoryItem(data.event));
    },

    listenForItemActions: function (item, row) {
      const match = this.viewData.findIndex(entry => entry.item.id === item.id);
      if (match >= 0) {
        row.find('.edit-history').click(() => this.startRowEdit(this.viewData[match], row));
        row.find('.remove-history').click(() => this.removeSelectedRow(this.viewData[match], row));
        row.find('a.export-link').click((event) => event.preventDefault());
      }
    },

    setEditDialog: function () {
      const _this = this;

      function closeRowEdit() {
        _this.editDialog.modal('toggle');
        _this.editDialog.find('form')[0].reset();
        _this.edit = undefined;
      }

      function doRowEdit() {
        const newTitle = _this.editDialog.find('input#edit-entry-title').val();
        if (newTitle && newTitle.length > 0) {
          _this.edit.row.find('.item-title div').html(newTitle);
        }

        const newDesc = _this.editDialog.find('textarea#edit-entry-description').val();
        _this.edit.row.find('.item-description').html(newDesc);

        updateViewData(_this.edit.item, newTitle, newDesc);
        closeRowEdit(); 
      }

      function updateViewData(item, label, description) {
        const match = _this.viewData.findIndex(data => data.item.id === item.id);
        if (match >= 0) {
          let edit = {};

          if (label && label.length > 0) {
            edit.label = label;
          }
          edit.description = description;

          jQuery.extend(_this.viewData[match], edit);
        }
      }

      this.editDialog = this.element.find('#history-list-edit-row').modal({
        backdrop: false,
        show: false
      });
      this.editDialog.find('form').submit((event) => {
        event.preventDefault();
        doRowEdit();
      });
      this.editDialog.find('.edit-entry-save').click(doRowEdit);
    },

    addHistoryItem: function (item) {
      // We can filter history items here so items such as Add/Remove slot do not appear
      if (item.type === $.HistoryStateType.slot_change) {
        return;
      }
      this.historyList.push(item);
    },

    updateHistoryList: function (list) {
      this.historyList = list.history;
      this.historyList.forEach((item, index) => this.addRowData(item, index));
    },

    addRowData: function (item, index) {
      const templateData = this.rowTemplateData(item, index);
      // const templateData = this.rowTemplateData(item, this.viewData.length);
      this.viewData.push(templateData);

      const moo = jQuery(this.rowTemplate(templateData));
      this.element.find('.history-list').append(moo);
      this.listenForItemActions(item, moo);
    },

    /**
     * @param {HistoryState} item 
     */
    rowTemplateData: function (item, index) {
      index++;    // 1 based index, instead of 0 based index
      const url = this.urlSlicer.toUrl(item);

      return new $.ViewStep({
        index,
        item,
        label: this.utils.historyStateLabel(item),
        description: undefined,
        url
      });
    },

    containerTemplateData: function () {
      const config = this.state.getStateProperty('researchFinding');
      return {
        enableRMap: config.export.rmap,
        enableHtml: config.export.html
      };
    },

    toggle: function () {
      const _this = this;

      this.element.toggle();
      // Generate templates for those items that do not already have templates
      // Generate templates on toggle to better ensure that data has already been loaded correctly
      this.historyList.forEach((item, index) => {
        if (!_this.viewData.find(d => item.equals(d.item))) {
          _this.addRowData(item, index);
        }
      });
      this.redoIndexes();
    },

    startRowEdit: function (entry, row) {
      this.edit = {
        item: entry.item,
        entry,
        row
      };
      this.editDialog.find('input#edit-entry-title').val(entry.label);
      this.editDialog.find('textarea#edit-entry-description').val(entry.description);
      // this.editDialog.dialog('open');
      this.editDialog.modal('toggle');
    },

    removeSelectedRow: function (entry, row) {
      if (!entry || !row) {
        return;
      }
      // TODO: Should remove from history list?
      row.remove();
      
      const viewIndex = this.viewData.findIndex(item => entry.id === item.item.id);
      if (viewIndex >= 0) {
        this.viewData.splice(viewIndex, 1);
      }
      const historyIndex = this.historyList.findIndex(item => item.id === entry.id);
      if (historyIndex >= 0) {
        this.historyList.splice(historyIndex, 1);
      }

      this.redoIndexes();
    },

    redoIndexes: function () {
      this.viewData.forEach((d, i) => d.index = i + 1);
      this.element.find('.history-list').children().each(function (i) {
        jQuery(this).find('.item-index').html(i);
      });
    },

    exportToHtml: function () {
      const description = this.element.find('#research-finding-description').val();
      const list = this.element.find('.history-col .history-list').clone();

      list.find('button').remove();

      const stringified = this.utils.htmlToString(
        jQuery('<p>' + description + '</p>'),
        list
      );

      this.htmlExport.setContent(stringified);
      this.htmlExport.open();
    },

    exportToRmap: function () {
      this.rmapExport.setContent({
        description: this.element.find('#research-finding-description').val(),
        steps: this.viewData
      });
      this.rmapExport.open();
    },

    registerHandlebarsUtils: function () {
      /**
       * Expects template: {}   // HistoryState
       */
      Handlebars.registerPartial('historyState', [
        '<span class="invisible item-data" ',
            'data-fragment="{{fragment}}" ',
            'data-windowid="{{data.windowId}}" ',
            'data-collection="{{data.collection}}" ',
            'data-manifest="{{data.manifest}}" ',
            'data-canvas="{{data.canvas}}" ',
            'data-viewtype="{{data.viewType}}">',
        '</span>',
      ].join(''));
    },

    /**
     * Template: {
     *    index: -1,          // integer, step number
     *    label: '',          // History step label
     *    description: '',    // Description for step, will come from the user
     *    item: {}            // HistoryState
     * }
     */
    rowTemplate: Handlebars.compile([
      '<li>',
        '<div class="row border border-dark rounded mx-4 my-2 py-2 d-flex align-items-center">',
          '<div class="col-1">',
            '<h2 class="item-index">{{index}}</h2>',
          '</div>',
          '<div class="col">',
            '<div class="row item-title">',
              // '{{#if url}}<a href="{{url}}">{{label}}</a>{{else}}{{label}}{{/if}}',
              // '<div class="research-finding-link view-link">{{label}}</div>',
              // '<a class="research-finding-link export-link" href="{{url}}">{{label}}</a>',
              '<div>{{label}}</div>',
              '<a class="research-finding-link hidden" href="{{url}}" target="_blank">{{url}}</a>',
            '</div>',
            '<div class="row item-description">{{description}}</div>',
          '</div>',
          '<div class="col-2 d-flex justify-content-end">',
            // '<button type="button" class="edit-history btn btn-info rounded-circle mx-2" data-toggle="modal" data-target="history-list-edit-row">',
            '<button type="button" class="edit-history btn btn-info rounded-circle mx-2">',
              '<i class="fa fa-lg fa-pencil"></i>',
            '</button>',
            '<button type="button" class="remove-history btn btn-danger rounded-circle" ',
                'data-toggle="popover" data-trigger="focus" title="Not implemented yet">',
              '<i class="fa fa-lg fa-times"></i>',
            '</button>',
          '</div>',
          '{{> historyState item}}',
        '</div>',
      '</li>'
    ].join('')),

    containerTemplate: Handlebars.compile([
      '<div class="research-finding-container container-fluid p-2 h-100" style="display: none;">',
      // '<div class="research-finding-container container-fluid p-2">',
        '<div class="row h-100">',
          '<div class="col-9 h-100 history-col">',
            '<p>',
              'Review actions you took while navigating the Archaeology of Reading. You can add descriptions or remove any steps shown.',
            '</p>',
            '<ul class="history-list p-0">',
              '<h1>The Archaeology of Reading in Early Modern Europe</h1>',
            '</ul>',
          '</div>',
          '<div class="col">',
            '<div class="form-group">',
              '<label for="research-finding-description">Enter a description of what you found</label>',
              '<textarea class="form-control" id="research-finding-description" rows="5"></textarea>',
            '</div>',
            '<div class="form-group border border-warning rounded" style="my-auto border-style:dashed !important">',
            '</div>',
            '<div class="form-group">',
              '{{#if enableHtml}}',
                '<button type="button" class="w-100 btn btn-primary export-html">',
                  '<i class="fa fa-lg fa-download"></i>',
                  ' Export as HTML',
                '</button>',
              '{{/if}}',
            '</div>',
            '<div class="form-group">',
              '{{#if enableRMap}}',
                '<button type="button" class="w-100 btn btn-success export-rmap">',
                  '<i class="fa fa-lg fa-external-link"></i>',
                  ' Export to RMap',
                '</button>',
              '{{/if}}',
            '</div>',
          '</div>',
        '</div>',
        // Popup to edit a row
        '<div id="history-list-edit-row" class="modal" tabindex="-1" role="dialog" data-background=false>',
          '<div class="modal-dialog" role="document">',
            '<div class="modal-content">',
              '<div class="modal-header">',
                '<h5>Edit</h5>',
                '<button type="button" class="close" data-dismiss="modal" aria-label="Close">',
                  '<span aria-hidden="true">&times;</span>',
                '</button>',
              '</div>',
              '<div class="modal-body">',
                '<form>',
                  '<div class="form-group">',
                    '<label for="edit-entry-title">Title:</label>',
                    '<input type="text" id="edit-entry-title" name="edit-entry-title" class="form-control">',
                  '</div>',
                  '<div class="form-group">',
                    '<label for="edit-entry-description">Description:</label>',
                    '<textarea id="edit-entry-description" name="edit-entry-description" rows="5" class="form-control">',
                    '</textarea>',
                  '</div>',
                '</form>',
              '</div>',
              '<div class="modal-footer">',
                '<button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>',
                '<button type="button" class="btn btn-primary edit-entry-save">Save</button>',
              '</div>',
            '</div>',
          '</div>',
        '</div>',
      '</div>'
    ].join(''))
  };
} (Mirador));
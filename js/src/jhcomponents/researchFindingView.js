(function ($) {
  $.ResearchFindingView = function (options) {
    jQuery.extend(this, {
      eventEmitter: null,
      state: null,
      element: null,
      appendTo: null,
      viewData: [],
      utils: null,
      editDialog: null,
      edit: {
        item: null,
        row: null
      }
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

      this.setEditDialog();

      this.bindEvents();
      this.listenForActions();

      // this.element.find('[data-toggle="popover"]').popover();
      // this.element.outerHeight(this.appendTo.innerHeight());
    },

    listenForActions: function () {
      this.element.find('.export-html').click(() => this.exportToHtml());
      this.element.find('.export-rmap').click(() => this.exportToRmap());
    },

    bindEvents: function () {
      this.eventEmitter.subscribe('TOGGLE_RESEARCH_FINDING_VIEW', () => this.toggle());
      this.eventEmitter.subscribe('HERE_IS_HISTORY', (event, data) => this.updateHistoryList(data));
    },

    listenForItemActions: function (item, row) {
      const _this = this;

      const match = this.viewData.findIndex(entry => entry.item.id === item.id);
      if (match >= 0) {
        row.find('.edit-history').click(() => this.startRowEdit(this.viewData[match], row));
        row.find('.remove-history').click(() => this.removeSelectedRow(this.viewData[match], row));
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
          _this.edit.row.find('.item-title').html(newTitle);
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

    updateHistoryList: function (list) {
      this.historyList = list.history;
      this.historyList.forEach((item, index) => this.addRowData(item, index));
    },

    addRowData: function (item, index) {
      const templateData = this.rowTemplateData(item, index);
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
    },

    exportToHtml: function () {
      console.log('Request export as HTML');
    },

    exportToRmap: function () {
      console.log('Request export to RMap');
    },

    /**
     * Template: {
     *    index: -1,          // integer, step number
     *    label: '',          // History step label
     *    description: '',    // Description for step, will come from the user
     * }
     */
    rowTemplate: Handlebars.compile([
      '<div class="row border border-dark rounded mx-4 my-2 py-2 d-flex align-items-center">',
        '<div class="col-1">',
          '<h2>{{index}}</h2>',
        '</div>',
        '<div class="col">',
          '<div class="row item-title">{{label}}</div>',
          '<div class="row item-description">Description: {{description}}</div>',
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
      '</div>'
    ].join('')),

    containerTemplate: Handlebars.compile([
      '<div class="research-finding-container container-fluid p-2 h-100" style="display: none;">',
      // '<div class="research-finding-container container-fluid p-2">',
        '<div class="row h-100">',
          '<div class="col-9 h-100 history-col">',
            '<p>',
              'Review actions you took while navigating the Archaeology of Reading. You can add descriptions or remove any steps shown.',
            '</p>',
            '<div class="history-list"></div>',
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
                  ' Send to RMap',
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
(function ($) {
  $.RmapExportModal = function (options) {
    jQuery.extend(this, {
      element: null,
      appendTo: null,
      utils: null
    }, options);

    this.rmapTransformer = new $.RmapTransformer({
      utils: this.utils
    });

    this.init();
  };

  $.RmapExportModal.prototype = {
    init: function () {
      this.element = jQuery(this.template()).appendTo(this.appendTo);
      this.element.modal({
        backdrop: false,
        show: false
      });

      this.listenForActions();
    },

    listenForActions: function () {
      const _this = this;

      this.element.find('.btn-close').click(() => this.element.modal('hide'));

    },

    setContent: function (content) {
      console.log('Moo');
      const result = this.rmapTransformer.transform(content);
      console.log(result);
    },

    open: function () {
      this.element.modal('show');
    },

    template: Handlebars.compile([
      '<div id="dialog-export-html" class="modal" tabindex="-1" role="dialog">',
        '<div class="modal-dialog modal-lg h-75" role="document">',
          '<div class="modal-content h-100">',
            '<div class="modal-header">',
              '<h5>RMap Export</h5>',
              '<button type="button" class="close btn-close" aria-label="Close">',
                '<span aria-hidden="true">&times;</span>',
              '</button>',
            '</div>',
            '<div class="modal-body h-75">',
              // Body content
            '</div>',
            '<div class="modal-footer">',
              '<div class="input-group">',
                '<button type="button" class="btn btn-secondary btn-close" aria-label="Cancel">Cancel</button>',
              '</div>',
              '<div class="input-group">',
                '<input class="form-control export-filename" aria-label="Enter your RMap credentials" placeholder="Enter your RMap credentials">',
                '<div class="input-group-append">',
                  '<button type="button" class="btn btn-primary btn-export" aria-label="Export to RMap">',
                    'Export',
                  '</button>',
                '</div>',
              '</div>',
            '</div>',
          '</div>',
        '</div>',
      '</div>',
    ].join(''))
  };
} (Mirador));

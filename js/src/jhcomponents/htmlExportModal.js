(function ($) {
  $.HtmlExportModal = function (options) {
    jQuery.extend(this, {
      content: null,  // Stringified HTML
      defaultFilename: 'research-finding.html',
      element: null,
      appendTo: null,
      url: null
    }, options);

    this.init();
  };

  $.HtmlExportModal.prototype = {
    init: function () {
      this.element = jQuery(this.template()).appendTo(this.appendTo);
      this.element.modal({
        backdrop: false,
        show: false
      });

      this.listenForActions();
      this.element.find('input.export-filename').val(this.defaultFilename);
    },

    /**
     * @param {string} cnt stringified HTML
     */
    setContent: function (cnt) {
      const body = this.element.find('.modal-body');
      body.empty();
      body.html(jQuery(cnt));

      // Also change the download link
      this.unsetDownload();

      // const data = new Blob([cnt], { type: 'text/html' });
      const data = new Blob([cnt], { type: 'octet/stream' });
      this.url = URL.createObjectURL(data);
    },

    doDownload: function (event) {
      let name = this.element.find('input.export-filename').val().trim();

      if (!name || name.length === 0) {
        event.preventDefault();
        console.log('%cInvalid research finding filename "' + name + '"', 'color:red;');
        return;
      } else if (name.substring(name.lastIndexOf('.')) !== '.html') {
        name += '.html';
      }

      const button = this.element.find('button.btn-export a');
      button.attr('href', this.url);
      button.attr('download', name);
    },

    unsetDownload: function () {
      if (!this.url) {
        return;
      }
      URL.revokeObjectURL(this.url);
    },

    validateFilename: function () {
      const button = this.element.find('button.btn-export');
      const input = this.element.find('input.export-filename');
      const val = input.val().trim();

      if ((!val || val.length === 0)) {
        if (!input.hasClass('is-invalid')) {
          input.addClass('is-invalid');
          button.addClass('disabled');
        }
      } else {
        input.removeClass('is-invalid');
        button.removeClass('disabled');
      }
    },

    listenForActions: function () {
      const _this = this;

      this.element.find('.btn-close').click(() => this.element.modal('hide'));
      this.element.find('button.btn-export').click(function (event) {
        _this.doDownload(event);
      });

      this.element.find('input.export-filename').keyup(function () {
        _this.validateFilename();
      });
    },

    open: function () {
      this.element.modal('show');
    },

    template: Handlebars.compile([
      '<div id="dialog-export-html" class="modal" tabindex="-1" role="dialog">',
        '<div class="modal-dialog modal-lg h-75" role="document">',
          '<div class="modal-content h-100">',
            '<div class="modal-header">',
              '<h5>Export Preview</h5>',
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
                '<input class="form-control export-filename" aria-label="Enter filename">',
                '<div class="input-group-append">',
                  '<button type="button" class="btn btn-primary btn-export" aria-label="Save file">',
                    '<a href="#" target="_blank">Save</a>',
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
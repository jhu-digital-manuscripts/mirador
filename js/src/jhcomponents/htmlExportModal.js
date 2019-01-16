(function ($) {
  $.HtmlExportModal = function (options) {
    jQuery.extend(this, {
      content: null,  // Stringified HTML
      defaultFilename: 'research-finding.html',
      element: null,
      appendTo: null,
      url: null,
      cssUri: null,
      css: null,
      utils: null,
    }, options);

    this.init();
  };

  $.HtmlExportModal.prototype = {
    init: function () {
      jQuery.get(this.cssUri)
        .done(css => this.css = css);
      
      this.element = jQuery(this.template({css: this.css})).appendTo(this.appendTo);
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
      const style = this.utils.htmlToString(this.style(this.css));
      const body = this.element.find('.modal-body');
      body.empty();
      // body.append(this.style(this.css));
      body.append(jQuery(cnt));

      // Also change the download link
      this.unsetDownload();

      // this.utils.htmlToString(jQuery(this.style(this.css)), jQuery(cnt))

      const data = new Blob([style, cnt], { type: 'text/html' });
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

      const button = this.element.find('#download-anchor');
      button.attr('href', this.url);
      button.attr('download', name);

      button[0].click();

      this.element.modal('hide');
    },

    unsetDownload: function () {
      if (!this.url) {
        return;
      }
      URL.revokeObjectURL(this.url);
      this.element.find('#download-anchor').attr('href', '#');
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
        return false;
      } else {
        input.removeClass('is-invalid');
        button.removeClass('disabled');
        return true;
      }
    },

    listenForActions: function () {
      const _this = this;

      this.element.find('.btn-close').click(() => this.element.modal('hide'));
      this.element.find('button.btn-export').click(function (event) {
        _this.doDownload(event);
      });

      this.element.find('input.export-filename').keyup(function (event) {
        if (!_this.validateFilename()) {
          return;
        }
        if (event.keyCode === 13) {
          _this.doDownload(event);
        }
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
              '<h5>HTML Export</h5>',
              '<button type="button" class="close btn-close" aria-label="Close">',
                '<span aria-hidden="true">&times;</span>',
              '</button>',
            '</div>',
            '<p class="m-2">',
              'By clicking "Save" your research finding will be converted to and saved as an HTML file as ',
              'previewed in this screen. The file will be saved in the default downloads directory on your ',
              'hard drive. The file name can be changed. This file will open in your default web browser.',
            '</p>',
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
                    'Save',
                  '</button>',
                  '<a href="#" target="_blank" class="invisible" id="download-anchor">Save</a>',
                '</div>',
              '</div>',
            '</div>',
          '</div>',
        '</div>',
      '</div>',
    ].join('')),

    style: Handlebars.compile('<style>{{this}}</style>')
  };
} (Mirador));
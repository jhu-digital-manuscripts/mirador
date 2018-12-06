(function ($) {
  $.RmapExportModal = function (options) {
    jQuery.extend(this, {
      element: null,
      appendTo: null,
      utils: null,
      rmapUrl: null
    }, options);

    this.rmapTransformer = new $.RmapTransformer({
      utils: this.utils
    });

    this.init();
  };

  $.RmapExportModal.prototype = {
    init: function () {
      this.element = jQuery(this.template({
        // bodyText: this.readme,
        rmapUrl: this.rmapUrl
      })).appendTo(this.appendTo);
      this.element.modal({
        backdrop: false,
        show: false
      });

      this.listenForActions();
    },

    /*
     * 
     */
    listenForActions: function () {
      const _this = this;

      this.element.find('.btn-close').click(() => this.element.modal('hide'));
      this.element.find('button.btn-export').click(function (event) {
        _this.doExport(event);
      });

      this.element.find('input.export-data').keyup(function (event) {
        if (!_this.validate(event)) {
          return;
        }
        if (event.keyCode === 13) {
          _this.doExport(event);
        }
      });
    },

    setContent: function (content) {
      console.log('Moo');
      const result = this.rmapTransformer.transform(content);
      console.log(result);
    },

    open: function () {
      this.element.modal('show');
    },

    validate: function () {
      const button = this.element.find('button.btn-export');
      const input = this.element.find('input#input-api-key');
      const val = input.val().trim();

      if (!val || val.length === 0) {
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

    doExport: function () {
      const key = this.element.find('input#input-api-key').val().trim();
      console.log('%cShould export to RMap now! (' + key + ')', 'color:green;');
      this.element.modal('hide');
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
              '<p>',
                'By clicking \"Export\" your research finding will be converted to a DiSCO and sent to ',
                '<a href="{{rmapUrl}}">RMap</a>. You can login using your Google credentials by clicking ',
                '"Sign in with Google" option in RMap. In order to proceed, you need an RMap API key associated ',
                'with your RMap account. ',
              '</p>',
              '<div class="form-group row">',
                '<label for="input-api-key" class="col-sm-2 col-form-label">RMap API Key</label>',
                '<div class="col">',
                  '<input id="input-api-key" class="form-control is-invalid export-data">',
                '</div>',
              '</div>',
              '<div class="row">',
                '<a class="ml-4 btn btn-info" data-toggle="collapse" href="#rmap-api-key-info" role="button" aria-expanded="false" aria-controls="rmap-api-key-info">',
                  'Get your RMap API key',
                '</a>',
              '</div>',
              '<div class="collapse mx-4 my-2" id="rmap-api-key-info">',
                '<ul class="list-group">',
                  '<li class="list-group-item">Login to RMap</li>',
                  '<li class="list-group-item">Hover over your user name to bring up a menu and click on "Manage API keys"</li>',
                  '<li class="list-group-item">If you already have an API key, you can copy the key to your clipboard here. ',
                      'Otherwise, you can click "Create new key" to get a key.</li>',
                '</ul>',
              '</div>',
            '</div>',
            '<div class="modal-footer">',
              '<button type="button" class="btn btn-secondary btn-close" aria-label="Cancel">Cancel</button>',
              '<button type="button" class="btn btn-primary btn-export disabled" aria-label="Export to RMap">',
                'Export',
              '</button>',
            '</div>',
          '</div>',
        '</div>',
      '</div>',
    ].join('')),
  };
} (Mirador));

(function ($) {
  $.RmapExportModal = function (options) {
    jQuery.extend(this, {
      element: null,
      appendTo: null,
      utils: null,
      rmapUrl: 'https://test.rmap-hub.org/',
      content: null
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
      this.content = content;
    },

    open: function () {
      this.element.modal('show');
    },

    validate: function () {
      if (!this.content) {
        return false;
      }

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
      const data = this.rmapTransformer.transform(this.content);
      const key = this.element.find('input#input-api-key').val().trim();
      console.log('%cShould export to RMap now! (' + key + ')', 'color:green;');
      
      const button = this.element.find('button.btn-export');
      const messages = this.element.find('#rmap-modal-messages');
      
      button.addClass('disabled');
      messages.html(jQuery(this.loadingMsg));
      // jQuery.post({
      //   url: this.rmapUrl,
      //   data,
      //   dataType: 'application/ld+json',
      //   headers: {
      //     'Authorization': 'Basic ' + btoa(key)
      //   }
      // }).done(result => {

      // }).fail(error => {

      // }).always(() => {

      // });

      // this.element.modal('hide');
    },

    loadingMsg: '<p><i class="fa fa-spinner fa-pulse fa-2x fa-fw"></i> Sending data to RMap</p>',

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
                'When you click \"Export\" your research finding will be converted to a Distributed Scholarly Compound Object (DiSCO) and sent to ',
                '<a class="text-primary" href="{{rmapUrl}}" target="_blank">RMap</a>. In order to proceed, you need an RMap API key associated ',
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
                  '<li class="list-group-item">',
                    'Login to <a class="text-primary" href="{{rmapUrl}}" target="_blank">RMap</a>. ',
                    'If you do not have an RMap account, you can create one using a Google or Twitter account.',
                  '</li>',
                  '<li class="list-group-item">Hover over your user name to bring up a menu and click on "Manage API keys"</li>',
                  '<li class="list-group-item">If you already have an API key, you can copy the key to your clipboard here. ',
                      'Otherwise, you can click "Create new key" to get a key.</li>',
                '</ul>',
              '</div>',
            '</div>',
            '<div class="modal-footer">',
              '<div id="rmap-modal-messages" class="row mx-4">',

              '</div>',
              '<div class="row mx-4">',
                '<button type="button" class="btn btn-secondary btn-close" aria-label="Cancel">Cancel</button>',
                '<button type="button" class="btn btn-primary btn-export disabled" aria-label="Export to RMap">',
                  'Export',
                '</button>',
              '</div>',
            '</div>',
          '</div>',
        '</div>',
      '</div>',
    ].join('')),
  };
} (Mirador));

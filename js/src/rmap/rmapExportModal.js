(function ($) {
  $.RmapExportModal = function (options) {
    jQuery.extend(this, {
      element: null,
      appendTo: null,
      utils: null,
      rmapUrl: null,
      rmapApi: null,
      context: null,
      resolver: null,
      content: null
    }, options);

    this.rmapTransformer = new $.RmapTransformer({
      utils: this.utils,
      contextUri: this.context
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
      this.element.find('#rmap-modal-messages').empty();
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

      const button = this.element.find('button.btn-export');
      const messages = this.element.find('#rmap-modal-messages');
      
      button.addClass('disabled');
      messages.html(jQuery(this.loadingMsg));

      jQuery.post({
        url: this.rmapApi,
        data: JSON.stringify(data),
        headers: {
          'Authorization': 'Basic ' + btoa(key),
          'Content-Type': 'application/ld+json; charset=utf-8'
        }
      }).done(result => {
        const url = this.rmapUrl + this.resolver + encodeURIComponent(result);
        messages.html(this.rmapSucceed(url));
      }).fail(error => {
        messages.html(
          jQuery(this.failureTemplate({
            message: error.statusText
          }))
        );
        button.removeClass('disabled');
      }).always(() => {
        // button.removeClass('disabled');
      });
    },

    loadingMsg: '<p><i class="fa fa-spinner fa-pulse fa-2x fa-fw"></i> Sending data to RMap</p>',
    
    rmapSucceed: Handlebars.compile([
      '<p class="text-success w-100 text-left">',
        '<i class="fa fa-smile-o fa-2x fa-fw"></i> ',
        'Successfully sent your research finding to RMap. Please copy this link for your records: ',
      '</p>',
      '<p class="text-primary w-100 text-left">',
        '<a href="{{this}}" target="_blank">{{this}}</a>',
      '</p>'
    ].join('')),

    failureTemplate: Handlebars.compile([
      '<p class="text-danger w-100 text-left">',
        '<i class="fa fa-frown-o fa-2x fa-fw"></i> Failed to send research finding to RMap.',
      '</p>',
      '<p class="text-danger w-100 text-left">',
        '{{message}}',
      '</p>'
    ].join('')),

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
              '<p>To access your RMap API key:</p>',
              '<ul class="">',
                '<li class="">',
                  'Login to <a class="text-primary" href="{{rmapUrl}}" target="_blank">RMap</a>. ',
                  'If you do not have an RMap account, you can create one using a Google or Twitter account.',
                '</li>',
                '<li class="">Hover over your user name to bring up a menu and click on "Manage API keys"</li>',
                '<li class="">If you already have an API key, you can copy the key to your clipboard here. ',
                    'Otherwise, you can click "Create new key" to get a key.</li>',
                '<li>You must ensure that you enable the "Synchronize RMap:Agent" in your user settings ',
                    'in order to create a new DiSCO.</li>',
              '</ul>',

              '<div class="form-group row pt-3 border-top">',
                '<label for="input-api-key" class="col-sm-2 col-form-label">RMap API Key</label>',
                '<div class="col">',
                  '<input id="input-api-key" class="form-control is-invalid export-data">',
                '</div>',
              '</div>',
            '</div>',
            '<div class="d-block modal-footer">',
              '<div id="rmap-modal-messages" class="row mx-4">',

              '</div>',
              '<div class="row mx-4 float-right">',
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

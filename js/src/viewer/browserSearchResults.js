(function($) {

  $.BrowserSearchResults = function(options) {
    jQuery.extend(true, this, {
      viewer: null,
      appendTo: null,
      element: null,
      searchResults: null,
    }, options);

    this.init();
  };

  $.BrowserSearchResults.prototype = {
    init: function() {

    },

    template: Handlebars.compile([
      '<p>',
        '{{#if last}}',
        'Showing {{offset}} - {{last}} {{#if total}}out of {{total}}{{/if}}',
        '{{/if}}',
      '</p>',
      '{{#each matches}}',
        '<div class="result-wrapper js-show-canvas{{#if selected}} selected{{/if}}" data-objectid="{{object.id}}" {{#if manifest}}data-manifestid="{{manifest.id}}"{{/if}}>',
          '<a class="search-result search-title">',
            '{{offset}}) ',
            '{{#if manifest}}',
              '{{manifest.label}} : ',
            '{{/if}}',
            '{{object.label}}',
          '</a>',
          '<div class="search-result result-paragraph">',
            '{{{context}}}',
          '</div>',
        '</div>',
      '{{/each}}',
    ].join(''))

  };

}(Mirador));

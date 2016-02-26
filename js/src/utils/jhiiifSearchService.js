(function($) {

$.JhiiifSearchService = function(options) {
  jQuery.extend(this, {
    id: null,
    profile: null,
    context: null,
    manifest: null,
    query: {
      fields: [
        'marginalia', 'underline', 'symbol', 'mark', 'object_id', 'object_type', 'object_label',
        'collection_id', 'manifest_id', 'manifest_label', 'errata', 'numeral', 'drawing', 'image_name'
      ],
      fieldRegex: /[A-Za-z]/,
      operators: {
        'class': 'advanced-search-operators',
        'choices': [
          {value: 'and', label: '&'},
          {value: 'or', label: '|'}
        ]
      },
      delimiters: {
        'and': '&',
        'or': '|',
        'field': ':'
      }
    },
    search : {
      'collection': { // TODO get this information from 'collectionUri' property in initial Mirador config!
        'id': 'http://rosetest.library.jhu.edu/iiif-pres/collection/aorcollection',
        'label': 'Archaeology of Reading collection'
      },
      'categories': {
        'label': 'Categories',
        'class': 'advanced-search-categories',
      },
      'inputs': {
        'symbol': {
          "type": "dropdown",
          "choices": ['Asterisk', 'Bisectedcircle', 'Crown', 'JC', 'HT', 'LL', 'Mars', 'Mercury', 'Moon', 'Opposite_planets', 'Saturn', 'Square', 'SS', 'Sun', 'Venus'],
          'addBlank': true,
          'placeholder': 'Search symboled text'
        },
        'mark': {
          "type": "dropdown",
          "choices": [
            'apostrophe', 'box', 'bracket', 'circumflex', 'colon', 'comma', 'dash', 'diacritic', 'dot', 'double_vertical_bar', 'equal_sign',
            'est_mark', 'hash', 'horizontal_bar', 'page_break', 'pen_trial', 'plus_sign', 'quotation_mark', 'scribble', 'section_sign',
            'semicolon', 'slash', 'straight_quotation_mark', 'tick', 'tilde', 'triple_dash', 'vertical_bar', 'X-sign'
          ],
          'addBlank': true,
          'placeholder': 'Search marked text.'
        },
        'marginalia': {
          'default': true
        },
        'underline': {
          'placeholder': 'Search underlined text',
        }
      }
    }
  }, options);

  this.init();
};

$.JhiiifSearchService.prototype = {
  init: function() {
    // TODO grab info.json from search service
    this.assignDefaults();
  },

  assignDefaults: function() {
    var inputs = {};
    this.query.fields.forEach(function(field) {
      var fieldInfo = {};

      fieldInfo.class = 'advanced-search-' + field;
      fieldInfo.type = 'text';
      fieldInfo.query = field;
      fieldInfo.placeholder = 'Search ' + field;

      inputs[field] = fieldInfo;
    });

    // Override defaults with values already in 'search.inputs'
    jQuery.extend(true, inputs, this.search.inputs);
    this.search.inputs = inputs;
  },

  getServiceUrl: function() {
    return this.manifest.getSearchWithinService();
  },
};

}(Mirador));

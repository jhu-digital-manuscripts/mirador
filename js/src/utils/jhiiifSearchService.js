(function($) {

$.JhiiifSearchService = function(options) {
  jQuery.extend(this, {
    id: null,
    profile: null,
    context: null,
    manifest: null,
    query: {
      operators: {
        'class': 'advanced-search-operators',
        'choices': [
          {value: 'and', label: 'AND'},
          {value: 'or', label: 'OR'}
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
      'settings': {
        'fields': [
          {
            'field': 'marginalia',
            'label': 'Marginalia',
          },
          {
            'field': 'underline',
            'label': 'Underline',
          },
          {
            'field': 'object_type',
            'label': 'Object Type',
          },
          {
            'field': 'object_label',
            'label': 'Object Label',
          },
          {
            'field': 'manifest_label',
            'label': 'Book Title',
          },
          {
            'field': 'errata',
            'label': 'Errata',
          },
          {
            'field': 'numeral',
            'label': 'Numeral',
          },
          {
            'field': 'drawing',
            'label': 'Drawing',
          },
          {
            'field': 'image_name',
            'label': 'Page name',
          },
          {
            'field': 'cross_reference',
            'label': 'Cross Reference',
          },
          {
            'field': 'emphasis',
            'label': 'Emphasis',
          },
          {
            'field': 'symbol',
            'label': 'Symbol',
            'enum': [
              {value: 'Asterisk', label: 'Asterisk'},
              {value: 'Bisectedcircle', label: 'Bisectedcircle'},
              {value: 'Crown', label: 'Crown'},
              {value: 'JC', label: 'JC'},
              {value: 'HT', label: 'HT'},
              {value: 'LL', label: 'LL'},
              {value: 'Mars', label: 'Mars'},
              {value: 'Mercury', label: 'Mercury'},
              {value: 'Moon', label: 'Moon'},
              {value: 'Opposite_planets', label: 'Opposite Planets'},
              {value: 'Saturn', label: 'Saturn'},
              {value: 'Square', label: 'Square'},
              {value: 'SS', label: 'SS'},
              {value: 'Sun', label: 'Sun'},
              {value: 'Venus', label: 'Venus'},
            ],
          },
          {
            'field': 'mark',
            'label': 'Mark',
            'enum': [
              {value: 'apostrophe', label: 'Apostrophe'},
              {value: 'box', label: 'Box'},
              {value: 'bracket', label: 'Bracket'},
              {value: 'circumflex', label: 'Circumflex'},
              {value: 'colon', label: 'Colon'},
              {value: 'comma', label: 'Comma'},
              {value: 'dash', label: 'Dash'},
              {value: 'diacritic', label: 'Diacritic'},
              {value: 'dot', label: 'Dot'},
              {value: 'double_vertical_bar', label: 'Double Vertical Bar'},
              {value: 'equal_sign', label: 'Equal Sign'},
              {value: 'est_mark', label: 'Est Mark'},
              {value: 'hash', label: 'Hash'},
              {value: 'horizontal_bar', label: 'Horizontal Bar'},
              {value: 'page_break', label: 'Page Break'},
              {value: 'pen_trial', label: 'Pen Trial'},
              {value: 'plus_sign', label: 'Plus Sign'},
              {value: 'quotation_mark', label: 'Quotation Mark'},
              {value: 'scribble', label: 'Scribble'},
              {value: 'section_sign', label: 'Section Sign'},
              {value: 'semicolon', label: 'Semicolon'},
              {value: 'slash', label: 'Slash'},
              {value: 'straight_quotation_mark', label: 'Straight Quotation Mark'},
              {value: 'tick', label: 'Tick'},
              {value: 'tilde', label: 'Tilde'},
              {value: 'triple_dash', label: 'Triple Dash'},
              {value: 'vertical_bar', label: 'Vertical Bar'},
              {value: 'sign', label: 'Sign'},
            ],
          },
        ],
        'default-fields': [
          'marginalia', 'underline', 'symbol', 'mark', 'object_type', 'object_label',
          'manifest_label', 'errata', 'numeral', 'drawing', 'image_name',
          'cross_reference', 'emphasis'
        ],
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

  /**
   * Add default settings to any fields that don't have overriding
   * settings.
   *
   * defaults:
   * 'field' : {
   *   'field': '{field}',
   *   'class': 'advanced-search-{field}',
   *   'type': 'text',
   *   'query': '{field}',
   *   'placeholder': '{label}'
   * }
   *
   * @return none
   */
  assignDefaults: function() {
    var fields = [];
    var categories = {
      'class': 'advanced-search-categories',
      'choices': [],
    };

    this.search.settings.fields.forEach(function(field, index) {
      var fieldInfo = {};

      fieldInfo.class = 'advanced-search-' + field.field;
      fieldInfo.type = field.enum ? 'dropdown' : 'text';
      fieldInfo.query = field.field;
      fieldInfo.placeholder = field.label;
      if (field.enum) {
        fieldInfo.choices = field.enum;
      }

      if (index === 0) {
        // Assign first field as 'default'
        fieldInfo.default = true;
      }

      fields.push(fieldInfo);
      categories.choices.push({'value': field.field, 'label': field.label});
    });

    // Override defaults with values already in 'search.inputs'
    jQuery.extend(true, fields, this.search.settings.fields);
    this.search.settings.fields = fields;

    // Create config for advanced search category dropdown
    this.search.categories = categories;
  },

  getField: function(fieldId) {
    var filtered = this.search.settings.fields.filter(function(field) {
      return field.field === fieldId;
    });

    if (filtered && filtered.length === 1) {
      return filtered[0];
    } else {
      return undefined;
    }
  },

  getServiceUrl: function() {
    return this.manifest.getSearchWithinService();
  },
};

}(Mirador));

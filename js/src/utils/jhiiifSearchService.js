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
        "fields": [
          {
            "field": "marginalia",
            "label": "Marginalia",
            "description": "Notes written by a reader"
          },
          {
            "field": "underline",
            "label": "Underline",
            "description": "Words or phrases in the printed text that have been underlined."
          },
          {
            "field": "object_type",
            "label": "Object Type",
            "description": ""
          },
          {
            "field": "object_label",
            "label": "Object label",
            "description": ""
          },
          {
            "field": "manifest_label",
            "label": "Book Title",
            "description": ""
          },
          {
            "field": "errata",
            "label": "Errata",
            "description": "Corrections made by a reader to the printed text."
          },
          {
            "field": "numeral",
            "label": "Numeral",
            "description": "Numbers written in the book."
          },
          {
            "field": "drawing",
            "label": "Drawing",
            "description": "Drawings or diagrams."
          },
          {
            "field": "image_name",
            "label": "Page name",
            "description": ""
          },
          {
            "field": "cross_reference",
            "label": "Cross Reference",
            "description": "A reference to an external book."
          },
          {
            "field": "emphasis",
            "label": "Emphasis",
            "description": "Words or phrases within the readers marginal notes that have been underlined or otherwise emphasized."
          },
          {
            "field": "symbol",
            "label": "Symbol",
            "description": "Simple drawings that carry some abstract and consistent meaning.",
            "enum": [
              {"value": "Asterisk", "label": "Asterisk"},
              {"value": "Bisectedcircle", "label": "Bisectedcircle"},
              {"value": "Crown", "label": "Crown"},
              {"value": "JC", "label": "JC"},
              {"value": "HT", "label": "HT"},
              {"value": "LL", "label": "LL"},
              {"value": "Mars", "label": "Mars"},
              {"value": "Mercury", "label": "Mercury"},
              {"value": "Moon", "label": "Moon"},
              {"value": "Opposite_planets", "label": "Opposite Planets"},
              {"value": "Saturn", "label": "Saturn"},
              {"value": "Square", "label": "Square"},
              {"value": "SS", "label": "SS"},
              {"value": "Sun", "label": "Sun"},
              {"value": "Venus", "label": "Venus"}
            ]
          },
          {
            "field": "mark",
            "label": "Mark",
            "description": "Pen marks made on a page that may not have consistent abstract meaning. Those marks not covered by 'Symbol'",
            "enum": [
              {"value": "apostrophe", "label": "Apostrophe"},
              {"value": "box", "label": "Box"},
              {"value": "bracket", "label": "Bracket"},
              {"value": "circumflex", "label": "Circumflex"},
              {"value": "colon", "label": "Colon"},
              {"value": "comma", "label": "Comma"},
              {"value": "dash", "label": "Dash"},
              {"value": "diacritic", "label": "Diacritic"},
              {"value": "dot", "label": "Dot"},
              {"value": "double_vertical_bar", "label": "Double Vertical Bar"},
              {"value": "equal_sign", "label": "Equal Sign"},
              {"value": "est_mark", "label": "Est Mark"},
              {"value": "hash", "label": "Hash"},
              {"value": "horizontal_bar", "label": "Horizontal Bar"},
              {"value": "page_break", "label": "Page Break"},
              {"value": "pen_trial", "label": "Pen Trial"},
              {"value": "plus_sign", "label": "Plus Sign"},
              {"value": "quotation_mark", "label": "Quotation Mark"},
              {"value": "scribble", "label": "Scribble"},
              {"value": "section_sign", "label": "Section Sign"},
              {"value": "semicolon", "label": "Semicolon"},
              {"value": "slash", "label": "Slash"},
              {"value": "straight_quotation_mark", "label": "Straight Quotation Mark"},
              {"value": "tick", "label": "Tick"},
              {"value": "tilde", "label": "Tilde"},
              {"value": "triple_dash", "label": "Triple Dash"},
              {"value": "vertical_bar", "label": "Vertical Bar"},
              {"value": "sign", "label": "Sign"}
            ]
          }
        ],
        "default-fields": [
          "marginalia", "underline", "symbol", "mark", "object_type", "object_label",
          "manifest_label", "errata", "numeral", "drawing", "image_name",
          "cross_reference", "emphasis"
        ]
      }
    }
  }, options);

  this.init();
};

$.JhiiifSearchService.prototype = {
  init: function() {
    this.makeInfoRequest(this.manifest.getSearchWithinInfoUrl());
    this.assignDefaults();
  },

  makeInfoRequest: function(searchUrl) {
    var _this = this;

    jQuery.ajax({
      url: searchUrl,
      dataType: 'json',
      cache: true,
    })
    .done(function(data) {
      // Overwrite any properties already present
      jQuery.extend(true, _this.search.settings, data);
    })
    .fail(function(jqXHR, textStatus, errorThrown) {
      console.log('[JH-IIIF Search Service] info request failed. (' + _this.manifest.getSearchWithinInfoUrl() + ')\n' + errorThrown);
    });
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

    // Override defaults with values already in 'search.settings.fields'
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

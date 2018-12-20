(function($) {

/**

  {
    id:string,    // URL ID of the search service
    initializer,  // jQuery ajax object, allowing code with an instance of
                  // this to act when the ajax call is complete by chaining a
                  // '.done()' method call. This should be used to know when
                  // the service is initialized after the info.json has been received
    profile,
    context,
    manifest,
    query: {
      operators   // Details about search operators UI
      delimiters  // Details of various query delimiters: AND operator, OR operator, field/value delimiter
    },
    settings: {
      fields      // Array of search fields
      default-fields  // Array of strings representing all fields that should be contained in a simple search
    }
  }

 */
$.JhiiifSearchService = function(options) {

  this.id = options.id;
  this.initializer = null;
  this.profile = options.profile;
  this.context = options.context;
  this.manifest = options.manifest;
  this.query = {
    operators: {
      'class': 'advanced-search-operators col-4',
      'placeholder': 'Select boolean operation',
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
  };
  this.search = {
    'settings': {
      "fields": [],
      "default-fields": []
    }
  };

  this.init();
};

$.JhiiifSearchService.prototype = {
  init: function() {
    this.makeInfoRequest(this.getInfoUrl(this.id));
  },

  makeInfoRequest: function(searchUrl) {
    var _this = this;

    this.initializer = jQuery.ajax({
      url: searchUrl,
      dataType: 'json',
      cache: true,
    })
    .done(function(data) {
      // Overwrite any properties already present
      jQuery.extend(true, _this.search.settings, data);
    })
    .fail(function(jqXHR, textStatus, errorThrown) {
      console.log('[JH-IIIF Search Service] info request failed. (' + _this.id + ')\n' + errorThrown);
    })
    .always(function() {
      _this.assignDefaults();
    });
  },

  /**
   * Add default settings to any fields that don't have overriding
   * settings.
   *
   * defaults:
   * 'field' : {
   *   'name': '{field}',
   *   'class': 'advanced-search-{field}',
   *   'type': 'text',
   *   'query': '{field}',
   *   'placeholder': '{label}'
   * }
   *
   * @return none
   */
  assignDefaults: function() {
    // var _this = this;
    var fields = [];
    var categories = {
      'class': 'advanced-search-categories col',
      'placeholder': 'Choose search field',
      'choices': [],
    };

    this.search.settings.fields.forEach(function(field, index) {
      var fieldInfo = {
        class: 'advanced-search-' + field.name,
        type: field.values ? 'dropdown' : 'text',
        query: field.name,
        placeholder: field.label
      };

      if (field.values) {
        fieldInfo.choices = field.values;
      }

      if (index === 0) {
        // Assign first field as 'default'
        fieldInfo.default = true;
      }

      fields.push(fieldInfo);
      categories.choices.push({'value': field.name, 'label': field.label, 'description': field.description});
    });

    // Override defaults with values already in 'search.settings.fields'
    jQuery.extend(true, fields, this.search.settings.fields);
    this.search.settings.fields = fields;

    // Create config for advanced search category dropdown
    this.search.categories = categories;

    // Massage facets if necessary into a form better suited for jsTree
    // if (Array.isArray(this.search.settings.categories)) {
    //   this.search.settings.categories.forEach(function(cat) {
    //     jQuery.extend(cat, {
    //       "text": cat.label,
    //       "dim": cat.name,
    //       "path": []
    //     });
    //   });
    // }
  },

  getField: function(fieldId) {
    var filtered = this.search.settings.fields.filter(function(field) {
      return field.name === fieldId;
    });

    if (filtered && filtered.length === 1) {
      return filtered[0];
    } else {
      return undefined;
    }
  },

  getDefaultFields: function() {
    return this.search.settings['default-fields'];
  },

  getInfoUrl: function() {
    return this.id + (this.id.charAt(this.id.length - 1) === "/" ? "" : "/") + "info.json";
  }
};

}(Mirador));

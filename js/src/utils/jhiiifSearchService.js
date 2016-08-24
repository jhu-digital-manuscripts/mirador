(function($) {

$.JhiiifSearchService = function(options) {
  jQuery.extend(this, {
    id: null,
    initializer: null,
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
        'id': 'http://jdm.library.jhu.edu/iiif-pres/collection/aorcollection',
        'label': 'Archaeology of Reading collection'
      },
      'settings': {
        "fields": [],
        "default-fields": []
      }
    }
  }, options);

  this.init();
};

$.JhiiifSearchService.prototype = {
  init: function() {
    var data = Mirador.saveController.currentConfig.data;
    data = data.filter(function(datum) { return datum.collectionUri && datum.collectionUri !== ''; });

    if (data && Array.isArray(data) && data.length > 0) {
      this.search.collection.id = data[0].collectionUri;
      if (data[0].label && data[0].label !== '') {
        this.search.collection.label = data[0].label;
      }
    }

    this.makeInfoRequest(this.manifest.getSearchWithinInfoUrl());
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
      console.log('[JH-IIIF Search Service] info request failed. (' + _this.manifest.getSearchWithinInfoUrl() + ')\n' + errorThrown);
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
    var fields = [];
    var categories = {
      'class': 'advanced-search-categories',
      'choices': [],
    };

    this.search.settings.fields.forEach(function(field, index) {
      var fieldInfo = {};

      fieldInfo.class = 'advanced-search-' + field.name;
      fieldInfo.type = field.values ? 'dropdown' : 'text';
      fieldInfo.query = field.name;
      fieldInfo.placeholder = field.label;
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

  getServiceUrl: function() {
    return this.manifest.getSearchWithinService();
  },
};

}(Mirador));

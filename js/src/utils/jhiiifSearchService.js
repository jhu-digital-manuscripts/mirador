(function($) {

$.JhiiifSearchService = function(options) {
  jQuery.extend(this, {
    id: null,
    profile: null,
    context: null,
    manifest: null,
    query: {
      fields: [
        {value: 'marginalia', label: 'Marginalia'},
        {value: 'underline', label: 'Underline'},
        {value: 'symbol', label: 'Symbol'},
        {value: 'mark', label: 'Mark'},
        {value: 'object_type', label: 'Object Type'},
        {value: 'object_label', label: 'Object Label'},
        {value: 'manifest_label', label: 'Book title'},
        {value: 'errata', label: 'Errata'},
        {value: 'numeral', label: 'Numeral'},
        {value: 'drawing', label: 'Drawing'},
        {value: 'image_name', label: 'Page label'},
      ],
      fieldRegex: /[A-Za-z]/,
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
      'categories': {
        'label': 'Categories',
        'class': 'advanced-search-categories',
      },
      'inputs': {
        'symbol': {
          "type": "dropdown",
          "choices": [
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
          'addBlank': true,
          'placeholder': 'Search symboled text'
        },
        'mark': {
          "type": "dropdown",
          "choices": [
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

  /**
   * Add default settings to any fields that don't have overriding
   * settings.
   *
   * defaults:
   * '{field}' : {
   *   'class': 'advanced-search-{field}',
   *   'type': 'text',
   *   'query': '{field}',
   *   'placeholder': 'Search {field}'
   * }
   *
   * @return none
   */
  assignDefaults: function() {
    var inputs = {};
    this.query.fields.forEach(function(field) {
      var fieldInfo = {};

      fieldInfo.class = 'advanced-search-' + field.value;
      fieldInfo.type = 'text';
      fieldInfo.query = field.value;
      fieldInfo.placeholder = 'Search ' + field.label;

      inputs[field.value] = fieldInfo;
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

(function($) {
/**
 * This object will be initialized with a hotspot annotation
 * and its intended parent element. The hotspot will then
 * build an HTML element to be displayed to a user in some way
 * and append it to the parent element.
 */
$.JHHotspotDecorator = function(options) {
  jQuery.extend(true, this, {
    hotspots: null,
    annotationsHtml: null,
  }, options);

  this.init();
};

$.JHHotspotDecorator.prototype = {
  init: function() {
    var _this = this;

    this.register();
    // For each 'hotspot', build an HTML display
    // then append it to the right annotation HTML
    if (!Array.isArray(this.hotspots)) {
      return; // If no hotspots, bail early
    }

    this.hotspots.forEach(function(spot) {
      _this.modifyAnnotations(spot);
    });
  },

  /**
   * @param targetData {object} 'on' property from anntation
   * @returns Array of jQuery objects where the link should be inserted
   */
  modifyAnnotations: function(hotspot) {
    var targetData = hotspot.on;
    var link = this.getLink(hotspot);
    var templateData = {
      refs: this.hotspotToTemplateData(hotspot)
    };

    var match;
    if (typeof targetData === 'string') {
      match = this.getMatchingAnnotation(targetData);
      if (!match) {
        return;
      }
      match.append(jQuery(this.hotspotTabContent(templateData)));
    } else if (typeof targetData === 'object') {
      match = this.getMatchingAnnotation(targetData['@id']);
      if (!match) {
        return;
      }
      // Now that we found the correct annotation, we might have to find
      // a specific piece of text to modify. If we find a 'TextQuoteSelector',
      // The we must find the text specified within the annotation.
      if (targetData.selector && targetData.selector['@type'] === "TextQuoteSelector") {
        var query = (targetData.selector.prefix ? targetData.selector.prefix : "") +
            targetData.selector.exact +
            (targetData.selector.suffix ? targetData.selector.suffix : "");
        var el = jQuery(match).find("div.editable:contains('" + query + "')");

        templateData.label = targetData.selector.exact;

        var newstuff = jQuery(this.hotspotContainer(templateData));
        el.append(jQuery(this.topTemplate()));
        el.find('.references-container').append(newstuff);

        this.bindEvents(newstuff);
      }
    }
  },

  bindEvents: function(el) {
    el.find('a.hotspot-toggle').click(function(event) {
      var clicked = jQuery(this);
      var visible = (clicked.attr('aria-expanded') == 'true');
      clicked.attr('aria-expanded', !visible);

      if (visible) {
        clicked.removeClass('fa-minus-square').addClass('fa-plus-square');
        clicked.next().hide(150);
      } else {
        clicked.removeClass('fa-plus-square').addClass('fa-minus-square');
        clicked.next().show(150);
      }
    });
  },

  /**
   * We want to return data in the form: 
   * {
   *    "label": "string",
   *    "description": "string",
   *    "link": "string(href)"
   * }
   * Possibly in an array.
   */
  hotspotToTemplateData: function(hotspot) {
    var res = [];

    if (hotspot.resource['@type'] === 'oa:Choice') {
      res.push({
        "label": hotspot.resource.default.label,
        "description": hotspot.resource.default.chars,
        "link": hotspot.resource.default['@id']
      });

      if (Array.isArray(hotspot.resource.items)) {
        hotspot.resource.items.forEach(function(item) {
          res.push({
            "label": item.label,
            "description": item.chars,
            "link": item['@id']
          });
        });
      }

      return res;
    } else {
      return [{
        "label": hotspot.label,
        "description": hotspot.resource.chars,
        "link": hotspot.resource['@id']
      }];
    }
  },

  /**
   * Look through a list of annotations and get the first annotation
   * that has a particular ID.
   *
   * @param queriedId {string}
   * @returns jQuery object of the desired annotation in the UI,
   *          FALSE if none exist
   */
  getMatchingAnnotation: function(queriedId) {
    var matches = this.annotationsHtml.find('li.annotationItem').filter(function(index, item) {
      var itemId = jQuery(item).data('id');
      return itemId && itemId.indexOf(queriedId) > -1;
    });

    if (matches.length === 0) {
      return false;
    } else {
      return matches[0];  // Use first, as there should be only 1 anyway :/
    }
  },

  getLink: function(hotspot) {
    if (hotspot.resource['@type'] === "oa:Choice") {
      return hotspot.resource.default['@id'];
    } else {
      return hotspot.resource['@id'];
    }
  },

  register: function() {
    /*
     * Button requires only label
     */
    Handlebars.registerPartial('hotspotTab', [
      '<button type="button" class="" data-toggle="collapse" data-target="{{label}}" aria-expanded="false">',
        '{{label}}',
      '</button>'
    ].join(''));

    Handlebars.registerPartial('hotspotTabContent', [
      '<div data-ref="{{label}}">',
        // '<h2>{{label}}</h2>',
        '{{#if description}}<p>{{description}}</p>{{/if}}',
        '<a href="{{link}}" target="_blank">{{link}}</a>',
      '</div>'
    ].join(''));
  },

  /*
   * Top level for a hotspot annotation. This will be created first. If other hotspots target the same thing,
   * its content will be added to this container
   * Requires template data:
   * {
   *    "label": "string",
   *    "description": "string",
   *    "link": "string:href"
   * }
   * Any additions to this will need to add {{> hotspotTab}} and {{> hotspotTabContent}}
   */
  hotspotContainer: Handlebars.compile([
    '<div class="hotspot-container">',
      '{{label}}',
      '<a href="javascript:;" class="fa fa-lg fa-plus-square hotspot-toggle" data-toggle="collapse" aria-expanded="false">',
      '</a>',
      '<div class="hotspot-collapse-container">',
        '<div class="tab-group">',
          '{{#each refs}}{{> hotspotTab }}{{/each}}',
        '</div>',
        '<div class="tab-content">',
          '{{#each refs}}{{> hotspotTabContent }}{{/each}}',
        '</div>',
      '</div>',
    '</div>'
  ].join('')),

  hotspotTab: Handlebars.compile('{{> hotspotTab }}'),
  hotspotTabContent: Handlebars.compile('{{> hotspotTabContent }}'),

  topTemplate: Handlebars.compile([
    '<div class="references-container">',
      '<span class="emphasize">References: </span>',
    '</div>'
  ].join(''))
};

}(Mirador));

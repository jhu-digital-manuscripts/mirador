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
    annotationsHtml: null
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

    if (typeof targetData === 'string') {
      this.annotationsHtml.find('ul.annotations').append(jQuery("<h2>Moo</h2>"));
    } else if (typeof targetData === 'object') {
      var matches = this.annotationsHtml.find('li.annotationItem').filter(function(index, item) {
        var itemId = jQuery(item).data('id');
        if (!itemId) {
          return false;
        }
        return itemId.indexOf(targetData['@id']) > -1;
      });
      if (matches.length === 0) {
        return [];
      }

      // Use first, as there should be only 1 anyway :/
      var match = matches[0];
      // Now that we found the correct annotation, we might have to find
      // a specific piece of text to modify. If we find a 'TextQuoteSelector',
      // The we must find the text specified within the annotation.
      if (targetData.selector && targetData.selector['@type'] === "TextQuoteSelector") {
        var selector = targetData.selector;
        var query = (selector.prefix ? selector.prefix : "") + selector.exact + (selector.suffix ? selector.suffix : "");
        var el = jQuery(match).find("div.editable:contains('" + query + "')");
        var orig = el.html();

        // Split original html by query, then rejoin all pieces with modified string
        orig = orig.split(query).join('<a href="' + link + '" target="_blank">' + query + '</a>');
        el.html(orig);
      }
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
    Handlebars.registerPartial('hotlink', [
      '<div>',
      '{{#ifCond resource.type "==" "oa:Choice"}}',
        '<ul>',
          '<li><h3>{{resource.default.label}}</h3></li>',
          '<li><p>{{resource.item.chars}}</p><p><a href="{{resource.item.id}}" target="_blank">(link)</a></p></li>',
        '</ul>',
      '{{else}}',
        '<ul><li><h3>{{this.resource.label}}</h3><p><a href="{{this.resource.id}}" target="_blank">(link)</a></p></li></ul>',
      '{{/ifCond}}',
      '</div>'
    ].join(''));

    Handlebars.registerPartial('hotlink-separate', [

    ].join(''));
  }

};

}(Mirador));

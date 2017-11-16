(function($) {

  $.MetadataView = function(options) {

    jQuery.extend(this, {
      manifest:             null,
      element:              null,
      metadataTypes:        null,
      metadataListingCls:   'metadata-listing',
      eventEmitter:         null,
      windowId:             null,
      canvasID:             null,
    }, options);

    this.init();
  };


  $.MetadataView.prototype = {

    init: function() {
      var _this = this,
          tplData = {
            metadataListingCls: this.metadataListingCls
          };
      this.registerPartials();

      _this.manifest = _this.manifest.jsonLd;
      this.metadataTypes = {};

      this.metadataTypes.details = _this.getMetadataDetails(_this.manifest);
      this.metadataTypes.rights = _this.getMetadataRights(_this.manifest);
      this.metadataTypes.links = _this.getMetadataLinks(_this.manifest);

      //vvvvv This is *not* how this should be done.
      jQuery.each(this.metadataTypes, function(metadataKey, metadataValues) {
        tplData[metadataKey] = [];

        jQuery.each(metadataValues, function(idx, itm) {
          if (typeof itm.value === 'object') {
            itm.value = _this.stringifyObject(itm.value);
          }

          if (typeof itm.value === 'string' && itm.value !== '') {
            tplData[metadataKey].push({
              label: _this.extractLabelFromAttribute(itm.label),
              value: (metadataKey === 'links') ? itm.value : _this.addLinksToUris(itm.value)
            });
          }
        });
      });

      if (_this.manifest.logo) {
        var logo = '';
        if (typeof _this.manifest.logo === "string") {
          logo = _this.manifest.logo;
        } else if (typeof _this.manifest.logo['@id'] !== 'undefined') {
          logo = _this.manifest.logo['@id'];
        }
        tplData.logo = logo;
      }

      this.element = jQuery(this.template(tplData)).appendTo(this.appendTo);
      this.handlePageChange(this.canvasID);
      this.bindEvents();
    },

  // Base code from https://github.com/padolsey/prettyprint.js. Modified to fit Mirador needs
  stringifyObject: function(obj, nestingMargin) {
    var type = typeof obj,
        _this = this,
        str,
        first = true,
        increment = 15,
        delimiter = '<br/>';

    if (obj instanceof RegExp) {
      return '/' + obj.source + '/';
    }

    if (typeof nestingMargin === 'undefined') {
      nestingMargin = 0;
    }

    if (obj instanceof Array) {
      str = '[ ';
      jQuery.each(obj, function (i, item) {
        str += (i === 0 ? '' : ', ') + _this.stringifyObject(item, nestingMargin + increment);
      });
      return str + ' ]';
    }

    if (typeof obj === 'object') {
      str = '<div style="margin-left:' +  nestingMargin + 'px">';
      for (var i in obj) {
        if (obj.hasOwnProperty(i)) {
          str += (first ? '' : delimiter) + i + ': ' + _this.stringifyObject(obj[i], nestingMargin + increment);
          first = false;
        }
      }

      return str + '</div>';
    }
    return obj.toString();
  },

  stringifyRelated: function(obj) {
    var _this = this,
        str,
        next,
        label,
        format;
    if (obj instanceof Array) {
      str = '';
      jQuery.each(obj, function (i, item) {
        next = _this.stringifyRelated(item);
        if (next !== '') str += (i === 0 ? '' : '<br/>') + next;
      });
      return str;
    }

    if (typeof obj === 'object' && '@id' in obj) {
      label = ('label' in obj)? obj.label : obj['@id'];
      format = ('format' in obj && obj.format !== 'text/html')? '(' + obj.format + ')' : '';
      return '<a href="' + obj['@id'] + '"  target="_blank">' + label + '</a> ' + format;
    }

    return _this.addLinksToUris(obj.toString());
  },

  getMetadataDetails: function(jsonLd) {
      var mdList = [
        { label: 'label',
          value: '<b>' + ($.JsonLd.getTextValue(jsonLd.label) || '') + '</b>' },
        { label: 'description',
          value: $.JsonLd.getTextValue(jsonLd.description) || '' }
      ];

      if (jsonLd.metadata) {
        value = "";
        label = "";
        jQuery.each(jsonLd.metadata, function(index, item) {
          label = $.JsonLd.getTextValue(item.label);
          value = $.JsonLd.getTextValue(item.value);
          mdList.push({label: label, value: value});
        });
      }

      return mdList;
    },

   getMetadataRights: function(jsonLd) {
       return [
         {label: i18n.t('license'), value: jsonLd.license || ''},
         {label: i18n.t('attribution'), value: $.JsonLd.getTextValue(jsonLd.attribution) || ''}
        ];
   },

   getMetadataLinks: function(jsonLd) {
     // #414
      return [
        {label: i18n.t('related'), value: this.stringifyRelated(jsonLd.related || '')},
        {label: i18n.t('seeAlso'), value: this.stringifyRelated(jsonLd.seeAlso || '')},
        {label: i18n.t('within'),  value: this.stringifyObject(jsonLd.within || '')}
      ];
   },

   extractLabelFromAttribute: function(attr) {
    var label = attr;

    label = label.replace(/^@/, '');
    label = label.replace(/([A-Z])/g, ' $1');
    label = label.replace(/\s{2,}/g, ' ');
    label = label.replace(/\w\S*/g, function(txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });

    return label;
  },

    bindEvents: function() {
      var _this = this;

      this.eventEmitter.subscribe("SET_CURRENT_CANVAS_ID." + this.windowId, function(event, canvasId) {
        _this.handlePageChange(canvasId);
      });
    },

    toggle: function(stateValue) {
        if (stateValue) {
            this.show();
        } else {
            this.hide();
        }
    },

    show: function() {
        var element = jQuery(this.element);
        if (this.panel) {
            element = element.parent();
        }
        element.show({effect: "slide", direction: "right", duration: 300, easing: "swing"});
    },

    hide: function() {
        var element = jQuery(this.element);
        if (this.panel) {
            element = element.parent();
        }
        element.hide({effect: "slide", direction: "right", duration: 300, easing: "swing"});
    },

    addLinksToUris: function(text) {
      // http://stackoverflow.com/questions/8188645/javascript-regex-to-match-a-url-in-a-field-of-text
      var regexUrl = /(http|ftp|https):\/\/[\w\-]+(\.[\w\-]+)+([\w.,@?\^=%&amp;:\/~+#\-]*[\w@?\^=%&amp;\/~+#\-])?/gi,
          textWithLinks = text,
          matches,
          parsedTextWithLinks;

      if (typeof text === 'string') {
        if (textWithLinks.indexOf('<a ') === -1) {
          matches = text.match(regexUrl);

          if (matches) {
            jQuery.each(matches, function(index, match) {
              textWithLinks = textWithLinks.replace(match, '<a href="' + match + '" target="_blank">' + match + '</a>');
            });
          }
        } else {
          parsedTextWithLinks = jQuery('<div />').append(textWithLinks);
          jQuery(parsedTextWithLinks[0]).find('a').attr('target', '_blank');
          textWithLinks = parsedTextWithLinks[0].innerHTML;
        }
      }

      return textWithLinks;
    },

    handlePageChange: function(canvasId) {
      var _this = this;
      this.canvasID = canvasId;

      var canvas = this.manifest.sequences[0].canvases.filter(function(c) {
        return c["@id"] === canvasId;
      });

      if (canvas.length) {
        canvas = canvas[0];

        var prependTo = this.appendTo.find(".canvas-metadata");
        if (prependTo.length) {
          prependTo.remove();
        }
        prependTo = this.appendTo.find(".sub-title").first();

        var tplData = {
          "categoryName": "canvas-metadata",
          "title": canvas.label,
          "metadataListingCls": this.metadataListingCls,
          "details": []
        };

        if (Array.isArray(canvas.metadata)) {
          canvas.metadata.forEach(function(item) {
            tplData.details.push({
              "label": item.label,
              "value": _this.stringifyObject(item.value)
            });
          });
        }

        if (tplData.details.length > 0) {
          // Add this metadata section only if there is metadata to add
          var toAdd = Handlebars.compile("{{> metadataList}}")(tplData);
          jQuery(toAdd).prependTo(prependTo.parent());
        }
      }
    },

    registerPartials: function() {
      Handlebars.registerPartial("metadataList", [
        '<div class="metadata-category {{categoryName}}">',
          '<div class="sub-title">{{title}}:</div>',
          '<div class="{{metadataListingCls}}">',
            '{{#each details}}',
              '<div class="metadata-item">',
                '<div class="metadata-label">{{label}}:</div>',
                '<div class="metadata-value">{{{value}}}</div>',
              '</div>',
            '{{/each}}',
          '</div>',
        '</div>'
      ].join(""));
    },

    template: Handlebars.compile([
    '<div class="sub-title">{{t "details"}}:</div>',
        '<div class="{{metadataListingCls}}">',
          '{{#each details}}',
            '<div class="metadata-item"><div class="metadata-label">{{label}}:</div><div class="metadata-value">{{{value}}}</div></div>',
          '{{/each}}',
        '</div>',
        '<div class="sub-title">{{t "rights"}}:</div>',
        '{{#if rights}}',
        '<div class="{{metadataListingCls}}">',
          '{{#each rights}}',
            '<div class="metadata-item"><div class="metadata-label">{{label}}:</div><div class="metadata-value">{{{value}}}</div></div>',
          '{{/each}}',
          '{{#if logo}}',
            '<div class="metadata-item"><div class="metadata-label">{{t "logo"}}:</div><img class="metadata-logo" src="{{logo}}"/></div>',
          '{{/if}}',
        '</div>',
        '{{else}}',
        '<div class="{{metadataListingCls}}">',
          '<div class="metadata-item"><div class="metadata-label">{{t "rightsStatus"}}:</div><div class="metadata-value">{{t "unspecified"}}</div></div>',
        '</div>',
        '{{/if}}',
        '{{#if links}}',
        '<div class="sub-title">{{t "links"}}:</div>',
        '<div class="{{metadataListingCls}}">',
          '{{#each links}}',
            '<div class="metadata-item"><div class="metadata-label">{{label}}:</div><div class="metadata-value">{{{value}}}</div></div>',
          '{{/each}}',
        // '{{#if relatedLinks}}',
        //   '<dt>{{label}}:</dt><dd>{{{value}}}</dd>',
        // '{{/if}}',
        '</dl>',
        '{{/if}}'

    ].join(''), { noEscape: true })

  };

}(Mirador));

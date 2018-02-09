(function($) {

 $.JhAnnotationTab = function(options) {
    jQuery.extend(true, this, {
      element: null,
      appendTo: null,
      windowId: null,
      tabId: null,
      manifest: null,
      visible: false,
      pendingRequests: {},
      eventEmitter: null,
      message: {
        error: '<h1 class="error">Failed to load annotation list.</h1>',
        empty: '<h1 class="empty">No annotations available.</h1>',
        noLists: '<h1 class="empty">No annotations found.</h1>',
      }
    }, options);

    this.init();
  };

  $.JhAnnotationTab.prototype = {
    init: function() {
      console.assert(this.manifest, '[jhAnnotationTab] Manifest must be provided.');
      this.registerWidget();
      this.element = jQuery(this.template()).appendTo(this.appendTo);
      this.bindEvents();
      this.listenForActions();
    },

    bindEvents: function() {
      var _this = this;

      this.eventEmitter.subscribe("ANNOTATIONS_LIST_UPDATED", function(event, data) {
        if (data.windowId === _this.windowId) {
          _this.processAnnotationList(data.canvasLabel, data.reader, data.annotationsList);
        }
      });

      this.eventEmitter.subscribe('tabStateUpdated.' + this.windowId, function(event, data) {
        if (data.tabs[data.selectedTabIndex].options.id === _this.tabId) {
          _this.element.show();
        } else {
          _this.element.hide();
        }
      });
    },

    listenForActions: function() {
      var _this = this;
      var selector = this.element.find('.annotation-type-selector');

      // Filter annotations by type
      selector.change(function() {
        var type = selector.val();
        if (!type || type === "" || type === "All") {
          _this.element.find('.annotationItem').show();
        } else {
          _this.element.find('.annotationItem').hide();
          _this.element.find('.annotationItem[data-type=' + type + ']').show();
        }
      });
    },

    /**
     * Once an annotation list is received, process and display it.
     *
     * @param  annotationList IIIF Presentation annotation list
     * @return (none)
     */
    processAnnotationList: function(canvasLabel, reader, annotationList) {
      var _this = this;
      var annotations = [];
      var appendTo = this.appendTo.find('ul.annotations');

      this.appendTo.find(".messages").empty();
      appendTo.empty();
      appendTo.scrollTop(0);

      this.clearTypesSelector();

      if (!annotationList || annotationList.length === 0) {
        jQuery(this.message.empty).appendTo(this.appendTo.find('.messages'));
      }

      // Massage data slightly, Handlebars cannot deal with weird JSON-LD
      // properties such as '@id', just change these to 'id'
      annotationList.forEach(function(annotation) {
        if (annotation['@type'] !== 'oa:Annotation') {
          return;
        }

        if (!annotation.id) {
          annotation.id = annotation['@id'];
        }
        if (!annotation.resource.id) {
          annotation.resource.id = annotation.resource['@id'];
        }
        if (!annotation.resource.type) {
          annotation.resource.type = annotation.resource['@type'];
        }
        annotation.aortype = _this.getMetadata(annotation, 'type');
        _this.addTypesToSelector(annotation.aortype);

        annotations.push(annotation);
      });

      // Compile HTML and add it to page
      var tmpTemplate = Handlebars.compile('{{> annotationList}}');

      var templateData = this.templateData(annotations);
      jQuery(tmpTemplate(templateData)).appendTo(appendTo);

      if (reader) {
        this.element.find("h2").append(" (" + reader + ")");
      }
    },

    /**
     * Get the value of metadata key from an annotation.
     */
    getMetadata: function(annotation, key) {
      if (!annotation || !annotation.metadata) {
        return false;
      }

      var matches = annotation.metadata.filter(function(d) {
        return d.label === key;
      }).map(function(d) {
        return d.value;
      });

      return matches.length > 0 ? matches[0] : false;
    },

    addTypesToSelector: function(type) {
      var selector = this.element.find('.annotation-type-selector');
      if (type) {
        // Only add type if it is not already present
        if (selector.find('option[value=' + type + ']').length === 0) {
          selector.append(jQuery(this.typeOption(type)));
        }
        if (selector.find('option').length > 2) {
          selector.show();
          selector.parent().show();
        }
      }
    },

    // Cleary annotation type selector and hide
    clearTypesSelector: function() {
      var selector = this.element.find('.annotation-type-selector');
      selector.hide();
      selector.parent().hide();
      this.element.find('.annotation-type-selector option').remove();
      selector.append(jQuery("<option value=\"\">All</option>"));
    },

    /**
     * @return array:
          [
            {
              "canvasLabel": "some label",
              "annotations": [ ... ]
            },
            { ... }
          ]
     */
    templateData: function(annotations) {
      // From list of all annotations, create a map of canvas IDs -> annotations
      var _this = this;
      var data = {};
      var result = [];

      annotations.forEach(function(anno) {
        var canvas;
        if (!anno.on) {
          canvas = "unknown";
        } else if (typeof anno.on === "string") {
          canvas = anno.on.split("#")[0];
        } else {
          // data.on exists and is an object
          canvas = anno.on["@id"] || anno.on.id;
          canvas = canvas.split("#")[0];
        }

        if (!data.hasOwnProperty(canvas)) {
          data[canvas] = [];
        }

        data[canvas].push(anno);
      });

      Object.keys(data).forEach(function(key) {
        var entry = {
          "canvasLabel": _this.manifest.getCanvasLabel(key),
          "annotations": data[key]
        };
        if (!Array.isArray(entry.annotations)) {
          entry.annotations = [entry.annotations];
        }
        result.push(entry);
      });

      result.sort(function(o1, o2) {
        return o1.canvasLabel > o2.canvasLabel;
      });

      return {template: result};
    },

    registerWidget: function() {
      Handlebars.registerPartial('annotationList', [
        '{{#each template}}',
          '<h2>{{canvasLabel}}</h2>',
          '{{#each annotations}}',
            '<li class="annotationItem {{#if this.selected}}selected{{/if}}" data-id="{{this.id}}" {{#if aortype}}data-type="{{aortype}}"{{/if}}>',
              '{{#ifCond this.resource.type "==" "cnt:ContentAsText"}}',
                '<div class="editable">{{{this.resource.chars}}}</div>',
              '{{/ifCond}}',
              // Could add other conditions here to match other annotation types
            '</li>',
          '{{/each}}',
        '{{/each}}'
      ].join(''));

      Handlebars.registerPartial('pageLeft', '<span class="aor-icon side-left"></span>');
      Handlebars.registerPartial('pageRight','<span class="aor-icon side-right"></span>');
      Handlebars.registerPartial('pageTop', '<span class="aor-icon side-top"></span>');
      Handlebars.registerPartial('pageBottom', '<span class="aor-icon side-bottom"></span>');

      $.registerHandlebarsHelpers();
    },

    typeOption: Handlebars.compile('<option value="{{this}}">{{this}}</option>'),

    template: Handlebars.compile([
      '<div class="jhAnnotationTab {{position}}">',
        '<div class="messages"></div>',
        '<label>Filter by type: ',
          '<select class="annotation-type-selector">',
          '</select>',
        '</label>',
        '<ul class="annotations">',
        '</ul>',
      '</div>'
    ].join('')),

  };

}(Mirador));

(function($) {

 $.JhAnnotationTab = function(options) {
    this.element = options.element;
    this.appendTo = jQuery(options.appendTo);
    this.windowId = options.windowId;
    this.tabId = options.tabId;
    this.manifest = options.manifest;
    this.visible = options.visible;
    this.pendingRequests = {};
    this.message = {
      error: '<h1 class="error">Failed to load annotation list.</h1>',
      empty: '<h1 class="empty">No annotations available.</h1>',
      noLists: '<h1 class="empty">No annotations found.</h1>',
    };

    this.init();
  };

  $.JhAnnotationTab.prototype = {
    init: function() {
      console.assert(this.manifest, '[jhAnnotationTab] Manifest must be provided.');
      this.registerWidget();
      this.element = jQuery(this.template()).appendTo(this.appendTo);
      this.bindEvents();
    },

    bindEvents: function() {
      var _this = this;

      jQuery.subscribe("annotationListLoaded." + this.windowId, function(event, data) {
        _this.processAnnotationList(data.canvas, data.annotations);
      });

      jQuery.subscribe('tabSelected.' + this.windowId, function(event, data) {
        if (data.id === _this.tabId) {
          _this.element.show();
        } else {
          _this.element.hide();
        }
      });
    },

    /**
     * Once an annotation list is received, process and display it.
     *
     * @param  annotationList IIIF Presentation annotation list
     * @return (none)
     */
    processAnnotationList: function(canvasLabel, annotationList) {
      var annotations = [];
      var appendTo = this.appendTo.find('ul.annotations');

      appendTo.empty();
      appendTo.scrollTop(0);

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

        annotations.push(annotation);
      });

      // Compile HTML and add it to page
      var tmpTemplate = Handlebars.compile('{{> annotationList}}');

      var templateData = this.templateData(annotations);
      jQuery(tmpTemplate(templateData)).appendTo(appendTo);
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
            '<li class="annotationItem {{#if this.selected}}selected{{/if}}" data-id="{{this.id}}">',
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

    template: Handlebars.compile([
      '<div class="jhAnnotationTab {{position}}">',
        '<div class="messages"></div>',
        '<ul class="annotations">',
          // '{{> annotationList}}',
        '</ul>',
      '</div>'
    ].join('')),

  };

}(Mirador));

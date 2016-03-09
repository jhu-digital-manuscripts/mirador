(function($) {

 $.JhAnnotationTab = function(options) {
    jQuery.extend(true, this, {
      element: null,
      appendTo: null,
      parent: null,
      windowId: null,
      tabId: null,
      manifest: null,           // Manfist object
      currentCanvasID: null,    // ID of canvas currently being displayed
      visible: null,
      message: {
        error: '<h1 class="error">Failed to load annotation list.</h1>',
        empty: '<h1 class="empty">No annotations available.</h1>',
        noLists: '<h1 class="empty">No annotations found.</h1>',
      },
    }, options);

    this.init();
  };

  $.JhAnnotationTab.prototype = {
    init: function() {
      console.assert(this.manifest, '[jhAnnotationTab] Manifest must be provided.');
      console.assert(this.currentCanvasID, '[jhAnnotationTab] Current canvas ID must be defined.');
      this.registerWidget();
      this.element = jQuery(this.template()).appendTo(this.appendTo);
      this.bindEvents();
      // this.processCurrentManifest();
    },

    bindEvents: function() {
      var _this = this;

      jQuery.subscribe('tabSelected.' + this.windowId, function(event, data) {
        if (data.id === _this.tabId) {
          _this.element.show();
        } else {
          _this.element.hide();
        }
      });

      jQuery.subscribe('currentCanvasIDUpdated.' + _this.windowId, function(event, canvasId) {
        _this.currentCanvasID = canvasId;
        _this.processCurrentManifest();
      });
    },

    processCurrentManifest: function() {
      this.loadAnnotationLists(
        this.manifest.getAnnotationLists(this.currentCanvasID),
        true
      );
    },

    loadAnnotationLists: function(lists, clearAnnotations) {
      var _this = this;

      if (clearAnnotations) {
        this.appendTo.find('.annotations').empty();
      }
      // Remove any error messages, if necessary
      this.appendTo.find('.messages').empty();

      if (!lists) {
        jQuery(this.message.noLists).appendTo(this.element.find('.messages'));
        return;
      }
      console.assert(typeof lists === 'string' || Array.isArray(lists),
        "[jhAnnotationTab#loadAnnotationLists] provided 'lists' must be a single string, or array of strings.");

      if (typeof lists === 'string') {
        this.requestList(lists);
      } else {
        lists.forEach(function(list) {
          _this.requestList(list);
        });
      }
    },

    requestList: function(listId) {
      var _this = this;
      jQuery.ajax({
        url:   listId,
        dataType: 'json'
      })
      .done(function(data) {
        _this.processAnnotationList(data);
      })
      .fail(function() {
        console.log('[jhAnnotationTab#requestList] Failed to load annotation list. ' + listId);
        jQuery(_this.message.error).appendTo(this.appendTo.find('.messages'));
      })
      .always(function() {

      });
    },

    /**
     * Once an annotation list is received, process and display it.
     *
     * @param  annotationList IIIF Presentation annotation list
     * @return (none)
     */
    processAnnotationList: function(annotationList) {
      var annotations = [];
      var appendTo = this.appendTo.find('ul.annotations');

      if (!annotationList.resources || annotationList.resources.length === 0) {
        jQuery(this.message.empty).appendTo(this.appendTo.find('.messages'));
      }

      // Massage data slightly, Handlebars cannot deal with weird JSON-LD
      // properties such as '@id', just change these to 'id'
      annotationList.resources.forEach(function(annotation) {
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

      var templateData = {};
      templateData.annotations = annotations;

      jQuery(tmpTemplate(templateData)).appendTo(appendTo);
    },

    registerWidget: function() {
      Handlebars.registerPartial('annotationList', [
        '{{#each annotations}}',
          '<li class="annotationItem {{#if this.selected}}selected{{/if}}" data-id="{{this.id}}">',
            '{{#ifCond this.resource.type "==" "cnt:ContentAsText"}}',
              '<div class="editable {{this.id}}">{{{this.resource.chars}}}</div>',
            '{{/ifCond}}',
            // Could add other conditions here to match other annotation types
          '</li>',
        '{{/each}}',
      ].join(''));

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

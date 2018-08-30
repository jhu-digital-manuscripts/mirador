(function($) {

 $.JhAnnotationTab = function(options) {
    jQuery.extend(true, this, {
      element: null,
      appendTo: null,
      windowId: null,
      state: null,
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
     * Add UI events that you want annotations to listen for here
     */
    listenForThings: function() {
      this.listenForInternalRefs();
      this.listenForPeopleClicks();
      // this.listenForSearchClicks();
    },

    listenForPeopleClicks: function() {
      var _this = this;

      var options = {
        'search': { name: 'Search', icon: 'fa-search' },
        'isni': { name: 'ISNI', icon: 'fa-external-link' },
        'external': { name: 'External link', icon: 'fa-external-link'}
      };

      this.element.contextMenu({
        selector: 'a.searchable',
        trigger: 'left',
        build: function($trigger, e) {
          var items = {};
          if ($trigger.hasClass('searchable')) {
            items.search = options.search;
            items.search.callback = function() {
              var within = $trigger.data('searchwithin');
              var field = $trigger.data('searchfield');
              var term = $trigger.text();
              _this.doSearch(within, term, field);
            };
          }
          if ($trigger.data('isni')) {
            items.isni = options.isni;
            items.isni.callback = function() {
              window.open($trigger.data('isni'), '_blank');
            };
          }
          return {
            items: items
          };
        }
      });
    },

    /**
     * @param {string} searchWithin : search will be done within this URI
     * @param {string} term : search term
     * @param {string} field : specific search field, if applicable
     */
    doSearch: function(searchWithin, term, field) {
      if (searchWithin.indexOf('jhsearch') < 0) {
        // Append 'jhsearch' if necessary
        searchWithin += (searchWithin.charAt(searchWithin.length - 1) === '/' ? '' : '/') + 'jhsearch';
      }

      var request = {
        service: searchWithin,
        query: $.generateBasicQuery('"' + term + '"', Array.of(field), '&')
      };
      this.eventEmitter.publish('REQUEST_SEARCH.' + this.windowId, request);
    },

    listenForInternalRefs: function() {
      var _this = this;

      this.element.find('a.internal-ref').click(function() {
        var el = jQuery(this);
        /*
         * At this point, we have the target ID in the element data-targetid as a IIIF URI
         * There are several possibilities at this point:
         *    - targetid is a page URI > navigate to image view (or book view?) for the page
         *    - targetid is a manifest URI > navigate to thumbnail view for the book
         *    - targetid is a collection URI (will likely not happen)
         */
        var targetManifest = el.data('manifestid');
        var targetObject = el.data('targetid');
        var needNewManifest = targetManifest === _this.manifest.getId();

        if (targetManifest === targetObject) {
          // Target object is a manifest, open thumbnail view
          if (needNewManifest) {
            _this.getManfiest(targetManifest).done(function(manifest) {
              _this.goToManifest(manifest);
            });
          }
        } else if (targetObject.indexOf('/canvas') > 0) {   // Make sure target is a canvas...
          _this.getManifest(targetManifest).done(function(manifest) {
            _this.goToPage(manifest, targetObject);
          });
        }
      });
    },

    /**
     * @param manifest {object} manifest object
     * @param page {string} page/canvas ID
     */
    goToPage: function(manifest, page) {
      var windowConfig = {
        'manifest': manifest,
        'canvasID': page,
        'viewType': this.state.getStateProperty('windowSettings').viewType
      };
      this.eventEmitter.publish('ADD_WINDOW', windowConfig);
    },

    /**
     * @param manifest {object} manifest object
     */
    goToManifest: function(manifest) {
      var windowConfig = {
        'manifest': manifest,
        'viewType': 'ThumbnailsView'
      };
      this.eventEmitter.publish('ADD_WINDOW', windowConfig);
    },

    /**
     * First check to see if manifest has already been loaded in the `saveController`. If so,
     * return that object immediately. Otherwise, load the manifest from the ID, save it in
     * the `saveController` and return the new manifest object.
     * 
     * @param manfiestUri {string} manifest ID
     * @returns jQuery Deferred of a manifest object
     */
    getManifest: function(manifestUri) {
      var promise = jQuery.Deferred();

      if (this.manifest.getId() === manifestUri) {
        promise.resolve(this.manifest);
      } else {
        var manifest = this.state.get('manifests', 'currentConfig').find(function(man) {
          return man.jsonLd ? man.getId() === manifestUri : false;
        });
        if (manifest && manifest.jsonLd) {  // Manifest already loaded. Is there a better way to determine this?
          promise.resolve(manifest);
        } else {
          // Manifest may have been referenced, but not loaded
          manifest = new $.Manifest(manifestUri);
          this.eventEmitter.publish('manifestQueued', manifest);
          manifest.request.done(function() {
            promise.resolve(manifest);
          });
        }
      }

      return promise;
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
        var header = this.element.find('h2');
        header.append(" (" + reader + ")");
        header.addClass(reader);
      }

      this.listenForThings();
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

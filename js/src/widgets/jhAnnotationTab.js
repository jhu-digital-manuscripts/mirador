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
      state: null,
      message: {
        error: '<h1 class="error">Failed to load annotation list.</h1>',
        empty: '<h1 class="empty">No annotations available.</h1>',
        noLists: '<h1 class="empty">No annotations found.</h1>',
      },
      map: null,
      initialZoom: 8,               // Default zoom level for the map pop-ups
      CETEI: null
    }, options);

    this.init();
  };

  $.JhAnnotationTab.prototype = {
    init: function() {
      console.assert(this.manifest, '[jhAnnotationTab] Manifest must be provided.');
      this.CETEI = new CETEI();
      this.registerWidget();
      this.element = jQuery(this.template()).appendTo(this.appendTo);
      this.bindEvents();
    },

    bindEvents: function() {
      var _this = this;

      this.eventEmitter.subscribe("RESET_WORKSPACE_LAYOUT", function() {
        _this.destroyMap();
      });

      this.eventEmitter.subscribe("windowRemoved", function(event, id) {
        if (id === _this.windowId) {
          _this.destroyMap();
        }
      });

      this.eventEmitter.subscribe("ANNOTATIONS_LIST_UPDATED", function(event, data) {
        if (data.windowId === _this.windowId) {
          _this.processAnnotationList(data.canvasLabel, data.annotationsList);
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

    /**
     * Once an annotation list is received, process and display it.
     *
     * @param  annotationList IIIF Presentation annotation list
     * @return (none)
     */
    processAnnotationList: function(canvasLabel, annotationList) {
      var _this = this;
      var annotations = [];
      var appendTo = this.appendTo.find('ul.annotations');

      this.appendTo.find(".messages").empty();
      appendTo.empty();
      appendTo.scrollTop(0);

      if (!annotationList || annotationList.length === 0) {
        jQuery(this.message.empty).appendTo(this.appendTo.find('.messages'));
      }

      // Massage data slightly, Handlebars cannot deal with weird JSON-LD
      // properties such as '@id', just change these to 'id'
      annotationList.forEach(function(annotation) {
        if (annotation['@type'] !== 'oa:Annotation' || annotation.motivation === 'oa:linking') {
          return;
        }
        _this.massageForHandlebars(annotation);
        annotations.push(annotation);
      });

      // Compile HTML and add it to page
      var tmpTemplate = Handlebars.compile('{{> annotationList}}');

      var templateData = this.templateData(annotations);
      jQuery(tmpTemplate(templateData)).appendTo(appendTo);

      new $.JHHotspotDecorator({
        hotspots: annotationList.filter(function(a) { return a.motivation === 'oa:linking'; }),
        annotationsHtml: this.element
      });

      this.doStuff();
    },

    /**
     * Modify objects so that Handlebars can deal with them.
     * IIIF has various properties with special characters in them,
     * such as '@id' and '@type'. Handlebars currently cannot handle
     * the '@' character in property names, so change these to
     * 'id', 'type', etc
     */
    massageForHandlebars: function(obj) {
      var _this = this;
      Object.keys(obj).forEach(function(key) {
        var val = obj[key];
        if (typeof val === 'object') {
          _this.massageForHandlebars(obj[key]);
        }

        if (key.indexOf('@') > -1) {
          var newKey = key.substring(1, key.length);
          obj[newKey] = obj[key];
        }
      });
      return obj;
    },

    initMap: function(key) {
      var _this = this;
      this.mapId = "annotation-map-container-" + this.windowId;
      var theMap = jQuery("#" + this.mapId);

      if (theMap.length > 0) {
        this.destroyMap();
      }

      theMap = jQuery("<div id='" + this.mapId + "' class=\"annotation-map-container\"></div>").appendTo("body");

      theMap.show();
      theMap.css("z-index", -1);
      L.mapbox.accessToken = key;
      this.map = L.mapbox.map(this.mapId, 'mapbox.streets');

      /**
       * When the mouse leaves the map area, close the map UNLESS the mouse
       * butten is being held down. If this is the case, the user is most likely
       * panning the map to reposition it.
       */
      var mouseDown = function() { _this.mouseHeld = true; };
      var mouseLeave = function() { if (!_this.mouseHeld) theMap.hide(); };
      var mouseUp = function() { if (_this.mouseHeld) _this.mouseHeld = false; };

      theMap.mousedown(mouseDown);
      jQuery(document).mouseup(mouseUp);
      theMap.mouseleave(mouseLeave);
    },

    destroyMap: function() {
      jQuery("#annotation-map-container-" + this.windowId).remove();
    },

    initPerseids: function() {
      var _this = this;
      var thePeople = jQuery(".perseids-container");

      var mouseDown = function() { _this.mouseHeld = true; };
      var mouseLeave = function() { if (!_this.mouseHeld) jQuery(this).hide(); };

      thePeople.mousedown(mouseDown);
      thePeople.mouseleave(mouseLeave);
    },

    doStuff: function(annotationList) {
      var _this = this;

      this.initPerseids();

      var url = window.location.href + "mapbox";
      jQuery.get(url).done(function(data) {
        _this.initMap(data);

        /*
         * Each a.external-link will have an href pointing to the Pleiades website.
         * This ref can be modified to point to the Pleiades Places API by simply
         * adding '/json' to the end.
         *
         * On first call:
         * 1) Add "pop-up" element, div that will sit on top of everything, that
         *    will hold the map element. Hide this element initially.
         * 2) Initialize the map, so it does not have to be re-rendered each call
         *
         * On mouseover of these links:
         * 1) Make a request to the Pleiades JSON API to retrieve the Place data.
         * 2) Set position of a map to the lat/long of the place, found in the data
         * 3) Set position of popup element, if necessary
         * 4) Show map
         *
         * On mouseout? some other event?:
         * 1) hide the map and prevent further user interaction.
         */
        var theMap = jQuery("#" + _this.mapId);
        var thePeople = jQuery(".perseids-container");
        _this.element.find("a.external-link").hover(
          function(event) { _this.showPopup(jQuery(this)); },
          function(event) {
            _this.popupTimer = window.setTimeout(function() {
              theMap.hide();
              thePeople.hide();
              _this.popupTimer = undefined;
            }, 1000);
          }
        );

        function clearTimer() {
          if (_this.popupTimer) window.clearTimeout(_this.popupTimer);
        }

        thePeople.mouseenter(clearTimer);
        theMap.mouseenter(clearTimer);
      })
      .fail(function() {
        console.log("[AnnoTab] Failed to retrieve mapbox info.");
      });
    },

    showPopup: function(element) {
      var _this = this;
      var theMap = jQuery("#" + this.mapId);
      var thePeople = jQuery(".perseids-container");
      theMap.css("z-index", 1);

      var href = element.attr("href");

      if (_this.popupTimer) { window.clearTimeout(_this.popupTimer); }
      if (href.indexOf("pleiades.stoa.org") >= 0) {
        thePeople.hide();
        // If this link is a pleiades Places link, do the map thing
        if (href.charAt(href.length - 1) !== "/") {
          href += "/";
        }
        href += "json";

        _this.setPosition(element, theMap);
        jQuery.getJSON(href).done(function(data) {
          if (data.reprPoint) {
            theMap.show();
            _this.map.setView([data.reprPoint[1], data.reprPoint[0]], _this.initialZoom);
          }
        }).fail(function() {
          console.log("[AnnoTab] Failed to retrieve Pleiades data. " + href);
          theMap.hide();
        });
      } else if (href.indexOf("perseids.org") >= 0) {
        thePeople.empty();
        theMap.hide();
        // If this link goes to the Perseids biography thing, do that

        // Rip apart the href to hack together the CTS URN
        // TODO REMOVE THIS! This ugly hack should be replaced with a different
        // mechanism. Ex: add a data-api="..." attribute or something to the anchor
        var hrefprefix = "https://cts.perseids.org/read/";
        var parts = href.substring(hrefprefix.length).split("/");
        href = "https://cts.perseids.org/api/cts/?request=GetPassage&urn=urn:cts";
        parts.forEach(function(value, index, array) {
          if (index === 2 || index === 3) {
            href += ".";
          } else {
            href += ":";
          }
          href += value;
        });

        // Get request will return XML
        _this.setPosition(element, thePeople);
        thePeople.show();
        thePeople.append('<i class="loading fa fa-spinner fa-spin fa-2x fa-fw"></i>');
        jQuery.get({
          url: href,
          dataType: "xml"
        }).done(function(data) {
          _ = thePeople;
          var datastr = new XMLSerializer().serializeToString(jQuery(data).find("TEI").get(0));
          _this.CETEI.makeHTML5(datastr, function(html) {
            thePeople.empty();
            thePeople.html(jQuery(html));
          });
        }).fail(function(jqXHR, textStatus, errorThrown) {
          console.log("[AnnoTab] Failed to get Perseids data. " + href + "\n" + textStatus);
          thePeople.empty();
          thePeople.html('<h2 style="color: darkred">Failed to get Perseids data.</h2>');
        });
      }
    },

    setPosition: function(linkEl, element) {
      var height = linkEl.outerHeight();
      var width = linkEl.outerWidth();

      var clickX = linkEl.offset().left + width;
      var clickY = linkEl.offset().top + height;

      var maxWidth = document.body.clientWidth;
      // var maxHeight = jQuery("#" + this.state.currentConfig.id).outerHeight();
      var maxHeight = jQuery("#" + this.state.getStateProperty("id")).outerHeight();

      var result = {
        top: clickY + 5,
        bottom: clickY + element.outerHeight(),
        left: clickX - element.outerWidth()/2,
        right: clickX - element.outerWidth()/2 + element.outerWidth()
      };

      if (result.bottom > maxHeight) {
        // Move widget above mouse
        result.bottom = clickY - 10;
        result.top = result.bottom - element.outerHeight();
      }
      if (result.right > maxWidth) {
        result.right = maxWidth;
        result.left = result.right - element.outerWidth();
      }

      element.css("top", result.top + "px");
      element.css("left", result.left + "px");
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
              '{{#ifCond this.motivation "==" "oa:linking"}}',
                '{{> hotlink this}}',
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
        '</ul>',
      '</div>'
    ].join('')),

  };

}(Mirador));

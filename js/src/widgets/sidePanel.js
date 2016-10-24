(function($) {

  $.SidePanel= function(options) {
    // jQuery.extend(true, this, {
    //   element:           null,
    //   appendTo:          null,
    //   parent:            null,
    //   manifest:          null,
    //   panelState:        {},
    //   tocTabAvailable:   false,
    //   annotationsTabAvailable: true,
    //   searchTabAvailable: true,
    //   layersTabAvailable: false,
    //   toolsTabAvailable: false,
    //   hasStructures:     false,
    //   visible:           false,
    //   queryUrl:          null,
    // }, options);

    this.canvasID = options.canvasID;
    this.element = options.element;
    this.appendTo = jQuery(options.appendTo);
    this.parent = options.parent;
    this.manifest = options.manifest;
    this.panelState = options.panelState ? options.panelState : {};
    this.tocTabAvailable = options.tocTabAvailable;
    this.annotationsTabAvailable = true;
    this.searchTabAvailable = true;
    this.layersTabAvailable = false;
    this.toolsTabAvailable = false;
    this.hasStructures = options.hasStructures;
    this.visible = options.visible;
    this.queryUrl = options.queryUrl;

    this.init();
  };

  $.SidePanel.prototype = {
    init: function() {
      var _this = this;
      this.windowId = this.parent.id;

      this.state({
        tabs : [
          {
            name : 'toc',
            options : {
              available: _this.tocTabAvailable,
              id:'tocTab',
              label:'Index'
            }
          },
          {
            name : 'annotations',
            options : {
              available: _this.annotationsTabAvailable,
              id:'annotationsTab',
              label:'Annotations'
            }
          },
          {
            name: 'search',
            options: {
              available: _this.searchTabAvailable,
              id: 'searchTab',
              label: 'Search'
            }
          },
        ],
        width: 330,
        open: _this.visible
      }, true);

      this.listenForActions();
      this.render(this.state());

      this.loadSidePanelComponents();
    },

    /**
     * Return all tabs with the requested ID.
     *
     * @param  string id
     * @return array containing all tabs (0 or more)
     */
    getTabObject: function(id) {
      console.assert(id && typeof id === 'string', 'The requested ID cannot be blank and must be a string.');
      return this.panelState.tabs.filter(function(tab) {
        return tab.options.id === id;
      });
    },

    loadSidePanelComponents: function() {
      var _this = this;

      new $.Tabs({
        windowId: this.parent.id,
        appendTo: this.appendTo,
        tabs : this.panelState.tabs,
        // parent : this
      });

      if (this.tocTabAvailable) {
        new $.TableOfContents({
          manifest: this.manifest,
          appendTo: this.element.find('.tabContentArea'),
          parent: this.parent,
          panel: true,
          canvasID: this.parent.currentCanvasID
        });
      }

      if (_this.annotationsTabAvailable) {
        new $.JhAnnotationTab({
          manifest: _this.manifest,
          // parent: _this.parent,
          appendTo: _this.element.find('.tabContentArea'),
          tabId: 'annotationsTab',
          windowId: _this.parent.id,
          currentCanvasID: this.parent.currentCanvasID,
        });
      }

      if (_this.searchTabAvailable) {
        var manifestSearch = this.manifest.getSearchWithinService();
        if (!manifestSearch.label) {
          manifestSearch.label = this.manifest.label;
        }

        var services = [manifestSearch];

        // If the manifest has a 'within' property, fetch that [parent collection]
        // and add its search service if it exists
        // Else, just add the search service from the manifest
        if (this.manifest.within()) {
          jQuery.getJSON(this.manifest.within())
            .done(function(collection) {
              if (!collection) {
                return;
              }
              if (Array.isArray(collection.service)) {
                collection.service.
                filter(function(service) {
                  return service["@context"] === "http://manuscriptlib.org/jhiff/search/context.json";
                })
                .forEach(function(service) {
                  service.label = collection.label;
                  services.push(service);
                });
              } else if (collection.service && collection.service["@context"] === "http://manuscriptlib.org/jhiff/search/context.json") {
                collection.service.label = collection.label;
                services.push(collection.service);
              } else {
                console.log("[SidePanel] parent collection has no search service.");
              }
            })
            .always(function() {
              _this.createSearchWidget(services);
            });
        } else {
          _this.createSearchWidget(services);
        }
      }
    },

    /**
     * Replace property "@id" with "id"
     */
    massageServiceBlock: function(service) {
      if (service["@id"]) {
        service.id = service["@id"];
      }
      return service;
    },

    createSearchWidget: function(services) {
      var _this = this;

      services.forEach(function(service) {
        service = _this.massageServiceBlock(service);
      });
console.log();
      new $.SearchWidget({
        manifest: _this.manifest,
        parent: _this.parent,
        windowId: _this.parent.id,
        widgetId: 'searchTab',
        appendTo: _this.element.find('.tabContentArea'),
        width: 0,
        searchContext: _this.searchContext ? _this.searchContext : {},
        pinned: _this.pinned,
        searchServices: services
      });
    },

    update: function(name, availability) {
      var state = this.panelState;
      jQuery.each(state.tabs, function(index, value) {
        if (value.name === name) {
          value.options.available = availability;
        }
      });
      this.state(state);
    },

    state: function(state, initial) {
      if (!arguments.length) return this.panelState;
      jQuery.extend(true, this.panelState, state);

      if (!initial) {
        jQuery.publish('sidePanelStateUpdated.' + this.windowId, this.panelState);
      }

      return this.panelState;
    },

    panelToggled: function() {
      var state = this.state(),
          open = !state.open;
      this.panelState.open = open;
    },

    listenForActions: function() {
      var _this = this;
      jQuery.subscribe('sidePanelStateUpdated.' + this.windowId, function(_, data) {
        _this.render(data);
      });

      jQuery.subscribe('sidePanelResized', function() {
      });

      jQuery.subscribe('sidePanelToggled.' + this.windowId, function() {
        _this.panelToggled();
      });

      jQuery.subscribe('annotationListLoaded.' + _this.windowId, function(event) {
        if (_this.parent.annotationsAvailable[_this.parent.currentFocus]) {
          if (_this.parent.annotationsList.length > 0) {
            _this.update('annotations', true);
          }
        }
      });

    },

    render: function(renderingData) {
      var _this = this;

      if (!this.element) {
        this.element = this.appendTo;
        jQuery(_this.template(renderingData)).appendTo(_this.appendTo);
        // this.loadSidePanelComponents();
        return;
      }

      if (renderingData.open) {
        this.appendTo.removeClass('minimized');
      } else {
        this.appendTo.addClass('minimized');
      }
    },

    template: Handlebars.compile([
      '<div class="tabContentArea">',
      '</div>'
    ].join('')),

    toggle: function (enableSidePanel) {
      if (!enableSidePanel) {
        jQuery(this.appendTo).hide();
        this.parent.element.find('.view-container').addClass('focus-max-width');
        this.parent.element.find('.mirador-icon-toc').hide();
      } else {
        jQuery(this.appendTo).show({effect: "fade", duration: 300, easing: "easeInCubic"});
        this.parent.element.find('.view-container').removeClass('focus-max-width');
        this.parent.element.find('.mirador-icon-toc').show();
      }
    }
  };

}(Mirador));

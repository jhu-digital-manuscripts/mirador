(function($) {

  $.SidePanel= function(options) {
    jQuery.extend(true, this, {
      windowId: null,
      slotAddress: null,
      pinned: null,
      element:           null,
      appendTo:          null,
      manifest:          null,
      panelState:        {},
      tocTabAvailable:   false,
      annotationsTabAvailable: false,
      layersTabAvailable: false,
      toolsTabAvailable: false,
      hasStructures:     false,
      state:             null,
      eventEmitter:      null,
      searchContext:     null,
    }, options);
    this.canvasID = options.canvasID;
    this.searchTabAvailable = true;
    this.visible = options.visible;
    this.queryUrl = options.queryUrl;

    this.searchTab = null;

    this.init();
  };

  $.SidePanel.prototype = {
    init: function() {
      var _this = this;

      this.updateState({
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
      this.render(this.updateState());

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
        windowId: this.windowId,
        appendTo: this.appendTo,
        tabs : this.panelState.tabs,
        hasStructures : this.hasStructures,
        eventEmitter: this.eventEmitter
      });

      if (this.tocTabAvailable) {
        new $.TableOfContents({
          structures: this.manifest.getStructures(),
          appendTo: this.element.find('.tabContentArea'),
          windowId: this.windowId,
          canvasID: this.canvasID,
          manifestVersion: this.manifest.getVersion(),
          eventEmitter: this.eventEmitter
        });
      }

      if (_this.annotationsTabAvailable) {
        this.annoTab = new $.JhAnnotationTab({
          manifest: _this.manifest,
          // parent: _this.parent,
          appendTo: _this.element.find('.tabContentArea'),
          tabId: 'annotationsTab',
          windowId: _this.windowId,
          canvasID: _this.canvasID,
          eventEmitter: _this.eventEmitter,
          state: _this.state,
          slotAddress: _this.slotAddress
        });
      }
      // if (_this.annotationsTabAvailable) {
      //   new $.AnnotationsTab({
      //     manifest: _this.manifest,
      //     windowId: this.windowId,
      //     appendTo: _this.element.find('.tabContentArea'),
      //     state: _this.state,
      //     eventEmitter: _this.eventEmitter
      //   });
      // }
      if (_this.layersTabAvailable) {
        new $.LayersTab({
          manifest: _this.manifest,
          windowId: this.windowId,
          appendTo: _this.element.find('.tabContentArea'),
          canvasID: this.canvasID,
          state: _this.state,
          eventEmitter: _this.eventEmitter
        });
      }

      if (_this.searchTabAvailable) {
        this.searchTab = new $.NewSearchWidget({
          startHidden: true,
          windowId: this.windowId,
          appendTo: this.element.find(".tabContentArea"),
          eventEmitter: this.eventEmitter,
          tabId: "searchTab",
          baseObject: this.manifest.jsonLd,
          pinned: this.pinned,
          slotAddress: this.slotAddress,
          context: this.searchContext,
          state: this.state,
          config: {
            allowFacets: false,
            searchBooks: true,
            inSidebar: true
          }
        });
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

    update: function(name, availability) {
      var updatedState = this.panelState;
      jQuery.each(updatedState.tabs, function(index, value) {
        if (value.name === name) {
          value.options.available = availability;
        }
      });
      this.updateState(updatedState);
    },

    updateState: function(newState, initial) {
      var _this = this;
      if (!arguments.length) return this.panelState;
      jQuery.extend(true, this.panelState, newState);

      if (!initial) {
        _this.eventEmitter.publish('sidePanelStateUpdated.' + this.windowId, this.panelState);
      }

      /*var enableSidePanel = false;
       jQuery.each(this.panelState.tabs, function(index, value) {
       if (value.options.available) {
       enableSidePanel = true;
       }
       });

       this.toggle(enableSidePanel);*/

      return this.panelState;
    },

    panelToggled: function() {
      var currentState = this.updateState(),
          open = !currentState.open;

      currentState.open = open;
      this.updateState(currentState);
    },

    // doesn't do anything right now
    // getTemplateData: function() {
    //     return {
    //         annotationsTab: this.state().annotationsTab,
    //         tocTab: this.state().tocTab
    //     };
    // },

    listenForActions: function() {
      var _this = this;
      _this.eventEmitter.subscribe('sidePanelStateUpdated.' + this.windowId, function(_, data) {
        _this.render(data);
      });

      _this.eventEmitter.subscribe('sidePanelResized', function() {
      });

      _this.eventEmitter.subscribe('sidePanelToggled.' + this.windowId, function() {
        _this.panelToggled();
      });

      _this.eventEmitter.subscribe('annotationListLoaded.' + _this.windowId, function(event) {
        var windowObject = _this.state.getWindowObjectById(_this.windowId);
        if (windowObject.annotationsAvailable[windowObject.viewType]) {
          if (_this.state.getWindowAnnotationsList(_this.windowId).length > 0) {
            _this.update('annotations', true);
          }
        }
      });

      _this.eventEmitter.subscribe('currentCanvasIDUpdated.' + _this.windowId, function(event, newCanvasId) {
        _this.canvasID = newCanvasId;
      });

      _this.eventEmitter.subscribe('REQUEST_SEARCH.' + _this.windowId, function(event, data) {
        if (!data || !data.service || !data.query) {
          console.log(' Sad moo ' + JSON.stringify(data));
          return;
        }
        // console.log("Received a search request in this window! " + _this.windowId + "\n" + JSON.stringify(data));
        // We want to toggle the search tab on, then send a search request to the search controller
        // var index = -1;

        var index = _this.appendTo.find('.tabGroup .tab[data-tabid=searchTab]').index();
        _this.eventEmitter.publish('tabSelected.' + _this.windowId, index);

        _this.searchTab.context = {
          searchService: typeof data.service === 'string' ? data.service : data.service.id,
          search: {
            query: data.query,
            offset: 0
          }
        };

        if (index) {
          _this.eventEmitter.publish('SEARCH', {
            'origin': _this.windowId,
            'service': data.service,
            'query': data.query
          });
        }
      });

    },

    render: function(renderingData) {
      var _this = this;
      if (!this.element) {
        this.element = this.appendTo;
        jQuery(_this.template(renderingData)).appendTo(_this.appendTo);
        return;
      }
    },

    template: Handlebars.compile([
      '<div class="tabContentArea">',
      '<ul class="tabGroup">',
      '</ul>',
      '</div>'
    ].join('')),

    toggle: function (enableSidePanel) {
      var _this = this;
      if (!enableSidePanel) {
        jQuery(this.appendTo).hide();
        _this.eventEmitter.publish('ADD_CLASS.'+this.windowId, 'focus-max-width');
        _this.eventEmitter.publish('HIDE_ICON_TOC.'+this.windowId);
      } else {
        jQuery(this.appendTo).show({effect: "fade", duration: 300, easing: "easeInCubic"});
        _this.eventEmitter.publish('REMOVE_CLASS.'+this.windowId, 'focus-max-width');
        _this.eventEmitter.publish('SHOW_ICON_TOC.'+this.windowId);
      }
    }
  };

}(Mirador));

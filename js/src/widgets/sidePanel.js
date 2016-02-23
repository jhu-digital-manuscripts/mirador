(function($) {

  $.SidePanel= function(options) {
    jQuery.extend(true, this, {
      element:           null,
      appendTo:          null,
      parent:            null,
      manifest:          null,
      panelState:        {},
      tocTabAvailable:   false,
      annotationsTabAvailable: true,
      searchTabAvailable: true,
      layersTabAvailable: false,
      toolsTabAvailable: false,
      hasStructures:     false
    }, options);

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
            content: null,
            options : {
              available: _this.tocTabAvailable,
              id:'tocTab',
              label:'Index'
            }
          },
          {
            name : 'annotations',
            content: null,
            options : {
              available: _this.annotationsTabAvailable,
              id:'annotationsTab',
              label:'Annotations'
            }
          },
          {
            name: 'search',
            content: null,
            options: {
              available: _this.searchTabAvailable,
              id: 'searchTab',
              label: 'Search'
            }
          },
          /*{
            name : 'layers',
            options : {
              available: _this.layersTabAvailable,
              id:'layersTab',
              label:'Layers'
            }
          },
          {
            name : 'tools',
            options : {
              available: _this.toolsTabAvailable,
              id:'toolsTab',
              label:'Tools'
            }
          }*/
        ],
        width: 280,
        open: true
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
        parent : this
      });

      if (this.tocTabAvailable) {
        new $.TableOfContents({
          manifest: this.manifest,
          appendTo: this.element.find('.tabContentArea td'),
          parent: this.parent,
          panel: true,
          canvasID: this.parent.currentCanvasID
        });
      }

      if (_this.annotationsTabAvailable) {
        // new $.AnnotationsTab({
        //   manifest: _this.manifest,
        //   parent: this.parent,
        //   appendTo: _this.element.find('.tabContentArea'),
        //   tabs: _this.state.tabs
        // });
        new $.JhAnnotationTab({
          manifest: _this.manifest,
          parent: _this.parent,
          appendTo: _this.element.find('.tabContentArea td'),
          tabId: 'annotationsTab',
          windowId: _this.parent.id,
          currentCanvasID: this.parent.currentCanvasID,
        });
      }

      if (_this.searchTabAvailable) {
        new $.SearchWidget({
          manifest: _this.manifest,
          parent: _this.parent,
          windowId: _this.parent.id,
          widgetId: 'searchTab',
          appendTo: _this.element.find('.tabContentArea td'),
          width: 0
        });
      }
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
      var state = this.state(),
          open = !state.open;

      state.open = open;
      this.state(state);
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
      '<tr class="tabContentArea"><td>',
      '</td></tr>'
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

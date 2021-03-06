(function($) {

  $.Hud = function(options) {

    jQuery.extend(this, {
      element:   null,
      windowId:  null,
      annoState: null,
      annoEndpointAvailable: false,
      eventEmitter: null,
      fullScreenAvailable: true,
      pinned: false,
      state: null
    }, options);

    this.init();
  };

  $.Hud.prototype = {

    init: function() {
      this.createStateMachines();

      var showAnno = typeof this.showAnno !== 'undefined' ? this.showAnno : this.canvasControls.annotations.annotationLayer,
      showImageControls = typeof this.showImageControls !== 'undefined' ? this.showImageControls : this.canvasControls.imageManipulation.manipulationLayer;
      // var zoomSlider = this.state.getStateProperty("windowSettings").imageManipulation.controls.zoomSlider;

      this.element = jQuery(this.template({
        showNextPrev : this.showNextPrev,
        showBottomPanel : typeof this.bottomPanelAvailable === 'undefined' ? true : this.bottomPanelAvailable,
        showAnno : showAnno,
        showImageControls : showImageControls,
        showFullScreen : this.fullScreenAvailable,
        // zoomSlider: zoomSlider
      })).appendTo(this.appendTo);

      if (showAnno || showImageControls) {
        this.contextControls = new $.ContextControls({
          element: null,
          container: this.element.find('.mirador-osd-context-controls'),
          qtipElement: this.qtipElement,
          mode: 'displayAnnotations',
          windowId: this.windowId,
          canvasControls: this.canvasControls,
          annoEndpointAvailable: this.annoEndpointAvailable,
          availableAnnotationTools: this.availableAnnotationTools,
          availableAnnotationStylePickers: this.availableAnnotationStylePickers,
          state: this.state,
          eventEmitter: this.eventEmitter
        });
      }

      this.listenForActions();
      this.setQtips(this.element.find('.mirador-osd-navigation'));
      this.setQtips(this.element.find('.mirador-pan-zoom-controls'));
    },

    togglePinned: function(isPinned) {
      this.pinned = isPinned;
    },

    listenForActions: function() {
      var _this = this;
      this.eventEmitter.subscribe('DISABLE_TOOLTIPS_BY_CLASS.' + this.windowId, function(event, className) {
        _this.element.find(className).qtip('disable');
      });

      this.eventEmitter.subscribe('ENABLE_TOOLTIPS_BY_CLASS.' + this.windowId, function(event, className) {
        _this.element.find(className).qtip('enable');
      });

      this.eventEmitter.subscribe('SET_STATE_MACHINE_POINTER.' + this.windowId, function(event) {
        if (_this.annoState.current === 'none') {
          _this.annoState.startup();
        } else if (_this.annoState.current === 'off') {
          _this.annoState.displayOn();
        } else {
          _this.annoState.choosePointer();
        }
      });

      this.eventEmitter.subscribe('windowPinned', function(event, data) {
        if (_this.windowId === data.windowId) {
          _this.togglePinned(data.status);
        }
      });
    },

    createStateMachines: function() {
      var _this = this,
      duration = "200";

      //add more to these as AnnoState becomes more complex
      //initial state is 'none'
      this.annoState = StateMachine.create({
        events: [
          { name: 'startup', from: 'none', to: 'off' },
          { name: 'displayOn', from: 'off', to: 'pointer'},
          { name: 'displayOff', from: ['pointer', 'shape'], to: 'off'},
          { name: 'choosePointer', from: ['pointer', 'shape'], to: 'pointer'},
          { name: 'chooseShape', from: 'pointer', to: 'shape'},
          { name: 'changeShape', from: 'shape', to: 'shape'},
          { name: 'refresh', from: 'pointer', to: 'pointer'},
          { name: 'refresh', from: 'shape', to: 'shape'}
        ],
        callbacks: {
          onstartup: function(event, from, to) {
            _this.eventEmitter.publish(('windowUpdated'), {
              id: _this.windowId,
              annotationState: to
            });
          },
          ondisplayOn: function(event, from, to) {
            _this.eventEmitter.publish('HUD_ADD_CLASS.'+_this.windowId, ['.mirador-osd-annotations-layer', 'selected']);
            if (_this.annoEndpointAvailable) {
                  _this.contextControls.annotationShow();
            }
            _this.eventEmitter.publish('modeChange.' + _this.windowId, 'displayAnnotations');
            _this.eventEmitter.publish('HUD_ADD_CLASS.'+_this.windowId, ['.mirador-osd-pointer-mode', 'selected']);
            _this.eventEmitter.publish('HUD_ADD_CLASS.'+_this.windowId, ['.hud-dropdown', 'hud-disabled']);
            _this.eventEmitter.publish('DISABLE_TOOLTIPS_BY_CLASS.'+_this.windowId, '.hud-dropdown');
            _this.eventEmitter.publish('DEFAULT_CURSOR.' + _this.windowId);
            _this.eventEmitter.publish(('windowUpdated'), {
              id: _this.windowId,
              annotationState: to
            });
          },
          ondisplayOff: function(event, from, to) {
            if (_this.annoEndpointAvailable) {
              _this.eventEmitter.publish('HUD_REMOVE_CLASS.'+_this.windowId, ['.mirador-osd-edit-mode', 'selected']);
              _this.eventEmitter.publish('HUD_REMOVE_CLASS.'+_this.windowId, ['.mirador-osd-pointer-mode', 'selected']);
              _this.eventEmitter.publish('CANCEL_ACTIVE_ANNOTATIONS.'+_this.windowId);
              _this.contextControls.annotationHide();
            }
            _this.eventEmitter.publish('HUD_REMOVE_CLASS.'+_this.windowId, ['.mirador-osd-annotations-layer', 'selected']);
            _this.eventEmitter.publish('modeChange.' + _this.windowId, 'default');
            _this.eventEmitter.publish(('windowUpdated'), {
              id: _this.windowId,
              annotationState: to
            });
          },
          onchoosePointer: function(event, from, to) {
            _this.eventEmitter.publish('HUD_REMOVE_CLASS.'+_this.windowId, ['.mirador-osd-edit-mode', 'selected']);
            _this.eventEmitter.publish('HUD_ADD_CLASS.'+_this.windowId, ['.mirador-osd-pointer-mode', 'selected']);
            _this.eventEmitter.publish('HUD_ADD_CLASS.'+_this.windowId, ['.hud-dropdown', 'hud-disabled']);
            _this.eventEmitter.publish('DISABLE_TOOLTIPS_BY_CLASS.'+_this.windowId, '.hud-dropdown');
            _this.eventEmitter.publish('modeChange.' + _this.windowId, 'displayAnnotations');
            _this.eventEmitter.publish('DEFAULT_CURSOR.' + _this.windowId);
            _this.eventEmitter.publish(('windowUpdated'), {
              id: _this.windowId,
              annotationState: to
            });
          },
          onchooseShape: function(event, from, to, shape) {
            _this.eventEmitter.publish('HUD_REMOVE_CLASS.'+_this.windowId, ['.mirador-osd-pointer-mode', 'selected']);
            _this.eventEmitter.publish('HUD_REMOVE_CLASS.'+_this.windowId, ['.mirador-osd-edit-mode', 'selected']);
            _this.eventEmitter.publish('HUD_REMOVE_CLASS.'+_this.windowId, ['.hud-dropdown', 'hud-disabled']);
            _this.eventEmitter.publish('ENABLE_TOOLTIPS_BY_CLASS.'+_this.windowId, '.hud-dropdown');
            _this.eventEmitter.publish('HUD_ADD_CLASS.'+_this.windowId, ['.mirador-osd-'+shape+'-mode', 'selected']);
            _this.eventEmitter.publish('modeChange.' + _this.windowId, 'creatingAnnotation');
            _this.eventEmitter.publish('CROSSHAIR_CURSOR.' + _this.windowId);
            _this.eventEmitter.publish('toggleDrawingTool.'+_this.windowId, shape);

            _this.eventEmitter.publish(('windowUpdated'), {
              id: _this.windowId,
              annotationState: to
            });
          },
          onchangeShape: function(event, from, to, shape) {
            _this.eventEmitter.publish('HUD_REMOVE_CLASS.'+_this.windowId, ['.mirador-osd-pointer-mode', 'selected']);
            _this.eventEmitter.publish('HUD_REMOVE_CLASS.'+_this.windowId, ['.mirador-osd-edit-mode', 'selected']);
            _this.eventEmitter.publish('HUD_REMOVE_CLASS.'+_this.windowId, ['.hud-dropdown', 'hud-disabled']);
            _this.eventEmitter.publish('ENABLE_TOOLTIPS_BY_CLASS.'+_this.windowId, '.hud-dropdown');
            _this.eventEmitter.publish('HUD_ADD_CLASS.'+_this.windowId, ['.mirador-osd-'+shape+'-mode', 'selected']);
            _this.eventEmitter.publish('CROSSHAIR_CURSOR.' + _this.windowId);
            //don't need to trigger a mode change, just change tool
            _this.eventEmitter.publish('toggleDrawingTool.'+_this.windowId, shape);

            _this.eventEmitter.publish(('windowUpdated'), {
              id: _this.windowId,
              annotationState: to
            });
          },
          onrefresh: function(event, from, to) {
            //TODO
          }
        }
      });

      this.manipulationState = StateMachine.create({
        events: [
          { name: 'startup',  from: 'none',  to: 'manipulationOff' },
          { name: 'displayOn',  from: 'manipulationOff',  to: 'manipulationOn' },
          { name: 'displayOff', from: 'manipulationOn', to: 'manipulationOff' }
        ],
        callbacks: {
          onstartup: function(event, from, to) {
            _this.eventEmitter.publish(('windowUpdated'), {
              id: _this.windowId,
              manipulationState: to
            });
          },
          ondisplayOn: function(event, from, to) {
            _this.eventEmitter.publish('HUD_ADD_CLASS.'+_this.windowId, ['.mirador-manipulation-toggle', 'selected']);
            _this.contextControls.manipulationShow();
            _this.eventEmitter.publish(('windowUpdated'), {
              id: _this.windowId,
              manipulationState: to
            });
          },
          ondisplayOff: function(event, from, to) {
            _this.contextControls.manipulationHide();
            _this.eventEmitter.publish('HUD_REMOVE_CLASS.'+_this.windowId, ['.mirador-manipulation-toggle', 'selected']);
            _this.eventEmitter.publish(('windowUpdated'), {
              id: _this.windowId,
              manipulationState: to
            });
          }
        }
      });
    },

    setQtips: function(element) {
      var _this = this;
      element.find('a').each(function () {
        var curEl = jQuery(this);
        curEl.qtip({
          content: { text: curEl.attr('title') },
          position: {
            my: 'bottom center',
            at: 'top center',
            viewport: true,
            container: _this.qtipElement
          },
          style: { classes: 'qtip-dark qtip-shadow qtip-rounded' }
        });
      });
    },

    template: Handlebars.compile([
      '<div class="mirador-hud">',
        '<div class="mirador-osd-context-controls hud-container">',
          '{{#if showAnno}}',
            '<div class="mirador-osd-annotation-controls">',
              '<a class="mirador-osd-annotations-layer hud-control" role="button" title="{{t "annotationTooltip"}}" aria-label="{{t "annotationTooltip"}}">',
                '<i class="fa fa-lg fa-comments"></i>',
              '</a>',
            '</div>',
          '{{/if}}',
          '{{#if showImageControls}}',
            '<div class="mirador-manipulation-controls">',
              '<a class="mirador-manipulation-toggle hud-control" role="button" title="{{t "imageManipulationTooltip"}}" aria-label="{{t "imageManipulationTooltip"}}">',
                '<i class="material-icons">tune</i>',
              '</a>',
            '</div>',
          '{{/if}}',
        '</div>',
        '<div class="mirador-osd-navigation">',
          '{{#if showNextPrev}}',
            '<a class="mirador-osd-previous hud-control "  title="{{t "prevPageTooltip"}}">',
              '<i class="fa fa-3x fa-chevron-left "></i>',
            '</a>',
            '<a class="mirador-osd-next hud-control "  title="{{t "nextPageTooltip"}}">',
              '<i class="fa fa-3x fa-chevron-right"></i>',
            '</a>',
          '{{/if}}',
          '{{#if showBottomPanel}}',
            '<a class="mirador-osd-toggle-bottom-panel hud-control" role="button"  title="{{t "toggleThumbnailsTooltip"}}">',
              '<i class="fa fa-2x fa-ellipsis-h"></i>',
            '</a>',
          '{{/if}}',
        '</div>',
        '<div class="mirador-pan-zoom-controls hud-control">',
          '<a class="mirador-osd-up hud-control" role="button"  title="{{t "panUpTooltip"}}">',
            '<i class="fa fa-chevron-circle-up"></i>',
          '</a>',
          '<a class="mirador-osd-right hud-control" role="button"  title="{{t "panRightTooltip"}}">',
            '<i class="fa fa-chevron-circle-right"></i>',
          '</a>',
          '<a class="mirador-osd-down hud-control" role="button"  title="{{t "panDownTooltip"}}">',
            '<i class="fa fa-chevron-circle-down"></i>',
          '</a>',
          '<a class="mirador-osd-left hud-control" role="button"  title="{{t "panLeftTooltip"}}">',
            '<i class="fa fa-chevron-circle-left"></i>',
          '</a>',
          //  '{{#if zoomSlider}}',
          //  '<div class=""></div>',  // Zoom slider
          //  '{{else}}',
          '<a class="mirador-osd-zoom-in hud-control" role="button"  title="{{t "zoomInTooltip"}}">',
            '<i class="fa fa-plus-circle"></i>',
          '</a>',
          '<a class="mirador-osd-zoom-out hud-control" role="button"  title="{{t "zoomOutTooltip"}}">',
            '<i class="fa fa-minus-circle"></i>',
          '</a>',
          //  '{{/if}}',
          //  '<div class="mirador-osd-zoom-slider hud-control"></div>',  // Zoom slider
          '<a class="mirador-osd-go-home hud-control" role="button"  title="{{t "resetPanZoomTooltip"}}">',
            '<i class="fa fa-refresh"></i>',
          '</a>',
          '<a class="mirador-osd-rotate-left hud-control " title="{{t "rotateLeftTooltip"}}">',
            '<i class="fa fa-3x fa-rotate-left "></i>',    // Rotate right icon
          '</a>',
          '<a class="mirador-osd-rotate-right hud-control " title="{{t "rotateRightTooltip"}}">',
            '<i class="fa fa-3x fa-rotate-right "></i>',    // Rotate right icon
          '</a>',
        '</div>',
      '</div>'
    ].join(''))

  };

}(Mirador));

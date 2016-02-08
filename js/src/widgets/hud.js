(function($) {

  $.Hud = function(options) {

    jQuery.extend(this, {
      element:   null,
      parent:    null,
      windowId:  null,
      annoState: null,
      showAnnotations: true,
      annoEndpointAvailable: false,
      fullScreenAvailable: true
    }, options);

    this.init();
  };

  $.Hud.prototype = {

    init: function() {
      this.createStateMachine();

      this.element = jQuery(this.template({
        showNextPrev : this.parent.imagesList.length !== 1,
        showBottomPanel : typeof this.bottomPanelAvailable === 'undefined' ? true : this.bottomPanelAvailable,
        showAnno : this.annotationLayerAvailable && this.editorPanelConfig.showOverlay,
        showFullScreen : this.fullScreenAvailable
      })).appendTo(this.element);

      if (this.annotationLayerAvailable && this.annoEndpointAvailable) {
        this.contextControls = new $.ContextControls({
          element: null,
          container: this.parent.element,
          mode: 'displayAnnotations',
          parent: this,
          windowId: this.windowId,
          annotationCreationAvailable: this.annotationCreationAvailable
        });
      }

      this.loadHudComponents();

      this.bindEvents();
      this.listenForActions();

      if (typeof this.bottomPanelAvailable !== 'undefined' && !this.bottomPanelAvailable) {
        this.parent.parent.bottomPanelVisibility(false);
      } else {
        this.parent.parent.bottomPanelVisibility(this.parent.parent.bottomPanelVisible);
      }
    },
    listenForActions: function() {
        var _this = this;

        jQuery.subscribe('editorPanelStateUpdated' + _this.windowId, function(_, editorPanelState) {

          if (editorPanelState.open){
            if (_this.annoState.current === 'annoOff') {
              _this.annoState.displayOn(this);
            }
          } else {
            if (_this.annoState.current === 'annoOn') {
              _this.annoState.displayOff(this);
            }
          }

        });

    },
    bindEvents: function() {
      var _this = this,
      firstCanvasId = _this.parent.imagesList[0]['@id'],
      lastCanvasId = _this.parent.imagesList[_this.parent.imagesList.length-1]['@id'];

      this.parent.element.find('.mirador-osd-next').on('click', function() {
        _this.parent.next();
      });

      this.parent.element.find('.mirador-osd-previous').on('click', function() {
        _this.parent.previous();
      });

      this.parent.element.find('.mirador-osd-annotations-layer').on('click', function() {
        if (_this.annoState.current === 'none') {
          _this.annoState.startup(this);
        }
        if (_this.annoState.current === 'annoOff') {
          _this.annoState.displayOn(this);
        } else {
          _this.annoState.displayOff(this);
        }
      });

      this.parent.element.find('.mirador-osd-go-home').on('click', function() {
        _this.parent.osd.viewport.goHome();
      });

      this.parent.element.find('.mirador-osd-up').on('click', function() {
        var panBy = _this.getPanByValue();
        var osd = _this.parent.osd;
        osd.viewport.panBy(new OpenSeadragon.Point(0, -panBy.y));
        osd.viewport.applyConstraints();
      });
      this.parent.element.find('.mirador-osd-right').on('click', function() {
        var panBy = _this.getPanByValue();
        var osd = _this.parent.osd;
        osd.viewport.panBy(new OpenSeadragon.Point(panBy.x, 0));
        osd.viewport.applyConstraints();
      });
      this.parent.element.find('.mirador-osd-down').on('click', function() {
        var panBy = _this.getPanByValue();
        var osd = _this.parent.osd;
        osd.viewport.panBy(new OpenSeadragon.Point(0, panBy.y));
        osd.viewport.applyConstraints();
      });
      this.parent.element.find('.mirador-osd-left').on('click', function() {
        var panBy = _this.getPanByValue();
        var osd = _this.parent.osd;
        osd.viewport.panBy(new OpenSeadragon.Point(-panBy.x, 0));
        osd.viewport.applyConstraints();
      });
      this.parent.element.find('.mirador-osd-zoom-in').on('click', function() {
        var osd = _this.parent.osd;
        if ( osd.viewport ) {
          osd.viewport.zoomBy(
            osd.zoomPerClick / 1.0
          );
          osd.viewport.applyConstraints();
        }
      });
      this.parent.element.find('.mirador-osd-zoom-out').on('click', function() {
        var osd = _this.parent.osd;
        if ( osd.viewport ) {
          osd.viewport.zoomBy(
            1.0 / osd.zoomPerClick
          );
          osd.viewport.applyConstraints();
        }
      });

      this.parent.element.find('.mirador-osd-fullscreen').on('click', function() {
        if (OpenSeadragon.isFullScreen()) {
          OpenSeadragon.exitFullScreen();
        } else {
          OpenSeadragon.requestFullScreen(_this.parent.parent.element[0]);
        }
      });

      jQuery(document).on("webkitfullscreenchange mozfullscreenchange fullscreenchange", function() {
        _this.fullScreen();
      });

      this.parent.element.find('.mirador-osd-toggle-bottom-panel').on('click', function() {
        var visible = !_this.parent.parent.bottomPanelVisible;
        _this.parent.parent.bottomPanelVisibility(visible);
      });

      /**
       * TODO BUG! panning around is kind of broken when image is rotated 90 deg./270 deg. 180 deg is fine.
       * This bug is caused by a bug in OpenSeadragon, as yet unresolved.
       * It is perhaps due to a failure to re-calculate viewport coords on rotate?
       * See: https://github.com/openseadragon/openseadragon/issues/567
       */
      this.parent.element.find('.mirador-osd-rotate-left').on('click', function() {
        var osd = _this.parent.osd;
        var current_rotation = osd.viewport.getRotation();
        osd.viewport.setRotation(current_rotation - 90);
      });
      this.parent.element.find('.mirador-osd-rotate-right').on('click', function() {
        var osd = _this.parent.osd;
        var current_rotation = osd.viewport.getRotation();
        osd.viewport.setRotation(current_rotation + 90);
      });

      jQuery.subscribe('bottomPanelSet.' + _this.windowId, function(event, visible) {
        var dodgers = _this.parent.element.find('.mirador-osd-toggle-bottom-panel, .mirador-pan-zoom-controls');
        var arrows = _this.parent.element.find('.mirador-osd-next, .mirador-osd-previous');
        if (visible === true) {
          dodgers.css({transform: 'translateY(-130px)'});
          arrows.css({transform: 'translateY(-65px)'});
        } else {
          dodgers.css({transform: 'translateY(0)'});
          arrows.css({transform: 'translateY(0)'});
        }
      });

      jQuery.subscribe('currentCanvasIDUpdated.' + _this.windowId, function(event, canvasId) {
        // If it is the first canvas, hide the "go to previous" button, otherwise show it.
        if (canvasId === firstCanvasId) {
          _this.parent.element.find('.mirador-osd-previous').hide();
          _this.parent.element.find('.mirador-osd-next').show();
        } else if (canvasId === lastCanvasId) {
          _this.parent.element.find('.mirador-osd-next').hide();
          _this.parent.element.find('.mirador-osd-previous').show();
        } else {
          _this.parent.element.find('.mirador-osd-next').show();
          _this.parent.element.find('.mirador-osd-previous').show();
        }
        // If it is the last canvas, hide the "go to previous" button, otherwise show it.
      });
    },
    loadHudComponents: function () {
        new $.EditorPanel({
          windowId: this.windowId,
          appendTo: this.element.parent().parent(), // appending to .view-container
          editorPanelConfig: this.editorPanelConfig
        });
    },
    createStateMachine: function() {
      //add more to these as AnnoState becomes more complex
      var _this = this,
      duration = "200";
      //initial state is 'none'
      this.annoState = StateMachine.create({
        events: [
          { name: 'startup',  from: 'none',  to: 'annoOff' },
          { name: 'displayOn',  from: 'annoOff',  to: 'annoOnCreateOff' },
          { name: 'refreshCreateOff',  from: 'annoOnCreateOff',  to: 'annoOnCreateOff' },          
          { name: 'createOn', from: ['annoOff','annoOnCreateOff'], to: 'annoOnCreateOn' },
          { name: 'refreshCreateOn',  from: 'annoOnCreateOn',  to: 'annoOnCreateOn' },          
          { name: 'createOff',  from: 'annoOnCreateOn',    to: 'annoOnCreateOff' },
          { name: 'displayOff', from: ['annoOnCreateOn','annoOnCreateOff'], to: 'annoOff' }
        ],
        callbacks: {
          onstartup: function(event, from, to) {
            jQuery.publish(('windowUpdated'), {
              id: _this.windowId,
              annotationState: to
            });
          },
          ondisplayOn: function(event, from, to) {
            if (_this.annoEndpointAvailable) {
              _this.parent.element.find('.mirador-osd-annotations-layer').fadeOut(duration, function() {      
                _this.contextControls.show();
              });              
            } else {
              _this.parent.element.find('.mirador-osd-annotations-layer').addClass("selected");
            }
            jQuery.publish('modeChange.' + _this.windowId, 'displayAnnotations');
            jQuery.publish(('windowUpdated'), {
              id: _this.windowId,
              annotationState: to
            });
          },
          onrefreshCreateOff: function(event, from, to) {
            jQuery.publish('modeChange.' + _this.windowId, 'displayAnnotations');
            jQuery.publish(('windowUpdated'), {
              id: _this.windowId,
              annotationState: to
            });
          },
          oncreateOn: function(event, from, to) {
            function enableEditingAnnotations() {
              _this.parent.element.find('.mirador-osd-edit-mode').addClass("selected");
              jQuery.publish('modeChange.' + _this.windowId, 'editingAnnotations');
            }
            if (_this.annoEndpointAvailable) {
              if (from === "annoOff") {
                _this.parent.element.find('.mirador-osd-annotations-layer').fadeOut(duration, function() {      
                  _this.contextControls.show();
                  enableEditingAnnotations();
                });
              } else {
                enableEditingAnnotations();
              }
            }
            jQuery.publish(('windowUpdated'), {
              id: _this.windowId,
              annotationState: to
            });
          },
          onrefreshCreateOn: function(event, from, to) {
            jQuery.publish('modeChange.' + _this.windowId, 'editingAnnotations');
            jQuery.publish(('windowUpdated'), {
              id: _this.windowId,
              annotationState: to
            });
          },
          oncreateOff: function(event, from, to) {
            _this.parent.element.find('.mirador-osd-edit-mode').removeClass("selected");
            jQuery.publish('modeChange.' + _this.windowId, 'displayAnnotations');
            jQuery.publish(('windowUpdated'), {
              id: _this.windowId,
              annotationState: to
            });
          },
          ondisplayOff: function(event, from, to) {
            if (_this.annoEndpointAvailable) {
              _this.parent.element.find('.mirador-osd-edit-mode').removeClass("selected");
              _this.contextControls.hide(function() {
                _this.parent.element.find('.mirador-osd-annotations-layer').fadeIn(duration);
              }
              );
            } else {
              _this.parent.element.find('.mirador-osd-annotations-layer').removeClass("selected");
            }
            jQuery.publish('modeChange.' + _this.windowId, 'default');
            jQuery.publish(('windowUpdated'), {
              id: _this.windowId,
              annotationState: to
            });
          }
        }
      });
    },

    getPanByValue: function() {
      var bounds = this.parent.osd.viewport.getBounds(true);
      //for now, let's keep 50% of the image on the screen
      var panBy = {
        "x" : bounds.width * 0.5,
        "y" : bounds.height * 0.5
      };
      return panBy;
    },

    fullScreen: function() {
      var replacementButton,
      bottomPanelHeight = this.parent.parent.element.find('.bottomPanel').innerHeight();

      if (!OpenSeadragon.isFullScreen()) {
        replacementButton = jQuery('<i class="fa fa-expand"></i>');
        this.parent.element.find('.mirador-osd-fullscreen').empty().append(replacementButton);
        this.parent.element.find('.mirador-osd-toggle-bottom-panel').show();
        this.parent.parent.bottomPanelVisibility(true);
      } else {

        replacementButton = jQuery('<i class="fa fa-compress"></i>');
        this.parent.element.find('.mirador-osd-fullscreen').empty().append(replacementButton);
        this.parent.element.find('.mirador-osd-toggle-bottom-panel').hide();
        this.parent.parent.bottomPanelVisibility(false);
      }
    },

    template: Handlebars.compile([
                                 '{{#if showNextPrev}}',
                                 '<a class="mirador-osd-previous hud-control ">',
                                 '<i class="fa fa-3x fa-chevron-left "></i>',
                                 '</a>',
                                 '{{/if}}',
                                 '{{#if showFullScreen}}',
                                 '<a class="mirador-osd-fullscreen hud-control" role="button" aria-label="Toggle fullscreen">',
                                 '<i class="fa fa-expand"></i>',
                                 '</a>',
                                 '{{/if}}',
                                 '{{#if showAnno}}',
                                 '<a class="mirador-osd-annotations-layer hud-control " role="button" aria-label="Toggle annotations">',
                                 '<i class="fa fa-lg fa-comments"></i>',
                                 '</a>',
                                 '{{/if}}',
                                 '{{#if showNextPrev}}',
                                 '<a class="mirador-osd-next hud-control ">',
                                 '<i class="fa fa-3x fa-chevron-right"></i>',
                                 '</a>',
                                 '{{/if}}',
                                 '{{#if showBottomPanel}}',
                                 '<a class="mirador-osd-toggle-bottom-panel hud-control " role="button" aria-label="Toggle Bottom Panel">',
                                 '<i class="fa fa-2x fa-ellipsis-h"></i>',
                                 '</a>',
                                 '{{/if}}',
                                 '<div class="mirador-pan-zoom-controls hud-control ">',
                                 '<a class="mirador-osd-up hud-control" role="button" aria-label="Move image up">',
                                 '<i class="fa fa-chevron-circle-up"></i>',
                                 '</a>',
                                 '<a class="mirador-osd-right hud-control" role="button" aria-label="Move image right">',
                                 '<i class="fa fa-chevron-circle-right"></i>',
                                 '</a>',
                                 '<a class="mirador-osd-down hud-control" role="button" aria-label="Move image down">',
                                 '<i class="fa fa-chevron-circle-down"></i>',
                                 '</a>',
                                 '<a class="mirador-osd-left hud-control" role="button" aria-label="Move image left">',
                                 '<i class="fa fa-chevron-circle-left"></i>',
                                 '</a>',
                                 '<a class="mirador-osd-zoom-in hud-control" role="button" aria-label="Zoom in">',
                                 '<i class="fa fa-plus-circle"></i>',
                                 '</a>',
                                 '<a class="mirador-osd-zoom-out hud-control" role="button" aria-label="Zoom out">',
                                 '<i class="fa fa-minus-circle"></i>',
                                 '</a>',
                                 '<a class="mirador-osd-go-home hud-control" role="button" aria-label="Reset image bounds">',
                                 '<i class="fa fa-home"></i>',
                                 '<a class="mirador-osd-rotate-left hud-control ">',
                                 '<i class="fa fa-3x fa-rotate-left "></i>',    // Rotate right icon
                                 '</a>',
                                 '<a class="mirador-osd-rotate-right hud-control ">',
                                 '<i class="fa fa-3x fa-rotate-right "></i>',    // Rotate right icon
                                 '</a>',
                                 '</a>',
                                 '</div>'
    ].join(''))

  };

}(Mirador));

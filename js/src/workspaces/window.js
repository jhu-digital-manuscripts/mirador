(function($) {

  $.Window = function(options) {

    jQuery.extend(this, {
      element:           null,
      scrollImageRatio:  0.9,
      manifest:          null,
      currentCanvasID:    null,
      focusImages:       [],
      imagesList:        null,
      annotationsList:   [],
      endpoint:          null,
      slotAddress:     null,
      currentImageMode:  'ImageView',
      imageModes:        ['ImageView', 'BookView'],
      currentFocus:      'ThumbnailsView',
      focusesOriginal:   ['ThumbnailsView', 'ImageView', 'ScrollView', 'BookView'],
      focuses:           ['ThumbnailsView', 'ImageView', 'ScrollView', 'BookView'],
      focusModules:           {'ThumbnailsView': null, 'ImageView': null, 'ScrollView': null, 'BookView': null},
      focusOverlaysAvailable: {
        'ThumbnailsView': {
          'overlay' : {'MetadataView' : false},
          'sidePanel' : {'SidePanel' : false},
          'bottomPanel' : {'' : false},
        },
        'ImageView': {
          'overlay' : {'MetadataView' : false},
          'sidePanel' : {'SidePanel' : false},
          'bottomPanel' : {'ThumbnailsView' : true},
        },
        'ScrollView': {
          'overlay' : {'MetadataView' : false},
          'sidePanel' : {'TableOfContents' : false},
          'bottomPanel' : {'' : false},
        },
        'BookView': {
          'overlay' : {'MetadataView' : false},
          'sidePanel' : {'SidePanel' : false},
          'bottomPanel' : {'ThumbnailsView' : true},
        }
      },
      focusOptions: null,
      id : null,
      sidePanel: null, //the actual module for the side panel
      sidePanelAvailable: true,
      sidePanelOptions: {
        "toc" : true,
        "annotations" : true,
        "search" : true,
      },
      sidePanelVisible: false,
      annotationsAvailable: {
        'ThumbnailsView' : false,
        'ImageView' : true,
        'ScrollView' : false,
        'BookView' : false
      },
      bottomPanel: null, //the actual module for the bottom panel
      bottomPanelAvailable: true,
      bottomPanelVisible: true,
      overlay: null,
      annotationLayerAvailable: true,
      annotationCreationAvailable: true,
      annoEndpointAvailable : false,
      annotationState : 'annoOff',
      fullScreenAvailable : true,
      displayLayout: true,
      layoutOptions : {
        "newObject" : false,
        "close" : false,
        "slotRight" : true,
        "slotLeft" : true,
        "slotAbove" : true,
        "slotBelow" : true
      },
      searchWidget: null,
      searchWidgetVisible: false,
      pinned: false
    }, options);

    this.init();
    this.bindAnnotationEvents();

  };

  $.Window.prototype = {
    init: function () {
      var _this = this,
      manifest = _this.manifest.jsonLd,
      focusState = _this.currentFocus,
      templateData = {};

      //make sure annotations list is cleared out when changing objects within window
      while(_this.annotationsList.length > 0) {
        _this.annotationsList.pop();
      }
      //unsubscribe from stale events as they will be updated with new module calls
      jQuery.unsubscribe(('currentCanvasIDUpdated.' + _this.id));

      _this.removeBookView();

      //remove any imageModes that are not available as a focus
      this.imageModes = jQuery.map(this.imageModes, function(value, index) {
        if (jQuery.inArray(value, _this.focuses) === -1) return null;
        return value;
      });

      _this.imagesList = _this.manifest.getCanvases();
      if (!_this.currentCanvasID) {
        _this.currentCanvasID = _this.imagesList[0]['@id'];
      }

      this.annoEndpointAvailable = !jQuery.isEmptyObject($.viewer.annotationEndpoint);
      if (!this.annotationLayerAvailable) {
        this.annotationCreationAvailable = false;
        this.annoEndpointAvailable = false;
        this.annotationState = 'annoOff';
      }
      _this.getAnnotations();

      //check config
      if (typeof this.bottomPanelAvailable !== 'undefined' && !this.bottomPanelAvailable) {
        jQuery.each(this.focusOverlaysAvailable, function(key, value) {
          _this.focusOverlaysAvailable[key].bottomPanel = {'' : false};
        });
      }

      templateData.sidePanel = this.sidePanelAvailable;
      if (this.sidePanelAvailable) {
        templateData.sidePanel = !Object.keys(this.sidePanelOptions).every(function(element, index, array) {
          return _this.sidePanelOptions[element] === false;
        });
      }
      if (typeof this.overlayAvailable !== 'undefined' && !this.overlayAvailable) {
        jQuery.each(this.focusOverlaysAvailable, function(key, value) {
          _this.focusOverlaysAvailable[key].overlay = {'' : false};
        });
      } else {
        templateData.MetadataView = true;
      }

      if (typeof this.searchWidgetAvailable !== 'undefined' && !this.searchWidgetAvailable) {
        // Set the 'searchWidget' overlay not available in all views
        jQuery.each(this.focusOverlaysAvailable, function(key, value) {
          _this.focusOverlaysAvailable[key].overlay = {'': false};
        });
        templateData.searchPanel = false;
      } else {
        templateData.searchPanel = true;
      }

      //determine if any buttons should be hidden in template
      jQuery.each(this.focuses, function(index, value) {
        templateData[value] = true;
      });
      templateData.title = manifest.label;
      templateData.displayLayout = this.displayLayout;
      templateData.layoutOptions = this.layoutOptions;
      // if displayLayout is true,  but all individual options are set to false, set displayLayout to false
      if (this.displayLayout) {
        templateData.displayLayout = !Object.keys(this.layoutOptions).every(function(element, index, array) {
          return _this.layoutOptions[element] === false;
        });
      }

      _this.element = jQuery(this.template(templateData)).appendTo(_this.appendTo);

      //clear any existing objects
      _this.clearViews();
      _this.clearPanelsAndOverlay();

      //attach view and toggle view, which triggers the attachment of panels or overlays
      _this.bindNavigation();
      switch(focusState) {
        case 'ThumbnailsView':
          _this.toggleThumbnails(_this.currentCanvasID);
        break;
        case 'ImageView':
          _this.toggleImageView(_this.currentCanvasID);
        break;
        case 'BookView':
          _this.toggleBookView(_this.currentCanvasID);
        break;
        case 'ScrollView':
          _this.toggleScrollView(_this.currentCanvasID);
        break;
        default:
          break;
      }

      if ($.viewer.workspace.slots.length <= 1) {
        _this.element.find('.remove-object-option').hide();
        _this.element.find('.mirador-icon-close').hide();
      }

      this.bindEvents();

      if (this.imagesList.length === 1) {
        this.bottomPanelVisibility(false);
      } else {
        this.bottomPanelVisibility(this.bottomPanelVisible);
      }

      if (this.sidePanelVisible) {
        jQuery.publish('sidePanelToggled.' + _this.id);
        this.sidePanelVisibility(this.sidePanelVisible, '0s');
      }

      if (this.pinned) {
        this.pinned = !this.pinned;   // ugh...
        this.togglePinWindow();
      }
    },

    update: function(options) {
      jQuery.extend(this, options);
      if (this.focusOptions) {
        this.focusOptions.osdBounds = null;
        this.focusOptions.zoomLevel = null;
      }
      this.init();
    },

    // spawnInWorkspace: function() {

    // },

    // reset whether BookView is available every time as a user might switch between paged and non-paged objects within a single slot/window
    removeBookView: function() {
      var _this = this;
      this.focuses = this.focusesOriginal;
      var manifest = this.manifest.jsonLd;
      if (manifest.sequences[0].viewingHint) {
        if (manifest.sequences[0].viewingHint.toLowerCase() !== 'paged') {
          //disable bookview for this object because it's not a paged object
          this.focuses = jQuery.grep(this.focuses, function(value) {
            return value !== 'BookView';
          });
        }
      }
    },

    bindEvents: function() {
      var _this = this;

      //this event should trigger from layout
      jQuery(window).resize($.debounce(function(){
        if (_this.focusModules.ScrollView) {
          var containerHeight = _this.element.find('.view-container').height();
          var triggerShow = false;
          if (_this.currentFocus === "ScrollView") {
            triggerShow = true;
          }
          _this.focusModules.ScrollView.reloadImages(Math.floor(containerHeight * _this.scrollImageRatio), triggerShow);
        }
      }, 300));

      jQuery.subscribe('bottomPanelSet.' + _this.id, function(event, visible) {
        var panel = _this.element.find('.bottomPanel');
        if (visible === true) {
          panel.css({transform: 'translateY(0)'});
        } else {
          panel.css({transform: 'translateY(100%)'});
        }
      });

      jQuery.subscribe('layoutChanged', function(event, layoutRoot) {
        if ($.viewer.workspace.slots.length <= 1) {
          _this.element.find('.remove-object-option').hide();
          _this.element.find('.mirador-icon-close').hide();
        } else if (!_this.pinned) {
          _this.element.find('.remove-object-option').show();
          _this.element.find('.mirador-icon-close').show();
        }
      });

      jQuery.subscribe('sidePanelStateUpdated.' + this.id, function(event, state) {
        if (state.open) {
            _this.element.find('.fa-bars').switchClass('fa-bars', 'fa-caret-down');
            _this.element.find('.mirador-icon-toc').addClass('selected');
            _this.element.find('.view-container').removeClass('maximised');
        } else {
            _this.element.find('.mirador-icon-toc').removeClass('selected');
            _this.element.find('.fa-caret-down').switchClass('fa-caret-down', 'fa-bars');
            _this.element.find('.view-container').addClass('maximised');
        }
    });

      // TODO: temporary logic to minimize side panel if only tab is toc and toc is empty
      jQuery.subscribe('sidePanelVisibilityByTab.' + this.id, function(event, visible) {
        _this.sidePanelVisibility(visible, '0s');
      });

    },

    bindAnnotationEvents: function() {
      var _this = this;

      jQuery.subscribe("requestAnnotationLists." + _this.id, function(event, data) {
        _this.annotationsList.length = 0;
        // calling #getAnnotations() will publish events: annotationListLoaded.<windowId>
        if (Array.isArray(data.requests)) {
          data.requests.forEach(function(req) { _this.getAnnotations(req); });
        } else if (typeof data.requests === 'string') {
          _this.getAnnotations(data.requests);
        }
        // If data.requests is a non-string/non-array object, do nothing
      });

      jQuery.subscribe('annotationCreated.'+_this.id, function(event, oaAnno, osdOverlay) {
        var annoID;
        //first function is success callback, second is error callback
        _this.endpoint.create(oaAnno, function(data) {
          //the success callback expects the OA annotation be returned
          annoID = String(data['@id']); //just in case it returns a number
          _this.annotationsList.push(data);
          //update overlay so it can be a part of the annotationList rendering
          jQuery(osdOverlay).removeClass('osd-select-rectangle').addClass('annotation').attr('id', annoID);
          jQuery.publish(('annotationListLoaded.' + _this.id));
        },
        function() {
          //provide useful feedback to user
          console.log("There was an error saving this new annotation");
          //remove this overlay because we couldn't save annotation
          jQuery(osdOverlay).remove();
        });
      });

      jQuery.subscribe('annotationUpdated.'+_this.id, function(event, oaAnno) {
        //first function is success callback, second is error callback
        _this.endpoint.update(oaAnno, function() {
          jQuery.each(_this.annotationsList, function(index, value) {
            if (value['@id'] === oaAnno['@id']) {
              _this.annotationsList[index] = oaAnno;
              return false;
            }
          });
          jQuery.publish(('annotationListLoaded.' + _this.id));
        },
        function() {
          console.log("There was an error updating this annotation");
        });
      });

      jQuery.subscribe('annotationDeleted.'+_this.id, function(event, annoId) {
        //remove from endpoint
        //first function is success callback, second is error callback
        _this.endpoint.deleteAnnotation(annoId, function() {
          _this.annotationsList = jQuery.grep(_this.annotationsList, function(e){ return e['@id'] !== annoId; });
          jQuery.publish(('annotationListLoaded.' + _this.id));
          jQuery.publish(('removeOverlay.' + _this.id), annoId);
        },
        function() {
          // console.log("There was an error deleting this annotation");
        });
      });

      jQuery.subscribe('updateAnnotationList.'+_this.id, function(event) {
        while(_this.annotationsList.length > 0) {
          _this.annotationsList.pop();
        }
        _this.getAnnotations();
      });
    },

    clearViews: function() {
      var _this = this;
      jQuery.each(_this.focusModules, function(key, value) {
        _this.focusModules[key] = null;
      });
    },

    clearPanelsAndOverlay: function() {
      this.sidePanel = null;
      this.bottomPanel = null;
      this.overlay = null;
      this.searchWidget = null;
    },

    // only panels and overlay available to this view, make rest hidden while on this view
    updatePanelsAndOverlay: function(state) {
      var _this = this;

      jQuery.each(this.focusOverlaysAvailable[state], function(panelType, viewOptions) {
        jQuery.each(viewOptions, function(view, displayed) {
          //instantiate any panels that exist for this view but are still null
          if (view !== '' && _this[panelType] === null) {
            _this[panelType] = new $[view]({
              manifest: _this.manifest,
              appendTo: _this.element.find('.'+panelType),
              parent: _this,
              panel: true,
              canvasID: _this.currentCanvasID,
              imagesList: _this.imagesList,
              searchContext: _this.searchContext,
              selectedResult: _this.selectedResult,
              pinned: _this.pinned,
              thumbInfo: {thumbsHeight: 80, listingCssCls: 'panel-listing-thumbs', thumbnailCls: 'panel-thumbnail-view'}
            });
          }

          //refresh displayed in case SidePanel module changed it
          displayed = _this.focusOverlaysAvailable[state][panelType][view];

          //toggle any valid panels
          if (view !== '' && displayed) {
            _this.togglePanels(panelType, displayed, view, state);
          }

          //hide any panels instantiated but not available to this view
          if (view === '' && _this[panelType]) {
            _this.togglePanels(panelType, displayed, view, state);
          }

          //lastly, adjust height for non-existent panels
          if (view === '') {
            _this.adjustFocusSize(panelType, displayed);
          }

          //update current image for all valid panels
        });
      });

      //update panels with current image
      if (this.bottomPanel) { this.bottomPanel.updateFocusImages(this.focusImages); }
    },

    updateSidePanel: function() {
      if (!this.sidePanelAvailable) {
        return;
      }
      var _this = this,
      tocAvailable = _this.sidePanelOptions.toc,
      annotationsTabAvailable = _this.sidePanelOptions.annotations,
      searchAvailable = _this.sidePanelOptions.search,
      hasStructures = true;

      var structures = _this.manifest.getStructures();
      if (!structures || structures.length === 0) {
        hasStructures = false;
      }

      if (this.sidePanel === null) {
        this.sidePanel = new $.SidePanel({
              parent: _this,
              appendTo: _this.element.find('.sidePanel'),
              manifest: _this.manifest,
              canvasID: _this.currentCanvasID,
              tocTabAvailable: tocAvailable,
              annotationsTabAvailable: annotationsTabAvailable,
              searchAvailable: searchAvailable,
              hasStructures: hasStructures,
              visible: _this.sidePanelVisible,
              pinned: _this.pinned
        });
      } else {
        this.sidePanel.update('annotations', annotationsTabAvailable);
      }
    },

    get: function(prop, parent) {
      if (parent) {
        return this[parent][prop];
      }
      return this[prop];
    },

    set: function(prop, value, options) {
      if (options) {
        this[options.parent][prop] = value;
      } else {
        this[prop] = value;
      }
    },

    /*setTOCBoolean: function(boolValue) {
      var _this = this;
      jQuery.each(this.focusOverlaysAvailable, function(key, value) {
        _this.focusOverlaysAvailable[key].sidePanel.SidePanel = boolValue;
      });
      //remove thumbnail icon if not available for this object
      if (!boolValue) {
        this.element.find('.mirador-icon-toc').hide();
      }
    },*/

    togglePanels: function(panelType, panelState, viewType, focusState) {
      //update state in focusOverlaysAvailable
      this.focusOverlaysAvailable[focusState][panelType][viewType] = panelState;
      this[panelType].toggle(panelState);
      this.adjustFocusSize(panelType, panelState);
    },

    sidePanelVisibility: function(visible, transitionDuration) {
      var _this = this,
          width = 330,
          tocIconElement = this.element.find('.mirador-icon-toc'),
          sidePanelElement = this.element.find('.sidePanel'),
          viewContainerElement = this.element.find('.view-container'),
          sidePanelMinimized = sidePanelElement.hasClass('minimized');

      _this.sidePanelVisible = visible;

      if (transitionDuration) {
        sidePanelElement.css('transition-duration', transitionDuration);
        viewContainerElement.css('transition', transitionDuration);
      }

      if (visible && sidePanelMinimized) {
        tocIconElement.find('.fa-bars').switchClass('fa-bars', 'fa-caret-down');
        sidePanelElement.removeClass('minimized').width(width).css('border-right', '1px solid lightgray');
        viewContainerElement.css('margin-right', width);
      } else if (!visible && !sidePanelMinimized) {
        tocIconElement.find('.fa-caret-down').switchClass('fa-caret-down', 'fa-bars');
        viewContainerElement.css('margin-right', 0);
        sidePanelElement.addClass('minimized').css('border', 'none').width(0);
      }
      jQuery.publish(('windowUpdated'), {
        id: _this.id,
        sidePanelVisible: visible
      });
    },

    bottomPanelVisibility: function(visible) {
      var _this = this;
      _this.bottomPanelVisible = visible;
      jQuery.publish(('bottomPanelSet.' + _this.id), visible);
      jQuery.publish(('windowUpdated'), {
        id: _this.id,
        bottomPanelVisible: visible
      });
    },
    adjustFocusSize: function(panelType, panelState) {
      if (panelType === 'bottomPanel') {
        this.focusModules[this.currentFocus].adjustHeight('focus-max-height', panelState);
      } else if (panelType === 'sidePanel') {
        this.focusModules[this.currentFocus].adjustWidth('focus-max-width', panelState);
      } else if (panelType === 'searchWidget') {

      }
    },

    toggleMetadataOverlay: function(focusState) {
      var _this = this;
      //returns boolean, true or false
      var currentState = this.focusOverlaysAvailable[focusState].overlay.MetadataView;
      if (currentState) {
        this.element.find('.mirador-icon-metadata-view').removeClass('selected');
      } else {
        this.element.find('.mirador-icon-metadata-view').addClass('selected');
      }
      //set overlay for all focus types to same value
      jQuery.each(this.focusOverlaysAvailable, function(focusType, options) {
        if (focusState !== focusType) {
          this.overlay.MetadataView = !currentState;
        }
      });
      // and then do toggling for current focus
      this.togglePanels('overlay', !currentState, 'MetadataView', focusState);
    },

    toggleFocus: function(focusState, imageMode) {
      var _this = this;

      this.currentFocus = focusState;
      if (imageMode && jQuery.inArray(imageMode, this.imageModes) > -1) {
        this.currentImageMode = imageMode;
      }
      //set other focusStates to false (toggle to display none)
      jQuery.each(this.focusModules, function(focusKey, module) {
        if (module && focusState !== focusKey) {
          module.toggle(false);
        }
      });
      this.focusModules[focusState].toggle(true);
      this.updateManifestInfo();
      this.updatePanelsAndOverlay(focusState);
      this.updateSidePanel();
      jQuery.publish("focusUpdated");
      jQuery.publish("windowUpdated", {
        id: _this.id,
        viewType: _this.currentFocus,
        canvasID: _this.currentCanvasID,
        imageMode: _this.currentImageMode,
        loadedManifest: _this.manifest.jsonLd['@id'],
        slotAddress: _this.slotAddress
      });
    },

    toggleThumbnails: function(canvasID) {
      this.currentCanvasID = canvasID;
      if (this.focusModules.ThumbnailsView === null) {
        this.focusModules.ThumbnailsView = new $.ThumbnailsView({
          manifest: this.manifest,
          appendTo: this.element.find('.view-container'),
          parent: this,
          canvasID: this.currentCanvasID,
          imagesList: this.imagesList
        });
      } else {
        var view = this.focusModules.ThumbnailsView;
        view.updateImage(canvasID);
      }
      this.toggleFocus('ThumbnailsView', '');
    },

    toggleImageView: function(canvasID) {
      this.currentCanvasID = canvasID;
      if (this.focusModules.ImageView === null) {
        this.focusModules.ImageView = new $.ImageView({
          manifest: this.manifest,
          appendTo: this.element.find('.view-container'),
          parent: this,
          windowId: this.id,
          canvasID: canvasID,
          imagesList: this.imagesList,
          osdOptions: this.focusOptions,
          bottomPanelAvailable: this.bottomPanelAvailable,
          annotationLayerAvailable: this.annotationLayerAvailable,
          annotationCreationAvailable: this.annotationCreationAvailable,
          annoEndpointAvailable: this.annoEndpointAvailable,
          annotationState : this.annotationState,
          fullScreenAvailable: this.fullScreenAvailable,
          editorPanelConfig: this.editorPanelConfig
        });
      } else {
        var view = this.focusModules.ImageView;
        view.updateImage(canvasID);
      }
      this.toggleFocus('ImageView', 'ImageView');
    },

    toggleBookView: function(canvasID) {
      this.currentCanvasID = canvasID;
      if (this.focusModules.BookView === null) {
        this.focusModules.BookView = new $.BookView({
          manifest: this.manifest,
          appendTo: this.element.find('.view-container'),
          parent: this,
          windowId: this.id,
          canvasID: canvasID,
          imagesList: this.imagesList,
          osdOptions: this.focusOptions,
          bottomPanelAvailable: this.bottomPanelAvailable,
          fullScreenAvailable: this.fullScreenAvailable
        });
      } else {
        var view = this.focusModules.BookView;
        view.updateImage(canvasID);
      }
      this.toggleFocus('BookView', 'BookView');
    },

    toggleScrollView: function(canvasID) {
      this.currentCanvasID = canvasID;
      if (this.focusModules.ScrollView === null) {
        var containerHeight = this.element.find('.view-container').height();
        this.focusModules.ScrollView = new $.ScrollView({
          manifest: this.manifest,
          appendTo: this.element.find('.view-container'),
          parent: this,
          canvasID: this.currentCanvasID,
          imagesList: this.imagesList,
          thumbInfo: {thumbsHeight: Math.floor(containerHeight * this.scrollImageRatio), listingCssCls: 'scroll-listing-thumbs', thumbnailCls: 'scroll-view'}
        });
      } else {
        var view = this.focusModules.ScrollView;
        view.updateImage(canvasID);
      }
      this.toggleFocus('ScrollView', '');
    },

    updateFocusImages: function(imageList) {
      this.focusImages = imageList;
    },

    setCurrentCanvasID: function(canvasID) {
      var _this = this;
      this.currentCanvasID = canvasID;
      jQuery.publish('removeTooltips.' + _this.id);
      // jQuery.unsubscribe(('annotationListLoaded.' + _this.id));
      while(_this.annotationsList.length > 0) {
        _this.annotationsList.pop();
      }
      this.getAnnotations();

      switch(this.currentImageMode) {
        case 'ImageView':
          this.toggleImageView(this.currentCanvasID);
        break;
        case 'BookView':
          this.toggleBookView(this.currentCanvasID);
        break;
        default:
          break;
      }
console.log('[Window] setting canvas ID -> ' + canvasID);
      jQuery.publish(('currentCanvasIDUpdated.' + _this.id), canvasID);
    },

    replaceWindow: function(newSlotAddress, newElement) {
      this.slotAddress = newSlotAddress;
      this.appendTo = newElement;
      this.update();
    },

    setCursorFrameStart: function(canvasID) {
    },

    updateManifestInfo: function() {
      var _this = this;

      // Determine whether or not the search panel was open. If so, its
      // icon must remain selected after this update.
      var searchIcon = this.element.find('.mirador-icon-search-within');
      var searchSelected = searchIcon.hasClass('selected');

      this.element.find('.window-manifest-navigation').children().removeClass('selected');
      if (searchSelected) {
        searchIcon.addClass('selected');
      }
      switch(_this.currentFocus) {
        case 'ThumbnailsView':
          //hide thumbnails button and highlight currentImageMode?
          _this.element.find('.mirador-icon-thumbs-view').addClass('selected');
        break;
        case 'ImageView':
          //highlight Single Image View option
          _this.element.find('.mirador-icon-image-view').addClass('selected');
        break;
        case 'BookView':
          //highlight Book View option
          _this.element.find('.mirador-icon-image-view').addClass('selected');
        break;
        case 'ScrollView':
          //highlight Scroll View option
          _this.element.find('.mirador-icon-thumbs-view').addClass('selected');
        break;
        default:
          break;
      }

      if (this.focusOverlaysAvailable[this.currentFocus].overlay.MetadataView) {
        this.element.find('.mirador-icon-metadata-view').addClass('selected');
      }
    },

    /*
       Merge all annotations for current image/canvas from various sources
       Pass to any widgets that will use this list
       */
    getAnnotations: function(canvasId) {
      //first look for manifest annotations
      if (!canvasId || canvasId.length === 0) {
        canvasId = this.currentCanvasID;
      }

      var _this = this,
          url = _this.manifest.getAnnotationsListUrl(canvasId);

      if (url !== false) {
        jQuery.get(url, function(list) {
          _this.annotationsList = _this.annotationsList.concat(list.resources);
          jQuery.each(_this.annotationsList, function(index, value) {
            // if there is no ID for this annotation, set a random one
            if (typeof value['@id'] === 'undefined') {
              value['@id'] = $.genUUID();
            }
            // indicate this is a manifest annotation - which affects the UI
            value.endpoint = "manifest";
          });
          jQuery.publish('annotationListLoaded.' + _this.id,
              {
                "annotations": _this.annotationsList,
                "canvas": _this.manifest.getCanvasLabel(canvasId)
              }
          );
        });
      }

      // next check endpoint
      if (this.annoEndpointAvailable) {
        var dfd = jQuery.Deferred(),
        module = $.viewer.annotationEndpoint.module,
        options = $.viewer.annotationEndpoint.options; //grab anything from the config that should be passed directly to the endpoint
        options.name = $.viewer.annotationEndpoint.name;
        // One annotation endpoint per window, the endpoint
        // is a property of the whole app instance.
        if ( _this.endpoint && _this.endpoint !== null ) {
          _this.endpoint.set('dfd', dfd);
        } else {
          options.dfd = dfd;
          options.windowID = _this.id;
          options.parent = _this;
          _this.endpoint = new $[module](options);
          _this.endpoint.name = name;
        }
        _this.endpoint.search({ "uri" : _this.currentCanvasID});

        dfd.done(function(loaded) {
          _this.annotationsList = _this.annotationsList.concat(_this.endpoint.annotationsList);
          // clear out some bad data
          _this.annotationsList = jQuery.grep(_this.annotationsList, function (value, index) {
            if (typeof value.on === "undefined") {
              return false;
            }
            return true;
          });

          jQuery.each( _this.annotationsList, function( key, value ) {
            if(jQuery.isArray(value.resource)){
              _this.annotationsList[key].resource = value.resource[0];
            }
          });
          jQuery.publish('annotationListLoaded.' + _this.id);
        });
      }
    },

    // based on currentFocus
    bindNavigation: function() {
      var _this = this;

      this.element.find('.mirador-icon-image-view').on('mouseenter',
        function() {
        _this.element.find('.image-list').stop().slideFadeToggle(300);
      })
      .on('mouseleave', function() {
        _this.element.find('.image-list').stop().slideFadeToggle(300);
      });

      this.element.find('.mirador-icon-window-menu').on('mouseenter',
        function() {
        _this.element.find('.slot-controls').stop().slideFadeToggle(300);
      })
      .on('mouseleave', function() {
        _this.element.find('.slot-controls').stop().slideFadeToggle(300);
      });

      this.element.find('.single-image-option').on('click', function() {
        _this.toggleImageView(_this.currentCanvasID);
      });

      this.element.find('.book-option').on('click', function() {
        _this.toggleBookView(_this.currentCanvasID);
      });

      this.element.find('.scroll-option').on('click', function() {
        _this.toggleScrollView(_this.currentCanvasID);
      });

      this.element.find('.thumbnails-option').on('click', function() {
        _this.toggleThumbnails(_this.currentCanvasID);
      });

      this.element.find('.mirador-icon-metadata-view').on('click', function() {
        _this.toggleMetadataOverlay(_this.currentFocus);
      });

      this.element.find('.mirador-icon-toc').on('click', function() {
        jQuery.publish('sidePanelToggled.' + _this.id);
        _this.sidePanelVisibility(!_this.sidePanelVisible, '0.3s');
      });

      this.element.find('.new-object-option').on('click', function() {
        if (!_this.pinned) {
          _this.parent.addItem();
        }
      });

      this.element.find('.remove-object-option').on('click', function() {
        $.viewer.workspace.removeNode(_this.parent);
      });

      this.element.find('.add-slot-right').on('click', function() {
        $.viewer.workspace.splitRight(_this.parent);
      });

      this.element.find('.add-slot-left').on('click', function() {
        $.viewer.workspace.splitLeft(_this.parent);
      });

      this.element.find('.add-slot-below').on('click', function() {
        $.viewer.workspace.splitDown(_this.parent);
      });

      this.element.find('.add-slot-above').on('click', function() {
        $.viewer.workspace.splitUp(_this.parent);
      });

      this.element.find('.mirador-icon-home').on('click', function() {
        if (!_this.pinned) {
          _this.parent.addItem();
        }
      });

      this.element.find('.mirador-icon-pin-window').on('click', function() {
        _this.togglePinWindow();
      });

      this.element.find('.mirador-icon-close').on('click', function() {
        $.viewer.workspace.removeNode(_this.parent);
      });
    },

    togglePinWindow: function() {
      var removeOptionEl = this.element.find('.remove-object-option');
      var pinOptionEl = this.element.find('.mirador-icon-pin-window');
      var closeBtnEl = this.element.find('.mirador-icon-close');

      this.pinned = !this.pinned;
      this.element.find('.slot-controls').removeAttr('height');

      if (this.pinned) {
        pinOptionEl.addClass('selected');
        pinOptionEl.attr('title', 'Unpin this window');
        removeOptionEl.hide();
        closeBtnEl.hide();
      } else {
        pinOptionEl.removeClass('selected');
        pinOptionEl.attr('title', 'Pin this window');
        if ($.viewer.workspace.slots.length > 1) {
          removeOptionEl.show();
          closeBtnEl.show();
        }
      }

      jQuery.publish('windowPinned', { "windowId": this.id, "status": this.pinned });
    },

    // template should be based on workspace type
    template: Handlebars.compile([
     '<div class="window">',
      '<div class="manifest-info">',
        '<div class="window-manifest-navigation">',
          '{{#if sidePanel}}',
            '<a href="javascript:;" class="mirador-btn mirador-icon-toc" title="View Transcriptions & Search"><i class="fa fa-bars fa-lg fa-fw"></i></a>',
          '{{/if}}',
          '<a href="javascript:;" class="mirador-btn mirador-icon-image-view" role="button" aria-label="Change Image Mode">',
            '<i class="fa fa-photo fa-lg fa-fw"></i>',
            '<i class="fa fa-chevron-down"></i>',
            '<ul class="dropdown image-list">',
              '{{#if ImageView}}',
                '<li class="single-image-option"><i class="fa fa-photo fa-lg fa-fw"></i> {{t "imageView"}}</li>',
              '{{/if}}',
              '{{#if BookView}}',
                '<li class="book-option"><i class="fa fa-columns fa-lg fa-fw"></i> {{t "bookView"}}</li>',
              '{{/if}}',
              '{{#if ScrollView}}',
                '<li class="scroll-option"><i class="fa fa-ellipsis-h fa-lg fa-fw"></i> {{t "scrollView"}}</li>',
              '{{/if}}',
            '</ul>',
          '</a>',
          '{{#if ThumbnailsView}}',
            '<a href="javascript:;" class="mirador-btn mirador-icon-thumbs-view thumbnails-option" role="button" aria-label="Change to Thumbnails Mode"><i class="fa fa-th fa-lg fa-rotate-90 fa-fw"></i>',
            '</a>',
          '{{/if}}',
          '{{#if MetadataView}}',
            '<a href="javascript:;" class="mirador-btn mirador-icon-metadata-view" title="{{t "objectMetadata"}}" role="button" aria-label="View Information/Metadata about Object"><i class="fa fa-info-circle fa-lg fa-fw"></i></a>',
          '{{/if}}',
        '</div>',
        // '<div class="layout-controls">',
          '<a href="javascript:;" class="mirador-btn mirador-icon-close" title="Close window">',
            '<i class="fa fa-fw fa-2x fa-times"></i>',
          '</a>',
          '{{#if displayLayout}}',
            // '<a href="javascript:;" class="mirador-btn mirador-icon-window-menu" title="{{t "changeLayout"}}">',
            '<a href="javascript:;" class="mirador-btn mirador-icon-window-menu" title="Add slot">',
              '<i class="fa fa-th-large fa-2x fa-fw"></i>',
              '<i class="fa fa-chevron-down fa-lg"></i>',
              '<ul class="dropdown slot-controls">',
                '{{#if layoutOptions.newObject}}',
                  '<li class="new-object-option"><i class="fa fa-plus-square fa-lg fa-fw"></i> {{t "newObject"}}</li>',
                '{{/if}}',
                '{{#if layoutOptions.close}}',
                  '<li class="remove-object-option"><i class="fa fa-times fa-lg fa-fw"></i> {{t "close"}}</li>',
                '{{/if}}',
                '{{#if layoutOptions.slotRight}}',
                  '<li class="add-slot-right"><i class="fa fa-caret-square-o-right fa-lg fa-fw"></i> {{t "addSlotRight"}}</li>',
                '{{/if}}',
                '{{#if layoutOptions.slotLeft}}',
                  '<li class="add-slot-left"><i class="fa fa-caret-square-o-left fa-lg fa-fw"></i> {{t "addSlotLeft"}}</li>',
                '{{/if}}',
                '{{#if layoutOptions.slotAbove}}',
                  '<li class="add-slot-above"><i class="fa fa-caret-square-o-up fa-lg fa-fw"></i> {{t "addSlotAbove"}}</li>',
                '{{/if}}',
                '{{#if layoutOptions.slotBelow}}',
                  '<li class="add-slot-below"><i class="fa fa-caret-square-o-down fa-lg fa-fw"></i> {{t "addSlotBelow"}}</li>',
                '{{/if}}',
              '</ul>',
            '</a>',
            '<a href="javascript:;" class="mirador-btn mirador-icon-home" title="Open book gallery"><i class="fa fa-home fa-2x fa-fw"></i></a>',
            '<a href="javascript:;" class="mirador-btn mirador-icon-pin-window" title="Pin this window"><i class="fa fa-2x fa-fw fa-thumb-tack"></i></a>',
          // '</div>',
        '{{/if}}',
        // ----- Search within widget -----
        '{{#if searchPanel}}',
          '<div class="searchWidget"></div>',
        '{{/if}}',
        '<h3 class="window-manifest-title">{{title}}</h3>',
        '</div>',
        '<div class="content-container">',
          '{{#if sidePanel}}',
            '<div class="sidePanel minimized">',
            '</div>',
          '{{/if}}',
          '<div class="overlay"></div>',
          '<div class="view-container {{#unless sidePanel}}focus-max-width{{/unless}}">',
            '<div class="bottomPanel"></div>',
          '</div>',
        '</div>',
      '</div>'
    ].join(''))
  };

}(Mirador));

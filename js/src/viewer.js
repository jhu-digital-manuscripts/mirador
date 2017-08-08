/**
 * Event:
 *  - "manifestQueued" : published when a manifest is first encountered
 *                      currently subscribed in SaveController and Workspace
 *  - "manifestReceived" : published when data for any manifest is retrieved.
 *                      currently subscribed here and ManifestsPanel and Slot
 *      Really, the only time we NEED the full manifest data is when one has
 *      been selected for viewing. A new slot will be spawned and a window
 *      created and populated with data from the manifest and child canvases.
 */
(function($) {

  $.Viewer = function(options) {
    jQuery.extend(true, this, {
      id:                     null,
      data:                   null,
      element:                null,
      canvas:                 null,
      workspaceType:          null,
      layout:                 null,
      workspace:              null,
      mainMenu:               null,
      workspaceAutoSave:      null,
      windowSize:             {},
      resizeRatio:            {},
      currentWorkspaceVisible: true,
      state:                  null,
      eventEmitter:           null,
      overlayStates:          {
        'workspacePanelVisible': false,
        'manifestsPanelVisible': false,
        'optionsPanelVisible': false,
        'bookmarkPanelVisible': false
      },
      manifests:             [],
      searchController:      null,
    }, options);

    this.id = this.state.getStateProperty('id');
    this.data = this.state.getStateProperty('data');
    // get initial manifests
    this.element = this.element || jQuery('#' + this.id);
    if (options.availableAnnotationDrawingTools && options.availableAnnotationDrawingTools.length > 0) {
      this.availableAnnotationDrawingTools = options.availableAnnotationDrawingTools;
    }

    if (this.data) {
      this.init();
    }

    if (!this.searchController) {
      this.searchController = new $.SearchController({
        "eventEmitter": this.eventEmitter
      });
    }
  };

  $.Viewer.prototype = {

    init: function() {
      var _this = this;

      //initialize i18next
      i18n.init({
        fallbackLng: 'en',
        load: 'unspecific',
        debug: false,
        getAsync: true,
        resGetPath: _this.state.getStateProperty('buildPath') + _this.state.getStateProperty('i18nPath')+'__lng__/__ns__.json'
      }, _this.setupViewer.bind(_this));
      // because this is a callback, we need to bind "_this" to explicitly retain the calling context of this function (the viewer object instance));
    },

    setupViewer: function() {
      var _this = this;
      //add background and positioning information on the root element that is provided in config
      var backgroundImage = _this.state.getStateProperty('buildPath') + _this.state.getStateProperty('imagesPath') + 'debut_dark.png';
      this.element.css('background-color', '#333').css('background-image','url('+backgroundImage+')').css('background-position','left top')
      .css('background-repeat','repeat');

      //register Handlebars helper
      Handlebars.registerHelper('t', function(i18n_key) {
        var result = i18n.t(i18n_key);
        return new Handlebars.SafeString(result);
      });

      //check all buttons in mainMenu.  If they are all set to false, then don't show mainMenu
      var showMainMenu = false;
      jQuery.each(this.state.getStateProperty('mainMenuSettings').buttons, function(key, value) {
        if (value) { showMainMenu = true; }
      });
      // but, mainMenu should be displayed if we have userButtons and/or userLogo defined
      if (this.state.getStateProperty('mainMenuSettings').userButtons && this.state.getStateProperty('mainMenuSettings').userButtons.length > 0) {
        showMainMenu = true;
      }
      if (this.state.getStateProperty('mainMenuSettings').userLogo && !jQuery.isEmptyObject(this.state.getStateProperty('mainMenuSettings').userLogo)) {
        showMainMenu = true;
      }

      //even if all these buttons are available, developer can override and set show to false,
      //in which case, don't show mainMenu at all
      if (this.state.getStateProperty('mainMenuSettings').show === false) {
        showMainMenu = false;
      }

      // add main menu
      if (showMainMenu) {
        this.mainMenu = new $.MainMenu({ appendTo: this.element, state: this.state, eventEmitter: this.eventEmitter });
      }

      // add viewer area
      this.canvas = jQuery('<div/>')
      .addClass('mirador-viewer')
      .appendTo(this.element);

      if (!showMainMenu) {
        this.canvas.css("top", "0px");
      }

      // add workspace configuration
      this.layout = typeof this.state.getStateProperty('layout') !== 'string' ? JSON.stringify(this.state.getStateProperty('layout')) : this.state.getStateProperty('layout');
      this.workspace = new $.Workspace({
        layoutDescription: this.layout.charAt(0) === '{' ? JSON.parse(this.layout) : $.layoutDescriptionFromGridString(this.layout),
        appendTo: this.element.find('.mirador-viewer'),
        state: this.state,
        eventEmitter: this.eventEmitter,
        editorPanelConfig: _this.editorPanelConfig
      });

      this.workspacePanel = new $.WorkspacePanel({
        appendTo: this.element.find('.mirador-viewer'),
        state: this.state,
        eventEmitter: this.eventEmitter
      });

      this.manifestsPanel = new $.ManifestsPanel({ appendTo: this.element.find('.mirador-viewer'), state: this.state, eventEmitter: this.eventEmitter });
      //only instatiate bookmarkPanel if we need it
      if (showMainMenu && this.state.getStateProperty('mainMenuSettings').buttons.bookmark) {
        this.bookmarkPanel = new $.BookmarkPanel({ appendTo: this.element.find('.mirador-viewer'), state: this.state, eventEmitter: this.eventEmitter });
      }

      // set this to be displayed
      this.set('currentWorkspaceVisible', true);

      this.bindEvents();
      this.listenForActions();
      // retrieve manifests
      this.getManifestsData();

      if (this.state.getStateProperty('windowObjects').length === 0 && this.state.getStateProperty('openManifestsPage')) {
        this.workspace.slots[0].addItem();
      }
    },

    listenForActions: function() {
      var _this = this;

      /**
       * data:{
       *        "origin": "ID string of event origin",
       *        "manifestId": "ID of requetsed manifest"
       *      }
       *
       * response:  {
       *              "origin": "ID string of MANIFEST_REQUETSED event origin",
       *              "manifest": {}    // Manifest object
       *            }
       */
      _this.eventEmitter.subscribe("MANIFEST_REQUESTED", function(event, data) {
        var fromHere = _this.manifests.filter(function(man) {
          return man.getId() === data.manifestId;
        });

        if (fromHere.length > 0) {
          _this.eventEmitter.publish("MANIFEST_FOUND", {
            "origin": data.origin,
            "manifest": fromHere[0]
          });
        } else {
          var manifest = new $.Manifest(data.manifestId);
          manifest.request.done(function() {
            _this.manifests.push(manifest);
            _this.eventEmitter.publish("MANIFEST_FOUND", {
              "origin": data.origin,
              "manifest": manifest
            });
          });
        }
      });

      // check that windows are loading first to set state of slot?
      _this.eventEmitter.subscribe('manifestReceived', function(event, newManifest) {
        if (_this.manifests.filter(function(m) { return m.getId() === newManifest.getId(); }).length === 0) {
          _this.manifests.push(newManifest);
        }
        if (_this.state.getStateProperty('windowObjects')) {
          var check = jQuery.grep(_this.state.getStateProperty('windowObjects'), function(object, index) {
            return object.loadedManifest === newManifest.uri;
          });
          jQuery.each(check, function(index, config) {
            _this.loadManifestFromConfig(config);
          });
        }
      });

      _this.eventEmitter.subscribe('TOGGLE_WORKSPACE_PANEL', function(event) {
        _this.toggleWorkspacePanel();
      });

      _this.eventEmitter.subscribe('TOGGLE_BOOKMARK_PANEL', function(event) {
        _this.toggleBookmarkPanel();
      });

      _this.eventEmitter.subscribe('TOGGLE_FULLSCREEN', function(event) {
        if ($.fullscreenElement()) {
          $.exitFullscreen();
          //enable any window-specific fullscreen buttons
          _this.eventEmitter.publish('ENABLE_WINDOW_FULLSCREEN');
        } else {
          $.enterFullscreen(_this.element[0]);
          //disable any window-specific fullscreen buttons
          _this.eventEmitter.publish('DISABLE_WINDOW_FULLSCREEN');
        }
      });

      jQuery(document).on("webkitfullscreenchange mozfullscreenchange fullscreenchange", function() {
        _this.eventEmitter.publish('MAINMENU_FULLSCREEN_BUTTON');
        // in case the user clicked ESC instead of clicking on the toggle fullscreen button, reenable the window fullscreen button
        if (!$.fullscreenElement()) {
          _this.eventEmitter.publish('ENABLE_WINDOW_FULLSCREEN');
        }
      });

      _this.eventEmitter.subscribe('TOGGLE_LOAD_WINDOW', function(event) {
        _this.toggleLoadWindow();
      });

      _this.eventEmitter.subscribe('ADD_MANIFEST_FROM_URL', function(event, url, location) {
        _this.addManifestFromUrl(url, location);
      });

      _this.eventEmitter.subscribe('TOGGLE_OVERLAYS_FALSE', function(event) {
        jQuery.each(_this.overlayStates, function(oState, value) {
          // toggles the other top-level panels closed and focuses the
          // workspace. For instance, after selecting an object from the
          // manifestPanel.
          _this.set(oState, false, {parent: 'overlayStates'});
        });
      });

    },

    bindEvents: function() {
      var _this = this;
    },

    get: function(prop, parent) {
      if (parent) {
        return this[parent][prop];
      }
      return this[prop];
    },

    set: function(prop, value, options) {
      var _this = this;
      if (options) {
        this[options.parent][prop] = value;
      } else {
        this[prop] = value;
      }
      _this.eventEmitter.publish(prop + '.set', value);
    },

    // Sets state of overlays that layer over the UI state
    toggleOverlay: function(state) {
      var _this = this;
      // first confirm all others are off
      jQuery.each(this.overlayStates, function(oState, value) {
        if (state !== oState) {
          _this.set(oState, false, {parent: 'overlayStates'});
        }
      });
      var currentState = this.get(state, 'overlayStates');
      this.set(state, !currentState, {parent: 'overlayStates'});
    },

    toggleLoadWindow: function() {
      this.toggleOverlay('manifestsPanelVisible');
    },

    toggleWorkspacePanel: function() {
      this.toggleOverlay('workspacePanelVisible');
    },

    toggleBookmarkPanel: function() {
      this.toggleOverlay('bookmarkPanelVisible');
    },

    /**
     * Original behavior: Load entire collection tree for all collections
     * specified on Mirador init. Load all manifests specified in init
     * found in any loaded collection.
     *
     * This way of loading IIIF data allows for a very rich browsing
     * experience, but is very slow and demands a fast connection. Propose
     * to not load collection tree, but do not load any manifests until
     * they are opened in a window.
     *
     * One caveat: manifests that are directly referenced in the Mirador
     * init. These should probably be loaded like the current behavior.
     * Otherwise, we will have no data to populate the UI.
     *
     * Use the same syntax in Mirador init to add data.
     *  data: {   // Pick ONE property
     *    "manifestUri": "",
     *    "collectionUri": "",
     *    "manifestContent": { ... }
     *  }
     */
    getManifestsData: function() {
      var _this = this;

      _this.data.forEach(function(manifest) {
        var location = manifest.location ? manifest.location : "";
        if (manifest.hasOwnProperty('manifestContent')) {
          // Full manifest is specified in init data, using property 'manifestContent'
          var content = manifest.manifestContent;
          _this.addManifestFromUrl(content['@id'], location, content);
        } else if (manifest.hasOwnProperty('manifestUri')) {
          // No content found, but manifest ID found in property 'manifestUri'
          _this.addManifestFromUrl(manifest.manifestUri, location, null);
        } else if (manifest.hasOwnProperty('collectionUri')) {
          // No manifest ID or content found, collection ID found
          _this.addCollectionFromUrl(manifest.collectionUri, location, null);
        }
      });
    },

    hasWidgets: function(collection) {
      return (
        typeof collection.widgets !== 'undefined' &&
        collection.widgets &&
        !jQuery.isEmptyObject(collection.widgets) &&
        collection.widgets.length > 0
      );
    },

    /**
     *
     * @param url {string} collection ID
     * @param location {string} (optional) label for current repository
     * @param content {object} (optional) full JSON data, if already known
     * @param depth {number} current depth in collection tree
     * @fires collectionQueued : collection found, starting to load
     * @fires collectionReceived : collection data done loading
     * @fires manifestReferenced : manifest found in collection, not loaded or queued
     */
    addCollectionFromUrl: function(url, location, content, depth) {
      var _this = this;
      var collection;

      if (!this.state.getStateProperty("collections")[url]) {
        collection = new $.Collection(url, location, content);
        this.eventEmitter.publish("collectionQueued", collection, location);

        collection.request.done(function() {
          _this.eventEmitter.publish("collectionReceived", collection);

          // Do stuff with child manifests
          collection.getManifestBlocks().forEach(function(man) {
            // TODO we can load manifest data if this block has no extra metadata
            // but what metric should we use to determine this?
            man.location = location;
            _this.eventEmitter.publish("manifestReferenced", man);
          });

          // Load child collections, provided we don't go too far down the rabbit hole
          if (depth < 4) {
            collection.getCollectionBlocks().forEach(function(col) {
              _this.addCollectionFromUrl(col["@id"], location, null, depth+1);
            });
          }
        }).fail(function(jqXHR, status, error) {
          console.log(jqXHR, status, error);
        });
      }
    },

    /**
     * Load manifest data from a URL. We can decorate it with a location
     * label or provide the manifest data if it has already been loaded.
     *
     * When this request is first made, a 'manifestQueued' event will be
     * triggered. After data has been loaded and otherwise setup, a
     * 'manifestReceived' event will be triggered.
     *
     * @param url resolvable URL ID of the manifest
     * @param location (optional) label for the manifests current repository
     * @param content (optional) manifest JSON data, if already loaded
     * @fires manifestQueued
     * @fires manifestReceived
     */
    addManifestFromUrl: function(url, location, content) {
      var _this = this,
        manifest;

      if (!_this.state.getStateProperty('manifests')[url]) {
        manifest = new $.Manifest(url, location, content);
        _this.eventEmitter.publish('manifestQueued', manifest, location);
        manifest.request.done(function() {
          _this.eventEmitter.publish('manifestReceived', manifest);
        });
      }
    },

    loadManifestFromConfig: function(options) {
      var _this = this;

      //make a copy of options and pass that so we don't get a circular reference
      var windowConfig = jQuery.extend(true, {}, options);
      //delete this old set of options (because they will be replaced by the actions from ADD_WINDOW)
      _this.eventEmitter.publish('DELETE_FROM_CONFIG', options);

      _this.eventEmitter.publish('ADD_WINDOW', windowConfig);
    }
  };

}(Mirador));

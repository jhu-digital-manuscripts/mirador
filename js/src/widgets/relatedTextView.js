(function($) {

  /**
   * This View is intented to display HTML data related to a IIIF Manifest
   * 
   * @param {*} options 
   */
  $.RelatedTextView = function(options) {
    jQuery.extend(this, {
      eventEmitter: null,
      windowId: null,
      element: null,
      appendTo: null,
      manifest: null,
      state: null,
      CETEI: null,
      teiUtil: null
    }, options);

    this.init();
  };

  $.RelatedTextView.prototype = {

    init: function() {
      this.element = jQuery(this.template());
      this.element.appendTo(this.appendTo);

      this.listenForActions();

      if (this.manifest) {
        this.handleRelated(this.manifest);
      }
    },

    listenForActions: function() {
      var _this = this;

      this.eventEmitter.subscribe('windowUpdated', function(event, data) {
        // Ignore updates to other windows, if the update has no manifest info
        // or if the updated manifest is the same as the currently loaded manifest
        if (data.id !== _this.windowId || !data.loadedManifest || data.loadedManifest === _this.manifestId) {
          return;
        }

        _this.clear();
        _this.manifestId = data.loadedManifest;
        _this.handleRelated(_this.state.getManifestObject(data.loadedManifest));
      });
    },

    /**
     * Check to see if a manifest has a 'related' property
     */
    manifestHasRelated: function(manifest) {
      return manifest && manifest.jsonLd && manifest.jsonLd.related;
    },

    handleRelated: function(manifest) {
      var _this = this;

      if (!this.manifestHasRelated(manifest)) {
        return;
      }

      // Ensure that related is an array to normalize behavior
      var related = manifest.jsonLd.related;
      if (!Array.isArray(related)) {
        // TODO not supported by IE :(
        related = Array.of(related);
      }

      // Only act on HTML entities
      related
      // .filter(function(rel) {
      //   return rel.format === 'application/xml';
      // })
      .forEach(function(rel) {
        _this.loadRelated(rel);
      });
    },

    loadRelated: function(rel) {
      var _this = this;

      this.teiUtil.getHTML5(rel['@id']).then(function(data) {
        // TODO do we want to inspect the incoming document and strip out things like surrounding brackets?
        var prose = jQuery(data).find('tei-notesstmt');
        if (prose.length === 0) {
          _this.element.append(_this.noDescription());
        } else {
          _this.element.append(prose);
        }
      });
    },

    clear: function() {
      this.element.empty();
    },

// -------------------------------------------------------------------------------------------------------
// ------ These functions are required for all 'View' types. Taken from ThumbnailsView -------------------
// -------------------------------------------------------------------------------------------------------

    adjustHeight: function(className, hasClass) {
      if (hasClass) {
        this.element.removeClass(className);
      } else {
        this.element.addClass(className);
      }
    },

    adjustWidth: function(className, hasClass) {
      var _this = this;
      if (hasClass) {
        _this.eventEmitter.publish('REMOVE_CLASS.'+this.windowId, className);
      } else {
        _this.eventEmitter.publish('ADD_CLASS.'+this.windowId, className);
      }
    },

    toggle: function(stateValue) {
      if (stateValue) {
        this.show();
      } else {
        this.hide();
      }
    },

    show: function() {
      this.element.show({
        effect: "fade",
        duration: 300,
        // easing: "easeInCubic",
        complete: function() {
          // Under firefox $.show() used under display:none iframe does not change the display.
          // This is workaround for https://github.com/IIIF/mirador/issues/929
          jQuery(this).css('display', 'block');
        }
      });
    },

    hide: function() {
      this.element.hide();
    },

// -------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------

    template: Handlebars.compile([
      '<div class="related-text-view">',
      '</div>'
    ].join('')),

    noDescription: Handlebars.compile('<h2>{{t "noDescription"}}</h2>'),

  };

}(Mirador));

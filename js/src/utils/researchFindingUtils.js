(function ($) {

  $.ResearchFindingUtils = function (options) {
    jQuery.extend(this, {
      saveController: null
    }, options);
  };

  $.ResearchFindingUtils.prototype = {
    /**
     * @param {HistoryState} state
     */
    historyStateLabel: function (state) {
      let label;
  
      switch (state.type) {
        case $.HistoryStateType.collection_search:
          label = 'Searched \'' + state.data.search.query + '\' in ' + 
              this.collectionLabel(state.data.collection);
          break;
        case $.HistoryStateType.manifest_search:
          label = 'Searched \'' + state.data.search.query + '\' in ' + 
              this.manifestLabel(state.data.manifest);
          break;
        case $.HistoryStateType.collection:
          label = 'Viewed ' + this.collectionLabel(state.data.collection);
          break;
        case $.HistoryStateType.thumb_view:
          label = 'Viewed book ' + this.manifestLabel(state.data.manifest);
          break;
        case $.HistoryStateType.image_view:
          label = 'Viewed page ' + this.manifestLabel(state.data.manifest) + ' : ' +
              this.canvasLabel(state.data.manifest, state.data.canvas);
          break;
        case $.HistoryStateType.opening_view:
          label = 'Viewed opening ' + this.manifestLabel(state.data.manifest) + ' : ' +
              this.canvasLabel(state.data.manifest, state.data.canvas);
          break;
        case $.HistoryStateType.scroll_view:
          label = 'Scroll view at ' + this.manifestLabel(state.data.manifest) + ' : ' +
              this.canvasLabel(state.data.manifest, state.data.canvas);
          break;
        default:
          break;
      }
  
      return label;
    },

    getCollection: function (id) {
      const collection = this.saveController.getStateProperty('collections')[id];
      return collection;
    },

    getManifest: function (id) {
      const manifest = this.saveController.getStateProperty('manifests')[id];
      return manifest;
    },

    manifestLabel: function (id) {
      const manifest = this.getManifest(id);
      if (!manifest) {
        return;
      }
      return manifest.getLabel();
    },

    canvasLabel: function (manifestId, canvas) {
      const manifest = this.getManifest(manifestId);
      if (!manifest) {
        return;
      }
      return manifest.getCanvasLabel(canvas);
    },

    collectionLabel: function (id) {
      const col = this.getCollection(id);
      if (!col) {
        return;
      }
      return col.getLabel();
    }
  };
} (Mirador));
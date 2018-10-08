(function($) {
  $.JHUrlSlicer = function (options) {
    jQuery.extend(true, this, {
      eventEmitter: null,
      baseUrl: null, // Base URL of this viewer
    });
  };

  $.JHUrlSlicer.prototype = {
    init: function() {},

    /**
     * @returns {string} (collection|collection_search|manifest_search|thumb_view|image_view|opening_view)
     */
    getUrlType: function (url) {
      if (!url || url.length === 0) {
        console.log('%$c[JHInitUrlSlicer#getUrlType] No URL provided.', 'color: red;');
        return false;
      }
      var uri = new URI(url);

      var hasQuery = !!uri.query() && uri.query().length > 0;
      var parts = uri.path().split('/');

      if (parts.length === 1) {
        return $.HistoryStateType.collection;
      }

      switch (parts[parts.length - 1]) {
        case 'thumb':
          return $.HistoryStateType.thumb_view;
        case 'scroll':
          return $.HistoryStateType.scroll_view;
        case 'image':
          return $.HistoryStateType.image_view;
        case 'opening':
          return $.HistoryStateType.opening_view;
        case 'search':
          if (!hasQuery) {
            console.log('%c[JHInitUrlSlicer#getUrlType] A search URL has no query', 'color: red');
            return false;
          }
          if (parts.length === 2) {
            return $.HistoryStateType.collection_search;
          } else if (parts.length === 3) {
            return $.HistoryStateType.manifest_search;
          }
          break;
        default:
          console.log('%c[JHInitUrlSlicer#getUrlType] URL type not found (' + url + ')', 'color: red');
          break;
      }
    },

    /**
     * Return a relative URL matching the given state object.
     * 
     * - Collection must always be specified
     * - Manifest can be specified
     * - Canvas can be specified, but only if manifest is present
     * - Query can be specified any time
     * - ViewType can be specified only when manifest is present
     * 
     *  options: {
     *    type: $.HistoryStateType,
     *    data: {
     *      collection: '',
     *      manifest: '',
     *      canvas: '',
     *      query: '',
     *      viewType: ''
     *    }
     *  }
     */
    toUrl: function (options) {
      if (!options) {
        console.log('%c[JHInitUrlSlicer#toUrl] No arguments were found.', 'color: red');
        return false;
      } else if (!options.data.collection) {
        console.log('%c[JHInitUrlSlicer#toUrl] No collection was found.', 'color: red');
        return false;
      }

      let uri = new URI();
      switch (options.type) {
        case $.HistoryStateType.collection:
          return uri.path(
            this.collectionName(options.data.collection)
          );
        case $.HistoryStateType.collection_search:
          return 'collection_search:' + options.data.query;
        case $.HistoryStateType.manifest_search:
          return 'manifest_search:' + options.data.query;
        case $.HistoryStateType.thumb_view:
          return 'thumbnail_view:' + options.data.manifest;
        case $.HistoryStateType.image_view:
          return 'image_view:' + options.data.manifest;
        case $.HistoryStateType.opening_view:
          return 'opening_view:' + opening.data.manifest;
        case $.HistoryStateType.scroll_view:
          return 'scroll_view:' + opening.data.manifest;
        default:
          return undefined;
      }
    },

    /**
     * Options: see #toUrl
     */
    getStateType: function (options) {
      var keys = Object.keys(options.data);

      if (!keys.includes('manifest')) {
        if (keys.includes('query')) {
          return $.HistoryStateType.collection_search;
        }
        return $.HistoryStateType.collection;
      } else if (!keys.includes('viewType') && keys.includes('query')) {
        return $.HistoryStateType.manifest_search;
      } else if (keys.includes('viewType')) {
        if (options.viewType === 'ImageView') {
          return $.HistoryStateType.image_view;
        } else if (options.viewType === 'BookView') {
          return $.HistoryStateType.opening_view;
        } else if (options.viewType === 'ThumbnailsView') {
          return $.HistoryStateType.thumb_view;
        } else if (options.viewType === 'ScrollView') {
          return $.HistoryStateType.scroll_view;
        } else {
          console.log('%c[JHInitUrlSlicer#getStateType] Invalid \'viewType\' found (' + options.viewType + ')', 'color: red');
        }
      }
    },

    /**
     * @param options see #toUrl
     */
    stateTitle: function (options) {
      switch (options.type) {
        case $.HistoryStateType.collection:
          return 'collection: ' + options.data.collection;
        case $.HistoryStateType.collection_search:
          return 'collection_search:' + options.data.query;
        case $.HistoryStateType.manifest_search:
          return 'manifest_search:' + options.data.query;
        case $.HistoryStateType.thumb_view:
          return 'thumbnail_view:' + options.data.manifest;
        case $.HistoryStateType.image_view:
          return 'image_view:' + options.data.manifest;
        case $.HistoryStateType.opening_view:
          return 'opening_view:' + opening.data.manifest;
        case $.HistoryStateType.scroll_view:
          return 'scroll_view:' + opening.data.manifest;
        default:
          return '';
      }
    },

    /**
     * Hack to get the collection name from its ID - only works because we have control of the ID!!
     */
    collectionName: function (collectionUri) {
      let uri = new URI(collectionUri);
      return uri.segment(1);
    }
  };
}(Mirador));
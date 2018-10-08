(function($) {
  $.JHInitUrlSlicer = function (options) {
    jQuery.extend(true, this, {
      eventEmitter: null,
      baseUrl: null, // Base URL of this viewer
    });
  };

  $.JHInitUrlSlicer.prototype = {
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
        return 'collection';
      }

      switch (parts[parts.length - 1]) {
        case 'thumb':
          return 'thumb_view';
        case 'scroll':
          return 'scroll_view';
        case 'image':
          return 'image_view';
        case 'opening':
          return 'opening_view';
        case 'search':
          if (!hasQuery) {
            console.log('%c[JHInitUrlSlicer#getUrlType] A search URL has no query', 'color: red');
            return false;
          }
          if (parts.length === 2) {
            return 'collection_search';
          } else if (parts.length === 3) {
            return 'manifest_search';
          }
          break;
        default:
          console.log('%c[JHInitUrlSlicer#getUrlType] URL type not found (' + url + ')', 'color: red');
          break;
      }
    },

    /**
     * - Collection must always be specified
     * - Manifest can be specified
     * - Canvas can be specified, but only if manifest is present
     * - Query can be specified any time
     * - ViewType can be specified only when manifest is present
     * 
     *  options: {
     *    collection: '',
     *    manifest: '',
     *    canvas: '',
     *    query: '',
     *    viewType: ''
     *  }
     */
    toUrl: function (options) {
      if (!options) {
        console.log('%c[JHInitUrlSlicer#toUrl] No arguments were found.', 'color: red');
        return false;
      } else if (!options.collection) {
        console.log('%c[JHInitUrlSlicer#toUrl] No collection was found.', 'color: red');
        return false;
      }

      var uri = new URI(this.baseUrl);
      uri.segment(options.collection);

      if (Object.keys(options).length === 1) {
        return uri;
      }


    },

    /**
     * Options: see #toUrl
     */
    getStateType: function (options) {
      var keys = Object.keys(options);

      if (!keys.includes('manifest')) {
        if (keys.includes('query')) {
          return 'collection_search';
        }
        return 'collection';
      } else if (!keys.includes('viewType') && keys.includes('query')) {
        return 'manifest_search';
      } else if (keys.includes('viewType')) {
        if (options.viewType === 'ImageView') {
          return 'image_view';
        } else if (options.viewType === 'BookView') {
          return 'opening_view';
        } else if (options.viewType === 'ThumbnailsView') {
          return 'thumb_view';
        } else if (options.viewType === 'ScrollView') {
          return 'scroll_view';
        } else {
          console.log('%c[JHInitUrlSlicer#getStateType] Invalid \'viewType\' found (' + options.viewType + ')', 'color: red');
        }
      }
    }
  };
}(Mirador));
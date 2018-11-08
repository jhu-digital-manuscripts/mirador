(function($) {
  $.JHUrlSlicer = function (options) {
    jQuery.extend(true, this, {
      baseUrl: null, // Base URL of the IIIF resources
    }, options);
  };

  $.JHUrlSlicer.prototype = {
    init: function() {},

    url: function (hash, query) {
      return new URI(hash).query(query).toString();
    },

    /**
     * @returns {string} (collection|collection_search|manifest_search|thumb_view|image_view|opening_view)
     */
    getUrlType: function (url) {
      if (!url || url.length === 0) {
        console.log('%$c[JHInitUrlSlicer#getUrlType] No URL provided.', 'color: red;');
        return false;
      }
      var uri = new URI(url);

      // A URI with no path will always load the base collection specified in the
      // Mirador initial config
      if (!uri.hash() || uri.hash() === '' || uri.hash() === '/') {
        return $.HistoryStateType.collection;
      }

      var parts = uri.hash().split('/');

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
          if (!uri.hasQuery('q')) {
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

    parseUrl: function(url) {
      if (!url) {
        throw new Error('[JHUrlSlicer#parseUrl] No URL specified');
      }

      const uri = new URI(url);
      const frag = uri.fragment().split('/');
      // const query = uri.query(true).q;
      const query = uri.query(true);
      
      const type = this.getUrlType(url);
      let data = {};
      
      switch (type) {
        case $.HistoryStateType.collection_search:
          data = {
            collection: frag[0],
            search: {
              query: query.q,
              offset: parseInt(query.o) || 0,
              maxPerPage: parseInt(query.m) || 30,
              sortOrder: query.s || 'relevance',
              type: query.type
            }
          };
          break;
        case $.HistoryStateType.collection:
          data = {
            collection: frag[0]
          };
          break;
        case $.HistoryStateType.manifest_search:
          data = {
            collection: frag[0],
            manifest: frag[1],
            search: {
              query: query.q,
              offset: query.o || 0,
              maxPerPage: query.m || 30,
              sortOrder: query.s || 'relevance',
              type: query.type
            }
          };
          break;
        case $.HistoryStateType.scroll_view:
        case $.HistoryStateType.thumb_view:
          data = {
            collection: frag[0],
            manifest: frag[1],
            viewType: frag[2]
          };
          break;
        case $.HistoryStateType.image_view:
        case $.HistoryStateType.opening_view:
          data = {
            collection: frag[0],
            manifest: frag[1],
            canvas: frag[2],
            viewType: frag[3]
          };
          break;
        default:
          break;
      }
      
      data.canvas = this.canvasUri(data.collection, data.manifest, data.canvas);
      data.manifest = this.manifestUri(data.collection, data.manifest);
      data.collection = this.collectionUri(data.collection);
      
      return new $.HistoryState({
        type,
        fragment: url,
        data
      });
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
     * When given 'options' that already specifies a manifest, the collection information
     * is not easily obtainable from the event. Instead, the event will parse the collection
     * name from the manifest ID, so for those event types representing a manifest, no
     * operation is needed for get the collection name.
     * 
     * Always clear URL query first. The URL query will be re-applied for URLs related to searches.
     * 
     * @param {HistoryState} options
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
      uri.query('');

      switch (options.type) {
        case $.HistoryStateType.collection:
          uri.fragment(
            this.collectionName(options.data.collection)
          );
          break;
        case $.HistoryStateType.collection_search:
          let searcher = this.processSearchObj(options.data.search);

          uri.fragment(this.uriToSearchUri(
            this.collectionName(options.data.collection) + '/' + options.viewType
          )).query({
            q: searcher.query,
            o: searcher.offset,
            m: searcher.maxPerPage,
            s: searcher.sortOrder,
            type: searcher.type,
            service: this.collectionName(searcher.service)
          });
          break;
        case $.HistoryStateType.manifest_search:
          let searcher2 = this.processSearchObj(options.data.search);

          uri.fragment(this.uriToSearchUri(
            this.collectionName(options.data.collection) + '/' + 
            this.manifestName(options.data.manifest) + '/' + options.viewType
          )).query({
            q: searcher2.query,
            o: searcher2.offset,
            m: searcher2.maxPerPage,
            s: searcher2.sortOrder,
            type: searcher2.type,
            service: this.collectionName(searcher2.service) + '/' + this.manifestName(searcher2.service)
          });
          break;
        case $.HistoryStateType.thumb_view:
        case $.HistoryStateType.scroll_view:
          uri.fragment(
            options.data.collection + '/' +
            this.manifestName(options.data.manifest) + '/' +
            options.data.viewType
          );
          break;
        case $.HistoryStateType.image_view:
        case $.HistoryStateType.opening_view:
          uri.fragment(
            options.data.collection + '/' +
            this.manifestName(options.data.manifest) + '/' + 
            this.canvasName(options.data.canvas) + '/' +
            options.data.viewType
          );
          break;
        default:
          return undefined;
      }

      return uri.toString();
    },

    processSearchObj: function (searcher) {
      if (!searcher.offset) {
        delete searcher.offset;
      }
      if (!searcher.maxPerPage) {
        delete searcher.maxPerPage;
      }
      if (!searcher.sortOrder) {
        delete searcher.sortOrder;
      }

      return searcher;
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
      } else if (!options.viewType && keys.includes('query')) {
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

    viewTypeToStateType: function (viewType) {
      if (viewType === 'ImageView') {
        return $.HistoryStateType.image_view;
      } else if (viewType === 'BookView') {
        return $.HistoryStateType.opening_view;
      } else if (viewType === 'ThumbnailsView') {
        return $.HistoryStateType.thumb_view;
      } else if (viewType === 'ScrollView') {
        return $.HistoryStateType.scroll_view;
      } else {
        console.log('%c[JHInitUrlSlicer#viewTypeToStateType] Invalid \'viewType\' found (' + options.viewType + ')', 'color: red');
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
          return 'opening_view:' + options.data.manifest;
        case $.HistoryStateType.scroll_view:
          return 'scroll_view:' + options.data.manifest;
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
    },

    manifestName: function (manifestUri) {
      let uri = new URI(manifestUri);
      return uri.segment(2);
    },

    canvasName: function (canvasUri) {
      let uri = new URI(canvasUri);
      return uri.segment(3);
    },

    /**
     * @param {string} uri
     */
    collectionFromUri: function (uri) {
      const frag = new URI(uri).fragment(); // URI-ify the string
      if (!frag) {
        return;
      }
      return frag.split('/')[0];
    },

    /**
     * @param collection short name of collection
     */
    collectionUri: function (collection) {
      if (!collection) {
        return;
      }

      let uri = new URI(this.baseUrl);

      uri.segment(1, collection);
      uri.segment(2, 'collection');

      return uri.toString();
    },

    /**
     * @param collection short name of collection
     * @param manifest short name of manifest
     */
    manifestUri: function (collection, manifest) {
      if (!manifest) {
        return;
      }

      let uri = new URI(this.baseUrl);

      uri.segment(1, collection);
      uri.segment(2, manifest);
      uri.segment(3, 'manifest');

      return uri.toString();
    },

    /**
     * @param collection short name of collection
     * @param manifest short name of manifest
     * @param canvas short name of canvas
     */
    canvasUri: function (collection, manifest, canvas) {
      if (!canvas) {
        return;
      }

      let uri = new URI(this.baseUrl);

      uri.segment(1, collection);
      uri.segment(2, manifest);
      uri.segment(3, canvas);
      uri.segment(4, 'canvas');

      return uri.toString();
    },

    uriToSearchUri: function (uri) {
      return uri + '/jhsearch';
    }
  };
}(Mirador));
/*
 * Responsible for all things searchy. This object is able to request search
 * info.json config objects. It can crawl IIIF object trees to discover related
 * search services. Search queries are sent to appropriate services from here
 * in response to search events.
 *
 * EVENTS (See docs in #listenForActions for data structures):
 * Listens for:
 *    - GET_SEARCH_SERVICE  : Get a search service by ID
 *    - GET_RELATED_SEARCH_SERVICES : Get all search services associated with
 *                                    a manifest and parent collections
 *              this returns only URL IDs or IIIF service blocks. Not the full info.json configs.
 *    - SEARCH  : Perform a search according to a search request object
 *                (See docs for SearchController#doSearch)
 *    - GET_FACETS
 * Emits:
 *    - SEARCH_SERVICE_FOUND  : once a search service is retrieved in
 *                              response to a "GET_SEARCH_SERVICE" event
 *    - RELATED_SEARCH_SERVICES_FOUND : once all search services related
 *                                      to a manifest are found, in response
 *                                      to "GET_RELATED_SEARCH_SERVICES" event
 *    - SEARCH_COMPLETE : after a search request is complete, in response to
 *                        a "SEARCH" event
 *    - FACETS_COMPLETE
 *
 * Each response has a suffix identifying the event origin. This is done so
 * that individual widgets can register and destory event handlers for these
 * responses at will.
 *    <EVENT_NAME>.<some-id-string>
 * For example:
 *    SEARCH_SERVICE_FOUND.window-1-ID
 * ===========================================================================
 *
 * List of known search services:
 *  searchServices: [
 *    {
 *      "id": "service_id",
 *      "service": { ... },  // Service block from IIIF object
 *      "config": { ... }    // info.json data
 *    }
 *  ]
 */
(function($){
  $.SearchController = function(options) {
    jQuery.extend(true, this, {
      eventEmitter: null,
      searchServices: [],
      cachedKeys: [],
    }, options);

    this.init();
  };

  $.SearchController.prototype = {
    init: function() {
      this.listenForActions();
    },

    listenForActions: function() {
      var _this = this;

      /**
       * data:  {
       *          "origin": ""          // ID of sender of this event, ex: windowId
       *          "serviceId": ""   // ID of requestd search service
       *        }
       *
       * @return  {
       *            "origin": "",             //
       *            "service": {
       *              "id": "service-id-same-as-requested",
       *              "label": "",        // Take from its parent object
       *              "service": { ... }  // Original JSON service definition
       *              "config": { ... }   // info.json stuff. An instance of $.jhiiifSearchService
       *            }
       *          }
       */
      this.eventEmitter.subscribe("GET_SEARCH_SERVICE", function(event, data) {
        _this.getSearchService(data.serviceId).done(function(service) {
          _this.eventEmitter.publish("SEARCH_SERVICE_FOUND." + data.origin, {
            "origin": data.origin,
            "service": service
          });
        });
      });

      /**
       * data:  {
       *          "origin": ""           // ID of sender of this event, ex: windowId
       *          "baseObject": {object} // A IIIF object JSON object
       *        }
       *
       * @return  {
       *            "origin": "",             // ID of original sender, could be windowId
       *            "services": [ ... ]   // array of search services found, for structure of each service, see GET_SEARCH_SERVICE docs
       *          }
       */
      this.eventEmitter.subscribe("GET_RELATED_SEARCH_SERVICES", function(event, data) {
        _this.eventEmitter.publish("RELATED_SEARCH_SERVICES_FOUND." + data.origin, {
          "origin": data.origin,
          "services": _this.searchServicesInObject(data.baseObject)
        });
      });

      /**
       * data:  {
       *          "origin": ""        // ID of original event source
       *          service: "",    // some service config object or search service ID string
       *          query: "",      // some query string, already formatted
       *          offset: -1,     // (optional) integer, requested results offset, used for paging
       *          maxPerPage: -1  // (optional) integer, maximum results to show per page,
       *          resumeToken: "",// (optional) string, token used by a search service to resume a search. Sometimes used with paging
       *          sortOrder: "",  // (optional) string, sort order of results (index|_relevance))
       *        }
       *
       * @return  {
       *            "origin": "",             // ID of original sender
       *            "results": {object}   // Search results, see https://github.com/jhu-digital-manuscripts/rosa2/wiki/JHIIIF-Search#search-result
       *          }
       */
      this.eventEmitter.subscribe("SEARCH", function(event, searchReq) {
        // Do async search, when complete, publish SEARCH_COMPLETE event
        _this.doSearch(searchReq).done(function(data) {
          _this.eventEmitter.publish("SEARCH_COMPLETE." + searchReq.origin, {
            "origin": searchReq.origin,
            "results" : data
          });
        });
      });

      this.eventEmitter.subscribe("GET_FACETS", function(event, searchReq) {
        searchReq.query = "object_type:'sc:Manifest'";      // TODO: relies on magic string
        searchReq.maxPerPage = 500;   // TODO look into weird behavior: either not setting this or setting too high will not retrieve all search results
        searchReq.offset = 0;
        _this.doSearch(searchReq).done(function(data) {
          _this.eventEmitter.publish("FACETS_COMPLETE." + searchReq.origin, {
            "origin": searchReq.origin,
            "results": data,
            "setui": searchReq.setui
          });
        });
      });
    },

    /**
     * Read from or write to cache.
     *
     * If 'value' is provided, it will be stored in cache under key = id.
     * If no 'value' is provided, it is read from cache using the provided
     * id as the key.
     *
     * When writing to cache, it is possible that storate will be full. If this
     * is the case, the write can be forced, which will clear the cache and
     * attempt the write again.
     *
     * TODO should use LRU or something
     *
     * @param  (string) id    ID of object in cache
     * @param  (string) value value to put into cache
     * @param  (boolean) force - if writing, this will retry attempt if an error occurs
     * @return cached object if reading from cache
     */
    cache: function(id, value, force) {
      console.assert(id, '[SearchController] cache ID must be provided');
      var _this = this;

      if (!value) {
        // No value provided, read this ID from cache
        return sessionStorage.getItem(id);

      } else {
        // Value provided, add this to cache
        try {
          this.cachedKeys.push(id);
          sessionStorage.setItem(id, value);
        } catch (e) {
          if (e === 'QuotaExceededError' && force) {
            // sessionStorage.clear();
            this.cachedKeys.forEach(function(key) { sessionStorage.removeItem(key); });
            this.cachedKeys = [];
            _this.cache(id, value, false);
          } else {
            console.log('[SearchController] Unexpected error encountered while writing search result to cache. ' + e);
          }
        }
      }
    },

    /**
     * Get a search service from its ID. The object provided will include the
     * services info.json. If this info has not yet been loaded, it will first
     * be requested and cached before being returned.
     *
     * @returns jQuery Deferred that resolves when a search service with the
     *          desired ID is found. The service may be cached in memory, or
     *          it may be retrieved by following the ID to get the service info.json
     *          #getService("service-url-id").done(function(jhiiifSearchService) { ... });
     */
    getSearchService: function(id) {
      if (!id) {
        console.log("[SearchController] Failed to get search service, no ID provided.");
        return;
      }
      var _this = this;
      var service = jQuery.Deferred();

      var s = this.searchServices.filter(function(service) {
        return service.id === id || service["@id"] === id;
      });

      if (s.length === 0) {
        // console.log("[SearchController] No search service found for ID: " + id);
        // service.resolve(undefined);
        var newService = { "id": id };
        var config = new $JhiiifSearchService(newService);
        config.initializer.always(function() {
          newService.config = config;
          _this._addSearchService(id, config);
          service.resolve(newService);
        });
      } else if (s.length > 0 && s[0].config) {
        service.resolve(s[0]);
      } else {
        // Only ONE should appear here, as it matches IDs, however, if
        // for some reason, more than one are matched, just pick the first
        var jhservice = new $.JhiiifSearchService({ "id": s[0].id });
        jhservice.initializer.always(function() {
          s[0].config = jhservice;
          service.resolve(s[0]);
        });
      }

      return service;
    },

    /**
     * Test a IIIF service block to see if it represents a search service.
     */
    isSearchServiceBlock: function(service) {
      return service && service["@context"] === "http://manuscriptlib.org/jhiff/search/context.json";
    },

    /**
     * Get the search service from a IIIF object. It is possible for an
     * object to contain multiple search services. For example, a
     * manifest might have a search service for itself and also a search
     * service for its parent collection.
     *
     * @param object
     * @return {Array} array of search services. Can return zero or more services.
     */
    searchServicesInObject: function(object) {
      var _this = this;
      var serviceProperty =  object.service || (object.jsonLd ? object.jsonLd.service : undefined);
      var serviceLabel = object.label || (object.jsonLd ? object.jsonLd.label : "");

      var s = [];
      if (Array.isArray(serviceProperty)) {
        serviceProperty
        .filter(function(service) { return _this.isSearchServiceBlock(service); })
        .forEach(function(service) {
          if (!service.label) service.label = serviceLabel;
          s.push(service);
          _this._addSearchService(service);
        });
      } else if (this.isSearchServiceBlock(serviceProperty)) {
        if (!serviceProperty.label) serviceProperty.label = serviceLabel;
        s.push(serviceProperty);
        _this._addSearchService(serviceProperty);
      }
      return s;
    },

    /**
     * Find search services related to a IIIF object, including the search
     * service for the object itself, by investigating the parent objects.
     * This will investigate the 'within' property of a IIIF object, if available
     * and keep going up the graph until there are no parents, or the maximum
     * number of levels have been traversed.
     * Terminating calls should return an array with zero or more service blocks
     * or URLs.
     *
     * ####
     * Currently not needed because all parent search services are now included
     * in the 'services' property of a manifest.
     * ####
     *
     * Investigate use of nested 'within' properties:
     *  "@id" : "their-canvas",
        "@type: "sc:Canvas",
        ...
        "within" : [
            { "@id": "my-manifest", "@type": "sc:Manifest" },
            { "@id": "your-manifest", "@type": "sc:Manifest" },
            {
               "@id": "their-manifest",
               "@type": "sc:Manifest",
               "within": [
                    { "@id": "their-collection-1", "@type": "sc:Collection" },
                    { "@id": "their-collection-2", "@type": "sc:Collection" }
               ]
            }
        ]
     * This would require modification of our IIIF Presentation endpoint,
     * but would greatly simplify the retrieval of related services.
     *
     * TODO add caching for collections
     * real TODO: must separate model logic! use Manifesto library!
     *
     * @param object a IIIF object
     * @param max_depth {integer} how many levels up in the tree to investigate
     *                            (OPTIONAL) default: 2
     * @return jQuery.Deferred object that resolves with values of related
     *          search service blocks
     */
    relatedServices: function(object, max_depth) {
      console.assert(object, "A IIIF object must be provided.");
      var _this = this;

      if (typeof max_depth === "undefined") max_depth = 2;
      if (!object) return [];

      // 'manifest' object might have its data stored in 'manifest.jsonLd'
      if (object.jsonLd) object = object.jsonLd;

      // First add lowest level search service
      // (recursive) If "within" property is present, pointing to a collection
      //    - Load collection, look for search service

      var result = jQuery.Deferred();
      var services = this.searchServicesInObject(object);
      var parent = object.within;

      // Get all parent IDs (URLs). In IIIF, the 'within' property can take 0 or more values
      var urls = [];
      if (parent && (typeof parent === "string" || (typeof parent === "object" && parent["@type"] === "sc:Collection"))) {
        var url = typeof parent === "string" ? parent : parent["@id"];
        urls.push(url);
      } else if (parent && Array.isArray(parent)) {
        parent.forEach(function(p) {
          var url = typeof parent === "string" ? parent : parent["@id"];
          urls.push(url);
        });
      }

      if (urls.length === 0 || max_depth === 0) {
        // Immediately return if there is no parent, or if we've reached max_depth
        return result.resolve(services);
      } else {
        // Else move up the graph to all parent objects
        var defs = [];      // Defs == definitions that need to be resolved individually
        var more = [];      // Deferrs for the recersive calls
        urls.forEach(function(url) {
          // This stage is done when all sub deferred objects are resolved
          defs.push(jQuery.getJSON(url).done(function(data) {
            more.push(_this.relatedServices(data, max_depth-1).done(function(s) {
              if (Array.isArray(s)) {
                services = services.concat(s);
              } else {
                services.push(s);
              }
            }));
          }));
        });
        // All JSON-LD objects will have returned. Pick out service blocks
        jQuery.when.apply(jQuery, defs).done(function(_) {
          jQuery.when.apply(jQuery, more).done(function(_) {
            result.resolve(services);
          });
        });
        return result;
      }
    },

    /**
     * Add a search service to the list of known services. An ID string or a
     * search service JSON block can be added. If a search service with the
     * same ID is found, its service definition and configuration information
     * will be updated.
     */
    _addSearchService: function(service, config) {
      if (service === null) {
        return;
      }

      var match;
      if (typeof service === "string") {
        match = this.searchServices.filter(function(s) { return s.id === service; });

        if (match.length === 0) {
          this.searchServices.push({"id": service, "config": config});
        } else if (config) {
          match[0].config = config;
        }
      } else if (typeof service === "object") {
        var toAdd = {"service": service};
        match = this.searchServices.filter(function(s) { return s.id === service["@id"]; });

        if (match.length === 0) {
          this.searchServices.push({ "id": service["@id"], "service": service, "config": config });
        } else {
          match[0].service = service;
          match[0].config = config;
        }
      }
    },

    /**
     * Do a search by making a query against the specified search service.
     * The search service should already be discovered.
     *
     * @param searchReq
     *    {
     *      service: "",  // some service ID string
     *      query: "",      // some query string, already formatted
     *      offset: -1,     // (optional) integer, requested results offset, used for paging
     *      maxPerPage: -1  // (optional) integer, maximum results to show per page,
     *      resumeToken: "",// (optional) string, token used by a search service to resume a search. Sometimes used with paging
     *      sortOrder: "",  // (optional) string, sort order of results (index|_relevance))
     *    }
     * @return {object} jQuery Deferred that resolves when the search is completed
     */
    doSearch: function(searchReq) {
      var _this = this;
      var request = jQuery.Deferred();
      var serviceUrl;

      if (typeof searchReq.service === "object") {
        serviceUrl = searchReq.service.id || searchReq.service["@id"];
        // Add the specified service if necessary
        this._addSearchService(searchReq.service);
      } else {
        serviceUrl = searchReq.service;
      }

      var data = {};
      if (searchReq.query) {
        data.q = searchReq.query;
      }
      if (searchReq.offset && typeof searchReq.offset === "number") {
        data.o = searchReq.offset;
      }
      if (searchReq.maxPerPage && typeof searchReq.maxPerPage === "number") {
        data.m = searchReq.maxPerPage;
      }
      if (searchReq.sortOrder) {
        data.so = searchReq.sortOrder === "index" ? searchReq.sortOrder : "relevance";
      }
      if (Array.isArray(searchReq.facets) && searchReq.facets.length > 0) {
        data.c = this.encodeFacets(searchReq.facets);
      }

      var queryUrl = URI(serviceUrl).query(data);   // .query() function automatically encodes stuff
console.log("[SC] " + queryUrl);
      // Can cache search results here
      var cached = _this.cache(queryUrl);
      if (cached) {
        request.resolve(JSON.parse(cached));
      } else {
        // Make request if not cached
        jQuery.ajax({
          url:   queryUrl,
          dataType: 'json',
          cache: true,
        })
        .done(function(searchResults) {
          _this.cache(queryUrl, JSON.stringify(searchResults), true);
          request.resolve(searchResults);   // Resolves the enclosing Promise
        })
        .fail(function(jqXHR, textStatus, errorThrown) {
          console.log("[SearchController] search query failed (" + queryUrl + ") \n" + errorThrown);
          request.resolve();
        });
      }

      return request;
    },

    encodeFacets: function(facets) {
      if (!Array.isArray(facets)) {
        return "";
      }

      var str = "";
      facets.forEach(function(facet, index) {
        if (index > 0) {
          str += ";";
        }

        str += facet.dim;
        if (Array.isArray(facet.path)) {
          facet.path.forEach(function(p) {
            str += ":'" + p + "'";
          });
        }
      });

      return str;
    }

  };

}(Mirador));

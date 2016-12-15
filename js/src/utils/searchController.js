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
 *        TODO: should this return full info.json descriptions, or just IDs
 *    - SEARCH  : Perform a search according to a search request object
 *                (See docs for SearchController#doSearch)
 * Emits:
 *    - SEARCH_SERVICE_FOUND  : once a search service is retrieved in
 *                              response to a "GET_SEARCH_SERVICE" event
 *    - RELATED_SEARCH_SERVICES_FOUND : once all search services related
 *                                      to a manifest are found, in response
 *                                      to "GET_RELATED_SEARCH_SERVICES" event
 *    - SEARCH_COMPLETE : after a search request is complete, in response to
 *                        a "SEARCH" event
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
       *          "id": ""          // ID of sender of this event, ex: windowId
       *          "serviceId": ""   // ID of requestd search service
       *        }
       */
      this.eventEmitter.subscribe("GET_SEARCH_SERVICE", function(event, data) {

      });

      /**
       * data:  {
       *          "id": ""          // ID of sender of this event, ex: windowId
       *          "manifest": {object} // manifest object, contains the JSON-LD
       *        }
       */
      this.eventEmitter.subscribe("GET_RELATED_SEARCH_SERVICES", function(event, data) {

      });

      /**
       * data:  {
       *          id: "",         // ID of sender of event, ex: windowId
       *          serviceId: "",  // some service ID string
       *          query: "",      // some query string, already formatted
       *          offset: 0,      // (optional) integer, requested results offset, used for paging
       *          maxPerPage: 0   // (optional) integer, maximum results to show per page,
       *          resumeToken: "" // (optional) string, token used by a search service to resume a search. Sometimes used with paging
       *        }
       *
       * @return  {
       *            "id": "",             // ID of original sender
       *            "results": {object}   // Search results
       *          }
       */
      this.eventEmitter.subscribe("SEARCH", function(event, searchReq) {
        // Do async search, when complete, publish SEARCH_COMPLETE event
        _this.doSearch(searchReq).done(function(data) {
          _this.eventEmitter.publish("SEARCH_COMPLETE", {
            "id": searchReq.id,
            "results" : data
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
     * @param  (string) id    ID of object in cache
     * @param  (string) value value to put into cache
     * @param  (boolean) force - if writing, this will retry attempt if an error occurs
     * @return cached object if reading from cache
     */
    cache: function(id, value, force) {
      console.assert(id, '[SearchResults] cache ID must be provided');
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
            console.log('[SearchResults] Unexpected error encountered while writing search result to cache. ' + e);
          }
        }
      }
    },

    /**
     * @returns jQuery Deferred that resolves when a search service with the
     *          desired ID is found. The service may be cached in memory, or
     *          it may be retrieved by following the ID to get the service info.json
     *          #getService("service-url-id").done(function(jhiiifSearchService) { ... });
     */
    getSearchService: function(id) {
      if (!id) {
        console.log("[ManifestsPanel] Failed to get search service, no ID provided.");
        return;
      }

      var service = jQuery.Deferred();

      var s = this.searchServices.filter(function(service) {
        return service.id === id;
      });

      if (s.length === 0) {
        console.log("[ManifestsPanel] No search service found for ID: " + id);
      } else if (s[0].service) {
        service.resolve(s[0].service);
      } else {
        // Only ONE should appear here, as it matches IDs, however, if
        // for some reason, more than one are matched, just pick the first
        var _this = this;
        var jhservice = new $.JhiiifSearchService({ "id": s[0].id });
        jhservice.initializer.done(function() {
          s[0].service = jhservice;
          service.resolve(jhservice);
        });
      }

      return service;
    },

    /**
     * Test a IIIF service block to see if it represents a search service.
     */
    isSearchServiceBlock: function(service) {
      return service["@context"] === "http://iiif.io/api/search/0/context.json" ||
          serviceProperty["@context"] === "http://manuscriptlib.org/jhiff/search/context.json";
    },

    /**
     * Get the search service from a manifest.
     *
     * @param manifest
     */
    manifestSearchService: function(manifest) {
      var _this = this;
      var serviceProperty = manifest.jsonLd.service;

      var s = {};
      if (Array.isArray(serviceProperty)) {
        serviceProperty
        .filter(function(service) { return _this.isSearchServiceBlock(service); })
        .forEach(function(service) {
          s.service = service;
          s.service.label = manifest.jsonLd.label;
        });
      }
      else if (this.isSearchServiceBlock(serviceProperty)) {
        s = _this.jsonLd.service;
        s.label = this.jsonLd.label;
      }
      else {
        //no service object with the right context is found
        s = null;
      }
      return s;
    },

    /**
     * Find search services related to a manifest, including the search
     * service for the manifest itself, by investigating the parent collections
     * of the manifest.
     *
     * @param manifest
     */
    relatedServices: function(manifest) {
      console.assert(manifest, "A manifest object must be provided.");


    },

    /**
     * Add a search service to the list of known services. An ID string or a
     * search service JSON block can be added.
     */
    _addSearchService: function(service) {
      if (typeof service === "string") {
        this.searchServices.push({"id": service});
      } else if (typeof service === "object") {
        var toAdd = {"service": service};
        var match = this.searchServices.filter(function(s) { return s.id === service["@id"]; });

        if (match.length === 0) {
          this.searchServices.push({ "id": service["@id"], "service": service });
        } else {
          match[0] = service;
        }
      }
    },

    /**
     * Do a search by making a query against the specified search service.
     * The search service should already be discovered.
     *
     * @param searchReq
     *    {
     *      serviceId: "",  // some service ID string
     *      query: "",      // some query string, already formatted
     *      offset: -1,     // (optional) integer, requested results offset, used for paging
     *      maxPerPage: -1  // (optional) integer, maximum results to show per page,
     *      resumeToken: "" // (optional) string, token used by a search service to resume a search. Sometimes used with paging
     *    }
     * @return {object} jQuery Deferred that resolves when the search is completed
     */
    doSearch: function(searchReq) {
      var _this = this;
      var queryUrl = searchService.id + "?q=" + encodeURIComponent(query);

      if (offset && typeof offset === 'number') {
        queryUrl += "&o=" + offset;
      }
      if (numExpected && typeof numExpected === 'number') {
        queryUrl += "&m=" + numExpected;
      }
      if (sortOrder) {
        queryUrl += "&so=" + (sortOrder === "index" ? sortOrder : "relevance");
      }

      var request = jQuery.Deferred();

      // Can cache search results here
      var cached = this.cache(queryUrl);
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
          console.log("[ManifestBrowser] search query failed (" + queryUrl + ") \n" + errorThrown);
        });
      }

      return request;
    },

  };

}(Mirador));

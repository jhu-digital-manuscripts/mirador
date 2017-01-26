describe("Search Controller", function() {

  var sampleService = {
    "@context": "http://manuscriptlib.org/jhiff/search/context.json",
    "id": "http://example.org/iiif-pres/collection/top/jhsearch",
    "profile": "http://iiif.io/api/search/0/search"
  };

  var searchController;
  var eventEmitter;

  beforeEach(function() {
    // Using Fixtures in Jasmine:::
    jasmine.getJSONFixtures().fixturesPath = 'spec/fixtures';
    this.collectionNoService = getJSONFixture("collectionNoService.json");
    this.collectionTop = getJSONFixture("collectionTop.json");
    this.collection = getJSONFixture("collection.json");
    this.manifest = getJSONFixture("manifestFolgers.json");
    this.search = getJSONFixture("sampleSearch.json");
    this.info = getJSONFixture("searchInfo.json");

    // Asynchronous jQuery.ajax mock
    function ajax(url) {
      var ajaxMock = $.Deferred();
      if (typeof url === "object") url = url.url;

      if (url.indexOf("q=") > -1) {
        ajaxMock.resolve(getJSONFixture("sampleSearch.json"));       // Search request
      } else if (url.indexOf("info.json") > -1) {
        ajaxMock.resolve(getJSONFixture("searchInfo.json"));         // Sample search info.json
      } else if (url.indexOf("collection/aorcollection") > -1) {
        ajaxMock.resolve(getJSONFixture("collection.json"));   // Collection request
      } else if (url.indexOf("collection/top") > -1) {
        ajaxMock.resolve(getJSONFixture("collectionTop.json"));// Top level collection
      } else {
        ajaxMock.reject();
      }

      return ajaxMock.promise();
    }

    spyOn(jQuery, 'ajax').and.callFake(function(url) {
      return ajax(url);
    });
    spyOn(jQuery, 'getJSON').and.callFake(function(url) {
      return ajax(url);
    });

    eventEmitter = new Mirador.EventEmitter();
    spyOn(eventEmitter, "publish").and.callThrough();
    searchController = new Mirador.SearchController({
      "eventEmitter": eventEmitter
    });
  });

  it("Search controller should exist.", function() {
    expect(eventEmitter).toBeDefined();
    expect(searchController).toBeDefined();
  });

  describe("Test event handling through the eventEmitter.", function() {
    beforeEach(function() {
      var searchServiceResult = new jQuery.Deferred();
      var doSearchResult = new jQuery.Deferred();
      searchServiceResult.resolve(this.info);
      doSearchResult.resolve(this.search);

      spyOn(searchController, "getSearchService").and.returnValues(searchServiceResult);
      spyOn(searchController, "doSearch").and.returnValues(doSearchResult);
      spyOn(searchController, "relatedServices").and.callThrough();
    });

    describe("Test handling of GET_RELATED_SERVICE. ", function() {
      beforeEach(function() {
        eventEmitter.publish("GET_SEARCH_SERVICE", {
          "origin": "Moo test",
          "serviceId": "serviceId"
        });
      });

      it("Should call '#getSearchService' function and publish a SEARCH_SERVICE_FOUND event.", function() {
        expect(searchController.getSearchService).toHaveBeenCalled();
        expect(eventEmitter.publish.calls.mostRecent().args)
          .toEqual(["SEARCH_SERVICE_FOUND", {origin: "Moo test", service: this.info}]);
      });
    });

    xdescribe("Test handling of GET_RELATED_SERVICE. ", function() {
      beforeEach(function() {
        eventEmitter.publish("GET_RELATED_SERVICE", {
          "origin": "Moo test",
          "baseObject": this.manifest
        });
      });

      xit("Should call #relatedServices and publish RELATED_SEARCH_SERVICES_FOUND event.", function() {
        expect(searchController.relatedServices).toHaveBeenCalled();
        expect(eventEmitter.publish.calls.mostRecent().args.length).toBe(2);
        expect(eventEmitter.publish.calls.mostRecent().args[0]).toBe("RELATED_SEARCH_SERVICES_FOUND");
        expect(Array.isArray(eventEmitter.publish.calls.mostRecent().args[1])).toBeTruthy();
        expect(eventEmitter.publish.calls.mostRecent().args[1].length).toBe(3);
      });
    });
  });

  describe("#isSearchServiceBlock test with two known service blocks.", function() {
    var services = [
      // A service block for JH Search
      {
        "@context": "http://manuscriptlib.org/jhiff/search/context.json",
        "@id": "http://localhost:8080/iiif-pres/aorcollection.FolgersHa2/manifest/jhsearch",
        "profile": "http://iiif.io/api/search/0/search"
      },
      // Service block for IIIF Image API
      {
        "@context": "http://iiif.io/api/image/2/context.json",
        "@id": "http://image.library.jhu.edu/iiif/aor%2fFolgersHa2%2fFolgersHa2.001r.tif",
        "profile": "http://iiif.io/api/image/2/profiles/level2.json"
      }
    ];

    it("First services should be a search service.", function() {
      expect(searchController.isSearchServiceBlock(services[0])).toBeTruthy();
    });

    it("Second services should not be a search service.", function() {
      expect(searchController.isSearchServiceBlock(services[1])).toBe(false);
    });
  });

  describe("Test #searchServicesInObject", function() {
    var expected = {
      "@context": "http://manuscriptlib.org/jhiff/search/context.json",
      "@id": "http://example.org/iiif-pres/collection/top/jhsearch",
      "profile": "http://iiif.io/api/search/0/search"
    };

    it("Sample should have ONE search service that is equivalent to the expected service block.", function() {
      var result = searchController.searchServicesInObject(this.collectionTop);
      expect(Array.isArray(result)).toBeTruthy();
      expect(result.length).toBe(1);
      expect(result[0]["@id"]).toBe(expected["@id"]);
    });

    it("Object with no service should return empty array.", function() {
      var result = searchController.searchServicesInObject(this.collectionNoService);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBeTruthy();
      expect(result.length).toBe(0);
    });
  });

  describe("Test #relatedServices by finding services related to test Folgers manifest.", function() {
    var result;

    beforeEach(function(done) {
      searchController.relatedServices(this.manifest)
      .done(function(services) { result = services; })
      .always(function(){ done(); });
    }, 2000);

    it("Should return 3 related services.", function() {
      expect(Array.isArray(result)).toBeTruthy();
      expect(result.length).toBe(3);
    });

    it("Should contain top collection service.", function() {
      expect(result.filter(function(s) {
        return s["@id"] === "http://example.org/iiif-pres/collection/top/jhsearch";
      }).length).toBe(1);
    });

    it("Should contain aorcollection service.", function() {
      expect(result.filter(function(s) {
        return s["@id"] === "http://example.org/iiif-pres/collection/aorcollection/jhsearch";
      }).length).toBe(1);
    });

    it("Should contain Folgers manifest service.", function() {
      expect(result.filter(function(s) {
        return s["@id"] === "http://example.org/iiif-pres/aorcollection.FolgersHa2/manifest/jhsearch";
      }).length).toBe(1);
    });
  });

  describe("Test #relatedServices find services related to Folgers manifest, but only up 1 level.", function() {
    var result;

    beforeEach(function(done) {
      searchController.relatedServices(this.manifest, 1)
      .done(function(s) { result = s; })
      .always(function() { done(); });
    });

    it("Should have 2 results.", function() {
      expect(Array.isArray(result)).toBeTruthy();
      expect(result.length).toBe(2);
    });

    it("Should not contain top collection service.", function() {
      expect(result.filter(function(s) {
        return s["@id"] === "http://example.org/iiif-pres/collection/top/jhsearch";
      }).length).toBe(0);
    });

    it("Should contain aorcollection service.", function() {
      expect(result.filter(function(s) {
        return s["@id"] === "http://example.org/iiif-pres/collection/aorcollection/jhsearch";
      }).length).toBe(1);
    });

    it("Should contain Folgers manifest service.", function() {
      expect(result.filter(function(s) {
        return s["@id"] === "http://example.org/iiif-pres/aorcollection.FolgersHa2/manifest/jhsearch";
      }).length).toBe(1);
    });
  });

  describe("Test #getSearchService, make sure the info request goes through.", function() {
    var searcher;

    beforeEach(function(done) {
      searchController.searchServices.push({"id": "http://example.org/iiif-pres/collection/top/jhsearch"});
      searchController.getSearchService("http://example.org/iiif-pres/collection/top/jhsearch")
      .done(function(data) { searcher = data.config.search; })
      .always(function() { done(); });
    }, 2000);

    it("Search settings should have 6 fields and default-fields", function() {
      expect(searcher).toBeDefined();
      expect(searcher.settings).toBeDefined();
      expect(searcher.settings.fields).toBeDefined();
      expect(Array.isArray(searcher.settings.fields)).toBeTruthy();
      expect(searcher.settings.fields.length).toBe(6);
      expect(searcher.settings["default-fields"].length).toBe(6);
    });

    it("Should have six search categories.", function() {
      expect(searcher).toBeDefined();
      expect(searcher.categories).toBeDefined();
      expect(searcher.categories.choices.length).toBe(6);
    });
  });

  describe("Test #doSearch", function() {
    var searchUrl = "http://example.org/iiif-pres/collection/aorcollection/jhsearch?q=marginalia%3A%27moo%27&m=30&so=relevance&o=0";
    var searchReq = {
      query: "marginalia:'moo'",
      offset: 0,
      maxPerPage: 30,
      sortOrder: "relevance"
    };
    var results;

    beforeEach(function(done) {
      searchController.doSearch(searchReq)
      .done(function(data) { results = data; })
      .always(function() { done(); });
    });

    it("There should be 1 ajax request.", function() {
      expect(results).toBeDefined();
      expect(jQuery.ajax).toHaveBeenCalledTimes(1);
    });

    it("Results should have 9 matches.", function() {
      expect(results).toBeDefined();
      expect(results.total).toBe(9);
      expect(results.matches.length).toBe(9);
    });
  });

});

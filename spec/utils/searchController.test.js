

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

  xdescribe("Test #relatedServices.", function() {
    var manifest = null;    // This needs to be a JSON object or a Mirador.Manifest object
    var result;

    beforeEach(function(done) {
      searchController.relatedServices(manifest).done(function(services) {
        result = services;
      }).always(function(){
        done();
      });
    }, 2000);

    xit("Should return 3 related services.", function() {
      expect(Array.isArray(result)).toBeTruthy();
      expect(result.length).toBe(3);
    });
  });

  describe("Testing $getSearchService again, make sure the info request goes through.", function() {
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

});

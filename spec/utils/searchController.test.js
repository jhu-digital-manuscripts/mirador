describe("Search Controller", function() {
  var sampleService = {
    "@context": "http://manuscriptlib.org/jhiff/search/context.json",
    "id": "http://example.org/iiif-pres/collection/top/jhsearch",
    "profile": "http://iiif.io/api/search/0/search"
  };

  var searchController;
  var eventEmitter;

  beforeEach(function() {
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
    var collectionData =
      '{"@context":"http://iiif.io/api/presentation/2/context.json","@id":"http://example.org/iiif-pres/collection/top","@type":"sc:Collection","label":"All JHU collections","description":"Top level collection bringing together all other collections in this archive.","service":{"@context":"http://manuscriptlib.org/jhiff/search/context.json","@id":"http://example.org/iiif-pres/collection/top/jhsearch","profile":"http://iiif.io/api/search/0/search"},"collections":[{"@id":"http://localhost:8080/iiif-pres/collection/aorcollection","@type":"sc:Collection","label":"Archaeology of Reading"},{"@id":"http://localhost:8080/iiif-pres/collection/rosecollection","@type":"sc:Collection","label":"Roman de la Rose Digital Library"},{"@id":"http://localhost:8080/iiif-pres/collection/pizancollection","@type":"sc:Collection","label":"Christine de Pizan Digital Scriptorium"}]}';
    var expected = {
      "@context": "http://manuscriptlib.org/jhiff/search/context.json",
      "@id": "http://example.org/iiif-pres/collection/top/jhsearch",
      "profile": "http://iiif.io/api/search/0/search"
    };
    var result;

    beforeEach(function() {
      result = searchController.searchServicesInObject(JSON.parse(collectionData));
    });

    it("Sample should have ONE search service that is equivalent to the expected service block.", function() {
      expect(Array.isArray(result)).toBeTruthy();
      expect(result.length).toBe(1);
      expect(result[0]["@id"]).toBe(expected["@id"]);
    });
  });

  describe("Test #getSearchService", function() {
    var id = "http://example.org/iiif-pres/collection/top/jhsearch";
    var result;

    beforeEach(function(done) {
      // First cache the sample service so it is known to the controller
      searchController.searchServices.push(sampleService);
      searchController.getSearchService(id).done(function(service) {
        result = service;
      }).always(function(){
        done();
      });
    }, 2000);

    it("Search service should be found, investigate for info.json data", function() {
      expect(result).toBeDefined();
      expect(result.config).toBeDefined();
      expect(result.config.query).toBeDefined();
      expect(result.config.search).toBeDefined();
    });
  });

  // TODO don't know how to access local data. Do not want to rely on a server being up.
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

});

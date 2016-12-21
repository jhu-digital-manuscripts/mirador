describe("Search Controller", function() {

  beforeEach(function() {
    var options = {
      eventEmitter: jasmine.createSpy("event-emitter-spy")
    };
    this.searchController = new Mirador.searchController(options);
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

    expect(this.searchController.isSearchServiceBlock(services[0])).toBe(true);
    expect(this.searchController.isSearchServiceBlock(services[1])).toBe(false);
  });

});

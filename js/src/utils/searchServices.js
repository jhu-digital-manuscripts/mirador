(function($){
  /**
   * This serves as a container for the different search services in the application.
   * It is responsible for requesting each search service info.json and returning
   * all relevant search config objects requested.
   *
   * This object will cache search services to help performance.
   */
  $.SearchServices = function(options) {
    jQuery.extend(true, this, {
      serviceCache: {}
    }, options);

    this.init();
  };

  $.SearchServices.prototype = {
    init: function() {
      // Do we need to initialize anything?
    },

    /**
     * Get the search service in a manifst. Also get any other search services
     * for any parent collections. If any search service has not previously
     * been resolved, the 'info.json' will be retrieved.
     *
     * @param manifest {object} The manifest object that contains the JSON-LD
     * @return {Promise} return a jQuery promise. Once this promise is resolved,
     *                   the caller will recieve an array containing all relevant
     *                   search services.
     */
    getSearchServices: function(manifest) {

    }
  };
}(Mirador));

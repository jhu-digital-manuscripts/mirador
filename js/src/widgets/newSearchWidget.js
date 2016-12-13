(function($){
  /**
   * This object is responsible for creating the basic and advanced search UI
   * anywhere in Mirador. This object is responsible for forming and sending
   * search requests to the appropriate search services and recieving the
   * responses. Responses will then be passed to a SearchResults widget.
   */
  $.NewSearchWidget = function(options) {
    jQuery.extend(true, this, {
      windowId: null,
      eventEmitter: null,
      manifest: null,
      searchServices: null,     // SearchServices object, used to cache and retrieve search services, and crawl manifests for related services
      element: null,            // Base jQuery object for this widget
      appendTo: null,           // jQuery object in base Mirador that this widget lives
    }, options);

    this.init();
  };

  $.NewSearchWidget.prototype = {
    init: function() {

    },

    /**
     * Change the UI in response to the user selecting a different search
     * service.
     *
     * @param newService {string} ID of the new search service
     */
    switchSearchServices: function(newService) {

    }
  };

}(Mirador));

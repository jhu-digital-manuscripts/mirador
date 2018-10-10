(function($) {
  $.HistoryState = function (options) {
    jQuery.extend(true, this, {
      type: null, // Must be HistoryStateType
      data: {
        windowId: null,
        collection: null,
        manifest: null,
        canvas: null,
        query: null,
        viewType: null
      }
    }, options);
  };
}(Mirador));
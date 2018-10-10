(function($) {
  // (collection|collection_search|manifest_search|thumb_view|image_view|opening_view)
  $.HistoryStateType = Object.freeze({
    collection: 1,
    // manifest: 2, // Remember, no strick 'manifest' view. instead, it is broken up into different views
    'collection_search': 2,
    'manifest_search': 3,
    'thumb_view': 4,
    'image_view': 5,
    'opening_view': 6,
    'scroll_view': 7
  });

  $.getViewName = function (type) {
    switch (type) {
      case this.thumb_view:
        return 'thumb';
      case this.image_view:
        return 'image';
      case this.opening_view:
        return 'opening';
      case this.scroll_view:
        return 'scroll';
      default:
        return '';
    }
  };

}(Mirador));
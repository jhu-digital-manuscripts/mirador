(function($) {
  $.HistoryState = function (options) {
    jQuery.extend(true, this, {
      id: $.genUUID(),
      index: -1,  // Index of the state within the tracked history
      type: null, // Must be HistoryStateType
      fragment: null,
      data: {
        windowId: null,
        collection: null,
        manifest: null,
        canvas: null,
        viewType: null,
        search: {
          query: null,
          offset: null,
          maxPerPage: null,
          sortOrder: null,
          type: null,   // basic|advanced
          facetQuery: null,
          rows: null    // Array of advanced search rows. Only present if search was an Advanced Search
        },
        modType: null,    // Must be SlotChangeType
        slot: {
          id: null,
          target: null
        }
      }
    }, options);
  };

  $.HistoryState.prototype = {
    equals: function(obj) {
      if (!obj) {
        return false;
      }
      // if (!(obj instanceof $.HistoryState) ) {
      //   return false;
      // }
      if (this.type !== obj.type) {
        return false;
      } else if (this.fragment !== obj.fragment) {
        return false;
      }

      if (this.hasOwnProperty('data') !== obj.hasOwnProperty('data')) {
        return false;
      }
      if (this.data) {
        if (this.data.windowId !== obj.data.windowId) {
          return false;
        } else if (this.data.collection !== obj.data.collection) {
          return false;
        } else if (this.data.manifest !== obj.data.manifest) {
          return false;
        } else if (this.data.canvas !== obj.data.canvas) {
          return false;
        } else if (this.data.viewType !== obj.data.viewType) {
          return false;
        } else if (this.data.query !== obj.data.query) {
          return false;
        } else if (this.data.modType !== obj.data.modType) {
          return false;
        }
      }

      return true;
    }
  };

}(Mirador));
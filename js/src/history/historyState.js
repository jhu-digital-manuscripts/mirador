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
        } else if (this.slot) {
          if (!obj.slot || this.slot.id !== obj.slot.id || this.slot.target !== obj.slot.target) {
            return false;
          }
        } else if (this.data.search) {
          const s1 = this.data.search;
          const s2 = obj.data.search;
          if (!s2 || s1.query !== s2.query || s1.offset !== s2.offset || s1.maxPerPage !== s2.maxPerPage ||
              s1.sortOrder !== s2.sortOrder || s1.type !== s2.type || s1.facetQuery !== s2.facetQuery) {
            return false;
          }
        }
      }

      return true;
    }
  };

}(Mirador));
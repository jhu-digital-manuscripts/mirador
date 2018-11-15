(function ($) {
  $.HistoryDirection = Object.freeze({
    forward: 1,
    back: 2
  });

  $.History = function (options) {
    jQuery.extend(this, {
      currentIndex: 0,
      historyList: [],
      // travelLimit: 5
    }, options);
  };

  $.History.prototype = {
    current: function () {
      return this.historyList[this.currentIndex];
    },

    /**
     * Add a state to the history immediately following the current state. If you move backward
     * in the history, then use this function to add a new state, it will erase any history
     * forward of the current position before adding the given state. Say you call #previousState
     * so that currentIndex is (#length() - 5). This leaves you with four states ahead of the
     * current index. If you then call #add, the history list will be truncated past the currentIndex
     * before the new state is appended.
     * 
     * @param {HistoryState} state 
     */
    add: function (state) {
      // Splice will truncate the historyList
      this.historyList.splice(++this.currentIndex);
      this.historyList.push(state);
    },

    length: function () {
      return this.historyList.length;
    },

    /**
     * Are there history states before the current state?
     */
    less: function () {
      return this.currentIndex >= 0 && this.historyList.length > 0;
    },

    /**
     * Are there more history states ahead of the current state?
     */
    more: function () {
      return this.historyList.length > 0 && this.currentIndex < this.historyList.length;
    },

    /**
     * Look at a state ahead of the current state. If you try to peek past the end of
     * the history state list, UNDEFINED is returned.
     * 
     * @param {integer} delta OPTIONAL how many places forward to check
     *                  Default = 1
     * @returns {HistoryState} 
     */
    peekForward: function (delta = 1) {
      const target = this.currentIndex + delta;
      if (target >= this.historyList.length) {
        return;
      }
      return this.historyList[target];
    },

    /**
     * Look at a state prior to the current state. If you try to peek before the
     * start of recorded history, UNDEFINED is returned.
     * 
     * @param {integer} delta OPTIONAL how many places back to check
     *                  Default = 1
     */
    peekBack: function (delta = 1) {
      const target = this.currentIndex - delta;
      if (target < 0) {
        return;
      }
      return this.historyList[target];
    },

    /**
     * Move to a previous history state. If 'delta' is provided, try to move
     * 'delta' number of spaces back in the history list. If 'delta' moves the
     * index prior to the beginning of the list, instead move to the beginning
     * of the list.
     * 
     * @param {integer} delta OPTIONAL (default = 1)
     */
    previousState: function (delta = 1) {
      const target = this.currentIndex - delta;
      if (target < 0) {
        this.currentIndex = 0;
      } else {
        this.currentIndex = target;
      }

      return this.historyList[this.currentIndex];
    },

    /**
     * Move to a "future" history state compared to the current state. If 'delta' is
     * provided, try to move that many spaces forward in the history list. If 'delta'
     * would move the index past the end of the list, instead move to the end of the list.
     * 
     * @param {integer} delta 
     */
    nextState: function (delta = 1) {
      const target = this.currentIndex + delta;
      if (target >= this.historyList.length) {
        this.currentIndex = this.historyList.length - 1;
      } else {
        this.currentIndex = target;
      }
      return this.historyList[this.currentIndex];
    },

    // /**
    //  * Find the direction in the history in which the given state can be found first.
    //  * Both forward and backward directions are searched, whichever direction finds
    //  * a match first is returned. If the given state is not found in the history,
    //  * 'undefined' is returned.
    //  * 
    //  * @param {HistoryState} state 
    //  * @returns {HistoryDirection} or undefined if state is not found
    //  */
    // directionTo: function (state) {
    //   let delta = 0;

    //   let noneForward = false;
    //   let noneBack = false;

    //   do {
    //     delta++;

    //     if (!noneForward) {
    //       const forward = this.peekForward(delta);
    //       if (!forward) {
    //         noneForward = true;
    //       } else if (forward.equals(state)) {
    //         return $.HistoryDirection.forward;
    //       }
    //     }
        
    //     if (!noneBack) {
    //       const back = this.peekBack(delta);
    //       if (!back) {
    //         noneBack = true;
    //       } else if (back.equals(state)) {
    //         return $.HistoryDirection.back;
    //       }
    //     }
    //   } while ((!noneForward || !noneBack) && delta < this.length());
    // },

    /**
     * Get the closest distance to a given state. Positive numbers indicate that the 
     * @param {HistoryState} state 
     * @returns {integer} +/- delta to find the given state, always greater than zero; 
     *                    or 'undefined' if state was not found in the history
     */
    search: function (state) {
      let delta = 0;

      let noneForward = false;
      let noneBack = false;

      while ((!noneForward || !noneBack) && delta < this.length()) {
        delta++;

        if (!noneForward) {
          const forward = this.peekForward(delta);
          if (!forward) {
            noneForward = true;
          } else if (forward.equals(state)) {
            return delta;
          }
        }
        
        if (!noneBack) {
          const back = this.peekBack(delta);
          if (!back) {
            noneBack = true;
          } else if (back.equals(state)) {
            return -delta;
          }
        }
      }
    }
  };
}(Mirador));
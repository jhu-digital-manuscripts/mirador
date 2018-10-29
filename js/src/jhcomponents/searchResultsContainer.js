(function ($) {
  $.SearchResultsContainer = function (options) {
    jQuery.extend(true, this, {
      windowId: undefined,
      element: null,
      appendTo: null,
      state: null,
      eventEmitter: null,

      context: null,
      config: null,
      baseObject: null,

    }, options);

    this.init();
  };

  $.SearchResultsContainer.prototype = {
    init: function () {
      this.element = jQuery(this.template()).appendTo(this.appendTo);

      this.searchPager = new $.SearchPager({
        windowId: this.windowId,
        appendTo: this.element.find('.search-results-container'),
        state: this.state,
        eventEmitter: this.eventEmitter,
        config: this.config,
        context: this.context
      });

      this.bindEvents();
    },

    listenForActions: function () {

    },

    bindEvents: function () {
      const _this = this;

      this.element.find('.search-results-close').on("click", () => {
        _this.element.slideUp(160);
      });
    },

    changeContext: function (context) {
      this.context = context;
      this.searchPager.changeContext(context, true);
    },

    clear: function () {
      this.element.find('.search-results-list').empty();
    },

    handleSearchResults: function (searchResults) {
      this.clear();

      this.searchResults = new $.SearchResults({
        parentId: this.windowId,
        state: this.state,
        currentObject: this.baseObject,
        appendTo: this.element.find('.search-results-list'),
        eventEmitter: this.eventEmitter,
        context: this.context,
        config: this.config
      });

      let last = parseInt(searchResults.offset) + this.context.search.maxPerPage;
      if (last > searchResults.total) {
        last = searchResults.total;
      }

      // TODO pager logic
      if (this.needsPager(searchResults)) {
        this.searchPager.setPagerText(searchResults.offset + 1, last, searchResults.total);
        this.searchPager.setPager(searchResults);
        this.searchPager.show();
      } else {
        this.searchPager.hide();
      }

      this.appendTo.find('.search-results-display').slideDown(160);
    },

    needsPager: function (results) {
      return results.offset > 0 ||
          results.offset + (results.max_matches || results.matches.length) < results.total;
    },

    template: Handlebars.compile([
      '<div class="search-results-display" style="display:none;">',
        '<div class="search-results-close"><i class="fa fa-2x fa-caret-up" title="Close results"></i>Close results</div>',
        '<div class="search-results-container">',
          '<div class="search-results-list"></div>',
        '</div>',
      '</div>',
    ].join(''))
  };
}(Mirador));
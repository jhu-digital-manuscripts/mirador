(function ($) {
  $.SearchPager = function (options) {
    jQuery.extend(true, this, {
      windowId: undefined,
      state: null,
      eventEmitter: null,
      config: null,
      context: null,
    }, options);
    this.init();
  };

  $.SearchPager.prototype = {
    init: function () {
      this.element = jQuery(this.template()).prependTo(this.appendTo);
    },

    changeContext: function (context, suppressEvent) {
      this.context = context;
      if (!suppressEvent) {
        this.eventEmitter.publish('SEARCH_CONTEXT_UPDATED', {
          origin: this.windowId,
          context: this.context
        });
      }
    },

    show: function () {
      this.pagerVisible = true;
      this.element.show();
    },

    hide: function () {
      this.pagerVisible = false;
      this.element.hide();
    },

    getTop: function () {
      if (this.pagerVisible) {
        return this.element.find('.results-pager-container').outerHeight(true);
      }
      return undefined;
    },

    setPagerText: function (offset, last, total) {
      const pagerText = this.element.find('.results-pager-text');

      pagerText.empty();
      pagerText.append(jQuery(this.pagerText({
        offset,
        last,
        total
      })));
    },

    setPager: function (results) {
      const _this = this;
      const searchContext = this.context.search;

      const onPageCount = searchContext.maxPerPage;
      const currentPage = searchContext.offset / onPageCount + 1;

      this.element.find('.results.pager').empty();

      this.element.find('.results-pager').pagination({
        currentPage,
        items: results.total,
        itemsOnPage: onPageCount,
        displayedPages: 2,
        edges: 1,
        cssStyle: 'compact-theme',
        ellipsePageSet: true,
        prevText: '<i class="fa fa-lg fa-angle-left"></i>',
        nextText: '<i class="fa fa-lg fa-angle-right"></i>',
        onPageClick: (pageNumber, event) => {
          event.preventDefault();

          const newOffset = (pageNumber - 1) * onPageCount;
          _this.changeContext({
            search: {
              offset: newOffset
            }
          });

          _this.eventEmitter.publish('SEARCH_REQUESTED', {
            origin: _this.windowId
          });
        }
      });
    },

    /**
     * Do a Bitwise OR to truncate decimal
     *
     * @param  num original number, could be integer or decimal
     * @return integer with any decimal part of input truncated (no rounding)
     */
    float2int: function(num) {
      return num | 0;
    },

    pagerText: Handlebars.compile([
      '{{#if last}}',
        'Showing {{offset}} - {{last}} {{#if total}}out of {{total}}{{/if}}',
      '{{/if}}'
    ].join('')),

    template: Handlebars.compile([
      '<div class="results-pager-container">',
        '<div class="results-pager"></div>',
        '<p class="results-pager-text"></p>',
      '</div>'
    ].join('')),
  };
}(Mirador));
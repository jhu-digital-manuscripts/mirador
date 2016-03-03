(function($) {

  $.SearchWithinResultsMenu = function(options) {
    jQuery.extend(true, this, {
      slotAddress: null,
      manifestId: null,
      objectId: null,
      appendTo: null,
      clickX: null,
      clickY: null,
      element: null,
    }, options);

    this.init();
  };

  $.SearchWithinResultsMenu.prototype = {
    init: function() {
      this.element = jQuery(this.template()).appendTo(this.appendTo);

      this.bindEvents();
      this.reposition();
    },

    reposition: function() {
      console.log('[Menu] setting position (left, top) = (' + this.clickX + ', ' + this.clickY + ')');
      this.element.css('left', this.clickX + 'px');
      this.element.css('top', this.clickY + 'px');
    },

    bindEvents: function() {
      var _this = this;

      this.element.on('click', function() {
        _this.closeMenu();
      });

      this.element.find('.open-above').on('click', function() {

      });

      this.element.find('.open-below').on('click', function() {

      });

      this.element.find('.open-left').on('click', function() {

      });

      this.element.find('.open-right').on('click', function() {

      });
    },

    /**
     * Called once an operation has taken place. This will destroy this menu.
     *
     * @return none
     */
    closeMenu: function() {
      this.element.remove();
    },

    template: Handlebars.compile([
      '<div class="search-results-context-menu">',
        '<ul >',
          '<li class="open-above"><i class="fa fa-lg fa-li fa-caret-square-o-up"></i> Open in slot above</li>',
          '<li class="open-below"><i class="fa fa-lg fa-li fa-caret-square-o-down"></i> Open in slot below</li>',
          '<li class="open-left"><i class="fa fa-lg fa-li fa-caret-square-o-left"></i> Open in slot left</li>',
          '<li class="open-right"><i class="fa fa-lg fa-li fa-caret-square-o-right"></i> Open in slot right</li>',
        '</ul>',
      '</div>'
    ].join(''))
  };

} (Mirador));

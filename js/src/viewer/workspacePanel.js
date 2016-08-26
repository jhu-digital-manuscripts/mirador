(function($) {

  $.WorkspacePanel = function(options) {

    jQuery.extend(true, this, {
      element: null,
      appendTo: null,
      parent: null,
      workspace: null,
      maxRows: null,
      maxColumns: null,
      pinned: {"dummyWindow": false}
    }, options);

    this.init();

  };

  $.WorkspacePanel.prototype = {
    init: function () {
      var _this = this,
      templateData = {
        rows: $.layoutDescriptionFromGridString(_this.maxColumns + 'x' + _this.maxRows).children.map(function(column, rowIndex) {
          column.columns = column.children.map(function(row, columnIndex) {
            row.gridString = (rowIndex+1) + 'x' + (columnIndex+1);
            return row;
          });
          return column;
        })
      };

      this.element = jQuery(this.template(templateData)).appendTo(this.appendTo);
      var backgroundImage = _this.parent.buildPath + _this.parent.imagesPath + 'debut_dark.png';
      this.element.css('background-image','url('+backgroundImage+')').css('background-repeat','repeat');
      this.bindEvents();
    },

    bindEvents: function() {
      var _this = this;
      jQuery.subscribe('workspacePanelVisible.set', function(_, stateValue) {
        if (stateValue) { _this.show(); return; }
        _this.hide();
      });

      jQuery.subscribe('windowPinned', function(event, data) {
        _this.pinned[data.windowId] = data.status;
      });

      _this.element.find('.grid-item').on('click', function() {
        var gridString = jQuery(this).data('gridstring');
        _this.onSelect(gridString);
      });

      _this.element.find('.grid-item').on('mouseover', function() {
        var gridString = jQuery(this).data('gridstring');
        _this.onHover(gridString);
      });

      _this.element.find('.select-grid').on('mouseout', function() {
        _this.element.find('.grid-item').removeClass('hovered');
        _this.element.find('.grid-instructions').show();
        _this.element.find('.grid-text').hide();
      });
    },

    onSelect: function(gridString) {
      var _this = this;
      if (!this.isBigEnough(gridString)) {
        return;
      }
      var layoutDescription = $.layoutDescriptionFromGridString(gridString);
      _this.workspace.resetLayout(layoutDescription);
      _this.parent.toggleWorkspacePanel();
    },

    onHover: function(gridString) {
      var _this = this,
      highestRow = gridString.charAt(0),
      highestColumn = gridString.charAt(2),
      gridItems = _this.element.find('.grid-item');
      gridItems.removeClass('hovered');
      if (this.isBigEnough(gridString)) {
        gridItems.filter(function(index) {
          var element = jQuery(this);
          var griddata = element.data('gridstring');
          // TODO uses questionable hack that will break if either max_row or
          // max_col is greater than 9
          return  griddata.charAt(0) <= highestRow && griddata.charAt(2) <= highestColumn;
        }).addClass('hovered');
      }
      _this.element.find('.grid-instructions').hide();
      _this.element.find('.grid-text').text(gridString).show();
    },

    /**
     * Is the specified grid string large enough to fit all pinned windows.
     *
     * @return TRUE iff specified grid contains enough cells
     *         FALSE if grid is too small or not properly formatted
     */
    isBigEnough: function(gridString) {
      var _this = this;
      var parts = gridString.split('x');
      if (parts.length !== 2) {
        return false;
      }

      var rows = parseInt(parts[0]);
      var cols = parseInt(parts[1]);
      var minCells = Object.keys(this.pinned)
          .filter(function(key) { return _this.pinned[key]; })
          .length;

      return rows * cols >= minCells;
    },

    hide: function() {
      jQuery(this.element).hide({effect: "fade", duration: 160, easing: "easeOutCubic"});
    },

    show: function() {
      jQuery(this.element).show({effect: "fade", duration: 160, easing: "easeInCubic"});
    },

    template: Handlebars.compile([
                                 '<div id="workspace-select-menu">',
                                 '<h1>{{t "changeLayout"}}</h1>',
                                 '<h3 class="grid-text"></h3>',
                                 '<h3 class="grid-instructions">{{t "selectGrid"}}</h3>',
                                 '<div class="select-grid">',
                                 '{{#each rows}}',
                                 '<div class="grid-row">',
                                   '{{#each columns}}',
                                   '<a class="grid-item" data-gridString="{{gridString}}">',
                                   '<div class="grid-icon"></div>',
                                   '</a>',
                                   '{{/each}}',
                                 '</div>',
                                 '{{/each}}',
                                 '</div>',
                                 // '<div class="preview-container">',
                                 // '</div>',
                                 '</div>'
    ].join(''))
  };

}(Mirador));

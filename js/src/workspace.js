(function($) {

  $.Workspace = function(options) {

    jQuery.extend(true, this, {
      type:             null,
      workspaceSlotCls: 'slot',
      focusedSlot:      null,
      slots:            [],
      appendTo:         null,
      parent:           null
    }, options);

    this.element  = this.element || jQuery('<div class="workspace-container" id="workspace">');
    this.init();

  };

  $.Workspace.prototype = {
    init: function () {
      this.element.appendTo(this.appendTo);
      if (this.type === "none") {
        this.parent.toggleSwitchWorkspace();
        return;
      }

      this.calculateLayout();

      if (this.focusedSlot === null) {
        // set the focused slot to the first in the list
        this.focusedSlot = this.slots[0].slotID;
      }
      
      this.bindEvents();
    },
    slotList: function(layoutSlots) {
      var _this = this;

      layoutSlots.forEach(function(slotData) {
        
        if (!jQuery.grep(_this.slots, function(slot) { return slotData.id === slot.slotID; }).length) {
          var appendTo = _this.element.children('div').filter('[data-layout-slot-id="'+slotData.id+'"]')[0];
          _this.slots.push(new $.Slot({
            slotID: slotData.id,
            focused: true,
            parent: _this,
            appendTo: appendTo
          }));
        }
      });
    },

    calculateLayout: function() {
      var _this = this,
      layout;

      _this.layout = layout = new Isfahan({
        containerId: _this.element.attr('id'),
        layoutDescription: _this.parent.workspaces[_this.parent.currentWorkspaceType].layout,
        configuration: null,
        padding: 3 
      });

      var data = layout.filter( function(d) {
        return !d.children;
      });
      
      // Data Join.
      var divs = d3.select("#" + _this.element.attr('id')).selectAll(".layout-slot")
      .data(data, function(d) { console.log(d); return d.id; });

      // Implicitly updates the existing elements.
      // Must come before the enter function.
      divs.call(cell);

      // Enter
      divs.enter().append("div")
      .attr("class", "layout-slot")
      .attr("data-layout-slot-id", function(d) { return d.id; })
      .call(cell);
      
      divs.exit()
      .remove("div");

      function cell() {
        this
        .style("left", function(d) { return d.x + "px"; })
        .style("top", function(d) { return d.y + "px"; })
        .style("width", function(d) { return Math.max(0, d.dx ) + "px"; })
        .style("height", function(d) { return Math.max(0, d.dy ) + "px"; });
      }

      _this.slotList(data);
      
    },
    
    availableSlot: function() {
       var toReturn = null;
       jQuery.each(this.slots, function(index, value) {
          if (!value.window) {
             toReturn = value.slotID;
             return false;
          }
       });
       return toReturn;
    },

    bindEvents: function() {
      var _this = this;

      d3.select(window).on('resize', function(event) {
        _this.calculateLayout();
      });
    },

    clearSlot: function(slotId) {
      if (this.slots[slodId].windowElement) { 
        this.slots[slotId].windowElement.remove();
      }
      this.slots[slotId].window = new $.Window();
    },

    addItem: function(slotID) {
      this.focusedSlot = slotID;
      this.parent.toggleLoadWindow();
    },

    hide: function() {
      jQuery(this.element).hide({effect: "fade", duration: 1000, easing: "easeOutCubic"});
    },

    show: function() {
      jQuery(this.element).show({effect: "fade", duration: 1000, easing: "easeInCubic"});
    }
  };

}(Mirador));


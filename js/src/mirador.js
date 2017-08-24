// This file defines the global Mirador constructor function.
// This is the entry point to Mirador and is intentionally sparse.
(function(global) {
  function Mirador(config) {
    jQuery.widget("custom.iconselectmenu", $.ui.selectmenu, {
      _renderItem: function(ul, item) {
        var li = $("<li>"),
          wrapper = $("<div>", {text: item.label});

        if (item.disabled) {
          li.addClass("ui-state-disabled");
        }

        $( "<span>", {
          style: item.element.attr("data-style"),
          "class": "ui-icon " + item.element.attr("data-class")
        })
          .appendTo(wrapper);

        return li.append(wrapper).appendTo(ul);
      }
    });

    if (this instanceof Mirador) {
        // initialize the event emitter for this mirador instance
        this.eventEmitter = new Mirador.EventEmitter();

        // pass the config through the save and restore process,
        // returning the config that will, in fact, populate the application
        this.saveController = new Mirador.SaveController(jQuery.extend(true, {}, config, {'eventEmitter': this.eventEmitter}));

        // initialize the application
        this.viewer = new Mirador.Viewer({
            'state': this.saveController,
            'eventEmitter': this.eventEmitter
        });
        return this;
    } else {
        return new Mirador(config);
    }
  }
  global.Mirador = global.Mirador || Mirador;
})(window);

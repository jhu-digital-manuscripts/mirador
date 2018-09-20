/**
 * New file to hold utility functions for handling TEI XML
 */


(function($) {
  $.TeiUtils = function(options) {
    jQuery.extend(this, {
      CETEI: null
    }, options);

    this.init();
  };

  $.TeiUtils.prototype = {
    init: function() {
      this.CETEI = new CETEI();
      this.CETEI.addBehaviors({
        handlers: {
          // p: this.pHandler,
          note: this.noteHandler,
          // list: this.listHandler,
          // head: this.headhandler,
          // item: this.itemHandler,
          // locus: this.locusHandler
        }
      });
    },

    getHTML5: function(url, callback) {
      return this.CETEI.getHTML5(url, callback);
    },

    pHandler: function(element) {

    },

    noteHandler: function(element) {
      var block = document.createElement('div');
      var title = document.createElement('h2');
      var text = document.createElement('p');

      title.innerHTML = element.getAttribute('rend');
      text.innerHTML = element.innerHTML;

      block.appendChild(title);
      block.appendChild(text);

      return block;
    },

    listHandler: function(element) {
      var list = document.createElement('ul');
      list.innerHTML = element.innerHTML;
      return list;
    },

    headhandler: function(element) {
      var result = document.createElement('h3');
      result.innerHTML = element.innerHTML;
      return result;
    },
    // List item
    itemHandler: function(element) {
      var item = document.createElement('li');
      item.innerHTML = element.innerHTML;
      return item;
    },

    locusHandler: function(element) {
      var block = document.createElement('a');
      block.innerText = element.innerText;
      return block;
    }
  };
}(Mirador));
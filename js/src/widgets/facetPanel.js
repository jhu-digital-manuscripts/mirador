/**
 * The "Facet Panel" is responsible for handling and displaying facets
 * for a search UI. This widget must know about a search service and
 * accept and emit events to handle facets correctly.
 *
 * In general, search facets form a tree with facets potentially leading
 * to more specific values drilling down into some search. Each of the
 * facets applies to an overall search query, which can be empty, for
 * a specific search service.
 *
 * Public functions:
 *  - setFacets(facets) : render the widget with a new set of facets
 */
(function($){
  $.FacetPanel = function(options) {
    jQuery.extend(true, this, {
      parentId: null,
      facetSelected: null,
      eventEmitter: null,
      facets: null,
      /**
       * Function specified by parent object telling this widget
       * what to do when a user selects a leaf.
       * function ([facets])
       */
      onSelect: null,
      model: {
        "core": {
          "data": []
        },
        "checkbox" : {
          "visible": false,
          "keep_selected_style" : true,
          "three_state": false,
        },
        "plugins": [
          "sort",
          // "state",        // Need to check API for configuration
          "wholerow",
          "checkbox"
        ]
      },
      element: null,
      appendTo: null,
      selector: ".facet-container",
      showCounts: true,
      container: "<div class=\"facet-container-scrollable\"><div class=\"facet-container\"></div></div>"
    }, options);
    this.id = $.genUUID();
    this.init();

  };

  $.FacetPanel.prototype = {
    init: function() {
      this.element = jQuery(this.container);
      this.appendTo.append(this.element);

      this.setFacets(this.facets);
      this.listenForActions();
      this.bindEvents();
    },

    bindEvents: function() {
      var _this = this;

      this.eventEmitter.subscribe("SEARCH_SIZE_UPDATED." + this.parentId, function() {
        var parent = _this.appendTo.parent();
        _this.element.css({
          "top": parent.position().top + parent.outerHeight(true) - 10 + "px"
        });
      });
    },

    listenForActions: function() {
      var _this = this;
      var tree = jQuery(this.selector);

      /**
       * data: {
       *   node: {},      // The node object of selected node
       *   selected: []   // Array of strings (node IDs)
       * }
       */
      // tree.on("select_node.jstree", function(event, data) {
      tree.on("activate_node.jstree", function(event, data) {
        if (!_this.isLeafNode(data.node)) {
          return;   // Only react to leaf nodes
        } else if (!_this.onSelect || typeof _this.onSelect !== "function") {
          return;   // Do nothing if 'onSelect' does not exist or is not a function
        }

        // Build array of facet objects
        var facets = [];
        var path = data.node.parents.slice(2);
        path.push(data.node.original.facet_id);

        facets.push({
          "dim": data.instance.get_node(data.node.parents[0]).original.facet_id,
          "path": path,
          "ui_id": data.node.id
        });

        if (_this.onSelect) {
          _this.onSelect(facets);
        }
      });
    },

    isLeafNode: function(node) {
      return !Array.isArray(node.children) || node.children.length === 0;
    },

    destroy: function() {
      this.appendTo.find(".facet-container-scrollable").remove();
    },

    /**
     * Render this widget with a new set of facets. This function will
     * overwrite any facets that are currently displayed
     *
     * @param facets {array} undefined or NULL will behave as empty array
     */
    setFacets: function(facets) {
      var _this = this;
      this.facets = facets;

      // Destroy and recreate tree
      if (Array.isArray(facets)) {
        this.model.core.data = [];
        facets.forEach(function(facet) { _this.addFacet(facet); });
        this.trimFacets();
        this.element.find(".facet-container").jstree(this.model);
        this.element.show();
      }
    },

    trimFacets: function() {
      this.model.core.data = this.model.core.data.filter(function(f) {
        return Array.isArray(f.children) && f.children.length > 0;
      });
    },

    addFacet: function(facet) {
      var hasDim = this.model.core.data.map(function(el) {
        return el.facet_id;
      }).indexOf(facet.dim) > 0;

      if (!hasDim) {
        this.model.core.data.push({
          "facet_id": facet.dim,
          "text": facet.label || facet.dim,
          "icon": false,
          "children": []
        });
      }

      var node = this.model.core.data.filter(function(el) {
        return el.facet_id === facet.dim;
      });
      if (node && node.length > 0) {
        this.add(node[0], facet.path, facet.count);
      }
    },

    add: function(node, path, count, index) {
      if (!index) {
        index = 0;
      }

      if (!node.children) {
        node.children = [];
      }

      var child = node.children.filter(function(c) {
        return c.facet_id === path[index];
      });
      if (child && child.length !== 0) {
        this.add(child, path, count, index+1);
      } else {
        this.addPath(node, path, count, index);
      }
    },

    addPath: function(node, path, count, index) {
      var toAdd = {
        "facet_id": path[index],
        "text": path[index] + (this.showCounts && count > 1 ? " (" + count + ")" : ""),
        "icon": false
      };

      if (!index) {
        index = 0;
      }

      if (Array.isArray(node.children)) {
        node.children.push(toAdd);
      } else {
        node.children = [toAdd];
      }

      if (index === path.length-1) {
        return;   // At target node
      } else {
        this.addPath(node.children[0], path, count, index+1);
      }
    },

  };
}(Mirador));

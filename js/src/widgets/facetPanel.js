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
    var _this = this;

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
          "data": [],
          "dblclick_toggle": false
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
        ],
        "sort": function(o1, o2) {
          var n1 = this.get_node(o1).text;
          var n2 = this.get_node(o2).text;
          if (!isNaN(n1) && !isNaN(n2)) {
            return n1 - n2;
          }
          return n1.localeCompare(n2);
        }
      },
      element: null,
      appendTo: null,
      selector: ".facet-container",
      showCounts: true,
      container: [
        "<div class=\"facet-container-scrollable\">",
          "<h2>Browse:<i class=\"fa fa-lg fa-times-circle clear\" title=\"Clear all\"></i></h2>",
          "<div class=\"facet-container\"></div>",
        "</div>"
      ].join("")
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
      var tree = this.element.find(this.selector);

      /**
       * This event is broadcast to ALL jsTree instances, so if a facet
       * panel is created in a Mirador slot AND the manifest browser,
       * both instances will recieve this event when a user interacts
       * with either instance.
       *
       * The specific instance is known in the event data.
       *
       * data: {
       *   node: {},      // The node object of selected node
       *   selected: []   // Array of strings (node IDs)
       * }
       */
      // tree.on("select_node.jstree", function(event, data) {
      tree.on("activate_node.jstree", function(event, data) {
        if (!_this.isLeafNode(data.node)) {console.log("[FP] Toggling category.");
          data.instance.toggle_node(data.node);
          return;   // Toggle category on single click
        } else
        if (!_this.onSelect || typeof _this.onSelect !== "function") {
          return;   // Do nothing if 'onSelect' does not exist or is not a function
        }

        if (_this.onSelect) {console.log("[FP] Selecting node");
          _this.onSelect([_this.nodeToFacet(data.node, data.instance)]);
        }
      });

      this.element.find("i.clear").on("click", function(event) {
        var facets = [];
        tree.jstree("get_selected", true).forEach(function(node) {
          if (node && _this.isLeafNode(node)) {
            facets.push(_this.nodeToFacet(node));
          }
        });

        if (_this.onSelect && typeof _this.onSelect === "function") {
          _this.onSelect(facets);
        }
        tree.jstree("deselect_all");
      });
    },

    nodeToFacet: function(node, instance) {
      var _this = this;

      var path;
      var dim;
      if (node.parent === "#") {
        // In this case, selected node is a top level category.
        // Dim is the facet_id, there is no path.
        dim = node.original.facet_id;
        path = [""];
      } else {
        path = node.parents.slice(2);
        path.push(node.original.facet_id);

        if (!instance) {
          jQuery(this.selector).each(function(index, el) {
            if (this.id === _this.id) {
              dim = jQuery(this).jstree("get_node", node.parents[0]).original.facet_id;
            }
          });
        } else {
          dim = instance.get_node(node.parents[0]).original.facet_id;
        }
      }

      return {
        "dim": dim,
        "path": path,
        "ui_id": node.id
      };
    },

    /**
     * It is possible to specify categories without declaring values under
     * them. In this case, the categories will technically be leaf nodes
     * in the tree. However, we do not want them to be "selectible" in
     * the same way that values are selectible.
     */
    isLeafNode: function(node) {
      return (!Array.isArray(node.children) || node.children.length === 0);
    },

    destroy: function() {
      this.appendTo.find(".facet-container-scrollable").remove();
    },

    /**
     * @param categories (array)
     *    [
            {
              "label": "...",
              "name": "an-id"
            },
            ...
          ]
     */
    setCategories: function(categories) {console.log("[FP] Setting categories: " + JSON.stringify(categories));
      var _this = this;
      this.model.core.data = [];
      categories.forEach(function(cat) {
        _this.model.core.data.push({
          "facet_id": cat.name,
          "text": cat.label,
          "icon": false,
          // "children": []
        });
      });
      this.element.find(".facet-container").jstree(this.model);
      this.element.find(".facet-container").prop("id", _this.id);
      this.element.show();
    },



    /**
     * Render this widget with a new set of facets. This function will
     * overwrite any facets that are currently displayed
     *
     * Accepts array of categories with no child values, or an array
     * of categories with child values.
     *
     * Categories must be adapted to data model for use in the tree
     * widget by specifying a facet_id, dimension, text for each
     * object.
     *
     * @param facets {array} undefined or NULL will behave as empty array
     *        facets: [
     *          {
     *            "name": "facet_id",     // Facet "dimension"
     *            "label": "A Label for this" // Human readable label for the category
     *            "values": [
     *              "label": "A Label",   // Facet "path"
     *              "count": 1            // Facet "count"
     *            ]
     *          }
     *        ]
     */
    setFacets: function(facets) {console.log("[FP] Setting facets: " + facets);
      var _this = this;
      this.facets = facets;

      // Destroy and recreate tree
      if (Array.isArray(facets)) {
        this.model.core.data = facets;
        this.model.core.data.forEach(function(facet) {
          jQuery.extend(facet, {
            "facet_id": facet.name,
            "text": facet.label,
            "icon": false
          });
          if (Array.isArray(facet.values)) {
            // Transform 'values' to 'children' usable by tree widget
            facet.values.forEach(function(val) {
              jQuery.extend(val, {
                "facet_id": facet.name,
                "text": val.label + (val.count > 1 ? " (" + val.count + ")": ""),
                "icon": false
              });
            });
            facet.children = facet.values;
            facet.values = undefined;
          }
        });
        console.log("[FP] Model: " + JSON.stringify(this.model, null, 2));
        // this.model.core.data = [];
        // facets.forEach(function(facet) { _this.addFacet(facet); });
        // this.trimFacets();
        this.element.find(".facet-container").jstree(this.model);
        this.element.find(".facet-container").prop("id", _this.id);
        this.element.show();
      }
    },

    trimFacets: function() {
      this.model.core.data = this.model.core.data.filter(function(f) {
        return Array.isArray(f.children) && f.children.length > 0;
      });
    },

    // addFacet: function(facet) {
    //   var hasDim = this.model.core.data.map(function(el) {
    //     return el.facet_id;
    //   }).indexOf(facet.dim) > 0;
    //
    //   if (!hasDim) {
    //     this.model.core.data.push({
    //       "facet_id": facet.dim,
    //       "text": facet.label || facet.dim,
    //       "icon": false,
    //       "children": []
    //     });
    //   }
    //
    //   var node = this.model.core.data.filter(function(el) {
    //     return el.facet_id === facet.dim;
    //   });
    //   if (node && node.length > 0) {
    //     this.add(node[0], facet.path, facet.count);
    //   }
    // },
    //
    // add: function(node, path, count, index) {
    //   if (!index) {
    //     index = 0;
    //   }
    //
    //   if (!node.children) {
    //     node.children = [];
    //   }
    //
    //   var child = node.children.filter(function(c) {
    //     return c.facet_id === path[index];
    //   });
    //   if (child && child.length !== 0) {
    //     this.add(child, path, count, index+1);
    //   } else {
    //     this.addPath(node, path, count, index);
    //   }
    // },
    //
    // addPath: function(node, path, count, index) {
    //   var toAdd = {
    //     "facet_id": path[index],
    //     "text": path[index] + (this.showCounts && count > 1 ? " (" + count + ")" : ""),
    //     "icon": false
    //   };
    //
    //   if (!index) {
    //     index = 0;
    //   }
    //
    //   if (Array.isArray(node.children)) {
    //     node.children.push(toAdd);
    //   } else {
    //     node.children = [toAdd];
    //   }
    //
    //   if (index >= path.length-1) {
    //     return;   // At target node
    //   } else {
    //     this.addPath(node.children[0], path, count, index+1);
    //   }
    // },

  };
}(Mirador));

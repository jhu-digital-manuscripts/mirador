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
 *  - setFacets(facets) : render the widget with a new set of facets. This
 *                        will overwrite any existing facets.
 *  - addValues(category, values) : add values under a category. Add the
 *                                  category if necessary
 *  - getSelectedNodes(): get JSON representation of all currently selected nodes
 *  - getNodes(nodes) : get JSON representations of all nodes specified by ID.
 *                      If no IDs are specified, get all nodes in the tree
 *
 * EVENTS:
 *  Publish:
 *    FACET_SELECTED : one or more facets has been selected (or deselected)
 *      {
 *        "origin": "widget id",
 *        "selected": []        // Array of selected facets
 *      }
 */
(function($){
  $.FacetPanel = function(options) {
    var _this = this;

    jQuery.extend(true, this, {
      parentId: null,
      facetSelected: null,
      eventEmitter: null,
      state: null,          // Application state
      /**
       *  "facet_id": {
       *    "open": (true|false),     // Is this category displayed (open)?
       *    "values": []              // All selected values for this category
       *  }
       */
      wState: {},           // Widget state
      facets: null,
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
          // "state",        // Need to check API for configuration
          "wholerow",
          "checkbox"
        ],
      },
      element: null,
      appendTo: null,
      selector: ".facet-container",
      showCounts: true,
      selected: {},
      container: [
        "<div class=\"facet-container-scrollable\">",
          "<h2>Browse:<span class=\"clear-btn\">Clear all<i class=\"fa fa-lg fa-times-circle\" title=\"Clear all\"></i></span></h2>",
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

    // TODO jstree event handlers here might conflict with other instances of jstree
    // not in this widget.
    listenForActions: function() {
      var _this = this;
      var tree = this.element.find(this.selector);
      var clearBtn = this.element.find(".clear-btn");

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
        _this.modifyState(data.node);

        if (!_this.isLeafNode(data.node)) {
          data.instance.toggle_node(data.node);
          return;   // Toggle category on single click
        }

        // Find all selected values, filtering out top level categories
        var nodes = tree.jstree("get_selected", true).filter(function(node) {
          return node && _this.isLeafNode(node);
        });
        if (!nodes || nodes.length === 0) {
          clearBtn.hide();
        } else {
          clearBtn.show();
        }

        _this.eventEmitter.publish("FACET_SELECTED", {
          "origin": _this.id,
          "selected": data.selected
        });
      });

      /**
       * Changing tree data, must wait for the refresh to complete
       *
       * data: {obj} tree instance
       */
      tree.on("refresh.jstree", function(event, data) {
        _this.applyState(_this.wState);
      });

      /**
       * Called after a node has been created successfully.
       *
       *  data: {
       *    "node": {},
       *    "parent": "parentId",
       *    "position": "0"     // Position of the node among the parent children
       *  }
       */
      tree.on("create_node.jstree", function(event, data) {
        _this.applyState(_this.wState);
      });

      // "Clear All" button
      clearBtn.on("click", function(event) {
        var facets = [];
        var nodes = [];
        tree.jstree("get_selected", true).forEach(function(node) {
          if (node && _this.isLeafNode(node)) {
            nodes.push(node);
            facets.push(_this.nodeToFacet(node));
          }
        });

        tree.jstree("deselect_node", nodes, true);
        _this.modifyState(nodes);
        clearBtn.hide();
        _this.eventEmitter.publish("FACET_SELECTED", {
          "origin": _this.id,
          "selected": facets
        });
      });
    },

    nodeToFacet: function(node, instance) {
      var _this = this;
      instance = this.element.find(this.selector).jstree(true);

      var path;
      var dim;
      if (node.parent === "#") {
        // In this case, selected node is a top level category.
        // Dim is the facet_id, there is no path.
        dim = node.original.facet_id;
        path = [""];
      } else {
        path = node.parents.slice(2);
        path.push(node.original.label);
        dim = instance.get_node(node.parents[0]).original.facet_id;
      }

      return {
        "category": dim,
        "value": path,
        "ui_id": node.id,
        "children": node.children,
        "isRoot": node.parent === "#"
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
    setFacets: function(facets, clearState) {
      var _this = this;
      var needsInit = this.model.core.data.length === 0;

      if (clearState) {
        this.wState = {};
      }

      this.facets = facets;
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
                "text": val.label + " (" + val.count + ")",
                "icon": false
              });
            });
            facet.children = facet.values;
            facet.values = undefined;
          }
        });

        var widget = this.element.find(this.selector);
        if (needsInit) {    // Create JSTree instance if necessary
          widget.jstree(this.model);
          widget.prop("id", _this.id);
          this.applyState(this.wState);
        } else {            // Otherwise, replace data and redraw

          widget.jstree(true).settings.core.data = this.model.core.data;
          widget.jstree("refresh");
        }
        this.element.show();
      }
    },

    /**
     * Add values to a category in the tree. If the category is not yet
     * defined, add it to the tree first.
     *
     * IMPL notes
     *  jstree.create_node([par, node, pos, callback, is_loaded])
     *    par: parent node ("#" to add a root node)
     *    node: node to add
     *
     * @param category {obj} {[text, facet_id]}
     * @param values {array} array of values to add
     */
    addValues: function(category, values) {
      var instance = this.element.find(this.selector).jstree(true);

      // Find node matching the category
      var treeCats = instance.get_json().filter(function(node) {
        return node.original.facet_id === category.facet_id;
      });

      if (treeCats.length) {
        // If no match is found, create the category and get the node
        var newNode = instance.create_node("#", category);
        treeCats = [instance.get_node(newNode)];
      }

      // Add values to appropriate category
      values.forEach(function(val) {
        var toAdd = {
          "facet_id": category,
          "text": val.label + " (" + val.count + ")"
        };
        instance.create_node(treeCats[0], toAdd);
      });
    },

    /**
     * We don't want to return category nodes (no value selected)
     * @returns JSON representations of all selected nodes.
     */
    getSelectedNodes: function() {
      var _this = this;
      return this.element.find(this.selector).jstree(true).get_selected(true)
              .map(function(node) { return _this.nodeToFacet(node); })
              .filter(function(facet) { return !facet.isRoot; });
    },

    /**
     * @returns Full JSON representations of nodes by ID. If no IDs are
     * specified, return all nodes.
     */
    getNodes: function(nodeIds) {
      var _this = this;
      var instance = this.element.find(this.selector).jstree(true);
      return instance.get_json(nodeIds, {
        "no_state": true,
        "no_li_attr": true,
        "no_a_attr": true,
        "flat": true
      }).map(function(node) { return _this.nodeToFacet(node); });
    },

    trimFacets: function() {
      this.model.core.data = this.model.core.data.filter(function(f) {
        return Array.isArray(f.children) && f.children.length > 0;
      });
    },

    /**
     * The state of this widget contains information about all currently
     * selected nodes in the tree that lead to the current tree. It
     * has information about which categories are open and which
     * values are selected. Note that selected values are especially
     * important, as they directly lead to facet search requests that
     * generate the tree.
     *
     * If no objects are supplied to mutate the state, this will clear
     * the state.
     *
     * @param modified {array} of facet objects
     */
    modifyState: function(modified) {
      if (!modified) {
        this.wState = {};
        return;
      }

      var _this = this;
      if (Array.isArray(modified)) {
        modified.forEach(function(m) { _this.doStateChange(m); });
      } else {
        this.doStateChange(modified);
      }
    },

    /**
     * Modify the current state of the object by applying a facet
     * object. This object may or may not have a selected value.
     *
     * @param modified facet object
     * @returns state with mod applied
     */
    doStateChange: function(mob) {
      var _this = this;
      var state = this.wState;
      /*
       * From the mob, find the appropriate category and value
       * in the current state.
       * > If no value in MOB, then mark category appropriately as
       *   selected or not
       * > If it exists, remove it from the state (deselect)
       * > If does not exist, add it to the state (select)
       */
      var cat = state[mob.original.facet_id];
      if (!cat) { // No matches. This will add category AND value (if present)
        cat = {"open": true, "values": []};
      } else if (mob.parent === "#"){  // Mob is a category (as opposed to value node)
        cat.open = !cat.open;
      }

      if (mob.original.label) {
        var index = cat.values.indexOf(mob.original.label);
        if (index === -1) { // Add value if not already there
          cat.values.push(mob.original.label);
        } else if (cat.values.length > 1) { // Remove value if it is not alone
          cat.values.splice(index, 1);
        } else { // If this value is the only one in the list, get rid of this state category
          cat = undefined;
        }
      }

      if (!cat) {
        delete(state[mob.original.facet_id]);
      } else {
        state[mob.original.facet_id] = cat;
      }
    },

    /**
     * Apply a state to the UI. This will open or close appropriate
     * categories and select or deselect appropriate values.
     *
     * @param state {object} state to apply
     */
    applyState: function(state) {
      var _this = this;
      var instance = this.element.find(this.selector).jstree(true);

      instance.close_all();
      instance.deselect_all(true);
      Object.keys(state).forEach(function(key) {
        var cat = state[key];

        var catNode = _this.getTreeNode(instance, key);
        // Open or close node appropriately
        if (catNode) {
          if (cat.open && !catNode.state.opened) {
            instance.open_node(catNode);
          } else if (!cat.open && catNode.state.opened) {
            instance.close_node(catNode);
          }
        }

        // Select all values found in 'state'
        cat.values.forEach(function(val) {
          var valNode = _this.getTreeNode(instance, key, val);
          if (valNode && !valNode.state.selected) {
            instance.select_node(valNode);
            // Force CSS class
            var domSelector = valNode.li_attr.id + " > div";
            _this.element.find(domSelector).addClass("jstree-wholerow-clicked");
          }
        });
      });
    },

    getTreeNode: function(instance, category, value) {
      var data = instance.get_json(null, {
        "no_state": true,
        "no_li_attr": true,
        "no_a_attr": true,
        "flat": true
      });

      var matches = data.filter(function(n) {
        var treeNode = instance.get_node(n.id);
        // Match if (no value AND category match) OR (category match AND value match)
        return (treeNode.original.facet_id === category) && (!value || treeNode.original.label === value);
      });

      if (matches.length > 0) {
        return instance.get_node(matches[0].id);
      } else {
        console.log("[FP] Failed to find node. " + category + ":" + value);
        return undefined;
      }
    }

  };
}(Mirador));

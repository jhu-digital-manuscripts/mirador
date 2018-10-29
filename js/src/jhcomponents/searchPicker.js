(function ($) {
  $.SearchPicker = function (options) {
    jQuery.extend(true, this, {
      windowId: undefined,
      tabId: null,
      parent: null,
      element: null,
      appendTo: null,
      state: null,
      eventEmitter: null,
      
      baseObject: null,
      searchServices: [],

      config: {
        inSidebar: false,
        showCollectionPicker: true
      },

      searchController: null,
      selected: null,
    }, options);

    this.init();
  };

  $.SearchPicker.prototype = {
    init: function () {
      this.element = jQuery(this.template({
        inSidebar: this.config.inSidebar,
        showCollectionPicker: this.config.showCollectionPicker
      })).appendTo(this.appendTo);

      this.bindEvents();
      this.listenForActions();
    },

    bindEvents: function () {
      const _this = this;

      this.eventEmitter.subscribe("RELATED_SEARCH_SERVICES_FOUND." + this.windowId, function(event, data) {
        /*
         * Add search service ID to list.
         * Fetch info.json only when that service is selected for the first time.
         */
        data.services.forEach(function(service) {
          _this.addSearchService(service);
        });
      });
    },

    listenForActions: function () {
      const _this = this;

      const selectChange = function () {
        const el = jQuery(this);
        if (!el) {
          return;
        }
        _this.switchSearchServices(el.val());
      };

      this.element.find(".search-within-object-select").on("change", selectChange);
      if (!this.config.inSidebar) {
        this.element.find(".search-within-object-select").iconselectmenu({
          change: selectChange
        });
      }
    },

    switchSearchServices: function (service) {
      this.eventEmitter.publish('SWITCH_SEARCH_SERVICE', {
        origin: this.windowId,
        service
      });
      // this.element.find('.search-within-object-select').val(service.id);
    },

    addSearchService: function(service) {
      if (!this.config.searchBooks && service["@id"].indexOf("manifest") >= 0) {
        console.log("[SW] Found a book, but ignoring it.");
        return; // End early if encountering a service for a book when they should not be included.
      }

      var _this = this;
      var id = service.id || service["@id"] || service;
      // Search service will likely NOT have an 'id' property, but instead
      //  have a '@id' property. Change this to 'id' for things to work.
      service.id = id;

      // First check search services for duplicates. If service already present
      // with desired ID of this service, update its entry. Otherwise, add it.
      var found = this.searchServices.filter(function(s) {
        return s.id === id;
      });

      if (found.length === 0) {
        // If this is a new service, add it to the UI and push it to
        // the list of known services.
        this.searchServices.push(service);
        this.addServiceToDropdown(id);
      } else {
        found.forEach(function(s) {
          jQuery.extend(true, s, service);  // This will not overwrite any currently present properties.
        });
      }
      // Initialize advanced search with first encountered search service.
      // For subsequent services, if the service is supposed to be selected
      // according to a previous context, switch to it.
      if ((this.context && this.context.searchService === id) || !this.advancedSearchSet) {
        // When adding a search service, if the ID of the service matches the ID of the initialization value, 
        // switch to it.
        this.switchSearchServices(service);
        if (!this.advancedSearchSet) {
          this.listenForActions();
        }
        this.advancedSearchSet = true;
      }
    },

    /**
     * Use knowlege of the DOM structure to insert an element for the
     * input collection in the correct place.
     *
     * @param id {string} ID search service
     */
    addServiceToDropdown: function(id) {
      var _this = this;
      var stylized = !this.config.inSidebar;  // Should do setup for fancy dropdown?
      var col = this.state.getObjFromSearchService(id);
      if (!col) {
        return false;
      }

      var template = {
        "objId": id,
        // ID here is a search service ID, so strip off the trailing portion
        "cssClass": $.Iiif.getCollectionName(id.substring(0, id.lastIndexOf("/"))),
        "label": col.jsonLd.label,
        "inSidebar": stylized
      };

      var moo = this.element.find(".search-within-object-select");
      if (moo.children().length === 0) {  // If no children exist in the dropdown, add it immediately
        moo.append(jQuery(_this.optionTemplate(template)));
        if (stylized) moo.iconselectmenu("refresh");
        return;
      }

      // Make sure we don't add duplicate entries. Match by ID
      var duplicateMatches = moo.children().filter(function(opt) {
        opt = jQuery(opt);
        return opt.attr("value") ? opt.attr("value").substring(0, opt.attr("value").lastIndexOf("/")) == id : false;
      });
      if (duplicateMatches.length > 0) {
        // Desired ID already in dropdown
        return;
      }
      /*
       * We must first get the collection object. From there, we can inspect
       * some metadata. Initial design will not support deeply nested collections.
       *
       * Iterate through all <option>s in the select.
       *   > If the current option data-name matches collection _parent_
       *      - append optionEl after the option, add 'child' css class to optionEl
       *   > If the current option data-name matches collection _child_
       *      - Number of 'child' css classes to add to optionEl = number of
       *        'child' css classes on current option
       *      - Add 'child' css class to current option
       *      - Prepend optionEl before curren option
       *   > If current option data-name matches optionEl name, terminate immediately,
       *     as duplicates must not be added to the list
       */
      moo.children().each(function(index, el) {
        el = jQuery(el);
        var elId = el.attr("value").substring(0, el.attr("value").lastIndexOf("/"));
        var elObj = _this.state.getObjFromSearchService(el.attr("value"));

        if (col.isWithin(elId)) { // Is the object to add a child of this <option>?
          template.cssClass += " child";
          jQuery(_this.optionTemplate(template)).insertAfter(el);
          if (stylized) moo.iconselectmenu("refresh");
        } else if (elObj && elObj.isWithin(id.substring(0, id.lastIndexOf('/')))) { // Is the object to add a parent of this <option>?
          jQuery(_this.optionTemplate(template)).insertBefore(el);
        } else {
          var elCollection = $.Iiif.getCollectionName(elId);
          // Find all children of 'col' that match the current <option>
          var numChildMatches =
            (col.getCollectionUris ? col.getCollectionUris().filter(function(uri) {
              return uri === elId;
            }).length : 0) ||
            (col.getManifestUris ? col.getManifestUris().filter(function(uri) {
              return uri === elId;
            }).length : 0);

          if (numChildMatches > 0 && el.attr("class")) {
            // Count # of times 'child' class appears in current <option>
            var numChilds = (el.attr("class").match(/child/g) || []).length;
            if (numChilds > 0) {
              template.cssClass += " child-" + numChilds;
            }
            jQuery(_this.optionTemplate(template)).insertBefore(el);
            if (stylized) moo.iconselectmenu("refresh");
          }
        }
      });
    },

    optionTemplate: Handlebars.compile([
      '{{#if inSidebar}}',
        '<option value="{{objId}}" {{#if cssClass}}data-class="{{cssClass}}"{{/if}}>{{label}}</option>',
      '{{else}}',
        '<option value="{{objId}}">{{label}}</option>',
      '{{/if}}'
    ].join('')),

    template: Handlebars.compile([
      '{{#if showCollectionPicker}}',
        '<div class="{{#if inSidebar}}manifest-picker-sidebar{{else}}manifest-picker{{/if}}">',
          '<label>{{#if inSidebar}}Search Within:{{else}}Choose Collection:{{/if}}',
            '<select class="search-within-object-select"></select>',
          '</label>',
          '<div class="manifest-picker-desc"></div>',
        '</div>',
      '{{/if}}'
    ].join(''))
  };
}(Mirador));
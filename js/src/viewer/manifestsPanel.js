(function ($) {

  $.ManifestsPanel = function (options) {

    jQuery.extend(true, this, {
      element: null,
      listItems: null,
      appendTo: null,
      manifestListItems: [],
      manifestListElement: null,
      manifestLoadStatusIndicator: null,
      resultsWidth: 0,
      state: null,
      eventEmitter: null,
      searcher: null,
      selectedObjects: []    // Array of IDs that have been selected to display. Can be manifests or collections
    }, options);

    var _this = this;
    _this.init();

  };

  $.ManifestsPanel.prototype = {

    init: function () {
      var _this = this;
      this.element = jQuery(this.template({
        showURLBox: this.state.getStateProperty('showAddFromURLBox')
      })).appendTo(this.appendTo);
      this.manifestListElement = this.element.find('.items-listing');

      //this code gives us the max width of the results area, used to determine how many preview images to show
      //cloning the element and adjusting the display and visibility means it won't break the normal flow
      var clone = this.element.clone().css("visibility", "hidden").css("display", "block").appendTo(this.appendTo);
      this.resultsWidth = clone.find('.select-results').outerWidth();
      this.controlsHeight = clone.find('.manifest-panel-controls').outerHeight();
      this.paddingListElement = this.controlsHeight;
      // this.manifestListElement.css("padding-bottom", this.paddingListElement);
      clone.remove();

      this.hasSearcher = this.state.getStateProperty('manifestList').enableSearch;
      this.facetable = this.state.getStateProperty('manifestList').enableFacets;
      this.searchConfig = this.state.getStateProperty('manifestList').search;
      this.showLogos = this.state.getStateProperty('manifestList').showLogos;

      if (this.hasSearcher) {
        this.searcher = new $.SearchContainer({
          "appendTo": this.element.find(".browser-search"),
          "windowId": undefined,
          "eventEmitter": this.eventEmitter,
          "state": this.state,
          "showHideAnimation": { duration: 160, easing: "easeOutCubic", queue: false },
          "config": {
            "hasContextMenu": false,
            "searchBooks": false,
            "allowFacets": this.state.getStateProperty('manifestList').enableFacets,
            "showCollectionPicker": this.searchConfig.showCollectionPicker,
            "showDescription": this.searchConfig.showDescription
          },
          // "onFacetSelect": function (selected) {
          //   _this.filterManifestList(selected);
          // },
          searchController: new $.SearchController({
            eventEmitter: this.eventEmitter
          }),
          context: {
            searchService: this.state.getStateProperty('initialCollection') // Set initial collection, if possible
          }
        });

        if (!this.facetable) {
          this.element.find('.search-results-display').addClass('full-width');
          this.element.find('.select-results').css({
            "left": 0,
            "top": (this.searchConfig.showCollectionPicker ? "191px" : "144px")
          });
        } else {
          this.setContainerPositions();
        }
      } else {
        this.filterManifestList();
        this.element.find('.select-results').css({
          "top": "36px",
          "left": 0
        });
      }

      // this.manifestLoadStatusIndicator = new $.ManifestLoadStatusIndicator({
      //   manifests: this.parent.manifests,
      //   appendTo: this.element.find('.select-results')
      // });
      this.bindEvents();
      this.listenForActions();
    },

    listenForActions: function () {
      var _this = this;

      // handle subscribed events
      _this.eventEmitter.subscribe('manifestsPanelVisible.set', function (_, data) {
        _this.onPanelVisible(_, data);
      });

      _this.eventEmitter.subscribe('manifestReceived', function (event, newManifest) {
        _this.onManifestReceived(event, newManifest);
      });

      _this.eventEmitter.subscribe("collectionReceived", function (event, collection) {
        _this.eventEmitter.publish('ADD_IIIF_OBJECT', {
          origin: _this.windowId,
          object: collection
        });
      });

      _this.eventEmitter.subscribe("manifestReferenced", function (event, ref, location) {
        _this.onManifestReferenced(ref, location);
      });

      if (this.hasSearcher) {
        _this.eventEmitter.subscribe("SEARCH_SIZE_UPDATED." + this.searcher.windowId, function () {
          _this.setContainerPositions();
        });
        _this.eventEmitter.subscribe('SET_COLLECTION', function (event, collection) {
          // _this.getSearchService(selected).done(function(s) {
          //   _this.switchSearchServices(s);
          //   _this.eventEmitter.publish("SEARCH_SIZE_UPDATED." + _this.windowId);
          // });
          if (!collection.endsWith('/jhsearch')) {
            collection += '/jhsearch';
          }
          _this.searcher.getSearchService(collection).done(function (service) {
            // console.log(' <<< ');
            // console.log(service);
            _this.searcher.switchSearchServices(service);
            _this.eventEmitter.publish('SEARCH_SIZE_UPDATED.' + _this.searcher.windowId);
          });
        });

        _this.eventEmitter.subscribe('UPDATE_FACET_BOOK_LIST', (event, data) => {
          if (data.origin === _this.windowId) {
            _this.filterManifestList(data.bookList);
          }
        });
      }
    },

    bindEvents: function () {
      var _this = this;

      // handle interface events
      this.element.find('form#url-load-form').on('submit', function (event) {
        event.preventDefault();
        _this.addManifestUrl(jQuery(this).find('input').val());
      });

      this.element.find('.remove-object-option').on('click', function (event) {
        _this.togglePanel(event);
      });

      // Filter manifests based on user input
      this.element.find('#manifest-search').on('keyup input', function (event) {
        _this.filterManifests(this.value);
      });

      this.element.find('#manifest-search-form').on('submit', function (event) {
        event.preventDefault();
      });

      this.element.find(".browser-search-container .close").on("click", function (event) {
        _this.element.find(".browser-search-container").hide();
      });

      jQuery(window).resize($.throttle(function () {
        _this.resizePanel();
      }, 50, true));
    },

    /**
     * Filter the manifest list UI to display only the selected
     * items.
     *
     * An object is "selected" >> visible if its ID is in the
     * 'selected' list OR if one of the 'selected' IDs is in
     * the object's 'within' property.
     *
     * @param selected array of strings, IDs for selected items
     */
    filterManifestList: function (selected) {
      var _this = this;
      this.selectedObjects = selected || [];

      this.element.find(".select-results").scrollTop(0);

      // selected is an array of strings, manifest IDs
      if (!selected) {
        this.manifestListItems.forEach(function (item) { item.element.show(); });
      } else {
        this.manifestListItems.forEach(function (item) {
          if (_this.manifestVisible(item.manifest) || _this.manifestVisible(item.manifestRef)) {
            item.element.show();    // This manifest is 'selected'
          } else {
            item.element.hide();
          }
        });
      }
    },

    manifestVisible: function (manifest) {
      if (!manifest) {
        return false;
      }
      var manifestId = manifest.hasOwnProperty("getId") ? manifest.getId() : manifest["@id"];
      if (!manifestId) {
        if (manifest.hasOwnProperty("jsonLd")) {
          manifestId = manifest.jsonLd["@id"];
        } else {
          return false;
        }
      }

      // If there is no search widget OR if there are no facets, force visible
      if (!this.hasSearcher || !this.facetable) {
        return true;
      }
      // Visible IF
      //    there is a search+facet widgets AND
      //    no selected objects OR
      //    manifest ID is not in selected objects  OR
      //    any manifest parent is in the selected objects
      return !Array.isArray(this.selectedObjects) || this.selectedObjects.indexOf(manifestId) !== -1;
    },

    hide: function () {
      var _this = this;
      jQuery(this.element).hide({ effect: "fade", duration: 160, easing: "easeOutCubic" });
    },

    show: function () {
      var _this = this;
      jQuery(this.element).show({ effect: "fade", duration: 160, easing: "easeInCubic" });
    },

    addManifestUrl: function (url) {
      var _this = this;
      _this.eventEmitter.publish('ADD_MANIFEST_FROM_URL', [url, "(Added from URL)"]);
    },

    togglePanel: function (event) {
      var _this = this;
      _this.eventEmitter.publish('TOGGLE_LOAD_WINDOW');
    },

    filterManifests: function (value) {
      var _this = this;
      if (value.length > 0) {
        _this.element.find('.items-listing li').show().filter(function () {
          return jQuery(this).text().toLowerCase().indexOf(value.toLowerCase()) === -1;
        }).hide();
      } else {
        _this.element.find('.items-listing li').show();
      }
    },

    resizePanel: function () {
      var _this = this;
      var clone = _this.element.clone().css("visibility", "hidden").css("display", "block").appendTo(_this.appendTo);
      _this.resultsWidth = clone.find('.select-results').outerWidth();
      clone.remove();
      _this.eventEmitter.publish("manifestPanelWidthChanged", _this.resultsWidth);
    },

    onPanelVisible: function (_, stateValue) {
      var _this = this;
      if (stateValue) { _this.show(); return; }
      _this.hide();
    },

    onManifestReceived: function (event, newManifest) {
      var _this = this;
      _this.manifestListItems.push(new $.ManifestListItem({
        manifest: newManifest,
        resultsWidth: _this.resultsWidth,
        state: _this.state,
        eventEmitter: _this.eventEmitter,
        appendTo: _this.manifestListElement,
        visible: _this.manifestVisible(newManifest)
      }));
      // _this.element.find('#manifest-search').keyup();

      this.eventEmitter.publish('ADD_IIIF_OBJECT', {
        origin: this.windowId,
        object: newManifest.jsonLd
      });
      // if (this.searcher) {
      //   this.searcher.addIIIFObject(newManifest.jsonLd);
      // }
    },

    onManifestReferenced: function (reference, location) {
      this.manifestListItems.push(new $.ManifestListItem({
        manifestRef: reference,
        resultsWidth: this.resultsWidth,
        state: this.state,
        eventEmitter: this.eventEmitter,
        appendTo: this.manifestListElement,
        visible: this.manifestVisible(reference),
        showLogo: this.showLogos,
        location: location,
      }));
      // this.element.find("#manifest-search").keyup();
    },

    setContainerPositions: function () {
      var vals;
      if (this.searcher) {
        if (this.facetable) {
          vals = { "top": 0 };
          if (this.searchConfig.showCollectionPicker && this.searchConfig.showDescription) {
            vals.top = "15%";
          } else if (this.searchConfig.showCollectionPicker && !this.searchConfig.showDescription) {
            vals.top = "91px";
          }

          this.element.find(".select-results").css(vals);
          this.element.find(".search-results-display").css(vals);
        } else {
          var resizedEl = this.element.find(".browser-search-container");
          vals = {
            "top": resizedEl.position().top + resizedEl.outerHeight(true) + "px"
          };

          this.element.find(".select-results").css(vals);
          this.element.find(".search-results-display").css(vals);
        }
      }
    },

    template: Handlebars.compile([
      '<div id="manifest-select-menu">',
        '<div class="container-fluid">',
          '<div class="manifest-panel-controls">',
            '<a class="remove-object-option"><i class="fa fa-times fa-lg fa-fw"></i>{{t "close"}}</a>',
            '<div id="load-controls">',
              '{{#if showURLBox}}',
                '<form action="" id="url-load-form">',
                  '<label for="url-loader">{{t "addNewObject"}}:</label>',
                  '<input type="text" id="url-loader" name="url-load" placeholder="http://...">',
                  '<input type="submit" value="{{t "load"}}">',
                '</form>',
              '{{/if}}',
              '<div class="browser-search-container">',
                '<div class="browser-search"></div>',
              '</div>',
            '</div>',
          '</div>',
          '<div class="select-results">',
            '<ul class="items-listing">',
            '</ul>',
            // '<table class="items-listing"></table>',
          '</div>',
        '</div>',
      '</div>'
    ].join(''))
  };

}(Mirador));

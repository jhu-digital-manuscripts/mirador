(function($) {

    $.ManifestsPanel = function(options) {

        jQuery.extend(true, this, {
            element:                    null,
            listItems:                  null,
            appendTo:                   null,
            manifestListItems:          [],
            manifestListElement:        null,
            manifestLoadStatusIndicator: null,
            resultsWidth:               0,
            state:                      null,
            eventEmitter:               null,
            searcher:                   null,
            selectedObjects:            []    // Array of IDs that have been selected to display. Can be manifests or collections
        }, options);

        var _this = this;
        _this.init();

    };

    $.ManifestsPanel.prototype = {

        init: function() {
            var _this = this;
            this.element = jQuery(this.template({
                showURLBox : this.state.getStateProperty('showAddFromURLBox')
            })).appendTo(this.appendTo);
            this.manifestListElement = this.element.find('ul');

            //this code gives us the max width of the results area, used to determine how many preview images to show
            //cloning the element and adjusting the display and visibility means it won't break the normal flow
            var clone = this.element.clone().css("visibility","hidden").css("display", "block").appendTo(this.appendTo);
            this.resultsWidth = clone.find('.select-results').outerWidth();
            this.controlsHeight = clone.find('.manifest-panel-controls').outerHeight();
            this.paddingListElement = this.controlsHeight;
            // this.manifestListElement.css("padding-bottom", this.paddingListElement);
            clone.remove();

            if (this.state.getStateProperty("initialCollection")) {
              this.selectedObjects.push(this.state.getStateProperty("initialCollection"));
            }

            this.searcher = new $.NewSearchWidget({
              "appendTo": this.element.find(".browser-search"),
              "windowId": $.genUUID(),
              "eventEmitter": this.eventEmitter,
              "state": this.state,
              "showHideAnimation": {duration: 160, easing: "easeOutCubic", queue: false},
              "config": {
                "hasContextMenu": false,
                "searchBooks": false
              },
              "onFacetSelect": function(selected) {
                _this.filterManifestList(selected);
              }
            });

            // this.manifestLoadStatusIndicator = new $.ManifestLoadStatusIndicator({
            //   manifests: this.parent.manifests,
            //   appendTo: this.element.find('.select-results')
            // });
            this.bindEvents();
            this.listenForActions();
        },

        listenForActions: function() {
          var _this = this;

          // handle subscribed events
          _this.eventEmitter.subscribe('manifestsPanelVisible.set', function(_, stateValue) {
            _this.onPanelVisible(_, stateValue);
          });

          _this.eventEmitter.subscribe('manifestReceived', function(event, newManifest) {
            _this.onManifestReceived(event, newManifest);
          });

          _this.eventEmitter.subscribe("collectionReceived", function(event, collection) {
            _this.onCollectionReceived(collection);
          });

          _this.eventEmitter.subscribe("manifestReferenced", function(event, ref, location) {
            _this.onManifestReferenced(ref, location);
          });

          _this.eventEmitter.subscribe("SEARCH_SIZE_UPDATED." + this.searcher.windowId, function() {
            _this.setContainerPositions();
          });
        },

        bindEvents: function() {
            var _this = this;

            // handle interface events
            this.element.find('form#url-load-form').on('submit', function(event) {
              event.preventDefault();
              _this.addManifestUrl(jQuery(this).find('input').val());
            });

            this.element.find('.remove-object-option').on('click', function(event) {
              _this.togglePanel(event);
            });

            // Filter manifests based on user input
            this.element.find('#manifest-search').on('keyup input', function(event) {
              _this.filterManifests(this.value);
            });

            this.element.find('#manifest-search-form').on('submit', function(event) {
              event.preventDefault();
            });

            this.element.find(".browser-search-container .close").on("click", function(event) {
              _this.element.find(".browser-search-container").hide();
            });

            jQuery(window).resize($.throttle(function() {
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
        filterManifestList: function(selected) {
          var _this = this;
          this.selectedObjects = selected || [];

          this.element.find(".select-results").scrollTop(0);

          // selected is an array of strings, manifest IDs
          if (!selected) {
            this.manifestListItems.forEach(function(item) { item.element.show(); });
          } else {
            this.manifestListItems.forEach(function(item) {
              if (_this.manifestVisible(item.manifest) || _this.manifestVisible(item.manifestRef)) {
                item.element.show();    // This manifest is 'selected'
              } else {
                item.element.hide();
              }
            });
          }
        },

        manifestVisible: function(manifest) {
          if (!manifest) {
            // console.log("No manifest to look at...");
            return false;
          }
          var manifestId = manifest.hasOwnProperty("getId") ? manifest.getId() : manifest["@id"];
          if (!manifestId) {
            if (manifest.hasOwnProperty("jsonLd")) {
              manifestId = manifest.jsonLd["@id"];
            } else {
              // console.log("Failed to find manifestId");
              return false;
            }
          }

          if (!manifestId.hasOwnProperty("indexOf")) {
            // console.log("manifestId >> (" + (typeof manifestId) + ") " + manifestId);
          }
          else if (manifestId.indexOf("Hamlet") >= 0) {
            // console.log("Found Hamlet!");
          }
          // Visible IF
          //    no selected objects OR
          //    manifest ID is not in selected objects  OR
          //    any manifest parent is in the selected objects
          return !Array.isArray(this.selectedObjects) || this.selectedObjects.length === 0 ||
            this.selectedObjects.indexOf(manifestId) !== -1 ;//||
            // (manifest.hasOwnProperty("isWithin") &&
            //   this.selectedObjects.filter(function(s) { return manifest.isWithin(s); }).length > 0);
        },

        hide: function() {
            var _this = this;
            jQuery(this.element).hide({effect: "fade", duration: 160, easing: "easeOutCubic"});
        },

        show: function() {
            var _this = this;
            jQuery(this.element).show({effect: "fade", duration: 160, easing: "easeInCubic"});
        },

        addManifestUrl: function(url) {
          var _this = this;
          _this.eventEmitter.publish('ADD_MANIFEST_FROM_URL', [url, "(Added from URL)"]);
        },

        togglePanel: function(event) {
          var _this = this;
          _this.eventEmitter.publish('TOGGLE_LOAD_WINDOW');
        },

        filterManifests: function(value) {
          var _this = this;
          if (value.length > 0) {
             _this.element.find('.items-listing li').show().filter(function() {
                return jQuery(this).text().toLowerCase().indexOf(value.toLowerCase()) === -1;
             }).hide();
          } else {
             _this.element.find('.items-listing li').show();
          }
        },

        resizePanel: function() {
          var _this = this;
          var clone = _this.element.clone().css("visibility","hidden").css("display", "block").appendTo(_this.appendTo);
          _this.resultsWidth = clone.find('.select-results').outerWidth();
          clone.remove();
          _this.eventEmitter.publish("manifestPanelWidthChanged", _this.resultsWidth);
        },

        onPanelVisible: function(_, stateValue) {
          var _this = this;
          if (stateValue) { _this.show(); return; }
           _this.hide();
        },

        onManifestReceived: function(event, newManifest) {
          var _this = this;
          _this.manifestListItems.push(new $.ManifestListItem({
            manifest: newManifest,
            resultsWidth: _this.resultsWidth,
            state: _this.state,
            eventEmitter: _this.eventEmitter,
            appendTo: _this.manifestListElement,
            visible: _this.manifestVisible(newManifest)
          }));
          _this.element.find('#manifest-search').keyup();

          if (this.searcher) {
            this.searcher.addIIIFObject(newManifest.jsonLd);
          }
        },

        onManifestReferenced: function(reference, location) {
          this.manifestListItems.push(new $.ManifestListItem({
            manifestRef: reference,
            resultsWidth: this.resultsWidth,
            state: this.state,
            eventEmitter: this.eventEmitter,
            appendTo: this.manifestListElement,
            visible: this.manifestVisible(reference),
            location: location
          }));
          this.element.find("#manifest-search").keyup();
        },

        onCollectionReceived: function(collection) {
          if (this.searcher) {
            this.searcher.addIIIFObject(collection);
          }
        },

        setContainerPositions: function() {
          // var vals = {
          //   "top": this.element.find("#load-controls").position().top +
          //       this.element.find("#load-controls").outerHeight(true) -
          //       10 + "px",
          //   "width": jQuery("#" + this.state.currentConfig.id).outerWidth(true) -
          //       this.element.find(".facet-container-scrollable").outerWidth(true) - 25 + "px",
          //   "left": this.element.find(".facet-container-scrollable").outerWidth(true) + 15 + "px"
          // };
          //
          // this.element.find(".select-results").css(vals);
          // this.element.find(".search-results-display").css(vals);
        },

        template: Handlebars.compile([
          '<div id="manifest-select-menu">',
          '<div class="container">',
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
              '</div>',
          '</div>',
          '</div>'
        ].join(''))
    };

}(Mirador));

(function($) {

    $.EditorPanel= function(options) {
        jQuery.extend(true, this, {
            element:           null,
            appendTo:          null,
            windowId:          null,
            maxWidth:          -1,
            maxHeight:         -1
        }, options);

        this.init();
    };

    $.EditorPanel.prototype = {
        init: function() {
            var _this = this;

            this.state({
                windowId: _this.windowId,
                position: _this.editorPanel ? _this.editorPanel.position : 'right',
                title: 'untitled',
                annotations: [],
                selectedAnno: null,
                editAnno: null,
                autoSaveInterval: null,
                showThumbnails: true,
                allowEditing: true,
                locked: true,
                size: 280,
                open: false,
                editorPanel: _this.editorPanel
            }, true);

            this.listenForActions();
            this.render(this.state());
            this.bindEvents();

            if (_this.onBottom()) {
              _this.element.find('.position-toggle').addClass('bottom');
            }
        },
        loadEditorPanelComponents: function() {
            var _this = this;

        },
        state: function(state, initial) {
            if (!arguments.length) return this.panelState;
            this.panelState = state;

            if (!initial) {
                jQuery.publish('editorPanelStateUpdated' + this.windowId, this.panelState);
            }

            return this.panelState;
        },
        refreshAnnotationList: function(listId){
          var _this = this,
              state = this.state();

          var window = $.viewer.workspace.windows
            // Return array of only those 'windows' whose ID matches the current window ID
            .filter(function(window) { return window.id == _this.windowId; }
          );

          if(listId === null){
            state.annotations = window[0].annotationsList;
          }else{
            state.annotations = window[0].annotationsList.filter(function(annotation){
              if(annotation.endpoint === listId){
                return true;
              }

              if(annotation.endpoint.name === listId){
                return true;
              }

              return false;
            });
          }

          this.state(state);
        },
        deselectAnno: function(annoId) {
            var _this = this;
            var state = this.state();
            state.selectedAnno = null;
            state.editAnno = null;
            this.state(state);
        },
        selectAnno: function(annoId) {
            var _this = this;
            var state = this.state();
            state.selectedAnno = annoId;
            state.editAnno = null;
            this.state(state);
        },
        editAnno: function(annoId) {
            var _this = this;
            var state = this.state();
            state.selectedAnno = annoId;
            state.editAnno = annoId;

            this.state(state);
        },
        openAnnotationList: function() {
            var _this = this,
                state = this.state(),
                open = true;

            state.open = open;
            this.state(state);
        },
        closeAnnotationList: function() {
            var _this = this,
                state = this.state(),
                open = false;

            state.open = open;
            this.state(state);
        },
        getTemplateData: function(state) {
            return {
                windowId: state.windowId,
                annotations: state.annotations,
                selected: state.selectedAnno,
                position: state.position,
                open: state.open,
                size:  state.size,
                showEditorTools: state.editorPanel.showTools
            };
        },
        getEditorContent: function(){
          var _this = this,
              state = _this.state();
          state.autoSaveInterval = setInterval(function(){ _this.autoSaveAnno(tinymce.activeEditor.getContent()); },2000);
          console.log(tinymce.activeEditor.getContent());
          this.state(state);
        },
        autoSaveAnno: function(resourceText){
              var _this = this;
              // jQuery.publish('autoSaveAnno.' + _this.windowId, resourceText);
              console.log(resourceText);

        },
        listenForActions: function() {
            var _this = this,
                state = _this.state();

            jQuery.subscribe('editorPanelStateUpdated' + this.windowId, function(_, data) {
                if(state.editAnno === null){
                    clearInterval(state.autoSaveInterval);
                    _this.render(data);
                } else {
                  var selector = "." + state.editAnno;
                  tinymce.init({
                            selector : selector,
                            inline: true,
                            menubar: false,
                            setup: function (ed) {
                                        ed.on('init', function(args) {
                                            _this.getEditorContent();
                                        });
                                    }
                          });
                }
            });

            jQuery.subscribe('annotationCreated.'+_this.id, function(event, oaAnno, osdOverlay) {
              console.log('annotationCreated');
            });

            jQuery.subscribe('annotationsTabStateUpdated.' + _this.windowId, function(event, annotationsTabState) {
              _this.refreshAnnotationList(annotationsTabState.selectedList);
              if(annotationsTabState.selectedList === null){
                _this.closeAnnotationList();
              }else{
                _this.openAnnotationList();
              }

            });

            jQuery.subscribe('editorPanelResized', function() {
            });

            jQuery.subscribe('editorPanelToggled' + this.windowId, function() {
                _this.panelToggled();
            });

            jQuery.subscribe('annoSelected.' + _this.windowId, function(event, annoId) {
                _this.selectAnno(annoId);
            });

            jQuery.subscribe('annoDeselected.' + _this.windowId, function(event, annoId) {
                _this.deselectAnno(annoId);
            });

            jQuery.subscribe('annoEdit.' + _this.windowId, function(event, annoId) {
                _this.editAnno(annoId);
            });

        },
        getCurrentWindow: function() {
          var _this = this;
          return $.viewer.workspace.windows
            .filter(function(window) { return window.id === _this.windowId; })[0];
        },
        updateDimensions: function() {
          var _this = this;

          this.maxWidth = jQuery(_this.element).parent().parent().width();
          this.maxHeight = jQuery(_this.element).parent().parent().height();
        },
        bindEvents: function() {
            var _this = this,
                fullpage = _this.element.find('.fullpage'),
                annoItems = _this.element.find('.annotationItem'),
                resizer = _this.element.find('.resizer-' + _this.state().position),
                positionToggle = _this.element.find('.position-toggle'),
                window = this.getCurrentWindow();
            //state = this.state();

            annoItems.on('click', function(event) {
              var annoClicked = jQuery(this).data('id');
              if(_this.state().selectedAnno === annoClicked){
                  //jQuery.publish('annoDeselected.' + _this.windowId, annoClicked);
                  jQuery.publish('annoEdit.' + _this.windowId, annoClicked);
              }else{
                  jQuery.publish('annoSelected.' + _this.windowId, annoClicked);
              }
            });

            fullpage.on('click', function(event) {
              jQuery.publish('fullPageSelected.' + _this.windowId);
            });

            positionToggle.click(function(event) {
              var state = _this.state();

              if (state.position === 'bottom') {
                state.position = 'right';

                positionToggle.css('padding-top', '3px');
                _this.element.css('height', '').removeAttr('height');
                _this.element.removeClass('bottom');
                _this.element.addClass('right');
              } else if (state.position === 'right') {
                state.position = 'bottom';

                positionToggle.css('padding-top', '8px');
                _this.element.css('width', '').removeAttr('width');
                _this.element.removeClass('right');
                _this.element.addClass('bottom');
              }

              _this.state(state);
            });

          // ----- Handle EditorPanel resizing -----
            // ----- Track window size changes -----
            jQuery.subscribe('windowResize', $.debounce(function() {
              _this.updateDimensions();
            }, 300));

            jQuery.subscribe('layoutChanged', function(event, layoutRoot) {
              _this.updateDimensions();
            });

          // ----- Handle EditorPanel resizing -----
            // Get initial window size
            if (typeof window !== 'undefined') {
              _this.updateDimensions();
            }

            resizer.mousedown(function(event) {
              event.preventDefault();

              var editor_height = parseInt(_this.element.css('height')),
                editor_width = parseInt(_this.element.css('width')),
                mouseX = event.pageX,
                mouseY = event.pageY;

              jQuery(document).mousemove(function(event) {
                var diff = 0;

                if (_this.onBottom()) {
                  diff = mouseY - event.pageY;
                  mouseY = mouseY - diff;
                  editor_height = editor_height + diff;

                  if (_this.maxHeight > 0 && editor_height < _this.maxHeight && editor_height > 5) {
                    _this.element.css('height', editor_height);
                  }

                } else if (_this.onRight()) {
                  diff = mouseX - event.pageX;
                  mouseX = mouseX - diff;
                  editor_width = editor_width + diff;

                    if (_this.maxWidth > 0 && editor_width < _this.maxWidth && editor_width > 5) {
                      _this.element.css('width', editor_width);
                    }
                  }
                });
              });

            jQuery(document).mouseup(function(event) {
              jQuery(document).unbind('mousemove');
            });
        },
        onRight: function() {
          return this.state().position === 'right';
        },
        onBottom: function() {
          return this.state().position === 'bottom';
        },
        render: function(state) {
            var _this = this;
            var templateData = _this.getTemplateData(state);

            // Handlebars does not like the @ symbol in template variables so massaging here...
            var arrayLength = templateData.annotations.length;
            for (var i = 0; i < arrayLength; i++) {
              for (var property in templateData.annotations[i]) {
                  if (templateData.annotations[i].hasOwnProperty(property)) {
                      var messaged = property.replace('@', '');
                      if (typeof templateData.annotations[i][property] !== "undefined") {
                        templateData.annotations[i][messaged] = templateData.annotations[i][property];
                        templateData.annotations[i].selected = templateData.annotations[i].id === templateData.selected ? true : false;
                      }
                  }
              }
            }

            if (!this.element) {
                this.element = jQuery(_this.template(templateData)).appendTo(_this.appendTo);
                return;
            } else {
                _this.appendTo.find(".editorPanel").empty();
                var contents = jQuery(_this.template(templateData)).children();

                this.element.html(contents);
            }
            var openValue = templateData.open === true ? 'block' : 'none';
            _this.bindEvents();
            this.element.css({'display':openValue});

        },
        template: Handlebars.compile([
            '<div class="editorPanel {{position}}">',
            '<div class="resizer-{{position}}"></div>',
            '<div class="position-toggle"><i class="fa fa-exchange"></i></div>',
            '<form>',
            '<ul class="annotations">',
            '{{#each annotations}}',
            '<li class="annotationItem {{#if this.selected}}selected{{/if}}" data-id="{{this.id}}">',
                '<div class="editable {{this.id}}">{{{this.resource.chars}}}</div>',
            '</li>',
            '{{/each}}',
            '</ul>',
            '</form>',
            '{{#if showEditorTools}}',
            '<div class="editorTools">',
            '<span class="fullpage"><i class="fa fa-edit fa-fw"></i> start transcription</span>',
            '</div>',
            '{{/if}}',
            '</div>'
        ].join('')),
        toggle: function () {}
    };

}(Mirador));

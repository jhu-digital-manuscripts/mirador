(function($){

  $.Manifest = function(manifestUri, location) {
    if (manifestUri.indexOf('info.json') !== -1) {
      // The following is an ugly hack. We need to finish the
      // Manifesto utility library.
      // See: https://github.com/IIIF/manifesto
      //
      // If manifestUri is not a string, then
      // it's an object, namely a light-weight
      // dummy manifest wrapped around the
      // contents of an an info.json response.
      //
      // The wrapper is still going to need these
      // accessor methods. We can just set the
      // jsonLd directly, and the request needs to
      // be a jQuery deferred object that is completed
      // imediately upon creation. This allows
      // components listening for this request to finish
      // to react immediately without having to be
      // re-written.
      jQuery.extend(true, this, {
        jsonLd: null,
        location: location,
        uri: manifestUri,
        request: null
      });

      this.initFromInfoJson(manifestUri);
    } else {
      jQuery.extend(true, this, {
        jsonLd: null,
        location: location,
        uri: manifestUri,
        request: null,
        canvasMap: null
      });

      this.init(manifestUri);
    }
  };

  $.Manifest.prototype = {
    init: function(manifestUri) {
      var _this = this;
      this.request = jQuery.ajax({
        url: manifestUri,
        dataType: 'json',
        async: true
      });

      this.request.done(function(jsonLd) {
        _this.jsonLd = jsonLd;
        _this.buildCanvasMap();
      });
    },
    buildCanvasMap: function() {
      var _this = this;
      this.canvasMap = {};

      this.getCanvases().forEach(function(canvas) {
        _this.canvasMap[canvas['@id']] = canvas;
      });
    },
    initFromInfoJson: function(infoJsonUrl) {
      var _this = this;
      this.request = jQuery.ajax({
        url: infoJsonUrl,
        dataType: 'json',
        async: true
      });

      this.request.done(function(jsonLd) {
        _this.jsonLd = _this.generateInfoWrapper(jsonLd);
      });
    },
    getThumbnailForCanvas : function(canvas, width) {
      var version = "1.1",
      service,
      thumbnailUrl;

      // Ensure width is an integer...
      width = parseInt(width, 10);

      // Respecting the Model...
      if (canvas.hasOwnProperty('thumbnail')) {
        // use the thumbnail image, prefer via a service
        if (typeof(canvas.thumbnail) == 'string') {
          thumbnailUrl = canvas.thumbnail;
        } else if (canvas.thumbnail.hasOwnProperty('service')) {
          // Get the IIIF Image API via the @context
          service = canvas.thumbnail.service;
          if (service.hasOwnProperty('@context')) {
            version = $.Iiif.getVersionFromContext(service['@context']);
          }
          thumbnailUrl = $.Iiif.makeUriWithWidth(service['@id'], width, version);
        } else {
          thumbnailUrl = canvas.thumbnail['@id'];
        }
      } else {
        // No thumbnail, use main image
        var resource = canvas.images[0].resource;
        service = resource['default'] ? resource['default'].service : resource.service;
        if (service.hasOwnProperty('@context')) {
          version = $.Iiif.getVersionFromContext(service['@context']);
        }
        thumbnailUrl = $.Iiif.makeUriWithWidth(service['@id'], width, version);
      }
      return thumbnailUrl;
    },
    getCanvases : function() {
      var _this = this;
      return _this.jsonLd.sequences[0].canvases;
    },
    getAnnotationsListUrl: function(canvasId) {
      var _this = this;
      var canvas = jQuery.grep(_this.getCanvases(), function(canvas, index) {
        return canvas['@id'] === canvasId;
      })[0];

      if (canvas && canvas.otherContent) {
        return canvas.otherContent[0]['@id'];
      } else if (canvas) {
        // console.log(canvas);
        // return canvas.otherContent[0]['@id'];
        return false;
      } else { return false; }
    },
    getStructures: function() {
      var _this = this;
      return _this.jsonLd.structures;
    },
    generateInfoWrapper: function(infoJson) {
      // Takes in info.json and creates the
      // dummy manifest wrapper around it
      // that will allow it to behave like a
      // manifest with one canvas in it, with
      // one image on it. Some of the metadata
      // of the image will be used as the
      // label, and so on, of the manifest.
      var dummyManifest = {
        '@context': "http://www.shared-canvas.org/ns/context.json",
        '@id': infoJson['@id'],
        '@type': 'sc:Manifest',
        label: infoJson['@id'].split('/')[infoJson['@id'].split('/').length -1],
        sequences: [
          {
            '@id': infoJson['@id'] + '/sequence/1',
            '@type': 'sc:Sequence',
            canvases: [
              {
                '@id': infoJson['@id'] + '/sequence/1/canvas/1',
                '@type': 'sc:Canvas',
                width: infoJson.width,
                height: infoJson.height,
                images: [
                  {
                    '@id': infoJson['@id'] + '/sequence/1/canvas/1/image/1',
                    '@type': 'sc:image',
                    'motivation': 'sc:painting',
                    resource: {
                      '@id': infoJson,
                      '@type': "dctypes:Image",
                      format: "image/jpeg",
                      height: infoJson.width,
                      width: infoJson.height,
                      service: {
                        '@id': infoJson['@id'],
                        '@context': infoJson['@context'],
                        'profile': infoJson.profile
                      }
                    }
                  }
                ]
              }
            ]
          }
        ]
      };

      return dummyManifest;
    },
    // my added function
    getSearchWithinService: function(){
      var _this = this;
      var serviceProperty = _this.jsonLd.service;

      var service = {};
      if (serviceProperty.constructor === Array){
        for (var i = 0; i < serviceProperty.length; i++){
          if (serviceProperty[i]["@context"] === "http://iiif.io/api/search/0/context.json"){
            //returns the first service object with the correct contest
            service = serviceProperty[i];
            break;
          }
        }
      }
      else if (_this.jsonLd.service["@context"] === "http://iiif.io/api/search/0/context.json" ||
          _this.jsonLd.service["@context"] === "http://manuscriptlib.org/jhiff/search/context.json"){
        service = _this.jsonLd.service;
      }
      else {
        //no service object with the right context is found
        service = null;
      }
      return service;
    },

    /**
     * Get all annotation lists for the given canvas. Each canvas can define
     * zero or more annotation lists for transcriptions or annotations under
     * its 'otherContent' property. If exactly one is defined, this
     * property will be a simple string. If more than one are defined, it
     * will be an array of strings. If no annotation lists are defined,
     * return UNDEFINED.
     *
     * @param  string canvasId URI ID
     * @return single annotation list ID or array of IDs
     */
    getAnnotationLists: function(canvasId) {
      console.assert(canvasId && canvasId !== '', '[Manifest#getAnnotationLists] "canvasId" must be specified.');
      var canvas = this.canvasMap[canvasId.split('#')[0]];

      if (canvas && canvas.otherContent) {
        if (Array.isArray(canvas.otherContent)) {
          var results = [];

          canvas.otherContent
          // .filter(function(content) {
          //   return content['@type'] === 'sc:AnnotationList';
          // })
          .forEach(function(content) {
            results.push(content['@id']);
          });

          return results;
        } else if (typeof canvas.otherContent === 'object') {
          return canvas.otherContent['@id'];
        } else if (typeof canvas.otherContent === 'string') {
          return canvas.otherContent;
        }
      }
    },

    /**
     * Get the label of the a canvas by ID, removing any region fragments
     * if necessary
     *
     * @param  {[type]} canvasId ID of desired canvas
     * @return {[type]}          string
     */
    getCanvasLabel: function(canvasId) {
      console.assert(canvasId && canvasId !== '', "No canvasId was specified.");
      var canvas = this.canvasMap[canvasId.split('#')[0]];
      return canvas ? canvas.label : undefined;
    },

    getId: function() {
      return this.jsonLd['@id'];
    },
    getLabel: function() {
      return this.jsonLd.label;
    }

  };

}(Mirador));

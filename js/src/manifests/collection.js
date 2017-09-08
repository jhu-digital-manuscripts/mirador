/**
 * Credit to Dickson Law, University of Toronto Library
 * https://github.com/utlib/mirador/blob/12449c38763ba00b12f933b178a3bdeb0149a2dd/js/src/manifests/collection.js
 */
(function($){

  // This is an analogue of the Manifest utility class, but for collections
  $.Collection = function(collectionUri, location, collectionContent) {
    if (collectionContent) {
      jQuery.extend(true, this, {
          jsonLd: null,
          location: location,
          uri: collectionUri,
          request: null
      });
      this.initFromCollectionContent(collectionContent);
    } else {
      jQuery.extend(true, this, {
        jsonLd: null,
        location: location,
        uri: collectionUri,
        request: null
      });

      this.init(collectionUri);
    }
  };

  $.Collection.prototype = {
    init: function(collectionUri) {
      var _this = this;
      this.request = jQuery.ajax({
        url: collectionUri,
        dataType: 'json',
        async: true
      });

      this.request.done(function(jsonLd) {
        _this.jsonLd = jsonLd;
      });
    },
    initFromCollectionContent: function (collectionContent) {
      var _this = this;
      this.request = jQuery.Deferred();
      this.request.done(function(jsonLd) {
        _this.jsonLd = jsonLd;
      });
      _this.request.resolve(collectionContent); // resolve immediately
    },

    /**
     * @returns IIIF API version of this collection
     */
    getVersion: function() {
      var versionMap = {
        'http://www.shared-canvas.org/ns/context.json': '1', // is this valid?
        'http://iiif.io/api/presentation/1/context.json': '1',
        'http://iiif.io/api/presentation/2/context.json': '2',
        'http://iiif.io/api/presentation/2.1/context.json': '2.1'
      };
      return versionMap[this.jsonLd['@context']];
    },

    /**
     * @returns list of manifest IDs contained in this collection
     */
    getManifestUris: function() {
      // "manifests" key present
      if (this.jsonLd.manifests) {
        return jQuery.map(this.jsonLd.manifests, function(v, _) {
          return v['@id'];
        });
      }
      // "members" key present, sift-out non-manifests
      if (this.jsonLd.members) {
        return jQuery.map(this.jsonLd.members, function(v, _) {
          if (v['@type'] === 'sc:Manifest') {
            return v['@id'];
          }
        });
      }
      // Neither present
      return [];
    },

    /**
     * According to spec, 'manifests' and 'members' MUST be objects.
     * @returns list of manifest JSON objects contained in this collection
     */
    getManifestBlocks: function() {
      // "manifests" key present
      if (this.jsonLd.manifests) {
        return this.jsonLd.manifests;
      }
      // "members" key present, sift-out non-manifests
      if (this.jsonLd.members) {
        return jQuery.map(this.jsonLd.members, function(v, _) {
          if (v['@type'] === 'sc:Manifest') {
            return v;
          }
        });
      }
      // Neither present
      return [];
    },

    /**
     * @returns list of child collection IDs contained in this collection
     */
    getCollectionUris: function() {
      // "collections" key present
      if (this.jsonLd.collections) {
        return jQuery.map(this.jsonLd.collections, function(v, _) {
          return v['@id'];
        });
      }
      // "members" key present, sift-out non-collections
      if (this.jsonLd.members) {
        return this.jsonLd.members
        .filter(function(mem) {
          return mem["@type"] === "sc:Collection";
        })
        .map(function(mem) {
          return mem["@id"];
        });
      }
      // Neither present
      return [];
    },

    /**
     * @returns list of child collection JSON objects contained in this collection
     */
    getCollectionBlocks: function() {
      // "collections" key present
      if (this.jsonLd.collections) {
        return this.jsonLd.collections;
      }
      // "members" key present, sift out non-collections
      if (this.jsonLd.members) {
        return this.jsonLd.members.filter(function(mem) {
          return mem["@type"] === "sc:Collection";
        });
      }
      // Neither present
      return [];
    },
    description: function() {
      return this.jsonLd ? this.jsonLd.description : undefined;
    },
    getId: function() {
      return this.jsonLd["@id"];
    },
    /**
     * Check if a IIIF ID is within this collection.
     */
    isWithin: function(someId, within) {
      var _this = this;
      if (!within) { within = this.within || this.jsonLd.within; } // If no 'within' is provided, start with base 'within' of this collection
      if (!within || !someId) { return false; }  // Quit early if 'within' still not defined, there is nothing to check.

      var result = false;
      if (Array.isArray(within)) {
        within.forEach(function(w) {
          result = result || _this.isWithin(someId, w);
        });
      } else if (typeof within === "object") {
        result = someId === within["@id"];
        if (!result && within.within) {
          result = this.isWithin(someId, within.within);
        }
      } else if (typeof within === "string") {
        result = someId === within;
      } else {
        result = false;
      }

      return result;
    },
    toString: function() {
      return "[Collection (" + this.uri + ")]";
    }
  };

}(Mirador));

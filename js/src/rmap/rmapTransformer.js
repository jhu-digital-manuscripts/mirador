(function ($) {
  $.RmapTransformer = function (options) {
    jQuery.extend(this, {
      utils: null,      // ResearchFindingUtils
    }, options);

    let context = new URI().fragment('').query('')
        .path('/build/mirador/aor_rmap_context.json');
    jQuery.getJSON(context.toString()).done(data => this.context = data);
  };

  /**
   * Input: list of ViewSteps
   * 
   * * For each ViewStep:
   *    - Generate activity object: 
   *      > @id: _:stepN, @type: prov:Activity, next&previous, used: ViewerURL
   *    - Add step obj if necessary using the ViewerURL from the activity as the id
   *      > @id: ViewerURL, isPartOf: bookBiblioURL, title: 'moo', @type: dcmitype:Image (or whatever)
   *    - Add manifest bibliography if necessary
   *      > @id: AOR_biblio_URL, @type: dcmitype:Text (??) points to AOR description in WordPress
   */
  $.RmapTransformer.prototype = {
    step: function (index) {
      return 'Step ' + index;
    },

    stepId: function (index) {
      return '_:step' + index;
    },

    /**
     * Transform an array of View Steps 
     * @param {array} data view data that includes user approved label and description
     *                as well as the HistoryState for each step
     * data: {
     *    description: '',
     *    steps: []
     * }
     */
    transform: function (data) {
      let result = {};
      let graph = [];

      let aggregates = [];

      data.steps.forEach((step, index) => {
        const hasNext = index < data.steps.length;
        const hasPrev = index > 0;

        const tStep = this.transformStep(step, hasPrev, hasNext);
        graph.push(tStep);
        aggregates.push(tStep.used);
        
        const bookView = this.transformBookView(step);
        if (!graph.includes(bookView)) {
          graph.push(bookView);
        }

        if (step.item.data.manifest) {
          const book = this.transformBook(step.item.data.manifest);
          if (!graph.includes(book)) {
            graph.push(book);
          }
        }

        // TODO: should transform people, locations, books, etc
      });

      graph.push(this.makeDisco(aggregates, data.description));

      result['@context'] = this.context;
      result['@graph'] = graph;

      return result;
    },

    makeDisco: function (aggregates, description) {
      console.assert(Array.isArray(aggregates), 'steps must be an array');
      let result = {
        description,
        aggregates
      };

      result['@id'] = '_:root';
      result['@type'] = 'rmap:DiSCO';

      return result;
    },
    
    transformStep: function (viewData, hasPrev, hasNext) {
      const label = this.step(viewData.index) + (viewData.description ? ': ' + viewData.description : '');

      const previous = hasPrev ? this.stepId(viewData.index - 1) : undefined;
      const next = hasNext ? this.stepId(viewData.index + 1) : undefined;

      let result = {
        used: viewData.url,
        description: viewData.description,
        label,
        previous,
        next
      };

      result['@id'] = this.stepId(viewData.index);
      result['@type'] = 'prov:Activity';

      return result;
    },

    // TODO: should this title be the user-generated label?
    // TODO: should decide on a way to reference book description in AOR WordPress
    transformBookView: function (viewData) {
      let result = {
        title: this.bookViewTitle(viewData),
        // isPartOf: this.utils.manifestData(viewData.item.data.manifest, 'mooRL')
      };

      result['@id'] = viewData.url;
      result['@type'] = this.bookViewType(viewData);

      return result;
    },

    /**
     * 
     * @param {string} manifest URI
     */
    transformBook: function (manifest) {
      let result = {
        published: this.utils.manifestMetadata(manifest, 'dateLabel'),
        title: this.utils.manifestLabel(manifest),
        // creator: moo
      };

      result['@id'] = this.utils.manifestMetadata(manifest, 'mooRL');
      result['@type'] = 'dcmitype:Text';

      return result;
    },

    bookViewTitle: function (viewData) {
      const col = viewData.item.data.collection;
      const manifest = viewData.item.data.manifest;
      const canvas = viewData.item.data.canvas;
      const query = viewData.item.data.search.query;

      switch (viewData.item.type) {
        case $.HistoryStateType.collection:
          return this.utils.collectionLabel(col);
        case $.HistoryStateType.collection_search:
          return 'Search : ' + query + ' in ' + this.utils.collectionLabel(col);
        case $.HistoryStateType.manifest_search:
          return 'Search : ' + query + ' in ' + this.utils.manifestLabel(manifest);
        case $.HistoryStateType.thumb_view:
          return this.utils.manifestLabel(manifest);
        case $.HistoryStateType.image_view:
        case $.HistoryStateType.opening_view:
        case $.HistoryStateType.scroll_view:
          return this.utils.manifestLabel(manifest) + ' ' + this.utils.canvasLabel(manifest, canvas);
        default:
          break;
      }
    },

    bookViewType: function (viewData) {
      switch (viewData.item.type) {
        case $.HistoryStateType.collection:
        case $.HistoryStateType.thumb_view:
          return 'dcmitype:Collection';
        case $.HistoryStateType.collection_search:
        case $.HistoryStateType.manifest_search:
          return 'dcmitype:Text';
        case $.HistoryStateType.image_view:
        case $.HistoryStateType.opening_view:
        case $.HistoryStateType.scroll_view:
          return 'dcmitype:Image';
        default:
          break;
      }
    },
  };
} (Mirador));

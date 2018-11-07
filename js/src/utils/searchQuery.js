(function($) {

  /**
   * Generate a "basic search" query that searches for the given
   * term across all default fields.
   *
   * @param  {String} term - term to search for
   * @param  {array}  fields-array of fields
   * @param  {String} operation - character delimiter representing the
   *                            	desired boolean operation
   * @return {String}      query for sending to the search service
   */
  $.generateBasicQuery = function(term, fields, operation) {
    var _this = this;
    var query = [];

    fields.forEach(function(field) {
      query.push({
        op: operation,
        category: typeof field === 'object' ? field.name : field,
        term: term
      });
    });

    return $.generateQuery(query);
  };

  /**
   * Generate a search query from an array of query parts.
   *
   * Expects input of array of query-part objects:
   * queryPart: {
   *   op: (string) boolean operator as the search service is expecting (& or |),
   *   category: (string) search category,
   *   term: (string)
   * }
   *
   * Query generated attempts to capture precedence by nesting
   * queries when the boolean operation changes. In the final query, each
   * part will consist of the category and term separated by the
   * categoryDelimter. If no delimiter is provided, it will default to
   * a colon (':'). The search term is always surrounded by single quotes.
   *
   * Input:
   * A & B & C | D & E | F
   *
   * Output:
   * (A & B & (C | (D & (E | F))))
   *
   * All query terms will be escaped.
   *
   * @param queryParts - array of objects
   * @param categoryDelimiter - character to delimit search category and search term
   *
   * @return (string)           query in JHIIIF format
   */
  $.generateQuery = function(queryParts, categoryDelimiter) {
    if (!categoryDelimiter) {
      categoryDelimiter = ':';
    }

    if (!queryParts || queryParts.length === 0) {
      // List is empty or does not exist
      return;
    }
    // Short circuit if only 1 part exists
    if (queryParts.length === 1) {
      return queryParts[0].category + categoryDelimiter + "'" + queryParts[0].term + "'";
    }

    // Start query
    // each term:
    //  operation the same as next?
    //    yes: append
    //    no: start nested query, append
    var query = '';
    var nestCount = 0;
    queryParts.forEach(function(part, index, array) {
      // Compare this operation to next operation
      if (index > 0) {
        query += part.op;
      }

      if (index < array.length - 1) {
        if (part.op !== array[index + 1].op) {
          query += '(';
          nestCount++;
        }
      }

      query += part.category + ':\'' + $.escapeSearchTerm(part.term) + "'";
    });

    // Add end parentheses
    for (var i = 0; i < nestCount; i++) {
      query += ')';
    }
    // Surround entire query if necessary
    if (query.charAt(0) !== '(') {
      query = '(' + query + ')';
    }

    return query;
  };

  /**
   * Properly escape a query term in preparation to be sent to the
   * search service.
   *
   * @param  string term
   * @return string      escaped term
   */
  $.escapeSearchTerm =  function(term) {
    if (!term) {
      return term;
    } else if (typeof term === "string") {
      return term.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    } else if (Array.isArray(term)) {
      term.forEach(function(val, index) {
        term[index] = $.escapeSearchTerm(val);
      });
      return term;
    } else {
      return term; // Fallback, just return the term
    }
  };

  $.toTermList = function(queryParts) {
    return queryParts.map(function(q) {
      return q.category + ":'" + $.escapeSearchTerm(q.term) + "'";
    }).join(" ");
  };

  $.parseQuery = function (query) {
    /** @param {QueryParserInput} input */
    function parseWord (input) {
      function isLetter (ch) {
        return /\w/.test(ch); // TODO not comprehensive.
      }

      input.skipWhitespace();
      input.mark();

      do {
        const c = input.peek();
        if (isLetter(c) || c === '_' || c === '-') {
          input.next();
        } else {
          break;
        }
      } while (input.more());

      const word = input.marked();
      if (!word) {
        throw new Error('Expecting word');
      }

      return word;
    }
    /** @param {QueryParserInput} input */
    function parseString (input) {
      let str = '';

      if (input.next() !== '\'') {
        throw new Error('String must start with \'');
      }

      let escaped = false;

      for (;;) {
        const c = input.next();

        if (escaped) {
          str += c;
          escaped = false;
        } else if (c === '\\') {
          escaped = true;
        } else if (c === '\'') {
          return str;
        } else {
          str += c;
        }
      }
    }
    /** @param {QueryParserInput} input */
    function parseTerm (input) {
      const category = parseWord(input);

      if (input.next() !== ':') {
        throw new Error('Term must have \':\' after field name');
      }

      const term = parseString(input);
      
      return {
        category,
        term
      };
    }
    /** @param {QueryParserInput} input */
    function parseOperation (input) {
      if (input.next() !== '(') {
        throw new Error('Operation must start  with \'(\'');
      }

      let subqueries = [];

      subqueries.push(parseQuery(input));

      for (;;) {
        input.skipWhitespace();

        if (!input.more()) {
          throw new Error('Operation must end with \')\'');
        }

        let operation = null;

        const c = input.next();
        if (c === '&') {
          operation = 'and';
        } else if (c === '|') {
          operation = 'or';
        } else if (c === ')') {
          break;
        } else {
          throw new Error('Invalid operation. Must be & or |');
        }

        let query = parseQuery(input);

        subqueries.push(query);
      }

      if (subqueries.length === 0) {
        throw new Error('Invalid operation. Must have at least two terms');
      }

      return subqueries;
    }
    /**
     * @param {QueryParserInput} input 
     */
    function parseQuery (input) {
      if (input.peek() === '(') {
        return parseOperation(input);
      } else {
        return [ parseTerm ];
      }
    }
    
    return parseQuery(new $.QueryParserInput(query));
  };

  // /**
  //  * Simplistic and naive parser
  //  * row: [
  //  *    {row: 0, category: "description", operation: "and", term: "two", type: "input"},
  //  *    ...
  //  * ]
  //  * 
  //  * > category : should be matched to searchService.config.search.settings.fields[n].query
  //  * > operation : should be matched to searchService.config.query.operators[delimiter]
  //  * > type : pseudo-maps from searchService.config.search.settings.fields[n].type
  //  *          'text' -> 'input'
  //  */
  // $.parseQuery = function (query, searchService) {
  //   function getDelimiters (searchService) {
  //     var delimiters = searchService.config.query.delimiters;
  //     var operators = searchService.config.query.operators;
  
  //     var moo = [];
  //     operators.choices.map(function (op) {
  //       return op.value;
  //     }).forEach(function (op) {
  //       var d = delimiters[op];
  //       if (d) {
  //         moo.push(d);
  //       }
  //     });
  
  //     return moo;
  //   }
  //   function findDelimiter (symbol, delimiters) {
  //     for (var key in Object.keys(delimiters)) {
  //       if (delimiters[key] === symbol) {
  //         return key;
  //       }
  //     }
  //     return;
  //   }
  //   function parseTerm (term, fieldDelimiter, op) {
  //     if (!term || !fieldDelimiter) {
  //       return;
  //     }
  //     var parts = term.split(fieldDelimiter);
  //     if (parts.length !== 2) {
  //       console.log('Unexpected search term encountered (' + term + ')');
  //       return;
  //     }
  //     // The second part is the term 'value' which will be surrounded by single quotes
  //     // Here we strip the single quotes
  //     return {
  //       operation: op || '&',
  //       category: parts[0],
  //       term: parts[0].substring(1, parts[0].length - 1)
  //     };
  //   }
  //   function getTermListFromQuery (query, delimiters) {
  //     var termList = [];
  
  //     var start = 0;
  
  //     for (var i = 0; i < query.length; i++) {
  //       var c = query.charAt(i);
  
  //       if (delimiters.some(c)) { // If this character is a term delimiter
  //         termList.push({
  //           op: query.charAt(start - 1),
  //           parsed: query.substring(start, i)
  //         });
  //         start = i + 1;
  //       }
  //     }
  
  //     return termList;
  //   }
    
  //   var config = searchService.config;    // JHIIIFSearchService object
  //   var fieldDelimiter = searchService.config.query.delimiters.field;

  //   var delimiters = getDelimiters(searchService);
  //   var termList = getTermListFromQuery(query, delimiters);

  //   var results = [];

  //   termList.forEach(function (item, index) {
  //     var term = parseTerm(item.parsed, fieldDelimiter, item.op);
  //     var field = config.search.settings.fields[term.category];

  //     if (!field) {
  //       return;
  //     }

  //     var type = field.type;

  //     if (type === 'text') {
  //       type = 'input';
  //     } else if (type === 'dropdown') {
  //       type = 'select';
  //     }

  //     results.push({
  //       row: index,
  //       operation: findDelimiter(term.operation),
  //       category: term.category,
  //       term: term.term
  //     });
  //   });
    
  //   return results;
  // };

// -----------------------------------------------------------------------------

  /**
   * Generate a search query from an array of query parts.
   * Expects input of array of query-part objects:
   * queryPart: {
   *   op: (string) [and|or],
   *   category: (string),
   *   term: (string)
   * }
   *
   * Output query groups all AND and OR operations together.
   *
   * Input:
   * A & B & C | D & E | F
   *
   * Output:
   * (A & B & C & E) & (D | F)
   *
   * @param  (array) queryParts
   * @return (string)
   */
  $.generateQuery2 = function(queryParts) {
    var ands = queryParts.filter(function(part) {
      return part.op === 'and';
    })
    .map(function(part) {
      return part.category + ':\'' + part.term + "'";
    });

    var ors = queryParts.filter(function(part) {
      return part.op === 'or';
    })
    .map(function(part) {
      return part.category + ':\'' + part.term + "'";
    });

    var hasAnds = ands.length > 0;
    var hasOrs = ors.length > 0;

    var query = '';
    if (hasAnds && hasOrs) {
      query = $.terms2query2([
        $.terms2query2(ands, '&'),
        $.terms2query2(ors, '|')
      ], '&');
    } else if (hasAnds && !hasOrs) {
      query = $.terms2query2(ands, '&');
    } else if (!hasAnds && hasOrs) {
      query = $.terms2query2(ors, '|');
    }

    console.log('[Test2] ' + query);
    return query;
  };

  $.terms2query2 = function(terms, operation) {
    if (!operation) {
      operation = '&';
    }

    // Short circuit if only 1 term exists
    if (terms.length === 1) {
      return terms[0];
    }

    var query = '';
    var addOp = false;
    terms.forEach(function(term) {
      if (addOp) {
        query += ' ' + operation + ' ';
      } else {
        addOp = true;
      }
      query += term;
    });

    return '(' + query + ')';
  };

  /**
   * Generate a search query from an array of quer parts.
   * This function will create nested queries all with the
   * same boolean operation, where each query has only two
   * sub queries.
   *
   * A & B & C & D & E -->
   * A & (B & (C & (D & E)))
   */
  // $.terms2query = function(terms, operation) {
  //   console.assert(terms, "Provided 'terms' must exist.");
  //   if (!operation) {
  //     operation = this.searchService.query.delimiters.and;
  //   }
  //   var _this = this;
  //
  //   // Return input if it is not an array
  //   if (!jQuery.isArray(terms)) {
  //     return terms;
  //   }
  //   // Short circuit if only 1 term exists
  //   if (terms.length === 1) {
  //     return terms[0];
  //   }
  //
  //   var query = '';
  //   var frag = '';
  //   var frag_start = false;
  //   terms.forEach(function(term) {
  //     if (!term || term.length <= 0) {
  //       return;
  //     }
  //     // All terms
  //     //  fragment already started?
  //     //    yes : add '(' to beginning of fragment
  //     //          append operator, current term, ')'
  //     //          fragment ended
  //     //          add '(' to start of query, append operator, fragment, ')'
  //     //    no : start fragment
  //     if (frag_start) {
  //       frag = '(' + frag + ' ' + operation + ' ' + term + ')';
  //       if (query.length === 0) {
  //         query = frag;
  //       } else {
  //         query = '(' + query + ' '+ operation + ' '+ frag + ')';
  //       }
  //
  //       frag_start = false;
  //       frag = '';
  //     } else {
  //       frag = term;
  //       frag_start = true;
  //     }
  //   });
  //
  //   // Could be a hanging term at the end if an odd number of terms were given.
  //   // Add this to the end of the query
  //   if (frag_start && frag && frag.length > 0) {
  //     query = '(' + query + ' ' + operation + ' ' + frag + ')';
  //   }
  //
  //   // Trim leading and trailing parentheses
  //   // query = query.slice(1, query.length - 1);
  //   return query;
  // };

}(Mirador));

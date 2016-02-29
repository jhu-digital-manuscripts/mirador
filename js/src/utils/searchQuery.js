(function($) {

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
        query += ' ' + part.op + ' ';
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
    return term ? term.replace('\\', '\\\\').replace("'", "\\'") : term;
  };

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

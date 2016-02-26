(function($) {

  /**
   * Expects input of array of query-part objects:
   * queryPart: {
   *   op: (string) [and|or],
   *   category: (string),
   *   term: (string)
   * }
   *
   * It is assumed that the query part term is already properly
   * escaped.
   *
   * @param  queryParts array of objects
   *
   * @return (string)           query in JHIIIF format
   */
  $.generateQuery = function(queryParts) {

    // Start query
    // append first term
    // each subsequent terms:
    //  operation the same as previous?
    //    yes: append
    //    no: start nested query

    if (!queryParts || queryParts.length === 0) {
      // List is empty or does not exist
      return;
    }

    var query = '';

    var currentOp = '';
    var currentQueryCount = 0;
    var nestCount = 0;
    queryParts.forEach(function(part, index, array) {
      if (index > 0) {
        query += ' ' + part.op + ' ';
      }

      if (part.op !== currentOp) {
        // Do not add '(' if this is the last part
        if (index < array.length-1) {
          query += '(';
          nestCount++;
        }

        currentOp = part.op;

        currentQueryCount = 0;
      }

      query += part.category + ':\'' + part.term + "'";
      // currentQueryCount++;
    });

    // If lowest level nested query has only 1
    // if (currentQueryCount < 2) {
    //   nestCount--;
    // }
    query += Array(nestCount).fill(')').join('');
console.log('[Test] ' + query);
  };

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

(function ($) {
  $.QueryParserInput = function (input) {
    jQuery.extend(this, {
      data: input,
      current: 0,
      mark: -1
    });
  };

  $.QueryParserInput.prototype = {
    more: function () {
      return this.current < this.data.length;
    },

    next: function () {
      if (this.current === this.data.length) {
        throw new Error('Premature end of input');
      }
      return this.data.charAt(this.current++);
    },

    peek: function () {
      if (this.current === this.data.length) {
        throw new Error('Premature end of input');
      }
      return this.data.charAt(this.current);
    },
    skipWhitespace: function () {
      function isWhitespace (ch) {
        return /\s/.test(ch);
      }
      while (this.more() && isWhitespace(this.peek())) {
        this.next();
      }
    },
    markHere: function () {
      this.mark = this.current;
    },
    unmark: function () {
      this.mark = -1;
    },
    marked: function () {
      return this.data.substring(this.mark, this.current);
    },
    rewind: function () {
      this.current = this.mark;
    }
  };
} (Mirador));
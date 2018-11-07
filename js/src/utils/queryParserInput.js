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
      return this.current < data.length;
    },

    next: function () {
      if (this.current === data.length) {
        throw new Error('Premature end of input');
      }
      return data.charAt(this.current++);
    },

    peek: function () {
      if (this.current === data.length) {
        throw new Error('Premature end of input');
      }
      return input.charAt(this.current);
    },
    skipWhitespace: function () {
      function isWhitespace (ch) {
        return /\s/.test(ch);
      }
      while (this.more() && isWhitespace(this.peek)) {
        this.next();
      }
    },
    mark: function () {
      this.mark = this.current;
    },
    unmark: function () {
      this.mark = -1;
    },
    marked: function () {
      return this.data.substring(mark, next);
    },
    rewind: function () {
      this.current = this.mark;
    }
  };
} (Mirador));
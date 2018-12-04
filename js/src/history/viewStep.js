(function ($) {
  $.ViewStep = function (options) {
    jQuery.extend(this, {
      index: -1,
      item: null,   // HistoryState
      label: null,
      description: null,
      url: null
    }, options);
  };

  $.ViewStep.prototype = {};
} (Mirador));

/*!
 * jQuery.textcomplete
 *
 * Repository: https://github.com/yuku-t/jquery-textcomplete
 * License:    MIT (https://github.com/yuku-t/jquery-textcomplete/blob/master/LICENSE)
 * Author:     Yuku Takahashi
 */
'use strict';

var Completer = require('./Completer'),
    Strategy  = require('./Strategy'),
    util = require('./util'),
    counter = 0, registry = {};

/**
 * Initialize the TextComplete interaction.
 * @param  {DomElement[]} elems An array of DOM element nodes
 * (e.g., selected with document.querySelectorAll).
 * @param  {Strategy} strategies TextComplete Strategy definition
 * @param  {Object} options Customize TextComplete interaction.
 * @return {void}
 */
module.exports = function TextComplete(elems, strategies, options) {
  elems.forEach(function(el) {
    var data = el.dataset,
        completer = registry[data.textComplete];

    if (!completer) {
      options = options || {};
      options._oid = ++counter;  // unique object id
      completer = registry[counter] = new Completer(el, options);
    }

    if (typeof strategies === 'string') {
      if (!completer) return;
      completer[strategies].call(completer, options);
      if (strategies === 'destroy') {
        delete data.textComplete;
      }
    } else {
      completer.register(Strategy.parse(strategies, el));
    }
  });
};

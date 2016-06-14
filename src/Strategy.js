/* jshint node: true */

'use strict';

var memoize = require('./util').memorize;

function Strategy(def, el) {
  Object.assign(this, def);
  this.el = el;
  if (this.cache) this.search = memoize(this.search);
}

Strategy.parse = function(strategies, el) {
  return strategies.map(function(strategy) {
    return new Strategy(strategy, el);
  });
};

Object.assign(Strategy.prototype, {
  // Public properties
  // -----------------

  // Required
  match:      null,
  replace:    null,
  search:     null,

  // Optional
  id:         null,
  cache:      false,
  context:    function() { return true; },
  index:      2,
  template:   function(obj) { return obj; },
  idProperty: null
});

module.exports = Strategy;

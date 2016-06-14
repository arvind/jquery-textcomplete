/* jshint node: true */

'use strict';

var Textarea = require('./Textarea'),
    util = require('../util'),
    sentinelChar = '吶';

function IETextarea(element, completer, options) {
  this.initialize(element, completer, options);

  var span = document.createElement('span');
  span.innerHTML = sentinelChar;
  element.parentNode.insertBefore(span, element);
}

Object.assign(IETextarea.prototype, Textarea.prototype, {
  // Public methods
  // --------------

  select: function(value, strategy, e) {
    var el = el,
        pre  = this.getTextFromHeadToCaret(),
        post = el.value.substring(pre.length),
        newSubstr = strategy.replace(value, e),
        range;

    if (typeof newSubstr !== 'undefined') {
      if (util.isArray(newSubstr)) {
        post = newSubstr[1] + post;
        newSubstr = newSubstr[0];
      }

      pre = pre.replace(strategy.match, newSubstr);
      el.value = pre + post;
      el.focus();

      range = el.createTextRange();
      range.collapse(true);
      range.moveEnd('character', pre.length);
      range.moveStart('character', pre.length);
      range.select();
    }
  },

  getTextFromHeadToCaret: function() {
    this.el.focus();
    var range = document.selection.createRange();
    range.moveStart('character', -this.el.value.length);
    var arr = range.text.split(sentinelChar)
    return arr.length === 1 ? arr[0] : arr[1];
  }
});

module.exports = IETextarea;

'use strict';

var getCaretCoordinates = require('../../lib/textarea_caret'),
    Adapter = require('./Adapter'),
    util = require('../util');

// Textarea adapter
// ================
//
// Managing a textarea. It doesn't know a Dropdown.
function Textarea(element, completer, options) {
  this.initialize(element, completer, options);
}

Object.assign(Textarea.prototype, Adapter.prototype, {
  // Public methods
  // --------------

  // Update the textarea with the given value and strategy.
  select: function(value, strategy, e) {
    var el   = this.el,
        pre  = this.getTextFromHeadToCaret(),
        post = el.value.substring(el.selectionEnd),
        newSubstr = strategy.replace(value, e);

    if (typeof newSubstr !== 'undefined') {
      if (util.isArray(newSubstr)) {
        post = newSubstr[1] + post;
        newSubstr = newSubstr[0];
      }

      pre = pre.replace(strategy.match, newSubstr);
      el.value = pre + post;
      el.selectionStart = el.selectionEnd = pre.length;
    }
  },

  getTextFromHeadToCaret: function() {
    return this.el.value.substring(0, this.el.selectionEnd);
  },

  // Private methods
  // ---------------
  _getCaretRelativePosition: function() {
    var p = getCaretCoordinates(this.el, this.el.selectionStart);
    return {
      top:  p.top + this._calculateLineHeight() - this.el.scrollTop,
      left: p.left - this.el.scrollLeft
    };
  },

  // http://stackoverflow.com/a/4515470/1297336
  _calculateLineHeight: function() {
    var parentNode = this.el.parentNode,
        temp  = document.createElement(this.el.nodeName),
        style = this.el.style,
        lineHeight;

    temp.setAttribute('style',
      'margin:0px;padding:0px;font-family:' + style.fontFamily + ';font-size:' + style.fontSize
    );

    temp.innerHTML = 'test';
    parentNode.appendChild(temp);
    lineHeight = temp.clientHeight;
    parentNode.removeChild(temp);

    return lineHeight;
  }
});

module.exports = Textarea;
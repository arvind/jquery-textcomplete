/* jshint node: true */

// NOTE: TextComplete plugin has contenteditable support but it does not work
//       fine especially on old IEs.
//       Any pull requests are REALLY welcome.

'use strict';

var Adapter = require('./Adapter'),
    util = require('../util');

// ContentEditable adapter
// =======================
//
// Adapter for contenteditable elements.
function ContentEditable(element, completer, options) {
  this.initialize(element, completer, options);
}

Object.assign(ContentEditable.prototype, Adapter.prototype, {
  // Public methods
  // --------------
  select: function(value, strategy, e) {
    var pre = this.getTextFromHeadToCaret(),
        sel = window.getSelection(),
        range = sel.getRangeAt(0),
        selection = range.cloneRange();

    selection.selectNodeContents(range.startContainer);

    var content = selection.toString(),
        post = content.substring(range.startOffset), // empty
        newSubstr = strategy.replace(value, e);

    var preWrapper,
        postWrapper,
        fragment,
        lastOfPre;

    if (typeof newSubstr !== 'undefined') {
      console.log('newSubstr: ', newSubstr);

      if (util.isArray(newSubstr)) {
        post += newSubstr[1];
        newSubstr = newSubstr[0];
      }

      pre = pre.replace(strategy.match, newSubstr);
      range.selectNodeContents(range.startContainer);
      range.deleteContents();

      // create temporary elements
      preWrapper  = document.createElement('div');
      postWrapper = document.createElement('div');
      preWrapper.innerHTML = pre;
      postWrapper.innerHTML = post;

      // create the fragment thats inserted
      fragment = document.createDocumentFragment();
      lastOfPre = fragment.appendChild(preWrapper.firstChild);

      // insert the fragment & jump behind the last node in "pre"
      range.insertNode(fragment);
      range.setStartAfter(lastOfPre);

      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  },

  // Private methods
  // ---------------

  /**
   * Returns the caret's relative position from the contenteditable's top-left
   * corner. For example,
   *
   *    this._getCaretRelativePosition()
   *    //=> { top: 18, left: 200, lineHeight: 16 }
   *
   * @return {Object} Position object.
   */
  _getCaretRelativePosition: function() {
    var range  = window.getSelection().getRangeAt(0).cloneRange(),
        node   = document.createElement('span'),
        offset = util.offset(this.el);

    range.insertNode(node);
    range.selectNodeContents(node);
    range.deleteContents();

    var position = util.offset(node),
        height = node.getBoundingClientRect().height;

    position.left -= offset.left;
    position.top  += height - offset.top;
    position.lineHeight = height;
    node.parentNode.removeChild(node);

    return position;
  },

  /**
   * Returns the string between the first character and the caret.
   * Completer will be triggered with the result for start autocompleting.
   * For example, suppose the html is '<b>hello</b> wor|ld' and | is the caret.
   *
   *    this.getTextFromHeadToCaret()
   *    //=> ' wor'  // not '<b>hello</b> wor'
   *
   * @return {string} The string between the first character and caret.
   */
  getTextFromHeadToCaret: function() {
    var range = window.getSelection().getRangeAt(0),
        selection = range.cloneRange();

    selection.selectNodeContents(range.startContainer);

    return selection.toString().substring(0, range.startOffset);
  }
});

module.exports = ContentEditable;

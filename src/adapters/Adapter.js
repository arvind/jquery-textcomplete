'use strict';

var util = require('../util');

function Adapter () {}

Object.assign(Adapter.prototype, {
  // Public properties
  // -----------------

  id:        null, // Identity.
  completer: null, // Completer object which creates it.
  el:        null, // Textarea element.
  option:    null,

  _listeners: [],  // Registered event listeners.

  // Public methods
  // --------------

  initialize: function(element, completer, options) {
    this.el        = element;
    this.id        = completer.id + this.constructor.name;
    this.completer = completer;
    this.options    = options;

    if (this.options.debounce) {
      this._onKeyup = util.debounce(this._onKeyup, this.options.debounce);
    }

    this._bindEvents();
  },

  on: function(type, func) {
    this.el.addEventListener(type, func);
    this._listeners.push({ type: type, func: func });
  },

  destroy: function() {
    this._listeners.forEach(function(l) {
      this.el.removeEventListener(l.type, l.func);
    }, this);

    this.$el = this.el = this.completer = null;
  },

  /**
   * Update the element with the given value and strategy.
   *
   * @param {Object} value The selected object. It is one of the item of the
   * array which was callbacked from the search function.
   * @param {Strategy} strategy The Strategy associated with the selected value.
   * @return {void}
   */
  select: function(/* value, strategy */) {
    throw new Error('Not implemented');
  },

  /**
   * Returns the caret's relative coordinates from body's top-left corner.
   * @return {number} The caret's relative coordinates from body's top-left corner.
   */
  getCaretPosition: function() {
    var position = this._getCaretRelativePosition(),
        offset = util.offset(el),
        parent = this.options.appendTo,
        parentOffset;

    // Calculate the left top corner of `this.options.appendTo` element.
    if (parent) {
       parentOffset = util.offset(parent.offsetParent || parent);
       offset.top  -= parentOffset.top;
       offset.left -= parentOffset.left;
    }

    position.top  += offset.top;
    position.left += offset.left;
    return position;
  },

  // Focus on the element.
  focus: function() {
    this.el.focus();
  },

  // Private methods
  // ---------------

  _bindEvents: function() {
    this.on('keyup', this._onKeyup.bind(this));
  },

  _onKeyup: function(e) {
    if (this._skipSearch(e)) return;
    this.completer.trigger(this.getTextFromHeadToCaret(), true);
  },

  // Suppress searching if it returns true.
  _skipSearch: function(clickEvent) {
    switch (clickEvent.keyCode) {
      case 9:  // TAB
      case 13: // ENTER
      case 40: // DOWN
      case 38: // UP
        return true;
    }
    if (clickEvent.ctrlKey) switch (clickEvent.keyCode) {
      case 78: // Ctrl-N
      case 80: // Ctrl-P
        return true;
    }
  }
});

module.exports = Adapter;
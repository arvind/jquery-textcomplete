/* jshint node: true */

'use strict';

var Dropdown = require('./Dropdown'),
    adapters = require('./adapters'),
    util = require('./util'),
    id = 0;

function Completer(element, options) {
  this.el = element;
  this.id = 'textcomplete' + (++id);
  this.views   = [];
  this.options = Object.assign({}, Completer._getDefaults(), options);
  this.strategies = [];

  var self = this,
      tagName  = this.el.tagName.toLowerCase(),
      tagType  = this.el.getAttribute('type'),
      editable = this.el.isContentEditable;

  if (tagName !== 'input' && tagType !== 'text' && tagType !== 'search' && tagName !== 'textarea' && !editable) {
    throw new Error('TextComplete must be called on a textarea or a contenteditable element.');
  }

  if (element === document.activeElement) {
    // element has already been focused. Initialize view objects immediately.
    this.initialize();
  } else {
    // Initialize view objects lazily.
    util.one(this.el, 'focus', function() { self.initialize(); });
  }
}

Completer._getDefaults = function() {
  if (!Completer.DEFAULTS) {
    Completer.DEFAULTS = {
      appendTo: document.body,
      zIndex: '100'
    };
  }

  return Completer.DEFAULTS;
};

Object.assign(Completer.prototype, {
  // Public properties
  // -----------------

  id:         null,
  option:     null,
  strategies: null,
  adapter:    null,
  dropdown:   null,

  // Public methods
  // --------------

  initialize: function() {
    var el = this.el,
        tagName = el.tagName().toLowerCase(),
        Adapter, viewName;

    // Initialize view objects.
    this.dropdown = new Dropdown(el, this, this.options);

    if (this.options.adapter) {
      Adapter = this.options.adapter;
    } else {
      if (tagName === 'textarea' || tagName === 'input') {
        viewName = util.isNumber(el.selectionEnd) ? 'Textarea' : 'IETextarea';
      } else {
        viewName = 'ContentEditable';
      }
      Adapter = adapters[viewName];
    }

    this.adapter = new Adapter(el, this, this.options);
  },

  // TODO
  destroy: function() {
    if (this.adapter)  {
      this.adapter.destroy();
    }
    if (this.dropdown) {
      this.dropdown.destroy();
    }

    this.el = this.adapter = this.dropdown = null;
  },

  deactivate: function() {
    if (this.dropdown) {
      this.dropdown.deactivate();
    }
  },

  // Invoke textcomplete.
  trigger: function(text, skipUnchangedTerm) {
    if (!this.dropdown) this.initialize();
    text = text || this.adapter.getTextFromHeadToCaret();
    var searchQuery = this._extractSearchQuery(text);
    if (searchQuery.length) {
      var term = searchQuery[1];
      // Ignore shift-key, ctrl-key and so on.
      if (skipUnchangedTerm && this._term === term && term !== "") { return; }
      this._term = term;
      this._search.apply(this, searchQuery);
    } else {
      this._term = null;
      this.dropdown.deactivate();
    }
  },

  fire: function(eventName) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (eventName.indexOf('textComplete') >= 0) {
      util.triggerCustom(eventName, args);
    } else {
      util.triggerNative(eventName, args);
    }

    return this;
  },

  register: function(strategies) {
    Array.prototype.push.apply(this.strategies, strategies);
  },

  // Insert the value into adapter view. It is called when the dropdown is clicked
  // or selected.
  //
  // value    - The selected element of the array callbacked from search func.
  // strategy - The Strategy object.
  // e        - Click or keydown event object.
  select: function(value, strategy, e) {
    this._term = null;
    this.adapter.select(value, strategy, e);
    this.fire('change').fire('textComplete:select', value, strategy);
    this.adapter.focus();
  },

  // Private properties
  // ------------------

  _clearAtNext: true,
  _term:        null,

  // Private methods
  // ---------------

  // Parse the given text and extract the first matching strategy.
  //
  // Returns an array including the strategy, the query term and the match
  // object if the text matches an strategy; otherwise returns an empty array.
  _extractSearchQuery: function(text) {
    var strategy, context, matchRegexp, match;

    for (var i = 0; i < this.strategies.length; i++) {
      strategy = this.strategies[i];
      context = strategy.context(text);

      if (context || context === '') {
        matchRegexp = util.isFunction(strategy.match) ?
          strategy.match(text) : strategy.match;

        if (util.isString(context)) {
          text = context;
        }

        match = text.match(matchRegexp);
        if (match) {
          return [strategy, match[strategy.index], match];
        }
      }
    }

    return [];
  },

  // Call the search method of selected strategy..
  _search: util.lock(function(free, strategy, term, match) {
    var self = this;
    strategy.search(term, function(data, stillSearching) {
      if (!self.dropdown.shown) {
        self.dropdown.activate();
      }

      if (self._clearAtNext) {
        // The first callback in the current lock.
        self.dropdown.clear();
        self._clearAtNext = false;
      }

      self.dropdown.setPosition(self.adapter.getCaretPosition());
      self.dropdown.render(self._zip(data, strategy, term));

      if (!stillSearching) {      // The last callback in the current lock.
        free();
        self._clearAtNext = true; // Call dropdown.clear at the next time.
      }

    }, match);
  }),

  /**
   * Build a parameter for Dropdown#render. For example,
   *
   * this._zip(['a', 'b'], 's');
   * //=> [{ value: 'a', strategy: 's' }, { value: 'b', strategy: 's' }]
   *
   * @param  {Object[]} data     [description]
   * @param  {Strategy} strategy [description]
   * @param  {string} term     [description]
   * @return {Object[]}          [description]
   */
  _zip: function(data, strategy, term) {
    return data.map(function(value) {
      return { value: value, strategy: strategy, term: term };
    });
  }
});

module.exports = Completer;

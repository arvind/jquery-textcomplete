(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.tc = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// The MIT License (MIT)
//
// Copyright (c) 2015 Jonathan Ong me@jongleberry.com
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
// associated documentation files (the "Software"), to deal in the Software without restriction,
// including without limitation the rights to use, copy, modify, merge, publish, distribute,
// sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or
// substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
// NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
// https://github.com/component/textarea-caret-position

// The properties that we copy into a mirrored div.
// Note that some browsers, such as Firefox,
// do not concatenate properties, i.e. padding-top, bottom etc. -> padding,
// so we have to do every single property specifically.
/* jshint node: true */

var properties = [
  'direction',  // RTL support
  'boxSizing',
  'width',  // on Chrome and IE, exclude the scrollbar, so the mirror div wraps exactly as the textarea does
  'height',
  'overflowX',
  'overflowY',  // copy the scrollbar for IE

  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',

  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',

  // https://developer.mozilla.org/en-US/docs/Web/CSS/font
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',

  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',  // might not make a difference, but better be safe

  'letterSpacing',
  'wordSpacing',

  'tabSize',
  'MozTabSize'

];

var isBrowser = (typeof window !== 'undefined');
var isFirefox = (isBrowser && window.mozInnerScreenX != null);

function getCaretCoordinates(element, position, options) {
  if(!isBrowser) {
    throw new Error('textarea-caret-position#getCaretCoordinates should only be called in a browser');
  }

  var debug = options && options.debug || false;
  if (debug) {
    var el = document.querySelector('#input-textarea-caret-position-mirror-div');
    if ( el ) { el.parentNode.removeChild(el); }
  }

  // mirrored div
  var div = document.createElement('div');
  div.id = 'input-textarea-caret-position-mirror-div';
  document.body.appendChild(div);

  var style = div.style;
  var computed = window.getComputedStyle? getComputedStyle(element) : element.currentStyle;  // currentStyle for IE < 9

  // default textarea styles
  style.whiteSpace = 'pre-wrap';
  if (element.nodeName !== 'INPUT')
    style.wordWrap = 'break-word';  // only for textarea-s

  // position off-screen
  style.position = 'absolute';  // required to return coordinates properly
  if (!debug)
    style.visibility = 'hidden';  // not 'display: none' because we want rendering

  // transfer the element's properties to the div
  properties.forEach(function(prop) {
    style[prop] = computed[prop];
  });

  if (isFirefox) {
    // Firefox lies about the overflow property for textareas: https://bugzilla.mozilla.org/show_bug.cgi?id=984275
    if (element.scrollHeight > parseInt(computed.height))
      style.overflowY = 'scroll';
  } else {
    style.overflow = 'hidden';  // for Chrome to not render a scrollbar; IE keeps overflowY = 'scroll'
  }

  div.textContent = element.value.substring(0, position);
  // the second special handling for input type="text" vs textarea: spaces need to be replaced with non-breaking spaces - http://stackoverflow.com/a/13402035/1269037
  if (element.nodeName === 'INPUT')
    div.textContent = div.textContent.replace(/\s/g, '\u00a0');

  var span = document.createElement('span');
  // Wrapping must be replicated *exactly*, including when a long word gets
  // onto the next line, with whitespace at the end of the line before (#7).
  // The  *only* reliable way to do that is to copy the *entire* rest of the
  // textarea's content into the <span> created at the caret position.
  // for inputs, just '.' would be enough, but why bother?
  span.textContent = element.value.substring(position) || '.';  // || because a completely empty faux span doesn't render at all
  div.appendChild(span);

  var coordinates = {
    top: span.offsetTop + parseInt(computed['borderTopWidth']),
    left: span.offsetLeft + parseInt(computed['borderLeftWidth'])
  };

  if (debug) {
    span.style.backgroundColor = '#aaa';
  } else {
    document.body.removeChild(div);
  }

  return coordinates;
}

module.exports = getCaretCoordinates;

},{}],2:[function(require,module,exports){
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

},{"./Dropdown":3,"./adapters":9,"./util":12}],3:[function(require,module,exports){
/* jshint node: true */

'use strict';

var util = require('./util');

var dropdownViews = {};

document.addEventListener('click', function(e) {
  var id = e.originalEvent && e.originalEvent.keepTextCompleteDropdown;
  Object.keys(dropdownViews).forEach(function(key) {
    var view = dropdownViews[key];
    if (key !== id) view.deactivate();
  })
});

var COMMANDS = require('./commands');

var OPTIONS = ['maxCount', 'placement', 'footer', 'header',
  'noResultsMessage', 'className'];

// Dropdown view
// =============

// Construct Dropdown object.
//
// element - Textarea or contenteditable element.
function Dropdown(element, completer, options) {
  this.el        = Dropdown.createElement(options);
  this.completer = completer;
  this.id        = completer.id + 'dropdown';
  this._data     = []; // zipped data.
  this.inputEl   = element;
  this.options   = options;

  // Override setPosition method.
  if (options.listPosition) {
    this.setPosition = options.listPosition;
  }

  if (options.height) {
    this.el.height(options.height);
  }

  // opt.name potentially empty
  OPTIONS.forEach(function(opt) {
    console.log('Dropdown.js -- Dropdown constructor', opt);
    if (options[opt.name] != null) {
      this[opt.name] = options[opt.name];
    }
  }, this);

  this._bindEvents(element);
  dropdownViews[this.id] = this;
}

Object.assign(Dropdown, {
  // Class methods
  // -------------

  createElement: function(options) {
    var parent = options.appendTo,
        el = document.createElement('ul');

    if (el.classList) {
      el.classList.add('dropdown-menu', 'textcomplete-dropdown');
    } else {
      el.className += ' dropdown-menu textcomplete-dropdown';
    }

    el.setAttribute('id', 'textcomplete-dropdown-' + options._oid);
    Object.assign(el.style, {
      display: 'none',
      position: 'absolute',
      left: 0,
      zIndex: options.zIndex
    });

    parent.appendChild(el);
    return el;
  }
});

Object.assign(Dropdown.prototype, {
  // Public properties
  // -----------------

  el:        null,  // ul.dropdown-menu element.
  inputEl:   null,  // target textarea.
  completer: null,
  footer:    null,
  header:    null,
  id:        null,
  maxCount:  10,
  placement: '',
  shown:     false,
  data:      [],     // Shown zipped data.
  className: '',

  _elListeners: [],
  _inputElListeners: [],

  // Public methods
  // --------------
  on: function(el, type, func) {
    var listeners = el === this.el ? this._elListeners : this._inputElListeners;
    el.addEventListener(type, func);
    listeners.push({ type: type, func: func });
  },

  destroy: function() {
    // Don't remove el because it may be shared by several textcompletes.
    this.deactivate();

    this._elListeners.forEach(function(l) {
      this.el.removeEventListener(l.type, l.func);
    }, this);

    this._inputElListeners.forEach(function(l) {
      this.inputEl.removeEventListener(l.type, l.func);
    }, this);

    this.clear();

    this.el.parentNode.removeChild(this.el);
    this.el = this.inputEl = this.completer = null;
    delete dropdownViews[this.id];
  },

  render: function(zippedData) {
    var contentsHtml = this._buildContents(zippedData);
    var unzippedData = this.data.map(function(d) { return d.value; });
    if (this.data.length) {
      var strategy = zippedData[0].strategy;
      if (strategy.id) {
        this.el.setAttribute('data-strategy', strategy.id);
      } else {
        this.el.removeAttribute('data-strategy');
      }
      this._renderHeader(unzippedData);
      this._renderFooter(unzippedData);
      if (contentsHtml) {
        this._renderContents(contentsHtml);
        this._fitToBottom();
        this._fitToRight();
        this._activateIndexedItem();
      }
      this._setScroll();
    } else if (this.noResultsMessage) {
      this._renderNoResultsMessage(unzippedData);
    } else if (this.shown) {
      this.deactivate();
    }
  },

  setPosition: function(pos) {
    // Make the dropdown fixed if the input is also fixed
    // This can't be done during init, as textcomplete may be used on multiple elements on the same page
    // Because the same dropdown is reused behind the scenes, we need to recheck every time the dropdown is showed
    var position = 'absolute',
        set = [],
        setElem = this.inputEl;

    // http://stackoverflow.com/a/8729274/3457884
    // TODO: move out to util?
    while (setElem) {
      set.unshift(setElem);
      setElem = setElem.parentNode;
    }

    // Check if input or one of its parents has positioning we need to care about
    set.forEach(function(currentSetItem) {
      if (document.querySelectorAll(window)[0].getComputedStyle(currentSetItem).position === 'absolute')
        return false;

      if (document.querySelectorAll(window)[0].getComputedStyle(currentSetItem).position === 'fixed') {
        pos.top -= document.querySelectorAll(window)[0].scrollTop();
        pos.left -= document.querySelectorAll(window)[0].scrollLeft();
        position = 'fixed';
        return false;
      }
    });

    Object.assign(this.el.style, this._applyPlacement(pos));
    this.el.style.position = position;

    // ?
    return this;
  },

  clear: function() {
    this.el.innerHTML = '';
    this.data = [];
    this._index = 0;
    this._$header = this._$footer = this._$noResultsMessage = null;
  },

  activate: function() {
    if (!this.shown) {
      this.clear();
      this.el.style.display = '';
      if (this.className) this.el.classList.add(this.className);
      this.completer.fire('textComplete:show');
      this.shown = true;
    }
    return this;
  },

  deactivate: function() {
    if (this.shown) {
      this.el.style.display = 'none';
      if (this.className) this.el.classList.remove(this.className);
      this.completer.fire('textComplete:hide');
      this.shown = false;
    }
    return this;
  },

  isUp: function(e) {
    return e.keyCode === 38 || (e.ctrlKey && e.keyCode === 80);  // UP, Ctrl-P
  },

  isDown: function(e) {
    return e.keyCode === 40 || (e.ctrlKey && e.keyCode === 78);  // DOWN, Ctrl-N
  },

  isEnter: function(e) {
    var modifiers = e.ctrlKey || e.altKey || e.metaKey || e.shiftKey;
    return !modifiers && (e.keyCode === 13 || e.keyCode === 9 || (this.options.completeOnSpace === true && e.keyCode === 32))  // ENTER, TAB
  },

  isPageup: function(e) {
    return e.keyCode === 33;  // PAGEUP
  },

  isPagedown: function(e) {
    return e.keyCode === 34;  // PAGEDOWN
  },

  isEscape: function(e) {
    return e.keyCode === 27;  // ESCAPE
  },

  // Private properties
  // ------------------

  _data:    null,  // Currently shown zipped data.
  _index:   null,
  _$header: null,
  _$noResultsMessage: null,
  _$footer: null,

  // Private methods
  // ---------------
  _bindEvents: function() {
    // might need custom event generator module
    this.el.addEventListener('mousedown.' + this.id, function(e) {
      if (e.target && e.target.classList.contains('.textcomplete-item')) {
        this._onClick(e);
      }
    }.bind(this), false);

    this.el.addEventListener('touchstart.' + this.id, function(e) {
      if (e.target && e.target.classList.contains('.textcomplete-item')) {
        this._onClick(e);
      }
    }.bind(this), false);

    this.el.addEventListener('mouseover.' + this.id, function(e) {
      if (e.target && e.target.classList.contains('.textcomplete-item')) {
        this._onClick(e);
      }
    }.bind(this), false);

    this.inputEl.addEventListener('keydown.' + this.id, this._onKeydown.bind(this), false);
  },

  _onClick: function(e) {
    e.preventDefault();

    var el = e.target;
    if (el.classList.contains('textcomplete-item')) {
      el = util.closest(el, 'textcomplete-item');
    }

    // suspect: el.getAttribute('data-index') undefined
    var datum = this.data[parseInt(el.getAttribute('data-index'), 10)];

    this.completer.select(datum.value, datum.strategy, e);
    var self = this;

    /*
      Deactive at next tick to allow other event handlers to know whether
      the dropdown has been shown or not.

      suspect: the use of setTimeout, especially with 0s|ms of separation
              between calls
    */
    setTimeout(function() {
      self.deactivate();
      if (e.type === 'touchstart') {
        self.$inputEl.focus();
      }
    }, 0);
  },

  // Activate hovered item.
  _onMouseover: function(e) {
    e.preventDefault();
    var el = e.target;

    if (!el.classList.contains('textcomplete-item')) {
      el = util.closest(el, 'textcomplete-item');
    }

    this._index = parseInt(el.getAttribute('data-index'), 10);
    this._activateIndexedItem();
  },

  _onKeydown: function(e) {
    if (!this.shown) { return; }

    var command;

    if (typeof this.options.onKeydown === 'function') {
      command = this.options.onKeydown(e, COMMANDS);
    }

    if (command == null) {
      command = this._defaultKeydown(e);
    }

    switch (command) {
      case COMMANDS.KEY_UP:
        e.preventDefault();
        this._up();
        break;
      case COMMANDS.KEY_DOWN:
        e.preventDefault();
        this._down();
        break;
      case COMMANDS.KEY_ENTER:
        e.preventDefault();
        this._enter(e);
        break;
      case COMMANDS.KEY_PAGEUP:
        e.preventDefault();
        this._pageup();
        break;
      case COMMANDS.KEY_PAGEDOWN:
        e.preventDefault();
        this._pagedown();
        break;
      case COMMANDS.KEY_ESCAPE:
        e.preventDefault();
        this.deactivate();
        break;
    }
  },

  _defaultKeydown: function(e) {
    if (this.isUp(e)) {
      return COMMANDS.KEY_UP;
    } else if (this.isDown(e)) {
      return COMMANDS.KEY_DOWN;
    } else if (this.isEnter(e)) {
      return COMMANDS.KEY_ENTER;
    } else if (this.isPageup(e)) {
      return COMMANDS.KEY_PAGEUP;
    } else if (this.isPagedown(e)) {
      return COMMANDS.KEY_PAGEDOWN;
    } else if (this.isEscape(e)) {
      return COMMANDS.KEY_ESCAPE;
    }
  },

  _up: function() {
    if (this._index === 0) {
      this._index = this.data.length - 1;
    } else {
      this._index -= 1;
    }
    this._activateIndexedItem();
    this._setScroll();
  },

  _down: function() {
    if (this._index === this.data.length - 1) {
      this._index = 0;
    } else {
      this._index += 1;
    }
    this._activateIndexedItem();
    this._setScroll();
  },

  _enter: function(e) {
    var datum = this.data[parseInt(this._getActiveElement().getAttribute('data-index'), 10)];
    this.completer.select(datum.value, datum.strategy, e);
    this.deactivate();
  },

  _pageup: function() {

    // suspect: means of calculating threshold
    var target = 0;
    var threshold = this._getActiveElement().offsetTop - this.el.innerHeight;

    // suspect: values returned by offsetTop, outerHeight compared to computed styles
    this.el.children.forEach(function(i) {
      if (i.offsetTop + i.outerHeight > threshold) {
        target = i;
        return false;
      }
    });

    this._index = target;
    this._activateIndexedItem();
    this._setScroll();
  },

  _pagedown: function() {

    var target = this.data.length - 1;
    var threshold = this._getActiveElement().offsetTop + this.el.innerHeight;

    this.el.children.forEach(function(i) {
      console.log(i);
      if (i.offsetTop > threshold) {
        target = i;
        return false;
      }
    });

    this._index = target;
    this._activateIndexedItem();
    this._setScroll();
  },

  _activateIndexedItem: function() {
    this.el.querySelector('.textcomplete-item.active').classList.remove('active');
    this._getActiveElement().classList.add('active');
  },

  _getActiveElement: function() {
    // return this.el.children('.textcomplete-item:nth(' + this._index + ')');
    // suspect: might not return the nth child
    return this.el.getElementsByClassName('textcomplete-item')[this._index - 1];
  },

  _setScroll: function() {
    var activeEl = this._getActiveElement();
    var itemTop = activeEl.offsetTop;
    var itemHeight = activeEl.outerHeight;
    var visibleHeight = this.el.innerHeight;
    var visibleTop = this.el.scrollTop;
    if (this._index === 0 || this._index == this.data.length - 1 || itemTop < 0) {
      this.el.scrollTop = itemTop + visibleTop;
    } else if (itemTop + itemHeight > visibleHeight) {
      this.el.scrollTop = itemTop + itemHeight + visibleTop - visibleHeight;
    }
  },

  _buildContents: function(zippedData) {
    var datum, i, index;
    var html = '';
    // higher order iterator instead?
    for (i = 0; i < zippedData.length; i++) {
      if ((this.data.length === this.maxCount) || !(util.include(this.data, datum))) break;
      datum = zippedData[i];
      index = this.data.length;
      this.data.push(datum);
      html += '<li class="textcomplete-item" data-index="' + index + '"><a>';
      html +=   datum.strategy.template(datum.value, datum.term);
      html += '</a></li>';
    }
    return html;
  },

  _renderHeader: function(unzippedData) {
    if (this.header) {
      if (!this._$header) {

        // suspect: translation loss form jq to native js
        var headerEl = document.createElement('li');
        headerEl.classList.add('textcomplete-header');
        this._$header = this.el.insertBefore(headerEl, this.el.firstChild);
      }
      var html = (typeof this.header === 'function') ? this.header(unzippedData) : this.header;
      this._$header.innerHTML = html;
    }
  },

  _renderFooter: function(unzippedData) {
    if (this.footer) {
      if (!this._$footer) {

        // suspect: translation loss form jq to native js
        this._$footer = this.el.innerHTML += '<li class="textcomplete-footer"></li>';

      }
      var html = (typeof this.footer === 'function') ? this.footer(unzippedData) : this.footer;
      this._$footer.innerHTML = html;
    }
  },

  _renderNoResultsMessage: function(unzippedData) {
    if (this.noResultsMessage) {
      if (!this._$noResultsMessage) {
        this._$noResultsMessage = this.el.innerHTML += '<li class="textcomplete-no-results-message"></li>';
      }
      var html = (typeof this.noResultsMessage === 'function') ? this.noResultsMessage(unzippedData) : this.noResultsMessage;
      this._$noResultsMessage.html(html);
    }
  },

  _renderContents: function(html) {
    if (this._$footer) {
      this._$footer.insertAdjacentHTML('beforebegin', html);
    } else {
      this.el.appendChild(html);
    }
  },

  _fitToBottom: function() {
    var windowScrollBottom = document.querySelectorAll(window)[0].scrollTop + document.querySelectorAll(window)[0].height;
    var height = this.el.style.height;
    if ((this.el.offsetTop + height) > windowScrollBottom) {
      // suspect: translation loss form jq to native js
      this.el.top = windowScrollBottom - height;
    }
  },

  _fitToRight: function() {
    // We don't know how wide our content is until the browser positions us, and at that point it clips us
    // to the document width so we don't know if we would have overrun it. As a heuristic to avoid that clipping
    // (which makes our elements wrap onto the next line and corrupt the next item), if we're close to the right
    // edge, move left. We don't know how far to move left, so just keep nudging a bit.

    // var tolerance = 30; // pixels. Make wider than vertical scrollbar because we might not be able to use that space.
    // while (this.el.offset().left + this.el.width() > $window.width() - tolerance) {
    //   this.el.offset({left: this.el.offset().left - tolerance});
    // }

    // suspect: miscalculation or translation loss form jq to native js
    var tolerance = 30;
    var left = this.el.getBoundingClientRect().left + document.body.scrollLeft,
        width = this.el.style.width;
    while (left + width > tolerance) {
      this.el.left = (this.el.getBoundingClientRect().left + document.body.scrollLeft) - tolerance;
    }
  },

  _applyPlacement: function(position) {
    // If the 'placement' option set to 'top', move the position above the element.
    if (this.placement === 'top') {
      // Overwrite the position object to set the 'bottom' property instead of the top.
      position = {
        top: 'auto',
        bottom: this.el.parentNode.style.height - position.top + position.lineHeight,
        left: position.left
      };
    } else {
      position.bottom = 'auto';
      delete position.lineHeight;
    }
    if (this.placement === 'absleft') {
      position.left = 0;
    } else if (this.placement === 'absright') {
      position.right = 0;
      position.left = 'auto';
    }
    return position;
  }
});

module.exports = Dropdown;

},{"./commands":10,"./util":12}],4:[function(require,module,exports){
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

},{"./util":12}],5:[function(require,module,exports){
/* jshint node: true */

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
        offset = util.offset(this.el),
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
    if (clickEvent.ctrlKey)
      switch (clickEvent.keyCode) {
        case 78: // Ctrl-N
        case 80: // Ctrl-P
          return true;
      }
  }
});

module.exports = Adapter;

},{"../util":12}],6:[function(require,module,exports){
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
        post = content.substring(range.startOffset),
        newSubstr = strategy.replace(value, e),
        preWrapper, postWrapper, fragment, childNode, lastOfPre;

    if (typeof newSubstr !== 'undefined') {
      if (util.isArray(newSubstr)) {
        post = newSubstr[1] + post;
        newSubstr = newSubstr[0];
      }

      pre = pre.replace(strategy.match, newSubstr);
      range.selectNodeContents(range.startContainer);
      range.deleteContents();

      // create temporary elements
      preWrapper  = document.createElement('div');
      postWrapper = document.createElement('div');
      preWrapper.innerHTML = postWrapper.innerHTML = post;

      // create the fragment thats inserted
      fragment = document.createDocumentFragment();

      while (childNode === preWrapper.firstChild) {
      	lastOfPre = fragment.appendChild(childNode);
      }

      while (childNode === postWrapper.firstChild) {
      	fragment.appendChild(childNode);
      }

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

},{"../util":12,"./Adapter":5}],7:[function(require,module,exports){
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

},{"../util":12,"./Textarea":8}],8:[function(require,module,exports){
/* jshint node: true */

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

},{"../../lib/textarea_caret":1,"../util":12,"./Adapter":5}],9:[function(require,module,exports){
/* jshint node: true */
module.exports = {
  ContentEditable: require('./ContentEditable'),
  Textarea: require('./Textarea'),
  IETextarea: require('./IETextarea')
};

},{"./ContentEditable":6,"./IETextarea":7,"./Textarea":8}],10:[function(require,module,exports){
/* jshint node: true */

module.exports = {
  SKIP_DEFAULT: 0,
  KEY_UP: 1,
  KEY_DOWN: 2,
  KEY_ENTER: 3,
  KEY_PAGEUP: 4,
  KEY_PAGEDOWN: 5,
  KEY_ESCAPE: 6
};

},{}],11:[function(require,module,exports){
/* jshint node: true */

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
    id = 0,
    registry = {};

var COMMANDS = require('./commands');

/**
 * Initialize the TextComplete interaction.
 * @param  {DomElement[]} elems An array of DOM element nodes
 * (e.g., selected with document.querySelectorAll).
 * @param  {Strategy} strategies TextComplete Strategy definition
 * @param  {Object} options Customize TextComplete interaction.
 * @return {void}
 */
function TextComplete(elems, strategies, options) {
  elems.forEach(function(el) {
    var data = el.dataset,
        completer = registry[data.textComplete];

    if (!completer) {
      options = options || {};
      options._oid = ++id;  // unique object id
      completer = registry[id] = new Completer(el, options);
    }

    if (util.isString(strategies)) {
      if (!completer) return;
      completer[strategies].call(completer, options);
      if (strategies === 'destroy') {
        delete data.textComplete;
      }
    } else {
      completer.register(Strategy.parse(strategies, el));
    }
  });
}

// s
Object.assign(TextComplete.prototype, COMMANDS);

module.exports = TextComplete;

},{"./Completer":2,"./Strategy":4,"./commands":10,"./util":12}],12:[function(require,module,exports){
/* jshint node: true */

'use strict';

var toString = Object.prototype.toString;

/**
 * Tests if the passed argument is a string.
 * @param  {Object}  obj A JavaScript object.
 * @return {Boolean} Returns true if the given argument is a string.
 */
function isString(obj) {
  return typeof value === 'string' || toString.call(obj) === '[object String]';
}

/**
 * Tests if the passed argument is a function.
 * @param  {Object}  obj A JavaScript object.
 * @return {Boolean} Returns true if the given argument is a function.
 */
function isFunction(obj) {
  return toString.call(obj) === '[object Function]';
}

/**
 * Tests if the passed argument is a number.
 * @param  {Object}  obj A JavaScript object.
 * @return {Boolean} Returns true if the given argument is a number.
 */
function isNumber(obj) {
  return typeof obj === 'number' || toString.call(obj) === '[object Number]';
}

/**
 * Tests if the passed argument is a array.
 * @param  {Object}  obj A JavaScript object.
 * @return {Boolean} Returns true if the given argument is a array.
 */
function isArray(obj) {
  return toString.call(obj) === '[object Array]';
}

/**
 * Prints a warning message to the JavaScript console.
 * @param  {string} message The message to log.
 * @return {void}
 */
function warn(message) {
  if (console.warn) { console.warn(message); }
}

/**
 * Memoize a search function.
 * @param  {Function} func A search function to memoize.
 * @return {Function} The memoized search function.
 */
function memoize(func) {
  var memo = {};
  return function(term, callback) {
    if (memo[term]) {
      callback(memo[term]);
    } else {
      func.call(this, term, function(data) {
        memo[term] = (memo[term] || []).concat(data);
        callback.apply(null, arguments);
      });
    }
  };
}

/**
 * Exclusive execution control utility. Once the given function is called,
 * additional executions are ignored until it is "freed" by invoking the passed
 * first argument. When this occurs, the most recent ignored execution is
 * immediately replayed. For example,
 *
 *  var lockedFunc = lock(function(free) {
 *    setTimeout(function { free(); }, 1000); // It will be free in 1 sec.
 *    console.log('Hello, world');
 *  });
 *  lockedFunc();  // => 'Hello, world'
 *  lockedFunc();  // none
 *  lockedFunc();  // none
 *  // 1 sec past then
 *  // => 'Hello, world'
 *  lockedFunc();  // => 'Hello, world'
 *  lockedFunc();  // none
 *
 * @param  {Function} func The function to be locked.
 * @return {Function} The wrapped function, with `free` as the first argument.
 */
function lock(func) {
  var locked, queuedArgsToReplay;

  return function() {
    // Convert arguments into a real array.
    var args = Array.prototype.slice.call(arguments);
    if (locked) {
      // Keep a copy of this argument list to replay later.
      // OK to overwrite a previous value because we only replay
      // the last one.
      queuedArgsToReplay = args;
      return;
    }
    locked = true;
    var self = this;
    args.unshift(function replayOrFree() {
      if (queuedArgsToReplay) {
        // Other request(s) arrived while we were locked.
        // Now that the lock is becoming available, replay
        // the latest such request, then call back here to
        // unlock (or replay another request that arrived
        // while this one was in flight).
        var replayArgs = queuedArgsToReplay;
        queuedArgsToReplay = undefined;
        replayArgs.unshift(replayOrFree);
        func.apply(self, replayArgs);
      } else {
        locked = false;
      }
    });
    func.apply(this, args);
  };
}

/**
 * Attaches the given handler to the element. The handler is unbound after it
 * is invoked the first time.
 * @param  {DomElement} el
 * @param  {Function} func
 * @return {DomElement}
 */
function one(el, type, func) {
  var wrap = function() {
    func();
    el.removeEventListener(type, wrap);
  };

  el.addEventListener(type, wrap);
}

function triggerNative(el, type) {
  var event = document.createEvent('HTMLEvents');
  event.initEvent(type, true, false);
  el.dispatchEvent(event);
}

function triggerCustom(el, type, data) {
  var event;
  if (window.CustomEvent) {
    event = new CustomEvent(type, {detail: data});
  } else {
    event = document.createEvent('CustomEvent');
    event.initCustomEvent(type, true, true, data);
  }

  el.dispatchEvent(event);
}

/**
 * Returns a function, that, as long as it continues to be invoked, will not
 * be triggered. The function will be called after it stops being called for
`* wait` msec. This utility function was originally implemented at Underscore.js.
 *
 * @param  {Function} func Function to debounce
 * @param  {number} wait Time between invocations, in milliseconds.
 * @return {Function} Debounced function.
 */
function debounce(func, wait) {
  var timeout, args, context, timestamp, result;
  var later = function() {
    var last = Date.now() - timestamp;
    if (last < wait) {
      timeout = setTimeout(later, wait - last);
    } else {
      timeout = null;
      result = func.apply(context, args);
      context = args = null;
    }
  };

  return function() {
    context = this;
    args = arguments;
    timestamp = Date.now();
    if (!timeout) {
      timeout = setTimeout(later, wait);
    }
    return result;
  };
}

function offset(el) {
  var rect = el.getBoundingClientRect();
  return {
    top: rect.top + document.body.scrollTop,
    left: rect.left + document.body.scrollLeft
  };
}

function include(zippedData, datum) {
  var idProperty = datum.strategy.idProperty,
      i, elem;

  for (i = 0; i < zippedData.length; i++) {
    elem = zippedData[i];
    if (elem.strategy !== datum.strategy) continue;
    if (idProperty) {
      if (elem.value[idProperty] === datum.value[idProperty]) return true;
    } else {
      if (elem.value === datum.value) return true;
    }
  }
  return false;
}

/* native js implementation of jQuery's .closest() */
function closest(el, targetClass) {
  while (el.className != targetClass) {
    el = el.parentNode;
    if (!el) {
      return null;
    }
  }
  return el;
}

// Polyfill Object.assign
if (typeof Object.assign != 'function') {
  (function() {
    Object.assign = function(target) {
      /* jshint node: true */
      // suspect: v
      // 'use strict';

      if (target === undefined || target === null) {
        throw new TypeError('Cannot convert undefined or null to object');
      }

      var output = Object(target);
      for (var index = 1; index < arguments.length; index++) {
        var source = arguments[index];
        if (source !== undefined && source !== null) {
          for (var nextKey in source) {
            if (source.hasOwnProperty(nextKey)) {
              output[nextKey] = source[nextKey];
            }
          }
        }
      }
      return output;
    };
  })();
}

module.exports = {
  debounce: debounce,
  include: include,
  isString: isString,
  isFunction: isFunction,
  isNumber: isNumber,
  isArray: Array.isArray || isArray,
  lock: lock,
  memoize: memoize,
  offset: offset,
  one: one,
  triggerNative: triggerNative,
  triggerCustom: triggerCustom,
  warn: warn,
  closest: closest
};

},{}]},{},[11])(11)
});
//# sourceMappingURL=textcomplete.js.map

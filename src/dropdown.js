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

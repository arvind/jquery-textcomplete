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

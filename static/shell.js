// Copyright 2007 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview
 * Javascript code for the interactive AJAX shell.
 *
 * Part of http://code.google.com/p/google-app-engine-samples/.
 *
 * Includes a function (shell.runStatement) that sends the current python
 * statement in the shell prompt text box to the server, and a callback
 * (shell.done) that displays the results when the XmlHttpRequest returns.
 *
 * Also includes cross-browser code (shell.getXmlHttpRequest) to get an
 * XmlHttpRequest.
 */

SymPy = {};

SymPy.Keys = {
    BACKSPACE: 8,  DEL:       49,
    TAB:       9,  SPACE:     32,
    ENTER:     13, ESC:       27,
    PAGE_UP:   33, PAGE_DOWN: 34,
    END:       35, HOME:      36,
    LEFT:      37, UP:        38,
    RIGHT:     39, DOWN:      40,
    A: 65, B: 66, C: 67, D: 68,
    E: 69, F: 70, G: 71, H: 72,
    I: 73, J: 74, K: 75, L: 76,
    M: 77, N: 78, O: 79, P: 80,
    Q: 81, R: 82, S: 83, T: 84,
    U: 85, V: 86, W: 87, X: 88,
    Y: 89, Z: 90,
    ZERO:  48, ONE:   49,
    TWO:   50, THREE: 51,
    FOUR:  52, FIVE:  53,
    SIX:   54, SEVEN: 55,
    EIGHT: 56, NINE:  57,
    ';':  59, ':':  59,
    '=':  61, '+':  61,
    '-': 109, '_': 109,
    ',': 188, '<': 188,
    '.': 190, '>': 190,
    '/': 191, '?': 191,
    '`': 192, '~': 192,
    '[': 219, '{': 219,
    ']': 221, '}': 221,
    "'": 222, '"': 222
};

/**
 * Shell namespace.
 * @type {Object}
 */
var shell = {}

/**
 * The shell history. history is an array of strings, ordered oldest to
 * newest. historyCursor is the current history element that the user is on.
 *
 * The last history element is the statement that the user is currently
 * typing. When a statement is run, it's frozen in the history, a new history
 * element is added to the end of the array for the new statement, and
 * historyCursor is updated to point to the new element.
 *
 * @type {Array}
 */
shell.history = [''];

/**
 * See {shell.history}
 * @type {number}
 */
shell.historyCursor = 0;

/**
 * A constant for the XmlHttpRequest 'done' state.
 * @type Number
 */
shell.DONE_STATE = 4;

/**
 * A cross-browser function to get an XmlHttpRequest object.
 *
 * @return {XmlHttpRequest?} a new XmlHttpRequest
 */
shell.getXmlHttpRequest = function() {
  if (window.XMLHttpRequest) {
    return new XMLHttpRequest();
  } else if (window.ActiveXObject) {
    try {
      return new ActiveXObject('Msxml2.XMLHTTP');
    } catch(e) {
      return new ActiveXObject('Microsoft.XMLHTTP');
    }
  }

  return null;
};

shell.setValue = function(value) {
    Ext.get('statement').dom.value = value;
};

shell.clearValue = function() {
    this.setValue("");
}

shell.getValue = function() {
    return Ext.get('statement').dom.value;
};

shell.isEmpty = function() {
    return this.getValue().length == 0;
};

shell.onPromptKeyDown = function(event) {
  if (this.historyCursor == this.history.length-1) {
    // we're on the current statement. update it in the history before doing anything.
    this.history[this.historyCursor] = this.getValue();
  }

  // should we pull something from the history?
  switch (event.getKey()) {
  case SymPy.Keys.UP:
    if (event.ctrlKey || this.isEmpty()) {
      event.preventDefault();

      if (this.historyCursor > 0) {
        this.setValue(this.history[--this.historyCursor]);
      }

      return false;
    }

    break;
  case SymPy.Keys.DOWN:
    if (event.ctrlKey || this.isEmpty()) {
      event.preventDefault();

      if (this.historyCursor < this.history.length - 1) {
        this.setValue(this.history[++this.historyCursor]);
      }

      return false;
    }

    break;
  case SymPy.Keys.ENTER:
    var shiftEnter = (Ext.get("submit_key").getValue() == "shift-enter");

    if (event.shiftKey == shiftEnter) {
      event.preventDefault();
      this.runStatement();
      return false;
    }

    break;
  }

  switch (event.getKey()) {
  case SymPy.Keys.BACKSPACE:
  case SymPy.Keys.ENTER:
    this.updatePrompt.defer(50, this);
    break;
  }

  return true;
};

shell.updatePrompt = function() {
    var prompt = ">>>",
        lines = this.getValue().split('\n');

    var i = 1,
        n = lines.length;

    for (; i < n; i++) {
        prompt += "\n...";
    }

    var caret = Ext.get("caret"),
        statement = Ext.get("statement");

    caret.dom.value = prompt;

    var rows = Math.max(4, n);

    caret.dom.setAttribute('rows', rows);
    statement.dom.setAttribute('rows', rows);
};

shell.prefixStatement = function() {
    var lines = this.getValue().split('\n');

    lines[0] = ">>> " + lines[0];

    var i = 1,
        n = lines.length;

    for (; i < n; i++) {
        lines[i] = "... " + lines[i];
    }

    return lines.join("\n");
};

/**
 * The XmlHttpRequest callback. If the request succeeds, it adds the command
 * and its resulting output to the shell history div.
 *
 * @param {XmlHttpRequest} req the XmlHttpRequest we used to send the current
 *     statement to the server
 */
shell.done = function(req) {
  if (req.readyState == this.DONE_STATE) {
    Ext.get('statement').removeClass('processing');

    // add the command to the shell output
    var output = document.getElementById('output');

    output.value += '\n' + this.prefixStatement();

    this.clearValue();
    this.updatePrompt();

    // add a new history element
    this.history.push('');
    this.historyCursor = this.history.length - 1;

    // add the command's result
    var result = req.responseText;

    if (result != '') {
      if (output.value[output.value.length-1] != '\n') {
        output.value += '\n';
      }

      output.value += result;
    }

    // scroll to the bottom
    output.scrollTop = output.scrollHeight;
    if (output.createTextRange) {
      var range = output.createTextRange();
      range.collapse(false);
      range.select();
    }
  }
};

/**
 * This is the form's onsubmit handler. It sends the python statement to the
 * server, and registers shell.done() as the callback to run when it returns.
 *
 * @return {Boolean} false to tell the browser not to submit the form.
 */
shell.runStatement = function() {
  var form = document.getElementById('form');

  // build a XmlHttpRequest
  var req = this.getXmlHttpRequest();
  if (!req) {
    document.getElementById('ajax-status').innerHTML =
        "<span class='error'>Your browser doesn't support AJAX. :(</span>";
    return false;
  }

  req.onreadystatechange = function() { shell.done(req); };

  // build the query parameter string
  var params = '';
  for (i = 0; i < form.elements.length; i++) {
    var elem = form.elements[i];
    if (elem.type != 'submit' && elem.type != 'button' && elem.id != 'caret') {
      var value = escape(elem.value).replace(/\+/g, '%2B'); // escape ignores +
      params += '&' + elem.name + '=' + value;
    }
  }

  // send the request and tell the user.
  Ext.get('statement').addClass('processing');

  req.open(form.method, form.action + '?' + params, true);
  req.setRequestHeader('Content-type',
                       'application/x-www-form-urlencoded;charset=UTF-8');
  req.send(null);

  return false;
};

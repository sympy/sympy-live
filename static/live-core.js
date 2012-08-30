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

utilities.namespace("SymPy");

SymPy.Keys = {
    BACKSPACE: 8,  DEL:       46,
    TAB:       9,  SPACE:     32,
    ENTER:     13, ESC:       27,
    PAGE_UP:   33, PAGE_DOWN: 34,
    END:       35, HOME:      36,
    LEFT:      37, UP:        38,
    RIGHT:     39, DOWN:      40,
    CTRL:      17,
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

SymPy.escapeHTML = function(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

SymPy.unescapeHTML = function(str) {
    return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
};

SymPy.lstrip = function(str) {
    return str.replace(/^\s+/, "");
};

SymPy.rstrip = function(str) {
    return str.replace(/\s+$/, "");
};

SymPy.strip = function(str) {
    return str.lstrip().rstrip();
};

SymPy.getDOMText = function(node) {
    // This is needed for cross-browser compatibility. Most browsers support
    // ``innerText`` but, for example, Firefox implements ``textContent``.
    return node.innerText || node.textContent;
};

SymPy.isTextNode = function(node) {
    return node.nodeType === 3;
};

SymPy.getBasePath = function(baseName) {
    if (baseName) {
        var scripts = document.getElementsByTagName('script');

        var reStart = RegExp("^(https?://[^/]+)/");
        var reEnd = RegExp("/" + baseName + "(\\?|$)");

        for (var i = scripts.length - 1; i >= 0; --i) {
            var src = scripts[i].src;

            if (src.match(reEnd) && src.match(reStart)) {
                return RegExp.$1;
            }
        }
    }

    return null;
};

SymPy.Shell = Class.$extend({
    banner: null,
    history: [''],
    historyCursor: 0,
    previousValue: "",
    evaluating: false,
    supportsSelection: false,
    fullscreenMode: false,
    leftHeight: $('#left').height(),

    printerTypes: ['repr', 'str', 'ascii', 'unicode', 'latex'],
    submitTypes: ['enter', 'shift-enter'],
    recordTypes: ['on', 'off'],
    autocompleteTypes: ['tab', 'ctrl-space'],
    printer: null,
    submit: null,
    tabWidth: 4,
    basePath: null,
    defaultBasePath: 'http://live.sympy.org',
    autocompleter: null,

    __init__: function(config) {
        config = $.extend({}, config);

        if (config.basePath) {
            this.basePath = config.basePath;
        } else {
            this.basePath = SymPy.getBasePath(config.baseName);
        }

        if (config.banner) {
            this.banner = config.banner;
            delete config.banner;
        } else {
            var elem = $('#banner');

            if (elem) {
                this.banner = elem.html();
            }
        }

        if (this.banner) {
            this.banner = SymPy.rstrip(this.banner) + '\n\n';
        }

        var index;

        index = this.printerTypes.indexOf(config.printer);
        this.printer = (index == -1) ? this.getCookie('sympy-printer', 'latex') : config.printer;

        index = this.submitTypes.indexOf(config.submit);
        this.submit = (index == -1) ? this.getCookie('sympy-submit', 'enter') : config.submit;

        index = this.recordTypes.indexOf(config.record);
        this.record = (index == -1) ? this.getCookie('sympy-privacy', 'on') : config.record;

        if (typeof config.forcedesktop !== "undefined" &&
            config.forcedesktop !== null) {
            this.forcedesktop = config.forcedesktop
        }
        else {
            this.forcedesktop = this.getCookie('desktop', false);
        }

        index = this.autocompleteTypes.indexOf(config.autocomplete);
        this.autocomplete = (index == -1) ?
            this.getCookie('sympy-autocomplete', 'tab') : config.autocomplete;

        delete config.printer;
        delete config.submit;

        if ($.isNumeric(config.tabWidth)) {
            this.tabWidth = config.tabWidth;
            delete config.tabWidth;
        }
    },

    render: function(el) {
        el = $(el) || $(document.body);

        this.outputEl = $('<div class="sympy-live-output" />').appendTo(el);

        if (this.banner) {
            this.outputEl.append($('<div>'+this.banner+'</div>'));
        }

        this.caretEl = $('<textarea/>').
            addClass('sympy-live-caret').
            attr({
                rows: '4',
                readonly: 'readonly'
            }).
            html('&gt;&gt;&gt;').
            appendTo(el);

        this.promptEl = $('<textarea/>').
            addClass('sympy-live-prompt').
            attr({
                rows: '4',
                spellcheck: 'false'
            }).
            appendTo(el);

        this.completionsEl = $('<div/>').
            addClass('sympy-live-autocompletions-container').
            appendTo(el);

        this.completer = new SymPy.Completer({
            input: this.promptEl,
            container: this.completionsEl,
            basePath: this.basePath
        }, this);
        this.completer.setup();

	    this.renderButtons(el);
	    var settings = $('#settings .content');
        this.renderToolbar(settings);

        this.caretEl.on("focus", function(event) {
            this.focus();
        }, this);

        var keyEvent = this.getKeyEvent();

        this.promptEl.on(keyEvent, $.proxy(function(event) {
            this.preHandleKey(event);

            if (!this.handleKey(event)) {
                this.postHandleKey(event);
            }
        }, this));

        this.promptEl.keydown($.proxy(function(event) {
            if(event.ctrlKey || event.which === SymPy.Keys.CTRL) {
                if (this.completer.showingNumbers === false){
                    this.completer.showNumbers();
                }
            }
        }, this));

        this.promptEl.keyup($.proxy(function(event) {
            if(event.ctrlKey && event.which !== SymPy.Keys.CTRL) {
                if (this.completer.showingNumbers === false){
                    this.completer.showNumbers();
                }
            }
            else {
                this.completer.hideNumbers();
            }
        }, this));

        this.evaluateEl.click($.proxy( function(event) {
            this.evaluate();
            this.focus();
        }, this));

        this.fullscreenEl.click($.proxy(function(event) {
            this.fullscreen();
        }, this));

        this.clearEl.click($.proxy(function(event) {
            this.clear();
            this.focus();
        }, this));

        this.printerEl.change($.proxy(function(event) {
            this.updateSettings();
            this.focus();
        }, this));

        this.submitEl.change($.proxy(function(event) {
            this.updateSettings();
            this.focus();
        }, this));

        this.autocompleteEl.change($.proxy(function(event) {
            this.updateSettings();
            this.focus();
        }, this));

        this.recordEl.change($.proxy(function(event) {
            this.updateSettings();
            this.focus();
        }, this));

	    this.forcedesktopEl.change($.proxy(function(event) {
            this.updateSettings();
            this.focus();
        }, this));

        this.focus();

        setInterval($.proxy(this.updatePrompt, this), 100);
    },

    renderToolbar: function(settings) {
        this.toolbarEl = $('<p/>').
            addClass('sympy-live-toolbar').
            append(
                $('<label for="output-format">Output Format: </label>'),
                $('<select id="output-format"/>').append(
                    $('<option value="repr">Repr</option>'),
                    $('<option value="str">Str</option>'),
                    $('<option value="ascii">ASCII</option>'),
                    $('<option value="unicode">Unicode</option>'),
                    $('<option value="latex">LaTeX</option>')
                ),
                $('<br/>'),
                $('<label for="submit-behavior">Submit with: </label>'),
                $('<select id="submit-behavior"/>').append(
                    $('<option value="enter">Enter</option>'),
                    $('<option value="shift-enter">Shift-Enter</option>')
                ),
                $('<label for="privacy">Privacy: </label>'),
                $('<select id="privacy"/>').append(
                    $('<option value="on">On</option>'),
                    $('<option value="off">Off</option>')
                ),
                $('<br/>'),
                $('<select id="autocomplete"/>').append(
                    $('<option value="tab">Tab</option>'),
                    $('<option value="ctrl-space">Ctrl-Space</option>')
                ),
                $('<label for="autocomplete"> completes</label>'),
                $('<br/>'),
                $('<label for="desktop">Force Desktop Version: </label>'),
                $('<input type="checkbox" id="desktop"/>'),
                $('<br/>'),
                $('<span>Ctrl-Up/Down for history</span>')
            ).
            appendTo(settings);
        this.supportsSelection = 'selectionStart' in this.promptEl.get(0);
        this.printerEl = this.toolbarEl.find('select:nth(0)');
        this.submitEl = this.toolbarEl.find('select:nth(1)');
        this.recordEl = this.toolbarEl.find('select:nth(2)');
        this.autocompleteEl = this.toolbarEl.find('select:nth(3)');
        this.forcedesktopEl = this.toolbarEl.find('input');
        var index;

        index = this.printerTypes.indexOf(this.printer);
        this.printerEl.children('option')[index].selected = true;

        index = this.submitTypes.indexOf(this.submit);
        this.submitEl.children('option')[index].selected = true;

        index = this.recordTypes.indexOf(this.record);
        this.recordEl.children('option')[index].selected = true;

        index = this.autocompleteTypes.indexOf(this.autocomplete);
        this.autocompleteEl.children('option')[index].selected = true;

        if (this.forcedesktop === "true") {
            this.forcedesktopEl.prop("checked", true);
        }
    },
    renderButtons: function(el) {
        this.buttonsEl = $('<p/>').
            addClass('sympy-live-toolbar').
            attr('id', 'sympy-live-toolbar-main').
            appendTo(el);
        this.evaluateEl = $('<button>Evaluate</button>').
            appendTo(this.buttonsEl);
        this.clearEl = $('<button>Clear</button>').
            appendTo(this.buttonsEl);
        this.fullscreenEl = $('<button>Fullscreen</button>').
            attr('id', 'fullscreen-button').
            appendTo(this.buttonsEl);
    },
    getKeyEvent: function() {
        return $.browser.opera ? "keypress" : "keydown";
    },

    disablePrompt: function() {
        this.promptEl.blur();
        this.promptEl.prop('readonly', true);
    },

    enablePrompt: function() {
        this.promptEl.prop('readonly', false);
    },

    setValue: function(value) {
        this.promptEl.val(value);
    },

    clearValue: function() {
        this.setValue("");
    },

    getValue: function() {
        return this.promptEl.val();
    },

    isEmpty: function() {
        return this.getValue().length == 0;
    },

    isLaTeX: function() {
        return this.printerEl.val() == 'latex';
    },

    setSelection: function(sel) {
        var start, end;

        if ($.isNumeric(sel)) {
            start = sel;
            end = sel;
        } else {
            start = sel.start;
            end = sel.end;
        }

        this.promptEl[0].selectionStart = start;
        this.promptEl[0].selectionEnd = end;
    },

    getSelection: function() {
        return {
            start: this.promptEl[0].selectionStart,
            end: this.promptEl[0].selectionEnd
        };
    },

    setCursor: function(cur) {
        this.setSelection(cur);
    },

    getCursor: function() {
        var sel = this.getSelection();

        if (sel.start == sel.end) {
            return sel.start;
        } else {
            return null;
        }
    },

    onFirstLine: function() {
        if (this.supportsSelection) {
            var cursor = this.getCursor();

            if (cursor !== null) {
                return this.getValue().lastIndexOf('\n', cursor-1) === -1;
            }
        }

        return false;
    },

    onLastLine: function() {
        if (this.supportsSelection) {
            var cursor = this.getCursor();

            if (cursor !== null) {
                return this.getValue().indexOf('\n', cursor) === -1;
            }
        }

        return false;
    },

    prevInHistory: function() {
        if (this.historyCursor > 0) {
            this.setValue(this.history[--this.historyCursor]);
        }
        this.focus();
    },

    nextInHistory: function() {
        if (this.historyCursor < this.history.length - 1) {
            this.setValue(this.history[++this.historyCursor]);
        }
        this.focus();
    },

    handleKey: function(event) {
        if (event.ctrlKey && this.completer.isNumberKey(event.which)) {
            this.completer.doNumberComplete(event.which);
            event.stopPropagation();
            event.preventDefault();
            return;
        }
        switch (event.which) {
        case SymPy.Keys.UP:
            if ((event.ctrlKey && !event.altKey) || this.onFirstLine()) {
                event.stopPropagation();
                event.preventDefault();
                this.prevInHistory();
            }

            return true;
        case SymPy.Keys.DOWN:
            if ((event.ctrlKey && !event.altKey) || this.onLastLine()) {
                event.stopPropagation();
                event.preventDefault();
                this.nextInHistory();
            }

            return true;
        case SymPy.Keys.K:
            if (event.altKey && !event.ctrlKey) {
                event.stopPropagation();
                event.preventDefault();
                this.prevInHistory();
                return true;
            }

            break;
        case SymPy.Keys.J:
            if (event.altKey && !event.ctrlKey) {
                event.stopPropagation();
                event.preventDefault();
                this.nextInHistory();
                return true;
            }

            break;
        case SymPy.Keys.LEFT:
            if (event.ctrlKey) {
                this.completer.showPrevGroup();
                event.stopPropagation();
                event.preventDefault();
                break;
            }
            else {
                return true;
            }
        case SymPy.Keys.RIGHT:
            if (event.ctrlKey) {
                this.completer.showNextGroup();
                event.stopPropagation();
                event.preventDefault();
                break;
            }
            else {
                return true;
            }
        case SymPy.Keys.DEL:
            this.completer.finishComplete();
            break;
        case SymPy.Keys.BACKSPACE:
            this.completer.finishComplete();
            if (this.supportsSelection) {
                var cursor = this.getCursor();

                if (cursor !== null) {
                    var value = this.getValue();
                    var spaces = 0;

                    for (var i = cursor; i > 0; i--) {
                        var ch = value[i-1];

                        if (ch === '\n') {
                            break;
                        } else if (ch === ' ') {
                            spaces++;
                        } else {
                            spaces = 0;
                            break;
                        }
                    }

                    if (spaces > 0) {
                        var cutoff = cursor - this.tabWidth;

                        if (cutoff >= i) {
                            var start = value.slice(0, cutoff);
                            var end = value.slice(cursor);

                            this.setValue(start + end);

                            event.stopPropagation();
                            event.preventDefault();
                            return true;
                        }
                    }
                }
            }

            break;
        case SymPy.Keys.ENTER:
            this.completer.finishComplete();
            var shiftEnter = (this.submitEl.val() == "shift-enter");
            if (event.shiftKey == shiftEnter) {
                event.stopPropagation();
                event.preventDefault();
                this.evaluate();
                return true;
            } else if (this.supportsSelection) {
                var cursor = this.getCursor();

                if (cursor !== null) {
                    var value = this.getValue();
                    var index = value.lastIndexOf('\n', cursor) + 1;
                    var spaces = "";

                    while (value[index++] == ' ') {
                        spaces += " ";
                    }

                    if (value[cursor-1] == ':') {
                        for (var i = 0; i < this.tabWidth; i++) {
                            spaces += " ";
                        }
                    }

                    var start = value.slice(0, cursor);
                    var end = value.slice(cursor);

                    this.setValue(start + '\n' + spaces + end);
                    this.setCursor(cursor + 1 + spaces.length);

                    event.stopPropagation();
                    event.preventDefault();
                    return true;
                }
            }

            break;
        case SymPy.Keys.E:
            if (event.altKey && (!event.ctrlKey || event.shiftKey)) {
                event.stopPropagation();
                event.preventDefault();
                this.evaluate();
                return true;
            }

            break;

        case SymPy.Keys.TAB:
            if (this.autocompleteEl.val() === "tab") {
                this.completer.complete(
                    this.getStatement(),
                    this.getSelection());
                event.stopPropagation();
                event.preventDefault();
            }
            break;

        case SymPy.Keys.SPACE:
            if (event.ctrlKey &&
                this.autocompleteEl.val() === "ctrl-space") {
                this.completer.complete(
                    this.getStatement(),
                    this.getSelection());
                event.stopPropagation();
                event.preventDefault();
            }
            break;
        }
        return false;
    },

    preHandleKey: function(event) {
        if (this.historyCursor == this.history.length-1) {
            this.history[this.historyCursor] = this.getValue();
        }
    },

    postHandleKey: function(event) {
        this.updateHistory(this.getValue());
    },

    updateHistory: function(value) {
        this.historyCursor = this.history.length - 1;
        this.history[this.historyCursor] = value;
    },

    updatePrompt: function() {
        var value = this.getValue();

        if (this.previousValue != value) {
            var prompt = ">>>",
                lines = value.split('\n');

            var i = 1,
                n = lines.length;

            for (; i < n; i++) {
                prompt += "\n...";
            }

            this.caretEl.val(prompt);

            var rows = Math.max(4, n);

            this.caretEl.attr('rows', rows);
            this.promptEl.attr('rows', rows);

            this.previousValue = value;
        }
    },

    prefixStatement: function() {
        var lines = this.getValue().split('\n');

        lines[0] = ">>> " + lines[0];

        var i = 1,
            n = lines.length;

        for (; i < n; i++) {
            lines[i] = "... " + lines[i];
        }

        return lines.join("\n");
    },

    scrollToBottom: function() {
        this.outputEl[0].scrollTop = this.outputEl[0].scrollHeight;
    },

    scrollToLeft: function() {
        this.outputEl[0].scrollLeft = 0;
    },

    scrollToDefault: function() {
        this.scrollToBottom();
        this.scrollToLeft();
    },

    setEvaluating: function(state) {
      if (state) {
          this.evaluating = true;
          this.promptEl.addClass('sympy-live-processing');
          this.evaluateEl.attr({'disabled': 'disabled'});
          this.evaluateEl.addClass('sympy-live-evaluate-disabled');
          this.completer.finishComplete();
      } else {
          this.evaluating = false;
          this.promptEl.removeClass('sympy-live-processing');
          this.evaluateEl.attr({disabled: null});
          this.evaluateEl.removeClass('sympy-live-evaluate-disabled');
      }
    },

    getStatement: function() {
        // gets and sanitizes the current statement
        var statement = this.getValue();
        if (!statement.match(/^\s*$/)) {
            return statement;
        }
        return null;
    },

    evaluate: function() {
        var statement = this.getValue();
        this.updateHistory(statement);
        // make sure the statement is not only whitespace
        // use statement != "" if pure whitespace should be evaluated
        if (!this.evaluating && !statement.match(/^\s*$/)) {
            this.setEvaluating(true);

            var data = {
                print_statement: this.getValue().split('\n'),
                statement: statement,
                printer: this.printerEl.val(),
                session: this.session || null,
                privacy: this.recordEl.val()
            };

            var value = this.prefixStatement();

            this.clearValue();
            this.updatePrompt();

            this.history.push('');
            this.historyCursor = this.history.length - 1;

            $('<div/>').html(SymPy.escapeHTML(value)).appendTo(this.outputEl);

            this.scrollToDefault();

			if (navigator.userAgent.match(/like Mac OS X/i)) {
                timeout = 58; // On an iOS Device
			} else {
				timeout = 61; // Not iOS based
			}

            $.ajax({
                type: 'POST',
                url: (this.basePath || '') + '/evaluate',
                dataType: 'json',
				timeout: (timeout * 1000),
                data: JSON.stringify(data),
                success: $.proxy(function(response, status) {
                    this.done(response);
                    this.focus();
                }, this),
                error: $.proxy(function(a,b,c) {
                    this.error();

                    $('<div>Error: Time limit exceeded.</div>').
                        appendTo(this.outputEl);

					this.scrollToDefault();
                    this.clearValue();
                    this.updatePrompt();
                    this.setEvaluating(false);
                    this.focus();
                }, this),
            });
            this.focus();
        }
    },

    done: function(response) {
        this.session = response.session;

        var result = response.output.replace(/^(\s*\n)+/, '');

        if (result.length) {
            var element = $("<div/>").html(SymPy.escapeHTML(result));
            if (this.isLaTeX()) {
                element.addClass('sympy-live-hidden');
            }
            element.appendTo(this.outputEl);

            this.scrollToDefault();

            if (this.printerEl.val() == 'latex') {
                function postprocessLaTeX() {
                    element.removeClass('sympy-live-hidden');
                    this.scrollToDefault();
                }

                MathJax.Hub.Queue(['Typeset', MathJax.Hub, element.get(0)],
                                  [$.proxy(postprocessLaTeX, this)]);
            }
        }

        this.setEvaluating(false);
        this.focus();
    },

    error: function(xhr, status, error) {
        console.log("Error:", xhr, status, error);
    },

    clear: function() {
        var elements = this.outputEl.find('div').remove();

        if (this.banner) {
            $("<div/>").html(this.banner).appendTo(this.outputEl);
        }

        this.clearValue();
        this.historyCursor = this.history.length-1;

        this.completer.finishComplete();
    },

    updateSettings: function() {
        this.setCookie('sympy-printer', this.printerEl.val());
        this.setCookie('sympy-submit', this.submitEl.val());
        this.setCookie('sympy-privacy', this.recordEl.val());
        this.setCookie('sympy-autocomplete', this.autocompleteEl.val());
	    this.setCookie('desktop', this.forcedesktopEl.prop('checked'));
    },

    setCookie: function(name, value) {
        var expiration = new Date();
        expiration.setYear(expiration.getFullYear() + 1);
        value = escape(value) + "; expires=" + expiration.toUTCString();
        document.cookie = name + "=" + value;
    },

    getCookie: function(name, default_value) {
        var result = null;
        var i, x, y, cookies = document.cookie.split(";");
        for (i = 0; i < cookies.length; i++) {
            x = cookies[i].substr(0, cookies[i].indexOf("="));
            y = cookies[i].substr(cookies[i].indexOf("=")+1);
            x = x.replace(/^\s+|\s+$/g,"");
            if (x == name) {
                result = unescape(y);
                break;
            }
        }

        return (result) ? result : default_value;
    },

    fullscreen: function() {
        var popup = $('<div class="sympy-live-fullscreen-popup">Escape to close fullscreen mode.</div>');
        popup.css({
            'font-size': 20,
            'color' : '#fff',
            'z-index' : 1000,
            'position' : 'absolute'
        });

        $("#sympy-live-toolbar-main").
            appendTo(".sympy-live-completions-toolbar");

        var shell = $('#shell'),
            leftdiv = $('#left'),
            ld = {
                pos : leftdiv.offset(),
                width : '55%',
                height : '560px',
                border : 2
            };

        if(!(this.fullscreenMode)){
            this.leftHeight = leftdiv.height();
        }

        if(this.fullscreenMode){
            $(window).off("resize");
            this.closeFullscreen(ld);
            this.fullscreenMode = false;
        }else{
            this.fullscreenMode = true;

            function fullscreenResize(){
                //browser viewport dimensions
                var bheight = $(window).height(), bwidth = $(window).width();
                leftdiv.css({
                    'margin' : 0,
                    'position' : 'absolute',
                    'z-index' : 500,
                    'background-color' : '#e4ebe4'
                }).animate({
                    'width' : bwidth,
                    'height' : bheight,
                    'top' : 0,
                    'left' : 0,
                    'border-width' : 0,
                    'padding' : 0
                }, 100);
                var promptHeight = $('.sympy-live-prompt').outerHeight(true);
                var completionHeight = $('.sympy-live-autocompletions-container')
                    .outerHeight(true);
                var toolbarHeight = $('.sympy-live-toolbar').outerHeight(true);
                var titleHeight = $('.right_title').outerHeight(true);
                var windowHeight = $(window).height();
                var margins = $('.sympy-live-output').outerHeight(true) -
                    $('.sympy-live-output').height();
                var shellPadding = 20;
                var height = windowHeight - (
                    promptHeight + toolbarHeight + completionHeight +
                        titleHeight + margins + shellPadding);
                $('.sympy-live-output').css({
                    'width' : bwidth-32,
                    'height' : height
                });
            }

            // some styles to make it look better
            leftdiv.css({
                'top' : ld.pos.top,
                'left' : ld.pos.left
            });
            shell.css('padding', 10);
            $('body').css('overflow', 'hidden');
            $('.right_title').css('padding-top', 20);

            $('html, body').animate({ scrollTop: 0 }, 100);
            fullscreenResize();

            // window resizing -> new dimensions
            $(window).on("resize", function() {
                // information about this timeout:
                // http://stackoverflow.com/questions/5534363/why-does-the-jquery-resize-event-fire-twice
                clearTimeout(id);
                id = setTimeout(function(){
                    fullscreenResize();
                }, 200);
            });
            $(popup).appendTo('body').hide().fadeIn(500).delay(1000).fadeOut(500);

            // enabling escape key to close fullscreen mode
            var keyEvent = this.getKeyEvent();
            $(document).on(keyEvent, $.proxy(function(event) {
                if(event.which == SymPy.Keys.ESC){
                    $(window).off("resize");
                    this.closeFullscreen(ld);
                    this.fullscreenMode = false;
                }
            }, this));
        }
    },

    closeFullscreen : function(ld) {
        if(this.fullscreenMode){
            var shell = $('#shell'),
                leftdiv = $('#left');
            $('#shell').css('padding', 0);
            $('body').css('overflow', 'auto');
            $('.right_title').css('padding-top', 0);
            leftdiv.css({
               position : 'static',
               margin : '4px 0 4px 4px',
               backgroundColor : 'white'
            });
            leftdiv.animate({
                top : ld.pos.top,
                left : ld.pos.left,
                width : ld.width,
                height : this.leftHeight,
                borderWidth : ld.border,
                padding: 10
            }, 100, function(){
                leftdiv.css({height: 'auto'});
            });
            $('.sympy-live-output').css({
                'width' : '95%',
                'height' : '20em'
            });
            $("#sympy-live-toolbar-main").
                appendTo("#shell");
        }
        this.fullscreenMode = false;
    },

    focus: function(){
        this.promptEl.focus();
    }
});

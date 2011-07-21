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

Ext.ns("SymPy");

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

Ext.USE_NATIVE_JSON = true;
Ext.Ajax.timeout = 60000;

SymPy.Shell = Ext.extend(Ext.util.Observable, {
    banner: null,
    history: [''],
    historyCursor: 0,
    previousValue: "",
    evaluating: false,
    supportsSelection: false,

    printerTypes: ['repr', 'str', 'ascii', 'unicode', 'latex'],
    submitTypes: ['enter', 'shift-enter'],
    printer: null,
    submit: null,
    tabWidth: 4,
    basePath: null,
    defaultBasePath: 'http://live.sympy.org',

    constructor: function(config) {
        config = Ext.apply({}, config);

        if (config.basePath) {
            this.basePath = config.basePath;
        } else {
            this.basePath = this.getBasePath(config.baseName);
        }

        if (config.banner) {
            this.banner = config.banner;
            delete config.banner;
        } else {
            var elem = Ext.get('banner');

            if (elem) {
                this.banner = elem.dom.innerHTML;
            }
        }

        if (this.banner) {
            this.banner = SymPy.rstrip(this.banner) + '\n\n';
        }

        var index;

        index = this.printerTypes.indexOf(config.printer);
        this.printer = (index == -1) ? 'ascii' : config.printer;

        index = this.submitTypes.indexOf(config.submit);
        this.submit = (index == -1) ? 'shift-enter' : config.submit;

        delete config.printer;
        delete config.submit;

        if (Ext.isNumber(config.tabWidth)) {
            this.tabWidth = config.tabWidth;
            delete config.tabWidth;
        }

        SymPy.Shell.superclass.constructor.call(this, config);
    },

    getBasePath: function(baseName) {
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
    },

    render: function(el) {
        el = Ext.get(el) || Ext.getBody();

        this.outputEl = Ext.DomHelper.append(el, {
            tag: 'div',
            cls: 'sympy-live-output'
        }, true);

        if (this.banner) {
            Ext.DomHelper.append(this.outputEl, {
                tag: 'div',
                html: this.banner
            });
        }

        this.caretEl = Ext.DomHelper.append(el, {
            tag: 'textarea',
            cls: 'sympy-live-caret',
            rows: '4',
            readonly: 'readonly',
            html: '&gt;&gt;&gt;'
        }, true);

        this.promptEl = Ext.DomHelper.append(el, {
            tag: 'textarea',
            cls: 'sympy-live-prompt',
            rows: '4',
            spellcheck: 'false'
        }, true);

        this.renderToolbar(el);

        this.caretEl.on("focus", function(event) {
            this.promptEl.focus();
        }, this);

        var keyEvent = this.getKeyEvent();

        this.promptEl.on(keyEvent, function(event) {
            this.preHandleKey(event);

            if (!this.handleKey(event)) {
                this.postHandleKey(event);
            }
        }, this);

        this.evaluateEl.on("click", function(event) {
            this.evaluate();
        }, this);

        this.clearEl.on("click", function(event) {
            this.clear();
        }, this);

        this.promptEl.focus();

        var task = {
            run: this.updatePrompt,
            scope: this,
            interval: 100
        }

        var runner = new Ext.util.TaskRunner();
        runner.start(task);
    },

    renderToolbar: function(el) {
        this.toolbarEl = Ext.DomHelper.append(el, {
            tag: 'p',
            cls: 'sympy-live-toolbar',
            children: [{
                tag: 'button',
                html: 'Evaluate'
            }, {
                tag: 'button',
                html: 'Clear'
            }, {
                tag: 'span',
                cls: 'sympy-live-separator',
                html: '|'
            }, {
                tag: 'select',
                children: [{
                    tag: 'option',
                    value: 'repr',
                    html: 'Repr'
                }, {
                    tag: 'option',
                    value: 'str',
                    html: 'Str'
                }, {
                    tag: 'option',
                    value: 'ascii',
                    html: 'ASCII'
                }, {
                    tag: 'option',
                    value: 'unicode',
                    html: 'Unicode'
                }, {
                    tag: 'option',
                    value: 'latex',
                    html: 'LaTeX'
                }]
            }, {
                tag: 'span',
                cls: 'sympy-live-separator',
                html: '|'
            }, {
                tag: 'select',
                children: [{
                    tag: 'option',
                    value: 'enter',
                    html: 'Enter'
                }, {
                    tag: 'option',
                    value: 'shift-enter',
                    html: 'Shift-Enter'
                }]
            }, {
                tag: 'span',
                html: 'submits'
            }, {
                tag: 'span',
                cls: 'sympy-live-separator',
                html: '|'
            }, {
                tag: 'span',
                html: 'Ctrl-Up/Down for history'
            }]
        }, true);

        this.supportsSelection = ('selectionStart' in this.promptEl.dom);

        this.evaluateEl = this.toolbarEl.down('button:nth(1)');
        this.clearEl = this.toolbarEl.down('button:nth(2)');

        this.printerEl = this.toolbarEl.down('select:nth(1)');
        this.submitEl = this.toolbarEl.down('select:nth(2)');

        var index;

        index = this.printerTypes.indexOf(this.printer);
        this.printerEl.dom.selectedIndex = index;

        index = this.submitTypes.indexOf(this.submit);
        this.submitEl.dom.selectedIndex = index;
    },

    getKeyEvent: function() {
        return Ext.isOpera ? "keypress" : "keydown";
    },

    disablePrompt: function() {
        this.promptEl.blur();
        this.promptEl.dom.setAttribute('readonly', 'readonly');
    },

    enablePrompt: function() {
        this.promptEl.dom.removeAttribute('readonly');
        this.promptEl.focus();
    },

    setValue: function(value) {
        this.promptEl.dom.value = value;
    },

    clearValue: function() {
        this.setValue("");
    },

    getValue: function() {
        return this.promptEl.dom.value;
    },

    isEmpty: function() {
        return this.getValue().length == 0;
    },

    isLaTeX: function() {
        return this.printerEl.getValue() == 'latex';
    },

    setSelection: function(sel) {
        var start, end;

        if (Ext.isNumber(sel)) {
            start = sel;
            end = sel;
        } else {
            start = sel.start;
            end = sel.end;
        }

        this.promptEl.dom.selectionStart = start;
        this.promptEl.dom.selectionEnd = end;
    },

    getSelection: function() {
        return {
            start: this.promptEl.dom.selectionStart,
            end: this.promptEl.dom.selectionEnd
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
    },

    nextInHistory: function() {
        if (this.historyCursor < this.history.length - 1) {
            this.setValue(this.history[++this.historyCursor]);
        }
    },

    handleKey: function(event) {
        switch (event.getKey()) {
        case SymPy.Keys.UP:
            if ((event.ctrlKey && !event.altKey) || this.onFirstLine()) {
                event.stopEvent();
                this.prevInHistory();
            }

            return true;
        case SymPy.Keys.DOWN:
            if ((event.ctrlKey && !event.altKey) || this.onLastLine()) {
                event.stopEvent();
                this.nextInHistory();
            }

            return true;
        case SymPy.Keys.K:
            if (event.altKey && !event.ctrlKey) {
                event.stopEvent();
                this.prevInHistory();
                return true;
            }

            break;
        case SymPy.Keys.J:
            if (event.altKey && !event.ctrlKey) {
                event.stopEvent();
                this.nextInHistory();
                return true;
            }

            break;
        case SymPy.Keys.LEFT:
            return true;
        case SymPy.Keys.RIGHT:
            return true;
        case SymPy.Keys.BACKSPACE:
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

                            event.stopEvent();
                            return true;
                        }
                    }
                }
            }

            break;
        case SymPy.Keys.ENTER:
            var shiftEnter = (this.submitEl.getValue() == "shift-enter");

            if (event.shiftKey == shiftEnter) {
                event.stopEvent();
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
                    var end = value.slice(cursor+1);

                    this.setValue(start + '\n' + spaces + end);

                    event.stopEvent();
                    return true;
                }
            }

            break;
        case SymPy.Keys.E:
            if (event.altKey && (!event.ctrlKey || event.shiftKey)) {
                event.stopEvent();
                this.evaluate();
                return true;
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

            this.caretEl.dom.value = prompt;

            var rows = Math.max(4, n);

            this.caretEl.dom.setAttribute('rows', rows);
            this.promptEl.dom.setAttribute('rows', rows);

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
        this.outputEl.dom.scrollTop = this.outputEl.dom.scrollHeight;
    },

    evaluate: function() {
        if (!this.evaluating) {
            this.evaluating = true;
            this.promptEl.addClass('sympy-live-processing');

            var data = {
                statement: this.promptEl.getValue(),
                printer: this.printerEl.getValue(),
                session: this.session || null
            };

            Ext.Ajax.request({
                method: 'POST',
                url: (this.basePath || '') + '/evaluate',
                jsonData: Ext.encode(data),
                success: function(response) {
                    this.done(response);
                },
                failure: function(response) {
                    this.clearValue();
                    this.updatePrompt();
                    this.promptEl.removeClass('sympy-live-processing');
                    this.evaluating = false;
                },
                scope: this
            });
        }
    },

    done: function(response) {
        var value = this.prefixStatement();

        this.clearValue();
        this.updatePrompt();

        this.history.push('');
        this.historyCursor = this.history.length - 1;

        Ext.DomHelper.append(this.outputEl, {
            tag: 'div',
            html: SymPy.escapeHTML(value)
        });

        this.scrollToBottom();

        var response = Ext.decode(response.responseText);
        this.session = response.session;

        var result = response.output.replace(/^(\s*\n)+/, '');

        if (result.length) {
            var element = Ext.DomHelper.append(this.outputEl, {
                tag: 'div',
                cls: this.isLaTeX() ? 'sympy-live-hidden' : '',
                html: SymPy.escapeHTML(result)
            }, false);

            this.scrollToBottom();

            if (this.printerEl.getValue() == 'latex') {
                function postprocessLaTeX() {
                    Ext.get(element).removeClass('sympy-live-hidden');
                    this.scrollToBottom();
                }

                MathJax.Hub.Queue(['Typeset', MathJax.Hub, element],
                                  [postprocessLaTeX.createDelegate(this)]);
            }
        }

        this.promptEl.removeClass('sympy-live-processing');
        this.evaluating = false;
    },

    clear: function() {
        var elements = this.outputEl.query('div');

        Ext.each(elements, function(elem) {
            Ext.get(elem).remove();
        });

        if (this.banner) {
            Ext.DomHelper.append(this.outputEl, {
                tag: 'div',
                html: this.banner
            });
        }

        this.clearValue();
        this.historyCursor = this.history.length-1;
    }
});

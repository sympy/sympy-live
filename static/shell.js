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

SymPy.Shell = Ext.extend(Ext.util.Observable, {
    history: [''],
    historyCursor: 0,
    previousValue: "",

    constructor: function(config) {
        config = config || {};

        var task = {
            run: this.updatePrompt,
            scope: this,
            interval: 100
        }

        var runner = new Ext.util.TaskRunner();
        runner.start(task);

        SymPy.Shell.superclass.constructor.call(this, config);
    },

    setValue: function(value) {
        Ext.get('statement').dom.value = value;
    },

    clearValue: function() {
        this.setValue("");
    },

    getValue: function() {
        return Ext.get('statement').dom.value;
    },

    isEmpty: function() {
        return this.getValue().length == 0;
    },

    onPromptKeyDown: function(event) {
        if (this.historyCursor == this.history.length-1) {
            this.history[this.historyCursor] = this.getValue();
        }

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
        case SymPy.Keys.E:
            if (event.altKey && (!event.ctrlKey || event.shiftKey)) {
                event.preventDefault();
                this.runStatement();
                return false;
            }

            break;
        }

        return true;
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

            var caret = Ext.get("caret"),
                statement = Ext.get("statement");

            caret.dom.value = prompt;

            var rows = Math.max(4, n);

            caret.dom.setAttribute('rows', rows);
            statement.dom.setAttribute('rows', rows);

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

    done: function(response) {
        var output = Ext.get('output'),
            value = '\n' + this.prefixStatement();

        this.clearValue();
        this.updatePrompt();

        this.history.push('');
        this.historyCursor = this.history.length - 1;

        Ext.DomHelper.append(output, {
            tag: 'div',
            html: SymPy.escapeHTML(value)
        });

        function scrollToBottom() {
            output.dom.scrollTop = output.dom.scrollHeight;
        }

        scrollToBottom();

        var response = Ext.decode(response.responseText);
        this.session = response.session;

        var result = response.output.replace(/^(\s*\n)+/, '');

        if (result.length) {
            var element = Ext.DomHelper.append(output, {
                tag: 'div',
                html: SymPy.escapeHTML(result)
            }, false);

            scrollToBottom();

            if (Ext.get('printer').getValue() == 'latex') {
                MathJax.Hub.Queue(['Typeset', MathJax.Hub, element], [scrollToBottom]);
            }
        }

        Ext.get('statement').removeClass('processing');
    },

    runStatement: function() {
        Ext.get('statement').addClass('processing');

        var data = {
            statement: Ext.get('statement').getValue(),
            printer: Ext.get('printer').getValue(),
            session: this.session || null
        };

        Ext.Ajax.request({
            method: 'POST',
            url: '/evaluate',
            jsonData: Ext.encode(data),
            success: function(response) {
                this.done(response);
            },
            scope: this
        });

        return false;
    }
});

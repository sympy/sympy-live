
SymPy.SphinxShell = Ext.extend(SymPy.Shell, {
    baseEl: null,
    triggerEl: null,
    collapsed: true,
    elementSelector: "div[class=highlight-python] pre",

    render: function(el) {
        var el = el || Ext.getBody();

        this.baseEl = Ext.DomHelper.append(el, {
            tag: 'div',
            cls: 'sympy-live-base'
        }, true);

        this.logoEl = Ext.DomHelper.append(el, {
            tag: 'div',
            cls: 'sympy-live-logo',
            html: 'SymPy Live',
        }, true);

        this.logoEl.on('click', function() {
            this.showShell();
        }, this);

        SymPy.SphinxShell.superclass.render.call(this, this.baseEl);
        this.hideShell();
    },

    renderToolbar: function(el) {
        SymPy.SphinxShell.superclass.renderToolbar.call(this, el);

        this.hideEl = Ext.DomHelper.append(this.toolbarEl, {
            tag: 'span',
            cls: 'sympy-live-separator',
            html: '|'
        }, true);

        this.hideEl = Ext.DomHelper.append(this.toolbarEl, {
            tag: 'button',
            html: 'Hide'
        }, true);

        this.hideEl.on('click', function(event) {
            this.hideShell();
        }, this);
    },

    hideShell: function() {
        this.disablePrompt();
        this.baseEl.hide();
        this.logoEl.show();
    },

    showShell: function() {
        this.logoEl.hide();
        this.baseEl.show();
        this.enablePrompt();
    },

    handleKey: function(event) {
        SymPy.SphinxShell.superclass.handleKey.call(this, event);

        switch (event.getKey()) {
        case SymPy.Keys.H:
            if (event.altKey && !event.ctrlKey) {
                this.hideShell();
            }

            break;
        case SymPy.Keys.ESC:
            this.hideShell();
            break;
        }
    },

    processElements: function() {
        var nodes = Ext.DomQuery.select(this.elementSelector);

        Ext.each(nodes, function(node) {
            var children = node.childNodes;

            function isPrompt(obj) {
                return obj.innerHTML === '&gt;&gt;&gt; ';
            }

            function isContinuation(obj) {
                return obj.innerHTML === '... ';
            }

            var blocks = [];
            var doctest = true;

            if ((children.length > 0) && isPrompt(children[0])) {
                var lines = [];
                var line = [];

                for (var i = 0; i < children.length; i++) {
                    var child = children[i];
                    line.push(child);

                    if (/^\n+$/.test(child.data)) {
                        lines.push(line);
                        line = [];
                    }
                }

                if (line.length) {
                    lines.push(line);
                }

                var elements = [];
                var content = null;

                function cloneNodes(line) {
                    for (var i = 0; i < line.length; i++) {
                        content.appendChild(line[i].cloneNode(true));
                    }
                }

                function copyNodes(line) {
                    for (var i = 0; i < line.length; i++) {
                        elements.push(line[i]);
                    }
                }

                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i];

                    if (isPrompt(line[0])) {
                        if (content) {
                            elements.push(content);
                            content = null;
                        }

                        content = document.createElement('div');
                        blocks.push(content);
                        cloneNodes(line);
                    } else if (isContinuation(line[0])) {
                        if (content) {
                            cloneNodes(line);
                        } else {
                            copyNodes(line);
                        }
                    } else {
                        if (content) {
                            elements.push(content);
                            content = null;
                        }

                        copyNodes(line);
                    }
                }

                if (content) {
                    elements.push(content);
                }

                while (node.childNodes.length >= 1) {
                    node.removeChild(node.firstChild);
                }

                for (var i = 0; i < elements.length; i++) {
                    node.appendChild(elements[i]);
                }
            } else {
                blocks = [node];
                doctest = false;
            }

            Ext.each(blocks, function(el) {
                el = Ext.get(el);
                el.addClass('sympy-live-element');

                var code = el.dom.innerText || el.dom.textContent;

                if (doctest) {
                    var lines = code.split('\n');

                    for (var j = 0; j < lines.length; j++) {
                        lines[j] = lines[j].substr(4);
                    }

                    code = lines.join('\n');
                }

                code = code.replace(/\n+$/, "");

                var toolbar = Ext.DomHelper.append(el, {
                    tag: 'div',
                    cls: 'sympy-live-element-toolbar'
                }, true);

                Ext.DomHelper.append(toolbar, {
                    tag: 'span',
                    html: 'Evaluate'
                }, true).on('click', function(event) {
                    this.evaluateCode(code);
                }, this);

                Ext.DomHelper.append(toolbar, {
                    tag: 'span',
                    html: 'Copy'
                }, true).on('click', function(event) {
                    this.copyCode(code);
                }, this);
            }, this);
        }, this);
    },

    evaluateCode: function(code) {
        this.copyCode(code);
        this.evaluate();
    },

    copyCode: function(code) {
        this.setValue(code);
        this.updatePrompt();
        this.showShell();
    }
});

Ext.onReady(function() {
    var shell = new SymPy.SphinxShell({baseName: 'live-sphinx.js'});
    shell.render();
    shell.processElements();
});

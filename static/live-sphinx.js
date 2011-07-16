
SymPy.SphinxShell = Ext.extend(SymPy.Shell, {
    baseEl: null,
    triggerEl: null,
    collapsed: true,

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
    }
});

Ext.onReady(function() {
    var shell = new SymPy.SphinxShell({baseName: 'live-sphinx.js'});
    shell.render();
});

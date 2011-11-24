Ext.ns("SymPy");
SymPy.MobileShell = Ext.extend(
    SymPy.Shell, {
        constructor: function(config) {
            config = Ext.apply({}, config);
            SymPy.MobileShell.superclass.constructor.call(this, config);
        },
        renderToolbar: function(el) {
            SymPy.MobileShell.superclass.renderToolbar.call(this, el);
            Ext.DomHelper.overwrite(
                this.toolbarEl.down('span:last-child'),
                {
                    tag: 'span',
                    children: [{
                                   tag: 'span',
                                   cls: 'sympy-live-separator',
                                   html: 'History'
                               }, {
                                   tag: 'button',
                                   id: 'button-history-prev',
                                   html: 'Up'
                               }, {
                                   tag: 'button',
                                   id: 'button-history-next',
                                   html: 'Down'
                               }]
                }, true);
            this.historyPrevEl = Ext.get("button-history-prev");
            this.historyNextEl = Ext.get("button-history-next");
        },
        render: function(el) {
            SymPy.MobileShell.superclass.render.call(this, el);
            el = Ext.get(el) || Ext.getBody();
            this.iScrollEl = Ext.DomHelper.insertFirst(el, {
                tag: 'div',
                id: 'iscroll-wrapper'
            }, true);
            this.iScrollEl.insertFirst(this.outputEl);
            this.iScroller = new iScroll("iscroll-wrapper");
            this.historyPrevEl.on("click", function(event){
                this.prevInHistory();
            }, this);
            this.historyNextEl.on("click", function(event){
                this.nextInHistory();
            }, this);
        }
    });

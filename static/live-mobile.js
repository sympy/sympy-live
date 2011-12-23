Ext.ns("SymPy");
SymPy.MobileShell = Ext.extend(
    SymPy.Shell, {
        constructor: function(config) {
            config = Ext.apply({}, config);
            SymPy.MobileShell.superclass.constructor.call(this, config);
        },
        renderToolbar: function(el) {
            SymPy.MobileShell.superclass.renderToolbar.call(this, el);
            Ext.DomHelper.insertAfter(
                this.promptEl,
                {
                    tag: 'div',
                    id: 'sympy-live-toolbar-history',
                    children: [{
                                   tag: 'button',
                                   id: 'button-history-prev',
                                   html: '\u2191'
                               }, {
                                   tag: 'button',
                                   id: 'button-history-next',
                                   html: '\u2193'
                               }]
                }, true);
            var insertEl = Ext.get(
                this.submitEl.query('option[value="enter"]')[0]);
            var submitEl = Ext.get(
                this.submitEl.query('option[value="shift-enter"]')[0]);
            insertEl.set({value: "enter-inserts-newline"}).update("inserts newline");
            submitEl.set({value: "enter-submits"}).update("submits");
            this.submitEl.next().remove();
            Ext.DomHelper.insertBefore(this.submitEl,{
                 tag: 'span',
                 html: 'Enter'
            });
            this.historyPrevEl = Ext.get("button-history-prev");
            this.historyNextEl = Ext.get("button-history-next");
        },
        render: function(el) {
            SymPy.MobileShell.superclass.render.call(this, el);
            this.renderSearches();
            this.promptEl.set({autocorrect: 'off', autocapitalize: 'off'});
            var shell = Ext.get("shell");
            Ext.each(
                this.toolbarEl.query('.sympy-live-separator'),
                function(n){
                    Ext.get(n).remove();
                }
            );
            Ext.get("output-format")
                .appendTo(shell)
                .insertBefore(this.outputEl);
            Ext.DomHelper.insertBefore(
                this.outputEl,
                {
                    'tag': 'span',
                    'cls': 'sympy-live-separator',
                    'html': '|'
                }
            );
            this.completeEl = Ext.DomHelper.insertAfter(
                this.evaluateEl,
                {
                    'tag': 'button',
                    'html': 'Complete'
                }
            , true);
            this.toolbarEl.down('span')
                .appendTo(shell)
                .insertBefore(this.outputEl);
            Ext.get("submit-behavior")
                .appendTo(shell)
                .insertBefore(this.outputEl);
            this.toolbarEl.down('span').remove();
            this.toolbarEl.down('span').remove();
            this.autocompleteEl.remove();
            this.historyPrevEl.on("click", function(event){
                this.promptEl.focus(1000);
                this.prevInHistory();
            }, this);
            this.historyNextEl.on("click", function(event){
                this.promptEl.focus(1000);
                this.nextInHistory();
            }, this);
            this.completeEl.on("click", function(event){
                this.autocompleter.complete(
                    this.getStatement(),
                    this.getSelection());
            }, this);
            Ext.get("menu").on("click", function(event){
                Ext.get("main-navigation").toggle(true);
                Ext.get("main-navigation").down("ul").toggle(true);
            });
            Ext.get(document.body).scrollTo("top", this.outputEl.getTop());
        },
        handleKey: function(event) {
            if (event.getKey() == SymPy.Keys.ENTER) {
                var enterSubmits = (this.submitEl.getValue() ==
                                    "enter-submits");
                if (enterSubmits) {
                    event.stopEvent();
                    this.evaluate();
                    return true;
                }
                else if (this.supportsSelection){

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

                        event.stopEvent();
                        return true;
                    }
                }
            }
            SymPy.MobileShell.superclass.handleKey.call(this, event);
        },
        renderSearches: function(){
            this.savedSearches = Ext.get("saved-searches");
            this.recentSearches = Ext.get("recent-searches");
            var setupEval = (function(el){
                var nodes = el.query("button");
                var shell = this;  // closure
                Ext.each(nodes, function(node){
                    node = Ext.get(node);
                    node.on("click", function(event){
                        // We don't want the query to show up twice
                        var origPrivacy = shell.recordEl.getValue();
                        shell.recordEl.dom.value =  "on";
                        // And we're going to scroll to the output
                        var scrollY = shell.outputEl.getTop();

                        shell.setValue(this.first("pre").dom.innerHTML);
                        shell.evaluate();

                        Ext.get(document.body).scrollTo("top", scrollY);
                        shell.recordEl.dom.value = origPrivacy;
                    }, node);
                });
            });
            setupEval.call(this, this.recentSearches);
            setupEval.call(this, this.savedSearches);
            var toggle = (function(event){
                $(this.dom).parent().toggleClass('hidden');
            });
            Ext.get("recent-searches-container").
                first("h3").
                on("click", toggle, this.recentSearches);
            Ext.get("saved-searches-container").
                first("h3").
                on("click", toggle, this.savedSearches);
            $("#saved-searches-clear").click(function(){
                if(confirm("Delete history?") === true){
                    $.ajax({
                        url: "http://" + window.location.host + "/delete",
                        type: 'GET',
                        dataType: 'text',
                        success: function(data, status, xhr){
                            $('#saved-searches-list').
                                html('<li>' + data + '</li>');
                        },
                        failure: function(xhr, status, error){
                            alert("Error: " + status + error);
                        }
                    })
                }
            });
        }
    });

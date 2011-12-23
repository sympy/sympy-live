Ext.ns("SymPy");

$.fn.reverse = [].reverse;

SymPy.Autocompleter = Ext.extend(Ext.util.Observable, {
    inputEl: null,
    outputEl: null,
    completions: [],
    currentCompletion: 0,

    constructor: function(config, shell) {
        config = Ext.apply({}, config);
        this.inputEl = config.input;
        this.containerEl = config.container;
        this.shell = shell;
    },

    setup: function() {
        this.toolbarEl = Ext.DomHelper.append(this.containerEl, {
            tag: 'div',
            cls: 'sympy-live-autocompletions-toolbar',
            children: [{
                tag: 'button',
                html: '&lt;'
            },{
                tag: 'button',
                html: '&gt;'
            }]
        }, true);
        this.prevEl = this.toolbarEl.down("button:nth(1)");
        this.nextEl = this.toolbarEl.down("button:nth(2)");
        this.nextEl.on("click", function(event){
            this.showNextGroup();
        }, this);
        this.prevEl.on("click", function(event){
            this.showPrevGroup();
        }, this);
        this.outputEl = Ext.DomHelper.append(this.containerEl, {
            tag: 'ol',
            cls: 'sympy-live-autocompletions',
            html: '<em>Autocompletions here</em>'
        }, true);
    },

    complete: function(statement) {
        if (statement !== null) {
            var data = {
                session: this.session || null,
                statement: statement
            };
            Ext.Ajax.request({
                method: 'POST',
                url: (this.basePath || '') + '/autocomplete',
                jsonData: Ext.encode(data),
                success: function(response) {
                    this.completionSuccess(Ext.decode(response.responseText));
                },
                failure: function(response) {
                    this.completionError(response);
                },
                scope: this
            });
        }
    },

    doComplete: function(completion) {
        this.shell.setValue(completion);
    },

    completionSuccess: function(responseJSON) {
        var completions = responseJSON['completions'];
        this.outputEl.dom.innerHTML = '';
        console.log(completions);
        if (completions.length === 1){
            this.doComplete(completions[0]);
        }
        else if(completions.length > 0){
            for(var i = 0; i < completions.length; i++){
                Ext.DomHelper.append(this.outputEl, {
                    tag: 'li',
                    html: completions[i],
                    id: this.getID(i)
                });
            }
            this.currentCompletion = 0;
        }
        else {
            Ext.DomHelper.append(this.outputEl, {
                tag: 'li',
                cls: 'sympy-live-autocompletions-none',
                html: '&lt;No completions&gt;'
            }, true);
        }
        this.completions = completions;
    },

    completionError: function(response) {
        Ext.DomHelper.append(this.outputEl, {
                tag: 'li',
                cls: 'sympy-live-autocompletions-none',
                html: '&lt;Error getting completions&gt;'
            }, true);
    },

    showNextGroup: function() {
        var y = Ext.fly(this.getID(this.currentCompletion));
        var current = this.currentCompletion;
        for(var i = current + 1; ; i++) {
            if (i === this.completions.length) { i = 0;}
            if(this.isShowing(i)){
                current = i;
            }
            else {
                break;
            }
        }
        $('#' + this.getID(current)).prevAll().reverse().appendTo($(this.outputEl.dom));
        if (this.currentCompletion === current) {
            this.currentCompletion = 0;
            Ext.get(this.getID(current)).appendTo(this.outputEl);
            return;
        }
        this.currentCompletion = current;
    },

    showPrevGroup: function() {
        var current = this.currentCompletion;
        var last = current - 1;
        if (last < 0) {last = this.completions.length - 1;}
        console.log("");
        console.log("last", last);
        for(var i = last; ; i--) {
            if (i < 0) {i = this.completions.length - 1;}
            this.outputEl.insertFirst(Ext.get(this.getID(i)));
            this.currentCompletion = i;
            console.log(current, i);
            if(!this.isShowing(current)){
                console.log("stop", current, i);
                Ext.get(this.getID(i)).appendTo(this.outputEl);
                this.currentCompletion += 1;
                break;
            }
        }
        if (this.currentCompletion === this.completions.length) {
            this.currentCompletion = 0;
        }
    },

    getID: function(index) {
        return "completion-" + index
    },

    isShowing: function(index) {
        var y = Ext.fly(this.getID(this.currentCompletion)).getY();
        console.log("showing", index, y, Ext.fly(this.getID(index)).getY());
        return (Ext.fly(this.getID(index)).getY() === y);
    }
});

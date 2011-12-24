Ext.ns("SymPy");

$.fn.reverse = [].reverse;

SymPy.NumberKeyCodes = {
    49: 1,
    50: 2, 51: 3,
    52: 4, 53: 5,
    54: 6, 55: 7,
    56: 8, 57: 9,
};

SymPy.NumberKeys = {
    49: true,
    50: true, 51: true,
    52: true, 53: true,
    54: true, 55: true,
    56: true, 57: true,
};

SymPy.Completer = Ext.extend(Ext.util.Observable, {
    inputEl: null,
    outputEl: null,
    completions: [],
    currentCompletion: 0,
    completionRowSize: 3,

    constructor: function(config, shell) {
        config = Ext.apply({}, config);
        this.inputEl = config.input;
        this.containerEl = config.container;
        this.shell = shell;
    },

    setup: function() {
        this.toolbarEl = Ext.DomHelper.append(this.containerEl, {
            tag: 'div',
            cls: 'sympy-live-completions-toolbar',
            children: [{
                tag: 'button',
                children: [{
                    tag: 'span',  // For CSS animation purposes
                    html: '&#x25BC;'
                }],
                title: 'Show/Hide All Completions'
            },{
                tag: 'button',
                cls: 'disabled',
                html: '&lt;'
            },{
                tag: 'button',
                cls: 'disabled',
                html: '&gt;'
            }]
        }, true);
        this.expandEl = this.toolbarEl.down("button:nth(1)");
        this.prevEl = this.toolbarEl.down("button:nth(2)");
        this.nextEl = this.toolbarEl.down("button:nth(3)");
        this.expandEl.on("click", function(event) {
            if (this.buttonsEnabled === true) {
                this.toggleAllCompletions();
            }
            this.shell.focus();
        }, this);
        this.nextEl.on("click", function(event){
            if (this.buttonsEnabled === true) {
                this.showNextGroup();
            }
            this.shell.focus();
        }, this);
        this.prevEl.on("click", function(event){
            if (this.buttonsEnabled === true) {
                this.showPrevGroup();
            }
            this.shell.focus();
        }, this);
        this.disableButtons();
        this.outputEl = Ext.DomHelper.append(this.containerEl, {
            tag: 'ol',
            cls: 'sympy-live-completions',
            html: '<em>Completions here</em>'
        }, true);
    },

    complete: function(statement, selection) {
        if (statement === this.replaceText) {
            this.doComplete(this.completions[this.currentCompletion], true);
            return;
        }
        if (statement !== null) {

            // Get just the part to complete
            var start = 0;
            var end = selection.end;
            // Ugly loop, but it's simple and it works
            var regex = /:|"|'|\)|\(|\[|\]|\{|\}|\n|\s|\t/;
            for(var i = end - 1; i >= 0 ; i--){
                var c = statement[i];

                if (c.match(regex) !== null) {
                    start = i + 1;
                    break;
                }
            }

            this.replacePosition = [start, end];
            this.replaceText = statement;
            statement = statement.substring(start, end);

            var data = {
                session: this.session || null,
                statement: statement
            };
            Ext.Ajax.request({
                method: 'POST',
                url: (this.basePath || '') + '/complete',
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

    doComplete: function(completion, end) {
        var prefix = this.replaceText.substring(0, this.replacePosition[0]);
        var suffix = this.replaceText.substring(
            this.replacePosition[1],
            this.replaceText.length);
        this.shell.setValue(prefix + completion + suffix);
        this.shell.setSelection(prefix.length + completion.length);
        if(typeof end === "undefined" || end === true) {
            this.finishComplete();
        }
    },

    doNumberComplete: function(keyCode){
        if(!this.isNumberKey(keyCode)) {return;}
        var number = SymPy.NumberKeyCodes[keyCode];
        var index = this.currentCompletion + number - 1;
        this.doComplete(this.completions[index]);
    },

    finishComplete: function(){
        this.replaceText = null;
        this.replacePositon = null;
        this.completions = [];
        this.allCompletions = [];
        this.currentCompletion = 0;
        this.outputEl.dom.innerHTML = '';
        this.hideAllCompletions();
        this.disableButtons();
    },

    completionSuccess: function(responseJSON) {
        var completions = responseJSON['completions'];
        this.outputEl.dom.innerHTML = '';
        if (responseJSON['prefix']){
            this.doComplete(responseJSON['prefix'], false);
        }

        if (completions.length === 1){
            this.doComplete(completions[0]);
        }
        else if(completions.length > 0){
            if ($.inArray(responseJSON['prefix'], completions) !== -1){
                completions = $.grep(
                    completions,
                    function(val) { return val != responseJSON['prefix']; });
            }
            for(var i = 0; i < completions.length; i++){
                var link = Ext.DomHelper.append(this.outputEl, {
                    tag: 'li',
                    children: [{
                        tag: 'button',
                        html: completions[i]
                    }],
                    id: this.getID(i)
                }, true);
                link.on("click", function(event){
                    this.doComplete(event.target.innerText);
                }, this);
            }
            this.currentCompletion = 0;
            this.completions = completions;
            this.allCompletions = completions;
            if (completions.length > this.completionRowSize) {
                this.showAllCompletions();
                this.enableButtons();
            }
            else {
                this.disableButtons();
            }
        }
        else {
            this.finishComplete();
            Ext.DomHelper.append(this.outputEl, {
                tag: 'li',
                cls: 'sympy-live-completions-none',
                html: '&lt;No completions&gt;'
            }, true);
        }
    },

    completionError: function(response) {
        Ext.DomHelper.append(this.outputEl, {
                tag: 'li',
                cls: 'sympy-live-completions-none',
                html: '&lt;Error getting completions&gt;'
            }, true);
    },

    showNextGroup: function() {
        if (this.completions.length <= this.completionRowSize) {return;}
        var id = (this.currentCompletion + this.completionRowSize) % this.completions.length;
        $('#' + this.getID(id)).
            prevAll().
            reverse().
            appendTo($(this.outputEl.dom));
        this.currentCompletion += this.completionRowSize;
        this.currentCompletion %= this.completions.length;
        if (this.showingNumbers === true) {
            this.showNumbers();
        }
    },

    showPrevGroup: function() {
        if (this.completions.length <= this.completionRowSize) {return;}
        $('#' + this.getID(this.currentCompletion)).
            nextAll().
            slice(-this.completionRowSize).
            prependTo($(this.outputEl.dom));
        this.currentCompletion -= this.completionRowSize;
        if (this.currentCompletion < 0) {
            this.currentCompletion += this.completions.length;
        }
        if (this.showingNumbers === true) {
            this.showNumbers();
        }
    },

    toggleAllCompletions: function(event){
        if ($(".sympy-live-completions").hasClass("expanded")){
            this.hideAllCompletions();
        }
        else {
            this.showAllCompletions();
        }
    },

    showAllCompletions: function(event){
        height = Math.ceil(this.completions.length / this.completionRowSize) * 40;
        if(height > 160) {height = 160;}
        $(".sympy-live-completions").
            scrollTop(0).
            addClass("expanded").
            height(height);
        $(".sympy-live-completions-toolbar button:first").addClass("hidden");
    },

    hideAllCompletions: function(event){
        $(".sympy-live-completions-toolbar button:first").removeClass("hidden");
        $(".sympy-live-completions").scrollTop(0).
            removeClass("expanded").height(30);
    },

    showNumbers: function() {
        this.hideNumbers();
        this.showingNumbers = true;
        $(this.outputEl.dom).children("li").slice(0, 9).addClass('counted');
    },

    hideNumbers: function() {
        $(this.outputEl.dom).children("li").removeClass('counted');
        this.showingNumbers = false;
    },

    enableButtons: function() {
        this.buttonsEnabled = true;
        $('.sympy-live-completions-toolbar button').removeClass('disabled');
    },

    disableButtons: function() {
        this.buttonsEnabled = false;
        $('.sympy-live-completions-toolbar button').addClass('disabled');
    },

    getID: function(index) {
        return "completion-" + index
    },

    isShowing: function(index) {
        var y = this.outputEl.first("li").getY();
        return (Ext.fly(this.getID(index)).getY() === y);
    },

    isNumberKey: function(keyCode) {
        return SymPy.NumberKeys[keyCode] === true;
    }
});

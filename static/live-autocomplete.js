utilities.namespace("SymPy");

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

SymPy.Completer = Class.$extend({
    inputEl: null,
    outputEl: null,
    completions: [],
    currentCompletion: 0,
    completionRowSize: 3,
    expandCompletions: true,

    __init__: function(config, shell) {
        config = $.extend({}, config);
        this.inputEl = config.input;
        this.containerEl = config.container;
        this.basePath = config.basePath;
        this.shell = shell;
        this.buttonState = {
            prev: false,
            next: false,
            expand: false,
        };
        var expand = this.shell.getCookie('sympy-completer-expand', true);
        if (expand === 'true') {
            this.expandCompletions = true;
        }
        else if (expand === 'false') {
            this.expandCompletions = false;
        }
    },

    setup: function() {
        this.toolbarEl = this.containerEl.append(
            $("<div />", {"class": 'sympy-live-completions-toolbar'})
                .append($("<button><span>&#x25BC;</span></button>")
                        .attr({"id": 'sympy-live-completions-toggle'}))
                .append($("<button>&lt;</button>")
                        .attr({"class": 'disabled',
                               'id': 'sympy-live-completions-prev'}))
                .append($("<button>&gt;</button>")
                        .attr({"class": 'disabled',
                               "id": 'sympy-live-completions-next'}))
        ).children('div');
        this.expandEl = this.toolbarEl.children("button:nth(0)");
        this.prevEl = this.toolbarEl.children("button:nth(1)");
        this.nextEl = this.toolbarEl.children("button:nth(2)");
        this.expandEl.click($.proxy(function(e) {
            if (this.isButtonEnabled("expand")) {
                this.toggleAllCompletions();
                this.shell.setCookie('sympy-completer-expand',
                                     (!this.expandCompletions).toString());
                this.expandCompletions = !this.expandCompletions;
            }
            this.shell.focus();
        }, this));
        this.nextEl.click($.proxy(function(event){
            if (this.isButtonEnabled("next")) {
                this.showNextGroup();
            }
            this.shell.focus();
        }, this));
        this.prevEl.click($.proxy(function(event){
            if (this.isButtonEnabled("prev")) {
                this.showPrevGroup();
            }
            this.shell.focus();
        }, this));
        this.outputEl = $("<ol />", {class: 'sympy-live-completions'})
            .append($("<em>Completions here</em>"));
        this.containerEl.append(this.outputEl);
        this.disableButtons(["prev", "next", "expand"]);
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
                session: this.shell.session || null,
                statement: statement
            };
            $.ajax((this.basePath || '') + '/complete', {
                type: 'POST',
                data: JSON.stringify(data),
                dataType: 'json',
                success: $.proxy(function(data, textStatus, xhr) {
                    this.completionSuccess(data);
                }, this),
                error: $.proxy(function(xhr, textStatus, error) {
                    this.completionError();
                }, this)
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
        if (index < this.completions.length){
            this.doComplete(this.completions[index]);
        }
    },

    finishComplete: function(){
        this.replaceText = null;
        this.replacePositon = null;
        this.completions = [];
        this.allCompletions = [];
        this.currentCompletion = 0;
        $(this.outputEl).html('');
        this.hideAllCompletions();
        this.disableButtons(["prev", "next", "expand"]);
    },

    completionSuccess: function(responseJSON) {
        this.shell.session = responseJSON['session'];
        var completions = responseJSON['completions'];
        this.outputEl.html('');
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
                var link = $("<li><button>" + completions[i] + "</button></li>");
                link.attr({id: this.getID(i)});
                link.appendTo(this.outputEl);
                link.click($.proxy(function(event){
                    this.doComplete($(event.currentTarget).text());
                }, this));
            }
            var padding = this.completionRowSize;
            padding -= (completions.length % this.completionRowSize);
            padding %= this.completionRowSize;
            for (var j = 0; j < padding; j++) {
                this.outputEl.append($("<li><button class='padding'/></li>"));
            }
            $("button.padding").html("&nbsp;");
            this.currentCompletion = 0;
            this.completions = completions;
            this.allCompletions = completions;
            if (completions.length > this.completionRowSize) {
                if (this.expandCompletions) {
                    this.showAllCompletions();
                }
                this.enableButtons(["expand", "next"]);
            }
            else {
                this.disableButtons(["expand", "prev", "next"]);
            }
        }
        else {
            this.finishComplete();
            this.outputEl.append($("<li><em>&lt;No completions&gt;</em>",
                                   {class: 'sympy-live-completions-none'}));
        }
    },

    completionError: function() {
        this.outputEl.html('');
        this.outputEl.append($("<li>&lt;Error getting completions&gt;</li>"),
                             {class: 'sympy-live-completions-none'});
    },

    showNextGroup: function() {
        if (this.completions.length <= this.completionRowSize) {
            this.disableButton("next");
            return;
        }
        this.enableButton("prev");
        var id = (this.currentCompletion + this.completionRowSize);
        if (id >= this.completions.length - this.completionRowSize) {
            this.disableButton("next");
            id = this.completions.length - this.completionRowSize + 1;
            id += this.completions.length % this.completionRowSize;
        }
        $('#' + this.getID(id)).
            prevAll().
            reverse().
            appendTo(this.outputEl);
        this.currentCompletion = id;
        if (this.currentCompletion >= this.completions.length - 1) {
            this.currentCompletion = this.completions.length - 1;
            this.disableButton("next");
        }
        if (this.showingNumbers === true) {
            this.showNumbers();
        }
    },

    showPrevGroup: function() {
        if (this.completions.length <= this.completionRowSize ||
            this.currentCompletion == 0
           ) {
            this.disableButton("prev");
            return;
        }
        this.enableButton("next");
        $('#' + this.getID(this.currentCompletion)).
            nextAll().
            slice(-this.completionRowSize).
            prependTo(this.outputEl);
        this.currentCompletion -= this.completionRowSize;
        if (this.currentCompletion <= 0) {
            this.currentCompletion = 0;
            this.disableButton("prev");
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
        var height = Math.ceil(
            this.completions.length / this.completionRowSize) * 40;
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
        this.outputEl.children("li").slice(0, 9).addClass('counted');
    },

    hideNumbers: function() {
        this.outputEl.children("li").removeClass('counted');
        this.showingNumbers = false;
    },

    isButtonEnabled: function(button) {
        if (this.buttonState[button] === true) {
            return true;
        }
        return false;
    },

    enableButton: function(button) {
        this.buttonState[button] = true;
        // Not very nice but simple
        this[button + "El"].removeClass("disabled");
    },

    disableButton: function(button) {
        this.buttonState[button] = false;
        // Not very nice but simple
        this[button + "El"].addClass("disabled");
    },

    enableButtons: function(buttons) {
        $.map(buttons, $.proxy(this.enableButton, this));
    },

    disableButtons: function(buttons) {
        $.map(buttons, $.proxy(this.disableButton, this));
    },

    getID: function(index) {
        return "completion-" + index
    },

    isNumberKey: function(keyCode) {
        return SymPy.NumberKeys[keyCode] === true;
    }
});

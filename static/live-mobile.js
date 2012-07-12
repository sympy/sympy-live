Ext.ns("SymPy");
SymPy.HISTORY_TEMPLATE = '<div id="sympy-live-toolbar-history">' +
    '<button id="button-history-prev">↑</button>' +
    '<button id="button-history-next">↓</button>' +
    '</div>';
SymPy.MobileShell = Ext.extend(
    SymPy.Shell, {
        constructor: function(config) {
            config = Ext.apply({}, config);
            SymPy.MobileShell.superclass.constructor.call(this, config);
        },
        renderToolbar: function(el) {
            SymPy.MobileShell.superclass.renderToolbar.call(this, el);
            this.promptEl.after($(SymPy.HISTORY_TEMPLATE));
            this.submitEl.children('option[value="enter"]').
                html("submits");
            this.submitEl.children('option[value="shift-enter"]').
                html("inserts newline");
            this.submitEl.
                before($('<label for="submit-behavior">Enter </span>'));
            this.historyPrevEl = $("#button-history-prev");
            this.historyNextEl = $("#button-history-next");
        },
        render: function(el) {
            SymPy.MobileShell.superclass.render.call(this, el);
            this.renderSearches();
            this.promptEl.attr({autocorrect: 'off', autocapitalize: 'off'});
            $("#output-format").next().remove();
			$("#output-format").next().remove();
            $("#autocomplete").next().remove();
            $("#autocomplete").remove();
            $(".sympy-live-toolbar").children("span").last().remove();
            $("#sympy-live-toolbar-main").
                appendTo(".sympy-live-completions-toolbar");
            $("#fullscreen-button").remove();
            this.completeButtonEl = $("<button>Complete</button>").
                insertAfter(this.evaluateEl);
            this.historyPrevEl.click($.proxy(function(event){
                this.promptEl.focus(1000);
                this.prevInHistory();
            }, this));
            this.historyNextEl.click($.proxy(function(event){
                this.promptEl.focus(1000);
                this.nextInHistory();
            }, this));
            this.completeButtonEl.click($.proxy(function(event){
                this.completer.complete(
                    this.getStatement(),
                    this.getSelection());
            }, this));
            $(window).bind("orientationchange",
                           $.proxy(this.orientationUpdate, this));
            this.orientationUpdate();
            $("#menu").click(function(event){
                $("#main-navigation").slideToggle();
                $("#main-navigation").find("ul").slideToggle();
            });
            $(document.body).scrollTop(this.outputEl.offset().top);
            this.completer.expandCompletions = true;
        },
        handleKey: function(event) {
            if (event.which == SymPy.Keys.ENTER) {
                var enterSubmits = (this.submitEl.val() ==
                                    "enter");
                if (enterSubmits) {
                    event.stopPropagation();
                    event.preventDefault();
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

                        event.stopPropagation();
                        event.preventDefault();
                        return true;
                    }
                }
            }
            SymPy.MobileShell.superclass.handleKey.call(this, event);
        },
        renderSearches: function(){
            this.savedSearches = $("#saved-searches");
            this.recentSearches = $("#recent-searches");
            var setupEval = (function(el){
                var nodes = el.find("button");
                var shell = this;  // closure
                el.find("button").each(function(index, node){
                    node = $(node);
                    node.click(function(event){
                        // We don't want the query to show up twice
                        var origPrivacy = shell.recordEl.val();
                        shell.recordEl.val("on");
                        // And we're going to scroll to the output
                        var scrollY = shell.outputEl.offset().top;

                        shell.setValue(node.children("pre").html());
                        shell.evaluate();

                        $(document.body).scrollTop(scrollY);
                        shell.recordEl.val(origPrivacy);
                    });
                });
            });
            setupEval.call(this, this.recentSearches);
            setupEval.call(this, this.savedSearches);
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
        },

        orientationUpdate: function(){
            if (window.orientation === 0 || window.orientation === 180){
                this.completer.completionRowSize = 1;
            }
            else {
                this.completer.completionRowSize = 2;
            }
        },

        focus: function() {
            this.setSelection(this.getValue().length);
        }
    });

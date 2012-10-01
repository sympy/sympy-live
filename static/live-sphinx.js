utilities.namespace("SymPy");
SymPy.DEFAULT_ANIMATION_DURATION = 500;
SymPy.SphinxShell = SymPy.Shell.$extend({
    evalModeTypes: ['eval', 'copy'],
    evalMode: 'eval',

    __init__: function(config) {
        this.$super(config);
        this.visible = false;
        this.queuedStatements = [];

        index = this.evalModeTypes.indexOf(config.record);
        this.evalMode = (index == -1) ? this.getCookie('sympy-evalMode', 'eval') : config.evalMode;
        this.banner = config.banner ? config.banner : '';
    },

    render: function(el) {
        this.$super(el);

        this.shellEl = $(el);

        var headerLink =
            $('<a href="http://live.sympy.org">SymPy Live Shell</a>');
        var header = $("<h2/>").append(headerLink);
        this.shellEl.prepend(header);

        this.toggleShellEl = $('<button/>').
            html("<span>Show SymPy Live Shell</span>").
            attr("id", "toggleShell");
        this.toggleShellEl.prepend($('<div class="arrow" />'));

        this.toggleShellEl.appendTo(document.body);
        this.toggleShellEl.click($.proxy(function() {
            this.toggle();
        }, this));

        // Add a link to Python code that will evaluate it in SymPy Live
        this.processCodeBlocks();

        // Don't expand the list of tab completions (saves space)
        this.completer.expandCompletions = false;

        // Change Fullscreen to go to main website
        $("#fullscreen-button").html("Go to SymPy Live");

	    this.evalModeEl.change($.proxy(function(event) {
            this.updateSettings();
            this.focus();
        }, this));
    },

    renderToolbar: function(settings) {
        this.$super(settings);

        $('<h3 class="shown">Settings</h3>').
            prependTo($("#settings")).
            click($.proxy(this.toggleSettings, this));
        $("#settings h3").prepend($('<div class="arrow"/>'));

        // We don't need the "force desktop version" option since there is
        // no mobile version
        var checkbox = $('#settings input[type="checkbox"]');
        checkbox.prev().hide();
        checkbox.next().hide();
        checkbox.hide();

        this.toolbarEl.append(
            $('<br/>'),
            $('<label for="evalMode">Evaluation Mode:</label>'),
            $('<select id="evalMode"/>').append(
                $('<option value="eval">Evaluate</option>'),
                $('<option value="copy">Copy</option>')
            ),
            $('<br/>')
        );
        this.evalModeEl = $('#evalMode');

        var index = this.evalModeTypes.indexOf(this.evalMode);
        this.evalModeEl.children('option')[index].selected = true;

        // Make enter the default submission button
        $("#submit-behavior").val("enter");
    },

    done: function(response) {
        this.$super(response);
        if (this.queuedStatements.length !== 0) {
            this.dequeueStatement();
            this.evaluate();
        }
    },

    error: function(xhr, status, error) {
        this.$super(xhr, status, error);
        this.queuedStatements.length = 0;
    },

    dequeueStatement: function() {
        if (this.queuedStatements.length !== 0) {
            this.setValue(this.queuedStatements.shift());
        }
    },

    processCodeBlocks: function() {
        $('.highlight-python').each($.proxy(function(index, el) {
            var el = $(el);
            var promptsFound = this.processIndividualCodeBlocks(el.find('pre'));

            if (promptsFound) {
                // Add the toolbar
                var container = $("<div/>").addClass('sympy-live-eval-toolbar');
                var evaluate = $("<button>Run code block in SymPy Live</button>").
                    addClass('sympy-live-eval-button').
                    appendTo(container);
                el.prepend(container);

                evaluate.click($.proxy(function() {
                    this.show();
                    var statementBlocks = el.find('div.live-statement');
                    var codeBlocks = [];
                    for (var i = 0; i < statementBlocks.length; i++) {
                        codeBlocks.push(
                            this.stripCode($(statementBlocks[i]).text())
                        );
                    }
                    if (this.evalModeEl.val() === "eval") {
                        this.queuedStatements = codeBlocks;
                        this.dequeueStatement();
                        this.evaluate();
                    }
                    else {
                        this.setValue(codeBlocks.join("\n"));
                        this.focus();
                    }
                }, this));
            }
        }, this));
    },

    /**
     * Processes a <pre> block, wrapping each line in a <div>. Additionally,
     * if the line is a Python prompt, it will be made executable-on-click.
     *
     * @return {Boolean} true if prompts were found
     */
    processIndividualCodeBlocks: function(codeEl) {
        // childNodes gives text nodes which we want for whitespace
        var childNodes = codeEl.get(0).childNodes;
        var currentLine = [];
        var lines = [];

        for (var i = 0; i < childNodes.length; i++) {
            var domNode = childNodes[i];
            if (domNode.nodeType === domNode.ELEMENT_NODE) {
                currentLine.push(domNode.cloneNode(true));

                // innerText is non-standard but only Firefox does not
                // support it; textContent is standard but IE < 9
                // does not support it
                var textContent = domNode.textContent || domNode.innerText;
                if (currentLine.length === 1 &&
                    textContent.substr(0, 3) === "...") {
                    // First node on line and continuation, so continue from
                    // the previous line
                    currentLine = lines.pop();
                    currentLine.push(domNode.cloneNode(true));
                }
            }
            else if (domNode.nodeType === domNode.TEXT_NODE) {
                currentLine.push(domNode.cloneNode(true));
                if (domNode.data.substr(-1) === '\n') {
                    lines.push(currentLine);
                    currentLine = [];
                }
            }
        }

        if (lines.length !== 0) {
            var foundPrompt = false;

            codeEl.empty();
            for (var i = 0; i < lines.length; i++) {
                var line = $('<div />');
                var processingLine = lines[i];
                var firstLineContent = processingLine[0].textContent ||
                    processingLine[0].innerText;
                if (firstLineContent.substr(0, 4) === ">>> ") {
                    foundPrompt = true;

                    line.addClass('live-statement');
                    line.click($.proxy((function(line) {
                        // Save the current line
                        return function() {
                            this.setValue(this.stripCode(line.text()));
                            this.show();
                            if (this.evalModeEl.val() === "eval") {
                                this.evaluate();
                            }
                            else {
                                this.focus();
                            }
                        }
                    })(line), this));
                    line.hover(
                        function() {},
                        function() {}
                    );
                }
                line.append(processingLine);
                codeEl.append(line);
            }

            return foundPrompt;
        }

        // No code was processed so of course no prompts were found
        return false;
    },

    // Strips >>> and ... from a string
    stripCode: function(text) {
        var lines = text.split(/\n/g);
        var strippedLines = [];
        for (var i = 0; i < lines.length; i++) {
            strippedLines.push(lines[i].slice(4));
        }
        return strippedLines.join('\n').trim();
    },

    hide: function(duration) {
        if (typeof duration === "undefined") {
            duration = SymPy.DEFAULT_ANIMATION_DURATION;
        }
        this.disablePrompt();

        this.shellDimensionsRestored = {
            width: this.shellEl.width(),
            height: this.shellEl.height(),
            opacity: 1
        };

        this.shellEl.animate({
            width: 0,
            height: 0,
            opacity: 0
        }, duration);
        this.visible = false;

        this.toggleShellEl.removeClass('shown').children('span').
            html("Show SymPy Live Shell");
    },

    show: function(duration) {
        if (this.visible) return;

        if (typeof duration === "undefined") {
            duration = SymPy.DEFAULT_ANIMATION_DURATION;
        }
        if (typeof this.shellDimensionsRestored === "undefined") {
            this.shellDimensionsRestored = {};
            // Quickly show the shell and get its height
            var shell = $(this.shellEl).css('display', 'block');
            this.shellDimensionsRestored.height = shell.height();
            this.shellDimensionsRestored.width = shell.width();
            shell.css('display', 'none');
        }
        this.enablePrompt();
        var shell = $(this.shellEl).css('display', 'block').width(0).height(0);
        $(this.shellEl).animate(
            this.shellDimensionsRestored,
            duration,
            function() {
                // Don't fix the height so that if the settings are
                // expanded, the shell will expand with them
                $(this).css('height', 'auto');
            });
        this.visible = true;
        this.toggleShellEl.addClass('shown').children('span').
            html("Hide SymPy Live Shell");
    },

    toggle: function(duration) {
        if (typeof duration === "undefined") {
            duration = SymPy.DEFAULT_ANIMATION_DURATION;
        }
        if (this.isVisible()) {
            this.hide(duration);
        }
        else {
            this.show(duration);
        }
    },

    toggleSettings: function(duration) {
        if (typeof duration === "undefined") {
            duration = SymPy.DEFAULT_ANIMATION_DURATION;
        }

        if ($("#settings .content").is(":visible")) {
            $("#settings .content").slideUp(duration);
            $("#settings h3").removeClass('shown');
        }
        else {
            $("#settings .content").slideDown(duration);
            $("#settings h3").addClass('shown');
        }
    },

    isVisible: function() {
        return this.visible;
    },

    fullscreen: function() {
        window.open("http://live.sympy.org");
    },

    updateSettings: function() {
        this.$super();
        this.setCookie('sympy-evalMode', this.evalModeEl.val());
    }
});

$(document).ready(function() {
    var path = SymPy.getBasePath('live-sphinx.js');

    $.get(path + '/sphinxbanner', function(data) {
        var shellEl = $('<div id="shell"/>').appendTo($(document.body));
        var settingsEl = $('<div id="settings"><div class="content"></div></div>');
        settingsEl.appendTo(shellEl);  // Needed to render the shell

        var shell = new SymPy.SphinxShell({
            baseName: 'live-sphinx.js',
            banner: data
        });
        shell.render(shellEl);
        settingsEl.appendTo(shellEl); // Put it under the shell
        shell.toggleSettings();
    });
});

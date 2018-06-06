

(function(){


var story = {};

(function () {
    'use strict';

    story.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                story.set('_turncount', story.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    story.story.passage(passage);
                }
                var turnPassage = '@' + story.get('_turncount');
                if (turnPassage in story.story.section.passages) {
                    story.story.passage(turnPassage);
                }
                if ('@last' in story.story.section.passages && story.get('_turncount')>= story.story.section.passageCount) {
                    story.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                story.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    story.set(link.attr('data-attribute'), result[0]);
                }
                story.story.save();
            }
        };

        story.ui.output.on('click', 'a.story-link', function () {
            handleLink(jQuery(this));
        });

        story.ui.output.on('keypress', 'a.story-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        story.ui.output.on('mousedown', 'a.story-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }

    story.story.begin = function () {
        if (!story.story.load()) {
            story.story.go(story.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=story.get(rhs.substring(1));
                story.set(lhs, rhs);
            }
            else {
                story.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=story.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = story.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                story.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                story.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in story.story.section.passages) {
            text = story.story.section.passages[text].text;
        }
        else if (text in story.story.sections) {
            text = story.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = story.ui.output.find('.story-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(story.ui.processText(text));
            $labels.fadeIn(1000, function() {
                story.story.save();
            });
        });
    };

    story.story.go = function(section) {
        story.set('_transition', null);
        newSection();
        story.story.section = story.story.sections[section];
        if (!story.story.section) return;
        story.set('_section', section);
        setSeen(section);
        var master = story.story.sections[''];
        if (master) {
            story.story.run(master);
            story.ui.write(master.text);
        }
        story.story.run(story.story.section);
        // The JS might have changed which section we're in
        if (story.get('_section') == section) {
            story.set('_turncount', 0);
            story.ui.write(story.story.section.text);
            story.story.save();
        }
    };

    story.story.run = function(section) {
        if (section.clear) {
            story.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    story.story.passage = function(passageName) {
        var passage = story.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = story.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                story.story.run(masterPassage);
                story.ui.write(masterPassage.text);
            }
        }
        var master = story.story.section.passages[''];
        if (master) {
            story.story.run(master);
            story.ui.write(master.text);
        }
        story.story.run(passage);
        story.ui.write(passage.text);
        story.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    story.story.restart = function() {
        if (story.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, story.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            story.storageFallback = {};
        }
        if (story.ui.settings.scroll === 'element') {
            story.ui.output.html('');
            story.story.begin();
        }
        else {
            location.reload();
        }
    };

    story.story.save = function() {
        story.set('_output', story.ui.output.html());
    };

    story.story.load = function() {
        var output = story.get('_output');
        if (!output) return false;
        story.ui.output.html(output);
        currentSection = jQuery('#' + story.get('_output-section'));
        story.story.section = story.story.sections[story.get('_section')];
        var transition = story.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = story.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            story.set('_seen_sections', seenSections);
        }
    };

    story.story.seen = function(sectionName) {
        var seenSections = story.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };

    story.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.story-link', currentSection));
        }
        var sectionCount = story.get('_section-count') + 1;
        story.set('_section-count', sectionCount);
        var id = 'story-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(story.ui.output);
        story.set('_output-section', id);
    };

    story.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = story.ui.output.height();
        currentSection.append(jQuery('<div/>').html(story.ui.processText(text)));
        story.ui.scrollToEnd();
    };

    story.ui.clearScreen = function() {
        story.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    story.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (story.ui.settings.scroll === 'element') {
            scrollTo = story.ui.output[0].scrollHeight - story.ui.output.height();
            currentScrollTop = story.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                story.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    story.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;

            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;

                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);

                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }

            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }

            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);
            }
            else if (text in story.story.section.passages) {
                return process(story.story.section.passages[text].text, data);
            }
            else if (text in story.story.sections) {
                return process(story.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return story.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = story.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=story.get(rhs.substring(1));

                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (story.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = story.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="story-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                story.set(attribute, rotation[0]);
            }
            return '<a class="story-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    story.ui.transition = function(f) {
        story.set('_transition', f.toString());
        f();
    };

    story.storageFallback = {};

    story.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (story.ui.settings.persist && window.localStorage) {
            localStorage[story.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            story.storageFallback[attribute] = JSON.stringify(value);
        }
        story.ui.settings.onSet(attribute, value);
    };

    story.get = function(attribute) {
        var result;
        if (story.ui.settings.persist && window.localStorage) {
            result = localStorage[story.story.id + '-' + attribute];
        }
        else {
            result = story.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            story.ui.output = this;
            story.ui.restart = jQuery(settings.restart);
            story.ui.settings = settings;

            if (settings.scroll === 'element') {
                story.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            story.story.begin();

            return this;
        },
        get: function (attribute) {
            return story.get(attribute);
        },
        set: function (attribute, value) {
            story.set(attribute, value);
        },
        restart: function () {
            if (!story.ui.settings.restartPrompt || confirm("Voulez vous tout recommencer? 🤔")) {
                story.story.restart();
            }
        }
    };

    jQuery.fn.story = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = story.get;
var set = story.set;


story.story.start = '_default';
story.story.id = '3cc57f85ac';
story.story.sections = {
	'_default': {
		'text': "<p>Le voyant !</p>\n<p>Tu es <a class=\"story-link link-section\" data-section=\"une femme\" role=\"link\" tabindex=\"0\">une femme</a> ou <a class=\"story-link link-section\" data-section=\"un homme\" role=\"link\" tabindex=\"0\">un homme</a> ?</p>",
		'passages': {
		},
	},
	'une femme': {
		'text': "<p>Tu veux rencontrer une <a class=\"story-link link-section\" data-section=\"femme\" role=\"link\" tabindex=\"0\">femme</a> ou un <a class=\"story-link link-section\" data-section=\"homme\" role=\"link\" tabindex=\"0\">homme</a> ?</p>",
		'passages': {
		},
	},
	'femme': {
		'text': "<p>Nous allons donc te mettre en relation avec une de ces 3 femmes : <a class=\"story-link link-section\" data-section=\"Marion Cotillard\" role=\"link\" tabindex=\"0\">Marion Cotillard</a>, <a class=\"story-link link-section\" data-section=\"Katy Perry\" role=\"link\" tabindex=\"0\">Katy Perry</a> ou <a class=\"story-link link-section\" data-section=\"Beyonce\" role=\"link\" tabindex=\"0\">Beyonce</a></p>",
		'passages': {
		},
	},
	'Marion Cotillard': {
		'text': "<p>Très mauvais choix, cette femme est autaine, elle va  te faire des caprices à longueur de journée, tu risques de ne pas pouvoir la supporter bien longtemps. Je suis déosolé pour toi. Changer de <a class=\"story-link link-section\" data-section=\"femme\" role=\"link\" tabindex=\"0\">femme</a> ?</p>",
		'passages': {
		},
	},
	'Katy Perry': {
		'text': "<p>Très belle femme, qui saura te guider vers de bons choix, cependant elle ne vivra pas très longtemps après votre mariage ce qui va nuire à ta santé, tu vas te noyé dans l&#39;alcool jusqu&#39;au suicide... <em>RIP AVICII</em> Changer de <a class=\"story-link link-section\" data-section=\"femme\" role=\"link\" tabindex=\"0\">femme</a> ?</p>",
		'passages': {
		},
	},
	'Beyonce': {
		'text': "<p>Le meilleur choix possible, tu vas vivre le parfait amour avec cette femme, elle saura te combler et te rendre heureux, je voie une grande passion entre vous. Changer de <a class=\"story-link link-section\" data-section=\"femme\" role=\"link\" tabindex=\"0\">femme</a> ou choisir un <a class=\"story-link link-section\" data-section=\"homme \" role=\"link\" tabindex=\"0\">homme </a>?</p>",
		'passages': {
		},
	},
	'homme': {
		'text': "<p>Nous allons donc te mettre en relation avec une de ces 3 hommes : <a class=\"story-link link-section\" data-section=\"Amaury Vassili\" role=\"link\" tabindex=\"0\">Amaury Vassili</a>, <a class=\"story-link link-section\" data-section=\"Amaury Leveaux\" role=\"link\" tabindex=\"0\">Amaury Leveaux</a> ou <a class=\"story-link link-section\" data-section=\"Amaury Faveriel\" role=\"link\" tabindex=\"0\">Amaury Faveriel</a></p>",
		'passages': {
		},
	},
	'Amaury Vassili': {
		'text': "<p>Très bon chanteur cependant lui ne te corespond pas. Il ne pense qu&#39;a sa carrière et ne se soucis pas de toi. Malheuresment cette histoire ne durera qu&#39;une semaine.. Change d&#39;<a class=\"story-link link-section\" data-section=\"homme\" role=\"link\" tabindex=\"0\">homme</a> ?</p>",
		'passages': {
		},
	},
	'Amaury Leveaux': {
		'text': "<p>Ancien nageur, je vois qu&#39;il n&#39;est malheuresement pas à ton goût. Changer d&#39;<a class=\"story-link link-section\" data-section=\"homme\" role=\"link\" tabindex=\"0\">homme</a> ?</p>",
		'passages': {
		},
	},
	'Amaury Faveriel': {
		'text': "<p>Je vois en cette homme une très grande sagesse, il te plait. Il te rendra heureuse. je vois que c&#39;est un fan de snowboard, il t&#39;emmenera donc à son chalet flocon qu&#39;il s&#39;est payer avec son salaire de developpeur pyhton.\nJe vois en vous deux une grande histoire d&#39;amoure. Malheuresment tu ne peux changer d&#39;homme il est parfait. C&#39;est la <a class=\"story-link link-section\" data-section=\"FIN\" role=\"link\" tabindex=\"0\">FIN</a></p>",
		'passages': {
		},
	},
	'un homme': {
		'text': "<p>Tu veux rencontrer une <a class=\"story-link link-section\" data-section=\"femme\" role=\"link\" tabindex=\"0\">femme</a> ou un <a class=\"story-link link-section\" data-section=\"homme\" role=\"link\" tabindex=\"0\">homme</a> ?</p>",
		'passages': {
		},
	},
	'FIN': {
		'text': "<p>Vous avez vu votre avenir amoureux, maintenant vous me devez la somme de 321€, merci :)</p>",
		'passages': {
		},
	},
}
})();

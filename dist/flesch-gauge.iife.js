var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.data !== data)
            text.data = data;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.shift()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            while (render_callbacks.length) {
                const callback = render_callbacks.pop();
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment) {
            $$.update($$.dirty);
            run_all($$.before_render);
            $$.fragment.p($$.dirty, $$.ctx);
            $$.dirty = null;
            $$.after_render.forEach(add_render_callback);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_render } = component.$$;
        fragment.m(target, anchor);
        // onMount happens after the initial afterUpdate. Because
        // afterUpdate callbacks happen in reverse order (inner first)
        // we schedule onMount callbacks before afterUpdate callbacks
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_render.forEach(add_render_callback);
    }
    function destroy(component, detaching) {
        if (component.$$) {
            run_all(component.$$.on_destroy);
            component.$$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            component.$$.on_destroy = component.$$.fragment = null;
            component.$$.ctx = {};
        }
    }
    function make_dirty(component, key) {
        if (!component.$$.dirty) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty = blank_object();
        }
        component.$$.dirty[key] = true;
    }
    function init(component, options, instance, create_fragment, not_equal$$1, prop_names) {
        const parent_component = current_component;
        set_current_component(component);
        const props = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props: prop_names,
            update: noop,
            not_equal: not_equal$$1,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_render: [],
            after_render: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty: null
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, props, (key, value) => {
                if ($$.ctx && not_equal$$1($$.ctx[key], $$.ctx[key] = value)) {
                    if ($$.bound[key])
                        $$.bound[key](value);
                    if (ready)
                        make_dirty(component, key);
                }
            })
            : props;
        $$.update();
        ready = true;
        run_all($$.before_render);
        $$.fragment = create_fragment($$.ctx);
        if (options.target) {
            if (options.hydrate) {
                $$.fragment.l(children(options.target));
            }
            else {
                $$.fragment.c();
            }
            if (options.intro && component.$$.fragment.i)
                component.$$.fragment.i();
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy(this, true);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
    }

    /* src/Ring.svelte generated by Svelte v3.4.4 */

    const file = "src/Ring.svelte";

    function add_css() {
    	var style = element("style");
    	style.id = 'svelte-1g5od43-style';
    	style.textContent = ".progress-ring__circle.svelte-1g5od43{transition:stroke-dashoffset 800ms ease-in-out;transform:rotate(90deg);transform-origin:center}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUmluZy5zdmVsdGUiLCJzb3VyY2VzIjpbIlJpbmcuc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGV4cG9ydCBsZXQgY29sb3IgPSAnYmxhY2snXG4gIGV4cG9ydCBsZXQgcmFkaXVzID0gNTJcbiAgZXhwb3J0IGxldCBwZXJjZW50ID0gMTAwXG5cbiAgbGV0IGNpcmN1bWZlcmVuY2UgPSByYWRpdXMgKiAyICogTWF0aC5QSVxuXG4gIGxldCBzdHJva2VEYXNoYXJyYXkgPSBgJHtjaXJjdW1mZXJlbmNlfSAke2NpcmN1bWZlcmVuY2V9YFxuICBsZXQgc3Ryb2tlRGFzaG9mZnNldCA9IGNpcmN1bWZlcmVuY2VcblxuICAkOiB7XG4gICAgLy8gdGltZW91dCB0byBlbmFibGUgdHJhbnNpdGlvblxuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgc3Ryb2tlRGFzaG9mZnNldCA9IGNpcmN1bWZlcmVuY2UgLSBwZXJjZW50IC8gMTAwICogY2lyY3VtZmVyZW5jZVxuICAgIH0sIDApXG4gIH1cbjwvc2NyaXB0PlxuXG48c3R5bGU+XG4ucHJvZ3Jlc3MtcmluZ19fY2lyY2xlIHtcbiAgdHJhbnNpdGlvbjogc3Ryb2tlLWRhc2hvZmZzZXQgODAwbXMgZWFzZS1pbi1vdXQ7XG4gIHRyYW5zZm9ybTogcm90YXRlKDkwZGVnKTtcbiAgdHJhbnNmb3JtLW9yaWdpbjogY2VudGVyO1xufVxuPC9zdHlsZT5cblxuPHN2Z1xuICAgY2xhc3M9XCJwcm9ncmVzcy1yaW5nXCJcbiAgIHdpZHRoPVwiMTIwXCJcbiAgIGhlaWdodD1cIjEyMFwiPlxuICA8Y2lyY2xlXG4gICAgY2xhc3M9XCJwcm9ncmVzcy1yaW5nX19jaXJjbGVcIlxuICAgIHN0cm9rZT17Y29sb3J9XG4gICAgc3Ryb2tlLXdpZHRoPVwiMTBcIlxuICAgIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIlxuICAgIHN0cm9rZS1kYXNoYXJyYXk9e3N0cm9rZURhc2hhcnJheX1cbiAgICBzdHJva2UtZGFzaG9mZnNldD17c3Ryb2tlRGFzaG9mZnNldH1cbiAgICBmaWxsPVwidHJhbnNwYXJlbnRcIlxuICAgIHI9e3JhZGl1c31cbiAgICBjeD1cIjYwXCJcbiAgICBjeT1cIjYwXCIvPlxuPC9zdmc+Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQW1CQSxzQkFBc0IsZUFBQyxDQUFDLEFBQ3RCLFVBQVUsQ0FBRSxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUMvQyxTQUFTLENBQUUsT0FBTyxLQUFLLENBQUMsQ0FDeEIsZ0JBQWdCLENBQUUsTUFBTSxBQUMxQixDQUFDIn0= */";
    	append(document.head, style);
    }

    function create_fragment(ctx) {
    	var svg, circle;

    	return {
    		c: function create() {
    			svg = svg_element("svg");
    			circle = svg_element("circle");
    			attr(circle, "class", "progress-ring__circle svelte-1g5od43");
    			attr(circle, "stroke", ctx.color);
    			attr(circle, "stroke-width", "10");
    			attr(circle, "stroke-linecap", "round");
    			attr(circle, "stroke-dasharray", ctx.strokeDasharray);
    			attr(circle, "stroke-dashoffset", ctx.strokeDashoffset);
    			attr(circle, "fill", "transparent");
    			attr(circle, "r", ctx.radius);
    			attr(circle, "cx", "60");
    			attr(circle, "cy", "60");
    			add_location(circle, file, 30, 2, 613);
    			attr(svg, "class", "progress-ring");
    			attr(svg, "width", "120");
    			attr(svg, "height", "120");
    			add_location(svg, file, 26, 0, 549);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, svg, anchor);
    			append(svg, circle);
    		},

    		p: function update(changed, ctx) {
    			if (changed.color) {
    				attr(circle, "stroke", ctx.color);
    			}

    			if (changed.strokeDashoffset) {
    				attr(circle, "stroke-dashoffset", ctx.strokeDashoffset);
    			}

    			if (changed.radius) {
    				attr(circle, "r", ctx.radius);
    			}
    		},

    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(svg);
    			}
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let { color = 'black', radius = 52, percent = 100 } = $$props;

      let circumference = radius * 2 * Math.PI;

      let strokeDasharray = `${circumference} ${circumference}`;
      let strokeDashoffset = circumference;

    	const writable_props = ['color', 'radius', 'percent'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Ring> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ('color' in $$props) $$invalidate('color', color = $$props.color);
    		if ('radius' in $$props) $$invalidate('radius', radius = $$props.radius);
    		if ('percent' in $$props) $$invalidate('percent', percent = $$props.percent);
    	};

    	$$self.$$.update = ($$dirty = { circumference: 1, percent: 1 }) => {
    		if ($$dirty.circumference || $$dirty.percent) { {
            // timeout to enable transition
            setTimeout(() => {
              $$invalidate('strokeDashoffset', strokeDashoffset = circumference - percent / 100 * circumference);
            }, 0);
          } }
    	};

    	return {
    		color,
    		radius,
    		percent,
    		strokeDasharray,
    		strokeDashoffset
    	};
    }

    class Ring extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-1g5od43-style")) add_css();
    		init(this, options, instance, create_fragment, safe_not_equal, ["color", "radius", "percent"]);
    	}

    	get color() {
    		throw new Error("<Ring>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<Ring>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get radius() {
    		throw new Error("<Ring>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set radius(value) {
    		throw new Error("<Ring>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get percent() {
    		throw new Error("<Ring>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set percent(value) {
    		throw new Error("<Ring>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function commonjsRequire () {
    	throw new Error('Dynamic requires are not currently supported by rollup-plugin-commonjs');
    }

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    function getCjsExportFromNamespace (n) {
    	return n && n['default'] || n;
    }

    var pluralize = createCommonjsModule(function (module, exports) {
    /* global define */

    (function (root, pluralize) {
      /* istanbul ignore else */
      if (typeof commonjsRequire === 'function' && 'object' === 'object' && 'object' === 'object') {
        // Node.
        module.exports = pluralize();
      } else {
        // Browser global.
        root.pluralize = pluralize();
      }
    })(commonjsGlobal, function () {
      // Rule storage - pluralize and singularize need to be run sequentially,
      // while other rules can be optimized using an object for instant lookups.
      var pluralRules = [];
      var singularRules = [];
      var uncountables = {};
      var irregularPlurals = {};
      var irregularSingles = {};

      /**
       * Sanitize a pluralization rule to a usable regular expression.
       *
       * @param  {(RegExp|string)} rule
       * @return {RegExp}
       */
      function sanitizeRule (rule) {
        if (typeof rule === 'string') {
          return new RegExp('^' + rule + '$', 'i');
        }

        return rule;
      }

      /**
       * Pass in a word token to produce a function that can replicate the case on
       * another word.
       *
       * @param  {string}   word
       * @param  {string}   token
       * @return {Function}
       */
      function restoreCase (word, token) {
        // Tokens are an exact match.
        if (word === token) return token;

        // Upper cased words. E.g. "HELLO".
        if (word === word.toUpperCase()) return token.toUpperCase();

        // Title cased words. E.g. "Title".
        if (word[0] === word[0].toUpperCase()) {
          return token.charAt(0).toUpperCase() + token.substr(1).toLowerCase();
        }

        // Lower cased words. E.g. "test".
        return token.toLowerCase();
      }

      /**
       * Interpolate a regexp string.
       *
       * @param  {string} str
       * @param  {Array}  args
       * @return {string}
       */
      function interpolate (str, args) {
        return str.replace(/\$(\d{1,2})/g, function (match, index) {
          return args[index] || '';
        });
      }

      /**
       * Replace a word using a rule.
       *
       * @param  {string} word
       * @param  {Array}  rule
       * @return {string}
       */
      function replace (word, rule) {
        return word.replace(rule[0], function (match, index) {
          var result = interpolate(rule[1], arguments);

          if (match === '') {
            return restoreCase(word[index - 1], result);
          }

          return restoreCase(match, result);
        });
      }

      /**
       * Sanitize a word by passing in the word and sanitization rules.
       *
       * @param  {string}   token
       * @param  {string}   word
       * @param  {Array}    rules
       * @return {string}
       */
      function sanitizeWord (token, word, rules) {
        // Empty string or doesn't need fixing.
        if (!token.length || uncountables.hasOwnProperty(token)) {
          return word;
        }

        var len = rules.length;

        // Iterate over the sanitization rules and use the first one to match.
        while (len--) {
          var rule = rules[len];

          if (rule[0].test(word)) return replace(word, rule);
        }

        return word;
      }

      /**
       * Replace a word with the updated word.
       *
       * @param  {Object}   replaceMap
       * @param  {Object}   keepMap
       * @param  {Array}    rules
       * @return {Function}
       */
      function replaceWord (replaceMap, keepMap, rules) {
        return function (word) {
          // Get the correct token and case restoration functions.
          var token = word.toLowerCase();

          // Check against the keep object map.
          if (keepMap.hasOwnProperty(token)) {
            return restoreCase(word, token);
          }

          // Check against the replacement map for a direct word replacement.
          if (replaceMap.hasOwnProperty(token)) {
            return restoreCase(word, replaceMap[token]);
          }

          // Run all the rules against the word.
          return sanitizeWord(token, word, rules);
        };
      }

      /**
       * Check if a word is part of the map.
       */
      function checkWord (replaceMap, keepMap, rules, bool) {
        return function (word) {
          var token = word.toLowerCase();

          if (keepMap.hasOwnProperty(token)) return true;
          if (replaceMap.hasOwnProperty(token)) return false;

          return sanitizeWord(token, token, rules) === token;
        };
      }

      /**
       * Pluralize or singularize a word based on the passed in count.
       *
       * @param  {string}  word
       * @param  {number}  count
       * @param  {boolean} inclusive
       * @return {string}
       */
      function pluralize (word, count, inclusive) {
        var pluralized = count === 1
          ? pluralize.singular(word) : pluralize.plural(word);

        return (inclusive ? count + ' ' : '') + pluralized;
      }

      /**
       * Pluralize a word.
       *
       * @type {Function}
       */
      pluralize.plural = replaceWord(
        irregularSingles, irregularPlurals, pluralRules
      );

      /**
       * Check if a word is plural.
       *
       * @type {Function}
       */
      pluralize.isPlural = checkWord(
        irregularSingles, irregularPlurals, pluralRules
      );

      /**
       * Singularize a word.
       *
       * @type {Function}
       */
      pluralize.singular = replaceWord(
        irregularPlurals, irregularSingles, singularRules
      );

      /**
       * Check if a word is singular.
       *
       * @type {Function}
       */
      pluralize.isSingular = checkWord(
        irregularPlurals, irregularSingles, singularRules
      );

      /**
       * Add a pluralization rule to the collection.
       *
       * @param {(string|RegExp)} rule
       * @param {string}          replacement
       */
      pluralize.addPluralRule = function (rule, replacement) {
        pluralRules.push([sanitizeRule(rule), replacement]);
      };

      /**
       * Add a singularization rule to the collection.
       *
       * @param {(string|RegExp)} rule
       * @param {string}          replacement
       */
      pluralize.addSingularRule = function (rule, replacement) {
        singularRules.push([sanitizeRule(rule), replacement]);
      };

      /**
       * Add an uncountable word rule.
       *
       * @param {(string|RegExp)} word
       */
      pluralize.addUncountableRule = function (word) {
        if (typeof word === 'string') {
          uncountables[word.toLowerCase()] = true;
          return;
        }

        // Set singular and plural references for the word.
        pluralize.addPluralRule(word, '$0');
        pluralize.addSingularRule(word, '$0');
      };

      /**
       * Add an irregular word definition.
       *
       * @param {string} single
       * @param {string} plural
       */
      pluralize.addIrregularRule = function (single, plural) {
        plural = plural.toLowerCase();
        single = single.toLowerCase();

        irregularSingles[single] = plural;
        irregularPlurals[plural] = single;
      };

      /**
       * Irregular rules.
       */
      [
        // Pronouns.
        ['I', 'we'],
        ['me', 'us'],
        ['he', 'they'],
        ['she', 'they'],
        ['them', 'them'],
        ['myself', 'ourselves'],
        ['yourself', 'yourselves'],
        ['itself', 'themselves'],
        ['herself', 'themselves'],
        ['himself', 'themselves'],
        ['themself', 'themselves'],
        ['is', 'are'],
        ['was', 'were'],
        ['has', 'have'],
        ['this', 'these'],
        ['that', 'those'],
        // Words ending in with a consonant and `o`.
        ['echo', 'echoes'],
        ['dingo', 'dingoes'],
        ['volcano', 'volcanoes'],
        ['tornado', 'tornadoes'],
        ['torpedo', 'torpedoes'],
        // Ends with `us`.
        ['genus', 'genera'],
        ['viscus', 'viscera'],
        // Ends with `ma`.
        ['stigma', 'stigmata'],
        ['stoma', 'stomata'],
        ['dogma', 'dogmata'],
        ['lemma', 'lemmata'],
        ['schema', 'schemata'],
        ['anathema', 'anathemata'],
        // Other irregular rules.
        ['ox', 'oxen'],
        ['axe', 'axes'],
        ['die', 'dice'],
        ['yes', 'yeses'],
        ['foot', 'feet'],
        ['eave', 'eaves'],
        ['goose', 'geese'],
        ['tooth', 'teeth'],
        ['quiz', 'quizzes'],
        ['human', 'humans'],
        ['proof', 'proofs'],
        ['carve', 'carves'],
        ['valve', 'valves'],
        ['looey', 'looies'],
        ['thief', 'thieves'],
        ['groove', 'grooves'],
        ['pickaxe', 'pickaxes'],
        ['whiskey', 'whiskies']
      ].forEach(function (rule) {
        return pluralize.addIrregularRule(rule[0], rule[1]);
      });

      /**
       * Pluralization rules.
       */
      [
        [/s?$/i, 's'],
        [/[^\u0000-\u007F]$/i, '$0'],
        [/([^aeiou]ese)$/i, '$1'],
        [/(ax|test)is$/i, '$1es'],
        [/(alias|[^aou]us|tlas|gas|ris)$/i, '$1es'],
        [/(e[mn]u)s?$/i, '$1s'],
        [/([^l]ias|[aeiou]las|[emjzr]as|[iu]am)$/i, '$1'],
        [/(alumn|syllab|octop|vir|radi|nucle|fung|cact|stimul|termin|bacill|foc|uter|loc|strat)(?:us|i)$/i, '$1i'],
        [/(alumn|alg|vertebr)(?:a|ae)$/i, '$1ae'],
        [/(seraph|cherub)(?:im)?$/i, '$1im'],
        [/(her|at|gr)o$/i, '$1oes'],
        [/(agend|addend|millenni|dat|extrem|bacteri|desiderat|strat|candelabr|errat|ov|symposi|curricul|automat|quor)(?:a|um)$/i, '$1a'],
        [/(apheli|hyperbat|periheli|asyndet|noumen|phenomen|criteri|organ|prolegomen|hedr|automat)(?:a|on)$/i, '$1a'],
        [/sis$/i, 'ses'],
        [/(?:(kni|wi|li)fe|(ar|l|ea|eo|oa|hoo)f)$/i, '$1$2ves'],
        [/([^aeiouy]|qu)y$/i, '$1ies'],
        [/([^ch][ieo][ln])ey$/i, '$1ies'],
        [/(x|ch|ss|sh|zz)$/i, '$1es'],
        [/(matr|cod|mur|sil|vert|ind|append)(?:ix|ex)$/i, '$1ices'],
        [/(m|l)(?:ice|ouse)$/i, '$1ice'],
        [/(pe)(?:rson|ople)$/i, '$1ople'],
        [/(child)(?:ren)?$/i, '$1ren'],
        [/eaux$/i, '$0'],
        [/m[ae]n$/i, 'men'],
        ['thou', 'you']
      ].forEach(function (rule) {
        return pluralize.addPluralRule(rule[0], rule[1]);
      });

      /**
       * Singularization rules.
       */
      [
        [/s$/i, ''],
        [/(ss)$/i, '$1'],
        [/(wi|kni|(?:after|half|high|low|mid|non|night|[^\w]|^)li)ves$/i, '$1fe'],
        [/(ar|(?:wo|[ae])l|[eo][ao])ves$/i, '$1f'],
        [/ies$/i, 'y'],
        [/\b([pl]|zomb|(?:neck|cross)?t|coll|faer|food|gen|goon|group|lass|talk|goal|cut)ies$/i, '$1ie'],
        [/\b(mon|smil)ies$/i, '$1ey'],
        [/(m|l)ice$/i, '$1ouse'],
        [/(seraph|cherub)im$/i, '$1'],
        [/(x|ch|ss|sh|zz|tto|go|cho|alias|[^aou]us|tlas|gas|(?:her|at|gr)o|ris)(?:es)?$/i, '$1'],
        [/(analy|ba|diagno|parenthe|progno|synop|the|empha|cri)(?:sis|ses)$/i, '$1sis'],
        [/(movie|twelve|abuse|e[mn]u)s$/i, '$1'],
        [/(test)(?:is|es)$/i, '$1is'],
        [/(alumn|syllab|octop|vir|radi|nucle|fung|cact|stimul|termin|bacill|foc|uter|loc|strat)(?:us|i)$/i, '$1us'],
        [/(agend|addend|millenni|dat|extrem|bacteri|desiderat|strat|candelabr|errat|ov|symposi|curricul|quor)a$/i, '$1um'],
        [/(apheli|hyperbat|periheli|asyndet|noumen|phenomen|criteri|organ|prolegomen|hedr|automat)a$/i, '$1on'],
        [/(alumn|alg|vertebr)ae$/i, '$1a'],
        [/(cod|mur|sil|vert|ind)ices$/i, '$1ex'],
        [/(matr|append)ices$/i, '$1ix'],
        [/(pe)(rson|ople)$/i, '$1rson'],
        [/(child)ren$/i, '$1'],
        [/(eau)x?$/i, '$1'],
        [/men$/i, 'man']
      ].forEach(function (rule) {
        return pluralize.addSingularRule(rule[0], rule[1]);
      });

      /**
       * Uncountable rules.
       */
      [
        // Singular words with no plurals.
        'adulthood',
        'advice',
        'agenda',
        'aid',
        'alcohol',
        'ammo',
        'anime',
        'athletics',
        'audio',
        'bison',
        'blood',
        'bream',
        'buffalo',
        'butter',
        'carp',
        'cash',
        'chassis',
        'chess',
        'clothing',
        'cod',
        'commerce',
        'cooperation',
        'corps',
        'debris',
        'diabetes',
        'digestion',
        'elk',
        'energy',
        'equipment',
        'excretion',
        'expertise',
        'flounder',
        'fun',
        'gallows',
        'garbage',
        'graffiti',
        'headquarters',
        'health',
        'herpes',
        'highjinks',
        'homework',
        'housework',
        'information',
        'jeans',
        'justice',
        'kudos',
        'labour',
        'literature',
        'machinery',
        'mackerel',
        'mail',
        'media',
        'mews',
        'moose',
        'music',
        'manga',
        'news',
        'pike',
        'plankton',
        'pliers',
        'pollution',
        'premises',
        'rain',
        'research',
        'rice',
        'salmon',
        'scissors',
        'series',
        'sewage',
        'shambles',
        'shrimp',
        'species',
        'staff',
        'swine',
        'tennis',
        'traffic',
        'transporation',
        'trout',
        'tuna',
        'wealth',
        'welfare',
        'whiting',
        'wildebeest',
        'wildlife',
        'you',
        // Regexes.
        /[^aeiou]ese$/i, // "chinese", "japanese"
        /deer$/i, // "deer", "reindeer"
        /fish$/i, // "fish", "blowfish", "angelfish"
        /measles$/i,
        /o[iu]s$/i, // "carnivorous"
        /pox$/i, // "chickpox", "smallpox"
        /sheep$/i
      ].forEach(pluralize.addUncountableRule);

      return pluralize;
    });
    });

    var charmap = {"105":"i","192":"A","193":"A","194":"A","195":"A","196":"A","197":"A","199":"C","200":"E","201":"E","202":"E","203":"E","204":"I","205":"I","206":"I","207":"I","209":"N","210":"O","211":"O","212":"O","213":"O","214":"O","216":"O","217":"U","218":"U","219":"U","220":"U","221":"Y","224":"a","225":"a","226":"a","227":"a","228":"a","229":"a","231":"c","232":"e","233":"e","234":"e","235":"e","236":"i","237":"i","238":"i","239":"i","241":"n","242":"o","243":"o","244":"o","245":"o","246":"o","248":"o","249":"u","250":"u","251":"u","252":"u","253":"y","255":"y","256":"A","257":"a","258":"A","259":"a","260":"A","261":"a","262":"C","263":"c","264":"C","265":"c","266":"C","267":"c","268":"C","269":"c","270":"D","271":"d","272":"D","273":"d","274":"E","275":"e","276":"E","277":"e","278":"E","279":"e","280":"E","281":"e","282":"E","283":"e","284":"G","285":"g","286":"G","287":"g","288":"G","289":"g","290":"G","291":"g","292":"H","293":"h","294":"H","295":"h","296":"I","297":"i","298":"I","299":"i","300":"I","301":"i","302":"I","303":"i","304":"I","308":"J","309":"j","310":"K","311":"k","313":"L","314":"l","315":"L","316":"l","317":"L","318":"l","319":"L","320":"l","321":"L","322":"l","323":"N","324":"n","325":"N","326":"n","327":"N","328":"n","332":"O","333":"o","334":"O","335":"o","336":"O","337":"o","338":"O","339":"o","340":"R","341":"r","342":"R","343":"r","344":"R","345":"r","346":"S","347":"s","348":"S","349":"s","350":"S","351":"s","352":"S","353":"s","354":"T","355":"t","356":"T","357":"t","358":"T","359":"t","360":"U","361":"u","362":"U","363":"u","364":"U","365":"u","366":"U","367":"u","368":"U","369":"u","370":"U","371":"u","372":"W","373":"w","374":"Y","375":"y","376":"Y","377":"Z","378":"z","379":"Z","380":"z","381":"Z","382":"z","384":"b","385":"B","386":"B","387":"b","390":"O","391":"C","392":"c","393":"D","394":"D","395":"D","396":"d","398":"E","400":"E","401":"F","402":"f","403":"G","407":"I","408":"K","409":"k","410":"l","412":"M","413":"N","414":"n","415":"O","416":"O","417":"o","420":"P","421":"p","422":"R","427":"t","428":"T","429":"t","430":"T","431":"U","432":"u","434":"V","435":"Y","436":"y","437":"Z","438":"z","461":"A","462":"a","463":"I","464":"i","465":"O","466":"o","467":"U","468":"u","477":"e","484":"G","485":"g","486":"G","487":"g","488":"K","489":"k","490":"O","491":"o","500":"G","501":"g","504":"N","505":"n","512":"A","513":"a","514":"A","515":"a","516":"E","517":"e","518":"E","519":"e","520":"I","521":"i","522":"I","523":"i","524":"O","525":"o","526":"O","527":"o","528":"R","529":"r","530":"R","531":"r","532":"U","533":"u","534":"U","535":"u","536":"S","537":"s","538":"T","539":"t","542":"H","543":"h","544":"N","545":"d","548":"Z","549":"z","550":"A","551":"a","552":"E","553":"e","558":"O","559":"o","562":"Y","563":"y","564":"l","565":"n","566":"t","567":"j","570":"A","571":"C","572":"c","573":"L","574":"T","575":"s","576":"z","579":"B","580":"U","581":"V","582":"E","583":"e","584":"J","585":"j","586":"Q","587":"q","588":"R","589":"r","590":"Y","591":"y","592":"a","593":"a","595":"b","596":"o","597":"c","598":"d","599":"d","600":"e","603":"e","604":"e","605":"e","606":"e","607":"j","608":"g","609":"g","610":"g","613":"h","614":"h","616":"i","618":"i","619":"l","620":"l","621":"l","623":"m","624":"m","625":"m","626":"n","627":"n","628":"n","629":"o","633":"r","634":"r","635":"r","636":"r","637":"r","638":"r","639":"r","640":"r","641":"r","642":"s","647":"t","648":"t","649":"u","651":"v","652":"v","653":"w","654":"y","655":"y","656":"z","657":"z","663":"c","665":"b","666":"e","667":"g","668":"h","669":"j","670":"k","671":"l","672":"q","686":"h","688":"h","690":"j","691":"r","692":"r","694":"r","695":"w","696":"y","737":"l","738":"s","739":"x","780":"v","829":"x","851":"x","867":"a","868":"e","869":"i","870":"o","871":"u","872":"c","873":"d","874":"h","875":"m","876":"r","877":"t","878":"v","879":"x","7424":"a","7427":"b","7428":"c","7429":"d","7431":"e","7432":"e","7433":"i","7434":"j","7435":"k","7436":"l","7437":"m","7438":"n","7439":"o","7440":"o","7441":"o","7442":"o","7443":"o","7446":"o","7447":"o","7448":"p","7449":"r","7450":"r","7451":"t","7452":"u","7453":"u","7454":"u","7455":"m","7456":"v","7457":"w","7458":"z","7522":"i","7523":"r","7524":"u","7525":"v","7680":"A","7681":"a","7682":"B","7683":"b","7684":"B","7685":"b","7686":"B","7687":"b","7690":"D","7691":"d","7692":"D","7693":"d","7694":"D","7695":"d","7696":"D","7697":"d","7698":"D","7699":"d","7704":"E","7705":"e","7706":"E","7707":"e","7710":"F","7711":"f","7712":"G","7713":"g","7714":"H","7715":"h","7716":"H","7717":"h","7718":"H","7719":"h","7720":"H","7721":"h","7722":"H","7723":"h","7724":"I","7725":"i","7728":"K","7729":"k","7730":"K","7731":"k","7732":"K","7733":"k","7734":"L","7735":"l","7738":"L","7739":"l","7740":"L","7741":"l","7742":"M","7743":"m","7744":"M","7745":"m","7746":"M","7747":"m","7748":"N","7749":"n","7750":"N","7751":"n","7752":"N","7753":"n","7754":"N","7755":"n","7764":"P","7765":"p","7766":"P","7767":"p","7768":"R","7769":"r","7770":"R","7771":"r","7774":"R","7775":"r","7776":"S","7777":"s","7778":"S","7779":"s","7786":"T","7787":"t","7788":"T","7789":"t","7790":"T","7791":"t","7792":"T","7793":"t","7794":"U","7795":"u","7796":"U","7797":"u","7798":"U","7799":"u","7804":"V","7805":"v","7806":"V","7807":"v","7808":"W","7809":"w","7810":"W","7811":"w","7812":"W","7813":"w","7814":"W","7815":"w","7816":"W","7817":"w","7818":"X","7819":"x","7820":"X","7821":"x","7822":"Y","7823":"y","7824":"Z","7825":"z","7826":"Z","7827":"z","7828":"Z","7829":"z","7835":"s","7840":"A","7841":"a","7842":"A","7843":"a","7864":"E","7865":"e","7866":"E","7867":"e","7868":"E","7869":"e","7880":"I","7881":"i","7882":"I","7883":"i","7884":"O","7885":"o","7886":"O","7887":"o","7908":"U","7909":"u","7910":"U","7911":"u","7922":"Y","7923":"y","7924":"Y","7925":"y","7926":"Y","7927":"y","7928":"Y","7929":"y","8305":"i","8341":"h","8342":"k","8343":"l","8344":"m","8345":"n","8346":"p","8347":"s","8348":"t","8450":"c","8458":"g","8459":"h","8460":"h","8461":"h","8464":"i","8465":"i","8466":"l","8467":"l","8468":"l","8469":"n","8472":"p","8473":"p","8474":"q","8475":"r","8476":"r","8477":"r","8484":"z","8488":"z","8492":"b","8493":"c","8495":"e","8496":"e","8497":"f","8498":"F","8499":"m","8500":"o","8506":"q","8513":"g","8514":"l","8515":"l","8516":"y","8517":"d","8518":"d","8519":"e","8520":"i","8521":"j","8526":"f","8579":"C","8580":"c","8765":"s","8766":"s","8959":"z","8999":"x","9746":"x","9776":"i","9866":"i","10005":"x","10006":"x","10007":"x","10008":"x","10625":"z","10626":"z","11362":"L","11364":"R","11365":"a","11366":"t","11373":"A","11374":"M","11375":"A","11390":"S","11391":"Z","19904":"i","42893":"H","42922":"H","42923":"E","42924":"G","42925":"L","42928":"K","42929":"T","62937":"x"};

    var charmap$1 = /*#__PURE__*/Object.freeze({
        'default': charmap
    });

    var require$$0 = getCjsExportFromNamespace(charmap$1);

    var normalizeStrings = createCommonjsModule(function (module) {
    (function(global, factory) {
      if (module.exports) {
        module.exports = factory(global, global.document);
      } else {
          global.normalize = factory(global, global.document);
      }
    } (typeof window !== 'undefined' ? window : commonjsGlobal, function (window, document) {
      var charmap = require$$0;
      var regex = null;
      var current_charmap;
      var old_charmap;

      function normalize(str, custom_charmap) {
        old_charmap = current_charmap;
        current_charmap = custom_charmap || charmap;

        regex = (regex && old_charmap === current_charmap) ? regex : buildRegExp(current_charmap);

        return str.replace(regex, function(charToReplace) {
          return current_charmap[charToReplace.charCodeAt(0)] || charToReplace;
        });
      }

      function buildRegExp(charmap){
         return new RegExp('[' + Object.keys(charmap).map(function(code) {return String.fromCharCode(code); }).join(' ') + ']', 'g');
       }

      return normalize;
    }));
    });

    const abalone=4;const abare=3;const abbruzzese=4;const abed=2;const aborigine=5;const abruzzese=4;const acreage=3;const adame=3;const adieu=2;const adobe=3;const anemone=4;const apache=3;const aphrodite=4;const apostrophe=4;const ariadne=4;const cafe=2;const calliope=4;const catastrophe=4;const chile=2;const chloe=2;const circe=2;const coyote=3;const daphne=2;const epitome=4;const eurydice=4;const euterpe=3;const every=2;const everywhere=3;const forever=3;const gethsemane=4;const guacamole=4;const hermione=4;const hyperbole=4;const jesse=2;const jukebox=2;const karate=3;const machete=3;const maybe=2;const newlywed=3;const penelope=4;const people=2;const persephone=4;const phoebe=2;const pulse=1;const queue=1;const recipe=3;const riverbed=3;const sesame=3;const shoreline=2;const simile=3;const snuffleupagus=5;const sometimes=2;const syncope=3;const tamale=3;const waterbed=3;const wednesday=2;const yosemite=4;const zoe=2;var problematic = {abalone:abalone,abare:abare,abbruzzese:abbruzzese,abed:abed,aborigine:aborigine,abruzzese:abruzzese,acreage:acreage,adame:adame,adieu:adieu,adobe:adobe,anemone:anemone,apache:apache,aphrodite:aphrodite,apostrophe:apostrophe,ariadne:ariadne,cafe:cafe,calliope:calliope,catastrophe:catastrophe,chile:chile,chloe:chloe,circe:circe,coyote:coyote,daphne:daphne,epitome:epitome,eurydice:eurydice,euterpe:euterpe,every:every,everywhere:everywhere,forever:forever,gethsemane:gethsemane,guacamole:guacamole,hermione:hermione,hyperbole:hyperbole,jesse:jesse,jukebox:jukebox,karate:karate,machete:machete,maybe:maybe,newlywed:newlywed,penelope:penelope,people:people,persephone:persephone,phoebe:phoebe,pulse:pulse,queue:queue,recipe:recipe,riverbed:riverbed,sesame:sesame,shoreline:shoreline,simile:simile,snuffleupagus:snuffleupagus,sometimes:sometimes,syncope:syncope,tamale:tamale,waterbed:waterbed,wednesday:wednesday,yosemite:yosemite,zoe:zoe};

    var problematic$1 = /*#__PURE__*/Object.freeze({
        abalone: abalone,
        abare: abare,
        abbruzzese: abbruzzese,
        abed: abed,
        aborigine: aborigine,
        abruzzese: abruzzese,
        acreage: acreage,
        adame: adame,
        adieu: adieu,
        adobe: adobe,
        anemone: anemone,
        apache: apache,
        aphrodite: aphrodite,
        apostrophe: apostrophe,
        ariadne: ariadne,
        cafe: cafe,
        calliope: calliope,
        catastrophe: catastrophe,
        chile: chile,
        chloe: chloe,
        circe: circe,
        coyote: coyote,
        daphne: daphne,
        epitome: epitome,
        eurydice: eurydice,
        euterpe: euterpe,
        every: every,
        everywhere: everywhere,
        forever: forever,
        gethsemane: gethsemane,
        guacamole: guacamole,
        hermione: hermione,
        hyperbole: hyperbole,
        jesse: jesse,
        jukebox: jukebox,
        karate: karate,
        machete: machete,
        maybe: maybe,
        newlywed: newlywed,
        penelope: penelope,
        people: people,
        persephone: persephone,
        phoebe: phoebe,
        pulse: pulse,
        queue: queue,
        recipe: recipe,
        riverbed: riverbed,
        sesame: sesame,
        shoreline: shoreline,
        simile: simile,
        snuffleupagus: snuffleupagus,
        sometimes: sometimes,
        syncope: syncope,
        tamale: tamale,
        waterbed: waterbed,
        wednesday: wednesday,
        yosemite: yosemite,
        zoe: zoe,
        'default': problematic
    });

    var problematic$2 = getCjsExportFromNamespace(problematic$1);

    var syllable_1 = syllables;

    var own = {}.hasOwnProperty;

    // Two expressions of occurrences which normally would be counted as two
    // syllables, but should be counted as one.
    var EXPRESSION_MONOSYLLABIC_ONE = new RegExp(
      [
        'cia(?:l|$)',
        'tia',
        'cius',
        'cious',
        '[^aeiou]giu',
        '[aeiouy][^aeiouy]ion',
        'iou',
        'sia$',
        'eous$',
        '[oa]gue$',
        '.[^aeiuoycgltdb]{2,}ed$',
        '.ely$',
        '^jua',
        'uai',
        'eau',
        '^busi$',
        '(?:[aeiouy](?:' +
          [
            '[bcfgklmnprsvwxyz]',
            'ch',
            'dg',
            'g[hn]',
            'lch',
            'l[lv]',
            'mm',
            'nch',
            'n[cgn]',
            'r[bcnsv]',
            'squ',
            's[chkls]',
            'th'
          ].join('|') +
          ')ed$)',
        '(?:[aeiouy](?:' +
          [
            '[bdfklmnprstvy]',
            'ch',
            'g[hn]',
            'lch',
            'l[lv]',
            'mm',
            'nch',
            'nn',
            'r[nsv]',
            'squ',
            's[cklst]',
            'th'
          ].join('|') +
          ')es$)'
      ].join('|'),
      'g'
    );

    var EXPRESSION_MONOSYLLABIC_TWO = new RegExp(
      '[aeiouy](?:' +
        [
          '[bcdfgklmnprstvyz]',
          'ch',
          'dg',
          'g[hn]',
          'l[lv]',
          'mm',
          'n[cgn]',
          'r[cnsv]',
          'squ',
          's[cklst]',
          'th'
        ].join('|') +
        ')e$',
      'g'
    );

    // Four expression of occurrences which normally would be counted as one
    // syllable, but should be counted as two.
    var EXPRESSION_DOUBLE_SYLLABIC_ONE = new RegExp(
      '(?:' +
        [
          '([^aeiouy])\\1l',
          '[^aeiouy]ie(?:r|s?t)',
          '[aeiouym]bl',
          'eo',
          'ism',
          'asm',
          'thm',
          'dnt',
          'snt',
          'uity',
          'dea',
          'gean',
          'oa',
          'ua',
          'react?',
          'orbed', // Cancel `'.[^aeiuoycgltdb]{2,}ed$',`
          'eings?',
          '[aeiouy]sh?e[rs]'
        ].join('|') +
        ')$',
      'g'
    );

    var EXPRESSION_DOUBLE_SYLLABIC_TWO = new RegExp(
      [
        'creat(?!u)',
        '[^gq]ua[^auieo]',
        '[aeiou]{3}',
        '^(?:ia|mc|coa[dglx].)',
        '^re(app|es|im|us)'
      ].join('|'),
      'g'
    );

    var EXPRESSION_DOUBLE_SYLLABIC_THREE = new RegExp(
      [
        '[^aeiou]y[ae]',
        '[^l]lien',
        'riet',
        'dien',
        'iu',
        'io',
        'ii',
        'uen',
        'real',
        'iell',
        'eo[^aeiou]',
        '[aeiou]y[aeiou]'
      ].join('|'),
      'g'
    );

    var EXPRESSION_DOUBLE_SYLLABIC_FOUR = /[^s]ia/;

    // Expression to match single syllable pre- and suffixes.
    var EXPRESSION_SINGLE = new RegExp(
      [
        '^(?:' +
          [
            'un',
            'fore',
            'ware',
            'none?',
            'out',
            'post',
            'sub',
            'pre',
            'pro',
            'dis',
            'side',
            'some'
          ].join('|') +
          ')',
        '(?:' +
          [
            'ly',
            'less',
            'some',
            'ful',
            'ers?',
            'ness',
            'cians?',
            'ments?',
            'ettes?',
            'villes?',
            'ships?',
            'sides?',
            'ports?',
            'shires?',
            'tion(?:ed|s)?'
          ].join('|') +
          ')$'
      ].join('|'),
      'g'
    );

    // Expression to match double syllable pre- and suffixes.
    var EXPRESSION_DOUBLE = new RegExp(
      [
        '^' +
          '(?:' +
          [
            'above',
            'anti',
            'ante',
            'counter',
            'hyper',
            'afore',
            'agri',
            'infra',
            'intra',
            'inter',
            'over',
            'semi',
            'ultra',
            'under',
            'extra',
            'dia',
            'micro',
            'mega',
            'kilo',
            'pico',
            'nano',
            'macro',
            'somer'
          ].join('|') +
          ')',
        '(?:' + ['fully', 'berry', 'woman', 'women', 'edly'].join('|') + ')$'
      ].join('|'),
      'g'
    );

    // Expression to match triple syllable suffixes.
    var EXPRESSION_TRIPLE = /(creations?|ology|ologist|onomy|onomist)$/g;

    // Expression to split on word boundaries.
    var SPLIT = /\b/g;

    // Expression to merge elision.
    var APOSTROPHE = /['’]/g;

    // Expression to remove non-alphabetic characters from a given value.
    var EXPRESSION_NONALPHABETIC = /[^a-z]/g;

    // Wrapper to support multiple word-parts (GH-11).
    function syllables(value) {
      var values = normalizeStrings(String(value))
        .toLowerCase()
        .replace(APOSTROPHE, '')
        .split(SPLIT);
      var length = values.length;
      var index = -1;
      var total = 0;

      while (++index < length) {
        total += syllable(values[index].replace(EXPRESSION_NONALPHABETIC, ''));
      }

      return total
    }

    // Get syllables in a given value.
    function syllable(value) {
      var count = 0;
      var index;
      var length;
      var singular;
      var parts;
      var addOne;
      var subtractOne;

      if (value.length === 0) {
        return count
      }

      // Return early when possible.
      if (value.length < 3) {
        return 1
      }

      // If `value` is a hard to count, it might be in `problematic`.
      if (own.call(problematic$2, value)) {
        return problematic$2[value]
      }

      // Additionally, the singular word might be in `problematic`.
      singular = pluralize(value, 1);

      if (own.call(problematic$2, singular)) {
        return problematic$2[singular]
      }

      addOne = returnFactory(1);
      subtractOne = returnFactory(-1);

      // Count some prefixes and suffixes, and remove their matched ranges.
      value = value
        .replace(EXPRESSION_TRIPLE, countFactory(3))
        .replace(EXPRESSION_DOUBLE, countFactory(2))
        .replace(EXPRESSION_SINGLE, countFactory(1));

      // Count multiple consonants.
      parts = value.split(/[^aeiouy]+/);
      index = -1;
      length = parts.length;

      while (++index < length) {
        if (parts[index] !== '') {
          count++;
        }
      }

      // Subtract one for occurrences which should be counted as one (but are
      // counted as two).
      value
        .replace(EXPRESSION_MONOSYLLABIC_ONE, subtractOne)
        .replace(EXPRESSION_MONOSYLLABIC_TWO, subtractOne);

      // Add one for occurrences which should be counted as two (but are counted as
      // one).
      value
        .replace(EXPRESSION_DOUBLE_SYLLABIC_ONE, addOne)
        .replace(EXPRESSION_DOUBLE_SYLLABIC_TWO, addOne)
        .replace(EXPRESSION_DOUBLE_SYLLABIC_THREE, addOne)
        .replace(EXPRESSION_DOUBLE_SYLLABIC_FOUR, addOne);

      // Make sure at least on is returned.
      return count || 1

      // Define scoped counters, to be used in `String#replace()` calls.
      // The scoped counter removes the matched value from the input.
      function countFactory(addition) {
        return counter
        function counter() {
          count += addition;
          return ''
        }
      }

      // Define scoped counters, to be used in `String#replace()` calls.
      // The scoped counter does not remove the matched value from the input.
      function returnFactory(addition) {
        return returner
        function returner($0) {
          count += addition;
          return $0
        }
      }
    }

    var flesch_1 = flesch;

    var sentenceWeight = 1.015;
    var wordWeight = 84.6;
    var base = 206.835;

    function flesch(counts) {
      if (!counts || !counts.sentence || !counts.word || !counts.syllable) {
        return NaN
      }

      return (
        base -
        sentenceWeight * (counts.word / counts.sentence) -
        wordWeight * (counts.syllable / counts.word)
      )
    }

    function countWords(content) {
      content = typeof content === 'string' ? content : '';
      return content.split(/\s+/).filter(el => !!el).length
    }

    function countSentences(content) {
      content = typeof content === 'string' ? content : '';
      return content.split(/[.?!]/).filter(el => !!el).length
    }

    function Calculate(content) {
      const sentences = countSentences(content);
      const words = countWords(content);
      const syllables = syllable_1(content);

      const score = flesch_1({
        word: words,
        sentence: sentences,
        syllable: syllables,
      });

      return (score < 0 ? 0 : score > 100 ? 100 : score).toFixed(1)
    }

    /* src/App.svelte generated by Svelte v3.4.4 */

    const file$1 = "src/App.svelte";

    function add_css$1() {
    	var style = element("style");
    	style.id = 'svelte-pa1i1i-style';
    	style.textContent = ".flesch-gauge__inner-wrap.svelte-pa1i1i{display:inline-block;position:relative}.flesch-gauge__copy.svelte-pa1i1i{position:absolute;left:50%;top:50%;transform:translate(-50%, -50%);font-family:sans-serif;font-weight:bold}.flesch-gauge__copy.svelte-pa1i1i p.svelte-pa1i1i{margin:0;margin-bottom:5px;text-align:center}.flesch-gauge__score.svelte-pa1i1i{font-size:1.4em}.flesch-gauge__rating.svelte-pa1i1i{white-space:nowrap;font-size:0.7em}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXBwLnN2ZWx0ZSIsInNvdXJjZXMiOlsiQXBwLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxuICAgIGltcG9ydCBSaW5nIGZyb20gJy4vUmluZy5zdmVsdGUnXG4gICAgaW1wb3J0IENhbGN1bGF0ZSBmcm9tICcuL2NhbGN1bGF0ZS5qcydcblxuICAgIC8vIGRlZmluZSBwcm9wc1xuICAgIGV4cG9ydCBsZXQgY29sb3IgPSAnJ1xuICAgIGV4cG9ydCBsZXQgY29udGVudCA9ICcnXG5cbiAgICBsZXQgcmF0aW5nID0gJydcbiAgICAkOiBzY29yZSA9IENhbGN1bGF0ZShjb250ZW50KVxuICAgICQ6IHtcbiAgICAgICAgaWYgKGlzTmFOKHNjb3JlKSkge1xuICAgICAgICAgICAgc2NvcmUgPSAwXG4gICAgICAgICAgICByYXRpbmcgPSAnV2FpdGluZy4uLidcbiAgICAgICAgfSBlbHNlIGlmIChzY29yZSA8IDMwKSB7XG4gICAgICAgICAgICByYXRpbmcgPSAnVmVyeSBEaWZmaWN1bHQnXG4gICAgICAgIH0gZWxzZSBpZiAoc2NvcmUgPj0gMzAgJiYgc2NvcmUgPCA1MCkge1xuICAgICAgICAgICAgcmF0aW5nID0gJ0RpZmZpY3VsdCdcbiAgICAgICAgfSBlbHNlIGlmIChzY29yZSA+PSA1MCAmJiBzY29yZSA8IDYwKSB7XG4gICAgICAgICAgICByYXRpbmcgPSAnRmFpcmx5IERpZmZpY3VsdCdcbiAgICAgICAgfSBlbHNlIGlmIChzY29yZSA+PSA2MCAmJiBzY29yZSA8IDcwKSB7XG4gICAgICAgICAgICByYXRpbmcgPSAnUGxhaW4gRW5nbGlzaCdcbiAgICAgICAgfSBlbHNlIGlmIChzY29yZSA+PSA3MCAmJiBzY29yZSA8IDgwKSB7XG4gICAgICAgICAgICByYXRpbmcgPSAnRmFpcmx5IEVhc3knXG4gICAgICAgIH0gZWxzZSBpZiAoc2NvcmUgPj0gODAgJiYgc2NvcmUgPCA5MCkge1xuICAgICAgICAgICAgcmF0aW5nID0gJ0Vhc3knXG4gICAgICAgIH0gZWxzZSBpZiAoc2NvcmUgPj0gOTApIHtcbiAgICAgICAgICAgIHJhdGluZyA9ICdWZXJ5IEVhc3knXG4gICAgICAgIH1cbiAgICB9XG48L3NjcmlwdD5cblxuPHN0eWxlPlxuLmZsZXNjaC1nYXVnZV9faW5uZXItd3JhcCB7XG4gICAgZGlzcGxheTogaW5saW5lLWJsb2NrO1xuICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbn1cbi5mbGVzY2gtZ2F1Z2VfX2NvcHkge1xuICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICBsZWZ0OiA1MCU7XG4gICAgdG9wOiA1MCU7XG4gICAgdHJhbnNmb3JtOiB0cmFuc2xhdGUoLTUwJSwgLTUwJSk7XG4gICAgZm9udC1mYW1pbHk6IHNhbnMtc2VyaWY7XG4gICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG59XG4uZmxlc2NoLWdhdWdlX19jb3B5IHAge1xuICAgIG1hcmdpbjogMDtcbiAgICBtYXJnaW4tYm90dG9tOiA1cHg7XG4gICAgdGV4dC1hbGlnbjogY2VudGVyO1xufVxuXG4uZmxlc2NoLWdhdWdlX19zY29yZSB7XG4gICAgZm9udC1zaXplOiAxLjRlbTtcbn1cbi5mbGVzY2gtZ2F1Z2VfX3JhdGluZyB7XG4gICAgd2hpdGUtc3BhY2U6IG5vd3JhcDs7XG4gICAgZm9udC1zaXplOiAwLjdlbTtcbn1cbjwvc3R5bGU+XG5cbjxkaXYgY2xhc3M9XCJmbGVzY2gtZ2F1Z2VfX2lubmVyLXdyYXBcIj5cbiAgICA8UmluZ1xuICAgICAgICBjb2xvcj17Y29sb3J9XG4gICAgICAgIHBlcmNlbnQ9e3Njb3JlfVxuICAgIC8+XG4gICAgPGRpdiBjbGFzcz1cImZsZXNjaC1nYXVnZV9fY29weVwiPlxuICAgICAgICA8cCBjbGFzcz1cImZsZXNjaC1nYXVnZV9fc2NvcmVcIj57c2NvcmV9PC9wPlxuICAgICAgICA8cCBjbGFzcz1cImZsZXNjaC1nYXVnZV9fcmF0aW5nXCI+e3JhdGluZ308L3A+XG4gICAgPC9kaXY+XG48L2Rpdj4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBaUNBLHlCQUF5QixjQUFDLENBQUMsQUFDdkIsT0FBTyxDQUFFLFlBQVksQ0FDckIsUUFBUSxDQUFFLFFBQVEsQUFDdEIsQ0FBQyxBQUNELG1CQUFtQixjQUFDLENBQUMsQUFDakIsUUFBUSxDQUFFLFFBQVEsQ0FDbEIsSUFBSSxDQUFFLEdBQUcsQ0FDVCxHQUFHLENBQUUsR0FBRyxDQUNSLFNBQVMsQ0FBRSxVQUFVLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUNoQyxXQUFXLENBQUUsVUFBVSxDQUN2QixXQUFXLENBQUUsSUFBSSxBQUNyQixDQUFDLEFBQ0QsaUNBQW1CLENBQUMsQ0FBQyxjQUFDLENBQUMsQUFDbkIsTUFBTSxDQUFFLENBQUMsQ0FDVCxhQUFhLENBQUUsR0FBRyxDQUNsQixVQUFVLENBQUUsTUFBTSxBQUN0QixDQUFDLEFBRUQsb0JBQW9CLGNBQUMsQ0FBQyxBQUNsQixTQUFTLENBQUUsS0FBSyxBQUNwQixDQUFDLEFBQ0QscUJBQXFCLGNBQUMsQ0FBQyxBQUNuQixXQUFXLENBQUUsTUFBTSxDQUNuQixTQUFTLENBQUUsS0FBSyxBQUNwQixDQUFDIn0= */";
    	append(document.head, style);
    }

    function create_fragment$1(ctx) {
    	var div1, t0, div0, p0, t1, t2, p1, t3, current;

    	var ring = new Ring({
    		props: {
    		color: ctx.color,
    		percent: ctx.score
    	},
    		$$inline: true
    	});

    	return {
    		c: function create() {
    			div1 = element("div");
    			ring.$$.fragment.c();
    			t0 = space();
    			div0 = element("div");
    			p0 = element("p");
    			t1 = text(ctx.score);
    			t2 = space();
    			p1 = element("p");
    			t3 = text(ctx.rating);
    			p0.className = "flesch-gauge__score svelte-pa1i1i";
    			add_location(p0, file$1, 66, 8, 1514);
    			p1.className = "flesch-gauge__rating svelte-pa1i1i";
    			add_location(p1, file$1, 67, 8, 1565);
    			div0.className = "flesch-gauge__copy svelte-pa1i1i";
    			add_location(div0, file$1, 65, 4, 1473);
    			div1.className = "flesch-gauge__inner-wrap svelte-pa1i1i";
    			add_location(div1, file$1, 60, 0, 1367);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div1, anchor);
    			mount_component(ring, div1, null);
    			append(div1, t0);
    			append(div1, div0);
    			append(div0, p0);
    			append(p0, t1);
    			append(div0, t2);
    			append(div0, p1);
    			append(p1, t3);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var ring_changes = {};
    			if (changed.color) ring_changes.color = ctx.color;
    			if (changed.score) ring_changes.percent = ctx.score;
    			ring.$set(ring_changes);

    			if (!current || changed.score) {
    				set_data(t1, ctx.score);
    			}

    			if (!current || changed.rating) {
    				set_data(t3, ctx.rating);
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			ring.$$.fragment.i(local);

    			current = true;
    		},

    		o: function outro(local) {
    			ring.$$.fragment.o(local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div1);
    			}

    			ring.$destroy();
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	

        // define props
        let { color = '', content = '' } = $$props;

        let rating = '';

    	const writable_props = ['color', 'content'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ('color' in $$props) $$invalidate('color', color = $$props.color);
    		if ('content' in $$props) $$invalidate('content', content = $$props.content);
    	};

    	let score;

    	$$self.$$.update = ($$dirty = { content: 1, score: 1 }) => {
    		if ($$dirty.content) { $$invalidate('score', score = Calculate(content)); }
    		if ($$dirty.score) { {
                    if (isNaN(score)) {
                        $$invalidate('score', score = 0);
                        $$invalidate('rating', rating = 'Waiting...');
                    } else if (score < 30) {
                        $$invalidate('rating', rating = 'Very Difficult');
                    } else if (score >= 30 && score < 50) {
                        $$invalidate('rating', rating = 'Difficult');
                    } else if (score >= 50 && score < 60) {
                        $$invalidate('rating', rating = 'Fairly Difficult');
                    } else if (score >= 60 && score < 70) {
                        $$invalidate('rating', rating = 'Plain English');
                    } else if (score >= 70 && score < 80) {
                        $$invalidate('rating', rating = 'Fairly Easy');
                    } else if (score >= 80 && score < 90) {
                        $$invalidate('rating', rating = 'Easy');
                    } else if (score >= 90) {
                        $$invalidate('rating', rating = 'Very Easy');
                    }
                } }
    	};

    	return { color, content, rating, score };
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-pa1i1i-style")) add_css$1();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, ["color", "content"]);
    	}

    	get color() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get content() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set content(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    window.FleschGauge = App;

    return App;

}());
//# sourceMappingURL=flesch-gauge.iife.js.map

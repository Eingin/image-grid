
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
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
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function action_destroyer(action_result) {
        return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
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
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    // unfortunately this can't be a constant as that wouldn't be tree-shakeable
    // so we cache the result instead
    let crossorigin;
    function is_crossorigin() {
        if (crossorigin === undefined) {
            crossorigin = false;
            try {
                if (typeof window !== 'undefined' && window.parent) {
                    void window.parent.document;
                }
            }
            catch (error) {
                crossorigin = true;
            }
        }
        return crossorigin;
    }
    function add_resize_listener(node, fn) {
        const computed_style = getComputedStyle(node);
        if (computed_style.position === 'static') {
            node.style.position = 'relative';
        }
        const iframe = element('iframe');
        iframe.setAttribute('style', 'display: block; position: absolute; top: 0; left: 0; width: 100%; height: 100%; ' +
            'overflow: hidden; border: 0; opacity: 0; pointer-events: none; z-index: -1;');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.tabIndex = -1;
        const crossorigin = is_crossorigin();
        let unsubscribe;
        if (crossorigin) {
            iframe.src = "data:text/html,<script>onresize=function(){parent.postMessage(0,'*')}</script>";
            unsubscribe = listen(window, 'message', (event) => {
                if (event.source === iframe.contentWindow)
                    fn();
            });
        }
        else {
            iframe.src = 'about:blank';
            iframe.onload = () => {
                unsubscribe = listen(iframe.contentWindow, 'resize', fn);
            };
        }
        append(node, iframe);
        return () => {
            if (crossorigin) {
                unsubscribe();
            }
            else if (unsubscribe && iframe.contentWindow) {
                unsubscribe();
            }
            detach(iframe);
        };
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function tick() {
        schedule_update();
        return resolved_promise;
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
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
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
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
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.49.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\App.svelte generated by Svelte v3.49.0 */
    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let div4;
    	let h1;
    	let t1;
    	let div0;
    	let t3;
    	let canvas_1;
    	let t4;
    	let input0;
    	let t5;
    	let div3;
    	let div1;
    	let label0;
    	let t7;
    	let input1;
    	let hValidator_action;
    	let t8;
    	let div2;
    	let label1;
    	let t10;
    	let input2;
    	let vValidator_action;
    	let div4_resize_listener;
    	let mounted;
    	let dispose;
    	add_render_callback(/*onwindowresize*/ ctx[10]);

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Image Grid";
    			t1 = space();
    			div0 = element("div");
    			div0.textContent = "Choose Image";
    			t3 = space();
    			canvas_1 = element("canvas");
    			t4 = space();
    			input0 = element("input");
    			t5 = space();
    			div3 = element("div");
    			div1 = element("div");
    			label0 = element("label");
    			label0.textContent = "Horizontal Cells";
    			t7 = space();
    			input1 = element("input");
    			t8 = space();
    			div2 = element("div");
    			label1 = element("label");
    			label1.textContent = "Vertical Cells";
    			t10 = space();
    			input2 = element("input");
    			add_location(h1, file, 116, 2, 2999);
    			attr_dev(div0, "class", "upload svelte-4y847h");
    			add_location(div0, file, 117, 2, 3022);
    			attr_dev(canvas_1, "id", "cv");
    			attr_dev(canvas_1, "class", "svelte-4y847h");
    			add_location(canvas_1, file, 125, 2, 3140);
    			set_style(input0, "display", "none");
    			attr_dev(input0, "type", "file");
    			attr_dev(input0, "accept", ".jpg, .jpeg, .png");
    			add_location(input0, file, 127, 2, 3183);
    			attr_dev(label0, "for", "horizontal");
    			add_location(label0, file, 136, 6, 3391);
    			attr_dev(input1, "name", "horizontal");
    			attr_dev(input1, "type", "number");
    			attr_dev(input1, "min", "1");
    			add_location(input1, file, 137, 6, 3447);
    			add_location(div1, file, 135, 4, 3378);
    			attr_dev(label1, "for", "vertical");
    			add_location(label1, file, 146, 6, 3623);
    			attr_dev(input2, "name", "vertical");
    			attr_dev(input2, "type", "number");
    			attr_dev(input2, "min", "1");
    			add_location(input2, file, 147, 6, 3675);
    			add_location(div2, file, 145, 4, 3610);
    			attr_dev(div3, "class", "input-container svelte-4y847h");
    			add_location(div3, file, 134, 2, 3343);
    			attr_dev(div4, "id", "app");
    			attr_dev(div4, "class", "svelte-4y847h");
    			add_render_callback(() => /*div4_elementresize_handler*/ ctx[17].call(div4));
    			add_location(div4, file, 115, 0, 2929);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, h1);
    			append_dev(div4, t1);
    			append_dev(div4, div0);
    			append_dev(div4, t3);
    			append_dev(div4, canvas_1);
    			/*canvas_1_binding*/ ctx[12](canvas_1);
    			append_dev(div4, t4);
    			append_dev(div4, input0);
    			/*input0_binding*/ ctx[14](input0);
    			append_dev(div4, t5);
    			append_dev(div4, div3);
    			append_dev(div3, div1);
    			append_dev(div1, label0);
    			append_dev(div1, t7);
    			append_dev(div1, input1);
    			set_input_value(input1, /*hCells*/ ctx[4]);
    			append_dev(div3, t8);
    			append_dev(div3, div2);
    			append_dev(div2, label1);
    			append_dev(div2, t10);
    			append_dev(div2, input2);
    			set_input_value(input2, /*vCells*/ ctx[5]);
    			div4_resize_listener = add_resize_listener(div4, /*div4_elementresize_handler*/ ctx[17].bind(div4));

    			if (!mounted) {
    				dispose = [
    					listen_dev(window, "resize", /*dispatchResize*/ ctx[7], false, false, false),
    					listen_dev(window, "resize", /*onwindowresize*/ ctx[10]),
    					listen_dev(div0, "click", /*click_handler*/ ctx[11], false, false, false),
    					listen_dev(input0, "change", /*change_handler*/ ctx[13], false, false, false),
    					action_destroyer(hValidator_action = /*hValidator*/ ctx[8].call(null, input1, /*hCells*/ ctx[4])),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[15]),
    					action_destroyer(vValidator_action = /*vValidator*/ ctx[9].call(null, input2, /*vCells*/ ctx[5])),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[16])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (hValidator_action && is_function(hValidator_action.update) && dirty & /*hCells*/ 16) hValidator_action.update.call(null, /*hCells*/ ctx[4]);

    			if (dirty & /*hCells*/ 16 && to_number(input1.value) !== /*hCells*/ ctx[4]) {
    				set_input_value(input1, /*hCells*/ ctx[4]);
    			}

    			if (vValidator_action && is_function(vValidator_action.update) && dirty & /*vCells*/ 32) vValidator_action.update.call(null, /*vCells*/ ctx[5]);

    			if (dirty & /*vCells*/ 32 && to_number(input2.value) !== /*vCells*/ ctx[5]) {
    				set_input_value(input2, /*vCells*/ ctx[5]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    			/*canvas_1_binding*/ ctx[12](null);
    			/*input0_binding*/ ctx[14](null);
    			div4_resize_listener();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const strokeWidth = 3;

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let image = null;
    	let fileinput, canvas;
    	let width = 1007;
    	let height = 100;
    	let hCells = 5;
    	let vCells = 5;

    	const drawGrid = (shiftX, shiftY, endX, endY) => {
    		const ctx = canvas.getContext("2d");

    		if (hCells > 1) {
    			for (let h = 0; h < hCells + 1; h++) {
    				let imgOffset = (endX - strokeWidth) / hCells * h;
    				ctx.strokeStyle = "red";
    				ctx.lineWidth = strokeWidth;
    				ctx.beginPath();
    				ctx.moveTo(shiftX + imgOffset + strokeWidth / 2, shiftY);
    				ctx.lineTo(shiftX + imgOffset + strokeWidth / 2, endY + shiftY);
    				ctx.stroke();
    			}
    		}

    		if (vCells > 1) {
    			for (let v = 0; v < vCells + 1; v++) {
    				let imgOffset = (endY - strokeWidth) / vCells * v;
    				ctx.strokeStyle = "red";
    				ctx.lineWidth = strokeWidth;
    				ctx.beginPath();
    				ctx.moveTo(shiftX, shiftY + imgOffset + strokeWidth / 2);
    				ctx.lineTo(shiftX + endX, shiftY + imgOffset + strokeWidth / 2);
    				ctx.stroke();
    			}
    		}
    	};

    	onMount(async () => {
    		$$invalidate(1, canvas.width = width, canvas);
    		$$invalidate(1, canvas.height = height, canvas);
    		await tick();
    	});

    	const redraw = () => {
    		if (image === null) {
    			return;
    		}

    		const ctx = canvas.getContext("2d");
    		var hRatio = canvas.width / image.width;
    		var vRatio = canvas.height / image.height;
    		var ratio = Math.min(hRatio, vRatio);
    		var centerShift_x = (canvas.width - image.width * ratio) / 2;
    		var centerShift_y = (canvas.height - image.height * ratio) / 2;
    		let endX = image.width * ratio;
    		let endY = image.height * ratio;
    		ctx.clearRect(0, 0, canvas.width, canvas.height);
    		ctx.drawImage(image, 0, 0, image.width, image.height, centerShift_x, centerShift_y, endX, endY);
    		drawGrid(centerShift_x, centerShift_y, endX, endY);
    	};

    	const onFileSelected = e => {
    		image = new Image();
    		image.onload = redraw.bind(null);
    		image.src = URL.createObjectURL(e.target.files[0]);
    	};

    	const dispatchResize = () => {
    		$$invalidate(1, canvas.width = width, canvas);
    		$$invalidate(1, canvas.height = height, canvas);
    		redraw();
    	};

    	let phCells = hCells;
    	let pvCells = vCells;

    	function hValidator(node, value) {
    		return {
    			update(value) {
    				$$invalidate(4, hCells = value === null || hCells < node.min
    				? phCells
    				: parseInt(value));

    				phCells = hCells;
    				redraw();
    			}
    		};
    	}

    	function vValidator(node, value) {
    		return {
    			update(value) {
    				$$invalidate(5, vCells = value === null || vCells < node.min
    				? pvCells
    				: parseInt(value));

    				pvCells = vCells;
    				redraw();
    			}
    		};
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function onwindowresize() {
    		$$invalidate(2, width = window.innerWidth);
    		$$invalidate(3, height = window.innerHeight);
    	}

    	const click_handler = () => {
    		fileinput.click();
    	};

    	function canvas_1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			canvas = $$value;
    			$$invalidate(1, canvas);
    		});
    	}

    	const change_handler = e => onFileSelected(e);

    	function input0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			fileinput = $$value;
    			$$invalidate(0, fileinput);
    		});
    	}

    	function input1_input_handler() {
    		hCells = to_number(this.value);
    		$$invalidate(4, hCells);
    	}

    	function input2_input_handler() {
    		vCells = to_number(this.value);
    		$$invalidate(5, vCells);
    	}

    	function div4_elementresize_handler() {
    		width = this.clientWidth;
    		height = this.clientHeight;
    		$$invalidate(2, width);
    		$$invalidate(3, height);
    	}

    	$$self.$capture_state = () => ({
    		onMount,
    		tick,
    		image,
    		fileinput,
    		canvas,
    		width,
    		height,
    		hCells,
    		vCells,
    		strokeWidth,
    		drawGrid,
    		redraw,
    		onFileSelected,
    		dispatchResize,
    		phCells,
    		pvCells,
    		hValidator,
    		vValidator
    	});

    	$$self.$inject_state = $$props => {
    		if ('image' in $$props) image = $$props.image;
    		if ('fileinput' in $$props) $$invalidate(0, fileinput = $$props.fileinput);
    		if ('canvas' in $$props) $$invalidate(1, canvas = $$props.canvas);
    		if ('width' in $$props) $$invalidate(2, width = $$props.width);
    		if ('height' in $$props) $$invalidate(3, height = $$props.height);
    		if ('hCells' in $$props) $$invalidate(4, hCells = $$props.hCells);
    		if ('vCells' in $$props) $$invalidate(5, vCells = $$props.vCells);
    		if ('phCells' in $$props) phCells = $$props.phCells;
    		if ('pvCells' in $$props) pvCells = $$props.pvCells;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		fileinput,
    		canvas,
    		width,
    		height,
    		hCells,
    		vCells,
    		onFileSelected,
    		dispatchResize,
    		hValidator,
    		vValidator,
    		onwindowresize,
    		click_handler,
    		canvas_1_binding,
    		change_handler,
    		input0_binding,
    		input1_input_handler,
    		input2_input_handler,
    		div4_elementresize_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map

/* @ds-bundle: {"format":4,"namespace":"Violet","components":[{"name":"Button"},{"name":"IconButton"},{"name":"TextField"},{"name":"TextArea"},{"name":"Select"},{"name":"PhoneField"},{"name":"PasswordField"},{"name":"SearchField"},{"name":"NumberField"},{"name":"DateField"},{"name":"Checkbox"},{"name":"Switch"},{"name":"Avatar"},{"name":"AvatarGroup"},{"name":"TabItem"},{"name":"TabGroup"},{"name":"ListItem"},{"name":"Chip"},{"name":"Radio"},{"name":"Table"},{"name":"TableHeaderCell"},{"name":"TableCell"},{"name":"Pagination"},{"name":"SegmentedControl"},{"name":"ProgressBar"},{"name":"Slider"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;
  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }
  function omit(o, keys) { var r = {}; for (var k in o) if (keys.indexOf(k) < 0) r[k] = o[k]; return r; }
  var seq = 0;
  function useAutoId(prefix) { return React.useState(function () { seq += 1; return 'vi-' + prefix + '-' + seq; })[0]; }
  function useIdFor(p, prefix) { var a = useAutoId(prefix); return p.id || a; }
  // Controlled-or-uncontrolled value.
  function useControlled(value, defaultValue) {
    var st = React.useState(defaultValue);
    var isCtl = value !== undefined;
    return [isCtl ? value : st[0], function (v) { if (!isCtl) st[1](v); }];
  }

  // Built-in glyphs (20px, currentColor)
  function svg(children, extra) {
    return h.apply(null, ['svg', Object.assign({ viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true', focusable: 'false' }, extra || {})].concat(children));
  }
  var G = {
    chevron: function () { return svg([h('path', { key: 1, d: 'M5.5 8l4.5 4.5L14.5 8' })]); },
    check: function () { return svg([h('path', { key: 1, d: 'M4.5 10.5l3.5 3.5 7.5-8' })]); },
    checkSm: function () { return svg([h('path', { key: 1, d: 'M5 10.5l3 3 7-7.5' })], { strokeWidth: 2.25 }); },
    dash: function () { return svg([h('path', { key: 1, d: 'M5.5 10h9' })], { strokeWidth: 2.25 }); },
    eye: function () { return svg([h('path', { key: 1, d: 'M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z' }), h('circle', { key: 2, cx: 10, cy: 10, r: 2.5 })]); },
    eyeOff: function () { return svg([h('path', { key: 1, d: 'M8.2 4.7A8.6 8.6 0 0 1 10 4.5c5 0 8 5.5 8 5.5a14 14 0 0 1-2.2 2.8M12.1 12.1A2.5 2.5 0 0 1 7.9 7.9M5.4 5.9C3.3 7.4 2 10 2 10s3 5.5 8 5.5c1.6 0 3-.5 4.2-1.3M3 3l14 14' })]); },
    search: function () { return svg([h('circle', { key: 1, cx: 9, cy: 9, r: 5.5 }), h('path', { key: 2, d: 'M13 13l4 4' })]); },
    close: function () { return svg([h('path', { key: 1, d: 'M5.5 5.5l9 9M14.5 5.5l-9 9' })]); },
    plus: function () { return svg([h('path', { key: 1, d: 'M10 4.5v11M4.5 10h11' })]); },
    minus: function () { return svg([h('path', { key: 1, d: 'M4.5 10h11' })]); },
    sort: function () { return svg([h('path', { key: 1, d: 'M6.5 15.5v-11M3.5 7.5l3-3 3 3M13.5 4.5v11M10.5 12.5l3 3 3-3' })]); },
    sortUp: function () { return svg([h('path', { key: 1, d: 'M10 15.5v-11M6 8.5l4-4 4 4' })]); },
    sortDown: function () { return svg([h('path', { key: 1, d: 'M10 4.5v11M6 11.5l4 4 4-4' })]); },
    chevLeft: function () { return svg([h('path', { key: 1, d: 'M12 5l-5 5 5 5' })]); },
    chevRight: function () { return svg([h('path', { key: 1, d: 'M8 5l5 5-5 5' })]); },
    calendar: function () { return svg([h('rect', { key: 1, x: 3, y: 4.5, width: 14, height: 12.5, rx: 2 }), h('path', { key: 2, d: 'M3 8.5h14M7 2.5v3M13 2.5v3' })]); }
  };

  /* ---------------- Actions ---------------- */
  var VARIANTS = ['primary', 'secondary', 'outline', 'ghost'];

  function Button(props) {
    var variant = VARIANTS.indexOf(props.variant) >= 0 ? props.variant : 'primary';
    var rest = omit(props, ['variant', 'iconStart', 'iconEnd', 'className', 'children', 'type']);
    return h('button', Object.assign({}, rest, {
      type: props.type || 'button',
      className: cx('vi-btn', 'vi-btn--' + variant, props.className)
    }),
      props.iconStart ? h('span', { className: 'vi-btn__icon', 'aria-hidden': 'true' }, props.iconStart) : null,
      props.children != null ? h('span', { className: 'vi-btn__label' }, props.children) : null,
      props.iconEnd ? h('span', { className: 'vi-btn__icon', 'aria-hidden': 'true' }, props.iconEnd) : null
    );
  }

  function IconButton(props) {
    var rest = omit(props, ['icon', 'selected', 'className', 'type']);
    var a = { type: props.type || 'button', className: cx('vi-icon-btn', props.className) };
    if (props.selected != null) a['aria-pressed'] = props.selected ? 'true' : 'false';
    return h('button', Object.assign({}, rest, a),
      h('span', { className: 'vi-btn__icon', 'aria-hidden': 'true' }, props.icon));
  }

  /* ---------------- Field shell (label, box, hint) shared by every input ---------------- */
  var SHELL_KEYS = ['label', 'hint', 'status', 'variant', 'iconStart', 'iconEnd', 'className', 'id', 'data-force', 'counter', 'required'];
  function statusOf(p) { return p.status === 'error' || p.status === 'success' ? p.status : 'default'; }
  function a11y(p, id) {
    return { id: id, 'aria-invalid': statusOf(p) === 'error' ? 'true' : undefined, 'aria-describedby': p.hint != null ? id + '-hint' : undefined };
  }
  function Shell(p, id, boxChildren, opts) {
    opts = opts || {};
    var status = statusOf(p);
    var foot = p.hint != null || p.counter != null;
    return h('div', {
      className: cx('vi-field', 'vi-field--' + (p.variant === 'outline' ? 'outline' : 'filled'), status !== 'default' && 'vi-field--' + status,
        p.disabled && 'is-disabled', p.readOnly && 'is-readonly', opts.className, p.className),
      'data-force': p['data-force']
    },
      p.label != null ? h(opts.labelTag || 'label', { className: 'vi-field__label', htmlFor: opts.labelTag ? undefined : (opts.labelFor || id), id: id + '-label' }, p.label, p.required ? h('span', { className: 'vi-req', title: 'Required' }, '*') : null) : null,
      h('div', { className: cx('vi-field__box', opts.boxClass), ref: opts.boxRef }, boxChildren),
      foot ? h('div', { className: 'vi-field__foot' },
        p.hint != null ? h('p', { className: 'vi-field__hint', id: id + '-hint' }, p.hint) : h('span'),
        p.counter != null ? h('span', { className: 'vi-field__count', 'aria-live': 'polite' }, p.counter) : null) : null,
      opts.after || null
    );
  }
  function icon(node) { return node ? h('span', { className: 'vi-field__icon', 'aria-hidden': 'true' }, node) : null; }
  function Action(p) {
    return h('button', Object.assign({ type: 'button', className: 'vi-field__action', tabIndex: p.tabIndex }, omit(p, ['children', 'tabIndex'])), p.children);
  }

  function TextField(props) {
    var id = useIdFor(props, 'field');
    var rest = omit(props, SHELL_KEYS.concat(['type']));
    var input = h('input', Object.assign({}, rest, a11y(props, id), { type: props.type || 'text', className: 'vi-field__input' }));
    return Shell(props, id, [h(React.Fragment, { key: 'k' }, icon(props.iconStart), input, icon(props.iconEnd))]);
  }

  function TextArea(props) {
    var id = useIdFor(props, 'area');
    var val = useControlled(props.value, props.defaultValue || '');
    var rest = omit(props, SHELL_KEYS.concat(['value', 'defaultValue', 'onChange', 'rows', 'showCount']));
    var counter = props.showCount && props.maxLength ? String(val[0] || '').length + ' / ' + props.maxLength : null;
    var ta = h('textarea', Object.assign({}, rest, a11y(props, id), {
      className: 'vi-field__input vi-field__textarea', rows: props.rows || 4, value: val[0],
      onChange: function (e) { val[1](e.target.value); if (props.onChange) props.onChange(e); }
    }));
    /* Keyed like every other field's box children, so React does not warn on the array. */
    return Shell(Object.assign({}, props, { counter: counter }), id, [h(React.Fragment, { key: 'k' }, ta)], { boxClass: 'vi-field__box--multi' });
  }

  function normOptions(opts) {
    return (opts || []).map(function (o) { return typeof o === 'string' ? { value: o, label: o } : o; });
  }
  function Select(props) {
    var id = useIdFor(props, 'select');
    var options = normOptions(props.options);
    var val = useControlled(props.value, props.defaultValue);
    var openSt = React.useState(!!props.defaultOpen), open = openSt[0], setOpen = openSt[1];
    var actSt = React.useState(-1), active = actSt[0], setActive = actSt[1];
    var boxRef = React.useRef(null), listRef = React.useRef(null);
    var selIndex = options.findIndex(function (o) { return o.value === val[0]; });
    var selected = options[selIndex];
    function enabledFrom(i, dir) {
      for (var n = 0; n < options.length; n++) { var k = (i + dir * n + options.length) % options.length; if (!options[k].disabled) return k; }
      return -1;
    }
    function openList(i) { if (props.disabled || props.readOnly) return; setOpen(true); setActive(i != null ? i : (selIndex >= 0 ? selIndex : enabledFrom(0, 1))); }
    function choose(i) {
      var o = options[i]; if (!o || o.disabled) return;
      val[1](o.value); if (props.onChange) props.onChange(o.value, o);
      setOpen(false);
    }
    React.useEffect(function () {
      if (!open) return;
      function onDoc(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); }
      document.addEventListener('mousedown', onDoc);
      return function () { document.removeEventListener('mousedown', onDoc); };
    }, [open]);
    React.useEffect(function () {
      if (open && listRef.current && active >= 0) { var el = listRef.current.children[active]; if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); }
    }, [open, active]);
    function onKey(e) {
      var k = e.key;
      if (!open) {
        if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ') { e.preventDefault(); openList(); }
        return;
      }
      if (k === 'ArrowDown') { e.preventDefault(); setActive(enabledFrom(active + 1, 1)); }
      else if (k === 'ArrowUp') { e.preventDefault(); setActive(enabledFrom(active - 1, -1)); }
      else if (k === 'Home') { e.preventDefault(); setActive(enabledFrom(0, 1)); }
      else if (k === 'End') { e.preventDefault(); setActive(enabledFrom(options.length - 1, -1)); }
      else if (k === 'Enter' || k === ' ') { e.preventDefault(); choose(active); }
      else if (k === 'Escape') { e.preventDefault(); setOpen(false); }
      else if (k === 'Tab') { setOpen(false); }
    }
    var listId = id + '-list';
    var trigger = h('button', Object.assign(a11y(props, id), {
      type: 'button', role: 'combobox', className: cx('vi-field__input', 'vi-select__trigger', !selected && 'is-placeholder'),
      'aria-haspopup': 'listbox', 'aria-expanded': open ? 'true' : 'false', 'aria-controls': listId,
      'aria-labelledby': props.label != null ? id + '-label ' + id : undefined, 'aria-label': props['aria-label'],
      'aria-activedescendant': open && active >= 0 ? listId + '-' + active : undefined,
      disabled: props.disabled, name: props.name,
      onClick: function () { open ? setOpen(false) : openList(); }, onKeyDown: onKey
    }), selected ? selected.label : (props.placeholder || 'Select'));
    var list = open ? h('ul', { className: 'vi-menu', role: 'listbox', id: listId, ref: listRef, 'aria-labelledby': props.label != null ? id + '-label' : undefined },
      options.map(function (o, i) {
        return h('li', {
          key: o.value, id: listId + '-' + i, role: 'option', 'aria-selected': o.value === val[0] ? 'true' : 'false', 'aria-disabled': o.disabled ? 'true' : undefined,
          className: cx('vi-menu__item', i === active && 'is-active'),
          onMouseEnter: function () { if (!o.disabled) setActive(i); },
          onMouseDown: function (e) { e.preventDefault(); },
          onClick: function () { choose(i); }
        }, h('span', { className: 'vi-menu__label' }, o.label), o.value === val[0] ? h('span', { className: 'vi-menu__check' }, G.check()) : null);
      })) : null;
    return Shell(props, id, [h(React.Fragment, { key: 'k' }, icon(props.iconStart), trigger,
      h('span', { className: cx('vi-field__icon', 'vi-select__chevron', open && 'is-open'), 'aria-hidden': 'true' }, G.chevron()), list)],
      { className: cx('vi-select', open && 'is-open'), labelFor: id, boxRef: boxRef });
  }

  var COUNTRIES = [
    { code: 'IN', dial: '+91', name: 'India' }, { code: 'US', dial: '+1', name: 'United States' },
    { code: 'GB', dial: '+44', name: 'United Kingdom' }, { code: 'AE', dial: '+971', name: 'United Arab Emirates' },
    { code: 'SG', dial: '+65', name: 'Singapore' }, { code: 'AU', dial: '+61', name: 'Australia' },
    { code: 'CA', dial: '+1', name: 'Canada' }, { code: 'DE', dial: '+49', name: 'Germany' }
  ];
  function PhoneField(props) {
    var id = useIdFor(props, 'phone');
    var list = props.countries || COUNTRIES;
    var c = useControlled(props.country, props.defaultCountry || list[0].code);
    var cur = list.find(function (x) { return x.code === c[0]; }) || list[0];
    var rest = omit(props, SHELL_KEYS.concat(['countries', 'country', 'defaultCountry', 'onCountryChange']));
    var picker = h('span', { className: 'vi-phone__country' },
      h('span', { className: 'vi-phone__code' }, cur.code), h('span', { className: 'vi-phone__dial' }, cur.dial),
      h('span', { className: 'vi-field__icon vi-phone__chev', 'aria-hidden': 'true' }, G.chevron()),
      h('select', {
        className: 'vi-phone__select', 'aria-label': 'Country code', value: cur.code, disabled: props.disabled || props.readOnly,
        onChange: function (e) { c[1](e.target.value); if (props.onCountryChange) props.onCountryChange(e.target.value); }
      }, list.map(function (x) { return h('option', { key: x.code, value: x.code }, x.name + ' (' + x.dial + ')'); })));
    var input = h('input', Object.assign({ autoComplete: 'tel-national', inputMode: 'tel' }, rest, a11y(props, id), { type: 'tel', className: 'vi-field__input' }));
    return Shell(props, id, [h(React.Fragment, { key: 'k' }, picker, h('span', { className: 'vi-phone__divider', 'aria-hidden': 'true' }), input)], { className: 'vi-phone' });
  }

  function PasswordField(props) {
    var id = useIdFor(props, 'pw');
    var vis = React.useState(!!props.defaultVisible), shown = vis[0];
    var rest = omit(props, SHELL_KEYS.concat(['type', 'defaultVisible']));
    var input = h('input', Object.assign({ autoComplete: 'current-password' }, rest, a11y(props, id), { type: shown ? 'text' : 'password', className: 'vi-field__input' }));
    var toggle = h(Action, { 'aria-label': shown ? 'Hide password' : 'Show password', 'aria-pressed': shown ? 'true' : 'false', disabled: props.disabled, onClick: function () { vis[1](!shown); } }, shown ? G.eyeOff() : G.eye());
    return Shell(props, id, [h(React.Fragment, { key: 'k' }, icon(props.iconStart), input, toggle)]);
  }

  function SearchField(props) {
    var id = useIdFor(props, 'search');
    var val = useControlled(props.value, props.defaultValue || '');
    var ref = React.useRef(null);
    var rest = omit(props, SHELL_KEYS.concat(['type', 'value', 'defaultValue', 'onChange', 'onClear']));
    var input = h('input', Object.assign({ placeholder: 'Search' }, rest, a11y(props, id), {
      type: 'search', className: 'vi-field__input', ref: ref, value: val[0],
      onChange: function (e) { val[1](e.target.value); if (props.onChange) props.onChange(e); },
      onKeyDown: function (e) { if (e.key === 'Escape' && val[0]) { val[1](''); if (props.onClear) props.onClear(); } if (props.onKeyDown) props.onKeyDown(e); }
    }));
    var clear = val[0] && !props.disabled && !props.readOnly ? h(Action, { 'aria-label': 'Clear search', onClick: function () { val[1](''); if (props.onClear) props.onClear(); if (ref.current) ref.current.focus(); } }, G.close()) : null;
    return Shell(props, id, [h(React.Fragment, { key: 'k' }, icon(props.iconStart === undefined ? G.search() : props.iconStart), input, clear)], { className: 'vi-search' });
  }

  function NumberField(props) {
    var id = useIdFor(props, 'num');
    var step = props.step || 1, min = props.min, max = props.max;
    var val = useControlled(props.value, props.defaultValue != null ? props.defaultValue : '');
    function set(n) {
      if (min != null) n = Math.max(min, n); if (max != null) n = Math.min(max, n);
      n = Math.round(n * 1e6) / 1e6; val[1](n); if (props.onValueChange) props.onValueChange(n);
    }
    var num = val[0] === '' || val[0] == null ? null : Number(val[0]);
    var rest = omit(props, SHELL_KEYS.concat(['type', 'value', 'defaultValue', 'onChange', 'onValueChange']));
    var input = h('input', Object.assign({ inputMode: 'decimal' }, rest, a11y(props, id), {
      type: 'number', className: 'vi-field__input vi-number__input', value: val[0],
      onChange: function (e) { var v = e.target.value; val[1](v); if (props.onChange) props.onChange(e); if (v !== '' && props.onValueChange) props.onValueChange(Number(v)); }
    }));
    var off = props.disabled || props.readOnly;
    return Shell(props, id, [h(React.Fragment, { key: 'k' }, icon(props.iconStart), input,
      h('span', { className: 'vi-number__steps' },
        h(Action, { 'aria-label': 'Decrease', tabIndex: -1, disabled: off || (min != null && num != null && num <= min), onClick: function () { set((num || 0) - step); } }, G.minus()),
        h(Action, { 'aria-label': 'Increase', tabIndex: -1, disabled: off || (max != null && num != null && num >= max), onClick: function () { set((num || 0) + step); } }, G.plus())))]);
  }

  function DateField(props) {
    return h(TextField, Object.assign({}, props, { type: props.type === 'datetime-local' || props.type === 'time' || props.type === 'month' ? props.type : 'date', className: cx('vi-date', props.className) }));
  }

  /* ---------------- Selection controls ---------------- */
  function Checkbox(props) {
    var ref = React.useRef(null);
    var id = useIdFor(props, 'check');
    React.useEffect(function () { if (ref.current) ref.current.indeterminate = !!props.indeterminate; }, [props.indeterminate]);
    var status = props.status === 'error' ? 'error' : 'default';
    var rest = omit(props, ['label', 'description', 'indeterminate', 'status', 'variant', 'className', 'id', 'data-force', 'type']);
    return h('label', {
      className: cx('vi-check', props.variant === 'card' && 'vi-check--card', props.indeterminate && 'is-indeterminate', status === 'error' && 'vi-check--error', props.disabled && 'is-disabled', props.className),
      htmlFor: id, 'data-force': props['data-force']
    },
      h('span', { className: 'vi-check__control' },
        h('input', Object.assign({}, rest, {
          id: id, ref: ref, type: 'checkbox', className: 'vi-check__input',
          'aria-invalid': status === 'error' ? 'true' : undefined, 'aria-checked': props.indeterminate ? 'mixed' : undefined,
          'aria-describedby': props.description != null ? id + '-desc' : undefined
        })),
        h('span', { className: 'vi-check__box', 'aria-hidden': 'true' },
          h('span', { className: 'vi-check__mark' }, G.checkSm()), h('span', { className: 'vi-check__dash' }, G.dash()))),
      props.label != null || props.description != null ? h('span', { className: 'vi-check__text' },
        props.label != null ? h('span', { className: 'vi-check__label' }, props.label) : null,
        props.description != null ? h('span', { className: 'vi-check__desc', id: id + '-desc' }, props.description) : null) : null
    );
  }

  function Switch(props) {
    var id = useIdFor(props, 'switch');
    var rest = omit(props, ['label', 'description', 'size', 'labelPosition', 'className', 'id', 'data-force', 'type']);
    var text = props.label != null || props.description != null ? h('span', { className: 'vi-switch__text' },
      props.label != null ? h('span', { className: 'vi-switch__label' }, props.label) : null,
      props.description != null ? h('span', { className: 'vi-switch__desc', id: id + '-desc' }, props.description) : null) : null;
    var control = h('span', { className: 'vi-switch__control' },
      h('input', Object.assign({}, rest, { id: id, type: 'checkbox', role: 'switch', className: 'vi-switch__input', 'aria-describedby': props.description != null ? id + '-desc' : undefined })),
      h('span', { className: 'vi-switch__track', 'aria-hidden': 'true' }, h('span', { className: 'vi-switch__thumb' })));
    var start = props.labelPosition === 'start';
    return h('label', {
      className: cx('vi-switch', props.size === 'sm' ? 'vi-switch--sm' : 'vi-switch--md', start && 'vi-switch--start', props.disabled && 'is-disabled', props.className),
      htmlFor: id, 'data-force': props['data-force']
    }, start ? text : control, start ? control : text);
  }

  /* ---------------- Avatar ---------------- */
  var AV_SIZES = { xs: 24, sm: 32, md: 40, lg: 48, xl: 64 };
  var AV_TONES = ['primary', 'info', 'success', 'warning', 'neutral'];
  var STATUS_TEXT = { online: 'online', busy: 'busy', away: 'away', offline: 'offline' };
  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '';
    var a = parts[0].charAt(0), z = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
    return (a + z).toUpperCase();
  }
  function toneFor(name) {
    var s = String(name || ''), n = 0;
    for (var i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
    return AV_TONES[n % AV_TONES.length];
  }
  var personGlyph = function () { return svg([h('circle', { key: 1, cx: 10, cy: 7, r: 3.25 }), h('path', { key: 2, d: 'M3.75 16.5c.8-3 3.3-4.75 6.25-4.75s5.45 1.75 6.25 4.75' })]); };

  function Avatar(props) {
    var size = AV_SIZES[props.size] ? props.size : 'md';
    var failed = React.useState(false);
    React.useEffect(function () { failed[1](false); }, [props.src]);
    var kind = props.src && !failed[0] ? 'image' : (props.name && !props.icon ? 'monogram' : 'icon');
    if (props.src && failed[0]) kind = props.name ? 'monogram' : 'icon';
    var tone = AV_TONES.indexOf(props.tone) >= 0 ? props.tone : toneFor(props.name);
    var label = [props.name || props.alt, props.status && STATUS_TEXT[props.status]].filter(Boolean).join(', ') || undefined;
    var rest = omit(props, ['src', 'alt', 'name', 'icon', 'size', 'shape', 'tone', 'status', 'className', 'style']);
    var inner;
    if (kind === 'image') inner = h('img', { className: 'vi-avatar__img', src: props.src, alt: '', draggable: false, onError: function () { failed[1](true); } });
    else if (kind === 'monogram') inner = h('span', { className: 'vi-avatar__text', 'aria-hidden': 'true' }, initials(props.name));
    else inner = h('span', { className: 'vi-avatar__icon', 'aria-hidden': 'true' }, props.icon || personGlyph());
    return h('span', Object.assign({ role: 'img', 'aria-label': label }, rest, {
      className: cx('vi-avatar', 'vi-avatar--' + size, props.shape === 'square' && 'vi-avatar--square', 'vi-avatar--' + kind, kind === 'monogram' && 'vi-avatar--tone-' + tone, props.className),
      style: props.style
    }),
      h('span', { className: 'vi-avatar__face' }, inner),
      props.status && STATUS_TEXT[props.status] ? h('span', { className: 'vi-avatar__status vi-avatar__status--' + props.status, 'aria-hidden': 'true' }) : null);
  }

  function AvatarGroup(props) {
    var size = AV_SIZES[props.size] ? props.size : 'md';
    var list = props.avatars || [];
    var max = props.max != null ? Math.max(1, props.max) : 4;
    var shown = list.length > max ? list.slice(0, max - 1) : list;
    var hidden = list.slice(shown.length);
    var names = hidden.map(function (a) { return a.name || a.alt; }).filter(Boolean);
    var overflowLabel = hidden.length + ' more' + (names.length ? ': ' + names.join(', ') : '');
    var items = shown.map(function (a, i) {
      return h('li', { key: a.id || a.name || i, className: 'vi-avatar-group__item', style: { zIndex: props.stack === 'last-on-top' ? i + 1 : shown.length - i } },
        h(Avatar, Object.assign({}, a, { size: size, shape: props.shape })));
    });
    if (hidden.length) {
      var more = h('span', { className: cx('vi-avatar', 'vi-avatar--' + size, props.shape === 'square' && 'vi-avatar--square', 'vi-avatar--overflow') },
        h('span', { className: 'vi-avatar__face' }, h('span', { className: 'vi-avatar__text' }, '+' + hidden.length)));
      items.push(h('li', { key: '__more', className: 'vi-avatar-group__item', style: { zIndex: 0 } },
        props.onOverflowClick
          ? h('button', { type: 'button', className: 'vi-avatar-group__more', 'aria-label': overflowLabel, title: names.join(', '), onClick: props.onOverflowClick }, more)
          : h('span', { role: 'img', 'aria-label': overflowLabel, title: names.join(', ') }, more)));
    }
    return h('ul', {
      className: cx('vi-avatar-group', 'vi-avatar-group--' + size, props.spacing === 'spaced' && 'vi-avatar-group--spaced', props.className),
      'aria-label': props['aria-label'] || (list.length + ' people')
    }, items);
  }

  /* ---------------- Tabs ---------------- */
  function TabItem(props) {
    var variant = props.variant === 'pill' ? 'pill' : 'underline';
    var rest = omit(props, ['variant', 'selected', 'icon', 'count', 'className', 'children', 'type', 'tabRef']);
    return h('button', Object.assign({ role: 'tab', tabIndex: props.selected ? 0 : -1 }, rest, {
      type: 'button', ref: props.tabRef,
      'aria-selected': props.selected ? 'true' : 'false',
      className: cx('vi-tab', 'vi-tab--' + variant, props.selected && 'is-selected', props.className)
    }),
      props.icon ? h('span', { className: 'vi-tab__icon', 'aria-hidden': 'true' }, props.icon) : null,
      h('span', { className: 'vi-tab__label' }, props.children),
      props.count != null ? h('span', { className: 'vi-tab__count' }, props.count) : null);
  }

  function TabGroup(props) {
    var id = useIdFor(props, 'tabs');
    var items = normOptions(props.items);
    var first = items.find(function (t) { return !t.disabled; });
    var val = useControlled(props.value, props.defaultValue != null ? props.defaultValue : first && first.value);
    var refs = React.useRef({});
    var variant = props.variant === 'pill' ? 'pill' : 'underline';
    function pick(v) { val[1](v); if (props.onChange) props.onChange(v); }
    function move(from, dir) {
      var n = items.length;
      for (var k = 1; k <= n; k++) {
        var i = dir === 'first' ? k - 1 : dir === 'last' ? n - k : (from + dir * k + n * k) % n;
        if (!items[i].disabled) { pick(items[i].value); var el = refs.current[items[i].value]; if (el) el.focus(); return; }
      }
    }
    function onKey(e) {
      var i = items.findIndex(function (t) { return t.value === val[0]; });
      var k = e.key, horiz = true;
      if (k === 'ArrowRight' || k === 'ArrowLeft') { e.preventDefault(); move(i, k === 'ArrowRight' ? 1 : -1); }
      else if (k === 'Home') { e.preventDefault(); move(i, 'first'); }
      else if (k === 'End') { e.preventDefault(); move(i, 'last'); }
    }
    var list = h('div', {
      role: 'tablist', 'aria-label': props['aria-label'], onKeyDown: onKey,
      className: cx('vi-tabs', 'vi-tabs--' + variant, props.divider && 'vi-tabs--divider', props.fullWidth && 'vi-tabs--full', props.className)
    }, items.map(function (t) {
      return h(TabItem, {
        key: t.value, id: id + '-tab-' + t.value, variant: variant, selected: t.value === val[0], disabled: t.disabled,
        icon: t.icon, count: t.count, 'aria-controls': props.renderPanel ? id + '-panel-' + t.value : undefined,
        tabRef: function (el) { refs.current[t.value] = el; },
        onClick: function () { pick(t.value); }
      }, t.label);
    }));
    if (!props.renderPanel) return list;
    return h('div', { className: 'vi-tabgroup' }, list,
      h('div', { role: 'tabpanel', id: id + '-panel-' + val[0], 'aria-labelledby': id + '-tab-' + val[0], tabIndex: 0, className: 'vi-tabpanel' }, props.renderPanel(val[0])));
  }

  /* ---------------- ListItem ---------------- */
  function ListItem(props) {
    var tone = ['neutral', 'primary', 'error'].indexOf(props.badgeTone) >= 0 ? props.badgeTone : 'neutral';
    var collapsed = !!props.collapsed;
    var tag = props.href && !props.disabled ? 'a' : 'button';
    var rest = omit(props, ['icon', 'trailingIcon', 'badge', 'badgeTone', 'selected', 'collapsed', 'className', 'children', 'type', 'href', 'current']);
    var label = typeof props.children === 'string' ? props.children : undefined;
    var a = {
      className: cx('vi-list-item', props.selected && 'is-selected', collapsed && 'vi-list-item--collapsed', props.disabled && 'is-disabled', props.className),
      'aria-current': props.selected ? (props.current || 'page') : undefined,
      'aria-label': collapsed ? (props['aria-label'] || label) : props['aria-label'],
      title: collapsed ? (props.title || label) : props.title
    };
    if (tag === 'a') { a.href = props.href; } else { a.type = props.type || 'button'; }
    if (tag === 'a' && props.disabled) a['aria-disabled'] = 'true';
    return h(tag, Object.assign({}, rest, a),
      props.icon ? h('span', { className: 'vi-list-item__icon', 'aria-hidden': 'true' }, props.icon) : null,
      !collapsed ? h('span', { className: 'vi-list-item__label' }, props.children) : null,
      !collapsed && props.badge != null ? h('span', { className: 'vi-list-item__badge vi-list-item__badge--' + tone }, props.badge) : null,
      !collapsed && props.trailingIcon ? h('span', { className: 'vi-list-item__icon vi-list-item__trail', 'aria-hidden': 'true' }, props.trailingIcon) : null,
      collapsed && props.badge != null ? h('span', { className: 'vi-list-item__dot vi-list-item__dot--' + tone, 'aria-hidden': 'true' }) : null);
  }

  /* ---------------- Chip / Tag ---------------- */
  var CHIP_TONES = ['neutral', 'primary', 'info', 'success', 'warning', 'error'];
  function Chip(props) {
    var tone = CHIP_TONES.indexOf(props.tone) >= 0 ? props.tone : 'neutral';
    var variant = props.variant === 'soft' || props.variant === 'solid' ? props.variant : 'outline';
    var size = props.size === 'sm' ? 'sm' : 'md';
    var interactive = !!(props.onClick || props.selected != null);
    var label = typeof props.children === 'string' ? props.children : '';
    var rest = omit(props, ['tone', 'variant', 'size', 'shape', 'icon', 'trailingIcon', 'badge', 'dot', 'avatar', 'selected', 'onRemove', 'removeLabel', 'className', 'children', 'type', 'data-force']);
    var cls = cx('vi-chip', 'vi-chip--' + size, 'vi-chip--' + variant, 'vi-chip--tone-' + tone, props.shape === 'tag' && 'vi-chip--tag',
      interactive && 'is-interactive', props.selected && 'is-selected', props.disabled && 'is-disabled', props.avatar && 'has-avatar', props.onRemove && 'has-remove', props.className);
    var body = [
      props.avatar ? h('span', { key: 'av', className: 'vi-chip__avatar' }, h(Avatar, Object.assign({ size: 'xs' }, props.avatar))) : null,
      !props.avatar && props.dot ? h('span', { key: 'dot', className: 'vi-chip__dot' + (typeof props.dot === 'string' ? ' vi-chip__dot--' + props.dot : ''), 'aria-hidden': 'true' }) : null,
      !props.avatar && !props.dot && props.icon ? h('span', { key: 'ic', className: 'vi-chip__icon', 'aria-hidden': 'true' }, props.icon) : null,
      h('span', { key: 'lb', className: 'vi-chip__label' }, props.children),
      props.badge != null ? h('span', { key: 'bd', className: 'vi-chip__badge' }, props.badge) : null,
      props.trailingIcon ? h('span', { key: 'ti', className: 'vi-chip__icon', 'aria-hidden': 'true' }, props.trailingIcon) : null
    ];
    var remove = props.onRemove ? h('button', {
      key: 'rm', type: 'button', className: 'vi-chip__remove', disabled: props.disabled,
      'aria-label': props.removeLabel || ('Remove ' + label).trim(), onClick: function (e) { e.stopPropagation(); props.onRemove(e); }
    }, G.close()) : null;
    if (interactive && !props.onRemove) {
      return h('button', Object.assign({}, rest, { type: 'button', className: cls, 'data-force': props['data-force'],
        'aria-pressed': props.selected != null ? (props.selected ? 'true' : 'false') : undefined }), body);
    }
    return h('span', Object.assign({}, rest, { className: cls, 'data-force': props['data-force'] }), body, remove);
  }

  /* ---------------- Radio ---------------- */
  function Radio(props) {
    var id = useIdFor(props, 'radio');
    var status = props.status === 'error' ? 'error' : 'default';
    var rest = omit(props, ['label', 'description', 'status', 'className', 'id', 'data-force', 'type']);
    return h('label', {
      className: cx('vi-radio', status === 'error' && 'vi-radio--error', props.disabled && 'is-disabled', props.className),
      htmlFor: id, 'data-force': props['data-force']
    },
      h('span', { className: 'vi-radio__control' },
        h('input', Object.assign({}, rest, { id: id, type: 'radio', className: 'vi-radio__input', 'aria-invalid': status === 'error' ? 'true' : undefined,
          'aria-describedby': props.description != null ? id + '-desc' : undefined })),
        h('span', { className: 'vi-radio__circle', 'aria-hidden': 'true' })),
      props.label != null || props.description != null ? h('span', { className: 'vi-check__text' },
        props.label != null ? h('span', { className: 'vi-check__label' }, props.label) : null,
        props.description != null ? h('span', { className: 'vi-check__desc', id: id + '-desc' }, props.description) : null) : null);
  }

  /* ---------------- Table ---------------- */
  var DensityCtx = React.createContext('comfortable');

  function TableHeaderCell(props) {
    var dir = props.sortDirection === 'asc' || props.sortDirection === 'desc' ? props.sortDirection : null;
    var rest = omit(props, ['icon', 'checkbox', 'sortable', 'sortDirection', 'onSort', 'align', 'className', 'children', 'width', 'select']);
    var inner = [
      props.checkbox ? h('span', { key: 'cb', className: 'vi-th__check' }, h(Checkbox, Object.assign({ 'aria-label': 'Select all rows' }, props.checkbox))) : null,
      props.icon ? h('span', { key: 'ic', className: 'vi-th__icon', 'aria-hidden': 'true' }, props.icon) : null,
      props.children != null ? h('span', { key: 'lb', className: 'vi-th__label' }, props.children) : null
    ];
    var content = props.sortable
      ? h('button', { type: 'button', className: cx('vi-th__sort', dir && 'is-sorted'), onClick: props.onSort },
          inner, h('span', { className: 'vi-th__sorticon', 'aria-hidden': 'true' }, dir === 'asc' ? G.sortUp() : dir === 'desc' ? G.sortDown() : G.sort()))
      : h('span', { className: 'vi-th__inner' }, inner);
    return h('th', Object.assign({ scope: 'col' }, rest, {
      className: cx('vi-th', props.select && 'vi-th--select', props.align === 'right' && 'is-right', props.align === 'center' && 'is-center', props.className),
      style: Object.assign({}, props.style, props.width ? { width: props.width } : null),
      'aria-sort': props.sortable ? (dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none') : undefined
    }), content);
  }

  function isPlainObj(x) { return x && typeof x === 'object' && !React.isValidElement(x) && !Array.isArray(x); }

  function TableCell(props) {
    var density = React.useContext(DensityCtx);
    var compact = density === 'compact';
    var rest = omit(props, ['avatar', 'subtext', 'tag', 'chips', 'icons', 'actions', 'checkbox', 'radio', 'align', 'numeric', 'className', 'children', 'as', 'select']);
    var tag = props.tag == null ? null : isPlainObj(props.tag)
      ? h(Chip, Object.assign({ size: 'sm', variant: 'soft', shape: 'tag' }, omit(props.tag, ['label'])), props.tag.label)
      : h(Chip, { size: 'sm', variant: 'soft', shape: 'tag' }, props.tag);
    var hasText = props.children != null || props.subtext != null;
    var body = [
      props.checkbox ? h('span', { key: 'cb', className: 'vi-cell__control' }, h(Checkbox, props.checkbox)) : null,
      props.radio ? h('span', { key: 'rd', className: 'vi-cell__control' }, h(Radio, props.radio)) : null,
      props.avatar ? h(Avatar, Object.assign({ key: 'av', size: compact ? 'sm' : 'md' }, props.avatar)) : null,
      props.icons ? h('span', { key: 'ic', className: 'vi-cell__icons' }, [].concat(props.icons).map(function (n, i) { return h('span', { key: i, className: 'vi-cell__icon', 'aria-hidden': 'true' }, n); })) : null,
      hasText ? h('span', { key: 'tx', className: 'vi-cell__text' },
        h('span', { className: 'vi-cell__titlerow' },
          props.children != null ? h('span', { className: 'vi-cell__title' }, props.children) : null, tag),
        props.subtext != null ? h('span', { className: 'vi-cell__sub' }, props.subtext) : null) : tag,
      props.chips ? h('span', { key: 'ch', className: 'vi-cell__chips' }, [].concat(props.chips).map(function (c, i) {
        return isPlainObj(c) ? h(Chip, Object.assign({ key: i, size: 'sm' }, omit(c, ['label'])), c.label) : h(Chip, { key: i, size: 'sm' }, c);
      })) : null,
      props.actions ? h('span', { key: 'ac', className: 'vi-cell__actions' }, [].concat(props.actions).map(function (a, i) {
        return h('button', { key: a.label || i, type: 'button', className: 'vi-cell__action', 'aria-label': a.label, title: a.label, disabled: a.disabled, onClick: a.onClick }, a.icon);
      })) : null
    ];
    return h(props.as || 'td', Object.assign({}, rest, {
      className: cx('vi-td', props.select && 'vi-td--select', props.numeric && 'is-numeric', props.align === 'right' && 'is-right', props.align === 'center' && 'is-center', props.actions && !hasText && !props.avatar && 'is-actions', props.className)
    }), h('span', { className: 'vi-cell' }, body));
  }

  function Table(props) {
    var cols = props.columns || [];
    var rows = props.rows || [];
    var mode = props.selection === 'multiple' || props.selection === 'single' ? props.selection : 'none';
    var density = props.density === 'compact' ? 'compact' : 'comfortable';
    var name = useIdFor(props, 'table');
    var sel = useControlled(props.selected, props.defaultSelected || []);
    var sortSt = useControlled(props.sort, props.defaultSort || null);
    var rowKey = function (r, i) { return r.id != null ? r.id : i; };
    function setSel(next) { sel[1](next); if (props.onSelectionChange) props.onSelectionChange(next); }
    function setSort(next) { sortSt[1](next); if (props.onSortChange) props.onSortChange(next); }
    var sort = sortSt[0];
    var view = rows.slice();
    if (sort && sort.key && props.sort === undefined && !props.manualSort) {
      var col = cols.find(function (c) { return c.key === sort.key; });
      var getv = col && col.sortValue ? col.sortValue : function (r) { return r[sort.key]; };
      view.sort(function (a, b) {
        var x = getv(a), y = getv(b);
        var c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x == null ? '' : x).localeCompare(String(y == null ? '' : y));
        return sort.direction === 'desc' ? -c : c;
      });
    }
    var keys = view.map(rowKey);
    var selected = sel[0] || [];
    var nSel = keys.filter(function (k) { return selected.indexOf(k) >= 0; }).length;
    var head = h('tr', null,
      mode === 'multiple' ? h(TableHeaderCell, { select: true, checkbox: {
        checked: nSel > 0 && nSel === keys.length, indeterminate: nSel > 0 && nSel < keys.length,
        onChange: function () { setSel(nSel === keys.length ? [] : keys.slice()); } } }) : null,
      mode === 'single' ? h(TableHeaderCell, { select: true }, h('span', { className: 'vi-sr' }, 'Select')) : null,
      cols.map(function (c) {
        var dir = sort && sort.key === c.key ? sort.direction : null;
        return h(TableHeaderCell, {
          key: c.key, icon: c.icon, align: c.align, width: c.width, sortable: c.sortable, sortDirection: dir,
          onSort: function () { setSort(dir === 'asc' ? { key: c.key, direction: 'desc' } : dir === 'desc' ? null : { key: c.key, direction: 'asc' }); }
        }, c.header);
      }));
    var body = view.map(function (r, i) {
      var k = rowKey(r, i), on = selected.indexOf(k) >= 0;
      var label = 'Select ' + (r.label || r.name || r.title || ('row ' + (i + 1)));
      return h('tr', { key: k, className: cx(on && 'is-selected'), 'aria-selected': mode !== 'none' ? (on ? 'true' : 'false') : undefined },
        mode === 'multiple' ? h(TableCell, { select: true, checkbox: { checked: on, 'aria-label': label,
          onChange: function () { setSel(on ? selected.filter(function (x) { return x !== k; }) : selected.concat([k])); } } }) : null,
        mode === 'single' ? h(TableCell, { select: true, radio: { checked: on, name: name + '-row', 'aria-label': label, onChange: function () { setSel([k]); } } }) : null,
        cols.map(function (c) {
          var v = c.cell ? c.cell(r) : r[c.key];
          if (React.isValidElement(v) && v.type === TableCell) return React.cloneElement(v, { key: c.key });
          if (isPlainObj(v)) return h(TableCell, Object.assign({ key: c.key, align: c.align, numeric: c.numeric }, v));
          return h(TableCell, { key: c.key, align: c.align, numeric: c.numeric }, v);
        }));
    });
    return h(DensityCtx.Provider, { value: density },
      h('div', { className: cx('vi-table-wrap', props.stickyHeader && 'is-sticky', props.className), style: props.maxHeight ? { maxHeight: props.maxHeight } : undefined },
        h('table', { className: cx('vi-table', 'vi-table--' + density, props.hover !== false && 'vi-table--hover'), 'aria-label': props['aria-label'] },
          h('thead', null, head), h('tbody', null, body))));
  }

  /* ---------------- Pagination ---------------- */
  function pageRange(page, count, sib, bound) {
    function range(a, z) { var r = []; for (var i = a; i <= z; i++) r.push(i); return r; }
    var total = bound * 2 + sib * 2 + 3;
    if (count <= total) return range(1, count);
    var start = Math.max(Math.min(page - sib, count - bound - sib * 2 - 1), bound + 2);
    var end = Math.min(Math.max(page + sib, bound + sib * 2 + 2), count - bound - 1);
    var out = range(1, bound);
    out.push(start > bound + 2 ? 'start-gap' : bound + 1);
    out = out.concat(range(start, end));
    out.push(end < count - bound - 1 ? 'end-gap' : count - bound);
    return out.concat(range(count - bound + 1, count));
  }
  function Pagination(props) {
    var size = props.pageSize || 10;
    var count = Math.max(1, props.pageCount != null ? props.pageCount : Math.ceil((props.total || 0) / size));
    var pg = useControlled(props.page, props.defaultPage || 1);
    var page = Math.min(Math.max(1, pg[0]), count);
    function go(p) { p = Math.min(Math.max(1, p), count); if (p === page) return; pg[1](p); if (props.onChange) props.onChange(p); }
    var compact = props.variant === 'compact';
    var summary = null;
    if (props.summary !== false && props.total != null) {
      var from = props.total === 0 ? 0 : (page - 1) * size + 1, to = Math.min(page * size, props.total);
      summary = typeof props.summary === 'function' ? props.summary({ from: from, to: to, total: props.total, page: page, pageCount: count })
        : 'Showing ' + from + '–' + to + ' of ' + props.total + (props.total === 1 ? ' result' : ' results');
    } else if (typeof props.summary === 'string' || React.isValidElement(props.summary)) summary = props.summary;
    var label = props.itemLabel || 'Page';
    var nav = h('div', { className: 'vi-pagination__pages' },
      h('button', { type: 'button', className: 'vi-pagination__step', 'aria-label': 'Previous page', disabled: page <= 1 || props.disabled, onClick: function () { go(page - 1); } }, G.chevLeft()),
      compact
        ? h('span', { className: 'vi-pagination__status', 'aria-live': 'polite' }, label + ' ', h('span', { className: 'vi-pagination__num' }, page), ' of ', h('span', { className: 'vi-pagination__num' }, count))
        : pageRange(page, count, props.siblingCount != null ? props.siblingCount : 1, props.boundaryCount != null ? props.boundaryCount : 1).map(function (p) {
            if (typeof p === 'string') return h('span', { key: p, className: 'vi-pagination__gap', 'aria-hidden': 'true' }, '…');
            var cur = p === page;
            return h('button', { key: p, type: 'button', className: cx('vi-pagination__page', cur && 'is-current'), disabled: props.disabled,
              'aria-current': cur ? 'page' : undefined, 'aria-label': label + ' ' + p, onClick: function () { go(p); } }, p);
          }),
      h('button', { type: 'button', className: 'vi-pagination__step', 'aria-label': 'Next page', disabled: page >= count || props.disabled, onClick: function () { go(page + 1); } }, G.chevRight()));
    var sizer = props.pageSizeOptions && props.onPageSizeChange ? h('label', { className: 'vi-pagination__size' }, 'Rows per page',
      h('select', { className: 'vi-pagination__select', value: size, disabled: props.disabled, onChange: function (e) { props.onPageSizeChange(Number(e.target.value)); } },
        props.pageSizeOptions.map(function (n) { return h('option', { key: n, value: n }, n); }))) : null;
    return h('nav', { className: cx('vi-pagination', props.className), 'aria-label': props['aria-label'] || 'Pagination' },
      summary != null ? h('p', { className: 'vi-pagination__summary' }, summary) : null,
      h('div', { className: 'vi-pagination__right' }, sizer, nav));
  }

  /* ---------------- SegmentedControl ---------------- */
  function SegmentedControl(props) {
    var items = normOptions(props.items);
    var multiple = !!props.multiple;
    var first = items.find(function (t) { return !t.disabled; });
    var val = useControlled(props.value, props.defaultValue != null ? props.defaultValue : (multiple ? [] : first && first.value));
    var refs = React.useRef({});
    var size = props.size === 'sm' ? 'sm' : 'md';
    function isOn(v) { return multiple ? (val[0] || []).indexOf(v) >= 0 : val[0] === v; }
    function set(v) {
      var next = v;
      if (multiple) { var cur = val[0] || []; next = cur.indexOf(v) >= 0 ? cur.filter(function (x) { return x !== v; }) : cur.concat([v]); }
      val[1](next); if (props.onChange) props.onChange(next);
    }
    function onKey(e) {
      if (multiple || props.disabled) return;
      var k = e.key; if (k !== 'ArrowRight' && k !== 'ArrowLeft' && k !== 'ArrowDown' && k !== 'ArrowUp' && k !== 'Home' && k !== 'End') return;
      e.preventDefault();
      var n = items.length, i = items.findIndex(function (t) { return t.value === val[0]; });
      var dir = k === 'ArrowRight' || k === 'ArrowDown' ? 1 : -1;
      for (var s = 1; s <= n; s++) {
        var j = k === 'Home' ? s - 1 : k === 'End' ? n - s : (i + dir * s + n * s) % n;
        if (!items[j].disabled) { set(items[j].value); var el = refs.current[items[j].value]; if (el) el.focus(); return; }
      }
    }
    return h('div', {
      role: multiple ? 'group' : 'radiogroup', 'aria-label': props['aria-label'], onKeyDown: onKey,
      className: cx('vi-seg', 'vi-seg--' + size, props.variant === 'primary' && 'vi-seg--primary', props.fullWidth && 'vi-seg--full', props.disabled && 'is-disabled', props.className)
    }, items.map(function (t) {
      var on = isOn(t.value);
      var a = { key: t.value, type: 'button', ref: function (el) { refs.current[t.value] = el; }, disabled: props.disabled || t.disabled,
        className: cx('vi-seg__item', on && 'is-selected', !t.label && t.icon && 'is-icon'), onClick: function () { set(t.value); },
        'aria-label': !t.label || t.label === '' ? t['aria-label'] || String(t.value) : undefined, title: !t.label ? (t['aria-label'] || String(t.value)) : undefined };
      if (multiple) a['aria-pressed'] = on ? 'true' : 'false';
      else { a.role = 'radio'; a['aria-checked'] = on ? 'true' : 'false'; a.tabIndex = on || (!val[0] && t === first) ? 0 : -1; }
      return h('button', a,
        t.icon ? h('span', { className: 'vi-seg__icon', 'aria-hidden': 'true' }, t.icon) : null,
        t.label ? h('span', { className: 'vi-seg__label' }, t.label) : null,
        t.count != null ? h('span', { className: 'vi-seg__count' }, t.count) : null);
    }));
  }

  /* ---------------- ProgressBar ---------------- */
  var PB_TONES = ['primary', 'info', 'success', 'warning', 'error'];
  function ProgressBar(props) {
    var id = useIdFor(props, 'progress');
    var max = props.max || 100;
    var ind = props.value == null || props.indeterminate;
    var v = ind ? 0 : Math.min(Math.max(0, props.value), max);
    var pct = Math.round((v / max) * 1000) / 10;
    var tone = PB_TONES.indexOf(props.tone) >= 0 ? props.tone : 'primary';
    var shown = props.valueLabel != null ? props.valueLabel : (ind ? null : Math.round(pct) + '%');
    var head = props.label != null || (props.showValue && shown != null);
    return h('div', { className: cx('vi-progress', 'vi-progress--' + (props.size === 'sm' ? 'sm' : props.size === 'lg' ? 'lg' : 'md'), 'vi-progress--' + tone, ind && 'is-indeterminate', props.className) },
      head ? h('div', { className: 'vi-progress__head' },
        props.label != null ? h('span', { className: 'vi-progress__label', id: id + '-label' }, props.label) : h('span'),
        props.showValue && shown != null ? h('span', { className: 'vi-progress__value' }, shown) : null) : null,
      h('div', {
        className: 'vi-progress__track', role: 'progressbar', 'aria-labelledby': props.label != null ? id + '-label' : undefined, 'aria-label': props.label == null ? (props['aria-label'] || 'Progress') : undefined,
        'aria-valuemin': ind ? undefined : 0, 'aria-valuemax': ind ? undefined : max, 'aria-valuenow': ind ? undefined : v,
        'aria-valuetext': ind ? undefined : (props.valueLabel != null ? String(props.valueLabel) : undefined),
        'aria-describedby': props.hint != null ? id + '-hint' : undefined
      }, h('div', { className: 'vi-progress__fill', style: ind ? undefined : { width: pct + '%' } })),
      props.hint != null ? h('p', { className: 'vi-progress__hint', id: id + '-hint' }, props.hint) : null);
  }

  /* ---------------- Slider ---------------- */
  function Slider(props) {
    var id = useIdFor(props, 'slider');
    var min = props.min != null ? props.min : 0, max = props.max != null ? props.max : 100, step = props.step || 1;
    var range = Array.isArray(props.value != null ? props.value : props.defaultValue);
    var val = useControlled(props.value, props.defaultValue != null ? props.defaultValue : min);
    var vals = range ? val[0] : [val[0]];
    var fmt = props.formatValue || function (x) { return String(x); };
    var active = React.useState(-1);
    var gap = props.minDistance != null ? props.minDistance : 0;
    function pct(x) { return ((x - min) / (max - min)) * 100; }
    function change(i, raw) {
      var x = Number(raw), next;
      if (range) {
        next = vals.slice();
        next[i] = i === 0 ? Math.min(x, vals[1] - gap) : Math.max(x, vals[0] + gap);
      } else next = x;
      val[1](next); if (props.onChange) props.onChange(next);
    }
    var lo = range ? pct(vals[0]) : 0, hi = pct(range ? vals[1] : vals[0]);
    var marks = props.marks === true ? (function () { var r = []; for (var x = min; x <= max + 1e-9; x += step) r.push({ value: Math.round(x * 1e6) / 1e6 }); return r; })()
      : (props.marks || []).map(function (m) { return typeof m === 'number' ? { value: m } : m; });
    var names = range ? (props.thumbLabels || ['Minimum', 'Maximum']) : [props.label != null && typeof props.label === 'string' ? props.label : (props['aria-label'] || 'Value')];
    var inputs = vals.map(function (x, i) {
      return h('input', {
        key: i, type: 'range', className: 'vi-slider__input', min: min, max: max, step: step, value: x, disabled: props.disabled, name: props.name ? (range ? props.name + (i ? '-max' : '-min') : props.name) : undefined,
        'aria-label': range || props.label == null ? names[i] : undefined, 'aria-labelledby': !range && props.label != null ? id + '-label' : undefined,
        'aria-valuetext': fmt(x),
        style: range && i === 0 && vals[0] >= max - (max - min) * 0.02 ? { zIndex: 3 } : undefined,
        onChange: function (e) { change(i, e.target.value); },
        onFocus: function () { active[1](i); }, onBlur: function () { active[1](-1); },
        onPointerDown: function () { active[1](i); }, onPointerUp: function () { active[1](-1); }
      });
    });
    var shown = range ? fmt(vals[0]) + ' – ' + fmt(vals[1]) : fmt(vals[0]);
    return h('div', { className: cx('vi-slider', props.disabled && 'is-disabled', range && 'is-range', props.className), 'data-force': props['data-force'] },
      props.label != null || props.showValue ? h('div', { className: 'vi-slider__head' },
        props.label != null ? h('span', { className: 'vi-slider__label', id: id + '-label' }, props.label) : h('span'),
        props.showValue ? h('span', { className: 'vi-slider__value', 'aria-hidden': 'true' }, shown) : null) : null,
      h('div', { className: 'vi-slider__control', onPointerDown: function (e) {
          if (props.disabled || (e.target && e.target.tagName === 'INPUT')) return;
          var rect = e.currentTarget.getBoundingClientRect();
          var raw = min + Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) * (max - min);
          var x = Math.round((raw - min) / step) * step + min;
          var i = range ? (Math.abs(x - vals[0]) <= Math.abs(x - vals[1]) ? 0 : 1) : 0;
          change(i, x);
        } },
        h('div', { className: 'vi-slider__track', 'aria-hidden': 'true' }),
        h('div', { className: 'vi-slider__rail', 'aria-hidden': 'true' },
          h('div', { className: 'vi-slider__fill', style: range ? { left: lo + '%', width: (hi - lo) + '%' } : { left: '-10px', width: 'calc(' + hi + '% + 10px)' } }),
          marks.map(function (m) { return h('span', { key: m.value, className: cx('vi-slider__tick', m.value >= (range ? vals[0] : min) && m.value <= (range ? vals[1] : vals[0]) && 'is-in'), style: { left: pct(m.value) + '%' } }); })),
        props.tooltip !== false ? vals.map(function (x, i) {
          return h('span', { key: 'tip' + i, className: cx('vi-slider__tip', (active[0] === i || props['data-force'] === 'active') && 'is-on'), style: { left: pct(x) + '%' }, 'aria-hidden': 'true' }, fmt(x));
        }) : null,
        inputs),
      marks.some(function (m) { return m.label != null; }) ? h('div', { className: 'vi-slider__marks', 'aria-hidden': 'true' }, marks.filter(function (m) { return m.label != null; }).map(function (m) {
        return h('span', { key: m.value, className: 'vi-slider__mark', style: { left: pct(m.value) + '%' } }, m.label);
      })) : null,
      props.hint != null ? h('p', { className: 'vi-slider__hint' }, props.hint) : null);
  }

  window.Violet = window.Violet || {};
  Object.assign(window.Violet, {
    Button: Button, IconButton: IconButton,
    TextField: TextField, TextArea: TextArea, Select: Select, PhoneField: PhoneField, PasswordField: PasswordField,
    SearchField: SearchField, NumberField: NumberField, DateField: DateField,
    Checkbox: Checkbox, Switch: Switch, Avatar: Avatar, AvatarGroup: AvatarGroup,
    TabItem: TabItem, TabGroup: TabGroup, ListItem: ListItem, Chip: Chip,
    Radio: Radio, Table: Table, TableHeaderCell: TableHeaderCell, TableCell: TableCell, Pagination: Pagination,
    SegmentedControl: SegmentedControl, ProgressBar: ProgressBar, Slider: Slider
  });
})();

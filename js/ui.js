/* Shared presentation pieces every screen draws from, built only on the design system.
   Nothing here knows about a specific module. */
(function () {
  var HRMS = (window.HRMS = window.HRMS || {});
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;

  /* ---------- Formatting ---------- */
  function inr(n, opts) {
    opts = opts || {};
    var v = Math.round(Number(n) || 0);
    if (opts.short) {
      if (Math.abs(v) >= 1e7) return '₹' + (v / 1e7).toFixed(2).replace(/\.00$/, '') + ' Cr';
      if (Math.abs(v) >= 1e5) return '₹' + (v / 1e5).toFixed(2).replace(/\.00$/, '') + ' L';
    }
    /* Indian grouping: last three digits, then pairs. */
    var s = String(Math.abs(v)), out = s.length > 3 ? s.slice(-3) : s, rest = s.slice(0, -3);
    while (rest.length > 2) { out = rest.slice(-2) + ',' + out; rest = rest.slice(0, -2); }
    if (rest) out = rest + ',' + out;
    return (v < 0 ? '-₹' : '₹') + out;
  }
  function pct(a, b) { return b ? Math.round((a / b) * 1000) / 10 : 0; }
  function dateLabel(isoStr) {
    if (!isoStr) return '—';
    var d = new Date(String(isoStr).slice(0, 10) + 'T00:00');
    return isNaN(d) ? isoStr : HRMS.seed.util.pretty(d);
  }
  function shortDate(isoStr) {
    if (!isoStr) return '—';
    var M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var d = new Date(String(isoStr).slice(0, 10) + 'T00:00');
    return isNaN(d) ? isoStr : d.getDate() + ' ' + M[d.getMonth()];
  }
  function relTime(when) {
    if (!when) return '—';
    var then = new Date(String(when).length > 10 ? when : when + 'T09:00');
    var mins = Math.round((HRMS.seed.today - then) / 60000);
    if (mins < 0) return 'just now';
    if (mins < 60) return mins <= 1 ? 'just now' : mins + 'm ago';
    if (mins < 60 * 24) return Math.round(mins / 60) + 'h ago';
    var d = Math.round(mins / (60 * 24));
    return d === 1 ? 'yesterday' : d + 'd ago';
  }

  /* ---------- Status tones ---------- */
  var TONES = {
    Active: 'success', Probation: 'info', 'On Leave': 'warning', 'Notice Period': 'warning',
    Onboarding: 'info', Invited: 'neutral', Suspended: 'error', Exited: 'neutral', Draft: 'neutral',
    Archived: 'neutral', Submitted: 'info', 'Pending Approval': 'warning', Approved: 'success',
    Rejected: 'error', 'Returned for Changes': 'warning', Cancelled: 'neutral', Expired: 'neutral',
    Present: 'success', Absent: 'error', Late: 'warning', 'Work From Home': 'info',
    'Missing Punch': 'warning', 'Not Started': 'neutral', 'Yet to Check In': 'neutral',
    Paid: 'success', Unpaid: 'neutral',
    Available: 'success', Assigned: 'info', 'Under Maintenance': 'warning', Damaged: 'error',
    Lost: 'error', Retired: 'neutral', Returned: 'neutral', Live: 'success', Closed: 'neutral',
    Scheduled: 'info', Completed: 'success', 'In Progress': 'info', 'Yet to Start': 'neutral',
    'Pending Verification': 'warning', Overdue: 'error', Verified: 'success', Achieved: 'success',
    'In Review': 'info', Finalized: 'success', Published: 'success', Connected: 'success',
    'Not Configured': 'neutral', 'Pending Invitation': 'warning', Deactivated: 'neutral',
    Open: 'warning', 'Under Review': 'info', Actioned: 'success', 'Awaiting Manager': 'warning',
    'Awaiting Self-Assessment': 'neutral', 'Manager Review Done': 'success', Pending: 'warning'
  };
  function StatusChip(p) {
    return h(V.Chip, {
      shape: 'tag', size: p.size || 'sm', variant: 'soft', dot: true,
      tone: TONES[p.status] || 'neutral'
    }, p.status);
  }

  /* ---------- Layout ---------- */
  /* Children arrive as a child array whenever a caller passes several, and React wants
     keys on an array rendered in one child position. `kids` spreads them into separate
     child arguments and lets React.Children.toArray key anything that is still a list. */
  function kids(children) { return React.Children.toArray(children); }
  function el(tag, props, list) { return React.createElement.apply(null, [tag, props].concat(kids(list))); }

  function PageHead(p) {
    return h('div', { className: 'page-head' },
      h('div', { className: 'stack gap-1' },
        p.eyebrow ? h('span', { className: 'eyebrow' }, p.eyebrow) : null,
        h('h1', null, p.title),
        p.description ? h('p', { className: 'muted page-head__desc' }, p.description) : null),
      p.actions ? el('div', { className: 'row gap-2 wrap' }, p.actions) : null);
  }

  function Card(p) {
    var head = p.title || p.aside
      ? h('div', { className: 'card__head' },
          h('h2', { className: 'card__title' }, p.title),
          p.aside || null)
      : null;
    var desc = p.description
      ? h('p', { className: 'muted', style: { fontSize: 13, marginTop: -4 } }, p.description)
      : null;
    return el('section', {
      className: ['card', p.span ? 'span-' + p.span : '', p.className || ''].filter(Boolean).join(' ')
    }, [head, desc].concat(kids(p.children)));
  }

  function Grid(p) { return el('div', { className: 'grid' }, p.children); }

  function Stat(p) {
    var inner = h(React.Fragment, null,
      h('span', { className: 'stat__label' }, p.label),
      h('span', { className: 'stat__value' }, p.value, p.unit ? h('small', null, ' ' + p.unit) : null),
      h('span', { className: 'stat__sub' + (p.tone ? ' is-' + p.tone : '') },
        p.tone === 'warn' ? I.warn : p.tone === 'good' ? I.ok : null, p.sub || ''));
    if (!p.onClick) return h('div', { className: 'stat' }, inner);
    return h('button', { type: 'button', className: 'stat stat--link', onClick: p.onClick }, inner);
  }
  function Stats(p) { return el('div', { className: 'stats' + (p.cols ? ' stats--' + p.cols : '') }, p.children); }

  function KeyValue(p) {
    return h('dl', { className: 'kv' + (p.columns ? ' kv--cols' : '') }, p.rows.filter(Boolean).map(function (row, i) {
      return h(React.Fragment, { key: i },
        h('dt', null, row[0]),
        h('dd', null, row[1] == null || row[1] === '' ? h('span', { className: 'muted' }, '—') : row[1]));
    }));
  }

  function Person(p) {
    var e = p.employee;
    if (!e) return h('span', { className: 'muted' }, '—');
    var sub = p.sub !== undefined ? p.sub : e.designation;
    var inner = h(React.Fragment, null,
      h(V.Avatar, { name: e.name, size: p.size || 'sm' }),
      h('span', { className: 'person__text' },
        h('span', { className: 'person__name' }, e.name),
        sub ? h('span', { className: 'person__sub' }, sub) : null));
    if (!p.onClick) return h('span', { className: 'person' }, inner);
    return h('button', { type: 'button', className: 'person person--link', onClick: p.onClick, title: 'Open ' + e.name }, inner);
  }

  /* ---------- Empty states (PRD 17) ---------- */
  function Empty(p) {
    return h('div', { className: 'empty' },
      h('span', { className: 'empty__mark' }, p.icon || I.file),
      h('div', { className: 'stack gap-2' },
        h('h3', { className: 'empty__title' }, p.title),
        p.body ? h('p', { className: 'empty__body' }, p.body) : null),
      p.actions ? el('div', { className: 'row gap-2 wrap', style: { justifyContent: 'center' } }, p.actions) : null);
  }

  /* The screen shown where the IA has a route but the module is not built. */
  function Stub(p) {
    var meta = p.meta;
    return h('div', { className: 'stub' },
      h('div', { className: 'stub__mark' }, I.template),
      h('div', { className: 'stack gap-3 stub__body' },
        meta.note ? h('p', { className: 'stub__note' }, meta.note) : null,
        h('div', { className: 'row gap-2 wrap' },
          meta.section ? h(V.Chip, { size: 'sm', shape: 'tag', icon: I.file }, 'PRD ' + meta.section) : null,
          h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info', dot: true }, 'Not built yet'),
          h(V.Chip, { size: 'sm', shape: 'tag', icon: I.link }, '#/' + meta.path))));
  }

  /* Module tabs, in one tier or two.

     Most modules are one row of tabs and stay that way. A module that gathers two
     subjects — attendance and leave, which belong together but are not the same
     question — says so by giving its tabs a `group`. Then the row above names the
     groups and the row below holds only the tabs of the group you are in, so nine or
     eleven tabs stop competing in a single line and the module reads as the two halves
     it actually has.

     The groups carry no routes of their own: picking one goes to its first tab, which
     is what the group means. A grouped module is still one rail item and one route
     table — only the tab row is in two tiers. */
  function ModuleTabs(p) {
    var item = p.item, role = p.role, active = p.active;
    if (!item || !item.tabs) return null;

    function go(tab) {
      /* A tab may keep a route of its own, so follow that where it has one. */
      HRMS.router.go((tab && tab.route) || (role + '/' + item.path + '/' + tab.path));
    }
    function row(tabs, variant, value, label) {
      return h(V.TabGroup, {
        variant: variant, divider: variant !== 'pill', 'aria-label': label, value: value,
        /* A tab may name an icon, which the module's nav entry declares. Most do not,
           and a mixed row reads badly, so the icons are used only where every tab in
           the row has one. */
        items: (function () {
          var all = tabs.every(function (t) { return !!t.icon; });
          return tabs.map(function (t) {
            return { value: t.path, label: t.label, icon: all ? I[t.icon] : null };
          });
        }()),
        onChange: function (v) { go(tabs.filter(function (t) { return t.path === v; })[0]); }
      });
    }

    var groups = [];
    item.tabs.forEach(function (t) { if (t.group && groups.indexOf(t.group) < 0) groups.push(t.group); });
    if (groups.length < 2) return row(item.tabs, 'underline', active, item.label);

    var activeTab = item.tabs.filter(function (t) { return t.path === active; })[0] || item.tabs[0];
    var inGroup = item.tabs.filter(function (t) { return t.group === activeTab.group; });
    /* The master row is keyed on its group's first tab, so selecting a group and
       landing on that tab are the same act and the row needs no state of its own. */
    var masters = groups.map(function (g) {
      var first = item.tabs.filter(function (t) { return t.group === g; })[0];
      return { path: first.path, label: g, route: first.route };
    });
    var currentMaster = item.tabs.filter(function (t) { return t.group === activeTab.group; })[0].path;

    return h('div', { className: 'mtabs' },
      row(masters, 'underline', currentMaster, item.label),
      row(inGroup, 'pill', active, activeTab.group));
  }

  /* ---------- Toasts: app-level, so an action can report from anywhere ---------- */
  var toastListeners = [];
  var toastSeq = 0;
  function toast(message, tone) {
    toastSeq += 1;
    var entry = { id: toastSeq, message: message, tone: tone || 'info' };
    toastListeners.forEach(function (fn) { fn(entry); });
    return entry;
  }
  /* Report an action result: its message on success, its first error on failure. */
  function report(result) {
    if (!result) return result;
    if (result.ok) { toast(result.message, 'success'); return result; }
    var keys = Object.keys(result.errors || {});
    var first = keys.length ? result.errors[keys[0]] : 'That could not be completed';
    toast(first, 'error');
    return result;
  }
  function ToastHost() {
    var st = React.useState([]);
    React.useEffect(function () {
      function onToast(entry) {
        st[1](function (list) { return list.concat([entry]); });
        setTimeout(function () {
          st[1](function (list) { return list.filter(function (x) { return x.id !== entry.id; }); });
        }, 4200);
      }
      toastListeners.push(onToast);
      return function () { toastListeners = toastListeners.filter(function (f) { return f !== onToast; }); };
    }, []);
    if (!st[0].length) return null;
    return h('div', { className: 'toasts' }, st[0].map(function (t) {
      return h('div', { key: t.id, className: 'toast toast--' + t.tone + ' fade-in', role: 'status' },
        h('span', { className: 'toast__icon' }, t.tone === 'error' ? I.warn : t.tone === 'success' ? I.ok : I.info),
        h('span', null, t.message));
    }));
  }

  /* ---------- Forms ---------- */
  /* Holds values, runs a validator, and exposes the props each field needs.
     `validate` receives the values and returns { field: message }. */
  function useForm(initial, validate) {
    var valuesSt = React.useState(initial || {});
    var errorsSt = React.useState({});
    var submittedSt = React.useState(false);

    function set(key, value) {
      valuesSt[1](function (v) {
        var next = Object.assign({}, v);
        next[key] = value;
        return next;
      });
      /* Clear the field's error as soon as it is edited. */
      errorsSt[1](function (e) {
        if (!e[key]) return e;
        var next = Object.assign({}, e);
        delete next[key];
        return next;
      });
    }
    function setMany(fields) { valuesSt[1](function (v) { return Object.assign({}, v, fields); }); }
    function reset(next) { valuesSt[1](next || initial || {}); errorsSt[1]({}); submittedSt[1](false); }

    /* Run the validator and, if clean, hand the values to `onValid`.
       A result with { ok: false, errors } is folded back into the field errors. */
    function submit(onValid) {
      submittedSt[1](true);
      var errs = (validate ? validate(valuesSt[0]) : {}) || {};
      if (HRMS.rules.hasErrors(errs)) { errorsSt[1](errs); return null; }
      var result = onValid(valuesSt[0]);
      if (result && result.ok === false) { errorsSt[1](result.errors || {}); return result; }
      return result;
    }

    /* Props for a Violet field: value, onChange, error status and hint. */
    function field(key, opts) {
      opts = opts || {};
      var err = errorsSt[0][key];
      return {
        value: valuesSt[0][key] == null ? '' : valuesSt[0][key],
        onChange: function (e) {
          set(key, opts.number ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value);
        },
        status: err ? 'error' : undefined,
        hint: err || opts.hint
      };
    }
    /* Props for a Violet Select, whose onChange gives the value directly. */
    function select(key, opts) {
      opts = opts || {};
      var err = errorsSt[0][key];
      return {
        value: valuesSt[0][key] == null ? '' : valuesSt[0][key],
        onChange: function (v) { set(key, v); },
        status: err ? 'error' : undefined,
        hint: err || opts.hint
      };
    }
    function check(key) {
      return { checked: !!valuesSt[0][key], onChange: function (e) { set(key, e.target.checked); } };
    }

    return {
      values: valuesSt[0], errors: errorsSt[0], submitted: submittedSt[0],
      set: set, setMany: setMany, reset: reset, submit: submit,
      field: field, select: select, check: check,
      setErrors: errorsSt[1]
    };
  }

  /* A row of fields that wraps to one column on a narrow screen. */
  function FieldRow(p) { return el('div', { className: 'fieldrow' + (p.cols ? ' fieldrow--' + p.cols : '') }, p.children); }
  function FormSection(p) {
    return el('div', { className: 'formsection' }, [
      h('div', { className: 'formsection__head' },
        h('span', { className: 'eyebrow' }, p.title),
        p.description ? h('p', { className: 'formsection__desc' }, p.description) : null)
    ].concat(kids(p.children)));
  }

  /* ---------- Modal, drawer, confirm ---------- */
  function useEscape(onClose) {
    React.useEffect(function () {
      function onKey(e) { if (e.key === 'Escape') onClose(); }
      document.addEventListener('keydown', onKey);
      return function () { document.removeEventListener('keydown', onKey); };
    }, [onClose]);
  }

  function Modal(p) {
    useEscape(p.onClose);
    return h('div', {
      className: 'modal__scrim',
      onMouseDown: function (e) { if (e.target === e.currentTarget) p.onClose(); }
    },
      h('div', {
        className: 'modal' + (p.wide ? ' modal--wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': p.title
      },
        h('div', { className: 'modal__head' },
          h('div', { className: 'stack gap-1', style: { flex: 1, minWidth: 0 } },
            h('h2', { className: 'modal__title' }, p.title),
            p.description ? h('p', { className: 'muted', style: { fontSize: 13 } }, p.description) : null),
          h(V.IconButton, { icon: I.close, 'aria-label': 'Close', onClick: p.onClose })),
        el('div', { className: 'modal__body' }, p.children),
        p.footer ? el('div', { className: 'modal__foot' }, p.footer) : null));
  }

  function Drawer(p) {
    useEscape(p.onClose);
    return h('div', {
      className: 'drawer__scrim',
      onMouseDown: function (e) { if (e.target === e.currentTarget) p.onClose(); }
    },
      h('div', { className: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': p.title },
        h('div', { className: 'drawer__head' },
          h('div', { className: 'stack gap-1', style: { flex: 1, minWidth: 0 } },
            p.eyebrow ? h('span', { className: 'eyebrow' }, p.eyebrow) : null,
            h('h2', { className: 'drawer__title' }, p.title),
            p.description ? h('p', { className: 'muted', style: { fontSize: 13 } }, p.description) : null),
          h(V.IconButton, { icon: I.close, 'aria-label': 'Close', onClick: p.onClose })),
        el('div', { className: 'drawer__body' }, p.children),
        p.footer ? el('div', { className: 'drawer__foot' }, p.footer) : null));
  }

  function Confirm(p) {
    return h(Modal, {
      title: p.title, description: p.body, onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, p.cancelLabel || 'Cancel'),
        h(V.Button, {
          variant: 'primary', className: p.tone === 'danger' ? 'vi-btn--danger' : '',
          onClick: function () { p.onConfirm(); p.onClose(); }
        }, p.confirmLabel || 'Confirm'))
    }, p.children || null);
  }

  /* ---------- Timeline (PRD 4.4 "Employee Timeline") ---------- */
  function Timeline(p) {
    if (!p.items || !p.items.length) {
      return h(Empty, { icon: I.history, title: p.emptyTitle || 'No activity yet' });
    }
    return h('ol', { className: 'timeline' }, p.items.map(function (item, i) {
      return h('li', { key: item.id || i, className: 'timeline__row' },
        h('span', { className: 'timeline__dot' + (item.tone ? ' is-' + item.tone : '') }),
        h('div', { className: 'timeline__main' },
          h('span', { className: 'timeline__title' }, item.title),
          item.body ? h('span', { className: 'timeline__body' }, item.body) : null,
          h('span', { className: 'timeline__when' }, item.when)));
    }));
  }

  /* ---------- Employee picker, used by most forms ---------- */
  function EmployeePicker(p) {
    var qSt = React.useState('');
    var openSt = React.useState(false);
    var ref = React.useRef(null);
    var q = qSt[0].trim().toLowerCase();

    React.useEffect(function () {
      if (!openSt[0]) return;
      function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) openSt[1](false); }
      document.addEventListener('mousedown', onDoc);
      return function () { document.removeEventListener('mousedown', onDoc); };
    }, [openSt[0]]);

    var pool = (p.pool || HRMS.store.collection('employees')).filter(function (e) {
      return p.includeExited ? true : e.status !== 'Exited';
    });
    var matches = q
      ? pool.filter(function (e) {
          return e.name.toLowerCase().indexOf(q) >= 0 || e.id.toLowerCase().indexOf(q) >= 0;
        }).slice(0, 8)
      : pool.slice(0, 8);
    var chosen = p.value ? HRMS.store.employee(p.value) : null;

    return h('div', { className: 'picker', ref: ref },
      h(V.TextField, {
        label: p.label, placeholder: p.placeholder || 'Search by name or ID',
        value: openSt[0] ? qSt[0] : (chosen ? chosen.name : ''),
        status: p.status, hint: p.hint,
        onFocus: function () { openSt[1](true); qSt[1](''); },
        onChange: function (e) { qSt[1](e.target.value); openSt[1](true); },
        iconEnd: chosen && !openSt[0] ? I.check : I.search
      }),
      openSt[0] ? h('ul', { className: 'picker__list' },
        matches.length ? matches.map(function (e) {
          return h('li', { key: e.id },
            h('button', {
              type: 'button', className: 'picker__item',
              onClick: function () { p.onChange(e.id); openSt[1](false); qSt[1](''); }
            },
              h(V.Avatar, { name: e.name, size: 'xs' }),
              h('span', { className: 'picker__text' },
                h('span', { className: 'picker__name' }, e.name),
                h('span', { className: 'picker__meta' }, e.designation + ' · ' + e.id))));
        }) : h('li', { className: 'picker__none muted' }, 'No match'),
        p.allowNone ? h('li', null, h('button', {
          type: 'button', className: 'picker__item',
          onClick: function () { p.onChange(null); openSt[1](false); }
        }, h('span', { className: 'picker__text' }, h('span', { className: 'picker__name muted' }, 'None')))) : null) : null);
  }

  /* ---------- Filter bar select ---------- */
  function Filter(p) {
    return h('div', { className: 'filterbar__item' },
      h(V.Select, {
        label: p.label, value: p.value, placeholder: p.placeholder || 'All',
        options: [{ value: '', label: p.allLabel || 'All' }].concat(p.options),
        onChange: p.onChange
      }));
  }

  /* ---------- Table with search, filters, pagination and export ---------- */
  function DataTable(p) {
    var sizeSt = React.useState(p.pageSize || 10);
    var qSt = React.useState(''), pageSt = React.useState(1);
    var q = qSt[0].trim().toLowerCase();

    var rows = p.rows;
    if (q && p.search) rows = rows.filter(function (r) { return String(p.search(r)).toLowerCase().indexOf(q) >= 0; });

    var size = sizeSt[0];
    var pageCount = Math.max(1, Math.ceil(rows.length / size));
    var page = Math.min(pageSt[0], pageCount);
    var view = rows.slice((page - 1) * size, page * size);

    React.useEffect(function () { pageSt[1](1); }, [q, p.rows.length, size]);

    function exportCsv() {
      var cols = p.columns.filter(function (c) { return c.key !== 'actions' && c.header; });
      var head = cols.map(function (c) { return '"' + c.header + '"'; }).join(',');
      var body = rows.map(function (r) {
        return cols.map(function (c) {
          var v = c.csv ? c.csv(r) : r[c.key];
          return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
        }).join(',');
      }).join('\n');
      var blob = new Blob([head + '\n' + body], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (p.exportName || 'export') + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
      toast(rows.length + ' rows exported', 'success');
    }

    var hasToolbar = p.search || p.filters || p.onExport !== false || p.toolbar;
    return h(React.Fragment, null,
      hasToolbar ? h('div', { className: 'filterbar' },
        p.search ? h('div', { className: 'filterbar__search' },
          h(V.SearchField, {
            placeholder: p.searchPlaceholder || 'Search',
            value: qSt[0], onChange: function (e) { qSt[1](e.target.value); }
          })) : null,
        p.filters || null,
        h('span', { className: 'filterbar__spacer' }),
        p.toolbar || null,
        p.onExport !== false
          ? h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.download, onClick: exportCsv }, 'Export')
          : null) : null,
      rows.length
        ? h(React.Fragment, null,
            h(V.Table, {
              columns: p.columns, rows: view, selection: p.selection, density: p.density,
              selected: p.selected, onSelectionChange: p.onSelectionChange,
              stickyHeader: p.stickyHeader, maxHeight: p.maxHeight, 'aria-label': p.label
            }),
            h(V.Pagination, {
              total: rows.length, pageSize: size, page: page, onChange: pageSt[1],
              pageSizeOptions: [10, 25, 50], onPageSizeChange: sizeSt[1]
            }))
        : h(Empty, {
            icon: q ? I.search : (p.emptyIcon || I.file),
            title: q ? 'No matches for "' + qSt[0].trim() + '"' : (p.emptyTitle || 'Nothing here yet'),
            body: q ? 'Try a different search term.' : p.emptyBody,
            actions: q
              ? h(V.Button, { variant: 'outline', onClick: function () { qSt[1](''); } }, 'Clear search')
              : p.emptyActions
          }));
  }

  /* ---------- A standard distribution bar list ---------- */
  function Bars(p) {
    var max = Math.max.apply(null, p.rows.map(function (x) { return x[1]; }).concat([1]));
    if (!p.rows.length) return h(Empty, { icon: I.reports, title: p.emptyTitle || 'No data' });
    return h('div', { className: 'bars' }, p.rows.map(function (row) {
      return h('div', { className: 'bars__row', key: row[0] },
        h('span', { className: 'bars__label', title: row[0] }, row[0]),
        h('span', { className: 'bars__track' },
          h('span', {
            className: 'bars__fill' + (row[2] ? ' is-' + row[2] : ''),
            style: { width: Math.round((row[1] / max) * 100) + '%' }
          })),
        h('span', { className: 'bars__value' }, row[1]));
    }));
  }

  HRMS.ui = {
    inr: inr, pct: pct, tones: TONES, dateLabel: dateLabel, shortDate: shortDate, relTime: relTime,
    PageHead: PageHead, Card: Card, Grid: Grid, Stat: Stat, Stats: Stats, KeyValue: KeyValue,
    Person: Person, StatusChip: StatusChip, Empty: Empty, Stub: Stub, ModuleTabs: ModuleTabs,
    DataTable: DataTable, Bars: Bars, Timeline: Timeline,
    Modal: Modal, Drawer: Drawer, Confirm: Confirm,
    useForm: useForm, FieldRow: FieldRow, FormSection: FormSection,
    EmployeePicker: EmployeePicker, Filter: Filter,
    toast: toast, report: report, ToastHost: ToastHost
  };
})();

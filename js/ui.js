/* Shared presentation pieces every screen draws from, built only on the design system.
   Nothing here knows about a specific module. */
(function () {
  var HRMS = (window.HRMS = window.HRMS || {});
  var React = window.React, ReactDOM = window.ReactDOM, h = React.createElement, V = window.Violet, I = window.Icons;

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
    'Manager Review Done': 'success', Pending: 'warning',
    /* Data export and import runs. */
    Ready: 'success', Queued: 'info', Running: 'info', 'Held for Review': 'warning'
  };
  /* A status may be configured with a colour of its own in employee setup, and when
     it is, that colour is what the status wears everywhere — not only on the screen
     where it was chosen. The built-in map stays as the fallback, so every status that
     shipped keeps the tone it has always had. */
  function statusTone(name) {
    var store = HRMS.store;
    if (store) {
      var rows = store.collection('statusTransitions') || [];
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].status === name && rows[i].tone) return rows[i].tone;
      }
    }
    return TONES[name] || 'neutral';
  }

  function StatusChip(p) {
    return h(V.Chip, {
      shape: 'tag', size: p.size || 'sm', variant: 'soft', dot: true,
      tone: statusTone(p.status)
    }, p.status);
  }

  /* ---------- Layout ---------- */
  /* Children arrive as a child array whenever a caller passes several, and React wants
     keys on an array rendered in one child position. `kids` spreads them into separate
     child arguments and lets React.Children.toArray key anything that is still a list. */
  function kids(children) { return React.Children.toArray(children); }
  function el(tag, props, list) { return React.createElement.apply(null, [tag, props].concat(kids(list))); }

  /* A page names itself once: a heading, a line under it, and whatever acts on the
     whole page, on that same row. The eyebrow is gone — it repeated the module the
     rail and the breadcrumb already name, above every heading in the product. */
  /* What acts on the whole page sits on the heading's row, and a screen is not where
     the heading is drawn — the frame is. So the heading hangs one detached node here
     and a screen fills it from wherever its own code happens to be, through
     `PageActions`. The node is made once, at load, so a portal into it never races
     the heading's own mount. */
  var headHost = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (headHost) headHost.className = 'page-head__slot';

  function PageHead(p) {
    return h('div', { className: ['page-head', p.className || ''].filter(Boolean).join(' ') },
      h('div', { className: 'page-head__text' },
        h('h1', { className: 'page-head__title' }, p.title),
        p.description ? h('p', { className: 'muted page-head__desc' }, p.description) : null),
      el('div', {
        className: 'page-head__tools',
        ref: function (node) { if (node && headHost && headHost.parentNode !== node) node.appendChild(headHost); }
      }, p.actions || null));
  }

  /* Renders its children onto the page's heading row, whatever draws that row. */
  function PageActions(p) {
    if (!headHost || !window.ReactDOM || !p.children) return null;
    return window.ReactDOM.createPortal(p.children, headHost);
  }

  /* A card whose whole body is one table is a box inside a box: the card draws a
     head and a border, and the table then draws its own toolbar and its own bordered
     table inside that. It also strands the controls — the heading sat in the card
     head while the search, the filters and the Export button sat in a band below it,
     lined up with nothing.

     So a card like that is not drawn. Its title, description and aside move onto the
     table's own toolbar row, which is where the search and the filters already are,
     and only the grid span is kept so the layout around it is unchanged. Doing it
     here rather than at each call site means every table in the product gets it,
     including ones added later. A card with anything else in it alongside the table,
     or a table that was already given its own title, is left alone. */
  /* The card leads with a table when its first child is one. Anything after it — a
     footnote, a pair of links — stays where it was, below the table, so unwrapping
     never reorders a card. A table that is not first keeps its card, because the
     heading has to sit on the table's own toolbar row and moving it there would put
     whatever came before the table underneath it. */
  function leadingTable(children) {
    var list = kids(children).filter(Boolean);
    if (!list.length) return null;
    var first = list[0];
    if (!React.isValidElement(first) || first.type !== DataTable || first.props.title) return null;
    return { table: first, rest: list.slice(1) };
  }

  /* The page already carries its name, so a table that repeats it word for word is a
     second heading saying the same thing one line down: in that case the table's title
     is dropped and the page's stands. Where the table says something of its own —
     "Earnings" among three tables, or "Leave requests" under a tab called "Requests" —
     it is kept, and reads as the section heading it is. */
  function sameAsPageName(title) {
    if (!title || typeof title !== 'string') return false;
    var router = HRMS.router, nav = HRMS.nav;
    if (!router || !nav || !router.current || !nav.resolve) return false;
    var meta = nav.resolve(router.current());
    if (!meta || !meta.label) return false;
    var norm = function (x) { return String(x).toLowerCase().replace(/[^a-z0-9]/g, ''); };
    return norm(meta.label) === norm(title);
  }

  function Card(p) {
    var led = leadingTable(p.children);
    if (led) {
      var dup = sameAsPageName(p.title);
      return el('div', {
        className: ['tablewrap', p.span ? 'span-' + p.span : '', p.className || ''].filter(Boolean).join(' ')
      }, [React.cloneElement(led.table, {
        title: dup ? null : p.title, description: dup ? null : p.description,
        /* What the card called its aside is the page's primary action — New, Add,
           Create — so it goes up onto the heading row, beside the name of the thing it
           creates, rather than sitting a row below it. */
        headActions: p.aside
      })].concat(led.rest));
    }
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

  function Grid(p) { return el('div', { className: ['grid', p.className || ''].filter(Boolean).join(' ') }, p.children); }

  /* ---------- the KPI card ----------
     Every module screen opens on a row of these, and they only ever know a label, a
     value, a line under it and a tone. So everything that makes the card worth looking
     at is read from those: the icon from what the label is about, the ring from a
     percentage wherever one appears, the colour from the tone. No screen has to pass
     anything new, and a screen that does pass `icon` gets its own. */
  var STAT_ICONS = [
    [/overdue|fail|reject|declin|absent|missing|expir|risk|late|lapsed|error/i, 'warn'],
    [/pending|await|waiting|due|notice|probation|in progress|queued|open|draft/i, 'clock'],
    [/approv|acknowledg|complet|verif|paid|present|done|ready|cleared|settled/i, 'check'],
    [/value|cost|payroll|salary|gross|net|amount|budget|ctc|spend|payable|deduction|reimburse|loan|₹/i, 'card'],
    [/holder|employee|people|headcount|user|joiner|member|staff|team|candidate|manager/i, 'users'],
    [/asset|unit|inventory|allocat|stock|laptop|device|return|maintenance/i, 'package'],
    [/leave|holiday|calendar|day|week|month|shift|hours/i, 'calendar'],
    [/request|ticket|task|approval|case/i, 'checklist'],
    [/score|rating|engag|survey|goal|review|performance/i, 'star']
  ];
  function statIcon(label) {
    var t = String(label || '');
    for (var i = 0; i < STAT_ICONS.length; i++) if (STAT_ICONS[i][0].test(t)) return I[STAT_ICONS[i][1]] || I.activity;
    return I.activity;
  }

  /* A percentage the card can draw: the value itself when its unit is %, else the first
     "N%" in the line underneath. Anything outside 0–100 is not a share and gets no ring. */
  function statShare(p) {
    var v = null;
    if (p.unit === '%' && isFinite(Number(p.value))) v = Number(p.value);
    else {
      var m = String(p.sub || '').match(/(\d+(?:\.\d+)?)\s*%/);
      if (m) v = Number(m[1]);
    }
    return v != null && v >= 0 && v <= 100 ? v : null;
  }

  /* The number counts up the first time the card is drawn. Only plain numbers do; a
     formatted string such as "₹4.52 Cr" is shown as it is, and so is everything for
     anyone who has asked for less motion. */
  function useCountUp(value) {
    var target = typeof value === 'number' && isFinite(value) ? value : null;
    var st = React.useState(target == null ? value : 0);
    React.useEffect(function () {
      if (target == null) { st[1](value); return; }
      var reduce = false;
      try { reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
      if (reduce || !window.requestAnimationFrame) { st[1](target); return; }
      var decimals = (String(target).split('.')[1] || '').length;
      var start = null, raf;
      function step(ts) {
        if (start == null) start = ts;
        var k = Math.min(1, (ts - start) / 700);
        var eased = 1 - Math.pow(1 - k, 3);
        st[1](k < 1 ? Number((target * eased).toFixed(decimals)) : target);
        if (k < 1) raf = window.requestAnimationFrame(step);
      }
      raf = window.requestAnimationFrame(step);
      return function () { if (raf) window.cancelAnimationFrame(raf); };
    }, [target]);
    return target == null ? value : st[0];
  }

  function StatRing(p) {
    var R = 15, C = 2 * Math.PI * R, on = p.v / 100 * C;
    return h('span', { className: 'stat__ring', 'aria-hidden': 'true' },
      h('svg', { viewBox: '0 0 40 40' },
        h('circle', { cx: 20, cy: 20, r: R, fill: 'none', stroke: 'var(--stat-track)', strokeWidth: 4 }),
        h('circle', { cx: 20, cy: 20, r: R, fill: 'none', stroke: 'var(--stat-ink)', strokeWidth: 4, strokeLinecap: 'round',
          strokeDasharray: on + ' ' + (C - on), transform: 'rotate(-90 20 20)' })),
      h('b', null, Math.round(p.v)));
  }

  function Stat(p) {
    var shown = useCountUp(p.value);
    var share = statShare(p);
    var tone = p.tone === 'warn' ? 'warn' : p.tone === 'good' ? 'good' : p.tone === 'bad' ? 'bad' : 'brand';
    var inner = h(React.Fragment, null,
      h('span', { className: 'stat__glow', 'aria-hidden': 'true' }),
      h('span', { className: 'stat__top' },
        h('span', { className: 'stat__label' }, p.label),
        h('span', { className: 'stat__ico', 'aria-hidden': 'true' }, p.icon || statIcon(p.label))),
      h('span', { className: 'stat__mid' },
        h('span', { className: 'stat__value' }, shown, p.unit ? h('small', null, ' ' + p.unit) : null),
        share != null && p.unit !== '%' ? h(StatRing, { v: share }) : null),
      p.sub ? h('span', { className: 'stat__sub' + (p.tone ? ' is-' + p.tone : '') },
        p.tone === 'warn' ? I.warn : p.tone === 'good' ? I.ok : null, p.sub) : null,
      h('span', { className: 'stat__bar', 'aria-hidden': 'true' },
        share != null ? h('i', { style: { width: share + '%' } }) : h('i', { style: { width: '100%' } })));
    var cls = 'stat stat--' + tone;
    if (!p.onClick) return h('div', { className: cls }, inner);
    return h('button', { type: 'button', className: cls + ' stat--link', onClick: p.onClick }, inner);
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

  /* ---------- Done: the illustration for a queue that is clear ----------

     A clipboard with its lines ticked off and a seal over the corner. It is the
     supplied artwork, redrawn against the product's own tokens rather than its stock
     green and lime: the paper takes the surface and border colours, the ticked lines
     take the brand, and the seal takes the success colour, so it reads the same in
     light and dark and follows the accent when the accent is changed on the Branding
     screen. A fixed-palette illustration would have been the one thing on the page
     that ignored the theme.

     It is decoration — the words beside it carry the meaning — so it is hidden from
     the reading order. */
  function DoneArt(p) {
    var size = p.size || 150;
    return h('svg', {
      width: size, height: Math.round(size * 125 / 168), viewBox: '0 0 168 125',
      fill: 'none', 'aria-hidden': 'true', className: 'doneart'
    },
      /* the soft shadow the sheet casts */
      h('ellipse', { cx: 83.8, cy: 100.2, rx: 68.9, ry: 9.7, className: 'doneart__shadow' }),
      /* the sheet, and the fold that lifts off its right edge */
      h('path', { className: 'doneart__paper',
        d: 'M127.6 25.3c2.2-7.8 5.7-16.5 12.2-21.8 1.3-1 3.1-2.4 4.2-3.5-3 .1-6.6.4-9.7.6-7.4.5-38.3 2.4-46.4 2.9-5.2.3-10.4.7-15.7 1-6.1.4-11 7.2-13.7 12.1-3.1 5.5-4.8 11.7-6 17.9-1.6 8.4-3.4 49.1-3.8 52.9-.7 6.7-3.3 17.4-11.7 17.4 3.4 0 66.9.5 71.8.5 5.8 0 9.2-4.6 11.1-9.6 2.4-6.1 3-32.4 3.3-39.2.3-6.8 3.4-27.7 4.4-31.2Z' }),
      h('path', { className: 'doneart__fold',
        d: 'M107.1 110c-3.3-.8-5.5-2.8-7.3-5.6-1.3-2.1-2.5-4.3-2.9-6.8-.4-2.5.2-4.3 2.5-5.6-2.4 0-70.8.6-71.9.6-2.1 0-3.2 2.1-3.2 4 0 1.9.5 3.8 1.2 5.5 1 2.4 2.6 4.7 4.7 6.3 1.9 1.4 4.3 2.2 6.7 2.3 0 0 72.3.2 72.3.2-.9-.2-1.4-.6-2.2-.8Z' }),
      h('path', { className: 'doneart__curl',
        d: 'M147.1 1.9c-.6-1.4-2.2-2.4-3.7-1.7-2.7 1.2-5 3.2-7.1 5.7-4.8 5.7-7.6 13.2-9.5 20.4-1.7 6.3-2.7 13-3.3 19.5-.4 4.8-.7 9.6-.8 14.4-.2 6.7-.3 13.5-.7 20.2-.3 5.2-.7 10.8-2.7 15.6-2.3 5.7-11.2 13.6-15.6 5-1.2-2.2-1.1-4.7-1.9-7-.3-.7-.7-1.5-1.4-1.8-1.9-.9-3.7 1.3-4 3-.6 3.8 1.7 8.7 4.2 11.6 1.7 1.9 4.2 3.4 6.7 3.9 2.2.4 4.7.1 6.7-.7 4.8-1.9 8.2-6.3 10.2-10.9 1.6-3.8 2.5-8 2.9-12 1-8.8.9-17.7 1.2-26.5.2-4.7.4-9.4.8-14 .5-6.1 1.4-12.2 2.8-18.1 1.4-6.1 3.6-12.7 7.6-17.6 1.8-2.2 3.8-3.8 6.3-4.9 1.6-.7 1.8-2.5 1.2-4Z' }),
      /* three lines, each with its bullet ticked */
      [0, 1, 2].map(function (i) {
        var y = 19.8 + i * 16.7;
        return h('g', { key: i },
          h('circle', { className: 'doneart__tick', cx: 74.5, cy: y, r: 4.8 }),
          h('path', { className: 'doneart__tickmark', d: 'M72.2 ' + y + 'l1.7 1.8 3.1-3.6' }),
          h('rect', { className: 'doneart__line', x: 83.8, y: y - 3.5, width: i === 2 ? 17 : 25, height: 7, rx: 3.5 }));
      }),
      /* the seal */
      h('circle', { className: 'doneart__seal', cx: 123.1, cy: 66.7, r: 28 }),
      h('circle', { className: 'doneart__sealring', cx: 123.1, cy: 66.7, r: 28 }),
      h('path', { className: 'doneart__sealtick', d: 'M109.6 66.4l9.2 9.6 18.7-18.2' }));
  }

  /* An empty state for a queue that is clear, as opposed to one that was never
     filled: `Empty` says "there is nothing here", this says "there is nothing left". */
  function Done(p) {
    return h('div', { className: 'done' },
      h(DoneArt, { size: p.size }),
      h('div', { className: 'stack gap-2' },
        h('h3', { className: 'done__title' }, p.title || 'All done'),
        p.body ? h('p', { className: 'done__body' }, p.body) : null),
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
          meta.section ? h(V.Chip, { size: 'sm', shape: 'tag', icon: I.file }, 'Section ' + meta.section) : null,
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
      /* A tab may keep a route of its own, so follow that where it has one —
         rebased onto the workspace doing the looking, since an inherited item
         names the one it was written for. */
      HRMS.router.go((tab && tab.route ? HRMS.nav.rebase(tab.route, role) : null)
        || (role + '/' + item.path + '/' + tab.path));
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

    /* A hidden tab still has a route — screens link straight to it — but it is not a
       place in the tab row, so it is kept out of what is drawn while staying in the
       lookup that decides which group is open. */
    var visible = item.tabs.filter(function (t) { return !t.hidden; });
    if (!visible.length) return null;

    /* A row of twelve tabs scrolls, and the tab you are on can be past its right edge
       — which reads as a row with nothing selected. Bring it into view when the row
       is drawn and whenever the selection moves. */
    var rowRef = React.useRef(null);
    React.useEffect(function () {
      var box = rowRef.current;
      if (!box) return;
      var on = box.querySelector('[aria-selected="true"]');
      if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, [active, item.path]);

    var groups = [];
    visible.forEach(function (t) { if (t.group && groups.indexOf(t.group) < 0) groups.push(t.group); });
    if (groups.length < 2) return h('div', { className: 'mtabs', ref: rowRef }, row(visible, 'underline', active, item.label));

    var activeTab = item.tabs.filter(function (t) { return t.path === active; })[0] || visible[0];
    var inGroup = visible.filter(function (t) { return t.group === activeTab.group; });
    /* The master row is keyed on its group's first tab, so selecting a group and
       landing on that tab are the same act and the row needs no state of its own. */
    var masters = groups.map(function (g) {
      var first = visible.filter(function (t) { return t.group === g; })[0];
      return { path: first.path, label: g, route: first.route };
    });
    var currentMaster = (visible.filter(function (t) { return t.group === activeTab.group; })[0] || visible[0]).path;

    return h('div', { className: 'mtabs', ref: rowRef },
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

  /* An assistant's suggestion: what it noticed, why, and the one thing it would do.
     Dismissing it is per-render and deliberate — a suggestion that cannot be waved
     away is a demand. */
  function Nudge(p) {
    var goneSt = React.useState(false);
    if (goneSt[0]) return null;
    return h('div', { className: 'ai-note' },
      h('span', { className: 'ai-note__mark' }, I.leo),
      h('div', { className: 'ai-note__body' },
        h('span', { className: 'ai-note__eyebrow' }, p.eyebrow || 'Assistant'),
        h('strong', { style: { fontSize: 15 } }, p.title),
        h('p', { className: 'ai-note__text' }, p.why),
        h('div', { className: 'ai-note__acts' },
          h(V.Button, {
            variant: 'primary', className: 'vi-btn--sm',
            onClick: function () { p.apply(); goneSt[1](true); }
          }, p.label),
          h(V.Button, {
            variant: 'ghost', className: 'vi-btn--sm', onClick: function () { goneSt[1](true); }
          }, 'Dismiss'))));
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

  /* Every overlay is rendered into <body> rather than where it is written.

     A modal is written inside the screen that opens it, which reads correctly and laid
     out wrongly: the admin dashboard wraps its content in `.adm > :not(.adm__glow) {
     position: relative }` to lift it above the blurred glow behind it, and that rule
     out-specifies `.modal__scrim { position: fixed }`, so the scrim became a relatively
     positioned block *in the page flow* and the dialog appeared below the fold instead
     of over it. Any ancestor with a transform, a filter or containment would have done
     the same thing, on any screen, and the next one would have been found the same way
     — by someone scrolling to look for a dialog.

     A portal ends the whole class of bug: an overlay's position in the DOM no longer
     depends on which screen opened it. */
  function portal(node) {
    return ReactDOM.createPortal(node, document.body);
  }

  /* ---------- Tip: what a mark stands for, on hover and on focus ----------

     A table that shows a category as an icon has to be able to say which category,
     and a status shown as a mark has to be able to say the rest — who holds it,
     since when, what condition it came back in. The native `title` attribute does
     that, badly: it waits a second, it cannot be reached from the keyboard, and it
     renders in the operating system's font rather than this one.

     The bubble is portalled to the body and positioned from the trigger's own
     rectangle, because every table wrapper in this application sets `overflow:
     hidden` to keep its columns in — an absolutely positioned bubble inside one is
     cut off at the cell edge, which is exactly where a tooltip is least useful. It
     opens on hover and on focus, closes on blur, leave and Escape, and the trigger
     carries `aria-describedby`, so what the sighted user reads on hover is what a
     screen reader is told. */
  function Tip(p) {
    var openSt = React.useState(null);
    var ref = React.useRef(null);
    var idRef = React.useRef(null);
    if (!idRef.current) { tipSeq += 1; idRef.current = 'tip-' + tipSeq; }
    var open = openSt[0];

    function show() {
      var el = ref.current;
      if (!el) return;
      var r = el.getBoundingClientRect();
      /* Centred on the trigger, but kept a bubble's half-width inside the window:
         the rightmost column of a wide table would otherwise put half of its own
         tooltip off-screen. 160 is half of the 320px the bubble is capped at. */
      var half = 160, pad = 8;
      var x = Math.round(r.left + r.width / 2);
      x = Math.max(half + pad, Math.min(window.innerWidth - half - pad, x));
      openSt[1]({ x: x, y: Math.round(r.top), bottom: Math.round(r.bottom) });
    }
    function hide() { openSt[1](null); }

    React.useEffect(function () {
      if (!open) return;
      function onKey(e) { if (e.key === 'Escape') hide(); }
      window.addEventListener('keydown', onKey);
      window.addEventListener('scroll', hide, true);
      return function () {
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('scroll', hide, true);
      };
    }, [!!open]);

    /* Above the trigger where there is room for it, below where there is not, so a
       row near the top of the viewport does not hide its own tooltip off-screen. */
    var above = !open || open.y > 120;
    var bubble = open ? portal(h('span', {
      className: 'vi-tip' + (above ? '' : ' vi-tip--below'), id: idRef.current, role: 'tooltip',
      style: { left: open.x + 'px', top: (above ? open.y : open.bottom) + 'px' }
    }, p.text)) : null;

    return h('span', {
      className: 'vi-tip__t' + (p.className ? ' ' + p.className : ''), ref: ref,
      tabIndex: p.focusable === false ? undefined : 0,
      'aria-describedby': open ? idRef.current : undefined,
      onMouseEnter: show, onMouseLeave: hide, onFocus: show, onBlur: hide
    }, p.children, bubble);
  }
  var tipSeq = 0;

  function Modal(p) {
    useEscape(p.onClose);
    return portal(h('div', {
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
        p.footer ? el('div', { className: 'modal__foot' }, p.footer) : null)));
  }

  function Drawer(p) {
    useEscape(p.onClose);
    return portal(h('div', {
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
        p.footer ? el('div', { className: 'drawer__foot' }, p.footer) : null)));
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
                h('span', { className: 'picker__meta' }, e.designation + ' · ' + e.id)),
              /* Optional per-row marker, so a caller can label where a candidate
                 came from without every picker in the app growing a chip. */
              p.badge ? p.badge(e) : null));
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

    /* A column may be for the export only. Folding one column's value into another
       cell — a request ID under the name it belongs to, a day count into the dates it
       counts — makes the table fit the card, but it would quietly drop the field from
       the spreadsheet, where there is no subtext line and someone is filtering on it.
       `csvOnly` keeps the column in the export and out of the table. */
    var shown = p.columns.filter(function (c) { return !c.csvOnly; });

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

    /* A table may own its heading. When it does, the title sits at the left of the
       toolbar row and the search, filters and Export line up with it, rather than the
       title sitting in a card head with a separate band of controls below it. */
    var hasToolbar = p.search || p.filters || p.onExport !== false || p.toolbar || p.actions || p.title;

    var controls = [
      p.search ? h('div', { className: 'filterbar__search', key: 's' },
        h(V.SearchField, {
          placeholder: p.searchPlaceholder || 'Search',
          value: qSt[0], onChange: function (e) { qSt[1](e.target.value); }
        })) : null,
      p.filters || null,
      p.toolbar || null,
      p.actions || null,
      p.onExport !== false
        ? h(V.Button, { key: 'x', variant: 'outline', className: 'vi-btn--sm', iconStart: I.download, onClick: exportCsv }, 'Export')
        : null
    ];

    return h(React.Fragment, null,
      /* The page's primary action, if this table was given one, onto the heading row. */
      p.headActions ? h(PageActions, null, p.headActions) : null,
      /* With a heading the controls are grouped, so when the row runs out of width
         they move under the heading together instead of the search staying put and
         the buttons dropping away from it one at a time. */
      hasToolbar ? (p.title
        ? h('div', { className: 'filterbar filterbar--titled' },
            h('div', { className: 'filterbar__head' },
              h('h2', { className: 'card__title' }, p.title),
              p.description ? h('p', { className: 'muted filterbar__desc' }, p.description) : null),
            el('div', { className: 'filterbar__tools' }, controls))
        : el('div', { className: 'filterbar' },
            [controls[0], controls[1], h('span', { className: 'filterbar__spacer', key: 'g' })]
              .concat(controls.slice(2)))) : null,
      rows.length
        ? h(React.Fragment, null,
            h(V.Table, {
              columns: shown, rows: view, selection: p.selection, density: p.density, tier: p.tier,
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
    PageHead: PageHead, PageActions: PageActions, Card: Card, Grid: Grid, Stat: Stat, Stats: Stats, KeyValue: KeyValue,
    Person: Person, StatusChip: StatusChip, statusTone: statusTone, Empty: Empty, Done: Done, DoneArt: DoneArt, Stub: Stub, ModuleTabs: ModuleTabs,
    DataTable: DataTable, Bars: Bars, Timeline: Timeline,
    Modal: Modal, Drawer: Drawer, Confirm: Confirm, portal: portal, Tip: Tip,
    useForm: useForm, FieldRow: FieldRow, FormSection: FormSection,
    EmployeePicker: EmployeePicker, Filter: Filter, Nudge: Nudge,
    toast: toast, report: report, ToastHost: ToastHost
  };
})();

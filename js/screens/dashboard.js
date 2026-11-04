/* The admin dashboard, from the aptaHR admin build.

   What it answers, in order: what Ara thinks needs doing, how big the organisation is,
   how the platform is holding up, what is queued against it, and what you might do next.

   Ara comes first because it is the only card that names work rather than measuring it —
   a reading of the other cards, put at the top so the page opens on what to do rather
   than on what is true. It can be closed, and closing it is remembered; the page head
   keeps a way back so dismissing it is not a one-way door.

   The counts are read from the store rather than typed in, so they stay honest when the
   seed changes. The series behind the usage chart is sample data: nothing in the
   prototype records history. */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var store = HRMS.store, router = HRMS.router, ui = HRMS.ui, seed = HRMS.seed;
  var useState = React.useState;

  /* ---------- glyphs the Tracklivo icon set does not carry ---------- */
  function g(d, s) {
    return h('svg', { viewBox: '0 0 24 24', width: s || 20, height: s || 20, fill: 'none', 'aria-hidden': 'true' },
      h('path', { d: d, stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }));
  }
  var CHECK = g('M5 13l4 4L19 7', 16);
  var UP = g('M7 14l5-5 5 5', 13);
  var TEAMS = g('M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c.4-3.3 3.3-5.8 7-5.8s6.6 2.5 7 5.8M17 11.2a2.6 2.6 0 1 0 0-5.2M18 14.4c2.3.5 4 2.4 4 4.6');
  var SYNC = g('M4 10a8 8 0 0 1 13.7-5.6L20 7M20 14a8 8 0 0 1-13.7 5.6L4 17M20 4v3h-3M4 20v-3h3');
  var CLOSE = g('M6 6l12 12M18 6L6 18', 16);

  var ARA_GLYPH = h('svg', { viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
    h('path', { d: 'M12 3.2l1.9 4.7 4.9 1.8-4.9 1.8L12 16.2l-1.9-4.7-4.9-1.8 4.9-1.8L12 3.2Z', fill: 'currentColor' }),
    h('circle', { cx: 18.4, cy: 17.6, r: 2.1, fill: 'currentColor', opacity: .85 }),
    h('circle', { cx: 6.2, cy: 18.4, r: 1.3, fill: 'currentColor', opacity: .6 }));

  function Ara(p) {
    return h('span', { className: 'ara ara--' + ((p && p.size) || 'md'), 'aria-hidden': 'true' }, ARA_GLYPH);
  }

  /* ---------- the card this page is built from ---------- */
  function Card(p) {
    return h('section', { className: 'dash__card ' + (p.span || 'c12') },
      h('div', { className: 'dash__card__head' },
        h('h2', null, p.title),
        p.right || null),
      p.children);
  }

  /* ---------- sample series: the prototype keeps no history ---------- */
  var USAGE = { Users: [200, 206, 215, 222, 233, 248], Storage: [41, 44, 48, 52, 58, 64] };
  var MONTHS = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];

  function Trend(p) {
    var data = USAGE[p.series], W = 900, H = 264, PL = 44, PR = 10, PT = 14, PB = 30;
    var lo = Math.min.apply(null, data), hi = Math.max.apply(null, data);
    var min = Math.floor((lo - (hi - lo) * 0.35) / 10) * 10;
    var max = Math.ceil((hi + (hi - lo) * 0.12) / 10) * 10;
    function x(i) { return PL + (i / (data.length - 1)) * (W - PL - PR); }
    function y(v) { return PT + (1 - (v - min) / (max - min)) * (H - PT - PB); }
    var line = data.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' ');
    var area = line + ' L' + x(data.length - 1).toFixed(1) + ' ' + (H - PB) + ' L' + x(0).toFixed(1) + ' ' + (H - PB) + ' Z';
    var ticks = [min, min + (max - min) / 2, max];

    return h('div', { className: 'chart' },
      h('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': p.series + ' from June to November' },
        h('defs', null, h('linearGradient', { id: 'dashTrend', x1: 0, y1: 0, x2: 0, y2: 1 },
          h('stop', { offset: 0, stopColor: 'var(--brand-solid)', stopOpacity: 0.22 }),
          h('stop', { offset: 1, stopColor: 'var(--brand-solid)', stopOpacity: 0 }))),
        ticks.map(function (t) {
          return h('g', { key: t },
            h('line', { x1: PL, x2: W - PR, y1: y(t), y2: y(t), stroke: 'var(--border-subtle)', strokeWidth: 1 }),
            h('text', { x: PL - 10, y: y(t) + 4, textAnchor: 'end', className: 'chart__ax' }, Math.round(t)));
        }),
        h('path', { d: area, fill: 'url(#dashTrend)' }),
        h('path', { d: line, fill: 'none', stroke: 'var(--brand-solid)', strokeWidth: 2.5, strokeLinejoin: 'round', strokeLinecap: 'round' }),
        data.map(function (v, i) {
          return h('circle', { key: i, cx: x(i), cy: y(v), r: 4, fill: 'var(--bg-surface)', stroke: 'var(--brand-solid)', strokeWidth: 2 });
        }),
        MONTHS.map(function (m, i) {
          return h('text', { key: m, x: x(i), y: H - 8, textAnchor: 'middle', className: 'chart__ax' }, m);
        })));
  }

  /* ---------- users by role ---------- */
  var RAMP = ['#3d2496', '#5733c1', '#7a5ad2', '#a690e4'];
  var ROLE_ORDER = ['me', 'manager', 'hr', 'admin'];
  var ROLE_NAME = { me: 'Employees', manager: 'Managers', hr: 'HR', admin: 'Admins' };

  function split() {
    var users = store.collection('users');
    return ROLE_ORDER.map(function (r) {
      return { k: ROLE_NAME[r], n: users.filter(function (u) { return u.role === r; }).length };
    }).filter(function (s) { return s.n; });
  }

  function Donut() {
    var rows = split();
    var total = rows.reduce(function (a, s) { return a + s.n; }, 0) || 1;
    var R = 62, C = 2 * Math.PI * R, GAP = 4, off = 0;
    return h('div', { className: 'donut' },
      h('div', { className: 'donut__svg' },
        h('svg', { viewBox: '0 0 168 168', 'aria-hidden': 'true' },
          rows.map(function (s, i) {
            var len = (s.n / total) * C, d = Math.max(len - GAP, 2), o = off;
            off += len;
            return h('circle', {
              key: s.k, cx: 84, cy: 84, r: R, fill: 'none', stroke: RAMP[i % RAMP.length], strokeWidth: 20,
              strokeDasharray: d + ' ' + (C - d), strokeDashoffset: -o, strokeLinecap: 'butt'
            });
          })),
        h('span', { className: 'donut__mid' }, h('span', null, h('b', null, total), h('span', null, 'Users')))),
      h('div', { className: 'donut__key' }, rows.map(function (s, i) {
        return h('div', { className: 'donut__row', key: s.k },
          h('span', { className: 'donut__dot', style: { background: RAMP[i % RAMP.length] } }),
          h('span', { className: 'donut__lbl' }, s.k),
          h('span', { className: 'donut__pc' }, Math.round((s.n / total) * 100) + '%'),
          h('span', { className: 'donut__n' }, s.n));
      })));
  }

  /* ---------- the fixed panels ---------- */
  var HEALTH = [
    { t: 'Core platform', s: 'Online', ok: true, icon: I.database },
    { t: 'Authentication (SSO)', s: 'Online', ok: true, icon: I.lock },
    { t: 'Integrations', s: '4 of 5 online', ok: false, icon: I.plug },
    { t: 'Data backup', s: 'Last backup 2 hrs ago', mut: true, icon: I.archive }
  ];

  var ARA_ITEMS = [
    { t: '3 users are exiting tomorrow', s: 'Their access stays open until someone closes it. I can schedule it for end of day.', a: 'Schedule disable', icon: I.logout, to: 'hr/people/exited' },
    { t: '2 accounts inactive for 30+ days', s: 'Rohit Shetty and one other. Deactivating frees two seats and closes a way in.', a: 'Review accounts', icon: I.person, to: 'admin/roles/review' },
    { t: '5 users hold more access than they use', s: 'None has used an approval right in 90 days. Worth stepping them down a level.', a: 'Adjust access', icon: I.shield, to: 'admin/roles/modules' },
    { t: 'Attendance sync failed 3 times yesterday', s: 'The Tally connector is timing out. Punches since Monday have not reached payroll.', a: 'Fix now', icon: SYNC, to: 'admin/integrations' }
  ];

  var REQS = [
    { t: 'New user access', n: 6, who: 'Engineering · Design', icon: I.person },
    { t: 'Role change', n: 4, who: 'HR Junior → HR Senior ×2', icon: I.shield },
    { t: 'Team or department access', n: 3, who: 'Finance · Sales', icon: TEAMS },
    { t: 'System access (integration)', n: 1, who: 'Tally', icon: I.plug }
  ];

  var LIFE = [
    { t: '3 employees exiting', d: 'Nov 04, 2026', act: 'Disable access', icon: I.logout },
    { t: '4 probation completions', d: 'Nov 07, 2026', act: 'Review', icon: I.calendar },
    { t: '7 document accesses expiring', d: 'Within 30 days', act: 'Notify users', icon: I.file }
  ];

  var QUICK = [
    { t: 'Add user', icon: I.person, to: 'admin/users/all' },
    { t: 'Manage roles', icon: I.shield, to: 'admin/roles/modules' },
    { t: 'Create team', icon: TEAMS, to: 'admin/org/teams' },
    { t: 'Org structure', icon: I.sitemap, to: 'admin/org/org-tree' },
    { t: 'Integrations', icon: I.plug, to: 'admin/integrations' },
    { t: 'Export audit', icon: I.download, to: 'admin/audit/export' }
  ];

  function greeting() {
    var hr = new Date().getHours();
    return hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  }

  /* ---------- the page ---------- */
  function AdminDashboard() {
    var seriesSt = useState('Users');
    var hidSt = useState(store.pref('araHidden') === true);
    var hidden = hidSt[0];

    var me = store.employeeByName(HRMS.nav.role('admin').persona);
    var users = store.collection('users');
    var reqTotal = REQS.reduce(function (a, r) { return a + r.n; }, 0);

    function hideAra(v) { hidSt[1](v); store.setPref('araHidden', v); }

    var KPI = [
      { l: 'Total users', n: users.length, ico: I.users, d: '+5.4%', dt: 'up', sub: 'vs last month', wave: true },
      { l: 'Departments', n: store.collection('departments').length, ico: I.sitemap, sub: 'across ' + seed.entities.length + (seed.entities.length === 1 ? ' entity' : ' entities') },
      { l: 'Teams', n: seed.teams.length, ico: TEAMS, sub: '6 without a lead' },
      { l: 'Roles', n: store.collection('roles').length, ico: I.shield, sub: '1 draft' },
      { l: 'Integrations', n: seed.integrations.length, ico: I.plug, d: '1 failing', dt: 'warn', sub: 'Tally since Monday' }
    ];

    return h('div', { className: 'stack gap-4 dash' },
      h('div', { className: 'ah' },
        h('div', null,
          h('h1', null, greeting() + ', ', h('em', null, me ? me.name.split(' ')[0] : 'there'), ' 👋'),
          h('p', null, 'Users, access, organisation and platform health.')),
        h('div', { className: 'row gap-2' },
          hidden
            ? h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.leo, onClick: function () { hideAra(false); } }, 'Show Ara')
            : null,
          h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.calendar, iconEnd: I.chevron,
            onClick: function () { ui.toast('Pick another period — not wired in the prototype.'); } },
            'Nov 1 – Nov 30, 2026'))),

      /* Ara leads: it is the only card that names work rather than measuring it. */
      hidden ? null : h('section', { className: 'dash__card dash__ara' },
        h('div', { className: 'dash__card__head' },
          h('h2', { className: 'row gap-2', style: { alignItems: 'center' } }, h(Ara, { size: 'sm' }), 'Ara'),
          h('div', { className: 'row gap-2', style: { alignItems: 'center' } },
            h('span', { className: 'tag2 tag2--brand' }, ARA_ITEMS.length + ' to look at'),
            h('button', {
              type: 'button', className: 'dash__x', 'aria-label': 'Hide Ara',
              onClick: function () { hideAra(true); ui.toast('Ara hidden. Bring it back from the top of the page.'); }
            }, CLOSE))),
        h('div', { className: 'cop cop--wide' }, ARA_ITEMS.map(function (c) {
          return h('div', { className: 'cop__i', key: c.t },
            h('span', { className: 'cop__ico' }, c.icon),
            h('span', { className: 'cop__m' },
              h('strong', null, c.t),
              h('span', null, c.s),
              h('button', { type: 'button', className: 'cop__a', onClick: function () { router.go(c.to); } }, c.a, I.right)));
        }))),

      h('div', { className: 'kpis' }, KPI.map(function (k) {
        return h('div', { className: 'kpi2' + (k.wave ? ' has-wave' : ''), key: k.l },
          h('div', { className: 'kpi2__top' },
            h('span', { className: 'kpi2__lbl' }, k.l),
            h('span', { className: 'kpi2__ico' }, k.ico)),
          h('span', { className: 'kpi2__n' }, k.n),
          h('div', { className: 'kpi2__foot' },
            k.d ? h('span', { className: 'delta delta--' + (k.dt === 'warn' ? 'warn' : 'up') }, k.dt === 'warn' ? I.warn : UP, k.d) : null,
            h('span', null, k.sub)),
          k.wave ? h('span', { className: 'kpi2__wave' },
            h('svg', { viewBox: '0 0 220 42', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
              h('defs', null, h('linearGradient', { id: 'dashKpi', x1: 0, y1: 0, x2: 0, y2: 1 },
                h('stop', { offset: 0, stopColor: 'var(--brand-solid)', stopOpacity: 0.2 }),
                h('stop', { offset: 1, stopColor: 'var(--brand-solid)', stopOpacity: 0 }))),
              h('path', { d: 'M0 34 C 30 30, 52 26, 78 24 S 128 18, 154 13 S 196 5, 220 2 L220 42 L0 42 Z', fill: 'url(#dashKpi)' }),
              h('path', { d: 'M0 34 C 30 30, 52 26, 78 24 S 128 18, 154 13 S 196 5, 220 2', fill: 'none', stroke: 'var(--brand-solid)', strokeWidth: 2 }))) : null);
      })),

      h('div', { className: 'agrid' },
        h(Card, { span: 'c8', title: 'Platform usage',
          right: h(V.SegmentedControl, { size: 'sm', value: seriesSt[0], onChange: seriesSt[1], items: ['Users', 'Storage'] }) },
          h(Trend, { series: seriesSt[0] })),

        h(Card, { span: 'c4', title: 'System health',
          right: h('span', { className: 'state state--ok' }, CHECK, 'Operational') },
          h('div', { className: 'lrows' }, HEALTH.map(function (x) {
            return h('div', { className: 'lrow', key: x.t },
              h('span', { className: 'lrow__ico' }, x.icon),
              h('span', { className: 'lrow__m' }, h('strong', null, x.t)),
              h('span', { className: 'state ' + (x.mut ? 'state--mut' : x.ok ? 'state--ok' : 'state--warn') },
                x.mut ? null : x.ok ? CHECK : I.warn, x.s));
          }))),

        h(Card, { span: 'c6', title: 'Pending access requests',
          right: h('span', { className: 'tag2 tag2--warn' }, reqTotal + ' waiting') },
          h('div', { className: 'lrows' }, REQS.map(function (r) {
            return h('div', { className: 'lrow', key: r.t },
              h('span', { className: 'lrow__ico' }, r.icon),
              h('span', { className: 'lrow__m' }, h('strong', null, r.t), h('span', null, r.who)),
              h('span', { className: 'lrow__n' }, r.n),
              h('button', { type: 'button', className: 'lrow__go', 'aria-label': 'Open ' + r.t,
                onClick: function () { router.go('admin/users/access'); } }, I.right));
          }))),

        h(Card, { span: 'c6', title: 'Upcoming lifecycle actions',
          right: h('button', { type: 'button', className: 'dash__link',
            onClick: function () { router.goAs('hr/people/all'); } }, 'This week', I.right) },
          h('div', { className: 'lrows' }, LIFE.map(function (l) {
            return h('div', { className: 'lrow', key: l.t },
              h('span', { className: 'lrow__ico' }, l.icon),
              h('span', { className: 'lrow__m' }, h('strong', null, l.t), h('span', null, l.d)),
              h(V.Button, { variant: 'outline', className: 'vi-btn--sm',
                onClick: function () { ui.toast(l.act + ' — not wired in the prototype.'); } }, l.act));
          }))),

        h(Card, { span: 'c6', title: 'Users by role',
          right: h('button', { type: 'button', className: 'dash__link',
            onClick: function () { router.go('admin/users/all'); } }, 'All users', I.right) },
          h(Donut)),

        h(Card, { span: 'c6', title: 'Quick actions' },
          h('div', { className: 'dash__qa' }, QUICK.map(function (q) {
            return h('button', { key: q.t, type: 'button', className: 'dash__qbtn',
              onClick: function () { router.go(q.to); } }, q.icon, h('span', null, q.t));
          })))));
  }

  HRMS.screens.register({ 'admin/dashboard': AdminDashboard });
})();

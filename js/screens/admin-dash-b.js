/* Admin dashboard, option B: the HRMS reference's content in option A's clothes.

   The reference attached for this one is a system overview — users and how many are
   active, how they grew, how they split by role, the roles themselves, the health of
   the platform, recent security activity and the organisation's setup. That is what
   this page shows, in that order. How it looks is option A's: the KPI strip on one card
   split by hairline rules, the dark circular icons, the four-step card shadow, the
   blurred ellipses, the Tracklivo palette.

   Where the reference shows a number the prototype cannot back, this page shows the
   nearest one it can. Nothing records failed sign-ins or service uptime, so the
   security strip counts what the audit log does hold, and the three platform services
   are fixed rows that say so here. Every other figure is counted from the store. */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var store = HRMS.store, router = HRMS.router, ui = HRMS.ui, seed = HRMS.seed;

  function g(d, s) {
    return h('svg', { viewBox: '0 0 24 24', width: s || 20, height: s || 20, fill: 'none', 'aria-hidden': 'true' },
      h('path', { d: d, stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }));
  }
  var CHECK = g('M5 13l4 4L19 7', 15);
  var UP = g('M7 14l5-5 5 5', 13);
  var USER_OK = g('M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20c.5-3.6 3.2-6 6.5-6 1.3 0 2.5.4 3.5 1M15 18l2 2 4-4.5', 18);
  var USER_OFF = g('M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20c.5-3.6 3.2-6 6.5-6 1.3 0 2.5.4 3.5 1M16 16l5 5M21 16l-5 5', 18);
  var PULSE = g('M3 12h4l2.5-6 4 12 2.5-6H21', 18);
  var KEY = g('M14.5 9.5a4 4 0 1 1-1.2-2.9M14.5 9.5L21 16v3h-3v-2h-2v-2h-2l-1.3-1.3', 18);

  var num = function (n) { return Number(n || 0).toLocaleString('en-IN'); };
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 864e5); }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var RAMP = ['var(--brand-solid)', '#8f73df', '#c3b3f1', 'var(--priority-high)'];

  function greeting() {
    var hr = new Date().getHours();
    return hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  }

  /* ---------- user growth: the directory's size on each of the last five weeks ----------
     Counted from joining dates, so the line is the directory as it actually stood. */
  function growth() {
    var emps = store.collection('employees');
    var today = new Date(seed.todayIso + 'T00:00');
    var pts = [];
    for (var w = 4; w >= 0; w--) {
      var d = new Date(today); d.setDate(d.getDate() - w * 7);
      var iso = d.toISOString().slice(0, 10);
      pts.push({
        label: d.getDate() + ' ' + MON[d.getMonth()],
        n: emps.filter(function (e) { return e.joined && e.joined <= iso && e.status !== 'Exited'; }).length
      });
    }
    return pts;
  }

  function GrowthChart(p) {
    var d = p.pts, W = 640, H = 220, PL = 40, PR = 14, PT = 16, PB = 28;
    var lo = Math.min.apply(null, d.map(function (x) { return x.n; }));
    var hi = Math.max.apply(null, d.map(function (x) { return x.n; }));
    /* Four even steps on whole fives, so the axis reads 230, 235, 240 rather than 236, 243. */
    var min = Math.floor((lo - 2) / 5) * 5;
    var stepSize = Math.max(5, Math.ceil((hi + 2 - min) / 4 / 5) * 5);
    var max = min + stepSize * 4;
    function x(i) { return PL + i / (d.length - 1) * (W - PL - PR); }
    function y(v) { return PT + (1 - (v - min) / (max - min || 1)) * (H - PT - PB); }
    /* A smooth curve through the points, as the reference draws it. */
    var path = d.map(function (pt, i) {
      if (!i) return 'M' + x(0) + ' ' + y(pt.n);
      var px = x(i - 1), py = y(d[i - 1].n), cx = (px + x(i)) / 2;
      return 'C' + cx + ' ' + py + ' ' + cx + ' ' + y(pt.n) + ' ' + x(i) + ' ' + y(pt.n);
    }).join(' ');
    var ticks = [];
    for (var t = 0; t <= 4; t++) ticks.push(min + stepSize * t);
    var last = d.length - 1;
    return h('div', { className: 'adm-plot' },
      h('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
        'aria-label': 'Users on the directory over five weeks, from ' + d[0].n + ' to ' + d[last].n },
        h('defs', null, h('linearGradient', { id: 'admbGrow', x1: 0, y1: 0, x2: 0, y2: 1 },
          h('stop', { offset: 0, stopColor: 'var(--brand-solid)', stopOpacity: .28 }),
          h('stop', { offset: 1, stopColor: 'var(--brand-solid)', stopOpacity: 0 }))),
        ticks.map(function (t) {
          return h('g', { key: t },
            h('line', { x1: PL, x2: W - PR, y1: y(t), y2: y(t), stroke: 'var(--border-subtle)' }),
            h('text', { x: PL - 9, y: y(t) + 4, textAnchor: 'end', className: 'adm-plot__ax' }, t));
        }),
        h('path', { d: path + ' L' + x(last) + ' ' + (H - PB) + ' L' + x(0) + ' ' + (H - PB) + ' Z', fill: 'url(#admbGrow)' }),
        h('path', { d: path, fill: 'none', stroke: 'var(--brand-solid)', strokeWidth: 2.4, strokeLinecap: 'round' }),
        h('circle', { cx: x(last), cy: y(d[last].n), r: 5, fill: 'var(--brand-solid)', stroke: 'var(--bg-surface)', strokeWidth: 2.5 }),
        d.map(function (pt, i) {
          return h('text', { key: i, x: x(i), y: H - 7, textAnchor: i === 0 ? 'start' : i === last ? 'end' : 'middle', className: 'adm-plot__ax' }, pt.label);
        })));
  }

  /* A ring split into the given shares, with a figure in the middle. */
  function Ring(p) {
    var total = p.rows.reduce(function (a, r) { return a + r.n; }, 0) || 1;
    var R = 62, C = 2 * Math.PI * R, GAP = 3, off = 0;
    return h('div', { className: 'admb-ring' },
      h('svg', { viewBox: '0 0 160 160', 'aria-hidden': 'true' },
        h('circle', { cx: 80, cy: 80, r: R, fill: 'none', stroke: 'var(--bg-muted)', strokeWidth: 18 }),
        p.rows.map(function (r, i) {
          var len = r.n / total * C, dash = Math.max(len - GAP, 1.5), o = off;
          off += len;
          return h('circle', { key: r.k, cx: 80, cy: 80, r: R, fill: 'none', stroke: RAMP[i % RAMP.length], strokeWidth: 18,
            strokeDasharray: dash + ' ' + (C - dash), strokeDashoffset: -o, transform: 'rotate(-90 80 80)' });
        })),
      h('span', { className: 'admb-ring__mid' }, h('b', null, num(p.center)), h('span', null, p.caption)));
  }

  /* The half-ring gauge the reference uses for roles. */
  function Gauge(p) {
    var total = p.rows.reduce(function (a, r) { return a + r.n; }, 0) || 1;
    var R = 70, C = Math.PI * R, GAP = 3, off = 0;
    return h('div', { className: 'admb-gauge' },
      h('svg', { viewBox: '0 0 180 104', 'aria-hidden': 'true' },
        h('path', { d: 'M20 92 A70 70 0 0 1 160 92', fill: 'none', stroke: 'var(--bg-muted)', strokeWidth: 20 }),
        p.rows.map(function (r, i) {
          var len = r.n / total * C, dash = Math.max(len - GAP, 1.5), o = off;
          off += len;
          return h('path', { key: r.k, d: 'M20 92 A70 70 0 0 1 160 92', fill: 'none', stroke: RAMP[i % RAMP.length], strokeWidth: 20,
            strokeDasharray: dash + ' ' + (C + 10), strokeDashoffset: -o });
        })),
      h('span', { className: 'admb-gauge__mid' }, h('b', null, p.center), h('span', null, p.caption)));
  }

  function Legend(p) {
    var total = p.rows.reduce(function (a, r) { return a + r.n; }, 0) || 1;
    return h('div', { className: 'admb-key' }, p.rows.map(function (r, i) {
      return h('div', { className: 'admb-key__r', key: r.k },
        h('i', { style: { background: RAMP[i % RAMP.length] } }),
        h('span', { className: 'grow' }, r.k),
        h('b', null, num(r.n)),
        /* A share that is real but rounds to nothing says so, rather than claiming 0%. */
        p.pct === false ? null : h('span', { className: 'admb-key__pc' },
          r.n && !pct(r.n, total) ? '<1%' : pct(r.n, total) + '%'));
    }));
  }

  function AdminDashB(p) {
    var users = store.collection('users');
    var s = store.stats();
    var today = seed.todayIso;

    /* Active means signed in during the last week; inactive is everyone else who has an
       account; pending is an invitation not yet accepted. Three readings of one list. */
    var pending = users.filter(function (u) { return u.status === 'Pending Invitation'; });
    var active = users.filter(function (u) { return u.lastSignIn && daysBetween(u.lastSignIn, today) <= 7; });
    var inactive = users.length - active.length - pending.length;
    var pts = growth();
    var grew = pts[0].n ? (pts[pts.length - 1].n - pts[0].n) / pts[0].n * 100 : 0;

    var ROLE_ORDER = [['me', 'Employees'], ['manager', 'Managers'], ['hr', 'HR'], ['admin', 'Admins']];
    var byRole = ROLE_ORDER.map(function (r) {
      return { k: r[1], n: users.filter(function (u) { return u.role === r[0]; }).length };
    }).filter(function (r) { return r.n; });

    var roles = store.collection('roles');
    /* In the same order as the distribution ring, so a role is the same colour in both. */
    var roleRows = ROLE_ORDER.map(function (o) { return roles.filter(function (r) { return r.id === o[0]; })[0]; })
      .filter(Boolean)
      .concat(roles.filter(function (r) { return !ROLE_ORDER.some(function (o) { return o[0] === r.id; }); }))
      .map(function (r) {
        return { k: r.name, n: users.filter(function (u) { return u.role === r.id; }).length };
      });

    var integrations = seed.integrations;
    var connected = integrations.filter(function (x) { return x.status === 'Connected'; }).length;
    /* The prototype keeps no heartbeat for the first three; they are fixed rows. The
       fourth is the integrations on record, so it can and does say when one is down. */
    var HEALTH = [
      { t: 'Application', ok: true, s: 'Operational' },
      { t: 'API services', ok: true, s: 'Operational' },
      { t: 'Database', ok: true, s: 'Operational' },
      { t: 'Integrations', ok: connected === integrations.length,
        s: connected === integrations.length ? 'Operational' : connected + ' of ' + integrations.length + ' connected' }
    ];
    var allOk = HEALTH.every(function (x) { return x.ok; });

    /* The security strip, from the audit log: what has actually been recorded. */
    var audit = store.collection('audit');
    function inLast(days, cat) {
      return audit.filter(function (a) {
        return (!cat || a.category === cat) && daysBetween(a.on.slice(0, 10), today) <= days;
      }).length;
    }
    var openAlerts = (integrations.length - connected) + 1;   // + single sign-on not configured
    var SECURITY = [
      { ico: I.lock, n: inLast(30, 'Security'), t: 'Security events', s: 'Last 30 days', to: 'admin/audit/security' },
      { ico: KEY, n: inLast(30, 'Configuration'), t: 'Configuration changes', s: 'Last 30 days', to: 'admin/audit/config' },
      { ico: I.users, n: inLast(30, 'Permissions'), t: 'Role changes', s: 'Last 30 days', to: 'admin/audit/permissions' },
      { ico: I.shield, n: openAlerts, t: 'Open alerts', s: 'SSO and integrations', to: 'admin/settings' }
    ];

    var org = seed.org;
    var SETUP = [
      { ico: I.sitemap, n: s.departments, t: 'Departments', to: 'admin/org/org-tree' },
      { ico: I.users, n: seed.teams.length, t: 'Teams', to: 'admin/org/teams' },
      { ico: I.world, n: s.locations, t: 'Locations', to: 'admin/org/locations' },
      { ico: I.calendar, n: (org.workWeek && org.workWeek.length) || 5, t: 'Working days a week', to: 'admin/org/workweek' },
      { ico: I.star, n: seed.holidays.length, t: 'Holidays', to: 'admin/org/workweek' }
    ];

    var KPIS = [
      { ico: I.users, t: 'Total users', s: '+' + s.newJoiners + ' this month', up: true, n: users.length },
      { ico: USER_OK, t: 'Active users', s: pct(active.length, users.length) + '% signed in this week', n: active.length },
      { ico: USER_OFF, t: 'Inactive users', s: pct(inactive, users.length) + '% quiet for over a week', n: inactive },
      { ico: I.mail, t: 'Pending invitations', s: 'Awaiting activation', warn: pending.length > 0, n: pending.length }
    ];

    return h('div', { className: 'adm' },
      h('div', { className: 'adm__glow', 'aria-hidden': 'true' }, h('i', null), h('i', null)),

      h('div', { className: 'adm__head' },
        h('div', null,
          h('span', { className: 'adm__eyebrow' }, 'System overview'),
          h('h1', null, greeting() + ', ', h('em', null, 'Admin')),
          h('div', { className: 'adm__status' },
            allOk ? h('b', null, CHECK, 'All systems operational')
              : h('b', { style: { color: 'var(--warning-fg)' } }, I.warn, 'One service needs attention'),
            h('i', null),
            h('span', null, 'Here’s the system overview for ' + seed.org.name))),
        p.switcher),

      h('section', { className: 'adm-card', style: { padding: 0 }, 'aria-label': 'Users' },
        h('div', { className: 'adm-kpis' }, KPIS.map(function (k) {
          return h('div', { className: 'adm-kpi', key: k.t },
            h('div', { className: 'adm-kpi__t' },
              h('span', { className: 'adm-ico' }, k.ico),
              h('span', { className: 'adm-kpi__l' }, h('strong', null, k.t),
                h('span', { className: k.up ? 'admb-up' : k.warn ? 'admb-warn' : null }, k.up ? UP : null, k.s))),
            h('span', { className: 'adm-kpi__n' }, num(k.n)));
        }))),

      h('div', { className: 'admb-two' },
        h('section', { className: 'adm-card' },
          h('div', { className: 'adm-card__head' },
            h('div', null,
              h('h2', null, 'User growth ', h('span', { className: 'adm-p adm-p--ok', style: { marginLeft: 6, verticalAlign: 2 } }, '+' + (Math.round(grew * 10) / 10) + '%')),
              h('p', null, 'Users on the directory, week by week')),
            h('span', { className: 'adm-pill' }, num(users.length) + ' users')),
          h(GrowthChart, { pts: pts })),
        h('section', { className: 'adm-card' },
          h('div', { className: 'adm-card__head' },
            h('div', null, h('h2', null, 'User distribution'), h('p', null, 'Accounts by role'))),
          h('div', { className: 'admb-split' },
            h(Ring, { rows: byRole, center: users.length, caption: 'Total users' }),
            h(Legend, { rows: byRole })))),

      h('div', { className: 'admb-two admb-two--even' },
        h('section', { className: 'adm-card' },
          h('div', { className: 'adm-card__head' },
            h('div', null, h('h2', null, 'Access & roles'), h('p', null, 'People holding each role')),
            h('button', { type: 'button', className: 'dash__link', onClick: function () { router.go('admin/roles/modules'); } }, 'Roles', I.right)),
          h('div', { className: 'admb-split' },
            h(Gauge, { rows: roleRows, center: roles.length, caption: 'Total roles' }),
            h(Legend, { rows: roleRows, pct: false }))),
        h('section', { className: 'adm-card' },
          h('div', { className: 'adm-card__head' },
            h('div', null, h('h2', null, 'System health'), h('p', null, 'Platform services and connectors')),
            h('span', { className: 'adm-pill' }, '99.9% uptime')),
          h('div', { className: 'admb-health' }, HEALTH.map(function (x) {
            return h('div', { className: 'admb-health__r', key: x.t },
              h('span', { className: 'admb-health__i ' + (x.ok ? 'is-ok' : 'is-warn') }, x.ok ? CHECK : I.warn),
              h('span', { className: 'grow' }, x.t),
              h('span', { className: 'adm-p adm-p--' + (x.ok ? 'ok' : 'warn') }, x.s));
          })))),

      h('section', { className: 'adm-card', style: { padding: 0 }, 'aria-label': 'Security and access' },
        h('div', { className: 'adm-card__head', style: { padding: '18px 22px 0' } },
          h('div', null, h('h2', null, 'Security & access'), h('p', null, 'From the audit log'))),
        h('div', { className: 'adm-kpis' }, SECURITY.map(function (k) {
          return h('button', { type: 'button', className: 'adm-kpi admb-kbtn', key: k.t, onClick: function () { router.go(k.to); } },
            h('div', { className: 'adm-kpi__t' },
              h('span', { className: 'adm-ico' }, k.ico),
              h('span', { className: 'adm-kpi__l' }, h('strong', null, k.t), h('span', null, k.s))),
            h('span', { className: 'adm-kpi__n', style: { fontSize: 34 } }, num(k.n)));
        }))),

      h('section', { className: 'adm-card' },
        h('div', { className: 'adm-card__head' },
          h('div', null, h('h2', null, 'Organisation setup'), h('p', null, 'What every other screen is configured against'))),
        h('div', { className: 'admb-setup' }, SETUP.map(function (x) {
          return h('button', { type: 'button', className: 'admb-tile', key: x.t, onClick: function () { router.go(x.to); } },
            h('span', { className: 'adm-ico' }, x.ico),
            h('b', null, num(x.n)),
            h('span', { className: 'admb-tile__l' }, x.t, I.right));
        }))));
  }

  HRMS.adminDashB = AdminDashB;
})();

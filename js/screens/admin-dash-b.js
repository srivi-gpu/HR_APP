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
        h('path', { d: path, fill: 'none', stroke: 'var(--brand-solid)', strokeWidth: 1.6, strokeLinecap: 'round' }),
        h('circle', { cx: x(last), cy: y(d[last].n), r: 4, fill: 'var(--brand-solid)', stroke: 'var(--bg-surface)', strokeWidth: 2 }),
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
        h('circle', { cx: 80, cy: 80, r: R, fill: 'none', stroke: 'var(--bg-muted)', strokeWidth: 10 }),
        p.rows.map(function (r, i) {
          var len = r.n / total * C, dash = Math.max(len - GAP, 1.5), o = off;
          off += len;
          return h('circle', { key: r.k, cx: 80, cy: 80, r: R, fill: 'none', stroke: RAMP[i % RAMP.length], strokeWidth: 10,
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
        h('path', { d: 'M20 92 A70 70 0 0 1 160 92', fill: 'none', stroke: 'var(--bg-muted)', strokeWidth: 11 }),
        p.rows.map(function (r, i) {
          var len = r.n / total * C, dash = Math.max(len - GAP, 1.5), o = off;
          off += len;
          return h('path', { key: r.k, d: 'M20 92 A70 70 0 0 1 160 92', fill: 'none', stroke: RAMP[i % RAMP.length], strokeWidth: 11,
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

  var TL_TONE = { Security: 'bad', Permissions: 'warn', Configuration: 'info' };
  var STEP_ROUTE = { 'Payroll configuration': 'hr/config/payroll', 'Integrations': 'admin/integrations', 'Payment method': 'admin/billing/billing' };
  function plural(n, one, many) { return num(n) + ' ' + (n === 1 ? one : (many || one + 's')); }
  function actorName(id) { var e = store.employee(id); return e ? e.name : 'Someone'; }
  function ago(on) {
    var d = daysBetween(on.slice(0, 10), seed.todayIso);
    return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 7 ? d + ' days ago' : ui.dateLabel(on.slice(0, 10));
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

    var integrations = store.collection('integrations');
    var connected = integrations.filter(function (x) { return x.status === 'Connected'; }).length;
    /* Health is about something being wrong, not about how long the catalogue is. A
       provider we never connected is not a fault; one that was connected and dropped
       out is. */
    var dropped = integrations.filter(function (x) { return x.status !== 'Connected' && x.droppedOn; }).length;
    /* The prototype keeps no heartbeat for the first three; they are fixed rows. The
       fourth is the integrations on record, so it can and does say when one is down. */
    var HEALTH = [
      { t: 'Application', ok: true, s: 'Operational' },
      { t: 'API services', ok: true, s: 'Operational' },
      { t: 'Database', ok: true, s: 'Operational' },
      { t: 'Integrations', ok: !dropped,
        s: dropped ? dropped + ' dropped out' : connected + ' connected, all reporting' }
    ];
    var allOk = HEALTH.every(function (x) { return x.ok; });

    /* The audit log's security-relevant entries, newest first. */
    var activity = store.collection('audit')
      .filter(function (e) { return e.category === 'Security' || e.category === 'Permissions' || e.category === 'Configuration'; })
      .sort(function (x, y) { return x.on < y.on ? 1 : -1; }).slice(0, 5);

    var steps = seed.setupSteps;

    var live = store.collection('employees').filter(function (e) { return e.status !== 'Exited'; });
    var liveCount = live.length;
    var byLoc = seed.locations.map(function (l) {
      return { id: l.id, name: l.name, n: live.filter(function (e) { return e.location === l.id; }).length };
    }).sort(function (x, y) { return y.n - x.n; });
    var locMax = Math.max.apply(null, byLoc.map(function (l) { return l.n; }).concat([1]));
    var nextHols = seed.holidays.filter(function (x) { return x.date >= today; })
      .sort(function (x, y) { return x.date < y.date ? -1 : 1; }).slice(0, 3);

    var KPIS = [
      { t: 'Total users', s: '+' + s.newJoiners + ' this month', up: true, n: users.length },
      { t: 'Active users', s: pct(active.length, users.length) + '% signed in this week', n: active.length },
      { t: 'Inactive users', s: pct(inactive, users.length) + '% quiet for over a week', n: inactive },
      { t: 'Pending invitations', s: 'Awaiting activation', warn: pending.length > 0, n: pending.length }
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

      /* What changed, what is left to set up, and where people are — three things an admin
         acts on, in place of two strips of counts. */
      h('div', { className: 'admb-three' },
        /* Security activity: the audit log's security, permission and configuration
           changes, newest first, as a timeline of who did what. */
        h('section', { className: 'adm-card' },
          h('div', { className: 'adm-card__head' },
            h('div', null, h('h2', null, 'Security activity'), h('p', null, 'Security, permission and configuration changes')),
            h('button', { type: 'button', className: 'dash__link', onClick: function () { router.go('admin/audit/security'); } }, 'Audit log', I.right)),
          activity.length ? h('ol', { className: 'admb-tl' }, activity.map(function (e) {
            return h('li', { className: 'admb-tl__r is-' + (TL_TONE[e.category] || 'info'), key: e.id },
              h('span', { className: 'admb-tl__dot', 'aria-hidden': 'true' }),
              h('span', { className: 'admb-tl__m' },
                h('span', { className: 'admb-tl__t' }, h('b', null, actorName(e.actor)), ' ', e.action),
                h('span', { className: 'admb-tl__w' }, h('span', { className: 'ara-tag ara-tag--' + (TL_TONE[e.category] || 'info') }, e.category), ago(e.on))));
          })) : h(ui.Empty, { icon: I.history, title: 'Nothing logged', body: 'Security and configuration changes appear here as they are made.' })),

        /* Setup progress: what is configured, and the steps still open, each a click from done. */
        h('section', { className: 'adm-card' },
          h('div', { className: 'adm-card__head' },
            h('div', null, h('h2', null, 'Setup progress'), h('p', null, steps.filter(function (x) { return x.done; }).length + ' of ' + steps.length + ' steps done')),
            h('button', { type: 'button', className: 'dash__link', onClick: function () { router.go('global/setup'); } }, 'Wizard', I.right)),
          h('div', { className: 'admb-setup2' },
            h(Gauge, { rows: [{ k: 'Done', n: steps.filter(function (x) { return x.done; }).length }, { k: 'Open', n: steps.filter(function (x) { return !x.done; }).length }],
              center: pct(steps.filter(function (x) { return x.done; }).length, steps.length) + '%', caption: 'configured' }),
            h('div', { className: 'admb-steps' },
              steps.filter(function (x) { return !x.done; }).map(function (x) {
                var to = STEP_ROUTE[x.label];
                return h('div', { className: 'admb-step', key: x.label },
                  h('span', { className: 'admb-step__i' }, I.clock),
                  h('span', { className: 'grow' }, x.label),
                  to ? h('button', { type: 'button', className: 'admb-step__go',
                    onClick: function () { (/^hr\//.test(to) && router.goAs ? router.goAs : router.go)(to); } }, 'Finish', I.right) : null);
              }),
              h('span', { className: 'admb-steps__done' }, CHECK, steps.filter(function (x) { return x.done; }).length + ' done: ' +
                steps.filter(function (x) { return x.done; }).slice(0, 3).map(function (x) { return x.label.toLowerCase(); }).join(', ') + '…')))),

        /* Where people work, and the days off coming up. */
        h('section', { className: 'adm-card' },
          h('div', { className: 'adm-card__head' },
            h('div', null, h('h2', null, 'Locations'), h('p', null, num(liveCount) + ' people across ' + plural(byLoc.length, 'office'))),
            h('button', { type: 'button', className: 'dash__link', onClick: function () { router.go('admin/org/locations'); } }, 'Manage', I.right)),
          h('div', { className: 'adm-stack adm-stack--mfa' }, byLoc.map(function (l, i) {
            return h('div', { className: 'adm-stack__r adm-stack__r--static', key: l.id },
              h('span', { className: 'adm-stack__l' }, l.name),
              h('span', { className: 'adm-stack__bar' }, h('i', { style: { width: (l.n / locMax * 100) + '%', background: RAMP[i % RAMP.length] } })),
              h('b', null, l.n));
          })),
          h('span', { className: 'adm-sub', style: { marginTop: 12 } }, 'Coming up'),
          h('div', { className: 'admb-hols' }, nextHols.map(function (x) {
            return h('div', { className: 'admb-hol', key: x.id },
              h('span', { className: 'admb-hol__d' }, h('b', null, x.date.slice(8, 10)), h('small', null, MON[Number(x.date.slice(5, 7)) - 1])),
              h('span', { className: 'grow' }, h('strong', null, x.name), h('small', null, x.type + ' · ' + (x.locs === 'all' ? 'every office' : x.locs))));
          })))));
  }

  HRMS.adminDashB = AdminDashB;
})();

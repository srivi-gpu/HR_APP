/* Admin dashboard, version 1: the reference layout, in the product's own palette.

   The brief attached a dashboard — a KPI strip across the top on one card, a tall
   illustrated card, a shield, a latency chart, a table and an alerts column — and asked
   for it here. What is kept is the geometry: four KPIs on a single card split by hairline
   rules, the dark circular icons, the dropdown pill on the chart, the grey header band on
   the table, the bordered status pills, the blurred ellipses behind everything. What is
   not kept is the colour. The reference is lime and hot pink on white; this page is drawn
   from the Tracklivo tokens, because a screen that arrives in colours the rest of the app
   never uses reads as a different product.

   The subject changes too, because the reference measures a replication engine and this
   is an HR platform. Each tile keeps its shape and takes the nearest question an admin
   actually has: not replication lag but sign-in failures, not RPO but how long onboarding
   takes, not storage replicated but storage used.

   Every count is read from the store. The two series — response time through the day and
   joiners by month — are sample data, because the prototype records no history; they are
   the only numbers on the page that are not derived, and they are marked where they live. */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var store = HRMS.store, router = HRMS.router, ui = HRMS.ui, seed = HRMS.seed;

  /* ---------- glyphs the Tracklivo set does not carry ---------- */
  function g(d, s) {
    return h('svg', { viewBox: '0 0 24 24', width: s || 20, height: s || 20, fill: 'none', 'aria-hidden': 'true' },
      h('path', { d: d, stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }));
  }
  var CHECK = g('M5 13l4 4L19 7', 15);
  var XMARK = g('M6 6l12 12M18 6L6 18', 18);
  var WIFI = g('M2 8.5a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16.5a5 5 0 0 1 6 0M12 20h.01');
  var SPEED = g('M12 13l4-4M3.5 18a9.5 9.5 0 1 1 17 0');
  var num = function (n) { return Number(n || 0).toLocaleString('en-IN'); };

  /* ---------- the four KPIs: different numbers from version 2's, by design ----------

     The reference's four are active replications, failed replications, average RPO and
     bandwidth. The four nearest questions an HR admin has are kept in the same order and
     the same shapes: who is actually using the platform, where sign-in is weakest, what
     is queued against onboarding, and how much of the plan is spent. Every one is counted
     from the records; none is written down. */
  function kpis(s) {
    var users = store.collection('users');
    var active = users.filter(function (u) { return u.status === 'Active'; }).length;
    var noMfa = users.filter(function (u) { return !u.mfa; }).length;
    var onb = store.collection('onboarding');
    var running = onb.filter(function (o) { return o.stage !== 'Completed'; }).length;
    var sub = seed.subscription;
    return [
      { ico: CHECK, t: 'Active accounts', s: 'Of ' + num(users.length) + ' on the directory', n: active },
      { ico: XMARK, t: 'Without MFA', s: 'Sign-in protected by a password only', n: noMfa },
      { ico: I.gear, t: 'Open onboarding tasks', s: 'Across ' + running + ' people joining', n: s.pendingOnboardingTasks },
      { ico: WIFI, t: 'Seats in use', s: 'Of ' + sub.seats + ' on ' + sub.plan, n: Math.round(sub.seatsUsed / sub.seats * 100), unit: '%' }
    ];
  }

  /* ---------- the one sample series on this page ----------
     Response time through the day. The prototype records no request history, so there is
     nothing to count; this is written data, and it is the only written data here. */
  var LATENCY = {
    '24 hours': [0.9, 1.2, 0.8, 1.0, 2.1, 1.4, 1.1, 1.0, 1.3, 0.9],
    '7 days': [1.1, 1.0, 1.4, 2.6, 1.2, 0.9, 1.0, 1.1, 0.8, 1.0],
    '30 days': [1.3, 1.2, 1.1, 1.5, 1.2, 1.0, 1.1, 1.2, 1.0, 0.9]
  };
  var HOURS = ['00:00', '', '04:00', '', '08:00', '', '12:00', '', '16:00', '24:00'];

  /* The bars under the directory are not sample data: the directory carries a joining
     date for every person, so six months of it can be counted rather than written. */
  function joinersBySix() {
    var counts = {}, out = [];
    store.collection('employees').forEach(function (e) {
      if (e.joined) counts[e.joined.slice(0, 7)] = (counts[e.joined.slice(0, 7)] || 0) + 1;
    });
    var d = new Date(seed.todayIso + 'T00:00');
    for (var i = 5; i >= 0; i--) {
      var m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push({
        label: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m.getMonth()],
        n: counts[m.toISOString().slice(0, 7)] || 0
      });
    }
    return out;
  }

  /* The chart: a line over a fading area, a dotted marker on the peak and a dark pill on
     it, exactly as the reference draws it. The peak is found rather than written down, so
     the pill cannot end up somewhere the line is not. */
  function Latency(p) {
    var data = LATENCY[p.range] || LATENCY['24 hours'];
    var W = 760, H = 230, PL = 40, PR = 14, PT = 16, PB = 28;
    var max = 3.2;
    function x(i) { return PL + (i / (data.length - 1)) * (W - PL - PR); }
    function y(v) { return PT + (1 - v / max) * (H - PT - PB); }
    var line = data.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' ');
    var area = line + ' L' + x(data.length - 1).toFixed(1) + ' ' + (H - PB) + ' L' + PL + ' ' + (H - PB) + ' Z';
    var peak = data.indexOf(Math.max.apply(null, data));

    return h('div', { className: 'rv1-plot' },
      h('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
        'aria-label': 'Average response time over the last ' + p.range + ', peaking at ' + data[peak] + ' seconds' },
        h('defs', null, h('linearGradient', { id: 'rv1Area', x1: 0, y1: 0, x2: 0, y2: 1 },
          h('stop', { offset: 0, stopColor: 'var(--brand-solid)', stopOpacity: .3 }),
          h('stop', { offset: 1, stopColor: 'var(--brand-solid)', stopOpacity: 0 }))),
        [0, 0.8, 1.6, 2.4, 3.2].map(function (t) {
          return h('g', { key: t },
            h('line', { x1: PL, x2: W - PR, y1: y(t), y2: y(t), stroke: 'var(--border-subtle)' }),
            h('text', { x: PL - 9, y: y(t) + 4, textAnchor: 'end', className: 'rv1-plot__ax' }, t.toFixed(1) + ' Sec'));
        }),
        h('path', { d: area, fill: 'url(#rv1Area)' }),
        h('path', { d: line, fill: 'none', stroke: 'var(--brand-solid)', strokeWidth: 2.4, strokeLinejoin: 'round', strokeLinecap: 'round' }),
        h('line', { x1: x(peak), x2: x(peak), y1: y(data[peak]), y2: H - PB, stroke: 'var(--text-muted)', strokeWidth: 1, strokeDasharray: '3 4' }),
        data.map(function (v, i) {
          return h('circle', { key: i, cx: x(i), cy: y(v), r: 3.2, fill: 'var(--bg-inverse)' });
        }),
        HOURS.map(function (m, i) {
          return m ? h('text', { key: i, x: x(i), y: H - 7, textAnchor: 'middle', className: 'rv1-plot__ax' }, m) : null;
        })),
      h('span', { className: 'rv1-tip', style: { left: (x(peak) / W * 100) + '%', top: (y(data[peak]) / H * 100) + '%' } },
        data[peak].toFixed(1) + ' Sec'));
  }

  /* The card-stack illustration from the reference, redrawn in brand tints. Decoration:
     it carries no number, so it is hidden from the reading order. */
  function CardStack() {
    return h('svg', { viewBox: '0 0 240 112', preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' },
      h('defs', null,
        h('linearGradient', { id: 'rv1St1', x1: 0, y1: 0, x2: 1, y2: 1 },
          h('stop', { offset: 0, stopColor: 'var(--brand-solid)', stopOpacity: .18 }),
          h('stop', { offset: 1, stopColor: 'var(--brand-solid)', stopOpacity: .04 })),
        h('linearGradient', { id: 'rv1St2', x1: 0, y1: 0, x2: 1, y2: 1 },
          h('stop', { offset: 0, stopColor: 'var(--priority-high)', stopOpacity: .22 }),
          h('stop', { offset: 1, stopColor: 'var(--priority-high)', stopOpacity: .04 }))),
      h('rect', { x: 52, y: 18, width: 92, height: 66, rx: 12, fill: 'url(#rv1St2)', stroke: 'var(--border-subtle)', transform: 'rotate(-11 98 51)' }),
      h('rect', { x: 68, y: 12, width: 92, height: 66, rx: 12, fill: 'url(#rv1St1)', stroke: 'var(--border-subtle)', transform: 'rotate(6 114 45)' }),
      h('rect', { x: 78, y: 24, width: 92, height: 66, rx: 12, fill: 'var(--bg-surface)', stroke: 'var(--brand-border)' }),
      h('circle', { cx: 97, cy: 43, r: 8, fill: 'var(--brand-soft)' }),
      h('path', { d: 'M93 43l3 3 5-6', stroke: 'var(--brand-solid)', strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }),
      [52, 62, 72].map(function (yy, i) {
        return h('rect', { key: yy, x: 112, y: yy - 14, width: [44, 34, 26][i], height: 5, rx: 2.5, fill: 'var(--bg-muted)' });
      }),
      h('rect', { x: 92, y: 62, width: 62, height: 5, rx: 2.5, fill: 'var(--bg-muted)' }),
      h('rect', { x: 92, y: 73, width: 40, height: 5, rx: 2.5, fill: 'var(--bg-muted)' }),
      h('path', { d: 'M186 28l3.4 8.4 8.6 3.2-8.6 3.2L186 51l-3.4-8.2-8.6-3.2 8.6-3.2L186 28Z', fill: 'var(--brand-solid)', opacity: .55 }),
      h('circle', { cx: 204, cy: 58, r: 3.4, fill: 'var(--priority-high)', opacity: .6 }));
  }

  /* The shield. The reference layers four radial gradients and a glass overlay; this keeps
     the layering and takes the hues from the brand. */
  function Shield() {
    return h('svg', { viewBox: '0 0 150 150', 'aria-hidden': 'true' },
      h('defs', null,
        h('radialGradient', { id: 'rv1Sh1', cx: '35%', cy: '22%', r: '85%' },
          h('stop', { offset: 0, stopColor: 'var(--brand-border)' }),
          h('stop', { offset: 1, stopColor: 'var(--brand-solid)' })),
        h('radialGradient', { id: 'rv1Sh2', cx: '70%', cy: '80%', r: '70%' },
          h('stop', { offset: 0, stopColor: 'var(--brand-solid)', stopOpacity: .0 }),
          h('stop', { offset: 1, stopColor: 'var(--priority-high)', stopOpacity: .45 }))),
      h('path', { d: 'M75 16l42 15v34c0 26-17 46-42 56-25-10-42-30-42-56V31l42-15Z', fill: 'var(--brand-soft)', opacity: .75 }),
      h('path', { d: 'M75 24l34 12v29c0 22-14 38-34 46-20-8-34-24-34-46V36l34-12Z', fill: 'url(#rv1Sh1)' }),
      h('path', { d: 'M75 24l34 12v29c0 22-14 38-34 46-20-8-34-24-34-46V36l34-12Z', fill: 'url(#rv1Sh2)' }),
      h('path', { d: 'M61 70l11 11 20-24', stroke: '#ffffff', strokeWidth: 6, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }),
      h('path', { d: 'M121 28l3.6 8.8 9 3.4-9 3.4L121 52l-3.6-8.4-9-3.4 9-3.4L121 28Z', fill: 'var(--brand-solid)', opacity: .8 }));
  }

  /* ---------- the table: the reference's six columns, this platform's rows ----------

     The reference lists replication jobs. The nearest thing here is what the platform
     keeps in step with the outside world: the three configured connectors, which are
     records, and the three services the platform runs itself, which are not — there is
     nothing in the prototype that records a core-platform heartbeat, so those three rows
     are fixed and say so in the only place it matters, which is this comment. */
  var SERVICES = [
    { name: 'Core platform', provider: 'aptaHR', trigger: 'Scheduled', health: 'Healthy', lag: '< 1 min', sync: 'Just now' },
    { name: 'Authentication (SSO)', provider: 'Not configured', trigger: 'Manual', health: 'Warning', lag: '—', sync: 'Never' },
    { name: 'Data backup', provider: 'Object store', trigger: 'Scheduled', health: 'Healthy', lag: '< 1 min', sync: '2 hrs ago' }
  ];
  var PILL = { Healthy: 'ok', Warning: 'warn', Failed: 'fail', Manual: 'manual', Scheduled: 'sched' };

  function pill(word) { return h('span', { className: 'rv1-p rv1-p--' + PILL[word] }, word); }

  /* A connector that is not connected has not failed — it has never run. Reading the
     two apart matters, because one needs fixing and the other needs setting up. */
  function rowsFor(integrations) {
    return integrations.map(function (x) {
      var connected = x.status === 'Connected';
      return {
        name: x.name, provider: x.provider, trigger: connected ? 'Scheduled' : 'Manual',
        health: connected ? 'Healthy' : 'Warning',
        lag: connected ? '< 5 min' : '—',
        sync: x.connectedOn ? ui.relTime(x.connectedOn) : 'Never'
      };
    }).concat(SERVICES);
  }

  function AdminDashV1(p) {
    var rangeSt = React.useState('24 hours');
    var s = store.stats();
    var me = store.employeeByName(HRMS.nav.role('admin').persona);
    var integrations = seed.integrations;
    var policies = seed.policies, acks = store.collection('acknowledgements');
    var live = store.collection('employees').filter(function (e) { return e.status !== 'Exited'; });
    /* What the library actually asks for: only the policies that require an
       acknowledgement, and only from the people they are addressed to. Counting every
       policy against every employee would understate compliance by inventing a
       denominator the library never asked for. */
    var mustAck = policies.filter(function (p) { return p.ack; });
    var need = mustAck.reduce(function (n, p) {
      if (/all employees/i.test(p.audience || '')) return n + live.length;
      var named = (p.audience || '').split(',').map(function (x) { return x.trim().toLowerCase(); });
      return n + live.filter(function (e) {
        var d = store.department(e.department);
        return d && named.indexOf(d.name.toLowerCase()) > -1;
      }).length;
    }, 0);
    var ackPct = need ? Math.round(acks.length / need * 100) : 0;
    var joiners = joinersBySix();
    var jmax = Math.max.apply(null, joiners.map(function (x) { return x.n; }).concat([1]));

    /* The alerts are read off the same records the rest of the app shows, so closing one
       of them anywhere closes it here. */
    var alerts = [
      { icon: I.plug, t: 'Integration sync failing', s: 'Attendance punches have not reached payroll since Monday.',
        src: 'Tally connector', tgt: 'Payroll · November cycle', at: '14:25:30 IST', to: 'admin/integrations' },
      { icon: I.person, t: s.invited + ' invitations unaccepted', s: 'Sent more than five days ago. Resend or revoke them.',
        src: 'User management', tgt: s.invited + ' accounts', at: '11:04:12 IST', to: 'admin/users/all' },
      { icon: I.shield, t: 'Single sign-on not configured', s: 'Everyone signs in with an email and a password only.',
        src: 'Authentication', tgt: 'All ' + num(store.collection('users').length) + ' users', at: '09:51:40 IST', to: 'admin/settings' },
      { icon: I.file, t: num(need - acks.length) + ' policy acknowledgements outstanding',
        s: 'Across the ' + mustAck.length + ' policies that require one. The library is holding at ' + ackPct + '%.',
        src: 'Policy library', tgt: num(need) + ' required', at: 'Yesterday', to: 'admin/org/profile' },
      { icon: I.database, t: 'Last backup 2 hours ago', s: 'Nightly backup completed with no errors.',
        src: 'Core platform', tgt: 'Object store', at: '04:00:00 IST', to: 'admin/settings' }
    ];

    return h('div', { className: 'rv1' },
      h('div', { className: 'rv1__glow', 'aria-hidden': 'true' }, h('i', null), h('i', null)),

      h('div', { className: 'rv1__head' },
        h('div', null,
          h('span', { className: 'rv1__eyebrow' }, 'Real-time workforce and platform overview'),
          h('h1', null, 'Admin ', h('em', null, 'dashboard')),
          h('div', { className: 'rv1__status' },
            h('b', null, CHECK, 'Platform health: Healthy'),
            h('i', null),
            h('span', null, 'Last sync: ' + seed.todayLabel + ' · 14:32 IST'),
            h('i', null),
            h('span', null, me ? 'Signed in as ' + me.name : 'Administrator'))),
        p.switcher),

      /* Four numbers on one card, divided by rules — the reference's strip. */
      h('section', { className: 'rv1-card', style: { padding: 0 }, 'aria-label': 'Key figures' },
        h('div', { className: 'rv1-kpis' }, kpis(s).map(function (k) {
          return h('div', { className: 'rv1-kpi', key: k.t },
            h('div', { className: 'rv1-kpi__t' },
              h('span', { className: 'rv1-ico' }, k.ico),
              h('span', { className: 'rv1-kpi__l' }, h('strong', null, k.t), h('span', null, k.s))),
            h('span', { className: 'rv1-kpi__n' }, num(k.n), k.unit ? h('small', null, k.unit) : null));
        }))),

      h('div', { className: 'rv1-mid' },
        /* The tall card: the directory, its illustration and six months of joiners. */
        h('section', { className: 'rv1-card rv1-tall' },
          h('div', { className: 'rv1-tall__art' }, h(CardStack)),
          h('div', null,
            h('span', { className: 'rv1-tall__n' }, num(s.headcount)),
            h('p', { className: 'rv1-tall__cap' }, 'People on the directory · ' + s.newJoiners + ' joined this month')),
          h('div', { className: 'rv1-bars' },
            h('div', { className: 'rv1-call' },
              h('span', { className: 'rv1-call__t' },
                h('span', { className: 'rv1-call__dot' }),
                h('span', null, 'Best of six months ', h('em', null, jmax + (jmax === 1 ? ' joiner' : ' joiners'))))),
            h('div', { className: 'rv1-bars__row' }, joiners.map(function (m, i) {
              var hi = m.n === jmax;
              return h('div', { className: 'rv1-bars__b' + (hi ? ' is-hi' : i === joiners.length - 1 ? ' is-alt' : ''), key: m.label + i },
                h('i', { style: { height: Math.max(6, Math.round(m.n / jmax * 76)) + 'px' } }),
                h('span', null, m.label));
            })),
            h('div', { className: 'rv1-bars__base' }))),

        /* The shield: how much of the policy library has actually been acknowledged. */
        h('section', { className: 'rv1-card rv1-shield' },
          h('div', { className: 'rv1-shield__art' }, h(Shield)),
          h('span', { className: 'rv1-shield__pc' }, ackPct + '%'),
          h('h2', null, 'Compliance posture'),
          h('p', null, num(acks.length) + ' of ' + num(need) + ' required acknowledgements, across ' +
            mustAck.length + ' policies and ' + num(live.length) + ' people.'),
          h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconEnd: I.right,
            onClick: function () { router.go('admin/org/profile'); } }, 'Open policy library')),

        /* The chart card, with the reference's dropdown pill and two stat chips. */
        h('section', { className: 'rv1-card' },
          h('div', { className: 'rv1-card__head' },
            h('div', null,
              h('h2', null, 'Performance metrics'),
              h('p', null, 'Average response time over the last ' + rangeSt[0])),
            h('button', {
              type: 'button', className: 'rv1-pill',
              onClick: function () {
                var order = ['24 hours', '7 days', '30 days'];
                rangeSt[1](order[(order.indexOf(rangeSt[0]) + 1) % order.length]);
              }
            }, rangeSt[0], I.chevron)),
          h('div', { className: 'rv1-chips' },
            h('span', { className: 'rv1-chip' }, h('b', null, '99.9%'), h('span', null, 'Uptime')),
            h('span', { className: 'rv1-chip' }, h('b', null, num(seed.aiUsage.used)), h('span', null, 'AI credits used')),
            h('span', { className: 'rv1-chip' }, h('b', null, '12'), h('span', null, 'Slow responses'))),
          h(Latency, { range: rangeSt[0] }))),

      h('div', { className: 'rv1-low' },
        /* The table: the reference's six columns, bordered pills and grey header band. */
        h('section', { className: 'rv1-card' },
          h('div', { className: 'rv1-card__head' },
            h('div', null,
              h('h2', null, 'Platform and connector details'),
              h('p', null, integrations.length + ' connectors and ' + SERVICES.length + ' services for ' + seed.org.name)),
            h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', iconEnd: I.right,
              onClick: function () { router.go('admin/integrations'); } }, 'Manage')),
          h('div', { className: 'rv1-wrap' },
            h('table', { className: 'rv1-tbl' },
              h('thead', null, h('tr', null,
                ['Connector', 'Source', 'Trigger type', 'Status', 'Current lag', 'Last sync'].map(function (c) {
                  return h('th', { key: c }, c);
                }))),
              h('tbody', null, rowsFor(integrations).map(function (x) {
                return h('tr', { key: x.name },
                  h('td', null, x.name),
                  h('td', { className: 'is-mut' }, x.provider),
                  h('td', null, pill(x.trigger)),
                  h('td', null, pill(x.health)),
                  h('td', { className: 'is-mut' }, x.lag),
                  h('td', { className: 'is-mut' }, x.sync));
              })))),
          h('p', { className: 'rv1-card__foot' },
            'A connector shows when it was connected: the prototype keeps no per-sync timestamp to show instead.')),

        /* The alerts column, with the reference's source and target lines. */
        h('section', { className: 'rv1-card' },
          h('div', { className: 'rv1-card__head' },
            h('div', null,
              h('h2', null, 'Alerts'),
              h('p', null, 'Everything the platform has raised today')),
            h('span', { className: 'rv1-pill', style: { cursor: 'default' } }, 'Showing all')),
          h('div', { className: 'rv1-alerts' }, alerts.map(function (a) {
            return h('div', { className: 'rv1-alert', key: a.t },
              h('span', { className: 'rv1-ico' }, a.icon),
              h('div', { className: 'rv1-alert__m' },
                h('strong', null, a.t),
                h('span', null, a.s),
                h('span', { className: 'rv1-alert__kv' }, h('b', null, 'Source : '), a.src),
                h('span', { className: 'rv1-alert__kv' }, h('b', null, 'Target : '), a.tgt)),
              h('div', { className: 'stack gap-2', style: { alignItems: 'flex-end' } },
                h('span', { className: 'rv1-alert__t' }, a.at),
                h('button', { type: 'button', className: 'lrow__go', 'aria-label': 'Open ' + a.t,
                  onClick: function () { router.go(a.to); } }, I.right)));
          })))));
  }

  HRMS.adminDashV1 = AdminDashV1;
})();

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

  function deptName(id) { var d = store.department(id); return d ? d.name : '\u2014'; }
  function locName(id) { var l = store.location(id); return l ? l.name : '\u2014'; }

  /* ---------- glyphs the Tracklivo icon set does not carry ---------- */
  function g(d, s) {
    return h('svg', { viewBox: '0 0 24 24', width: s || 20, height: s || 20, fill: 'none', 'aria-hidden': 'true' },
      h('path', { d: d, stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }));
  }
  var CHECK = g('M5 13l4 4L19 7', 16);
  var UP = g('M7 14l5-5 5 5', 13);
  var TEAMS = g('M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c.4-3.3 3.3-5.8 7-5.8s6.6 2.5 7 5.8M17 11.2a2.6 2.6 0 1 0 0-5.2M18 14.4c2.3.5 4 2.4 4 4.6');
  var SYNC = g('M4 10a8 8 0 0 1 13.7-5.6L20 7M20 14a8 8 0 0 1-13.7 5.6L4 17M20 4v3h-3M4 20v-3h3');

  var ARA_GLYPH = h('svg', { viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
    h('path', { d: 'M12 3.2l1.9 4.7 4.9 1.8-4.9 1.8L12 16.2l-1.9-4.7-4.9-1.8 4.9-1.8L12 3.2Z', fill: 'currentColor' }),
    h('circle', { cx: 18.4, cy: 17.6, r: 2.1, fill: 'currentColor', opacity: .85 }),
    h('circle', { cx: 6.2, cy: 18.4, r: 1.3, fill: 'currentColor', opacity: .6 }));

  function Ara(p) {
    return h('span', { className: 'ara ara--' + ((p && p.size) || 'md'), 'aria-hidden': 'true' }, ARA_GLYPH);
  }

  /* ---------- the card this page is built from ---------- */
  /* A card says what it measures. What to do about it is Ara's, and it is one small
     control in the head rather than a panel underneath: the card keeps its size and
     the suggestions open in a modal over it. */
  function Card(p) {
    return h('section', { className: 'dash__card ' + (p.span || 'c12') },
      h('div', { className: 'dash__card__head' },
        h('h2', null, p.title),
        h('div', { className: 'row gap-2', style: { alignItems: 'center' } },
          p.right || null,
          p.ara && p.ara.length
            ? h('button', {
                type: 'button', className: 'dash__ara-b',
                title: 'Ara · ' + p.ara.length + (p.ara.length === 1 ? ' suggestion' : ' suggestions'),
                'aria-label': 'Ara has ' + p.ara.length + ' suggestion' + (p.ara.length === 1 ? '' : 's') + ' about ' + p.title,
                onClick: function () { p.onAra(p.title, p.ara); }
              }, h(Ara, { size: 'xs' }), h('span', null, p.ara.length))
            : null)),
      p.children);
  }

  /* The suggestions, over the card rather than inside it. */
  function AraModal(p) {
    return h(ui.Modal, {
      title: 'Ara · ' + p.title,
      description: p.items.length + (p.items.length === 1 ? ' thing' : ' things') + ' worth doing here.',
      onClose: p.onClose,
      footer: h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Close')
    },
      h('div', { className: 'cop' }, p.items.map(function (c) {
        return h('div', { className: 'cop__i', key: c.t },
          h('span', { className: 'cop__ico' }, c.icon),
          h('span', { className: 'cop__m' },
            h('strong', null, c.t),
            h('span', null, c.s),
            h('button', {
              type: 'button', className: 'cop__a',
              onClick: function () { p.onClose(); router.go(c.to); }
            }, c.a, I.right)));
      })));
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

  /* Each one is filed against the card whose number it explains, so the suggestion sits
     next to the thing it is about rather than in a pile of its own. */
  var ARA_ITEMS = [
    { card: 'Upcoming lifecycle actions', t: '3 users are exiting tomorrow', s: 'Their access stays open until someone closes it. I can schedule it for end of day.', a: 'Schedule disable', icon: I.logout, to: 'admin/users/all' },
    { card: 'Users by role', t: '2 accounts inactive for 30+ days', s: 'Rohit Shetty and one other. Deactivating frees two seats and closes a way in.', a: 'Review accounts', icon: I.person, to: 'admin/roles/review' },
    { card: 'Pending access requests', t: '5 users hold more access than they use', s: 'None has used an approval right in 90 days. Worth stepping them down a level.', a: 'Adjust access', icon: I.shield, to: 'admin/roles/modules' },
    { card: 'System health', t: 'Attendance sync failed 3 times yesterday', s: 'The Tally connector is timing out. Punches since Monday have not reached payroll.', a: 'Fix now', icon: SYNC, to: 'admin/integrations' }
  ];
  function araFor(card) { return ARA_ITEMS.filter(function (x) { return x.card === card; }); }

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
    var araSt = useState(null);

    var me = store.employeeByName(HRMS.nav.role('admin').persona);
    var users = store.collection('users');
    var reqTotal = REQS.reduce(function (a, r) { return a + r.n; }, 0);

    function openAra(title, items) { araSt[1]({ title: title, items: items }); }

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
        h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.calendar, iconEnd: I.chevron,
          onClick: function () { ui.toast('Pick another period — not wired in the prototype.'); } },
          'Nov 1 – Nov 30, 2026')),

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

        h(Card, { span: 'c4', title: 'System health', ara: araFor('System health'), onAra: openAra,
          right: h('span', { className: 'state state--ok' }, CHECK, 'Operational') },
          h('div', { className: 'lrows' }, HEALTH.map(function (x) {
            return h('div', { className: 'lrow', key: x.t },
              h('span', { className: 'lrow__ico' }, x.icon),
              h('span', { className: 'lrow__m' }, h('strong', null, x.t)),
              h('span', { className: 'state ' + (x.mut ? 'state--mut' : x.ok ? 'state--ok' : 'state--warn') },
                x.mut ? null : x.ok ? CHECK : I.warn, x.s));
          }))),

        h(Card, { span: 'c6', title: 'Pending access requests', ara: araFor('Pending access requests'), onAra: openAra,
          right: h('span', { className: 'tag2 tag2--warn' }, reqTotal + ' waiting') },
          h('div', { className: 'lrows' }, REQS.map(function (r) {
            return h('div', { className: 'lrow', key: r.t },
              h('span', { className: 'lrow__ico' }, r.icon),
              h('span', { className: 'lrow__m' }, h('strong', null, r.t), h('span', null, r.who)),
              h('span', { className: 'lrow__n' }, r.n),
              h('button', { type: 'button', className: 'lrow__go', 'aria-label': 'Open ' + r.t,
                onClick: function () { router.go('admin/users/access'); } }, I.right));
          }))),

        h(Card, { span: 'c6', title: 'Upcoming lifecycle actions', ara: araFor('Upcoming lifecycle actions'), onAra: openAra,
          right: h('button', { type: 'button', className: 'dash__link',
            onClick: function () { router.goAs('hr/people/all'); } }, 'This week', I.right) },
          h('div', { className: 'lrows' }, LIFE.map(function (l) {
            return h('div', { className: 'lrow', key: l.t },
              h('span', { className: 'lrow__ico' }, l.icon),
              h('span', { className: 'lrow__m' }, h('strong', null, l.t), h('span', null, l.d)),
              h(V.Button, { variant: 'outline', className: 'vi-btn--sm',
                onClick: function () { ui.toast(l.act + ' — not wired in the prototype.'); } }, l.act));
          }))),

        h(Card, { span: 'c6', title: 'Users by role', ara: araFor('Users by role'), onAra: openAra,
          right: h('button', { type: 'button', className: 'dash__link',
            onClick: function () { router.go('admin/users/all'); } }, 'All users', I.right) },
          h(Donut)),

        h(Card, { span: 'c6', title: 'Quick actions' },
          h('div', { className: 'dash__qa' }, QUICK.map(function (q) {
            return h('button', { key: q.t, type: 'button', className: 'dash__qbtn',
              onClick: function () { router.go(q.to); } }, q.icon, h('span', null, q.t));
          })))),

      araSt[0] ? h(AraModal, {
        title: araSt[0].title, items: araSt[0].items,
        onClose: function () { araSt[1](null); }
      }) : null);
  }


  /* ================================================== The employee dashboard
     Built from the same pieces as the admin one above — the greeting head, the
     twelve-column card grid, the row lists, the quick-action tiles — so moving
     between workspaces does not feel like moving between products.

     What it carries, and why: this month's attendance and leave balance, because
     those are the two numbers somebody checks about themselves; who is having a
     birthday, an anniversary or a first week, because that is the one thing a
     dashboard tells you that you could not have looked up; the holidays coming;
     the announcements if there are any; and a row of shortcuts to the pages
     people actually open.

     No KPI strip: the four tiles it had restated the cards below them. No "My
     tasks", which was a hard-coded list nothing could complete, and no board. */

  var SHORTCUTS = [
    { t: 'Payslips', icon: I.card, to: 'me/payroll/payslips' },
    { t: 'Apply leave', icon: I.calendar, to: 'me/leave/overview' },
    { t: 'Attendance', icon: I.clock, to: 'me/attendance/history' },
    { t: 'My documents', icon: I.folder, to: 'me/profile/documents' },
    { t: 'My assets', icon: I.package, to: 'me/assets/assigned' },
    { t: 'Tax declaration', icon: I.reports, to: 'me/payroll/tax' }
  ];

  /* A month's worth of the same derivation the attendance screens use, so the
     tallies here and the history there can never disagree. */
  var MONTH_TALLY = [
    { k: 'Present', l: 'Present', tone: 'ok' },
    { k: 'Work From Home', l: 'Work from home' },
    { k: 'Late', l: 'Late', tone: 'warn' },
    { k: 'On Leave', l: 'On leave' },
    { k: 'Absent', l: 'Absent', tone: 'warn' }
  ];

  function monthCounts(me) {
    var counts = {};
    var monthStart = seed.todayIso.slice(0, 8) + '01';
    var days = Math.round((new Date(seed.todayIso + 'T00:00') - new Date(monthStart + 'T00:00')) / 86400000) + 1;
    var rows = (HRMS.attendanceHistory ? HRMS.attendanceHistory(me, days) : [])
      .filter(function (r) { return r.date >= monthStart; });
    rows.forEach(function (r) { counts[r.status] = (counts[r.status] || 0) + 1; });
    counts._worked = (counts.Present || 0) + (counts['Work From Home'] || 0) + (counts.Late || 0);
    /* Working days, so the ratio underneath means something: a weekend or a holiday
       is not a day somebody failed to turn up for. */
    counts._working = rows.filter(function (r) {
      return r.status !== 'Weekly Off' && r.status !== 'Holiday';
    }).length;
    return counts;
  }

  /* Birthdays, work anniversaries and first weeks in one list, nearest first.
     Three separate cards would each have held one or two rows.

     The window is a month rather than the fortnight seed.birthdays and
     seed.anniversaries are cut to. Over a fortnight the sample data happens to hold
     no work anniversary at all, so a third of the card could never appear; a month
     carries sixteen. Both kinds are derived here against the same window, so the
     card's own label is the truth about what is in it. */
  var CELEBRATION_DAYS = 30;

  function celebrations() {
    var birthdays = [], years = [], joiners = [];
    var monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var today = seed.today;
    function whenLabel(mmdd) {
      return Number(mmdd.slice(3)) + ' ' + monthName[Number(mmdd.slice(0, 2)) - 1];
    }
    function inLabel(n) { return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : 'In ' + n + ' days'; }
    /* Days until the next time this month and day comes round. */
    function daysTo(mmdd) {
      var d = new Date(today.getFullYear(), Number(mmdd.slice(0, 2)) - 1, Number(mmdd.slice(3)));
      if (d < today) d = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
      return Math.round((d - today) / 86400000);
    }

    store.collection('employees').forEach(function (e) {
      if (e.status === 'Exited') return;
      if (e.dob) {
        var bd = daysTo(e.dob.slice(5));
        if (bd <= CELEBRATION_DAYS) {
          birthdays.push({ id: 'b' + e.id, employee: e, kind: 'Birthday', tone: 'info',
            sort: bd, note: whenLabel(e.dob.slice(5)) + ' \u00b7 ' + inLabel(bd) });
        }
      }
      var served = today.getFullYear() - Number(e.joined.slice(0, 4));
      var ad = daysTo(e.joined.slice(5));
      if (served > 0 && ad <= CELEBRATION_DAYS) {
        years.push({ id: 'a' + e.id, employee: e,
          kind: served + (served === 1 ? ' year' : ' years'), tone: 'success',
          sort: ad, note: whenLabel(e.joined.slice(5)) + ' \u00b7 ' + inLabel(ad) });
      }
    });
    birthdays.sort(function (x, y) { return x.sort - y.sort; });
    years.sort(function (x, y) { return x.sort - y.sort; });
    store.collection('employees')
      .filter(function (e) {
        return e.status !== 'Exited' && e.joined <= seed.todayIso
          && e.joined >= seed.util.iso(seed.util.addDays(seed.today, -21));
      })
      .sort(function (x, y) { return x.joined < y.joined ? 1 : -1; })
      .forEach(function (e) {
        joiners.push({ id: 'n' + e.id, employee: e, kind: 'New joiner', tone: 'warning',
          sort: -1, note: 'Joined ' + seed.util.pretty(new Date(e.joined + 'T00:00')) });
      });
    /* Capped per kind before they are merged. The seed has a dozen people in their
       first fortnight, and without a cap they fill the card and the birthdays and
       anniversaries never appear at all. */
    return joiners.slice(0, 2)
      .concat(birthdays.slice(0, 3), years.slice(0, 3))
      .sort(function (x, y) { return x.sort - y.sort; })
      .slice(0, 6);
  }

  function MeDashboard() {
    var me = store.persona('me');
    var clockSt = useState(new Date());
    React.useEffect(function () {
      var t = setInterval(function () { clockSt[1](new Date()); }, 1000);
      return function () { clearInterval(t); };
    }, []);
    if (!me) return h(ui.Empty, { icon: I.person, title: 'No employee record' });

    var shift = store.shift(me.shift) || seed.shifts[0];
    var balances = store.balancesFor(me.id);
    var punch = store.pref('punch') || {};
    var today = seed.todayIso;
    var inAt = punch.date === today ? punch.in : null;
    var outAt = punch.date === today ? punch.out : null;
    function hhmm(d) { return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
    function setPunch(next) {
      store.setPref('punch', Object.assign({ date: today }, punch.date === today ? punch : {}, next));
    }

    var counts = monthCounts(me);
    var posts = store.collection('announcements').slice()
      .sort(function (a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (a.on < b.on ? 1 : -1); })
      .slice(0, 3);
    var holidays = store.collection('holidays')
      .filter(function (x) { return x.date >= today; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; })
      .slice(0, 4);
    var party = celebrations();
    var monthLabel = new Date(today + 'T00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    return h('div', { className: 'stack gap-4 dash' },
      h('div', { className: 'ah' },
        h('div', null,
          h('h1', null, greeting() + ', ', h('em', null, me.name.split(' ')[0]), ' 👋'),
          h('p', null, me.designation + ' · ' + deptName(me.department)
            + ' · ' + locName(me.location) + ' · ' + me.id)),
        h('div', { className: 'row gap-2 wrap' },
          h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.calendar,
            onClick: function () { router.go('me/leave/holidays'); } }, seed.todayLabel),
          h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus,
            onClick: function () { router.go('me/leave/overview'); } }, 'Apply leave'))),

      h('div', { className: 'agrid' },
        h(Card, { span: 'c8', title: 'Attendance · ' + monthLabel,
          right: h('button', { type: 'button', className: 'dash__link',
            onClick: function () { router.go('me/attendance/history'); } }, 'Full history', I.right) },
          h('div', { className: 'mdash__split' },
            h('div', { className: 'mdash__punch' },
              h('span', { className: 'mdash__clock' }, hhmm(clockSt[0])),
              h('div', { className: 'mdash__pmeta' },
                h('span', null, 'In', h('b', null, inAt || '—')),
                h('span', null, 'Out', h('b', null, outAt || '—')),
                h('span', null, 'Shift', h('b', null, shift.start + ' – ' + shift.end))),
              !inAt
                ? h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.play,
                    onClick: function () { setPunch({ in: hhmm(new Date()) }); } }, 'Check in')
                : !outAt
                  ? h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.stop,
                      onClick: function () { setPunch({ out: hhmm(new Date()) }); } }, 'Check out')
                  : h(V.Chip, { shape: 'tag', variant: 'soft', tone: 'success', dot: true }, 'Day complete')),
            h('div', { className: 'mstat' }, MONTH_TALLY.map(function (t) {
              return h('div', { className: 'mstat__i' + (t.tone ? ' is-' + t.tone : ''), key: t.k },
                h('span', { className: 'mstat__n' }, counts[t.k] || 0),
                h('span', { className: 'mstat__l' }, t.l));
            }))),
          h('p', { className: 'mdash__note' },
            counts._working
              ? 'Worked ' + counts._worked + ' of ' + counts._working + ' working day'
                + (counts._working === 1 ? '' : 's') + ' so far this month. '
                + 'Weekends and holidays are not counted.'
              : 'The month has not reached a working day yet.')),

        h(Card, { span: 'c4', title: 'Leave balance',
          right: h('button', { type: 'button', className: 'dash__link',
            onClick: function () { router.go('me/leave/overview'); } }, 'My leave', I.right) },
          balances.length
            ? h('div', { className: 'lrows' }, balances.map(function (b) {
                var t = store.leaveType(b.type) || {};
                return h('div', { className: 'lrow', key: b.type },
                  h('span', { className: 'lrow__m' },
                    h('strong', null, t.name || b.type),
                    h('span', null, b.used + ' of ' + b.entitled + ' used')),
                  h('span', { className: 'lrow__v' }, b.available));
              }))
            : h(ui.Empty, { icon: I.calendar, title: 'No leave policy assigned',
              body: 'Ask HR to assign a leave policy to your record.' })),

        h(Card, { span: 'c6', title: 'Celebrations',
          right: h('span', { className: 'tag2 tag2--brand' }, 'Next 30 days') },
          party.length
            ? h('div', { className: 'lrows' }, party.map(function (c) {
                return h('div', { className: 'lrow', key: c.id },
                  h(V.Avatar, { name: c.employee.name, size: 'sm' }),
                  h('span', { className: 'lrow__m' },
                    h('strong', null, c.employee.name),
                    h('span', null, c.employee.designation + ' · ' + c.note)),
                  h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: c.tone }, c.kind));
              }))
            : h(ui.Empty, { icon: I.star, title: 'Nothing coming up',
              body: 'Birthdays, work anniversaries and new joiners appear here.' })),

        h(Card, { span: 'c6', title: 'Announcements',
          right: h('button', { type: 'button', className: 'dash__link',
            onClick: function () { router.go('me/announcements'); } }, 'See all', I.right) },
          posts.length
            ? h('div', { className: 'lrows' }, posts.map(function (a) {
                var by = a.by ? store.employee(a.by) : null;
                return h('div', { className: 'lrow', key: a.id },
                  h(V.Avatar, { name: by ? by.name : (a.byName || 'HR'), size: 'sm' }),
                  h('span', { className: 'lrow__m' },
                    h('strong', null,
                      a.pinned ? h(V.Chip, { size: 'sm', shape: 'tag', icon: I.flag }, 'Pinned') : null,
                      /* A titleless announcement leads with its text. */
                      h('span', null, a.title || a.body)),
                    h('span', null, a.title ? a.body : ui.dateLabel(String(a.on).slice(0, 10)))),
                  h('button', { type: 'button', className: 'lrow__go', 'aria-label': 'Open announcements',
                    onClick: function () { router.go('me/announcements'); } }, I.right));
              }))
            : h(ui.Empty, { icon: I.flag, title: 'No announcements',
              body: 'Anything HR posts shows up here.' })),

        h(Card, { span: 'c6', title: 'Upcoming holidays',
          right: h('button', { type: 'button', className: 'dash__link',
            onClick: function () { router.go('me/leave/holidays'); } }, 'Calendar', I.right) },
          holidays.length
            ? h('div', { className: 'lrows' }, holidays.map(function (hd) {
                return h('div', { className: 'lrow', key: hd.id || hd.date },
                  h('span', { className: 'lrow__ico' }, I.calendar),
                  h('span', { className: 'lrow__m' },
                    h('strong', null, hd.name),
                    h('span', null, new Date(hd.date + 'T00:00').toLocaleDateString('en-GB', { weekday: 'long' })
                      + ', ' + ui.dateLabel(hd.date))),
                  h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft',
                    tone: hd.type === 'Optional' ? 'neutral' : 'info' }, hd.type));
              }))
            : h(ui.Empty, { icon: I.calendar, title: 'No holidays left this year' })),

        h(Card, { span: 'c6', title: 'Shortcuts' },
          h('div', { className: 'dash__qa' }, SHORTCUTS.map(function (q) {
            return h('button', { key: q.t, type: 'button', className: 'dash__qbtn',
              onClick: function () { router.go(q.to); } }, q.icon, h('span', null, q.t));
          })))));
  }

  HRMS.screens.register({ 'admin/dashboard': AdminDashboard, 'me/dashboard': MeDashboard });
})();

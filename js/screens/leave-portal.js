/* The leave portal (PRD 4.10–4.14), for the Employee workspace and for HR.

   Leave was reachable from both workspaces but not gathered anywhere: the employee could
   apply, read a balance and list their history on three unrelated tabs, with no way to
   see what was coming, who else would be away, or which holidays were near. "How much
   leave do I have and can I take it next Thursday" took three screens and a guess.

   The portal answers that on one: what is left, what is already booked, who else from the
   team is out, and which holidays fall nearby. The calendar and the holiday list come with
   it, and the balance can be opened to the ledger that produced it.

   Everything here is scoped to the signed-in employee, as PRD 16.6 requires of this
   workspace. The team view names only who is away and when — the reason is not theirs to
   read, and is not shown. */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var store = HRMS.store, router = HRMS.router, ui = HRMS.ui, seed = HRMS.seed;
  var Card = ui.Card, Grid = ui.Grid, Stat = ui.Stat, Stats = ui.Stats;

  function me() { return store.persona('me'); }
  function emp(id) { return store.employee(id); }
  function typeName(id) { var t = store.leaveType(id); return t ? t.name : id; }
  function typeCode(id) { var t = store.leaveType(id); return t ? t.code : ''; }

  function myRequests(id) {
    return store.collection('leaveRequests').filter(function (l) { return l.employee === id; });
  }

  /* Who else is away, and when. Colleagues are the people sharing a department: the ones
     whose absence actually lands on the same work. */
  function teamAway(m, fromIso, toIso) {
    var mates = {};
    store.collection('employees').forEach(function (e) {
      if (e.department === m.department && e.status !== 'Exited') mates[e.id] = e;
    });
    return store.collection('leaveRequests')
      .filter(function (l) {
        return mates[l.employee] && l.status === 'Approved' && l.to >= fromIso && l.from <= toIso;
      })
      .sort(function (a, b) { return a.from < b.from ? -1 : 1; });
  }

  function holidaysAhead(n) {
    var today = seed.todayIso;
    return store.collection('holidays')
      .filter(function (hd) { return hd.date >= today; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; })
      .slice(0, n || 99);
  }

  function addDays(iso, n) {
    var d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  /* ----------------------------------------------------------- The ledger
     Shared with the HR balances screen: one balance, every line that moved it. */
  function Ledger(p) {
    var lines = store.collection('leaveLedger')
      .filter(function (l) { return l.employee === p.employee && l.type === p.type; })
      .slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var running = 0;
    var rows = lines.map(function (l) { running += l.days; return { l: l, at: Math.round(running * 10) / 10 }; });

    return h(ui.Drawer, { title: typeName(p.type) + ' · how it adds up', onClose: p.onClose },
      h(ui.KeyValue, { rows: [
        ['Leave type', typeName(p.type) + ' (' + typeCode(p.type) + ')'],
        ['Entries', rows.length],
        ['Closing balance', (rows.length ? rows[rows.length - 1].at : 0) + ' days']
      ]}),
      h('div', { className: 'lrows', style: { marginTop: 14 } }, rows.map(function (x) {
        var neg = x.l.days < 0;
        return h('div', { className: 'lrow', key: x.l.id },
          h('span', { className: 'lrow__ico' }, neg ? I.logout : I.plus),
          h('span', { className: 'lrow__m' },
            h('strong', null, x.l.kind),
            h('span', null, ui.dateLabel(x.l.date) + ' · ' + x.l.note)),
          h('span', { style: { fontWeight: 500, color: neg ? 'var(--warning-fg)' : 'var(--success-fg)' } },
            (neg ? '' : '+') + x.l.days),
          h('span', { className: 'muted', style: { width: 52, textAlign: 'right' } }, x.at));
      })),
      rows.length ? null : h(ui.Empty, { icon: I.calendar, title: 'Nothing has moved this balance yet' }));
  }

  /* ------------------------------------------------------ Employee overview */
  function MyLeaveOverview() {
    var m = me();
    var ledgerSt = React.useState(null);
    if (!m) return h(ui.Empty, { icon: I.person, title: 'No employee record' });

    var today = seed.todayIso;
    var balances = store.balancesFor(m.id);
    var mine = myRequests(m.id);
    var pending = mine.filter(function (l) { return /pending/i.test(l.status); });
    var booked = mine.filter(function (l) { return l.status === 'Approved' && l.to >= today; })
      .sort(function (a, b) { return a.from < b.from ? -1 : 1; });
    var available = balances.reduce(function (n, b) { return n + b.available; }, 0);
    var carried = balances.reduce(function (n, b) { return n + (b.carried || 0); }, 0);
    /* The department first, since that is whose absence lands on the same work. Where
       nobody there is away the card widens to the organization rather than sitting empty,
       and says which it is showing. */
    var away = teamAway(m, today, addDays(today, 28));
    var wide = false;
    if (!away.length) {
      wide = true;
      away = store.collection('leaveRequests').filter(function (l) {
        return l.status === 'Approved' && l.to >= today && l.from <= addDays(today, 28);
      }).sort(function (a, b) { return a.from < b.from ? -1 : 1; });
    }
    var hols = holidaysAhead(5);

    return h(React.Fragment, null,
      h(ui.PageHead, {
        eyebrow: seed.todayLabel, title: 'My leave',
        description: available + ' days available across ' + balances.length + ' leave types'
          + (pending.length ? ' · ' + pending.length + ' request' + (pending.length === 1 ? '' : 's') + ' awaiting a decision' : '')
          + '.',
        actions: [
          h(V.Button, { key: 'a', variant: 'outline', iconStart: I.calendar,
            onClick: function () { router.go('me/leave/calendar'); } }, 'Who is away'),
          h(V.Button, { key: 'b', variant: 'primary', iconStart: I.plus,
            onClick: function () { router.go('me/leave/apply'); } }, 'Apply for leave')
        ]
      }),

      h(Stats, null,
        h(Stat, { label: 'Available', value: available, unit: 'days', tone: 'good',
          sub: carried ? carried + ' carried from last year' : 'Across every type you hold' }),
        h(Stat, { label: 'Awaiting a decision', value: pending.length,
          sub: pending.length ? 'With ' + (emp(pending[0].approver) || {}).name : 'Nothing pending',
          tone: pending.length ? 'warn' : 'good',
          onClick: function () { router.go('me/leave/history'); } }),
        h(Stat, { label: 'Booked ahead', value: booked.reduce(function (n, l) { return n + l.days; }, 0), unit: 'days',
          sub: booked.length ? 'Next on ' + ui.dateLabel(booked[0].from) : 'Nothing booked' }),
        h(Stat, { label: 'Next holiday', value: hols.length ? ui.dateLabel(hols[0].date).replace(/,.*/, '') : '—',
          sub: hols.length ? hols[0].name : 'None left this year' })),

      h(Grid, null,
        h(Card, { span: 7, title: 'What you have left',
          description: 'Open a type to see every line that moved it.' },
          balances.length
            ? h('div', { className: 'lrows' }, balances.map(function (b) {
                return h('div', { className: 'lrow', key: b.type },
                  h('span', { className: 'lrow__ico' }, I.calendar),
                  h('span', { className: 'lrow__m' },
                    h('strong', null, typeName(b.type)),
                    h('span', null, b.entitled + ' entitled · ' + b.used + ' used'
                      + (b.carried ? ' · ' + b.carried + ' carried in' : '')
                      + (b.encashed ? ' · ' + b.encashed + ' encashed' : ''))),
                  h('span', { style: { width: 110 } },
                    h(V.ProgressBar, { value: ui.pct(b.used, b.entitled + (b.carried || 0)), size: 'sm',
                      tone: b.available <= 1 ? 'warning' : 'primary', 'aria-label': typeName(b.type) })),
                  h('strong', { style: { width: 64, textAlign: 'right', fontWeight: 500 } }, b.available + 'd'),
                  h('button', { type: 'button', className: 'lrow__go', 'aria-label': 'Ledger for ' + typeName(b.type),
                    onClick: function () { ledgerSt[1](b.type); } }, I.right));
              }))
            : h(ui.Empty, { icon: I.calendar, title: 'No leave types on your policy' })),

        h(Card, { span: 5, title: wide ? 'Away, next four weeks' : 'Your team, next four weeks',
          description: wide
            ? 'Nobody in ' + (store.department(m.department) || {}).name + ' is away, so this is everyone. Reasons are not shown.'
            : 'Who is away in ' + (store.department(m.department) || {}).name + '. Reasons are not shown.' },
          away.length
            ? h('div', { className: 'lrows' }, away.slice(0, 7).map(function (l) {
                var e = emp(l.employee);
                return h('div', { className: 'lrow', key: l.id },
                  h(V.Avatar, { name: e ? e.name : l.employee, size: 'sm' }),
                  h('span', { className: 'lrow__m' },
                    h('strong', null, e ? e.name : l.employee),
                    h('span', null, ui.dateLabel(l.from) + ' – ' + ui.dateLabel(l.to) + ' · ' + l.days + ' day' + (l.days === 1 ? '' : 's'))),
                  l.employee === m.id ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info' }, 'You') : null);
              }))
            : h(ui.Empty, { icon: I.users, title: 'Nobody is away', body: 'Everyone is in for the next four weeks.' })),

        h(Card, { span: 12, title: 'Holidays ahead',
          aside: h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', iconEnd: I.right,
            onClick: function () { router.go('me/leave/holidays'); } }, 'All holidays') },
          hols.length
            ? h('div', { className: 'row gap-2 wrap' }, hols.map(function (hd) {
                return h(V.Chip, { key: hd.date, size: 'sm', shape: 'tag',
                  variant: hd.type === 'Optional' ? 'outline' : 'soft',
                  tone: hd.type === 'Optional' ? 'neutral' : 'info' },
                  ui.dateLabel(hd.date) + ' · ' + hd.name);
              }))
            : h(ui.Empty, { icon: I.star, title: 'No holidays left this year' }))),

      ledgerSt[0] ? h(Ledger, { employee: m.id, type: ledgerSt[0], onClose: function () { ledgerSt[1](null); } }) : null);
  }

  /* ------------------------------------------------------ Employee calendar
     A month of the team's approved leave against the holiday calendar, so cover can be
     seen before a day is asked for. */
  function MyLeaveCalendar() {
    var m = me();
    var offsetSt = React.useState(0);
    if (!m) return h(ui.Empty, { icon: I.person, title: 'No employee record' });

    var base = new Date(seed.todayIso + 'T00:00:00');
    base.setDate(1);
    base.setMonth(base.getMonth() + offsetSt[0]);
    var year = base.getFullYear(), month = base.getMonth();
    var first = new Date(year, month, 1), last = new Date(year, month + 1, 0);
    function iso(d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    var fromIso = iso(first), toIso = iso(last);

    var away = teamAway(m, fromIso, toIso);
    var hols = {};
    store.collection('holidays').forEach(function (hd) { if (hd.date >= fromIso && hd.date <= toIso) hols[hd.date] = hd; });

    /* One cell per day, with who is away on it. */
    var days = [];
    for (var d = 1; d <= last.getDate(); d++) {
      var cellIso = iso(new Date(year, month, d));
      var dow = new Date(year, month, d).getDay();
      days.push({
        iso: cellIso, d: d, weekend: dow === 0 || dow === 6, holiday: hols[cellIso],
        people: away.filter(function (l) { return l.from <= cellIso && l.to >= cellIso; })
      });
    }
    var label = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    return h(React.Fragment, null,
      h(ui.PageHead, {
        eyebrow: 'My leave', title: 'Who is away',
        description: 'Approved leave across ' + (store.department(m.department) || {}).name
          + ', against the holiday calendar. Reasons are not shown.',
        actions: [
          h(V.Button, { key: 'p', variant: 'outline', iconStart: I.back, onClick: function () { offsetSt[1](offsetSt[0] - 1); } }, 'Previous'),
          h(V.Button, { key: 'n', variant: 'outline', iconEnd: I.right, onClick: function () { offsetSt[1](offsetSt[0] + 1); } }, 'Next')
        ]
      }),
      h(Card, { title: label, aside: h(V.Chip, { size: 'sm', shape: 'tag' }, away.length + ' booked') },
        h('div', { className: 'lcal' },
          ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (w) {
            return h('span', { className: 'lcal__h', key: w }, w);
          }),
          /* Pad to the Monday the month starts after. */
          Array.apply(null, Array((first.getDay() + 6) % 7)).map(function (_, i) {
            return h('span', { className: 'lcal__pad', key: 'p' + i });
          }),
          days.map(function (c) {
            var cls = 'lcal__d' + (c.weekend ? ' is-off' : '') + (c.holiday ? ' is-hol' : '')
              + (c.iso === seed.todayIso ? ' is-today' : '');
            return h('span', { className: cls, key: c.iso, title: c.holiday ? c.holiday.name : undefined },
              h('span', { className: 'lcal__n' }, c.d),
              c.holiday ? h('span', { className: 'lcal__tag' }, c.holiday.name) : null,
              c.people.length
                ? h('span', { className: 'lcal__who' }, c.people.slice(0, 3).map(function (l) {
                    var e = emp(l.employee);
                    return h(V.Avatar, { key: l.id, name: e ? e.name : l.employee, size: 'xs' });
                  }), c.people.length > 3 ? h('span', { className: 'lcal__more' }, '+' + (c.people.length - 3)) : null)
                : null);
          }))),
      h('p', { className: 'muted', style: { fontSize: 12 } },
        'Weekends and holidays are shaded. A day with people on it shows who, not why.'));
  }

  /* ----------------------------------------------------- Employee holidays */
  function MyHolidays() {
    var today = seed.todayIso;
    var rows = store.collection('holidays').slice()
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var left = rows.filter(function (hd) { return hd.date >= today; });
    var optional = rows.filter(function (hd) { return hd.type === 'Optional'; });

    return h(React.Fragment, null,
      h(ui.PageHead, {
        eyebrow: 'My leave', title: 'Holiday calendar',
        description: 'The holidays this organization observes. Optional ones are taken by request.'
      }),
      h(Stats, { cols: 3 },
        h(Stat, { label: 'Holidays this year', value: rows.length }),
        h(Stat, { label: 'Still to come', value: left.length, tone: 'good',
          sub: left.length ? 'Next on ' + ui.dateLabel(left[0].date) : 'None left' }),
        h(Stat, { label: 'Optional', value: optional.length, sub: 'Taken by request, not automatic' })),
      h(Card, { title: 'All holidays' },
        h(ui.DataTable, {
          exportName: 'holidays', label: 'Holidays', rows: rows.map(function (hd, i) {
            return { id: hd.date + '-' + i, date: hd.date, name: hd.name, type: hd.type };
          }), pageSize: 15,
          columns: [
            { key: 'date', header: 'Date', sortable: true, cell: function (x) { return ui.dateLabel(x.date); } },
            { key: 'name', header: 'Holiday', sortable: true, cell: function (x) { return h('strong', null, x.name); } },
            { key: 'type', header: 'Type', cell: function (x) {
                return h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft',
                  tone: x.type === 'Optional' ? 'neutral' : 'info' }, x.type);
              } },
            { key: 'when', header: '', align: 'right', csv: false, cell: function (x) {
                return x.date < seed.todayIso
                  ? h('span', { className: 'muted' }, 'Passed')
                  : h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'success' }, 'Ahead');
              } }
          ]
        })));
  }

  HRMS.screens.register({
    'me/leave/overview': MyLeaveOverview,
    'me/leave/calendar': MyLeaveCalendar,
    'me/leave/holidays': MyHolidays
  });

  /* The HR balances screen opens the same ledger. */
  HRMS.screens.Ledger = Ledger;
})();

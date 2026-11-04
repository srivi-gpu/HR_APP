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
  var act = HRMS.actions;
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
  /* =========================================================== My leave
     One screen, where there used to be six tabs. The balances sit across the top and
     every request sits under them, because "can I take Friday off" was a question that
     needed the balance, the history and the team calendar, and they were three places.

     Apply, the team calendar, the old balance and history screens keep their routes and
     are reached from here; they are no longer tabs of their own. */
  function LeaveStatusCell(p) {
    var l = p.request;
    var decided = l.decidedBy ? emp(l.decidedBy) : null;
    var tone = /pending/i.test(l.status) ? 'warning'
      : l.status === 'Approved' ? 'success'
        : l.status === 'Rejected' ? 'error' : 'neutral';
    return h('span', { className: 'lstatus' },
      h(ui.StatusChip, { status: l.status, tone: tone }),
      decided && l.status !== 'Pending Approval'
        ? h('span', { className: 'lstatus__by' }, 'by ' + decided.name)
        : null);
  }

  /* Changing a request that nobody has decided yet. Once it is approved the dates are
     somebody else's plan too, so the row offers nothing but cancel. */
  function EditLeaveModal(p) {
    var l = p.request;
    var form = ui.useForm({ from: l.from, to: l.to, reason: l.reason || '' });
    function save() {
      var res = form.submit(function (v) { return ui.report(act.updateLeaveRequest(l.id, v)); });
      if (res && res.ok) p.onClose();
    }
    var calc = form.values.from && form.values.to && form.values.from <= form.values.to
      ? HRMS.rules.countLeaveDays(form.values.from, form.values.to, l.halfDay) : null;
    return h(ui.Modal, {
      title: 'Edit this request',
      description: typeName(l.type) + ' · ' + l.id + ', still awaiting a decision.',
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
        h(V.Button, { variant: 'primary', onClick: save }, 'Save changes'))
    },
      h(ui.FieldRow, { cols: 2 },
        h(V.DateField, Object.assign({ label: 'From', required: true }, form.field('from'))),
        h(V.DateField, Object.assign({ label: 'To', required: true }, form.field('to')))),
      calc
        ? h('p', { className: 'muted', style: { fontSize: 12, margin: '-4px 0 10px' } },
          calc.total + ' working day' + (calc.total === 1 ? '' : 's')
          + (calc.weekends ? ', ' + calc.weekends + ' weekend day' + (calc.weekends === 1 ? '' : 's') : '')
          + (calc.holidays ? ' and ' + calc.holidays + ' holiday' + (calc.holidays === 1 ? '' : 's') : '')
          + (calc.weekends || calc.holidays ? ' excluded.' : '.'))
        : null,
      h(V.TextArea, Object.assign({ label: 'Reason', rows: 3 }, form.field('reason'))),
      /* A refusal may key on something this form has no field for — the type's own
         limits, for one — so anything not bound to a field is shown here rather than
         living only in a toast that fades. */
      (function () {
        var loose = Object.keys(form.errors || {})
          .filter(function (k) { return ['from', 'to', 'reason'].indexOf(k) < 0; })
          .map(function (k) { return form.errors[k]; });
        return loose.length
          ? h('p', { style: { color: 'var(--danger-fg)', fontSize: 13, margin: 0 } }, loose.join(' · '))
          : null;
      }()));
  }

  /* What a month of this type is worth, capped by what is actually left. The strip
     shows the year on top and this underneath, so a balance reads as "what I have" and
     "what I can take now" rather than one number doing both jobs. */
  function availableThisMonth(b) {
    if (!b.entitled) return b.available;
    return Math.max(0, Math.min(b.available, Math.ceil(b.entitled / 12)));
  }

  /* Applying, in one dialog: what kind, when, how long, and why. Nothing else — the
     notice periods, the document rules and the rest are the approver's business, and
     the action refuses with the reason if one of them is not met. */
  function ApplyLeaveModal(p) {
    var balances = p.balances;
    var form = ui.useForm({ type: balances.length ? balances[0].type : '', from: '', to: '', reason: '' });
    var v = form.values;
    var calc = v.from && v.to && v.from <= v.to
      ? HRMS.rules.countLeaveDays(v.from, v.to, false) : null;

    function save() {
      var res = form.submit(function (vals) {
        return ui.report(act.applyLeave(p.employee, {
          type: vals.type, from: vals.from, to: vals.to, reason: vals.reason
        }));
      });
      if (res && res.ok) p.onClose();
    }

    return h(ui.Modal, {
      title: 'Apply leave',
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
        h(V.Button, { variant: 'primary', onClick: save }, 'Apply'))
    },
      h(V.Select, Object.assign({
        label: 'Leave type', required: true,
        options: balances.map(function (b) {
          return { value: b.type, label: typeName(b.type) + ' · ' + b.available + ' available' };
        })
      }, form.select('type'))),
      h(ui.FieldRow, { cols: 2 },
        h(V.DateField, Object.assign({ label: 'From', required: true }, form.field('from'))),
        h(V.DateField, Object.assign({ label: 'To', required: true }, form.field('to')))),
      h(V.TextField, {
        label: 'Duration', readOnly: true, value: calc ? calc.total + (calc.total === 1 ? ' day' : ' days') : '',
        placeholder: 'Set both dates',
        hint: calc && (calc.weekends || calc.holidays)
          ? (calc.weekends ? calc.weekends + ' weekend day' + (calc.weekends === 1 ? '' : 's') : '')
            + (calc.weekends && calc.holidays ? ' and ' : '')
            + (calc.holidays ? calc.holidays + ' holiday' + (calc.holidays === 1 ? '' : 's') : '')
            + ' excluded'
          : 'Counted from the dates, weekends and holidays excluded'
      }),
      h(V.TextArea, Object.assign({
        label: 'Reason', rows: 3, required: true, placeholder: 'Why you need the time off'
      }, form.field('reason'))),
      (function () {
        var loose = Object.keys(form.errors || {})
          .filter(function (k) { return ['type', 'from', 'to', 'reason'].indexOf(k) < 0; })
          .map(function (k) { return form.errors[k]; });
        return loose.length
          ? h('p', { style: { color: 'var(--danger-fg)', fontSize: 13, margin: 0 } }, loose.join(' \u00b7 '))
          : null;
      }()));
  }

  function MyLeaveOverview() {
    var m = me();
    var ledgerSt = React.useState(null);
    var editSt = React.useState(null);
    var cancelSt = React.useState(null);
    var applySt = React.useState(false);
    var typeSt = React.useState('');
    var statusSt = React.useState('');
    var yearSt = React.useState('');
    if (!m) return h(ui.Empty, { icon: I.person, title: 'No employee record' });

    var balances = store.balancesFor(m.id);
    var mine = myRequests(m.id).slice().sort(function (a, b) { return a.from < b.from ? 1 : -1; });

    var years = [];
    mine.forEach(function (l) {
      var y = String(l.from).slice(0, 4);
      if (years.indexOf(y) < 0) years.push(y);
    });
    years.sort().reverse();

    var rows = mine;
    if (typeSt[0]) rows = rows.filter(function (l) { return l.type === typeSt[0]; });
    if (statusSt[0]) rows = rows.filter(function (l) { return l.status === statusSt[0]; });
    if (yearSt[0]) rows = rows.filter(function (l) { return String(l.from).slice(0, 4) === yearSt[0]; });

    var target = cancelSt[0] ? store.find('leaveRequests', cancelSt[0]) : null;

    return h(React.Fragment, null,
      h(ui.PageHead, {
        title: 'Leave',
        description: 'What you have left, and every request you have made.',
        actions: [
          h(V.Button, { key: 'w', variant: 'outline', iconStart: I.calendar,
            onClick: function () { router.go('me/leave/calendar'); } }, 'Who is away'),
          h(V.Button, { key: 'a', variant: 'primary', iconStart: I.plus,
            onClick: function () { applySt[1](true); } }, 'Apply leave')
        ]
      }),

      /* The balance strip. Each cell opens the ledger behind its number. */
      balances.length ? h('div', { className: 'lbal' }, balances.map(function (b) {
        var total = b.entitled + (b.carried || 0);
        return h('button', {
          type: 'button', className: 'lbal__cell linklike', key: b.type,
          title: 'Every line behind ' + typeName(b.type),
          onClick: function () { ledgerSt[1](b.type); }
        },
          h('span', { className: 'lbal__n' }, b.available, h('small', null, '/' + total)),
          h('span', { className: 'lbal__t' }, typeName(b.type)),
          h('span', { className: 'lbal__s' }, 'Available (this month)', h('b', null, availableThisMonth(b))));
      })) : null,

      h(Card, {
        title: 'Applied leaves',
        description: 'Edit or cancel a request while it is still waiting on a decision.'
      },
        h(ui.DataTable, {
          exportName: 'my-leave', label: 'Applied leaves', rows: rows, pageSize: 10,
          search: function (l) { return typeName(l.type) + ' ' + (l.reason || '') + ' ' + l.status; },
          searchPlaceholder: 'Search your requests',
          filters: h(React.Fragment, null,
            h(ui.Filter, {
              label: 'Leave type', value: typeSt[0], onChange: typeSt[1],
              options: balances.map(function (b) { return { value: b.type, label: typeName(b.type) }; })
            }),
            h(ui.Filter, {
              label: 'Status', value: statusSt[0], onChange: statusSt[1],
              options: ['Pending Approval', 'Approved', 'Rejected', 'Cancelled']
            }),
            h(ui.Filter, { label: 'Year', value: yearSt[0], onChange: yearSt[1], options: years })),
          columns: [
            { key: 'type', header: 'Leave type', sortable: true,
              sortValue: function (l) { return typeName(l.type); },
              csv: function (l) { return typeName(l.type); },
              cell: function (l) { return h('span', { style: { color: 'var(--text-brand)' } }, typeName(l.type)); } },
            { key: 'from', header: 'From', sortable: true, cell: function (l) { return ui.dateLabel(l.from); } },
            { key: 'to', header: 'To', sortable: true, cell: function (l) { return ui.dateLabel(l.to); } },
            { key: 'days', header: 'Duration', numeric: true, align: 'right', sortable: true,
              csv: function (l) { return l.days; },
              cell: function (l) { return l.days + ' day' + (l.days === 1 ? '' : 's'); } },
            { key: 'reason', header: 'Reason',
              cell: function (l) {
                return h('span', { className: 'muted', style: { display: 'block', maxWidth: 280 } }, l.reason || '—');
              } },
            { key: 'status', header: 'Leave status', sortable: true,
              csv: function (l) { return l.status; },
              cell: function (l) { return h(LeaveStatusCell, { request: l }); } },
            { key: 'actions', header: 'Action', align: 'right',
              cell: function (l) {
                var open = /pending/i.test(l.status);
                return h('span', { className: 'row gap-1', style: { justifyContent: 'flex-end' } },
                  h(V.IconButton, {
                    icon: I.pencil, 'aria-label': 'Edit the ' + typeName(l.type) + ' request', title: 'Edit',
                    disabled: !open, onClick: function () { editSt[1](l.id); }
                  }),
                  h(V.IconButton, {
                    icon: I.close, 'aria-label': 'Cancel the ' + typeName(l.type) + ' request', title: 'Cancel',
                    disabled: !open, onClick: function () { cancelSt[1](l.id); }
                  }));
              } }
          ],
          emptyIcon: I.calendar,
          emptyTitle: typeSt[0] || statusSt[0] || yearSt[0] ? 'No requests match these filters' : 'No leave requests yet',
          emptyBody: typeSt[0] || statusSt[0] || yearSt[0]
            ? 'Clear a filter to see everything you have applied for.'
            : 'When you apply for leave it appears here, with what it is waiting on.',
          emptyActions: h(V.Button, { variant: 'primary', iconStart: I.plus,
            onClick: function () { applySt[1](true); } }, 'Apply leave')
        })),

      applySt[0] ? h(ApplyLeaveModal, {
        employee: m.id, balances: balances, onClose: function () { applySt[1](false); }
      }) : null,
      editSt[0] ? h(EditLeaveModal, {
        request: store.find('leaveRequests', editSt[0]),
        onClose: function () { editSt[1](null); }
      }) : null,
      target ? h(ui.Confirm, {
        title: 'Cancel this request?',
        body: typeName(target.type) + ', ' + ui.dateLabel(target.from) + ' to ' + ui.dateLabel(target.to)
          + '. The days go back to your balance and your manager is told.',
        confirmLabel: 'Cancel the request', cancelLabel: 'Keep it', tone: 'danger',
        onConfirm: function () { ui.report(act.cancelLeave(target.id)); },
        onClose: function () { cancelSt[1](null); }
      }) : null,
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

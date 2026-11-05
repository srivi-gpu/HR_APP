/* Employee self-service (PRD 2.3). These screens carry most of the Employee
   acceptance criteria in PRD 19: apply for leave, check in and out, view attendance
   and shifts, request assets, download payslips, acknowledge policies, take part in
   reviews, submit surveys and initiate a resignation.

   Everything here is scoped to the signed-in employee. Nothing reads another person's
   confidential record, which is what PRD 16.6 asks of this workspace. */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var store = HRMS.store, router = HRMS.router, ui = HRMS.ui, seed = HRMS.seed;
  var act = HRMS.actions, rules = HRMS.rules;
  var Card = ui.Card, Grid = ui.Grid, Stat = ui.Stat, Stats = ui.Stats;
  var charts = HRMS.charts;

  function me() { return store.persona('me'); }
  function emp(id) { return store.employee(id); }
  function deptName(id) { var d = store.department(id); return d ? d.name : '—'; }
  function locName(id) { var l = store.location(id); return l ? l.name : '—'; }

  /* The prototype seeds only today's attendance, so history is derived from the
     employee's shift, approved leave and the holiday calendar. The hash keeps it
     stable across reloads instead of reshuffling on every render. */
  function hash(str) {
    var n = 0;
    for (var i = 0; i < str.length; i++) n = (n * 31 + str.charCodeAt(i)) >>> 0;
    return n;
  }
  function historyFor(employee, days) {
    var shift = store.shift(employee.shift) || seed.shifts[0];
    var holidays = {};
    store.collection('holidays').forEach(function (x) { holidays[x.date] = x.name; });
    var leave = store.collection('leaveRequests').filter(function (l) {
      return l.employee === employee.id && l.status === 'Approved';
    });
    var out = [];
    for (var d = 0; d < days; d++) {
      var day = seed.util.addDays(seed.today, -d);
      var key = seed.util.iso(day);
      if (key < employee.joined) break;
      var weekend = day.getDay() === 0 || day.getDay() === 6;
      var onLeave = leave.some(function (l) { return l.from <= key && l.to >= key; });
      var seedN = hash(employee.id + key);
      var status = weekend ? 'Weekly Off'
        : holidays[key] ? 'Holiday'
          : onLeave ? 'On Leave'
            : (seedN % 100) < 4 ? 'Absent'
              : (seedN % 100) < 12 ? 'Late'
                : (seedN % 100) < 26 ? 'Work From Home' : 'Present';
      var worked = status === 'Present' || status === 'Late' || status === 'Work From Home';
      out.push({
        id: 'H-' + key, date: key, dateLabel: seed.util.pretty(day), status: status,
        holiday: holidays[key] || null,
        checkIn: worked ? shift.start : null,
        checkOut: worked ? shift.end : null,
        hours: worked ? Math.round((8 + ((seedN % 17) / 10 - 0.8)) * 10) / 10 : 0,
        lateBy: status === 'Late' ? 10 + (seedN % 40) : 0
      });
    }
    return out;
  }
  /* The performance score reads presence off these same days, so publish the
     derivation rather than let a second copy of it drift. */
  HRMS.attendanceHistory = historyFor;

  /* ============================================================= Profile (4.4) */
  /* PRD 4.5: an employee may propose changes, but sensitive fields need HR approval
     before the record updates. Contact details go straight through; bank details and
     anything identity-related raise a request. */
  /* Personal details now carries what Contact and Emergency contacts used to hold:
     three tabs of four fields each, which made a person's own details a small hunt.
     Employment is editable too, but through a request — a department or a designation
     is HR's to grant, so it queues for approval the way bank details do. */
  function profileScreen(kind) {
    var TITLES = {
      personal: 'Personal details', employment: 'Employment', bank: 'Bank details'
    };
    /* Saved straight away, or raised as a request for HR to approve. */
    var NEEDS_APPROVAL = { employment: 'Employment details', bank: 'Bank account details' };

    return function () {
      var m = me();
      var editSt = React.useState(false);
      var form = ui.useForm(m);

      function currentValues() {
        var cur = me();
        return Object.assign({}, cur, {
          emergencyName: cur.emergency && cur.emergency.name,
          emergencyRelation: cur.emergency && cur.emergency.relation,
          emergencyPhone: cur.emergency && cur.emergency.phone,
          bankName: cur.bank && cur.bank.name,
          bankAccount: cur.bank && cur.bank.account,
          bankIfsc: cur.bank && cur.bank.ifsc
        });
      }

      function save() {
        var res = form.submit(function (v) {
          if (kind === 'personal') {
            return ui.report(act.editEmployee(m.id, {
              personalEmail: v.personalEmail, phone: v.phone, dob: v.dob,
              address: v.address, permanentAddress: v.permanentAddress,
              emergency: { name: v.emergencyName, relation: v.emergencyRelation, phone: v.emergencyPhone }
            }));
          }
          if (kind === 'employment') {
            return ui.report(act.requestProfileChange(m.id, {
              department: v.department, designationId: v.designationId,
              location: v.location, shift: v.shift
            }, NEEDS_APPROVAL.employment));
          }
          return ui.report(act.requestProfileChange(m.id, {
            bank: { name: v.bankName, account: v.bankAccount, ifsc: v.bankIfsc }
          }, NEEDS_APPROVAL.bank));
        });
        if (res && res.ok) editSt[1](false);
      }

      function view() {
        if (kind === 'personal') {
          return h(React.Fragment, null,
            h(ui.KeyValue, { rows: [
              ['Full name', m.name], ['Employee ID', h('span', { className: 'mono' }, m.id)],
              ['Date of birth', ui.dateLabel(m.dob)], ['Gender', m.gender],
              ['Personal email', m.personalEmail], ['Work email', m.workEmail],
              ['Phone', m.phone]
            ]}),
            h(ui.FormSection, { title: 'Addresses' },
              h(ui.KeyValue, { rows: [
                ['Current address', m.address],
                ['Permanent address', m.permanentAddress]
              ]})),
            h(ui.FormSection, { title: 'In an emergency', description: 'Who we call, and how.' },
              h(ui.KeyValue, { rows: [
                ['Contact name', m.emergency && m.emergency.name],
                ['Relationship', m.emergency && m.emergency.relation],
                ['Phone', m.emergency && m.emergency.phone]
              ]})));
        }
        if (kind === 'employment') {
          return h(React.Fragment, null,
            h(ui.KeyValue, { rows: [
              ['Employee ID', h('span', { className: 'mono' }, m.id)],
              ['Joining date', m.joinedLabel],
              ['Department', deptName(m.department)], ['Designation', m.designation],
              ['Reporting manager', m.manager ? emp(m.manager).name : null],
              ['Employment type', m.type], ['Work location', locName(m.location)],
              ['Probation', m.probationMonths + ' months'],
              ['Assigned shift', (store.shift(m.shift) || {}).name],
              ['Status', h(ui.StatusChip, { status: m.status })]
            ]}),
            h('p', { className: 'muted', style: { fontSize: 12 } },
              'A change here is a request: your department, designation, location and shift are '
              + 'HR’s to grant, so they review it before the record moves.'));
        }
        return h(React.Fragment, null,
          h(ui.KeyValue, { rows: [
            ['Bank', m.bank && m.bank.name],
            ['Account number', m.bank && m.bank.account],
            ['IFSC', m.bank && m.bank.ifsc],
            ['Salary credited to', m.bank && m.bank.name ? m.bank.name + ' ' + m.bank.account : null]
          ]}),
          h('p', { className: 'muted', style: { fontSize: 12 } },
            'PRD 4.5: bank details are sensitive, so a change here raises a request for HR to approve rather than updating the record directly.'));
      }

      function fields() {
        if (kind === 'personal') {
          return h(React.Fragment, null,
            h(ui.FieldRow, null,
              h(V.TextField, Object.assign({ label: 'Personal email', type: 'email' }, form.field('personalEmail'))),
              h(V.TextField, Object.assign({ label: 'Phone' }, form.field('phone')))),
            h(V.DateField, Object.assign({ label: 'Date of birth' }, form.field('dob'))),
            h(ui.FormSection, { title: 'Addresses' },
              h(V.TextArea, Object.assign({ label: 'Current address', rows: 3 }, form.field('address'))),
              h(V.TextArea, Object.assign({ label: 'Permanent address', rows: 3 }, form.field('permanentAddress')))),
            h(ui.FormSection, { title: 'In an emergency' },
              h(ui.FieldRow, { cols: 3 },
                h(V.TextField, Object.assign({ label: 'Contact name' }, form.field('emergencyName'))),
                h(V.Select, Object.assign({ label: 'Relationship',
                  options: ['Spouse', 'Parent', 'Sibling', 'Friend', 'Other'] }, form.select('emergencyRelation'))),
                h(V.TextField, Object.assign({ label: 'Phone' }, form.field('emergencyPhone'))))));
        }
        if (kind === 'employment') {
          return h(React.Fragment, null,
            h(ui.FieldRow, null,
              h(V.Select, Object.assign({ label: 'Department',
                options: store.collection('departments').map(function (d) { return { value: d.id, label: d.name }; })
              }, form.select('department'))),
              h(V.Select, Object.assign({ label: 'Designation',
                options: store.collection('designations').map(function (d) { return { value: d.id, label: d.name }; })
              }, form.select('designationId')))),
            h(ui.FieldRow, null,
              h(V.Select, Object.assign({ label: 'Work location',
                options: store.collection('locations').map(function (l) { return { value: l.id, label: l.name }; })
              }, form.select('location'))),
              h(V.Select, Object.assign({ label: 'Assigned shift',
                options: store.collection('shifts').map(function (sh) { return { value: sh.id, label: sh.name }; })
              }, form.select('shift')))),
            h('p', { className: 'muted', style: { fontSize: 12 } },
              'Your name, employee id and joining date are fixed. Everything else here goes to HR as a request.'));
        }
        return h(ui.FieldRow, { cols: 3 },
          h(V.TextField, Object.assign({ label: 'Bank name' }, form.field('bankName'))),
          h(V.TextField, Object.assign({ label: 'Account number' }, form.field('bankAccount'))),
          h(V.TextField, Object.assign({ label: 'IFSC' }, form.field('bankIfsc'))));
      }

      /* The "My record" card beside this one is gone: the avatar, name, designation,
         status, department and location it repeated are all in the header above the
         tabs now, on every tab, so it was saying the same thing twice on three of
         them. The detail card takes the full width it left behind. */
      return h(Grid, null,
        h(Card, { span: 12, title: TITLES[kind],
          aside: h(V.Button, {
            variant: editSt[0] ? 'ghost' : 'outline', className: 'vi-btn--sm', iconStart: I.pencil,
            onClick: function () { form.reset(currentValues()); editSt[1](!editSt[0]); }
          }, editSt[0] ? 'Cancel' : 'Edit') },
          editSt[0]
            ? h('div', { className: 'stack gap-4' }, fields(),
                h('div', { className: 'row gap-2' },
                  h(V.Button, { variant: 'primary', onClick: save },
                    NEEDS_APPROVAL[kind] ? 'Request change' : 'Save changes'),
                  h(V.Button, { variant: 'outline', onClick: function () { editSt[1](false); } }, 'Cancel')))
            : view()));
    };
  }

  function AttendanceToday() {
    var m = me();
    var shift = store.shift(m.shift) || seed.shifts[0];
    var punch = store.pref('punch') || {};
    var today = seed.todayIso;
    var inAt = punch.date === today ? punch.in : null;
    var outAt = punch.date === today ? punch.out : null;
    var clockSt = React.useState(new Date());

    React.useEffect(function () {
      var t = setInterval(function () { clockSt[1](new Date()); }, 1000);
      return function () { clearInterval(t); };
    }, []);

    var blockIn = rules.canCheckIn(m.id);
    var blockOut = rules.canCheckOut(m.id);

    /* Hours so far, from the recorded punch rather than the wall clock alone. */
    var worked = null;
    if (inAt) {
      var endStr = outAt || (String(clockSt[0].getHours()).padStart(2, '0') + ':' + String(clockSt[0].getMinutes()).padStart(2, '0'));
      var mins = (Number(endStr.slice(0, 2)) * 60 + Number(endStr.slice(3)))
        - (Number(inAt.slice(0, 2)) * 60 + Number(inAt.slice(3)));
      worked = Math.max(0, Math.round((mins / 60) * 10) / 10);
    }

    var history = historyFor(m, 30);
    var present = history.filter(function (x) { return x.status === 'Present' || x.status === 'Late' || x.status === 'Work From Home'; });
    var workingDays = history.filter(function (x) { return x.status !== 'Weekly Off' && x.status !== 'Holiday'; });

    /* The same shape HR sees, reading the employee's own record rather than the
       organization's: their rate, their thirty days, their month by status. A form you
       have already learned to read costs nothing to read again. */
    var rate = Math.round(ui.pct(present.length, workingDays.length));
    /* Oldest first, so the grid reads the way a calendar does. */
    var days = history.slice().reverse();
    var byStatus = {};
    history.forEach(function (x) { byStatus[x.status] = (byStatus[x.status] || 0) + 1; });
    var statusRows = Object.keys(byStatus).map(function (k) {
      return { label: k, value: byStatus[k], rate: Math.round(ui.pct(byStatus[k], history.length)) };
    }).sort(function (a, b) { return b.value - a.value; });

    /* The tiles answer what an employee actually wants to know about themselves. They
       used to be HR's row — present, work from home, on leave, late, absent — which is a
       count of other people when HR reads it and, filled with one person's own thirty
       days, both a duplicate of the grid below and a sentence nobody needs: you know
       whether you were in. These are the things you cannot work out by remembering. */

    /* Hours since Monday, against the shift's own week. */
    var weekStart = (function () {
      var d = new Date(seed.todayIso + 'T00:00:00');
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return seed.util.iso(d);
    })();
    var weekDays = history.filter(function (x) { return x.date >= weekStart; });
    var weekHours = Math.round(weekDays.reduce(function (n, x) { return n + (x.hours || 0); }, 0) * 10) / 10;
    var weekTarget = weekDays.filter(function (x) {
      return x.status !== 'Weekly Off' && x.status !== 'Holiday';
    }).length * 8;

    /* The time you actually start, which is the shift start plus however late you tend
       to be — a number you cannot get by remembering. */
    var worked30 = history.filter(function (x) { return x.checkIn; });
    var avgLate = worked30.length
      ? worked30.reduce(function (n, x) { return n + (x.lateBy || 0); }, 0) / worked30.length : 0;
    var startMins = Number(shift.start.slice(0, 2)) * 60 + Number(shift.start.slice(3)) + avgLate;
    var avgStart = String(Math.floor(startMins / 60)).padStart(2, '0') + ':'
      + String(Math.round(startMins % 60)).padStart(2, '0');

    /* Working days back from the most recent one, until a late or an absence stops it.
       Today only counts once it has been punched: the hero says you have not checked in,
       and a streak that silently included today would contradict it. */
    var streak = 0;
    for (var si = 0; si < history.length; si++) {
      var hd = history[si];
      if (hd.date === today && !inAt) continue;
      if (hd.status === 'Weekly Off' || hd.status === 'Holiday') continue;
      if (hd.status === 'Late' || hd.status === 'Absent') break;
      streak++;
    }

    var leaveLeft = store.balancesFor(m.id).reduce(function (n, b) { return n + b.available; }, 0);
    var nextHol = store.collection('holidays')
      .filter(function (hd2) { return hd2.date >= seed.todayIso; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0];
    var holIn = nextHol
      ? Math.round((new Date(nextHol.date + 'T00:00:00') - new Date(seed.todayIso + 'T00:00:00')) / 86400000)
      : null;

    var pending = store.collection('leaveRequests').filter(function (l) {
      return l.employee === m.id && /pending/i.test(l.status);
    }).length + store.collection('regularizations').filter(function (rg) {
      return rg.employee === m.id && /pending/i.test(rg.status);
    }).length;

    return h(React.Fragment, null,
      h('section', { className: 'dash__card hero' },
        h('div', { className: 'hero__l' },
          h('span', { className: 'hero__date' }, I.calendar, seed.todayLabel),
          h('h1', null, inAt ? 'You are checked in' : 'Attendance today'),
          h('p', { className: 'hero__p' },
            inAt
              ? 'Checked in at ' + inAt + (outAt ? ', out at ' + outAt : '') + '. Your shift is '
                + shift.start + ' to ' + shift.end + '.'
              : 'You have not checked in yet. Your shift starts at ' + shift.start + '.'),
          h('div', { className: 'hero__acts' },
            h(V.Button, { variant: 'primary', iconEnd: I.arrow, onClick: function () { router.go('me/attendance/history'); } }, 'My history'),
            h(V.Button, { variant: 'outline', iconStart: I.checklist, onClick: function () { router.go('me/attendance/regularization'); } }, 'Regularizations'))),
        h('span', { className: 'hero__sep' }),
        h(charts.Gauge, { value: rate, label: 'Your 30 days' }),
        h('span', { className: 'hero__sep' }),
        h('div', { className: 'hero__r' },
          h('span', { className: 'hero__fig' },
            h('strong', null, worked == null ? '—' : worked + 'h'), h('span', null, 'Hours today')),
          h('span', { className: 'hero__fig' },
            h('strong', null, present.length), h('span', null, 'Days attended')))),

      h(charts.Tiles, { items: [
        { label: 'Hours this week', value: weekHours + 'h', tone: 'good', icon: I.clock },
        { label: 'You usually start', value: avgStart, tone: 'info', icon: I.person },
        { label: 'On time, in a row', value: streak, tone: streak >= 5 ? 'good' : 'warn', icon: I.check },
        { label: 'Leave available', value: leaveLeft, tone: 'brand', icon: I.calendar,
          onClick: function () { router.go('me/leave/overview'); } },
        { label: pending ? 'Awaiting a decision' : 'Next holiday',
          value: pending || (holIn === 0 ? 'Today' : holIn ? holIn + 'd' : '—'),
          tone: pending ? 'warn' : 'brand', icon: pending ? I.checklist : I.star,
          onClick: function () { router.go(pending ? 'me/leave/history' : 'me/leave/holidays'); } }
      ]}),

      h(Grid, null,
        h(Card, { span: 7, title: 'Your last 30 days',
          description: 'Oldest to newest. Days nobody was due in stay quiet.',
          aside: h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: rate >= 90 ? 'success' : 'warning' },
            rate + '% attendance') },
          h(charts.DayStrip, {
            days: days,
            order: ['Present', 'Work From Home', 'Late', 'On Leave', 'Absent', 'Holiday', 'Weekly Off'],
            tones: {
              'Present': 'good', 'Work From Home': 'info', 'On Leave': 'brand',
              'Late': 'warn', 'Absent': 'bad', 'Holiday': 'none', 'Weekly Off': 'none'
            }
          })),
        h(Card, { span: 5, title: 'By status',
          description: 'Every day of the last thirty, counted.' },
          h(charts.RankBars, { rows: statusRows }))),

      h(Grid, null,
        h(Card, { span: 6, title: "Today's attendance" },
          h('div', { className: 'punch' },
            h('span', { className: 'punch__clock' },
              String(clockSt[0].getHours()).padStart(2, '0') + ':' + String(clockSt[0].getMinutes()).padStart(2, '0')),
            h('div', { className: 'punch__meta' },
              h('span', null, 'Checked in', h('b', null, inAt || '—')),
              h('span', null, 'Checked out', h('b', null, outAt || '—')),
              h('span', null, 'Hours', h('b', null, worked == null ? '—' : worked + ' h'))),
            h('div', { className: 'row gap-2 wrap' },
              !inAt
                ? h(V.Button, {
                    variant: 'primary', iconStart: I.play, disabled: !!blockIn,
                    onClick: function () { ui.report(act.checkIn(m.id)); }
                  }, 'Check in')
                : !outAt
                  ? h(V.Button, {
                      variant: 'primary', iconStart: I.stop, disabled: !!blockOut,
                      onClick: function () { ui.report(act.checkOut(m.id)); }
                    }, 'Check out')
                  : h(V.Chip, { shape: 'tag', variant: 'soft', tone: 'success', dot: true }, 'Day complete'),
              h(V.Button, { variant: 'ghost', onClick: function () { router.go('me/attendance/regularization'); } }, 'Raise a correction')),
            /* PRD 14.3: duplicate punches and punching on approved leave are refused. */
            blockIn && !inAt ? h('p', { style: { fontSize: 12, color: 'var(--warning-fg)' } }, blockIn) : null)),

        /* The thirty-day breakdown is the "By status" card above now, so this one carries
           only the way through to the full record. */
        h(Card, { span: 6, title: 'Your record' },
          h('p', { className: 'muted', style: { marginTop: 0 } },
            present.length + ' of ' + workingDays.length + ' working days attended over the last thirty.'),
          h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconEnd: I.right,
            onClick: function () { router.go('me/attendance/history'); } }, 'View full history'))));
  }

  function AttendanceHistory() {
    var m = me();
    var statusSt = React.useState('');
    var rows = historyFor(m, 90);
    if (statusSt[0]) rows = rows.filter(function (x) { return x.status === statusSt[0]; });

    return h(React.Fragment, null,
      h(Card, { title: 'Attendance history', description: 'Your last 90 days, with status, punches and hours.' },
        h(ui.DataTable, {
          exportName: 'my-attendance', label: 'My attendance', rows: rows, pageSize: 15,
          search: function (x) { return x.dateLabel + ' ' + x.status; }, searchPlaceholder: 'Search by date or status',
          filters: h(ui.Filter, {
            label: 'Status', value: statusSt[0], onChange: statusSt[1],
            options: ['Present', 'Work From Home', 'Late', 'On Leave', 'Absent', 'Holiday', 'Weekly Off']
          }),
          columns: [
            { key: 'dateLabel', header: 'Date', sortable: true, sortValue: function (x) { return x.date; } },
            { key: 'day', header: 'Day', csv: function (x) { return new Date(x.date + 'T00:00').getDay(); },
              cell: function (x) {
                return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(x.date + 'T00:00').getDay()];
              } },
            { key: 'checkIn', header: 'In', cell: function (x) { return x.checkIn || h('span', { className: 'muted' }, '—'); } },
            { key: 'checkOut', header: 'Out', cell: function (x) { return x.checkOut || h('span', { className: 'muted' }, '—'); } },
            { key: 'hours', header: 'Hours', numeric: true, align: 'right',
              cell: function (x) { return x.hours ? x.hours + ' h' : h('span', { className: 'muted' }, '—'); } },
            { key: 'lateBy', header: 'Late by', numeric: true, align: 'right',
              cell: function (x) { return x.lateBy ? x.lateBy + ' min' : ''; } },
            { key: 'status', header: 'Status', cell: function (x) {
                return x.status === 'Holiday'
                  ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info' }, x.holiday || 'Holiday')
                  : x.status === 'Weekly Off' ? h('span', { className: 'muted' }, 'Weekly off')
                    : h(ui.StatusChip, { status: x.status });
              } }
          ],
          emptyIcon: I.clock, emptyTitle: 'No records for that filter'
        })));
  }

  function MyRegularization() {
    var m = me();
    var openSt = React.useState(false);
    var form = ui.useForm({ date: seed.util.iso(seed.util.addDays(seed.today, -1)) },
      function (v) { return rules.validRegularization(v); });
    var rows = store.collection('regularizations').filter(function (x) { return x.employee === m.id; });

    function save() {
      var res = form.submit(function (v) { return ui.report(act.requestRegularization(m.id, v)); });
      if (res && res.ok) { openSt[1](false); form.reset({ date: seed.util.iso(seed.util.addDays(seed.today, -1)) }); }
    }

    return h(React.Fragment, null,
      h(Card, {
        title: 'Regularization requests',
        description: 'Correct a missing or wrong punch. Both the original and the corrected value are kept (PRD 14.3).',
        aside: h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus, onClick: function () { openSt[1](true); } }, 'Raise a correction')
      },
        h(ui.DataTable, {
          exportName: 'my-regularizations', label: 'My regularization requests', rows: rows, pageSize: 10,
          search: function (x) { return x.dateLabel + ' ' + x.issue; }, searchPlaceholder: 'Search requests',
          columns: [
            { key: 'id', header: 'Request', cell: function (x) { return h('span', { className: 'mono' }, x.id); } },
            { key: 'dateLabel', header: 'For date', sortable: true, sortValue: function (x) { return x.date; } },
            { key: 'issue', header: 'Issue' },
            { key: 'original', header: 'Original' },
            { key: 'corrected', header: 'Corrected' },
            { key: 'approver', header: 'Approver', csv: function (x) { return emp(x.approver) ? emp(x.approver).name : ''; },
              cell: function (x) { return emp(x.approver) ? emp(x.approver).name : '—'; } },
            { key: 'status', header: 'Status', cell: function (x) { return h(ui.StatusChip, { status: x.status }); } }
          ],
          emptyIcon: I.clock, emptyTitle: 'No corrections raised',
          emptyBody: 'If a punch is missing or wrong, raise a correction and your manager will review it.',
          emptyActions: h(V.Button, { variant: 'primary', iconStart: I.plus, onClick: function () { openSt[1](true); } }, 'Raise a correction')
        })),

      openSt[0] ? h(ui.Modal, {
        title: 'Raise a correction', onClose: function () { openSt[1](false); },
        description: 'Corrections are allowed for the last 30 days.',
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { openSt[1](false); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: save }, 'Submit for approval'))
      },
        h(ui.FieldRow, null,
          h(V.DateField, Object.assign({ label: 'Date', required: true, max: seed.todayIso }, form.field('date'))),
          h(V.Select, Object.assign({ label: 'Issue', required: true,
            options: ['Missing check-in', 'Missing check-out', 'Wrong punch time', 'Marked absent in error'] }, form.select('issue')))),
        h(ui.FieldRow, null,
          h(V.TextField, Object.assign({ label: 'Recorded (as is)', placeholder: '09:48 / —' }, form.field('original'))),
          h(V.TextField, Object.assign({ label: 'Corrected time', required: true, placeholder: '09:05' }, form.field('corrected')))),
        h(V.TextArea, Object.assign({ label: 'Reason', required: true, rows: 3,
          placeholder: 'Your manager sees this.' }, form.field('reason')))) : null);
  }

  /* =============================================================== Leave (4.12) */
  function ApplyLeave() {
    var m = me();
    var form = ui.useForm({ from: seed.todayIso, to: seed.todayIso },
      function (v) { return rules.validateLeave(v, m); });
    var balances = store.balancesFor(m.id);
    var policy = store.collection('leavePolicies').filter(function (p) { return p.id === m.leavePolicy; })[0];
    var types = store.collection('leaveTypes').filter(function (t) {
      return !policy || policy.types.indexOf(t.id) >= 0;
    });

    /* PRD 4.12: the application shows days, balance and exclusions before submission. */
    var calc = form.values.from && form.values.to && form.values.to >= form.values.from
      ? rules.countLeaveDays(form.values.from, form.values.to, form.values.halfDay) : null;
    var bal = balances.filter(function (b) { return b.type === form.values.type; })[0];
    var notice = form.values.type && form.values.from ? rules.meetsNotice(form.values.type, form.values.from) : null;

    function save() {
      var res = form.submit(function (v) { return ui.report(act.applyLeave(m.id, v)); });
      if (res && res.ok) form.reset({ from: seed.todayIso, to: seed.todayIso });
    }

    return h(Grid, null,
      h(Card, { span: 7, title: 'Apply for leave', description: policy ? 'Under the ' + policy.name + ' policy.' : null },
        h(V.Select, Object.assign({ label: 'Leave type', required: true, placeholder: 'Choose a leave type',
          options: types.map(function (t) {
            var b = balances.filter(function (x) { return x.type === t.id; })[0];
            return { value: t.id, label: t.name + (b ? ' — ' + b.available + ' available' : t.paid ? '' : ' — unpaid') };
          }) }, form.select('type'))),
        h(ui.FieldRow, null,
          h(V.DateField, Object.assign({ label: 'From', required: true }, form.field('from'))),
          h(V.DateField, Object.assign({ label: 'To', required: true }, form.field('to')))),
        calc && calc.total === 1
          ? h(V.Checkbox, Object.assign({ label: 'Half day' }, form.check('halfDay'))) : null,
        h(V.TextArea, Object.assign({ label: 'Reason', required: true, rows: 3 }, form.field('reason'))),
        h(V.TextField, Object.assign({ label: 'Supporting document', placeholder: 'File name, if required',
          hint: form.errors.document || 'Sick leave over two days needs a document (PRD 4.11)' }, form.field('document'))),
        notice ? h('p', { style: { fontSize: 12, color: 'var(--warning-fg)' } }, notice + '. You can still apply.') : null,
        h('div', { className: 'row gap-2' },
          h(V.Button, { variant: 'primary', onClick: save }, 'Submit application'),
          h(V.Button, { variant: 'outline', onClick: function () { form.reset({ from: seed.todayIso, to: seed.todayIso }); } }, 'Clear'))),

      h(Card, { span: 5, title: 'Before you submit' },
        calc
          ? h(React.Fragment, null,
              h(ui.KeyValue, { rows: [
                ['Leave days', h('strong', null, calc.total)],
                ['Weekly offs excluded', calc.weekends],
                ['Holidays excluded', calc.holidays],
                ['Available balance', bal ? bal.available : h('span', { className: 'muted' }, 'Not balance-bound')],
                ['Balance after', bal ? Math.round((bal.available - calc.total) * 10) / 10 : null]
              ]}),
              calc.excluded.length
                ? h('div', { className: 'stack gap-2' },
                    h('span', { className: 'eyebrow' }, 'Excluded dates'),
                    h('div', { className: 'list' }, calc.excluded.map(function (x) {
                      return h('div', { className: 'list__row', key: x.date },
                        h('div', { className: 'list__main' },
                          h('span', { className: 'list__title' }, ui.dateLabel(x.date)),
                          h('span', { className: 'list__meta' }, x.why)));
                    })))
                : null)
          : h(ui.Empty, { icon: I.calendar, title: 'Choose a date range', body: 'The day count, exclusions and balance appear here.' }),
        h('p', { className: 'muted', style: { fontSize: 12 } },
          'Weekly offs and holidays are excluded automatically, overlapping requests are detected, and the balance is checked before the request is created (PRD 14.2).')));
  }

  function LeaveBalance() {
    var m = me();
    var balances = store.balancesFor(m.id);
    var requests = store.collection('leaveRequests').filter(function (l) { return l.employee === m.id; });
    var taken = requests.filter(function (l) { return l.status === 'Approved'; })
      .reduce(function (n, l) { return n + l.days; }, 0);

    return h(React.Fragment, null,
      h(Stats, { cols: 3 },
        h(Stat, { label: 'Total entitlement', value: balances.reduce(function (n, b) { return n + b.entitled; }, 0), unit: 'days', sub: 'This leave year' }),
        h(Stat, { label: 'Available', value: balances.reduce(function (n, b) { return n + b.available; }, 0), unit: 'days', sub: 'Across all types', tone: 'good' }),
        h(Stat, { label: 'Taken', value: taken, unit: 'days', sub: requests.filter(function (l) { return l.status === 'Approved'; }).length + ' approved requests' })),
      h(Card, { title: 'Leave balance', description: 'Entitlement, used and available for each leave type.' },
        balances.length
          ? h(V.Table, {
              'aria-label': 'Leave balance',
              columns: [
                { key: 'type', header: 'Leave type', cell: function (b) { return store.leaveType(b.type).name; } },
                { key: 'code', header: 'Code', cell: function (b) { return h('span', { className: 'mono' }, store.leaveType(b.type).code); } },
                { key: 'entitled', header: 'Entitled', numeric: true, align: 'right' },
                { key: 'used', header: 'Used', numeric: true, align: 'right' },
                { key: 'available', header: 'Available', numeric: true, align: 'right',
                  cell: function (b) { return h('strong', { style: { fontWeight: 500 } }, b.available); } },
                { key: 'bar', header: 'Used', cell: function (b) {
                    return h(V.ProgressBar, { value: ui.pct(b.used, b.entitled), size: 'sm', 'aria-label': store.leaveType(b.type).name });
                  } },
                { key: 'carry', header: 'Carry forward', csv: function (b) { return store.leaveType(b.type).carry ? 'Yes' : 'No'; },
                  cell: function (b) {
                    return store.leaveType(b.type).carry
                      ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'success' }, 'Yes')
                      : h('span', { className: 'muted' }, 'No');
                  } }
              ],
              rows: balances.map(function (b, i) { return Object.assign({ id: i }, b); })
            })
          : h(ui.Empty, { icon: I.calendar, title: 'No leave policy assigned', body: 'Ask HR to assign a leave policy to your record.' })),
      h(Card, { title: 'Upcoming holidays' },
        h('div', { className: 'list' }, store.collection('holidays')
          .filter(function (x) { return x.date >= seed.todayIso; }).slice(0, 5).map(function (hd) {
            return h('div', { className: 'list__row', key: hd.date },
              h('div', { className: 'list__main' },
                h('span', { className: 'list__title' }, hd.name),
                h('span', { className: 'list__meta' }, ui.dateLabel(hd.date))),
              h(V.Chip, { size: 'sm', shape: 'tag', variant: hd.type === 'Optional' ? 'outline' : 'soft', tone: hd.type === 'Optional' ? 'neutral' : 'info' }, hd.type));
          }))));
  }

  function LeaveHistory() {
    var m = me();
    var cancelSt = React.useState(null);
    var statusSt = React.useState('');
    var rows = store.collection('leaveRequests').filter(function (l) { return l.employee === m.id; });
    if (statusSt[0]) rows = rows.filter(function (l) { return l.status === statusSt[0]; });

    return h(React.Fragment, null,
      h(Card, { title: 'My leave requests', description: 'Every request you have made and where it stands.' },
        h(ui.DataTable, {
          exportName: 'my-leave', label: 'My leave requests', rows: rows, pageSize: 10,
          search: function (l) { return store.leaveType(l.type).name + ' ' + l.reason + ' ' + l.id; },
          searchPlaceholder: 'Search by type or reason',
          filters: h(ui.Filter, {
            label: 'Status', value: statusSt[0], onChange: statusSt[1],
            options: ['Pending Approval', 'Approved', 'Rejected', 'Cancelled']
          }),
          columns: [
            { key: 'id', header: 'Request', cell: function (l) { return h('span', { className: 'mono' }, l.id); } },
            { key: 'type', header: 'Type', csv: function (l) { return store.leaveType(l.type).name; },
              cell: function (l) { return store.leaveType(l.type).name; } },
            { key: 'from', header: 'From', sortable: true, cell: function (l) { return l.fromLabel; } },
            { key: 'to', header: 'To', cell: function (l) { return l.toLabel; } },
            { key: 'days', header: 'Days', numeric: true, align: 'right',
              cell: function (l) { return l.days + (l.halfDay ? ' (half)' : ''); } },
            { key: 'reason', header: 'Reason' },
            { key: 'status', header: 'Status', cell: function (l) { return h(ui.StatusChip, { status: l.status }); } },
            { key: 'actions', header: '', align: 'right',
              cell: function (l) {
                var cancellable = l.status === 'Pending Approval' || (l.status === 'Approved' && l.to >= seed.todayIso);
                return cancellable
                  ? h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', onClick: function () { cancelSt[1](l); } }, 'Cancel')
                  : l.decisionComment
                    ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'neutral', title: l.decisionComment }, 'Has note')
                    : '';
              } }
          ],
          emptyIcon: I.calendar, emptyTitle: 'No leave requests yet',
          emptyBody: 'Apply for leave and it appears here with its approval status.',
          emptyActions: h(V.Button, { variant: 'primary', onClick: function () { router.go('me/leave/apply'); } }, 'Apply for leave')
        })),

      cancelSt[0] ? h(ui.Confirm, {
        title: 'Cancel ' + cancelSt[0].id + '?',
        body: cancelSt[0].status === 'Approved'
          ? 'The days are returned to your balance (PRD 14.2).'
          : 'The request is withdrawn before approval.',
        confirmLabel: 'Cancel request', tone: 'danger',
        onClose: function () { cancelSt[1](null); },
        onConfirm: function () { ui.report(act.cancelLeave(cancelSt[0].id)); }
      }) : null);
  }

  /* ============================================================== Shifts (4.21) */
  function MyShifts() {
    var m = me();
    var shift = store.shift(m.shift) || seed.shifts[0];
    var mine = store.collection('shiftAssignments').filter(function (x) { return x.employee === m.id; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });

    return h(React.Fragment, null,
      h(Stats, { cols: 3 },
        h(Stat, { label: 'My default shift', value: shift.start, unit: '– ' + shift.end, sub: shift.name }),
        h(Stat, { label: 'Working days', value: shift.days, sub: 'Break ' + shift.breakMins + ' min' }),
        h(Stat, { label: 'Grace period', value: shift.grace, unit: 'min', sub: shift.night ? 'Night shift' : 'Day shift' })),
      h(Card, { title: 'My published roster', description: 'Your assigned shifts. Weekends are unassigned.' },
        h(ui.DataTable, {
          exportName: 'my-roster', label: 'My roster', rows: mine, pageSize: 10, onExport: true,
          search: function (x) { return x.date; }, searchPlaceholder: 'Search by date',
          columns: [
            { key: 'date', header: 'Date', sortable: true, cell: function (x) { return ui.dateLabel(x.date); } },
            { key: 'day', header: 'Day', csv: function (x) { return new Date(x.date + 'T00:00').getDay(); },
              cell: function (x) { return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(x.date + 'T00:00').getDay()]; } },
            { key: 'shift', header: 'Shift', csv: function (x) { return (store.shift(x.shift) || {}).name; },
              cell: function (x) { var s = store.shift(x.shift) || {}; return s.name + ' (' + s.start + ' – ' + s.end + ')'; } },
            { key: 'source', header: 'Source', cell: function (x) { return h(V.Chip, { size: 'sm', shape: 'tag' }, x.source); } },
            { key: 'published', header: 'Published', align: 'center', csv: function (x) { return x.published ? 'Yes' : 'No'; },
              cell: function (x) { return x.published ? h(ui.StatusChip, { status: 'Published' }) : h('span', { className: 'muted' }, 'Draft'); } }
          ],
          emptyIcon: I.hourglass, emptyTitle: 'No shifts assigned',
          emptyBody: 'Your roster appears here once HR publishes it.'
        })));
  }

  function MySwaps() {
    var m = me();
    var openSt = React.useState(false);
    var form = ui.useForm({ from: m.shift });
    var mine = store.collection('shiftSwaps').filter(function (x) { return x.employee === m.id || x.with === m.id; });

    function save() {
      var res = form.submit(function (v) { return ui.report(act.requestShiftSwap(m.id, v)); });
      if (res && res.ok) { openSt[1](false); form.reset({ from: m.shift }); }
    }

    return h(React.Fragment, null,
      h(Card, {
        title: 'Shift swap requests',
        description: 'Swaps need the replacement colleague to agree and your manager to approve (PRD 4.22).',
        aside: h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus, onClick: function () { openSt[1](true); } }, 'Request a swap')
      },
        h(ui.DataTable, {
          exportName: 'my-swaps', label: 'My shift swaps', rows: mine, pageSize: 10, onExport: false,
          columns: [
            { key: 'id', header: 'Request', cell: function (x) { return h('span', { className: 'mono' }, x.id); } },
            { key: 'date', header: 'Date', sortable: true, cell: function (x) { return ui.dateLabel(x.date); } },
            { key: 'direction', header: 'Direction', csv: function (x) { return x.employee === m.id ? 'Raised by me' : 'Asked of me'; },
              cell: function (x) {
                return x.employee === m.id
                  ? h(V.Chip, { size: 'sm', shape: 'tag' }, 'Raised by me')
                  : h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info' }, 'Asked of me');
              } },
            { key: 'with', header: 'Counterpart', csv: function (x) { return emp(x.employee === m.id ? x.with : x.employee).name; },
              cell: function (x) {
                var other = emp(x.employee === m.id ? x.with : x.employee);
                return other ? h(ui.Person, { employee: other }) : '—';
              } },
            { key: 'shifts', header: 'Change', csv: function (x) { return (store.shift(x.from) || {}).name + ' to ' + (store.shift(x.to) || {}).name; },
              cell: function (x) { return (store.shift(x.from) || {}).name + ' → ' + (store.shift(x.to) || {}).name; } },
            { key: 'counterpartyAgreed', header: 'Colleague agreed', align: 'center',
              csv: function (x) { return x.counterpartyAgreed ? 'Yes' : 'No'; },
              cell: function (x) {
                return x.counterpartyAgreed
                  ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'success' }, 'Yes')
                  : h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning' }, 'Waiting');
              } },
            { key: 'status', header: 'Status', cell: function (x) { return h(ui.StatusChip, { status: x.status }); } }
          ],
          emptyIcon: I.hourglass, emptyTitle: 'No swap requests',
          emptyBody: 'Request a swap if you need a different shift on a particular day.',
          emptyActions: h(V.Button, { variant: 'primary', iconStart: I.plus, onClick: function () { openSt[1](true); } }, 'Request a swap')
        })),

      openSt[0] ? h(ui.Modal, {
        title: 'Request a shift swap', onClose: function () { openSt[1](false); },
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { openSt[1](false); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: save }, 'Submit request'))
      },
        h(V.DateField, Object.assign({ label: 'Date', required: true, min: seed.todayIso }, form.field('date'))),
        h(ui.EmployeePicker, {
          label: 'Replacement colleague', placeholder: 'Who will take your shift?',
          value: form.values.with, status: form.errors.with ? 'error' : undefined, hint: form.errors.with,
          onChange: function (v) { form.set('with', v); }
        }),
        h(ui.FieldRow, null,
          h(V.Select, Object.assign({ label: 'My current shift',
            options: store.collection('shifts').map(function (s) { return { value: s.id, label: s.name }; }) }, form.select('from'))),
          h(V.Select, Object.assign({ label: 'Requested shift', required: true,
            options: store.collection('shifts').map(function (s) { return { value: s.id, label: s.name + ' (' + s.start + '–' + s.end + ')' }; }) }, form.select('to')))),
        h(V.TextArea, Object.assign({ label: 'Reason', required: true, rows: 2 }, form.field('reason')))) : null);
  }

  /* =========================================================== Documents (4.24) */
  /* ============================================================== Assets (4.31) */
  function MyAssets() {
    var m = me();
    var rows = store.collection('assets').filter(function (a) { return a.assignedTo === m.id; });
    return h(React.Fragment, null,
      h(Card, { title: 'Assigned to me', description: 'What you hold, since when, and its condition on handover.' },
        rows.length
          ? h('div', { className: 'list' }, rows.map(function (a) {
              return h('div', { className: 'list__row', key: a.id },
                h('span', { className: 'empty__mark', style: { width: 34, height: 34 } }, I.package),
                h('div', { className: 'list__main' },
                  h('span', { className: 'list__title' }, a.name),
                  h('span', { className: 'list__meta' },
                    a.id + ' · ' + a.serial + ' · assigned ' + ui.dateLabel(a.assignedOn) + ' · condition ' + a.condition)),
                a.acknowledged === false
                  ? h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.check,
                      onClick: function () { ui.report(act.acknowledgeAsset(a.id)); } }, 'Acknowledge receipt')
                  : h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'success', dot: true }, 'Acknowledged'));
            }))
          : h(ui.Empty, {
              icon: I.package, title: 'Nothing assigned to you',
              body: 'Request an asset and HR will check availability.',
              actions: h(V.Button, { variant: 'primary', onClick: function () { router.go('me/assets/requests'); } }, 'Request an asset')
            })));
  }

  function MyAssetRequests() {
    var m = me();
    var openSt = React.useState(false);
    var form = ui.useForm({});
    var rows = store.collection('assetRequests').filter(function (a) { return a.employee === m.id; });

    function save() {
      var res = form.submit(function (v) { return ui.report(act.requestAsset(m.id, v)); });
      if (res && res.ok) { openSt[1](false); form.reset({}); }
    }

    return h(React.Fragment, null,
      h(Card, {
        title: 'My asset requests',
        aside: h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus, onClick: function () { openSt[1](true); } }, 'Request an asset')
      },
        h(ui.DataTable, {
          exportName: 'my-asset-requests', label: 'My asset requests', rows: rows, pageSize: 10, onExport: false,
          columns: [
            { key: 'id', header: 'Request', cell: function (a) { return h('span', { className: 'mono' }, a.id); } },
            { key: 'category', header: 'Category' },
            { key: 'reason', header: 'Reason' },
            { key: 'requestedOn', header: 'Raised', sortable: true, cell: function (a) { return ui.dateLabel(a.requestedOn); } },
            { key: 'approver', header: 'Approver', csv: function (a) { return emp(a.approver) ? emp(a.approver).name : ''; },
              cell: function (a) { return emp(a.approver) ? emp(a.approver).name : '—'; } },
            { key: 'status', header: 'Status', cell: function (a) { return h(ui.StatusChip, { status: a.status }); } },
            { key: 'fulfilled', header: 'Allocated', csv: function (a) { return a.fulfilledWith || ''; },
              cell: function (a) { return a.fulfilledWith ? h('span', { className: 'mono' }, a.fulfilledWith) : ''; } }
          ],
          emptyIcon: I.package, emptyTitle: 'No requests raised',
          emptyBody: 'Ask for a laptop, monitor, headset or anything else you need to work.',
          emptyActions: h(V.Button, { variant: 'primary', iconStart: I.plus, onClick: function () { openSt[1](true); } }, 'Request an asset')
        })),

      openSt[0] ? h(ui.Modal, {
        title: 'Request an asset', description: 'HR checks inventory before approving.',
        onClose: function () { openSt[1](false); },
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { openSt[1](false); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: save }, 'Submit request'))
      },
        h(V.Select, Object.assign({ label: 'Asset category', required: true, placeholder: 'Choose',
          options: seed.assetCategories }, form.select('category'))),
        h(V.TextArea, Object.assign({ label: 'Reason', required: true, rows: 3,
          placeholder: 'Why do you need it?' }, form.field('reason')))) : null);
  }

  function MyAssetHistory() {
    var m = me();
    var current = store.collection('assets').filter(function (a) { return a.assignedTo === m.id; });
    var past = store.collection('assetHistory').filter(function (x) { return x.employee === m.id; });
    var rows = current.map(function (a) {
      return { id: a.id, name: a.name, category: a.category, from: a.assignedOn, to: null, condition: a.condition };
    }).concat(past.map(function (x) {
      var asset = store.find('assets', x.asset) || {};
      return { id: x.id, name: asset.name || x.asset, category: asset.category || '—', from: x.from, to: x.to, condition: x.condition };
    }));

    return h(Card, { title: 'Asset history', description: 'Everything you have held and returned.' },
      h(ui.DataTable, {
        exportName: 'my-asset-history', label: 'My asset history', rows: rows, pageSize: 10,
        columns: [
          { key: 'name', header: 'Asset', sortable: true },
          { key: 'category', header: 'Category' },
          { key: 'from', header: 'From', cell: function (x) { return ui.dateLabel(x.from); } },
          { key: 'to', header: 'To', cell: function (x) { return x.to ? ui.dateLabel(x.to) : h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info' }, 'Current'); } },
          { key: 'condition', header: 'Condition' }
        ],
        emptyIcon: I.package, emptyTitle: 'No asset history'
      }));
  }

  /* ============================================================= Payroll (4.37) */
  function SalaryStructure() {
    var m = me();
    var b = m.breakdown || seed.util.breakdown(m.ctc);
    return h(Grid, null,
      h(Card, { span: 7, title: 'My salary structure', description: 'Your monthly earnings and deductions.' },
        h('div', { className: 'payslip' },
          h('div', { className: 'payslip__col' },
            h('span', { className: 'eyebrow' }, 'Earnings'),
            b.earnings.map(function (row) {
              return h('div', { className: 'payslip__row', key: row[0] },
                h('span', null, row[0]), h('b', null, ui.inr(row[1])));
            }),
            h('div', { className: 'payslip__row payslip__total' },
              h('span', null, 'Gross'), h('b', null, ui.inr(b.gross)))),
          h('div', { className: 'payslip__col' },
            h('span', { className: 'eyebrow' }, 'Deductions'),
            b.deductions.map(function (row) {
              return h('div', { className: 'payslip__row', key: row[0] },
                h('span', null, row[0]), h('b', null, ui.inr(row[1])));
            }),
            h('div', { className: 'payslip__row payslip__total' },
              h('span', null, 'Total deductions'), h('b', null, ui.inr(b.totalDeductions))))),
        h('div', { className: 'payslip__net' },
          h('span', null, 'Monthly net pay'), h('b', null, ui.inr(b.net)))),
      h(Card, { span: 5, title: 'Summary' },
        h(ui.KeyValue, { rows: [
          ['Annual CTC', ui.inr(m.ctc)],
          ['Monthly gross', ui.inr(b.gross)],
          ['Employer PF', ui.inr(b.employerPf)],
          ['Structure', (store.collection('salaryStructures').filter(function (s) { return s.id === m.salaryStructure; })[0] || {}).name],
          ['Effective from', m.salaryEffective ? ui.dateLabel(m.salaryEffective) : m.joinedLabel],
          ['Paid to', m.bank && m.bank.name ? m.bank.name + ' ' + m.bank.account : null]
        ]}),
        h('p', { className: 'muted', style: { fontSize: 12 } },
          'PRD 10: payroll is a confidential module. You see your own figures only.')));
  }

  function MyPayslips() {
    var m = me();
    var openSt = React.useState(null);
    var rows = store.collection('payslips').filter(function (p) { return p.employee === m.id; });

    return h(React.Fragment, null,
      h(Card, { title: 'My payslips', description: 'Monthly payslips, newest first.' },
        h(ui.DataTable, {
          exportName: 'my-payslips', label: 'My payslips', rows: rows, pageSize: 12,
          search: function (p) { return p.period; }, searchPlaceholder: 'Search by period',
          columns: [
            { key: 'period', header: 'Period', sortable: true },
            { key: 'gross', header: 'Gross', numeric: true, align: 'right', cell: function (p) { return ui.inr(p.gross); } },
            { key: 'deductions', header: 'Deductions', numeric: true, align: 'right', cell: function (p) { return ui.inr(p.deductions); } },
            { key: 'net', header: 'Net pay', numeric: true, align: 'right',
              cell: function (p) { return h('strong', { style: { fontWeight: 500 } }, ui.inr(p.net)); } },
            { key: 'paidOn', header: 'Credited', cell: function (p) { return ui.dateLabel(p.paidOn); } },
            { key: 'status', header: 'Status', cell: function (p) { return h(ui.StatusChip, { status: p.status }); } },
            { key: 'actions', header: '', align: 'right',
              cell: function (p) {
                return h('span', { className: 'row gap-2', style: { justifyContent: 'flex-end' } },
                  h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', onClick: function () { openSt[1](p); } }, 'View'),
                  h(V.IconButton, { icon: I.download, 'aria-label': 'Download ' + p.period,
                    onClick: function () { ui.toast(p.period + ' payslip download started', 'success'); } }));
              } }
          ],
          emptyIcon: I.card, emptyTitle: 'No payslips yet',
          emptyBody: 'Your first payslip appears here once payroll runs for a period you worked in.'
        })),

      openSt[0] ? h(ui.Modal, {
        title: 'Payslip · ' + openSt[0].period, wide: true,
        description: m.name + ' · ' + m.id + ' · ' + m.designation,
        onClose: function () { openSt[1](null); },
        footer: h(V.Button, { variant: 'primary', iconStart: I.download,
          onClick: function () { ui.toast('Payslip download started', 'success'); } }, 'Download PDF')
      },
        (function () {
          var b = m.breakdown || seed.util.breakdown(m.ctc);
          return h(React.Fragment, null,
            h(ui.KeyValue, { columns: true, rows: [
              ['Employee', m.name], ['Employee ID', m.id],
              ['Department', deptName(m.department)], ['Designation', m.designation],
              ['Period', openSt[0].period], ['Credited on', ui.dateLabel(openSt[0].paidOn)],
              ['Paid days', '30'], ['Loss of pay', String(openSt[0].lopDays || 0)]
            ]}),
            h('div', { className: 'payslip' },
              h('div', { className: 'payslip__col' },
                h('span', { className: 'eyebrow' }, 'Earnings'),
                b.earnings.map(function (row) {
                  return h('div', { className: 'payslip__row', key: row[0] },
                    h('span', null, row[0]), h('b', null, ui.inr(row[1])));
                }),
                h('div', { className: 'payslip__row payslip__total' },
                  h('span', null, 'Gross earnings'), h('b', null, ui.inr(openSt[0].gross)))),
              h('div', { className: 'payslip__col' },
                h('span', { className: 'eyebrow' }, 'Deductions'),
                b.deductions.map(function (row) {
                  return h('div', { className: 'payslip__row', key: row[0] },
                    h('span', null, row[0]), h('b', null, ui.inr(row[1])));
                }),
                h('div', { className: 'payslip__row payslip__total' },
                  h('span', null, 'Total deductions'), h('b', null, ui.inr(openSt[0].deductions))))),
            h('div', { className: 'payslip__net' },
              h('span', null, 'Net pay'), h('b', null, ui.inr(openSt[0].net))));
        })()) : null);
  }

  function MyTaxDeclaration() {
    var m = me();
    var existing = store.collection('taxDeclarations').filter(function (t) { return t.employee === m.id; })[0];
    var form = ui.useForm(existing || { regime: 'New', declared: 0, proofs: 0 });

    function save() {
      form.submit(function (v) { return ui.report(act.submitTaxDeclaration(m.id, v)); });
    }

    return h(Grid, null,
      h(Card, { span: 7, title: 'Tax declaration', description: 'FY 2026-27. Declare investments so tax is deducted correctly.' },
        h(V.SegmentedControl, {
          value: form.values.regime, fullWidth: true,
          items: [{ value: 'New', label: 'New regime' }, { value: 'Old', label: 'Old regime' }],
          onChange: function (v) { form.set('regime', v); }
        }),
        h('p', { className: 'muted', style: { fontSize: 12 } },
          form.values.regime === 'New'
            ? 'The new regime has lower rates and no investment deductions, so declarations do not reduce tax.'
            : 'The old regime allows deductions under 80C, 80D and others against declared investments.'),
        h(ui.FieldRow, null,
          h(V.NumberField, Object.assign({ label: 'Total declared investments (₹)', min: 0, step: 5000 }, form.field('declared', { number: true }))),
          h(V.NumberField, Object.assign({ label: 'Proof documents uploaded', min: 0, max: 20 }, form.field('proofs', { number: true })))),
        h(V.Button, { variant: 'primary', onClick: save }, existing && existing.status !== 'Not Started' ? 'Update declaration' : 'Submit declaration')),
      h(Card, { span: 5, title: 'Status' },
        h(ui.KeyValue, { rows: [
          ['Financial year', 'FY 2026-27'],
          ['Regime', existing ? existing.regime : '—'],
          ['Declared', existing && existing.declared ? ui.inr(existing.declared) : null],
          ['Proofs', existing ? existing.proofs : 0],
          ['Status', h(ui.StatusChip, { status: existing ? existing.status : 'Not Started' })],
          ['Submitted on', existing && existing.submittedOn ? ui.dateLabel(existing.submittedOn) : null]
        ]}),
        h('p', { className: 'muted', style: { fontSize: 12 } },
          'PRD 4.34: tax and statutory calculations are configurable per jurisdiction and are not assumed to be universal.')));
  }

  function MyPayments() {
    var m = me();
    var rows = store.collection('payslips').filter(function (p) { return p.employee === m.id; });
    var total = rows.reduce(function (n, p) { return n + p.net; }, 0);
    return h(React.Fragment, null,
      h(Stats, { cols: 3 },
        h(Stat, { label: 'Payments received', value: rows.length, sub: 'Across all periods' }),
        h(Stat, { label: 'Total net paid', value: ui.inr(total, { short: true }), sub: 'Lifetime at Nexora' }),
        h(Stat, { label: 'Credited to', value: m.bank && m.bank.account ? '••' + String(m.bank.account).slice(-4) : '—', sub: m.bank && m.bank.name })),
      h(Card, { title: 'Payment history' },
        h(ui.DataTable, {
          exportName: 'my-payments', label: 'My payment history', rows: rows, pageSize: 12,
          columns: [
            { key: 'period', header: 'Period', sortable: true },
            { key: 'paidOn', header: 'Credited', sortable: true, cell: function (p) { return ui.dateLabel(p.paidOn); } },
            { key: 'net', header: 'Amount', numeric: true, align: 'right', cell: function (p) { return ui.inr(p.net); } },
            { key: 'account', header: 'Account', csv: function () { return m.bank && m.bank.account; },
              cell: function () { return m.bank && m.bank.name ? m.bank.name + ' ' + m.bank.account : '—'; } },
            { key: 'mode', header: 'Mode', cell: function () { return h(V.Chip, { size: 'sm', shape: 'tag' }, 'NEFT'); } },
            { key: 'status', header: 'Status', cell: function (p) { return h(ui.StatusChip, { status: 'Paid' }); } }
          ],
          emptyIcon: I.card, emptyTitle: 'No payments yet'
        })));
  }

  function MyTaxDocuments() {
    var DOCS = [
      { id: 'f16-26', name: 'Form 16 — FY 2025-26', kind: 'Form 16', issued: '2026-06-15', status: 'Published' },
      { id: 'f16-25', name: 'Form 16 — FY 2024-25', kind: 'Form 16', issued: '2025-06-18', status: 'Published' },
      { id: 'f12bb-26', name: 'Form 12BB — FY 2026-27', kind: 'Form 12BB', issued: null, status: 'Pending' },
      { id: 'tds-q2', name: 'TDS certificate — Q2 FY 2026-27', kind: 'TDS', issued: '2026-10-20', status: 'Published' }
    ];
    return h(Card, { title: 'Tax documents', description: 'Annual statements and related forms.' },
      h(ui.DataTable, {
        exportName: 'my-tax-documents', label: 'My tax documents', rows: DOCS, pageSize: 10, onExport: false,
        columns: [
          { key: 'name', header: 'Document', sortable: true },
          { key: 'kind', header: 'Type', cell: function (d) { return h(V.Chip, { size: 'sm', shape: 'tag' }, d.kind); } },
          { key: 'issued', header: 'Issued', cell: function (d) { return d.issued ? ui.dateLabel(d.issued) : h('span', { className: 'muted' }, 'Not yet issued'); } },
          { key: 'status', header: 'Status', cell: function (d) { return h(ui.StatusChip, { status: d.status }); } },
          { key: 'actions', header: '', align: 'right',
            cell: function (d) {
              return d.status === 'Published'
                ? h(V.IconButton, { icon: I.download, 'aria-label': 'Download ' + d.name,
                    onClick: function () { ui.toast(d.name + ' download started', 'success'); } })
                : '';
            } }
        ]
      }));
  }

  /* ========================================================= Performance (4.46) */
  function MyGoals() {
    var m = me();
    var openSt = React.useState(false);
    var form = ui.useForm({ cycle: 'pc-h2-26', due: '2026-12-31' });
    var rows = store.collection('goals').filter(function (g) { return g.employee === m.id; });
    var achieved = rows.filter(function (g) { return g.status === 'Achieved'; }).length;
    var weighted = rows.reduce(function (n, g) { return n + (g.progress * g.weight) / 100; }, 0);

    function save() {
      var res = form.submit(function (v) { return ui.report(act.createGoal(m.id, v)); });
      if (res && res.ok) { openSt[1](false); form.reset({ cycle: 'pc-h2-26', due: '2026-12-31' }); }
    }

    return h(React.Fragment, null,
      h(Stats, { cols: 3 },
        h(Stat, { label: 'Goals', value: rows.length, sub: achieved + ' achieved' }),
        h(Stat, { label: 'Weighted progress', value: Math.round(weighted), unit: '%', sub: 'Across all goals', tone: weighted >= 70 ? 'good' : 'warn' }),
        h(Stat, { label: 'Cycle', value: 'H2', unit: 'FY2026', sub: 'Ends 31 Dec 2026' })),

      h(Card, {
        title: 'My goals', description: 'Update progress as you go. Your manager sees these during the review.',
        aside: h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus, onClick: function () { openSt[1](true); } }, 'Add a goal')
      },
        rows.length
          ? h('div', { className: 'list' }, rows.map(function (g) {
              return h('div', { className: 'list__row', key: g.id },
                h('div', { className: 'list__main' },
                  h('span', { className: 'list__title' }, g.title),
                  h('span', { className: 'list__meta' }, g.weight + '% weight · due ' + ui.dateLabel(g.due)),
                  h('div', { style: { marginTop: 6, maxWidth: 320 } },
                    h(V.Slider, {
                      min: 0, max: 100, step: 5, defaultValue: g.progress, showValue: true,
                      'aria-label': 'Progress on ' + g.title,
                      formatValue: function (v) { return v + '%'; },
                      onChange: function (v) { store.setOverride('goals', g.id, { progress: v }); }
                    }))),
                h('div', { className: 'stack gap-2', style: { alignItems: 'flex-end' } },
                  h(ui.StatusChip, { status: g.status }),
                  h(V.Button, { variant: 'outline', className: 'vi-btn--sm',
                    onClick: function () { ui.report(act.updateGoalProgress(g.id, g.progress)); } }, 'Save')));
            }))
          : h(ui.Empty, {
              icon: I.target, title: 'No goals set', body: 'Add a goal, or wait for your manager to assign one.',
              actions: h(V.Button, { variant: 'primary', iconStart: I.plus, onClick: function () { openSt[1](true); } }, 'Add a goal')
            })),

      openSt[0] ? h(ui.Modal, {
        title: 'Add a goal', onClose: function () { openSt[1](false); },
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { openSt[1](false); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: save }, 'Add goal'))
      },
        h(V.TextField, Object.assign({ label: 'Goal', required: true, placeholder: 'What will you achieve?' }, form.field('title'))),
        h(ui.FieldRow, null,
          h(V.NumberField, Object.assign({ label: 'Weight (%)', min: 0, max: 100, step: 5 }, form.field('weight', { number: true }))),
          h(V.DateField, Object.assign({ label: 'Due date' }, form.field('due'))))) : null);
  }

  function SelfAppraisal() {
    var m = me();
    var assessment = store.collection('assessments').filter(function (a) { return a.employee === m.id; })[0];
    var form = ui.useForm({ ratings: {} });
    var ratingsSt = React.useState({});

    function save() {
      var res = form.submit(function (v) {
        return ui.report(act.submitSelfAssessment(m.id, assessment && assessment.id, {
          summary: v.summary, ratings: ratingsSt[0]
        }));
      });
      if (res && res.ok) form.reset({ ratings: {} });
    }

    if (!assessment) {
      return h(Card, { title: 'Self-appraisal' },
        h(ui.Empty, {
          icon: I.target, title: 'No open assessment',
          body: 'You are not in an open appraisal cycle. H2 FY2026 opens on 15 November 2026.'
        }));
    }
    if (assessment.self === 'Submitted') {
      return h(Grid, null,
        h(Card, { span: 7, title: 'Self-appraisal submitted' },
          h(ui.KeyValue, { rows: [
            ['Cycle', 'H2 FY2026'],
            ['Submitted on', ui.dateLabel(assessment.selfSubmittedOn)],
            ['Reviewer', assessment.reviewer ? emp(assessment.reviewer).name : null],
            ['Manager review', h(ui.StatusChip, { status: assessment.manager === 'Submitted' ? 'Submitted' : 'Not Started' })]
          ]}),
          assessment.selfSummary
            ? h('div', { className: 'stack gap-2' },
                h('span', { className: 'eyebrow' }, 'What you wrote'),
                h('p', { style: { fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' } }, assessment.selfSummary))
            : null),
        h(Card, { span: 5, title: 'What happens next' },
          h(ui.Timeline, { items: [
            { title: 'Self-assessment submitted', when: ui.dateLabel(assessment.selfSubmittedOn), tone: 'success' },
            { title: 'Manager review', when: assessment.manager === 'Submitted' ? 'Done' : 'Pending', tone: assessment.manager === 'Submitted' ? 'success' : 'warning' },
            { title: 'Calibration', when: 'After all reviews', tone: 'neutral' },
            { title: 'Results published', when: 'Mid December', tone: 'neutral' }
          ]})));
    }

    return h(Grid, null,
      h(Card, { span: 7, title: 'Self-appraisal · H2 FY2026',
        description: 'Rate yourself against each competency, then summarise your half.' },
        seed.competencies.map(function (c) {
          return h('div', { className: 'stack gap-1', key: c, style: { paddingBottom: 10 } },
            h('span', { style: { fontSize: 14 } }, c),
            h(V.SegmentedControl, {
              size: 'sm', value: String(ratingsSt[0][c] || ''),
              items: [1, 2, 3, 4, 5].map(function (n) { return { value: String(n), label: String(n) }; }),
              onChange: function (v) {
                var next = Object.assign({}, ratingsSt[0]);
                next[c] = Number(v);
                ratingsSt[1](next);
              }
            }));
        }),
        h(V.TextArea, Object.assign({
          label: 'Summary of your half', required: true, rows: 5,
          placeholder: 'What went well, what was hard, what you want next.',
          hint: form.errors.summary || 'At least a couple of sentences.'
        }, form.field('summary'))),
        form.errors._ ? h('p', { style: { color: 'var(--danger-fg)', fontSize: 13 } }, form.errors._) : null,
        h(V.Button, { variant: 'primary', onClick: save }, 'Submit self-assessment')),

      h(Card, { span: 5, title: 'My goals this cycle' },
        (function () {
          var goals = store.collection('goals').filter(function (g) { return g.employee === m.id; });
          return goals.length
            ? h('div', { className: 'list' }, goals.map(function (g) {
                return h('div', { className: 'list__row', key: g.id },
                  h('div', { className: 'list__main' },
                    h('span', { className: 'list__title' }, g.title),
                    h('span', { className: 'list__meta' }, g.weight + '% weight')),
                  h('span', { style: { width: 76 } }, h(V.ProgressBar, { value: g.progress, size: 'sm', 'aria-label': g.title })));
              }))
            : h(ui.Empty, { icon: I.target, title: 'No goals to reference' });
        })(),
        h(V.Button, { variant: 'outline', className: 'vi-btn--sm', onClick: function () { router.go('me/performance/goals'); } }, 'Update my goals')));
  }

  function ManagerFeedback() {
    var m = me();
    var assessment = store.collection('assessments').filter(function (a) { return a.employee === m.id; })[0];
    if (!assessment || assessment.manager !== 'Submitted') {
      return h(Card, { title: 'Manager feedback' },
        h(ui.Empty, {
          icon: I.comment, title: 'Nothing published yet',
          body: assessment
            ? 'Your manager has not submitted their review. Feedback appears here once results are published.'
            : 'You are not in an open appraisal cycle.'
        }));
    }
    return h(Grid, null,
      h(Card, { span: 7, title: 'Manager feedback · H2 FY2026' },
        h(ui.KeyValue, { rows: [
          ['Reviewer', assessment.reviewer ? emp(assessment.reviewer).name : null],
          ['Overall rating', assessment.rating ? assessment.rating + ' of 5' : null],
          ['Submitted on', ui.dateLabel(assessment.managerSubmittedOn)]
        ]}),
        assessment.managerSummary
          ? h('p', { style: { fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)' } }, assessment.managerSummary)
          : h('p', { className: 'muted', style: { fontSize: 13 } }, 'No written summary was recorded.')),
      h(Card, { span: 5, title: 'Rating scale' },
        h(ui.KeyValue, { rows: [
          ['5', 'Consistently exceeds expectations'], ['4', 'Often exceeds expectations'],
          ['3', 'Meets expectations'], ['2', 'Partially meets expectations'], ['1', 'Below expectations']
        ]})));
  }

  function PerformanceHistory() {
    var m = me();
    var past = store.collection('perfCycles').filter(function (c) { return c.status === 'Completed'; });
    /* Deterministic past ratings, so the history is stable across reloads. */
    var rows = past.map(function (c) {
      var n = hash(m.id + c.id);
      return { id: c.id, cycle: c.name, period: c.period, rating: 3 + (n % 3) * 0.5, published: c.to };
    });
    return h(Card, { title: 'Performance history', description: 'Results from earlier appraisal cycles.' },
      h(ui.DataTable, {
        exportName: 'my-performance-history', label: 'My performance history', rows: rows, pageSize: 10, onExport: false,
        columns: [
          { key: 'cycle', header: 'Cycle', sortable: true },
          { key: 'period', header: 'Review period' },
          { key: 'rating', header: 'Rating', numeric: true, align: 'right',
            cell: function (x) { return h('strong', { style: { fontWeight: 500 } }, x.rating + ' / 5'); } },
          { key: 'bar', header: '', cell: function (x) { return h(V.ProgressBar, { value: (x.rating / 5) * 100, size: 'sm', 'aria-label': x.cycle }); } },
          { key: 'published', header: 'Published', cell: function (x) { return ui.dateLabel(x.published); } }
        ],
        emptyIcon: I.history, emptyTitle: 'No completed cycles yet'
      }));
  }

  /* ========================================================== Engagement (4.41) */
  function MySurveys() {
    var m = me();
    var openSt = React.useState(null);
    var answersSt = React.useState({});
    var done = store.pref('surveysDone') || [];
    var rows = store.collection('surveys');

    function submit() {
      var res = ui.report(act.submitSurvey(m.id, openSt[0].id, answersSt[0]));
      if (res && res.ok) { openSt[1](null); answersSt[1]({}); }
    }

    return h(React.Fragment, null,
      h(Card, { title: 'Surveys', description: 'Surveys open to you, with the closing date.' },
        h(ui.DataTable, {
          exportName: 'my-surveys', label: 'Surveys', rows: rows, pageSize: 10, onExport: false,
          columns: [
            { key: 'name', header: 'Survey', sortable: true },
            { key: 'type', header: 'Type', cell: function (s) { return h(V.Chip, { size: 'sm', shape: 'tag' }, s.type); } },
            { key: 'questions', header: 'Questions', numeric: true, align: 'right' },
            { key: 'anonymous', header: 'Anonymous', align: 'center', csv: function (s) { return s.anonymous ? 'Yes' : 'No'; },
              cell: function (s) {
                return s.anonymous
                  ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'success', icon: I.lock }, 'Anonymous')
                  : h('span', { className: 'muted' }, 'Identified');
              } },
            { key: 'to', header: 'Closes', sortable: true, cell: function (s) { return ui.dateLabel(s.to); } },
            { key: 'status', header: 'Status', cell: function (s) { return h(ui.StatusChip, { status: s.status }); } },
            { key: 'actions', header: '', align: 'right',
              cell: function (s) {
                if (done.indexOf(s.id) >= 0) return h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'success', dot: true }, 'Submitted');
                if (s.status !== 'Live') return '';
                return h(V.Button, { variant: 'primary', className: 'vi-btn--sm',
                  onClick: function () { answersSt[1]({}); openSt[1](s); } }, 'Take survey');
              } }
          ],
          emptyIcon: I.smile, emptyTitle: 'No surveys open'
        })),

      openSt[0] ? h(ui.Modal, {
        title: openSt[0].name, wide: true,
        description: openSt[0].anonymous
          ? 'This survey is anonymous. Your answers are not linked to your name (PRD 4.41).'
          : 'Your name is recorded against your answers.',
        onClose: function () { openSt[1](null); },
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { openSt[1](null); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: submit }, 'Submit response'))
      },
        seed.surveyQuestions.slice(0, openSt[0].questions).map(function (q) {
          var isNps = q.kind === 'NPS';
          var isText = q.kind === 'Text Response';
          return h('div', { className: 'stack gap-2', key: q.id, style: { paddingBottom: 8 } },
            h('span', { style: { fontSize: 14 } }, q.text),
            h('span', { className: 'muted', style: { fontSize: 11 } }, q.kind),
            isText
              ? h(V.TextArea, {
                  rows: 3, 'aria-label': q.text,
                  onChange: function (e) {
                    var next = Object.assign({}, answersSt[0]); next[q.id] = e.target.value; answersSt[1](next);
                  }
                })
              : h(V.SegmentedControl, {
                  size: 'sm', value: String(answersSt[0][q.id] || ''),
                  items: (isNps ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [1, 2, 3, 4, 5]).map(function (n) {
                    return { value: String(n), label: String(n) };
                  }),
                  onChange: function (v) {
                    var next = Object.assign({}, answersSt[0]); next[q.id] = Number(v); answersSt[1](next);
                  }
                }));
        })) : null);
  }

  function MyFeedback() {
    var m = me();
    var openSt = React.useState(false);
    var form = ui.useForm({ anonymous: true });
    var mine = store.collection('feedback').filter(function (f) { return f.employee === m.id; });

    function save() {
      var res = form.submit(function (v) { return ui.report(act.submitFeedback(m.id, v)); });
      if (res && res.ok) { openSt[1](false); form.reset({ anonymous: true }); }
    }

    return h(React.Fragment, null,
      h(Card, {
        title: 'My feedback', description: 'Tell HR what is working and what is not. You may send it anonymously.',
        aside: h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus, onClick: function () { openSt[1](true); } }, 'Give feedback')
      },
        mine.length
          ? h('div', { className: 'list' }, mine.map(function (f) {
              return h('div', { className: 'list__row', key: f.id },
                h(V.Chip, { size: 'sm', shape: 'tag' }, f.category),
                h('div', { className: 'list__main' },
                  h('span', { className: 'list__title' }, f.note),
                  h('span', { className: 'list__meta' }, ui.dateLabel(f.on))),
                h(ui.StatusChip, { status: f.status }));
            }))
          : h(ui.Empty, {
              icon: I.comment, title: 'No feedback submitted',
              body: 'Anonymous feedback is not linked to your name anywhere in the product.',
              actions: h(V.Button, { variant: 'primary', iconStart: I.plus, onClick: function () { openSt[1](true); } }, 'Give feedback')
            })),

      openSt[0] ? h(ui.Modal, {
        title: 'Give feedback', onClose: function () { openSt[1](false); },
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { openSt[1](false); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: save }, 'Submit feedback'))
      },
        h(V.Select, Object.assign({ label: 'Category', required: true, placeholder: 'Choose',
          options: ['Workplace', 'Tools', 'Process', 'Management', 'Benefits'] }, form.select('category'))),
        h(V.TextArea, Object.assign({ label: 'Feedback', required: true, rows: 4 }, form.field('note'))),
        h(V.Checkbox, Object.assign({
          label: 'Send anonymously',
          description: 'Your name is not stored against the feedback.'
        }, form.check('anonymous')))) : null);
  }

  function MyRecognition() {
    var m = me();
    var openSt = React.useState(false);
    var form = ui.useForm({});
    var received = store.collection('recognition').filter(function (x) { return x.to === m.id; });
    var given = store.collection('recognition').filter(function (x) { return x.from === m.id; });

    function save() {
      var res = form.submit(function (v) { return ui.report(act.giveRecognition(m.id, v)); });
      if (res && res.ok) { openSt[1](false); form.reset({}); }
    }

    function feed(rows, dir) {
      return rows.length
        ? h('div', { className: 'list' }, rows.map(function (x) {
            var other = emp(dir === 'to' ? x.from : x.to);
            return h('div', { className: 'list__row', key: x.id },
              h(V.Avatar, { name: other ? other.name : '?', size: 'sm' }),
              h('div', { className: 'list__main' },
                h('span', { className: 'list__title' }, x.note),
                h('span', { className: 'list__meta' },
                  (dir === 'to' ? 'From ' : 'To ') + (other ? other.name : 'someone') + ' · ' + ui.dateLabel(x.on))),
              h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info', icon: I.star }, x.value));
          }))
        : h(ui.Empty, { icon: I.star, title: dir === 'to' ? 'No recognition received yet' : 'You have not recognised anyone yet' });
    }

    return h(React.Fragment, null,
      h(Stats, { cols: 2 },
        h(Stat, { label: 'Recognition received', value: received.length, sub: 'From colleagues', tone: received.length ? 'good' : null }),
        h(Stat, { label: 'Recognition given', value: given.length, sub: 'To colleagues' })),
      h(Grid, null,
        h(Card, { span: 6, title: 'Received' }, feed(received, 'to')),
        h(Card, { span: 6, title: 'Given',
          aside: h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus, onClick: function () { openSt[1](true); } }, 'Recognise someone') },
          feed(given, 'from'))),

      openSt[0] ? h(ui.Modal, {
        title: 'Recognise a colleague', onClose: function () { openSt[1](false); },
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { openSt[1](false); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: save }, 'Send recognition'))
      },
        h(ui.EmployeePicker, {
          label: 'Colleague', value: form.values.to,
          status: form.errors.to ? 'error' : undefined, hint: form.errors.to,
          onChange: function (v) { form.set('to', v); }
        }),
        h(V.Select, Object.assign({ label: 'Value demonstrated', required: true, placeholder: 'Choose',
          options: ['Ownership', 'Craft', 'Teamwork', 'Customer first'] }, form.select('value'))),
        h(V.TextArea, Object.assign({ label: 'What they did', required: true, rows: 3 }, form.field('note')))) : null);
  }

  /* ============================================================== Exit (4.49) */
  function myCase() {
    var m = me();
    return store.collection('offboarding').filter(function (o) {
      return o.employee === m.id && o.stage !== 'Completed' && o.stage !== 'Rejected';
    })[0];
  }

  /* ====================================================== Exit request (PRD 4.49)
     Before a resignation exists this screen is one question and one button. Once it
     does, the same route becomes the case: what was submitted, where it is, who has to
     agree, and what has to be cleared. The deeper tabs beside it — notice, handover,
     assets, formalities — stay as they are; this is the front page of the exit. */
  function ExitArt() {
    return h('svg', { viewBox: '0 0 240 200', fill: 'none', role: 'img', 'aria-label': 'A letter being written' },
      h('rect', { x: 38, y: 44, width: 132, height: 128, rx: 10, fill: 'var(--bg-muted)', stroke: 'var(--border-strong)', strokeWidth: 2 }),
      [72, 94, 116, 138].map(function (y, i) {
        return h('rect', { key: y, x: 60, y: y, width: i === 3 ? 48 : 88, height: 7, rx: 3.5, fill: 'var(--border-default, #d5d7de)' });
      }),
      /* The pencil, laid across the page. */
      h('g', { transform: 'rotate(38 168 70)' },
        h('rect', { x: 152, y: 18, width: 26, height: 104, rx: 7, fill: 'var(--brand-solid)' }),
        h('rect', { x: 152, y: 34, width: 26, height: 9, fill: 'var(--brand-on-solid)', opacity: 0.45 }),
        h('path', { d: 'M152 122h26l-13 22z', fill: 'var(--text-primary)' }),
        h('path', { d: 'M160 136h10l-5 8z', fill: 'var(--bg-surface)' })),
      h('circle', { cx: 196, cy: 150, r: 6, fill: 'var(--brand-softer)', stroke: 'var(--brand-border)', strokeWidth: 2 }),
      h('circle', { cx: 32, cy: 60, r: 4, fill: 'var(--brand-softer)', stroke: 'var(--brand-border)', strokeWidth: 2 }));
  }

  /* The dialog of the design: who, when, why, and whether the role gets backfilled. */
  function ResignationModal(p) {
    var m = p.employee;
    var fileRef = React.useRef(null);
    var fileSt = React.useState('');
    var form = ui.useForm({ replacement: '' }, function (v) { return rules.validResignation(v); });
    var shortfall = form.values.lastWorkingDay
      ? rules.noticeShortfall(form.values.lastWorkingDay, 60) : null;

    function save() {
      var res = form.submit(function (v) {
        return ui.report(act.submitResignation(m.id, {
          lastWorkingDay: v.lastWorkingDay, reason: v.reason, replacement: v.replacement,
          comments: v.comments, attachment: fileSt[0] || null
        }));
      });
      if (res && res.ok) p.onClose();
    }

    return h(ui.Modal, {
      title: 'Submit Resignation Request', wide: true,
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
        h(V.Button, { variant: 'primary', onClick: save }, 'Submit'))
    },
      h(ui.FieldRow, { cols: 2 },
        /* Your own resignation, so this is who you are rather than a choice. */
        h(V.TextField, { label: 'Employee', required: true, value: m.name + ' · ' + m.id, readOnly: true }),
        h(V.DateField, Object.assign({
          label: 'Last working date', required: true, min: seed.todayIso
        }, form.field('lastWorkingDay')))),
      shortfall
        ? h('p', { style: { fontSize: 12, color: 'var(--warning-fg)', margin: '-6px 0 10px' } },
          shortfall + '. HR may ask you to serve the full period or settle the shortfall.')
        : null,
      h(ui.FieldRow, { cols: 2 },
        h(V.Select, Object.assign({
          label: 'Reason', required: true, placeholder: 'Select', options: seed.exitReasons
        }, form.select('reason'))),
        h(V.Select, Object.assign({
          label: 'Replacement required', required: true, placeholder: 'Select',
          options: ['Yes', 'No', 'To be decided']
        }, form.select('replacement')))),
      h(V.TextArea, Object.assign({
        label: 'Explanation (if any)', rows: 3, placeholder: 'Anything you would like HR to know'
      }, form.field('comments'))),
      h('div', { className: 'stack gap-2' },
        h('span', { className: 'vi-field__label' }, 'Attachment'),
        h('div', { className: 'row gap-2', style: { alignItems: 'center' } },
          h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.clip,
            onClick: function () { if (fileRef.current) fileRef.current.click(); } }, 'Upload file'),
          h('span', { className: 'muted', style: { fontSize: 12 } },
            fileSt[0] || 'A resignation letter, if you have one'),
          fileSt[0]
            ? h(V.IconButton, { icon: I.close, 'aria-label': 'Remove the attachment',
              onClick: function () { fileSt[1](''); } })
            : null),
        h('input', {
          ref: fileRef, type: 'file', className: 'visually-hidden', 'aria-label': 'Choose a file',
          onChange: function (e) {
            var f = e.target.files && e.target.files[0];
            if (f) fileSt[1](f.name);
            e.target.value = '';
          }
        })),
      form.errors._ ? h('p', { style: { color: 'var(--danger-fg)', fontSize: 13, margin: 0 } }, form.errors._) : null);
  }

  function Resignation() {
    var m = me();
    var askSt = React.useState(false);
    var c = myCase();

    /* ---- Nothing submitted: the question, and the one button that answers it ---- */
    if (!c) {
      return h(React.Fragment, null,
        h('div', { className: 'exitgate' },
          h('div', { className: 'exitgate__copy' },
            h('p', { className: 'exitgate__text' },
              'Before you proceed, are you certain you want to submit your resignation? '
              + 'We value your contributions and would love to discuss any concerns or '
              + 'potential solutions with you.'),
            h(V.Button, { variant: 'primary', onClick: function () { askSt[1](true); } },
              'Submit Resignation Request'),
            h('p', { className: 'exitgate__note' },
              'Your manager and HR both review this. Nothing changes until it is approved, '
              + 'and you keep full access until your last working day.')),
          h('div', { className: 'exitgate__art' }, h(ExitArt))),
        askSt[0] ? h(ResignationModal, {
          employee: m, onClose: function () { askSt[1](false); }
        }) : null);
    }

    /* ---- Submitted: the case ---- */
    var approvals = store.collection('approvals').filter(function (a) {
      return a.module === 'offboarding' && a.employee === m.id;
    });
    var daysLeft = Math.max(0, Math.round((new Date(c.lastWorkingDay + 'T00:00') - seed.today) / 86400000));
    var accepted = c.status === 'Approved';
    var tasks = c.tasks || [];
    var done = tasks.filter(function (t) { return t.done; }).length;

    return h(React.Fragment, null,
      h(ui.PageHead, {
        eyebrow: c.id, title: 'Exit request',
        description: 'Submitted ' + ui.dateLabel(c.resignedOn) + ' · last working day ' + c.lastWorkingDayLabel + '.',
        actions: [
          h(V.Button, { key: 'n', variant: 'outline', iconStart: I.calendar,
            onClick: function () { router.go('me/exit/notice'); } }, 'Notice period'),
          h(V.Button, { key: 'f', variant: 'outline', iconStart: I.checklist,
            onClick: function () { router.go('me/exit/formalities'); } }, 'Exit formalities')
        ]
      }),

      h(Stats, { cols: 4 },
        h(Stat, { label: 'Stage', value: c.stage, sub: accepted ? 'Resignation accepted' : 'Awaiting a decision',
          tone: accepted ? 'good' : 'warn' }),
        h(Stat, { label: 'Last working day', value: ui.shortDate(c.lastWorkingDay), sub: c.lastWorkingDayLabel }),
        h(Stat, { label: 'Days remaining', value: daysLeft, sub: 'Of a ' + c.noticeDays + '-day notice',
          tone: daysLeft < 15 ? 'warn' : null }),
        h(Stat, { label: 'Clearance', value: c.clearance, unit: '%', sub: done + ' of ' + tasks.length + ' tasks done' })),

      h(Grid, null,
        h(Card, { span: 7, title: 'Resignation details' },
          h(ui.KeyValue, { rows: [
            ['Request', h('span', { className: 'mono' }, c.id)],
            ['Employee', m.name + ' · ' + m.id],
            ['Submitted on', ui.dateLabel(c.resignedOn)],
            ['Last working day', c.lastWorkingDayLabel],
            ['Notice period', c.noticeDays + ' days'],
            ['Reason', c.reason],
            ['Replacement required', c.replacement || 'Not stated'],
            ['Attachment', c.attachment
              ? h('span', { className: 'row gap-2', style: { alignItems: 'center' } },
                h('span', { className: 'mono' }, c.attachment),
                h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', iconStart: I.download,
                  onClick: function () { ui.toast(c.attachment + ' download started', 'success'); } }, 'Download'))
              : null],
            ['Approval', h(ui.StatusChip, { status: c.status })]
          ]}),
          c.comments
            ? h(ui.FormSection, { title: 'Explanation' },
              h('p', { style: { fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 } }, c.comments))
            : null),

        h(Card, { span: 5, title: 'Timeline' },
          h(ui.Timeline, { items: [
            { title: 'Resignation submitted', body: 'By you', when: ui.dateLabel(c.resignedOn), tone: 'success' },
            { title: 'Manager and HR review',
              body: accepted ? 'Accepted' : 'With your approvers',
              when: accepted ? (c.approvedOn ? ui.dateLabel(c.approvedOn) : 'Done') : 'In progress',
              tone: accepted ? 'success' : 'warning' },
            { title: 'Notice period',
              body: c.noticeDays + ' days, ending ' + c.lastWorkingDayLabel,
              when: c.stage === 'Notice Period' ? daysLeft + ' days left' : 'After approval',
              tone: c.stage === 'Notice Period' ? 'success' : 'neutral' },
            { title: 'Handover and clearance',
              body: done + ' of ' + tasks.length + ' tasks done',
              when: 'During notice', tone: done ? 'warning' : 'neutral' },
            { title: 'Final settlement and exit documents',
              body: 'Settlement ' + String(c.settlement).toLowerCase(),
              when: 'On your last working day', tone: 'neutral' }
          ]})),

        h(Card, { span: 5, title: 'Approvals', description: 'Who has to agree before your notice starts.' },
          approvals.length
            ? h('div', { className: 'list' }, approvals.map(function (a) {
              var who = emp(a.approver);
              return h('div', { className: 'list__row', key: a.id },
                h(V.Avatar, { name: who ? who.name : 'HR', size: 'sm' }),
                h('div', { className: 'list__main' },
                  h('span', { className: 'list__title' }, who ? who.name : 'HR'),
                  h('span', { className: 'list__meta' }, a.kind + ' · raised ' + ui.dateLabel(a.submitted))),
                h(ui.StatusChip, { status: a.status }));
            }))
            : h(ui.Empty, { icon: I.ok, title: 'No approval outstanding' })),

        h(Card, { span: 7, title: 'Clearance',
          description: 'Everything that has to be signed off before your settlement is released.',
          aside: h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', iconEnd: I.right,
            onClick: function () { router.go('me/exit/formalities'); } }, 'All formalities') },
          h(V.ProgressBar, { label: 'Clearance', value: c.clearance, showValue: true,
            tone: c.clearance >= 100 ? 'success' : 'primary' }),
          h('div', { className: 'checks', style: { marginTop: 10 } }, tasks.map(function (t) {
            return h('div', { className: 'checks__row' + (t.done ? ' is-done' : ''), key: t.name },
              h('span', { className: 'steps__tick' + (t.done ? ' is-done' : '') }, I.check),
              h('div', { className: 'checks__main' },
                h('span', { className: 'checks__name' }, t.name),
                h('span', { className: 'checks__meta' },
                  t.done ? 'Completed' : (t.owner && emp(t.owner) ? 'With ' + emp(t.owner).name : 'Pending'))));
          })))));
  }

  function NoticePeriod() {
    var c = myCase();
    if (!c) {
      return h(Card, { title: 'Notice period' },
        h(ui.Empty, { icon: I.calendar, title: 'Not applicable', body: 'You have not submitted a resignation.' }));
    }
    var daysLeft = Math.max(0, Math.round((new Date(c.lastWorkingDay + 'T00:00') - seed.today) / 86400000));
    var served = c.noticeDays - daysLeft;
    return h(React.Fragment, null,
      h(Stats, { cols: 3 },
        h(Stat, { label: 'Last working day', value: ui.shortDate(c.lastWorkingDay), sub: c.lastWorkingDayLabel }),
        h(Stat, { label: 'Days remaining', value: daysLeft, sub: 'Of a ' + c.noticeDays + '-day notice', tone: daysLeft < 15 ? 'warn' : null }),
        h(Stat, { label: 'Clearance', value: c.clearance, unit: '%', sub: c.tasksDone + ' of ' + c.tasksTotal + ' tasks done' })),
      h(Grid, null,
        h(Card, { span: 7, title: 'Notice period' },
          h(V.ProgressBar, { label: 'Notice served', value: ui.pct(Math.max(0, served), c.noticeDays), showValue: true }),
          h(ui.KeyValue, { rows: [
            ['Resignation accepted', c.approvedOn ? ui.dateLabel(c.approvedOn) : 'Awaiting approval'],
            ['Notice period', c.noticeDays + ' days'],
            ['Last working day', c.lastWorkingDayLabel],
            ['Assets outstanding', c.assetsOutstanding],
            ['Final settlement', h(ui.StatusChip, { status: c.settlement })]
          ]})),
        h(Card, { span: 5, title: 'My exit checklist' },
          h('div', { className: 'checks' }, (c.tasks || []).map(function (t) {
            return h('div', { className: 'checks__row' + (t.done ? ' is-done' : ''), key: t.name },
              h('span', { className: 'steps__tick' }, I.check),
              h('div', { className: 'checks__main' },
                h('span', { className: 'checks__name' }, t.name),
                h('span', { className: 'checks__meta' }, t.owner && emp(t.owner) ? 'Owner: ' + emp(t.owner).name : '')));
          })))));
  }

  function Handover() {
    var c = myCase();
    if (!c) {
      return h(Card, { title: 'Knowledge transfer' },
        h(ui.Empty, { icon: I.subtask, title: 'Not applicable', body: 'Handover tasks appear here once a resignation is approved.' }));
    }
    var items = (c.tasks || []).filter(function (t) { return /Knowledge|Handover/.test(t.name); });
    return h(Grid, null,
      h(Card, { span: 7, title: 'Knowledge transfer', description: 'Tasks assigned to you during your notice period.' },
        items.length
          ? h('div', { className: 'checks' }, items.map(function (t) {
              return h('div', { className: 'checks__row' + (t.done ? ' is-done' : ''), key: t.name },
                h(V.Checkbox, {
                  checked: !!t.done, 'aria-label': t.name,
                  onChange: function (e) { ui.report(act.completeOffboardingTask(c.id, t.name, e.target.checked)); }
                }),
                h('div', { className: 'checks__main' },
                  h('span', { className: 'checks__name' }, t.name),
                  h('span', { className: 'checks__meta' }, t.done ? 'Completed' : 'Pending')));
            }))
          : h(ui.Empty, { icon: I.subtask, title: 'No handover tasks assigned yet' })),
      h(Card, { span: 5, title: 'Who takes over' },
        h('p', { className: 'muted', style: { fontSize: 13, lineHeight: 1.6 } },
          'Your manager assigns a successor and signs off the handover. Until then, keep the list above up to date.'),
        h(ui.KeyValue, { rows: [
          ['Manager', emp(me().manager) ? emp(me().manager).name : null],
          ['Department', deptName(me().department)],
          ['Last working day', c.lastWorkingDayLabel]
        ]})));
  }

  function ExitAssetReturn() {
    var m = me();
    var c = myCase();
    var held = store.collection('assets').filter(function (a) { return a.assignedTo === m.id; });
    var returned = store.collection('assetHistory').filter(function (x) { return x.employee === m.id; });
    return h(React.Fragment, null,
      h(Card, { title: 'Assets to return',
        description: c ? 'Everything you hold must be returned and verified before your final settlement (PRD 14.8).'
          : 'What you currently hold. Returns are recorded during offboarding.' },
        held.length
          ? h('div', { className: 'list' }, held.map(function (a) {
              return h('div', { className: 'list__row', key: a.id },
                h('span', { className: 'empty__mark', style: { width: 34, height: 34 } }, I.package),
                h('div', { className: 'list__main' },
                  h('span', { className: 'list__title' }, a.name),
                  h('span', { className: 'list__meta' }, a.id + ' · ' + a.serial + ' · condition ' + a.condition)),
                h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning', dot: true }, 'To return'));
            }))
          : h(ui.Empty, { icon: I.ok, title: 'Nothing left to return', body: 'Every asset assigned to you has been returned.' })),
      returned.length
        ? h(Card, { title: 'Returned' },
            h('div', { className: 'list' }, returned.map(function (x) {
              var asset = store.find('assets', x.asset) || {};
              return h('div', { className: 'list__row', key: x.id },
                h('div', { className: 'list__main' },
                  h('span', { className: 'list__title' }, asset.name || x.asset),
                  h('span', { className: 'list__meta' }, 'Returned ' + ui.dateLabel(x.to) + ' · condition ' + x.condition)),
                h(ui.StatusChip, { status: 'Returned' }));
            })))
        : null);
  }

  function ExitFormalities() {
    var c = myCase();
    if (!c) {
      return h(Card, { title: 'Exit formalities' },
        h(ui.Empty, { icon: I.checklist, title: 'Not applicable', body: 'Exit formalities appear here once a resignation is approved.' }));
    }
    return h(Grid, null,
      h(Card, { span: 7, title: 'Exit formalities' },
        h('div', { className: 'checks' }, (c.tasks || []).map(function (t) {
          return h('div', { className: 'checks__row' + (t.done ? ' is-done' : ''), key: t.name },
            h('span', { className: 'steps__tick' }, I.check),
            h('div', { className: 'checks__main' },
              h('span', { className: 'checks__name' }, t.name),
              h('span', { className: 'checks__meta' },
                t.done ? 'Completed' : (t.owner && emp(t.owner) ? 'With ' + emp(t.owner).name : 'Pending'))));
        }))),
      h(Card, { span: 5, title: 'Final settlement' },
        h(ui.KeyValue, { rows: [
          ['Status', h(ui.StatusChip, { status: c.settlement })],
          ['Amount', c.settlementAmount ? ui.inr(c.settlementAmount) : null],
          ['Settled on', c.settledOn ? ui.dateLabel(c.settledOn) : null],
          ['Clearance', c.clearance + '%'],
          ['Assets outstanding', c.assetsOutstanding]
        ]}),
        h('p', { className: 'muted', style: { fontSize: 12 } },
          'Your settlement is released once clearance is complete. Exit documents follow within seven working days.'),
        h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.download, disabled: c.settlement !== 'Paid',
          onClick: function () { ui.toast('Exit documents download started', 'success'); } }, 'Download exit documents')));
  }

  /* ================================================ Profile header and overview
     The header is drawn by the frame above the tab row, because it is the person
     rather than any one tab: whichever tab you are on, it is still your record. */
  function ProfileHeader() {
    var m = me();
    if (!m) return null;
    var dept = store.department(m.department);
    return h('div', { className: 'phead' },
      h('div', { className: 'phead__cover' },
        /* The arcs of the design, drawn rather than fetched. */
        h('svg', { viewBox: '0 0 900 112', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
          h('path', { d: 'M300 150 A 150 150 0 0 1 600 150', fill: 'none',
            stroke: 'var(--brand-solid)', strokeWidth: 10, opacity: 0.5 }),
          h('path', { d: 'M345 160 A 105 105 0 0 1 555 160', fill: 'none',
            stroke: 'var(--brand-solid)', strokeWidth: 8, opacity: 0.25 }))),

      h('div', { className: 'phead__body' },
        h('span', { className: 'phead__face' }, h(V.Avatar, { name: m.name, size: 'xl' })),
        h('div', { className: 'phead__who' },
          h('h1', { className: 'phead__name' }, m.name),
          h('span', { className: 'phead__sub' },
            h('span', { className: 'mono' }, '#' + m.id), ' · ', m.designation)),
        h('div', { className: 'phead__aside' },
          h(ui.StatusChip, { status: m.status, size: 'md' }))),

      h('div', { className: 'phead__chips' },
        h('div', { className: 'pchip' },
          h('span', { className: 'pchip__k' }, 'Department'),
          h('span', { className: 'pchip__v' },
            h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'primary', dot: true },
              dept ? dept.name : '—'))),
        h('div', { className: 'pchip' },
          h('span', { className: 'pchip__k' }, 'Employment type'),
          h('span', { className: 'pchip__v' },
            h(V.Chip, { size: 'sm', shape: 'tag' }, m.type))),
        h('div', { className: 'pchip' },
          h('span', { className: 'pchip__k' }, 'Email'),
          h('span', { className: 'pchip__v' }, I.mail, h('span', { title: m.workEmail }, m.workEmail))),
        h('div', { className: 'pchip' },
          h('span', { className: 'pchip__k' }, 'Phone number'),
          h('span', { className: 'pchip__v' }, I.chat, h('span', null, m.phone)))));
  }

  /* Present, remote, late and leave over the last 30 days, counted from the same
     day-by-day record the attendance history lists. */
  function attendanceSummary(m, days) {
    var rows = historyFor(m, days);
    var n = { present: 0, remote: 0, late: 0, leave: 0 };
    rows.forEach(function (r) {
      if (r.status === 'Present') n.present++;
      else if (r.status === 'Work From Home') n.remote++;
      else if (r.status === 'Late') { n.late++; n.present++; }
      else if (r.status === 'On Leave') n.leave++;
    });
    return n;
  }

  function ProfileOverview() {
    var m = me();
    if (!m) return h(ui.Empty, { icon: I.person, title: 'No employee record' });

    var manager = m.manager ? emp(m.manager) : null;
    var goals = store.collection('goals')
      .filter(function (g) { return g.employee === m.id; })
      .sort(function (a, b) { return b.progress - a.progress; });
    var open = goals.filter(function (g) { return g.status !== 'Achieved'; });
    var shown = (open.length ? open : goals).slice(0, 3);
    var att = attendanceSummary(m, 30);
    var achieved = goals.filter(function (g) { return g.status === 'Achieved'; }).length;
    var avg = goals.length
      ? Math.round(goals.reduce(function (t, g) { return t + g.progress; }, 0) / goals.length) : 0;
    var assessment = store.collection('assessments').filter(function (a) { return a.employee === m.id; })[0];
    var shift = store.shift(m.shift);
    var loc = store.location(m.location);

    return h('div', { className: 'pcols' },
      h('div', null,
      h(Card, { title: 'About' },
        h('p', { style: { fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 } },
          m.name + ' is a ' + m.designation + ' in '
          + (store.department(m.department) || {}).name + ', based at '
          + (loc ? loc.name : 'the office') + ' since ' + m.joinedLabel + '.'
          + (manager ? ' They report to ' + manager.name + '.' : ''))),

      h(Card, { title: 'Employee information' },
        h('div', { className: 'psnap' },
          [['Employee ID', h('span', { className: 'mono' }, m.id)],
            ['Work email', m.workEmail],
            ['Phone', m.phone],
            ['Join date', m.joinedLabel],
            ['Reporting to', manager ? manager.name : 'Not assigned'],
            ['Work type', shift ? shift.name : 'Not set'],
            ['Office location', loc ? loc.name : '\u2014'],
            ['Employment type', m.type]].map(function (row) {
            return h('div', { key: row[0] },
              h('span', { className: 'psnap__k' }, row[0]),
              h('span', { className: 'psnap__v' }, row[1]));
          }))),

      h(Card, { title: 'Performance snapshot',
        description: assessment ? 'The open cycle, as it stands.' : 'No cycle open for you yet.',
        aside: h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', iconEnd: I.right,
          onClick: function () { router.go('me/performance/standing'); } }, 'My standing') },
        h('div', { className: 'pmeter' },
          h('div', { className: 'pmeter__head' },
            h('span', { className: 'pmeter__t' }, 'Goal completion'),
            h('span', { className: 'pmeter__n' }, avg + '%')),
          h(V.ProgressBar, { value: avg, size: 'sm', 'aria-label': 'Goal completion',
            tone: avg >= 75 ? 'success' : avg >= 40 ? 'primary' : 'warning' }),
          h('span', { className: 'pmeter__s' }, achieved + ' of ' + goals.length + ' goals achieved')),
        assessment
          ? h('div', { className: 'pmeter' },
            h('div', { className: 'pmeter__head' },
              h('span', { className: 'pmeter__t' }, 'Self-assessment'),
              h('span', { className: 'pmeter__n' }, assessment.self === 'Submitted' ? 'Submitted' : 'Not started')),
            h(V.ProgressBar, { value: assessment.self === 'Submitted' ? 100 : 0, size: 'sm',
              'aria-label': 'Self-assessment', tone: assessment.self === 'Submitted' ? 'success' : 'warning' }),
            h('span', { className: 'pmeter__s' },
              'Manager review ' + (assessment.manager === 'Submitted' ? 'submitted' : 'not started')))
          : null)),

      h('div', null,
      h(Card, { title: 'Goals in progress',
        description: goals.length ? achieved + ' of ' + goals.length + ' achieved this cycle' : null,
        aside: h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', iconEnd: I.right,
          onClick: function () { router.go('me/performance/goals'); } }, 'All goals') },
        shown.length
          ? shown.map(function (g) {
            return h('div', { className: 'pmeter pmeter--lined', key: g.id },
              h('div', { className: 'pmeter__head' },
                h('span', { className: 'pmeter__t' }, g.title),
                h('span', { className: 'pmeter__n' }, g.progress + '%')),
              h(V.ProgressBar, {
                value: g.progress, size: 'sm', 'aria-label': g.title,
                tone: g.progress >= 100 ? 'success' : g.progress >= 50 ? 'primary' : 'warning'
              }),
              h('span', { className: 'pmeter__s' }, g.status + ' · due ' + ui.dateLabel(g.due)));
          })
          : h(ui.Empty, { icon: I.target, title: 'No goals set for this cycle' })),

      h(Card, { title: 'Attendance summary', description: 'Your last 30 days.' },
        h('div', null,
          [['Present days', att.present, 'var(--brand-solid)', null],
            ['Remote days', att.remote, 'var(--success-fg)', null],
            ['Late check-ins', att.late, 'var(--danger-fg)', null],
            ['Leave taken', att.leave, 'var(--warning-fg)', 'days']].map(function (row) {
            return h('div', { className: 'pstat', key: row[0] },
              h('span', { className: 'pstat__dot', style: { background: row[2] } }),
              h('span', { className: 'pstat__l' }, row[0]),
              h('span', { className: 'pstat__v' }, row[1],
                row[3] ? h('small', null, row[3]) : null));
          })))));
  }

  /* ============================================ Education, and the three summaries
     Qualifications and prior roles are records now, so they can be added to and
     corrected. Leave, attendance and performance join the profile as summaries of the
     person, each pointing at the module that holds the whole of it. */
  function EducationEntryModal(p) {
    var isQual = p.kind === 'qualifications';
    var form = ui.useForm(p.entry || (isQual
      ? { level: '', specialisation: '', institution: '', year: '', grade: '' }
      : { role: '', company: '', from: '', to: '' }));

    function save() {
      var res = form.submit(function (v) {
        var entry = p.entry ? Object.assign({}, p.entry, v) : v;
        return ui.report(act.saveEducationEntry(p.kind, p.employee, entry));
      });
      if (res && res.ok) p.onClose();
    }

    return h(ui.Modal, {
      title: (p.entry ? 'Edit ' : 'Add ') + (isQual ? 'a qualification' : 'an earlier role'),
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
        h(V.Button, { variant: 'primary', onClick: save }, p.entry ? 'Save' : 'Add'))
    },
      isQual
        ? h(React.Fragment, null,
          h(V.TextField, Object.assign({ label: 'Qualification', required: true,
            placeholder: 'e.g. Bachelor of Technology' }, form.field('level'))),
          h(V.TextField, Object.assign({ label: 'Specialisation',
            placeholder: 'e.g. Computer Science' }, form.field('specialisation'))),
          h(V.TextField, Object.assign({ label: 'Institution', required: true }, form.field('institution'))),
          h(ui.FieldRow, { cols: 2 },
            h(V.NumberField, Object.assign({ label: 'Year of passing', min: 1950, max: 2100 }, form.field('year', { number: true }))),
            h(V.TextField, Object.assign({ label: 'Grade', placeholder: 'e.g. 72%' }, form.field('grade')))))
        : h(React.Fragment, null,
          h(V.TextField, Object.assign({ label: 'Role', required: true,
            placeholder: 'e.g. Product Designer' }, form.field('role'))),
          h(V.TextField, Object.assign({ label: 'Company', required: true }, form.field('company'))),
          h(ui.FieldRow, { cols: 2 },
            h(V.NumberField, Object.assign({ label: 'From', min: 1950, max: 2100 }, form.field('from', { number: true }))),
            h(V.NumberField, Object.assign({ label: 'To', min: 1950, max: 2100 }, form.field('to', { number: true })))))); 
  }

  function EducationScreen() {
    var m = me();
    var editSt = React.useState(null);     // { kind, entry }
    var dropSt = React.useState(null);     // { kind, id, what }
    if (!m) return h(ui.Empty, { icon: I.person, title: 'No employee record' });

    var quals = store.collection('qualifications')
      .filter(function (q) { return q.employee === m.id; })
      .sort(function (a, b) { return (b.year || 0) - (a.year || 0); });
    var exp = store.collection('experience')
      .filter(function (x) { return x.employee === m.id; })
      .sort(function (a, b) { return (b.from || 0) - (a.from || 0); });

    function rows(list, kind, render) {
      return h('div', { className: 'checks' }, list.map(function (it) {
        var shown = render(it);
        return h('div', { className: 'checks__row', key: it.id },
          h('span', { className: 'empty__mark', style: { width: 28, height: 28 } },
            kind === 'qualifications' ? I.reports : I.building),
          h('div', { className: 'checks__main' },
            h('span', { className: 'checks__name' }, shown[0]),
            h('span', { className: 'checks__meta' }, shown[1])),
          shown[2] ? h(V.Chip, { size: 'sm', shape: 'tag' }, shown[2]) : null,
          h(V.IconButton, { icon: I.pencil, 'aria-label': 'Edit ' + shown[0],
            onClick: function () { editSt[1]({ kind: kind, entry: it }); } }),
          h(V.IconButton, { icon: I.trash, 'aria-label': 'Remove ' + shown[0],
            onClick: function () { dropSt[1]({ kind: kind, id: it.id, what: shown[0] }); } }));
      }));
    }

    return h(React.Fragment, null,
      h(Grid, null,
        h(Card, { span: 12, title: 'Qualifications',
          description: 'Your education, newest first. Yours to keep up to date.',
          aside: h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.plus,
            onClick: function () { editSt[1]({ kind: 'qualifications', entry: null }); } }, 'Add qualification') },
          quals.length
            ? rows(quals, 'qualifications', function (q) {
              return [q.level + (q.specialisation ? ' · ' + q.specialisation : ''),
                q.institution + (q.grade ? ' · ' + q.grade : ''),
                q.year ? String(q.year) : null];
            })
            : h(ui.Empty, { icon: I.reports, title: 'No qualifications recorded',
              body: 'Add your degrees and certificates so HR has them on file.' })),

        h(Card, { span: 12, title: 'Previous experience',
          description: 'Where you worked before joining.',
          aside: h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.plus,
            onClick: function () { editSt[1]({ kind: 'experience', entry: null }); } }, 'Add a role') },
          exp.length
            ? rows(exp, 'experience', function (x) {
              return [x.role, x.company, (x.from || '?') + ' – ' + (x.to || 'present')];
            })
            : h(ui.Empty, { icon: I.building, title: 'Nothing recorded',
              body: 'If you worked elsewhere before joining, add it here.' }))),

      editSt[0] ? h(EducationEntryModal, {
        kind: editSt[0].kind, entry: editSt[0].entry, employee: m.id,
        onClose: function () { editSt[1](null); }
      }) : null,
      dropSt[0] ? h(ui.Confirm, {
        title: 'Remove this entry?',
        body: '"' + dropSt[0].what + '" is removed from your record. This cannot be undone.',
        confirmLabel: 'Remove', tone: 'danger',
        onConfirm: function () { ui.report(act.deleteEducationEntry(dropSt[0].kind, dropSt[0].id)); },
        onClose: function () { dropSt[1](null); }
      }) : null);
  }

  /* The three summaries. Each answers its question here and hands off to the module
     that owns the detail, rather than reproducing it. */
  function ProfileLeave() {
    var m = me();
    if (!m) return null;
    var balances = store.balancesFor(m.id);
    var mine = store.collection('leaveRequests')
      .filter(function (l) { return l.employee === m.id; })
      .sort(function (a, b) { return a.from < b.from ? 1 : -1; }).slice(0, 5);

    return h(Grid, null,
      h(Card, { span: 12, title: 'Leave balances',
        aside: h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconEnd: I.right,
          onClick: function () { router.go('me/leave/overview'); } }, 'Apply or manage') },
        balances.length
          ? h('div', { className: 'lbal' }, balances.map(function (b) {
            return h('div', { className: 'lbal__cell', key: b.type },
              h('span', { className: 'lbal__n' }, b.available,
                h('small', null, '/' + (b.entitled + (b.carried || 0)))),
              h('span', { className: 'lbal__t' }, (store.leaveType(b.type) || {}).name),
              h('span', { className: 'lbal__s' }, 'Taken', h('b', null, b.used)));
          }))
          : h(ui.Empty, { icon: I.calendar, title: 'No leave types on your policy' })),

      h(Card, { span: 12, title: 'Recent requests' },
        mine.length
          ? h('div', { className: 'list' }, mine.map(function (l) {
            return h('div', { className: 'list__row', key: l.id },
              h('div', { className: 'list__main' },
                h('span', { className: 'list__title' }, (store.leaveType(l.type) || {}).name),
                h('span', { className: 'list__meta' },
                  ui.dateLabel(l.from) + ' – ' + ui.dateLabel(l.to) + ' · ' + l.days
                  + ' day' + (l.days === 1 ? '' : 's'))),
              h(ui.StatusChip, { status: l.status }));
          }))
          : h(ui.Empty, { icon: I.calendar, title: 'No requests yet' })));
  }

  function ProfileAttendance() {
    var m = me();
    if (!m) return null;
    var att = attendanceSummary(m, 30);
    var recent = historyFor(m, 10);

    return h(Grid, null,
      h(Card, { span: 5, title: 'Last 30 days',
        aside: h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconEnd: I.right,
          onClick: function () { router.go('me/attendance/history'); } }, 'Full history') },
        h('div', null,
          [['Present days', att.present, 'var(--brand-solid)'],
            ['Remote days', att.remote, 'var(--success-fg)'],
            ['Late check-ins', att.late, 'var(--danger-fg)'],
            ['Leave taken', att.leave, 'var(--warning-fg)']].map(function (row) {
            return h('div', { className: 'pstat', key: row[0] },
              h('span', { className: 'pstat__dot', style: { background: row[2] } }),
              h('span', { className: 'pstat__l' }, row[0]),
              h('span', { className: 'pstat__v' }, row[1]));
          }))),

      h(Card, { span: 7, title: 'Recent days' },
        h('div', { className: 'list' }, recent.map(function (d) {
          return h('div', { className: 'list__row', key: d.date },
            h('div', { className: 'list__main' },
              h('span', { className: 'list__title' }, d.dateLabel),
              h('span', { className: 'list__meta' },
                d.checkIn ? d.checkIn + ' – ' + (d.checkOut || 'open') : 'No punch')),
            h(ui.StatusChip, { status: d.status }));
        }))));
  }

  function ProfilePerformance() {
    var m = me();
    if (!m) return null;
    var goals = store.collection('goals').filter(function (g) { return g.employee === m.id; });
    var assessment = store.collection('assessments').filter(function (a) { return a.employee === m.id; })[0];
    var achieved = goals.filter(function (g) { return g.status === 'Achieved'; }).length;
    var avg = goals.length
      ? Math.round(goals.reduce(function (t, g) { return t + g.progress; }, 0) / goals.length) : 0;

    return h(Grid, null,
      h(Card, { span: 7, title: 'Goals',
        description: goals.length ? achieved + ' of ' + goals.length + ' achieved this cycle' : null,
        aside: h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconEnd: I.right,
          onClick: function () { router.go('me/performance/goals'); } }, 'Manage goals') },
        goals.length
          ? goals.map(function (g) {
            return h('div', { className: 'pmeter', key: g.id },
              h('div', { className: 'pmeter__head' },
                h('span', { className: 'pmeter__t' }, g.title),
                h('span', { className: 'pmeter__n' }, g.progress + '%')),
              h(V.ProgressBar, { value: g.progress, size: 'sm', 'aria-label': g.title,
                tone: g.progress >= 100 ? 'success' : g.progress >= 50 ? 'primary' : 'warning' }),
              h('span', { className: 'pmeter__s' }, g.status + ' · due ' + ui.dateLabel(g.due)));
          })
          : h(ui.Empty, { icon: I.target, title: 'No goals set for this cycle' })),

      h(Card, { span: 5, title: 'The open cycle',
        aside: h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconEnd: I.right,
          onClick: function () { router.go('me/performance/standing'); } }, 'My standing') },
        h(ui.KeyValue, { rows: [
          ['Goal completion', avg + '%'],
          ['Goals achieved', achieved + ' of ' + goals.length],
          ['Self-assessment', assessment
            ? h(ui.StatusChip, { status: assessment.self === 'Submitted' ? 'Submitted' : 'Not Started' })
            : null],
          ['Manager review', assessment
            ? h(ui.StatusChip, { status: assessment.manager === 'Submitted' ? 'Submitted' : 'Not Started' })
            : null]
        ]})));
  }

  /* ================================================== My documents (PRD 4.24)
     An employee's own papers, on their own record. Sharing one sends it to HR as
     Pending Verification — the same path a document uploaded by HR takes — so the two
     sides see one queue rather than two. */
  var REQUIRED_DOCS = ['Identity Proof', 'Address Proof', 'Education Certificate', 'Employment Agreement'];

  function docTitle(d) { return d.title || d.name; }

  function ShareDocumentModal(p) {
    var fileRef = React.useRef(null);
    var fileSt = React.useState(null);              // { name, size }
    var form = ui.useForm({ title: '', category: seed.documentCategories[0], expiry: '' });

    function save() {
      var res = form.submit(function (v) {
        return ui.report(act.uploadDocument(p.employee, {
          title: v.title, category: v.category,
          name: fileSt[0] ? fileSt[0].name : '',
          size: fileSt[0] ? prettySize(fileSt[0].size) : '— KB',
          expiry: v.expiry || null
        }));
      });
      if (res && res.ok) p.onClose();
    }
    function take(file) {
      if (!file) return;
      fileSt[1]({ name: file.name, size: file.size });
      /* A first guess at the name, so the common case is one less thing to type. */
      if (!form.values.title.trim()) form.set('title', file.name.replace(/\.[^.]+$/, ''));
    }

    return h(ui.Modal, {
      title: 'Share a document',
      description: 'HR verifies what you share. You can rename it afterwards; the file itself cannot be swapped.',
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
        h(V.Button, { variant: 'primary', iconStart: I.up, onClick: save }, 'Share'))
    },
      h('div', {
        className: 'dropzone', role: 'button', tabIndex: 0,
        onClick: function () { if (fileRef.current) fileRef.current.click(); },
        onKeyDown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current.click(); } },
        onDragOver: function (e) { e.preventDefault(); },
        onDrop: function (e) { e.preventDefault(); take(e.dataTransfer && e.dataTransfer.files[0]); }
      },
        h('span', { className: 'dropzone__mark' }, I.file),
        h('span', { className: 'dropzone__title' }, fileSt[0] ? fileSt[0].name : 'Drop your document here'),
        h('span', { className: 'dropzone__hint' },
          fileSt[0] ? prettySize(fileSt[0].size) + ' · click to replace' : 'or click to browse')),
      h('input', {
        ref: fileRef, type: 'file', className: 'visually-hidden', 'aria-label': 'Choose a file',
        onChange: function (e) { take(e.target.files && e.target.files[0]); e.target.value = ''; }
      }),
      h(V.TextField, Object.assign({
        label: 'Document name', required: true, placeholder: 'e.g. Aadhaar card, front and back'
      }, form.field('title', { hint: form.errors.title || 'What this is, in your words' }))),
      h(ui.FieldRow, { cols: 2 },
        h(V.Select, Object.assign({
          label: 'Category', required: true, options: seed.documentCategories
        }, form.select('category'))),
        h(V.DateField, Object.assign({ label: 'Expires on' },
          form.field('expiry', { hint: 'Leave empty if it does not lapse' })))),
      form.errors.name ? h('p', { style: { color: 'var(--danger-fg)', fontSize: 13, margin: 0 } }, 'Choose a file to share') : null);
  }

  function prettySize(n) {
    if (n == null) return '— KB';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function MyDocuments() {
    var m = me();
    var shareSt = React.useState(false);
    var renameSt = React.useState(null);
    if (!m) return h(ui.Empty, { icon: I.person, title: 'No employee record' });

    var docs = store.collection('employeeDocuments')
      .filter(function (d) { return d.employee === m.id; })
      .sort(function (a, b) { return a.uploaded < b.uploaded ? 1 : -1; });
    var held = {};
    docs.forEach(function (d) { held[d.category] = true; });
    var missing = REQUIRED_DOCS.filter(function (c) { return !held[c]; });
    var pending = docs.filter(function (d) { return d.status === 'Pending Verification'; }).length;

    return h(React.Fragment, null,
      h(ui.PageHead, {
        eyebrow: 'My profile', title: 'Documents',
        description: 'What you have shared with HR, and what each one is waiting on.',
        actions: [
          h(V.Button, { key: 's', variant: 'primary', iconStart: I.up,
            onClick: function () { shareSt[1](true); } }, 'Share a document')
        ]
      }),

      missing.length
        ? h('div', { className: 'ai-note', style: { marginBottom: 14 } },
          h('span', { className: 'ai-note__mark' }, I.warn),
          h('div', { className: 'ai-note__body' },
            h('span', { className: 'ai-note__eyebrow' }, 'Still needed'),
            h('p', { className: 'ai-note__text' },
              missing.join(', ') + '. HR asks everyone for these, and your record is not complete without them.')))
        : null,

      h(Card, {
        title: 'My documents',
        description: docs.length
          ? docs.length + ' shared · ' + (pending ? pending + ' awaiting verification' : 'all verified or decided')
          : null
      },
        h(ui.DataTable, {
          exportName: 'my-documents', label: 'My documents', rows: docs, pageSize: 10,
          search: function (d) { return docTitle(d) + ' ' + d.category; },
          searchPlaceholder: 'Search your documents',
          columns: [
            { key: 'title', header: 'Document', sortable: true,
              sortValue: docTitle, csv: docTitle,
              cell: function (d) {
                /* The file and its size go under the title rather than in columns of
                   their own: six columns plus two actions did not fit the card. */
                var sub = [d.title && d.title !== d.name ? d.name : null, d.size]
                  .filter(Boolean).join(' \u00b7 ');
                return h('span', { className: 'row gap-2', style: { alignItems: 'center' } },
                  h('span', { className: 'empty__mark', style: { width: 26, height: 26 } }, I.file),
                  h('span', { className: 'stack gap-1' },
                    h('span', null, docTitle(d)),
                    sub ? h('span', { className: 'list__meta' }, sub) : null));
              } },
            { key: 'category', header: 'Category', sortable: true },
            { key: 'uploaded', header: 'Shared on', sortable: true,
              cell: function (d) { return ui.dateLabel(d.uploaded); } },
            { key: 'expiry', header: 'Expires',
              csv: function (d) { return d.expiry || ''; },
              cell: function (d) {
                if (!d.expiry) return h('span', { className: 'muted' }, '—');
                var n = Math.round((new Date(d.expiry + 'T00:00') - seed.today) / 86400000);
                return h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', dot: true,
                  tone: n < 0 ? 'error' : n <= 30 ? 'error' : n <= 90 ? 'warning' : 'info' },
                  n < 0 ? 'Expired' : ui.dateLabel(d.expiry));
              } },
            { key: 'status', header: 'Status',
              cell: function (d) {
                return h('span', { className: 'lstatus' },
                  h(ui.StatusChip, { status: d.status }),
                  d.verifiedBy && emp(d.verifiedBy)
                    ? h('span', { className: 'lstatus__by' }, 'by ' + emp(d.verifiedBy).name)
                    : null);
              } },
            { key: 'actions', header: '', align: 'right',
              cell: function (d) {
                return h('span', { className: 'row gap-1', style: { justifyContent: 'flex-end' } },
                  h(V.IconButton, {
                    icon: I.pencil, title: 'Rename', 'aria-label': 'Rename ' + docTitle(d),
                    onClick: function () { renameSt[1](d.id); }
                  }),
                  h(V.IconButton, {
                    icon: I.download, title: 'Download', 'aria-label': 'Download ' + docTitle(d),
                    onClick: function () { ui.toast(docTitle(d) + ' download started', 'success'); }
                  }));
              } }
          ],
          emptyIcon: I.file, emptyTitle: 'You have not shared anything yet',
          emptyBody: 'Share your identity, address, education and employment documents so HR can verify them.',
          emptyActions: h(V.Button, { variant: 'primary', iconStart: I.up,
            onClick: function () { shareSt[1](true); } }, 'Share a document')
        })),

      shareSt[0] ? h(ShareDocumentModal, {
        employee: m.id, onClose: function () { shareSt[1](false); }
      }) : null,
      renameSt[0] ? h(RenameDocumentModal, {
        doc: store.find('employeeDocuments', renameSt[0]),
        onClose: function () { renameSt[1](null); }
      }) : null);
  }

  function RenameDocumentModal(p) {
    var d = p.doc;
    var form = ui.useForm({ title: docTitle(d) });
    function save() {
      var res = form.submit(function (v) { return ui.report(act.renameEmployeeDocument(d.id, v.title)); });
      if (res && res.ok) p.onClose();
    }
    return h(ui.Modal, {
      title: 'Rename document',
      description: 'The file stays as it is — ' + d.name + '.',
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
        h(V.Button, { variant: 'primary', onClick: save }, 'Rename'))
    },
      h(V.TextField, Object.assign({
        label: 'Document name', required: true,
        onKeyDown: function (e) { if (e.key === 'Enter') { e.preventDefault(); save(); } }
      }, form.field('title'))));
  }

  HRMS.screens.registerBanner({ 'me/profile': ProfileHeader });

  HRMS.screens.register({

    'me/profile/overview': ProfileOverview,
    'me/profile/personal': profileScreen('personal'),
    'me/profile/employment': profileScreen('employment'),
    'me/profile/education': EducationScreen,
    'me/profile/bank': profileScreen('bank'),
    'me/profile/documents': MyDocuments,
    'me/profile/leave': ProfileLeave,
    'me/profile/attendance': ProfileAttendance,
    'me/profile/performance': ProfilePerformance,

    'me/attendance/today': AttendanceToday,
    'me/attendance/history': AttendanceHistory,
    'me/attendance/regularization': MyRegularization,

    'me/leave/apply': ApplyLeave,
    'me/leave/balance': LeaveBalance,
    'me/leave/history': LeaveHistory,

    'me/shifts/mine': MyShifts,
    'me/shifts/swaps': MySwaps,


    'me/assets/assigned': MyAssets,
    'me/assets/requests': MyAssetRequests,
    'me/assets/history': MyAssetHistory,

    'me/payroll/structure': SalaryStructure,
    'me/payroll/payslips': MyPayslips,
    'me/payroll/tax': MyTaxDeclaration,
    'me/payroll/payments': MyPayments,
    'me/payroll/documents': MyTaxDocuments,

    'me/performance/goals': MyGoals,
    'me/performance/self': SelfAppraisal,
    'me/performance/feedback': ManagerFeedback,
    'me/performance/history': PerformanceHistory,

    'me/engagement/surveys': MySurveys,
    'me/engagement/feedback': MyFeedback,
    'me/engagement/recognition': MyRecognition,

    'me/exit/resignation': Resignation,
    'me/exit/notice': NoticePeriod,
    'me/exit/handover': Handover,
    'me/exit/assets': ExitAssetReturn,
    'me/exit/formalities': ExitFormalities
  });
})();

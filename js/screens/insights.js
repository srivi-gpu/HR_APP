/* Phase 7 (PRD 18): the reports and analytics suite of PRD section 8, plus the HR
   "My tasks" screen of PRD 2.2.

   Two rules run through this file:
   1. Every figure is computed from store.collection(...) at render time. Nothing is
      written onto a screen, so a change to the data moves the report (PRD 15).
   2. A report says what it is counting. Each screen states its window and its active
      filters, and the less obvious figures — attrition, leave liability, average tenure
      at exit — show their working next to the headline, so a number can be checked
      rather than taken on trust. */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var store = HRMS.store, router = HRMS.router, ui = HRMS.ui, seed = HRMS.seed;
  var Card = ui.Card, Grid = ui.Grid, Stat = ui.Stat, Stats = ui.Stats, PageHead = ui.PageHead;

  function emp(id) { return store.employee(id); }
  function deptName(id) { var d = store.department(id); return d ? d.name : '—'; }
  function locName(id) { var l = store.location(id); return l ? l.name : '—'; }
  function deptOptions() { return store.collection('departments').map(function (d) { return { value: d.id, label: d.name }; }); }
  function locOptions() { return store.collection('locations').map(function (l) { return { value: l.id, label: l.name }; }); }
  var TYPES = ['Full-Time', 'Part-Time', 'Contract', 'Intern', 'Consultant', 'Temporary'];

  /* ---------------------------------------------------------------- Arithmetic
     Small, shared and deliberately dull, so each report below reads as a statement
     about the data rather than a pile of loops. */
  function sum(rows, valueOf) {
    return rows.reduce(function (n, r) { return n + (Number(valueOf(r)) || 0); }, 0);
  }
  function mean(rows, valueOf) { return rows.length ? sum(rows, valueOf) / rows.length : 0; }

  /* Count rows into a { key: count } map. */
  function tally(rows, keyOf) {
    var out = {};
    rows.forEach(function (r) {
      var k = keyOf(r);
      if (k == null || k === '') return;
      out[k] = (out[k] || 0) + 1;
    });
    return out;
  }
  /* Add rows up into a { key: total } map. */
  function totals(rows, keyOf, valueOf) {
    var out = {};
    rows.forEach(function (r) {
      var k = keyOf(r);
      if (k == null || k === '') return;
      out[k] = (out[k] || 0) + (Number(valueOf(r)) || 0);
    });
    return out;
  }
  /* [label, value] pairs for ui.Bars, largest first, empty rows dropped. */
  function pairs(map) {
    return Object.keys(map).map(function (k) { return [k, Math.round(map[k])]; })
      .filter(function (p) { return p[1] > 0; })
      .sort(function (a, b) { return b[1] - a[1]; });
  }
  /* The same, in a fixed order — for bands, scales and months, where sequence carries
     meaning and a zero is itself worth seeing. */
  function ordered(map, keys) {
    return keys.map(function (k) { return [k, Math.round(map[k] || 0)]; });
  }

  /* ------------------------------------------------------------------- Dates
     "Today" is pinned to 3 November 2026 by the seed, so a report never drifts. */
  function toDate(isoStr) { return new Date(String(isoStr).slice(0, 10) + 'T00:00'); }
  function dayGap(fromIso, toIso) { return Math.round((toDate(toIso) - toDate(fromIso)) / 86400000); }
  function backIso(n) { return seed.util.iso(seed.util.addDays(seed.today, -n)); }
  function years(days) { return Math.round((days / 365.25) * 10) / 10; }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function monthKey(isoStr) { return String(isoStr).slice(0, 7); }
  function monthLabel(key) { return MONTHS[Number(key.slice(5, 7)) - 1] + ' ' + key.slice(2, 4); }
  /* Every month the window touches, oldest first, so a trend reads left to right. */
  function monthsBetween(fromIso, toIso) {
    var out = [], y = Number(fromIso.slice(0, 4)), m = Number(fromIso.slice(5, 7));
    var lastY = Number(toIso.slice(0, 4)), lastM = Number(toIso.slice(5, 7));
    while ((y < lastY || (y === lastY && m <= lastM)) && out.length < 48) {
      out.push(y + '-' + String(m).padStart(2, '0'));
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
    return out;
  }

  /* --------------------------------------------------------------- Money basis
     A day of pay and a leave encashment both run on basic salary, which the salary
     structures of PRD 4.35 set at 40% of CTC, spread over a 30-day month. Keeping the
     basis in one place means the leave liability and the payroll cost agree. */
  function monthlyBasic(e) { return ((e && e.ctc) || 0) / 12 * 0.4; }
  function dayRate(e) { return monthlyBasic(e) / 30; }
  function breakdown(e) { return (e && e.breakdown) || seed.util.breakdown((e && e.ctc) || 0); }

  /* Salary bands for the payroll distribution (PRD 8.2), on annual CTC. */
  var BANDS = [
    ['Up to ₹5L', 0, 500000], ['₹5L – ₹10L', 500000, 1000000], ['₹10L – ₹20L', 1000000, 2000000],
    ['₹20L – ₹35L', 2000000, 3500000], ['₹35L – ₹50L', 3500000, 5000000], ['Above ₹50L', 5000000, Infinity]
  ];
  var BAND_LABELS = BANDS.map(function (b) { return b[0]; });
  function bandOf(ctc) {
    var v = Number(ctc) || 0;
    for (var i = 0; i < BANDS.length; i++) if (v >= BANDS[i][1] && v < BANDS[i][2]) return BANDS[i][0];
    return BAND_LABELS[BAND_LABELS.length - 1];
  }

  /* ============================================== Report filters (PRD 8.3)
     Every report carries the same controls: a date range, department, location,
     employee type and a search box. The three facet filters narrow the *people* a
     report looks at; the date range narrows whichever dated record the report counts,
     which differs per report and is therefore stated on each screen rather than
     assumed. The search box belongs to ui.DataTable, which already has one. */
  function useFilters(fromIso, toIso) {
    var fromSt = React.useState(fromIso);
    var toSt = React.useState(toIso);
    var deptSt = React.useState('');
    var locSt = React.useState('');
    var typeSt = React.useState('');

    var f = {
      from: fromSt[0], to: toSt[0],
      dept: deptSt[0], loc: locSt[0], type: typeSt[0],
      days: Math.max(1, dayGap(fromSt[0], toSt[0]) + 1)
    };

    /* True when an employee survives the department, location and type filters. */
    f.allows = function (e) {
      if (!e) return false;
      if (f.dept && e.department !== f.dept) return false;
      if (f.loc && e.location !== f.loc) return false;
      if (f.type && e.type !== f.type) return false;
      return true;
    };
    /* True when a record's own date falls inside the chosen window. */
    f.inRange = function (isoStr) {
      if (!isoStr) return false;
      var d = String(isoStr).slice(0, 10);
      return d >= f.from && d <= f.to;
    };
    /* A set of the employee ids in scope, for filtering a long child collection once. */
    f.idsOf = function (rows) {
      var set = {};
      rows.forEach(function (e) { set[e.id] = true; });
      return set;
    };

    f.rangeLabel = ui.dateLabel(f.from) + ' – ' + ui.dateLabel(f.to);
    f.scopeLabel = [
      f.dept ? deptName(f.dept) : null, f.loc ? locName(f.loc) : null, f.type || null
    ].filter(Boolean).join(' · ') || 'All departments, locations and types';
    f.months = monthsBetween(f.from, f.to);

    f.controls = h(React.Fragment, null,
      h('div', { className: 'filterbar__item' },
        h(V.DateField, { label: 'From', value: fromSt[0], onChange: function (e) { fromSt[1](e.target.value); } })),
      h('div', { className: 'filterbar__item' },
        h(V.DateField, { label: 'To', value: toSt[0], onChange: function (e) { toSt[1](e.target.value); } })),
      h(ui.Filter, { label: 'Department', value: deptSt[0], onChange: deptSt[1], options: deptOptions() }),
      h(ui.Filter, { label: 'Location', value: locSt[0], onChange: locSt[1], options: locOptions() }),
      h(ui.Filter, { label: 'Employee type', value: typeSt[0], onChange: typeSt[1], options: TYPES }));

    return f;
  }

  /* The line under every report head: the window, the filters, and one sentence saying
     what the date range is actually applied to. A figure with an unstated window is
     the main way a report misleads. */
  function Scope(p) {
    return h('div', { className: 'rolebar' },
      h(V.Chip, { size: 'sm', shape: 'tag', icon: I.calendar }, p.filters.rangeLabel),
      h(V.Chip, { size: 'sm', shape: 'tag', icon: I.filter }, p.filters.scopeLabel),
      h('span', { className: 'muted' }, p.note));
  }

  /* An empty state that says which filter emptied the view, not just that it is empty
     (PRD 17). Every report hands this to its table. */
  function noRows(what) {
    return {
      emptyIcon: I.reports,
      emptyTitle: 'No ' + what + ' in this window',
      emptyBody: 'Widen the date range, or clear the department, location and type filters.'
    };
  }

  /* ======================================================= Employee report (8.2)
     Headcount, distribution, new joiners, attrition and the status breakdown. */
  function EmployeeReport() {
    var f = useFilters(backIso(365), seed.todayIso);

    var records = store.collection('employees').filter(f.allows);
    var live = records.filter(function (e) { return e.status !== 'Exited'; });
    var joiners = live.filter(function (e) { return f.inRange(e.joined); });

    /* Exits are dated by the offboarding record's last working day, which is the only
       place an exit date is held — an employee record carries only the status. */
    var exits = store.collection('offboarding').filter(function (o) {
      var e = emp(o.employee);
      return e && e.status === 'Exited' && f.allows(e) && f.inRange(o.lastWorkingDay);
    });

    /* Attrition rate (PRD 8.2): exits in the window over the average headcount across
       it, annualised so a three-month window and a year are comparable. The opening
       headcount is derived — today's live count, plus everyone who left inside the
       window, less everyone who joined inside it. */
    var opening = live.length - joiners.length + exits.length;
    var avgHeadcount = (opening + live.length) / 2;
    var attrition = ui.pct(exits.length * (365 / f.days), avgHeadcount);

    var byDept = tally(live, function (e) { return deptName(e.department); });
    var byLoc = tally(live, function (e) { return locName(e.location); });
    var byType = tally(live, function (e) { return e.type; });
    var byLevel = tally(live, function (e) { return 'L' + e.level; });
    var byStatus = tally(records, function (e) { return e.status; });
    var joinTrend = tally(joiners, function (e) { return monthKey(e.joined); });
    var exitTrend = tally(exits, function (o) { return monthKey(o.lastWorkingDay); });

    return h(React.Fragment, null,
      h(Scope, { filters: f, note: 'Headcount and distribution are as at today; joiners, exits and attrition are counted inside the window.' }),

      h(Stats, null,
        h(Stat, { label: 'Headcount', value: live.length, sub: records.length - live.length + ' exited records excluded' }),
        h(Stat, { label: 'New joiners', value: joiners.length, sub: 'Joined inside the window', tone: joiners.length ? 'good' : null }),
        h(Stat, { label: 'Exits', value: exits.length, sub: 'Last working day inside the window' }),
        h(Stat, {
          label: 'Attrition rate', value: attrition, unit: '%',
          sub: 'Annualised, on ' + Math.round(avgHeadcount) + ' average headcount',
          tone: attrition > 12 ? 'warn' : 'good'
        })),

      h(Grid, null,
        h(Card, { span: 6, title: 'Headcount by department' }, h(ui.Bars, { rows: pairs(byDept) })),
        h(Card, { span: 6, title: 'Headcount by location' }, h(ui.Bars, { rows: pairs(byLoc) })),
        h(Card, { span: 4, title: 'By employment type' }, h(ui.Bars, { rows: pairs(byType) })),
        h(Card, { span: 4, title: 'By job level' },
          h(ui.Bars, { rows: ordered(byLevel, ['L7', 'L6', 'L5', 'L4', 'L3', 'L2', 'L1']) })),
        h(Card, { span: 4, title: 'Status breakdown', description: 'Across all records, archived included (PRD 14.1).' },
          h(ui.Bars, { rows: pairs(byStatus) })),

        h(Card, { span: 7, title: 'Joiners and exits by month' },
          f.months.length > 1
            ? h(React.Fragment, null,
                h('span', { className: 'eyebrow' }, 'Joiners'),
                h(ui.Bars, { rows: ordered(joinTrend, f.months).map(function (r) { return [monthLabel(r[0]), r[1], 'success']; }) }),
                h('span', { className: 'eyebrow' }, 'Exits'),
                h(ui.Bars, { rows: ordered(exitTrend, f.months).map(function (r) { return [monthLabel(r[0]), r[1], 'error']; }) }))
            : h(ui.Empty, { icon: I.calendar, title: 'Window too short for a trend', body: 'Choose a range covering at least two months.' })),

        h(Card, { span: 5, title: 'How attrition is calculated',
          description: 'PRD 8.2 names the figure but not the formula, so the working is shown.' },
          h(ui.KeyValue, { rows: [
            ['Window', f.rangeLabel + ' (' + f.days + ' days)'],
            ['Opening headcount', Math.round(opening)],
            ['Joined in window', joiners.length],
            ['Left in window', exits.length],
            ['Closing headcount', live.length],
            ['Average headcount', Math.round(avgHeadcount)],
            ['Annualised rate', attrition + '%']
          ]}),
          h('p', { className: 'muted', style: { fontSize: 12, lineHeight: 1.6 } },
            'Exits ÷ average headcount × 365 ÷ window days. Invited and onboarding records count ' +
            'towards headcount because they consume a seat (PRD 4.1).'))),

      h(Card, { title: 'Employee records', description: 'Every record behind the figures above, exported as shown.' },
        h(ui.DataTable, Object.assign({
          exportName: 'report-employee', label: 'Employee report', rows: records, pageSize: 10,
          search: function (e) { return e.name + ' ' + e.id + ' ' + e.designation + ' ' + deptName(e.department); },
          searchPlaceholder: 'Search by name, ID or designation',
          filters: f.controls,
          columns: [
            { key: 'name', header: 'Employee', sortable: true, csv: function (e) { return e.name; },
              cell: function (e) { return h(ui.Person, { employee: e, sub: e.id }); } },
            { key: 'department', header: 'Department', sortable: true,
              csv: function (e) { return deptName(e.department); }, cell: function (e) { return deptName(e.department); } },
            { key: 'location', header: 'Location', sortable: true,
              csv: function (e) { return locName(e.location); }, cell: function (e) { return locName(e.location); } },
            { key: 'type', header: 'Type', sortable: true },
            { key: 'level', header: 'Level', numeric: true, align: 'right', sortable: true,
              csv: function (e) { return 'L' + e.level; }, cell: function (e) { return 'L' + e.level; } },
            { key: 'joined', header: 'Joined', sortable: true, cell: function (e) { return e.joinedLabel; } },
            { key: 'tenure', header: 'Tenure', numeric: true, align: 'right',
              sortValue: function (e) { return dayGap(e.joined, seed.todayIso); },
              csv: function (e) { return years(dayGap(e.joined, seed.todayIso)); },
              cell: function (e) { return years(dayGap(e.joined, seed.todayIso)) + ' yrs'; } },
            { key: 'status', header: 'Status', cell: function (e) { return h(ui.StatusChip, { status: e.status }); } }
          ]
        }, noRows('employees')))));
  }

  /* ===================================================== Attendance report (8.2)
     Summary, late arrivals, absenteeism, overtime and regularization volume. */
  function AttendanceReport() {
    var f = useFilters(backIso(30), seed.todayIso);

    var live = store.collection('employees')
      .filter(function (e) { return e.status !== 'Exited'; }).filter(f.allows);
    var ids = f.idsOf(live);

    /* The prototype seeds one day of punches, so the summary is today's. The window
       applies to regularizations, which are dated across the past weeks. */
    var att = store.collection('attendanceToday').filter(function (a) { return ids[a.employee]; });
    /* Scheduled = expected to work today. Invited, onboarding and suspended records sit
       at "Not Started" and are not absentees. */
    var scheduled = att.filter(function (a) { return a.status !== 'Not Started'; });
    var present = scheduled.filter(function (a) { return a.status === 'Present' || a.status === 'Late'; });
    var wfh = scheduled.filter(function (a) { return a.status === 'Work From Home'; });
    var late = scheduled.filter(function (a) { return a.status === 'Late'; });
    var absent = scheduled.filter(function (a) { return a.status === 'Absent'; });
    var missing = scheduled.filter(function (a) { return a.status === 'Missing Punch'; });

    /* Overtime is time beyond the eight paid hours a standard shift carries (PRD 4.17). */
    var STANDARD_HOURS = 8;
    function overtimeOf(a) { return Math.max(0, (a.hours || 0) - STANDARD_HOURS); }
    var overtime = sum(att, overtimeOf);

    var regs = store.collection('regularizations')
      .filter(function (x) { return ids[x.employee] && f.inRange(x.date); });
    var regsPending = regs.filter(function (x) { return x.status === 'Pending Approval'; });

    var byStatus = tally(scheduled, function (a) { return a.status; });
    var lateByDept = tally(late, function (a) { var e = emp(a.employee); return e ? deptName(e.department) : null; });
    var otByDept = totals(att, function (a) { var e = emp(a.employee); return e ? deptName(e.department) : null; }, overtimeOf);
    var regsByIssue = tally(regs, function (x) { return x.issue; });
    var regsByMonth = tally(regs, function (x) { return monthKey(x.date); });

    var presentRate = ui.pct(present.length + wfh.length, scheduled.length);
    var absenteeism = ui.pct(absent.length, scheduled.length);

    return h(React.Fragment, null,
      h(Scope, { filters: f, note: 'The attendance summary is for ' + seed.todayLabel + '; regularizations are counted across the window.' }),

      h(Stats, null,
        h(Stat, {
          label: 'Marked present', value: presentRate, unit: '%',
          sub: present.length + ' in office, ' + wfh.length + ' from home', tone: presentRate >= 90 ? 'good' : 'warn'
        }),
        h(Stat, {
          label: 'Late arrivals', value: late.length,
          sub: late.length ? 'Average ' + Math.round(mean(late, function (a) { return a.lateBy; })) + ' min past grace' : 'Everyone on time',
          tone: late.length > 8 ? 'warn' : null
        }),
        h(Stat, {
          label: 'Absenteeism rate', value: absenteeism, unit: '%',
          sub: absent.length + ' absent of ' + scheduled.length + ' scheduled', tone: absenteeism > 3 ? 'warn' : 'good'
        }),
        h(Stat, {
          label: 'Overtime', value: Math.round(overtime), unit: 'h',
          sub: 'Beyond ' + STANDARD_HOURS + ' hours, across ' + att.filter(function (a) { return overtimeOf(a) > 0; }).length + ' people'
        })),

      h(Grid, null,
        h(Card, { span: 5, title: 'Attendance summary', description: 'Scheduled employees by marked status.' },
          h(ui.Bars, { rows: pairs(byStatus) }),
          h('div', { style: { marginTop: 10 } },
            h(V.ProgressBar, { label: 'Marked present or working from home', value: presentRate, showValue: true, tone: 'success' })),
          missing.length
            ? h(V.Button, {
                variant: 'outline', className: 'vi-btn--sm', iconStart: I.warn,
                onClick: function () { router.go('hr/attendance/regularization'); }
              }, missing.length + ' missing punches to resolve')
            : null),

        h(Card, { span: 7, title: 'Late arrivals by department' },
          h(ui.Bars, { rows: pairs(lateByDept).map(function (r) { return [r[0], r[1], 'warning']; }),
            emptyTitle: 'No late arrivals today' })),

        h(Card, { span: 6, title: 'Overtime hours by department' },
          h(ui.Bars, { rows: pairs(otByDept), emptyTitle: 'No overtime recorded' })),

        h(Card, { span: 6, title: 'Regularization volume',
          aside: h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: regsPending.length ? 'warning' : 'success', dot: true },
            regsPending.length + ' pending') },
          f.months.length > 1
            ? h(ui.Bars, { rows: ordered(regsByMonth, f.months).map(function (r) { return [monthLabel(r[0]), r[1], 'info']; }) })
            : h(ui.Bars, { rows: pairs(regsByIssue), emptyTitle: 'No corrections raised' }),
          h(ui.KeyValue, { rows: [
            ['Raised in window', regs.length],
            ['Approved', regs.filter(function (x) { return x.status === 'Approved'; }).length],
            ['Rejected', regs.filter(function (x) { return x.status === 'Rejected'; }).length],
            ['Still pending', regsPending.length]
          ]}))),

      h(Card, { title: 'Punch records', description: 'Today\'s punches for everyone in scope.' },
        h(ui.DataTable, Object.assign({
          exportName: 'report-attendance', label: 'Attendance report', rows: att, pageSize: 10,
          search: function (a) { var e = emp(a.employee); return (e ? e.name + ' ' + e.id : '') + ' ' + a.status; },
          searchPlaceholder: 'Search by name, ID or status',
          filters: f.controls,
          columns: [
            { key: 'employee', header: 'Employee', sortable: true,
              sortValue: function (a) { var e = emp(a.employee); return e ? e.name : ''; },
              csv: function (a) { var e = emp(a.employee); return e ? e.name : a.employee; },
              cell: function (a) { return h(ui.Person, { employee: emp(a.employee), sub: a.employee }); } },
            { key: 'department', header: 'Department',
              csv: function (a) { var e = emp(a.employee); return e ? deptName(e.department) : ''; },
              cell: function (a) { var e = emp(a.employee); return e ? deptName(e.department) : '—'; } },
            { key: 'status', header: 'Status', sortable: true, cell: function (a) { return h(ui.StatusChip, { status: a.status }); } },
            { key: 'checkIn', header: 'Check in', cell: function (a) { return a.checkIn || h('span', { className: 'muted' }, '—'); } },
            { key: 'checkOut', header: 'Check out', cell: function (a) { return a.checkOut || h('span', { className: 'muted' }, '—'); } },
            { key: 'hours', header: 'Hours', numeric: true, align: 'right', sortable: true,
              cell: function (a) { return a.hours ? a.hours + ' h' : h('span', { className: 'muted' }, '—'); } },
            { key: 'lateBy', header: 'Late by', numeric: true, align: 'right', sortable: true,
              csv: function (a) { return a.lateBy || 0; },
              cell: function (a) { return a.lateBy ? a.lateBy + ' min' : h('span', { className: 'muted' }, '—'); } },
            { key: 'source', header: 'Source', cell: function (a) { return a.source || h('span', { className: 'muted' }, '—'); } }
          ]
        }, noRows('punch records')))),

      h(Card, { title: 'Regularizations', description: 'Corrections raised in the window, with the original and corrected punches.' },
        h(ui.DataTable, Object.assign({
          exportName: 'report-regularizations', label: 'Regularizations', rows: regs, pageSize: 10,
          search: function (x) { var e = emp(x.employee); return (e ? e.name : '') + ' ' + x.issue + ' ' + x.reason; },
          searchPlaceholder: 'Search by name, issue or reason',
          columns: [
            { key: 'employee', header: 'Employee',
              csv: function (x) { var e = emp(x.employee); return e ? e.name : x.employee; },
              cell: function (x) { return h(ui.Person, { employee: emp(x.employee), sub: null }); } },
            { key: 'date', header: 'Date', sortable: true, cell: function (x) { return x.dateLabel; } },
            { key: 'issue', header: 'Issue', sortable: true },
            { key: 'original', header: 'Original', cell: function (x) { return h('span', { className: 'mono' }, x.original); } },
            { key: 'corrected', header: 'Corrected', cell: function (x) { return h('span', { className: 'mono' }, x.corrected); } },
            { key: 'status', header: 'Status', cell: function (x) { return h(ui.StatusChip, { status: x.status }); } }
          ]
        }, noRows('regularizations')))));
  }

  /* ========================================================== Leave report (8.2)
     Utilisation per type, balance liability, trends and department comparison. */
  function LeaveReport() {
    var f = useFilters(backIso(365), seed.todayIso);

    var live = store.collection('employees')
      .filter(function (e) { return e.status !== 'Exited'; }).filter(f.allows);
    var ids = f.idsOf(live);

    var requests = store.collection('leaveRequests')
      .filter(function (l) { return ids[l.employee] && f.inRange(l.from); });
    var taken = requests.filter(function (l) { return l.status === 'Approved'; });

    /* Balances are keyed by employee rather than row id, so they come through
       store.balancesFor and are aggregated per leave type here.

       Balance liability (PRD 8.2): unused leave that carries into the next year is money
       still owed, so it is provisioned. Casual and sick leave lapse at the year end and
       carry no cash liability; earned leave carries and therefore does. The seeded leave
       types say which is which, so the rule is read from the data, not assumed. */
    var agg = {};
    live.forEach(function (e) {
      store.balancesFor(e.id).forEach(function (b) {
        var row = agg[b.type] || (agg[b.type] = { entitled: 0, used: 0, available: 0, liability: 0, people: 0 });
        var t = store.leaveType(b.type);
        row.entitled += b.entitled;
        row.used += b.used;
        row.available += b.available;
        row.people += 1;
        if (t && t.paid && t.carry) row.liability += b.available * dayRate(e);
      });
    });
    var typeRows = Object.keys(agg).map(function (id) {
      var t = store.leaveType(id) || { name: id, paid: false, carry: false };
      return Object.assign({ id: id, name: t.name, paid: t.paid, carry: t.carry }, agg[id]);
    }).sort(function (a, b) { return b.used - a.used; });

    var entitled = sum(typeRows, function (r) { return r.entitled; });
    var used = sum(typeRows, function (r) { return r.used; });
    var unusedPaid = sum(typeRows.filter(function (r) { return r.paid; }), function (r) { return r.available; });
    var liability = sum(typeRows, function (r) { return r.liability; });

    var daysByType = totals(taken, function (l) { var t = store.leaveType(l.type); return t ? t.name : l.type; },
      function (l) { return l.days; });
    var daysByDept = totals(taken, function (l) { var e = emp(l.employee); return e ? deptName(e.department) : null; },
      function (l) { return l.days; });
    var daysByMonth = totals(taken, function (l) { return monthKey(l.from); }, function (l) { return l.days; });

    /* Department comparison is only fair per head, since departments differ in size. */
    var headByDept = tally(live, function (e) { return deptName(e.department); });
    var perHead = Object.keys(headByDept).map(function (d) {
      return { id: d, department: d, headcount: headByDept[d], days: Math.round(daysByDept[d] || 0) };
    }).sort(function (a, b) { return (b.days / b.headcount) - (a.days / a.headcount); });

    return h(React.Fragment, null,
      h(Scope, { filters: f, note: 'Balances and liability are as at today; days taken and trends are counted inside the window.' }),

      h(Stats, null,
        h(Stat, { label: 'Leave days taken', value: Math.round(sum(taken, function (l) { return l.days; })),
          sub: taken.length + ' approved requests in the window' }),
        h(Stat, { label: 'Utilisation', value: ui.pct(used, entitled), unit: '%',
          sub: Math.round(used) + ' of ' + Math.round(entitled) + ' entitled days used' }),
        h(Stat, { label: 'Unused paid days', value: Math.round(unusedPaid),
          sub: 'Across ' + live.length + ' employees', tone: 'warn' }),
        h(Stat, { label: 'Balance liability', value: ui.inr(liability, { short: true }),
          sub: 'Carry-forward leave, at basic pay' })),

      h(Grid, null,
        h(Card, { span: 6, title: 'Days taken by leave type' },
          h(ui.Bars, { rows: pairs(daysByType), emptyTitle: 'No leave taken in this window' })),
        h(Card, { span: 6, title: 'Days taken by department' },
          h(ui.Bars, { rows: pairs(daysByDept), emptyTitle: 'No leave taken in this window' })),

        h(Card, { span: 7, title: 'Leave trend by month' },
          f.months.length > 1
            ? h(ui.Bars, { rows: ordered(daysByMonth, f.months).map(function (r) { return [monthLabel(r[0]), r[1], 'info']; }) })
            : h(ui.Empty, { icon: I.calendar, title: 'Window too short for a trend', body: 'Choose a range covering at least two months.' })),

        h(Card, { span: 5, title: 'How the liability is calculated',
          description: 'PRD 8.2 calls unused paid leave a cost, so it is priced here.' },
          h(ui.KeyValue, { rows: [
            ['Encashable types', typeRows.filter(function (r) { return r.paid && r.carry; }).map(function (r) { return r.name; }).join(', ') || 'None'],
            ['Lapsing types', typeRows.filter(function (r) { return r.paid && !r.carry; }).map(function (r) { return r.name; }).join(', ') || 'None'],
            ['Encashable days outstanding', Math.round(sum(typeRows.filter(function (r) { return r.carry; }), function (r) { return r.available; }))],
            ['Basis', 'Basic pay — 40% of CTC, 30-day month'],
            ['Provision', h('strong', null, ui.inr(liability))]
          ]}),
          h('p', { className: 'muted', style: { fontSize: 12, lineHeight: 1.6 } },
            'Casual and sick leave lapse at the year end, so they are shown as utilisation only. ' +
            'Earned leave carries forward and is therefore a cash liability (PRD 4.11).'))),

      h(Card, { title: 'Utilisation per leave type' },
        h(ui.DataTable, Object.assign({
          exportName: 'report-leave-utilisation', label: 'Leave utilisation', rows: typeRows, pageSize: 10,
          columns: [
            { key: 'name', header: 'Leave type', sortable: true,
              cell: function (r) {
                return h('span', { className: 'row gap-2' }, r.name,
                  r.paid ? null : h(V.Chip, { size: 'sm', shape: 'tag' }, 'Unpaid'),
                  r.carry ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info' }, 'Carries forward') : null);
              } },
            { key: 'entitled', header: 'Entitled', numeric: true, align: 'right', sortable: true,
              cell: function (r) { return Math.round(r.entitled); } },
            { key: 'used', header: 'Used', numeric: true, align: 'right', sortable: true,
              cell: function (r) { return Math.round(r.used); } },
            { key: 'available', header: 'Available', numeric: true, align: 'right', sortable: true,
              cell: function (r) { return Math.round(r.available); } },
            { key: 'utilisation', header: 'Utilisation', csv: function (r) { return ui.pct(r.used, r.entitled) + '%'; },
              cell: function (r) { return h(V.ProgressBar, { value: ui.pct(r.used, r.entitled), size: 'sm', showValue: true, 'aria-label': r.name }); } },
            { key: 'liability', header: 'Liability', numeric: true, align: 'right',
              csv: function (r) { return Math.round(r.liability); },
              cell: function (r) { return r.carry ? ui.inr(r.liability) : h('span', { className: 'muted' }, 'Lapses'); } }
          ],
          emptyIcon: I.calendar, emptyTitle: 'No leave policy applies to this selection',
          emptyBody: 'Interns and contractors hold a reduced set of leave types (PRD 4.11).'
        }))),

      h(Card, { title: 'Department comparison', description: 'Days taken against headcount, so a large department is not flattered.' },
        h(ui.DataTable, Object.assign({
          exportName: 'report-leave-departments', label: 'Leave by department', rows: perHead, pageSize: 10, onExport: true,
          columns: [
            { key: 'department', header: 'Department', sortable: true },
            { key: 'headcount', header: 'Headcount', numeric: true, align: 'right', sortable: true },
            { key: 'days', header: 'Days taken', numeric: true, align: 'right', sortable: true },
            { key: 'perHead', header: 'Days per head', numeric: true, align: 'right',
              sortValue: function (r) { return r.days / r.headcount; },
              csv: function (r) { return Math.round((r.days / r.headcount) * 10) / 10; },
              cell: function (r) { return Math.round((r.days / r.headcount) * 10) / 10; } }
          ]
        }, noRows('departments')))),

      h(Card, { title: 'Leave requests', description: 'Every request whose start date falls inside the window.' },
        h(ui.DataTable, Object.assign({
          exportName: 'report-leave', label: 'Leave report', rows: requests, pageSize: 10,
          search: function (l) { var e = emp(l.employee); return (e ? e.name : '') + ' ' + (store.leaveType(l.type) || {}).name + ' ' + l.reason; },
          searchPlaceholder: 'Search by name, type or reason',
          filters: f.controls,
          columns: [
            { key: 'employee', header: 'Employee', sortable: true,
              sortValue: function (l) { var e = emp(l.employee); return e ? e.name : ''; },
              csv: function (l) { var e = emp(l.employee); return e ? e.name : l.employee; },
              cell: function (l) { return h(ui.Person, { employee: emp(l.employee), sub: null }); } },
            { key: 'department', header: 'Department',
              csv: function (l) { var e = emp(l.employee); return e ? deptName(e.department) : ''; },
              cell: function (l) { var e = emp(l.employee); return e ? deptName(e.department) : '—'; } },
            { key: 'type', header: 'Type', sortable: true,
              csv: function (l) { return (store.leaveType(l.type) || {}).name; },
              cell: function (l) { return (store.leaveType(l.type) || {}).name; } },
            { key: 'from', header: 'From', sortable: true, cell: function (l) { return l.fromLabel; } },
            { key: 'to', header: 'To', cell: function (l) { return l.toLabel; } },
            { key: 'days', header: 'Days', numeric: true, align: 'right', sortable: true },
            { key: 'status', header: 'Status', cell: function (l) { return h(ui.StatusChip, { status: l.status }); } }
          ]
        }, noRows('leave requests')))));
  }

  /* ======================================================== Payroll report (8.2)
     Cost per cycle, salary distribution by band, deductions, cost per department and
     the history across cycles. */
  function PayrollReport() {
    var f = useFilters(backIso(180), seed.todayIso);

    /* Invited employees have accepted nothing yet and are not on the payroll (PRD 4.36). */
    var payable = store.collection('employees')
      .filter(function (e) { return e.status !== 'Exited' && e.status !== 'Invited'; }).filter(f.allows);

    /* A cycle belongs to the window when it was paid inside it, or when it is still open
       and falls due after the window opens — the cycle HR is working on right now is the
       one the report is most often opened for, and its pay date is in the future. */
    var cycles = store.collection('payrollCycles').filter(function (c) {
      return f.inRange(c.payDate) || (c.status !== 'Paid' && c.payDate >= f.from);
    });
    var latest = cycles[0] || store.collection('payrollCycles')[0];

    var gross = sum(payable, function (e) { return breakdown(e).gross; });
    var deductions = sum(payable, function (e) { return breakdown(e).totalDeductions; });
    var employerPf = sum(payable, function (e) { return breakdown(e).employerPf; });

    /* The deduction summary reads each component off the same breakdown the payslip
       uses, so a total here always reconciles with a payslip (PRD 4.38). */
    var deductionTotals = {};
    payable.forEach(function (e) {
      breakdown(e).deductions.forEach(function (d) { deductionTotals[d[0]] = (deductionTotals[d[0]] || 0) + d[1]; });
    });

    var byBand = tally(payable, function (e) { return bandOf(e.ctc); });
    /* Costs are shown in lakh so a bar is readable; the table below carries the rupees. */
    var costByDept = totals(payable, function (e) { return deptName(e.department); },
      function (e) { return breakdown(e).gross / 100000; });
    var costByLoc = totals(payable, function (e) { return locName(e.location); },
      function (e) { return breakdown(e).gross / 100000; });

    return h(React.Fragment, null,
      h(Scope, { filters: f, note: 'Cost figures are this month\'s run for everyone in scope; the cycle history covers pay dates inside the window.' }),

      h(Stats, null,
        h(Stat, { label: 'Monthly gross', value: ui.inr(gross, { short: true }), sub: payable.length + ' employees on the payroll' }),
        h(Stat, { label: 'Deductions', value: ui.inr(deductions, { short: true }), sub: ui.pct(deductions, gross) + '% of gross' }),
        h(Stat, { label: 'Net payable', value: ui.inr(gross - deductions, { short: true }), sub: 'Credited to employee accounts' }),
        h(Stat, { label: 'Employer cost', value: ui.inr(gross + employerPf, { short: true }), sub: 'Gross plus ' + ui.inr(employerPf, { short: true }) + ' employer PF' })),

      h(Grid, null,
        h(Card, { span: 6, title: 'Salary distribution by band', description: 'Annual CTC across the bands in PRD 4.35.' },
          h(ui.Bars, { rows: ordered(byBand, BAND_LABELS) })),
        h(Card, { span: 6, title: 'Deduction summary' },
          h(ui.Bars, { rows: pairs(deductionTotals).map(function (r) { return [r[0], Math.round(r[1] / 1000), 'warning']; }),
            emptyTitle: 'No deductions computed' }),
          h('p', { className: 'muted', style: { fontSize: 12 } }, 'Thousands of rupees per month.'),
          h(ui.KeyValue, { rows: Object.keys(deductionTotals).map(function (k) { return [k, ui.inr(deductionTotals[k])]; })
            .concat([['Total', h('strong', null, ui.inr(deductions))]]) }),
          h('p', { className: 'muted', style: { fontSize: 12, lineHeight: 1.6 } },
            'Every figure here is the sum of the components on the payslips themselves (PRD 4.38), ' +
            'so a total always reconciles with the payslip it came from. A cycle\'s own recorded ' +
            'deduction figure is a provision taken at cut-off and can differ from this sum.')),

        h(Card, { span: 6, title: 'Monthly cost by department', description: 'Gross pay, in ₹ lakh.' },
          h(ui.Bars, { rows: pairs(costByDept) })),
        h(Card, { span: 6, title: 'Monthly cost by location', description: 'Gross pay, in ₹ lakh.' },
          h(ui.Bars, { rows: pairs(costByLoc) })),

        latest ? h(Card, { span: 5, title: 'Cost summary — ' + latest.period,
          aside: h(ui.StatusChip, { status: latest.status }) },
          h(ui.KeyValue, { rows: [
            ['Employees', latest.employees],
            ['Gross', ui.inr(latest.gross)],
            ['Deductions', ui.inr(latest.deductions)],
            ['Net payable', h('strong', null, ui.inr(latest.net))],
            ['Employer cost', ui.inr(latest.employerCost)],
            ['Cut-off', ui.dateLabel(latest.cutoff)],
            ['Pay date', ui.dateLabel(latest.payDate)]
          ]}),
          h(V.Button, { variant: 'outline', className: 'vi-btn--sm',
            onClick: function () { router.go('hr/payroll/cycles'); } }, 'Open payroll cycles')) : null,

        h(Card, { span: 7, title: 'History across cycles' },
          h(ui.DataTable, Object.assign({
            exportName: 'report-payroll-cycles', label: 'Payroll history', rows: cycles, pageSize: 10, onExport: true,
            columns: [
              { key: 'period', header: 'Cycle', sortable: true },
              { key: 'employees', header: 'Employees', numeric: true, align: 'right' },
              { key: 'gross', header: 'Gross', numeric: true, align: 'right',
                csv: function (c) { return c.gross; }, cell: function (c) { return ui.inr(c.gross, { short: true }); } },
              { key: 'deductions', header: 'Deductions', numeric: true, align: 'right',
                csv: function (c) { return c.deductions; }, cell: function (c) { return ui.inr(c.deductions, { short: true }); } },
              { key: 'net', header: 'Net', numeric: true, align: 'right',
                csv: function (c) { return c.net; }, cell: function (c) { return ui.inr(c.net, { short: true }); } },
              { key: 'status', header: 'Status', cell: function (c) { return h(ui.StatusChip, { status: c.status }); } }
            ]
          }, noRows('payroll cycles'))))),

      h(Card, { title: 'Cost per employee',
        description: 'Payroll is confidential (PRD 10), so this view follows the payroll permission rather than the people one.' },
        h(ui.DataTable, Object.assign({
          exportName: 'report-payroll', label: 'Payroll report', rows: payable, pageSize: 10,
          search: function (e) { return e.name + ' ' + e.id + ' ' + deptName(e.department); },
          searchPlaceholder: 'Search by name, ID or department',
          filters: f.controls,
          columns: [
            { key: 'name', header: 'Employee', sortable: true, csv: function (e) { return e.name; },
              cell: function (e) { return h(ui.Person, { employee: e, sub: e.id }); } },
            { key: 'department', header: 'Department', sortable: true,
              csv: function (e) { return deptName(e.department); }, cell: function (e) { return deptName(e.department); } },
            { key: 'band', header: 'Band', csv: function (e) { return bandOf(e.ctc); }, cell: function (e) { return bandOf(e.ctc); } },
            { key: 'ctc', header: 'Annual CTC', numeric: true, align: 'right', sortable: true,
              csv: function (e) { return e.ctc; }, cell: function (e) { return ui.inr(e.ctc, { short: true }); } },
            { key: 'gross', header: 'Monthly gross', numeric: true, align: 'right',
              sortValue: function (e) { return breakdown(e).gross; },
              csv: function (e) { return breakdown(e).gross; }, cell: function (e) { return ui.inr(breakdown(e).gross); } },
            { key: 'deductions', header: 'Deductions', numeric: true, align: 'right',
              csv: function (e) { return breakdown(e).totalDeductions; }, cell: function (e) { return ui.inr(breakdown(e).totalDeductions); } },
            { key: 'net', header: 'Net', numeric: true, align: 'right',
              sortValue: function (e) { return breakdown(e).net; },
              csv: function (e) { return breakdown(e).net; },
              cell: function (e) { return h('strong', { style: { fontWeight: 500 } }, ui.inr(breakdown(e).net)); } }
          ]
        }, noRows('payroll rows')))));
  }

  /* ==================================================== Performance report (8.2)
     Appraisal completion, goal achievement and rating distribution. */
  function PerformanceReport() {
    var f = useFilters(backIso(365), seed.todayIso);

    var live = store.collection('employees')
      .filter(function (e) { return e.status !== 'Exited'; }).filter(f.allows);
    var ids = f.idsOf(live);

    /* A cycle belongs to the window when it opened inside it, or when it is still open
       and opens after the window does — a scheduled cycle's dates are in the future, and
       it is the one with live assessments against it. */
    var cycles = store.collection('perfCycles').filter(function (c) {
      return f.inRange(c.from) || (c.status !== 'Completed' && c.from >= f.from);
    });
    /* The report follows the open cycle, falling back to the newest closed one, since
       completion only means anything inside a single cycle (PRD 4.44). */
    var cycle = cycles.filter(function (c) { return c.status !== 'Completed'; })[0] || cycles[0] || null;

    var assessments = store.collection('assessments')
      .filter(function (a) { return ids[a.employee] && (!cycle || a.cycle === cycle.id); });
    var goals = store.collection('goals')
      .filter(function (g) { return ids[g.employee] && (!cycle || g.cycle === cycle.id); });

    var selfDone = assessments.filter(function (a) { return a.self === 'Submitted'; });
    var managerDone = assessments.filter(function (a) { return a.manager === 'Submitted'; });
    var achieved = goals.filter(function (g) { return g.status === 'Achieved'; });

    var byStatus = tally(assessments, function (a) { return a.status; });
    var goalStatus = tally(goals, function (g) { return g.status; });
    /* Ratings only exist once a manager review is submitted with one, so the
       distribution is read off the assessments that actually carry a rating rather
       than invented for the ones that do not. */
    var rated = assessments.filter(function (a) { return a.rating != null; });
    var ratingSpread = tally(rated, function (a) { return String(a.rating); });

    /* Goal progress per department, averaged — a sum would just rank the big teams. */
    var progressByDept = {};
    goals.forEach(function (g) {
      var e = emp(g.employee);
      if (!e) return;
      var k = deptName(e.department);
      var row = progressByDept[k] || (progressByDept[k] = { n: 0, total: 0 });
      row.n += 1;
      row.total += g.progress || 0;
    });
    var deptProgress = Object.keys(progressByDept).map(function (k) {
      return [k, Math.round(progressByDept[k].total / progressByDept[k].n)];
    }).sort(function (a, b) { return b[1] - a[1]; });

    /* Goal achievement weights each goal by its own weighting, which is what the
       appraisal does — a 40% goal at 50% is not the same as a 5% goal at 50%. */
    var weight = sum(goals, function (g) { return g.weight; });
    var weighted = sum(goals, function (g) { return (g.weight || 0) * (g.progress || 0); });
    var achievement = weight ? Math.round((weighted / weight) * 10) / 10 : 0;

    var rows = assessments.map(function (a) {
      var mine = goals.filter(function (g) { return g.employee === a.employee; });
      return Object.assign({}, a, {
        goals: mine.length,
        progress: mine.length ? Math.round(mean(mine, function (g) { return g.progress; })) : 0
      });
    });

    return h(React.Fragment, null,
      h(Scope, { filters: f,
        note: cycle ? 'Figures are for ' + cycle.name + ' (' + cycle.period + ').' : 'No appraisal cycle starts inside this window.' }),

      h(Stats, null,
        h(Stat, { label: 'Appraisal completion', value: ui.pct(managerDone.length, assessments.length), unit: '%',
          sub: managerDone.length + ' of ' + assessments.length + ' manager reviews submitted',
          tone: ui.pct(managerDone.length, assessments.length) > 80 ? 'good' : 'warn' }),
        h(Stat, { label: 'Self-assessments in', value: ui.pct(selfDone.length, assessments.length), unit: '%',
          sub: selfDone.length + ' of ' + assessments.length + ' submitted' }),
        h(Stat, { label: 'Goal achievement', value: achievement, unit: '%',
          sub: 'Weighted across ' + goals.length + ' goals' }),
        h(Stat, { label: 'Goals achieved', value: achieved.length,
          sub: goals.length ? ui.pct(achieved.length, goals.length) + '% of all goals' : 'No goals set', tone: 'good' })),

      h(Grid, null,
        h(Card, { span: 6, title: 'Appraisal progress',
          aside: cycle ? h(ui.StatusChip, { status: cycle.status }) : null },
          h(ui.Bars, { rows: pairs(byStatus), emptyTitle: 'Nobody is in an open cycle' }),
          assessments.length
            ? h('div', { style: { marginTop: 10 } },
                h(V.ProgressBar, { label: 'Manager reviews submitted', value: ui.pct(managerDone.length, assessments.length), showValue: true }))
            : null),

        h(Card, { span: 6, title: 'Goal status' },
          h(ui.Bars, { rows: pairs(goalStatus), emptyTitle: 'No goals set in this cycle' })),

        h(Card, { span: 6, title: 'Average goal progress by department', description: 'Per cent complete, averaged per goal.' },
          h(ui.Bars, { rows: deptProgress, emptyTitle: 'No goals to compare' })),

        h(Card, { span: 6, title: 'Rating distribution',
          description: cycle ? 'Scale ' + cycle.ratingScale : 'Across the chosen cycle.' },
          rated.length
            ? h(React.Fragment, null,
                h(ui.Bars, { rows: ordered(ratingSpread, ['5', '4', '3', '2', '1']).map(function (r) { return [r[0] + ' — ' + ['', 'Needs improvement', 'Developing', 'Meets expectations', 'Exceeds expectations', 'Outstanding'][Number(r[0])], r[1]]; }) }),
                h(ui.KeyValue, { rows: [
                  ['Rated', rated.length + ' of ' + assessments.length],
                  ['Average rating', Math.round(mean(rated, function (a) { return a.rating; }) * 100) / 100]
                ]}))
            : h(ui.Empty, {
                icon: I.target, title: 'No ratings published yet',
                body: 'A rating appears once a manager submits a review with one. Until then the cycle shows completion only, which is the honest figure.',
                actions: h(V.Button, { variant: 'outline', onClick: function () { router.go('hr/performance/reviews'); } }, 'Open reviews')
              }))),

      h(Card, { title: 'Appraisals', description: 'One row per employee in the cycle, with their goal progress.' },
        h(ui.DataTable, Object.assign({
          exportName: 'report-performance', label: 'Performance report', rows: rows, pageSize: 10,
          search: function (a) { var e = emp(a.employee); return (e ? e.name + ' ' + e.id : '') + ' ' + a.status; },
          searchPlaceholder: 'Search by name, ID or status',
          filters: f.controls,
          columns: [
            { key: 'employee', header: 'Employee', sortable: true,
              sortValue: function (a) { var e = emp(a.employee); return e ? e.name : ''; },
              csv: function (a) { var e = emp(a.employee); return e ? e.name : a.employee; },
              cell: function (a) { return h(ui.Person, { employee: emp(a.employee), sub: a.employee }); } },
            { key: 'department', header: 'Department',
              csv: function (a) { var e = emp(a.employee); return e ? deptName(e.department) : ''; },
              cell: function (a) { var e = emp(a.employee); return e ? deptName(e.department) : '—'; } },
            { key: 'reviewer', header: 'Reviewer',
              csv: function (a) { var r = emp(a.reviewer); return r ? r.name : ''; },
              cell: function (a) { var r = emp(a.reviewer); return r ? r.name : h('span', { className: 'muted' }, 'Not assigned'); } },
            { key: 'self', header: 'Self', cell: function (a) { return h(ui.StatusChip, { status: a.self === 'Submitted' ? 'Submitted' : 'Not Started' }); } },
            { key: 'manager', header: 'Manager', cell: function (a) { return h(ui.StatusChip, { status: a.manager === 'Submitted' ? 'Submitted' : 'Not Started' }); } },
            { key: 'goals', header: 'Goals', numeric: true, align: 'right', sortable: true },
            { key: 'progress', header: 'Progress', numeric: true, align: 'right', sortable: true,
              csv: function (a) { return a.progress + '%'; },
              cell: function (a) { return h(V.ProgressBar, { value: a.progress, size: 'sm', showValue: true, 'aria-label': 'Goal progress' }); } },
            { key: 'rating', header: 'Rating', numeric: true, align: 'right',
              csv: function (a) { return a.rating == null ? '' : a.rating; },
              cell: function (a) { return a.rating == null ? h('span', { className: 'muted' }, '—') : a.rating; } }
          ],
          emptyIcon: I.target, emptyTitle: 'No appraisals in this window',
          emptyBody: 'A cycle has to be launched before appraisals exist (PRD 4.44).'
        }))));
  }

  /* ===================================================== Engagement report (8.2)
     Participation, response rate and the engagement trend — reported without ever
     breaking the anonymity a survey promised.

     Two rules, both enforced below rather than left to the reader:
     1. A response to a survey marked anonymous is never attributed to a person, in the
        table, in the CSV export or anywhere else.
     2. No group of fewer than five responses is reported. A group of one or two
        re-identifies its respondent however the figure is labelled, so the group is
        counted and then withheld. */
  var MIN_GROUP = 5;
  /* The rating-scale questions. q3 is the NPS question and sits on its own 0–10 scale,
     so it is scored separately rather than averaged in. */
  var RATING_KEYS = ['q1', 'q2', 'q4', 'q5'];
  function avgRating(r) {
    var n = 0, t = 0;
    RATING_KEYS.forEach(function (k) {
      if (r.scores && r.scores[k] != null) { t += r.scores[k]; n += 1; }
    });
    return n ? t / n : 0;
  }

  function EngagementReport() {
    var f = useFilters(backIso(365), seed.todayIso);

    var surveys = store.collection('surveys').filter(function (s) { return f.inRange(s.from); });
    var surveyById = {};
    surveys.forEach(function (s) { surveyById[s.id] = s; });

    var live = store.collection('employees').filter(function (e) { return e.status !== 'Exited'; });
    var allowed = {};
    live.filter(f.allows).forEach(function (e) { allowed[e.id] = true; });

    /* An anonymous response carries a department and nothing else. The department
       filter can therefore be honoured; location and employee type cannot, because
       narrowing an anonymous set by them would identify the people left in it. */
    var responses = store.collection('surveyResponses').filter(function (r) {
      if (!surveyById[r.survey]) return false;
      if (f.dept && r.department !== f.dept) return false;
      if (!r.employee) return true;
      return !!allowed[r.employee];
    });

    var invited = sum(surveys, function (s) { return s.invited; });
    var responded = responses.length;

    /* Group sizes, used to decide what may be reported at all. */
    var perSurvey = tally(responses, function (r) { return r.survey; });
    var perGroup = tally(responses, function (r) { return r.survey + '|' + (r.department || ''); });
    function withheld(r) {
      var sv = surveyById[r.survey];
      return !!(sv && sv.anonymous) && (perGroup[r.survey + '|' + (r.department || '')] || 0) < MIN_GROUP;
    }

    /* Department scores. The pooled set contains anonymous responses, so the threshold
       is applied to every department rather than only the anonymous ones. */
    var deptAgg = {};
    responses.forEach(function (r) {
      var k = r.department || 'unknown';
      var row = deptAgg[k] || (deptAgg[k] = { n: 0, total: 0 });
      row.n += 1;
      row.total += avgRating(r);
    });
    var deptRows = Object.keys(deptAgg).map(function (k) {
      return {
        id: k, department: k === 'unknown' ? 'Not recorded' : deptName(k),
        responses: deptAgg[k].n, score: deptAgg[k].n ? deptAgg[k].total / deptAgg[k].n : 0,
        reportable: deptAgg[k].n >= MIN_GROUP
      };
    }).sort(function (a, b) { return b.responses - a.responses; });
    var suppressedDepts = deptRows.filter(function (d) { return !d.reportable; });

    /* Employee NPS from the recommendation question: promoters less detractors. */
    var nps = responses.filter(function (r) { return r.scores && r.scores.q3 != null; });
    var promoters = nps.filter(function (r) { return r.scores.q3 >= 9; }).length;
    var detractors = nps.filter(function (r) { return r.scores.q3 <= 6; }).length;
    var enps = nps.length >= MIN_GROUP ? Math.round(((promoters - detractors) / nps.length) * 100) : null;

    /* The trend: each survey in the window, oldest first, with its mean rating. A
       survey below the threshold is plotted as participation only. */
    var trend = surveys.slice().sort(function (a, b) { return a.from < b.from ? -1 : 1; }).map(function (s) {
      var mine = responses.filter(function (r) { return r.survey === s.id; });
      return {
        survey: s, count: mine.length,
        score: mine.length >= MIN_GROUP ? mean(mine, avgRating) : null
      };
    });

    var rows = responses.map(function (r) {
      var sv = surveyById[r.survey];
      return Object.assign({}, r, { anonymous: !!(sv && sv.anonymous), hidden: withheld(r), surveyName: sv ? sv.name : r.survey });
    });

    return h(React.Fragment, null,
      h(Scope, { filters: f, note: 'Surveys whose fieldwork opens inside the window. Groups under ' + MIN_GROUP + ' responses are withheld.' }),

      h(Stats, null,
        h(Stat, { label: 'Surveys', value: surveys.length,
          sub: surveys.filter(function (s) { return s.status === 'Live'; }).length + ' live, ' + surveys.filter(function (s) { return s.status === 'Closed'; }).length + ' closed' }),
        h(Stat, { label: 'Invitations', value: invited, sub: 'Across every survey in the window' }),
        h(Stat, { label: 'Responses', value: responded, sub: 'Anonymous responses included, unattributed' }),
        h(Stat, { label: 'Response rate', value: ui.pct(responded, invited), unit: '%',
          sub: enps == null ? 'Too few responses for an eNPS' : 'Employee NPS ' + (enps > 0 ? '+' : '') + enps,
          tone: ui.pct(responded, invited) >= 60 ? 'good' : 'warn' })),

      h(Grid, null,
        h(Card, { span: 6, title: 'Participation by survey' },
          surveys.length
            ? h('div', { className: 'list' }, surveys.map(function (s) {
                return h('div', { className: 'list__row', key: s.id },
                  h('div', { className: 'list__main' },
                    h('span', { className: 'list__title row gap-2' },
                      h('span', null, s.name),
                      s.anonymous ? h(V.Chip, { size: 'sm', shape: 'tag', icon: I.lock }, 'Anonymous') : null),
                    h('span', { className: 'list__meta' },
                      (perSurvey[s.id] || 0) + ' of ' + s.invited + ' invited · ' + s.type + ' · ' +
                      ui.dateLabel(s.from) + ' – ' + ui.dateLabel(s.to))),
                  h('span', { style: { width: 110 } },
                    h(V.ProgressBar, { value: ui.pct(perSurvey[s.id] || 0, s.invited), size: 'sm', showValue: true, 'aria-label': s.name })),
                  h(ui.StatusChip, { status: s.status }));
              }))
            : h(ui.Empty, { icon: I.comment, title: 'No surveys in this window', body: 'Widen the date range, or create a survey.' })),

        h(Card, { span: 6, title: 'Engagement trend', description: 'Mean rating across the scale questions, oldest survey first.' },
          trend.length
            ? h('div', { className: 'list' }, trend.map(function (t) {
                return h('div', { className: 'list__row', key: t.survey.id },
                  h('div', { className: 'list__main' },
                    h('span', { className: 'list__title' }, t.survey.name),
                    h('span', { className: 'list__meta' }, ui.dateLabel(t.survey.from) + ' · ' + t.count + ' responses')),
                  t.score == null
                    ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'neutral', dot: true },
                        t.count ? 'Withheld' : 'No responses yet')
                    : h('span', { className: 'row gap-2' },
                        h('span', { style: { width: 90 } },
                          h(V.ProgressBar, { value: (t.score / 5) * 100, size: 'sm', tone: t.score >= 4 ? 'success' : t.score >= 3 ? 'info' : 'warning', 'aria-label': t.survey.name })),
                        h('strong', { style: { fontWeight: 500 } }, Math.round(t.score * 100) / 100, h('small', { className: 'muted' }, ' / 5'))));
              }))
            : h(ui.Empty, { icon: I.activity, title: 'Nothing to trend yet' })),

        h(Card, { span: 12, title: 'Scores by department',
          description: 'A department with fewer than ' + MIN_GROUP + ' responses is counted but not scored, so an anonymous answer stays anonymous.' },
          h(ui.DataTable, {
            exportName: 'report-engagement-departments', label: 'Engagement by department',
            rows: deptRows, pageSize: 10, onExport: true,
            columns: [
              { key: 'department', header: 'Department', sortable: true },
              { key: 'responses', header: 'Responses', numeric: true, align: 'right', sortable: true },
              { key: 'score', header: 'Mean score', numeric: true, align: 'right',
                csv: function (d) { return d.reportable ? Math.round(d.score * 100) / 100 : 'Withheld'; },
                cell: function (d) {
                  return d.reportable
                    ? h('span', null, Math.round(d.score * 100) / 100, h('small', { className: 'muted' }, ' / 5'))
                    : h('span', { className: 'muted' }, 'Withheld');
                } },
              { key: 'bar', header: '', csv: function () { return ''; },
                cell: function (d) {
                  return d.reportable
                    ? h(V.ProgressBar, { value: (d.score / 5) * 100, size: 'sm', 'aria-label': d.department })
                    : h(V.Chip, { size: 'sm', shape: 'tag', icon: I.lock }, 'Under ' + MIN_GROUP);
                } }
            ],
            emptyIcon: I.comment, emptyTitle: 'No responses in this window',
            emptyBody: 'Widen the date range, or clear the department filter.'
          }),
          suppressedDepts.length
            ? h('p', { className: 'muted', style: { fontSize: 12, lineHeight: 1.6 } },
                suppressedDepts.length + ' department' + (suppressedDepts.length > 1 ? 's' : '') + ' returned fewer than ' +
                MIN_GROUP + ' responses and are not scored. The responses still count towards the totals above.')
            : null)),

      h(Card, { title: 'Responses', description: 'Anonymous responses carry no identity here or in the export.' },
        h(ui.DataTable, Object.assign({
          exportName: 'report-engagement', label: 'Engagement report', rows: rows, pageSize: 10,
          search: function (r) { return r.surveyName + ' ' + (r.hidden || r.anonymous ? '' : (emp(r.employee) || {}).name || ''); },
          searchPlaceholder: 'Search by survey or respondent',
          filters: f.controls,
          columns: [
            { key: 'surveyName', header: 'Survey', sortable: true },
            { key: 'respondent', header: 'Respondent',
              csv: function (r) { return r.anonymous || !r.employee ? 'Anonymous' : (emp(r.employee) || {}).name || ''; },
              cell: function (r) {
                if (r.anonymous || !r.employee) {
                  return h(V.Chip, { size: 'sm', shape: 'tag', icon: I.lock }, 'Anonymous');
                }
                return h(ui.Person, { employee: emp(r.employee), sub: null });
              } },
            { key: 'group', header: 'Department',
              csv: function (r) { return r.hidden ? 'Withheld' : deptName(r.department); },
              cell: function (r) { return r.hidden ? h('span', { className: 'muted' }, 'Withheld') : deptName(r.department); } },
            { key: 'submittedOn', header: 'Submitted', sortable: true, cell: function (r) { return ui.dateLabel(r.submittedOn); } },
            { key: 'score', header: 'Mean score', numeric: true, align: 'right',
              sortValue: function (r) { return avgRating(r); },
              csv: function (r) { return Math.round(avgRating(r) * 100) / 100; },
              cell: function (r) { return Math.round(avgRating(r) * 100) / 100; } },
            { key: 'nps', header: 'Recommend', numeric: true, align: 'right',
              csv: function (r) { return r.scores && r.scores.q3 != null ? r.scores.q3 : ''; },
              cell: function (r) { return r.scores && r.scores.q3 != null ? r.scores.q3 + ' / 10' : h('span', { className: 'muted' }, '—'); } }
          ],
          emptyIcon: I.comment, emptyTitle: 'No responses in this window',
          emptyBody: 'Widen the date range, or clear the department filter.'
        }))));
  }

  /* ==================================================== Offboarding report (8.2)
     Exit summary, attrition reasons, pending clearance, settlement status and the
     average tenure at exit. */
  function OffboardingReport() {
    var f = useFilters(backIso(365), seed.todayIso);

    var cases = store.collection('offboarding').filter(function (o) { return f.allows(emp(o.employee)); });
    /* An exit is dated by its last working day. Cases still in notice have a future
       last working day, so they are counted separately rather than dropped. */
    var completed = cases.filter(function (o) { return o.status === 'Completed' && f.inRange(o.lastWorkingDay); });
    var inNotice = cases.filter(function (o) { return o.stage === 'Notice Period'; });
    var pendingClearance = cases.filter(function (o) { return o.tasksDone < o.tasksTotal; });
    var inWindow = completed.concat(inNotice.filter(function (o) { return completed.indexOf(o) < 0; }));

    /* Average tenure at exit (PRD 8.2): joining date to last working day, for exits
       that have actually completed. Including people still serving notice would shorten
       the figure by however much notice they have left to serve. */
    var tenures = completed.map(function (o) {
      var e = emp(o.employee);
      return e ? dayGap(e.joined, o.lastWorkingDay) : 0;
    }).filter(function (d) { return d > 0; });
    var avgTenure = tenures.length ? years(sum(tenures, function (d) { return d; }) / tenures.length) : 0;

    var byReason = tally(inWindow, function (o) { return o.reason; });
    var byDept = tally(inWindow, function (o) { var e = emp(o.employee); return e ? deptName(e.department) : null; });
    var byLoc = tally(inWindow, function (o) { var e = emp(o.employee); return e ? locName(e.location) : null; });
    var bySettlement = tally(inWindow, function (o) { return o.settlement; });
    var exitTrend = tally(completed, function (o) { return monthKey(o.lastWorkingDay); });
    var assetsOut = sum(inNotice, function (o) { return o.assetsOutstanding; });

    return h(React.Fragment, null,
      h(Scope, { filters: f, note: 'Completed exits are counted by last working day; cases still in notice are always shown, whatever the window.' }),

      h(Stats, null,
        h(Stat, { label: 'Completed exits', value: completed.length, sub: 'Last working day inside the window' }),
        h(Stat, { label: 'Serving notice', value: inNotice.length,
          sub: assetsOut ? assetsOut + ' assets still to come back' : 'No assets outstanding',
          tone: inNotice.length ? 'warn' : null }),
        h(Stat, { label: 'Pending clearance', value: pendingClearance.length,
          sub: pendingClearance.length ? 'Average ' + Math.round(mean(pendingClearance, function (o) { return o.clearance; })) + '% complete' : 'Everything cleared' }),
        h(Stat, { label: 'Average tenure at exit', value: avgTenure, unit: 'yrs',
          sub: tenures.length ? 'Across ' + tenures.length + ' completed exits' : 'No completed exits to average' })),

      h(Grid, null,
        h(Card, { span: 6, title: 'Attrition reasons' },
          h(ui.Bars, { rows: pairs(byReason), emptyTitle: 'No exits in this window' })),
        h(Card, { span: 6, title: 'Exits by department' },
          h(ui.Bars, { rows: pairs(byDept), emptyTitle: 'No exits in this window' })),
        h(Card, { span: 4, title: 'Exits by location' },
          h(ui.Bars, { rows: pairs(byLoc), emptyTitle: 'No exits in this window' })),
        h(Card, { span: 4, title: 'Settlement status' },
          h(ui.Bars, { rows: pairs(bySettlement), emptyTitle: 'Nothing to settle' }),
          h(ui.KeyValue, { rows: [
            ['Settled', bySettlement.Paid || 0],
            ['Awaiting settlement', bySettlement.Pending || 0],
            ['Final settlement window', 'Within 45 days of the last working day']
          ]})),
        h(Card, { span: 4, title: 'Exits by month' },
          f.months.length > 1
            ? h(ui.Bars, { rows: ordered(exitTrend, f.months).map(function (r) { return [monthLabel(r[0]), r[1], 'error']; }) })
            : h(ui.Empty, { icon: I.calendar, title: 'Window too short for a trend', body: 'Choose a range covering at least two months.' })),

        h(Card, { span: 12, title: 'Pending clearance',
          aside: h(V.Button, { variant: 'outline', className: 'vi-btn--sm', onClick: function () { router.go('hr/offboarding/clearance'); } }, 'Open clearance') },
          pendingClearance.length
            ? h('div', { className: 'list' }, pendingClearance.map(function (o) {
                var person = emp(o.employee);
                return h('div', { className: 'list__row', key: o.id },
                  h(ui.Person, { employee: person, sub: person ? deptName(person.department) : null }),
                  h('div', { className: 'list__main' },
                    h('span', { className: 'list__meta' },
                      'Last working day ' + o.lastWorkingDayLabel + ' · ' + o.tasksDone + ' of ' + o.tasksTotal + ' tasks done' +
                      (o.assetsOutstanding ? ' · ' + o.assetsOutstanding + ' assets out' : ''))),
                  h('span', { style: { width: 110 } },
                    h(V.ProgressBar, { value: o.clearance, size: 'sm', showValue: true, 'aria-label': 'Clearance' })),
                  h(ui.StatusChip, { status: o.settlement === 'Paid' ? 'Paid' : 'Pending' }));
              }))
            : h(ui.Empty, { icon: I.ok, title: 'Every exit is cleared', body: 'No assets, access or settlements are outstanding.' }))),

      h(Card, { title: 'Exit records' },
        h(ui.DataTable, Object.assign({
          exportName: 'report-offboarding', label: 'Offboarding report', rows: inWindow, pageSize: 10,
          search: function (o) { var e = emp(o.employee); return (e ? e.name + ' ' + e.id : '') + ' ' + o.reason; },
          searchPlaceholder: 'Search by name, ID or reason',
          filters: f.controls,
          columns: [
            { key: 'employee', header: 'Employee', sortable: true,
              sortValue: function (o) { var e = emp(o.employee); return e ? e.name : ''; },
              csv: function (o) { var e = emp(o.employee); return e ? e.name : o.employee; },
              cell: function (o) { return h(ui.Person, { employee: emp(o.employee), sub: o.employee }); } },
            { key: 'department', header: 'Department',
              csv: function (o) { var e = emp(o.employee); return e ? deptName(e.department) : ''; },
              cell: function (o) { var e = emp(o.employee); return e ? deptName(e.department) : '—'; } },
            { key: 'resignedOn', header: 'Resigned', sortable: true, cell: function (o) { return o.resignedOnLabel; } },
            { key: 'lastWorkingDay', header: 'Last working day', sortable: true, cell: function (o) { return o.lastWorkingDayLabel; } },
            { key: 'tenure', header: 'Tenure', numeric: true, align: 'right',
              sortValue: function (o) { var e = emp(o.employee); return e ? dayGap(e.joined, o.lastWorkingDay) : 0; },
              csv: function (o) { var e = emp(o.employee); return e ? years(dayGap(e.joined, o.lastWorkingDay)) : ''; },
              cell: function (o) { var e = emp(o.employee); return e ? years(dayGap(e.joined, o.lastWorkingDay)) + ' yrs' : '—'; } },
            { key: 'reason', header: 'Reason', sortable: true },
            { key: 'clearance', header: 'Clearance', numeric: true, align: 'right', sortable: true,
              csv: function (o) { return o.clearance + '%'; },
              cell: function (o) { return h(V.ProgressBar, { value: o.clearance, size: 'sm', showValue: true, 'aria-label': 'Clearance' }); } },
            { key: 'settlement', header: 'Settlement', cell: function (o) { return h(ui.StatusChip, { status: o.settlement === 'Paid' ? 'Paid' : 'Pending' }); } },
            { key: 'status', header: 'Status', cell: function (o) { return h(ui.StatusChip, { status: o.status }); } }
          ]
        }, noRows('exits')))));
  }

  /* ============================================================ HR tasks (2.2)
     Everything assigned to the HR persona, gathered from each module rather than kept
     in a list of its own — so an item disappears from here the moment the module that
     owns it resolves the record, and nothing can go stale.

     Urgency comes from the data, not from an invented service level: a task is overdue
     when it carries a due date already past, due soon when that date is inside a week,
     and otherwise it is simply waiting. Approvals and verification queues carry no due
     date at all, so they are ranked by how long they have been waiting. */
  var SOON_DAYS = 7;

  /* ---------------------------------------------------------------- Register */
  HRMS.screens.register({
    'hr/reports/employee': EmployeeReport,
    'hr/reports/attendance': AttendanceReport,
    'hr/reports/leave': LeaveReport,
    'hr/reports/payroll': PayrollReport,
    'hr/reports/performance': PerformanceReport,
    'hr/reports/engagement': EngagementReport,
    'hr/reports/offboarding': OffboardingReport
  });
})();

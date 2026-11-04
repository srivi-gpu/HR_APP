/* Phase 3 (PRD 18): attendance, leave, shifts and the holiday calendar.

   Every write goes through HRMS.actions, wrapped in ui.report so success and failure
   both toast. Nothing here touches the store directly, so the rules in PRD 14 cannot
   be bypassed by approving from one screen rather than another. */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var store = HRMS.store, router = HRMS.router, ui = HRMS.ui, seed = HRMS.seed;
  var act = HRMS.actions, rules = HRMS.rules;
  var Card = ui.Card, Grid = ui.Grid, Stat = ui.Stat, Stats = ui.Stats;
  var charts = HRMS.charts;

  function emp(id) { return store.employee(id); }
  function empName(id) { var e = emp(id); return e ? e.name : '—'; }
  function deptName(id) { var d = store.department(id); return d ? d.name : '—'; }
  function locName(id) { var l = store.location(id); return l ? l.name : '—'; }
  function typeName(id) { var t = store.leaveType(id); return t ? t.name : id; }
  function shiftOf(id) { return store.shift(id); }
  function shiftName(id) { var s = shiftOf(id); return s ? s.name : '—'; }

  function deptOptions() { return store.collection('departments').map(function (d) { return { value: d.id, label: d.name }; }); }
  function locOptions() { return store.collection('locations').map(function (l) { return { value: l.id, label: l.name }; }); }
  function shiftOptions() {
    return store.collection('shifts').map(function (s) { return { value: s.id, label: s.name + ' (' + s.start + '–' + s.end + ')' }; });
  }
  function leaveTypeOptions() { return store.collection('leaveTypes').map(function (t) { return { value: t.id, label: t.name }; }); }

  var iso = seed.util.iso, addDays = seed.util.addDays, pretty = seed.util.pretty;
  var WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var ATT_STATUSES = ['Present', 'Late', 'Absent', 'Work From Home', 'On Leave', 'Missing Punch', 'Not Started'];

  /* Employees who are actually rostered: an invited or exited record has no attendance. */
  function workforce() {
    return store.collection('employees').filter(function (e) {
      return e.status !== 'Exited' && e.status !== 'Invited';
    });
  }
  function holidayMap() {
    var map = {};
    store.collection('holidays').forEach(function (hd) { map[hd.date] = hd; });
    return map;
  }
  /* Monday of the week a date falls in — the org work week starts on Monday (PRD 3.2). */
  function mondayOf(d) { return addDays(d, -((d.getDay() + 6) % 7)); }

  /* ====================================================== Attendance dashboard
     PRD 4.15: present, absent, late, WFH, on leave, missing punches and pending
     regularizations, every figure read from store.stats() rather than written here. */
  /* A thirty-day check-in rate for the organization. The prototype seeds only today's
     attendance, so the days behind are derived — and derived from a hash of the date, not
     a random number, so the trend is the same on every render and every reload. Weekends
     and holidays are skipped: a check-in rate on a day nobody was expected in says
     nothing. */
  function checkInTrend(days, todayRate) {
    var holidays = {};
    store.collection('holidays').forEach(function (x) { holidays[x.date] = true; });
    var roster = workforce().length || 1;
    var out = [];
    for (var d = days - 1; d >= 0; d--) {
      var day = seed.util.addDays(seed.today, -d);
      var key = seed.util.iso(day);
      if (day.getDay() === 0 || day.getDay() === 6 || holidays[key]) continue;
      var n = 0;
      for (var i = 0; i < key.length; i++) n = (n * 31 + key.charCodeAt(i)) >>> 0;
      /* Today is the real figure — the same one the gauge shows, so the last bar and the
         headline cannot disagree. The days behind sit in a believable band around it. */
      var rate = d === 0 ? todayRate : 88 + (n % 11);
      out.push({ label: ui.shortDate(key), value: Math.min(rate, 100), iso: key });
    }
    return out;
  }

  function AttendanceDashboard() {
    var s = store.stats();
    var att = store.collection('attendanceToday');
    var marked = att.filter(function (a) { return a.status !== 'Not Started'; });

    function countBy(keyFn, pickFn) {
      var out = {};
      att.forEach(function (a) { if (pickFn(a)) { var k = keyFn(a); out[k] = (out[k] || 0) + 1; } });
      return out;
    }
    var byStatus = {};
    att.forEach(function (a) { byStatus[a.status] = (byStatus[a.status] || 0) + 1; });
    var byDept = countBy(function (a) { return deptName((emp(a.employee) || {}).department); },
      function (a) { return a.status === 'Present' || a.status === 'Late' || a.status === 'Work From Home'; });
    var byLoc = countBy(function (a) { return locName((emp(a.employee) || {}).location); },
      function (a) { return a.status === 'Present' || a.status === 'Late' || a.status === 'Work From Home'; });
    var bySource = countBy(function (a) { return a.source; }, function (a) { return !!a.source; });

    var missing = att.filter(function (a) { return a.status === 'Missing Punch'; });
    var lateToday = att.filter(function (a) { return a.status === 'Late'; })
      .sort(function (a, b) { return b.lateBy - a.lateBy; });

    function rowsOf(obj, tone) {
      return Object.keys(obj).map(function (k) { return [k, obj[k], tone]; })
        .sort(function (a, b) { return b[1] - a[1]; });
    }

    var rate = Math.round(ui.pct(marked.length, workforce().length));
    var trend = checkInTrend(30, rate);
    var prev = trend.length > 1 ? Math.round(trend.slice(0, -1).reduce(function (n, x) { return n + x.value; }, 0) / (trend.length - 1)) : rate;
    var deptRows = Object.keys(byDept).map(function (k) {
      return { label: k, value: byDept[k], rate: 0 };
    }).sort(function (a, b) { return b.value - a.value; });
    /* The share each department has in today's attendance, against its own headcount. */
    var headcount = {};
    workforce().forEach(function (e) {
      var d = deptName(e.department); headcount[d] = (headcount[d] || 0) + 1;
    });
    deptRows.forEach(function (r) { r.rate = Math.round(ui.pct(r.value, headcount[r.label] || r.value)); });

    return h(React.Fragment, null,
      h('section', { className: 'dash__card hero' },
        h('div', { className: 'hero__l' },
          h('span', { className: 'hero__date' }, I.calendar, seed.todayLabel),
          h('h1', null, 'Attendance today'),
          h('p', { className: 'hero__p' },
            marked.length + ' of ' + workforce().length + ' employees have a record for today.'),
          h('div', { className: 'hero__acts' },
            h(V.Button, { variant: 'primary', iconEnd: I.arrow, onClick: function () { router.go('hr/attendance/daily'); } }, 'Daily register'),
            h(V.Button, { variant: 'outline', iconStart: I.checklist, onClick: function () { router.go('hr/attendance/regularization'); } }, 'Regularizations'))),
        h('span', { className: 'hero__sep' }),
        h(charts.Gauge, { value: rate, label: 'Check-in rate' }),
        h('span', { className: 'hero__sep' }),
        h('div', { className: 'hero__r' },
          h('span', { className: 'hero__fig' },
            h('strong', null, workforce().length), h('span', null, 'Total employees')),
          h('span', { className: 'hero__fig' },
            h('strong', null, marked.length,
              rate - prev > 0 ? h('em', null, I.up || null, '+' + (rate - prev) + '%') : null),
            h('span', null, 'Checked in')))),

      h(charts.Tiles, { items: [
        { label: 'Present', value: s.present - s.wfh, tone: 'good', icon: I.users,
          onClick: function () { router.go('hr/attendance/daily'); } },
        { label: 'Work from home', value: s.wfh, tone: 'info', icon: I.home },
        { label: 'On leave', value: s.onLeaveToday, tone: 'brand', icon: I.calendar,
          onClick: function () { router.go('hr/leave/requests'); } },
        { label: 'Late arrivals', value: s.late, tone: 'warn', icon: I.clock },
        { label: 'Absent', value: s.absent, tone: 'bad', icon: I.person }
      ]}),

      h(Grid, null,
        h(Card, { span: 7, title: 'Check-in rate trend',
          description: 'Working days only — a rate on a day nobody was due in says nothing.',
          aside: h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft',
            tone: rate >= prev ? 'success' : 'warning' },
            (rate >= prev ? '+' : '') + (rate - prev) + '% vs the 30-day average') },
          h(charts.TrendBars, { rows: trend, unit: '%' })),
        h(Card, { span: 5, title: 'By department',
          description: 'Working today against each department\u2019s own headcount.',
          aside: h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', iconEnd: I.right,
            onClick: function () { router.go('hr/reports/attendance'); } }, 'View all') },
          h(charts.RankBars, { rows: deptRows.slice(0, 6) }))),

      h(Grid, null,
        h(Card, { span: 6, title: 'Status distribution',
          description: 'Every rostered employee, including the states the tiles above do not carry — missing punches and those not yet started.' },
          h(ui.Bars, {
            rows: ATT_STATUSES.filter(function (st) { return byStatus[st]; }).map(function (st) {
              return [st, byStatus[st],
                st === 'Present' || st === 'Work From Home' ? 'success'
                  : st === 'Absent' ? 'error' : st === 'Late' || st === 'Missing Punch' ? 'warning' : 'info'];
            })
          })),
        h(Card, { span: 6, title: 'Working today by location' },
          h(ui.Bars, { rows: rowsOf(byLoc, 'info') })),
        h(Card, { span: 4, title: 'Punch source', description: 'Where today’s punches came from (PRD 4.17).' },
          h(ui.Bars, { rows: rowsOf(bySource, 'info') })),

        h(Card, {
          span: 3, title: 'Missing punches',
          aside: h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: missing.length ? 'warning' : 'success', dot: true }, String(missing.length))
        },
          missing.length
            ? h('div', { className: 'list scroll-320' }, missing.map(function (a) {
                return h('div', { className: 'list__row', key: a.id },
                  h('div', { className: 'list__main' },
                    h('span', { className: 'list__title' }, empName(a.employee)),
                    h('span', { className: 'list__meta' }, 'In ' + (a.checkIn || '—') + ' · out missing')));
              }))
            : h(ui.Empty, { icon: I.ok, title: 'Every punch is complete' })),

        h(Card, { span: 12, title: 'Late arrivals today', description: 'PRD 4.16: late is measured against the shift start plus its grace period.' },
          lateToday.length
            ? h('div', { className: 'list' }, lateToday.slice(0, 8).map(function (a) {
                var e = emp(a.employee);
                return h('div', { className: 'list__row', key: a.id },
                  h(ui.Person, { employee: e, sub: deptName(e.department) }),
                  h('span', { style: { flex: 1 } }),
                  h(V.Chip, { size: 'sm', shape: 'tag' }, shiftName(a.shift)),
                  h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning', dot: true }, a.lateBy + ' min late'),
                  h('span', { className: 'mono', style: { fontSize: 12 } }, a.checkIn));
              }))
            : h(ui.Empty, { icon: I.ok, title: 'Nobody arrived late today' }))));
  }

  /* =========================================================== Daily register
     PRD 4.19: one row per employee for the chosen date, with punches and hours. */
  function AttendanceDaily() {
    var deptSt = React.useState(''), locSt = React.useState(''), statusSt = React.useState('');
    var openSt = React.useState(null);

    var rows = store.collection('attendanceToday').filter(function (a) { return !!emp(a.employee); });
    if (deptSt[0]) rows = rows.filter(function (a) { return emp(a.employee).department === deptSt[0]; });
    if (locSt[0]) rows = rows.filter(function (a) { return emp(a.employee).location === locSt[0]; });
    if (statusSt[0]) rows = rows.filter(function (a) { return a.status === statusSt[0]; });

    var columns = [
      { key: 'employee', header: 'Employee', sortable: true,
        sortValue: function (a) { return empName(a.employee); },
        csv: function (a) { return empName(a.employee); },
        cell: function (a) {
          var e = emp(a.employee);
          return h(ui.Person, { employee: e, sub: e.id + ' · ' + deptName(e.department), onClick: function () { openSt[1](e.id); } });
        } },
      { key: 'shift', header: 'Shift', sortable: true, csv: function (a) { return shiftName(a.shift); },
        cell: function (a) {
          var s = shiftOf(a.shift);
          return s ? h(V.Chip, { size: 'sm', shape: 'tag' }, s.code + ' · ' + s.start + '–' + s.end) : h('span', { className: 'muted' }, '—');
        } },
      { key: 'checkIn', header: 'Check in', csv: function (a) { return a.checkIn || ''; },
        cell: function (a) { return a.checkIn ? h('span', { className: 'mono' }, a.checkIn) : h('span', { className: 'muted' }, '—'); } },
      { key: 'checkOut', header: 'Check out', csv: function (a) { return a.checkOut || ''; },
        cell: function (a) { return a.checkOut ? h('span', { className: 'mono' }, a.checkOut) : h('span', { className: 'muted' }, '—'); } },
      { key: 'hours', header: 'Hours', numeric: true, align: 'right', sortable: true,
        csv: function (a) { return a.hours || 0; },
        cell: function (a) { return a.hours ? a.hours + ' h' : h('span', { className: 'muted' }, '—'); } },
      { key: 'lateBy', header: 'Late by', numeric: true, align: 'right', sortable: true,
        csv: function (a) { return a.lateBy || 0; },
        cell: function (a) {
          return a.lateBy
            ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning' }, a.lateBy + ' min')
            : h('span', { className: 'muted' }, '—');
        } },
      { key: 'source', header: 'Source', csv: function (a) { return a.source || ''; },
        cell: function (a) { return a.source || h('span', { className: 'muted' }, '—'); } },
      { key: 'status', header: 'Status', cell: function (a) { return h(ui.StatusChip, { status: a.status }); } }
    ];

    return h(React.Fragment, null,
      h(Card, {
        title: 'Daily attendance', description: 'Punches, hours and exceptions for a single day (PRD 4.19).',
        aside: h('div', { className: 'row gap-2' },
          h(V.Chip, { size: 'sm', shape: 'tag', icon: I.calendar }, seed.todayLabel),
          h(V.Button, {
            variant: 'outline', className: 'vi-btn--sm', iconStart: I.grid,
            onClick: function () { router.go('hr/attendance/monthly'); }
          }, 'Monthly view'))
      },
        h(ui.DataTable, {
          exportName: 'attendance-' + seed.todayIso, label: 'Daily attendance', rows: rows, pageSize: 10,
          search: function (a) { var e = emp(a.employee); return e.name + ' ' + e.id + ' ' + a.status + ' ' + shiftName(a.shift); },
          searchPlaceholder: 'Search by name, ID or status',
          filters: h(React.Fragment, null,
            h(ui.Filter, { label: 'Department', value: deptSt[0], onChange: deptSt[1], options: deptOptions() }),
            h(ui.Filter, { label: 'Location', value: locSt[0], onChange: locSt[1], options: locOptions() }),
            h(ui.Filter, { label: 'Status', value: statusSt[0], onChange: statusSt[1], options: ATT_STATUSES })),
          columns: columns,
          emptyIcon: I.clock, emptyTitle: 'No attendance rows match these filters',
          emptyBody: 'Clear a filter, or pick a different department, location or status.'
        }),
        h('p', { className: 'muted', style: { fontSize: 12 } },
          'The prototype carries one live attendance day. The monthly view derives the rest of the month '
          + 'from approved leave, the holiday calendar and the work week.')),
      openSt[0] && HRMS.screens.ProfileDrawer
        ? h(HRMS.screens.ProfileDrawer, { id: openSt[0], onClose: function () { openSt[1](null); } })
        : null);
  }

  /* ============================================================ Monthly grid
     PRD 4.19: a month grid per employee with a day-status legend. Only today is
     seeded, so each other day is derived — holidays and weekly offs first, then
     approved leave, then a value keyed off the employee id and the date, so the
     same grid is drawn on every render. */
  var CELL_CLASS = {
    Present: 'is-present', Late: 'is-present', 'Work From Home': 'is-present',
    'On Leave': 'is-leave', 'Missing Punch': 'is-leave', Absent: 'is-absent',
    Holiday: 'is-holiday', 'Weekly Off': 'is-off', 'Not Started': 'is-off', Future: ''
  };
  var CELL_MARK = {
    Present: 'P', Late: 'L', 'Work From Home': 'WFH', 'On Leave': 'LV', 'Missing Punch': 'MP',
    Absent: 'A', Holiday: 'H', 'Weekly Off': 'WO', 'Not Started': '—', Future: ''
  };

  function hashOf(str) {
    var n = 0;
    for (var i = 0; i < str.length; i++) n = (n * 31 + str.charCodeAt(i)) >>> 0;
    return n;
  }
  function dayStatus(employeeId, dateIso, hol) {
    var d = new Date(dateIso + 'T00:00');
    if (hol[dateIso]) return 'Holiday';
    if (rules.isWeekend(d)) return 'Weekly Off';
    if (dateIso > seed.todayIso) return 'Future';
    var onLeave = store.collection('leaveRequests').some(function (l) {
      return l.employee === employeeId && l.status === 'Approved' && l.from <= dateIso && l.to >= dateIso;
    });
    if (onLeave) return 'On Leave';
    if (dateIso === seed.todayIso) {
      var rec = store.collection('attendanceToday').filter(function (a) { return a.employee === employeeId; })[0];
      return rec ? rec.status : 'Not Started';
    }
    var e = emp(employeeId);
    if (e && e.joined > dateIso) return 'Not Started';
    var n = hashOf(employeeId + dateIso) % 100;
    return n < 3 ? 'Absent' : n < 8 ? 'Missing Punch' : n < 17 ? 'Late' : n < 32 ? 'Work From Home' : 'Present';
  }

  function MonthGrid(p) {
    var hol = holidayMap();
    var first = new Date(p.year, p.month, 1);
    var total = new Date(p.year, p.month + 1, 0).getDate();
    var lead = (first.getDay() + 6) % 7;                 // Monday-first, matching the work week
    var cells = [];
    for (var i = 0; i < lead; i++) cells.push(null);
    for (var d = 1; d <= total; d++) cells.push(new Date(p.year, p.month, d));

    return h('div', { className: 'monthgrid' },
      WEEK.map(function (w) { return h('span', { className: 'monthgrid__head', key: w }, w); }),
      cells.map(function (day, idx) {
        if (!day) return h('span', { className: 'monthgrid__cell is-empty', key: 'lead' + idx });
        var key = iso(day);
        var st = dayStatus(p.employee, key, hol);
        var title = pretty(day) + ' · ' + (st === 'Holiday' ? hol[key].name : st);
        return h('span', { className: ('monthgrid__cell ' + CELL_CLASS[st]).trim(), key: key, title: title },
          h('span', { className: 'monthgrid__day' }, day.getDate()),
          h('span', { style: { fontSize: 9, letterSpacing: '.04em' } }, CELL_MARK[st]));
      }));
  }

  function AttendanceMonthly() {
    var empSt = React.useState(defaultEmployeeId());
    var offsetSt = React.useState(0);

    function defaultEmployeeId() {
      var featured = store.employeeByName('Ananya Rao');
      if (featured) return featured.id;
      var list = workforce();
      return list.length ? list[0].id : null;
    }

    var base = new Date(seed.today.getFullYear(), seed.today.getMonth() + offsetSt[0], 1);
    var year = base.getFullYear(), month = base.getMonth();
    var who = empSt[0] ? emp(empSt[0]) : null;
    var hol = holidayMap();

    /* Day-by-day tally for the month, so the summary agrees with the grid exactly. */
    var counts = {};
    var total = new Date(year, month + 1, 0).getDate();
    for (var d = 1; d <= total; d++) {
      var st = who ? dayStatus(who.id, iso(new Date(year, month, d)), hol) : 'Future';
      counts[st] = (counts[st] || 0) + 1;
    }
    function n(key) { return counts[key] || 0; }
    var payable = n('Present') + n('Late') + n('Work From Home') + n('On Leave') + n('Holiday') + n('Weekly Off');

    var LEGEND = [
      ['is-present', 'Present, late or WFH'], ['is-leave', 'On leave or missing punch'],
      ['is-absent', 'Absent'], ['is-holiday', 'Holiday'], ['is-off', 'Weekly off']
    ];

    return h(React.Fragment, null,
      h(Grid, null,
        h(Card, { span: 8, title: MONTHS[month] + ' ' + year,
          description: who ? 'Derived from approved leave, the holiday calendar and the work week (PRD 4.19).' : null,
          aside: h('div', { className: 'row gap-2' },
            h(V.IconButton, { icon: I.back, 'aria-label': 'Previous month', onClick: function () { offsetSt[1](offsetSt[0] - 1); } }),
            h(V.Button, { variant: 'outline', className: 'vi-btn--sm', disabled: offsetSt[0] === 0, onClick: function () { offsetSt[1](0); } }, 'This month'),
            h(V.IconButton, { icon: I.right, 'aria-label': 'Next month', onClick: function () { offsetSt[1](offsetSt[0] + 1); } }))
        },
          h(ui.EmployeePicker, {
            label: 'Employee', value: empSt[0], placeholder: 'Search by name or ID',
            onChange: function (v) { empSt[1](v); }
          }),
          who
            ? h(React.Fragment, null,
                h(MonthGrid, { employee: who.id, year: year, month: month }),
                h('div', { className: 'legend' }, LEGEND.map(function (row) {
                  return h('span', { className: 'legend__key', key: row[0] },
                    h('span', { className: 'legend__swatch ' + row[0] }), row[1]);
                })))
            : h(ui.Empty, {
                icon: I.person, title: 'Choose an employee',
                body: 'The month grid is drawn for one employee at a time.'
              })),

        h(Card, { span: 4, title: 'Month summary' },
          who
            ? h(React.Fragment, null,
                h(ui.Person, { employee: who, size: 'md', sub: deptName(who.department) + ' · ' + locName(who.location) }),
                h(ui.KeyValue, { rows: [
                  ['Assigned shift', shiftName(who.shift)],
                  ['Present days', n('Present') + n('Late')],
                  ['Work from home', n('Work From Home')],
                  ['Late arrivals', n('Late')],
                  ['On leave', n('On Leave')],
                  ['Absent', n('Absent')],
                  ['Missing punches', n('Missing Punch')],
                  ['Holidays', n('Holiday')],
                  ['Weekly offs', n('Weekly Off')],
                  ['Payable days', h('strong', null, payable + ' of ' + total)]
                ]}),
                h('div', { className: 'row gap-2 wrap' },
                  h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.checklist,
                    onClick: function () { router.go('hr/attendance/regularization'); } }, 'Corrections'),
                  h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.calendar,
                    onClick: function () { router.go('hr/leave/requests'); } }, 'Leave requests')))
            : h(ui.Empty, { icon: I.reports, title: 'No employee selected' }))));
  }

  /* ========================================================= Regularization
     PRD 4.18: a correction keeps both the original and the corrected value, and
     the decision goes through actions so 5.1's attendance update always runs. */
  function AttendanceRegularization() {
    var tabSt = React.useState('pending');
    var rejectSt = React.useState(null);
    var reasonSt = React.useState('');

    var all = store.collection('regularizations');
    var pending = all.filter(function (x) { return x.status === 'Pending Approval'; });
    var rows = tabSt[0] === 'pending' ? pending
      : tabSt[0] === 'actioned' ? all.filter(function (x) { return x.status !== 'Pending Approval'; })
        : all;

    function approve(x) { ui.report(act.approveRegularization(x.id)); }
    function reject() {
      var res = ui.report(act.rejectRegularization(rejectSt[0].id, reasonSt[0]));
      if (res && res.ok) { rejectSt[1](null); reasonSt[1](''); }
    }

    var columns = [
      { key: 'id', header: 'Request', width: 96, cell: function (x) { return h('span', { className: 'mono' }, x.id); } },
      { key: 'employee', header: 'Employee', sortable: true,
        sortValue: function (x) { return empName(x.employee); }, csv: function (x) { return empName(x.employee); },
        cell: function (x) {
          var e = emp(x.employee);
          return e ? h(ui.Person, { employee: e, sub: deptName(e.department) }) : h('span', { className: 'muted' }, '—');
        } },
      { key: 'date', header: 'Date', sortable: true, cell: function (x) { return x.dateLabel || ui.dateLabel(x.date); } },
      { key: 'issue', header: 'Issue' },
      { key: 'original', header: 'Original', cell: function (x) { return h('span', { className: 'mono' }, x.original); } },
      { key: 'corrected', header: 'Corrected', cell: function (x) { return h('span', { className: 'mono' }, x.corrected); } },
      { key: 'reason', header: 'Reason' },
      { key: 'approver', header: 'Approver', csv: function (x) { return empName(x.approver); },
        cell: function (x) { return empName(x.approver); } },
      { key: 'status', header: 'Status', cell: function (x) { return h(ui.StatusChip, { status: x.status }); } },
      { key: 'actions', header: '', align: 'right', cell: function (x) {
          if (x.status !== 'Pending Approval') {
            return h('span', { className: 'muted', style: { fontSize: 12 } },
              x.decidedOn ? ui.dateLabel(x.decidedOn) : '');
          }
          return h('span', { className: 'row gap-2', style: { justifyContent: 'flex-end' } },
            h(V.Button, { variant: 'outline', className: 'vi-btn--sm', onClick: function () { reasonSt[1](''); rejectSt[1](x); } }, 'Reject'),
            h(V.Button, { variant: 'primary', className: 'vi-btn--sm', onClick: function () { approve(x); } }, 'Approve'));
        } }
    ];

    return h(React.Fragment, null,
      h(Stats, { cols: 3 },
        h(Stat, { label: 'Pending corrections', value: pending.length, sub: 'Awaiting a decision', tone: pending.length ? 'warn' : 'good' }),
        h(Stat, { label: 'Approved', value: all.filter(function (x) { return x.status === 'Approved'; }).length, sub: 'Original values retained (PRD 14.3)' }),
        h(Stat, { label: 'Rejected', value: all.filter(function (x) { return x.status === 'Rejected'; }).length, sub: 'Each carries a reason' })),

      h(V.TabGroup, {
        value: tabSt[0], onChange: tabSt[1],
        items: [
          { value: 'pending', label: 'Pending', count: pending.length },
          { value: 'actioned', label: 'Actioned', count: all.length - pending.length },
          { value: 'all', label: 'All', count: all.length }
        ]
      }),

      h(Card, { title: 'Attendance corrections', description: 'Approving writes the corrected punch while keeping the original on the record (PRD 14.3).' },
        h(ui.DataTable, {
          exportName: 'attendance-regularizations', label: 'Attendance corrections', rows: rows, pageSize: 10,
          search: function (x) { return [x.id, empName(x.employee), x.issue, x.reason].join(' '); },
          searchPlaceholder: 'Search by request, employee or issue',
          columns: columns,
          emptyIcon: tabSt[0] === 'pending' ? I.ok : I.checklist,
          emptyTitle: tabSt[0] === 'pending' ? 'No corrections waiting' : 'Nothing here yet',
          emptyBody: tabSt[0] === 'pending'
            ? 'Every correction request has been actioned.'
            : 'Correction requests appear here once employees raise them.'
        })),

      /* PRD 4.18 and 17: a rejection carries a mandatory reason. */
      rejectSt[0] ? h(ui.Modal, {
        title: 'Reject correction',
        description: rejectSt[0].id + ' · ' + empName(rejectSt[0].employee) + ' · ' + rejectSt[0].issue
          + ' on ' + (rejectSt[0].dateLabel || ui.dateLabel(rejectSt[0].date)),
        onClose: function () { rejectSt[1](null); },
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { rejectSt[1](null); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', className: 'vi-btn--danger', onClick: reject }, 'Reject correction'))
      },
        h(ui.KeyValue, { rows: [
          ['Original', h('span', { className: 'mono' }, rejectSt[0].original)],
          ['Corrected', h('span', { className: 'mono' }, rejectSt[0].corrected)],
          ['Employee reason', rejectSt[0].reason]
        ]}),
        h(V.TextArea, {
          label: 'Reason', required: true, rows: 3, value: reasonSt[0],
          placeholder: 'The employee sees this reason.',
          onChange: function (e) { reasonSt[1](e.target.value); }
        })) : null);
  }

  /* ====================================================== Attendance policies
     PRD 4.16: working hours, grace period, late and overtime rules. */
  var ATTENDANCE_POLICIES = [
    { id: 'ap-standard', name: 'Standard — General Shift', appliesTo: 'Full-Time, general shift',
      hours: 9, grace: 15, halfDay: 4, fullDay: 8, overtime: 'Beyond 9.5 h, compensatory off', wfh: 'Up to 2 days a week', status: 'Active' },
    { id: 'ap-shift', name: 'Rotational shift', appliesTo: 'Operations, morning / evening / night',
      hours: 8, grace: 10, halfDay: 4, fullDay: 7.5, overtime: 'Beyond 9 h, paid at 1.0x', wfh: 'Not permitted', status: 'Active' },
    { id: 'ap-flex', name: 'Flexible hours', appliesTo: 'Design, Product and Marketing leads',
      hours: 9, grace: 60, halfDay: 4, fullDay: 8, overtime: 'Not tracked', wfh: 'Fully flexible', status: 'Active' }
  ];

  function AttendancePolicies() {
    var assigned = {};
    workforce().forEach(function (e) {
      var k = e.attendancePolicy || 'ap-standard';
      assigned[k] = (assigned[k] || 0) + 1;
    });

    return h(React.Fragment, null,
      h(Card, { title: 'Attendance policies', description: 'Working hours, grace period, late marking and overtime, per group of employees (PRD 4.16).' },
        h(ui.DataTable, {
          exportName: 'attendance-policies', label: 'Attendance policies', rows: ATTENDANCE_POLICIES, pageSize: 10,
          search: function (p) { return p.name + ' ' + p.appliesTo; }, searchPlaceholder: 'Search policies',
          columns: [
            { key: 'name', header: 'Policy', sortable: true },
            { key: 'appliesTo', header: 'Applies to' },
            { key: 'hours', header: 'Hours / day', numeric: true, align: 'right', cell: function (p) { return p.hours + ' h'; } },
            { key: 'grace', header: 'Grace', numeric: true, align: 'right', cell: function (p) { return p.grace + ' min'; } },
            { key: 'halfDay', header: 'Half day at', numeric: true, align: 'right', cell: function (p) { return p.halfDay + ' h'; } },
            { key: 'overtime', header: 'Overtime' },
            { key: 'people', header: 'Employees', numeric: true, align: 'right',
              csv: function (p) { return assigned[p.id] || 0; },
              cell: function (p) { return assigned[p.id] || 0; } },
            { key: 'status', header: 'Status', cell: function (p) { return h(ui.StatusChip, { status: p.status }); } }
          ],
          emptyIcon: I.sliders, emptyTitle: 'No attendance policies defined',
          emptyBody: 'A policy sets the working hours, grace period and overtime rules for a group of employees.'
        })),

      h(Grid, null,
        h(Card, { span: 6, title: 'Marking rules', description: 'How a day is classified once punches are in.' },
          h(ui.KeyValue, { rows: [
            ['Late', 'Check-in after the shift start plus its grace period'],
            ['Half day', 'Fewer than 4 worked hours'],
            ['Absent', 'No punch and no approved leave'],
            ['Missing punch', 'One punch recorded, the other missing'],
            ['Correction window', 'The last 30 days (PRD 14.3)'],
            ['Weekly off', seed.org.workWeek.join(', ') + ' are working days']
          ]})),
        h(Card, { span: 6, title: 'Options' },
          h('div', { className: 'checks' },
            [['Mark late automatically past the grace period', true],
              ['Allow employees to raise corrections', true],
              ['Require a reason on every correction', true],
              ['Treat a missing punch as absent for payroll', false],
              ['Track overtime for shift employees', true],
              ['Allow work from home to be self-marked', true]].map(function (row) {
              return h('div', { className: 'checks__row', key: row[0] },
                h(V.Switch, {
                  defaultChecked: row[1], 'aria-label': row[0],
                  onChange: function (e) { ui.toast(row[0] + ' ' + (e.target.checked ? 'enabled' : 'disabled'), 'success'); }
                }),
                h('div', { className: 'checks__main' }, h('span', { className: 'checks__name' }, row[0])));
            })),
          h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.sliders,
            onClick: function () { router.go('hr/config/attendance'); } }, 'Attendance configuration'))));
  }

  /* ============================================================ Leave dashboard
     PRD 4.10: request volume, pending approvals, who is out today and what is next. */
  function LeaveDashboard() {
    var s = store.stats();
    var all = store.collection('leaveRequests');
    var today = seed.todayIso;
    var monthStart = today.slice(0, 8) + '01';

    var outToday = all.filter(function (l) { return l.status === 'Approved' && l.from <= today && l.to >= today; });
    var upcoming = all.filter(function (l) { return l.status === 'Approved' && l.from > today; })
      .sort(function (a, b) { return a.from < b.from ? -1 : 1; });
    var thisMonth = all.filter(function (l) { return l.appliedOn >= monthStart; });

    var byType = {}, byDept = {}, byStatus = {};
    all.forEach(function (l) {
      byStatus[l.status] = (byStatus[l.status] || 0) + 1;
      byType[typeName(l.type)] = (byType[typeName(l.type)] || 0) + l.days;
      var e = emp(l.employee);
      if (e) byDept[deptName(e.department)] = (byDept[deptName(e.department)] || 0) + l.days;
    });
    function rowsOf(obj, tone) {
      return Object.keys(obj).map(function (k) { return [k, Math.round(obj[k]), tone]; })
        .sort(function (a, b) { return b[1] - a[1]; });
    }
    var holidaysAhead = store.collection('holidays').filter(function (hd) { return hd.date >= today; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });

    return h(React.Fragment, null,
      h(ui.PageHead, {
        eyebrow: seed.todayLabel, title: 'Leave overview',
        description: s.pendingLeave + ' requests are awaiting a decision and ' + s.onLeaveToday + ' employees are out today.',
        actions: [
          h(V.Button, { key: 'a', variant: 'outline', iconStart: I.calendar, onClick: function () { router.go('hr/leave/calendar'); } }, 'Leave calendar'),
          h(V.Button, { key: 'b', variant: 'primary', iconStart: I.checklist, onClick: function () { router.go('hr/leave/requests'); } }, 'Open requests')
        ]
      }),

      h(Stats, null,
        h(Stat, { label: 'Pending approval', value: s.pendingLeave, sub: 'Across every leave type',
          tone: s.pendingLeave ? 'warn' : 'good', onClick: function () { router.go('hr/leave/requests'); } }),
        h(Stat, { label: 'Out today', value: s.onLeaveToday, sub: 'Approved leave covering today' }),
        h(Stat, { label: 'Requests this month', value: thisMonth.length, sub: 'Applied since ' + ui.dateLabel(monthStart) }),
        h(Stat, { label: 'Approved all time', value: byStatus.Approved || 0, sub: (byStatus.Rejected || 0) + ' rejected', tone: 'good' })),

      h(Grid, null,
        h(Card, { span: 5, title: 'Days by leave type', description: 'Total days requested, all statuses.' },
          h(ui.Bars, { rows: rowsOf(byType, 'info') })),
        h(Card, { span: 7, title: 'Days by department' },
          h(ui.Bars, { rows: rowsOf(byDept, 'success') })),

        h(Card, { span: 4, title: 'Request status' },
          h(ui.Bars, {
            rows: Object.keys(byStatus).map(function (k) {
              return [k, byStatus[k], k === 'Approved' ? 'success' : k === 'Rejected' ? 'error' : 'warning'];
            }).sort(function (a, b) { return b[1] - a[1]; })
          })),

        h(Card, {
          span: 4, title: 'Who is out today',
          aside: h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', onClick: function () { router.go('hr/leave/calendar'); } }, 'Calendar')
        },
          outToday.length
            ? h('div', { className: 'list scroll-320' }, outToday.slice(0, 10).map(function (l) {
                var e = emp(l.employee);
                return h('div', { className: 'list__row', key: l.id },
                  e ? h(ui.Person, { employee: e, sub: typeName(l.type) }) : h('span', null, l.employee),
                  h('span', { style: { flex: 1 } }),
                  h(V.Chip, { size: 'sm', shape: 'tag' }, 'to ' + ui.shortDate(l.to)));
              }))
            : h(ui.Empty, { icon: I.users, title: 'Everyone is in today' })),

        h(Card, { span: 4, title: 'Upcoming leave' },
          upcoming.length
            ? h('div', { className: 'list scroll-320' }, upcoming.slice(0, 10).map(function (l) {
                var e = emp(l.employee);
                return h('div', { className: 'list__row', key: l.id },
                  h('div', { className: 'list__main' },
                    h('span', { className: 'list__title' }, e ? e.name : l.employee),
                    h('span', { className: 'list__meta' }, typeName(l.type) + ' · ' + l.fromLabel + ' → ' + l.toLabel)),
                  h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info' }, l.days + 'd'));
              }))
            : h(ui.Empty, { icon: I.calendar, title: 'No approved leave ahead' })),

        h(Card, { span: 12, title: 'Holidays ahead', description: 'Leave days are counted around these and the weekly offs (PRD 14.2).' },
          holidaysAhead.length
            ? h('div', { className: 'row gap-2 wrap' }, holidaysAhead.map(function (hd) {
                return h(V.Chip, {
                  key: hd.date, size: 'sm', shape: 'tag',
                  variant: hd.type === 'Optional' ? 'outline' : 'soft',
                  tone: hd.type === 'Optional' ? 'neutral' : 'info'
                }, hd.name + ' · ' + ui.shortDate(hd.date));
              }))
            : h(ui.Empty, { icon: I.star, title: 'No holidays left this year' }))));
  }

  /* ============================================================ Leave requests
     PRD 4.14 and 16.4: approve or reject, with a mandatory reason on rejection. */
  function LeaveRequests() {
    var tabSt = React.useState('pending');
    var typeSt = React.useState(''), deptSt = React.useState('');
    var rejectSt = React.useState(null);
    var reasonSt = React.useState('');
    var openSt = React.useState(null);

    var all = store.collection('leaveRequests');
    var pending = all.filter(function (l) { return l.status === 'Pending Approval'; });
    var rows = tabSt[0] === 'pending' ? pending
      : tabSt[0] === 'approved' ? all.filter(function (l) { return l.status === 'Approved'; })
        : tabSt[0] === 'rejected' ? all.filter(function (l) { return l.status === 'Rejected' || l.status === 'Cancelled'; })
          : all;
    if (typeSt[0]) rows = rows.filter(function (l) { return l.type === typeSt[0]; });
    if (deptSt[0]) rows = rows.filter(function (l) { var e = emp(l.employee); return e && e.department === deptSt[0]; });

    function approve(l) { ui.report(act.approveLeave(l.id)); }
    function reject() {
      var res = ui.report(act.rejectLeave(rejectSt[0].id, reasonSt[0]));
      if (res && res.ok) { rejectSt[1](null); reasonSt[1](''); }
    }

    var columns = [
      { key: 'id', header: 'Request', width: 96, cell: function (l) { return h('span', { className: 'mono' }, l.id); } },
      { key: 'employee', header: 'Employee', sortable: true,
        sortValue: function (l) { return empName(l.employee); }, csv: function (l) { return empName(l.employee); },
        cell: function (l) {
          var e = emp(l.employee);
          return e ? h(ui.Person, { employee: e, sub: deptName(e.department), onClick: function () { openSt[1](e.id); } })
            : h('span', { className: 'muted' }, '—');
        } },
      { key: 'type', header: 'Type', sortable: true, csv: function (l) { return typeName(l.type); },
        cell: function (l) { return h(V.Chip, { size: 'sm', shape: 'tag' }, typeName(l.type)); } },
      { key: 'from', header: 'Dates', sortable: true, csv: function (l) { return l.from + ' to ' + l.to; },
        cell: function (l) { return l.fromLabel + ' → ' + l.toLabel; } },
      { key: 'days', header: 'Days', numeric: true, align: 'right', sortable: true,
        cell: function (l) { return l.days + (l.halfDay ? ' (half)' : ''); } },
      { key: 'reason', header: 'Reason' },
      { key: 'appliedOn', header: 'Applied', sortable: true, cell: function (l) { return ui.relTime(l.appliedOn); },
        csv: function (l) { return l.appliedOn; } },
      { key: 'approver', header: 'Approver', csv: function (l) { return empName(l.approver); },
        cell: function (l) { return empName(l.approver); } },
      { key: 'status', header: 'Status', cell: function (l) { return h(ui.StatusChip, { status: l.status }); } },
      { key: 'actions', header: '', align: 'right', cell: function (l) {
          if (l.status !== 'Pending Approval') {
            return h('span', { className: 'muted', style: { fontSize: 12 } }, l.decidedOn ? ui.dateLabel(l.decidedOn) : '');
          }
          return h('span', { className: 'row gap-2', style: { justifyContent: 'flex-end' } },
            h(V.Button, { variant: 'outline', className: 'vi-btn--sm', onClick: function () { reasonSt[1](''); rejectSt[1](l); } }, 'Reject'),
            h(V.Button, { variant: 'primary', className: 'vi-btn--sm', onClick: function () { approve(l); } }, 'Approve'));
        } }
    ];

    return h(React.Fragment, null,
      h(V.TabGroup, {
        value: tabSt[0], onChange: tabSt[1],
        items: [
          { value: 'pending', label: 'Pending', count: pending.length },
          { value: 'approved', label: 'Approved', count: all.filter(function (l) { return l.status === 'Approved'; }).length },
          { value: 'rejected', label: 'Rejected & cancelled', count: all.filter(function (l) { return l.status === 'Rejected' || l.status === 'Cancelled'; }).length },
          { value: 'all', label: 'All', count: all.length }
        ]
      }),

      h(Card, {
        title: 'Leave requests',
        description: 'Approving updates the balance, the attendance calendar and payroll inputs, as PRD 5.1 requires.'
      },
        h(ui.DataTable, {
          exportName: 'leave-requests', label: 'Leave requests', rows: rows, pageSize: 10,
          search: function (l) { return [l.id, empName(l.employee), typeName(l.type), l.reason, l.status].join(' '); },
          searchPlaceholder: 'Search by request, employee or type',
          filters: h(React.Fragment, null,
            h(ui.Filter, { label: 'Leave type', value: typeSt[0], onChange: typeSt[1], options: leaveTypeOptions() }),
            h(ui.Filter, { label: 'Department', value: deptSt[0], onChange: deptSt[1], options: deptOptions() })),
          columns: columns,
          emptyIcon: tabSt[0] === 'pending' ? I.ok : I.calendar,
          emptyTitle: tabSt[0] === 'pending' ? 'Nothing waiting for a decision' : 'No requests match this view',
          emptyBody: tabSt[0] === 'pending'
            ? 'Every leave request has been actioned.'
            : 'Adjust the filters, or choose another tab.'
        })),

      /* PRD 4.13: a rejection needs a reason, and the requester sees it. */
      rejectSt[0] ? h(ui.Modal, {
        title: 'Reject leave request',
        description: rejectSt[0].id + ' · ' + empName(rejectSt[0].employee) + ' · ' + typeName(rejectSt[0].type)
          + ' · ' + rejectSt[0].days + ' day' + (rejectSt[0].days === 1 ? '' : 's'),
        onClose: function () { rejectSt[1](null); },
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { rejectSt[1](null); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', className: 'vi-btn--danger', onClick: reject }, 'Reject request'))
      },
        h(ui.KeyValue, { rows: [
          ['Dates', rejectSt[0].fromLabel + ' → ' + rejectSt[0].toLabel],
          ['Employee reason', rejectSt[0].reason],
          ['Applied', ui.dateLabel(rejectSt[0].appliedOn)]
        ]}),
        h(V.TextArea, {
          label: 'Reason', required: true, rows: 3, value: reasonSt[0],
          placeholder: 'The employee sees this reason.',
          onChange: function (e) { reasonSt[1](e.target.value); }
        })) : null,

      openSt[0] && HRMS.screens.ProfileDrawer
        ? h(HRMS.screens.ProfileDrawer, { id: openSt[0], onClose: function () { openSt[1](null); } })
        : null);
  }

  /* ============================================================ Leave calendar
     PRD 4.14: who is out, grouped by date, across the next thirty days, with the
     holiday calendar drawn against it. */
  function LeaveCalendar() {
    var deptSt = React.useState('');
    var WINDOW = 30;
    var hol = holidayMap();
    var from = seed.todayIso, to = iso(addDays(seed.today, WINDOW - 1));

    var inWindow = store.collection('leaveRequests').filter(function (l) {
      return (l.status === 'Approved' || l.status === 'Pending Approval') && l.from <= to && l.to >= from;
    });
    if (deptSt[0]) inWindow = inWindow.filter(function (l) { var e = emp(l.employee); return e && e.department === deptSt[0]; });

    var days = [];
    for (var i = 0; i < WINDOW; i++) {
      var d = addDays(seed.today, i);
      var key = iso(d);
      var out = inWindow.filter(function (l) { return l.from <= key && l.to >= key; });
      days.push({
        id: key, date: key, day: d, holiday: hol[key] || null,
        weekend: rules.isWeekend(d),
        approved: out.filter(function (l) { return l.status === 'Approved'; }),
        pending: out.filter(function (l) { return l.status === 'Pending Approval'; })
      });
    }
    var busy = days.filter(function (x) { return x.approved.length || x.pending.length || x.holiday; });
    var peak = days.slice().sort(function (a, b) { return b.approved.length - a.approved.length; })[0];

    return h(React.Fragment, null,
      h(Stats, { cols: 3 },
        h(Stat, { label: 'Out today', value: days[0].approved.length, sub: days[0].pending.length + ' more awaiting approval' }),
        h(Stat, { label: 'Absences in the window', value: inWindow.length, sub: 'Next ' + WINDOW + ' days from ' + seed.todayLabel }),
        h(Stat, {
          label: 'Busiest day', value: peak && peak.approved.length ? peak.approved.length : 0,
          sub: peak && peak.approved.length ? ui.dateLabel(peak.date) : 'Nothing booked yet',
          tone: peak && peak.approved.length > 6 ? 'warn' : null
        })),

      h(Grid, null,
        h(Card, {
          span: 7, title: 'Who is out', description: 'Grouped by date for the next ' + WINDOW + ' days. Weekly offs and holidays are marked.',
          aside: h(ui.Filter, { label: 'Department', value: deptSt[0], onChange: deptSt[1], options: deptOptions() })
        },
          busy.length
            ? h('div', { className: 'list' }, busy.map(function (x) {
                var people = x.approved.concat(x.pending);
                return h('div', { className: 'list__row', key: x.id },
                  h('div', { className: 'list__main' },
                    h('span', { className: 'list__title' },
                      ui.dateLabel(x.date) + ' · ' + DAY_NAMES[x.day.getDay()]),
                    h('span', { className: 'list__meta' },
                      people.length
                        ? people.slice(0, 4).map(function (l) { return empName(l.employee); }).join(', ')
                          + (people.length > 4 ? ' and ' + (people.length - 4) + ' more' : '')
                        : 'Nobody on leave')),
                  people.length
                    ? h(V.AvatarGroup, {
                        size: 'xs', max: 5,
                        avatars: people.map(function (l) { return { id: l.id, name: empName(l.employee) }; })
                      })
                    : null,
                  x.holiday
                    ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info', dot: true }, x.holiday.name)
                    : null,
                  x.weekend ? h(V.Chip, { size: 'sm', shape: 'tag' }, 'Weekly off') : null,
                  x.pending.length
                    ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning' }, x.pending.length + ' pending')
                    : null);
              }))
            : h(ui.Empty, {
                icon: I.calendar, title: 'Nobody is out in the next ' + WINDOW + ' days',
                body: 'Approved and pending leave both appear here as soon as it is applied for.'
              })),

        h(Card, { span: 5, title: 'Absences in the window', description: 'The same data as a list you can export.' },
          h(ui.DataTable, {
            exportName: 'leave-calendar', label: 'Upcoming absences', rows: inWindow, pageSize: 10,
            search: function (l) { return empName(l.employee) + ' ' + typeName(l.type) + ' ' + l.status; },
            searchPlaceholder: 'Search by employee or type',
            columns: [
              { key: 'employee', header: 'Employee', sortable: true,
                sortValue: function (l) { return empName(l.employee); }, csv: function (l) { return empName(l.employee); },
                cell: function (l) { var e = emp(l.employee); return e ? h(ui.Person, { employee: e, sub: typeName(l.type) }) : '—'; } },
              { key: 'from', header: 'From', sortable: true, cell: function (l) { return ui.shortDate(l.from); } },
              { key: 'to', header: 'To', cell: function (l) { return ui.shortDate(l.to); } },
              { key: 'days', header: 'Days', numeric: true, align: 'right' },
              { key: 'status', header: 'Status', cell: function (l) { return h(ui.StatusChip, { status: l.status }); } }
            ],
            emptyIcon: I.calendar, emptyTitle: 'No absences booked',
            emptyBody: 'Nothing falls inside the next ' + WINDOW + ' days for this department.'
          }))));
  }

  /* ============================================================ Leave balances
     PRD 4.14: entitlement, used and available per employee per leave type. */
  /* The ledger behind one balance: every line that moved it, oldest first, with a running
     total so the number on the row can be followed to where it came from. */
  function BalanceLedger(p) {
    var e = emp(p.employee);
    var lines = store.collection('leaveLedger')
      .filter(function (l) { return l.employee === p.employee && l.type === p.type; })
      .slice()
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });

    var running = 0;
    var rows = lines.map(function (l) { running += l.days; return { l: l, at: Math.round(running * 10) / 10 }; });
    var closing = rows.length ? rows[rows.length - 1].at : 0;

    return h(ui.Drawer, {
      title: (e ? e.name : p.employee) + ' · ' + typeName(p.type),
      onClose: p.onClose
    },
      h(ui.KeyValue, { rows: [
        ['Employee', e ? e.name + ' · ' + e.id : p.employee],
        ['Leave type', typeName(p.type)],
        ['Lines', rows.length],
        ['Closing balance', closing + ' days']
      ]}),
      h('div', { className: 'lrows', style: { marginTop: 14 } }, rows.map(function (x) {
        var neg = x.l.days < 0;
        return h('div', { className: 'lrow', key: x.l.id },
          h('span', { className: 'lrow__ico' }, neg ? I.logout : I.plus),
          h('span', { className: 'lrow__m' },
            h('strong', null, x.l.kind),
            h('span', null, ui.dateLabel(x.l.date) + ' · ' + x.l.note)),
          h('span', { style: { fontWeight: 500, color: neg ? 'var(--danger-fg, var(--text-primary))' : 'var(--success-fg)' } },
            (neg ? '' : '+') + x.l.days),
          h('span', { className: 'muted', style: { width: 56, textAlign: 'right' } }, x.at));
      })),
      rows.length ? null : h(ui.Empty, { icon: I.calendar, title: 'No ledger for this balance' }));
  }

  function LeaveBalances() {
    var deptSt = React.useState(''), typeSt = React.useState(''), locSt = React.useState('');
    var openSt = React.useState(null);

    var people = workforce();
    if (deptSt[0]) people = people.filter(function (e) { return e.department === deptSt[0]; });
    if (locSt[0]) people = people.filter(function (e) { return e.location === locSt[0]; });

    var rows = [];
    people.forEach(function (e) {
      store.balancesFor(e.id).forEach(function (b) {
        if (typeSt[0] && b.type !== typeSt[0]) return;
        rows.push({
          id: e.id + '-' + b.type, employee: e.id, type: b.type,
          entitled: b.entitled, used: b.used, available: b.available,
          carried: b.carried || 0, encashed: b.encashed || 0
        });
      });
    });

    /* Utilisation by leave type across everyone currently in view. */
    var totals = {};
    rows.forEach(function (x) {
      var k = typeName(x.type);
      totals[k] = totals[k] || { entitled: 0, used: 0 };
      totals[k].entitled += x.entitled;
      totals[k].used += x.used;
    });

    return h(React.Fragment, null,
      h(Grid, null,
        h(Card, { span: 8, title: 'Leave balances', description: 'One row per employee per leave type, from the policy they are on (PRD 4.11).' },
          h(ui.DataTable, {
            exportName: 'leave-balances', label: 'Leave balances', rows: rows, pageSize: 10,
            search: function (x) { return empName(x.employee) + ' ' + x.employee + ' ' + typeName(x.type); },
            searchPlaceholder: 'Search by name, ID or leave type',
            filters: h(React.Fragment, null,
              h(ui.Filter, { label: 'Department', value: deptSt[0], onChange: deptSt[1], options: deptOptions() }),
              h(ui.Filter, { label: 'Location', value: locSt[0], onChange: locSt[1], options: locOptions() }),
              h(ui.Filter, { label: 'Leave type', value: typeSt[0], onChange: typeSt[1], options: leaveTypeOptions() })),
            columns: [
              { key: 'employee', header: 'Employee', sortable: true,
                sortValue: function (x) { return empName(x.employee); }, csv: function (x) { return empName(x.employee); },
                cell: function (x) {
                  var e = emp(x.employee);
                  return e ? h(ui.Person, { employee: e, sub: e.id }) : h('span', { className: 'muted' }, '—');
                } },
              { key: 'department', header: 'Department', csv: function (x) { return deptName((emp(x.employee) || {}).department); },
                cell: function (x) { return deptName((emp(x.employee) || {}).department); } },
              { key: 'type', header: 'Leave type', sortable: true, csv: function (x) { return typeName(x.type); },
                cell: function (x) { return h(V.Chip, { size: 'sm', shape: 'tag' }, typeName(x.type)); } },
              { key: 'entitled', header: 'Entitled', numeric: true, align: 'right', sortable: true },
              { key: 'carried', header: 'Carried in', numeric: true, align: 'right', sortable: true,
                cell: function (x) { return x.carried ? x.carried : h('span', { className: 'muted' }, '—'); } },
              { key: 'used', header: 'Used', numeric: true, align: 'right', sortable: true },
              { key: 'encashed', header: 'Encashed', numeric: true, align: 'right',
                cell: function (x) { return x.encashed ? x.encashed : h('span', { className: 'muted' }, '—'); } },
              { key: 'available', header: 'Available', numeric: true, align: 'right', sortable: true,
                cell: function (x) { return h('strong', { style: { fontWeight: 500 } }, x.available); } },
              { key: 'ledger', header: '', align: 'right',
                cell: function (x) {
                  return h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', iconEnd: I.right,
                    onClick: function () { openSt[1]({ employee: x.employee, type: x.type }); } }, 'Ledger');
                } },
              { key: 'bar', header: 'Utilisation', csv: function (x) { return ui.pct(x.used, x.entitled) + '%'; },
                cell: function (x) {
                  return h(V.ProgressBar, {
                    value: ui.pct(x.used, x.entitled), size: 'sm',
                    tone: x.available <= 1 ? 'warning' : 'primary',
                    'aria-label': typeName(x.type) + ' utilisation'
                  });
                } }
            ],
            emptyIcon: I.calendar, emptyTitle: 'No balances to show',
            emptyBody: 'Balances come from the leave policy assigned to each employee. Adjust the filters to widen the view.'
          }),
          h('p', { className: 'muted', style: { fontSize: 12, marginTop: 10 } },
            'Available counts leave carried in and leaves out what has been encashed, so it is what the ledger adds up to. Open a row to follow it.')),

        h(Card, { span: 4, title: 'Utilisation by type', description: 'Days used against days entitled, for everyone in view.' },
          Object.keys(totals).length
            ? h(React.Fragment, null,
                Object.keys(totals).map(function (k) {
                  return h(V.ProgressBar, {
                    key: k, label: k, showValue: true,
                    value: ui.pct(totals[k].used, totals[k].entitled),
                    tone: ui.pct(totals[k].used, totals[k].entitled) > 80 ? 'warning' : 'info'
                  });
                }),
                h('p', { className: 'muted', style: { fontSize: 12 } },
                  'PRD 14.2: an application is refused when the requested days exceed the available balance.'))
            : h(ui.Empty, { icon: I.reports, title: 'Nothing to summarise' }))),

      openSt[0] ? h(BalanceLedger, {
        employee: openSt[0].employee, type: openSt[0].type,
        onClose: function () { openSt[1](null); }
      }) : null);
  }

  /* ================================================================ Leave types
     PRD 4.11: every rule a leave type carries, created through actions.createLeaveType. */
  function LeaveTypes() {
    var openSt = React.useState(false);
    var form = ui.useForm({ paid: true, carry: false, halfDay: true, docRequired: false, annual: 12, notice: 1 });

    function save() {
      var res = form.submit(function (v) { return ui.report(act.createLeaveType(v)); });
      if (res && res.ok) {
        openSt[1](false);
        form.reset({ paid: true, carry: false, halfDay: true, docRequired: false, annual: 12, notice: 1 });
      }
    }

    var rows = store.collection('leaveTypes');
    function yesNo(flag) {
      return flag
        ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'success' }, 'Yes')
        : h('span', { className: 'muted' }, 'No');
    }

    return h(React.Fragment, null,
      h(Card, {
        title: 'Leave types', description: 'Entitlement, carry forward, notice and documentation rules per type (PRD 4.11).',
        aside: h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus, onClick: function () { openSt[1](true); } }, 'Create leave type')
      },
        h(ui.DataTable, {
          exportName: 'leave-types', label: 'Leave types', rows: rows, pageSize: 10,
          search: function (t) { return t.name + ' ' + t.code; }, searchPlaceholder: 'Search leave types',
          columns: [
            { key: 'name', header: 'Leave type', sortable: true },
            { key: 'code', header: 'Code', cell: function (t) { return h('span', { className: 'mono' }, t.code); } },
            { key: 'paid', header: 'Paid', align: 'center', csv: function (t) { return t.paid ? 'Paid' : 'Unpaid'; },
              cell: function (t) { return h(ui.StatusChip, { status: t.paid ? 'Paid' : 'Unpaid' }); } },
            { key: 'annual', header: 'Annual days', numeric: true, align: 'right', sortable: true,
              cell: function (t) { return t.annual ? t.annual : h('span', { className: 'muted' }, 'Accrued'); } },
            { key: 'carry', header: 'Carry forward', align: 'center', csv: function (t) { return t.carry ? 'Yes' : 'No'; },
              cell: function (t) { return yesNo(t.carry); } },
            { key: 'maxAccrual', header: 'Max accrual', numeric: true, align: 'right',
              csv: function (t) { return t.maxAccrual || ''; },
              cell: function (t) { return t.maxAccrual ? t.maxAccrual : h('span', { className: 'muted' }, '—'); } },
            { key: 'maxConsecutive', header: 'Max consecutive', numeric: true, align: 'right',
              csv: function (t) { return t.maxConsecutive || ''; },
              cell: function (t) { return t.maxConsecutive ? t.maxConsecutive : h('span', { className: 'muted' }, 'No cap'); } },
            { key: 'notice', header: 'Notice days', numeric: true, align: 'right',
              cell: function (t) { return t.notice ? t.notice : h('span', { className: 'muted' }, 'None'); } },
            { key: 'docRequired', header: 'Document', align: 'center', csv: function (t) { return t.docRequired ? 'Required' : 'Not required'; },
              cell: function (t) { return yesNo(t.docRequired); } },
            { key: 'halfDay', header: 'Half day', align: 'center', csv: function (t) { return t.halfDay ? 'Allowed' : 'Not allowed'; },
              cell: function (t) { return yesNo(t.halfDay); } },
            { key: 'status', header: 'Status', cell: function (t) { return h(ui.StatusChip, { status: t.status || 'Active' }); } }
          ],
          emptyIcon: I.calendar, emptyTitle: 'No leave types defined',
          emptyBody: 'A leave type carries its own entitlement, notice period and documentation rules.',
          emptyActions: h(V.Button, { variant: 'primary', iconStart: I.plus, onClick: function () { openSt[1](true); } }, 'Create leave type')
        })),

      openSt[0] ? h(ui.Modal, {
        title: 'Create leave type', wide: true, onClose: function () { openSt[1](false); },
        description: 'Every field here becomes a rule the leave application in PRD 14.2 is checked against.',
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { openSt[1](false); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: save }, 'Create leave type'))
      },
        h(ui.FieldRow, null,
          h(V.TextField, Object.assign({ label: 'Leave name', required: true, placeholder: 'e.g. Bereavement Leave' }, form.field('name'))),
          h(V.TextField, Object.assign({ label: 'Leave code', required: true, placeholder: 'e.g. BL',
            hint: form.errors.code || 'Must be unique across leave types' }, form.field('code')))),
        h(ui.FormSection, { title: 'Entitlement', description: 'Annual days and how much may be carried into the next year.' },
          h(ui.FieldRow, { cols: 3 },
            h(V.NumberField, Object.assign({ label: 'Annual entitlement (days)', min: 0, step: 1 }, form.field('annual', { number: true }))),
            h(V.NumberField, Object.assign({ label: 'Maximum accrual (days)', min: 0, step: 1,
              hint: 'Cap on the carried-forward balance' }, form.field('maxAccrual', { number: true }))),
            h(V.NumberField, Object.assign({ label: 'Max consecutive days', min: 0, step: 1,
              hint: '0 means no cap' }, form.field('maxConsecutive', { number: true })))),
          h(ui.FieldRow, null,
            h(V.Switch, Object.assign({ label: 'Paid leave', description: 'Unpaid leave creates a loss-of-pay payroll input (PRD 5.1).' }, form.check('paid'))),
            h(V.Switch, Object.assign({ label: 'Carry forward allowed', description: 'Unused days move into the next leave year.' }, form.check('carry'))))),
        h(ui.FormSection, { title: 'Application rules' },
          h(ui.FieldRow, null,
            h(V.NumberField, Object.assign({ label: 'Notice days required', min: 0, step: 1,
              hint: 'Checked when the employee applies' }, form.field('notice', { number: true }))),
            h('div', { className: 'stack gap-2' },
              h(V.Switch, Object.assign({ label: 'Supporting document required', description: 'Enforced beyond two days.' }, form.check('docRequired'))),
              h(V.Switch, Object.assign({ label: 'Half day allowed' }, form.check('halfDay')))))),
        form.errors._ ? h('p', { style: { color: 'var(--danger-fg)', fontSize: 13 } }, form.errors._) : null) : null);
  }

  /* ============================================================ Leave policies
     PRD 4.11: a policy scopes a set of leave types to a group of employees. */
  function LeavePolicies() {
    var openSt = React.useState(false);
    var form = ui.useForm({ appliesTo: 'All employees', types: [] });

    function toggleType(id) {
      var picked = form.values.types || [];
      form.set('types', picked.indexOf(id) >= 0
        ? picked.filter(function (x) { return x !== id; })
        : picked.concat([id]));
    }
    function save() {
      var res = form.submit(function (v) { return ui.report(act.createLeavePolicy(v)); });
      if (res && res.ok) { openSt[1](false); form.reset({ appliesTo: 'All employees', types: [] }); }
    }

    var rows = store.collection('leavePolicies');
    var assigned = {};
    workforce().forEach(function (e) { assigned[e.leavePolicy] = (assigned[e.leavePolicy] || 0) + 1; });

    return h(React.Fragment, null,
      h(Card, {
        title: 'Leave policies', description: 'Policies scoped by employee type, department, location and tenure (PRD 4.11).',
        aside: h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus, onClick: function () { openSt[1](true); } }, 'Create policy')
      },
        h(ui.DataTable, {
          exportName: 'leave-policies', label: 'Leave policies', rows: rows, pageSize: 10,
          search: function (p) { return p.name + ' ' + p.appliesTo; }, searchPlaceholder: 'Search policies',
          columns: [
            { key: 'name', header: 'Policy', sortable: true },
            { key: 'appliesTo', header: 'Applies to' },
            { key: 'types', header: 'Leave types', csv: function (p) { return (p.types || []).map(typeName).join('; '); },
              cell: function (p) {
                return h('span', { className: 'row gap-2 wrap' }, (p.types || []).map(function (t) {
                  return h(V.Chip, { key: t, size: 'sm', shape: 'tag' }, (store.leaveType(t) || {}).code || t);
                }));
              } },
            { key: 'days', header: 'Total days', numeric: true, align: 'right',
              csv: function (p) { return (p.types || []).reduce(function (n, t) { return n + ((store.leaveType(t) || {}).annual || 0); }, 0); },
              cell: function (p) {
                var days = (p.types || []).reduce(function (n, t) {
                  var lt = store.leaveType(t);
                  return n + (lt && lt.annual < 100 ? lt.annual : 0);
                }, 0);
                return days;
              } },
            { key: 'people', header: 'Employees', numeric: true, align: 'right',
              csv: function (p) { return assigned[p.id] || 0; },
              cell: function (p) { return assigned[p.id] || 0; } },
            { key: 'status', header: 'Status', cell: function (p) { return h(ui.StatusChip, { status: p.status || 'Active' }); } }
          ],
          emptyIcon: I.sliders, emptyTitle: 'No leave policies defined',
          emptyBody: 'A policy decides which leave types an employee may apply for.',
          emptyActions: h(V.Button, { variant: 'primary', iconStart: I.plus, onClick: function () { openSt[1](true); } }, 'Create policy')
        })),

      openSt[0] ? h(ui.Modal, {
        title: 'Create leave policy', onClose: function () { openSt[1](false); },
        description: 'PRD 14.2: an employee may only apply for a leave type their policy includes.',
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { openSt[1](false); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: save }, 'Create policy'))
      },
        h(V.TextField, Object.assign({ label: 'Policy name', required: true, placeholder: 'e.g. Standard — Part-Time' }, form.field('name'))),
        h(V.Select, Object.assign({ label: 'Applies to',
          options: ['All employees', 'Full-Time employees past probation', 'Interns and trainees',
            'Contract, consultant and part-time', 'Employees on probation'] }, form.select('appliesTo'))),
        h(ui.FormSection, { title: 'Leave types included', description: 'Choose at least one. The policy total drives each employee’s balance.' },
          h('div', { className: 'checks' }, store.collection('leaveTypes').map(function (t) {
            var picked = (form.values.types || []).indexOf(t.id) >= 0;
            return h('div', { className: 'checks__row', key: t.id },
              h(V.Checkbox, {
                checked: picked, 'aria-label': t.name,
                onChange: function () { toggleType(t.id); }
              }),
              h('div', { className: 'checks__main' },
                h('span', { className: 'checks__name' }, t.name),
                h('span', { className: 'checks__meta' },
                  (t.annual ? t.annual + ' days a year' : 'Accrued, no fixed entitlement')
                  + ' · ' + (t.paid ? 'paid' : 'unpaid')
                  + (t.notice ? ' · ' + t.notice + ' day notice' : ''))),
              h(V.Chip, { size: 'sm', shape: 'tag' }, t.code));
          })),
          form.errors.types ? h('p', { style: { color: 'var(--danger-fg)', fontSize: 13 } }, form.errors.types) : null)) : null);
  }

  /* ============================================================ Shift dashboard
     PRD 4.23: coverage per shift, unassigned employees and open swap requests. */
  function ShiftsDashboard() {
    var shifts = store.collection('shifts');
    var assignments = store.collection('shiftAssignments');
    var swaps = store.collection('shiftSwaps');
    var today = seed.todayIso;

    var todays = assignments.filter(function (a) { return a.date === today; });
    var coverage = shifts.map(function (s) {
      return [s.name, todays.filter(function (a) { return a.shift === s.id; }).length, s.night ? 'warning' : 'success'];
    });
    var assignedToday = {};
    todays.forEach(function (a) { assignedToday[a.employee] = true; });
    var unassigned = workforce().filter(function (e) { return !assignedToday[e.id]; });
    var openSwaps = swaps.filter(function (x) { return x.status === 'Pending Approval'; });

    var byShiftHeadcount = shifts.map(function (s) {
      return [s.name, workforce().filter(function (e) { return e.shift === s.id; }).length, 'info'];
    });

    return h(React.Fragment, null,
      h(ui.PageHead, {
        eyebrow: seed.todayLabel, title: 'Shift overview',
        description: todays.length + ' employees are rostered today across ' + shifts.length + ' shift templates.',
        actions: [
          h(V.Button, { key: 'a', variant: 'outline', iconStart: I.gantt, onClick: function () { router.go('hr/shifts/roster'); } }, 'Open roster'),
          h(V.Button, { key: 'b', variant: 'primary', iconStart: I.plus, onClick: function () { router.go('hr/shifts/templates'); } }, 'Shift templates')
        ]
      }),

      h(Stats, null,
        h(Stat, { label: 'Shift templates', value: shifts.length, sub: shifts.filter(function (s) { return s.night; }).length + ' night shift' }),
        h(Stat, { label: 'Rostered today', value: todays.length, sub: ui.pct(todays.length, workforce().length) + '% of the workforce' }),
        h(Stat, { label: 'Unassigned today', value: unassigned.length, sub: 'Weekly off or no roster row',
          tone: unassigned.length ? 'warn' : 'good' }),
        h(Stat, { label: 'Open swap requests', value: openSwaps.length, sub: 'Awaiting a decision',
          tone: openSwaps.length ? 'warn' : 'good', onClick: function () { router.go('hr/shifts/swaps'); } })),

      h(Grid, null,
        h(Card, { span: 6, title: 'Coverage today', description: 'Published roster rows per shift for ' + seed.todayLabel + '.' },
          h(ui.Bars, { rows: coverage })),
        h(Card, { span: 6, title: 'Default shift assignment', description: 'The shift each employee record carries (PRD 4.21).' },
          h(ui.Bars, { rows: byShiftHeadcount })),

        h(Card, { span: 7, title: 'Shift timings', description: 'Hours are computed from the timings and break (PRD 14.4).' },
          h('div', { className: 'list' }, shifts.map(function (s) {
            return h('div', { className: 'list__row', key: s.id },
              h('div', { className: 'list__main' },
                h('span', { className: 'list__title' }, s.name),
                h('span', { className: 'list__meta' },
                  s.start + ' – ' + s.end + ' · ' + s.breakMins + ' min break · ' + s.grace + ' min grace · ' + s.days)),
              s.night ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning', dot: true }, 'Night') : null,
              h(V.Chip, { size: 'sm', shape: 'tag' }, rules.shiftHours(s) + ' h'));
          }))),

        h(Card, {
          span: 5, title: 'Open swap requests',
          aside: h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', onClick: function () { router.go('hr/shifts/swaps'); } }, 'Decide')
        },
          openSwaps.length
            ? h('div', { className: 'list' }, openSwaps.map(function (x) {
                return h('div', { className: 'list__row', key: x.id },
                  h('div', { className: 'list__main' },
                    h('span', { className: 'list__title' }, empName(x.employee) + ' → ' + shiftName(x.to)),
                    h('span', { className: 'list__meta' }, ui.dateLabel(x.date) + ' · with ' + empName(x.with))),
                  h(ui.StatusChip, { status: x.status }));
              }))
            : h(ui.Empty, { icon: I.ok, title: 'No swaps waiting' }))));
  }

  /* ============================================================ Shift templates
     PRD 4.20: shift definitions with timing, break, grace period and night flag. */
  function ShiftTemplates() {
    var openSt = React.useState(false);
    var form = ui.useForm({ start: '09:00', end: '18:00', breakMins: 60, grace: 15, days: 'Mon–Fri', allowance: 0 });

    function save() {
      var res = form.submit(function (v) { return ui.report(act.createShift(v)); });
      if (res && res.ok) {
        openSt[1](false);
        form.reset({ start: '09:00', end: '18:00', breakMins: 60, grace: 15, days: 'Mon–Fri', allowance: 0 });
      }
    }

    var v = form.values;
    var previewable = /^\d{2}:\d{2}$/.test(v.start || '') && /^\d{2}:\d{2}$/.test(v.end || '') && v.start !== v.end;
    var previewHours = previewable ? rules.shiftHours({ start: v.start, end: v.end, breakMins: Number(v.breakMins) || 0 }) : null;

    var rows = store.collection('shifts');
    var headcount = {};
    workforce().forEach(function (e) { headcount[e.shift] = (headcount[e.shift] || 0) + 1; });

    return h(React.Fragment, null,
      h(Card, {
        title: 'Shift templates', description: 'Working hours per shift, with break, grace period and the night flag (PRD 4.20).',
        aside: h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus, onClick: function () { openSt[1](true); } }, 'Create shift')
      },
        h(ui.DataTable, {
          exportName: 'shift-templates', label: 'Shift templates', rows: rows, pageSize: 10,
          search: function (s) { return s.name + ' ' + s.code + ' ' + s.days; }, searchPlaceholder: 'Search shifts',
          columns: [
            { key: 'name', header: 'Shift', sortable: true,
              cell: function (s) {
                return h('span', { className: 'row gap-2' }, s.name,
                  s.night ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning', dot: true }, 'Night') : null);
              } },
            { key: 'code', header: 'Code', cell: function (s) { return h('span', { className: 'mono' }, s.code); } },
            { key: 'start', header: 'Timing', csv: function (s) { return s.start + '-' + s.end; },
              cell: function (s) { return h('span', { className: 'mono' }, s.start + ' – ' + s.end); } },
            { key: 'breakMins', header: 'Break', numeric: true, align: 'right', cell: function (s) { return s.breakMins + ' min'; } },
            { key: 'hours', header: 'Working hours', numeric: true, align: 'right', sortable: true,
              sortValue: function (s) { return rules.shiftHours(s); },
              csv: function (s) { return rules.shiftHours(s); },
              cell: function (s) { return h('strong', { style: { fontWeight: 500 } }, rules.shiftHours(s) + ' h'); } },
            { key: 'grace', header: 'Grace', numeric: true, align: 'right', cell: function (s) { return s.grace + ' min'; } },
            { key: 'days', header: 'Days' },
            { key: 'people', header: 'Employees', numeric: true, align: 'right',
              csv: function (s) { return headcount[s.id] || 0; },
              cell: function (s) { return headcount[s.id] || 0; } },
            { key: 'status', header: 'Status', cell: function (s) { return h(ui.StatusChip, { status: s.status || 'Active' }); } }
          ],
          emptyIcon: I.hourglass, emptyTitle: 'No shifts defined',
          emptyBody: 'A shift sets the working window every attendance record is measured against.',
          emptyActions: h(V.Button, { variant: 'primary', iconStart: I.plus, onClick: function () { openSt[1](true); } }, 'Create shift')
        })),

      openSt[0] ? h(ui.Modal, {
        title: 'Create shift', onClose: function () { openSt[1](false); },
        description: 'An end time before the start time is an overnight shift, which is legitimate (PRD 14.4).',
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { openSt[1](false); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: save }, 'Create shift'))
      },
        h(ui.FieldRow, null,
          h(V.TextField, Object.assign({ label: 'Shift name', required: true, placeholder: 'e.g. Late Evening Shift' }, form.field('name'))),
          h(V.TextField, Object.assign({ label: 'Shift code', required: true, placeholder: 'e.g. LEV',
            hint: form.errors.code || 'Must be unique across shifts' }, form.field('code')))),
        h(ui.FieldRow, null,
          h(V.TextField, Object.assign({ label: 'Start time', required: true, type: 'time', placeholder: 'HH:MM' }, form.field('start'))),
          h(V.TextField, Object.assign({ label: 'End time', required: true, type: 'time', placeholder: 'HH:MM' }, form.field('end')))),
        h(ui.FieldRow, { cols: 3 },
          h(V.NumberField, Object.assign({ label: 'Break (minutes)', min: 0, step: 15 }, form.field('breakMins', { number: true }))),
          h(V.NumberField, Object.assign({ label: 'Grace (minutes)', min: 0, step: 5,
            hint: 'Late is measured past this' }, form.field('grace', { number: true }))),
          h(V.NumberField, Object.assign({ label: 'Shift allowance (₹)', min: 0, step: 100 }, form.field('allowance', { number: true })))),
        h(V.Select, Object.assign({ label: 'Working days', options: ['Mon–Fri', 'Mon–Sat', 'All week', 'Rotational'] }, form.select('days'))),
        h(Card, { className: 'card--quiet', title: 'Computed hours' },
          previewable
            ? h(ui.KeyValue, { rows: [
                ['Window', v.start + ' – ' + v.end],
                ['Break', (Number(v.breakMins) || 0) + ' minutes'],
                ['Working hours', h('strong', null, previewHours + ' h')],
                ['Overnight', v.start > v.end ? 'Yes — the shift crosses midnight' : 'No']
              ]})
            : h('p', { className: 'muted', style: { fontSize: 13 } },
                'Enter a start and end time as HH:MM to see the computed working hours.'))) : null);
  }

  /* ================================================================== Roster
     PRD 4.21: the weekly roster, with bulk assignment across selected employees
     and selected days through actions.assignShift. */
  function ShiftRoster() {
    var weekSt = React.useState(0);
    var selSt = React.useState([]);
    var assignSt = React.useState(null);
    var deptSt = React.useState(''), locSt = React.useState('');
    var shiftPickSt = React.useState('sh-gen');
    var daysPickSt = React.useState([]);

    var start = mondayOf(addDays(seed.today, weekSt[0] * 7));
    var dates = [];
    for (var i = 0; i < 7; i++) dates.push(iso(addDays(start, i)));
    var hol = holidayMap();

    var assignments = store.collection('shiftAssignments').filter(function (a) {
      return dates.indexOf(a.date) >= 0;
    });
    var byEmployee = {};
    assignments.forEach(function (a) {
      byEmployee[a.employee] = byEmployee[a.employee] || {};
      byEmployee[a.employee][a.date] = a;
    });

    var people = workforce();
    if (deptSt[0]) people = people.filter(function (e) { return e.department === deptSt[0]; });
    if (locSt[0]) people = people.filter(function (e) { return e.location === locSt[0]; });
    var rows = people.map(function (e) {
      return { id: e.id, employee: e, assigned: byEmployee[e.id] || {} };
    });

    function openAssign(ids) {
      daysPickSt[1](dates.filter(function (d) { return !rules.isWeekend(new Date(d + 'T00:00')); }));
      shiftPickSt[1]('sh-gen');
      assignSt[1](ids);
    }
    function toggleDay(d) {
      var picked = daysPickSt[0];
      daysPickSt[1](picked.indexOf(d) >= 0 ? picked.filter(function (x) { return x !== d; }) : picked.concat([d]));
    }
    function saveAssign() {
      if (!daysPickSt[0].length) { ui.toast('Choose at least one day to assign', 'error'); return; }
      var res = ui.report(act.assignShift(assignSt[0], shiftPickSt[0], daysPickSt[0]));
      if (res && res.ok) { assignSt[1](null); selSt[1]([]); }
    }

    var columns = [{
      key: 'employee', header: 'Employee', sortable: true,
      sortValue: function (r) { return r.employee.name; }, csv: function (r) { return r.employee.name; },
      cell: function (r) { return h(ui.Person, { employee: r.employee, sub: deptName(r.employee.department) }); }
    }].concat(dates.map(function (d, idx) {
      var day = new Date(d + 'T00:00');
      return {
        key: 'd' + idx, align: 'center',
        header: WEEK[idx] + ' ' + day.getDate(),
        csv: function (r) { return r.assigned[d] ? (shiftOf(r.assigned[d].shift) || {}).code || '' : ''; },
        cell: function (r) {
          var a = r.assigned[d];
          if (a) {
            var s = shiftOf(a.shift);
            return h(V.Chip, {
              size: 'sm', shape: 'tag', variant: 'soft',
              tone: s && s.night ? 'warning' : 'info'
            }, s ? s.code : a.shift);
          }
          if (hol[d]) return h(V.Chip, { size: 'sm', shape: 'tag' }, 'Holiday');
          if (rules.isWeekend(day)) return h('span', { className: 'muted', style: { fontSize: 11 } }, 'Off');
          return h('span', { className: 'muted' }, '—');
        }
      };
    })).concat([{
      key: 'actions', header: '', align: 'right',
      cell: function (r) {
        return h(V.Button, {
          variant: 'ghost', className: 'vi-btn--sm',
          onClick: function () { openAssign([r.employee.id]); }
        }, 'Assign');
      }
    }]);

    var weekLabel = pretty(start) + ' → ' + pretty(addDays(start, 6));
    var holidaysThisWeek = dates.filter(function (d) { return hol[d]; });

    return h(React.Fragment, null,
      h(Stats, { cols: 3 },
        h(Stat, { label: 'Rows published', value: assignments.length, sub: 'For ' + weekLabel }),
        h(Stat, { label: 'Employees in view', value: rows.length, sub: 'After the department and location filters' }),
        h(Stat, {
          label: 'Selected', value: selSt[0].length, sub: selSt[0].length ? 'Ready for bulk assignment' : 'Tick rows to assign in bulk',
          tone: selSt[0].length ? 'good' : null
        })),

      h(Card, {
        title: 'Weekly roster', description: 'Assigning replaces any shift already published for that employee and date (PRD 14.4).',
        aside: h('div', { className: 'row gap-2' },
          h(V.IconButton, { icon: I.back, 'aria-label': 'Previous week', onClick: function () { weekSt[1](weekSt[0] - 1); } }),
          h(V.Button, { variant: 'outline', className: 'vi-btn--sm', disabled: weekSt[0] === 0, onClick: function () { weekSt[1](0); } }, 'This week'),
          h(V.IconButton, { icon: I.right, 'aria-label': 'Next week', onClick: function () { weekSt[1](weekSt[0] + 1); } }))
      },
        h('div', { className: 'row gap-2 wrap' },
          h(V.Chip, { size: 'sm', shape: 'tag', icon: I.calendar }, weekLabel),
          holidaysThisWeek.map(function (d) {
            return h(V.Chip, { key: d, size: 'sm', shape: 'tag', variant: 'soft', tone: 'info', dot: true },
              hol[d].name + ' · ' + ui.shortDate(d));
          })),
        h(ui.DataTable, {
          exportName: 'shift-roster-' + iso(start), label: 'Weekly roster', rows: rows, pageSize: 10,
          selection: 'multiple', selected: selSt[0], onSelectionChange: selSt[1],
          search: function (r) { return r.employee.name + ' ' + r.employee.id + ' ' + deptName(r.employee.department); },
          searchPlaceholder: 'Search by name, ID or department',
          filters: h(React.Fragment, null,
            h(ui.Filter, { label: 'Department', value: deptSt[0], onChange: deptSt[1], options: deptOptions() }),
            h(ui.Filter, { label: 'Location', value: locSt[0], onChange: locSt[1], options: locOptions() })),
          toolbar: h(V.Button, {
            variant: 'primary', className: 'vi-btn--sm', iconStart: I.relate,
            disabled: !selSt[0].length,
            onClick: function () { openAssign(selSt[0]); }
          }, selSt[0].length ? 'Assign ' + selSt[0].length + ' selected' : 'Assign selected'),
          columns: columns,
          emptyIcon: I.gantt, emptyTitle: 'No employees in this view',
          emptyBody: 'Clear the department or location filter to see the full roster.'
        })),

      assignSt[0] ? h(ui.Modal, {
        title: assignSt[0].length > 1 ? 'Assign a shift to ' + assignSt[0].length + ' employees' : 'Assign a shift',
        description: assignSt[0].length === 1 ? empName(assignSt[0][0]) + ' · ' + weekLabel : weekLabel,
        onClose: function () { assignSt[1](null); },
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { assignSt[1](null); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: saveAssign }, 'Save assignment'))
      },
        h(V.Select, {
          label: 'Shift', required: true, value: shiftPickSt[0], options: shiftOptions(),
          onChange: function (v) { shiftPickSt[1](v); }
        }),
        h(ui.FormSection, { title: 'Days', description: 'Weekends and holidays start unticked; tick them to roster coverage.' },
          h('div', { className: 'checks' }, dates.map(function (d, idx) {
            var day = new Date(d + 'T00:00');
            return h('div', { className: 'checks__row', key: d },
              h(V.Checkbox, {
                checked: daysPickSt[0].indexOf(d) >= 0, 'aria-label': pretty(day),
                onChange: function () { toggleDay(d); }
              }),
              h('div', { className: 'checks__main' },
                h('span', { className: 'checks__name' }, WEEK[idx] + ' · ' + pretty(day)),
                h('span', { className: 'checks__meta' },
                  hol[d] ? hol[d].name : rules.isWeekend(day) ? 'Weekly off' : 'Working day')),
              hol[d] ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info' }, 'Holiday') : null);
          }))),
        h('p', { className: 'muted', style: { fontSize: 12 } },
          (assignSt[0].length * daysPickSt[0].length) + ' roster row(s) will be written. '
          + 'An existing shift on the same date is replaced and reported in the result.')) : null);
  }

  /* ============================================================== Shift swaps
     PRD 4.22: the replacement employee and the manager both have to agree. */
  function ShiftSwaps() {
    var tabSt = React.useState('pending');
    var confirmSt = React.useState(null);

    var all = store.collection('shiftSwaps');
    var pending = all.filter(function (x) { return x.status === 'Pending Approval'; });
    var rows = tabSt[0] === 'pending' ? pending
      : tabSt[0] === 'actioned' ? all.filter(function (x) { return x.status !== 'Pending Approval'; })
        : all;

    function decide(id, decision) { ui.report(act.decideShiftSwap(id, decision)); }

    var columns = [
      { key: 'id', header: 'Request', width: 96, cell: function (x) { return h('span', { className: 'mono' }, x.id); } },
      { key: 'employee', header: 'Requested by', sortable: true,
        sortValue: function (x) { return empName(x.employee); }, csv: function (x) { return empName(x.employee); },
        cell: function (x) {
          var e = emp(x.employee);
          return e ? h(ui.Person, { employee: e, sub: deptName(e.department) }) : h('span', { className: 'muted' }, '—');
        } },
      { key: 'with', header: 'Replacement', csv: function (x) { return empName(x.with); },
        cell: function (x) {
          var e = emp(x.with);
          return e ? h(ui.Person, { employee: e, sub: shiftName(e.shift) }) : h('span', { className: 'muted' }, '—');
        } },
      { key: 'date', header: 'Date', sortable: true, cell: function (x) { return ui.dateLabel(x.date); } },
      { key: 'from', header: 'Swap', csv: function (x) { return shiftName(x.from) + ' to ' + shiftName(x.to); },
        cell: function (x) {
          return h('span', { className: 'row gap-2' },
            h(V.Chip, { size: 'sm', shape: 'tag' }, (shiftOf(x.from) || {}).code || '—'),
            h('span', { className: 'muted' }, '→'),
            h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info' }, (shiftOf(x.to) || {}).code || '—'));
        } },
      { key: 'reason', header: 'Reason' },
      { key: 'counterpartyAgreed', header: 'Counterparty', align: 'center',
        csv: function (x) { return x.counterpartyAgreed ? 'Agreed' : 'Not confirmed'; },
        cell: function (x) {
          return x.counterpartyAgreed
            ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'success', dot: true }, 'Agreed')
            : h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning', dot: true }, 'Not confirmed');
        } },
      { key: 'status', header: 'Status', cell: function (x) { return h(ui.StatusChip, { status: x.status }); } },
      { key: 'actions', header: '', align: 'right', cell: function (x) {
          if (x.status !== 'Pending Approval') return h('span', { className: 'muted', style: { fontSize: 12 } }, 'Decided');
          return h('span', { className: 'row gap-2', style: { justifyContent: 'flex-end' } },
            h(V.Button, { variant: 'outline', className: 'vi-btn--sm', onClick: function () { confirmSt[1]({ swap: x, decision: 'Rejected' }); } }, 'Reject'),
            h(V.Button, { variant: 'primary', className: 'vi-btn--sm', onClick: function () { confirmSt[1]({ swap: x, decision: 'Approved' }); } }, 'Approve'));
        } }
    ];

    return h(React.Fragment, null,
      h(Stats, { cols: 3 },
        h(Stat, { label: 'Pending swaps', value: pending.length, sub: 'Awaiting a manager decision', tone: pending.length ? 'warn' : 'good' }),
        h(Stat, { label: 'Approved', value: all.filter(function (x) { return x.status === 'Approved'; }).length, sub: 'Both rosters were rewritten' }),
        h(Stat, { label: 'Rejected', value: all.filter(function (x) { return x.status === 'Rejected'; }).length, sub: 'Rosters left unchanged' })),

      h(V.TabGroup, {
        value: tabSt[0], onChange: tabSt[1],
        items: [
          { value: 'pending', label: 'Pending', count: pending.length },
          { value: 'actioned', label: 'Actioned', count: all.length - pending.length },
          { value: 'all', label: 'All', count: all.length }
        ]
      }),

      h(Card, { title: 'Shift swap requests', description: 'Approving writes both halves of the swap into the roster (PRD 5.1).' },
        h(ui.DataTable, {
          exportName: 'shift-swaps', label: 'Shift swap requests', rows: rows, pageSize: 10,
          search: function (x) { return [x.id, empName(x.employee), empName(x.with), x.reason].join(' '); },
          searchPlaceholder: 'Search by request, employee or reason',
          columns: columns,
          emptyIcon: tabSt[0] === 'pending' ? I.ok : I.relate,
          emptyTitle: tabSt[0] === 'pending' ? 'No swap requests waiting' : 'No swap requests here',
          emptyBody: tabSt[0] === 'pending'
            ? 'Every swap request has been decided.'
            : 'Swap requests appear here once employees raise them from their own shifts screen.'
        })),

      confirmSt[0] ? h(ui.Confirm, {
        title: (confirmSt[0].decision === 'Approved' ? 'Approve' : 'Reject') + ' swap ' + confirmSt[0].swap.id + '?',
        body: confirmSt[0].decision === 'Approved'
          ? empName(confirmSt[0].swap.employee) + ' moves to ' + shiftName(confirmSt[0].swap.to) + ' on '
            + ui.dateLabel(confirmSt[0].swap.date) + ', and ' + empName(confirmSt[0].swap.with) + ' takes '
            + shiftName(confirmSt[0].swap.from) + '. Both roster rows are rewritten.'
          : 'The roster is left unchanged and both employees are notified.',
        confirmLabel: confirmSt[0].decision === 'Approved' ? 'Approve swap' : 'Reject swap',
        tone: confirmSt[0].decision === 'Approved' ? null : 'danger',
        onClose: function () { confirmSt[1](null); },
        onConfirm: function () { decide(confirmSt[0].swap.id, confirmSt[0].decision); }
      },
        !confirmSt[0].swap.counterpartyAgreed
          ? h('div', { className: 'ai-note' },
              h('span', { className: 'ai-note__mark' }, I.warn),
              h('div', { className: 'ai-note__body' },
                h('p', { className: 'ai-note__text' },
                  empName(confirmSt[0].swap.with) + ' has not confirmed this swap yet (PRD 4.22).')))
          : null) : null);
  }

  /* ========================================================== Holiday calendar
     PRD 4.11: the holiday calendar HR works from, including optional holidays.
     The global default lives on the admin side (admin/org/holidays). */
  function Holidays() {
    var typeSt = React.useState('');
    var today = seed.todayIso;

    var all = store.collection('holidays').slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var rows = all.map(function (hd, i) { return Object.assign({ id: hd.date + '-' + i }, hd); });
    if (typeSt[0]) rows = rows.filter(function (hd) { return hd.type === typeSt[0]; });

    var ahead = all.filter(function (hd) { return hd.date >= today; });
    var next = ahead[0];
    var optional = all.filter(function (hd) { return hd.type === 'Optional'; });
    var weekendClash = all.filter(function (hd) { return rules.isWeekend(new Date(hd.date + 'T00:00')); });

    var byMonth = {};
    all.forEach(function (hd) {
      var m = MONTHS[new Date(hd.date + 'T00:00').getMonth()];
      byMonth[m] = (byMonth[m] || 0) + 1;
    });

    return h(React.Fragment, null,
      h(Stats, null,
        h(Stat, { label: 'Holidays this year', value: all.length, sub: optional.length + ' of them optional' }),
        h(Stat, { label: 'Still ahead', value: ahead.length, sub: next ? 'Next: ' + next.name : 'None left this year' }),
        h(Stat, {
          label: 'Falling on a weekly off', value: weekendClash.length,
          sub: 'Not deducted from leave either way', tone: weekendClash.length ? 'warn' : 'good'
        }),
        h(Stat, { label: 'Locations covered', value: store.collection('locations').length, sub: 'All inherit the org calendar' })),

      h(Grid, null,
        h(Card, {
          span: 8, title: 'Holiday calendar',
          description: 'A holiday is excluded when leave days are counted, per PRD 14.2. Optional holidays are not.',
          aside: h('div', { className: 'row gap-2' },
            h(ui.Filter, { label: 'Type', value: typeSt[0], onChange: typeSt[1], options: ['National', 'Public', 'Optional'] }),
            h(V.Button, {
              variant: 'outline', className: 'vi-btn--sm', iconStart: I.sitemap,
              onClick: function () { router.goAs('admin/org/holidays'); }
            }, 'Org default'))
        },
          h(ui.DataTable, {
            exportName: 'hr-holidays', label: 'Holiday calendar', rows: rows, pageSize: 15,
            search: function (hd) { return hd.name + ' ' + hd.type; }, searchPlaceholder: 'Search holidays',
            columns: [
              { key: 'date', header: 'Date', sortable: true, cell: function (hd) { return ui.dateLabel(hd.date); } },
              { key: 'day', header: 'Day', csv: function (hd) { return DAY_NAMES[new Date(hd.date + 'T00:00').getDay()]; },
                cell: function (hd) {
                  var d = new Date(hd.date + 'T00:00');
                  return rules.isWeekend(d)
                    ? h('span', { className: 'muted' }, DAY_NAMES[d.getDay()] + ' · weekly off')
                    : DAY_NAMES[d.getDay()];
                } },
              { key: 'name', header: 'Holiday', sortable: true },
              { key: 'type', header: 'Type',
                cell: function (hd) {
                  return h(V.Chip, {
                    size: 'sm', shape: 'tag',
                    variant: hd.type === 'Optional' ? 'outline' : 'soft',
                    tone: hd.type === 'Optional' ? 'neutral' : 'info'
                  }, hd.type);
                } },
              { key: 'counted', header: 'Leave counting', csv: function (hd) { return hd.type === 'Optional' ? 'Counted' : 'Excluded'; },
                cell: function (hd) {
                  return hd.type === 'Optional'
                    ? h('span', { className: 'muted' }, 'Counted as a working day')
                    : h('span', null, 'Excluded from leave days');
                } },
              { key: 'passed', header: '', align: 'right',
                cell: function (hd) {
                  return hd.date < today
                    ? h('span', { className: 'muted', style: { fontSize: 12 } }, 'Passed')
                    : h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'success' }, 'Upcoming');
                } }
            ],
            emptyIcon: I.star, emptyTitle: 'No holidays match this filter',
            emptyBody: 'Clear the type filter to see the whole calendar.'
          })),

        h(Card, { span: 4, title: 'Next holidays' },
          ahead.length
            ? h('div', { className: 'list' }, ahead.slice(0, 6).map(function (hd) {
                var d = new Date(hd.date + 'T00:00');
                return h('div', { className: 'list__row', key: hd.date },
                  h('div', { className: 'list__main' },
                    h('span', { className: 'list__title' }, hd.name),
                    h('span', { className: 'list__meta' }, pretty(d) + ' · ' + DAY_NAMES[d.getDay()])),
                  h(V.Chip, {
                    size: 'sm', shape: 'tag',
                    variant: hd.type === 'Optional' ? 'outline' : 'soft',
                    tone: hd.type === 'Optional' ? 'neutral' : 'info'
                  }, hd.type));
              }))
            : h(ui.Empty, { icon: I.star, title: 'No holidays left this year' })),

        h(Card, { span: 4, title: 'Holidays by month' },
          h(ui.Bars, { rows: MONTHS.filter(function (m) { return byMonth[m]; }).map(function (m) { return [m, byMonth[m], 'info']; }) })),

        h(Card, { span: 8, title: 'How the calendar is applied' },
          h(ui.KeyValue, { columns: true, rows: [
            ['Scope', 'Organization-wide, inherited by every location'],
            ['Optional holidays', optional.length + ' a year, employee’s choice'],
            ['Leave counting', 'National and public holidays are excluded (PRD 14.2)'],
            ['Weekly offs', 'Saturday and Sunday'],
            ['Attendance', 'A holiday is not marked absent'],
            ['Payroll', 'Holidays are payable days']
          ]}))));
  }

  /* ====================================================== Leave configuration
     PRD 4.11: types, entitlement, accrual, carry forward and approval levels. */
  function ConfigLeave() {
    var types = store.collection('leaveTypes');
    var policies = store.collection('leavePolicies');

    return h(Grid, null,
      h(Card, {
        span: 12, title: 'Leave types and entitlement',
        description: 'The rule set each type carries. Create and edit them on the Leave types screen (PRD 4.11).',
        aside: h('div', { className: 'row gap-2' },
          h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.sliders, onClick: function () { router.go('hr/leave/policies'); } }, 'Policies'),
          h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus, onClick: function () { router.go('hr/leave/types'); } }, 'Leave types'))
      },
        h(ui.DataTable, {
          exportName: 'config-leave-types', label: 'Leave configuration', rows: types, pageSize: 10, onExport: true,
          search: function (t) { return t.name + ' ' + t.code; }, searchPlaceholder: 'Search leave types',
          columns: [
            { key: 'name', header: 'Leave type', sortable: true },
            { key: 'code', header: 'Code', cell: function (t) { return h('span', { className: 'mono' }, t.code); } },
            { key: 'annual', header: 'Annual', numeric: true, align: 'right',
              cell: function (t) { return t.annual ? t.annual + ' days' : h('span', { className: 'muted' }, 'Accrued'); } },
            { key: 'accrual', header: 'Accrual', csv: function (t) { return t.annual ? 'Monthly' : 'On event'; },
              cell: function (t) { return t.annual ? 'Monthly, ' + Math.round((t.annual / 12) * 100) / 100 + ' days' : 'On event'; } },
            { key: 'carry', header: 'Carry forward', csv: function (t) { return t.carry ? 'Yes, up to ' + (t.maxAccrual || 0) : 'No'; },
              cell: function (t) {
                return t.carry
                  ? h('span', null, 'Up to ' + (t.maxAccrual || 0) + ' days')
                  : h('span', { className: 'muted' }, 'Lapses at year end');
              } },
            { key: 'notice', header: 'Notice', numeric: true, align: 'right',
              cell: function (t) { return t.notice ? t.notice + ' days' : h('span', { className: 'muted' }, 'None'); } },
            { key: 'approval', header: 'Approval levels',
              csv: function (t) { return t.annual > 100 ? 'Manager then HR' : 'Manager'; },
              cell: function (t) {
                return h(V.Chip, { size: 'sm', shape: 'tag' }, t.annual > 100 ? 'Manager → HR' : 'Manager');
              } },
            { key: 'policies', header: 'In policies', numeric: true, align: 'right',
              csv: function (t) { return policies.filter(function (p) { return p.types.indexOf(t.id) >= 0; }).length; },
              cell: function (t) { return policies.filter(function (p) { return p.types.indexOf(t.id) >= 0; }).length; } }
          ],
          emptyIcon: I.calendar, emptyTitle: 'No leave types configured',
          emptyBody: 'Create a leave type before assigning it to a policy.'
        })),

      h(Card, { span: 6, title: 'Leave year and accrual' },
        h(ui.KeyValue, { rows: [
          ['Leave year', '1 January – 31 December'],
          ['Accrual frequency', 'Monthly, credited on the first'],
          ['Accrual on joining', 'Pro-rated from the joining date'],
          ['Carry forward cap', 'Per leave type, up to its maximum accrual'],
          ['Encashment', 'Earned leave only, at exit'],
          ['Negative balance', 'Not permitted (PRD 14.2)']
        ]}),
        h('p', { className: 'muted', style: { fontSize: 12 } },
          'Days are counted excluding weekly offs and holidays, which is why a five-day range can be three leave days.')),

      h(Card, { span: 6, title: 'Options' },
        h('div', { className: 'checks' },
          [['Exclude weekly offs from leave days', true],
            ['Exclude holidays from leave days', true],
            ['Allow half-day applications', true],
            ['Require a reason on every application', true],
            ['Let managers approve their own team’s leave', true],
            ['Allow backdated applications', false]].map(function (row) {
            return h('div', { className: 'checks__row', key: row[0] },
              h(V.Switch, {
                defaultChecked: row[1], 'aria-label': row[0],
                onChange: function (e) { ui.toast(row[0] + ' ' + (e.target.checked ? 'enabled' : 'disabled'), 'success'); }
              }),
              h('div', { className: 'checks__main' }, h('span', { className: 'checks__name' }, row[0])));
          }))));
  }

  /* ================================================= Attendance configuration
     PRD 4.16: working hours, grace period, late and overtime rules. */
  function ConfigAttendance() {
    var shifts = store.collection('shifts');
    return h(Grid, null,
      h(Card, { span: 6, title: 'Working hours' },
        h(ui.KeyValue, { rows: [
          ['Hours per day', '9, including a 1 hour break'],
          ['Standard window', '09:00 – 18:00'],
          ['Work week', seed.org.workWeek.join(', ')],
          ['Half day threshold', '4 worked hours'],
          ['Full day threshold', '8 worked hours'],
          ['Time zone', seed.org.timezone]
        ]}),
        h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.clock,
          onClick: function () { router.go('hr/attendance/policies'); } }, 'Attendance policies')),

      h(Card, { span: 6, title: 'Late, overtime and corrections' },
        h(ui.KeyValue, { rows: [
          ['Grace period', 'Per shift, 10 to 60 minutes'],
          ['Late marking', 'Automatic past the grace period'],
          ['Three lates', 'Counted as a half day'],
          ['Overtime threshold', 'Beyond 9.5 worked hours'],
          ['Overtime treatment', 'Compensatory off, or paid for shift staff'],
          ['Correction window', 'The last 30 days (PRD 14.3)']
        ]})),

      h(Card, { span: 12, title: 'Grace period by shift', description: 'Late is measured against the shift start plus this value.' },
        h(ui.DataTable, {
          exportName: 'config-attendance-grace', label: 'Grace period by shift', rows: shifts, pageSize: 10,
          search: function (s) { return s.name + ' ' + s.code; }, searchPlaceholder: 'Search shifts',
          columns: [
            { key: 'name', header: 'Shift', sortable: true },
            { key: 'start', header: 'Starts', cell: function (s) { return h('span', { className: 'mono' }, s.start); } },
            { key: 'grace', header: 'Grace', numeric: true, align: 'right', sortable: true, cell: function (s) { return s.grace + ' min'; } },
            { key: 'lateAfter', header: 'Marked late after',
              csv: function (s) { return s.grace + ' min past ' + s.start; },
              cell: function (s) {
                var mins = Number(s.start.slice(0, 2)) * 60 + Number(s.start.slice(3)) + s.grace;
                var at = String(Math.floor(mins / 60) % 24).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
                return h('span', { className: 'mono' }, at);
              } },
            { key: 'hours', header: 'Working hours', numeric: true, align: 'right',
              csv: function (s) { return rules.shiftHours(s); },
              cell: function (s) { return rules.shiftHours(s) + ' h'; } },
            { key: 'night', header: 'Night shift', align: 'center', csv: function (s) { return s.night ? 'Yes' : 'No'; },
              cell: function (s) {
                return s.night
                  ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning', dot: true }, 'Yes')
                  : h('span', { className: 'muted' }, 'No');
              } }
          ],
          emptyIcon: I.hourglass, emptyTitle: 'No shifts configured',
          emptyBody: 'Define a shift before the grace period can be applied.'
        })),

      h(Card, { span: 12, title: 'Options' },
        h('div', { className: 'checks' },
          [['Capture the punch source (biometric, web, mobile)', true],
            ['Allow web check-in', true],
            ['Allow mobile check-in with location', true],
            ['Auto-mark absent with no punch by end of day', true],
            ['Let employees see their own monthly grid', true],
            ['Notify the manager on a missing punch', true]].map(function (row) {
            return h('div', { className: 'checks__row', key: row[0] },
              h(V.Switch, {
                defaultChecked: row[1], 'aria-label': row[0],
                onChange: function (e) { ui.toast(row[0] + ' ' + (e.target.checked ? 'enabled' : 'disabled'), 'success'); }
              }),
              h('div', { className: 'checks__main' }, h('span', { className: 'checks__name' }, row[0])));
          }))));
  }

  /* ====================================================== Shift configuration
     PRD 4.20: shift templates, rotation patterns and swap rules. */
  var ROTATIONS = [
    { id: 'rot-week', name: 'Weekly rotation', pattern: 'Morning → Evening → Night, changing every Monday', cycle: '3 weeks', appliesTo: 'Operations' },
    { id: 'rot-fort', name: 'Fortnightly rotation', pattern: 'Morning → Evening, changing on alternate Mondays', cycle: '2 weeks', appliesTo: 'Support' },
    { id: 'rot-fixed', name: 'Fixed general shift', pattern: 'General shift, Monday to Friday', cycle: 'None', appliesTo: 'Everyone else' }
  ];

  function ConfigShifts() {
    var shifts = store.collection('shifts');
    return h(Grid, null,
      h(Card, {
        span: 12, title: 'Shift templates',
        description: 'Working hours are computed from the timing and break, so an overnight shift needs no special case (PRD 14.4).',
        aside: h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus,
          onClick: function () { router.go('hr/shifts/templates'); } }, 'Manage shifts')
      },
        h(ui.DataTable, {
          exportName: 'config-shifts', label: 'Shift configuration', rows: shifts, pageSize: 10,
          search: function (s) { return s.name + ' ' + s.code + ' ' + s.days; }, searchPlaceholder: 'Search shifts',
          columns: [
            { key: 'name', header: 'Shift', sortable: true },
            { key: 'code', header: 'Code', cell: function (s) { return h('span', { className: 'mono' }, s.code); } },
            { key: 'start', header: 'Timing', csv: function (s) { return s.start + '-' + s.end; },
              cell: function (s) { return h('span', { className: 'mono' }, s.start + ' – ' + s.end); } },
            { key: 'hours', header: 'Working hours', numeric: true, align: 'right',
              csv: function (s) { return rules.shiftHours(s); },
              cell: function (s) { return rules.shiftHours(s) + ' h'; } },
            { key: 'breakMins', header: 'Break', numeric: true, align: 'right', cell: function (s) { return s.breakMins + ' min'; } },
            { key: 'days', header: 'Days' },
            { key: 'night', header: 'Night', align: 'center', csv: function (s) { return s.night ? 'Yes' : 'No'; },
              cell: function (s) {
                return s.night
                  ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning', dot: true }, 'Night')
                  : h('span', { className: 'muted' }, '—');
              } },
            { key: 'status', header: 'Status', cell: function (s) { return h(ui.StatusChip, { status: s.status || 'Active' }); } }
          ],
          emptyIcon: I.hourglass, emptyTitle: 'No shifts configured',
          emptyBody: 'Create a shift template to start rostering.'
        })),

      h(Card, { span: 7, title: 'Rotation patterns', description: 'How a rostered group moves between shifts (PRD 4.21).' },
        h('div', { className: 'list' }, ROTATIONS.map(function (rt) {
          return h('div', { className: 'list__row', key: rt.id },
            h('div', { className: 'list__main' },
              h('span', { className: 'list__title' }, rt.name),
              h('span', { className: 'list__meta' }, rt.pattern)),
            h(V.Chip, { size: 'sm', shape: 'tag' }, rt.cycle),
            h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info' }, rt.appliesTo));
        })),
        h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.gantt,
          onClick: function () { router.go('hr/shifts/roster'); } }, 'Open the roster')),

      h(Card, { span: 5, title: 'Swap rules' },
        h(ui.KeyValue, { rows: [
          ['Who may request', 'Any rostered employee'],
          ['Notice', 'The swap date must be in the future'],
          ['Counterparty', 'Must agree before approval (PRD 4.22)'],
          ['Approver', 'The reporting manager'],
          ['On approval', 'Both roster rows are rewritten'],
          ['Conflicts', 'An existing shift on the date is replaced']
        ]}),
        h('div', { className: 'checks' },
          [['Require the counterparty to agree first', true],
            ['Allow swaps between different shifts', true],
            ['Publish the roster to employees', true]].map(function (row) {
            return h('div', { className: 'checks__row', key: row[0] },
              h(V.Switch, {
                defaultChecked: row[1], 'aria-label': row[0],
                onChange: function (e) { ui.toast(row[0] + ' ' + (e.target.checked ? 'enabled' : 'disabled'), 'success'); }
              }),
              h('div', { className: 'checks__main' }, h('span', { className: 'checks__name' }, row[0])));
          }))));
  }

  /* ---------------------------------------------------------------- Register */
  HRMS.screens.register({
    'hr/attendance/dashboard': AttendanceDashboard,
    'hr/attendance/daily': AttendanceDaily,
    'hr/attendance/monthly': AttendanceMonthly,
    'hr/attendance/regularization': AttendanceRegularization,
    'hr/attendance/policies': AttendancePolicies,

    'hr/leave/dashboard': LeaveDashboard,
    'hr/leave/requests': LeaveRequests,
    'hr/leave/calendar': LeaveCalendar,
    'hr/leave/balances': LeaveBalances,
    'hr/leave/types': LeaveTypes,
    'hr/leave/policies': LeavePolicies,

    'hr/shifts/dashboard': ShiftsDashboard,
    'hr/shifts/templates': ShiftTemplates,
    'hr/shifts/roster': ShiftRoster,
    'hr/shifts/swaps': ShiftSwaps,

    'hr/holidays': Holidays,

    'hr/config/leave': ConfigLeave,
    'hr/config/attendance': ConfigAttendance,
    'hr/config/shifts': ConfigShifts
  });
})();

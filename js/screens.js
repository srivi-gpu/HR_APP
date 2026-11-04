/* Screens. A route that is built resolves to a component here; every other route in the
   IA falls through to ui.Stub, which names the screen and its PRD section.

   Built in this slice: the three dashboards (PRD 9), the approval inbox (6.5), the
   notification centre (7), the roles and permissions screens (10) and the global
   screens (11.1). */
(function () {
  var HRMS = (window.HRMS = window.HRMS || {});
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var store = HRMS.store, router = HRMS.router, ui = HRMS.ui, seed = HRMS.seed, perms = HRMS.permissions;
  var Card = ui.Card, Stat = ui.Stat, Stats = ui.Stats, Grid = ui.Grid, PageHead = ui.PageHead;

  function emp(id) { return store.employee(id); }
  function who(name) { return store.employeeByName(name); }
  function deptName(id) { var d = store.department(id); return d ? d.name : '—'; }
  function locName(id) { var l = store.location(id); return l ? l.name : '—'; }

  var Bars = ui.Bars, relTime = ui.relTime;

  /* ============================================================ ADMIN HOME */
  function AdminDashboard() {
    var s = store.stats();
    var sub = seed.subscription, ai = seed.aiUsage;
    var done = seed.setupSteps.filter(function (x) { return x.done; }).length;
    var setupPct = ui.pct(done, seed.setupSteps.length);
    var seatPct = ui.pct(sub.seatsUsed, sub.seats);
    var aiPct = ui.pct(ai.used, ai.credits);

    var alerts = [
      { tone: 'warning', title: s.invited + ' invitations unaccepted', body: 'Sent more than five days ago. Resend or revoke from User management.', to: 'admin/users/pending' },
      { tone: 'warning', title: (seed.setupSteps.length - done) + ' setup steps remaining', body: seed.setupSteps.filter(function (x) { return !x.done; }).map(function (x) { return x.label; }).join(', ') + '.', to: 'admin/org/settings' },
      { tone: 'info', title: 'Single sign-on not configured', body: 'Everyone signs in with email and password only.', to: 'admin/settings/auth' },
      { tone: 'info', title: 'Seat usage at ' + seatPct + '%', body: sub.seatsUsed + ' of ' + sub.seats + ' seats used on the ' + sub.plan + ' plan.', to: 'admin/billing/seats' }
    ];

    return h(React.Fragment, null,
      h(PageHead, {
        eyebrow: seed.todayLabel, title: 'Organization overview',
        description: seed.org.name + ' · ' + seed.org.industry + ' · ' + s.locations + ' locations under ' + s.entities + ' legal entity.',
        actions: [
          h(V.Button, { key: 'a', variant: 'outline', iconStart: I.download }, 'Export'),
          h(V.Button, { key: 'b', variant: 'primary', iconStart: I.plus, onClick: function () { router.go('admin/users/pending'); } }, 'Invite user')
        ]
      }),

      h(Stats, null,
        h(Stat, { label: 'Total employees', value: s.headcount, sub: s.newJoiners + ' joined this month', tone: 'good' }),
        h(Stat, { label: 'Active users', value: s.active, sub: s.invited + ' invitations pending', tone: s.invited ? 'warn' : null }),
        h(Stat, { label: 'Locations', value: s.locations, sub: seed.locations.map(function (l) { return l.name; }).join(', ') }),
        h(Stat, { label: 'Setup completion', value: setupPct, unit: '%', sub: done + ' of ' + seed.setupSteps.length + ' steps done', tone: setupPct === 100 ? 'good' : 'warn' })),

      h(Grid, null,
        h(Card, { span: 5, title: 'Organization setup',
          aside: h('span', { className: 'row gap-2' },
            h(V.Chip, { size: 'sm', shape: 'tag' }, done + '/' + seed.setupSteps.length),
            h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', onClick: function () { router.go('global/setup'); } }, 'Open wizard')) },
          h(V.ProgressBar, { value: setupPct, showValue: true }),
          h('div', { className: 'steps' }, seed.setupSteps.map(function (st) {
            return h('div', { key: st.label, className: 'steps__row' + (st.done ? ' is-done' : '') },
              h('span', { className: 'steps__tick' }, I.check), h('span', null, st.label));
          }))),

        h(Card, { span: 7, title: 'Subscription & AI usage' },
          h(ui.KeyValue, { rows: [
            ['Plan', h('span', { className: 'row gap-2' }, sub.plan + ' · ' + sub.cycle, h(ui.StatusChip, { status: sub.status }))],
            ['Seats', sub.seatsUsed + ' of ' + sub.seats + ' used'],
            ['Renews on', sub.renewsLabel],
            ['Annual value', ui.inr(sub.amount)]
          ]}),
          h(V.ProgressBar, { label: 'Seat utilisation', value: seatPct, showValue: true, tone: seatPct > 90 ? 'warning' : 'info' }),
          h(V.ProgressBar, { label: 'AI credits consumed', value: aiPct, showValue: true, tone: aiPct > 80 ? 'warning' : 'primary' }),
          h('div', { style: { marginTop: 4 } }, h(Bars, { rows: ai.byModule.slice(0, 5).map(function (m) { return [m.module, m.credits]; }) }))),

        h(Card, { span: 7, title: 'Recent activity',
          aside: h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', onClick: function () { router.go('admin/audit/activity'); } }, 'View audit log') },
          h('div', { className: 'list' }, seed.audit.slice(0, 6).map(function (a) {
            var actor = emp(a.actor);
            return h('div', { className: 'list__row', key: a.id },
              h(V.Avatar, { name: actor.name, size: 'sm' }),
              h('div', { className: 'list__main' },
                h('span', { className: 'list__title' }, h('strong', { style: { fontWeight: 500 } }, actor.name), ' ', a.action),
                h('span', { className: 'list__meta' }, a.category + ' · ' + relTime(a.on))));
          }))),

        h(Card, { span: 5, title: 'Attention needed' },
          h('div', { className: 'list' }, alerts.map(function (al, i) {
            return h('div', { className: 'list__row', key: i },
              h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: al.tone, dot: true }, al.tone === 'warning' ? 'Review' : 'Info'),
              h('div', { className: 'list__main' },
                h('span', { className: 'list__title' }, al.title),
                h('span', { className: 'list__meta' }, al.body)),
              h(V.IconButton, { icon: I.right, 'aria-label': 'Open: ' + al.title, onClick: function () { router.go(al.to); } }));
          })))));
  }

  /* =============================================================== HR HOME */
  function HrDashboard() {
    var s = store.stats();
    var me = store.persona('hr');
    var approvals = store.collection('approvals').filter(function (a) { return a.status === 'Pending Approval'; });
    var cycle = seed.payrollCycles[0];

    var deptRows = seed.departments.map(function (d) { return [d.name, d.headcount]; })
      .sort(function (a, b) { return b[1] - a[1]; });
    var attRows = [
      ['Present', s.present - s.wfh], ['Work from home', s.wfh], ['On leave', s.onLeaveToday],
      ['Absent', s.absent], ['Missing punch', s.missingPunch]
    ].filter(function (x) { return x[1] > 0; });

    var openOnb = store.collection('onboarding').filter(function (o) { return o.stage !== 'Completed'; });
    var openExits = store.collection('offboarding').filter(function (o) { return o.stage === 'Notice Period'; });

    return h(React.Fragment, null,
      h(PageHead, {
        eyebrow: seed.todayLabel, title: 'Good morning, ' + me.name.split(' ')[0],
        description: s.pendingApprovals + ' requests are waiting on you, and November payroll is open for review.',
        actions: [
          h(V.Button, { key: 'a', variant: 'outline', iconStart: I.download }, 'Export'),
          h(V.Button, { key: 'b', variant: 'primary', iconStart: I.plus, onClick: function () { router.go('hr/people/all'); } }, 'Add employee')
        ]
      }),

      h(Stats, null,
        h(Stat, { label: 'Headcount', value: s.headcount, sub: s.newJoiners + ' joined this month', tone: 'good' }),
        h(Stat, { label: 'On leave today', value: s.onLeaveToday, sub: s.absent + ' absent, ' + s.wfh + ' from home', tone: s.absent ? 'warn' : null }),
        h(Stat, { label: 'Attendance today', value: ui.pct(s.present + s.wfh, s.headcount), unit: '%', sub: s.late + ' late arrivals', tone: s.late > 8 ? 'warn' : 'good' }),
        h(Stat, { label: 'Open approvals', value: s.pendingApprovals, sub: s.pendingLeave + ' leave, ' + s.pendingRegs + ' regularization, ' + s.pendingAssetRequests + ' asset', tone: 'warn' })),

      h('div', { className: 'ai-note' },
        h('span', { className: 'ai-note__mark' }, I.leo),
        h('div', { className: 'ai-note__body' },
          h('span', { className: 'ai-note__eyebrow' }, 'Assistant'),
          h('p', { className: 'ai-note__text' },
            'Diwali falls on 8 and 9 November, two weeks before the payroll cut-off on the 25th. ' +
            s.pendingLeave + ' leave requests are still pending and ' + s.pendingOnboardingTasks +
            ' onboarding tasks are open across ' + openOnb.length + ' new joiners.'),
          h('div', { className: 'ai-note__acts' },
            h(V.Button, { variant: 'primary', className: 'vi-btn--sm', onClick: function () { router.go('hr/approvals'); } }, 'Review approvals'),
            h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', onClick: function () { router.go('hr/payroll/cycles'); } }, 'Open payroll')))),

      h(Grid, null,
        h(Card, { span: 7, title: 'Pending approvals',
          aside: h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', onClick: function () { router.go('hr/approvals'); } }, 'Open inbox') },
          approvals.length
            ? h('div', { className: 'list scroll-320' }, approvals.slice(0, 8).map(function (a) {
                var person = emp(a.employee);
                return h('div', { className: 'list__row', key: a.id },
                  h(V.Avatar, { name: person.name, size: 'sm' }),
                  h('div', { className: 'list__main' },
                    h('span', { className: 'list__title' }, person.name, ' · ', a.kind),
                    h('span', { className: 'list__meta' }, a.detail + ' · ' + relTime(a.submitted))),
                  h(V.Button, { variant: 'outline', className: 'vi-btn--sm', onClick: function () { router.go('hr/approvals'); } }, 'Review'));
              }))
            : h(ui.Empty, { icon: I.ok, title: 'Nothing waiting', body: 'Every request has been actioned.' })),

        h(Card, { span: 5, title: 'Attendance today' },
          h(Bars, { rows: attRows }),
          h('div', { style: { marginTop: 8 } },
            h(V.ProgressBar, { label: 'Marked present', value: ui.pct(s.present + s.wfh, s.headcount), showValue: true, tone: 'success' })),
          s.missingPunch ? h(V.Button, {
            variant: 'outline', className: 'vi-btn--sm', iconStart: I.warn,
            onClick: function () { router.go('hr/attendance/regularization'); }
          }, s.missingPunch + ' missing punches · ' + s.pendingRegs + ' corrections pending') : null),

        h(Card, { span: 4, title: 'Payroll status' },
          h(ui.KeyValue, { rows: [
            ['Period', cycle.period],
            ['Status', h(ui.StatusChip, { status: cycle.status })],
            ['Employees', cycle.employees],
            ['Gross', ui.inr(cycle.gross, { short: true })],
            ['Net payable', ui.inr(cycle.net, { short: true })],
            ['Cut-off', '25 Nov 2026']
          ]}),
          h(V.Button, { variant: 'primary', className: 'vi-btn--sm', onClick: function () { router.go('hr/payroll/processing'); } }, 'Review payroll')),

        h(Card, { span: 4, title: 'Headcount by department' }, h(Bars, { rows: deptRows })),

        h(Card, { span: 4, title: 'Celebrations' },
          seed.birthdays.length || seed.anniversaries.length
            ? h('div', { className: 'list' },
                seed.birthdays.slice(0, 3).map(function (b) {
                  var person = emp(b.employee);
                  return h('div', { className: 'list__row', key: 'b' + b.employee },
                    h(V.Avatar, { name: person.name, size: 'sm' }),
                    h('div', { className: 'list__main' },
                      h('span', { className: 'list__title' }, person.name),
                      h('span', { className: 'list__meta' }, 'Birthday ' + (b.inDays === 0 ? 'today' : 'in ' + b.inDays + ' days'))),
                    h(V.Chip, { size: 'sm', shape: 'tag', icon: I.smile }, 'Birthday'));
                }),
                seed.anniversaries.slice(0, 3).map(function (a) {
                  var person = emp(a.employee);
                  return h('div', { className: 'list__row', key: 'a' + a.employee },
                    h(V.Avatar, { name: person.name, size: 'sm' }),
                    h('div', { className: 'list__main' },
                      h('span', { className: 'list__title' }, person.name),
                      h('span', { className: 'list__meta' }, a.years + ' years ' + (a.inDays === 0 ? 'today' : 'in ' + a.inDays + ' days'))),
                    h(V.Chip, { size: 'sm', shape: 'tag', icon: I.star }, 'Anniversary'));
                }))
            : h(ui.Empty, { icon: I.smile, title: 'Nothing in the next two weeks' })),

        h(Card, { span: 6, title: 'Onboarding in progress',
          aside: h(V.Chip, { size: 'sm', shape: 'tag' }, s.pendingOnboardingTasks + ' tasks open') },
          openOnb.length
            ? h('div', { className: 'list' }, openOnb.map(function (o) {
                var person = emp(o.employee);
                return h('div', { className: 'list__row', key: o.id },
                  h(V.Avatar, { name: person.name, size: 'sm' }),
                  h('div', { className: 'list__main' },
                    h('span', { className: 'list__title' }, person.name, ' · ', person.designation),
                    h('span', { className: 'list__meta' }, o.tasksDone + ' of ' + o.tasksTotal + ' tasks' + (o.overdue ? ' · ' + o.overdue + ' overdue' : ''))),
                  h(ui.StatusChip, { status: o.overdue ? 'Overdue' : o.stage }));
              }))
            : h(ui.Empty, { icon: I.person, title: 'No one is onboarding' })),

        h(Card, { span: 6, title: 'Upcoming exits', aside: h(V.Chip, { size: 'sm', shape: 'tag' }, openExits.length + ' in notice') },
          openExits.length
            ? h('div', { className: 'list' }, openExits.map(function (o) {
                var person = emp(o.employee);
                return h('div', { className: 'list__row', key: o.id },
                  h(V.Avatar, { name: person.name, size: 'sm' }),
                  h('div', { className: 'list__main' },
                    h('span', { className: 'list__title' }, person.name, ' · ', deptName(person.department)),
                    h('span', { className: 'list__meta' }, 'Last working day ' + o.lastWorkingDayLabel +
                      (o.assetsOutstanding ? ' · ' + o.assetsOutstanding + ' assets out' : ''))),
                  h('span', { style: { width: 90 } }, h(V.ProgressBar, { value: o.clearance, size: 'sm', 'aria-label': 'Clearance' })));
              }))
            : h(ui.Empty, { icon: I.logout, title: 'No exits in progress' }))));
  }

  /* ========================================================= EMPLOYEE HOME */
  function MeDashboard() {
    var me = store.persona('me');
    var shift = store.shift(me.shift);
    var balances = store.balancesFor(me.id);
    var punch = store.pref('punch') || {};
    var today = seed.todayIso;
    var inAt = punch.date === today ? punch.in : null;
    var outAt = punch.date === today ? punch.out : null;

    var clockSt = React.useState(new Date());
    React.useEffect(function () {
      var t = setInterval(function () { clockSt[1](new Date()); }, 1000);
      return function () { clearInterval(t); };
    }, []);
    function hhmm(d) { return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

    var myLeave = store.collection('leaveRequests').filter(function (l) { return l.employee === me.id; });
    var myPending = myLeave.filter(function (l) { return l.status === 'Pending Approval'; });
    var myAssets = store.collection('assets').filter(function (a) { return a.assignedTo === me.id; });
    var el = balances.filter(function (b) { return b.type === 'lt-el'; })[0] || { available: 0, entitled: 0 };
    var upcoming = seed.holidays.filter(function (x) { return x.date >= today; });
    var myAssessment = seed.assessments.filter(function (a) { return a.employee === me.id; })[0];

    var tasks = [
      { label: 'Acknowledge Information Security Policy v5.0', due: 'Due 15 Nov', tone: 'warning', to: 'me/documents/acknowledgements' },
      { label: 'Complete Q4 engagement pulse', due: 'Closes 14 Nov', tone: 'info', to: 'me/engagement/surveys' },
      { label: 'Submit tax declaration for FY 2026-27', due: 'Due 31 Dec', tone: 'neutral', to: 'me/payroll/tax' },
      { label: 'Self-appraisal for H2 FY2026', due: 'Opens 15 Nov', tone: 'neutral', to: 'me/performance/self' }
    ];

    function setPunch(next) {
      store.setPref('punch', Object.assign({ date: today }, punch.date === today ? punch : {}, next));
    }

    return h(React.Fragment, null,
      h(PageHead, {
        eyebrow: seed.todayLabel, title: 'Hello, ' + me.name.split(' ')[0],
        description: me.designation + ' · ' + deptName(me.department) + ' · ' + locName(me.location) + ' · ' + me.id,
        actions: [h(V.Button, { key: 'a', variant: 'outline', iconStart: I.calendar, onClick: function () { router.go('me/leave/apply'); } }, 'Apply for leave')]
      }),

      h(Stats, null,
        h(Stat, { label: 'Earned leave available', value: el.available, unit: 'of ' + el.entitled, sub: 'Accrues 1.5 days a month' }),
        h(Stat, { label: 'My shift', value: shift.start, unit: '– ' + shift.end, sub: shift.name + ' · ' + shift.days }),
        h(Stat, { label: 'Open requests', value: myPending.length, sub: myPending.length ? 'Awaiting approval' : 'Nothing pending', tone: myPending.length ? 'warn' : 'good' }),
        h(Stat, { label: 'Assets held', value: myAssets.length, sub: myAssets.length ? myAssets.map(function (a) { return a.category; }).slice(0, 2).join(', ') : 'None assigned' })),

      h(Grid, null,
        h(Card, { span: 5, title: "Today's attendance" },
          h('div', { className: 'punch' },
            h('span', { className: 'punch__clock' }, hhmm(clockSt[0])),
            h('div', { className: 'punch__meta' },
              h('span', null, 'Checked in', h('b', null, inAt || '—')),
              h('span', null, 'Checked out', h('b', null, outAt || '—')),
              h('span', null, 'Shift', h('b', null, shift.start + ' – ' + shift.end))),
            h('div', { className: 'row gap-2 wrap' },
              !inAt
                ? h(V.Button, { variant: 'primary', iconStart: I.play, onClick: function () { setPunch({ in: hhmm(new Date()) }); } }, 'Check in')
                : !outAt
                  ? h(V.Button, { variant: 'primary', iconStart: I.stop, onClick: function () { setPunch({ out: hhmm(new Date()) }); } }, 'Check out')
                  : h(V.Chip, { shape: 'tag', variant: 'soft', tone: 'success', dot: true }, 'Day complete'),
              h(V.Button, { variant: 'ghost', onClick: function () { router.go('me/attendance/regularization'); } }, 'Raise a correction')),
            inAt ? h('p', { className: 'muted', style: { fontSize: 12 } },
              'Saved in this browser, so it survives a reload. Reset prototype data from the profile menu to clear it.') : null)),

        h(Card, { span: 7, title: 'Leave balance',
          aside: h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', onClick: function () { router.go('me/leave/balance'); } }, 'View details') },
          h(V.Table, {
            density: 'compact',
            columns: [
              { key: 'type', header: 'Leave type', cell: function (x) { return store.leaveType(x.type).name; } },
              { key: 'entitled', header: 'Entitled', numeric: true, align: 'right' },
              { key: 'used', header: 'Used', numeric: true, align: 'right' },
              { key: 'available', header: 'Available', numeric: true, align: 'right',
                cell: function (x) { return h('strong', { style: { fontWeight: 500 } }, x.available); } }
            ],
            rows: balances.map(function (b, i) { return Object.assign({ id: i }, b); })
          })),

        h(Card, { span: 6, title: 'My tasks', aside: h(V.Chip, { size: 'sm', shape: 'tag' }, tasks.length + ' open') },
          h('div', { className: 'list' }, tasks.map(function (t) {
            return h('div', { className: 'list__row', key: t.label },
              h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: t.tone, dot: true }, t.due),
              h('div', { className: 'list__main' }, h('span', { className: 'list__title' }, t.label)),
              h(V.IconButton, { icon: I.right, 'aria-label': 'Open: ' + t.label, onClick: function () { router.go(t.to); } }));
          }))),

        h(Card, { span: 6, title: 'Announcements',
          aside: h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', onClick: function () { router.go('me/announcements'); } }, 'See all') },
          h('div', { className: 'list' }, seed.announcements.slice(0, 3).map(function (a) {
            return h('div', { className: 'list__row', key: a.id },
              h(V.Avatar, { name: emp(a.by).name, size: 'sm' }),
              h('div', { className: 'list__main' },
                h('span', { className: 'list__title row gap-2' },
                  a.pinned ? h(V.Chip, { size: 'sm', shape: 'tag', icon: I.flag }, 'Pinned') : null,
                  h('span', null, a.title)),
                h('span', { className: 'list__meta' }, a.body)));
          }))),

        h(Card, { span: 4, title: 'Latest payslip' },
          h(ui.KeyValue, { rows: [
            ['Period', 'October 2026'],
            ['Net pay', ui.inr((me.ctc / 12) * 0.827)],
            ['Credited', '31 Oct 2026'],
            ['Account', me.bank.name + ' ' + me.bank.account],
            ['Status', h(ui.StatusChip, { status: 'Paid' })]
          ]}),
          h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.download, onClick: function () { router.go('me/payroll/payslips'); } }, 'Download payslip')),

        h(Card, { span: 4, title: 'Upcoming holidays' },
          upcoming.length
            ? h('div', { className: 'list' }, upcoming.slice(0, 4).map(function (hd) {
                return h('div', { className: 'list__row', key: hd.date },
                  h('div', { className: 'list__main' },
                    h('span', { className: 'list__title' }, hd.name),
                    h('span', { className: 'list__meta' }, seed.util.pretty(new Date(hd.date + 'T00:00')))),
                  h(V.Chip, { size: 'sm', shape: 'tag', variant: hd.type === 'Optional' ? 'outline' : 'soft', tone: hd.type === 'Optional' ? 'neutral' : 'info' }, hd.type));
              }))
            : h(ui.Empty, { icon: I.star, title: 'No holidays left this year' })),

        h(Card, { span: 4, title: 'My performance' },
          myAssessment
            ? h(React.Fragment, null,
                h(ui.KeyValue, { rows: [
                  ['Cycle', 'H2 FY2026'],
                  ['Self-assessment', h(ui.StatusChip, { status: myAssessment.self === 'Submitted' ? 'Approved' : 'Not Started' })],
                  ['Manager review', h(ui.StatusChip, { status: myAssessment.manager === 'Submitted' ? 'Approved' : 'Not Started' })],
                  ['Reviewer', myAssessment.reviewer ? emp(myAssessment.reviewer).name : '—']
                ]}),
                h(V.Button, { variant: 'outline', className: 'vi-btn--sm', onClick: function () { router.go('me/performance/self'); } }, 'Open self-appraisal'))
            : h(ui.Empty, { icon: I.target, title: 'No open cycle', body: 'H2 FY2026 opens on 15 November.' }))));
  }

  /* ======================================================= APPROVAL INBOX */
  function ApprovalInbox() {
    var tabSt = React.useState('pending');
    var rejectSt = React.useState(null);
    var reasonSt = React.useState('');
    var rows = store.collection('approvals');
    var pending = rows.filter(function (a) { return a.status === 'Pending Approval'; });
    var filtered = tabSt[0] === 'pending' ? pending
      : tabSt[0] === 'actioned' ? rows.filter(function (a) { return a.status !== 'Pending Approval'; })
        : rows;

    /* Dispatching through actions.decideApproval keeps the cross-module effects of
       PRD 5.1 identical whether a request is actioned here or in its own module. */
    function approve(a) { ui.report(HRMS.actions.decideApproval(a.id, 'Approved')); }
    function reject() {
      var res = ui.report(HRMS.actions.decideApproval(rejectSt[0].id, 'Rejected', reasonSt[0]));
      if (res && res.ok) { rejectSt[1](null); reasonSt[1](''); }
    }

    var columns = [
      { key: 'id', header: 'Request', width: 104, cell: function (x) { return h('span', { className: 'mono' }, x.id); } },
      { key: 'kind', header: 'Type', sortable: true },
      { key: 'employee', header: 'Employee', sortable: true,
        sortValue: function (x) { return emp(x.employee).name; },
        cell: function (x) { return h(ui.Person, { employee: emp(x.employee), sub: deptName(emp(x.employee).department) }); } },
      { key: 'detail', header: 'Details' },
      { key: 'submitted', header: 'Submitted', sortable: true, cell: function (x) { return relTime(x.submitted); } },
      { key: 'approver', header: 'Approver', cell: function (x) { return emp(x.approver) ? emp(x.approver).name : '—'; } },
      { key: 'status', header: 'Status', cell: function (x) { return h(ui.StatusChip, { status: x.status }); } },
      { key: 'actions', header: '', align: 'right', cell: function (x) {
          if (x.status !== 'Pending Approval') {
            return h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', onClick: function () { router.go(x.route); } }, 'View');
          }
          return h('span', { className: 'row gap-2', style: { justifyContent: 'flex-end' } },
            h(V.Button, { variant: 'outline', className: 'vi-btn--sm', onClick: function () { reasonSt[1](''); rejectSt[1](x); } }, 'Reject'),
            h(V.Button, { variant: 'primary', className: 'vi-btn--sm', onClick: function () { approve(x); } }, 'Approve'));
        } }
    ];

    var byKind = {};
    pending.forEach(function (a) { byKind[a.kind] = (byKind[a.kind] || 0) + 1; });

    return h(React.Fragment, null,
      h(PageHead, {
        eyebrow: 'Overview', title: 'Approval inbox',
        description: 'One queue for every request type. Approving here updates the source record, as PRD 5.1 requires.'
      }),
      h('div', { className: 'row gap-2 wrap' }, Object.keys(byKind).map(function (k) {
        return h(V.Chip, { key: k, size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning', dot: true }, k + ' · ' + byKind[k]);
      })),
      h(V.TabGroup, {
        value: tabSt[0], onChange: tabSt[1],
        items: [
          { value: 'pending', label: 'Pending', count: pending.length },
          { value: 'actioned', label: 'Actioned', count: rows.length - pending.length },
          { value: 'all', label: 'All', count: rows.length }
        ]
      }),
      h(Card, null,
        h(ui.DataTable, {
          columns: columns, rows: filtered, pageSize: 10, label: 'Approval requests',
          search: function (x) { return [x.id, x.kind, emp(x.employee).name, x.detail].join(' '); },
          searchPlaceholder: 'Search by request, type or employee',
          emptyTitle: tabSt[0] === 'pending' ? 'Nothing waiting on you' : 'Nothing here',
          emptyBody: tabSt[0] === 'pending' ? 'Every request has been actioned.' : undefined
        })),

      /* PRD 4.13: rejection carries a mandatory reason. */
      rejectSt[0] ? h(ui.Modal, {
        title: 'Reject ' + rejectSt[0].kind.toLowerCase(),
        description: rejectSt[0].id + ' · ' + emp(rejectSt[0].employee).name + ' · ' + rejectSt[0].detail,
        onClose: function () { rejectSt[1](null); },
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { rejectSt[1](null); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', className: 'vi-btn--danger', onClick: reject }, 'Reject request'))
      },
        h(V.TextArea, {
          label: 'Reason', required: true, rows: 3, value: reasonSt[0],
          placeholder: 'The requester sees this reason.',
          onChange: function (e) { reasonSt[1](e.target.value); }
        })) : null);
  }

  /* ==================================================== NOTIFICATION CENTRE */
  function Notifications(p) {
    var role = (p.route && p.route.role) || store.pref('role');
    var notes = store.notificationsFor(role);
    var unread = notes.filter(function (n) { return !n.read; });

    return h(React.Fragment, null,
      h(PageHead, {
        eyebrow: role === 'me' ? 'Home' : 'Overview', title: 'Notifications',
        description: unread.length ? unread.length + ' unread of ' + notes.length + '.' : 'Everything is read.',
        actions: unread.length ? [h(V.Button, {
          key: 'a', variant: 'outline', iconStart: I.check,
          onClick: function () { store.markRead(unread.map(function (n) { return n.id; })); }
        }, 'Mark all as read')] : null
      }),
      h(Card, null,
        notes.length
          ? h('div', { className: 'notes' }, notes.map(function (n) {
              return h('button', {
                key: n.id, type: 'button', className: 'notes__row' + (n.read ? ' is-read' : ''),
                onClick: function () { store.markRead([n.id]); router.goAs(n.route); }
              },
                h('span', { className: 'notes__dot', 'aria-hidden': 'true' }),
                h('span', { className: 'notes__main' },
                  h('span', { className: 'notes__title' }, n.title),
                  h('span', { className: 'notes__body' }, n.body),
                  h('span', { className: 'row gap-2', style: { marginTop: 4 } },
                    h(V.Chip, { size: 'sm', shape: 'tag' }, n.kind))),
                h('span', { className: 'notes__when' }, relTime(n.on)));
            }))
          : h(ui.Empty, { icon: I.bell, title: 'No notifications', body: 'Requests and reminders addressed to you appear here.' })));
  }

  /* ================================================= ROLES & PERMISSIONS (10) */
  var LEVEL_TONE = { full: 'success', manage: 'success', limited: 'info', own: 'info', participate: 'info', viewOnly: 'neutral', none: 'error' };
  var LEVEL_LABEL = { full: 'Full', manage: 'Manage', limited: 'Limited', own: 'Own records', participate: 'Participate', viewOnly: 'View', none: 'No access' };

  function RolesPredefined() {
    return h(React.Fragment, null,
      h(PageHead, {
        eyebrow: 'Roles & permissions', title: 'Predefined roles',
        description: 'The four built-in roles. Manager is an employee with extra team-level rights, not a fourth workspace.'
      }),
      h(Grid, null,
        perms.predefined.map(function (role) {
          return h(Card, { key: role.id, span: 6, title: role.name,
            aside: h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info' }, role.users + ' users') },
            h('p', { className: 'muted', style: { fontSize: 13, lineHeight: 1.6 } }, role.description),
            h(ui.KeyValue, { rows: [
              ['Workspace', role.workspace],
              ['Modules with full access', role.id === 'manager' ? '—'
                : perms.matrix.filter(function (m) { return perms.levelName(role.id, m.id) === 'full'; }).length],
              ['Modules with no access', role.id === 'manager' ? '—'
                : perms.matrix.filter(function (m) { return perms.levelName(role.id, m.id) === 'none'; }).length]
            ]}),
            role.id === 'manager'
              ? h('div', { className: 'stack gap-2' },
                  h('span', { className: 'eyebrow' }, 'On top of the employee role'),
                  h('ul', { className: 'bullets' }, perms.managerExtras.map(function (x) { return h('li', { key: x }, x); })))
              : null);
        })));
  }

  function RolesModules() {
    return h(React.Fragment, null,
      h(PageHead, {
        eyebrow: 'Roles & permissions', title: 'Module permissions',
        description: 'The permission matrix in PRD section 10. Each level expands to the actions listed below.'
      }),
      h(Card, null,
        h(V.Table, {
          density: 'compact', 'aria-label': 'Module permission matrix',
          columns: [
            { key: 'label', header: 'Module', sortable: true },
            { key: 'admin', header: 'Admin', cell: function (m) { return levelChip('admin', m); } },
            { key: 'hr', header: 'HR', cell: function (m) { return levelChip('hr', m); } },
            { key: 'me', header: 'Employee', cell: function (m) { return levelChip('me', m); } },
            { key: 'confidential', header: 'Confidential', align: 'center',
              cell: function (m) { return m.confidential ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning', icon: I.lock }, 'Restricted') : ''; } }
          ],
          rows: perms.matrix
        })),
      h(Card, { title: 'What each level grants' },
        h(V.Table, {
          density: 'compact', 'aria-label': 'Permission levels',
          columns: [
            { key: 'level', header: 'Level', cell: function (x) { return h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: LEVEL_TONE[x.level] }, LEVEL_LABEL[x.level]); } },
            { key: 'actions', header: 'Actions', cell: function (x) { return x.actions.length ? x.actions.join(', ') : '—'; } }
          ],
          rows: Object.keys(perms.levels).map(function (k) { return { id: k, level: k, actions: perms.levels[k] }; })
        })));
  }

  function levelChip(role, m) {
    var lvl = perms.levelName(role, m.id);
    return h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: LEVEL_TONE[lvl] || 'neutral' }, LEVEL_LABEL[lvl] || lvl);
  }

  function RolesData() {
    return h(React.Fragment, null,
      h(PageHead, {
        eyebrow: 'Roles & permissions', title: 'Data access',
        description: 'The data boundary each role sees per module, on top of its permission level.'
      }),
      h(Card, null,
        h(V.Table, {
          density: 'compact', 'aria-label': 'Data access scopes',
          columns: [
            { key: 'label', header: 'Module', sortable: true },
            { key: 'a', header: 'Admin', cell: function (m) { return perms.scopes[perms.scope('admin', m.id)]; } },
            { key: 'h', header: 'HR', cell: function (m) { return perms.scopes[perms.scope('hr', m.id)]; } },
            { key: 'e', header: 'Employee', cell: function (m) { return perms.scopes[perms.scope('me', m.id)]; } }
          ],
          rows: perms.matrix
        })),
      h(Card, { title: 'Enforcement in this prototype', aside: h(V.Chip, { size: 'sm', shape: 'tag', icon: I.file }, 'PRD 16.6') },
        h('p', { className: 'muted', style: { fontSize: 14, lineHeight: 1.6 } },
          'Routes are gated on the matrix above: a deep link into a workspace you are not signed into, ',
          'or a module your role cannot view, lands on the access-denied screen. Try ',
          h('span', { className: 'mono code' }, '#/hr/payroll/dashboard'),
          ' while signed in as Employee.'),
        h('p', { className: 'muted', style: { fontSize: 14, lineHeight: 1.6 } },
          'This is prototype-level access control only. PRD 16.6 is explicit that frontend permissions ' +
          'are not production security — real authorization has to be enforced by a backend.')));
  }

  /* ========================================================= GLOBAL SCREENS */
  /* ---------- Sign in (option B) ----------
     The lavender page from the sign-in prototype: the pitch on the left of one centred
     card, the form on the right. Email or mobile, a password, four SSO tiles, and a row
     that picks which workspace the prototype opens in. */

  var EYE_OFF = h('svg', { viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', 'aria-hidden': 'true' },
    h('path', { d: 'M2.5 12s3.6-6.2 9.5-6.2S21.5 12 21.5 12s-3.6 6.2-9.5 6.2S2.5 12 2.5 12Z', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round' }),
    h('circle', { cx: 12, cy: 12, r: 3, stroke: 'currentColor', strokeWidth: 1.5 }),
    h('path', { d: 'M3.5 3.5l17 17', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }));

  var PHONE = h('svg', { viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', 'aria-hidden': 'true' },
    h('rect', { x: 6, y: 2.5, width: 12, height: 19, rx: 2.5, stroke: 'currentColor', strokeWidth: 1.5 }),
    h('path', { d: 'M10.5 18.5h3', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }));

  var GOOGLE = h('span', { className: 'auth-sso__mark' }, h('svg', { viewBox: '0 0 48 48', 'aria-hidden': 'true' },
    h('path', { fill: '#EA4335', d: 'M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z' }),
    h('path', { fill: '#4285F4', d: 'M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z' }),
    h('path', { fill: '#FBBC05', d: 'M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z' }),
    h('path', { fill: '#34A853', d: 'M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z' })));

  var MICROSOFT = h('span', { className: 'auth-sso__mark' }, h('svg', { viewBox: '0 0 23 23', 'aria-hidden': 'true' },
    h('path', { fill: '#F25022', d: 'M1 1h10v10H1z' }), h('path', { fill: '#7FBA00', d: 'M12 1h10v10H12z' }),
    h('path', { fill: '#00A4EF', d: 'M1 12h10v10H1z' }), h('path', { fill: '#FFB900', d: 'M12 12h10v10H12z' })));

  /* The two ribbons over the wash. Stroked only, so no edge shows where they fade. */
  function AuthWaves() {
    return h('div', { className: 'authb__waves', 'aria-hidden': 'true' },
      h('svg', { viewBox: '0 0 900 420', preserveAspectRatio: 'none' },
        h('path', { d: 'M-50 300C140 250 250 120 460 70 640 27 780 60 950 150', strokeWidth: 2 }),
        h('path', { d: 'M-50 380C160 320 270 180 480 128 660 84 800 120 950 212', strokeWidth: 1.5, opacity: .7 })),
      h('svg', { viewBox: '0 0 900 420', preserveAspectRatio: 'none' },
        h('path', { d: 'M-50 180C150 268 300 128 480 150 650 170 790 280 950 258', strokeWidth: 2 }),
        h('path', { d: 'M-50 268C170 348 320 208 500 232 660 254 800 352 950 330', strokeWidth: 1.5, opacity: .7 })));
  }

  /* A glass stack: the employee record, a calendar chip, a chart chip and a done mark. */
  function AuthArt() {
    return h('div', { className: 'authb__art', 'aria-hidden': 'true' },
      h('svg', { viewBox: '0 0 320 230', fill: 'none' },
        h('defs', null,
          h('linearGradient', { id: 'authg1', x1: 0, y1: 0, x2: 1, y2: 1 },
            h('stop', { offset: 0, stopColor: '#ffffff', stopOpacity: .95 }), h('stop', { offset: 1, stopColor: '#ede7fb', stopOpacity: .9 })),
          h('linearGradient', { id: 'authg2', x1: 0, y1: 0, x2: 1, y2: 1 },
            h('stop', { offset: 0, stopColor: '#ffffff', stopOpacity: .7 }), h('stop', { offset: 1, stopColor: '#e3daf9', stopOpacity: .75 })),
          h('filter', { id: 'authsh', x: '-20%', y: '-20%', width: '150%', height: '150%' },
            h('feDropShadow', { dx: 0, dy: 10, stdDeviation: 12, floodColor: '#4a2e9e', floodOpacity: .16 }))),
        h('g', { filter: 'url(#authsh)' },
          h('rect', { x: 52, y: 44, width: 196, height: 122, rx: 20, fill: 'url(#authg2)' }),
          h('rect', { x: 40, y: 56, width: 196, height: 122, rx: 20, fill: 'url(#authg1)', stroke: '#ffffff', strokeWidth: 1.4 })),
        h('circle', { cx: 74, cy: 92, r: 13, fill: '#5733c1', opacity: .16 }),
        h('path', { d: 'M74 88.5a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Zm8 12c-.8-4.6-4-7.6-8-7.6s-7.2 3-8 7.6Z', fill: '#5733c1' }),
        h('g', { fill: '#5733c1', opacity: .22 },
          h('rect', { x: 96, y: 84, width: 104, height: 8, rx: 4 }),
          h('rect', { x: 96, y: 100, width: 72, height: 8, rx: 4 })),
        h('g', { fill: '#5733c1', opacity: .13 },
          h('rect', { x: 60, y: 126, width: 150, height: 8, rx: 4 }),
          h('rect', { x: 60, y: 144, width: 110, height: 8, rx: 4 })),
        h('g', { filter: 'url(#authsh)' }, h('rect', { x: 212, y: 18, width: 62, height: 62, rx: 18, fill: 'url(#authg1)', stroke: '#fff', strokeWidth: 1.4 })),
        h('g', { stroke: '#5733c1', strokeWidth: 1.8, strokeLinecap: 'round', fill: 'none' },
          h('rect', { x: 229, y: 36, width: 28, height: 26, rx: 6 }), h('path', { d: 'M236 32v7M250 32v7M229 46h28' })),
        h('g', { filter: 'url(#authsh)' }, h('rect', { x: 226, y: 118, width: 62, height: 62, rx: 18, fill: 'url(#authg1)', stroke: '#fff', strokeWidth: 1.4 })),
        h('g', { fill: '#5733c1' },
          h('rect', { x: 241, y: 150, width: 7, height: 15, rx: 3 }), h('rect', { x: 253, y: 140, width: 7, height: 25, rx: 3 }), h('rect', { x: 265, y: 132, width: 7, height: 33, rx: 3 })),
        h('g', { filter: 'url(#authsh)' }, h('circle', { cx: 52, cy: 178, r: 24, fill: '#3ec46a' })),
        h('path', { d: 'M42 178.5l7 7 14-14', stroke: '#fff', strokeWidth: 3.2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' })));
  }

  function Login() {
    var roles = HRMS.nav.roles;
    var roleSt = React.useState(store.pref('role') || 'admin');
    var activeRole = roles.filter(function (r) { return r.id === roleSt[0]; })[0] || roles[0];
    var persona = who(activeRole.persona);

    var modeSt = React.useState('email');
    var emailSt = React.useState(persona ? persona.workEmail : '');
    var phoneSt = React.useState('98765 43210');
    var pwSt = React.useState('prototype');
    var showSt = React.useState(false);
    var rememberSt = React.useState(true);
    var busySt = React.useState(null);
    var idErr = React.useState(null);
    var pwErr = React.useState(null);
    var alertSt = React.useState(null);
    var mobile = modeSt[0] === 'mobile';

    /* Signing in is the only place the workspace is chosen, so write it before leaving.
       An admin whose organisation has not been set up goes to the wizard rather than to a
       console configured for nobody; everyone else goes straight to their workspace. */
    function enter(how) {
      busySt[1](how);
      store.setPref('role', roleSt[0]);
      store.setPref('signedIn', true);
      /* The one place organisation setup is offered: an admin signing in to an
         organisation that has not been set up yet. Switching workspace later does not
         ask again, because that is looking around rather than signing up. */
      var toSetup = roleSt[0] === 'admin' && store.pref('setupComplete') === false;
      setTimeout(function () { router.go(toSetup ? 'global/setup' : activeRole.home); }, 420);
    }

    function pickRole(id) {
      roleSt[1](id);
      var r = roles.filter(function (x) { return x.id === id; })[0];
      var p = r && who(r.persona);
      if (p) { emailSt[1](p.workEmail); idErr[1](null); }
      alertSt[1](null);
    }

    function switchMode(m) { modeSt[1](m); idErr[1](null); alertSt[1](null); }

    function submit(e) {
      e.preventDefault();
      if (busySt[0]) return;
      var bad = false;
      if (mobile) {
        if (phoneSt[0].replace(/\D/g, '').length < 10) { idErr[1]('Enter a 10-digit mobile number.'); bad = true; }
      } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailSt[0])) {
        idErr[1]('Enter your work email address.'); bad = true;
      }
      if (!pwSt[0]) { pwErr[1]('Enter your password.'); bad = true; }
      if (bad) { alertSt[1]('Check the highlighted fields and try again.'); return; }
      enter('password');
    }

    var idField = mobile
      ? h(V.TextField, {
          id: 'b-mobile', label: 'Mobile number', required: true, type: 'tel', iconStart: PHONE, value: phoneSt[0],
          placeholder: '98765 43210', autoComplete: 'tel', status: idErr[0] ? 'error' : 'default', hint: idErr[0] || undefined,
          onChange: function (e) { phoneSt[1](e.target.value); if (idErr[0]) idErr[1](null); }
        })
      : h(V.TextField, {
          id: 'b-email', label: 'Work email', required: true, type: 'email', iconStart: I.mail, value: emailSt[0],
          placeholder: 'name@aptagrim.com', autoComplete: 'email', status: idErr[0] ? 'error' : 'default', hint: idErr[0] || undefined,
          onChange: function (e) { emailSt[1](e.target.value); if (idErr[0]) idErr[1](null); }
        });

    return h('div', { className: 'authb' },
      h(AuthWaves),
      h('header', { className: 'authb__top' },
        h('span', { className: 'brand' },
          h('span', { className: 'brand__mark' }, 'A'),
          h('span', { className: 'brand__name' }, 'Aptagrim HR'))),

      h('div', { className: 'authb__card' },
        h('div', { className: 'authb__aside' },
          h('div', { className: 'stack gap-3' },
            h('h2', { className: 'authb__h' }, 'People, work and growth ', h('em', null, 'in one place.')),
            h('p', { className: 'authb__p' }, 'A modern HRMS for your people, their work and the workplace — simply and smarter.')),
          h(AuthArt),
          h('div', { className: 'authb__uses' },
            h('span', { className: 'authb__use' }, I.calendar, 'Manage leave'),
            h('span', { className: 'authb__use' }, I.users, 'Track attendance'),
            h('span', { className: 'authb__use' }, I.card, 'Access payslips'))),

        h('div', { className: 'authb__form' },
          h('div', null,
            h('h1', { className: 'authb__title' }, 'Sign in'),
            h('p', { className: 'authb__lede' }, 'Welcome back. Use your work email or mobile number.')),
          alertSt[0] ? h('div', { className: 'auth-alert', role: 'alert' }, I.warn, h('span', null, alertSt[0])) : null,
          h('form', { className: 'auth-fields', onSubmit: submit, noValidate: true },
            h('div', { className: 'auth-switcher', role: 'group', 'aria-label': 'Sign in with' },
              ['email', 'mobile'].map(function (m) {
                return h('button', {
                  key: m, type: 'button', className: 'auth-switcher__tab' + (modeSt[0] === m ? ' is-on' : ''),
                  'aria-pressed': modeSt[0] === m ? 'true' : 'false', onClick: function () { switchMode(m); }
                }, h('span', { className: 'auth-switcher__icon' }, m === 'email' ? I.mail : PHONE), m === 'email' ? 'Email' : 'Mobile');
              })),
            idField,
            h('div', { className: 'stack gap-3' },
              h('div', { className: 'auth-pw' },
                h(V.TextField, {
                  id: 'b-pw', label: 'Password', required: true, type: showSt[0] ? 'text' : 'password', iconStart: I.lock,
                  value: pwSt[0], autoComplete: 'current-password', placeholder: 'Enter your password',
                  status: pwErr[0] ? 'error' : 'default', hint: pwErr[0] || undefined,
                  onChange: function (e) { pwSt[1](e.target.value); if (pwErr[0]) pwErr[1](null); }
                }),
                h('button', {
                  type: 'button', className: 'auth-pw__eye', onClick: function () { showSt[1](!showSt[0]); },
                  'aria-label': showSt[0] ? 'Hide password' : 'Show password', 'aria-pressed': showSt[0] ? 'true' : 'false'
                }, showSt[0] ? EYE_OFF : I.eye)),
              h('div', { className: 'auth-pwrow' },
                h(V.Checkbox, { label: 'Keep me signed in', checked: rememberSt[0], onChange: function (e) { rememberSt[1](e.target.checked); } }),
                h('button', { type: 'button', className: 'link', onClick: function () { router.go('global/forgot'); } }, 'Forgot password?'))),
            h('div', { className: 'auth-full' },
              h(V.Button, { type: 'submit', disabled: !!busySt[0], iconEnd: busySt[0] === 'password' ? null : I.arrow },
                busySt[0] === 'password' ? 'Signing in…' : 'Sign in'))),

          h('div', { className: 'auth-or' }, h('span', null, 'or continue with')),
          h('div', { className: 'auth-sso' },
            [['Google', GOOGLE], ['Microsoft', MICROSOFT], ['Company SSO', h('span', { className: 'auth-sso__mark' }, I.building)]].map(function (p) {
              return h('button', {
                key: p[0], type: 'button', className: 'auth-sso__btn', title: p[0], 'aria-label': 'Continue with ' + p[0],
                disabled: !!busySt[0], onClick: function () { enter('sso'); }
              }, p[1]);
            }),
            h('button', {
              type: 'button', className: 'auth-sso__btn', disabled: !!busySt[0], onClick: function () { enter('otp'); },
              title: mobile ? 'One-time code by SMS' : 'One-time code by email',
              'aria-label': mobile ? 'Send a one-time code by SMS' : 'Email me a one-time code'
            }, h('span', { className: 'auth-sso__mark' }, mobile ? PHONE : I.mail))),

          /* Prototype only: which of the three workspaces this sign-in opens. */
          h('div', { className: 'authrole' },
            h('span', { className: 'authrole__cap' }, 'Prototype — open as'),
            h('div', { className: 'authrole__row', role: 'group', 'aria-label': 'Workspace to open' },
              roles.map(function (r) {
                var p = who(r.persona);
                return h('button', {
                  key: r.id, type: 'button', className: 'authrole__btn' + (roleSt[0] === r.id ? ' is-on' : ''),
                  'aria-pressed': roleSt[0] === r.id ? 'true' : 'false', onClick: function () { pickRole(r.id); }
                },
                  h('span', { className: 'authrole__ico' }, I[r.icon] || I.person),
                  h('span', { className: 'authrole__txt' },
                    h('strong', null, r.label),
                    h('small', null, p ? p.name : r.persona)));
              })),
            h('p', { className: 'auth-switch' }, 'Any password signs you in. New here? Your HR team sends you an invite.'),
            /* Signing up is the one path with no organisation behind it yet, so it marks
               setup as outstanding and the console sends you to the wizard. */
            h('p', { className: 'auth-switch' }, 'Setting up a new organisation? ',
              h('button', { type: 'button', className: 'link', onClick: function () {
                store.setPref('role', 'admin');
                store.setPref('setupComplete', false);   /* in case setup was finished before */
                router.go('global/setup');
              } }, 'Sign up')))))
      ,
      h('footer', { className: 'authb__foot' },
        h('span', null, '© 2026 ' + seed.org.name),
        h('a', { href: '#' }, 'Privacy'), h('a', { href: '#' }, 'Terms'), h('a', { href: '#' }, 'Help')));
  }

  function Help() {
    var s = store.stats();
    return h(React.Fragment, null,
      h(PageHead, { eyebrow: 'Global', title: 'Help & support', description: 'How this prototype maps to the product requirements document.' }),
      h(Grid, null,
        h(Card, { span: 7, title: 'What is built' },
          h(ui.KeyValue, { rows: [
            ['Application shell', 'Rail, role switcher, top bar, breadcrumbs, dark mode, mobile drawer (12.2)'],
            ['Routing', HRMS.nav.count + ' routes registered, each a bookmarkable link (11)'],
            ['Dashboards', 'Admin, HR and Employee (9)'],
            ['Approval inbox', 'Writes through to the source record (6.5, 5.1)'],
            ['Notification centre', 'With read state (7)'],
            ['Roles & permissions', 'Matrix, data scopes and route gating (10, 16.6)'],
            ['Sample data', seed.org.name + ', ' + s.headcount + ' employees, persisted in this browser (15, 16.5)']
          ]})),
        h(Card, { span: 5, title: 'Everything else' },
          h('p', { className: 'muted', style: { fontSize: 14, lineHeight: 1.6 } },
            'Every other route resolves to a placeholder naming the screen and its PRD section, so the ' +
            'information architecture can be reviewed against the document before any module is built deep. ' +
            'PRD 18 sequences the remaining phases.'),
          h(V.Button, { variant: 'outline', iconStart: I.sitemap, onClick: function () { router.go('global/map'); } }, 'See the full screen map')),
        h(Card, { span: 12, title: 'Sample figures', aside: h(V.Chip, { size: 'sm', shape: 'tag', icon: I.file }, 'PRD 15') },
          h('p', { className: 'muted', style: { fontSize: 13 } },
            'These are computed from the sample data, not written onto screens. The smoke test asserts them.'),
          h(V.Table, {
            density: 'compact', 'aria-label': 'Sample figures',
            columns: [
              { key: 'label', header: 'Figure' },
              { key: 'target', header: 'PRD 15', numeric: true, align: 'right' },
              { key: 'actual', header: 'Computed', numeric: true, align: 'right',
                cell: function (x) {
                  return h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: x.actual === x.target ? 'success' : 'error', dot: true }, String(x.actual));
                } }
            ],
            rows: [
              { id: 1, label: 'Total employees', target: seed.targets.totalEmployees, actual: s.headcount },
              { id: 2, label: 'Active employees', target: seed.targets.activeEmployees, actual: s.active },
              { id: 3, label: 'New joiners this month', target: seed.targets.newJoinersThisMonth, actual: s.newJoiners },
              { id: 4, label: 'Employees on leave today', target: seed.targets.onLeaveToday, actual: s.onLeaveToday },
              { id: 5, label: 'Pending leave requests', target: seed.targets.pendingLeaveRequests, actual: s.pendingLeave },
              { id: 6, label: 'Pending regularizations', target: seed.targets.pendingRegularizations, actual: s.pendingRegs },
              { id: 7, label: 'Pending onboarding tasks', target: seed.targets.pendingOnboardingTasks, actual: s.pendingOnboardingTasks },
              { id: 8, label: 'Pending asset requests', target: seed.targets.pendingAssetRequests, actual: s.pendingAssetRequests }
            ]
          }))));
  }

  function ScreenMap() {
    var built = Object.keys(REGISTRY);
    return h(React.Fragment, null,
      h(PageHead, {
        eyebrow: 'Global', title: 'Screen map',
        description: HRMS.nav.count + ' routes across three workspaces, mapped from PRD sections 2 and 11. Opening a screen in another workspace switches account.'
      }),
      HRMS.nav.roles.map(function (role) {
        return h(Card, { key: role.id, title: role.label + ' workspace',
          aside: h(V.Chip, { size: 'sm', shape: 'tag' }, role.groups.reduce(function (n, g) { return n + g.items.length; }, 0) + ' sidebar items') },
          role.groups.map(function (group, gi) {
            return h('div', { key: gi, className: 'stack gap-2', style: { marginBottom: 14 } },
              group.label ? h('span', { className: 'eyebrow' }, group.label) : null,
              group.items.map(function (item) {
                var base = role.id + '/' + item.path;
                var kids = item.tabs || [];
                var isBuilt = built.indexOf(base) >= 0 || kids.some(function (t) { return built.indexOf(base + '/' + t.path) >= 0; });
                return h('div', { key: item.path, className: 'list__row' },
                  h('div', { className: 'list__main' },
                    h('span', { className: 'list__title row gap-2 wrap' },
                      item.href
                        ? h('a', { className: 'link', href: item.href }, item.label)
                        : h('button', { className: 'link', type: 'button', onClick: function () { router.goAs(base); } }, item.label),
                      isBuilt || item.href ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'success', dot: true }, 'Built') : null,
                      h(V.Chip, { size: 'sm', shape: 'tag' }, 'PRD ' + item.section)),
                    kids.length ? h('span', { className: 'list__meta' }, kids.map(function (t) { return t.label; }).join(' · ')) : null));
              }));
          }));
      }));
  }

  function NotFound(p) {
    return h('div', { style: { padding: '5vh 0' } },
      h(ui.Empty, {
        icon: I.search, title: 'Page not found',
        body: 'No screen is registered at #/' + p.path + '.',
        actions: [
          h(V.Button, { key: 'a', variant: 'primary', onClick: function () { router.go(HRMS.nav.role(store.pref('role')).home); } }, 'Back to dashboard'),
          h(V.Button, { key: 'b', variant: 'outline', onClick: function () { router.go('global/map'); } }, 'Screen map')
        ]
      }));
  }

  /* Access denied (PRD 11.1, 16.6, 17). Reached by deep-linking into a workspace you
     are not signed into, or a module your role cannot view. */
  function Denied(p) {
    var activeRole = p.activeRole || store.pref('role');
    var activeLabel = HRMS.nav.role(activeRole).label;
    var moduleId = p.module;
    var mod = moduleId && perms.byModule[moduleId];
    var needed = p.requiredRole ? HRMS.nav.role(p.requiredRole) : null;

    var body = needed
      ? 'You are signed in as ' + activeLabel + '. ' + (p.label || 'That screen') +
        ' belongs to the ' + needed.label + ' workspace.'
      : 'You are signed in as ' + activeLabel + ', which has no access to ' +
        (mod ? mod.label : 'this module') + '.';

    return h('div', { style: { padding: '5vh 0' } },
      h(ui.Empty, {
        icon: I.lock, title: 'Access denied', body: body,
        actions: [
          needed ? h(V.Button, {
            key: 'switch', variant: 'primary', iconStart: I[needed.icon],
            onClick: function () { store.setPref('role', needed.id); router.go(p.path); }
          }, 'Switch to ' + needed.label) : null,
          h(V.Button, {
            key: 'home', variant: needed ? 'outline' : 'primary',
            onClick: function () { router.go(HRMS.nav.role(activeRole).home); }
          }, 'Back to my dashboard'),
          h(V.Button, { key: 'perm', variant: 'ghost', onClick: function () { router.goAs('admin/roles/modules'); } }, 'See the permission matrix')
        ].filter(Boolean)
      }),
      h('div', { style: { maxWidth: 560, margin: '0 auto' } },
        h(Card, { title: 'Why' },
          h(ui.KeyValue, { rows: [
            ['Requested', h('span', { className: 'mono' }, '#/' + p.path)],
            ['Signed in as', activeLabel],
            mod ? ['Module', mod.label] : null,
            mod ? ['Your level', LEVEL_LABEL[perms.levelName(activeRole, moduleId)]] : null,
            needed ? ['Belongs to', needed.label + ' workspace'] : null
          ].filter(Boolean) }))));
  }

  function SimpleAuth(p) {
    return h('div', { className: 'card', style: { maxWidth: 420, margin: '6vh auto' } },
      h('h1', { style: { font: '500 22px/1.3 var(--font-flex)' } }, p.title),
      h('p', { className: 'muted' }, p.body),
      h(V.TextField, { label: p.field, placeholder: p.placeholder }),
      h(V.Button, { variant: 'primary', onClick: function () { router.go('global/login'); } }, p.cta),
      h('button', { className: 'link', type: 'button', onClick: function () { router.go('global/login'); } }, 'Back to sign in'));
  }

  /* ------------------------------------------------------------- Registry */
  var REGISTRY = {
    'admin/dashboard': AdminDashboard,
    'hr/dashboard': HrDashboard,
    'me/dashboard': MeDashboard,
    'hr/approvals': ApprovalInbox,
    'global/notifications': Notifications,
    'admin/roles/predefined': RolesPredefined,
    'admin/roles/modules': RolesModules,
    'admin/roles/data': RolesData,
    'global/login': Login,
    'global/help': Help,
    'global/map': ScreenMap,
    'global/denied': Denied,
    'global/forgot': function () { return h(SimpleAuth, { title: 'Forgot password', body: 'We will email a reset link to your work address.', field: 'Work email', placeholder: 'name@nexoratech.com', cta: 'Send reset link' }); },
    'global/reset': function () { return h(SimpleAuth, { title: 'Reset password', body: 'Choose a new password that meets the organization policy.', field: 'New password', placeholder: 'At least 12 characters', cta: 'Set password' }); },
    'global/activate': function () { return h(SimpleAuth, { title: 'Activate your account', body: 'Set a password to finish activating your account.', field: 'New password', placeholder: 'At least 12 characters', cta: 'Activate account' }); },
    'global/invite': function () { return h(SimpleAuth, { title: 'Accept your invitation', body: 'Confirm your details to join ' + seed.org.name + '.', field: 'Full name', placeholder: 'Your name', cta: 'Accept invitation' }); },
    'global/404': NotFound
  };

  HRMS.screens = {
    registry: REGISTRY,
    NotFound: NotFound,
    Denied: Denied,
    /* The per-phase screen files call this to add their routes. Registering a route
       that the IA does not define is a mistake the smoke test fails on. */
    register: function (map) {
      Object.keys(map).forEach(function (path) { REGISTRY[path] = map[path]; });
    },
    resolve: function (route) {
      if (route.notFound) return null;
      return REGISTRY[route.path] || null;
    }
  };
})();

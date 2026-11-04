/* Phase 5 (PRD 18): payroll, compensation, performance and appraisals.

   Payroll covers the run sequence of PRD 4.35, the structures and components of 4.34,
   payslips (4.38) and tax declarations (4.37). Performance covers appraisal cycles (4.44),
   criteria (4.43), goals (4.46), reviews (4.45), calibration and results (4.45, 4.47).
   The two configuration screens are PRD 4.34 and 4.43.

   Every write goes through HRMS.actions, which validates through rules.js, so a payroll
   cannot be finalized before review and a review cannot be submitted by the wrong person. */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var store = HRMS.store, router = HRMS.router, ui = HRMS.ui, seed = HRMS.seed;
  var act = HRMS.actions, rules = HRMS.rules;
  var Card = ui.Card, Grid = ui.Grid, Stat = ui.Stat, Stats = ui.Stats;

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var RATINGS = [1, 2, 3, 4, 5];

  function emp(id) { return store.employee(id); }
  function deptName(id) { var d = store.department(id); return d ? d.name : '—'; }
  function deptOptions() { return store.collection('departments').map(function (d) { return { value: d.id, label: d.name }; }); }
  function structureName(id) {
    var s = store.collection('salaryStructures').filter(function (x) { return x.id === id; })[0];
    return s ? s.name : '—';
  }

  /* Employees payroll actually pays: an exited record is out, and an invited one has
     not joined yet. The same filter actions.initiatePayroll uses, so the screen and
     the action always agree on the headcount. */
  function payable() {
    return store.collection('employees').filter(function (e) {
      return e.status !== 'Exited' && e.status !== 'Invited';
    });
  }
  function bOf(e) { return e.breakdown || seed.util.breakdown(e.ctc); }

  /* Every payroll figure on these screens is summed from the employee breakdowns
     rather than written onto the screen (PRD 15). The "lines" map carries the per-component
     totals the components screen needs. */
  function totals(list) {
    var out = { count: 0, gross: 0, deductions: 0, net: 0, employerPf: 0, ctc: 0, lines: {} };
    list.forEach(function (e) {
      var b = bOf(e);
      out.count += 1;
      out.ctc += e.ctc;
      out.gross += b.gross;
      out.deductions += b.totalDeductions;
      out.net += b.net;
      out.employerPf += b.employerPf;
      b.earnings.concat(b.deductions).forEach(function (row) {
        out.lines[row[0]] = (out.lines[row[0]] || 0) + row[1];
      });
    });
    out.employerCost = out.gross + out.employerPf;
    return out;
  }

  function cycles() {
    return store.collection('payrollCycles').slice().sort(function (a, b) { return a.payDate < b.payDate ? 1 : -1; });
  }
  /* The run a user would work on: the first one not yet paid, else the most recent. */
  function openCycle() {
    var list = cycles();
    return list.filter(function (c) { return c.status !== 'Paid'; }).slice(-1)[0] || list[0];
  }
  /* The next unused period, so the new-run form opens on a sensible default. */
  function nextPeriod() {
    var d = new Date(seed.todayIso.slice(0, 8) + '01T00:00');
    d.setMonth(d.getMonth() + 1);
    return {
      period: MONTHS[d.getMonth()] + ' ' + d.getFullYear(),
      cutoff: seed.util.iso(new Date(d.getFullYear(), d.getMonth(), 25)),
      payDate: seed.util.iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))
    };
  }

  function perfCycles() { return store.collection('perfCycles'); }
  function perfOpen() {
    var list = perfCycles();
    return list.filter(function (c) { return c.status === 'Live'; })[0]
      || list.filter(function (c) { return c.status === 'Scheduled'; })[0]
      || list[0];
  }
  function perfOptions() {
    return perfCycles().map(function (c) { return { value: c.id, label: c.name }; });
  }
  function assessmentsIn(cycleId) {
    return store.collection('assessments').filter(function (a) { return a.cycle === cycleId; });
  }
  function goalsIn(cycleId) {
    return store.collection('goals').filter(function (g) { return g.cycle === cycleId; });
  }

  /* =========================================================== PAYROLL (4.36) */
  function PayrollDashboard() {
    var t = totals(payable());
    var cycle = openCycle();
    var history = cycles();

    /* Cost by department, summed from the same breakdowns the payslips use. */
    var byDept = {};
    payable().forEach(function (e) {
      var row = byDept[e.department] || (byDept[e.department] = {
        id: e.department, department: e.department, employees: 0, gross: 0, deductions: 0, net: 0
      });
      var b = bOf(e);
      row.employees += 1; row.gross += b.gross; row.deductions += b.totalDeductions; row.net += b.net;
    });
    var deptRows = Object.keys(byDept).map(function (k) { return byDept[k]; })
      .sort(function (a, b) { return b.gross - a.gross; });

    var STAGES = ['Inputs pending', 'Under review', 'Locked', 'Completed'];
    var stageAt = cycle ? Math.max(0, STAGES.indexOf(cycle.stage)) : 0;

    return h(React.Fragment, null,
      h(Stats, null,
        h(Stat, {
          label: 'Total payroll cost', value: ui.inr(t.employerCost, { short: true }),
          sub: 'Gross plus employer contributions for ' + t.count + ' employees'
        }),
        h(Stat, {
          label: 'Gross earnings', value: ui.inr(t.gross, { short: true }),
          sub: 'Annual CTC of ' + ui.inr(t.ctc, { short: true }) + ' across the payroll'
        }),
        h(Stat, {
          label: 'Total deductions', value: ui.inr(t.deductions, { short: true }),
          sub: ui.pct(t.deductions, t.gross) + '% of gross earnings'
        }),
        h(Stat, {
          label: 'Net payable', value: ui.inr(t.net, { short: true }),
          sub: cycle ? 'Payment date ' + ui.dateLabel(cycle.payDate) : 'No open cycle',
          tone: cycle && cycle.status === 'Paid' ? 'good' : 'warn'
        })),

      h(Grid, null,
        h(Card, { span: 7, title: 'Monthly cost by department', description: 'Derived from each employee’s salary breakdown, not entered on this screen.' },
          h(ui.DataTable, {
            exportName: 'payroll-cost-by-department', label: 'Cost by department', rows: deptRows, pageSize: 10,
            search: function (r) { return deptName(r.department); }, searchPlaceholder: 'Search departments',
            columns: [
              { key: 'department', header: 'Department', sortable: true,
                sortValue: function (r) { return deptName(r.department); },
                csv: function (r) { return deptName(r.department); },
                cell: function (r) { return deptName(r.department); } },
              { key: 'employees', header: 'Employees', numeric: true, align: 'right', sortable: true },
              { key: 'gross', header: 'Gross', numeric: true, align: 'right', sortable: true,
                cell: function (r) { return ui.inr(r.gross); } },
              { key: 'deductions', header: 'Deductions', numeric: true, align: 'right',
                cell: function (r) { return ui.inr(r.deductions); } },
              { key: 'net', header: 'Net', numeric: true, align: 'right',
                cell: function (r) { return h('strong', { style: { fontWeight: 500 } }, ui.inr(r.net)); } },
              { key: 'share', header: 'Share of cost', csv: function (r) { return ui.pct(r.gross, t.gross) + '%'; },
                cell: function (r) { return h(V.ProgressBar, { value: ui.pct(r.gross, t.gross), size: 'sm', 'aria-label': deptName(r.department) }); } }
            ],
            emptyIcon: I.card, emptyTitle: 'No payroll cost to show',
            emptyBody: 'Cost appears once employees with a CTC are on the payroll.'
          })),

        h(Card, { span: 5, title: 'Processing status', aside: cycle ? h(ui.StatusChip, { status: cycle.status }) : null },
          cycle
            ? h(React.Fragment, null,
                h(ui.KeyValue, { rows: [
                  ['Open cycle', cycle.period],
                  ['Stage', cycle.stage],
                  ['Cut-off', ui.dateLabel(cycle.cutoff)],
                  ['Payment date', ui.dateLabel(cycle.payDate)],
                  ['Employees in run', cycle.employees],
                  ['Locked', rules.payrollLocked(cycle)
                    ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'success', icon: I.lock }, 'Finalized')
                    : h('span', { className: 'muted' }, 'Open for edits')]
                ]}),
                h('div', { className: 'steps' }, STAGES.map(function (s, i) {
                  var reached = i === 0 || i <= stageAt;
                  return h('div', { className: 'steps__row' + (reached ? ' is-done' : ''), key: s },
                    h('span', { className: 'steps__tick' }, I.check), h('span', null, s));
                })),
                h(V.Button, {
                  variant: 'primary', className: 'vi-btn--sm', iconStart: I.right,
                  onClick: function () { router.goAs('hr/payroll/processing'); }
                }, 'Open processing'))
            : h(ui.Empty, { icon: I.card, title: 'No payroll cycle yet', body: 'Start a run from the cycles screen.' })),

        h(Card, { span: 5, title: 'Statutory & employer contributions', description: 'Per month, across the payroll. Rules are configurable per jurisdiction (PRD 4.34).' },
          h(ui.KeyValue, { rows: [
            ['Provident fund — employee', ui.inr(t.lines['Provident Fund'] || 0)],
            ['Provident fund — employer', ui.inr(t.employerPf)],
            ['Professional tax', ui.inr(t.lines['Professional Tax'] || 0)],
            ['Tax deducted at source', ui.inr(t.lines['Tax Deducted at Source'] || 0)],
            ['Group insurance', ui.inr(t.lines['Group Insurance'] || 0)],
            ['Employer cost above gross', ui.inr(t.employerCost - t.gross)]
          ]}),
          h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.sliders,
            onClick: function () { router.goAs('hr/config/payroll'); } }, 'Payroll configuration')),

        h(Card, { span: 7, title: 'Payroll history' },
          h(ui.DataTable, {
            exportName: 'payroll-history', label: 'Payroll history', rows: history, pageSize: 10,
            search: function (c) { return c.period + ' ' + c.status; }, searchPlaceholder: 'Search by period or status',
            columns: [
              { key: 'period', header: 'Period', sortable: true },
              { key: 'employees', header: 'Employees', numeric: true, align: 'right' },
              { key: 'gross', header: 'Gross', numeric: true, align: 'right', cell: function (c) { return ui.inr(c.gross, { short: true }); } },
              { key: 'deductions', header: 'Deductions', numeric: true, align: 'right', cell: function (c) { return ui.inr(c.deductions, { short: true }); } },
              { key: 'net', header: 'Net paid', numeric: true, align: 'right',
                cell: function (c) { return h('strong', { style: { fontWeight: 500 } }, ui.inr(c.net, { short: true })); } },
              { key: 'payDate', header: 'Pay date', sortable: true, cell: function (c) { return ui.dateLabel(c.payDate); } },
              { key: 'status', header: 'Status', cell: function (c) { return h(ui.StatusChip, { status: c.status }); } }
            ],
            emptyIcon: I.history, emptyTitle: 'No payroll has been run yet',
            emptyBody: 'Completed cycles appear here with their gross, deductions and net.'
          }))));
  }

  /* A payroll run is created here and on the processing screen, so the form is shared. */
  function NewRunModal(p) {
    var form = ui.useForm(nextPeriod());
    function save() {
      var res = form.submit(function (v) { return ui.report(act.initiatePayroll(v)); });
      if (res && res.ok) { p.onClose(); if (p.onCreated) p.onCreated(res.id); }
    }
    return h(ui.Modal, {
      title: 'Start a payroll run', onClose: p.onClose,
      description: 'Step 1 of PRD 4.35. The run opens as a draft with inputs pending, so nothing is paid yet.',
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
        h(V.Button, { variant: 'primary', onClick: save }, 'Create run'))
    },
      h(V.TextField, Object.assign({ label: 'Period', required: true, placeholder: 'e.g. December 2026',
        hint: form.errors.period || 'One cycle per period' }, form.field('period'))),
      h(ui.FieldRow, null,
        h(V.DateField, Object.assign({ label: 'Attendance cut-off' }, form.field('cutoff'))),
        h(V.DateField, Object.assign({ label: 'Payment date', required: true }, form.field('payDate')))),
      h('p', { className: 'muted', style: { fontSize: 13, lineHeight: 1.6 } },
        'The run covers ' + payable().length + ' employees and is valued at '
          + ui.inr(totals(payable()).gross) + ' gross before inputs are applied.'));
  }

  /* ------------------------------------------------------------- Cycles (4.35) */
  function PayrollCycles() {
    var newSt = React.useState(false);
    var rows = cycles();

    return h(React.Fragment, null,
      h(Card, {
        title: 'Payroll cycles', description: 'Every run with its cut-off, payment date and current stage.',
        aside: h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus,
          onClick: function () { newSt[1](true); } }, 'New payroll run')
      },
        h(ui.DataTable, {
          exportName: 'payroll-cycles', label: 'Payroll cycles', rows: rows, pageSize: 10,
          search: function (c) { return c.period + ' ' + c.status + ' ' + c.stage; },
          searchPlaceholder: 'Search by period, status or stage',
          columns: [
            { key: 'period', header: 'Period', sortable: true },
            { key: 'status', header: 'Status', cell: function (c) { return h(ui.StatusChip, { status: c.status }); } },
            { key: 'stage', header: 'Stage' },
            { key: 'cutoff', header: 'Cut-off', sortable: true, cell: function (c) { return ui.shortDate(c.cutoff); } },
            { key: 'payDate', header: 'Pay date', sortable: true, cell: function (c) { return ui.shortDate(c.payDate); } },
            { key: 'employees', header: 'Employees', numeric: true, align: 'right', sortable: true },
            { key: 'gross', header: 'Gross', numeric: true, align: 'right', cell: function (c) { return ui.inr(c.gross, { short: true }); } },
            { key: 'net', header: 'Net', numeric: true, align: 'right',
              cell: function (c) { return h('strong', { style: { fontWeight: 500 } }, ui.inr(c.net, { short: true })); } },
            { key: 'employerCost', header: 'Employer cost', numeric: true, align: 'right',
              cell: function (c) { return ui.inr(c.employerCost, { short: true }); } },
            /* PRD 14.6: a finalized cycle is locked, and the table says so rather than
               offering an edit that the action would refuse. */
            { key: 'locked', header: 'Editable', csv: function (c) { return rules.payrollLocked(c) ? 'Locked' : 'Open'; },
              cell: function (c) {
                return rules.payrollLocked(c)
                  ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'neutral', icon: I.lock }, 'Locked')
                  : h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info', dot: true }, 'Open');
              } },
            { key: 'actions', header: '', align: 'right',
              cell: function (c) {
                return h(V.Button, {
                  variant: rules.payrollLocked(c) ? 'ghost' : 'outline', className: 'vi-btn--sm',
                  onClick: function () { router.goAs(rules.payrollLocked(c) ? 'hr/payroll/payslips' : 'hr/payroll/processing'); }
                }, rules.payrollLocked(c) ? 'Payslips' : 'Process');
              } }
          ],
          emptyIcon: I.card, emptyTitle: 'No payroll cycles yet',
          emptyBody: 'Start a run to pull attendance and leave inputs for a period.',
          emptyActions: h(V.Button, { variant: 'primary', iconStart: I.plus, onClick: function () { newSt[1](true); } }, 'New payroll run')
        })),
      newSt[0] ? h(NewRunModal, {
        onClose: function () { newSt[1](false); },
        onCreated: function () { router.goAs('hr/payroll/processing'); }
      }) : null);
  }

  /* ----------------------------------------------------------- Payslip (4.38) */
  function slipRow(label, amount, extra) {
    return h('div', { className: 'payslip__row' + (extra ? ' ' + extra : ''), key: label },
      h('span', null, label), h('b', null, ui.inr(amount)));
  }

  function PayslipModal(p) {
    var e = p.employee;
    if (!e) return null;
    var b = bOf(e);
    var slip = p.slip || null;
    return h(ui.Modal, {
      title: 'Payslip · ' + p.period, wide: true,
      description: e.name + ' · ' + e.id + ' · ' + deptName(e.department),
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Close'),
        h(V.Button, { variant: 'primary', iconStart: I.download,
          onClick: function () { ui.toast('Payslip for ' + e.name + ' downloaded', 'success'); } }, 'Download PDF'))
    },
      h(ui.KeyValue, { columns: true, rows: [
        ['Employee', e.name],
        ['Employee ID', h('span', { className: 'mono' }, e.id)],
        ['Designation', e.designation],
        ['Department', deptName(e.department)],
        ['Pay period', p.period],
        ['Payment date', ui.dateLabel(slip ? slip.paidOn : p.payDate)],
        ['Salary structure', structureName(e.salaryStructure)],
        ['Loss of pay days', slip ? slip.lopDays : 0],
        ['Bank account', e.bank && e.bank.account ? '•••• ' + String(e.bank.account).slice(-4) : null],
        ['Status', slip
          ? h(ui.StatusChip, { status: slip.status })
          : h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info', dot: true }, 'Preview')]
      ]}),

      h('div', { className: 'payslip' },
        h('div', { className: 'payslip__col' },
          h('span', { className: 'eyebrow' }, 'Earnings'),
          b.earnings.map(function (row) { return slipRow(row[0], row[1]); }),
          slipRow('Gross earnings', b.gross, 'payslip__total')),
        h('div', { className: 'payslip__col' },
          h('span', { className: 'eyebrow' }, 'Deductions'),
          b.deductions.map(function (row) { return slipRow(row[0], row[1]); }),
          slipRow('Total deductions', b.totalDeductions, 'payslip__total'))),

      h('div', { className: 'payslip__net' },
        h('span', null, 'Net pay for ' + p.period),
        h('b', null, ui.inr(b.net))),

      h('p', { className: 'muted', style: { fontSize: 12, lineHeight: 1.6 } },
        'Earnings and deductions are derived from the annual CTC of ' + ui.inr(e.ctc)
          + ' through the assigned salary structure (PRD 4.38). Employer provident fund of '
          + ui.inr(b.employerPf) + ' is a cost to the company and is not deducted from the employee.'));
  }

  /* -------------------------------------------------------- Processing (4.35)
     The run sequence of PRD 4.35 in order: initiate, review inputs, finalize and lock,
     then publish payslips. Every button calls the action and reports what comes back, so
     an out-of-order click shows the refusal from actions.js rather than being hidden. */
  function PayrollProcessing() {
    var all = cycles();
    var pickSt = React.useState((openCycle() || {}).id || '');
    var newSt = React.useState(false);
    var previewSt = React.useState(null);

    var cycle = store.find('payrollCycles', pickSt[0]) || all[0];
    if (!cycle) {
      return h(React.Fragment, null,
        h(Card, { title: 'Payroll processing' },
          h(ui.Empty, {
            icon: I.card, title: 'No payroll cycle to process',
            body: 'Start a run for a period to pull its attendance and leave inputs.',
            actions: h(V.Button, { variant: 'primary', iconStart: I.plus, onClick: function () { newSt[1](true); } }, 'Start a payroll run')
          })),
        newSt[0] ? h(NewRunModal, { onClose: function () { newSt[1](false); }, onCreated: pickSt[1] }) : null);
    }

    var locked = rules.payrollLocked(cycle);                 // PRD 14.6
    var warnings = rules.payrollInputsReady(cycle);          // pending leave and corrections
    var inputs = store.collection('payrollInputs').filter(function (x) { return x.cycle === cycle.id; });
    var slips = store.collection('payslips').filter(function (x) { return x.cycle === cycle.id; });
    var list = payable();
    var t = totals(list);

    var done = {
      initiate: true,
      review: cycle.status !== 'Draft',
      finalize: cycle.status === 'Finalized' || cycle.status === 'Paid',
      publish: cycle.status === 'Paid'
    };
    var STEPS = [
      ['Initiate the run', 'Create the cycle with its cut-off and payment date.', done.initiate],
      ['Pull inputs and review', 'Approved attendance, leave and loss-of-pay rows are applied, then the run moves to review.', done.review],
      ['Approve, finalize and lock', 'Finalizing locks the cycle. Later corrections go through an adjustment (PRD 14.6).', done.finalize],
      ['Generate and publish payslips', 'One payslip per employee in the run, published to the employee workspace.', done.publish]
    ];

    return h(React.Fragment, null,
      h(Grid, null,
        h(Card, {
          span: 7, title: 'Payroll run · ' + cycle.period,
          aside: h(ui.StatusChip, { status: cycle.status }),
          description: 'The sequence in PRD 4.35. Each step refuses to run before the one before it.'
        },
          h(V.Select, {
            label: 'Cycle', value: cycle.id, onChange: pickSt[1],
            options: all.map(function (c) { return { value: c.id, label: c.period + ' · ' + c.status }; })
          }),

          h('div', { className: 'steps' }, STEPS.map(function (s, i) {
            return h('div', { className: 'steps__row' + (s[2] ? ' is-done' : ''), key: s[0] },
              h('span', { className: 'steps__tick' }, I.check),
              h('div', { className: 'checks__main' },
                h('span', { className: 'checks__name' }, (i + 1) + '. ' + s[0]),
                h('span', { className: 'checks__meta' }, s[1])));
          })),

          /* A locked cycle is shown as locked instead of offering edits (PRD 14.6). */
          locked
            ? h('div', { className: 'ai-note' },
                h('span', { className: 'ai-note__mark' }, I.lock),
                h('div', { className: 'ai-note__body' },
                  h('span', { className: 'ai-note__eyebrow' }, 'Locked'),
                  h('p', { className: 'ai-note__text' }, locked),
                  h('div', { className: 'ai-note__acts' },
                    h(V.Button, {
                      variant: cycle.status === 'Finalized' ? 'primary' : 'outline', className: 'vi-btn--sm', iconStart: I.file,
                      onClick: function () { ui.report(act.generatePayslips(cycle.id)); }
                    }, 'Generate payslips'),
                    h(V.Button, {
                      variant: 'ghost', className: 'vi-btn--sm', iconStart: I.plus,
                      onClick: function () { newSt[1](true); }
                    }, 'Start the next run'))))
            : h('div', { className: 'row gap-2 wrap' },
                h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.plus,
                  onClick: function () { newSt[1](true); } }, 'Initiate a run'),
                h(V.Button, {
                  variant: cycle.status === 'Draft' ? 'primary' : 'outline', className: 'vi-btn--sm', iconStart: I.eye,
                  onClick: function () { ui.report(act.reviewPayroll(cycle.id)); }
                }, 'Review payroll'),
                h(V.Button, {
                  variant: cycle.status === 'In Review' ? 'primary' : 'outline', className: 'vi-btn--sm', iconStart: I.lock,
                  onClick: function () { ui.report(act.finalizePayroll(cycle.id)); }
                }, 'Finalize and lock'),
                h(V.Button, {
                  variant: 'outline', className: 'vi-btn--sm', iconStart: I.file,
                  onClick: function () { ui.report(act.generatePayslips(cycle.id)); }
                }, 'Generate payslips'))),

        h(Card, { span: 5, title: 'Run summary' },
          h(ui.KeyValue, { rows: [
            ['Employees in run', cycle.employees],
            ['Eligible today', t.count],
            ['Gross earnings', ui.inr(t.gross)],
            ['Total deductions', ui.inr(t.deductions)],
            ['Net payable', h('strong', null, ui.inr(t.net))],
            ['Employer cost', ui.inr(t.employerCost)],
            ['Cut-off', ui.dateLabel(cycle.cutoff)],
            ['Payment date', ui.dateLabel(cycle.payDate)],
            ['Payslips published', slips.length]
          ]}),
          h('p', { className: 'muted', style: { fontSize: 12, lineHeight: 1.6 } },
            'An exited or invited employee is excluded from the run, so the eligible count can '
              + 'differ from the count stored when the cycle was created.')),

        /* The readiness warnings from rules.payrollInputsReady, shown before review. */
        cycle.status === 'Draft' ? h(Card, {
          span: 7, title: 'Before you review',
          aside: h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: warnings.length ? 'warning' : 'success', dot: true },
            warnings.length ? warnings.length + ' to clear' : 'Inputs ready')
        },
          warnings.length
            ? h('div', { className: 'list' }, warnings.map(function (w, i) {
                return h('div', { className: 'list__row', key: i },
                  h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning', icon: I.warn }, 'Pending'),
                  h('div', { className: 'list__main' },
                    h('span', { className: 'list__title' }, w),
                    h('span', { className: 'list__meta' }, 'Anything approved after the cut-off lands in the next cycle.')),
                  h(V.Button, {
                    variant: 'outline', className: 'vi-btn--sm',
                    onClick: function () { router.goAs(/leave/.test(w) ? 'hr/leave/requests' : 'hr/attendance/regularization'); }
                  }, 'Open'));
              }))
            : h(ui.Empty, { icon: I.ok, title: 'Inputs are ready', body: 'No leave or attendance corrections are waiting on a decision.' })) : null,

        h(Card, { span: cycle.status === 'Draft' ? 5 : 12, title: 'Payroll inputs', description: 'Loss of pay, arrears and one-time inputs applied to this run.' },
          h(ui.DataTable, {
            exportName: 'payroll-inputs-' + cycle.id, label: 'Payroll inputs', rows: inputs, pageSize: 10,
            search: function (x) { return (emp(x.employee) ? emp(x.employee).name : '') + ' ' + x.kind; },
            searchPlaceholder: 'Search by employee or input',
            columns: [
              { key: 'employee', header: 'Employee', csv: function (x) { return emp(x.employee) ? emp(x.employee).name : x.employee; },
                cell: function (x) { return emp(x.employee) ? h(ui.Person, { employee: emp(x.employee) }) : h('span', { className: 'muted' }, '—'); } },
              { key: 'kind', header: 'Input' },
              { key: 'days', header: 'Days', numeric: true, align: 'right' },
              { key: 'source', header: 'Source', cell: function (x) { return h('span', { className: 'mono' }, x.source || '—'); } }
            ],
            emptyIcon: I.clock, emptyTitle: 'No manual inputs in this run',
            emptyBody: 'Approving unpaid leave adds a loss-of-pay row here (PRD 5.1).'
          })),

        h(Card, { span: 12, title: 'Calculation preview', description: 'What each employee would be paid for ' + cycle.period + '.' },
          h(ui.DataTable, {
            exportName: 'payroll-preview-' + cycle.id, label: 'Calculation preview', rows: list, pageSize: 10,
            search: function (e) { return e.name + ' ' + e.id + ' ' + deptName(e.department); },
            searchPlaceholder: 'Search by name, ID or department',
            columns: [
              { key: 'name', header: 'Employee', sortable: true, csv: function (e) { return e.name; },
                cell: function (e) { return h(ui.Person, { employee: e, sub: e.id, onClick: function () { previewSt[1](e.id); } }); } },
              { key: 'department', header: 'Department', csv: function (e) { return deptName(e.department); },
                cell: function (e) { return deptName(e.department); } },
              { key: 'structure', header: 'Structure', csv: function (e) { return structureName(e.salaryStructure); },
                cell: function (e) { return structureName(e.salaryStructure); } },
              { key: 'gross', header: 'Gross', numeric: true, align: 'right', sortable: true,
                sortValue: function (e) { return bOf(e).gross; }, csv: function (e) { return bOf(e).gross; },
                cell: function (e) { return ui.inr(bOf(e).gross); } },
              { key: 'deductions', header: 'Deductions', numeric: true, align: 'right',
                csv: function (e) { return bOf(e).totalDeductions; },
                cell: function (e) { return ui.inr(bOf(e).totalDeductions); } },
              { key: 'net', header: 'Net', numeric: true, align: 'right', csv: function (e) { return bOf(e).net; },
                cell: function (e) { return h('strong', { style: { fontWeight: 500 } }, ui.inr(bOf(e).net)); } },
              { key: 'actions', header: '', align: 'right',
                cell: function (e) {
                  return h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', onClick: function () { previewSt[1](e.id); } }, 'Preview');
                } }
            ],
            emptyIcon: I.users, emptyTitle: 'Nobody is on this payroll',
            emptyBody: 'Employees appear here once they are past the invited stage.'
          }))),

      newSt[0] ? h(NewRunModal, { onClose: function () { newSt[1](false); }, onCreated: pickSt[1] }) : null,
      previewSt[0] ? h(PayslipModal, {
        employee: emp(previewSt[0]), period: cycle.period, payDate: cycle.payDate,
        onClose: function () { previewSt[1](null); }
      }) : null);
  }

  /* ------------------------------------------------ Salary structures (4.34) */
  function SalaryStructures() {
    var openSt = React.useState(false);
    var rows = store.collection('salaryStructures');
    var form = ui.useForm({ effective: seed.todayIso, components: 9, levels: 'Any' });
    var list = payable();
    var t = totals(list);

    function save() {
      var res = form.submit(function (v) { return ui.report(act.createSalaryStructure(v)); });
      if (res && res.ok) { openSt[1](false); form.reset({ effective: seed.todayIso, components: 9, levels: 'Any' }); }
    }

    function assigned(id) {
      return list.filter(function (e) { return e.salaryStructure === id; }).length;
    }

    return h(React.Fragment, null,
      h(Grid, null,
        h(Card, {
          span: 8, title: 'Salary structures', description: 'CTC to net breakdowns, assignable to employees by level or type.',
          aside: h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus,
            onClick: function () { openSt[1](true); } }, 'Create structure')
        },
          h(ui.DataTable, {
            exportName: 'salary-structures', label: 'Salary structures', rows: rows, pageSize: 10,
            search: function (s) { return s.name + ' ' + s.levels; }, searchPlaceholder: 'Search structures',
            columns: [
              { key: 'name', header: 'Structure', sortable: true },
              { key: 'levels', header: 'Job levels' },
              { key: 'components', header: 'Components', numeric: true, align: 'right', sortable: true },
              { key: 'assigned', header: 'Employees', numeric: true, align: 'right',
                csv: function (s) { return assigned(s.id); }, cell: function (s) { return assigned(s.id); } },
              { key: 'effective', header: 'Effective from', csv: function (s) { return s.effective || ''; },
                cell: function (s) { return s.effective ? ui.dateLabel(s.effective) : h('span', { className: 'muted' }, 'Since go-live'); } },
              { key: 'status', header: 'Status', cell: function (s) { return h(ui.StatusChip, { status: s.status }); } }
            ],
            emptyIcon: I.card, emptyTitle: 'No salary structures yet',
            emptyBody: 'A structure decides how a CTC is split into earnings, deductions and employer contributions.',
            emptyActions: h(V.Button, { variant: 'primary', iconStart: I.plus, onClick: function () { openSt[1](true); } }, 'Create structure')
          })),

        h(Card, { span: 4, title: 'Across the payroll' },
          h(ui.KeyValue, { rows: [
            ['Employees paid', t.count],
            ['Average annual CTC', ui.inr(t.count ? Math.round(t.ctc / t.count) : 0)],
            ['Average monthly gross', ui.inr(t.count ? Math.round(t.gross / t.count) : 0)],
            ['Average monthly net', ui.inr(t.count ? Math.round(t.net / t.count) : 0)],
            ['Deduction rate', ui.pct(t.deductions, t.gross) + '% of gross']
          ]}),
          h('p', { className: 'muted', style: { fontSize: 12, lineHeight: 1.6 } },
            'PRD 14.6: a salary change needs an effective date, and the previous value stays in the '
              + 'employment history rather than being overwritten.'),
          h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.right,
            onClick: function () { router.goAs('hr/payroll/components'); } }, 'Components'))),

      openSt[0] ? h(ui.Modal, {
        title: 'Create salary structure', onClose: function () { openSt[1](false); },
        description: 'A structure needs an effective date, because salary changes are dated (PRD 14.6).',
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { openSt[1](false); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: save }, 'Create structure'))
      },
        h(V.TextField, Object.assign({ label: 'Structure name', required: true, placeholder: 'e.g. Senior Leadership' }, form.field('name'))),
        h(ui.FieldRow, null,
          h(V.TextField, Object.assign({ label: 'Job levels', placeholder: 'e.g. 5–7' }, form.field('levels'))),
          h(V.NumberField, Object.assign({ label: 'Components', min: 1, max: 20 }, form.field('components', { number: true })))),
        h(V.DateField, Object.assign({ label: 'Effective from', required: true,
          hint: form.errors.effective || 'Applied to payroll runs with a cut-off on or after this date' }, form.field('effective')))) : null);
  }

  /* ---------------------------------------------------- Components (4.34) */
  function SalaryComponents() {
    var t = totals(payable());
    var components = store.collection('salaryComponents');

    /* Each component's monthly total, summed from the employee breakdowns. The employer
       provident fund is carried separately because it never appears on the payslip. */
    function amountOf(c) {
      if (c.name === 'Provident Fund — employer') return t.employerPf;
      return t.lines[c.name] || 0;
    }

    var GROUPS = [
      ['Earning', 'Earnings', 'Paid to the employee and summed into monthly gross.'],
      ['Deduction', 'Deductions', 'Withheld from gross to arrive at net pay.'],
      ['Employer Contribution', 'Employer contributions', 'A cost to the company above gross, never deducted from the employee.']
    ];

    return h(React.Fragment, null,
      h(Stats, { cols: 3 },
        h(Stat, { label: 'Monthly gross', value: ui.inr(t.gross, { short: true }), sub: components.filter(function (c) { return c.kind === 'Earning'; }).length + ' earning components' }),
        h(Stat, { label: 'Monthly deductions', value: ui.inr(t.deductions, { short: true }), sub: ui.pct(t.deductions, t.gross) + '% of gross' }),
        h(Stat, { label: 'Employer contributions', value: ui.inr(t.employerCost - t.gross, { short: true }), sub: 'Above gross, per month' })),

      h(Grid, null, GROUPS.map(function (g) {
        var rows = components.filter(function (c) { return c.kind === g[0]; });
        var groupTotal = rows.reduce(function (n, c) { return n + amountOf(c); }, 0);
        return h(Card, {
          key: g[0], span: 12, title: g[1], description: g[2],
          aside: h(V.Chip, { size: 'sm', shape: 'tag' }, ui.inr(groupTotal) + ' / month')
        },
          h(ui.DataTable, {
            exportName: 'salary-components-' + g[0].toLowerCase().replace(/ /g, '-'),
            label: g[1], rows: rows, pageSize: 10,
            search: function (c) { return c.name + ' ' + c.calc; }, searchPlaceholder: 'Search components',
            columns: [
              { key: 'name', header: 'Component', sortable: true },
              { key: 'calc', header: 'Calculation method' },
              { key: 'taxable', header: 'Taxable', align: 'center', csv: function (c) { return c.taxable ? 'Yes' : 'No'; },
                cell: function (c) {
                  return c.taxable
                    ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning' }, 'Taxable')
                    : h('span', { className: 'muted' }, 'Exempt');
                } },
              { key: 'total', header: 'Total / month', numeric: true, align: 'right',
                csv: function (c) { return amountOf(c); }, cell: function (c) { return ui.inr(amountOf(c)); } },
              { key: 'average', header: 'Average / employee', numeric: true, align: 'right',
                csv: function (c) { return t.count ? Math.round(amountOf(c) / t.count) : 0; },
                cell: function (c) { return ui.inr(t.count ? Math.round(amountOf(c) / t.count) : 0); } },
              { key: 'share', header: 'Share of group', csv: function (c) { return ui.pct(amountOf(c), groupTotal) + '%'; },
                cell: function (c) { return h(V.ProgressBar, { value: ui.pct(amountOf(c), groupTotal), size: 'sm', 'aria-label': c.name }); } }
            ],
            emptyIcon: I.card, emptyTitle: 'No ' + g[1].toLowerCase() + ' configured',
            emptyBody: 'Components added in payroll configuration appear here with their calculation method.'
          }));
      })));
  }

  /* -------------------------------------------------------- Payslips (4.38) */
  function Payslips() {
    var cycleSt = React.useState('');
    var openSt = React.useState(null);
    var all = store.collection('payslips');
    var rows = cycleSt[0] ? all.filter(function (s) { return s.cycle === cycleSt[0]; }) : all;
    var netTotal = rows.reduce(function (n, s) { return n + s.net; }, 0);
    var periods = {};
    all.forEach(function (s) { periods[s.period] = true; });

    return h(React.Fragment, null,
      h(Stats, { cols: 3 },
        h(Stat, { label: 'Payslips published', value: rows.length, sub: Object.keys(periods).length + ' periods on record' }),
        h(Stat, { label: 'Net paid', value: ui.inr(netTotal, { short: true }), sub: 'For the selected periods' }),
        h(Stat, { label: 'Average net', value: ui.inr(rows.length ? Math.round(netTotal / rows.length) : 0), sub: 'Per payslip' })),

      h(Card, { title: 'Payslips', description: 'Published payslips, downloadable by HR and visible to the employee.' },
        h(ui.DataTable, {
          exportName: 'payslips', label: 'Payslips', rows: rows, pageSize: 10,
          search: function (s) { return (emp(s.employee) ? emp(s.employee).name + ' ' + s.employee : '') + ' ' + s.period; },
          searchPlaceholder: 'Search by employee, ID or period',
          filters: h(ui.Filter, {
            label: 'Cycle', value: cycleSt[0], onChange: cycleSt[1],
            options: cycles().map(function (c) { return { value: c.id, label: c.period }; })
          }),
          columns: [
            { key: 'employee', header: 'Employee', sortable: true,
              sortValue: function (s) { return emp(s.employee) ? emp(s.employee).name : s.employee; },
              csv: function (s) { return emp(s.employee) ? emp(s.employee).name : s.employee; },
              cell: function (s) {
                return emp(s.employee)
                  ? h(ui.Person, { employee: emp(s.employee), sub: s.employee, onClick: function () { openSt[1](s.id); } })
                  : h('span', { className: 'muted' }, s.employee);
              } },
            { key: 'period', header: 'Period', sortable: true },
            { key: 'gross', header: 'Gross', numeric: true, align: 'right', cell: function (s) { return ui.inr(s.gross); } },
            { key: 'deductions', header: 'Deductions', numeric: true, align: 'right', cell: function (s) { return ui.inr(s.deductions); } },
            { key: 'net', header: 'Net pay', numeric: true, align: 'right', sortable: true,
              cell: function (s) { return h('strong', { style: { fontWeight: 500 } }, ui.inr(s.net)); } },
            { key: 'paidOn', header: 'Paid on', cell: function (s) { return ui.dateLabel(s.paidOn); } },
            { key: 'status', header: 'Status', cell: function (s) { return h(ui.StatusChip, { status: s.status }); } },
            { key: 'actions', header: '', align: 'right',
              cell: function (s) {
                return h(V.Button, { variant: 'outline', className: 'vi-btn--sm', onClick: function () { openSt[1](s.id); } }, 'View');
              } }
          ],
          emptyIcon: I.file, emptyTitle: 'No payslips for this selection',
          emptyBody: 'Payslips are created when a finalized cycle is published on the processing screen.',
          emptyActions: h(V.Button, { variant: 'primary', iconStart: I.right, onClick: function () { router.goAs('hr/payroll/processing'); } }, 'Open processing')
        })),

      openSt[0] ? (function () {
        var slip = store.find('payslips', openSt[0]);
        if (!slip) return null;
        return h(PayslipModal, {
          employee: emp(slip.employee), period: slip.period, slip: slip,
          onClose: function () { openSt[1](null); }
        });
      })() : null);
  }

  /* ------------------------------------------------ Tax declarations (4.37) */
  function TaxDeclarations() {
    var regimeSt = React.useState(''), statusSt = React.useState('');
    var all = store.collection('taxDeclarations');
    var rows = all;
    if (regimeSt[0]) rows = rows.filter(function (x) { return x.regime === regimeSt[0]; });
    if (statusSt[0]) rows = rows.filter(function (x) { return x.status === statusSt[0]; });

    var declared = all.reduce(function (n, x) { return n + x.declared; }, 0);
    var verified = all.filter(function (x) { return x.status === 'Verified'; }).length;
    var pending = all.filter(function (x) { return x.status === 'Pending Verification'; }).length;
    var notStarted = all.filter(function (x) { return x.status === 'Not Started'; }).length;
    var regimeRows = ['New', 'Old'].map(function (r) {
      return [r + ' regime', all.filter(function (x) { return x.regime === r; }).length, r === 'New' ? 'info' : null];
    });

    return h(React.Fragment, null,
      h(Stats, null,
        h(Stat, { label: 'Declarations', value: all.length, sub: notStarted + ' not yet submitted', tone: notStarted ? 'warn' : 'good' }),
        h(Stat, { label: 'Total declared', value: ui.inr(declared, { short: true }), sub: 'Investment and exemption claims' }),
        h(Stat, { label: 'Verified', value: verified, sub: ui.pct(verified, all.length) + '% of declarations', tone: 'good' }),
        h(Stat, { label: 'Awaiting verification', value: pending, sub: 'Proofs to check before the next run', tone: pending ? 'warn' : null })),

      h(Grid, null,
        h(Card, { span: 8, title: 'Tax declarations', description: 'Regime, declared amount, proofs and verification state for FY 2026-27 (PRD 4.37).' },
          h(ui.DataTable, {
            exportName: 'tax-declarations', label: 'Tax declarations', rows: rows, pageSize: 10,
            search: function (x) { return (emp(x.employee) ? emp(x.employee).name + ' ' + x.employee : '') + ' ' + x.regime; },
            searchPlaceholder: 'Search by employee or regime',
            filters: h(React.Fragment, null,
              h(ui.Filter, { label: 'Regime', value: regimeSt[0], onChange: regimeSt[1], options: ['New', 'Old'] }),
              h(ui.Filter, { label: 'Status', value: statusSt[0], onChange: statusSt[1],
                options: ['Not Started', 'Pending Verification', 'Verified'] })),
            columns: [
              { key: 'employee', header: 'Employee', sortable: true,
                sortValue: function (x) { return emp(x.employee) ? emp(x.employee).name : x.employee; },
                csv: function (x) { return emp(x.employee) ? emp(x.employee).name : x.employee; },
                cell: function (x) { return emp(x.employee) ? h(ui.Person, { employee: emp(x.employee), sub: x.employee }) : h('span', { className: 'muted' }, x.employee); } },
              { key: 'year', header: 'Financial year' },
              { key: 'regime', header: 'Regime', cell: function (x) { return h(V.Chip, { size: 'sm', shape: 'tag' }, x.regime); } },
              { key: 'declared', header: 'Declared', numeric: true, align: 'right', sortable: true,
                cell: function (x) { return x.declared ? ui.inr(x.declared) : h('span', { className: 'muted' }, '—'); } },
              { key: 'proofs', header: 'Proofs', numeric: true, align: 'right' },
              { key: 'submittedOn', header: 'Submitted', csv: function (x) { return x.submittedOn || ''; },
                cell: function (x) { return x.submittedOn ? ui.dateLabel(x.submittedOn) : h('span', { className: 'muted' }, 'Not submitted'); } },
              { key: 'status', header: 'Status', cell: function (x) { return h(ui.StatusChip, { status: x.status }); } }
            ],
            emptyIcon: I.file, emptyTitle: 'No declarations match this filter',
            emptyBody: 'Employees submit a declaration from their own payroll screens; HR verifies the proofs here.'
          })),

        h(Card, { span: 4, title: 'Regime split' },
          h(ui.Bars, { rows: regimeRows, emptyTitle: 'No declarations yet' }),
          h(ui.KeyValue, { rows: [
            ['Average declared', ui.inr(all.length ? Math.round(declared / all.length) : 0)],
            ['Proofs on file', all.reduce(function (n, x) { return n + x.proofs; }, 0)],
            ['Verification outstanding', pending + notStarted]
          ]}),
          h('p', { className: 'muted', style: { fontSize: 12, lineHeight: 1.6 } },
            'Tax deducted at source is recalculated from the verified declaration at the next '
              + 'payroll run, so a late proof moves the correction to the following cycle.'))));
  }

  /* ======================================================= PERFORMANCE (4.47) */
  function PerformanceDashboard() {
    var cycle = perfOpen();
    var asm = cycle ? assessmentsIn(cycle.id) : [];
    var selfIn = asm.filter(function (a) { return a.self === 'Submitted'; }).length;
    var mgrIn = asm.filter(function (a) { return a.manager === 'Submitted'; }).length;
    var rated = asm.filter(function (a) { return a.rating; });
    var goals = cycle ? goalsIn(cycle.id) : [];
    var achieved = goals.filter(function (g) { return g.status === 'Achieved'; }).length;
    var avgProgress = goals.length
      ? Math.round(goals.reduce(function (n, g) { return n + g.progress; }, 0) / goals.length) : 0;

    var progressRows = [
      ['Awaiting self-assessment', asm.filter(function (a) { return a.status === 'Awaiting Self-Assessment'; }).length, 'warning'],
      ['Awaiting manager', asm.filter(function (a) { return a.status === 'Awaiting Manager'; }).length, 'info'],
      ['Manager review done', mgrIn, 'success']
    ];
    var ratingRows = RATINGS.map(function (r) {
      return ['Rating ' + r, rated.filter(function (a) { return Number(a.rating) === r; }).length,
        r >= 4 ? 'success' : r === 3 ? 'info' : 'warning'];
    });

    var goalDept = {};
    goals.forEach(function (g) {
      var e = emp(g.employee);
      if (!e) return;
      var row = goalDept[e.department] || (goalDept[e.department] = {
        id: e.department, department: e.department, goals: 0, progress: 0, achieved: 0
      });
      row.goals += 1; row.progress += g.progress;
      if (g.status === 'Achieved') row.achieved += 1;
    });
    var goalRows = Object.keys(goalDept).map(function (k) { return goalDept[k]; })
      .sort(function (a, b) { return b.goals - a.goals; });

    return h(React.Fragment, null,
      h(Stats, null,
        h(Stat, { label: 'Employees in cycle', value: asm.length, sub: cycle ? cycle.name : 'No open cycle' }),
        h(Stat, { label: 'Self-assessments in', value: selfIn, sub: ui.pct(selfIn, asm.length) + '% of the cycle', tone: selfIn < asm.length ? 'warn' : 'good' }),
        h(Stat, { label: 'Manager reviews done', value: mgrIn, sub: (asm.length - mgrIn) + ' still open', tone: mgrIn < asm.length ? 'warn' : 'good' }),
        h(Stat, { label: 'Completion rate', value: ui.pct(mgrIn, asm.length), unit: '%', sub: 'Reviews submitted against eligible' })),

      h(Grid, null,
        h(Card, { span: 7, title: 'Review progress', description: cycle ? cycle.name + ' · ' + cycle.period : 'No cycle is open.' },
          h(ui.Bars, { rows: progressRows, emptyTitle: 'No assessments in this cycle' }),
          h(V.ProgressBar, { label: 'Cycle completion', value: ui.pct(mgrIn, asm.length), showValue: true,
            tone: ui.pct(mgrIn, asm.length) > 75 ? 'success' : 'primary' }),
          h('div', { className: 'row gap-2 wrap' },
            h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.checklist,
              onClick: function () { router.goAs('hr/performance/reviews'); } }, 'Open reviews'),
            h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.target,
              onClick: function () { router.goAs('hr/performance/goals'); } }, 'Goals'))),

        h(Card, { span: 5, title: 'Rating distribution',
          aside: h(V.Chip, { size: 'sm', shape: 'tag' }, (cycle ? cycle.ratingScale : '1 – 5') + ' scale') },
          h(ui.Bars, { rows: ratingRows, emptyTitle: 'No ratings yet' }),
          h('p', { className: 'muted', style: { fontSize: 12, lineHeight: 1.6 } },
            rated.length
              ? rated.length + ' of ' + asm.length + ' assessments carry a rating. Compare teams on the calibration screen before publishing.'
              : 'A rating appears here as each manager review is submitted, and calibration compares the spread across departments before results are published.')),

        h(Card, { span: 12, title: 'Goal progress by department', description: 'Goals and KPIs in the open cycle (PRD 4.46).' },
          h(ui.DataTable, {
            exportName: 'goal-progress-by-department', label: 'Goal progress by department', rows: goalRows, pageSize: 10,
            search: function (r) { return deptName(r.department); }, searchPlaceholder: 'Search departments',
            columns: [
              { key: 'department', header: 'Department', sortable: true,
                sortValue: function (r) { return deptName(r.department); },
                csv: function (r) { return deptName(r.department); }, cell: function (r) { return deptName(r.department); } },
              { key: 'goals', header: 'Goals', numeric: true, align: 'right', sortable: true },
              { key: 'achieved', header: 'Achieved', numeric: true, align: 'right', sortable: true },
              { key: 'average', header: 'Average progress', numeric: true, align: 'right',
                csv: function (r) { return Math.round(r.progress / r.goals) + '%'; },
                cell: function (r) { return Math.round(r.progress / r.goals) + '%'; } },
              { key: 'bar', header: '', cell: function (r) {
                  return h(V.ProgressBar, { value: Math.round(r.progress / r.goals), size: 'sm', 'aria-label': deptName(r.department) });
                } }
            ],
            emptyIcon: I.target, emptyTitle: 'No goals in the open cycle',
            emptyBody: 'Goals assigned to employees appear here, grouped by department.'
          })),

        h(Card, { span: 12, title: 'Cycles' },
          h(ui.KeyValue, { columns: true, rows: [
            ['Open cycle', cycle ? cycle.name : null],
            ['Period under review', cycle ? cycle.period : null],
            ['Window', cycle ? ui.dateLabel(cycle.from) + ' → ' + ui.dateLabel(cycle.to) : null],
            ['Status', cycle ? h(ui.StatusChip, { status: cycle.status }) : null],
            ['Goals in cycle', goals.length + ' · ' + achieved + ' achieved'],
            ['Average goal progress', avgProgress + '%']
          ]}))));
  }

  /* ------------------------------------------------- Appraisal cycles (4.44) */
  function AppraisalCycles() {
    var openSt = React.useState(false);
    var form = ui.useForm({ ratingScale: '1 – 5' });
    var rows = perfCycles();

    function save() {
      var res = form.submit(function (v) { return ui.report(act.createAppraisalCycle(v)); });
      if (res && res.ok) { openSt[1](false); form.reset({ ratingScale: '1 – 5' }); }
    }

    function stateOf(c) {
      var asm = assessmentsIn(c.id);
      var mgr = asm.filter(function (a) { return a.manager === 'Submitted'; }).length;
      return { asm: asm, done: mgr, pct: ui.pct(mgr, asm.length) };
    }

    return h(React.Fragment, null,
      h(Card, {
        title: 'Appraisal cycles', description: 'Period, eligibility, reviewers and workflow for each cycle (PRD 4.44).',
        aside: h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus,
          onClick: function () { openSt[1](true); } }, 'Create cycle')
      },
        h(ui.DataTable, {
          exportName: 'appraisal-cycles', label: 'Appraisal cycles', rows: rows, pageSize: 10,
          search: function (c) { return c.name + ' ' + c.period + ' ' + c.status; },
          searchPlaceholder: 'Search by name, period or status',
          columns: [
            { key: 'name', header: 'Cycle', sortable: true },
            { key: 'period', header: 'Period under review' },
            { key: 'from', header: 'Window', csv: function (c) { return c.from + ' to ' + c.to; },
              cell: function (c) { return ui.shortDate(c.from) + ' → ' + ui.shortDate(c.to); } },
            { key: 'ratingScale', header: 'Scale' },
            { key: 'eligible', header: 'Eligible', numeric: true, align: 'right', sortable: true },
            { key: 'assessments', header: 'Assessments', numeric: true, align: 'right',
              csv: function (c) { return stateOf(c).asm.length; }, cell: function (c) { return stateOf(c).asm.length; } },
            { key: 'progress', header: 'Reviews done', csv: function (c) { return stateOf(c).pct + '%'; },
              cell: function (c) {
                var s = stateOf(c);
                return s.asm.length
                  ? h(V.ProgressBar, { value: s.pct, size: 'sm', 'aria-label': c.name + ' completion' })
                  : h('span', { className: 'muted' }, 'Not launched');
              } },
            { key: 'status', header: 'Status', cell: function (c) { return h(ui.StatusChip, { status: c.status }); } },
            { key: 'actions', header: '', align: 'right',
              cell: function (c) {
                /* PRD 5.1: launching a cycle generates one assessment per active employee. */
                if (c.status === 'Scheduled') {
                  return h(V.Button, {
                    variant: 'primary', className: 'vi-btn--sm', iconStart: I.play,
                    onClick: function () { ui.report(act.launchAppraisalCycle(c.id)); }
                  }, 'Launch');
                }
                return h(V.Button, {
                  variant: 'outline', className: 'vi-btn--sm',
                  onClick: function () { router.goAs(c.status === 'Completed' ? 'hr/performance/results' : 'hr/performance/reviews'); }
                }, c.status === 'Completed' ? 'Results' : 'Reviews');
              } }
          ],
          emptyIcon: I.target, emptyTitle: 'No appraisal cycles yet',
          emptyBody: 'Create a cycle, then launch it to generate an assessment for every active employee.',
          emptyActions: h(V.Button, { variant: 'primary', iconStart: I.plus, onClick: function () { openSt[1](true); } }, 'Create cycle')
        })),

      openSt[0] ? h(ui.Modal, {
        title: 'Create appraisal cycle', onClose: function () { openSt[1](false); },
        description: 'Creating a cycle schedules it. Launching it generates the review tasks (PRD 5.1).',
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { openSt[1](false); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: save }, 'Create cycle'))
      },
        h(V.TextField, Object.assign({ label: 'Cycle name', required: true, placeholder: 'e.g. H1 FY2027 Appraisal' }, form.field('name'))),
        h(V.TextField, Object.assign({ label: 'Period under review', placeholder: 'e.g. Jan – Jun 2027' }, form.field('period'))),
        h(ui.FieldRow, null,
          h(V.DateField, Object.assign({ label: 'Opens on', required: true }, form.field('from'))),
          h(V.DateField, Object.assign({ label: 'Closes on', required: true }, form.field('to')))),
        h(V.Select, Object.assign({ label: 'Rating scale', options: ['1 – 5', '1 – 4', '1 – 10'] }, form.select('ratingScale'))),
        h('p', { className: 'muted', style: { fontSize: 13, lineHeight: 1.6 } },
          store.collection('employees').filter(function (e) { return e.status === 'Active'; }).length
            + ' active employees are eligible today. A self-assessment must be in before the manager can review (PRD 14.7).')) : null);
  }

  /* ------------------------------------------------------- Criteria (4.43) */
  function Criteria() {
    var cycle = perfOpen();
    var each = Math.floor(100 / seed.competencies.length);
    var rows = seed.competencies.map(function (name, i) {
      return {
        id: 'cmp-' + i, name: name,
        weight: i === seed.competencies.length - 1 ? 100 - each * (seed.competencies.length - 1) : each,
        scale: cycle ? cycle.ratingScale : '1 – 5',
        appliesTo: 'All employees', status: 'Active'
      };
    });
    var SCALE = [
      [1, 'Needs improvement', 'Expectations are not consistently met; a support plan is agreed.'],
      [2, 'Developing', 'Meets some expectations, with gaps the manager names in the review.'],
      [3, 'Meets expectations', 'Delivers the role as defined. The expected rating for most people.'],
      [4, 'Exceeds expectations', 'Delivers beyond the role and lifts the team around them.'],
      [5, 'Outstanding', 'Rare, organization-level impact. Calibrated across departments before publishing.']
    ].map(function (r) { return { id: r[0], score: r[0], label: r[1], meaning: r[2] }; });

    return h(Grid, null,
      h(Card, { span: 7, title: 'Competencies', description: 'What every review scores, alongside the goals of PRD 4.46.' },
        h(ui.DataTable, {
          exportName: 'performance-competencies', label: 'Competencies', rows: rows, pageSize: 10,
          search: function (r) { return r.name; }, searchPlaceholder: 'Search competencies',
          columns: [
            { key: 'name', header: 'Competency', sortable: true },
            { key: 'weight', header: 'Weight', numeric: true, align: 'right', sortable: true,
              cell: function (r) { return r.weight + '%'; } },
            { key: 'scale', header: 'Rating scale' },
            { key: 'appliesTo', header: 'Applies to' },
            { key: 'status', header: 'Status', cell: function (r) { return h(ui.StatusChip, { status: r.status }); } }
          ],
          emptyIcon: I.checklist, emptyTitle: 'No competencies configured',
          emptyBody: 'Competencies set in performance configuration appear here with their weighting.'
        }),
        h('p', { className: 'muted', style: { fontSize: 12, lineHeight: 1.6 } },
          'Weights are split evenly across the ' + seed.competencies.length
            + ' competencies and are edited in performance configuration (PRD 4.43).')),

      h(Card, { span: 5, title: 'Rating scale', aside: h(V.Chip, { size: 'sm', shape: 'tag' }, cycle ? cycle.ratingScale : '1 – 5') },
        h(ui.DataTable, {
          exportName: 'performance-rating-scale', label: 'Rating scale', rows: SCALE, pageSize: 10, onExport: false,
          search: function (r) { return r.label + ' ' + r.meaning; }, searchPlaceholder: 'Search the scale',
          columns: [
            { key: 'score', header: 'Score', numeric: true, align: 'right' },
            { key: 'label', header: 'Label' },
            { key: 'meaning', header: 'What it means' }
          ],
          emptyIcon: I.star, emptyTitle: 'No rating scale configured',
          emptyBody: 'A cycle needs a scale before reviews can be submitted.'
        }),
        h(ui.KeyValue, { rows: [
          ['Goal weighting', '60% of the final score'],
          ['Competency weighting', '40% of the final score'],
          ['Written summary', 'Required with every manager rating'],
          ['Calibration', 'Compared by department before publishing (PRD 4.45)']
        ]})));
  }

  /* ---------------------------------------------------------- Goals (4.46) */
  function Goals() {
    var addSt = React.useState(false);
    var editSt = React.useState(null);
    var deptSt = React.useState(''), statusSt = React.useState('');
    var cycle = perfOpen();

    var addForm = ui.useForm({ cycle: cycle ? cycle.id : '', due: '2026-12-31', weight: 20 });
    var progressSt = React.useState(0);

    var rows = store.collection('goals');
    if (deptSt[0]) rows = rows.filter(function (g) { var e = emp(g.employee); return e && e.department === deptSt[0]; });
    if (statusSt[0]) rows = rows.filter(function (g) { return g.status === statusSt[0]; });

    var achieved = rows.filter(function (g) { return g.status === 'Achieved'; }).length;
    var inProgress = rows.filter(function (g) { return g.status === 'In Progress'; }).length;
    var notStarted = rows.filter(function (g) { return g.status === 'Not Started'; }).length;

    function saveGoal() {
      var res = addForm.submit(function (v) {
        if (!v.employee) return { ok: false, errors: { employee: 'Choose the employee the goal belongs to' } };
        return ui.report(act.createGoal(v.employee, v));
      });
      if (res && res.ok) { addSt[1](false); addForm.reset({ cycle: cycle ? cycle.id : '', due: '2026-12-31', weight: 20 }); }
    }
    function saveProgress() {
      var res = ui.report(act.updateGoalProgress(editSt[0], progressSt[0]));
      if (res && res.ok) editSt[1](null);
    }

    var editing = editSt[0] ? store.find('goals', editSt[0]) : null;

    return h(React.Fragment, null,
      h(Stats, null,
        h(Stat, { label: 'Goals', value: rows.length, sub: cycle ? cycle.name : 'All cycles' }),
        h(Stat, { label: 'Achieved', value: achieved, sub: ui.pct(achieved, rows.length) + '% of the selection', tone: 'good' }),
        h(Stat, { label: 'In progress', value: inProgress, sub: 'Moving, not yet complete' }),
        h(Stat, { label: 'Not started', value: notStarted, sub: 'No progress recorded', tone: notStarted ? 'warn' : null })),

      h(Card, {
        title: 'Goals & KPIs', description: 'Goals assigned across the organization, with weight, progress and due date.',
        aside: h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus,
          onClick: function () { addSt[1](true); } }, 'Add goal')
      },
        h(ui.DataTable, {
          exportName: 'performance-goals', label: 'Goals', rows: rows, pageSize: 10,
          search: function (g) { return (emp(g.employee) ? emp(g.employee).name : '') + ' ' + g.title; },
          searchPlaceholder: 'Search by employee or goal',
          filters: h(React.Fragment, null,
            h(ui.Filter, { label: 'Department', value: deptSt[0], onChange: deptSt[1], options: deptOptions() }),
            h(ui.Filter, { label: 'Status', value: statusSt[0], onChange: statusSt[1],
              options: ['Not Started', 'In Progress', 'Achieved'] })),
          columns: [
            { key: 'employee', header: 'Employee', sortable: true,
              sortValue: function (g) { return emp(g.employee) ? emp(g.employee).name : g.employee; },
              csv: function (g) { return emp(g.employee) ? emp(g.employee).name : g.employee; },
              cell: function (g) {
                return emp(g.employee) ? h(ui.Person, { employee: emp(g.employee) }) : h('span', { className: 'muted' }, g.employee);
              } },
            { key: 'title', header: 'Goal', sortable: true },
            { key: 'weight', header: 'Weight', numeric: true, align: 'right', cell: function (g) { return g.weight + '%'; } },
            { key: 'progress', header: 'Progress', numeric: true, align: 'right', sortable: true,
              csv: function (g) { return g.progress + '%'; },
              cell: function (g) { return h(V.ProgressBar, { value: g.progress, size: 'sm', showValue: true, 'aria-label': g.title }); } },
            { key: 'status', header: 'Status', cell: function (g) { return h(ui.StatusChip, { status: g.status }); } },
            { key: 'due', header: 'Due', sortable: true, cell: function (g) { return ui.dateLabel(g.due); } },
            { key: 'actions', header: '', align: 'right',
              cell: function (g) {
                return h(V.Button, {
                  variant: 'outline', className: 'vi-btn--sm',
                  onClick: function () { editSt[1](g.id); progressSt[1](g.progress); }
                }, 'Update');
              } }
          ],
          emptyIcon: I.target, emptyTitle: 'No goals match this view',
          emptyBody: 'Add a goal for an employee, or clear the filters to see the whole organization.',
          emptyActions: h(V.Button, { variant: 'primary', iconStart: I.plus, onClick: function () { addSt[1](true); } }, 'Add goal')
        })),

      addSt[0] ? h(ui.Modal, {
        title: 'Add goal', onClose: function () { addSt[1](false); },
        description: 'Goals carry a weight out of 100 and roll into the appraisal score (PRD 4.46).',
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { addSt[1](false); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: saveGoal }, 'Add goal'))
      },
        h(ui.EmployeePicker, {
          label: 'Employee', value: addForm.values.employee,
          status: addForm.errors.employee ? 'error' : undefined, hint: addForm.errors.employee,
          onChange: function (v) { addForm.set('employee', v); }
        }),
        h(V.TextField, Object.assign({ label: 'Goal', required: true, placeholder: 'e.g. Cut p95 API latency by 30%' }, addForm.field('title'))),
        h(ui.FieldRow, null,
          h(V.NumberField, Object.assign({ label: 'Weight (%)', min: 0, max: 100, step: 5 }, addForm.field('weight', { number: true }))),
          h(V.DateField, Object.assign({ label: 'Due date' }, addForm.field('due')))),
        h(V.Select, Object.assign({ label: 'Cycle', options: perfOptions() }, addForm.select('cycle')))) : null,

      editing ? h(ui.Modal, {
        title: 'Update progress', onClose: function () { editSt[1](null); },
        description: editing.title + ' · ' + (emp(editing.employee) ? emp(editing.employee).name : editing.employee),
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { editSt[1](null); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: saveProgress }, 'Save progress'))
      },
        h(V.NumberField, {
          label: 'Progress (%)', min: 0, max: 100, step: 5, value: progressSt[0],
          onChange: function (e) { progressSt[1](Number(e.target.value) || 0); },
          hint: '100% marks the goal achieved; anything above zero marks it in progress.'
        }),
        h(V.ProgressBar, { label: 'New progress', value: Number(progressSt[0]) || 0, showValue: true }),
        h(ui.KeyValue, { rows: [
          ['Current progress', editing.progress + '%'],
          ['Weight', editing.weight + '%'],
          ['Status', h(ui.StatusChip, { status: editing.status })],
          ['Due', ui.dateLabel(editing.due)]
        ]})) : null);
  }

  /* -------------------------------------------------------- Reviews (4.45) */
  function ReviewModal(p) {
    var a = p.assessment;
    var e = emp(a.employee);
    var reviewer = a.reviewer ? emp(a.reviewer) : null;
    var me = store.persona(store.pref('role'));
    var form = ui.useForm({ rating: '', summary: '', asMe: false });
    var goals = store.collection('goals').filter(function (g) { return g.employee === a.employee && g.cycle === a.cycle; });

    /* PRD 14.7: the assigned reviewer, and only after the self-assessment is in. */
    var blocked = rules.canReview(a, a.reviewer);

    function save() {
      var res = form.submit(function (v) {
        var reviewerId = v.asMe ? (me || {}).id : a.reviewer;
        return ui.report(act.submitManagerReview(reviewerId, a.id, { rating: v.rating, summary: v.summary }));
      });
      if (res && res.ok) p.onClose();
    }

    return h(ui.Modal, {
      title: 'Manager review · ' + (e ? e.name : a.employee), wide: true,
      description: a.cycle + ' · self-assessment ' + a.self.toLowerCase() + ' · review ' + a.manager.toLowerCase(),
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
        h(V.Button, { variant: 'primary', onClick: save }, 'Submit review'))
    },
      h(ui.KeyValue, { columns: true, rows: [
        ['Employee', e ? e.name : a.employee],
        ['Department', e ? deptName(e.department) : null],
        ['Assigned reviewer', reviewer ? reviewer.name : h('span', { className: 'muted' }, 'None assigned')],
        ['Self-assessment', h(ui.StatusChip, { status: a.self === 'Submitted' ? 'Submitted' : 'Not Started' })],
        ['Goals in cycle', goals.length],
        ['Average goal progress', goals.length
          ? Math.round(goals.reduce(function (n, g) { return n + g.progress; }, 0) / goals.length) + '%' : null]
      ]}),

      blocked ? h('div', { className: 'ai-note' },
        h('span', { className: 'ai-note__mark' }, I.warn),
        h('div', { className: 'ai-note__body' },
          h('span', { className: 'ai-note__eyebrow' }, 'This review will be refused'),
          h('p', { className: 'ai-note__text' }, blocked + ' (PRD 14.7).'))) : null,

      goals.length ? h(Card, { className: 'card--quiet', title: 'Goals under review' },
        h('div', { className: 'list' }, goals.slice(0, 6).map(function (g) {
          return h('div', { className: 'list__row', key: g.id },
            h('div', { className: 'list__main' },
              h('span', { className: 'list__title' }, g.title),
              h('span', { className: 'list__meta' }, g.weight + '% weight · due ' + ui.dateLabel(g.due))),
            h('span', { style: { width: 84 } }, h(V.ProgressBar, { value: g.progress, size: 'sm', 'aria-label': g.title })));
        }))) : null,

      h(V.Select, Object.assign({
        label: 'Overall rating', required: true, placeholder: 'Choose a rating',
        options: RATINGS.map(function (r) { return { value: String(r), label: String(r) }; })
      }, form.select('rating'))),
      h(V.TextArea, Object.assign({ label: 'Review summary', rows: 4,
        placeholder: 'What went well, what to work on, and the agreed focus for the next cycle.' }, form.field('summary'))),

      h('div', { className: 'checks' },
        h('div', { className: 'checks__row' },
          h(V.Switch, Object.assign({ 'aria-label': 'Submit as me instead of the assigned reviewer' }, form.check('asMe'))),
          h('div', { className: 'checks__main' },
            h('span', { className: 'checks__name' }, 'Submit as me'
              + (me ? ' (' + me.name + ')' : '') + ' instead of the assigned reviewer'),
            h('span', { className: 'checks__meta' },
              'PRD 14.7 refuses a review from anyone other than the assigned reviewer. Leave this off to submit as '
                + (reviewer ? reviewer.name : 'the assigned reviewer') + '.')))));
  }

  function Reviews() {
    var cycleSt = React.useState((perfOpen() || {}).id || '');
    var statusSt = React.useState('');
    var openSt = React.useState(null);

    var rows = store.collection('assessments');
    if (cycleSt[0]) rows = rows.filter(function (a) { return a.cycle === cycleSt[0]; });
    if (statusSt[0]) rows = rows.filter(function (a) { return a.status === statusSt[0]; });

    var selfIn = rows.filter(function (a) { return a.self === 'Submitted'; }).length;
    var mgrIn = rows.filter(function (a) { return a.manager === 'Submitted'; }).length;
    var open = openSt[0] ? store.find('assessments', openSt[0]) : null;

    return h(React.Fragment, null,
      h(Stats, { cols: 3 },
        h(Stat, { label: 'Assessments', value: rows.length, sub: 'In the selected cycle' }),
        h(Stat, { label: 'Self-assessments in', value: selfIn, sub: ui.pct(selfIn, rows.length) + '% submitted' }),
        h(Stat, { label: 'Manager reviews in', value: mgrIn, sub: (rows.length - mgrIn) + ' still open', tone: rows.length - mgrIn ? 'warn' : 'good' })),

      h(Card, { title: 'Reviews', description: 'Self-assessment and manager review progress for every employee in the cycle (PRD 4.45).' },
        h(ui.DataTable, {
          exportName: 'performance-reviews', label: 'Reviews', rows: rows, pageSize: 10,
          search: function (a) {
            return (emp(a.employee) ? emp(a.employee).name : '') + ' '
              + (a.reviewer && emp(a.reviewer) ? emp(a.reviewer).name : '') + ' ' + a.status;
          },
          searchPlaceholder: 'Search by employee, reviewer or status',
          filters: h(React.Fragment, null,
            h(ui.Filter, { label: 'Cycle', value: cycleSt[0], onChange: cycleSt[1], options: perfOptions() }),
            h(ui.Filter, { label: 'Status', value: statusSt[0], onChange: statusSt[1],
              options: ['Awaiting Self-Assessment', 'Awaiting Manager', 'Manager Review Done'] })),
          columns: [
            { key: 'employee', header: 'Employee', sortable: true,
              sortValue: function (a) { return emp(a.employee) ? emp(a.employee).name : a.employee; },
              csv: function (a) { return emp(a.employee) ? emp(a.employee).name : a.employee; },
              cell: function (a) {
                return emp(a.employee)
                  ? h(ui.Person, { employee: emp(a.employee), sub: deptName(emp(a.employee).department) })
                  : h('span', { className: 'muted' }, a.employee);
              } },
            { key: 'reviewer', header: 'Reviewer', csv: function (a) { return a.reviewer && emp(a.reviewer) ? emp(a.reviewer).name : ''; },
              cell: function (a) {
                return a.reviewer && emp(a.reviewer)
                  ? h(ui.Person, { employee: emp(a.reviewer), sub: null })
                  : h('span', { className: 'muted' }, 'Not assigned');
              } },
            { key: 'self', header: 'Self-assessment',
              cell: function (a) { return h(ui.StatusChip, { status: a.self === 'Submitted' ? 'Submitted' : 'Not Started' }); } },
            { key: 'manager', header: 'Manager review',
              cell: function (a) { return h(ui.StatusChip, { status: a.manager === 'Submitted' ? 'Submitted' : 'Not Started' }); } },
            { key: 'rating', header: 'Rating', numeric: true, align: 'right',
              csv: function (a) { return a.rating || ''; },
              cell: function (a) { return a.rating ? h('strong', { style: { fontWeight: 500 } }, a.rating) : h('span', { className: 'muted' }, '—'); } },
            { key: 'status', header: 'Stage', cell: function (a) { return h(ui.StatusChip, { status: a.status }); } },
            { key: 'actions', header: '', align: 'right',
              cell: function (a) {
                return h(V.Button, {
                  variant: a.status === 'Awaiting Manager' ? 'primary' : 'outline', className: 'vi-btn--sm',
                  onClick: function () { openSt[1](a.id); }
                }, a.manager === 'Submitted' ? 'View' : 'Review');
              } }
          ],
          emptyIcon: I.checklist, emptyTitle: 'No assessments in this cycle',
          emptyBody: 'Launch the cycle from the cycles screen to generate one assessment per active employee.',
          emptyActions: h(V.Button, { variant: 'primary', iconStart: I.right, onClick: function () { router.goAs('hr/performance/cycles'); } }, 'Open cycles')
        })),

      open ? h(ReviewModal, { assessment: open, onClose: function () { openSt[1](null); } }) : null);
  }

  /* ---------------------------------------------------- Calibration (4.45) */
  function Calibration() {
    var cycleSt = React.useState((perfOpen() || {}).id || '');
    var asm = cycleSt[0] ? assessmentsIn(cycleSt[0]) : store.collection('assessments');
    var rated = asm.filter(function (a) { return a.rating; });

    var rows = store.collection('departments').map(function (d) {
      var mine = asm.filter(function (a) { var e = emp(a.employee); return e && e.department === d.id; });
      var mineRated = mine.filter(function (a) { return a.rating; });
      var row = {
        id: d.id, department: d.name, inCycle: mine.length,
        reviewed: mine.filter(function (a) { return a.manager === 'Submitted'; }).length,
        rated: mineRated.length,
        average: mineRated.length
          ? Math.round((mineRated.reduce(function (n, a) { return n + Number(a.rating); }, 0) / mineRated.length) * 10) / 10
          : null
      };
      RATINGS.forEach(function (r) {
        row['r' + r] = mineRated.filter(function (a) { return Number(a.rating) === r; }).length;
      });
      return row;
    }).filter(function (r) { return r.inCycle > 0; });

    var overall = RATINGS.map(function (r) {
      return ['Rating ' + r, rated.filter(function (a) { return Number(a.rating) === r; }).length,
        r >= 4 ? 'success' : r === 3 ? 'info' : 'warning'];
    });
    var avgRows = rows.filter(function (r) { return r.average != null; })
      .map(function (r) { return [r.department, r.average, r.average >= 4 ? 'success' : r.average >= 3 ? 'info' : 'warning']; })
      .sort(function (a, b) { return b[1] - a[1]; });
    var orgAverage = rated.length
      ? Math.round((rated.reduce(function (n, a) { return n + Number(a.rating); }, 0) / rated.length) * 10) / 10 : null;

    var columns = [
      { key: 'department', header: 'Department', sortable: true },
      { key: 'inCycle', header: 'In cycle', numeric: true, align: 'right', sortable: true },
      { key: 'reviewed', header: 'Reviewed', numeric: true, align: 'right', sortable: true }
    ].concat(RATINGS.map(function (r) {
      return { key: 'r' + r, header: String(r), numeric: true, align: 'right' };
    })).concat([
      { key: 'average', header: 'Average', numeric: true, align: 'right', sortable: true,
        csv: function (r) { return r.average == null ? '' : r.average; },
        cell: function (r) {
          return r.average == null ? h('span', { className: 'muted' }, '—')
            : h('strong', { style: { fontWeight: 500 } }, r.average.toFixed(1));
        } },
      { key: 'spread', header: 'Against the organization',
        csv: function (r) { return r.average == null || orgAverage == null ? '' : (r.average - orgAverage).toFixed(1); },
        cell: function (r) {
          if (r.average == null || orgAverage == null) return h('span', { className: 'muted' }, 'Not yet rated');
          var gap = Math.round((r.average - orgAverage) * 10) / 10;
          return h(V.Chip, {
            size: 'sm', shape: 'tag', variant: 'soft', dot: true,
            tone: gap > 0.3 ? 'warning' : gap < -0.3 ? 'info' : 'success'
          }, (gap > 0 ? '+' : '') + gap.toFixed(1));
        } }
    ]);

    return h(React.Fragment, null,
      h(Grid, null,
        h(Card, {
          span: 12, title: 'Calibration by department',
          description: 'Compare the rating spread across teams before results are published, so one manager’s scale does not become the organization’s (PRD 4.45).'
        },
          h(ui.DataTable, {
            exportName: 'performance-calibration', label: 'Calibration by department', rows: rows, pageSize: 10,
            search: function (r) { return r.department; }, searchPlaceholder: 'Search departments',
            filters: h(ui.Filter, { label: 'Cycle', value: cycleSt[0], onChange: cycleSt[1], options: perfOptions() }),
            columns: columns,
            emptyIcon: I.reports, emptyTitle: 'Nothing to calibrate yet',
            emptyBody: 'Departments appear here once the cycle is launched and assessments exist.'
          })),

        h(Card, { span: 7, title: 'Average rating by department' },
          h(ui.Bars, { rows: avgRows, emptyTitle: 'No ratings submitted yet' }),
          h('p', { className: 'muted', style: { fontSize: 12, lineHeight: 1.6 } },
            orgAverage == null
              ? 'Averages appear as manager reviews are submitted. Until then the distribution is empty rather than estimated.'
              : 'Organization average is ' + orgAverage.toFixed(1) + ' across ' + rated.length + ' rated assessments.')),

        h(Card, { span: 5, title: 'Organization distribution' },
          h(ui.Bars, { rows: overall, emptyTitle: 'No ratings submitted yet' }),
          h(ui.KeyValue, { rows: [
            ['Assessments', asm.length],
            ['Reviews submitted', asm.filter(function (a) { return a.manager === 'Submitted'; }).length],
            ['Carrying a rating', rated.length],
            ['Organization average', orgAverage == null ? null : orgAverage.toFixed(1)]
          ]}),
          h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.right,
            onClick: function () { router.goAs('hr/performance/results'); } }, 'Results'))));
  }

  /* --------------------------------------------------------- Results (4.45) */
  function Results() {
    var cycleSt = React.useState((perfOpen() || {}).id || '');
    var cycle = store.find('perfCycles', cycleSt[0]) || perfCycles()[0];
    var asm = cycle ? assessmentsIn(cycle.id) : [];
    var incomplete = asm.filter(function (a) { return a.manager !== 'Submitted'; });
    var rated = asm.filter(function (a) { return a.rating; });

    return h(React.Fragment, null,
      h(Grid, null,
        h(Card, {
          span: 5, title: 'Publication', aside: cycle ? h(ui.StatusChip, { status: cycle.status }) : null,
          description: 'Results are published to employees once every review is in (PRD 4.45).'
        },
          h(V.Select, {
            label: 'Cycle', value: cycle ? cycle.id : '', onChange: cycleSt[1], options: perfOptions()
          }),
          cycle
            ? h(React.Fragment, null,
                h(ui.KeyValue, { rows: [
                  ['Cycle', cycle.name],
                  ['Period', cycle.period],
                  ['Assessments', asm.length],
                  ['Reviews submitted', asm.length - incomplete.length],
                  ['Still incomplete', incomplete.length],
                  ['Published on', cycle.publishedOn ? ui.dateLabel(cycle.publishedOn) : null]
                ]}),
                h(V.ProgressBar, {
                  label: 'Reviews complete', value: ui.pct(asm.length - incomplete.length, asm.length), showValue: true,
                  tone: incomplete.length ? 'warning' : 'success'
                }),
                /* publishResults refuses while any review is open; the message is surfaced. */
                h(V.Button, {
                  variant: 'primary', iconStart: I.send,
                  onClick: function () { ui.report(act.publishResults(cycle.id)); }
                }, 'Publish results'),
                incomplete.length
                  ? h('p', { className: 'muted', style: { fontSize: 12, lineHeight: 1.6 } },
                      incomplete.length + ' review' + (incomplete.length === 1 ? '' : 's')
                        + ' are still open, so publishing is refused until they are submitted.')
                  : h('p', { className: 'muted', style: { fontSize: 12, lineHeight: 1.6 } },
                      'Every review is in. Publishing closes the cycle and shows each employee their rating.'))
            : h(ui.Empty, { icon: I.target, title: 'No cycle to publish', body: 'Create and launch an appraisal cycle first.' })),

        h(Card, { span: 7, title: 'Final results', description: 'Approved ratings and reviewers for the selected cycle.' },
          h(ui.DataTable, {
            exportName: 'performance-results', label: 'Final results', rows: asm, pageSize: 10,
            search: function (a) { return (emp(a.employee) ? emp(a.employee).name : '') + ' ' + a.status; },
            searchPlaceholder: 'Search by employee or stage',
            columns: [
              { key: 'employee', header: 'Employee', sortable: true,
                sortValue: function (a) { return emp(a.employee) ? emp(a.employee).name : a.employee; },
                csv: function (a) { return emp(a.employee) ? emp(a.employee).name : a.employee; },
                cell: function (a) {
                  return emp(a.employee) ? h(ui.Person, { employee: emp(a.employee) }) : h('span', { className: 'muted' }, a.employee);
                } },
              { key: 'department', header: 'Department',
                csv: function (a) { return emp(a.employee) ? deptName(emp(a.employee).department) : ''; },
                cell: function (a) { return emp(a.employee) ? deptName(emp(a.employee).department) : '—'; } },
              { key: 'reviewer', header: 'Reviewer',
                csv: function (a) { return a.reviewer && emp(a.reviewer) ? emp(a.reviewer).name : ''; },
                cell: function (a) { return a.reviewer && emp(a.reviewer) ? emp(a.reviewer).name : h('span', { className: 'muted' }, 'Not assigned'); } },
              { key: 'rating', header: 'Rating', numeric: true, align: 'right', sortable: true,
                csv: function (a) { return a.rating || ''; },
                cell: function (a) { return a.rating ? h('strong', { style: { fontWeight: 500 } }, a.rating) : h('span', { className: 'muted' }, 'Not rated'); } },
              { key: 'status', header: 'Stage', cell: function (a) { return h(ui.StatusChip, { status: a.status }); } },
              { key: 'published', header: 'Visible to employee',
                csv: function (a) { return cycle && cycle.status === 'Completed' ? 'Yes' : 'No'; },
                cell: function () {
                  return cycle && cycle.status === 'Completed'
                    ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'success', dot: true }, 'Published')
                    : h('span', { className: 'muted' }, 'Held');
                } }
            ],
            emptyIcon: I.target, emptyTitle: 'No results in this cycle',
            emptyBody: 'Results appear once the cycle is launched and its reviews are submitted.'
          }),
          h('p', { className: 'muted', style: { fontSize: 12, lineHeight: 1.6 } },
            rated.length + ' of ' + asm.length + ' assessments carry a rating. '
              + 'A rating is set by the manager review and can be normalised on the calibration screen before publishing.'))));
  }

  /* ============================================== Payroll configuration (4.34) */
  function PayrollConfig() {
    var cycle = openCycle();
    var t = totals(payable());

    /* PRD 4.34: statutory rules are configurable per jurisdiction and are not
       presented as universal, so each row names the jurisdiction it belongs to. */
    var STATUTORY = [
      { id: 'pf', rule: 'Provident Fund', jurisdiction: 'India', basis: '12% of basic salary, employee and employer',
        applies: 'Mandatory up to a basic of ' + ui.inr(15000) + ' a month, voluntary above it', status: 'Active' },
      { id: 'pt', rule: 'Professional Tax', jurisdiction: 'India — Telangana, Karnataka, Maharashtra',
        basis: 'State slab on monthly gross', applies: 'Slab differs by state; set per work location', status: 'Active' },
      { id: 'tds', rule: 'Tax Deducted at Source', jurisdiction: 'India', basis: 'Projected annual tax ÷ 12',
        applies: 'Recalculated when a declaration is verified', status: 'Active' },
      { id: 'gratuity', rule: 'Gratuity', jurisdiction: 'India', basis: '15 days’ wages for each completed year',
        applies: 'On exit, after five years of continuous service', status: 'Active' },
      { id: 'esi', rule: 'Employees’ State Insurance', jurisdiction: 'India', basis: '0.75% employee, 3.25% employer',
        applies: 'Gross up to ' + ui.inr(21000) + ' a month', status: 'Not Configured' },
      { id: 'lwf', rule: 'Labour Welfare Fund', jurisdiction: 'India — Karnataka, Maharashtra',
        basis: 'Flat contribution, half-yearly', applies: 'Applicable in some states only', status: 'Not Configured' }
    ];

    var WORKFLOW = [
      ['Prepared by', 'HR Administrator', 'Pulls approved attendance, leave and one-time inputs for the period.'],
      ['Reviewed by', 'Finance Controller', 'Checks the variance against the previous cycle before approval.'],
      ['Approved by', 'Organization Admin', 'Approval finalizes and locks the cycle (PRD 14.6).'],
      ['Published by', 'HR Administrator', 'Payslips are generated and published to the employee workspace.']
    ].map(function (r, i) { return { id: i, step: i + 1, role: r[1], stage: r[0], detail: r[2] }; });

    return h(Grid, null,
      h(Card, { span: 7, title: 'Run settings', description: 'Frequency, cut-off and payment date for every cycle (PRD 4.34).' },
        h(ui.KeyValue, { rows: [
          ['Frequency', 'Monthly'],
          ['Attendance cut-off', '25th of the month'],
          ['Payment date', 'Last working day of the month'],
          ['Current cycle', cycle ? cycle.period + ' · ' + cycle.stage : null],
          ['Pay currency', seed.org.currency + ' (₹)'],
          ['Rounding', 'Nearest rupee'],
          ['Arrears', 'Paid in the next cycle after approval'],
          ['Loss of pay', 'Gross ÷ calendar days, per unpaid day'],
          ['Monthly payroll value', ui.inr(t.gross) + ' gross · ' + ui.inr(t.net) + ' net']
        ]}),
        h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.right,
          onClick: function () { router.goAs('hr/payroll/components'); } }, 'Salary components')),

      h(Card, { span: 5, title: 'Options' },
        h('div', { className: 'checks' },
          [['Lock the cycle on finalization', true],
            ['Hold payslips until the payment date', true],
            ['Email a payslip when it is published', true],
            ['Let employees download past payslips', true],
            ['Block a run while leave approvals are pending', false],
            ['Require a second approver above ' + ui.inr(5000000), true]].map(function (row) {
            return h('div', { className: 'checks__row', key: row[0] },
              h(V.Switch, { defaultChecked: row[1], 'aria-label': row[0],
                onChange: function (e) { ui.toast(row[0] + ' ' + (e.target.checked ? 'enabled' : 'disabled'), 'success'); } }),
              h('div', { className: 'checks__main' }, h('span', { className: 'checks__name' }, row[0])));
          })),
        h('p', { className: 'muted', style: { fontSize: 12, lineHeight: 1.6 } },
          'PRD 14.6: once a cycle is finalized it cannot be edited. A correction is raised as an '
            + 'adjustment in the next run, so the paid figures stay auditable.')),

      h(Card, { span: 12, title: 'Statutory rules',
        description: 'PRD 4.34: statutory rules are configurable per jurisdiction and are not assumed to be universal.' },
        h(ui.DataTable, {
          exportName: 'payroll-statutory-rules', label: 'Statutory rules', rows: STATUTORY, pageSize: 10,
          search: function (r) { return r.rule + ' ' + r.jurisdiction + ' ' + r.basis; },
          searchPlaceholder: 'Search rules or jurisdictions',
          columns: [
            { key: 'rule', header: 'Rule', sortable: true },
            { key: 'jurisdiction', header: 'Jurisdiction', sortable: true },
            { key: 'basis', header: 'Calculation basis' },
            { key: 'applies', header: 'Applies to' },
            { key: 'status', header: 'Status', cell: function (r) { return h(ui.StatusChip, { status: r.status }); } }
          ],
          emptyIcon: I.shield, emptyTitle: 'No statutory rules configured',
          emptyBody: 'Add the rules that apply to each jurisdiction the organization pays in.'
        })),

      h(Card, { span: 12, title: 'Approval workflow',
        description: 'Who prepares, reviews, approves and publishes a payroll run (PRD 4.34 and 6.3).' },
        h(ui.DataTable, {
          exportName: 'payroll-approval-workflow', label: 'Payroll approval workflow', rows: WORKFLOW, pageSize: 10, onExport: false,
          search: function (r) { return r.stage + ' ' + r.role + ' ' + r.detail; },
          searchPlaceholder: 'Search the workflow',
          columns: [
            { key: 'step', header: 'Step', numeric: true, align: 'right' },
            { key: 'stage', header: 'Stage' },
            { key: 'role', header: 'Role', cell: function (r) { return h(V.Chip, { size: 'sm', shape: 'tag' }, r.role); } },
            { key: 'detail', header: 'What happens' }
          ],
          emptyIcon: I.relate, emptyTitle: 'No approval workflow configured',
          emptyBody: 'A payroll run needs at least one approver before it can be finalized.'
        }),
        h('div', { className: 'row gap-2 wrap' },
          h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.right,
            onClick: function () { router.goAs('hr/payroll/processing'); } }, 'Open processing'),
          h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', iconStart: I.relate,
            onClick: function () { router.goAs('hr/config/workflows'); } }, 'Approval workflows'))));
  }

  /* ========================================== Performance configuration (4.43) */
  function PerformanceConfig() {
    var cycle = perfOpen();
    var each = Math.floor(100 / seed.competencies.length);
    var competencyRows = seed.competencies.map(function (name, i) {
      return {
        id: 'cfg-cmp-' + i, name: name,
        weight: i === seed.competencies.length - 1 ? 100 - each * (seed.competencies.length - 1) : each,
        appliesTo: 'All employees', scale: cycle ? cycle.ratingScale : '1 – 5', status: 'Active'
      };
    });
    var HIERARCHY = [
      ['Self-assessment', 'Employee', 'Must be submitted before the manager can review (PRD 14.7).'],
      ['Manager review', 'Reporting manager', 'Only the assigned reviewer may submit it.'],
      ['Calibration', 'Department head', 'Ratings are compared across teams before publishing.'],
      ['Publication', 'HR Administrator', 'Refused while any review in the cycle is incomplete.']
    ].map(function (r, i) { return { id: i, step: i + 1, stage: r[0], owner: r[1], detail: r[2] }; });

    return h(Grid, null,
      h(Card, { span: 6, title: 'Cycle defaults', description: 'Applied to every appraisal cycle created from here (PRD 4.43).' },
        h(ui.KeyValue, { rows: [
          ['Frequency', 'Half-yearly'],
          ['Open cycle', cycle ? cycle.name : null],
          ['Rating scale', cycle ? cycle.ratingScale : '1 – 5'],
          ['Self-assessment window', '14 days from the cycle opening'],
          ['Manager review window', '14 days after self-assessments close'],
          ['Goal weighting', '60% of the final score'],
          ['Competency weighting', '40% of the final score'],
          ['Eligibility', 'Active employees who joined before the period end'],
          ['Cycles on record', perfCycles().length]
        ]}),
        h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.right,
          onClick: function () { router.goAs('hr/performance/cycles'); } }, 'Appraisal cycles')),

      h(Card, { span: 6, title: 'Options' },
        h('div', { className: 'checks' },
          [['Self-assessment is mandatory before a manager review', true],
            ['A written summary is required with every rating', true],
            ['Peer feedback is collected alongside the manager review', false],
            ['Calibration is required before results are published', true],
            ['Employees see their rating once results are published', true],
            ['Goals carry a weight that must total 100', true]].map(function (row) {
            return h('div', { className: 'checks__row', key: row[0] },
              h(V.Switch, { defaultChecked: row[1], 'aria-label': row[0],
                onChange: function (e) { ui.toast(row[0] + ' ' + (e.target.checked ? 'enabled' : 'disabled'), 'success'); } }),
              h('div', { className: 'checks__main' }, h('span', { className: 'checks__name' }, row[0])));
          })),
        h('p', { className: 'muted', style: { fontSize: 12, lineHeight: 1.6 } },
          'The first two options are enforced as rules, not preferences: rules.canReview refuses a '
            + 'review whose self-assessment is missing, and refuses anyone who is not the assigned reviewer.')),

      h(Card, { span: 7, title: 'Competencies', description: 'What every review scores, with its weighting.' },
        h(ui.DataTable, {
          exportName: 'performance-config-competencies', label: 'Competencies', rows: competencyRows, pageSize: 10,
          search: function (r) { return r.name; }, searchPlaceholder: 'Search competencies',
          columns: [
            { key: 'name', header: 'Competency', sortable: true },
            { key: 'weight', header: 'Weight', numeric: true, align: 'right', cell: function (r) { return r.weight + '%'; } },
            { key: 'scale', header: 'Scale' },
            { key: 'appliesTo', header: 'Applies to' },
            { key: 'status', header: 'Status', cell: function (r) { return h(ui.StatusChip, { status: r.status }); } }
          ],
          emptyIcon: I.checklist, emptyTitle: 'No competencies configured',
          emptyBody: 'A cycle needs at least one competency before reviews can be scored.'
        }),
        h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', iconStart: I.right,
          onClick: function () { router.goAs('hr/performance/criteria'); } }, 'Criteria')),

      h(Card, { span: 5, title: 'Review hierarchy', description: 'The order a review moves through (PRD 4.45).' },
        h(ui.DataTable, {
          exportName: 'performance-review-hierarchy', label: 'Review hierarchy', rows: HIERARCHY, pageSize: 10, onExport: false,
          search: function (r) { return r.stage + ' ' + r.owner; }, searchPlaceholder: 'Search the hierarchy',
          columns: [
            { key: 'step', header: 'Step', numeric: true, align: 'right' },
            { key: 'stage', header: 'Stage' },
            { key: 'owner', header: 'Owner', cell: function (r) { return h(V.Chip, { size: 'sm', shape: 'tag' }, r.owner); } }
          ],
          emptyIcon: I.relate, emptyTitle: 'No review hierarchy configured',
          emptyBody: 'Define who reviews, calibrates and publishes before launching a cycle.'
        }),
        h('div', { className: 'list' }, HIERARCHY.map(function (r) {
          return h('div', { className: 'list__row', key: r.id },
            h('div', { className: 'list__main' },
              h('span', { className: 'list__title' }, r.stage),
              h('span', { className: 'list__meta' }, r.detail)));
        }))));
  }

  /* ---------------------------------------------------------------- Register */
  HRMS.screens.register({
    'hr/payroll/dashboard': PayrollDashboard,
    'hr/payroll/cycles': PayrollCycles,
    'hr/payroll/processing': PayrollProcessing,
    'hr/payroll/structures': SalaryStructures,
    'hr/payroll/components': SalaryComponents,
    'hr/payroll/payslips': Payslips,
    'hr/payroll/tax': TaxDeclarations,

    'hr/performance/dashboard': PerformanceDashboard,
    'hr/performance/cycles': AppraisalCycles,
    'hr/performance/criteria': Criteria,
    'hr/performance/goals': Goals,
    'hr/performance/reviews': Reviews,
    'hr/performance/calibration': Calibration,
    'hr/performance/results': Results,

    'hr/config/payroll': PayrollConfig,
    'hr/config/performance': PerformanceConfig
  });

  /* Shared with the employee workspace, which shows the same payslip (PRD 4.37). */
  HRMS.screens.PayslipModal = PayslipModal;
})();

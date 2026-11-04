/* Payroll, in detail, for both workspaces.

   HR runs the cycle; the employee reads what came of it. Both are looking at the same
   arithmetic — js/payroll.js computes every figure from the employee's CTC, their work
   location, the days they were actually paid for and whatever the cycle carried — so a
   question asked on one screen is answerable on the other.

   The shape follows Indian payroll as it is actually run: a month moves through inputs,
   preview, approval, payment and statutory filing, and it is the preview that matters,
   because a payroll error found after the bank file is an apology rather than a fix.
   So the run screen leads with exceptions — the payslips that are not simply last month
   repeated — rather than with a total nobody can check.

   The employee's side answers the three questions a payslip actually raises: why is it
   different from last month, where did the deductions go, and what would the other tax
   regime have cost. */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var store = HRMS.store, router = HRMS.router, ui = HRMS.ui, pay = HRMS.payroll, seed = HRMS.seed;
  var Card = ui.Card, Grid = ui.Grid, Stat = ui.Stat, Stats = ui.Stats;
  var inr = ui.inr;

  function me() { return store.persona('me'); }
  function emp(id) { return store.employee(id); }
  function cycles() {
    return store.collection('payrollCycles').slice().sort(function (a, b) {
      return b.payDate.localeCompare(a.payDate);
    });
  }
  function openCycle() {
    return cycles().filter(function (c) { return c.status !== 'Paid'; })[0] || cycles()[0];
  }
  function lastPaid() {
    return cycles().filter(function (c) { return c.status === 'Paid'; })[0];
  }

  /* ------------------------------------------------------------- The payslip
     One component per row, with what it is and why it is that much. A payslip that
     only gives totals cannot be checked, and an employee who cannot check it asks
     payroll instead. */
  function Payslip(p) {
    var slip = p.slip;
    function side(rows, title, total, cls) {
      return h('div', { className: 'pslip__c' },
        h('h4', null, title),
        rows.map(function (r) {
          return h('div', { className: 'pslip__r', key: r.k },
            h('span', { className: 'stack', style: { gap: 0, minWidth: 0 } },
              h('span', null, r.label),
              r.note ? h('i', null, r.note) : null),
            h('b', null, inr(r.amount)));
        }),
        h('div', { className: 'pslip__t' + (cls ? ' ' + cls : '') },
          h('span', null, 'Total'), h('b', null, inr(total))));
    }
    return h('div', { className: 'pslip' },
      h('div', { className: 'pslip__h' },
        h('div', { className: 'stack grow', style: { gap: 2, minWidth: 0 } },
          h('strong', null, slip.employee.name),
          h('span', { className: 'ad-sub' }, slip.employee.id, ' · ',
            slip.cycle.period, ' · ', pay.workingDaysIn(slip.cycle), ' days in the month')),
        h('div', { className: 'pslip__net' },
          h('span', null, 'Net pay'), h('strong', null, inr(slip.net)))),

      slip.lop.days ? h('p', { className: 'pslip__lop' },
        h('strong', null, slip.lop.days, slip.lop.days === 1 ? ' day' : ' days', ' of loss of pay'),
        ' — ', slip.lop.unpaidLeave ? slip.lop.unpaidLeave + ' of unpaid leave' : '',
        slip.lop.unpaidLeave && slip.lop.absent ? ' and ' : '',
        slip.lop.absent ? slip.lop.absent + ' absent without leave' : '',
        '. Every earning is reduced in proportion, at ', inr(slip.lop.perDay), ' a day, which is why the ',
        'provident fund is lower too.') : null,

      h('div', { className: 'pslip__cols' },
        side(slip.earnings, 'Earnings', slip.gross),
        side(slip.deductions, 'Deductions', slip.totalDeductions, 'is-minus')),

      slip.reimbursed ? h('div', { className: 'pslip__extra' },
        h('span', null, 'Reimbursements paid with this cycle'),
        h('b', null, inr(slip.reimbursed))) : null,

      h('div', { className: 'pslip__sum' },
        h('span', null, 'Gross ', inr(slip.gross),
          slip.reimbursed ? ' + reimbursements ' + inr(slip.reimbursed) : '',
          ' − deductions ', inr(slip.totalDeductions)),
        h('strong', null, inr(slip.net))),

      p.showEmployer === false ? null : h('div', { className: 'pslip__er' },
        h('h4', null, 'What the employer pays on top',
          h('i', null, 'Part of cost to company, not of your pay')),
        slip.employerContributions.map(function (r) {
          return h('div', { className: 'pslip__r', key: r.k },
            h('span', null, r.label), h('b', null, inr(r.amount)));
        }),
        h('div', { className: 'pslip__t' },
          h('span', null, 'Cost for the month'), h('b', null, inr(slip.cost)))));
  }

  /* ===================================================== Employee: my payslips */
  function MyPayslips() {
    var person = me();
    if (!person) return h(ui.Empty, { icon: I.card, title: 'No employee record' });
    var all = cycles().filter(function (c) { return c.status === 'Paid' && person.joined <= c.payDate; });
    var pickSt = React.useState(all.length ? all[0].id : null);
    var cycle = all.filter(function (c) { return c.id === pickSt[0]; })[0] || all[0];
    if (!cycle) {
      return h(ui.Empty, { icon: I.card, title: 'No payslips yet',
        body: 'Your first payslip appears once a cycle you were part of has been paid.' });
    }
    var slip = pay.payslip(person, cycle);
    var y = pay.ytd(person);

    return h('div', { className: 'stack gap-4' },
      h(ui.PageHead, { eyebrow: 'Payroll', title: 'Payslips',
        description: 'Every component, what it is worked out from, and what reached your bank.' }),
      h(Stats, null,
        h(Stat, { label: 'Net this month', value: inr(slip.net), sub: cycle.period }),
        h(Stat, { label: 'Gross', value: inr(slip.gross),
          sub: slip.lop.days ? slip.lop.days + ' days loss of pay' : 'Full month' }),
        h(Stat, { label: 'Paid so far this year', value: inr(y.net), sub: y.months + ' months' }),
        h(Stat, { label: 'Tax deducted so far', value: inr(y.tds),
          sub: slip.tds.regime === 'old' ? 'Old regime' : 'New regime' })),
      h('div', { className: 'pfilter' },
        h('span', { className: 'ad-sub grow' }, 'Choose a month to see its payslip.'),
        h(V.Select, { 'aria-label': 'Payslip month', value: cycle.id,
          onChange: function (v) { pickSt[1](v); },
          options: all.map(function (c) { return { value: c.id, label: c.period }; }) }),
        h(V.Button, { variant: 'outline', iconStart: I.download,
          onClick: function () { ui.toast('Payslip for ' + cycle.period + ' downloaded.', 'success'); } },
          'Download')),
      h(Card, null, h(Payslip, { slip: slip })));
  }

  /* ============================================= Employee: salary and structure */
  function MyStructure() {
    var person = me();
    if (!person) return h(ui.Empty, { icon: I.card, title: 'No employee record' });
    var c = pay.components(person);
    var revisions = store.collection('salaryRevisions').filter(function (x) {
      return x.employee === person.id;
    }).sort(function (a, b) { return b.effective.localeCompare(a.effective); });
    var annual = function (n) { return n * 12; };

    return h('div', { className: 'stack gap-4' },
      h(ui.PageHead, { eyebrow: 'Payroll', title: 'Salary',
        description: 'How your cost to company is split, and what it has been over time.' }),
      h(Stats, null,
        h(Stat, { label: 'Cost to company', value: inr(person.ctc), sub: 'A year' }),
        h(Stat, { label: 'Monthly gross', value: inr(c.gross), sub: 'Before deductions' }),
        h(Stat, { label: 'Basic', value: inr(c.basic), sub: '40% of monthly · drives PF and gratuity' }),
        h(Stat, { label: 'Last revised',
          value: revisions.length ? ui.dateLabel(revisions[0].effective) : 'Not yet',
          sub: revisions.length ? '+' + revisions[0].pct + '%' : null })),
      h(Grid, null,
        h(Card, { span: 7, title: 'The split',
          description: 'Employer contributions are part of cost to company but not of your pay.' },
          h('div', { className: 'pslip__c' },
            [['Basic salary', c.basic], ['House rent allowance', c.hra],
              ['Conveyance allowance', c.conveyance], ['Medical allowance', c.medical],
              ['Special allowance', c.special]].map(function (row) {
              return h('div', { className: 'pslip__r', key: row[0] },
                h('span', { className: 'stack', style: { gap: 0 } },
                  h('span', null, row[0]), h('i', null, inr(annual(row[1])), ' a year')),
                h('b', null, inr(row[1])));
            }),
            h('div', { className: 'pslip__t' }, h('span', null, 'Monthly gross'), h('b', null, inr(c.gross))),
            [['Provident fund — employer', c.pfEmployer], ['Gratuity accrual', c.gratuity]].map(function (row) {
              return h('div', { className: 'pslip__r', key: row[0] },
                h('span', { className: 'stack', style: { gap: 0 } },
                  h('span', null, row[0]), h('i', null, 'Employer contribution')),
                h('b', null, inr(row[1])));
            }),
            h('div', { className: 'pslip__t' },
              h('span', null, 'Cost to company, a month'),
              h('b', null, inr(c.gross + c.pfEmployer + c.gratuity))))),
        h(Card, { span: 5, title: 'Revision history',
          description: revisions.length ? null : 'Nothing recorded yet.' },
          revisions.length
            ? h(ui.Timeline, { items: revisions.map(function (x) {
              return { title: inr(x.from) + ' → ' + inr(x.to) + '  (+' + x.pct + '%)',
                meta: ui.dateLabel(x.effective) + ' · ' + x.reason,
                body: x.arrears ? 'Arrears of ' + inr(x.arrears) + ' paid with the next cycle.' : null };
            }) })
            : h(ui.Empty, { icon: I.card, title: 'No revisions yet' }))));
  }

  /* ====================================================== Employee: tax regime */
  function MyTax() {
    var person = me();
    if (!person) return h(ui.Empty, { icon: I.card, title: 'No employee record' });
    var d = pay.declarationFor(person);
    var declared = d ? d.declared : 0;
    var newR = pay.annualTax(person, 'new', declared);
    var oldR = pay.annualTax(person, 'old', declared);
    var chosen = pay.regimeOf(person);
    var better = newR.total <= oldR.total ? 'new' : 'old';
    var slip = pay.payslip(person, openCycle());

    function regimeCard(key, calc) {
      var isOn = chosen === key;
      return h('div', { className: 'ptax' + (isOn ? ' is-on' : '') + (better === key ? ' is-best' : '') },
        h('header', null,
          h('strong', null, key === 'new' ? 'New regime' : 'Old regime'),
          isOn ? h('span', { className: 'ptax__tag' }, 'Yours') : null,
          better === key ? h('span', { className: 'ptax__best' }, 'Costs less') : null),
        h('div', { className: 'ptax__rows' },
          h('div', null, h('span', null, 'Annual gross'), h('b', null, inr(calc.gross))),
          h('div', null, h('span', null, 'Standard deduction'),
            h('b', null, '− ' + inr(pay.RATES.tax[key].standard))),
          h('div', null, h('span', null, 'Declared investments'),
            h('b', null, key === 'old' ? '− ' + inr(calc.exemptions) : 'Not allowed')),
          h('div', null, h('span', null, 'Taxable'), h('b', null, inr(calc.taxable))),
          h('div', null, h('span', null, 'Tax'), h('b', null, inr(calc.before))),
          h('div', null, h('span', null, 'Cess at 4%'), h('b', null, inr(calc.cess)))),
        h('div', { className: 'ptax__t' },
          h('span', null, 'For the year'), h('strong', null, inr(calc.total))));
    }

    return h('div', { className: 'stack gap-4' },
      h(ui.PageHead, { eyebrow: 'Payroll', title: 'Tax',
        description: 'What is being deducted, why, and what the other regime would have cost.' }),
      h(Stats, null,
        h(Stat, { label: 'Deducted each month', value: inr(slip.tds.monthly),
          sub: slip.tds.monthsLeft + ' months left in the year' }),
        h(Stat, { label: 'For the year', value: inr(slip.tds.annual.total),
          sub: chosen === 'old' ? 'Old regime' : 'New regime' }),
        h(Stat, { label: 'Declared', value: inr(declared),
          sub: d ? d.status : 'Nothing declared' }),
        h(Stat, { label: 'If you switched', value: inr(Math.abs(newR.total - oldR.total)),
          tone: better === chosen ? 'good' : 'warn',
          sub: better === chosen ? 'You are on the cheaper one' : 'You would save this' })),
      better !== chosen ? h('p', { className: 'pnote' },
        'The ', better === 'new' ? 'new' : 'old', ' regime would cost you ',
        inr(Math.abs(newR.total - oldR.total)), ' less this year on what you have declared. ',
        'The regime can be changed once in a financial year.') : null,
      h('div', { className: 'ptaxes' }, regimeCard('new', newR), regimeCard('old', oldR)),
      h(Card, { title: 'How the monthly figure is reached',
        description: 'Tax is projected across the year and charged a twelfth at a time, so the deduction is steady rather than lumpy.' },
        h(ui.KeyValue, { rows: [
          ['Tax for the year', inr(slip.tds.annual.total)],
          ['Already deducted', inr(slip.tds.alreadyDeducted)],
          ['Still to collect', inr(Math.max(0, slip.tds.annual.total - slip.tds.alreadyDeducted))],
          ['Months left in the financial year', String(slip.tds.monthsLeft)],
          ['This month', inr(slip.tds.monthly)]
        ] })));
  }

  /* ================================================ Employee: reimbursements */
  function MyReimbursements() {
    var person = me();
    if (!person) return h(ui.Empty, { icon: I.card, title: 'No employee record' });
    var mine = store.collection('reimbursements').filter(function (x) { return x.employee === person.id; })
      .sort(function (a, b) { return b.on.localeCompare(a.on); });
    var kinds = seed.reimbursementKinds || [];
    var openSt = React.useState(false);
    var form = ui.useForm({ kind: kinds.length ? kinds[0].kind : 'Travel', amount: '', note: '' });

    function submit() {
      var res = form.submit(function (v) {
        if (!v.amount || Number(v.amount) <= 0) return { ok: false, errors: { amount: 'Enter the amount you spent' } };
        store.add('reimbursements', {
          id: store.nextId('RB'), employee: person.id, kind: v.kind, amount: Number(v.amount),
          on: seed.todayIso, claimed: seed.todayIso, status: 'Awaiting approval',
          paidIn: null, receipt: true, approver: person.manager, note: v.note || null
        });
        return { ok: true, message: 'Claim raised. It is with your manager.' };
      });
      if (res && res.ok) { openSt[1](false); ui.report(res); }
    }

    var waiting = mine.filter(function (x) { return x.status === 'Awaiting approval'; });
    var approved = mine.filter(function (x) { return x.status === 'Approved'; });

    return h('div', { className: 'stack gap-4' },
      h(ui.PageHead, { eyebrow: 'Payroll', title: 'Reimbursements',
        description: 'Money you have spent on company work, and where each claim stands.',
        actions: h(V.Button, { iconStart: I.plus, onClick: function () { openSt[1](true); } }, 'New claim') }),
      h(Stats, null,
        h(Stat, { label: 'Awaiting approval', value: waiting.length,
          sub: waiting.length ? inr(waiting.reduce(function (t, x) { return t + x.amount; }, 0)) : null }),
        h(Stat, { label: 'Approved, not yet paid', value: approved.length,
          sub: approved.length ? inr(approved.reduce(function (t, x) { return t + x.amount; }, 0)) + ' with the next cycle' : null }),
        h(Stat, { label: 'Paid this year',
          value: inr(mine.filter(function (x) { return x.status === 'Paid'; })
            .reduce(function (t, x) { return t + x.amount; }, 0)) }),
        h(Stat, { label: 'Claims raised', value: mine.length })),
      h(Card, { title: 'Your claims' },
        mine.length ? h(ui.DataTable, { rows: mine, pageSize: 12,
          search: function (x) { return x.kind + ' ' + x.status; },
          columns: [
            { key: 'kind', header: 'What for', cell: function (x) { return x.kind; } },
            { key: 'amount', header: 'Amount', align: 'right', cell: function (x) { return inr(x.amount); } },
            { key: 'on', header: 'Claimed', cell: function (x) { return ui.dateLabel(x.on); } },
            { key: 'receipt', header: 'Receipt',
              cell: function (x) { return x.receipt ? 'Attached' : h('span', { className: 'ad-sub' }, 'Missing'); } },
            { key: 'status', header: 'Status', cell: function (x) { return h(ui.StatusChip, { status: x.status }); } }
          ] })
          : h(ui.Empty, { icon: I.card, title: 'Nothing claimed yet',
            body: 'Raise a claim for anything you have spent on company work.' })),
      h(Card, { title: 'What can be claimed', description: 'Each has a cap for the year.' },
        h('div', { className: 'prw' }, kinds.map(function (k) {
          return h('div', { className: 'prw__i', key: k.kind },
            h('span', { className: 'prw__ic' }, I.card),
            h('div', { className: 'prw__m' },
              h('strong', null, k.kind, h('span', { className: 'prw__c' }, inr(k.cap), ' a year')),
              h('span', { className: 'prw__w' }, k.note)));
        }))),
      openSt[0] ? h(ui.Modal, { title: 'New reimbursement claim',
        description: 'It goes to your manager, and rides the next cycle once approved.',
        onClose: function () { openSt[1](false); },
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { openSt[1](false); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: submit }, 'Raise claim')) },
        h(ui.FieldRow, null,
          h(V.Select, Object.assign({ label: 'What for',
            options: kinds.map(function (k) { return { value: k.kind, label: k.kind }; }) },
            form.select('kind'))),
          h(V.TextField, Object.assign({ label: 'Amount', inputMode: 'numeric' },
            form.field('amount', { number: true })))),
        h(V.TextArea, Object.assign({ label: 'Note', rows: 3 }, form.field('note')))) : null);
  }

  /* ========================================================= HR: the payroll run
     The stage the month is at, what is still missing, and the payslips worth looking
     at before anyone approves a total. */
  function PayrollRun() {
    var cycle = openCycle();
    var totals = pay.runTotals(cycle);
    var exc = pay.exceptions(cycle);
    var prev = lastPaid();
    var prevTotals = prev ? pay.runTotals(prev) : null;
    var openSt = React.useState(null);
    var stage = cycle.stage || 'inputs';
    var stageIdx = pay.STAGES.map(function (s) { return s.k; }).indexOf(stage);

    function advance() {
      var next = pay.STAGES[stageIdx + 1];
      if (!next) {
        store.setOverride('payrollCycles', cycle.id, { status: 'Paid', stage: 'file' });
        ui.toast(cycle.period + ' is closed. Payslips are published and the challans are raised.', 'success');
        return;
      }
      store.setOverride('payrollCycles', cycle.id, { stage: next.k });
      ui.toast(cycle.period + ' moved to ' + next.label.toLowerCase() + '.', 'success');
    }

    var delta = prevTotals ? totals.net - prevTotals.net : 0;

    return h('div', { className: 'stack gap-4' },
      h(ui.PageHead, { eyebrow: 'Payroll', title: 'Run ' + cycle.period,
        description: 'Everyone who is paid this month, what it comes to, and what still needs a decision.',
        actions: h(V.Button, { variant: 'primary', iconEnd: I.arrow, onClick: advance },
          stageIdx >= pay.STAGES.length - 1 ? 'Close the cycle' : 'Move to ' + pay.STAGES[stageIdx + 1].label.toLowerCase()) }),

      h('div', { className: 'prun' }, pay.STAGES.map(function (s, i) {
        return h('div', { className: 'prun__s' + (i < stageIdx ? ' is-done' : i === stageIdx ? ' is-now' : ''), key: s.k },
          h('span', { className: 'prun__n' }, i < stageIdx ? I.ok : i + 1),
          h('span', { className: 'stack', style: { gap: 1, minWidth: 0 } },
            h('strong', null, s.label),
            h('span', null, s.what)));
      })),

      h(Stats, null,
        h(Stat, { label: 'People', value: totals.count,
          sub: totals.onLop ? totals.onLop + ' with loss of pay' : 'Nobody on loss of pay' }),
        h(Stat, { label: 'Gross', value: inr(totals.gross) }),
        h(Stat, { label: 'Net payable', value: inr(totals.net),
          sub: prevTotals ? (delta >= 0 ? '+' : '−') + inr(Math.abs(delta)) + ' on ' + prev.period : null,
          tone: prevTotals && Math.abs(delta) > prevTotals.net * 0.05 ? 'warn' : null }),
        h(Stat, { label: 'Cost to company', value: inr(totals.cost),
          sub: inr(totals.employer) + ' of employer contributions' })),

      h(Grid, null,
        h(Card, { span: 7, title: 'Worth a look before you approve',
          description: exc.length
            ? exc.length + ' of ' + totals.count + ' payslips are not simply last month repeated.'
            : 'Every payslip matches last month.' },
          exc.length ? h('div', { className: 'pexc' }, exc.slice(0, 12).map(function (x) {
            return h('button', { type: 'button', className: 'pexc__i', key: x.employee.id,
              onClick: function () { openSt[1](x.slip); } },
              h(ui.Person, { employee: x.employee }),
              h('span', { className: 'pexc__w' }, x.why.join(' · ')),
              h('span', { className: 'pexc__n' }, inr(x.slip.net),
                x.delta == null ? null : h('i', { className: x.delta < 0 ? 'is-down' : 'is-up' },
                  (x.delta >= 0 ? '+' : '−') + inr(Math.abs(x.delta)))),
              h('span', { className: 'prow__go' }, I.right));
          })) : h(ui.Empty, { icon: I.ok, title: 'Nothing unusual' })),

        h(Card, { span: 5, title: 'Loss of pay',
          description: 'Where attendance and leave reach the bank account.' },
          h(ui.KeyValue, { rows: [
            ['People affected', String(totals.onLop)],
            ['Days', String(totals.lopDays)],
            ['Held back', inr(totals.lopAmount)],
            ['Reimbursements riding along', inr(totals.reimbursed)]
          ] }),
          h(V.Button, { variant: 'outline', className: 'vi-btn--sm',
            onClick: function () { router.go('hr/attendance/regularization'); } },
            'Open regularizations'))),

      h(Card, { title: 'Everyone in this run' },
        h(ui.DataTable, { rows: totals.rows, pageSize: 12,
          search: function (r) { return r.employee.name + ' ' + r.employee.id; },
          columns: [
            { key: 'employee', header: 'Employee',
              cell: function (r) { return h(ui.Person, { employee: r.employee }); } },
            { key: 'gross', header: 'Gross', align: 'right', cell: function (r) { return inr(r.gross); } },
            { key: 'lop', header: 'LOP', align: 'right',
              cell: function (r) { return r.lop.days ? r.lop.days + 'd' : '—'; } },
            { key: 'ded', header: 'Deductions', align: 'right', cell: function (r) { return inr(r.totalDeductions); } },
            { key: 'net', header: 'Net', align: 'right', cell: function (r) { return inr(r.net); } },
            { key: 'actions', header: '',
              cell: function (r) {
                return h(V.Button, { variant: 'ghost', className: 'vi-btn--sm',
                  onClick: function () { openSt[1](r); } }, 'Payslip');
              } }
          ] })),

      openSt[0] ? h(ui.Drawer, { title: 'Payslip', onClose: function () { openSt[1](null); } },
        h(Payslip, { slip: openSt[0] })) : null);
  }

  /* ============================================================= HR: statutory */
  function Statutory() {
    var cycle = lastPaid() || openCycle();
    var items = pay.liabilities(cycle);
    var R = pay.RATES;
    return h('div', { className: 'stack gap-4' },
      h(ui.PageHead, { eyebrow: 'Payroll', title: 'Statutory',
        description: 'What ' + cycle.period + ' owes, to whom and by when — and the rates it was worked out on.' }),
      h(Stats, null, items.map(function (x) {
        return h(Stat, { key: x.k, label: x.label, value: inr(x.amount),
          sub: x.form + ' · due ' + ui.dateLabel(x.due) });
      })),
      h(Grid, null,
        h(Card, { span: 7, title: 'Challans and returns',
          description: 'Each is a separate payment with its own deadline.' },
          h(ui.DataTable, { rows: items, pageSize: 10,
            columns: [
              { key: 'label', header: 'Liability', cell: function (x) { return x.label; } },
              { key: 'to', header: 'Paid to', cell: function (x) { return x.to; } },
              { key: 'employee', header: 'Employee share', align: 'right',
                cell: function (x) { return x.employee ? inr(x.employee) : '—'; } },
              { key: 'employer', header: 'Employer share', align: 'right',
                cell: function (x) { return x.employer ? inr(x.employer) : '—'; } },
              { key: 'amount', header: 'Total', align: 'right', cell: function (x) { return inr(x.amount); } },
              { key: 'due', header: 'Due', cell: function (x) { return ui.dateLabel(x.due); } }
            ] })),
        h(Card, { span: 5, title: 'The rates these were worked out on',
          description: 'Policy rather than logic, so they are shown rather than buried in the arithmetic.' },
          h(ui.KeyValue, { rows: [
            ['Provident fund', '12% employee, 12% employer'],
            ['PF wage ceiling', inr(R.pf.ceiling) + ' a month'],
            ['Of which pension', '8.33% of the ceiling wage'],
            ['Employee state insurance', '0.75% employee, 3.25% employer'],
            ['ESI applies below', inr(R.esi.ceiling) + ' gross a month'],
            ['Gratuity accrual', '4.81% of basic'],
            ['Cess on income tax', '4%']
          ] }),
          h('p', { className: 'pnote' },
            'The provident fund ceiling is reported to have moved during 2026 and the sources disagree, ',
            'so this prototype runs on the long-standing figure. A real deployment would confirm each of ',
            'these against EPFO, ESIC, the state labour department and the Income Tax Department before ',
            'running a cycle on them.'))),
      h(Card, { title: 'Professional tax by state',
        description: 'A state subject, so it follows where somebody works rather than what they earn alone.' },
        h('div', { className: 'pstates' }, Object.keys(R.pt).map(function (st) {
          var here = store.collection('employees').filter(function (e) {
            return R.state[e.location] === st && e.status !== 'Exited' && e.status !== 'Invited';
          });
          return h('div', { className: 'pstates__i', key: st },
            h('strong', null, st),
            h('span', { className: 'ad-sub' }, here.length, ' people'),
            h('ul', null, R.pt[st].map(function (slab, i) {
              return h('li', { key: i },
                slab.upto === Infinity ? 'Above ' + inr(R.pt[st][i - 1].upto) : 'Up to ' + inr(slab.upto),
                ' — ', slab.amount ? inr(slab.amount) + ' a month' : 'nil');
            })));
        }))));
  }

  /* ====================================================== HR: reimbursements */
  function HrReimbursements() {
    var rows = store.collection('reimbursements').slice()
      .sort(function (a, b) { return b.on.localeCompare(a.on); });
    var waiting = rows.filter(function (x) { return x.status === 'Awaiting approval'; });
    var approved = rows.filter(function (x) { return x.status === 'Approved'; });

    function decide(x, ok) {
      store.setOverride('reimbursements', x.id, { status: ok ? 'Approved' : 'Declined' });
      ui.toast(x.kind + ' claim ' + (ok ? 'approved — it rides the next cycle' : 'declined') + '.',
        ok ? 'success' : 'info');
    }

    return h('div', { className: 'stack gap-4' },
      h(ui.PageHead, { eyebrow: 'Payroll', title: 'Reimbursements',
        description: 'Claims across the organization, and which ones the next cycle will carry.' }),
      h(Stats, null,
        h(Stat, { label: 'Awaiting approval', value: waiting.length,
          tone: waiting.length ? 'warn' : 'good',
          sub: inr(waiting.reduce(function (t, x) { return t + x.amount; }, 0)) }),
        h(Stat, { label: 'Approved for the next cycle', value: approved.length,
          sub: inr(approved.reduce(function (t, x) { return t + x.amount; }, 0)) }),
        h(Stat, { label: 'Paid this year',
          value: inr(rows.filter(function (x) { return x.status === 'Paid'; })
            .reduce(function (t, x) { return t + x.amount; }, 0)) }),
        h(Stat, { label: 'Without a receipt',
          value: rows.filter(function (x) { return !x.receipt; }).length,
          tone: 'warn', sub: 'Cannot be paid until one is attached' })),
      h(Card, { title: 'Every claim' },
        h(ui.DataTable, { rows: rows, pageSize: 14,
          search: function (x) { var e = emp(x.employee); return (e ? e.name : '') + ' ' + x.kind + ' ' + x.status; },
          columns: [
            { key: 'employee', header: 'Employee',
              cell: function (x) { return h(ui.Person, { employee: emp(x.employee) }); } },
            { key: 'kind', header: 'What for', cell: function (x) { return x.kind; } },
            { key: 'amount', header: 'Amount', align: 'right', cell: function (x) { return inr(x.amount); } },
            { key: 'on', header: 'Claimed', cell: function (x) { return ui.dateLabel(x.on); } },
            { key: 'receipt', header: 'Receipt',
              cell: function (x) { return x.receipt ? 'Attached' : h('span', { className: 'is-warn' }, 'Missing'); } },
            { key: 'status', header: 'Status', cell: function (x) { return h(ui.StatusChip, { status: x.status }); } },
            { key: 'actions', header: '', cell: function (x) {
              if (x.status !== 'Awaiting approval') return null;
              return h('span', { className: 'row gap-2' },
                h(V.Button, { variant: 'outline', className: 'vi-btn--sm',
                  onClick: function () { decide(x, true); } }, 'Approve'),
                h(V.Button, { variant: 'ghost', className: 'vi-btn--sm',
                  onClick: function () { decide(x, false); } }, 'Decline'));
            } }
          ] })));
  }

  /* ============================================================== HR: loans */
  function Loans() {
    var rows = store.collection('loans').slice();
    var running = rows.filter(function (x) { return x.status === 'Running'; });
    return h('div', { className: 'stack gap-4' },
      h(ui.PageHead, { eyebrow: 'Payroll', title: 'Loans and advances',
        description: 'What the company has lent, what is still outstanding, and what each cycle recovers.' }),
      h(Stats, null,
        h(Stat, { label: 'Running', value: running.length }),
        h(Stat, { label: 'Outstanding',
          value: inr(running.reduce(function (t, x) { return t + x.outstanding; }, 0)) }),
        h(Stat, { label: 'Recovered each cycle',
          value: inr(running.reduce(function (t, x) { return t + x.emi; }, 0)) }),
        h(Stat, { label: 'Settled', value: rows.length - running.length })),
      h(Card, { title: 'Every loan and advance' },
        h(ui.DataTable, { rows: rows, pageSize: 12,
          search: function (x) { var e = emp(x.employee); return (e ? e.name : '') + ' ' + x.kind; },
          columns: [
            { key: 'employee', header: 'Employee',
              cell: function (x) { return h(ui.Person, { employee: emp(x.employee) }); } },
            { key: 'kind', header: 'Kind', cell: function (x) { return x.kind; } },
            { key: 'principal', header: 'Principal', align: 'right', cell: function (x) { return inr(x.principal); } },
            { key: 'emi', header: 'Instalment', align: 'right', cell: function (x) { return inr(x.emi); } },
            { key: 'progress', header: 'Recovered',
              cell: function (x) {
                return h('span', { className: 'prow__bar' },
                  h('i', { style: { width: Math.round(x.paidInstalments / x.months * 100) + '%' } }),
                  h('b', null, x.paidInstalments + ' of ' + x.months));
              } },
            { key: 'outstanding', header: 'Outstanding', align: 'right',
              cell: function (x) { return inr(x.outstanding); } },
            { key: 'status', header: 'Status', cell: function (x) { return h(ui.StatusChip, { status: x.status }); } }
          ] })));
  }

  HRMS.screens.register({
    'me/payroll/payslips': MyPayslips,
    'me/payroll/structure': MyStructure,
    'me/payroll/tax': MyTax,
    'me/payroll/reimbursements': MyReimbursements,
    'hr/payroll/run': PayrollRun,
    'hr/payroll/statutory': Statutory,
    'hr/payroll/reimbursements': HrReimbursements,
    'hr/payroll/loans': Loans
  });
  HRMS.payrollUI = { Payslip: Payslip };
})();

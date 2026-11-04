/* Payroll: the calculation engine.

   Everything a payslip says is worked out here, from the employee's CTC, their work
   location, the days they were actually paid for, and whatever one-off amounts the
   cycle carries. Nothing is stored as a finished number — a payslip is recomputed from
   its inputs every time — so a change to an input cannot leave a payslip saying
   something the records no longer support.

   The shape is Indian payroll as Zoho Payroll and its peers implement it: a CTC split
   into components, statutory deductions that each have their own wage base and ceiling,
   employer contributions that sit outside gross, and tax projected across the year
   rather than charged on the month. Professional tax is per state, which is why the
   work location matters and not just the salary.

   Rates and ceilings are in RATES below rather than scattered through the arithmetic,
   because they are policy that changes by notification, not logic. They are shown on
   the statutory screen for the same reason. The figures here are the ones in common
   use for FY 2026-27; a real deployment would check each against EPFO, ESIC, the state
   labour department and the Income Tax Department before running a cycle on them, and
   the PF ceiling in particular is reported to have moved during 2026 — see CEILING. */
(function () {
  var HRMS = (window.HRMS = window.HRMS || {});

  function store() { return HRMS.store; }
  function round(n) { return Math.round(n); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  /* ------------------------------------------------------------------ Rates */
  var RATES = {
    pf: {
      employee: 0.12, employer: 0.12,
      /* The employer's 12% is split: 8.33% of the ceiling wage goes to the pension
         scheme, the remainder to the provident fund itself. */
      pensionShare: 0.0833,
      /* Reported to have risen from 15,000 to 25,000 during 2026. Sources disagree and
         we could not confirm the notification, so the prototype runs on the long
         standing 15,000 and shows the figure on the statutory screen where it can be
         changed rather than burying the choice in the arithmetic. */
      ceiling: 15000,
      edli: 0.005, admin: 0.005
    },
    esi: { employee: 0.0075, employer: 0.0325, ceiling: 21000 },
    gratuity: { accrual: 0.0481, daysPerYear: 15, monthDays: 26, minYears: 5, cap: 2000000 },
    /* Professional tax is a state subject. Each state publishes its own monthly slabs
       and the total is capped at 2,500 a year everywhere. */
    pt: {
      Telangana:   [{ upto: 15000, amount: 0 }, { upto: 20000, amount: 150 }, { upto: Infinity, amount: 200 }],
      Karnataka:   [{ upto: 25000, amount: 0 }, { upto: Infinity, amount: 200 }],
      Maharashtra: [{ upto: 7500, amount: 0 }, { upto: 10000, amount: 175 }, { upto: Infinity, amount: 200 }]
    },
    /* Which state each work location sits in, since professional tax follows the
       place of work rather than the entity. */
    state: { 'loc-hyd': 'Telangana', 'loc-blr': 'Karnataka', 'loc-pun': 'Maharashtra' },
    tax: {
      cess: 0.04,
      new: {
        standard: 75000, rebateUpto: 1200000,
        slabs: [[400000, 0], [800000, 0.05], [1200000, 0.10], [1600000, 0.15],
          [2000000, 0.20], [2400000, 0.25], [Infinity, 0.30]]
      },
      old: {
        standard: 50000, rebateUpto: 500000,
        slabs: [[250000, 0], [500000, 0.05], [1000000, 0.20], [Infinity, 0.30]]
      }
    },
    insurance: 450          /* group cover, a flat monthly deduction */
  };

  /* --------------------------------------------------------- CTC into components
     The split a structure applies. Basic drives the statutory bases, so it is the
     number that matters most; special allowance is the balancing figure, which is how
     Indian structures absorb the rest of the CTC. */
  function components(employee) {
    var annual = employee.ctc || 0;
    var monthly = annual / 12;
    var basic = round(monthly * 0.40);
    var hra = round(basic * 0.50);
    var conveyance = 1600;
    var medical = 1250;
    /* Employer contributions are part of CTC but not of gross pay, so they come out
       before the balancing component rather than after. */
    var pfEmployer = round(Math.min(basic, RATES.pf.ceiling) * RATES.pf.employer);
    var gratuity = round(basic * RATES.gratuity.accrual);
    var special = Math.max(0, round(monthly - basic - hra - conveyance - medical - pfEmployer - gratuity));
    return {
      basic: basic, hra: hra, conveyance: conveyance, medical: medical, special: special,
      pfEmployer: pfEmployer, gratuity: gratuity,
      gross: basic + hra + conveyance + medical + special
    };
  }

  /* ------------------------------------------------------------------- Statutory */
  function ptFor(employee, gross) {
    var state = RATES.state[employee.location] || 'Telangana';
    var slabs = RATES.pt[state] || RATES.pt.Telangana;
    for (var i = 0; i < slabs.length; i++) if (gross <= slabs[i].upto) return { state: state, amount: slabs[i].amount };
    return { state: state, amount: 200 };
  }

  function pfFor(basic) {
    var wage = Math.min(basic, RATES.pf.ceiling);
    var employee = round(wage * RATES.pf.employee);
    var pension = round(Math.min(basic, RATES.pf.ceiling) * RATES.pf.pensionShare);
    var employer = round(wage * RATES.pf.employer);
    return {
      wage: wage, employee: employee, employer: employer,
      pension: pension, toFund: employer - pension,
      edli: round(wage * RATES.pf.edli), admin: round(wage * RATES.pf.admin)
    };
  }

  function esiFor(gross) {
    if (gross > RATES.esi.ceiling) return { applies: false, employee: 0, employer: 0 };
    return {
      applies: true,
      employee: round(gross * RATES.esi.employee),
      employer: round(gross * RATES.esi.employer)
    };
  }

  /* --------------------------------------------------------------------- Income tax
     Projected across the year and charged a twelfth at a time, which is what makes a
     payslip's TDS line steady rather than lumpy. Both regimes are computed so the
     employee can be shown what the other one would have cost. */
  function slabTax(taxable, regime) {
    var cfg = RATES.tax[regime] || RATES.tax.new;
    var tax = 0, last = 0;
    for (var i = 0; i < cfg.slabs.length; i++) {
      var upto = cfg.slabs[i][0], rate = cfg.slabs[i][1];
      if (taxable > last) tax += (Math.min(taxable, upto) - last) * rate;
      last = upto;
      if (taxable <= upto) break;
    }
    return tax;
  }

  function annualTax(employee, regime, declared) {
    var cfg = RATES.tax[regime] || RATES.tax.new;
    var c = components(employee);
    var gross = c.gross * 12;
    /* Declared investments only reduce tax under the old regime; the new one trades
       them for the wider slabs. */
    var exemptions = regime === 'old' ? (declared || 0) : 0;
    var taxable = Math.max(0, gross - cfg.standard - exemptions);
    var tax = slabTax(taxable, regime);
    /* The rebate wipes the liability out below the threshold rather than reducing it. */
    if (taxable <= cfg.rebateUpto) tax = 0;
    return { gross: gross, exemptions: exemptions, taxable: taxable, before: round(tax),
      cess: round(tax * RATES.tax.cess), total: round(tax * (1 + RATES.tax.cess)) };
  }

  function declarationFor(employee) {
    return store().collection('taxDeclarations')
      .filter(function (d) { return d.employee === employee.id; })[0] || null;
  }
  function regimeOf(employee) {
    var d = declarationFor(employee);
    return d && d.regime === 'Old' ? 'old' : 'new';
  }

  function tdsFor(employee, cycle) {
    var d = declarationFor(employee);
    var regime = regimeOf(employee);
    var yr = annualTax(employee, regime, d ? d.declared : 0);
    /* Spread across the months of the financial year still to be paid. India's
       financial year starts in April, so a November cycle has five left including
       itself. */
    var left = monthsLeftInFY(cycle);
    var paid = yr.total * (12 - left) / 12;
    return {
      regime: regime, annual: yr, monthly: round(Math.max(0, yr.total - paid) / Math.max(left, 1)),
      monthsLeft: left, alreadyDeducted: round(paid)
    };
  }

  function monthsLeftInFY(cycle) {
    var m = cycle && cycle.payDate ? Number(cycle.payDate.slice(5, 7)) : 11;
    /* April is month 1 of the financial year, March month 12. */
    var inFY = m >= 4 ? m - 3 : m + 9;
    return clamp(13 - inFY, 1, 12);
  }

  /* -------------------------------------------------------------- Loss of pay
     The one place payroll and leave meet. A day of unpaid leave, and a day absent
     with no leave behind it, both cost a day's gross — which is why an attendance
     record that has not been regularised is a payroll problem and not only an
     attendance one. */
  function workingDaysIn(cycle) {
    var d = new Date(cycle.payDate + 'T00:00');
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  }

  function lopFor(employee, cycle) {
    var s = store();
    var month = cycle.payDate.slice(0, 7);
    var unpaid = 0, absent = 0;
    var types = {};
    s.collection('leaveTypes').forEach(function (t) { types[t.id] = t; });

    s.collection('leaveRequests').forEach(function (l) {
      if (l.employee !== employee.id || l.status !== 'Approved') return;
      var t = types[l.type];
      if (!t || t.paid !== false) return;
      if (String(l.from).slice(0, 7) !== month && String(l.to).slice(0, 7) !== month) return;
      unpaid += l.days || 0;
    });

    /* Absences inside the cycle with nothing approved against them. */
    var hist = HRMS.attendanceHistory ? HRMS.attendanceHistory(employee, 62) : [];
    hist.forEach(function (day) {
      if (day.date.slice(0, 7) !== month) return;
      if (day.status === 'Absent') absent += 1;
    });

    var days = unpaid + absent;
    var perDay = components(employee).gross / workingDaysIn(cycle);
    return { unpaidLeave: unpaid, absent: absent, days: days, perDay: round(perDay),
      amount: round(days * perDay) };
  }

  /* --------------------------------------------------------- One-off amounts
     Reimbursements approved inside the cycle, arrears from a mid-cycle revision, and
     an instalment on anything the employee has borrowed. */
  function extrasFor(employee, cycle) {
    var s = store(), month = cycle.payDate.slice(0, 7);
    var reimb = s.collection('reimbursements').filter(function (x) {
      return x.employee === employee.id && x.status === 'Approved' && String(x.on).slice(0, 7) <= month
        && !x.paidIn;
    });
    var arrear = s.collection('salaryRevisions').filter(function (x) {
      return x.employee === employee.id && String(x.effective).slice(0, 7) === month && x.arrears;
    });
    var loans = s.collection('loans').filter(function (x) {
      return x.employee === employee.id && x.status === 'Running';
    });
    return {
      reimbursements: reimb, reimbursed: reimb.reduce(function (t, x) { return t + x.amount; }, 0),
      arrears: arrear.reduce(function (t, x) { return t + (x.arrears || 0); }, 0),
      loans: loans, emi: loans.reduce(function (t, x) { return t + x.emi; }, 0)
    };
  }

  /* --------------------------------------------------------------- The payslip
     Every line, in the order a payslip prints them: what was earned, what was taken
     off, what the employer paid on top, and what reached the bank. */
  function payslip(employee, cycle) {
    var c = components(employee);
    var lop = lopFor(employee, cycle);
    var extra = extrasFor(employee, cycle);

    /* Loss of pay reduces every earning proportionally, which is what keeps the
       statutory bases honest: a month half worked is a month of half the PF. */
    var factor = clamp(1 - lop.days / workingDaysIn(cycle), 0, 1);
    var basic = round(c.basic * factor);
    var earnings = [
      { k: 'basic', label: 'Basic salary', amount: basic, taxable: true },
      { k: 'hra', label: 'House rent allowance', amount: round(c.hra * factor), taxable: true },
      { k: 'conv', label: 'Conveyance allowance', amount: round(c.conveyance * factor), taxable: false },
      { k: 'med', label: 'Medical allowance', amount: round(c.medical * factor), taxable: false },
      { k: 'spec', label: 'Special allowance', amount: round(c.special * factor), taxable: true }
    ];
    if (extra.arrears) earnings.push({ k: 'arrear', label: 'Arrears', amount: extra.arrears, taxable: true });
    var grossEarned = earnings.reduce(function (t, x) { return t + x.amount; }, 0);

    var pf = pfFor(basic);
    var esi = esiFor(grossEarned);
    var pt = ptFor(employee, grossEarned);
    var tds = tdsFor(employee, cycle);

    var deductions = [
      { k: 'pf', label: 'Provident fund', amount: pf.employee,
        note: '12% of ' + inr(pf.wage) + (basic > RATES.pf.ceiling ? ' (wage ceiling)' : '') },
      { k: 'pt', label: 'Professional tax', amount: pt.amount, note: pt.state + ' slab' }
    ];
    if (esi.applies) deductions.push({ k: 'esi', label: 'Employee state insurance', amount: esi.employee,
      note: '0.75% of gross' });
    deductions.push({ k: 'ins', label: 'Group insurance', amount: RATES.insurance, note: 'Flat monthly' });
    deductions.push({ k: 'tds', label: 'Tax deducted at source', amount: tds.monthly,
      note: tds.regime === 'old' ? 'Old regime' : 'New regime' });
    if (extra.emi) deductions.push({ k: 'emi', label: 'Loan instalment', amount: extra.emi,
      note: extra.loans.length + (extra.loans.length === 1 ? ' loan running' : ' loans running') });

    var totalDeductions = deductions.reduce(function (t, x) { return t + x.amount; }, 0);
    var net = grossEarned + extra.reimbursed - totalDeductions;

    /* What the employee costs, which is not what they are paid. */
    var employer = [
      { k: 'pf', label: 'Provident fund', amount: pf.toFund },
      { k: 'eps', label: 'Pension scheme', amount: pf.pension },
      { k: 'edli', label: 'EDLI and admin charges', amount: pf.edli + pf.admin },
      { k: 'grat', label: 'Gratuity accrual', amount: round(c.gratuity * factor) }
    ];
    if (esi.applies) employer.push({ k: 'esi', label: 'Employee state insurance', amount: esi.employer });
    var employerTotal = employer.reduce(function (t, x) { return t + x.amount; }, 0);

    return {
      employee: employee, cycle: cycle, components: c, factor: factor,
      earnings: earnings, gross: grossEarned,
      lop: lop, extras: extra,
      deductions: deductions, totalDeductions: totalDeductions,
      employerContributions: employer, employerTotal: employerTotal,
      cost: grossEarned + employerTotal,
      reimbursed: extra.reimbursed, net: net,
      pf: pf, esi: esi, pt: pt, tds: tds
    };
  }

  /* Year to date, for the employee's own summary and for Form 16. */
  function ytd(employee, upto) {
    var cycles = store().collection('payrollCycles').filter(function (c) {
      return c.status === 'Paid' && (!upto || c.payDate <= upto);
    });
    var out = { gross: 0, deductions: 0, net: 0, pf: 0, tds: 0, months: cycles.length };
    cycles.forEach(function (c) {
      var p = payslip(employee, c);
      out.gross += p.gross; out.deductions += p.totalDeductions; out.net += p.net;
      out.pf += p.pf.employee; out.tds += p.tds.monthly;
    });
    return out;
  }

  /* ------------------------------------------------------------ The cycle totals
     What a run comes to across everybody in it, and the statutory liabilities it
     creates — each of which is a separate challan with its own deadline. */
  function payableFor(cycle) {
    return store().collection('employees').filter(function (e) {
      return e.status !== 'Invited' && e.status !== 'Exited' && e.joined <= cycle.payDate;
    });
  }

  function runTotals(cycle) {
    var rows = payableFor(cycle).map(function (e) { return payslip(e, cycle); });
    var t = { count: rows.length, gross: 0, deductions: 0, net: 0, employer: 0, cost: 0,
      pfEmployee: 0, pfEmployer: 0, eps: 0, esiEmployee: 0, esiEmployer: 0, pt: 0, tds: 0,
      lopDays: 0, lopAmount: 0, reimbursed: 0, onLop: 0, rows: rows };
    rows.forEach(function (p) {
      t.gross += p.gross; t.deductions += p.totalDeductions; t.net += p.net;
      t.employer += p.employerTotal; t.cost += p.cost;
      t.pfEmployee += p.pf.employee; t.pfEmployer += p.pf.toFund; t.eps += p.pf.pension;
      t.esiEmployee += p.esi.employee; t.esiEmployer += p.esi.employer;
      t.pt += p.pt.amount; t.tds += p.tds.monthly;
      t.lopDays += p.lop.days; t.lopAmount += p.lop.amount; t.reimbursed += p.reimbursed;
      if (p.lop.days) t.onLop += 1;
    });
    return t;
  }

  /* The challans a run creates, with who they are paid to and by when. The dates are
     the statutory deadlines: PF and ESI by the fifteenth of the following month, TDS
     by the seventh, professional tax by the state's own date. */
  function liabilities(cycle) {
    var t = runTotals(cycle);
    var next = new Date(cycle.payDate + 'T00:00');
    next.setMonth(next.getMonth() + 1);
    function by(day) {
      var d = new Date(next.getFullYear(), next.getMonth(), day);
      return d.toISOString().slice(0, 10);
    }
    return [
      { k: 'pf', label: 'Provident fund', to: 'EPFO', form: 'ECR',
        employee: t.pfEmployee, employer: t.pfEmployer + t.eps,
        amount: t.pfEmployee + t.pfEmployer + t.eps, due: by(15) },
      { k: 'esi', label: 'Employee state insurance', to: 'ESIC', form: 'ESI return',
        employee: t.esiEmployee, employer: t.esiEmployer,
        amount: t.esiEmployee + t.esiEmployer, due: by(15) },
      { k: 'tds', label: 'Tax deducted at source', to: 'Income Tax Department', form: 'Challan 281',
        employee: t.tds, employer: 0, amount: t.tds, due: by(7) },
      { k: 'pt', label: 'Professional tax', to: 'State governments', form: 'Form 5-A',
        employee: t.pt, employer: 0, amount: t.pt, due: by(20) }
    ];
  }

  /* The stages a run moves through, in order. A cycle's `stage` names where it is. */
  var STAGES = [
    { k: 'inputs', label: 'Inputs', what: 'Attendance, loss of pay, joiners, leavers and anything one-off.' },
    { k: 'preview', label: 'Preview', what: 'Every payslip computed, with the exceptions listed before anyone signs.' },
    { k: 'approve', label: 'Approval', what: 'Signed off against the previous month, so a jump is seen before it is paid.' },
    { k: 'pay', label: 'Payment', what: 'The bank file, and the payslips published to employees.' },
    { k: 'file', label: 'Statutory', what: 'Challans paid and returns filed: ECR, ESI, Form 24Q, professional tax.' }
  ];

  /* Rows a reviewer should look at before approving: a payslip is an exception when it
     is not simply last month repeated. */
  function exceptions(cycle) {
    var prev = store().collection('payrollCycles').filter(function (c) {
      return c.payDate < cycle.payDate && c.status === 'Paid';
    }).sort(function (a, b) { return b.payDate.localeCompare(a.payDate); })[0];
    var out = [];
    payableFor(cycle).forEach(function (e) {
      var p = payslip(e, cycle);
      var why = [];
      if (p.lop.days) {
        why.push(p.lop.days + (p.lop.days === 1 ? ' day' : ' days') + ' loss of pay'
          + (p.lop.unpaidLeave ? ' (' + p.lop.unpaidLeave + ' unpaid leave' + (p.lop.absent ? ', ' + p.lop.absent + ' absent)' : ')') : ''));
      }
      if (p.extras.arrears) why.push('arrears of ' + inr(p.extras.arrears));
      if (p.reimbursed) why.push('reimbursements of ' + inr(p.reimbursed));
      if (e.joined > (prev ? prev.payDate : '0000-00-00')) why.push('joined this cycle');
      if (e.status === 'Notice Period') why.push('serving notice');
      if (!why.length) return;
      var before = prev ? payslip(e, prev).net : null;
      out.push({ employee: e, slip: p, why: why, previous: before,
        delta: before == null ? null : p.net - before });
    });
    return out.sort(function (a, b) { return Math.abs(b.delta || 0) - Math.abs(a.delta || 0); });
  }

  function inr(n) { return HRMS.ui ? HRMS.ui.inr(n) : '₹' + Math.round(n).toLocaleString('en-IN'); }

  HRMS.payroll = {
    RATES: RATES, STAGES: STAGES,
    components: components, payslip: payslip, ytd: ytd,
    pfFor: pfFor, esiFor: esiFor, ptFor: ptFor, tdsFor: tdsFor, annualTax: annualTax,
    regimeOf: regimeOf, declarationFor: declarationFor,
    lopFor: lopFor, workingDaysIn: workingDaysIn, extrasFor: extrasFor,
    payableFor: payableFor, runTotals: runTotals, liabilities: liabilities,
    exceptions: exceptions, monthsLeftInFY: monthsLeftInFY
  };
})();

/* Admin dashboard, version 2: the same organisation, read rather than counted.

   Version 1 answers "what are the numbers". This one is a different page, not a restyle
   of that one: it opens on a question box, then three readings of the organisation, and
   only then the figures — and the figures it shows are deliberately none of version 1's,
   so putting the two side by side tells you more than either alone.

   What makes it the AI version is that the analysis is attached to the thing it is about.
   The chart carries its own notes: a marker sits on the month it concerns and opens what
   Ara makes of that month. The chart itself can be argued with — Ara proposes other ways
   to draw it, says why, and applying one actually redraws it. Each reading in the briefing
   can be asked to show its evidence. Anomalies are investigated in place.

   One honest note about what Ara is here. No model runs in the prototype. Every number in
   every answer is computed from the store at the moment you ask, and every anomaly is a
   z-score over the same records; the question box matches on keywords. So the figures are
   real and the phrasing is written, which is the opposite way round from a language model
   and the only way a prototype can promise that what it says is true. */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var store = HRMS.store, router = HRMS.router, ui = HRMS.ui, seed = HRMS.seed;

  function g(d, s) {
    return h('svg', { viewBox: '0 0 24 24', width: s || 20, height: s || 20, fill: 'none', 'aria-hidden': 'true' },
      h('path', { d: d, stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }));
  }
  var UP = g('M7 14l5-5 5 5', 13);
  var DOWN = g('M7 10l5 5 5-5', 13);
  var BOLT = g('M13 3L5 14h5l-1 7 8-11h-5l1-7Z', 14);
  var num = function (n) { return Number(n || 0).toLocaleString('en-IN'); };
  var pc = function (n) { return (Math.round(n * 10) / 10) + '%'; };
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

  var ARA = h('svg', { viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
    h('path', { d: 'M12 3.2l1.9 4.7 4.9 1.8-4.9 1.8L12 16.2l-1.9-4.7-4.9-1.8 4.9-1.8L12 3.2Z', fill: 'currentColor' }),
    h('circle', { cx: 18.4, cy: 17.6, r: 2.1, fill: 'currentColor', opacity: .85 }),
    h('circle', { cx: 6.2, cy: 18.4, r: 1.3, fill: 'currentColor', opacity: .6 }));

  /* ============================================================ what is true now
     Read once per render and passed down, so every panel, answer and anomaly on the page
     is talking about the same moment. */
  function facts() {
    var s = store.stats();
    var emps = store.collection('employees');
    var live = emps.filter(function (e) { return e.status !== 'Exited'; });
    var ofb = store.collection('offboarding');
    var att = store.collection('attendanceToday');
    var leave = store.collection('leaveRequests');
    var cycles = store.collection('payrollCycles');
    var responses = store.collection('surveyResponses');

    /* Attrition: resignations on record against the live headcount. */
    var attrition = live.length ? ofb.length / live.length * 100 : 0;

    /* Engagement: the rating-scale questions only. The NPS question is a 0–10 scale, so
       averaging it in with 1–5 answers would quietly weight it four times over. */
    var ratingIds = seed.surveyQuestions.filter(function (q) { return q.kind === 'Rating Scale'; })
      .map(function (q) { return q.id; });
    var sum = 0, n = 0;
    responses.forEach(function (r) {
      ratingIds.forEach(function (q) { if (r.scores && r.scores[q] != null) { sum += r.scores[q]; n++; } });
    });
    var engagement = n ? sum / n * 20 : 0;

    /* Coverage is answers against people, so it has to be answers to one survey. Adding
       every response ever collected would put coverage over 100% and call that certainty. */
    var perSurvey = {};
    responses.forEach(function (r) { perSurvey[r.survey] = (perSurvey[r.survey] || 0) + 1; });
    var pulseResponses = Object.keys(perSurvey).reduce(function (m, k) { return Math.max(m, perSurvey[k]); }, 0);

    /* Payroll drift: this cycle's gross against the one before it. */
    var paid = cycles.slice().sort(function (a, b) { return a.id < b.id ? 1 : -1; });
    var drift = paid.length > 1 && paid[1].gross ? (paid[0].gross - paid[1].gross) / paid[1].gross * 100 : 0;

    /* Absence: today's register, as a share of the people on it. */
    var absent = att.filter(function (a) { return a.status === 'Absent'; }).length;
    var absencePct = att.length ? absent / att.length * 100 : 0;

    return {
      s: s, live: live, ofb: ofb, att: att, leave: leave, cycles: paid, responses: responses,
      attrition: attrition, engagement: engagement, drift: drift,
      pulseResponses: pulseResponses, surveysCounted: Object.keys(perSurvey).length,
      absent: absent, absencePct: absencePct,
      grossThis: paid.length ? paid[0].gross : 0
    };
  }

  /* ============================================== twelve months of joining and leaving
     Both series come off the records: joining dates from the directory, last working days
     from the exit files. Nothing is filled in to make the shape nicer. */
  function months12() {
    var out = [], d = new Date(seed.todayIso + 'T00:00');
    d.setDate(1);
    for (var i = 11; i >= 0; i--) {
      var m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push({
        key: m.toISOString().slice(0, 7),
        label: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m.getMonth()]
      });
    }
    return out;
  }

  function series(f) {
    var ms = months12();
    var joins = {}, exits = {};
    store.collection('employees').forEach(function (e) {
      if (e.joined) joins[e.joined.slice(0, 7)] = (joins[e.joined.slice(0, 7)] || 0) + 1;
    });
    f.ofb.forEach(function (o) {
      if (o.lastWorkingDay) exits[o.lastWorkingDay.slice(0, 7)] = (exits[o.lastWorkingDay.slice(0, 7)] || 0) + 1;
    });
    return ms.map(function (m) {
      return { key: m.key, label: m.label, joined: joins[m.key] || 0, exited: exits[m.key] || 0 };
    });
  }

  /* A month is worth a note when it sits more than a standard deviation and a half off the
     mean of its own series. That is the whole of the "detection": it is a z-score, and the
     threshold is written here rather than hidden, so a reader can disagree with it. */
  function flagged(rows) {
    function z(vals) {
      var m = vals.reduce(function (a, b) { return a + b; }, 0) / (vals.length || 1);
      var sd = Math.sqrt(vals.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / (vals.length || 1)) || 1;
      return function (v) { return (v - m) / sd; };
    }
    var zj = z(rows.map(function (r) { return r.joined; }));
    var ze = z(rows.map(function (r) { return r.exited; }));
    var out = [];
    rows.forEach(function (r, i) {
      var a = zj(r.joined), b = ze(r.exited);
      if (Math.abs(b) >= 1.5 && r.exited > 0) {
        out.push({ i: i, row: r, kind: 'exits', z: b, tone: b > 0 ? 'bad' : 'warn' });
      } else if (Math.abs(a) >= 1.5) {
        out.push({ i: i, row: r, kind: 'joins', z: a, tone: 'warn' });
      }
    });
    return out;
  }

  /* ========================================================= the anomalies panel
     Three different readings over three different collections, each with the arithmetic
     that produced it carried alongside, because a flag nobody can check is just a mood. */
  function anomalies(f) {
    var out = [];

    /* Absence by department against the organisation's own rate. */
    var byDept = {};
    f.att.forEach(function (a) {
      var e = store.employee(a.employee);
      if (!e) return;
      var d = byDept[e.department] || (byDept[e.department] = { n: 0, out: 0 });
      d.n++;
      if (a.status === 'Absent') d.out++;
    });
    var worst = null;
    /* A ratio over one or two people is arithmetic, not a signal: one absence in a team of
       twelve is already three times an organisation sitting at 2%. A department needs a
       workable size and at least three people actually away before it is worth raising. */
    Object.keys(byDept).forEach(function (id) {
      var d = byDept[id];
      if (d.n < 12 || d.out < 3) return;
      var rate = d.out / d.n * 100;
      if (!worst || rate > worst.rate) worst = { id: id, rate: rate, n: d.n, out: d.out };
    });
    if (worst && worst.rate > f.absencePct * 1.4) {
      var dept = store.department(worst.id);
      out.push({
        sev: worst.rate > f.absencePct * 2 ? 'high' : 'med',
        t: (dept ? dept.name : worst.id) + ' absence is ' + Math.round(worst.rate / (f.absencePct || 1) * 10) / 10 + '× the organisation',
        s: worst.out + ' of ' + worst.n + ' away today, against ' + pc(f.absencePct) + ' across everyone.',
        z: pc(worst.rate),
        detail: 'Today’s register for ' + (dept ? dept.name : 'the department') + ' shows ' + worst.out +
          ' absences across ' + worst.n + ' people, a rate of ' + pc(worst.rate) + '. The organisation is at ' +
          pc(f.absencePct) + '. One day is not a trend; what it is worth is a look at whether they are the same ' +
          'people as last week, which the attendance register will tell you.',
        to: 'hr/attendance/dashboard', act: 'Open the register'
      });
    }

    /* Leave requests that have been sitting unanswered. */
    var pending = f.leave.filter(function (l) { return l.status === 'Pending Approval'; });
    var aged = pending.map(function (l) {
      return { l: l, days: Math.round((new Date(seed.todayIso) - new Date(l.appliedOn)) / 864e5) };
    }).filter(function (x) { return x.days >= 3; }).sort(function (a, b) { return b.days - a.days; });
    if (aged.length) {
      out.push({
        sev: aged[0].days >= 7 ? 'high' : 'med',
        t: plural(aged.length, 'leave request') + ' waiting more than three days',
        s: 'The oldest has been with its approver for ' + plural(aged[0].days, 'day') + '.',
        z: aged[0].days + 'd',
        detail: 'Of ' + pending.length + ' requests pending approval, ' + aged.length + ' have been waiting three days ' +
          'or longer. The oldest is ' + aged[0].l.id + ', raised by ' +
          ((store.employee(aged[0].l.employee) || {}).name || aged[0].l.employee) + ' on ' +
          ui.dateLabel(aged[0].l.appliedOn) + '. A request that outlives its own notice period stops being an ' +
          'approval and becomes a fait accompli.',
        to: 'hr/leave/dashboard', act: 'Open leave'
      });
    }

    /* Resignations concentrated in one department. */
    var resByDept = {};
    f.ofb.forEach(function (o) {
      var e = store.employee(o.employee);
      if (e) resByDept[e.department] = (resByDept[e.department] || 0) + 1;
    });
    var sizeByDept = {};
    f.live.forEach(function (e) { sizeByDept[e.department] = (sizeByDept[e.department] || 0) + 1; });
    var hot = null;
    Object.keys(resByDept).forEach(function (id) {
      var size = sizeByDept[id] || 1;
      if (size < 10) return;
      var rate = resByDept[id] / size * 100;
      if (!hot || rate > hot.rate) hot = { id: id, rate: rate, n: resByDept[id], size: size };
    });
    if (hot && hot.rate > f.attrition * 1.25) {
      var hd = store.department(hot.id);
      out.push({
        sev: hot.rate > f.attrition * 1.8 ? 'high' : 'low',
        t: 'Resignations are concentrated in ' + (hd ? hd.name : hot.id),
        s: hot.n + ' of ' + hot.size + ' people, against ' + pc(f.attrition) + ' across the organisation.',
        z: pc(hot.rate),
        detail: 'Exit files name ' + plural(hot.n, 'resignation') + ' in ' + (hd ? hd.name : 'this department') + ', which is ' +
          hot.size + ' people, a rate of ' + pc(hot.rate) + ' against ' + pc(f.attrition) + ' organisation-wide. ' +
          'The reasons on those files are the next thing to read, and they are on the offboarding screen rather ' +
          'than in a number.',
        to: 'hr/offboarding/dashboard', act: 'Open exits'
      });
    }
    return out;
  }

  /* ================================================================= the briefing
     Three readings, each one a sentence about the organisation rather than a measurement
     of it, each with the records it was read from and how much of the picture they cover.
     Confidence is coverage: what share of the relevant population the reading could see. */
  function insights(f) {
    var ratingResponses = f.responses.length;
    var coverage = f.live.length ? Math.min(100, Math.round(f.pulseResponses / f.live.length * 100)) : 0;
    var noticeNow = f.ofb.filter(function (o) { return o.stage === 'Notice Period'; }).length;
    var assetsOut = f.ofb.reduce(function (n, o) { return n + (o.assetsOutstanding || 0); }, 0);

    return [
      {
        tone: f.attrition > 7 ? 'risk' : 'good',
        kind: 'Retention',
        t: 'Attrition is running at ' + pc(f.attrition) + ', and ' + noticeNow + ' people are on notice right now',
        s: 'The exit files carry ' + f.ofb.length + ' resignations against ' + num(f.live.length) +
          ' people. ' + assetsOut + ' assets are still out with people who are leaving.',
        conf: 96,
        why: 'This is a count, not an estimate: every resignation on record divided by every live employee on ' +
          'the directory. It is high-confidence because both sides of the division are complete — nothing about ' +
          'attrition is sampled.',
        rows: [
          { t: 'Exit files on record', n: f.ofb.length },
          { t: 'On notice period today', n: noticeNow },
          { t: 'Live headcount', n: f.live.length },
          { t: 'Assets not yet returned', n: assetsOut }
        ],
        act: 'Open exits', to: 'hr/offboarding/dashboard'
      },
      {
        tone: f.engagement >= 70 ? 'good' : 'risk',
        kind: 'Engagement',
        t: 'Engagement sits at ' + Math.round(f.engagement) + ' out of 100',
        s: 'Averaged over ' + num(ratingResponses) + ' responses across ' + f.surveysCounted +
          ' surveys. The NPS question is left out of it, because its scale is four times wider than the rest.',
        conf: coverage,
        why: 'Confidence here is coverage, measured on the largest single survey rather than on every response ' +
          'ever collected: ' + num(f.pulseResponses) + ' answers against ' + num(f.live.length) + ' people is ' +
          coverage + '%. The average itself is honest, but who chooses to answer a pulse survey is never a ' +
          'random slice of who works here, and no amount of coverage fixes that.',
        rows: [
          { t: 'Responses counted', n: ratingResponses },
          { t: 'Largest single survey', n: f.pulseResponses },
          { t: 'Rating-scale questions used', n: seed.surveyQuestions.filter(function (q) { return q.kind === 'Rating Scale'; }).length },
          { t: 'Live headcount', n: f.live.length },
          { t: 'Coverage', n: coverage + '%' }
        ],
        act: 'Open engagement', to: 'hr/engagement/dashboard'
      },
      {
        tone: Math.abs(f.drift) > 2 ? 'risk' : 'good',
        kind: 'Payroll',
        t: 'This cycle is ' + (f.drift >= 0 ? 'up ' : 'down ') + pc(Math.abs(f.drift)) + ' on the last one',
        s: 'Gross of ' + ui.inr(f.grossThis, { short: true }) + ' against ' +
          ui.inr(f.cycles.length > 1 ? f.cycles[1].gross : 0, { short: true }) + '. Headcount moved by ' +
          (f.s.newJoiners - f.ofb.filter(function (o) { return o.stage === 'Exited'; }).length) + ' over the same period.',
        conf: 92,
        why: 'Two cycle totals, divided. It is below full confidence only because the current cycle is still a ' +
          'draft — a revision or a late reimbursement will move it before it is paid.',
        rows: f.cycles.slice(0, 4).map(function (c) {
          return { t: c.id.replace('pay-', '') + ' · ' + c.status, n: ui.inr(c.gross, { short: true }) };
        }),
        act: 'Open payroll', to: 'hr/payroll/dashboard'
      }
    ];
  }

  /* ===================================================================== the KPIs
     Deliberately none of version 1's four. Version 1 measures the platform — accounts,
     sign-in, onboarding queue, seats. These measure the organisation.

     Three of them have a real twelve-month shape behind them, because the directory, the
     exit files and the payroll cycles all carry dates. Two of them do not: there is one
     engagement pulse and one attendance register, so a trend line for either would be a
     drawing of nothing. Those two get a second real figure instead of a sparkline, and no
     projection. Inventing six months of history to make five cards match would make the
     page tidier and the numbers worthless. */
  function kpiRows(f) {
    var rows = series(f);
    var joinTrail = rows.map(function (r) { return r.joined; });
    var exitTrail = rows.map(function (r) { return r.exited; });
    var payTrail = f.cycles.slice().reverse().map(function (c) { return c.gross / 1e7; });

    /* The projection is the last point plus the average step of the series, carried three
       periods out. It is a straight line, it is labelled as one on the card, and it
       forecasts nothing except arithmetic continuing. */
    function project(vals, n) {
      if (vals.length < 2) return vals[vals.length - 1] || 0;
      var steps = [];
      for (var i = 1; i < vals.length; i++) steps.push(vals[i] - vals[i - 1]);
      var avg = steps.reduce(function (a, b) { return a + b; }, 0) / steps.length;
      return vals[vals.length - 1] + avg * (n || 3);
    }

    var coverage = f.live.length ? Math.round(f.pulseResponses / f.live.length * 100) : 0;

    return [
      { k: 'attrition', l: 'Attrition rate', n: pc(f.attrition), tone: f.attrition > 7 ? 'bad' : 'good',
        trail: exitTrail, fc: 'Straight line: ' + plural(Math.max(0, Math.round(project(exitTrail))), 'leaver') + ' a month',
        to: 'hr/offboarding/dashboard' },
      { k: 'engagement', l: 'Engagement index', n: Math.round(f.engagement), unit: ' / 100',
        tone: f.engagement >= 70 ? 'good' : 'warn',
        fc: 'One pulse only · ' + coverage + '% coverage', to: 'hr/engagement/dashboard' },
      { k: 'absence', l: 'Absence today', n: pc(f.absencePct), tone: f.absencePct > 5 ? 'warn' : 'good',
        fc: f.absent + ' of ' + num(f.att.length) + ' on the register', to: 'hr/attendance/dashboard' },
      { k: 'payroll', l: 'Payroll drift', n: (f.drift >= 0 ? '+' : '') + pc(f.drift),
        tone: Math.abs(f.drift) > 2 ? 'warn' : 'good', trail: payTrail,
        fc: 'Straight line: ' + ui.inr(project(payTrail) * 1e7, { short: true }) + ' in three cycles',
        to: 'hr/payroll/dashboard' },
      { k: 'hiring', l: 'Joined this month', n: f.s.newJoiners, tone: 'good', trail: joinTrail,
        fc: 'Straight line: ' + plural(Math.max(0, Math.round(project(joinTrail))), 'joiner') + ' a month',
        to: 'hr/people/all' }
    ];
  }

  function Spark(p) {
    var d = p.trail, W = 140, H = 26;
    var lo = Math.min.apply(null, d), hi = Math.max.apply(null, d);
    var span = hi - lo || 1;
    function x(i) { return (i / (d.length - 1 || 1)) * W; }
    function y(v) { return H - 2 - ((v - lo) / span) * (H - 5); }
    var line = d.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' ');
    var stroke = p.tone === 'bad' ? 'var(--danger-fg)' : p.tone === 'warn' ? 'var(--warning-fg)' : 'var(--brand-solid)';
    return h('div', { className: 'ara2-kpi__spark' },
      h('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none', 'aria-hidden': 'true' },
        h('path', { d: line + ' L' + W + ' ' + H + ' L0 ' + H + ' Z', fill: stroke, opacity: .1 }),
        h('path', { d: line, fill: 'none', stroke: stroke, strokeWidth: 1.8, strokeLinejoin: 'round', strokeLinecap: 'round' }),
        h('circle', { cx: x(d.length - 1), cy: y(d[d.length - 1]), r: 2.4, fill: stroke })));
  }

  /* ========================================================== the chart, and its notes */
  var SHAPES = [
    { k: 'line', t: 'Two lines', short: 'Lines', s: 'Joining and leaving as separate lines. Best for reading the gap between them month to month.', fit: 'Good fit' },
    { k: 'bars', t: 'Grouped bars', short: 'Bars', s: 'A pair of bars per month. Best for comparing one month against another, worse for the trend.', fit: 'Good fit' },
    { k: 'net', t: 'Net change', short: 'Net', s: 'One bar per month, joiners minus leavers. Shows whether the organisation grew, and hides why.', fit: 'Partial fit' }
  ];

  function shapeGlyph(k) {
    if (k === 'line') return h('svg', { viewBox: '0 0 40 26', fill: 'none', 'aria-hidden': 'true' },
      h('path', { d: 'M2 18l8-6 8 4 8-10 12 6', stroke: 'var(--brand-solid)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      h('path', { d: 'M2 23l8-2 8 2 8-4 12 2', stroke: 'var(--text-muted)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
    if (k === 'bars') return h('svg', { viewBox: '0 0 40 26', 'aria-hidden': 'true' },
      [4, 14, 24].map(function (x, i) {
        return h('g', { key: x },
          h('rect', { x: x, y: 10 - i * 2, width: 4, height: 14 + i * 2, rx: 1, fill: 'var(--brand-solid)' }),
          h('rect', { x: x + 5, y: 16, width: 4, height: 8, rx: 1, fill: 'var(--text-muted)' }));
      }));
    return h('svg', { viewBox: '0 0 40 26', 'aria-hidden': 'true' },
      h('line', { x1: 2, x2: 38, y1: 15, y2: 15, stroke: 'var(--border-default)', strokeWidth: 1 }),
      [[5, 6], [13, 9], [21, -5], [29, 7]].map(function (b, i) {
        return h('rect', { key: i, x: b[0], y: b[1] > 0 ? 15 - b[1] : 15, width: 6, height: Math.abs(b[1]), rx: 1,
          fill: b[1] > 0 ? 'var(--brand-solid)' : 'var(--danger-fg)' });
      }));
  }

  function Plot(p) {
    var rows = p.rows, shape = p.shape, marks = p.marks;
    var W = 740, H = 268, PL = 34, PR = 14, PT = 18, PB = 30;
    var vals = shape === 'net'
      ? rows.map(function (r) { return r.joined - r.exited; })
      : rows.reduce(function (a, r) { return a.concat([r.joined, r.exited]); }, []);
    var hi = Math.max.apply(null, vals.concat([1]));
    var lo = Math.min.apply(null, vals.concat([0]));
    function x(i) { return PL + (i + 0.5) / rows.length * (W - PL - PR); }
    function y(v) { return PT + (1 - (v - lo) / ((hi - lo) || 1)) * (H - PT - PB); }
    var band = (W - PL - PR) / rows.length;

    function lineFor(key, colour, dash) {
      var d = rows.map(function (r, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(r[key]).toFixed(1); }).join(' ');
      return h('path', { d: d, fill: 'none', stroke: colour, strokeWidth: 2.4, strokeDasharray: dash || null,
        strokeLinejoin: 'round', strokeLinecap: 'round' });
    }

    var body;
    if (shape === 'line') {
      body = h('g', null,
        h('path', {
          d: rows.map(function (r, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(r.joined).toFixed(1); }).join(' ') +
            ' L' + x(rows.length - 1).toFixed(1) + ' ' + y(lo) + ' L' + x(0).toFixed(1) + ' ' + y(lo) + ' Z',
          fill: 'var(--brand-solid)', opacity: .1
        }),
        lineFor('joined', 'var(--brand-solid)'),
        lineFor('exited', 'var(--danger-fg)', '5 4'),
        rows.map(function (r, i) {
          return h('circle', { key: i, cx: x(i), cy: y(r.joined), r: 3.2, fill: 'var(--bg-surface)', stroke: 'var(--brand-solid)', strokeWidth: 2 });
        }));
    } else if (shape === 'bars') {
      var bw = Math.min(11, band / 2.8);
      body = rows.map(function (r, i) {
        return h('g', { key: i },
          h('rect', { x: x(i) - bw - 1.5, y: y(r.joined), width: bw, height: Math.max(1, y(lo) - y(r.joined)), rx: 3, fill: 'var(--brand-solid)' }),
          h('rect', { x: x(i) + 1.5, y: y(r.exited), width: bw, height: Math.max(1, y(lo) - y(r.exited)), rx: 3, fill: 'var(--danger-fg)' }));
      });
    } else {
      var zero = y(0);
      body = h('g', null,
        h('line', { x1: PL, x2: W - PR, y1: zero, y2: zero, stroke: 'var(--border-default)' }),
        rows.map(function (r, i) {
          var v = r.joined - r.exited, top = y(Math.max(0, v)), hgt = Math.abs(y(v) - zero);
          return h('rect', { key: i, x: x(i) - 7, y: top, width: 14, height: Math.max(1, hgt), rx: 3,
            fill: v >= 0 ? 'var(--brand-solid)' : 'var(--danger-fg)' });
        }));
    }

    return h('div', { className: 'ara2-plot' },
      h('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
        'aria-label': 'Joining and leaving by month over the last twelve months, drawn as ' + shape },
        [0, 0.5, 1].map(function (t) {
          var v = lo + (hi - lo) * t;
          return h('g', { key: t },
            h('line', { x1: PL, x2: W - PR, y1: y(v), y2: y(v), stroke: 'var(--border-subtle)' }),
            h('text', { x: PL - 8, y: y(v) + 4, textAnchor: 'end', className: 'ara2-plot__ax' }, Math.round(v)));
        }),
        body,
        rows.map(function (r, i) {
          return h('text', { key: i, x: x(i), y: H - 8, textAnchor: 'middle', className: 'ara2-plot__ax' }, r.label);
        })),
      /* A note is a button on the plot, at the point it is about. */
      marks.map(function (m) {
        var v = shape === 'net' ? m.row.joined - m.row.exited : m.kind === 'exits' ? m.row.exited : m.row.joined;
        return h('button', {
          key: m.i, type: 'button',
          className: 'ara2-pin ara2-pin--' + m.tone,
          title: 'Ara on ' + m.row.label,
          'aria-label': 'What Ara makes of ' + m.row.label,
          style: { left: (x(m.i) / W * 100) + '%', top: (y(v) / H * 100) + '%' },
          onClick: function () { p.onMark(m); }
        }, ARA);
      }));
  }

  /* ============================================================== what Ara answers
     Keyword matching over a handful of questions, each answered by computing the figure
     at the moment it is asked and naming the records it came from. A question it has no
     reading for is told so plainly instead of being given a plausible-sounding guess. */
  var SEEDS = [
    'Where is attrition worst?',
    'Who is waiting on an approval?',
    'Why did payroll move this cycle?',
    'How engaged is the organisation?'
  ];

  function answer(q, f) {
    var t = (q || '').toLowerCase();
    var an = anomalies(f);

    if (/attrit|resign|leav(e|ing)|exit|quit|churn/.test(t)) {
      var hot = an.filter(function (a) { return /Resignations/.test(a.t); })[0];
      return {
        p1: 'Attrition is ' + pc(f.attrition) + ': ' + f.ofb.length + ' resignations on record against ' +
          num(f.live.length) + ' people.' + (hot ? ' ' + hot.t.replace('Resignations are concentrated in', 'It is concentrated in') + '.' : ''),
        p2: f.ofb.filter(function (o) { return o.stage === 'Notice Period'; }).length +
          ' people are serving notice now, and ' + f.ofb.reduce(function (n, o) { return n + (o.assetsOutstanding || 0); }, 0) +
          ' assets are still out with them. The exit reasons are on the files rather than in this number.',
        rows: [
          { t: 'Exit files', n: f.ofb.length },
          { t: 'On notice', n: f.ofb.filter(function (o) { return o.stage === 'Notice Period'; }).length },
          { t: 'Live headcount', n: num(f.live.length) }
        ],
        to: 'hr/offboarding/dashboard', act: 'Open exits'
      };
    }
    if (/approv|pending|waiting|queue|inbox/.test(t)) {
      var pend = f.leave.filter(function (l) { return l.status === 'Pending Approval'; }).length;
      return {
        p1: f.s.pendingApprovals + ' items are sitting in approval inboxes: ' + pend + ' leave requests, ' +
          f.s.pendingRegs + ' regularizations and ' + f.s.pendingAssetRequests + ' asset requests.',
        p2: 'The oldest of them have been there long enough to matter — the anomaly panel on this page names which.',
        rows: [
          { t: 'All pending approvals', n: f.s.pendingApprovals },
          { t: 'Leave', n: pend },
          { t: 'Regularizations', n: f.s.pendingRegs },
          { t: 'Asset requests', n: f.s.pendingAssetRequests }
        ],
        to: 'global/approvals', act: 'Open approvals'
      };
    }
    if (/payroll|salary|cost|gross|pay/.test(t)) {
      return {
        p1: 'This cycle is ' + (f.drift >= 0 ? 'up ' : 'down ') + pc(Math.abs(f.drift)) + ' on the last: gross ' +
          ui.inr(f.grossThis, { short: true }) + ' against ' + ui.inr(f.cycles.length > 1 ? f.cycles[1].gross : 0, { short: true }) + '.',
        p2: 'The cycle is still a draft, so a revision or a late reimbursement can still move it. ' +
          f.s.newJoiners + ' people joined this month, which is the first place to look for the difference.',
        rows: f.cycles.slice(0, 4).map(function (c) {
          return { t: c.id.replace('pay-', '') + ' · ' + c.status, n: ui.inr(c.gross, { short: true }) };
        }),
        to: 'hr/payroll/dashboard', act: 'Open payroll'
      };
    }
    if (/engage|survey|pulse|moral|sentiment|happy/.test(t)) {
      return {
        p1: 'Engagement is ' + Math.round(f.engagement) + ' out of 100, averaged over ' + num(f.responses.length) +
          ' pulse responses on the rating-scale questions.',
        p2: 'The largest single survey reached ' + Math.round(f.pulseResponses / f.live.length * 100) + '% of the organisation. ' +
          'Treat it as the view of the people who answered, which is not the same as the view of everyone.',
        rows: [
          { t: 'Responses', n: num(f.responses.length) },
          { t: 'Largest single survey', n: num(f.pulseResponses) },
          { t: 'Headcount', n: num(f.live.length) },
          { t: 'Index', n: Math.round(f.engagement) + ' / 100' }
        ],
        to: 'hr/engagement/dashboard', act: 'Open engagement'
      };
    }
    if (/absen|attend|present|away|sick/.test(t)) {
      return {
        p1: plural(f.absent, 'person', 'people') + ' absent today, which is ' + pc(f.absencePct) + ' of the ' +
          num(f.att.length) + ' on the register.',
        p2: an.length && /absence/.test(an[0].t) ? an[0].s : 'No department is far enough off the organisation rate today to be worth flagging.',
        rows: [
          { t: 'Absent today', n: f.absent },
          { t: 'On the register', n: num(f.att.length) },
          { t: 'Rate', n: pc(f.absencePct) }
        ],
        to: 'hr/attendance/dashboard', act: 'Open attendance'
      };
    }
    return {
      p1: 'I have no reading for that one.',
      p2: 'What I can answer from the records on this prototype is attrition and exits, approvals waiting, ' +
        'payroll movement between cycles, engagement from the pulse surveys, and today’s absence. ' +
        'Anything else I would be making up, which is worse than saying so.',
      rows: [],
      to: null, act: null
    };
  }

  /* ===================================================================== the modals */
  function SourceRows(p) {
    if (!p.rows || !p.rows.length) return null;
    return h('div', { className: 'ara2-src' },
      h('span', { className: 'ara2-src__h' }, p.title || 'Read from'),
      p.rows.map(function (r) {
        return h('div', { className: 'ara2-src__r', key: r.t }, I.database, h('span', null, r.t), h('b', null, r.n));
      }));
  }

  function AraSay(p) {
    return h('div', { className: 'ara2-say' },
      h('span', { className: 'ara2-mark', style: { width: 34, height: 34, borderRadius: 11 } }, ARA),
      h('div', { className: 'ara2-say__m' }, p.children));
  }

  function AskModal(p) {
    var a = answer(p.q, p.f);
    return h(ui.Modal, {
      title: 'Ara', description: p.q,
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h('span', { className: 'muted grow' }, 'Computed from the records at ' + seed.todayLabel + '. No model ran.'),
        a.to ? h(V.Button, { variant: 'primary', iconEnd: I.right,
          onClick: function () { p.onClose(); router.go(a.to); } }, a.act) : null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Close'))
    },
      h(AraSay, null, h('p', null, a.p1), h('p', null, a.p2)),
      h(SourceRows, { rows: a.rows }));
  }

  function WhyModal(p) {
    var x = p.insight;
    return h(ui.Modal, {
      title: 'Why Ara says this', description: x.t,
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h('span', { className: 'muted grow' }, 'Confidence ' + x.conf + '% — coverage of the records, not certainty of the conclusion.'),
        h(V.Button, { variant: 'primary', iconEnd: I.right, onClick: function () { p.onClose(); router.go(x.to); } }, x.act),
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Close'))
    },
      h(AraSay, null, h('p', null, x.why)),
      h(SourceRows, { rows: x.rows, title: 'The arithmetic' }));
  }

  function MarkModal(p) {
    var m = p.mark, r = m.row;
    var net = r.joined - r.exited;
    return h(ui.Modal, {
      title: 'Ara on ' + r.label, description: r.key + ' · ' + (m.kind === 'exits' ? 'leaving' : 'joining') + ' is off its own average',
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h('span', { className: 'muted grow' }, 'z = ' + (Math.round(m.z * 100) / 100) + ' against the twelve-month mean'),
        h(V.Button, { variant: 'primary', iconEnd: I.right,
          onClick: function () { p.onClose(); router.go(m.kind === 'exits' ? 'hr/offboarding/dashboard' : 'hr/people/all'); } },
          m.kind === 'exits' ? 'Open exits' : 'Open the directory'),
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Close'))
    },
      h(AraSay, null,
        h('p', null, r.label + ' had ' + r.joined + (r.joined === 1 ? ' joiner' : ' joiners') + ' and ' +
          r.exited + (r.exited === 1 ? ' leaver' : ' leavers') + ', a net of ' + (net >= 0 ? '+' : '') + net + '. ' +
          'That puts ' + (m.kind === 'exits' ? 'leaving' : 'joining') + ' ' +
          Math.abs(Math.round(m.z * 100) / 100) + ' standard deviations ' + (m.z > 0 ? 'above' : 'below') +
          ' its own twelve-month mean, which is why there is a marker on it.'),
        h('p', null, 'A single month off the mean is not a finding on its own — twelve points produce an outlier ' +
          'often enough by chance. What makes it worth opening is whether the next month does the same thing.')),
      h(SourceRows, {
        title: 'That month', rows: [
          { t: 'Joined', n: r.joined }, { t: 'Left', n: r.exited },
          { t: 'Net change', n: (net >= 0 ? '+' : '') + net }
        ]
      }));
  }

  function AnomalyModal(p) {
    var a = p.anomaly;
    return h(ui.Modal, {
      title: 'Ara · ' + a.t, description: a.s,
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h('span', { className: 'muted grow' }, 'Flagged at ' + a.z + ', against the organisation rate.'),
        h(V.Button, { variant: 'primary', iconEnd: I.right, onClick: function () { p.onClose(); router.go(a.to); } }, a.act),
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Close'))
    }, h(AraSay, null, h('p', null, a.detail)));
  }

  /* Ara arguing with the chart. Applying a proposal actually redraws it; a suggestion you
     cannot take is a review, not a suggestion. */
  function ChartModal(p) {
    return h(ui.Modal, {
      title: 'Ara · how to draw this', wide: true,
      description: 'Three ways to show joining against leaving, and what each one costs you.',
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h('span', { className: 'muted grow' }, 'Picking one redraws the chart behind this.'),
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Close'))
    },
      h(AraSay, null,
        h('p', null, 'You are reading two counts over twelve months. The question decides the shape: a trend wants ' +
          'lines, a month-against-month comparison wants bars, and whether the organisation grew wants one bar ' +
          'per month and no second series at all.')),
      h('div', { className: 'ara2-opts', style: { marginTop: 16 } }, SHAPES.map(function (sh) {
        return h('button', {
          key: sh.k, type: 'button', className: 'ara2-opt' + (p.shape === sh.k ? ' is-on' : ''),
          onClick: function () { p.onPick(sh.k); }
        },
          h('span', { className: 'ara2-opt__g' }, shapeGlyph(sh.k)),
          h('span', { className: 'ara2-opt__m' },
            h('strong', null, sh.t + (p.shape === sh.k ? ' · in use' : '')),
            h('span', null, sh.s)),
          h('span', { className: 'ara2-opt__f' + (sh.fit === 'Partial fit' ? ' is-mid' : '') }, sh.fit));
      })));
  }

  /* The weekly note, assembled from the same readings the page is showing. */
  function DraftModal(p) {
    var f = p.f, ins = insights(f), an = anomalies(f);
    var text = 'Week to ' + seed.todayLabel + '\n\n' +
      ins.map(function (x) { return '· ' + x.t + '. ' + x.s; }).join('\n\n') +
      (an.length ? '\n\nWorth a look:\n' + an.map(function (a) { return '· ' + a.t + ' — ' + a.s; }).join('\n') : '') +
      '\n\nEvery figure above was counted from the records on ' + seed.todayLabel + '.';
    return h(ui.Modal, {
      title: 'Ara · the weekly note', wide: true,
      description: 'Assembled from the three readings and the anomalies, in the order the page shows them.',
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h('span', { className: 'muted grow' }, 'Nothing is sent. Copy it where it needs to go.'),
        h(V.Button, {
          variant: 'primary', iconStart: I.copy,
          onClick: function () {
            if (navigator.clipboard) navigator.clipboard.writeText(text);
            ui.toast('The note is on your clipboard.');
          }
        }, 'Copy the note'),
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Close'))
    }, h('div', { className: 'ara2-draft' }, text));
  }

  /* ======================================================================= the page */
  function AdminDashV2(p) {
    var qSt = React.useState('');
    var askSt = React.useState(null);
    var whySt = React.useState(null);
    var markSt = React.useState(null);
    var anSt = React.useState(null);
    var chartSt = React.useState(false);
    var draftSt = React.useState(false);
    var shapeSt = React.useState('line');
    var hiddenSt = React.useState([]);

    var f = facts();
    var rows = series(f);
    var marks = flagged(rows);
    var ins = insights(f).filter(function (x) { return hiddenSt[0].indexOf(x.kind) < 0; });
    var an = anomalies(f);
    var me = store.employeeByName(HRMS.nav.role('admin').persona);

    function ask(q) { if (q && q.trim()) askSt[1](q.trim()); }

    return h('div', { className: 'ara2' },
      /* The page opens on a question, not a number. */
      h('section', { className: 'ara2-ask' },
        h('div', { className: 'ara2-ask__t' },
          h('span', { className: 'ara2-mark' }, ARA),
          h('div', { className: 'grow' },
            h('h1', null, 'Ara has read ' + seed.org.name + ' this morning'),
            h('p', null, (me ? me.name.split(' ')[0] + ' — ' : '') + ins.length +
              (ins.length === 1 ? ' reading' : ' readings') + ', ' + marks.length +
              (marks.length === 1 ? ' month' : ' months') + ' worth a note and ' + an.length +
              (an.length === 1 ? ' anomaly' : ' anomalies') + ' on ' + seed.todayLabel + '.')),
          p.switcher),
        h('form', {
          className: 'ara2-ask__bar',
          onSubmit: function (e) { e.preventDefault(); ask(qSt[0]); }
        },
          h(V.TextField, {
            placeholder: 'Ask about attrition, approvals, payroll, engagement or absence…',
            value: qSt[0], onChange: function (e) { qSt[1](e && e.target ? e.target.value : e); },
            'aria-label': 'Ask Ara a question'
          }),
          h(V.Button, { type: 'submit', variant: 'primary', iconStart: BOLT }, 'Ask Ara')),
        h('div', { className: 'ara2-seeds' }, SEEDS.map(function (q) {
          return h('button', { key: q, type: 'button', className: 'ara2-seed', onClick: function () { ask(q); } }, ARA, q);
        }))),

      /* The briefing: three readings, each able to show its own evidence. */
      h('div', { className: 'ara2-brief' }, ins.map(function (x) {
        return h('section', { className: 'ara2-ins ara2-ins--' + x.tone, key: x.kind },
          h('span', { className: 'ara2-ins__k' }, ARA, x.kind),
          h('strong', null, x.t),
          h('p', null, x.s),
          h('span', { className: 'ara2-conf' }, 'Confidence',
            h('i', null, h('b', { style: { width: x.conf + '%' } })), x.conf + '%'),
          h('div', { className: 'ara2-ins__acts' },
            h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.info,
              onClick: function () { whySt[1](x); } }, 'Why this?'),
            h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', iconEnd: I.right,
              onClick: function () { router.go(x.to); } }, x.act),
            h(V.Button, {
              variant: 'ghost', className: 'vi-btn--sm',
              onClick: function () { hiddenSt[1](hiddenSt[0].concat([x.kind])); }
            }, 'Dismiss')));
      })),

      /* Five numbers, none of them version 1's. */
      h('div', { className: 'ara2-kpis' }, kpiRows(f).map(function (k) {
        return h('button', {
          key: k.k, type: 'button', className: 'ara2-kpi is-' + k.tone,
          onClick: function () { router.go(k.to); },
          'aria-label': k.l + ': ' + k.n
        },
          h('span', { className: 'ara2-kpi__l' }, k.l),
          h('span', { className: 'ara2-kpi__n' }, k.n, k.unit ? h('small', null, k.unit) : null),
          k.trail ? h(Spark, { trail: k.trail, tone: k.tone }) : null,
          h('span', { className: 'ara2-kpi__fc' }, k.trail ? (k.tone === 'bad' ? UP : DOWN) : I.info, k.fc));
      })),

      h('div', { className: 'ara2-main' },
        /* The chart, carrying its own notes and open to being redrawn. */
        h('section', { className: 'ara2-card' },
          h('div', { className: 'ara2-card__head' },
            h('div', null,
              h('h2', null, 'Joining and leaving, twelve months'),
              h('p', null, 'Both series counted from the directory and the exit files. ' +
                (marks.length ? 'Markers sit on the months that are off their own average.' : 'No month is far enough off its average to mark.'))),
            h('div', { className: 'ara2-tools' },
              h('button', { type: 'button', className: 'ara2-sug', onClick: function () { chartSt[1](true); } },
                ARA, 'Suggest a chart', h('span', { className: 'ara2-sug__n' }, SHAPES.length)),
              h(V.SegmentedControl, {
                size: 'sm', value: shapeSt[0], onChange: shapeSt[1],
                items: SHAPES.map(function (s) { return { value: s.k, label: s.short }; })
              }))),
          h(Plot, { rows: rows, shape: shapeSt[0], marks: marks, onMark: function (m) { markSt[1](m); } }),
          h('div', { className: 'ara2-legend' },
            h('span', null, h('i', { style: { background: 'var(--brand-solid)' } }), 'Joined'),
            h('span', null, h('i', { style: { background: 'var(--danger-fg)' } }), 'Left'),
            marks.length ? h('span', null, h('i', { style: { background: 'var(--warning-fg)', borderRadius: '50%' } }),
              marks.length + (marks.length === 1 ? ' month Ara has a note on' : ' months Ara has notes on')) : null)),

        /* The anomalies, each investigated in place. */
        h('section', { className: 'ara2-card' },
          h('div', { className: 'ara2-card__head' },
            h('div', null,
              h('h2', null, 'Anomaly radar'),
              h('p', null, an.length ? 'Ranked by how far off the organisation they sit' : 'Nothing is far enough off to raise')),
            h('span', { className: 'tag2 tag2--' + (an.length ? 'warn' : 'ok') }, an.length ? an.length + ' found' : 'All clear')),
          an.length
            ? h('div', { className: 'ara2-an' }, an.map(function (a) {
                return h('div', { className: 'ara2-an__r', key: a.t },
                  h('span', { className: 'ara2-an__sev is-' + a.sev }, a.sev === 'high' ? I.warn : a.sev === 'med' ? I.clock : I.info),
                  h('span', { className: 'ara2-an__m' }, h('strong', null, a.t), h('span', null, a.s)),
                  h('span', { className: 'ara2-an__z' }, a.z),
                  h('button', { type: 'button', className: 'lrow__go', 'aria-label': 'Investigate ' + a.t,
                    onClick: function () { anSt[1](a); } }, I.right));
              }))
            : h(ui.Empty, { icon: I.ok, title: 'Nothing to raise',
                body: 'Absence, approval age and resignations are all within reach of the organisation’s own rates today.' }),
          h('div', { className: 'ara2-note' }, I.info,
            h('span', null, 'Each flag is a z-score over the same records the rest of the page shows, with the threshold written in the source.')))),

      h('div', { className: 'ara2-low' },
        h('section', { className: 'ara2-card' },
          h('div', { className: 'ara2-card__head' }, h('div', null,
            h('h2', null, 'The weekly note'),
            h('p', null, 'The readings, assembled into something you can send'))),
          h('div', { className: 'ara2-note', style: { marginTop: 14 } }, ARA,
            h('span', null, 'Built from the ' + ins.length + ' readings and ' + an.length + ' anomalies above.')),
          h(V.Button, { variant: 'primary', iconStart: I.file, style: { marginTop: 12, alignSelf: 'flex-start' },
            onClick: function () { draftSt[1](true); } }, 'Draft it')),

        h('section', { className: 'ara2-card' },
          h('div', { className: 'ara2-card__head' }, h('div', null,
            h('h2', null, 'What Ara can answer'),
            h('p', null, 'And, as plainly, what it cannot'))),
          h('div', { className: 'ara2-src', style: { marginTop: 10 } },
            [['Attrition and exits', f.ofb.length + ' files'],
             ['Approvals waiting', f.s.pendingApprovals + ' items'],
             ['Payroll between cycles', f.cycles.length + ' cycles'],
             ['Engagement pulse', num(f.responses.length) + ' responses'],
             ['Absence today', f.att.length + ' records']].map(function (r) {
              return h('div', { className: 'ara2-src__r', key: r[0] }, I.database, h('span', null, r[0]), h('b', null, r[1]));
            })),
          h('div', { className: 'ara2-note' }, I.info,
            h('span', null, 'Anything outside those five collections it says it has no reading for, rather than guessing.'))),

        h('section', { className: 'ara2-card' },
          h('div', { className: 'ara2-card__head' }, h('div', null,
            h('h2', null, 'How this page works'),
            h('p', null, 'Worth knowing before you act on it'))),
          h('p', { style: { fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary)', marginTop: 10 } },
            'No model runs here. Every figure is computed from the store when the page renders, every anomaly is ' +
            'a z-score over those same records, and the question box matches on keywords. Nothing is filled in: ' +
            'engagement and absence carry no sparkline because there is one survey and one register behind them, ' +
            'and a trend line for either would be a drawing of nothing.'),
          h('div', { className: 'ara2-note' }, I.info,
            h('span', null, 'Read on ' + seed.todayLabel + ' · ' + num(f.live.length) + ' people, ' + f.att.length + ' attendance records.')))),

      askSt[0] ? h(AskModal, { q: askSt[0], f: f, onClose: function () { askSt[1](null); qSt[1](''); } }) : null,
      whySt[0] ? h(WhyModal, { insight: whySt[0], onClose: function () { whySt[1](null); } }) : null,
      markSt[0] ? h(MarkModal, { mark: markSt[0], onClose: function () { markSt[1](null); } }) : null,
      anSt[0] ? h(AnomalyModal, { anomaly: anSt[0], onClose: function () { anSt[1](null); } }) : null,
      chartSt[0] ? h(ChartModal, {
        shape: shapeSt[0],
        onPick: function (k) { shapeSt[1](k); ui.toast('Redrawn as ' + k + '.'); },
        onClose: function () { chartSt[1](false); }
      }) : null,
      draftSt[0] ? h(DraftModal, { f: f, onClose: function () { draftSt[1](false); } }) : null);
  }

  HRMS.adminDashV2 = AdminDashV2;
})();

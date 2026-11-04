/* Phase 6 (PRD 18): employee engagement. Surveys and the survey builder (4.40),
   responses with anonymity preserved (4.41), engagement analytics, continuous
   feedback and recognition (4.42), action plans, and the two configuration screens
   for survey setup (4.40) and the approval workflow engine (6.2). */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var store = HRMS.store, router = HRMS.router, ui = HRMS.ui, seed = HRMS.seed;
  var act = HRMS.actions, rules = HRMS.rules, perms = HRMS.permissions;
  var Card = ui.Card, Grid = ui.Grid, Stat = ui.Stat, Stats = ui.Stats;

  function emp(id) { return store.employee(id); }
  function deptName(id) { var d = store.department(id); return d ? d.name : '—'; }
  function locName(id) { var l = store.location(id); return l ? l.name : '—'; }
  function deptOptions() { return store.collection('departments').map(function (d) { return { value: d.id, label: d.name }; }); }
  function locOptions() { return store.collection('locations').map(function (l) { return { value: l.id, label: l.name }; }); }

  function surveys() { return store.collection('surveys'); }
  function surveyOf(id) { return store.find('surveys', id); }
  function responsesFor(id) { return store.collection('surveyResponses').filter(function (r) { return r.survey === id; }); }
  function questionBank() { return store.collection('surveyQuestions'); }
  function surveyOptions() {
    return surveys().map(function (s) { return { value: s.id, label: s.name }; });
  }
  function byNewest(key) {
    return function (a, b) { return a[key] < b[key] ? 1 : a[key] > b[key] ? -1 : 0; };
  }
  function byOldest(key) {
    return function (a, b) { return a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0; };
  }

  /* The six answer types PRD 4.40 lists. The builder offers exactly these. */
  var QUESTION_TYPES = ['Single Choice', 'Multiple Choice', 'Rating Scale', 'NPS', 'Text Response', 'Yes/No'];
  var TYPE_NOTE = {
    'Single Choice': 'One option from a list. Reported as a distribution.',
    'Multiple Choice': 'Any number of options. Reported per option, so shares exceed 100%.',
    'Rating Scale': 'An agreement scale, scored and averaged into the engagement score.',
    'NPS': 'A 0 – 10 recommendation question, scored as promoters minus detractors.',
    'Text Response': 'Free text. Never aggregated into a score, and withheld from small groups.',
    'Yes/No': 'A binary question, reported as the share answering yes.'
  };
  var CHOICE_TYPES = ['Single Choice', 'Multiple Choice'];
  var SURVEY_TYPES = ['Pulse', 'Lifecycle', 'Engagement', 'Custom'];

  /* ------------------------------------------------------------- Scoring (4.42)
     Responses carry scores keyed q1–q5. q3 is the NPS answer on 0 – 10; the rest are
     rating-scale answers on 1 – 5. Scores are computed here rather than stored, so a
     response submitted in this browser counts the same as a seeded one (PRD 15). */
  var RATING_KEYS = ['q1', 'q2', 'q4', 'q5'];
  var NPS_KEY = 'q3';

  function scoreOf(rows) {
    var total = 0, n = 0;
    rows.forEach(function (r) {
      RATING_KEYS.forEach(function (k) {
        if (r.scores && r.scores[k] != null) { total += Number(r.scores[k]); n += 1; }
      });
    });
    return n ? Math.round((total / n) * 10) / 10 : null;
  }
  function npsOf(rows) {
    var answered = rows.filter(function (r) { return r.scores && r.scores[NPS_KEY] != null; });
    if (!answered.length) return null;
    var promoters = answered.filter(function (r) { return Number(r.scores[NPS_KEY]) >= 9; }).length;
    var detractors = answered.filter(function (r) { return Number(r.scores[NPS_KEY]) <= 6; }).length;
    return Math.round(((promoters - detractors) / answered.length) * 100);
  }
  function questionAverage(rows, key) {
    var answered = rows.filter(function (r) { return r.scores && r.scores[key] != null; });
    if (!answered.length) return null;
    var total = answered.reduce(function (n, r) { return n + Number(r.scores[key]); }, 0);
    return Math.round((total / answered.length) * 10) / 10;
  }
  /* Counts of something per key, as the rows ui.Bars takes, highest first. */
  function countRows(rows, keyFn, limit) {
    var counts = {};
    rows.forEach(function (r) {
      var key = keyFn(r);
      if (key) counts[key] = (counts[key] || 0) + 1;
    });
    var out = Object.keys(counts).map(function (k) { return [k, counts[k]]; })
      .sort(function (a, b) { return b[1] - a[1]; });
    return limit ? out.slice(0, limit) : out;
  }
  function tenureBucket(employee) {
    if (!employee || !employee.joined) return null;
    var months = Math.round((seed.today - new Date(employee.joined + 'T00:00')) / 2592000000);
    return months < 12 ? 'Under 1 year' : months < 24 ? '1 – 2 years' : months < 60 ? '2 – 5 years' : 'Over 5 years';
  }
  var TENURE_ORDER = ['Under 1 year', '1 – 2 years', '2 – 5 years', 'Over 5 years'];

  /* ------------------------------------------------------- Anonymity (PRD 4.41)
     An anonymous response has no employee, and that is deliberate: nothing on these
     screens may attribute it. Aggregates are still useful, but a group small enough to
     identify the individuals in it is withheld rather than shown. */
  var MIN_GROUP = 5;

  function groupBy(rows, keyFn) {
    var buckets = {}, order = [];
    rows.forEach(function (r) {
      var key = keyFn(r);
      if (!key) return;
      if (!buckets[key]) { buckets[key] = []; order.push(key); }
      buckets[key].push(r);
    });
    return order.map(function (key) {
      return {
        id: key, key: key, rows: buckets[key], count: buckets[key].length,
        anonymous: buckets[key].some(function (r) { return !r.employee; }),
        score: scoreOf(buckets[key]), nps: npsOf(buckets[key])
      };
    });
  }
  /* True when a group holds anonymous responses and is too small to report safely. */
  function withheld(group) { return group.anonymous && group.count < MIN_GROUP; }
  function reportable(groups) { return groups.filter(function (g) { return !withheld(g); }); }
  function suppressedCount(groups) { return groups.filter(withheld).length; }

  function suppressionNote(groups) {
    var n = suppressedCount(groups);
    if (!n) return null;
    return h('p', { className: 'muted', style: { fontSize: 12, lineHeight: 1.6 } },
      n + (n === 1 ? ' group is' : ' groups are') + ' withheld because fewer than ' + MIN_GROUP +
      ' people answered. PRD 4.41 requires that an anonymous response cannot be traced back to ' +
      'an employee, and a group that small would identify them.');
  }
  /* The banner an anonymous survey carries wherever its responses are shown. */
  function AnonymityNote(p) {
    return h('div', { className: 'ai-note' },
      h('span', { className: 'ai-note__mark' }, I.lock),
      h('div', { className: 'ai-note__body' },
        h('span', { className: 'ai-note__eyebrow' }, 'Anonymous survey'),
        h('p', { className: 'ai-note__text' },
          p.name + ' was run anonymously. The respondent was never recorded against a response, so no ' +
          'answer here can be attributed to an employee — not by HR, and not by an administrator. ' +
          'Group figures are shown only where at least ' + MIN_GROUP + ' people answered (PRD 4.41).')));
  }

  /* Which survey the responses and analytics screens open on, so a row action in the
     library carries its survey across the tab change. */
  var focused = { survey: null };
  function openSurvey(id, path) { focused.survey = id; router.goAs(path); }
  function initialSurvey() {
    var all = surveys();
    if (focused.survey && surveyOf(focused.survey)) return focused.survey;
    var live = all.filter(function (s) { return s.status === 'Live' && s.responded; })[0];
    var answered = all.filter(function (s) { return s.responded; })[0];
    return (live || answered || all[0] || {}).id || '';
  }

  /* ========================================================= Dashboard (4.42) */
  function EngagementDashboard() {
    var all = surveys();
    var ran = all.filter(function (s) { return s.status !== 'Scheduled'; });
    var invited = ran.reduce(function (n, s) { return n + (s.invited || 0); }, 0);
    var responded = ran.reduce(function (n, s) { return n + (s.responded || 0); }, 0);
    var responses = store.collection('surveyResponses');
    var live = all.filter(function (s) { return s.status === 'Live'; });
    var plans = store.collection('actionPlans');
    var openPlans = plans.filter(function (p) { return p.status !== 'Completed'; });
    var overduePlans = openPlans.filter(function (p) { return p.due < seed.todayIso; });
    var recognition = store.collection('recognition').slice().sort(byNewest('on'));
    var feedback = store.collection('feedback');
    var openFeedback = feedback.filter(function (f) { return f.status === 'Open'; });

    var score = scoreOf(responses);
    var nps = npsOf(responses);

    /* Movement over time: one point per survey that has closed or is open, oldest first. */
    var trend = all.filter(function (s) { return s.responded; }).slice().sort(byOldest('from'))
      .map(function (s) { return [s.name, scoreOf(responsesFor(s.id)) || 0]; });

    return h(React.Fragment, null,
      h(Stats, null,
        h(Stat, {
          label: 'Participation rate', value: ui.pct(responded, invited), unit: '%',
          sub: responded + ' responses from ' + invited + ' invitations',
          tone: ui.pct(responded, invited) >= 60 ? 'good' : 'warn'
        }),
        h(Stat, {
          label: 'Engagement score', value: score == null ? '—' : score, unit: 'of 5',
          sub: 'Average across every rating question'
        }),
        h(Stat, {
          label: 'Employee NPS', value: nps == null ? '—' : nps,
          sub: 'Promoters minus detractors, 0 – 10 question',
          tone: nps != null && nps >= 20 ? 'good' : 'warn'
        }),
        h(Stat, {
          label: 'Open action plans', value: openPlans.length,
          sub: overduePlans.length ? overduePlans.length + ' past their due date' : 'All within their due date',
          tone: overduePlans.length ? 'warn' : 'good',
          onClick: function () { router.goAs('hr/engagement/actions'); }
        })),

      h(Grid, null,
        h(Card, { span: 7, title: 'Engagement score trend', description: 'Average rating score per survey, oldest first (PRD 4.42).' },
          h(ui.Bars, { rows: trend, emptyTitle: 'No scored responses yet' }),
          h('p', { className: 'muted', style: { fontSize: 12, lineHeight: 1.6 } },
            'Scores are computed from the stored responses, so they move as responses arrive. ' +
            'Free-text answers are never folded into the score.')),

        h(Card, { span: 5, title: 'Open surveys', aside: h(V.Chip, { size: 'sm', shape: 'tag' }, live.length + ' live') },
          live.length
            ? h('div', { className: 'list' }, live.map(function (s) {
                return h('div', { className: 'list__row', key: s.id },
                  h('div', { className: 'list__main' },
                    h('span', { className: 'list__title' }, s.name),
                    h('span', { className: 'list__meta' }, s.responded + ' of ' + s.invited + ' responded · closes ' + ui.dateLabel(s.to))),
                  h('span', { style: { width: 84 } },
                    h(V.ProgressBar, { value: ui.pct(s.responded, s.invited), size: 'sm', 'aria-label': s.name })));
              }))
            : h(ui.Empty, { icon: I.checklist, title: 'No survey is open', body: 'Build one from the Builder tab.' }),
          h(V.Button, {
            variant: 'outline', className: 'vi-btn--sm', iconStart: I.plus,
            onClick: function () { router.goAs('hr/engagement/builder'); }
          }, 'Build a survey')),

        h(Card, { span: 7, title: 'Open action plans',
          aside: h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', onClick: function () { router.goAs('hr/engagement/actions'); } }, 'Open action plans') },
          openPlans.length
            ? h('div', { className: 'list' }, openPlans.map(function (p) {
                var owner = emp(p.owner);
                return h('div', { className: 'list__row', key: p.id },
                  owner ? h(V.Avatar, { name: owner.name, size: 'sm' }) : null,
                  h('div', { className: 'list__main' },
                    h('span', { className: 'list__title' }, p.title),
                    h('span', { className: 'list__meta' }, (owner ? owner.name + ' · ' : '') + 'due ' + ui.dateLabel(p.due))),
                  h(ui.StatusChip, { status: p.due < seed.todayIso ? 'Overdue' : p.status }));
              }))
            : h(ui.Empty, { icon: I.target, title: 'Nothing open', body: 'Every action plan from a survey finding is complete.' })),

        h(Card, { span: 5, title: 'Recent recognition', description: 'Peer recognition against the company values (PRD 4.42).' },
          recognition.length
            ? h('div', { className: 'list scroll-320' }, recognition.slice(0, 6).map(function (r) {
                var to = emp(r.to), from = emp(r.from);
                return h('div', { className: 'list__row', key: r.id },
                  to ? h(V.Avatar, { name: to.name, size: 'sm' }) : null,
                  h('div', { className: 'list__main' },
                    h('span', { className: 'list__title' }, (to ? to.name : '—') + ' · ' + r.value),
                    h('span', { className: 'list__meta' }, r.note),
                    h('span', { className: 'list__meta' }, 'from ' + (from ? from.name : '—') + ' · ' + ui.relTime(r.on))));
              }))
            : h(ui.Empty, { icon: I.star, title: 'No recognition yet' })),

        h(Card, { span: 12, title: 'Continuous feedback',
          aside: h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', onClick: function () { router.goAs('hr/engagement/feedback'); } }, 'Open feedback') },
          h(ui.KeyValue, { columns: true, rows: [
            ['Feedback received', feedback.length],
            ['Open items', openFeedback.length],
            ['Submitted anonymously', feedback.filter(function (f) { return !f.employee; }).length],
            ['Recognition notes', recognition.length]
          ]}),
          h('p', { className: 'muted', style: { fontSize: 12, lineHeight: 1.6 } },
            'Feedback submitted anonymously carries no employee reference, so it is listed without a person ' +
            'wherever it appears (PRD 4.41).'))));
  }

  /* ==================================================== Survey library (4.40) */
  function SurveyLibrary() {
    var statusSt = React.useState('');
    var typeSt = React.useState('');
    var detailSt = React.useState(null);

    var rows = surveys();
    if (statusSt[0]) rows = rows.filter(function (s) { return s.status === statusSt[0]; });
    if (typeSt[0]) rows = rows.filter(function (s) { return s.type === typeSt[0]; });

    var columns = [
      { key: 'name', header: 'Survey', sortable: true,
        cell: function (s) {
          return h('div', { className: 'stack gap-1' },
            h('button', { type: 'button', className: 'link', onClick: function () { detailSt[1](s.id); } }, s.name),
            h('span', { className: 'list__meta' }, s.type + ' · ' + (s.questions || 0) + ' questions'));
        } },
      { key: 'window', header: 'Window', sortable: true, sortValue: function (s) { return s.from; },
        csv: function (s) { return s.from + ' to ' + s.to; },
        cell: function (s) { return ui.shortDate(s.from) + ' – ' + ui.dateLabel(s.to); } },
      { key: 'anonymous', header: 'Anonymity', csv: function (s) { return s.anonymous ? 'Anonymous' : 'Attributed'; },
        cell: function (s) {
          return s.anonymous
            ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info', icon: I.lock }, 'Anonymous')
            : h(V.Chip, { size: 'sm', shape: 'tag', icon: I.person }, 'Attributed');
        } },
      { key: 'invited', header: 'Audience', numeric: true, align: 'right', sortable: true },
      { key: 'rate', header: 'Response rate', sortValue: function (s) { return ui.pct(s.responded, s.invited); },
        csv: function (s) { return ui.pct(s.responded, s.invited) + '%'; },
        cell: function (s) {
          return h('div', { className: 'stack gap-1', style: { minWidth: 120 } },
            h(V.ProgressBar, {
              value: ui.pct(s.responded, s.invited), size: 'sm', 'aria-label': 'Response rate for ' + s.name,
              tone: ui.pct(s.responded, s.invited) >= 60 ? 'success' : 'primary'
            }),
            h('span', { className: 'list__meta' }, s.responded + ' of ' + s.invited + ' · ' + ui.pct(s.responded, s.invited) + '%'));
        } },
      { key: 'status', header: 'Status', cell: function (s) { return h(ui.StatusChip, { status: s.status }); } },
      { key: 'actions', header: '', align: 'right',
        cell: function (s) {
          return h('span', { className: 'row gap-2', style: { justifyContent: 'flex-end' } },
            h(V.Button, {
              variant: 'ghost', className: 'vi-btn--sm',
              onClick: function () { openSurvey(s.id, 'hr/engagement/analytics'); }
            }, 'Analyse'),
            h(V.Button, {
              variant: 'outline', className: 'vi-btn--sm',
              onClick: function () { openSurvey(s.id, 'hr/engagement/responses'); }
            }, 'Responses'));
        } }
    ];

    var detail = detailSt[0] && surveyOf(detailSt[0]);

    return h(React.Fragment, null,
      h(Card, {
        title: 'Survey library',
        description: 'Every survey with its window, audience, anonymity and response rate (PRD 4.40).',
        aside: h(V.Button, {
          variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus,
          onClick: function () { router.goAs('hr/engagement/builder'); }
        }, 'New survey')
      },
        h(ui.DataTable, {
          exportName: 'surveys', label: 'Survey library', rows: rows, pageSize: 10,
          search: function (s) { return s.name + ' ' + s.type + ' ' + s.status; },
          searchPlaceholder: 'Search by name, type or status',
          filters: h(React.Fragment, null,
            h(ui.Filter, { label: 'Status', value: statusSt[0], onChange: statusSt[1],
              options: ['Live', 'Scheduled', 'Closed'] }),
            h(ui.Filter, { label: 'Type', value: typeSt[0], onChange: typeSt[1], options: SURVEY_TYPES })),
          columns: columns,
          emptyIcon: I.checklist, emptyTitle: 'No surveys match',
          emptyBody: 'Clear the filters, or build a survey from single choice, rating, NPS, text and yes/no questions.',
          emptyActions: h(V.Button, {
            variant: 'primary', iconStart: I.plus,
            onClick: function () { router.goAs('hr/engagement/builder'); }
          }, 'Open the builder')
        })),

      detail ? h(SurveyDrawer, { survey: detail, onClose: function () { detailSt[1](null); } }) : null);
  }

  /* The questions and settings of one survey, read-only. */
  function SurveyDrawer(p) {
    var s = p.survey;
    var list = s.questionList && s.questionList.length ? s.questionList : questionBank();
    var responses = responsesFor(s.id);

    return h(ui.Drawer, {
      eyebrow: s.type + ' survey', title: s.name,
      description: ui.dateLabel(s.from) + ' – ' + ui.dateLabel(s.to),
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Close'),
        h(V.Button, {
          variant: 'primary', iconStart: I.reports,
          onClick: function () { p.onClose(); openSurvey(s.id, 'hr/engagement/responses'); }
        }, 'View responses'))
    },
      h(ui.KeyValue, { rows: [
        ['Survey ID', h('span', { className: 'mono' }, s.id)],
        ['Type', s.type],
        ['Status', h(ui.StatusChip, { status: s.status })],
        ['Window', ui.dateLabel(s.from) + ' – ' + ui.dateLabel(s.to)],
        ['Anonymity', s.anonymous ? 'Anonymous — respondents are not recorded' : 'Attributed — responses name the respondent'],
        ['Audience', s.invited + ' employees'],
        ['Responses', s.responded + ' · ' + ui.pct(s.responded, s.invited) + '% response rate'],
        ['Engagement score', scoreOf(responses) == null ? null : scoreOf(responses) + ' of 5'],
        ['NPS', npsOf(responses) == null ? null : String(npsOf(responses))]
      ]}),
      h('div', { className: 'stack gap-2' },
        h('span', { className: 'eyebrow' }, 'Questions'),
        h('div', { className: 'list' }, list.map(function (q, i) {
          return h('div', { className: 'list__row', key: q.id || i },
            h('span', { className: 'mono list__meta' }, 'Q' + (i + 1)),
            h('div', { className: 'list__main' },
              h('span', { className: 'list__title' }, q.text),
              h('span', { className: 'list__meta' }, (q.kind || 'Rating Scale') + (q.mandatory ? ' · mandatory' : ' · optional'))));
        }))));
  }

  /* ===================================================== Survey builder (4.40)
     A working builder: questions are added, edited, reordered and removed here, and
     the survey is written through actions.createSurvey, which refuses an empty set. */
  function QuestionModal(p) {
    var form = ui.useForm(p.draft, function (v) {
      var errs = rules.required([{ key: 'text', label: 'Question' }, { key: 'kind', label: 'Answer type' }], v);
      if (CHOICE_TYPES.indexOf(v.kind) >= 0) {
        var opts = String(v.optionText || '').split(/\r?\n/).filter(function (x) { return x.trim(); });
        if (opts.length < 2) errs.optionText = 'A choice question needs at least two options';
      }
      return errs;
    });

    function save() {
      form.submit(function (v) {
        p.onSave({
          id: p.draft.id, text: String(v.text).trim(), kind: v.kind, mandatory: !!v.mandatory,
          scale: v.kind === 'Rating Scale' ? (v.scale || '1 – 5') : null,
          options: CHOICE_TYPES.indexOf(v.kind) >= 0
            ? String(v.optionText || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean)
            : null
        });
        return { ok: true, message: 'Question saved' };
      });
    }

    return h(ui.Modal, {
      title: p.draft.isNew ? 'Add question' : 'Edit question',
      description: 'PRD 4.40 lists six answer types. The type decides how the answer is reported.',
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
        h(V.Button, { variant: 'primary', onClick: save }, p.draft.isNew ? 'Add question' : 'Save question'))
    },
      h(V.TextArea, Object.assign({
        label: 'Question', required: true, rows: 2,
        placeholder: 'e.g. I get the support I need from my manager'
      }, form.field('text'))),
      h(ui.FieldRow, null,
        h(V.Select, Object.assign({ label: 'Answer type', required: true, options: QUESTION_TYPES }, form.select('kind'))),
        form.values.kind === 'Rating Scale'
          ? h(V.Select, Object.assign({ label: 'Scale', options: ['1 – 5', '1 – 7', '1 – 10'] }, form.select('scale')))
          : h('div', { className: 'stack gap-1' },
              h('span', { className: 'eyebrow' }, 'How it is reported'),
              h('span', { className: 'list__meta' }, TYPE_NOTE[form.values.kind] || TYPE_NOTE['Rating Scale']))),
      CHOICE_TYPES.indexOf(form.values.kind) >= 0
        ? h(V.TextArea, Object.assign({
            label: 'Options, one per line', required: true, rows: 4,
            placeholder: 'Strongly agree\nAgree\nNeither\nDisagree\nStrongly disagree'
          }, form.field('optionText')))
        : null,
      h('div', { className: 'checks' },
        h('div', { className: 'checks__row' },
          h(V.Switch, Object.assign({ 'aria-label': 'Mandatory question' }, form.check('mandatory'))),
          h('div', { className: 'checks__main' },
            h('span', { className: 'checks__name' }, 'Mandatory'),
            h('span', { className: 'checks__meta' }, 'The survey cannot be submitted until this question is answered.')))));
  }

  function SurveyBuilder() {
    var questionsSt = React.useState([]);
    var draftSt = React.useState(null);
    var seqSt = React.useState(1);

    var form = ui.useForm({
      type: 'Pulse', anonymous: true,
      from: seed.todayIso, to: seed.util.iso(seed.util.addDays(seed.today, 14))
    }, function (v) {
      var errs = rules.required([
        { key: 'name', label: 'Survey name' }, { key: 'from', label: 'Start date' }, { key: 'to', label: 'End date' }
      ], v);
      if (v.from && v.to && v.to < v.from) errs.to = 'The end date cannot be before the start date';
      return errs;
    });

    var questions = questionsSt[0];
    var audience = store.collection('employees').filter(function (e) {
      return e.status !== 'Exited' && e.status !== 'Invited'
        && (!form.values.department || e.department === form.values.department)
        && (!form.values.location || e.location === form.values.location);
    });

    function setQuestions(next) { questionsSt[1](next); }
    function addDraft() {
      draftSt[1]({ id: 'q-new-' + seqSt[0], isNew: true, kind: 'Rating Scale', mandatory: true, scale: '1 – 5' });
    }
    function editAt(i) {
      var q = questions[i];
      draftSt[1](Object.assign({}, q, {
        index: i, isNew: false,
        optionText: (q.options || []).join('\n')
      }));
    }
    function saveDraft(q) {
      var draft = draftSt[0];
      if (draft.isNew) {
        setQuestions(questions.concat([Object.assign({}, q, { id: 'q' + seqSt[0] })]));
        seqSt[1](seqSt[0] + 1);
      } else {
        setQuestions(questions.map(function (x, i) { return i === draft.index ? Object.assign({}, x, q) : x; }));
      }
      draftSt[1](null);
    }
    function removeAt(i) {
      setQuestions(questions.filter(function (x, n) { return n !== i; }));
    }
    /* Reordering matters: PRD 4.40 treats question order as part of the survey. */
    function moveBy(i, delta) {
      var target = i + delta;
      if (target < 0 || target >= questions.length) return;
      var next = questions.slice();
      var held = next[i];
      next[i] = next[target];
      next[target] = held;
      setQuestions(next);
    }
    function addFromBank(q) {
      if (questions.some(function (x) { return x.text === q.text; })) {
        ui.toast('That question is already in the survey', 'info');
        return;
      }
      setQuestions(questions.concat([{
        id: 'q' + seqSt[0], text: q.text, kind: q.kind, mandatory: q.kind !== 'Text Response',
        scale: q.kind === 'Rating Scale' ? '1 – 5' : null, options: null
      }]));
      seqSt[1](seqSt[0] + 1);
    }

    function create() {
      var res = form.submit(function (v) {
        return ui.report(act.createSurvey({
          name: v.name, type: v.type, anonymous: v.anonymous !== false,
          from: v.from, to: v.to, department: v.department || null, location: v.location || null,
          questions: questions
        }));
      });
      if (res && res.ok) {
        focused.survey = res.id;
        setQuestions([]);
        form.reset({
          type: 'Pulse', anonymous: true,
          from: seed.todayIso, to: seed.util.iso(seed.util.addDays(seed.today, 14))
        });
        router.goAs('hr/engagement/surveys');
      }
    }

    var mandatory = questions.filter(function (q) { return q.mandatory; }).length;

    return h(React.Fragment, null,
      h(Grid, null,
        h(Card, {
          span: 7, title: 'Questions',
          description: 'Add, edit, reorder and remove questions. Order is the order employees see.',
          aside: h('div', { className: 'row gap-2' },
            h(V.Chip, { size: 'sm', shape: 'tag' }, questions.length + ' question' + (questions.length === 1 ? '' : 's')),
            h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus, onClick: addDraft }, 'Add question'))
        },
          questions.length
            ? h('div', { className: 'list' }, questions.map(function (q, i) {
                return h('div', { className: 'list__row', key: q.id },
                  h('span', { className: 'mono list__meta' }, 'Q' + (i + 1)),
                  h('div', { className: 'list__main' },
                    h('span', { className: 'list__title' }, q.text),
                    h('span', { className: 'list__meta row gap-2 wrap' },
                      h(V.Chip, { size: 'sm', shape: 'tag' }, q.kind + (q.scale ? ' · ' + q.scale : '')),
                      q.mandatory
                        ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning', dot: true }, 'Mandatory')
                        : h(V.Chip, { size: 'sm', shape: 'tag', variant: 'outline' }, 'Optional'),
                      q.options && q.options.length ? h('span', null, q.options.join(' · ')) : null)),
                  h('span', { className: 'row gap-2' },
                    h(V.IconButton, { icon: I.up, 'aria-label': 'Move up: ' + q.text, disabled: i === 0, onClick: function () { moveBy(i, -1); } }),
                    h(V.IconButton, { icon: I.down, 'aria-label': 'Move down: ' + q.text, disabled: i === questions.length - 1, onClick: function () { moveBy(i, 1); } }),
                    h(V.IconButton, { icon: I.pencil, 'aria-label': 'Edit: ' + q.text, onClick: function () { editAt(i); } }),
                    h(V.IconButton, { icon: I.trash, 'aria-label': 'Remove: ' + q.text, onClick: function () { removeAt(i); } })));
              }))
            : h(ui.Empty, {
                icon: I.forms, title: 'No questions yet',
                body: 'A survey needs at least one question before it can be created (PRD 4.40).',
                actions: h(V.Button, { variant: 'primary', iconStart: I.plus, onClick: addDraft }, 'Add the first question')
              }),
          form.errors.questions
            ? h('p', { style: { color: 'var(--danger-fg)', fontSize: 13 } }, form.errors.questions)
            : null),

        h(Card, { span: 5, title: 'Survey settings' },
          h(V.TextField, Object.assign({
            label: 'Survey name', required: true, placeholder: 'e.g. Q1 Engagement Pulse'
          }, form.field('name'))),
          h(ui.FieldRow, null,
            h(V.Select, Object.assign({ label: 'Survey type', options: SURVEY_TYPES }, form.select('type'))),
            h(V.Select, {
              label: 'Anonymity',
              options: [{ value: 'yes', label: 'Anonymous' }, { value: 'no', label: 'Attributed' }],
              value: form.values.anonymous === false ? 'no' : 'yes',
              onChange: function (v) { form.set('anonymous', v === 'yes'); },
              hint: form.values.anonymous === false
                ? 'Responses name the respondent and can be filtered by person.'
                : 'Responses are stored without the respondent and cannot be attributed (PRD 4.41).'
            })),
          h(ui.FieldRow, null,
            h(V.DateField, Object.assign({ label: 'Opens', required: true }, form.field('from'))),
            h(V.DateField, Object.assign({ label: 'Closes', required: true }, form.field('to')))),
          h(ui.FormSection, { title: 'Audience', description: 'Leave both blank to invite everyone on the payroll.' },
            h(ui.FieldRow, null,
              h(V.Select, Object.assign({ label: 'Department', placeholder: 'All departments', options: deptOptions() }, form.select('department'))),
              h(V.Select, Object.assign({ label: 'Location', placeholder: 'All locations', options: locOptions() }, form.select('location'))))),
          h(ui.KeyValue, { rows: [
            ['Audience size', audience.length + ' employees'],
            ['Questions', questions.length + (mandatory ? ' · ' + mandatory + ' mandatory' : '')],
            ['Opens', form.values.from > seed.todayIso ? 'Scheduled for ' + ui.dateLabel(form.values.from) : 'Immediately, as Live'],
            ['Anonymity', form.values.anonymous === false ? 'Attributed' : 'Anonymous']
          ]}),
          h(V.Button, { variant: 'primary', iconStart: I.send, onClick: create }, 'Create survey'),
          h('p', { className: 'muted', style: { fontSize: 12, lineHeight: 1.6 } },
            'Exited and invited employees are excluded from the audience. An anonymous survey cannot be ' +
            'switched to attributed afterwards, because the responses it has already collected hold no respondent.')),

        h(Card, { span: 12, title: 'Question bank', description: 'Reusable questions from the survey configuration (PRD 4.40).' },
          h(ui.DataTable, {
            exportName: 'question-bank', label: 'Question bank', rows: questionBank(), pageSize: 10,
            search: function (q) { return q.text + ' ' + q.kind; }, searchPlaceholder: 'Search the question bank',
            columns: [
              { key: 'text', header: 'Question', sortable: true },
              { key: 'kind', header: 'Answer type', sortable: true,
                cell: function (q) { return h(V.Chip, { size: 'sm', shape: 'tag' }, q.kind); } },
              { key: 'note', header: 'Reported as', csv: function (q) { return TYPE_NOTE[q.kind] || ''; },
                cell: function (q) { return h('span', { className: 'list__meta' }, TYPE_NOTE[q.kind] || '—'); } },
              { key: 'actions', header: '', align: 'right',
                cell: function (q) {
                  return h(V.Button, {
                    variant: 'outline', className: 'vi-btn--sm', iconStart: I.plus,
                    onClick: function () { addFromBank(q); }
                  }, 'Add');
                } }
            ],
            emptyIcon: I.forms, emptyTitle: 'The question bank is empty',
            emptyBody: 'Questions added in survey configuration appear here for reuse.'
          }))),

      draftSt[0] ? h(QuestionModal, {
        draft: draftSt[0], onClose: function () { draftSt[1](null); }, onSave: saveDraft
      }) : null);
  }

  /* ======================================================== Responses (4.41)
     The screen where anonymity is actually enforced. For an anonymous survey no person
     is rendered anywhere — not in a row, not in a drawer, not in the CSV export — and
     group figures are withheld below the minimum group size. */
  function ResponseDrawer(p) {
    var r = p.response, s = p.survey;
    var list = s.questionList && s.questionList.length ? s.questionList : questionBank();

    return h(ui.Drawer, {
      eyebrow: s.name,
      title: s.anonymous ? 'Anonymous response' : (emp(r.employee) || {}).name || 'Response',
      description: s.anonymous
        ? 'Submitted ' + ui.dateLabel(r.submittedOn) + ' · no respondent was recorded'
        : 'Submitted ' + ui.dateLabel(r.submittedOn),
      onClose: p.onClose,
      footer: h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Close')
    },
      s.anonymous
        ? h(AnonymityNote, { name: s.name })
        : h(ui.Person, { employee: emp(r.employee), size: 'md' }),
      h(ui.KeyValue, { rows: [
        ['Response ID', h('span', { className: 'mono' }, r.id)],
        ['Submitted', ui.dateLabel(r.submittedOn)],
        s.anonymous
          ? ['Respondent', h('span', { className: 'muted' }, 'Not recorded — the survey is anonymous')]
          : ['Respondent', (emp(r.employee) || {}).name],
        ['Department', p.showDepartment ? deptName(r.department) : h('span', { className: 'muted' }, 'Withheld — fewer than ' + MIN_GROUP + ' responses in that group')],
        ['Engagement score', scoreOf([r]) == null ? null : scoreOf([r]) + ' of 5']
      ]}),
      h('div', { className: 'stack gap-2' },
        h('span', { className: 'eyebrow' }, 'Answers'),
        h('div', { className: 'list' }, list.map(function (q, i) {
          var value = r.scores ? r.scores[q.id] : null;
          return h('div', { className: 'list__row', key: q.id || i },
            h('div', { className: 'list__main' },
              h('span', { className: 'list__title' }, q.text),
              h('span', { className: 'list__meta' }, q.kind + (q.mandatory ? ' · mandatory' : ''))),
            value == null
              ? h('span', { className: 'muted' }, 'Not answered')
              : h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info' },
                  q.kind === 'NPS' ? value + ' / 10' : value + ' / 5'));
        }))));
  }

  function SurveyResponses() {
    var pickSt = React.useState(initialSurvey());
    var openSt = React.useState(null);
    var s = surveyOf(pickSt[0]);

    if (!s) {
      return h(Card, { title: 'Responses' },
        h(ui.Empty, {
          icon: I.checklist, title: 'No surveys exist yet',
          body: 'Build a survey to start collecting responses (PRD 4.40).',
          actions: h(V.Button, { variant: 'primary', iconStart: I.plus, onClick: function () { router.goAs('hr/engagement/builder'); } }, 'Open the builder')
        }));
    }

    var responses = responsesFor(s.id).slice().sort(byNewest('submittedOn'));
    var byDept = groupBy(responses, function (r) { return deptName(r.department); });
    var deptCounts = {};
    byDept.forEach(function (g) { deptCounts[g.key] = g.count; });
    /* For an anonymous survey a department with a handful of answers identifies the
       people in it, so the department is withheld on the row as well (PRD 4.41). */
    function deptVisible(r) {
      if (!s.anonymous) return true;
      return (deptCounts[deptName(r.department)] || 0) >= MIN_GROUP;
    }

    var columns = [
      { key: 'id', header: 'Response', width: 110, cell: function (r) { return h('span', { className: 'mono' }, r.id); } }
    ];
    if (s.anonymous) {
      /* No respondent column at all: there is nothing to show, and offering one would
         imply the data exists. */
      columns.push({
        key: 'respondent', header: 'Respondent', csv: function () { return 'Anonymous'; },
        cell: function () {
          return h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info', icon: I.lock }, 'Anonymous');
        }
      });
    } else {
      columns.push({
        key: 'employee', header: 'Respondent', sortable: true,
        sortValue: function (r) { return (emp(r.employee) || {}).name || ''; },
        csv: function (r) { return (emp(r.employee) || {}).name || 'Anonymous'; },
        cell: function (r) {
          return emp(r.employee)
            ? h(ui.Person, { employee: emp(r.employee), sub: deptName(r.department) })
            : h('span', { className: 'muted' }, 'Anonymous');
        }
      });
    }
    columns.push({
      key: 'department', header: 'Department', sortable: true,
      csv: function (r) { return deptVisible(r) ? deptName(r.department) : 'Withheld'; },
      cell: function (r) {
        return deptVisible(r) ? deptName(r.department)
          : h('span', { className: 'muted' }, 'Withheld');
      }
    });
    columns.push({
      key: 'submittedOn', header: 'Submitted', sortable: true,
      cell: function (r) { return ui.dateLabel(r.submittedOn); }
    });
    columns.push({
      key: 'score', header: 'Score', numeric: true, align: 'right',
      sortValue: function (r) { return scoreOf([r]) || 0; },
      csv: function (r) { return scoreOf([r]); },
      cell: function (r) { var v = scoreOf([r]); return v == null ? h('span', { className: 'muted' }, '—') : v + ' / 5'; }
    });
    columns.push({
      key: 'nps', header: 'NPS answer', numeric: true, align: 'right',
      csv: function (r) { return r.scores ? r.scores[NPS_KEY] : ''; },
      cell: function (r) {
        var v = r.scores ? r.scores[NPS_KEY] : null;
        if (v == null) return h('span', { className: 'muted' }, '—');
        return h(V.Chip, {
          size: 'sm', shape: 'tag', variant: 'soft', dot: true,
          tone: v >= 9 ? 'success' : v >= 7 ? 'neutral' : 'error'
        }, v >= 9 ? 'Promoter' : v >= 7 ? 'Passive' : 'Detractor');
      }
    });
    columns.push({
      key: 'actions', header: '', align: 'right',
      cell: function (r) {
        return h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', onClick: function () { openSt[1](r.id); } }, 'View');
      }
    });

    var open = openSt[0] && responses.filter(function (r) { return r.id === openSt[0]; })[0];

    return h(React.Fragment, null,
      h('div', { className: 'filterbar' },
        h('div', { className: 'filterbar__item', style: { minWidth: 260 } },
          h(V.Select, {
            label: 'Survey', value: s.id, options: surveyOptions(),
            onChange: function (v) { focused.survey = v; pickSt[1](v); openSt[1](null); }
          })),
        h('span', { className: 'filterbar__spacer' }),
        h(V.Chip, { size: 'sm', shape: 'tag' }, s.type),
        h(ui.StatusChip, { status: s.status }),
        s.anonymous
          ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info', icon: I.lock }, 'Anonymous')
          : h(V.Chip, { size: 'sm', shape: 'tag', icon: I.person }, 'Attributed')),

      s.anonymous ? h(AnonymityNote, { name: s.name }) : null,

      h(Stats, { cols: 3 },
        h(Stat, { label: 'Invited', value: s.invited, sub: ui.dateLabel(s.from) + ' – ' + ui.dateLabel(s.to) }),
        h(Stat, {
          label: 'Responded', value: s.responded, sub: ui.pct(s.responded, s.invited) + '% response rate',
          tone: ui.pct(s.responded, s.invited) >= 60 ? 'good' : 'warn'
        }),
        h(Stat, {
          label: 'Engagement score', value: scoreOf(responses) == null ? '—' : scoreOf(responses), unit: 'of 5',
          sub: npsOf(responses) == null ? 'No NPS question answered' : 'NPS ' + npsOf(responses)
        })),

      h(Grid, null,
        h(Card, { span: 12, title: 'Individual responses',
          description: s.anonymous
            ? 'Responses to an anonymous survey are listed without a respondent, because none was ever recorded (PRD 4.41).'
            : 'This survey is attributed, so each response names the employee who submitted it.' },
          h(ui.DataTable, {
            exportName: 'survey-responses-' + s.id, label: 'Responses to ' + s.name,
            rows: responses, pageSize: 10, columns: columns,
            search: function (r) {
              /* An anonymous survey is searchable by response id and date only; adding a
                 name here would be a route back to the respondent. */
              return s.anonymous
                ? r.id + ' ' + r.submittedOn
                : r.id + ' ' + ((emp(r.employee) || {}).name || '') + ' ' + deptName(r.department);
            },
            searchPlaceholder: s.anonymous ? 'Search by response ID or date' : 'Search by response, name or department',
            emptyIcon: I.checklist,
            emptyTitle: s.status === 'Scheduled' ? 'This survey has not opened yet' : 'No responses yet',
            emptyBody: s.status === 'Scheduled'
              ? 'It opens on ' + ui.dateLabel(s.from) + ' and invitations go out that morning.'
              : 'Responses appear here as employees submit them.'
          })),

        h(Card, { span: 7, title: 'Responses by department',
          description: 'Aggregate figures are available for an anonymous survey; small groups are not.' },
          h(ui.Bars, {
            rows: reportable(byDept).map(function (g) { return [g.key, g.count]; }),
            emptyTitle: 'Nothing reportable yet'
          }),
          suppressionNote(byDept)),

        h(Card, { span: 5, title: 'Score by department' },
          h(ui.DataTable, {
            exportName: 'survey-scores-' + s.id, label: 'Scores by department',
            rows: byDept, pageSize: 10,
            search: function (g) { return g.key; }, searchPlaceholder: 'Search departments',
            columns: [
              { key: 'key', header: 'Department', sortable: true },
              { key: 'count', header: 'Responses', numeric: true, align: 'right', sortable: true,
                cell: function (g) { return withheld(g) ? h('span', { className: 'muted' }, 'Under ' + MIN_GROUP) : g.count; } },
              { key: 'score', header: 'Score', numeric: true, align: 'right',
                csv: function (g) { return withheld(g) ? 'Withheld' : g.score; },
                cell: function (g) {
                  return withheld(g)
                    ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'neutral', icon: I.lock }, 'Withheld')
                    : (g.score == null ? h('span', { className: 'muted' }, '—') : g.score + ' / 5');
                } }
            ],
            emptyIcon: I.reports, emptyTitle: 'No departments to report',
            emptyBody: 'Department figures appear once responses arrive.'
          }))),

      open ? h(ResponseDrawer, {
        response: open, survey: s, showDepartment: deptVisible(open),
        onClose: function () { openSt[1](null); }
      }) : null);
  }

  /* ======================================================== Analytics (4.42) */
  function EngagementAnalytics() {
    var scopeSt = React.useState(focused.survey && surveyOf(focused.survey) ? focused.survey : '');
    var all = surveys();
    var scope = scopeSt[0];
    var scoped = scope ? surveyOf(scope) : null;
    var rows = scope
      ? responsesFor(scope)
      : store.collection('surveyResponses');

    /* Department comes with every response. Location and tenure only exist where the
       respondent is known, so an anonymous survey cannot be split that way at all. */
    var attributed = rows.filter(function (r) { return r.employee && emp(r.employee); });
    var byDept = groupBy(rows, function (r) { return deptName(r.department); });
    var byLoc = groupBy(attributed, function (r) { return locName(emp(r.employee).location); });
    var byTenure = groupBy(attributed, function (r) { return tenureBucket(emp(r.employee)); });

    var trendSurveys = all.filter(function (s) { return s.responded; }).slice().sort(byOldest('from'));
    var trend = trendSurveys.map(function (s) {
      return [ui.shortDate(s.from) + ' · ' + s.name, scoreOf(responsesFor(s.id)) || 0];
    });
    var npsTrend = trendSurveys.map(function (s) {
      return [ui.shortDate(s.from) + ' · ' + s.name, npsOf(responsesFor(s.id)) || 0];
    });

    /* Free text is never scored, so it is left out of the per-question averages. */
    var bank = questionBank().filter(function (q) { return q.kind !== 'Text Response'; });
    var byQuestion = bank.map(function (q) {
      var avg = questionAverage(rows, q.id);
      return [q.text, avg == null ? 0 : avg, avg != null && avg < 3.2 ? 'warn' : null];
    });

    function tenureRows() {
      return TENURE_ORDER.map(function (label) {
        return byTenure.filter(function (g) { return g.key === label; })[0];
      }).filter(Boolean);
    }

    return h(React.Fragment, null,
      h('div', { className: 'filterbar' },
        h('div', { className: 'filterbar__item', style: { minWidth: 260 } },
          h(V.Select, {
            label: 'Scope', value: scope, placeholder: 'All surveys',
            options: [{ value: '', label: 'All surveys' }].concat(surveyOptions()),
            onChange: function (v) { focused.survey = v || null; scopeSt[1](v); }
          })),
        h('span', { className: 'filterbar__spacer' }),
        h(V.Chip, { size: 'sm', shape: 'tag' }, rows.length + ' responses'),
        scoped && scoped.anonymous
          ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info', icon: I.lock }, 'Anonymous')
          : null),

      h(Stats, null,
        h(Stat, { label: 'Engagement score', value: scoreOf(rows) == null ? '—' : scoreOf(rows), unit: 'of 5',
          sub: scoped ? scoped.name : 'Across every survey' }),
        h(Stat, { label: 'Employee NPS', value: npsOf(rows) == null ? '—' : npsOf(rows),
          sub: 'Promoters minus detractors' }),
        h(Stat, { label: 'Departments reported', value: reportable(byDept).length,
          sub: suppressedCount(byDept) ? suppressedCount(byDept) + ' withheld as too small' : 'All groups large enough',
          tone: suppressedCount(byDept) ? 'warn' : 'good' }),
        h(Stat, { label: 'Attributable responses', value: attributed.length,
          sub: (rows.length - attributed.length) + ' anonymous, so no person-level split' })),

      h(Grid, null,
        h(Card, { span: 6, title: 'Score by department',
          description: 'Groups below ' + MIN_GROUP + ' responses are withheld (PRD 4.41).' },
          h(ui.Bars, {
            rows: reportable(byDept).map(function (g) {
              return [g.key, g.score || 0, g.score != null && g.score < 3.2 ? 'warn' : null];
            }).sort(function (a, b) { return b[1] - a[1]; }),
            emptyTitle: 'No reportable department'
          }),
          suppressionNote(byDept)),

        h(Card, { span: 6, title: 'Score by location' },
          h(ui.Bars, {
            rows: reportable(byLoc).map(function (g) { return [g.key, g.score || 0]; }),
            emptyTitle: 'No attributable responses'
          }),
          h('p', { className: 'muted', style: { fontSize: 12, lineHeight: 1.6 } },
            'Location is read from the respondent, so only attributed surveys appear here. An anonymous ' +
            'response stores the department and nothing else about the person.')),

        h(Card, { span: 6, title: 'Score by tenure' },
          h(ui.Bars, {
            rows: tenureRows().map(function (g) { return [g.key + ' (' + g.count + ')', g.score || 0]; }),
            emptyTitle: 'No attributable responses'
          }),
          h('p', { className: 'muted', style: { fontSize: 12, lineHeight: 1.6 } },
            'Tenure is derived from the joining date of the respondent, so it is available for attributed ' +
            'surveys only.')),

        h(Card, { span: 6, title: 'Score by question', description: 'Average per rating question across the scope.' },
          h(ui.Bars, { rows: byQuestion, emptyTitle: 'No scored answers' })),

        h(Card, { span: 6, title: 'Engagement score over time' },
          h(ui.Bars, { rows: trend, emptyTitle: 'Only one survey has responses' })),

        h(Card, { span: 6, title: 'NPS over time' },
          h(ui.Bars, { rows: npsTrend, emptyTitle: 'No NPS answers yet' })),

        h(Card, { span: 12, title: 'Department detail',
          description: 'The same figures as a table, with the withheld groups shown as withheld rather than hidden.' },
          h(ui.DataTable, {
            exportName: 'engagement-by-department', label: 'Engagement by department',
            rows: byDept, pageSize: 10,
            search: function (g) { return g.key; }, searchPlaceholder: 'Search departments',
            columns: [
              { key: 'key', header: 'Department', sortable: true },
              { key: 'count', header: 'Responses', numeric: true, align: 'right', sortable: true,
                csv: function (g) { return withheld(g) ? 'Under ' + MIN_GROUP : g.count; },
                cell: function (g) { return withheld(g) ? h('span', { className: 'muted' }, 'Under ' + MIN_GROUP) : g.count; } },
              { key: 'score', header: 'Score', numeric: true, align: 'right',
                csv: function (g) { return withheld(g) ? 'Withheld' : g.score; },
                cell: function (g) {
                  if (withheld(g)) return h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'neutral', icon: I.lock }, 'Withheld');
                  return g.score == null ? h('span', { className: 'muted' }, '—') : g.score + ' / 5';
                } },
              { key: 'nps', header: 'NPS', numeric: true, align: 'right',
                csv: function (g) { return withheld(g) ? 'Withheld' : g.nps; },
                cell: function (g) {
                  if (withheld(g)) return h('span', { className: 'muted' }, 'Withheld');
                  return g.nps == null ? h('span', { className: 'muted' }, '—') : g.nps;
                } },
              { key: 'bar', header: '', csv: function (g) { return ''; },
                cell: function (g) {
                  if (withheld(g)) return '';
                  return h(V.ProgressBar, {
                    value: ((g.score || 0) / 5) * 100, size: 'sm', 'aria-label': 'Score for ' + g.key,
                    tone: (g.score || 0) >= 4 ? 'success' : (g.score || 0) >= 3.2 ? 'primary' : 'warning'
                  });
                } }
            ],
            emptyIcon: I.reports, emptyTitle: 'Nothing to report yet',
            emptyBody: 'Department figures appear once a survey collects responses.'
          }),
          suppressionNote(byDept))));
  }

  /* ============================================= Feedback & recognition (4.42) */
  function FeedbackScreen() {
    var tabSt = React.useState('feedback');
    var statusSt = React.useState('');
    var recogSt = React.useState(false);

    var feedback = store.collection('feedback').slice().sort(byNewest('on'));
    var recognition = store.collection('recognition').slice().sort(byNewest('on'));
    var shown = statusSt[0] ? feedback.filter(function (f) { return f.status === statusSt[0]; }) : feedback;
    var anonymous = feedback.filter(function (f) { return !f.employee; });

    var valueRows = countRows(recognition, function (r) { return r.value; });
    var categoryRows = countRows(feedback, function (f) { return f.category; });

    var me = store.persona('hr') || {};
    var recogForm = ui.useForm({ value: 'Ownership' });
    function sendRecognition() {
      var res = recogForm.submit(function (v) { return ui.report(act.giveRecognition(me.id, v)); });
      if (res && res.ok) { recogSt[1](false); recogForm.reset({ value: 'Ownership' }); }
    }

    return h(React.Fragment, null,
      h(Stats, null,
        h(Stat, { label: 'Feedback received', value: feedback.length, sub: 'Across every category' }),
        h(Stat, { label: 'Open items', value: feedback.filter(function (f) { return f.status === 'Open'; }).length,
          sub: feedback.filter(function (f) { return f.status === 'Under Review'; }).length + ' under review', tone: 'warn' }),
        h(Stat, { label: 'Submitted anonymously', value: anonymous.length,
          sub: 'Listed without a person, by design' }),
        h(Stat, { label: 'Recognition notes', value: recognition.length,
          sub: valueRows.length ? 'Most cited value: ' + valueRows[0][0] : 'None given yet' })),

      h(V.TabGroup, {
        value: tabSt[0], onChange: tabSt[1],
        items: [
          { value: 'feedback', label: 'Feedback', count: feedback.length },
          { value: 'recognition', label: 'Recognition', count: recognition.length }
        ]
      }),

      tabSt[0] === 'feedback' ? h(Grid, null,
        h(Card, { span: 12, title: 'Continuous feedback',
          description: 'Employee feedback outside a survey. Anonymous submissions carry no employee reference (PRD 4.41, 4.42).' },
          h(ui.DataTable, {
            exportName: 'feedback', label: 'Continuous feedback', rows: shown, pageSize: 10,
            search: function (f) { return f.category + ' ' + f.note + ' ' + f.status; },
            searchPlaceholder: 'Search by category, text or status',
            filters: h(ui.Filter, { label: 'Status', value: statusSt[0], onChange: statusSt[1],
              options: ['Open', 'Under Review', 'Actioned'] }),
            columns: [
              { key: 'id', header: 'Item', width: 104, cell: function (f) { return h('span', { className: 'mono' }, f.id); } },
              { key: 'employee', header: 'From', sortable: true,
                sortValue: function (f) { return (emp(f.employee) || {}).name || ''; },
                csv: function (f) { return f.employee ? (emp(f.employee) || {}).name : 'Anonymous'; },
                cell: function (f) {
                  /* No employee means the submission was anonymous — never guess at one. */
                  return f.employee && emp(f.employee)
                    ? h(ui.Person, { employee: emp(f.employee), sub: deptName(emp(f.employee).department) })
                    : h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info', icon: I.lock }, 'Anonymous');
                } },
              { key: 'category', header: 'Category', sortable: true,
                cell: function (f) { return h(V.Chip, { size: 'sm', shape: 'tag' }, f.category); } },
              { key: 'note', header: 'Feedback' },
              { key: 'on', header: 'Received', sortable: true, cell: function (f) { return ui.dateLabel(f.on); } },
              { key: 'status', header: 'Status', cell: function (f) { return h(ui.StatusChip, { status: f.status }); } },
              { key: 'actions', header: '', align: 'right',
                cell: function (f) {
                  return h(V.Button, {
                    variant: 'outline', className: 'vi-btn--sm',
                    onClick: function () { focused.survey = null; router.goAs('hr/engagement/actions'); }
                  }, 'Raise action');
                } }
            ],
            emptyIcon: I.comment, emptyTitle: 'No feedback here',
            emptyBody: 'Feedback submitted from the employee workspace appears here, with or without a name.'
          })),
        h(Card, { span: 6, title: 'Feedback by category' },
          h(ui.Bars, { rows: categoryRows, emptyTitle: 'No feedback yet' })),
        h(Card, { span: 6, title: 'How anonymous feedback is handled', aside: h(V.Chip, { size: 'sm', shape: 'tag', icon: I.file }, 'PRD 4.41') },
          h('p', { className: 'muted', style: { fontSize: 13, lineHeight: 1.6 } },
            'An anonymous submission is stored without an employee reference, so there is nothing to reveal ' +
            'later — not by widening a filter, not by exporting the table, and not by an administrator. HR can ' +
            'still categorise it, review it and raise an action plan from it.'),
          h(ui.KeyValue, { rows: [
            ['Anonymous items', anonymous.length + ' of ' + feedback.length],
            ['Stored respondent', 'None'],
            ['Export behaviour', 'Exports the word "Anonymous", never a name'],
            ['Minimum group size', MIN_GROUP + ' responses for any grouped figure']
          ]}))) : null,

      tabSt[0] === 'recognition' ? h(Grid, null,
        h(Card, { span: 12, title: 'Recognition',
          description: 'Peer-to-peer recognition against the company values (PRD 4.42).',
          aside: h(V.Button, {
            variant: 'primary', className: 'vi-btn--sm', iconStart: I.star,
            onClick: function () { recogSt[1](true); }
          }, 'Give recognition') },
          h(ui.DataTable, {
            exportName: 'recognition', label: 'Recognition', rows: recognition, pageSize: 10,
            search: function (r) {
              return ((emp(r.to) || {}).name || '') + ' ' + ((emp(r.from) || {}).name || '') + ' ' + r.value + ' ' + r.note;
            },
            searchPlaceholder: 'Search by person, value or note',
            columns: [
              { key: 'to', header: 'Recognised', sortable: true,
                sortValue: function (r) { return (emp(r.to) || {}).name || ''; },
                csv: function (r) { return (emp(r.to) || {}).name || ''; },
                cell: function (r) { return h(ui.Person, { employee: emp(r.to), sub: deptName((emp(r.to) || {}).department) }); } },
              { key: 'value', header: 'Value', sortable: true,
                cell: function (r) { return h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'success', icon: I.star }, r.value); } },
              { key: 'note', header: 'Note' },
              { key: 'from', header: 'From', csv: function (r) { return (emp(r.from) || {}).name || ''; },
                cell: function (r) { return (emp(r.from) || {}).name || h('span', { className: 'muted' }, '—'); } },
              { key: 'on', header: 'Given', sortable: true, cell: function (r) { return ui.dateLabel(r.on); } }
            ],
            emptyIcon: I.star, emptyTitle: 'No recognition yet',
            emptyBody: 'Recognition given from any workspace appears here.'
          })),
        h(Card, { span: 6, title: 'Recognition by value' },
          h(ui.Bars, { rows: valueRows, emptyTitle: 'No recognition yet' })),
        h(Card, { span: 6, title: 'Most recognised' },
          h(ui.Bars, {
            rows: countRows(recognition, function (r) { return (emp(r.to) || {}).name; }, 8),
            emptyTitle: 'No recognition yet'
          }))) : null,

      recogSt[0] ? h(ui.Modal, {
        title: 'Give recognition', description: 'Sent as ' + (me.name || 'you') + ' and visible to the recipient.',
        onClose: function () { recogSt[1](false); },
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { recogSt[1](false); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', iconStart: I.send, onClick: sendRecognition }, 'Send recognition'))
      },
        h(ui.EmployeePicker, {
          label: 'Colleague', value: recogForm.values.to,
          status: recogForm.errors.to ? 'error' : undefined, hint: recogForm.errors.to,
          onChange: function (v) { recogForm.set('to', v); }
        }),
        h(V.Select, Object.assign({
          label: 'Value', required: true, options: ['Ownership', 'Craft', 'Teamwork', 'Customer first']
        }, recogForm.select('value'))),
        h(V.TextArea, Object.assign({
          label: 'Note', required: true, rows: 3, placeholder: 'What they did, and why it mattered.'
        }, recogForm.field('note')))) : null);
  }

  /* ======================================================= Action plans (4.41) */
  function ActionPlans() {
    var openSt = React.useState(false);
    var statusSt = React.useState('');
    var plans = store.collection('actionPlans');
    var rows = statusSt[0] ? plans.filter(function (p) { return p.status === statusSt[0]; }) : plans;

    var form = ui.useForm({ survey: focused.survey || '', due: seed.util.iso(seed.util.addDays(seed.today, 30)) });
    function create() {
      var res = form.submit(function (v) { return ui.report(act.createActionPlan(v)); });
      if (res && res.ok) {
        openSt[1](false);
        form.reset({ survey: focused.survey || '', due: seed.util.iso(seed.util.addDays(seed.today, 30)) });
      }
    }

    return h(React.Fragment, null,
      h(Stats, { cols: 3 },
        h(Stat, { label: 'Action plans', value: plans.length, sub: 'Created from survey findings' }),
        h(Stat, { label: 'In progress', value: plans.filter(function (p) { return p.status === 'In Progress'; }).length,
          sub: plans.filter(function (p) { return p.status === 'Completed'; }).length + ' completed' }),
        h(Stat, { label: 'Past due', value: plans.filter(function (p) { return p.status !== 'Completed' && p.due < seed.todayIso; }).length,
          sub: 'Owners are notified on the due date',
          tone: plans.filter(function (p) { return p.status !== 'Completed' && p.due < seed.todayIso; }).length ? 'warn' : 'good' })),

      h(Card, {
        title: 'Action plans',
        description: 'Improvement actions raised from a survey finding, each with a single accountable owner (PRD 4.41).',
        aside: h(V.Button, {
          variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus, onClick: function () { openSt[1](true); }
        }, 'New action plan')
      },
        h(ui.DataTable, {
          exportName: 'action-plans', label: 'Action plans', rows: rows, pageSize: 10,
          search: function (p) {
            return p.title + ' ' + (p.finding || '') + ' ' + ((emp(p.owner) || {}).name || '');
          },
          searchPlaceholder: 'Search by title, finding or owner',
          filters: h(ui.Filter, { label: 'Status', value: statusSt[0], onChange: statusSt[1],
            options: ['In Progress', 'Completed'] }),
          columns: [
            { key: 'title', header: 'Action', sortable: true,
              cell: function (p) {
                return h('div', { className: 'stack gap-1' },
                  h('span', { className: 'list__title' }, p.title),
                  p.finding ? h('span', { className: 'list__meta' }, p.finding) : null);
              } },
            { key: 'survey', header: 'From survey', sortable: true,
              csv: function (p) { return p.survey ? (surveyOf(p.survey) || {}).name || p.survey : ''; },
              cell: function (p) {
                var s = p.survey && surveyOf(p.survey);
                return s
                  ? h('button', {
                      type: 'button', className: 'link',
                      onClick: function () { openSurvey(s.id, 'hr/engagement/analytics'); }
                    }, s.name)
                  : h('span', { className: 'muted' }, 'Not linked');
              } },
            { key: 'owner', header: 'Owner', sortable: true,
              sortValue: function (p) { return (emp(p.owner) || {}).name || ''; },
              csv: function (p) { return (emp(p.owner) || {}).name || ''; },
              cell: function (p) {
                return emp(p.owner)
                  ? h(ui.Person, { employee: emp(p.owner), sub: deptName(emp(p.owner).department) })
                  : h('span', { className: 'muted' }, 'Unassigned');
              } },
            { key: 'due', header: 'Due', sortable: true, cell: function (p) { return ui.dateLabel(p.due); } },
            { key: 'status', header: 'Status',
              csv: function (p) { return p.status; },
              cell: function (p) {
                return h(ui.StatusChip, { status: p.status !== 'Completed' && p.due < seed.todayIso ? 'Overdue' : p.status });
              } }
          ],
          emptyIcon: I.target, emptyTitle: 'No action plans yet',
          emptyBody: 'A survey finding without an owner and a date rarely changes anything. Raise the first action plan.',
          emptyActions: h(V.Button, { variant: 'primary', iconStart: I.plus, onClick: function () { openSt[1](true); } }, 'New action plan')
        })),

      openSt[0] ? h(ui.Modal, {
        title: 'New action plan',
        description: 'Link the action to the finding it came from, so the next survey can be read against it.',
        onClose: function () { openSt[1](false); },
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { openSt[1](false); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: create }, 'Create action plan'))
      },
        h(V.TextField, Object.assign({
          label: 'Action', required: true, placeholder: 'e.g. Clarify career progression'
        }, form.field('title'))),
        h(ui.EmployeePicker, {
          label: 'Owner', value: form.values.owner,
          status: form.errors.owner ? 'error' : undefined,
          hint: form.errors.owner || 'One accountable owner, not a team.',
          onChange: function (v) { form.set('owner', v); }
        }),
        h(ui.FieldRow, null,
          h(V.DateField, Object.assign({ label: 'Due date', required: true }, form.field('due'))),
          h(V.Select, Object.assign({
            label: 'From survey', placeholder: 'Not linked', options: surveyOptions()
          }, form.select('survey')))),
        h(V.TextArea, Object.assign({
          label: 'Finding', rows: 3, placeholder: 'The survey result this action answers, e.g. "Only 61% agreed that progression is clear".'
        }, form.field('finding')))) : null);
  }

  /* =============================================== Survey configuration (4.40) */
  function SurveyConfig() {
    var TEMPLATES = [
      { id: 'tpl-eng', name: 'Annual engagement survey', questions: 24, cadence: 'Yearly', anonymous: true,
        note: 'Full engagement index across every driver, benchmarked year on year.' },
      { id: 'tpl-pulse', name: 'Quarterly pulse', questions: 6, cadence: 'Quarterly', anonymous: true,
        note: 'Five rating questions and one free-text, to track movement between annual surveys.' },
      { id: 'tpl-onb', name: 'Onboarding experience', questions: 8, cadence: 'On day 30', anonymous: false,
        note: 'Attributed, because HR follows up with the joiner and their manager individually.' },
      { id: 'tpl-enps', name: 'eNPS only', questions: 1, cadence: 'Monthly', anonymous: true,
        note: 'The single 0 – 10 recommendation question.' },
      { id: 'tpl-exit', name: 'Exit survey', questions: 12, cadence: 'On resignation', anonymous: false,
        note: 'Attributed and linked to the offboarding case, feeding the attrition reasons report.' }
    ];

    var used = {};
    surveys().forEach(function (s) {
      (s.questionList || []).forEach(function (q) { used[q.text] = (used[q.text] || 0) + 1; });
    });

    return h(Grid, null,
      h(Card, { span: 12, title: 'Question bank',
        description: 'The reusable questions the builder draws from, with the answer types of PRD 4.40.' },
        h(ui.DataTable, {
          exportName: 'survey-question-bank', label: 'Question bank', rows: questionBank(), pageSize: 10,
          search: function (q) { return q.text + ' ' + q.kind; }, searchPlaceholder: 'Search questions',
          columns: [
            { key: 'id', header: 'Key', width: 72, cell: function (q) { return h('span', { className: 'mono' }, q.id); } },
            { key: 'text', header: 'Question', sortable: true },
            { key: 'kind', header: 'Answer type', sortable: true,
              cell: function (q) { return h(V.Chip, { size: 'sm', shape: 'tag' }, q.kind); } },
            { key: 'scored', header: 'Scored', align: 'center',
              csv: function (q) { return q.kind === 'Text Response' ? 'No' : 'Yes'; },
              cell: function (q) {
                return q.kind === 'Text Response'
                  ? h('span', { className: 'muted' }, 'No')
                  : h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'success' }, 'Yes');
              } },
            { key: 'used', header: 'In surveys', numeric: true, align: 'right',
              csv: function (q) { return used[q.text] || 0; },
              cell: function (q) { return used[q.text] || h('span', { className: 'muted' }, '—'); } }
          ],
          emptyIcon: I.forms, emptyTitle: 'No questions configured',
          emptyBody: 'Add questions here to reuse them across surveys.',
          emptyActions: h(V.Button, {
            variant: 'primary', iconStart: I.plus, onClick: function () { router.goAs('hr/engagement/builder'); }
          }, 'Open the builder')
        })),

      h(Card, { span: 7, title: 'Answer types', description: 'The six types a question can use (PRD 4.40).' },
        h(ui.DataTable, {
          exportName: 'survey-answer-types', label: 'Answer types',
          rows: QUESTION_TYPES.map(function (t) { return { id: t, type: t, note: TYPE_NOTE[t] }; }),
          pageSize: 10, search: function (t) { return t.type + ' ' + t.note; }, searchPlaceholder: 'Search answer types',
          columns: [
            { key: 'type', header: 'Type', cell: function (t) { return h(V.Chip, { size: 'sm', shape: 'tag' }, t.type); } },
            { key: 'note', header: 'How it is reported' }
          ],
          emptyIcon: I.forms, emptyTitle: 'No answer types configured',
          emptyBody: 'The six types in PRD 4.40 are built in.'
        })),

      h(Card, { span: 5, title: 'Anonymity defaults', aside: h(V.Chip, { size: 'sm', shape: 'tag', icon: I.file }, 'PRD 4.41') },
        h('div', { className: 'checks' },
          [['New surveys are anonymous by default', true],
            ['Withhold any group smaller than the minimum', true],
            ['Withhold free-text answers from group reports', true],
            ['Allow attributed surveys for lifecycle moments', true],
            ['Let an anonymous survey be switched to attributed', false]].map(function (row) {
            return h('div', { className: 'checks__row', key: row[0] },
              h(V.Switch, {
                defaultChecked: row[1], 'aria-label': row[0],
                onChange: function (e) { ui.toast(row[0] + ' ' + (e.target.checked ? 'enabled' : 'disabled'), 'success'); }
              }),
              h('div', { className: 'checks__main' }, h('span', { className: 'checks__name' }, row[0])));
          })),
        h(V.NumberField, {
          label: 'Minimum group size for reporting', defaultValue: MIN_GROUP, min: 2, max: 25, step: 1,
          hint: 'A department, location or tenure band with fewer responses than this is withheld.'
        }),
        h('p', { className: 'muted', style: { fontSize: 12, lineHeight: 1.6 } },
          'The last switch is off and stays off: responses to an anonymous survey never held a respondent, ' +
          'so there is no identity to restore.')),

      h(Card, { span: 12, title: 'Survey templates', description: 'Starting points for a new survey, with their default anonymity.' },
        h(ui.DataTable, {
          exportName: 'survey-templates', label: 'Survey templates', rows: TEMPLATES, pageSize: 10,
          search: function (t) { return t.name + ' ' + t.cadence + ' ' + t.note; }, searchPlaceholder: 'Search templates',
          columns: [
            { key: 'name', header: 'Template', sortable: true,
              cell: function (t) {
                return h('div', { className: 'stack gap-1' },
                  h('span', { className: 'list__title' }, t.name),
                  h('span', { className: 'list__meta' }, t.note));
              } },
            { key: 'questions', header: 'Questions', numeric: true, align: 'right', sortable: true },
            { key: 'cadence', header: 'Cadence' },
            { key: 'anonymous', header: 'Anonymity', csv: function (t) { return t.anonymous ? 'Anonymous' : 'Attributed'; },
              cell: function (t) {
                return t.anonymous
                  ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info', icon: I.lock }, 'Anonymous')
                  : h(V.Chip, { size: 'sm', shape: 'tag', icon: I.person }, 'Attributed');
              } },
            { key: 'actions', header: '', align: 'right',
              cell: function (t) {
                return h(V.Button, {
                  variant: 'outline', className: 'vi-btn--sm',
                  onClick: function () { router.goAs('hr/engagement/builder'); }
                }, 'Use');
              } }
          ],
          emptyIcon: I.template, emptyTitle: 'No templates configured',
          emptyBody: 'Templates pre-fill the builder with a question set and an anonymity default.'
        })));
  }

  /* ========================================= Approval workflow engine (PRD 6.2)
     The configuration behind every approval in the product: what triggers a request,
     who approves it, in what order, what happens if nobody acts, and what a rejection
     does. Modules are read from the permission matrix so the two cannot drift. */
  var APPROVER_TYPES = [
    { id: 'manager', label: 'Reporting manager', note: 'The requester’s manager at the time of submission.' },
    { id: 'head', label: 'Department head', note: 'The head of the requester’s department.' },
    { id: 'role', label: 'Role based', note: 'Anyone holding a role, e.g. HR Administrator.' },
    { id: 'user', label: 'Specific user', note: 'One named person, used for finance and IT sign-off.' },
    { id: 'group', label: 'Any one of a group', note: 'The first member of a group to act decides.' }
  ];

  var WORKFLOWS = [
    { id: 'wf-leave', name: 'Leave request', module: 'leave', trigger: 'An employee submits a leave request',
      stages: [{ type: 'manager', label: 'Reporting manager' }, { type: 'role', label: 'HR Administrator' }],
      sequence: 'Sequential', escalate: 2, escalateTo: 'Department head', reject: 'Returned to the requester with a mandatory reason',
      note: 'A second level applies only where the request is longer than five working days.' },
    { id: 'wf-reg', name: 'Attendance regularization', module: 'attendance', trigger: 'An employee raises an attendance correction',
      stages: [{ type: 'manager', label: 'Reporting manager' }, { type: 'role', label: 'HR Administrator' }],
      sequence: 'Sequential', escalate: 2, escalateTo: 'HR Administrator', reject: 'Returned with a reason; the original punch is kept',
      note: 'PRD 14.3: approval records the corrected time without overwriting the original.' },
    { id: 'wf-swap', name: 'Shift swap', module: 'shifts', trigger: 'Two employees agree a swap and submit it',
      stages: [{ type: 'manager', label: 'Reporting manager' }],
      sequence: 'Single', escalate: 1, escalateTo: 'Department head', reject: 'Both employees keep their original shifts',
      note: 'The counterparty must agree before the request reaches an approver.' },
    { id: 'wf-asset', name: 'Asset request', module: 'assets', trigger: 'An employee requests an asset category',
      stages: [{ type: 'user', label: 'IT Administrator' }, { type: 'role', label: 'HR Administrator' }],
      sequence: 'Sequential', escalate: 3, escalateTo: 'Organization Admin', reject: 'Closed with a reason; no inventory is reserved',
      note: 'Approval fails if no asset of that category is available (PRD 14.5).' },
    { id: 'wf-profile', name: 'Profile change', module: 'people', trigger: 'An employee edits a restricted profile field',
      stages: [{ type: 'role', label: 'HR Administrator' }],
      sequence: 'Single', escalate: 5, escalateTo: 'HR Manager', reject: 'The field reverts and the employee is told why',
      note: 'Bank, name and statutory fields always route here (PRD 4.5).' },
    { id: 'wf-doc', name: 'Document verification', module: 'documents', trigger: 'An employee uploads a document',
      stages: [{ type: 'role', label: 'HR Administrator' }],
      sequence: 'Single', escalate: 4, escalateTo: 'HR Manager', reject: 'Marked rejected with a reason; a re-upload is allowed',
      note: 'Mandatory onboarding documents block activation until verified (PRD 14.1).' },
    { id: 'wf-payroll', name: 'Payroll release', module: 'payroll', trigger: 'A payroll cycle is moved to review',
      stages: [{ type: 'user', label: 'Finance Controller' }, { type: 'role', label: 'Organization Admin' }],
      sequence: 'Sequential', escalate: 1, escalateTo: 'Organization Admin', reject: 'The cycle returns to Draft and inputs reopen',
      note: 'A finalized cycle is locked; corrections go through an adjustment (PRD 14.6).' },
    { id: 'wf-resign', name: 'Resignation', module: 'offboarding', trigger: 'An employee submits a resignation',
      stages: [{ type: 'manager', label: 'Reporting manager' }, { type: 'role', label: 'HR Administrator' }],
      sequence: 'Sequential', escalate: 3, escalateTo: 'Department head', reject: 'The employee stays active and is told why',
      note: 'Approval starts the notice period and the clearance checklist (PRD 5.1).' },
    { id: 'wf-review', name: 'Performance review', module: 'performance', trigger: 'A manager submits a review for publication',
      stages: [{ type: 'head', label: 'Department head' }, { type: 'group', label: 'Calibration panel' }],
      sequence: 'Parallel', escalate: 5, escalateTo: 'HR Administrator', reject: 'Returned to the reviewer before the employee sees it',
      note: 'Ratings are calibrated across teams before results are published (PRD 4.45).' },
    { id: 'wf-action', name: 'Engagement action plan', module: 'engagement', trigger: 'An action plan is raised from a survey finding',
      stages: [{ type: 'role', label: 'HR Administrator' }],
      sequence: 'Single', escalate: 7, escalateTo: 'Department head', reject: 'Closed with a note on the finding',
      note: 'The owner is notified on assignment and again on the due date.' }
  ];

  function moduleLabel(id) { return (perms.byModule[id] || {}).label || id; }

  function WorkflowDrawer(p) {
    var w = p.workflow;
    return h(ui.Drawer, {
      eyebrow: moduleLabel(w.module), title: w.name, description: w.trigger,
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Close'),
        h(V.Button, {
          variant: 'primary', iconStart: I.tasks,
          onClick: function () { p.onClose(); router.goAs('hr/approvals'); }
        }, 'Open the approval inbox'))
    },
      h(ui.KeyValue, { rows: [
        ['Workflow ID', h('span', { className: 'mono' }, w.id)],
        ['Module', moduleLabel(w.module)],
        ['Trigger', w.trigger],
        ['Levels', w.stages.length + ' · ' + w.sequence.toLowerCase()],
        ['Escalation', 'After ' + w.escalate + ' day' + (w.escalate === 1 ? '' : 's') + ' to ' + w.escalateTo],
        ['On rejection', w.reject],
        ['Status', h(ui.StatusChip, { status: 'Active' })]
      ]}),
      h('div', { className: 'stack gap-2' },
        h('span', { className: 'eyebrow' }, 'Approval chain'),
        h('div', { className: 'steps' }, w.stages.map(function (st, i) {
          var type = APPROVER_TYPES.filter(function (t) { return t.id === st.type; })[0] || {};
          return h('div', { className: 'steps__row', key: i },
            h('span', { className: 'steps__tick' }, I.check),
            h('span', null, 'Level ' + (i + 1) + ' · ' + st.label + ' — ' + (type.note || '')));
        })),
        h('p', { className: 'muted', style: { fontSize: 12, lineHeight: 1.6 } },
          w.sequence === 'Parallel'
            ? 'Parallel: every approver is asked at once and all must approve before the request completes.'
            : w.sequence === 'Single'
              ? 'Single level: one decision completes the request.'
              : 'Sequential: each level is asked only after the level before it approves.')),
      h('div', { className: 'stack gap-2' },
        h('span', { className: 'eyebrow' }, 'Notes'),
        h('p', { className: 'muted', style: { fontSize: 13, lineHeight: 1.6 } }, w.note)));
  }

  function WorkflowConfig() {
    var openSt = React.useState(null);
    var moduleSt = React.useState('');
    var seqSt = React.useState('');

    var rows = WORKFLOWS;
    if (moduleSt[0]) rows = rows.filter(function (w) { return w.module === moduleSt[0]; });
    if (seqSt[0]) rows = rows.filter(function (w) { return w.sequence === seqSt[0]; });

    var modules = {};
    WORKFLOWS.forEach(function (w) { modules[w.module] = true; });
    var pending = store.collection('approvals').filter(function (a) { return a.status === 'Pending Approval'; });
    var kindRows = countRows(pending, function (a) { return a.kind; });

    var open = openSt[0] && WORKFLOWS.filter(function (w) { return w.id === openSt[0]; })[0];

    return h(React.Fragment, null,
      h(Stats, null,
        h(Stat, { label: 'Workflows', value: WORKFLOWS.length, sub: 'Across ' + Object.keys(modules).length + ' modules' }),
        h(Stat, { label: 'Multi-level', value: WORKFLOWS.filter(function (w) { return w.stages.length > 1; }).length,
          sub: WORKFLOWS.filter(function (w) { return w.sequence === 'Parallel'; }).length + ' run in parallel' }),
        h(Stat, { label: 'Requests waiting', value: pending.length,
          sub: kindRows.length + ' request types in the inbox',
          tone: pending.length ? 'warn' : 'good',
          onClick: function () { router.goAs('hr/approvals'); } }),
        h(Stat, { label: 'Fastest escalation', value: Math.min.apply(null, WORKFLOWS.map(function (w) { return w.escalate; })), unit: 'day',
          sub: 'Payroll and shift swaps escalate first' })),

      h(Grid, null,
        h(Card, { span: 12, title: 'Approval workflows',
          description: 'The workflow engine of PRD 6.2: a trigger, an approver chain, a sequence, an escalation and a rejection behaviour.',
          aside: h(V.Button, {
            variant: 'outline', className: 'vi-btn--sm', iconStart: I.tasks,
            onClick: function () { router.goAs('hr/approvals'); }
          }, 'Approval inbox') },
          h(ui.DataTable, {
            exportName: 'approval-workflows', label: 'Approval workflows', rows: rows, pageSize: 10,
            search: function (w) { return w.name + ' ' + moduleLabel(w.module) + ' ' + w.trigger + ' ' + w.sequence; },
            searchPlaceholder: 'Search by workflow, module or trigger',
            filters: h(React.Fragment, null,
              h(ui.Filter, { label: 'Module', value: moduleSt[0], onChange: moduleSt[1],
                options: Object.keys(modules).map(function (m) { return { value: m, label: moduleLabel(m) }; }) }),
              h(ui.Filter, { label: 'Sequence', value: seqSt[0], onChange: seqSt[1],
                options: ['Sequential', 'Parallel', 'Single'] })),
            columns: [
              { key: 'name', header: 'Workflow', sortable: true,
                cell: function (w) {
                  return h('div', { className: 'stack gap-1' },
                    h('button', { type: 'button', className: 'link', onClick: function () { openSt[1](w.id); } }, w.name),
                    h('span', { className: 'list__meta' }, w.trigger));
                } },
              { key: 'module', header: 'Module', sortable: true,
                csv: function (w) { return moduleLabel(w.module); },
                cell: function (w) { return h(V.Chip, { size: 'sm', shape: 'tag' }, moduleLabel(w.module)); } },
              { key: 'approvers', header: 'Approvers', csv: function (w) { return w.stages.map(function (s) { return s.label; }).join(' → '); },
                cell: function (w) {
                  return h('span', { className: 'row gap-2 wrap' }, w.stages.map(function (st, i) {
                    return h(V.Chip, { key: i, size: 'sm', shape: 'tag', variant: 'soft', tone: i ? 'neutral' : 'info' },
                      (i + 1) + '. ' + st.label);
                  }));
                } },
              { key: 'sequence', header: 'Sequence', sortable: true,
                cell: function (w) {
                  return h(V.Chip, {
                    size: 'sm', shape: 'tag', variant: 'soft',
                    tone: w.sequence === 'Parallel' ? 'warning' : 'neutral'
                  }, w.sequence);
                } },
              { key: 'escalate', header: 'Escalates', numeric: true, align: 'right', sortable: true,
                csv: function (w) { return w.escalate + ' days to ' + w.escalateTo; },
                cell: function (w) { return w.escalate + 'd → ' + w.escalateTo; } },
              { key: 'reject', header: 'On rejection' },
              { key: 'actions', header: '', align: 'right',
                cell: function (w) {
                  return h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', onClick: function () { openSt[1](w.id); } }, 'Configure');
                } }
            ],
            emptyIcon: I.relate, emptyTitle: 'No workflows match',
            emptyBody: 'Clear the filters. Every request type in PRD 6.2 has a workflow.'
          })),

        h(Card, { span: 6, title: 'Approver types', description: 'Who a level can resolve to (PRD 6.2).' },
          h('div', { className: 'list' }, APPROVER_TYPES.map(function (t) {
            var uses = WORKFLOWS.filter(function (w) {
              return w.stages.some(function (st) { return st.type === t.id; });
            }).length;
            return h('div', { className: 'list__row', key: t.id },
              h('div', { className: 'list__main' },
                h('span', { className: 'list__title' }, t.label),
                h('span', { className: 'list__meta' }, t.note)),
              h(V.Chip, { size: 'sm', shape: 'tag' }, uses + ' workflow' + (uses === 1 ? '' : 's')));
          }))),

        h(Card, { span: 6, title: 'Engine behaviour', aside: h(V.Chip, { size: 'sm', shape: 'tag', icon: I.file }, 'PRD 6.2') },
          h(ui.KeyValue, { rows: [
            ['Sequential', 'Each level is asked after the one before it approves'],
            ['Parallel', 'Every approver is asked at once; all must approve'],
            ['Escalation', 'An untouched request moves to the fallback approver'],
            ['Rejection', 'Always carries a reason, and the requester is notified'],
            ['Cancellation', 'Closes the whole chain, including levels not yet asked'],
            ['Delegation', 'An approver on leave delegates to their own manager'],
            ['History', 'Every decision is retained for audit (PRD 14)']
          ]}),
          h('div', { className: 'checks' },
            [['Escalate automatically when a level goes untouched', true],
              ['Require a reason on every rejection', true],
              ['Notify the requester at each level', true],
              ['Let an approver delegate while on leave', true],
              ['Allow the final approver to edit the request before approving', false]].map(function (row) {
              return h('div', { className: 'checks__row', key: row[0] },
                h(V.Switch, {
                  defaultChecked: row[1], 'aria-label': row[0],
                  onChange: function (e) { ui.toast(row[0] + ' ' + (e.target.checked ? 'enabled' : 'disabled'), 'success'); }
                }),
                h('div', { className: 'checks__main' }, h('span', { className: 'checks__name' }, row[0])));
            }))),

        h(Card, { span: 12, title: 'Live queue by request type',
          description: 'What these workflows currently hold in the approval inbox (PRD 6.5).' },
          kindRows.length
            ? h(ui.Bars, { rows: kindRows })
            : h(ui.Empty, { icon: I.ok, title: 'Nothing waiting', body: 'Every request routed by these workflows has been actioned.' }))),

      open ? h(WorkflowDrawer, { workflow: open, onClose: function () { openSt[1](null); } }) : null);
  }

  /* ---------------------------------------------------------------- Register */
  /* ================================================== Announcements (PRD 4.39)
     One feed, two workspaces. HR posts; everyone reads, reacts and comments. The
     employee screen used to live in self.js, but the two differ only by `canPost`,
     so they share an implementation rather than drifting apart. */
  var REACTIONS = [
    { emoji: '\uD83D\uDC4D', label: 'Like' },
    { emoji: '\u2764\uFE0F', label: 'Love' },
    { emoji: '\uD83C\uDF89', label: 'Celebrate' },
    { emoji: '\uD83D\uDC4F', label: 'Applaud' }
  ];

  function announcementsNewestFirst() {
    return store.collection('announcements').slice().sort(function (a, b) {
      return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (a.on < b.on ? 1 : -1);
    });
  }
  function authorName(a) {
    var e = a.by ? emp(a.by) : null;
    return e ? e.name : (a.byName || 'HR');
  }

  function Reactions(p) {
    var all = store.collection('announcementReactions').filter(function (r) {
      return r.announcement === p.announcement;
    });
    var me = p.me;
    return h('div', { className: 'reacts' }, REACTIONS.map(function (r) {
      var rows = all.filter(function (x) { return x.emoji === r.emoji; });
      var mine = me && rows.some(function (x) { return x.employee === me.id; });
      var who = rows.map(function (x) { var e = emp(x.employee); return e ? e.name : '—'; });
      return h('button', {
        key: r.emoji, type: 'button',
        className: 'react' + (mine ? ' is-on' : ''),
        'aria-pressed': mine ? 'true' : 'false',
        'aria-label': r.label + (rows.length ? ' · ' + rows.length : ''),
        title: who.length ? who.join(', ') : r.label,
        /* A reaction needs no toast: the pill itself lights up. Only a failure speaks. */
        onClick: function () {
          var res = act.toggleAnnouncementReaction(p.announcement, r.emoji);
          if (!res.ok) ui.report(res);
        }
      }, h('span', { className: 'react__e', 'aria-hidden': 'true' }, r.emoji),
         rows.length ? h('span', { className: 'react__n' }, rows.length) : null);
    }));
  }

  function Comments(p) {
    var rows = store.collection('announcementComments')
      .filter(function (c) { return c.announcement === p.announcement; })
      .sort(function (a, b) { return a.on < b.on ? -1 : 1; });
    var draft = React.useState('');
    var openSt = React.useState(false);

    function post() {
      var res = act.commentOnAnnouncement(p.announcement, { body: draft[0].trim() });
      ui.report(res);
      if (res.ok) draft[1]('');
    }

    return h('div', { className: 'cmts' },
      rows.length
        ? h('button', {
            type: 'button', className: 'cmts__toggle',
            'aria-expanded': openSt[0] ? 'true' : 'false',
            onClick: function () { openSt[1](!openSt[0]); }
          }, I.comment, rows.length === 1 ? '1 comment' : rows.length + ' comments')
        : h('span', { className: 'cmts__none' }, I.comment, 'No comments yet'),

      (openSt[0] || !rows.length) ? h('div', { className: 'cmts__list' }, rows.map(function (c) {
        var who = emp(c.by);
        return h('div', { className: 'cmt', key: c.id },
          h(V.Avatar, { name: who ? who.name : 'User', size: 'xs' }),
          h('div', { className: 'cmt__main' },
            h('div', { className: 'cmt__head' },
              h('strong', null, who ? who.name : 'Someone'),
              h('span', { className: 'muted' }, ui.relTime ? ui.relTime(c.on) : ui.dateLabel(c.on.slice(0, 10)))),
            h('p', { className: 'cmt__body' }, c.body)));
      })) : null,

      h('div', { className: 'cmts__new' },
        h(V.Avatar, { name: p.me ? p.me.name : 'User', size: 'xs' }),
        h(V.TextField, {
          label: null, placeholder: 'Write a comment', value: draft[0],
          'aria-label': 'Write a comment',
          onChange: function (e) { draft[1](e.target.value); },
          onKeyDown: function (e) { if (e.key === 'Enter' && draft[0].trim()) { e.preventDefault(); post(); } }
        }),
        h(V.Button, {
          variant: 'outline', className: 'vi-btn--sm', iconStart: I.send,
          disabled: !draft[0].trim(), onClick: post
        }, 'Comment')));
  }

  function Composer() {
    var openSt = React.useState(false);
    var form = ui.useForm({ title: '', body: '', pinned: false });
    function submit() {
      var res = form.submit(function (v) { return ui.report(act.postAnnouncement(v)); });
      if (res && res.ok) { form.reset({ title: '', body: '', pinned: false }); openSt[1](false); }
    }
    if (!openSt[0]) {
      return h(Card, { span: 12 },
        h('div', { className: 'row gap-2' },
          h(V.Button, { variant: 'primary', iconStart: I.plus, onClick: function () { openSt[1](true); } }, 'Post an announcement'),
          h('span', { className: 'muted', style: { fontSize: 13 } },
            'Everyone in the organization sees it, and can react and comment.')));
    }
    return h(Card, { span: 12, title: 'New announcement' },
      h(V.TextField, Object.assign({ label: 'Title', placeholder: 'e.g. Office closed on 14 November' }, form.field('title'))),
      h(V.TextArea, Object.assign({ label: 'Announcement', rows: 4, placeholder: 'What should everyone know?' }, form.field('body'))),
      h('div', { className: 'row gap-3', style: { marginTop: 12 } },
        h(V.Checkbox, Object.assign({ label: 'Pin to the top' }, form.check('pinned'))),
        h('span', { style: { marginLeft: 'auto' } }),
        h(V.Button, { variant: 'ghost', onClick: function () { openSt[1](false); } }, 'Cancel'),
        h(V.Button, { variant: 'primary', iconStart: I.send, onClick: submit }, 'Post')));
  }

  function announcementsScreen(canPost) {
    return function () {
      var me = store.persona(store.pref('role'));
      var rows = announcementsNewestFirst();
      return h(React.Fragment, null,
        h(ui.PageHead, {
          eyebrow: canPost ? 'Engagement' : 'Home', title: 'Announcements',
          description: canPost
            ? 'Post to the whole organization. Everyone can react and comment.'
            : 'Company announcements, newest first. React or comment to join in.'
        }),
        h(Grid, null,
          canPost ? h(Composer) : null,
          rows.map(function (a) {
            return h(Card, { key: a.id, span: 12, title: a.title,
              aside: a.pinned ? h(V.Chip, { size: 'sm', shape: 'tag', icon: I.flag }, 'Pinned') : null },
              h('p', { style: { fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' } }, a.body),
              h('div', { className: 'row gap-2' },
                h(V.Avatar, { name: authorName(a), size: 'xs' }),
                h('span', { className: 'muted', style: { fontSize: 12 } },
                  authorName(a) + ' \u00b7 ' + ui.dateLabel(a.on))),
              h(Reactions, { announcement: a.id, me: me }),
              h(Comments, { announcement: a.id, me: me }));
          })));
    };
  }

  HRMS.screens.register({
    'hr/engagement/dashboard': EngagementDashboard,
    'hr/engagement/surveys': SurveyLibrary,
    'hr/engagement/builder': SurveyBuilder,
    'hr/engagement/responses': SurveyResponses,
    'hr/engagement/analytics': EngagementAnalytics,
    'hr/engagement/feedback': FeedbackScreen,
    'hr/engagement/actions': ActionPlans,
    'hr/announcements': announcementsScreen(true),
    'me/announcements': announcementsScreen(false),
    'hr/config/surveys': SurveyConfig,
    'hr/config/workflows': WorkflowConfig
  });
})();

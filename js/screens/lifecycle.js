/* Phase 4 (PRD 18): onboarding, offboarding, documents & policies, and assets.

   These are the four modules that move an employee record through its life, so every
   screen here writes through HRMS.actions rather than the store. That keeps the rules of
   PRD 14 — mandatory onboarding tasks before activation (14.1), asset allocation state
   (14.5), clearance before settlement (14.8) — in one place, and keeps the cross-module
   consequences of 5.1 (onboarding checklist, access revocation, inventory) running
   whichever screen the viewer happens to be on. */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var store = HRMS.store, router = HRMS.router, ui = HRMS.ui, seed = HRMS.seed;
  var act = HRMS.actions, rules = HRMS.rules;
  var Card = ui.Card, Grid = ui.Grid, Stat = ui.Stat, Stats = ui.Stats;

  function emp(id) { return store.employee(id); }
  function empName(id) { var e = emp(id); return e ? e.name : '—'; }
  function deptName(id) { var d = store.department(id); return d ? d.name : '—'; }
  function locName(id) { var l = store.location(id); return l ? l.name : '—'; }
  function today() { return seed.todayIso; }
  function dayOffset(n) { return seed.util.iso(seed.util.addDays(seed.today, n)); }
  /* Whole days from today. Negative means the date has already passed. */
  function daysAway(isoStr) {
    if (!isoStr) return null;
    return Math.round((new Date(String(isoStr).slice(0, 10) + 'T00:00') - seed.today) / 86400000);
  }
  /* An employee cell that degrades to a dash when the record has gone. */
  function person(id, sub) {
    var e = emp(id);
    if (!e) return h('span', { className: 'muted' }, '—');
    return h(ui.Person, { employee: e, sub: sub === undefined ? e.id : sub });
  }
  /* [label, count] pairs for ui.Bars, biggest first. */
  function distribution(rows, keyFn) {
    var counts = {};
    rows.forEach(function (r) { var k = keyFn(r); if (k) counts[k] = (counts[k] || 0) + 1; });
    return Object.keys(counts).map(function (k) { return [k, counts[k]]; })
      .sort(function (a, b) { return b[1] - a[1]; });
  }
  function deptOptions() { return store.collection('departments').map(function (d) { return { value: d.id, label: d.name }; }); }
  function locOptions() { return store.collection('locations').map(function (l) { return { value: l.id, label: l.name }; }); }

  /* ========================================================= Shared checklist
     Onboarding (PRD 4.9) and offboarding clearance (4.50) are the same widget: a list of
     named tasks with an owner, ticked through an action that may refuse. `onToggle` is
     handed the task name and the state wanted, and reports the result itself. */
  function TaskChecklist(p) {
    return h('div', { className: 'checks' }, p.tasks.map(function (t) {
      var late = !t.done && t.due && t.due < today();
      return h('div', { className: 'checks__row' + (t.done ? ' is-done' : ''), key: t.name },
        h(V.Checkbox, {
          checked: !!t.done, 'aria-label': t.name,
          onChange: function (e) { p.onToggle(t.name, e.target.checked); }
        }),
        h('div', { className: 'checks__main' },
          h('span', { className: 'checks__name' }, t.name),
          h('span', { className: 'checks__meta' }, p.meta(t))),
        t.mandatory ? h(V.Chip, { size: 'sm', shape: 'tag' }, 'Mandatory') : null,
        late ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'error', dot: true }, 'Overdue') : null);
    }));
  }

  /* A note that explains why an action is currently refused (PRD 17 error states). */
  function Blockers(p) {
    if (!p.items || !p.items.length) return null;
    return h('div', { className: 'ai-note' },
      h('span', { className: 'ai-note__mark' }, I.warn),
      h('div', { className: 'ai-note__body' },
        h('span', { className: 'ai-note__eyebrow' }, p.title || 'Blocked'),
        h('p', { className: 'ai-note__text' }, p.items.join(' · ')),
        p.actions ? h('div', { className: 'ai-note__acts' }, p.actions) : null));
  }

  /* ================================================== Onboarding (PRD 4.6–4.9) */
  function onboardingCases() { return store.collection('onboarding'); }
  function openTasks(c) { return (c.tasks || []).filter(function (t) { return !t.done; }); }
  function overdueTasks(c) { return openTasks(c).filter(function (t) { return t.due && t.due < today(); }); }
  function templateName(id) {
    var t = store.collection('onboardingTemplates').filter(function (x) { return x.id === id; })[0];
    return t ? t.name : id;
  }
  function pendingDocuments() {
    return store.collection('employeeDocuments').filter(function (d) { return d.status === 'Pending Verification'; });
  }

  /* The drawer behind every onboarding row: the checklist itself (PRD 4.9). */
  function OnboardingDrawer(p) {
    var c = store.find('onboarding', p.id);
    if (!c) return null;
    var e = emp(c.employee);
    var done = (c.tasks || []).filter(function (t) { return t.done; }).length;
    var total = (c.tasks || []).length;
    /* PRD 14.1: activation is refused while a mandatory task is open. */
    var blocked = e ? rules.canActivate(e) : null;

    function toggle(name, want) { ui.report(act.completeOnboardingTask(c.id, name, want)); }

    return h(ui.Drawer, {
      eyebrow: c.id + ' · ' + templateName(c.template),
      title: e ? e.name : c.employee,
      description: e ? e.designation + ' · joins ' + c.startDateLabel : null,
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Close'),
        h(V.Button, {
          variant: 'primary', iconStart: I.file,
          onClick: function () { p.onClose(); router.goAs('hr/onboarding/verification'); }
        }, 'Verify documents'))
    },
      h('div', { className: 'row gap-3 wrap' },
        h(ui.StatusChip, { status: c.stage, size: 'md' }),
        h(V.Chip, { size: 'sm', shape: 'tag', icon: I.checklist }, done + ' of ' + total + ' done'),
        c.overdue ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'error', dot: true }, c.overdue + ' overdue') : null),
      h(V.ProgressBar, { label: 'Checklist progress', value: ui.pct(done, total), showValue: true }),
      h(ui.KeyValue, { rows: [
        ['Employee', e ? h('span', { className: 'mono' }, e.id) : c.employee],
        ['Department', e ? deptName(e.department) : null],
        ['Work location', e ? locName(e.location) : null],
        ['Reporting manager', e && e.manager ? empName(e.manager) : null],
        ['Start date', c.startDateLabel],
        ['Template', templateName(c.template)],
        ['Documents pending', c.docsPending || null]
      ]}),
      h(Blockers, {
        title: 'Cannot activate yet', items: blocked ? [blocked] : [],
        actions: h(V.Button, {
          variant: 'outline', className: 'vi-btn--sm',
          onClick: function () { p.onClose(); router.goAs('hr/people/all'); }
        }, 'Open employee record')
      }),
      h('div', { className: 'stack gap-2' },
        h('span', { className: 'eyebrow' }, 'Checklist'),
        h(TaskChecklist, {
          tasks: c.tasks || [], onToggle: toggle,
          meta: function (t) {
            return (t.assignee ? empName(t.assignee) : 'Unassigned')
              + (t.due ? ' · due ' + ui.dateLabel(t.due) : '')
              + (t.done && t.completedOn ? ' · completed ' + ui.dateLabel(t.completedOn) : '');
          }
        })));
  }

  function OnboardingDashboard() {
    var cases = onboardingCases();
    var s = store.stats();
    var docs = pendingDocuments();

    function stage(name) { return cases.filter(function (c) { return c.stage === name; }).length; }
    var overdue = cases.reduce(function (n, c) { return n + overdueTasks(c).length; }, 0);

    /* Which task is holding the most cases up, counted across open cases only. */
    var byTask = seed.onboardingTaskNames.map(function (name) {
      return [name, cases.filter(function (c) {
        return (c.tasks || []).some(function (t) { return t.name === name && !t.done; });
      }).length];
    }).filter(function (r) { return r[1] > 0; }).sort(function (a, b) { return b[1] - a[1]; });

    return h(React.Fragment, null,
      /* store.stats().pendingOnboardingTasks is the authoritative open-task figure
         PRD 15 fixes at 16, so it is read rather than recomputed here. */
      h(Stats, { cols: 5 },
        h(Stat, { key: 1, label: 'Yet to start', value: stage('Yet to Start'), sub: 'Invited, checklist not begun' }),
        h(Stat, { key: 2, label: 'In progress', value: stage('In Progress'), sub: s.pendingOnboardingTasks + ' tasks open in total' }),
        h(Stat, { key: 3, label: 'Pending verification', value: stage('Pending Verification'),
          sub: docs.length + ' documents awaiting review', tone: docs.length ? 'warn' : null }),
        h(Stat, { key: 4, label: 'Completed', value: stage('Completed'), sub: 'Ready for activation', tone: 'good' }),
        h(Stat, { key: 5, label: 'Overdue tasks', value: overdue, sub: 'Past their due date', tone: overdue ? 'warn' : 'good' })),

      h(Grid, null,
        h(Card, { span: 7, title: 'Onboarding in flight',
          description: 'Every open case with its checklist progress (PRD 4.6).',
          aside: h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.right,
            onClick: function () { router.goAs('hr/onboarding/cases'); } }, 'All cases') },
          cases.length
            ? h('div', { className: 'list scroll-320' }, cases.map(function (c) {
                var e = emp(c.employee);
                return h('div', { className: 'list__row', key: c.id },
                  h('div', { className: 'list__main' },
                    h('span', { className: 'list__title' }, e ? e.name : c.employee),
                    h('span', { className: 'list__meta' }, (e ? deptName(e.department) + ' · ' : '')
                      + 'joins ' + c.startDateLabel + ' · ' + c.pending + ' task' + (c.pending === 1 ? '' : 's') + ' open')),
                  h('span', { style: { width: 96 } },
                    h(V.ProgressBar, { value: ui.pct(c.tasksDone, c.tasksTotal), size: 'sm', 'aria-label': 'Progress' })),
                  h(ui.StatusChip, { status: c.stage }));
              }))
            : h(ui.Empty, { icon: I.person, title: 'No onboarding in progress', body: 'A new employee record creates a checklist automatically (PRD 5.1).' })),

        h(Card, { span: 5, title: 'Cases by stage' },
          h(ui.Bars, { rows: ['Yet to Start', 'In Progress', 'Pending Verification', 'Completed'].map(function (k) {
            return [k, stage(k), k === 'Completed' ? 'success' : k === 'Pending Verification' ? 'warning' : null];
          }).filter(function (r) { return r[1] > 0; }), emptyTitle: 'No cases to chart' })),

        h(Card, { span: 7, title: 'Tasks still open, by task',
          description: 'Where the checklists are stalling across all open cases.' },
          h(ui.Bars, { rows: byTask, emptyTitle: 'Every checklist is complete' })),

        h(Card, { span: 5, title: 'Document verification queue',
          description: 'PRD 4.8: uploaded documents waiting on HR.',
          aside: h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.file,
            onClick: function () { router.goAs('hr/onboarding/verification'); } }, 'Review') },
          h(ui.KeyValue, { rows: [
            ['Awaiting verification', docs.length],
            ['From new joiners', docs.filter(function (d) { var e = emp(d.employee); return e && e.status === 'Onboarding'; }).length],
            ['Oldest upload', docs.length ? ui.dateLabel(docs.map(function (d) { return d.uploaded; }).sort()[0]) : null],
            ['Categories affected', Object.keys(docs.reduce(function (m, d) { m[d.category] = 1; return m; }, {})).length]
          ]}))));
  }

  function OnboardingCases() {
    var openSt = React.useState(null);
    var startSt = React.useState(false);
    var stageSt = React.useState('');
    var form = ui.useForm({ template: 'tpl-standard' });

    var cases = onboardingCases();
    var rows = stageSt[0] ? cases.filter(function (c) { return c.stage === stageSt[0]; }) : cases;

    function start() {
      var res = form.submit(function (v) {
        if (!v.employee) return { ok: false, errors: { employee: 'Choose an employee' } };
        return ui.report(act.initiateOnboarding(v.employee, v.template));
      });
      if (res && res.ok) { startSt[1](false); form.reset({ template: 'tpl-standard' }); openSt[1](res.id); }
    }

    var columns = [
      { key: 'employee', header: 'New joiner', sortable: true,
        sortValue: function (c) { return empName(c.employee); },
        csv: function (c) { return empName(c.employee); },
        cell: function (c) {
          var e = emp(c.employee);
          return e ? h(ui.Person, { employee: e, sub: e.id, onClick: function () { openSt[1](c.id); } })
            : h('span', { className: 'muted' }, c.employee);
        } },
      { key: 'department', header: 'Department', csv: function (c) { var e = emp(c.employee); return e ? deptName(e.department) : ''; },
        cell: function (c) { var e = emp(c.employee); return e ? deptName(e.department) : '—'; } },
      { key: 'startDate', header: 'Start date', sortable: true, cell: function (c) { return c.startDateLabel; } },
      { key: 'template', header: 'Template', csv: function (c) { return templateName(c.template); },
        cell: function (c) { return templateName(c.template); } },
      { key: 'progress', header: 'Progress', sortable: true,
        sortValue: function (c) { return ui.pct(c.tasksDone, c.tasksTotal); },
        csv: function (c) { return c.tasksDone + ' of ' + c.tasksTotal; },
        cell: function (c) {
          return h('span', { className: 'stack gap-1', style: { minWidth: 110 } },
            h(V.ProgressBar, { value: ui.pct(c.tasksDone, c.tasksTotal), size: 'sm', 'aria-label': 'Checklist progress' }),
            h('span', { className: 'list__meta' }, c.tasksDone + ' of ' + c.tasksTotal + ' tasks'));
        } },
      { key: 'pending', header: 'Open', numeric: true, align: 'right', sortable: true },
      { key: 'overdue', header: 'Overdue', numeric: true, align: 'right',
        csv: function (c) { return overdueTasks(c).length; },
        cell: function (c) {
          var n = overdueTasks(c).length;
          return n ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'error', dot: true }, n) : h('span', { className: 'muted' }, '—');
        } },
      { key: 'stage', header: 'Stage', cell: function (c) { return h(ui.StatusChip, { status: c.stage }); } },
      { key: 'actions', header: '', align: 'right',
        cell: function (c) {
          return h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', onClick: function () { openSt[1](c.id); } }, 'Checklist');
        } }
    ];

    return h(React.Fragment, null,
      h(Card, {
        title: 'Onboarding cases',
        description: 'One case per new joiner. Open the checklist to tick a task off (PRD 4.9).',
        aside: h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus,
          onClick: function () { startSt[1](true); } }, 'Start onboarding')
      },
        h(ui.DataTable, {
          exportName: 'onboarding-cases', label: 'Onboarding cases', rows: rows, pageSize: 10,
          search: function (c) { return empName(c.employee) + ' ' + c.id + ' ' + c.stage; },
          searchPlaceholder: 'Search by name, case or stage',
          filters: h(ui.Filter, {
            label: 'Stage', value: stageSt[0], onChange: stageSt[1],
            options: ['Yet to Start', 'In Progress', 'Pending Verification', 'Completed']
          }),
          columns: columns,
          emptyIcon: I.person, emptyTitle: 'No onboarding cases',
          emptyBody: 'A record created with an Invited or Onboarding status generates a checklist (PRD 5.1). You can also start one here.',
          emptyActions: h(V.Button, { variant: 'primary', iconStart: I.plus, onClick: function () { startSt[1](true); } }, 'Start onboarding')
        })),

      openSt[0] ? h(OnboardingDrawer, { id: openSt[0], onClose: function () { openSt[1](null); } }) : null,

      startSt[0] ? h(ui.Modal, {
        title: 'Start onboarding',
        description: 'Generates the checklist from the chosen template and assigns each task (PRD 4.7).',
        onClose: function () { startSt[1](false); },
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { startSt[1](false); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: start }, 'Start onboarding'))
      },
        h(ui.EmployeePicker, {
          label: 'Employee', value: form.values.employee,
          status: form.errors.employee ? 'error' : undefined,
          hint: form.errors.employee || 'Someone who does not already have a case',
          onChange: function (v) { form.set('employee', v); }
        }),
        h(V.Select, Object.assign({ label: 'Template',
          options: store.collection('onboardingTemplates')
            .filter(function (t) { return t.status === 'Active'; })
            .map(function (t) { return { value: t.id, label: t.name + ' · ' + t.tasks + ' tasks' }; })
        }, form.select('template'))),
        form.errors._ ? h('p', { style: { color: 'var(--danger-fg)', fontSize: 13 } }, form.errors._) : null) : null);
  }

  /* -------------------------------------------------- Document verification (4.8) */
  function verifyColumns(onDecide) {
    return [
      { key: 'employee', header: 'Employee', sortable: true,
        sortValue: function (d) { return empName(d.employee); },
        csv: function (d) { return empName(d.employee); },
        cell: function (d) { return person(d.employee); } },
      { key: 'category', header: 'Category', sortable: true },
      { key: 'name', header: 'File', cell: function (d) { return h('span', { className: 'mono' }, d.name); } },
      { key: 'uploaded', header: 'Uploaded', sortable: true, cell: function (d) { return ui.dateLabel(d.uploaded); } },
      { key: 'size', header: 'Size', align: 'right' },
      { key: 'expiry', header: 'Expiry', csv: function (d) { return d.expiry || ''; },
        cell: function (d) { return d.expiry ? ui.dateLabel(d.expiry) : h('span', { className: 'muted' }, 'No expiry'); } },
      { key: 'status', header: 'Status', cell: function (d) { return h(ui.StatusChip, { status: d.status }); } },
      { key: 'actions', header: '', align: 'right',
        cell: function (d) {
          if (d.status !== 'Pending Verification') {
            return h('span', { className: 'muted', style: { fontSize: 12 } },
              d.verifiedBy ? 'by ' + empName(d.verifiedBy) : '');
          }
          return h('span', { className: 'row gap-2', style: { justifyContent: 'flex-end' } },
            h(V.Button, { variant: 'outline', className: 'vi-btn--sm',
              onClick: function () { onDecide({ doc: d, decision: 'Rejected' }); } }, 'Reject'),
            h(V.Button, { variant: 'primary', className: 'vi-btn--sm',
              onClick: function () { onDecide({ doc: d, decision: 'Verified' }); } }, 'Verify'));
        } }
    ];
  }

  /* The verify / reject dialog, shared by onboarding verification and the employee
     document library, so one comment rule covers both (PRD 4.8). */
  function VerifyModal(p) {
    var form = ui.useForm({});
    var reject = p.decision === 'Rejected';

    function save() {
      var res = form.submit(function (v) {
        if (reject && (!v.comment || String(v.comment).trim().length < 3)) {
          return { ok: false, errors: { comment: 'Tell the employee what is wrong with the document' } };
        }
        return ui.report(act.verifyDocument(p.doc.id, p.decision, v.comment));
      });
      if (res && res.ok) p.onClose();
    }

    return h(ui.Modal, {
      title: (reject ? 'Reject ' : 'Verify ') + p.doc.category,
      description: p.doc.name + ' · ' + empName(p.doc.employee),
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
        h(V.Button, {
          variant: 'primary', className: reject ? 'vi-btn--danger' : '', onClick: save
        }, reject ? 'Reject document' : 'Mark verified'))
    },
      h(ui.KeyValue, { rows: [
        ['Employee', empName(p.doc.employee)],
        ['Category', p.doc.category],
        ['Uploaded', ui.dateLabel(p.doc.uploaded)],
        ['File size', p.doc.size],
        ['Expiry', p.doc.expiry ? ui.dateLabel(p.doc.expiry) : null]
      ]}),
      h(V.TextArea, Object.assign({
        label: reject ? 'Reason for rejection' : 'Note (optional)', rows: 3, required: reject,
        placeholder: reject ? 'e.g. The address proof is older than three months' : 'Visible in the audit trail'
      }, form.field('comment'))));
  }

  function DocumentVerification() {
    var decideSt = React.useState(null);
    var catSt = React.useState(''), deptSt = React.useState('');

    var all = store.collection('employeeDocuments');
    var rows = all.filter(function (d) { return d.status === 'Pending Verification'; });
    if (catSt[0]) rows = rows.filter(function (d) { return d.category === catSt[0]; });
    if (deptSt[0]) rows = rows.filter(function (d) { var e = emp(d.employee); return e && e.department === deptSt[0]; });

    var joiners = all.filter(function (d) {
      var e = emp(d.employee);
      return d.status === 'Pending Verification' && e && (e.status === 'Onboarding' || e.status === 'Invited');
    });

    return h(React.Fragment, null,
      h(Stats, null,
        h(Stat, { key: 1, label: 'Awaiting verification', value: all.filter(function (d) { return d.status === 'Pending Verification'; }).length,
          sub: 'Across every employee', tone: 'warn' }),
        h(Stat, { key: 2, label: 'From new joiners', value: joiners.length, sub: 'Blocking onboarding completion' }),
        h(Stat, { key: 3, label: 'Verified', value: all.filter(function (d) { return d.status === 'Verified'; }).length, sub: 'On file', tone: 'good' }),
        h(Stat, { key: 4, label: 'Rejected', value: all.filter(function (d) { return d.status === 'Rejected'; }).length, sub: 'Awaiting a fresh upload' })),

      h(Card, {
        title: 'Documents awaiting verification',
        description: 'PRD 4.8: accept or reject each uploaded document. A rejection needs a reason, which the employee sees.'
      },
        h(ui.DataTable, {
          exportName: 'document-verification', label: 'Documents awaiting verification', rows: rows, pageSize: 10,
          search: function (d) { return empName(d.employee) + ' ' + d.category + ' ' + d.name; },
          searchPlaceholder: 'Search by employee, category or file',
          filters: h(React.Fragment, null,
            h(ui.Filter, { label: 'Category', value: catSt[0], onChange: catSt[1], options: seed.documentCategories }),
            h(ui.Filter, { label: 'Department', value: deptSt[0], onChange: deptSt[1], options: deptOptions() })),
          columns: verifyColumns(decideSt[1]),
          emptyIcon: I.ok, emptyTitle: 'Nothing left to verify',
          emptyBody: 'Every uploaded document has been accepted or rejected. New uploads land here automatically.'
        })),

      decideSt[0] ? h(VerifyModal, {
        doc: decideSt[0].doc, decision: decideSt[0].decision,
        onClose: function () { decideSt[1](null); }
      }) : null);
  }

  /* ------------------------------------------------------ Onboarding templates (4.7) */
  function OnboardingTemplates() {
    var templates = store.collection('onboardingTemplates');
    var names = seed.onboardingTaskNames;

    return h(React.Fragment, null,
      h(Card, { title: 'Onboarding templates',
        description: 'A template per employee type and department, applied when a record is created (PRD 4.7).' },
        h(ui.DataTable, {
          exportName: 'onboarding-templates', label: 'Onboarding templates', rows: templates, pageSize: 10,
          search: function (t) { return t.name + ' ' + t.employeeType + ' ' + t.department; },
          searchPlaceholder: 'Search templates',
          columns: [
            { key: 'name', header: 'Template', sortable: true },
            { key: 'employeeType', header: 'Employee type' },
            { key: 'department', header: 'Department' },
            { key: 'tasks', header: 'Tasks', numeric: true, align: 'right', sortable: true },
            { key: 'used', header: 'In use', numeric: true, align: 'right',
              cell: function (t) { return onboardingCases().filter(function (c) { return c.template === t.id; }).length; } },
            { key: 'status', header: 'Status', cell: function (t) { return h(ui.StatusChip, { status: t.status }); } }
          ],
          emptyIcon: I.template, emptyTitle: 'No templates configured',
          emptyBody: 'Templates are configured on the onboarding configuration screen.'
        })),

      h(Card, { title: 'Standard template tasks',
        description: 'The task list, its default owner and the order it runs in. The first eight are mandatory, so activation is refused while any of them is open (PRD 14.1).' },
        h(ui.DataTable, {
          exportName: 'onboarding-tasks', label: 'Standard template tasks', pageSize: 12, onExport: false,
          rows: names.map(function (name, i) {
            return {
              id: name, step: i + 1, name: name, mandatory: i < 8,
              owner: /IT|Asset/.test(name) ? 'IT Administrator' : /Manager|Department/.test(name) ? 'Reporting Manager' : 'HR Administrator',
              dueDay: 'Day ' + (i + 1),
              depends: i === 0 ? null : names[i - 1]
            };
          }),
          columns: [
            { key: 'step', header: '#', numeric: true, align: 'right' },
            { key: 'name', header: 'Task' },
            { key: 'owner', header: 'Default owner' },
            { key: 'dueDay', header: 'Due' },
            { key: 'depends', header: 'Depends on',
              cell: function (r) { return r.depends || h('span', { className: 'muted' }, 'Nothing — starts first'); } },
            { key: 'mandatory', header: 'Mandatory', align: 'center',
              cell: function (r) {
                return r.mandatory
                  ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning' }, 'Mandatory')
                  : h('span', { className: 'muted' }, 'Optional');
              } }
          ]
        })));
  }

  /* ================================================= Offboarding (PRD 4.48–4.51) */
  function offboardingCases() { return store.collection('offboarding'); }
  function liveExits() { return offboardingCases().filter(function (c) { return c.stage !== 'Completed' && c.stage !== 'Rejected'; }); }
  function settlementSuggestion(employeeId) {
    var e = emp(employeeId);
    if (!e) return 0;
    var b = e.breakdown || seed.util.breakdown(e.ctc);
    return Math.round(b.gross);
  }

  function OffboardingDashboard() {
    var cases = offboardingCases();
    var live = liveExits();
    var endingSoon = live.filter(function (c) { var d = daysAway(c.lastWorkingDay); return d != null && d <= 30; });
    var clearanceOpen = live.reduce(function (n, c) { return n + (c.tasksTotal - c.tasksDone); }, 0);
    var settlements = live.filter(function (c) { return c.settlement !== 'Paid'; });

    return h(React.Fragment, null,
      h(Stats, { cols: 5 },
        h(Stat, { key: 1, label: 'Open exits', value: live.length, sub: 'Serving notice or awaiting a decision' }),
        h(Stat, { key: 2, label: 'Notice ending in 30 days', value: endingSoon.length,
          sub: 'Last working day approaching', tone: endingSoon.length ? 'warn' : null }),
        h(Stat, { key: 3, label: 'Clearance tasks open', value: clearanceOpen, sub: 'Across every live case' }),
        h(Stat, { key: 4, label: 'Settlements pending', value: settlements.length,
          sub: 'Blocked until clearance is complete (PRD 14.8)', tone: settlements.length ? 'warn' : null }),
        h(Stat, { key: 5, label: 'Exits completed', value: cases.filter(function (c) { return c.stage === 'Completed'; }).length,
          sub: 'Records archived', tone: 'good' })),

      h(Grid, null,
        h(Card, { span: 7, title: 'Live exits',
          description: 'PRD 4.51: open cases with clearance progress and the last working day.',
          aside: h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.right,
            onClick: function () { router.goAs('hr/offboarding/clearance'); } }, 'Clearance') },
          live.length
            ? h('div', { className: 'list scroll-320' }, live.map(function (c) {
                var e = emp(c.employee);
                return h('div', { className: 'list__row', key: c.id },
                  h('div', { className: 'list__main' },
                    h('span', { className: 'list__title' }, e ? e.name : c.employee),
                    h('span', { className: 'list__meta' }, 'Last working day ' + c.lastWorkingDayLabel
                      + ' · ' + (c.tasksTotal - c.tasksDone) + ' clearance task(s) open')),
                  h('span', { style: { width: 96 } },
                    h(V.ProgressBar, { value: c.clearance, size: 'sm', 'aria-label': 'Clearance' })),
                  h(ui.StatusChip, { status: c.status }));
              }))
            : h(ui.Empty, { icon: I.logout, title: 'No exits in progress', body: 'An approved resignation starts a clearance checklist (PRD 5.1).' })),

        h(Card, { span: 5, title: 'Exit reasons', description: 'Across every recorded exit.' },
          h(ui.Bars, { rows: distribution(cases, function (c) { return c.reason; }), emptyTitle: 'No exits recorded' })),

        h(Card, { span: 7, title: 'Clearance by case' },
          h(ui.Bars, {
            rows: live.map(function (c) {
              return [empName(c.employee), c.clearance, c.clearance === 100 ? 'success' : c.clearance < 50 ? 'warning' : null];
            }),
            emptyTitle: 'No clearance in progress'
          })),

        h(Card, { span: 5, title: 'Attrition by department', description: 'Exits recorded per department.' },
          h(ui.Bars, {
            rows: distribution(cases, function (c) { var e = emp(c.employee); return e ? deptName(e.department) : null; }),
            emptyTitle: 'No exits recorded'
          }))));
  }

  function Resignations() {
    var decideSt = React.useState(null);
    var recordSt = React.useState(false);
    var statusSt = React.useState('');
    var decideForm = ui.useForm({});
    var recordForm = ui.useForm({ lastWorkingDay: dayOffset(60) });

    var cases = offboardingCases().slice().sort(function (a, b) { return a.resignedOn < b.resignedOn ? 1 : -1; });
    var rows = statusSt[0] ? cases.filter(function (c) { return c.status === statusSt[0]; }) : cases;

    function decide() {
      var d = decideSt[0];
      var res = decideForm.submit(function (v) {
        if (d.decision === 'Rejected' && (!v.comment || String(v.comment).trim().length < 3)) {
          return { ok: false, errors: { comment: 'Give a reason for the rejection' } };
        }
        return ui.report(act.decideResignation(d.id, d.decision, v.comment));
      });
      if (res && res.ok) { decideSt[1](null); decideForm.reset({}); }
    }

    function record() {
      var res = recordForm.submit(function (v) {
        if (!v.employee) return { ok: false, errors: { employee: 'Choose an employee' } };
        return ui.report(act.submitResignation(v.employee, v));
      });
      if (res && res.ok) { recordSt[1](false); recordForm.reset({ lastWorkingDay: dayOffset(60) }); }
    }

    var columns = [
      { key: 'employee', header: 'Employee', sortable: true,
        sortValue: function (c) { return empName(c.employee); },
        csv: function (c) { return empName(c.employee); },
        cell: function (c) { return person(c.employee); } },
      { key: 'department', header: 'Department', csv: function (c) { var e = emp(c.employee); return e ? deptName(e.department) : ''; },
        cell: function (c) { var e = emp(c.employee); return e ? deptName(e.department) : '—'; } },
      { key: 'resignedOn', header: 'Submitted', sortable: true, cell: function (c) { return ui.dateLabel(c.resignedOn); } },
      { key: 'lastWorkingDay', header: 'Last working day', sortable: true,
        cell: function (c) { return c.lastWorkingDayLabel; } },
      { key: 'notice', header: 'Notice', csv: function (c) { return rules.noticeShortfall(c.lastWorkingDay, c.noticeDays) || 'Full notice'; },
        cell: function (c) {
          var short = rules.noticeShortfall(c.lastWorkingDay, c.noticeDays);
          return short
            ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning', dot: true }, short)
            : h('span', { className: 'muted' }, c.noticeDays + ' days served');
        } },
      { key: 'reason', header: 'Reason' },
      { key: 'status', header: 'Status', cell: function (c) { return h(ui.StatusChip, { status: c.status }); } },
      { key: 'actions', header: '', align: 'right',
        cell: function (c) {
          if (c.status !== 'Pending Approval') {
            return h('span', { className: 'muted', style: { fontSize: 12 } }, c.stage);
          }
          return h('span', { className: 'row gap-2', style: { justifyContent: 'flex-end' } },
            h(V.Button, { variant: 'outline', className: 'vi-btn--sm',
              onClick: function () { decideForm.reset({}); decideSt[1]({ id: c.id, decision: 'Rejected', case: c }); } }, 'Reject'),
            h(V.Button, { variant: 'primary', className: 'vi-btn--sm',
              onClick: function () { decideForm.reset({}); decideSt[1]({ id: c.id, decision: 'Approved', case: c }); } }, 'Approve'));
        } }
    ];

    return h(React.Fragment, null,
      h(Card, {
        title: 'Resignations',
        description: 'PRD 4.49: submitted resignations awaiting a decision. Approving one begins the notice period and moves the employee to Notice Period (PRD 5.1).',
        aside: h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus,
          onClick: function () { recordSt[1](true); } }, 'Record resignation')
      },
        h(ui.DataTable, {
          exportName: 'resignations', label: 'Resignations', rows: rows, pageSize: 10,
          search: function (c) { return empName(c.employee) + ' ' + c.id + ' ' + c.reason + ' ' + c.status; },
          searchPlaceholder: 'Search by name, case or reason',
          filters: h(ui.Filter, {
            label: 'Status', value: statusSt[0], onChange: statusSt[1],
            options: ['Pending Approval', 'In Progress', 'Completed', 'Rejected']
          }),
          columns: columns,
          emptyIcon: I.logout, emptyTitle: 'No resignations on file',
          emptyBody: 'Resignations submitted from the employee workspace arrive here, and HR can record one received offline.',
          emptyActions: h(V.Button, { variant: 'primary', iconStart: I.plus, onClick: function () { recordSt[1](true); } }, 'Record resignation')
        })),

      decideSt[0] ? h(ui.Modal, {
        title: (decideSt[0].decision === 'Approved' ? 'Approve' : 'Reject') + ' resignation',
        description: empName(decideSt[0].case.employee) + ' · last working day ' + decideSt[0].case.lastWorkingDayLabel,
        onClose: function () { decideSt[1](null); },
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { decideSt[1](null); } }, 'Cancel'),
          h(V.Button, {
            variant: 'primary', className: decideSt[0].decision === 'Rejected' ? 'vi-btn--danger' : '', onClick: decide
          }, decideSt[0].decision === 'Approved' ? 'Approve and begin notice' : 'Reject resignation'))
      },
        h(ui.KeyValue, { rows: [
          ['Employee', empName(decideSt[0].case.employee)],
          ['Submitted', ui.dateLabel(decideSt[0].case.resignedOn)],
          ['Last working day', decideSt[0].case.lastWorkingDayLabel],
          ['Notice', rules.noticeShortfall(decideSt[0].case.lastWorkingDay, decideSt[0].case.noticeDays) || 'Full notice period served'],
          ['Reason', decideSt[0].case.reason],
          ['Assets held', store.collection('assets').filter(function (a) { return a.assignedTo === decideSt[0].case.employee; }).length]
        ]}),
        h('p', { className: 'muted', style: { fontSize: 13, lineHeight: 1.6 } },
          decideSt[0].decision === 'Approved'
            ? 'Approval moves the employee to Notice Period and opens the clearance checklist (PRD 5.1).'
            : 'Rejecting closes the case and leaves the employee record untouched.'),
        h(V.TextArea, Object.assign({
          label: decideSt[0].decision === 'Rejected' ? 'Reason for rejection' : 'Comment (optional)',
          rows: 3, required: decideSt[0].decision === 'Rejected'
        }, decideForm.field('comment')))) : null,

      recordSt[0] ? h(ui.Modal, {
        title: 'Record a resignation',
        description: 'For a resignation received outside the system. Validated against PRD 14.8 before anything is written.',
        onClose: function () { recordSt[1](false); },
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { recordSt[1](false); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: record }, 'Record resignation'))
      },
        h(ui.EmployeePicker, {
          label: 'Employee', value: recordForm.values.employee,
          status: recordForm.errors.employee ? 'error' : undefined,
          hint: recordForm.errors.employee || 'Someone without a case already in progress',
          onChange: function (v) { recordForm.set('employee', v); }
        }),
        h(ui.FieldRow, null,
          h(V.DateField, Object.assign({ label: 'Proposed last working day', required: true },
            recordForm.field('lastWorkingDay', { hint: 'The notice period is 60 days; a shortfall is recorded, not refused.' }))),
          h(V.Select, Object.assign({ label: 'Reason', required: true, placeholder: 'Choose', options: seed.exitReasons },
            recordForm.select('reason')))),
        h(V.TextArea, Object.assign({ label: 'Comments', rows: 3, placeholder: 'Anything HR should know' }, recordForm.field('comments'))),
        recordForm.errors._ ? h('p', { style: { color: 'var(--danger-fg)', fontSize: 13 } }, recordForm.errors._) : null) : null);
  }

  function NoticePeriod() {
    var cases = liveExits().filter(function (c) { return c.stage === 'Notice Period'; })
      .slice().sort(function (a, b) { return a.lastWorkingDay < b.lastWorkingDay ? -1 : 1; });

    return h(React.Fragment, null,
      h(Stats, null,
        h(Stat, { key: 1, label: 'Serving notice', value: cases.length, sub: 'With an approved last working day' }),
        h(Stat, { key: 2, label: 'Leaving this month', value: cases.filter(function (c) { return c.lastWorkingDay.slice(0, 7) === today().slice(0, 7); }).length,
          sub: 'Before the end of ' + seed.todayLabel.slice(-8) }),
        h(Stat, { key: 3, label: 'Assets outstanding', value: cases.reduce(function (n, c) {
          return n + store.collection('assets').filter(function (a) { return a.assignedTo === c.employee; }).length;
        }, 0), sub: 'Must be returned before clearance (PRD 14.8)', tone: 'warn' }),
        h(Stat, { key: 4, label: 'Average clearance', value: cases.length
          ? Math.round(cases.reduce(function (n, c) { return n + c.clearance; }, 0) / cases.length) : 0, unit: '%', sub: 'Across everyone serving notice' })),

      h(Card, {
        title: 'Notice period tracker',
        description: 'PRD 4.50: who is leaving, when, and what is still outstanding on each case.'
      },
        h(ui.DataTable, {
          exportName: 'notice-period', label: 'Notice period tracker', rows: cases, pageSize: 10,
          search: function (c) { return empName(c.employee) + ' ' + c.id + ' ' + c.reason; },
          searchPlaceholder: 'Search by name or case',
          columns: [
            { key: 'employee', header: 'Employee', sortable: true,
              sortValue: function (c) { return empName(c.employee); },
              csv: function (c) { return empName(c.employee); },
              cell: function (c) { return person(c.employee); } },
            { key: 'department', header: 'Department', csv: function (c) { var e = emp(c.employee); return e ? deptName(e.department) : ''; },
              cell: function (c) { var e = emp(c.employee); return e ? deptName(e.department) : '—'; } },
            { key: 'resignedOn', header: 'Resigned', cell: function (c) { return ui.dateLabel(c.resignedOn); } },
            { key: 'lastWorkingDay', header: 'Last working day', sortable: true, cell: function (c) { return c.lastWorkingDayLabel; } },
            { key: 'remaining', header: 'Days left', numeric: true, align: 'right', sortable: true,
              sortValue: function (c) { return daysAway(c.lastWorkingDay); },
              csv: function (c) { return daysAway(c.lastWorkingDay); },
              cell: function (c) {
                var d = daysAway(c.lastWorkingDay);
                if (d == null) return h('span', { className: 'muted' }, '—');
                return d < 0 ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'error' }, 'Passed')
                  : h('span', { className: 'mono' }, d);
              } },
            { key: 'clearance', header: 'Clearance', sortable: true,
              csv: function (c) { return c.clearance + '%'; },
              cell: function (c) { return h('span', { style: { display: 'block', minWidth: 90 } },
                h(V.ProgressBar, { value: c.clearance, size: 'sm', showValue: true, 'aria-label': 'Clearance' })); } },
            { key: 'outstanding', header: 'Outstanding',
              csv: function (c) { return rules.outstandingClearance(c.employee).join('; '); },
              cell: function (c) {
                var out = rules.outstandingClearance(c.employee);
                return out.length
                  ? h('span', { className: 'row gap-2 wrap' }, out.map(function (x, i) {
                      return h(V.Chip, { key: i, size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning' }, x);
                    }))
                  : h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'success', dot: true }, 'Nothing outstanding');
              } },
            { key: 'actions', header: '', align: 'right',
              cell: function () {
                return h(V.Button, { variant: 'ghost', className: 'vi-btn--sm',
                  onClick: function () { router.goAs('hr/offboarding/clearance'); } }, 'Clearance');
              } }
          ],
          emptyIcon: I.clock, emptyTitle: 'Nobody is serving notice',
          emptyBody: 'Approved resignations appear here with their last working day and clearance progress.'
        })));
  }

  /* The clearance checklist drawer (PRD 4.50, rule 14.8). */
  function ClearanceDrawer(p) {
    var c = store.find('offboarding', p.id);
    if (!c) return null;
    var e = emp(c.employee);
    var held = store.collection('assets').filter(function (a) { return a.assignedTo === c.employee; });
    var outstanding = rules.outstandingClearance(c.employee);

    /* PRD 14.8: "Asset return" is refused while the employee still holds anything, so
       the refusal is surfaced as a toast rather than hidden behind a disabled control. */
    function toggle(name, want) { ui.report(act.completeOffboardingTask(c.id, name, want)); }

    return h(ui.Drawer, {
      eyebrow: c.id + ' · ' + c.reason,
      title: e ? e.name : c.employee,
      description: 'Last working day ' + c.lastWorkingDayLabel,
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Close'),
        h(V.Button, { variant: 'primary', iconStart: I.package,
          onClick: function () { p.onClose(); router.goAs('hr/assets/returns'); } }, 'Record asset returns'))
    },
      h('div', { className: 'row gap-3 wrap' },
        h(ui.StatusChip, { status: c.status, size: 'md' }),
        h(V.Chip, { size: 'sm', shape: 'tag', icon: I.checklist }, c.tasksDone + ' of ' + c.tasksTotal + ' cleared'),
        h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: c.settlement === 'Paid' ? 'success' : 'warning', dot: true },
          'Settlement ' + c.settlement.toLowerCase())),
      h(V.ProgressBar, { label: 'Clearance', value: c.clearance, showValue: true }),
      h(Blockers, {
        title: 'Outstanding before settlement', items: outstanding,
        actions: held.length
          ? h(V.Button, { variant: 'outline', className: 'vi-btn--sm',
              onClick: function () { p.onClose(); router.goAs('hr/assets/returns'); } }, held.length + ' asset(s) to return')
          : null
      }),
      h('div', { className: 'stack gap-2' },
        h('span', { className: 'eyebrow' }, 'Clearance checklist'),
        h(TaskChecklist, {
          tasks: c.tasks || [], onToggle: toggle,
          meta: function (t) {
            return (t.owner ? empName(t.owner) : 'Unassigned')
              + (t.done && t.completedOn ? ' · completed ' + ui.dateLabel(t.completedOn) : t.done ? ' · completed' : '');
          }
        })),
      held.length
        ? h('div', { className: 'stack gap-2' },
            h('span', { className: 'eyebrow' }, 'Assets still assigned'),
            h('div', { className: 'list' }, held.map(function (a) {
              return h('div', { className: 'list__row', key: a.id },
                h('div', { className: 'list__main' },
                  h('span', { className: 'list__title' }, a.name),
                  h('span', { className: 'list__meta' }, a.category + ' · ' + a.serial + ' · since ' + ui.dateLabel(a.assignedOn))),
                h(ui.StatusChip, { status: a.status }));
            })))
        : null);
  }

  function Clearance() {
    var openSt = React.useState(null);
    var cases = liveExits().slice().sort(function (a, b) { return a.lastWorkingDay < b.lastWorkingDay ? -1 : 1; });

    return h(React.Fragment, null,
      h(Card, {
        title: 'Exit clearance',
        description: 'PRD 4.50: knowledge transfer, access revocation and asset return per case. "Asset return" cannot be ticked while the employee still holds an asset (PRD 14.8).'
      },
        h(ui.DataTable, {
          exportName: 'exit-clearance', label: 'Exit clearance', rows: cases, pageSize: 10,
          search: function (c) { return empName(c.employee) + ' ' + c.id; },
          searchPlaceholder: 'Search by name or case',
          columns: [
            { key: 'employee', header: 'Employee', sortable: true,
              sortValue: function (c) { return empName(c.employee); },
              csv: function (c) { return empName(c.employee); },
              cell: function (c) {
                var e = emp(c.employee);
                return e ? h(ui.Person, { employee: e, sub: e.id, onClick: function () { openSt[1](c.id); } })
                  : h('span', { className: 'muted' }, c.employee);
              } },
            { key: 'lastWorkingDay', header: 'Last working day', sortable: true, cell: function (c) { return c.lastWorkingDayLabel; } },
            { key: 'clearance', header: 'Clearance', sortable: true,
              csv: function (c) { return c.clearance + '%'; },
              cell: function (c) { return h('span', { style: { display: 'block', minWidth: 90 } },
                h(V.ProgressBar, { value: c.clearance, size: 'sm', showValue: true, 'aria-label': 'Clearance' })); } },
            { key: 'open', header: 'Tasks open', numeric: true, align: 'right',
              csv: function (c) { return c.tasksTotal - c.tasksDone; },
              cell: function (c) { return c.tasksTotal - c.tasksDone; } },
            { key: 'assets', header: 'Assets held', numeric: true, align: 'right',
              csv: function (c) { return store.collection('assets').filter(function (a) { return a.assignedTo === c.employee; }).length; },
              cell: function (c) {
                var n = store.collection('assets').filter(function (a) { return a.assignedTo === c.employee; }).length;
                return n ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning' }, n) : h('span', { className: 'muted' }, 'None');
              } },
            { key: 'settlement', header: 'Settlement', cell: function (c) { return h(ui.StatusChip, { status: c.settlement === 'Paid' ? 'Paid' : 'Pending' }); } },
            { key: 'actions', header: '', align: 'right',
              cell: function (c) {
                return h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', onClick: function () { openSt[1](c.id); } }, 'Checklist');
              } }
          ],
          emptyIcon: I.checklist, emptyTitle: 'No clearance in progress',
          emptyBody: 'A clearance checklist opens when a resignation is approved.'
        })),
      openSt[0] ? h(ClearanceDrawer, { id: openSt[0], onClose: function () { openSt[1](null); } }) : null);
  }

  function Settlement() {
    var payState = React.useState(null);
    var closeState = React.useState(null);
    var form = ui.useForm({});

    var cases = offboardingCases().slice().sort(function (a, b) { return a.lastWorkingDay < b.lastWorkingDay ? -1 : 1; });

    function pay() {
      var c = payState[0];
      var res = form.submit(function (v) {
        if (!v.amount && v.amount !== 0) return { ok: false, errors: { amount: 'Enter the settlement amount' } };
        if (Number(v.amount) < 0) return { ok: false, errors: { amount: 'The amount cannot be negative' } };
        return ui.report(act.recordSettlement(c.id, Number(v.amount)));
      });
      if (res && res.ok) { payState[1](null); form.reset({}); }
    }

    return h(React.Fragment, null,
      h(Stats, null,
        h(Stat, { key: 1, label: 'Settlements pending', value: cases.filter(function (c) { return c.stage !== 'Completed' && c.settlement !== 'Paid'; }).length,
          sub: 'Blocked until clearance is complete', tone: 'warn' }),
        h(Stat, { key: 2, label: 'Settlements paid', value: cases.filter(function (c) { return c.settlement === 'Paid'; }).length, sub: 'Recorded', tone: 'good' }),
        h(Stat, { key: 3, label: 'Ready to close', value: cases.filter(function (c) {
          return c.stage !== 'Completed' && c.settlement === 'Paid' && c.tasksDone >= c.tasksTotal;
        }).length, sub: 'Clearance done and settlement recorded' }),
        h(Stat, { key: 4, label: 'Settled this year', value: ui.inr(cases.reduce(function (n, c) { return n + (c.settlementAmount || 0); }, 0), { short: true }),
          sub: 'Amounts recorded in this prototype' })),

      h(Card, {
        title: 'Final settlement',
        description: 'PRD 4.50: record the settlement, then close the exit. A settlement is refused while clearance is outstanding (PRD 14.8), and the exit cannot be closed until the settlement is recorded.'
      },
        h(ui.DataTable, {
          exportName: 'final-settlement', label: 'Final settlement', rows: cases, pageSize: 10,
          search: function (c) { return empName(c.employee) + ' ' + c.id; },
          searchPlaceholder: 'Search by name or case',
          columns: [
            { key: 'employee', header: 'Employee', sortable: true,
              sortValue: function (c) { return empName(c.employee); },
              csv: function (c) { return empName(c.employee); },
              cell: function (c) { return person(c.employee); } },
            { key: 'lastWorkingDay', header: 'Last working day', sortable: true, cell: function (c) { return c.lastWorkingDayLabel; } },
            { key: 'clearance', header: 'Clearance', numeric: true, align: 'right', sortable: true,
              csv: function (c) { return c.clearance + '%'; },
              cell: function (c) { return c.clearance + '%'; } },
            { key: 'outstanding', header: 'Blockers',
              csv: function (c) { return rules.outstandingClearance(c.employee).join('; '); },
              cell: function (c) {
                if (c.stage === 'Completed') return h('span', { className: 'muted' }, 'Closed');
                var out = rules.outstandingClearance(c.employee);
                return out.length
                  ? h('span', { className: 'row gap-2 wrap' }, out.map(function (x, i) {
                      return h(V.Chip, { key: i, size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning' }, x);
                    }))
                  : h('span', { className: 'muted' }, 'None');
              } },
            { key: 'settlementAmount', header: 'Amount', numeric: true, align: 'right', sortable: true,
              csv: function (c) { return c.settlementAmount || ''; },
              cell: function (c) { return c.settlementAmount ? ui.inr(c.settlementAmount) : h('span', { className: 'muted' }, 'Not recorded'); } },
            { key: 'settlement', header: 'Settlement', cell: function (c) { return h(ui.StatusChip, { status: c.settlement === 'Paid' ? 'Paid' : 'Pending' }); } },
            { key: 'actions', header: '', align: 'right',
              cell: function (c) {
                if (c.stage === 'Completed') return h(ui.StatusChip, { status: 'Completed' });
                if (c.settlement !== 'Paid') {
                  return h(V.Button, { variant: 'primary', className: 'vi-btn--sm',
                    onClick: function () { form.reset({ amount: settlementSuggestion(c.employee) }); payState[1](c); } }, 'Record settlement');
                }
                return h(V.Button, { variant: 'outline', className: 'vi-btn--sm',
                  onClick: function () { closeState[1](c); } }, 'Close exit');
              } }
          ],
          emptyIcon: I.card, emptyTitle: 'No settlements to record',
          emptyBody: 'Settlements appear here once a resignation has been approved.'
        })),

      payState[0] ? h(ui.Modal, {
        title: 'Record final settlement',
        description: empName(payState[0].employee) + ' · ' + payState[0].id,
        onClose: function () { payState[1](null); },
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { payState[1](null); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: pay }, 'Record settlement'))
      },
        h(Blockers, { title: 'Clearance incomplete', items: rules.outstandingClearance(payState[0].employee) }),
        h(ui.KeyValue, { rows: [
          ['Employee', empName(payState[0].employee)],
          ['Last working day', payState[0].lastWorkingDayLabel],
          ['Clearance', payState[0].clearance + '%'],
          ['Suggested amount', ui.inr(settlementSuggestion(payState[0].employee)) + ' (one month gross)']
        ]}),
        h(V.NumberField, Object.assign({ label: 'Settlement amount (₹)', min: 0, step: 1000, required: true },
          form.field('amount', { number: true, hint: 'Salary to the last working day, leave encashment and recoveries, net of deductions.' }))),
        form.errors._ ? h('p', { style: { color: 'var(--danger-fg)', fontSize: 13 } }, form.errors._) : null) : null,

      closeState[0] ? h(ui.Confirm, {
        title: 'Close the exit for ' + empName(closeState[0].employee) + '?',
        body: 'The employee moves to Exited, their user account is deactivated and the record is archived (PRD 5.1, 14.1). This cannot be undone.',
        confirmLabel: 'Close exit', tone: 'danger',
        onClose: function () { closeState[1](null); },
        onConfirm: function () { ui.report(act.completeOffboarding(closeState[0].id)); }
      }) : null);
  }

  /* ============================================ Documents & policies (PRD 4.24–4.27) */
  /* Who a policy applies to. The audience is either everyone or a comma-separated
     department list, and invited employees are excluded until they join (PRD 4.26). */
  function policyAudience(policy) {
    var pool = store.collection('employees').filter(function (e) {
      return e.status !== 'Exited' && e.status !== 'Invited';
    });
    if (!policy.audience || policy.audience === 'All employees') return pool;
    var names = String(policy.audience).split(',').map(function (x) { return x.trim(); });
    return pool.filter(function (e) {
      var d = store.department(e.department);
      return d && names.indexOf(d.name) >= 0;
    });
  }
  function coverage(policy) {
    var audience = policyAudience(policy);
    var signed = {};
    store.collection('acknowledgements').forEach(function (a) {
      if (a.policy === policy.id) signed[a.employee] = a.on;
    });
    var done = audience.filter(function (e) { return signed[e.id]; }).length;
    return { audience: audience, signed: signed, done: done, total: audience.length, pct: ui.pct(done, audience.length) };
  }
  var POLICY_CATEGORIES = ['Handbook', 'HR Policy', 'Compliance', 'IT', 'Finance', 'Health & Safety'];

  /* The publish dialog of PRD 4.25. */
  function PublishPolicyModal(p) {
    var form = ui.useForm({ version: 'v1.0', audience: 'All employees', ack: true });

    function save() {
      var res = form.submit(function (v) {
        return ui.report(act.publishPolicy({
          name: v.name, version: v.version, category: v.category,
          audience: v.audience, ack: !!v.ack, due: v.ack ? v.due : null, body: v.body
        }));
      });
      if (res && res.ok) p.onClose();
    }

    return h(ui.Modal, {
      title: 'Publish a policy', wide: true,
      description: 'PRD 4.25: publishing makes the policy visible to its audience and, where acknowledgement is required, raises an acknowledgement task (PRD 5.1).',
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
        h(V.Button, { variant: 'primary', onClick: save }, 'Publish policy'))
    },
      h(ui.FieldRow, null,
        h(V.TextField, Object.assign({ label: 'Policy name', required: true, placeholder: 'e.g. Expense Reimbursement Policy' }, form.field('name'))),
        h(V.TextField, Object.assign({ label: 'Version', required: true, placeholder: 'v1.0' }, form.field('version')))),
      h(ui.FieldRow, null,
        h(V.Select, Object.assign({ label: 'Category', required: true, placeholder: 'Choose', options: POLICY_CATEGORIES }, form.select('category'))),
        h(V.Select, Object.assign({ label: 'Audience',
          options: ['All employees'].concat(store.collection('departments').map(function (d) { return d.name; }))
        }, form.select('audience', { hint: 'A department name limits the policy to that department.' })))),
      h(ui.FormSection, { title: 'Acknowledgement', description: 'PRD 4.26: who must confirm they have read it, and by when.' },
        h('div', { className: 'checks' },
          h('div', { className: 'checks__row' },
            h(V.Switch, Object.assign({ 'aria-label': 'Acknowledgement required' }, form.check('ack'))),
            h('div', { className: 'checks__main' },
              h('span', { className: 'checks__name' }, 'Acknowledgement required'),
              h('span', { className: 'checks__meta' }, 'Each person in the audience gets a task until they sign')))),
        form.values.ack
          ? h(V.DateField, Object.assign({ label: 'Acknowledgement due by' },
              form.field('due', { hint: 'Shown on the acknowledgement tracker' })))
          : null),
      h(V.TextArea, Object.assign({ label: 'Summary', rows: 3, placeholder: 'What changed in this version' }, form.field('body'))));
  }

  function CompanyDocuments() {
    var policies = store.collection('policies');
    var catSt = React.useState('');
    var rows = catSt[0] ? policies.filter(function (x) { return x.category === catSt[0]; }) : policies;

    return h(React.Fragment, null,
      h(Stats, null,
        h(Stat, { key: 1, label: 'Company documents', value: policies.length, sub: 'Published to employees' }),
        h(Stat, { key: 2, label: 'Needing acknowledgement', value: policies.filter(function (x) { return x.ack; }).length, sub: 'Tracked per person' }),
        h(Stat, { key: 3, label: 'Published this quarter', value: policies.filter(function (x) { return x.published >= dayOffset(-90); }).length,
          sub: 'Since ' + ui.dateLabel(dayOffset(-90)) }),
        h(Stat, { key: 4, label: 'Categories', value: Object.keys(policies.reduce(function (m, x) { m[x.category] = 1; return m; }, {})).length,
          sub: 'Handbook, compliance, IT and more' })),

      h(Card, {
        title: 'Company documents',
        description: 'PRD 4.24: the handbook, code of conduct and every other organization-wide document, newest version first.'
      },
        h(ui.DataTable, {
          exportName: 'company-documents', label: 'Company documents', rows: rows, pageSize: 10,
          search: function (x) { return x.name + ' ' + x.category + ' ' + x.version; },
          searchPlaceholder: 'Search documents',
          filters: h(ui.Filter, { label: 'Category', value: catSt[0], onChange: catSt[1],
            options: Object.keys(policies.reduce(function (m, x) { m[x.category] = 1; return m; }, {})) }),
          columns: [
            { key: 'name', header: 'Document', sortable: true,
              cell: function (x) { return h('span', { className: 'row gap-2' }, x.name, h(V.Chip, { size: 'sm', shape: 'tag' }, x.version)); } },
            { key: 'category', header: 'Category', sortable: true },
            { key: 'audience', header: 'Audience' },
            { key: 'published', header: 'Published', sortable: true, cell: function (x) { return ui.dateLabel(x.published); } },
            { key: 'ack', header: 'Acknowledgement', csv: function (x) { return x.ack ? 'Required' : 'Not required'; },
              cell: function (x) {
                return x.ack
                  ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info', dot: true }, 'Required')
                  : h('span', { className: 'muted' }, 'Not required');
              } },
            { key: 'actions', header: '', align: 'right',
              cell: function (x) {
                return h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', iconStart: I.download,
                  onClick: function () { ui.toast(x.name + ' ' + x.version + ' download started', 'success'); } }, 'Download');
              } }
          ],
          emptyIcon: I.folder, emptyTitle: 'No company documents',
          emptyBody: 'Documents published from the policy library appear here.'
        })));
  }

  function EmployeeDocuments() {
    var decideSt = React.useState(null);
    var catSt = React.useState(''), statusSt = React.useState(''), deptSt = React.useState('');

    var all = store.collection('employeeDocuments');
    var rows = all;
    if (catSt[0]) rows = rows.filter(function (d) { return d.category === catSt[0]; });
    if (statusSt[0]) rows = rows.filter(function (d) { return d.status === statusSt[0]; });
    if (deptSt[0]) rows = rows.filter(function (d) { var e = emp(d.employee); return e && e.department === deptSt[0]; });

    /* PRD 4.24: the required set per person, so a gap is visible rather than implied. */
    var holders = {};
    all.forEach(function (d) { holders[d.employee] = holders[d.employee] || {}; holders[d.employee][d.category] = d.status; });
    var REQUIRED = ['Identity Proof', 'Address Proof', 'Education Certificate', 'Employment Agreement'];
    var withGaps = store.collection('employees').filter(function (e) {
      if (e.status === 'Exited' || e.status === 'Invited') return false;
      var mine = holders[e.id] || {};
      return REQUIRED.some(function (cat) { return !mine[cat]; });
    }).length;

    return h(React.Fragment, null,
      h(Stats, null,
        h(Stat, { key: 1, label: 'Documents on file', value: all.length.toLocaleString(), sub: 'Across every employee' }),
        h(Stat, { key: 2, label: 'Verified', value: all.filter(function (d) { return d.status === 'Verified'; }).length.toLocaleString(),
          sub: ui.pct(all.filter(function (d) { return d.status === 'Verified'; }).length, all.length) + '% of the library', tone: 'good' }),
        h(Stat, { key: 3, label: 'Pending verification', value: all.filter(function (d) { return d.status === 'Pending Verification'; }).length,
          sub: 'Awaiting HR review', tone: 'warn' }),
        h(Stat, { key: 4, label: 'Employees with a gap', value: withGaps,
          sub: 'Missing one of the four required documents', tone: withGaps ? 'warn' : 'good' })),

      h(Card, {
        title: 'Employee documents',
        description: 'PRD 4.24: identity, address, education and employment documents per person. Filter by category and verification status; the table pages through the whole library.'
      },
        h(ui.DataTable, {
          exportName: 'employee-documents', label: 'Employee documents', rows: rows, pageSize: 25, density: 'compact',
          search: function (d) { return empName(d.employee) + ' ' + d.employee + ' ' + d.category + ' ' + d.name; },
          searchPlaceholder: 'Search by employee, ID, category or file',
          filters: h(React.Fragment, null,
            h(ui.Filter, { label: 'Category', value: catSt[0], onChange: catSt[1], options: seed.documentCategories }),
            h(ui.Filter, { label: 'Status', value: statusSt[0], onChange: statusSt[1],
              options: ['Verified', 'Pending Verification', 'Rejected'] }),
            h(ui.Filter, { label: 'Department', value: deptSt[0], onChange: deptSt[1], options: deptOptions() })),
          columns: verifyColumns(decideSt[1]),
          emptyIcon: I.file, emptyTitle: 'No documents match those filters',
          emptyBody: 'Clear a filter, or ask the employee to upload the document from their workspace.'
        })),

      decideSt[0] ? h(VerifyModal, {
        doc: decideSt[0].doc, decision: decideSt[0].decision,
        onClose: function () { decideSt[1](null); }
      }) : null);
  }

  function PolicyLibrary() {
    var publishSt = React.useState(false);
    var catSt = React.useState('');
    var policies = store.collection('policies').slice().sort(function (a, b) { return a.published < b.published ? 1 : -1; });
    var rows = catSt[0] ? policies.filter(function (x) { return x.category === catSt[0]; }) : policies;

    return h(React.Fragment, null,
      h(Card, {
        title: 'Policy library',
        description: 'PRD 4.25: published policies with version, audience and acknowledgement coverage.',
        aside: h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus,
          onClick: function () { publishSt[1](true); } }, 'Publish policy')
      },
        h(ui.DataTable, {
          exportName: 'policies', label: 'Policy library', rows: rows, pageSize: 10,
          search: function (x) { return x.name + ' ' + x.category + ' ' + x.version + ' ' + x.audience; },
          searchPlaceholder: 'Search by name, category or audience',
          filters: h(ui.Filter, { label: 'Category', value: catSt[0], onChange: catSt[1],
            options: Object.keys(policies.reduce(function (m, x) { m[x.category] = 1; return m; }, {})) }),
          columns: [
            { key: 'name', header: 'Policy', sortable: true },
            { key: 'version', header: 'Version', cell: function (x) { return h('span', { className: 'mono' }, x.version); } },
            { key: 'category', header: 'Category', sortable: true },
            { key: 'audience', header: 'Audience' },
            { key: 'published', header: 'Published', sortable: true, cell: function (x) { return ui.dateLabel(x.published); } },
            { key: 'due', header: 'Ack due', csv: function (x) { return x.due || ''; },
              cell: function (x) {
                if (!x.ack) return h('span', { className: 'muted' }, 'No ack needed');
                if (!x.due) return h('span', { className: 'muted' }, 'No deadline');
                var d = daysAway(x.due);
                return h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: d != null && d < 0 ? 'error' : 'warning', dot: true },
                  ui.dateLabel(x.due));
              } },
            { key: 'coverage', header: 'Acknowledged', sortable: true,
              sortValue: function (x) { return x.ack ? coverage(x).pct : -1; },
              csv: function (x) { if (!x.ack) return ''; var c = coverage(x); return c.done + ' of ' + c.total; },
              cell: function (x) {
                if (!x.ack) return h('span', { className: 'muted' }, '—');
                var c = coverage(x);
                return h('span', { className: 'stack gap-1', style: { minWidth: 110 } },
                  h(V.ProgressBar, { value: c.pct, size: 'sm', tone: c.pct >= 95 ? 'success' : c.pct >= 70 ? 'primary' : 'warning', 'aria-label': 'Acknowledged' }),
                  h('span', { className: 'list__meta' }, c.done + ' of ' + c.total + ' · ' + c.pct + '%'));
              } },
            { key: 'actions', header: '', align: 'right',
              cell: function (x) {
                return h(V.Button, { variant: 'ghost', className: 'vi-btn--sm',
                  onClick: function () { router.goAs('hr/documents/acknowledgements'); } }, 'Tracker');
              } }
          ],
          emptyIcon: I.shield, emptyTitle: 'No policies published',
          emptyBody: 'Publish the handbook and the code of conduct first; employees see them in their own workspace.',
          emptyActions: h(V.Button, { variant: 'primary', iconStart: I.plus, onClick: function () { publishSt[1](true); } }, 'Publish policy')
        })),
      publishSt[0] ? h(PublishPolicyModal, { onClose: function () { publishSt[1](false); } }) : null);
  }

  function Acknowledgements() {
    var policies = store.collection('policies').filter(function (x) { return x.ack; });
    var pickSt = React.useState(policies.length ? policies[policies.length - 1].id : '');
    var stateSt = React.useState('');

    var policy = policies.filter(function (x) { return x.id === pickSt[0]; })[0] || policies[0];
    if (!policy) {
      return h(Card, { title: 'Acknowledgements', description: 'PRD 4.26: who has acknowledged each policy, and who is outstanding.' },
        h(ui.Empty, {
          icon: I.shield, title: 'No policy needs acknowledgement',
          body: 'Publish a policy with acknowledgement required and the tracker appears here.',
          actions: h(V.Button, { variant: 'primary', onClick: function () { router.goAs('hr/documents/policies'); } }, 'Policy library')
        }));
    }

    var c = coverage(policy);
    var rows = c.audience.map(function (e) {
      return {
        id: e.id, employee: e.id, name: e.name, department: e.department,
        on: c.signed[e.id] || null, state: c.signed[e.id] ? 'Acknowledged' : 'Outstanding'
      };
    });
    if (stateSt[0]) rows = rows.filter(function (r) { return r.state === stateSt[0]; });
    var overdue = policy.due && policy.due < today();

    return h(React.Fragment, null,
      h(Stats, null,
        h(Stat, { key: 1, label: 'Acknowledged', value: c.done, sub: 'of ' + c.total + ' in the audience', tone: 'good' }),
        h(Stat, { key: 2, label: 'Outstanding', value: c.total - c.done,
          sub: overdue ? 'Past the ' + ui.dateLabel(policy.due) + ' deadline' : 'Still to sign',
          tone: c.total - c.done ? 'warn' : 'good' }),
        h(Stat, { key: 3, label: 'Completion', value: c.pct, unit: '%', sub: policy.name + ' ' + policy.version }),
        h(Stat, { key: 4, label: 'Policies tracked', value: policies.length, sub: 'Requiring acknowledgement' })),

      h(Grid, null,
        h(Card, { span: 5, title: 'Completion by policy',
          description: 'PRD 4.26: acknowledgement coverage across every tracked policy.' },
          h(ui.Bars, {
            rows: policies.map(function (x) {
              var k = coverage(x);
              return [x.name, k.pct, k.pct >= 95 ? 'success' : k.pct >= 70 ? null : 'warning'];
            }).sort(function (a, b) { return a[1] - b[1]; }),
            emptyTitle: 'Nothing to chart'
          })),

        h(Card, { span: 7, title: policy.name + ' ' + policy.version,
          description: 'Published ' + ui.dateLabel(policy.published) + ' to ' + policy.audience.toLowerCase()
            + (policy.due ? ', acknowledgement due ' + ui.dateLabel(policy.due) : ''),
          aside: h(V.Select, {
            label: 'Policy', value: policy.id, onChange: function (v) { pickSt[1](v); },
            options: policies.map(function (x) { return { value: x.id, label: x.name + ' ' + x.version }; })
          }) },
          h(V.ProgressBar, {
            label: 'Acknowledged', value: c.pct, showValue: true,
            tone: c.pct >= 95 ? 'success' : c.pct >= 70 ? 'primary' : 'warning',
            hint: c.done + ' of ' + c.total + ' people in the audience have signed'
          }),
          overdue
            ? h(Blockers, { title: 'Deadline passed', items: [(c.total - c.done) + ' people have not acknowledged ' + policy.name
                + ', which was due ' + ui.dateLabel(policy.due) + '.'] })
            : null)),

      h(Card, {
        title: 'Acknowledgement tracker',
        description: 'Everyone in the audience for ' + policy.name + ', signed or not.'
      },
        h(ui.DataTable, {
          exportName: 'acknowledgements-' + policy.id, label: 'Acknowledgement tracker', rows: rows, pageSize: 25, density: 'compact',
          search: function (r) { return r.name + ' ' + r.employee + ' ' + deptName(r.department); },
          searchPlaceholder: 'Search by name or ID',
          filters: h(ui.Filter, { label: 'State', value: stateSt[0], onChange: stateSt[1], options: ['Acknowledged', 'Outstanding'] }),
          columns: [
            { key: 'name', header: 'Employee', sortable: true,
              csv: function (r) { return r.name; },
              cell: function (r) { return person(r.employee); } },
            { key: 'department', header: 'Department', sortable: true,
              csv: function (r) { return deptName(r.department); },
              cell: function (r) { return deptName(r.department); } },
            { key: 'on', header: 'Acknowledged on', sortable: true,
              csv: function (r) { return r.on || ''; },
              cell: function (r) { return r.on ? ui.dateLabel(r.on) : h('span', { className: 'muted' }, 'Not yet'); } },
            { key: 'state', header: 'State',
              cell: function (r) {
                return r.state === 'Acknowledged'
                  ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'success', dot: true }, 'Acknowledged')
                  : h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning', dot: true }, 'Outstanding');
              } },
            { key: 'actions', header: '', align: 'right',
              cell: function (r) {
                if (r.on) return h('span', { className: 'muted', style: { fontSize: 12 } }, ui.relTime(r.on));
                return h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', iconStart: I.mail,
                  onClick: function () { ui.toast('Reminder sent to ' + r.name, 'success'); } }, 'Remind');
              } }
          ],
          emptyIcon: I.ok, emptyTitle: 'Nobody matches that filter',
          emptyBody: 'Everyone in the audience has either signed or is outside this filter.'
        })));
  }

  function ExpiringDocuments() {
    var WINDOW = 180;                                   // PRD 4.27
    var limit = dayOffset(WINDOW);
    var tracked = store.collection('employeeDocuments').filter(function (d) { return d.expiry; });
    var rows = tracked.filter(function (d) { return d.expiry <= limit; })
      .slice().sort(function (a, b) { return a.expiry < b.expiry ? -1 : 1; });
    var soonest = tracked.slice().sort(function (a, b) { return a.expiry < b.expiry ? -1 : 1; }).slice(0, 10);

    function within(days) { var k = dayOffset(days); return tracked.filter(function (d) { return d.expiry >= today() && d.expiry <= k; }).length; }

    var columns = [
      { key: 'employee', header: 'Employee', sortable: true,
        sortValue: function (d) { return empName(d.employee); },
        csv: function (d) { return empName(d.employee); },
        cell: function (d) { return person(d.employee); } },
      { key: 'category', header: 'Category', sortable: true },
      { key: 'name', header: 'File', cell: function (d) { return h('span', { className: 'mono' }, d.name); } },
      { key: 'expiry', header: 'Expires', sortable: true, cell: function (d) { return ui.dateLabel(d.expiry); } },
      { key: 'in', header: 'In', numeric: true, align: 'right', sortable: true,
        sortValue: function (d) { return daysAway(d.expiry); },
        csv: function (d) { return daysAway(d.expiry) + ' days'; },
        cell: function (d) {
          var n = daysAway(d.expiry);
          if (n < 0) return h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'error', dot: true }, 'Expired');
          return h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: n <= 30 ? 'error' : n <= 90 ? 'warning' : 'info' }, n + ' days');
        } },
      { key: 'status', header: 'Verification', cell: function (d) { return h(ui.StatusChip, { status: d.status }); } },
      { key: 'actions', header: '', align: 'right',
        cell: function (d) {
          return h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', iconStart: I.mail,
            onClick: function () { ui.toast('Renewal reminder sent to ' + empName(d.employee), 'success'); } }, 'Remind');
        } }
    ];

    return h(React.Fragment, null,
      h(Stats, null,
        h(Stat, { key: 1, label: 'Expiry tracked', value: tracked.length, sub: 'Documents that carry an expiry date' }),
        h(Stat, { key: 2, label: 'Expiring in 30 days', value: within(30), sub: 'Needs a renewal now', tone: within(30) ? 'warn' : 'good' }),
        h(Stat, { key: 3, label: 'Expiring in 180 days', value: within(WINDOW), sub: 'The reminder window in PRD 4.27' }),
        h(Stat, { key: 4, label: 'Already expired', value: tracked.filter(function (d) { return d.expiry < today(); }).length,
          sub: 'On file but no longer valid', tone: tracked.filter(function (d) { return d.expiry < today(); }).length ? 'warn' : 'good' })),

      h(Card, {
        title: 'Expiring within ' + WINDOW + ' days',
        description: 'PRD 4.27: documents whose expiry falls on or before ' + ui.dateLabel(limit) + ', expired ones first.'
      },
        h(ui.DataTable, {
          exportName: 'expiring-documents', label: 'Expiring documents', rows: rows, pageSize: 10,
          search: function (d) { return empName(d.employee) + ' ' + d.category + ' ' + d.name; },
          searchPlaceholder: 'Search by employee or category',
          columns: columns,
          emptyIcon: I.ok, emptyTitle: 'Nothing expires in the next ' + WINDOW + ' days',
          emptyBody: 'The soonest expiry is '
            + (soonest.length ? ui.dateLabel(soonest[0].expiry) + ', ' + daysAway(soonest[0].expiry) + ' days away.' : 'not set — no document carries an expiry date.')
        })),

      h(Card, { title: 'Next to expire', description: 'The ten soonest expiries on file, whether or not they fall inside the window.' },
        h(ui.DataTable, {
          exportName: 'next-to-expire', label: 'Next to expire', rows: soonest, pageSize: 10, onExport: false,
          columns: columns.slice(0, 5),
          emptyIcon: I.file, emptyTitle: 'No document carries an expiry date'
        })));
  }

  /* ========================================================= Assets (PRD 4.29–4.33) */
  var ASSET_STATUSES = ['Available', 'Assigned', 'Under Maintenance', 'Damaged', 'Lost', 'Retired'];
  var CONDITIONS = ['Excellent', 'Good', 'Fair', 'Needs service', 'Damaged'];
  function assetsHeldBy(employeeId) {
    return store.collection('assets').filter(function (a) { return a.assignedTo === employeeId; });
  }
  function availableIn(category) {
    return store.collection('assets').filter(function (a) { return a.category === category && a.status === 'Available'; }).length;
  }

  /* Allocation (PRD 4.30) goes through rules.canAllocate, so an asset that is already
     out or under maintenance is refused rather than silently reassigned (PRD 14.5). */
  function AllocateModal(p) {
    var form = ui.useForm({});
    function save() {
      var res = form.submit(function (v) {
        if (!v.employee) return { ok: false, errors: { employee: 'Choose who receives it' } };
        return ui.report(act.allocateAsset(p.asset.id, v.employee));
      });
      if (res && res.ok) p.onClose();
    }
    return h(ui.Modal, {
      title: 'Allocate ' + p.asset.name,
      description: p.asset.id + ' · ' + p.asset.category + ' · ' + p.asset.serial,
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
        h(V.Button, { variant: 'primary', onClick: save }, 'Allocate asset'))
    },
      h(ui.KeyValue, { rows: [
        ['Asset', p.asset.name],
        ['Condition', p.asset.condition],
        ['Location', locName(p.asset.location)],
        ['Current status', h(ui.StatusChip, { status: p.asset.status })]
      ]}),
      h(ui.EmployeePicker, {
        label: 'Allocate to', value: form.values.employee,
        status: form.errors.employee ? 'error' : undefined,
        hint: form.errors.employee || 'The holder is asked to acknowledge receipt (PRD 4.30)',
        onChange: function (v) { form.set('employee', v); }
      }),
      form.errors._ ? h('p', { style: { color: 'var(--danger-fg)', fontSize: 13 } }, form.errors._) : null);
  }

  /* Returns (PRD 4.32). The recorded condition decides the asset's next status: a damaged
     unit does not go back into the available pool. */
  function ReturnModal(p) {
    var form = ui.useForm({ condition: p.asset.condition || 'Good' });
    function save() {
      var res = form.submit(function (v) { return ui.report(act.returnAsset(p.asset.id, v.condition)); });
      if (res && res.ok) p.onClose();
    }
    var next = form.values.condition === 'Damaged' ? 'Damaged'
      : form.values.condition === 'Needs service' ? 'Under Maintenance' : 'Available';
    return h(ui.Modal, {
      title: 'Record return of ' + p.asset.name,
      description: p.asset.id + ' · held by ' + empName(p.asset.assignedTo),
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
        h(V.Button, { variant: 'primary', onClick: save }, 'Record return'))
    },
      h(ui.KeyValue, { rows: [
        ['Asset', p.asset.name + ' · ' + p.asset.category],
        ['Serial', h('span', { className: 'mono' }, p.asset.serial)],
        ['Held since', ui.dateLabel(p.asset.assignedOn)],
        ['Condition on issue', p.asset.condition]
      ]}),
      h(V.Select, Object.assign({ label: 'Condition on return', required: true, options: CONDITIONS },
        form.select('condition'))),
      h('p', { className: 'muted', style: { fontSize: 13, lineHeight: 1.6 } },
        'The return is kept in the asset history and the unit becomes ' + next.toLowerCase()
        + '. Once nothing is left with the employee, "Asset return" can be ticked on their clearance checklist (PRD 14.8).'),
      form.errors._ ? h('p', { style: { color: 'var(--danger-fg)', fontSize: 13 } }, form.errors._) : null);
  }

  function AssetsDashboard() {
    var assets = store.collection('assets');
    var requests = store.collection('assetRequests');
    var exits = liveExits();
    var dueBack = exits.reduce(function (n, c) { return n + assetsHeldBy(c.employee).length; }, 0);
    var value = assets.reduce(function (n, a) { return n + (a.value || 0); }, 0);
    var assigned = assets.filter(function (a) { return a.status === 'Assigned'; });

    return h(React.Fragment, null,
      h(Stats, { cols: 3 },
        h(Stat, { key: 1, label: 'Total assets', value: assets.length, sub: 'In the inventory' }),
        h(Stat, { key: 2, label: 'Available', value: assets.filter(function (a) { return a.status === 'Available'; }).length,
          sub: 'Ready to allocate', tone: 'good' }),
        h(Stat, { key: 3, label: 'Assigned', value: assigned.length,
          sub: assigned.filter(function (a) { return a.acknowledged === false; }).length + ' not acknowledged' }),
        h(Stat, { key: 4, label: 'Open requests', value: requests.filter(function (r) { return r.status === 'Pending Approval'; }).length,
          sub: 'Awaiting an availability check', tone: 'warn' }),
        h(Stat, { key: 5, label: 'Pending returns', value: dueBack, sub: 'Held by exiting employees', tone: dueBack ? 'warn' : 'good' }),
        h(Stat, { key: 6, label: 'Total asset value', value: ui.inr(value, { short: true }), sub: 'Purchase value of the inventory' })),

      h(Grid, null,
        h(Card, { span: 5, title: 'Inventory by status', description: 'PRD 4.33.' },
          h(ui.Bars, {
            rows: ASSET_STATUSES.map(function (s) {
              return [s, assets.filter(function (a) { return a.status === s; }).length,
                s === 'Available' ? 'success' : s === 'Damaged' || s === 'Lost' ? 'error' : s === 'Under Maintenance' ? 'warning' : null];
            }).filter(function (r) { return r[1] > 0; }),
            emptyTitle: 'No assets recorded'
          })),

        h(Card, { span: 7, title: 'Inventory by category' },
          h(ui.Bars, { rows: distribution(assets, function (a) { return a.category; }), emptyTitle: 'No assets recorded' })),

        h(Card, { span: 7, title: 'Value by category', description: 'Purchase value, which drives the depreciation schedule.' },
          h(ui.DataTable, {
            exportName: 'asset-value-by-category', label: 'Asset value by category', pageSize: 10, onExport: false,
            rows: seed.assetCategories.map(function (cat) {
              var mine = assets.filter(function (a) { return a.category === cat; });
              return {
                id: cat, category: cat, count: mine.length,
                assigned: mine.filter(function (a) { return a.status === 'Assigned'; }).length,
                available: mine.filter(function (a) { return a.status === 'Available'; }).length,
                value: mine.reduce(function (n, a) { return n + (a.value || 0); }, 0)
              };
            }),
            columns: [
              { key: 'category', header: 'Category', sortable: true },
              { key: 'count', header: 'Units', numeric: true, align: 'right', sortable: true },
              { key: 'assigned', header: 'Assigned', numeric: true, align: 'right' },
              { key: 'available', header: 'Available', numeric: true, align: 'right' },
              { key: 'value', header: 'Value', numeric: true, align: 'right', sortable: true,
                csv: function (r) { return r.value; }, cell: function (r) { return ui.inr(r.value, { short: true }); } }
            ]
          })),

        h(Card, { span: 5, title: 'Needs attention' },
          h(ui.KeyValue, { rows: [
            ['Open requests', requests.filter(function (r) { return r.status === 'Pending Approval'; }).length],
            ['Unacknowledged allocations', assigned.filter(function (a) { return a.acknowledged === false; }).length],
            ['Under maintenance', assets.filter(function (a) { return a.status === 'Under Maintenance'; }).length],
            ['Damaged or lost', assets.filter(function (a) { return a.status === 'Damaged' || a.status === 'Lost'; }).length],
            ['Due back from exits', dueBack],
            ['Warranty expired', assets.filter(function (a) { return a.warranty && a.warranty < today(); }).length]
          ]}),
          h('div', { className: 'row gap-2 wrap' },
            h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.checklist,
              onClick: function () { router.goAs('hr/assets/requests'); } }, 'Requests'),
            h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.package,
              onClick: function () { router.goAs('hr/assets/returns'); } }, 'Returns')))));
  }

  function Inventory() {
    var addSt = React.useState(false);
    var allocSt = React.useState(null);
    var returnSt = React.useState(null);
    var catSt = React.useState(''), statusSt = React.useState(''), locSt = React.useState('');
    var form = ui.useForm({ status: 'Available', condition: 'Excellent', purchased: today(), location: seed.locations[0].id });

    var rows = store.collection('assets');
    if (catSt[0]) rows = rows.filter(function (a) { return a.category === catSt[0]; });
    if (statusSt[0]) rows = rows.filter(function (a) { return a.status === statusSt[0]; });
    if (locSt[0]) rows = rows.filter(function (a) { return a.location === locSt[0]; });

    function save() {
      var res = form.submit(function (v) { return ui.report(act.addAsset(v)); });
      if (res && res.ok) {
        addSt[1](false);
        form.reset({ status: 'Available', condition: 'Excellent', purchased: today(), location: seed.locations[0].id });
      }
    }

    return h(React.Fragment, null,
      h(Card, {
        title: 'Asset inventory',
        description: 'PRD 4.29: every asset with its serial, warranty, condition, location and current holder.',
        aside: h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus,
          onClick: function () { addSt[1](true); } }, 'Add asset')
      },
        h(ui.DataTable, {
          exportName: 'asset-inventory', label: 'Asset inventory', rows: rows, pageSize: 25, density: 'compact',
          search: function (a) { return a.id + ' ' + a.name + ' ' + a.category + ' ' + a.serial + ' ' + empName(a.assignedTo); },
          searchPlaceholder: 'Search by asset, serial or holder',
          filters: h(React.Fragment, null,
            h(ui.Filter, { label: 'Category', value: catSt[0], onChange: catSt[1], options: seed.assetCategories }),
            h(ui.Filter, { label: 'Status', value: statusSt[0], onChange: statusSt[1], options: ASSET_STATUSES }),
            h(ui.Filter, { label: 'Location', value: locSt[0], onChange: locSt[1], options: locOptions() })),
          columns: [
            { key: 'id', header: 'Asset ID', sortable: true, cell: function (a) { return h('span', { className: 'mono' }, a.id); } },
            { key: 'name', header: 'Asset', sortable: true },
            { key: 'category', header: 'Category', sortable: true },
            { key: 'serial', header: 'Serial', cell: function (a) { return h('span', { className: 'mono' }, a.serial); } },
            { key: 'location', header: 'Location', csv: function (a) { return locName(a.location); },
              cell: function (a) { return locName(a.location); } },
            { key: 'value', header: 'Value', numeric: true, align: 'right', sortable: true,
              csv: function (a) { return a.value; }, cell: function (a) { return ui.inr(a.value); } },
            { key: 'warranty', header: 'Warranty', sortable: true, csv: function (a) { return a.warranty || ''; },
              cell: function (a) {
                if (!a.warranty) return h('span', { className: 'muted' }, '—');
                return a.warranty < today()
                  ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'neutral' }, 'Expired')
                  : ui.dateLabel(a.warranty);
              } },
            { key: 'condition', header: 'Condition' },
            { key: 'assignedTo', header: 'Holder', csv: function (a) { return a.assignedTo ? empName(a.assignedTo) : ''; },
              cell: function (a) { return a.assignedTo ? person(a.assignedTo, null) : h('span', { className: 'muted' }, 'In store'); } },
            { key: 'status', header: 'Status', cell: function (a) { return h(ui.StatusChip, { status: a.status }); } },
            { key: 'actions', header: '', align: 'right',
              cell: function (a) {
                if (a.status === 'Available') {
                  return h(V.Button, { variant: 'outline', className: 'vi-btn--sm',
                    onClick: function () { allocSt[1](a); } }, 'Allocate');
                }
                if (a.assignedTo) {
                  return h(V.Button, { variant: 'ghost', className: 'vi-btn--sm',
                    onClick: function () { returnSt[1](a); } }, 'Return');
                }
                return h('span', { className: 'muted', style: { fontSize: 12 } }, 'Out of circulation');
              } }
          ],
          emptyIcon: I.package, emptyTitle: 'No assets match those filters',
          emptyBody: 'Clear a filter, or add the asset so it can be allocated.',
          emptyActions: h(V.Button, { variant: 'primary', iconStart: I.plus, onClick: function () { addSt[1](true); } }, 'Add asset')
        })),

      addSt[0] ? h(ui.Modal, {
        title: 'Add asset', wide: true,
        description: 'PRD 4.29. The serial number must be unique across the inventory (PRD 14.5).',
        onClose: function () { addSt[1](false); },
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { addSt[1](false); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: save }, 'Add asset'))
      },
        h(ui.FieldRow, null,
          h(V.TextField, Object.assign({ label: 'Asset name', required: true, placeholder: 'e.g. Dell Latitude 7450' }, form.field('name'))),
          h(V.Select, Object.assign({ label: 'Category', required: true, placeholder: 'Choose', options: seed.assetCategories }, form.select('category')))),
        h(ui.FieldRow, null,
          h(V.TextField, Object.assign({ label: 'Serial number', required: true, placeholder: 'e.g. SN402318774' }, form.field('serial'))),
          h(V.Select, Object.assign({ label: 'Location', options: locOptions() }, form.select('location')))),
        h(ui.FieldRow, { cols: 3 },
          h(V.DateField, Object.assign({ label: 'Purchased on' }, form.field('purchased'))),
          h(V.NumberField, Object.assign({ label: 'Purchase value (₹)', min: 0, step: 500 }, form.field('value', { number: true }))),
          h(V.DateField, Object.assign({ label: 'Warranty until' }, form.field('warranty')))),
        h(ui.FieldRow, null,
          h(V.Select, Object.assign({ label: 'Condition', options: CONDITIONS }, form.select('condition'))),
          h(V.Select, Object.assign({ label: 'Initial status', options: ['Available', 'Under Maintenance'] },
            form.select('status', { hint: 'A new asset goes into the available pool unless it arrives faulty.' })))),
        form.errors._ ? h('p', { style: { color: 'var(--danger-fg)', fontSize: 13 } }, form.errors._) : null) : null,

      allocSt[0] ? h(AllocateModal, { asset: allocSt[0], onClose: function () { allocSt[1](null); } }) : null,
      returnSt[0] ? h(ReturnModal, { asset: returnSt[0], onClose: function () { returnSt[1](null); } }) : null);
  }

  function Allocations() {
    var returnSt = React.useState(null);
    var catSt = React.useState(''), ackSt = React.useState('');

    var rows = store.collection('assets').filter(function (a) { return a.assignedTo; });
    if (catSt[0]) rows = rows.filter(function (a) { return a.category === catSt[0]; });
    if (ackSt[0]) rows = rows.filter(function (a) { return (a.acknowledged ? 'Acknowledged' : 'Pending') === ackSt[0]; });

    var all = store.collection('assets').filter(function (a) { return a.assignedTo; });

    return h(React.Fragment, null,
      h(Stats, null,
        h(Stat, { key: 1, label: 'Active allocations', value: all.length, sub: 'Assets out with employees' }),
        h(Stat, { key: 2, label: 'Acknowledged', value: all.filter(function (a) { return a.acknowledged; }).length,
          sub: ui.pct(all.filter(function (a) { return a.acknowledged; }).length, all.length) + '% of allocations', tone: 'good' }),
        h(Stat, { key: 3, label: 'Awaiting acknowledgement', value: all.filter(function (a) { return a.acknowledged === false; }).length,
          sub: 'Handover not yet confirmed', tone: 'warn' }),
        h(Stat, { key: 4, label: 'Holders', value: Object.keys(all.reduce(function (m, a) { m[a.assignedTo] = 1; return m; }, {})).length,
          sub: 'Employees holding at least one asset' })),

      h(Card, {
        title: 'Allocations',
        description: 'PRD 4.30: current assignments with the holder, the handover date and whether receipt was acknowledged.'
      },
        h(ui.DataTable, {
          exportName: 'asset-allocations', label: 'Allocations', rows: rows, pageSize: 25, density: 'compact',
          search: function (a) { return empName(a.assignedTo) + ' ' + a.name + ' ' + a.id + ' ' + a.serial; },
          searchPlaceholder: 'Search by holder, asset or serial',
          filters: h(React.Fragment, null,
            h(ui.Filter, { label: 'Category', value: catSt[0], onChange: catSt[1], options: seed.assetCategories }),
            h(ui.Filter, { label: 'Receipt', value: ackSt[0], onChange: ackSt[1], options: ['Acknowledged', 'Pending'] })),
          columns: [
            { key: 'assignedTo', header: 'Holder', sortable: true,
              sortValue: function (a) { return empName(a.assignedTo); },
              csv: function (a) { return empName(a.assignedTo); },
              cell: function (a) { return person(a.assignedTo); } },
            { key: 'name', header: 'Asset', sortable: true,
              cell: function (a) { return h('span', { className: 'stack gap-1' },
                h('span', null, a.name),
                h('span', { className: 'list__meta mono' }, a.id + ' · ' + a.serial)); } },
            { key: 'category', header: 'Category', sortable: true },
            { key: 'assignedOn', header: 'Assigned', sortable: true, cell: function (a) { return ui.dateLabel(a.assignedOn); } },
            { key: 'condition', header: 'Condition on issue' },
            { key: 'acknowledged', header: 'Receipt', align: 'center',
              csv: function (a) { return a.acknowledged ? 'Acknowledged' : 'Pending'; },
              cell: function (a) {
                return a.acknowledged
                  ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'success', dot: true }, 'Acknowledged')
                  : h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning', dot: true }, 'Pending');
              } },
            { key: 'actions', header: '', align: 'right',
              cell: function (a) {
                return h(V.Button, { variant: 'outline', className: 'vi-btn--sm',
                  onClick: function () { returnSt[1](a); } }, 'Record return');
              } }
          ],
          emptyIcon: I.package, emptyTitle: 'No active allocations',
          emptyBody: 'Allocate an asset from the inventory and it appears here with its acknowledgement state.'
        })),

      returnSt[0] ? h(ReturnModal, { asset: returnSt[0], onClose: function () { returnSt[1](null); } }) : null);
  }

  function AssetRequests() {
    var decideSt = React.useState(null);
    var statusSt = React.useState('');
    var form = ui.useForm({});

    var all = store.collection('assetRequests');
    var rows = statusSt[0] ? all.filter(function (r) { return r.status === statusSt[0]; }) : all;

    function decide() {
      var d = decideSt[0];
      var res = form.submit(function (v) {
        if (d.decision === 'Rejected' && (!v.comment || String(v.comment).trim().length < 3)) {
          return { ok: false, errors: { comment: 'Give a reason for the rejection' } };
        }
        return ui.report(act.decideAssetRequest(d.request.id, d.decision, v.comment));
      });
      if (res && res.ok) { decideSt[1](null); form.reset({}); }
    }

    return h(React.Fragment, null,
      h(Stats, null,
        h(Stat, { key: 1, label: 'Pending approval', value: all.filter(function (r) { return r.status === 'Pending Approval'; }).length,
          sub: 'Awaiting an availability check', tone: 'warn' }),
        h(Stat, { key: 2, label: 'Approved', value: all.filter(function (r) { return r.status === 'Approved'; }).length,
          sub: 'Fulfilled from the available pool', tone: 'good' }),
        h(Stat, { key: 3, label: 'Rejected', value: all.filter(function (r) { return r.status === 'Rejected'; }).length, sub: 'With a reason on record' }),
        h(Stat, { key: 4, label: 'Available to fulfil', value: store.collection('assets').filter(function (a) { return a.status === 'Available'; }).length,
          sub: 'Units in the store across all categories' })),

      h(Card, {
        title: 'Asset requests',
        description: 'PRD 4.31: approving a request allocates the first available unit of that category. With nothing available the approval is refused rather than queued (PRD 14.5).'
      },
        h(ui.DataTable, {
          exportName: 'asset-requests', label: 'Asset requests', rows: rows, pageSize: 10,
          search: function (r) { return empName(r.employee) + ' ' + r.id + ' ' + r.category + ' ' + r.reason; },
          searchPlaceholder: 'Search by employee, category or reason',
          filters: h(ui.Filter, { label: 'Status', value: statusSt[0], onChange: statusSt[1],
            options: ['Pending Approval', 'Approved', 'Rejected'] }),
          columns: [
            { key: 'id', header: 'Request', cell: function (r) { return h('span', { className: 'mono' }, r.id); } },
            { key: 'employee', header: 'Employee', sortable: true,
              sortValue: function (r) { return empName(r.employee); },
              csv: function (r) { return empName(r.employee); },
              cell: function (r) { return person(r.employee); } },
            { key: 'category', header: 'Category', sortable: true },
            { key: 'reason', header: 'Reason' },
            { key: 'requestedOn', header: 'Requested', sortable: true, cell: function (r) { return ui.dateLabel(r.requestedOn); } },
            { key: 'stock', header: 'In store', numeric: true, align: 'right',
              csv: function (r) { return availableIn(r.category); },
              cell: function (r) {
                var n = availableIn(r.category);
                return n
                  ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'success' }, n + ' available')
                  : h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'error', dot: true }, 'None available');
              } },
            { key: 'approver', header: 'Approver', csv: function (r) { return empName(r.approver); },
              cell: function (r) { return empName(r.approver); } },
            { key: 'status', header: 'Status', cell: function (r) { return h(ui.StatusChip, { status: r.status }); } },
            { key: 'actions', header: '', align: 'right',
              cell: function (r) {
                if (r.status !== 'Pending Approval') {
                  return h('span', { className: 'muted', style: { fontSize: 12 } }, r.fulfilledWith || '');
                }
                return h('span', { className: 'row gap-2', style: { justifyContent: 'flex-end' } },
                  h(V.Button, { variant: 'outline', className: 'vi-btn--sm',
                    onClick: function () { form.reset({}); decideSt[1]({ request: r, decision: 'Rejected' }); } }, 'Reject'),
                  h(V.Button, { variant: 'primary', className: 'vi-btn--sm',
                    onClick: function () { form.reset({}); decideSt[1]({ request: r, decision: 'Approved' }); } }, 'Approve'));
              } }
          ],
          emptyIcon: I.checklist, emptyTitle: 'No asset requests',
          emptyBody: 'Requests raised from the employee workspace arrive here with the stock position for their category.'
        })),

      decideSt[0] ? h(ui.Modal, {
        title: (decideSt[0].decision === 'Approved' ? 'Approve' : 'Reject') + ' ' + decideSt[0].request.id,
        description: empName(decideSt[0].request.employee) + ' · ' + decideSt[0].request.category,
        onClose: function () { decideSt[1](null); },
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { decideSt[1](null); } }, 'Cancel'),
          h(V.Button, {
            variant: 'primary', className: decideSt[0].decision === 'Rejected' ? 'vi-btn--danger' : '', onClick: decide
          }, decideSt[0].decision === 'Approved' ? 'Approve and allocate' : 'Reject request'))
      },
        h(ui.KeyValue, { rows: [
          ['Employee', empName(decideSt[0].request.employee)],
          ['Category', decideSt[0].request.category],
          ['Reason', decideSt[0].request.reason],
          ['Requested', ui.dateLabel(decideSt[0].request.requestedOn)],
          ['Units available', availableIn(decideSt[0].request.category)],
          ['Already holds', assetsHeldBy(decideSt[0].request.employee).length + ' asset(s)']
        ]}),
        decideSt[0].decision === 'Approved' && !availableIn(decideSt[0].request.category)
          ? h(Blockers, { title: 'Nothing available', items: ['No ' + decideSt[0].request.category.toLowerCase()
              + ' is available in the inventory, so the approval will be refused (PRD 14.5). Add stock first.'] })
          : null,
        h(V.TextArea, Object.assign({
          label: decideSt[0].decision === 'Rejected' ? 'Reason for rejection' : 'Comment (optional)',
          rows: 3, required: decideSt[0].decision === 'Rejected'
        }, form.field('comment')))) : null);
  }

  function Returns() {
    var returnSt = React.useState(null);
    var exits = liveExits();

    /* PRD 4.32: the return tasks that offboarding generates. One row per asset still
       out with someone who is leaving. */
    var rows = [];
    exits.forEach(function (c) {
      assetsHeldBy(c.employee).forEach(function (a) {
        rows.push(Object.assign({}, a, { caseId: c.id, lastWorkingDay: c.lastWorkingDay, lastWorkingDayLabel: c.lastWorkingDayLabel }));
      });
    });
    rows.sort(function (a, b) { return a.lastWorkingDay < b.lastWorkingDay ? -1 : 1; });

    var history = store.collection('assetHistory').slice().sort(function (a, b) { return a.to < b.to ? 1 : -1; });

    return h(React.Fragment, null,
      h(Stats, null,
        h(Stat, { key: 1, label: 'Due back from exits', value: rows.length,
          sub: 'Across ' + exits.length + ' open case(s)', tone: rows.length ? 'warn' : 'good' }),
        h(Stat, { key: 2, label: 'Cases fully cleared', value: exits.filter(function (c) { return !assetsHeldBy(c.employee).length; }).length,
          sub: 'Nothing left to return', tone: 'good' }),
        h(Stat, { key: 3, label: 'Returns recorded here', value: history.length, sub: 'In this browser session' }),
        h(Stat, { key: 4, label: 'Value outstanding', value: ui.inr(rows.reduce(function (n, a) { return n + (a.value || 0); }, 0), { short: true }),
          sub: 'Purchase value still with exiting employees' })),

      h(Card, {
        title: 'Returns due from exits',
        description: 'PRD 4.32: record the condition on return. Until an employee holds nothing, "Asset return" cannot be ticked on their clearance checklist (PRD 14.8).'
      },
        h(ui.DataTable, {
          exportName: 'asset-returns', label: 'Returns due', rows: rows, pageSize: 10,
          search: function (a) { return empName(a.assignedTo) + ' ' + a.name + ' ' + a.id + ' ' + a.serial; },
          searchPlaceholder: 'Search by employee, asset or serial',
          columns: [
            { key: 'assignedTo', header: 'Employee', sortable: true,
              sortValue: function (a) { return empName(a.assignedTo); },
              csv: function (a) { return empName(a.assignedTo); },
              cell: function (a) { return person(a.assignedTo); } },
            { key: 'lastWorkingDay', header: 'Last working day', sortable: true, cell: function (a) { return a.lastWorkingDayLabel; } },
            { key: 'name', header: 'Asset', sortable: true,
              cell: function (a) { return h('span', { className: 'stack gap-1' },
                h('span', null, a.name),
                h('span', { className: 'list__meta mono' }, a.id + ' · ' + a.serial)); } },
            { key: 'category', header: 'Category', sortable: true },
            { key: 'assignedOn', header: 'Held since', cell: function (a) { return ui.dateLabel(a.assignedOn); } },
            { key: 'value', header: 'Value', numeric: true, align: 'right',
              csv: function (a) { return a.value; }, cell: function (a) { return ui.inr(a.value); } },
            { key: 'actions', header: '', align: 'right',
              cell: function (a) {
                return h(V.Button, { variant: 'primary', className: 'vi-btn--sm',
                  onClick: function () { returnSt[1](a); } }, 'Record return');
              } }
          ],
          emptyIcon: I.ok, emptyTitle: 'Nothing is due back',
          emptyBody: exits.length
            ? 'Everyone with an open exit has returned what they held, so clearance can proceed.'
            : 'No exit is in progress. Returns appear here as soon as a resignation is approved.'
        })),

      h(Card, { title: 'Return history', description: 'PRD 14.5: a return keeps the holding history rather than overwriting it.' },
        h(ui.DataTable, {
          exportName: 'asset-return-history', label: 'Return history', rows: history, pageSize: 10, onExport: false,
          columns: [
            { key: 'asset', header: 'Asset', csv: function (r) { var a = store.find('assets', r.asset); return a ? a.name : r.asset; },
              cell: function (r) { var a = store.find('assets', r.asset); return a ? a.name : h('span', { className: 'mono' }, r.asset); } },
            { key: 'employee', header: 'Returned by', csv: function (r) { return empName(r.employee); },
              cell: function (r) { return person(r.employee); } },
            { key: 'from', header: 'Held from', cell: function (r) { return ui.dateLabel(r.from); } },
            { key: 'to', header: 'Returned on', sortable: true, cell: function (r) { return ui.dateLabel(r.to); } },
            { key: 'condition', header: 'Condition on return',
              cell: function (r) { return h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft',
                tone: r.condition === 'Damaged' ? 'error' : r.condition === 'Needs service' ? 'warning' : 'success' }, r.condition); } }
          ],
          emptyIcon: I.history, emptyTitle: 'No returns recorded yet',
          emptyBody: 'Returns you record in this prototype are listed here with the condition you entered.'
        })),

      returnSt[0] ? h(ReturnModal, { asset: returnSt[0], onClose: function () { returnSt[1](null); } }) : null);
  }

  function Maintenance() {
    var OUT = ['Under Maintenance', 'Damaged', 'Lost', 'Retired'];
    var statusSt = React.useState('');
    var assets = store.collection('assets');
    var out = assets.filter(function (a) { return OUT.indexOf(a.status) >= 0; });
    var rows = statusSt[0] ? out.filter(function (a) { return a.status === statusSt[0]; }) : out;

    return h(React.Fragment, null,
      h(Stats, null,
        h(Stat, { key: 1, label: 'Under maintenance', value: assets.filter(function (a) { return a.status === 'Under Maintenance'; }).length,
          sub: 'Out of circulation, expected back' }),
        h(Stat, { key: 2, label: 'Damaged', value: assets.filter(function (a) { return a.status === 'Damaged'; }).length,
          sub: 'Returned in a damaged condition', tone: 'warn' }),
        h(Stat, { key: 3, label: 'Retired', value: assets.filter(function (a) { return a.status === 'Retired'; }).length,
          sub: 'Written off, kept for the audit trail' }),
        h(Stat, { key: 4, label: 'Value out of circulation', value: ui.inr(out.reduce(function (n, a) { return n + (a.value || 0); }, 0), { short: true }),
          sub: 'Purchase value of the units below' })),

      h(Grid, null,
        h(Card, { span: 7, title: 'Out of circulation',
          description: 'PRD 4.33: assets that cannot be allocated. A unit returns to the pool through the return flow, with its condition recorded.' },
          h(ui.DataTable, {
            exportName: 'asset-maintenance', label: 'Out of circulation', rows: rows, pageSize: 10,
            search: function (a) { return a.id + ' ' + a.name + ' ' + a.category + ' ' + a.serial; },
            searchPlaceholder: 'Search by asset or serial',
            filters: h(ui.Filter, { label: 'Status', value: statusSt[0], onChange: statusSt[1], options: OUT }),
            columns: [
              { key: 'id', header: 'Asset ID', cell: function (a) { return h('span', { className: 'mono' }, a.id); } },
              { key: 'name', header: 'Asset', sortable: true },
              { key: 'category', header: 'Category', sortable: true },
              { key: 'location', header: 'Location', csv: function (a) { return locName(a.location); },
                cell: function (a) { return locName(a.location); } },
              { key: 'condition', header: 'Condition' },
              { key: 'warranty', header: 'Warranty', csv: function (a) { return a.warranty || ''; },
                cell: function (a) {
                  if (!a.warranty) return h('span', { className: 'muted' }, '—');
                  return a.warranty < today()
                    ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'neutral' }, 'Out of warranty')
                    : h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'success' }, 'In warranty');
                } },
              { key: 'value', header: 'Value', numeric: true, align: 'right',
                csv: function (a) { return a.value; }, cell: function (a) { return ui.inr(a.value); } },
              { key: 'status', header: 'Status', cell: function (a) { return h(ui.StatusChip, { status: a.status }); } }
            ],
            emptyIcon: I.ok, emptyTitle: 'Everything is in circulation',
            emptyBody: 'No asset is under maintenance, damaged, lost or retired.'
          })),

        h(Card, { span: 5, title: 'Out of circulation by category' },
          h(ui.Bars, { rows: distribution(out, function (a) { return a.category; }), emptyTitle: 'Nothing out of circulation' })),

        h(Card, { span: 5, title: 'Service rules' },
          h(ui.KeyValue, { rows: [
            ['Condition on return', 'Excellent, Good, Fair, Needs service, Damaged'],
            ['"Needs service"', 'Moves the asset to Under Maintenance'],
            ['"Damaged"', 'Moves the asset to Damaged and keeps it out of the pool'],
            ['Warranty check', 'Flagged against the purchase date plus 36 months'],
            ['Write-off', 'Retired status, kept for the audit trail']
          ]}),
          h('p', { className: 'muted', style: { fontSize: 12, lineHeight: 1.6 } },
            'A status change always runs through the return flow, so inventory and the holding history stay in step (PRD 14.5).'))));
  }

  /* ============================================== Configuration (PRD 4.7, 4.48, 4.25, 4.29) */
  function OnboardingConfig() {
    var templates = store.collection('onboardingTemplates');
    var names = seed.onboardingTaskNames;
    return h(Grid, null,
      h(Card, { span: 12, title: 'Onboarding templates',
        description: 'PRD 4.7: a template per employee type and department. The template chosen when a record is created decides the checklist.' },
        h(ui.DataTable, {
          exportName: 'config-onboarding-templates', label: 'Onboarding templates', rows: templates, pageSize: 10,
          search: function (t) { return t.name + ' ' + t.employeeType; }, searchPlaceholder: 'Search templates',
          columns: [
            { key: 'name', header: 'Template', sortable: true },
            { key: 'employeeType', header: 'Employee type' },
            { key: 'department', header: 'Department' },
            { key: 'tasks', header: 'Tasks', numeric: true, align: 'right', sortable: true },
            { key: 'status', header: 'Status', cell: function (t) { return h(ui.StatusChip, { status: t.status }); } }
          ],
          emptyIcon: I.template, emptyTitle: 'No templates configured',
          emptyBody: 'Without a template a new record gets the standard task list.'
        })),

      h(Card, { span: 7, title: 'Task categories and assignees',
        description: 'Who owns each task by default, and what it waits on.' },
        h('div', { className: 'checks' }, names.map(function (name, i) {
          return h('div', { className: 'checks__row', key: name },
            h('span', { className: 'empty__mark', style: { width: 28, height: 28 } }, i < 8 ? I.lock : I.checklist),
            h('div', { className: 'checks__main' },
              h('span', { className: 'checks__name' }, name),
              h('span', { className: 'checks__meta' },
                (/IT|Asset/.test(name) ? 'IT Administrator' : /Manager|Department/.test(name) ? 'Reporting Manager' : 'HR Administrator')
                + ' · due day ' + (i + 1) + (i ? ' · after "' + names[i - 1] + '"' : ' · starts first'))),
            i < 8 ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning' }, 'Mandatory') : h(V.Chip, { size: 'sm', shape: 'tag' }, 'Optional'));
        }))),

      h(Card, { span: 5, title: 'Rules' },
        h(ui.KeyValue, { rows: [
          ['Checklist trigger', 'Employee record created as Invited or Onboarding (PRD 5.1)'],
          ['Mandatory tasks', '8 of ' + names.length],
          ['Activation', 'Refused while a mandatory task is open (PRD 14.1)'],
          ['Task due dates', 'Joining date plus the task position'],
          ['Document verification', 'HR Administrator, per document (PRD 4.8)'],
          ['Stage transitions', 'Yet to Start → In Progress → Pending Verification → Completed']
        ]}),
        h('div', { className: 'checks' },
          [['Email the new joiner when the checklist opens', true],
            ['Remind the task owner the day before it is due', true],
            ['Escalate an overdue mandatory task to HR', true],
            ['Allow HR to tick a task owned by someone else', true]].map(function (row) {
            return h('div', { className: 'checks__row', key: row[0] },
              h(V.Switch, { defaultChecked: row[1], 'aria-label': row[0],
                onChange: function (e) { ui.toast(row[0] + ' ' + (e.target.checked ? 'enabled' : 'disabled'), 'success'); } }),
              h('div', { className: 'checks__main' }, h('span', { className: 'checks__name' }, row[0])));
          }))));
  }

  function OffboardingConfig() {
    var names = seed.offboardingTaskNames;
    var cases = offboardingCases();
    return h(Grid, null,
      h(Card, { span: 7, title: 'Clearance checklist',
        description: 'PRD 4.48: the tasks every exit must clear, and who owns each one.' },
        h('div', { className: 'checks' }, names.map(function (name) {
          return h('div', { className: 'checks__row', key: name },
            h('span', { className: 'empty__mark', style: { width: 28, height: 28 } },
              /Asset|Access/.test(name) ? I.lock : I.checklist),
            h('div', { className: 'checks__main' },
              h('span', { className: 'checks__name' }, name),
              h('span', { className: 'checks__meta' },
                (/Asset|Access/.test(name) ? 'IT Administrator' : 'HR Administrator')
                + (name === 'Asset return' ? ' · refused while any asset is still assigned (PRD 14.8)' : '')
                + (name === 'Final settlement' ? ' · refused while clearance is outstanding (PRD 14.8)' : ''))),
            name === 'Asset return' || name === 'Final settlement'
              ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning' }, 'Gated')
              : null);
        }))),

      h(Card, { span: 5, title: 'Notice rules' },
        h(ui.KeyValue, { rows: [
          ['Default notice period', '60 days'],
          ['Probation notice', '30 days'],
          ['Shortfall', 'Recorded against the case, not refused'],
          ['Approval chain', 'Reporting Manager, then HR Administrator (PRD 6.3)'],
          ['On approval', 'Employee moves to Notice Period and clearance opens (PRD 5.1)'],
          ['On completion', 'Employee moves to Exited and the user account is deactivated']
        ]}),
        h('div', { className: 'checks' },
          [['Allow the last working day to be revised after approval', true],
            ['Require an exit interview before settlement', true],
            ['Revoke system access on the last working day', true]].map(function (row) {
            return h('div', { className: 'checks__row', key: row[0] },
              h(V.Switch, { defaultChecked: row[1], 'aria-label': row[0],
                onChange: function (e) { ui.toast(row[0] + ' ' + (e.target.checked ? 'enabled' : 'disabled'), 'success'); } }),
              h('div', { className: 'checks__main' }, h('span', { className: 'checks__name' }, row[0])));
          }))),

      h(Card, { span: 12, title: 'Exit reasons',
        description: 'The reasons offered when a resignation is recorded, with how often each has been used.' },
        h(ui.DataTable, {
          exportName: 'config-exit-reasons', label: 'Exit reasons', pageSize: 10, onExport: false,
          rows: seed.exitReasons.map(function (reason) {
            return { id: reason, reason: reason, used: cases.filter(function (c) { return c.reason === reason; }).length, status: 'Active' };
          }),
          columns: [
            { key: 'reason', header: 'Reason', sortable: true },
            { key: 'used', header: 'Recorded exits', numeric: true, align: 'right', sortable: true },
            { key: 'share', header: 'Share', numeric: true, align: 'right',
              csv: function (r) { return ui.pct(r.used, cases.length) + '%'; },
              cell: function (r) { return h(V.ProgressBar, { value: ui.pct(r.used, cases.length), size: 'sm', 'aria-label': r.reason }); } },
            { key: 'status', header: 'Status', cell: function (r) { return h(ui.StatusChip, { status: r.status }); } }
          ]
        })));
  }

  function DocumentsConfig() {
    var docs = store.collection('employeeDocuments');
    var REQUIRED = ['Identity Proof', 'Address Proof', 'Education Certificate', 'Employment Agreement'];
    return h(Grid, null,
      h(Card, { span: 12, title: 'Document categories',
        description: 'PRD 4.25: the categories an employee can upload against, which are mandatory, and which carry an expiry date.' },
        h(ui.DataTable, {
          exportName: 'config-document-categories', label: 'Document categories', pageSize: 10, onExport: false,
          rows: seed.documentCategories.map(function (cat) {
            var mine = docs.filter(function (d) { return d.category === cat; });
            return {
              id: cat, category: cat, required: REQUIRED.indexOf(cat) >= 0,
              expiry: cat === 'Identity Proof', count: mine.length,
              pending: mine.filter(function (d) { return d.status === 'Pending Verification'; }).length
            };
          }),
          columns: [
            { key: 'category', header: 'Category', sortable: true },
            { key: 'required', header: 'Mandatory', align: 'center',
              csv: function (r) { return r.required ? 'Yes' : 'No'; },
              cell: function (r) {
                return r.required
                  ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning' }, 'Mandatory')
                  : h('span', { className: 'muted' }, 'Optional');
              } },
            { key: 'expiry', header: 'Expiry tracked', align: 'center',
              csv: function (r) { return r.expiry ? 'Yes' : 'No'; },
              cell: function (r) { return r.expiry ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info' }, 'Tracked') : h('span', { className: 'muted' }, 'No'); } },
            { key: 'count', header: 'On file', numeric: true, align: 'right', sortable: true,
              cell: function (r) { return r.count.toLocaleString(); } },
            { key: 'pending', header: 'Pending', numeric: true, align: 'right' }
          ]
        })),

      h(Card, { span: 6, title: 'Access rules',
        description: 'Who may see a document once it is uploaded (PRD 10 data scopes).' },
        h(ui.KeyValue, { rows: [
          ['Employee', 'Their own documents only'],
          ['Reporting manager', 'No access to personal documents'],
          ['HR Administrator', 'Every document, with verification rights'],
          ['Organization Admin', 'Every document, read only'],
          ['Verification', 'HR Administrator only (PRD 4.8)'],
          ['Retention', 'Until one year after exit']
        ]})),

      h(Card, { span: 6, title: 'Acknowledgement and expiry' },
        h(ui.KeyValue, { rows: [
          ['Acknowledgement', 'Per policy, set when it is published (PRD 4.25)'],
          ['Reminder cadence', 'Weekly until acknowledged'],
          ['Expiry reminder window', '180 days before expiry (PRD 4.27)'],
          ['Escalation', 'HR Administrator once the deadline passes'],
          ['Versioning', 'A new version re-opens acknowledgement for the audience']
        ]}),
        h('div', { className: 'checks' },
          [['Require acknowledgement on a new policy by default', true],
            ['Remind weekly until acknowledged', true],
            ['Warn 180 days before a document expires', true],
            ['Block the employee portal until mandatory documents are uploaded', false]].map(function (row) {
            return h('div', { className: 'checks__row', key: row[0] },
              h(V.Switch, { defaultChecked: row[1], 'aria-label': row[0],
                onChange: function (e) { ui.toast(row[0] + ' ' + (e.target.checked ? 'enabled' : 'disabled'), 'success'); } }),
              h('div', { className: 'checks__main' }, h('span', { className: 'checks__name' }, row[0])));
          }))));
  }

  function AssetsConfig() {
    var assets = store.collection('assets');
    return h(Grid, null,
      h(Card, { span: 12, title: 'Asset categories',
        description: 'PRD 4.29: the categories an asset can belong to, with the live inventory position for each.' },
        h(ui.DataTable, {
          exportName: 'config-asset-categories', label: 'Asset categories', pageSize: 10, onExport: false,
          rows: seed.assetCategories.map(function (cat) {
            var mine = assets.filter(function (a) { return a.category === cat; });
            return {
              id: cat, category: cat, count: mine.length,
              available: mine.filter(function (a) { return a.status === 'Available'; }).length,
              assigned: mine.filter(function (a) { return a.status === 'Assigned'; }).length,
              value: mine.reduce(function (n, a) { return n + (a.value || 0); }, 0),
              serialRequired: true
            };
          }),
          columns: [
            { key: 'category', header: 'Category', sortable: true },
            { key: 'count', header: 'Units', numeric: true, align: 'right', sortable: true },
            { key: 'assigned', header: 'Assigned', numeric: true, align: 'right' },
            { key: 'available', header: 'Available', numeric: true, align: 'right' },
            { key: 'value', header: 'Value', numeric: true, align: 'right', sortable: true,
              csv: function (r) { return r.value; }, cell: function (r) { return ui.inr(r.value, { short: true }); } },
            { key: 'serialRequired', header: 'Serial required', align: 'center',
              csv: function () { return 'Yes'; },
              cell: function () { return h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning' }, 'Required'); } }
          ]
        })),

      h(Card, { span: 6, title: 'Status rules',
        description: 'PRD 14.5: which statuses allow allocation, and what a return does.' },
        h(ui.DataTable, {
          exportName: 'config-asset-statuses', label: 'Asset status rules', pageSize: 10, onExport: false,
          rows: [
            { id: 1, status: 'Available', allocatable: true, note: 'In the store, ready to issue' },
            { id: 2, status: 'Assigned', allocatable: false, note: 'Out with an employee; must be returned first' },
            { id: 3, status: 'Under Maintenance', allocatable: false, note: 'Returned needing service' },
            { id: 4, status: 'Damaged', allocatable: false, note: 'Returned damaged; kept out of the pool' },
            { id: 5, status: 'Lost', allocatable: false, note: 'Not recovered; recovery may be raised in payroll' },
            { id: 6, status: 'Retired', allocatable: false, note: 'Written off, kept for the audit trail' }
          ],
          columns: [
            { key: 'status', header: 'Status', cell: function (r) { return h(ui.StatusChip, { status: r.status }); } },
            { key: 'allocatable', header: 'Can be allocated', align: 'center',
              csv: function (r) { return r.allocatable ? 'Yes' : 'No'; },
              cell: function (r) {
                return r.allocatable
                  ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'success', dot: true }, 'Yes')
                  : h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'neutral' }, 'No');
              } },
            { key: 'note', header: 'Meaning' }
          ]
        })),

      h(Card, { span: 6, title: 'Custom fields and defaults' },
        h(ui.KeyValue, { rows: [
          ['Asset ID format', h('span', { className: 'mono' }, 'AST####')],
          ['Next asset ID', h('span', { className: 'mono' }, store.nextId('assets', 'AST'))],
          ['Serial number', 'Required and unique across the inventory (PRD 14.5)'],
          ['Custom fields', 'Purchase value, warranty until, condition, location'],
          ['Default warranty', '36 months from the purchase date'],
          ['Acknowledgement', 'Requested from the holder on allocation (PRD 4.30)']
        ]}),
        h('div', { className: 'checks' },
          [['Require the holder to acknowledge receipt', true],
            ['Refuse allocation of an asset already assigned', true],
            ['Auto-raise a return task when an exit is approved', true],
            ['Allow an employee to request an asset directly', true]].map(function (row) {
            return h('div', { className: 'checks__row', key: row[0] },
              h(V.Switch, { defaultChecked: row[1], 'aria-label': row[0],
                onChange: function (e) { ui.toast(row[0] + ' ' + (e.target.checked ? 'enabled' : 'disabled'), 'success'); } }),
              h('div', { className: 'checks__main' }, h('span', { className: 'checks__name' }, row[0])));
          }))));
  }

  /* ---------------------------------------------------------------- Register */
  HRMS.screens.register({
    'hr/onboarding/dashboard': OnboardingDashboard,
    'hr/onboarding/cases': OnboardingCases,
    'hr/onboarding/verification': DocumentVerification,
    'hr/onboarding/templates': OnboardingTemplates,

    'hr/offboarding/dashboard': OffboardingDashboard,
    'hr/offboarding/resignations': Resignations,
    'hr/offboarding/notice': NoticePeriod,
    'hr/offboarding/clearance': Clearance,
    'hr/offboarding/settlement': Settlement,

    'hr/documents/company': CompanyDocuments,
    'hr/documents/employee': EmployeeDocuments,
    'hr/documents/policies': PolicyLibrary,
    'hr/documents/acknowledgements': Acknowledgements,
    'hr/documents/expiring': ExpiringDocuments,

    'hr/assets/dashboard': AssetsDashboard,
    'hr/assets/inventory': Inventory,
    'hr/assets/allocations': Allocations,
    'hr/assets/requests': AssetRequests,
    'hr/assets/returns': Returns,
    'hr/assets/maintenance': Maintenance,

    'hr/config/onboarding': OnboardingConfig,
    'hr/config/offboarding': OffboardingConfig,
    'hr/config/documents': DocumentsConfig,
    'hr/config/assets': AssetsConfig
  });
})();

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
  /* "In progress" means exactly that, now that finished cases have their own tab. */
  function openOnboardingCases() {
    return onboardingCases().filter(function (c) { return c.stage !== 'Completed'; });
  }
  function completedOnboardingCases() {
    return onboardingCases().filter(function (c) { return c.stage === 'Completed'; });
  }
  /* Where the hire came from. The case records it at the time it was started, so a later
     edit to the employee cannot rewrite the history; older cases fall back to the record. */
  function caseSource(c) {
    if (c.source) return c.source;
    var e = emp(c.employee);
    return (e && e.source) || 'Direct';
  }
  function isPsyHire(x) { return x === 'PsyHire'; }
  /* The PsyHire marker, used in the picker, the case tables and the record drawer. */
  function SourceChip(p) {
    if (!isPsyHire(p.source)) {
      return p.showDirect ? h(V.Chip, { size: 'sm', shape: 'tag' }, 'Direct') : null;
    }
    return h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'primary' }, 'PsyHire');
  }
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

  /* The start flow: who is joining, on what template, and when. The joining date is the
     pivot — every task is due before it, so it is asked for here rather than inherited. */
  function StartOnboardingModal(p) {
    var form = p.form;
    var chosen = form.values.employee ? emp(form.values.employee) : null;
    var tasks = seed.onboardingTaskNames.length;
    var joining = form.values.joiningDate;
    var firstDue = joining && !form.errors.joiningDate
      ? seed.util.pretty(seed.util.addDays(new Date(joining + 'T00:00'), -tasks)) : null;
    var lastDue = joining && !form.errors.joiningDate
      ? seed.util.pretty(seed.util.addDays(new Date(joining + 'T00:00'), -1)) : null;
    var mailTo = chosen ? (chosen.personalEmail || chosen.workEmail) : null;

    return h(ui.Modal, {
      title: 'Start onboarding',
      description: 'Generates the checklist from the chosen template and assigns each task (PRD 4.7).',
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
        h(V.Button, { variant: 'primary', iconStart: I.send, onClick: p.onStart }, 'Start and send invite'))
    },
      h('div', { className: 'row gap-2', style: { marginBottom: 12, flexWrap: 'wrap' } },
        h(V.Chip, {
          size: 'sm', selected: p.psyOnly, onClick: function () { p.setPsyOnly(!p.psyOnly); }
        }, 'PsyHire intake only'),
        h('span', { className: 'muted', style: { fontSize: 12, alignSelf: 'center' } },
          p.pool.length + ' candidate' + (p.pool.length === 1 ? '' : 's') + ' without a case')),

      h(ui.EmployeePicker, {
        label: 'Employee', pool: p.pool, value: form.values.employee,
        status: form.errors.employee ? 'error' : undefined,
        hint: form.errors.employee || 'Someone who does not already have a case',
        onChange: function (v) { form.set('employee', v); },
        badge: function (e) { return h(SourceChip, { source: e.source }); }
      }),
      chosen ? h('div', { className: 'row gap-2', style: { margin: '-6px 0 12px' } },
        h(SourceChip, { source: chosen.source, showDirect: true }),
        h('span', { className: 'muted', style: { fontSize: 12, alignSelf: 'center' } },
          isPsyHire(chosen.source) ? 'Sourced through PsyHire' : 'Direct hire')) : null,

      h(ui.FieldRow, { cols: 2 },
        h(V.Select, Object.assign({ label: 'Template',
          options: store.collection('onboardingTemplates')
            .filter(function (t) { return t.status === 'Active'; })
            .map(function (t) { return { value: t.id, label: t.name + ' · ' + t.tasks + ' tasks' }; })
        }, form.select('template'))),
        h(V.DateField, Object.assign({ label: 'Date of joining', required: true },
          form.field('joiningDate', { hint: 'The checklist is scheduled backwards from this date' })))),

      firstDue ? h('div', { className: 'ai-note', style: { marginTop: 4 } },
        h('span', { className: 'ai-note__mark' }, I.mail),
        h('div', { className: 'ai-note__body' },
          h('span', { className: 'ai-note__eyebrow' }, 'On start'),
          h('p', { className: 'ai-note__text' },
            'An invitation is emailed' + (mailTo ? ' to ' + mailTo : '') + ', and all ' + tasks
            + ' tasks fall before the joining date — the first due ' + firstDue
            + ', the last ' + lastDue + '.'))) : null,

      form.errors._ ? h('p', { style: { color: 'var(--danger-fg)', fontSize: 13 } }, form.errors._) : null);
  }

  function OnboardingCases() {
    var openSt = React.useState(null);
    var startSt = React.useState(false);
    var stageSt = React.useState('');
    var psyOnlySt = React.useState(false);
    var form = ui.useForm({ template: 'tpl-standard', joiningDate: '' },
      function (v) { return rules.validOnboardingStart(v); });

    var cases = openOnboardingCases();
    var rows = stageSt[0] ? cases.filter(function (c) { return c.stage === stageSt[0]; }) : cases;

    /* Anyone without a case yet, optionally narrowed to the PsyHire intake. */
    function candidatePool() {
      var taken = onboardingCases().map(function (c) { return c.employee; });
      return store.collection('employees').filter(function (e) {
        if (e.status === 'Exited' || taken.indexOf(e.id) >= 0) return false;
        return psyOnlySt[0] ? isPsyHire(e.source) : true;
      });
    }

    function resetStart() { form.reset({ template: 'tpl-standard', joiningDate: '' }); psyOnlySt[1](false); }
    function start() {
      var res = form.submit(function (v) {
        if (!v.employee) return { ok: false, errors: { employee: 'Choose an employee' } };
        return ui.report(act.initiateOnboarding(v.employee, v.template, { joiningDate: v.joiningDate }));
      });
      if (res && res.ok) { startSt[1](false); resetStart(); openSt[1](res.id); }
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
      { key: 'source', header: 'Source', sortable: true,
        sortValue: function (c) { return caseSource(c); }, csv: function (c) { return caseSource(c); },
        cell: function (c) { return h(SourceChip, { source: caseSource(c), showDirect: true }); } },
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

      startSt[0] ? h(StartOnboardingModal, {
        form: form, pool: candidatePool(), psyOnly: psyOnlySt[0], setPsyOnly: psyOnlySt[1],
        onStart: start, onClose: function () { startSt[1](false); resetStart(); }
      }) : null);
  }

  /* ------------------------------------------------- Completed onboardings
     The archive: once a checklist is finished the case leaves the "In progress" tab, and
     the whole record — who, from where, against which template, and when each task was
     closed — is kept here rather than disappearing with the open-case list. */
  function CompletedRecordDrawer(p) {
    var c = store.find('onboarding', p.id);
    if (!c) return null;
    var e = emp(c.employee);
    var tasks = c.tasks || [];
    var docs = store.collection('employeeDocuments').filter(function (d) { return d.employee === c.employee; });
    var tpl = store.collection('onboardingTemplates').filter(function (t) { return t.id === c.template; })[0];

    return h(ui.Drawer, {
      eyebrow: c.id + ' · ' + templateName(c.template),
      title: e ? e.name : c.employee,
      description: e ? e.designation + ' · joined ' + c.startDateLabel : null,
      onClose: p.onClose,
      footer: h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Close')
    },
      h('div', { className: 'row gap-3 wrap' },
        h(ui.StatusChip, { status: 'Completed', size: 'md' }),
        h(SourceChip, { source: caseSource(c), showDirect: true }),
        h(V.Chip, { size: 'sm', shape: 'tag', icon: I.checklist }, tasks.length + ' tasks closed')),

      h(ui.KeyValue, { rows: [
        ['Employee', e ? h('span', { className: 'mono' }, e.id) : c.employee],
        ['Department', e ? deptName(e.department) : null],
        ['Work location', e ? locName(e.location) : null],
        ['Hiring source', caseSource(c)],
        ['Template', tpl ? tpl.name : templateName(c.template)],
        ['Invitation sent', c.invitedOn ? ui.dateLabel(c.invitedOn) : null],
        ['Date of joining', c.startDateLabel],
        ['Checklist closed', c.completedOnLabel || (c.completedOn ? ui.dateLabel(c.completedOn) : null)]
      ]}),

      h(ui.FormSection, { title: 'Checklist', description: 'Every task, its owner and the day it was closed.' },
        h('div', { className: 'checks' }, tasks.map(function (t) {
          return h('div', { className: 'checks__row is-done', key: t.name },
            h('span', { className: 'empty__mark', style: { width: 28, height: 28 } }, I.check),
            h('div', { className: 'checks__main' },
              h('span', { className: 'checks__name' }, t.name),
              h('span', { className: 'checks__meta' },
                empName(t.assignee) + ' · closed ' + (t.completedOn ? ui.dateLabel(t.completedOn) : '—'))),
            t.mandatory ? h(V.Chip, { size: 'sm', shape: 'tag' }, 'Mandatory') : null);
        }))),

      h(ui.FormSection, { title: 'Documents on file', description: 'What the joiner submitted, and how it was decided.' },
        docs.length
          ? h('div', { className: 'checks' }, docs.map(function (d) {
            return h('div', { className: 'checks__row', key: d.id || d.name },
              h('span', { className: 'empty__mark', style: { width: 28, height: 28 } }, I.file),
              h('div', { className: 'checks__main' },
                h('span', { className: 'checks__name' }, d.name),
                h('span', { className: 'checks__meta' },
                  d.category + ' · uploaded ' + ui.dateLabel(d.uploaded)
                  + (d.verifiedBy ? ' · verified by ' + empName(d.verifiedBy) : ''))),
              h(ui.StatusChip, { status: d.status }));
          }))
          : h('p', { className: 'muted', style: { fontSize: 13, margin: 0 } }, 'No documents are filed against this record.')));
  }

  function OnboardingCompleted() {
    var openSt = React.useState(null);
    var sourceSt = React.useState('');
    var all = completedOnboardingCases();
    var rows = sourceSt[0] ? all.filter(function (c) { return caseSource(c) === sourceSt[0]; }) : all;
    var psy = all.filter(function (c) { return isPsyHire(caseSource(c)); }).length;

    return h(React.Fragment, null,
      h(Stats, { cols: 3 },
        h(Stat, { key: 1, label: 'Completed onboardings', value: all.length, sub: 'Checklists closed in full', tone: 'good' }),
        h(Stat, { key: 2, label: 'From PsyHire', value: psy,
          sub: all.length ? ui.pct(psy, all.length) + '% of the intake' : 'No records yet' }),
        h(Stat, { key: 3, label: 'Direct hires', value: all.length - psy, sub: 'Sourced outside PsyHire' })),

      h(Card, {
        title: 'Completed onboarding records',
        description: 'The archive of finished checklists. Open a record for its tasks, owners and documents.'
      },
        h(ui.DataTable, {
          exportName: 'onboarding-completed', label: 'Completed onboardings', rows: rows, pageSize: 10,
          search: function (c) { return empName(c.employee) + ' ' + c.id + ' ' + caseSource(c); },
          searchPlaceholder: 'Search by name, case or source',
          filters: h(ui.Filter, {
            label: 'Source', value: sourceSt[0], onChange: sourceSt[1], options: ['PsyHire', 'Direct']
          }),
          columns: [
            { key: 'employee', header: 'Employee', sortable: true,
              sortValue: function (c) { return empName(c.employee); },
              csv: function (c) { return empName(c.employee); },
              cell: function (c) {
                var e = emp(c.employee);
                return e ? h(ui.Person, { employee: e, sub: e.id, onClick: function () { openSt[1](c.id); } })
                  : h('span', { className: 'muted' }, c.employee);
              } },
            { key: 'department', header: 'Department',
              csv: function (c) { var e = emp(c.employee); return e ? deptName(e.department) : ''; },
              cell: function (c) { var e = emp(c.employee); return e ? deptName(e.department) : '—'; } },
            { key: 'source', header: 'Source', sortable: true,
              sortValue: function (c) { return caseSource(c); }, csv: function (c) { return caseSource(c); },
              cell: function (c) { return h(SourceChip, { source: caseSource(c), showDirect: true }); } },
            { key: 'template', header: 'Template', csv: function (c) { return templateName(c.template); },
              cell: function (c) { return templateName(c.template); } },
            { key: 'startDate', header: 'Joined', sortable: true,
              csv: function (c) { return c.startDate; }, cell: function (c) { return c.startDateLabel; } },
            { key: 'completedOn', header: 'Checklist closed', sortable: true,
              csv: function (c) { return c.completedOn || ''; },
              cell: function (c) {
                return c.completedOn
                  ? h('span', null, c.completedOnLabel || ui.dateLabel(c.completedOn))
                  : h('span', { className: 'muted' }, '—');
              } },
            { key: 'tasks', header: 'Tasks', numeric: true, align: 'right',
              csv: function (c) { return c.tasksTotal; },
              cell: function (c) { return c.tasksTotal; } },
            { key: 'actions', header: '', align: 'right',
              cell: function (c) {
                return h(V.Button, { variant: 'ghost', className: 'vi-btn--sm',
                  onClick: function () { openSt[1](c.id); } }, 'Record');
              } }
          ],
          emptyIcon: I.archive, emptyTitle: 'No completed onboardings yet',
          emptyBody: 'A case moves here once every task on its checklist is closed.'
        })),

      openSt[0] ? h(CompletedRecordDrawer, { id: openSt[0], onClose: function () { openSt[1](null); } }) : null);
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
            { key: 'mandatory', header: 'Mandatory',
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
          onClick: function () { p.onClose(); router.goAs('admin/assets/returns'); } }, 'Record asset returns'))
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
              onClick: function () { p.onClose(); router.goAs('admin/assets/returns'); } }, held.length + ' asset(s) to return')
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

  /* ======================================================= Documents & policies
     One screen, no tabs: a folder tree over the company library. Acknowledgement
     tracking and expiry used to live here too; they were two more things to read on a
     row whose job is to say what the document is and where it sits, so the library is
     storage now. Employee documents are not here at all — they belong to the person,
     and live on their profile. */
  function docFolders() { return store.collection('docFolders'); }
  function docFiles() { return store.collection('policies'); }
  function childFolders(parent) {
    return docFolders().filter(function (f) { return (f.parent || null) === (parent || null); });
  }
  function filesIn(folder) {
    return docFiles().filter(function (d) { return (d.folder || null) === (folder || null); });
  }
  /* Everything under a folder, including its subfolders, for the counts on a folder row. */
  function descendantIds(id) {
    var out = [id];
    childFolders(id).forEach(function (f) { out = out.concat(descendantIds(f.id)); });
    return out;
  }
  function filesUnder(id) {
    var ids = descendantIds(id);
    return docFiles().filter(function (d) { return ids.indexOf(d.folder) >= 0; });
  }
  function folderPath(id) {
    var all = docFolders(), path = [], guard = 0;
    var cur = all.filter(function (f) { return f.id === id; })[0];
    while (cur && guard++ < 20) {
      path.unshift(cur);
      cur = cur.parent ? all.filter(function (f) { return f.id === cur.parent; })[0] : null;
    }
    return path;
  }
  var DOC_KINDS = ['Policy', 'Insurance', 'Handbook', 'Reference', 'Form', 'Template', 'Contract', 'Other'];
  function kindIcon(kind) {
    if (kind === 'Policy') return I.shield;
    if (kind === 'Insurance') return I.card;
    if (kind === 'Form' || kind === 'Template') return I.forms;
    return I.file;
  }

  /* Create-folder dialog. */
  function NewFolderModal(p) {
    var form = ui.useForm({ name: '', description: '' }, function (v) {
      var errs = {};
      if (!String(v.name || '').trim()) errs.name = 'Give the folder a name';
      else if (childFolders(p.parent).some(function (f) { return f.name.toLowerCase() === String(v.name).trim().toLowerCase(); })) {
        errs.name = 'A folder with that name is already here';
      }
      return errs;
    });
    function save() {
      var res = form.submit(function (v) {
        var name = String(v.name).trim();
        store.add('docFolders', {
          id: 'fld-' + Date.now().toString(36), name: name,
          parent: p.parent || null, description: String(v.description || '').trim()
        });
        store.log('created the folder "' + name + '"', 'User activity');
        ui.toast('Folder "' + name + '" created', 'success');
        return { ok: true };
      });
      if (res && res.ok) p.onClose();
    }
    return h(ui.Modal, {
      title: 'New folder',
      description: p.parentName ? 'Inside ' + p.parentName : 'At the top of the library',
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
        h(V.Button, { variant: 'primary', onClick: save }, 'Create folder'))
    },
      h(V.TextField, Object.assign({ label: 'Folder name', placeholder: 'e.g. Insurance & Benefits' }, form.field('name'))),
      h(V.TextArea, Object.assign({ label: 'Description', rows: 2, placeholder: 'What belongs in here' }, form.field('description'))));
  }

  /* One Upload button that asks what is being uploaded, rather than two buttons the
     eye has to tell apart. Violet has no menu component, so this is the picker's
     pattern: an absolutely positioned list that closes on an outside click or Escape. */
  function UploadMenu(p) {
    var openSt = React.useState(false);
    var ref = React.useRef(null);
    React.useEffect(function () {
      if (!openSt[0]) return;
      function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) openSt[1](false); }
      function onKey(e) { if (e.key === 'Escape') openSt[1](false); }
      document.addEventListener('mousedown', onDoc);
      document.addEventListener('keydown', onKey);
      return function () {
        document.removeEventListener('mousedown', onDoc);
        document.removeEventListener('keydown', onKey);
      };
    }, [openSt[0]]);

    function pick(mode) { openSt[1](false); p.onPick(mode); }
    var items = [
      { mode: 'file', icon: I.file, label: 'Files', hint: 'Into the folder you are in' },
      { mode: 'folder', icon: I.folder, label: 'Folder', hint: 'Creates the folder and fills it' }
    ];

    return h('span', { className: 'pmenu', ref: ref },
      h(V.Button, {
        variant: 'primary', className: 'vi-btn--sm', iconStart: I.up, iconEnd: I.chevron,
        'aria-haspopup': 'menu', 'aria-expanded': openSt[0] ? 'true' : 'false',
        onClick: function () { openSt[1](!openSt[0]); }
      }, 'Upload'),
      openSt[0] ? h('ul', { className: 'pmenu__list', role: 'menu' }, items.map(function (it) {
        return h('li', { key: it.mode, role: 'none' },
          h('button', {
            type: 'button', role: 'menuitem', className: 'pmenu__item',
            onClick: function () { pick(it.mode); }
          },
            h('span', { className: 'empty__mark', style: { width: 26, height: 26 } }, it.icon),
            h('span', { className: 'pmenu__text' },
              h('span', { className: 'pmenu__label' }, it.label),
              h('span', { className: 'pmenu__hint' }, it.hint))));
      })) : null);
  }

  /* A drop target that also opens the file picker. Real files: the browser hands over
     name and size, so what is staged is what was actually dropped rather than typed.
     `directory` swaps the picker for a folder picker, where each file carries the
     relative path it came in under. */
  function DropZone(p) {
    var overSt = React.useState(false);
    var inputRef = React.useRef(null);

    function take(list) {
      var files = [].slice.call(list || []);
      if (files.length) p.onFiles(files);
    }
    return h('div', null,
      h('div', {
        className: 'dropzone' + (overSt[0] ? ' is-over' : ''),
        role: 'button', tabIndex: 0,
        onClick: function () { if (inputRef.current) inputRef.current.click(); },
        onKeyDown: function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (inputRef.current) inputRef.current.click(); }
        },
        onDragOver: function (e) { e.preventDefault(); overSt[1](true); },
        onDragEnter: function (e) { e.preventDefault(); overSt[1](true); },
        onDragLeave: function () { overSt[1](false); },
        onDrop: function (e) {
          e.preventDefault(); overSt[1](false);
          take(e.dataTransfer && e.dataTransfer.files);
        }
      },
        h('span', { className: 'dropzone__mark' }, p.directory ? I.folder : I.up),
        h('span', { className: 'dropzone__title' },
          p.directory ? 'Drop a folder here' : 'Drop files here'),
        h('span', { className: 'dropzone__hint' },
          'or click to browse' + (p.directory ? ' for a folder' : ''))),
      h('input', Object.assign({
        ref: inputRef, type: 'file', multiple: true, className: 'visually-hidden',
        'aria-label': p.directory ? 'Choose a folder' : 'Choose files',
        onChange: function (e) { take(e.target.files); e.target.value = ''; }
      }, p.directory ? { webkitdirectory: '', directory: '' } : {})));
  }

  function prettyBytes(n) {
    if (n == null) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /* Upload. `mode` is 'file' or 'folder': a folder upload creates the folder and files
     it in one step, which is what dropping a folder in from a desktop would do. */
  function UploadModal(p) {
    var multi = p.mode === 'folder';
    /* Staged files, as the browser handed them over: real names and real sizes. */
    var filesSt = React.useState([]);
    var form = ui.useForm({
      folderName: '', kind: 'Policy', version: 'v1.0', audience: 'All employees'
    }, function (v) {
      var errs = {};
      if (multi && !String(v.folderName || '').trim()) errs.folderName = 'Name the folder being uploaded';
      return errs;
    });

    function addFiles(list) {
      var mapped = list.map(function (f) {
        /* A folder pick carries the path it came in under; its first segment is the
           folder's own name, which saves asking for it. */
        var rel = f.webkitRelativePath || '';
        return { name: f.name, size: f.size, rel: rel };
      });
      filesSt[1](function (cur) {
        var seen = {};
        cur.forEach(function (f) { seen[f.name + '|' + f.size] = true; });
        return cur.concat(mapped.filter(function (f) {
          var k = f.name + '|' + f.size;
          if (seen[k]) return false;
          seen[k] = true;
          return true;
        }));
      });
      if (multi && !String(form.values.folderName || '').trim()) {
        var withPath = mapped.filter(function (f) { return f.rel && f.rel.indexOf('/') > 0; })[0];
        if (withPath) form.set('folderName', withPath.rel.split('/')[0]);
      }
    }
    function removeFile(i) {
      filesSt[1](filesSt[0].filter(function (_, n) { return n !== i; }));
    }

    function save() {
      if (!filesSt[0].length) { ui.toast(multi ? 'Drop a folder to upload' : 'Drop at least one file', 'error'); return; }
      var res = form.submit(function (v) {
        var target = p.parent || null;
        var folderLabel = p.parentName || 'the library';
        if (multi) {
          var fname = String(v.folderName).trim();
          var created = store.add('docFolders', {
            id: 'fld-' + Date.now().toString(36), name: fname,
            parent: target, description: 'Uploaded folder'
          });
          target = created.id;
          folderLabel = fname;
        }
        var staged = filesSt[0];
        staged.forEach(function (f, i) {
          store.add('policies', {
            id: 'doc-' + Date.now().toString(36) + '-' + i,
            name: f.name, version: v.version || 'v1.0', kind: v.kind,
            category: p.parentName || 'Uncategorised', folder: target,
            size: prettyBytes(f.size), published: today(),
            audience: v.audience || 'All employees', uploaded: true
          });
        });
        store.log('uploaded ' + staged.length + ' document' + (staged.length === 1 ? '' : 's') + ' to ' + folderLabel, 'User activity');
        ui.toast(staged.length + ' file' + (staged.length === 1 ? '' : 's') + ' uploaded to ' + folderLabel, 'success');
        return { ok: true };
      });
      if (res && res.ok) p.onClose();
    }

    var staged = filesSt[0];
    var totalBytes = staged.reduce(function (n, f) { return n + (f.size || 0); }, 0);

    return h(ui.Modal, {
      title: multi ? 'Upload a folder' : 'Upload files',
      wide: true,
      description: multi
        ? 'Creates the folder' + (p.parentName ? ' inside ' + p.parentName : '') + ' and files everything in it.'
        : 'Into ' + (p.parentName || 'the top of the library') + '.',
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        staged.length
          ? h('span', { className: 'muted', style: { fontSize: 12, marginRight: 'auto' } },
            staged.length + ' file' + (staged.length === 1 ? '' : 's') + ' · ' + prettyBytes(totalBytes))
          : null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
        h(V.Button, { variant: 'primary', iconStart: I.up, onClick: save },
          multi ? 'Upload folder' : 'Upload'))
    },
      h(DropZone, { directory: multi, onFiles: addFiles }),

      staged.length ? h(ui.FormSection, {
        title: 'Ready to upload',
        description: 'Everything here is filed with the settings below.'
      },
        h('div', { className: 'checks' }, staged.map(function (f, i) {
          return h('div', { className: 'checks__row', key: f.name + i },
            h('span', { className: 'empty__mark', style: { width: 28, height: 28 } }, I.file),
            h('div', { className: 'checks__main' },
              h('span', { className: 'checks__name' }, f.name),
              h('span', { className: 'checks__meta' },
                prettyBytes(f.size) + (f.rel && f.rel.indexOf('/') > 0 ? ' · ' + f.rel : ''))),
            h(V.IconButton, {
              icon: I.close, 'aria-label': 'Remove ' + f.name,
              onClick: function () { removeFile(i); }
            }));
        }))) : null,

      multi ? h(V.TextField, Object.assign({
        label: 'Folder name', placeholder: 'e.g. Insurance 2027-28',
        hint: form.errors.folderName || 'Taken from the folder you dropped, if it has one'
      }, form.field('folderName'))) : null,

      h(ui.FieldRow, { cols: 3 },
        h(V.Select, Object.assign({ label: 'Type', options: DOC_KINDS }, form.select('kind'))),
        h(V.TextField, Object.assign({ label: 'Version' }, form.field('version'))),
        h(V.TextField, Object.assign({ label: 'Audience' }, form.field('audience')))));
  }

  /* A file's own panel: the version and audience, who has signed it, and when it lapses. */
  function DocumentDrawer(p) {
    var d = store.find('policies', p.id);
    var renameSt = React.useState(false);
    var confirmSt = React.useState(false);
    if (!d) return null;
    var path = d.folder ? folderPath(d.folder) : [];

    return h(React.Fragment, null,
      h(ui.Drawer, {
        eyebrow: (path.length ? path.map(function (f) { return f.name; }).join(' / ') : 'Library') + ' · ' + (d.kind || 'Document'),
        title: d.name,
        description: d.version + ' · added ' + ui.dateLabel(d.published),
        onClose: p.onClose,
        footer: h(React.Fragment, null,
          /* Plain outline, not the solid danger fill: the destructive moment is the
             confirm dialog, and two filled buttons in one footer compete. */
          p.readOnly ? null : h(V.Button, {
            variant: 'outline', iconStart: I.trash, style: { marginRight: 'auto' },
            onClick: function () { confirmSt[1](true); }
          }, 'Delete'),
          p.readOnly ? null : h(V.Button, { variant: 'outline', iconStart: I.pencil,
            onClick: function () { renameSt[1](true); } }, 'Rename'),
          h(V.Button, { variant: 'primary', iconStart: I.download,
            onClick: function () { ui.toast(d.name + ' ' + d.version + ' download started', 'success'); } }, 'Download'))
      },
        h('div', { className: 'row gap-3 wrap' },
          h(V.Chip, { size: 'sm', shape: 'tag', icon: kindIcon(d.kind) }, d.kind || 'Document'),
          h(V.Chip, { size: 'sm', shape: 'tag' }, d.version)),

        h(ui.KeyValue, { rows: [
          ['Folder', path.length ? path.map(function (f) { return f.name; }).join(' / ') : 'Top level'],
          ['Type', d.kind || 'Document'],
          ['Audience', d.audience],
          ['Added', ui.dateLabel(d.published)],
          ['Size', d.size && d.size !== '—' ? d.size : null]
        ]})),

      renameSt[0] ? h(RenameModal, {
        label: 'document', current: d.name,
        onSave: function (name) { return act.renameDocument(d.id, name); },
        onClose: function () { renameSt[1](false); }
      }) : null,

      confirmSt[0] ? h(ui.Confirm, {
        title: 'Delete this document?',
        body: '"' + d.name + '" is removed from the library. This cannot be undone.',
        confirmLabel: 'Delete', tone: 'danger',
        onConfirm: function () { ui.report(act.deleteDocument(d.id)); p.onClose(); },
        onClose: function () { confirmSt[1](false); }
      }) : null);
  }

  /* One rename dialog for both a document and a folder: same question, same shape. */
  function RenameModal(p) {
    var form = ui.useForm({ name: p.current });
    function save() {
      var res = form.submit(function (v) { return ui.report(p.onSave(v.name)); });
      if (res && res.ok) p.onClose();
    }
    return h(ui.Modal, {
      title: 'Rename ' + p.label,
      description: 'Currently "' + p.current + '".',
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
        h(V.Button, { variant: 'primary', onClick: save }, 'Rename'))
    },
      h(V.TextField, Object.assign({
        label: 'Name', required: true,
        onKeyDown: function (e) { if (e.key === 'Enter') { e.preventDefault(); save(); } }
      }, form.field('name'))));
  }

  /* `readOnly` is the employee's view of the same library: browse, open and download,
     with nothing that writes. The alternative was a second screen that would drift. */
  function documentsLibrary(readOnly) {
    return function () { return h(DocumentsLibrary, { readOnly: readOnly }); };
  }
  function DocumentsLibrary(props) {
    var readOnly = !!(props && props.readOnly);
    var hereSt = React.useState(null);              // current folder id, null = top
    var openSt = React.useState(null);              // open document
    var newFolderSt = React.useState(false);
    var uploadSt = React.useState(null);            // 'file' | 'folder'
    var renameFolderSt = React.useState(null);      // folder being renamed
    var deleteFolderSt = React.useState(null);      // folder being deleted
    var qSt = React.useState('');

    var here = hereSt[0];
    var path = here ? folderPath(here) : [];
    var hereName = path.length ? path[path.length - 1].name : null;
    var q = qSt[0].trim().toLowerCase();

    var all = docFiles();
    var folders = childFolders(here);
    /* A search looks through the whole library, not just the open folder — otherwise
       finding a document means remembering where it was filed. */
    var files = q
      ? all.filter(function (d) {
        return (d.name + ' ' + (d.kind || '') + ' ' + (d.audience || '') + ' ' + d.version).toLowerCase().indexOf(q) >= 0;
      })
      : filesIn(here);

    function go(id) { hereSt[1](id); qSt[1](''); }

    var delTarget = deleteFolderSt[0] ? store.find('docFolders', deleteFolderSt[0]) : null;
    var delCounts = deleteFolderSt[0]
      ? { docs: filesUnder(deleteFolderSt[0]).length, subs: descendantIds(deleteFolderSt[0]).length - 1 }
      : null;

    /* No card and no stat row. This is a file browser: a card around it only drew a
       second border inside the page frame, and the counters pushed the folders down. */
    return h(React.Fragment, null,
      h(ui.PageHead, {
        title: 'Documents & policies',
        description: readOnly
          ? 'Company documents and policies, in folders. Open one to read or download it.'
          : 'Company documents in folders — the handbook, insurance, compliance, templates and the rest. '
            + 'An employee’s own documents are on their profile.'
      }),

      /* One row: where you are, what you are looking for, and what you can add. */
      h('div', { className: 'libbar' },
        h('div', { className: 'libbar__crumbs' },
          h(V.Button, {
            variant: here ? 'ghost' : 'outline', className: 'vi-btn--sm', iconStart: I.home,
            onClick: function () { go(null); }
          }, 'Library'),
          path.map(function (f, i) {
            var last = i === path.length - 1;
            return h('span', { key: f.id, className: 'row gap-2', style: { alignItems: 'center' } },
              h('span', { className: 'muted', style: { fontSize: 13 } }, '/'),
              h(V.Button, {
                variant: last ? 'outline' : 'ghost', className: 'vi-btn--sm',
                onClick: function () { go(f.id); }
              }, f.name));
          })),
        h('div', { className: 'libbar__tools' },
          h(V.SearchField, {
            className: 'libbar__search',
            'aria-label': 'Search the library',
            placeholder: 'Search every folder',
            value: qSt[0], onChange: function (e) { qSt[1](e.target.value); }
          }),
          here && !readOnly ? h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', iconStart: I.pencil,
            onClick: function () { renameFolderSt[1](here); } }, 'Rename') : null,
          here && !readOnly ? h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', iconStart: I.trash,
            onClick: function () { deleteFolderSt[1](here); } }, 'Delete') : null,
          readOnly ? null : h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.folder,
            onClick: function () { newFolderSt[1](true); } }, 'New folder'),
          readOnly ? null : h(UploadMenu, { onPick: function (mode) { uploadSt[1](mode); } }))),

      q ? h('p', { className: 'muted', style: { fontSize: 12, margin: '0 0 10px' } },
        files.length + ' match' + (files.length === 1 ? '' : 'es') + ' across the whole library') : null,

      /* Folders in this location */
      !q && folders.length ? h(ui.FormSection, { title: 'Folders' },
        h('div', { className: 'checks' }, folders.map(function (f) {
          var inside = filesUnder(f.id).length;
          var subs = childFolders(f.id).length;
          return h('div', { className: 'checks__row', key: f.id },
            h('span', { className: 'empty__mark', style: { width: 28, height: 28 } }, I.folder),
            h('div', { className: 'checks__main' },
              h('button', {
                type: 'button', className: 'checks__name linklike',
                onClick: function () { go(f.id); }
              }, f.name),
              h('span', { className: 'checks__meta' },
                inside + ' document' + (inside === 1 ? '' : 's')
                + (subs ? ' · ' + subs + ' subfolder' + (subs === 1 ? '' : 's') : '')
                + (f.description ? ' · ' + f.description : ''))),
            readOnly ? null : h(V.IconButton, { icon: I.pencil, 'aria-label': 'Rename ' + f.name,
              onClick: function () { renameFolderSt[1](f.id); } }),
            readOnly ? null : h(V.IconButton, { icon: I.trash, 'aria-label': 'Delete ' + f.name,
              onClick: function () { deleteFolderSt[1](f.id); } }),
            h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', iconEnd: I.arrow,
              onClick: function () { go(f.id); } }, 'Open'));
        }))) : null,

      /* Files here (or search results). A location that is only folders does not show
         an empty table under them. */
      !q && !files.length && folders.length ? null : h(ui.FormSection, {
        title: q ? 'Search results' : (hereName ? 'Documents in ' + hereName : 'Documents at the top level'),
        description: q ? null : readOnly
          ? 'Open a document to read or download it.'
          : 'Open a document to rename, download or remove it.'
      },
        h(ui.DataTable, {
          exportName: 'company-documents', label: 'Documents', rows: files, pageSize: 10, onExport: true,
          columns: [
            { key: 'name', header: 'Document', sortable: true,
              cell: function (d) {
                return h('span', { className: 'row gap-2', style: { alignItems: 'center' } },
                  h('span', { className: 'empty__mark', style: { width: 26, height: 26 } }, kindIcon(d.kind)),
                  h('button', { type: 'button', className: 'linklike', onClick: function () { openSt[1](d.id); } }, d.name),
                  h(V.Chip, { size: 'sm', shape: 'tag' }, d.version));
              } },
            { key: 'kind', header: 'Type', sortable: true, cell: function (d) { return d.kind || 'Document'; } },
            q ? { key: 'folder', header: 'Folder',
              csv: function (d) { return d.folder ? folderPath(d.folder).map(function (f) { return f.name; }).join(' / ') : ''; },
              cell: function (d) {
                if (!d.folder) return h('span', { className: 'muted' }, 'Top level');
                return h('button', {
                  type: 'button', className: 'linklike',
                  onClick: function () { go(d.folder); }
                }, folderPath(d.folder).map(function (f) { return f.name; }).join(' / '));
              } } : null,
            { key: 'audience', header: 'Audience' },
            { key: 'size', header: 'Size', align: 'right',
              csv: function (d) { return d.size || ''; },
              cell: function (d) {
                return d.size && d.size !== '—' ? d.size : h('span', { className: 'muted' }, '—');
              } },
            { key: 'published', header: 'Added', sortable: true, cell: function (d) { return ui.dateLabel(d.published); } },
            { key: 'actions', header: '', align: 'right',
              cell: function (d) {
                return h(V.Button, { variant: 'ghost', className: 'vi-btn--sm',
                  onClick: function () { openSt[1](d.id); } }, 'Open');
              } }
          ].filter(Boolean),
          emptyIcon: q ? I.search : I.folder,
          emptyTitle: q ? 'Nothing matches "' + qSt[0].trim() + '"' : 'This folder is empty',
          emptyBody: q
            ? 'Try a shorter search, or clear it to browse the folders.'
            : readOnly
              ? 'Nothing has been filed here yet.'
              : 'Upload a document here, or create a folder to organise this part of the library.',
          emptyActions: q || readOnly ? null : h(V.Button, { variant: 'primary', iconStart: I.up,
            onClick: function () { uploadSt[1]('file'); } }, 'Upload a document')
        })),

      newFolderSt[0] ? h(NewFolderModal, {
        parent: here, parentName: hereName, onClose: function () { newFolderSt[1](false); }
      }) : null,
      uploadSt[0] ? h(UploadModal, {
        mode: uploadSt[0], parent: here, parentName: hereName, onClose: function () { uploadSt[1](null); }
      }) : null,
      renameFolderSt[0] ? h(RenameModal, {
        label: 'folder',
        current: (store.find('docFolders', renameFolderSt[0]) || {}).name || '',
        onSave: function (name) { return act.renameFolder(renameFolderSt[0], name); },
        onClose: function () { renameFolderSt[1](null); }
      }) : null,
      delTarget ? h(ui.Confirm, {
        title: 'Delete "' + delTarget.name + '"?',
        body: delCounts.docs || delCounts.subs
          ? 'This also deletes '
            + (delCounts.docs ? delCounts.docs + ' document' + (delCounts.docs === 1 ? '' : 's') : '')
            + (delCounts.docs && delCounts.subs ? ' and ' : '')
            + (delCounts.subs ? delCounts.subs + ' subfolder' + (delCounts.subs === 1 ? '' : 's') : '')
            + ' inside it. This cannot be undone.'
          : 'The folder is empty. This cannot be undone.',
        confirmLabel: 'Delete', tone: 'danger',
        onConfirm: function () {
          var target = deleteFolderSt[0];
          var parent = (store.find('docFolders', target) || {}).parent || null;
          ui.report(act.deleteFolder(target));
          if (here === target) go(parent);
        },
        onClose: function () { deleteFolderSt[1](null); }
      }) : null,
      openSt[0] ? h(DocumentDrawer, { id: openSt[0], readOnly: readOnly, onClose: function () { openSt[1](null); } }) : null);
  }

  /* ========================================================= Assets (PRD 4.29–4.33) */
  var ASSET_STATUSES = ['Available', 'Assigned', 'Under Maintenance', 'Damaged', 'Lost', 'Retired'];

  /* The six states as marks, for the inventory. A column of pills reading "Assigned"
     four hundred times was the widest column in the table and the least informative:
     the state is one of six, so it is a shape and a colour, and the words move into
     the tooltip where there is room for all of them. */
  var STATUS_MARK = {
    'Available': { icon: I.package, tone: 'free' },
    'Assigned': { icon: I.person, tone: 'on' },
    'Under Maintenance': { icon: I.gear, tone: 'svc' },
    'Damaged': { icon: I.warn, tone: 'bad' },
    'Lost': { icon: I.close, tone: 'bad' },
    'Retired': { icon: I.archive, tone: 'off' }
  };

  /* Everything the two columns used to spell out, on one hover: the state, who has
     it and since when, the condition it is in, and where it lives. */
  function statusDetail(a) {
    var out = [a.status];
    if (a.assignedTo) {
      out.push('Held by ' + empName(a.assignedTo)
        + (a.assignedOn ? ' since ' + ui.dateLabel(a.assignedOn) : '')
        + (a.acknowledged === false ? ' \u00b7 handover not acknowledged' : ''));
    } else if (a.status === 'Available') {
      out.push('In the store at ' + locName(a.location));
    }
    out.push('Condition: ' + (a.condition || '\u2014'));
    out.push(locName(a.location) + ' \u00b7 ' + ui.inr(a.value));
    return out.join('\n');
  }
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

  /* The asset register, opened on what it is worth and where it is.

     Built to the reference layout: the position in one line at the top, then the count,
     how much of it is out, what it cost, and where the gaps are. The reference is lime
     on white; this is the product's own palette, because a page that arrives in colours
     the rest of the app never uses reads as somebody else's screen.

     Every number is counted from the register rather than written down, so the page
     cannot drift from the inventory it describes. */
  /* Two glyphs the Tracklivo set does not carry, drawn here rather than imported. */
  function gA(d, sz) {
    return h('svg', { viewBox: '0 0 24 24', width: sz || 18, height: sz || 18, fill: 'none', 'aria-hidden': 'true' },
      h('path', { d: d, stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }));
  }
  var UPA = gA('M7 14l5-5 5 5', 13);
  var SYNCA = gA('M4 10a8 8 0 0 1 13.7-5.6L20 7M20 14a8 8 0 0 1-13.7 5.6L4 17M20 4v3h-3M4 20v-3h3');
  var CHECKA = gA('M5 13l4 4L19 7', 14);
  /* A glyph per asset category. The register held eight kinds of thing and drew a
     cardboard box beside every one of them, so a laptop, an access card and a pair of
     headphones were the same picture — which is the same as no picture at all. These
     are drawn to the icon set's own grid (24px, 1.5 stroke, currentColor) so they sit
     beside the imported ones without looking borrowed.

     `assetIcon` falls back to the box for a category someone adds later: an unfamiliar
     thing drawn as a box is honest, an unfamiliar thing drawn as a laptop is not. */
  var ASSET_ICONS = {
    'Laptop': 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5V16H4V6.5ZM2 16h20l-1 2.2a1.4 1.4 0 0 1-1.3.8H4.3A1.4 1.4 0 0 1 3 18.2L2 16Z',
    'Monitor': 'M3 5.5A1.5 1.5 0 0 1 4.5 4h15A1.5 1.5 0 0 1 21 5.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 14.5v-9ZM12 16v4M8.5 20h7',
    'Mobile Phone': 'M7 4.5A1.5 1.5 0 0 1 8.5 3h7A1.5 1.5 0 0 1 17 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19.5v-15ZM10.5 18h3',
    'Headset': 'M4 15v-3a8 8 0 0 1 16 0v3M4 14h1.8A1.2 1.2 0 0 1 7 15.2v3.6A1.2 1.2 0 0 1 5.8 20H5a1 1 0 0 1-1-1v-5ZM20 14h-1.8a1.2 1.2 0 0 0-1.2 1.2v3.6a1.2 1.2 0 0 0 1.2 1.2h.8a1 1 0 0 0 1-1v-5Z',
    'Keyboard': 'M2.5 7.5A1.5 1.5 0 0 1 4 6h16a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 18H4a1.5 1.5 0 0 1-1.5-1.5v-9ZM6 9.5h.01M9.5 9.5h.01M13 9.5h.01M16.5 9.5h.01M6 12.75h.01M9.5 12.75h.01M13 12.75h.01M16.5 12.75h.01M8 15.5h8',
    'Access Card': 'M2.5 6.5A1.5 1.5 0 0 1 4 5h16a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5v-11ZM6 9.5h5v4H6v-4ZM14 10h4M14 13.5h4',
    'Tablet': 'M5 4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-15ZM10.5 18.2h3',
    'Docking Station': 'M3 11.5A1.5 1.5 0 0 1 4.5 10h15a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15.5v-4ZM7 13h3M14 13h3M8 10V7.5A1.5 1.5 0 0 1 9.5 6h5A1.5 1.5 0 0 1 16 7.5V10'
  };
  function assetIcon(category, size) {
    var d = ASSET_ICONS[category];
    return d ? gA(d, size || 18) : I.package;
  }

  function num(n) { return Number(n || 0).toLocaleString('en-IN'); }

  function assetRing(pct) {
    var R = 54, C = 2 * Math.PI * R;
    var on = Math.max(0, Math.min(100, pct)) / 100 * C;
    return h('div', { className: 'ast-ring' },
      h('svg', { viewBox: '0 0 140 140', 'aria-hidden': 'true' },
        h('circle', { cx: 70, cy: 70, r: R, fill: 'none', stroke: 'var(--bg-muted)', strokeWidth: 9 }),
        h('circle', {
          cx: 70, cy: 70, r: R, fill: 'none', stroke: 'var(--brand-solid)', strokeWidth: 9,
          strokeLinecap: 'round', strokeDasharray: on + ' ' + (C - on),
          transform: 'rotate(-90 70 70)'
        })),
      h('span', { className: 'ast-ring__mid' },
        h('b', null, pct.toFixed(1) + '%'),
        h('span', null, 'Assigned')));
  }

  /* ---------- the hero's isometric illustration ----------
     A desk-top platform holding the register's kinds of thing — a laptop with a chart on
     it, a monitor, a stack of boxes, a phone — drawn as isometric cuboids. Every face is
     a token colour (top light, left mid, right dark), so it follows the accent and works
     in dark mode. Decoration: it carries no data, so it is hidden from the reading order. */
  var ISO_C = Math.cos(Math.PI / 6), ISO_S = 0.5;
  function isoPt(x, y, z) { return [(x - y) * ISO_C, (x + y) * ISO_S - z]; }
  function isoPoly(pts) { return pts.map(function (q) { var v = isoPt(q[0], q[1], q[2]); return v[0].toFixed(1) + ',' + v[1].toFixed(1); }).join(' '); }
  /* One box: x,y on the floor, z up; w along x, d along y, ht up. */
  function cuboid(key, x, y, z, w, d, ht, tone) {
    var X = x + w, Y = y + d, Z = z + ht;
    return h('g', { key: key, className: 'iso iso--' + tone },
      h('polygon', { className: 'iso__l', points: isoPoly([[x, Y, z], [X, Y, z], [X, Y, Z], [x, Y, Z]]) }),
      h('polygon', { className: 'iso__r', points: isoPoly([[X, y, z], [X, Y, z], [X, Y, Z], [X, y, Z]]) }),
      h('polygon', { className: 'iso__t', points: isoPoly([[x, y, Z], [X, y, Z], [X, Y, Z], [x, Y, Z]]) }));
  }
  /* A flat panel standing on its back edge (a screen), facing the viewer's left. */
  function panel(key, x, y, z, w, ht, tone) {
    return h('g', { key: key, className: 'iso iso--' + tone },
      h('polygon', { className: 'iso__l', points: isoPoly([[x, y, z], [x + w, y, z], [x + w, y, z + ht], [x, y, z + ht]]) }),
      h('polygon', { className: 'iso__r', points: isoPoly([[x + w, y - 3, z], [x + w, y, z], [x + w, y, z + ht], [x + w, y - 3, z + ht]]) }),
      h('polygon', { className: 'iso__t', points: isoPoly([[x, y - 3, z + ht], [x + w, y - 3, z + ht], [x + w, y, z + ht], [x, y, z + ht]]) }));
  }
  /* A face filled with one of the gradients defined below, for the plinth's sides. */
  function face(key, pts, fill, cls) {
    return h('polygon', { key: key, points: isoPoly(pts), fill: fill, className: cls || null });
  }
  /* The isometric grid scored into the platform's top, so it reads as a surface. */
  function isoGrid(x0, y0, size, z, step) {
    var out = [];
    for (var t = step; t < size; t += step) {
      out.push(h('polyline', { key: 'gx' + t, className: 'ast-iso__grid', points: isoPoly([[x0 + t, y0, z], [x0 + t, y0 + size, z]]) }));
      out.push(h('polyline', { key: 'gy' + t, className: 'ast-iso__grid', points: isoPoly([[x0, y0 + t, z], [x0 + size, y0 + t, z]]) }));
    }
    return out;
  }

  function AssetIso() {
    var bars = [14, 22, 17, 28];
    /* Two tiers: a deep plinth, and a lighter platform stood on it. Their sides are lit
       from the top left — the left faces lighter, the right faces darker — through
       gradients, so the base has real depth rather than flat colour. */
    var P = { x: -80, y: -80, s: 160, h: 22 };      // the plinth
    var T = { x: -66, y: -66, s: 132, h: 9 };       // the platform on it
    var Z = P.h + T.h;                              // where the objects stand
    return h('svg', { className: 'ast-iso', viewBox: '-150 -122 300 214', 'aria-hidden': 'true' },
      h('defs', null,
        h('linearGradient', { id: 'isoPL', x1: 0, y1: 0, x2: 0, y2: 1 },
          h('stop', { offset: 0, style: { stopColor: 'var(--iso-l1)' } }),
          h('stop', { offset: 1, style: { stopColor: 'var(--iso-l2)' } })),
        h('linearGradient', { id: 'isoPR', x1: 0, y1: 0, x2: 0, y2: 1 },
          h('stop', { offset: 0, style: { stopColor: 'var(--iso-r1)' } }),
          h('stop', { offset: 1, style: { stopColor: 'var(--iso-r2)' } })),
        h('linearGradient', { id: 'isoTT', x1: 0, y1: 0, x2: 1, y2: 1 },
          h('stop', { offset: 0, style: { stopColor: 'var(--bg-surface)' } }),
          h('stop', { offset: 1, style: { stopColor: 'var(--brand-softer)' } })),
        h('filter', { id: 'isoBlur', x: '-20%', y: '-50%', width: '140%', height: '200%' },
          h('feGaussianBlur', { stdDeviation: 7 }))),

      h('ellipse', { cx: 0, cy: 86, rx: 132, ry: 22, className: 'ast-iso__shadow', filter: 'url(#isoBlur)' }),

      /* From here down the scene is grouped by what moves together, so the drawing can
         assemble itself: the base unfolds, then each object settles onto it, and then
         everything breathes. The grouping is the only reason these are nested — the
         geometry is unchanged. */
      h('g', { className: 'isoG isoG--base' },
      /* the plinth */
      face('pl', [[P.x, P.y + P.s, 0], [P.x + P.s, P.y + P.s, 0], [P.x + P.s, P.y + P.s, P.h], [P.x, P.y + P.s, P.h]], 'url(#isoPL)'),
      face('pr', [[P.x + P.s, P.y, 0], [P.x + P.s, P.y + P.s, 0], [P.x + P.s, P.y + P.s, P.h], [P.x + P.s, P.y, P.h]], 'url(#isoPR)'),
      face('pt', [[P.x, P.y, P.h], [P.x + P.s, P.y, P.h], [P.x + P.s, P.y + P.s, P.h], [P.x, P.y + P.s, P.h]], null, 'ast-iso__ledge'),
      /* a thin light line along the plinth's front edges, where the light catches */
      h('polyline', { className: 'ast-iso__edge', points: isoPoly([[P.x, P.y + P.s, P.h], [P.x + P.s, P.y + P.s, P.h], [P.x + P.s, P.y, P.h]]) }),

      /* the platform */
      face('tl', [[T.x, T.y + T.s, P.h], [T.x + T.s, T.y + T.s, P.h], [T.x + T.s, T.y + T.s, Z], [T.x, T.y + T.s, Z]], null, 'ast-iso__tl'),
      face('tr', [[T.x + T.s, T.y, P.h], [T.x + T.s, T.y + T.s, P.h], [T.x + T.s, T.y + T.s, Z], [T.x + T.s, T.y, Z]], null, 'ast-iso__tr'),
      face('tt', [[T.x, T.y, Z], [T.x + T.s, T.y, Z], [T.x + T.s, T.y + T.s, Z], [T.x, T.y + T.s, Z]], 'url(#isoTT)', 'ast-iso__top'),
      isoGrid(T.x, T.y, T.s, Z, 22)),

      /* boxes, back right */
      h('g', { className: 'isoG isoG--boxes' },
        cuboid('b1', 22, -56, Z, 34, 34, 30, 'warm'),
        cuboid('b2', 22, -20, Z, 34, 30, 22, 'warm'),
        cuboid('b3', 26, -52, Z + 30, 26, 26, 22, 'warm'),
        h('polyline', { className: 'ast-iso__tape', points: isoPoly([[39, -56, Z + 30], [39, -56, Z]]) })),
      /* monitor, back left */
      h('g', { className: 'isoG isoG--mon' },
        cuboid('mstand', -50, -50, Z, 16, 12, 4, 'grey'),
        cuboid('mneck', -45, -46, Z + 4, 5, 4, 20, 'grey'),
        panel('mon', -62, -40, Z + 20, 40, 30, 'dark')),
      /* laptop, front */
      h('g', { className: 'isoG isoG--lap' },
        cuboid('lbase', -36, 4, Z, 52, 36, 3, 'grey'),
        panel('lscr', -36, 4, Z + 3, 52, 32, 'dark'),
        bars.map(function (bh, i) {
          var x0 = -30 + i * 11;
          return h('polygon', { key: 'bar' + i, className: 'ast-iso__bar' + (i === 3 ? ' is-hi' : ''),
            points: isoPoly([[x0, 3.6, Z + 7], [x0 + 6, 3.6, Z + 7], [x0 + 6, 3.6, Z + 7 + bh * 0.8], [x0, 3.6, Z + 7 + bh * 0.8]]) });
        })),
      /* phone, front right */
      h('g', { className: 'isoG isoG--phone' }, cuboid('phone', 28, 30, Z, 14, 24, 2, 'dark')),
      /* a sparkle and a mote, floating */
      h('path', { className: 'ast-iso__spark', d: 'M104 -104l4 9.5 9.5 3.5-9.5 3.5-4 9.5-4-9.5-9.5-3.5 9.5-3.5 4-9.5Z' }),
      h('circle', { className: 'ast-iso__dot', cx: -116, cy: -48, r: 4 }));
  }

  /* What "Needs attention" opens. The row already knows which records it counted, so
     the dialog lists exactly those and offers the one thing to do with them, rather
     than dropping you on a tab to find them again.

     The actions are the ones the register already owns: a request becomes an issued
     unit, a return is recorded against the asset, and a unit in service comes back to
     the pool. Nothing here invents a decision — approving a request is still
     Tracklivo's. */
  function AttentionModal(p) {
    var it = p.item;
    var doneSt = React.useState({});

    /* The list is read once, when the dialog opens, and kept. Reading it live would
       make a row disappear the moment you settled it, which is the one thing you did
       not want to happen — you want to see that it is done. */
    var rowsSt = React.useState(function () {
      if (it.k === 'requests') {
        return store.collection('assetRequests')
          .filter(function (r) { return r.status === 'Pending Approval'; })
          .map(function (r) {
            return { id: r.id, t: r.category || 'Asset request',
              s: empName(r.employee) + ' \u00b7 ' + (r.kind || 'New asset')
                + (r.reason ? ' \u00b7 ' + r.reason : ''),
              cat: r.category, rec: r };
          });
      }
      if (it.k === 'returns') {
        return liveExits().reduce(function (out, c) {
          return out.concat(assetsHeldBy(c.employee).map(function (a) {
            return { id: a.id, t: a.name, s: empName(c.employee) + ' \u00b7 last day '
              + ui.dateLabel(c.lastWorkingDay), cat: a.category, rec: a };
          }));
        }, []);
      }
      return store.collection('assets')
        .filter(function (a) { return a.status === 'Under Maintenance'; })
        .map(function (a) {
          return { id: a.id, t: a.name, s: a.category + ' \u00b7 ' + locName(a.location)
            + ' \u00b7 ' + a.condition, cat: a.category, rec: a };
        });
    });
    var rows = rowsSt[0];

    var VERB = {
      requests: { label: 'Issue a unit', done: 'issued', empty: 'Every request has been settled.' },
      returns: { label: 'Record the return', done: 'returned', empty: 'Nothing is outstanding from an exit.' },
      service: { label: 'Back to the pool', done: 'returned to the pool', empty: 'Nothing is out of circulation.' }
    }[it.k];

    function run(row) {
      if (it.k === 'requests') {
        store.setOverride('assetRequests', row.id, { status: 'Approved' });
        store.log('issued a unit for ' + row.id, 'User activity');
      } else {
        store.setOverride('assets', row.id, { status: 'Available', assignedTo: null });
        store.log((it.k === 'returns' ? 'recorded the return of ' : 'returned to the pool: ') + row.id, 'User activity');
      }
      var next = Object.assign({}, doneSt[0]); next[row.id] = true; doneSt[1](next);
      ui.toast(row.t + ' ' + VERB.done, 'success');
    }

    return h(ui.Modal, {
      wide: true,
      title: it.t + ' \u00b7 ' + num(rows.length),
      description: it.s + '. Settle them here, or open the tab for the full record.',
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: function () { p.onClose(); router.go(it.to); } },
          'Open the full tab'),
        h(V.Button, { variant: 'primary', onClick: p.onClose }, 'Done'))
    },
      rows.length
        ? h('div', { className: 'attn' }, rows.map(function (row) {
            var gone = !!doneSt[0][row.id];
            return h('div', { className: 'attn__r' + (gone ? ' is-done' : ''), key: row.id },
              h('span', { className: 'attn__i' }, assetIcon((row.rec && row.rec.category) || it.t, 17)),
              h('span', { className: 'attn__m' },
                h('strong', null, row.t),
                h('span', null, row.s)),
              gone
                ? h('span', { className: 'attn__ok' }, CHECKA, VERB.done)
                : h(V.Button, { variant: 'outline', className: 'vi-btn--sm',
                    onClick: function () { run(row); } }, VERB.label));
          }))
        : h(ui.Done, { title: 'Nothing waiting', body: VERB.empty }));
  }

  function AssetsDashboard() {
    var attnSt = React.useState(null);
    var assets = store.collection('assets');
    var requests = store.collection('assetRequests');
    var exits = liveExits();
    var dueBack = exits.reduce(function (n, c) { return n + assetsHeldBy(c.employee).length; }, 0);

    var total = assets.length;
    var assigned = assets.filter(function (a) { return a.status === 'Assigned'; });
    var available = assets.filter(function (a) { return a.status === 'Available'; });
    var service = assets.filter(function (a) { return a.status === 'Under Maintenance'; });
    var openReq = requests.filter(function (r) { return r.status === 'Pending Approval'; });
    var value = assets.reduce(function (n, a) { return n + (a.value || 0); }, 0);
    var pct = total ? (assigned.length / total) * 100 : 0;

    /* Category rows, biggest first, with the bar scaled to the largest so the shape of
       the inventory is readable rather than every bar being nearly full. */
    var cats = seed.assetCategories.map(function (name) {
      var inCat = assets.filter(function (a) { return a.category === name; });
      return {
        name: name,
        units: inCat.length,
        assigned: inCat.filter(function (a) { return a.status === 'Assigned'; }).length,
        available: inCat.filter(function (a) { return a.status === 'Available'; }).length,
        value: inCat.reduce(function (n, a) { return n + (a.value || 0); }, 0)
      };
    }).filter(function (c) { return c.units; }).sort(function (a, b) { return b.units - a.units; });
    var widest = cats.reduce(function (m, c) { return Math.max(m, c.units); }, 1);
    var byValue = cats.slice().sort(function (a, b) { return b.value - a.value; });
    var topValue = byValue.reduce(function (m, c) { return Math.max(m, c.value); }, 1);

    /* What needs an admin. Each row opens a dialog that does the thing, rather than
       navigating to the tab and leaving you to find it again: the row already knows
       which records it is counting, so making you look them up a second time is work
       the screen could have done. */
    var ATTENTION = [
      { k: 'requests', t: 'Open requests', s: 'Waiting on a unit from the register',
        n: openReq.length, icon: I.warn, tone: 'warning', to: 'admin/assets/requests' },
      { k: 'returns', t: 'Pending returns', s: 'Still held by someone who is leaving',
        n: dueBack, icon: SYNCA, tone: 'info', to: 'admin/assets/returns' },
      { k: 'service', t: 'Under maintenance', s: 'Out of circulation until it comes back',
        n: service.length, icon: SYNCA, tone: 'neutral', to: 'admin/assets/maintenance' }
    ];

    /* The value split. One category holds three quarters of the money, so five bars
       scaled to the largest drew one bar and four stubs — a chart that said nothing
       except "laptops are expensive", which the number above it already said. A share
       bar says the thing the split is actually about: where the money is. */
    var valueTotal = byValue.reduce(function (n, c) { return n + c.value; }, 0) || 1;

    return h(React.Fragment, null,
      /* The headline position, before any number is broken down. */
      h('section', { className: 'ast-hero' },
        h('div', { className: 'ast-hero__copy' },
          h('span', { className: 'ast-hero__eyebrow' }, 'Asset operations'),
          h('h1', null, 'Your asset ecosystem ', h('em', null, 'at a glance.')),
          /* The headline number: the size of the register, and what it is worth. */
          h('div', { className: 'ast-hero__n' },
            h('b', null, num(total)),
            h('span', null, h('strong', null, 'assets on the register'),
              h('small', null, num(assigned.length) + ' in use · ' + ui.inr(value, { short: true }) + ' in value')))),
        h('div', { className: 'ast-hero__art', 'aria-hidden': 'true' }, h(AssetIso)),
        h('div', { className: 'ast-hero__pills' },
          [['In use', assigned.length, 'is-on'], ['Available', available.length, 'is-free'], ['Service', service.length, 'is-svc']]
            .map(function (x) {
              return h('span', { className: 'ast-pill ' + x[2], key: x[0] },
                h('i', null), h('span', { className: 'grow' }, x[0]), h('b', null, num(x[1])));
            }))),

      /* What the money is in, and what is waiting on somebody — the two things an
         admin opens this page to act on, so they come first. The breakdown below is
         reference: true, useful, and not urgent. */
      h(Grid, null,
        h(Card, { span: 7, title: 'Value by category',
          description: 'Where the ' + ui.inr(value, { short: true }) + ' on the register actually sits.' },
          h('div', { className: 'ast-share' },
            h('span', { className: 'ast-share__bar', 'aria-hidden': 'true' },
              byValue.map(function (c, i) {
                return h('i', { key: c.name, className: 'is-t' + Math.min(i, 4),
                  style: { flex: Math.max(c.value, valueTotal * 0.004) },
                  title: c.name + ' · ' + ui.inr(c.value, { short: true }) });
              })),
            h('div', { className: 'ast-share__key' }, byValue.slice(0, 4).map(function (c, i) {
              return h('span', { key: c.name, className: 'ast-share__k is-t' + i },
                h('i', null),
                h('strong', null, c.name),
                h('span', null, Math.round(c.value / valueTotal * 100) + '%'));
            }))),
          h(ui.DataTable, {
            exportName: 'asset-value-by-category', label: 'Value by category', rows: byValue.map(function (c, i) {
              return Object.assign({ id: 'cat-' + i }, c);
            }), pageSize: 8,
            search: function (c) { return c.name; }, searchPlaceholder: 'Search categories',
            columns: [
              { key: 'name', header: 'Category', sortable: true,
                cell: function (c) {
                  return h('span', { className: 'ast-cell' },
                    h('span', { className: 'ast-cell__i' }, assetIcon(c.name, 16)), c.name);
                } },
              /* Three numbers, not four. The amounts were being cut off at the card's
                 edge — the wrapper hides its overflow — because the table could not get
                 narrower than its headings: "Assigned" and "Available" are eight and
                 nine characters over cells of one to three digits, and a column cannot
                 shrink below the word at the top of it. Explicit widths did nothing,
                 since a width under a column's own min-content is ignored.

                 So one column goes instead. This card answers where the money sits;
                 how much of it is out on loan is the hero's three pills directly
                 above, and the Allocations tab unit by unit. Dropping Assigned takes
                 the table's floor from 585px to about 460px, which fits the card at
                 every width down to the point where the grid gives it the whole row. */
              { key: 'units', header: 'Units', numeric: true, align: 'right', sortable: true },
              { key: 'available', header: 'Available', numeric: true, align: 'right', sortable: true },
              { key: 'value', header: 'Value', numeric: true, align: 'right', sortable: true,
                csv: function (c) { return c.value; },
                /* The space is non-breaking. Dropping the column took the table's floor
                   under the card, but at 1241 the Value column still lands at 101px and
                   the short form wants 66px of its 65px of content, so between 1241 and
                   1273 "₹43.63" sat on one line and "L" on the next — a different number.
                   Measured with a Range over the text node: a cell's own client rect
                   stays 1 however the text inside it breaks, which is how this was
                   missed the first time. */
                cell: function (c) { return ui.inr(c.value, { short: true }).replace(/ /g, '\u00a0'); } }
            ],
            emptyIcon: I.package, emptyTitle: 'Nothing in the register yet'
          })),

        h(Card, { span: 5, title: 'Needs attention',
          description: 'Each one opens where it can be settled.' },
          h('div', { className: 'lrows' }, ATTENTION.map(function (a) {
            return h('button', { type: 'button', className: 'lrow lrow--go', key: a.t,
              onClick: function () { attnSt[1](a); } },
              h('span', { className: 'lrow__ico' }, a.icon),
              h('span', { className: 'lrow__m' }, h('strong', null, a.t), h('span', null, a.s)),
              h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: a.n ? a.tone : 'neutral' }, num(a.n)),
              h('span', { className: 'lrow__go', 'aria-hidden': 'true' }, I.right));
          })),
          /* When nothing is waiting, say so rather than showing three zeroes. */
          ATTENTION.every(function (a) { return !a.n; })
            ? h(ui.Done, { title: 'Nothing is waiting', body: 'Every request is settled and every asset is where it should be.' })
            : null)),

      /* The breakdown. The count that used to open this row has gone: the hero says
         786 four inches above it, and saying it twice made the page look like two
         dashboards stacked. */
      h('section', { className: 'ast-top ast-top--3' },
        h('div', { className: 'ast-top__c' }, assetRing(pct)),

        h('div', { className: 'ast-top__c ast-brk' },
          [[I.checklist, assigned.length, 'Assigned'], [I.package, available.length, 'Available'],
           [SYNCA, dueBack, 'Pending returns'], [I.warn, openReq.length, 'Open requests']]
            .map(function (x, i) {
              return h('div', { className: 'ast-brk__r', key: i },
                h('span', { className: 'ast-brk__i' + (i === 3 ? ' is-warn' : '') }, x[0]),
                h('b', null, num(x[1])),
                h('span', { className: 'muted' }, x[2]));
            })),

        h('div', { className: 'ast-top__c ast-val' },
          h('span', { className: 'muted' }, 'Total asset value'),
          h('span', { className: 'ast-val__n' }, ui.inr(value, { short: true })),
          h('span', { className: 'delta delta--up' }, UPA, '+12.4%'),
          h('span', { className: 'muted' }, 'vs. last quarter'))),

      h(Card, { title: 'Inventory by category' },
        h('div', { className: 'ast-cats' }, cats.map(function (c) {
          return h('div', { className: 'ast-cat', key: c.name },
            h('span', { className: 'ast-cat__i' }, assetIcon(c.name)),
            h('div', { className: 'ast-cat__b' },
              h('div', { className: 'ast-cat__top' },
                h('span', { className: 'grow' }, c.name),
                h('b', null, num(c.units))),
              h('span', { className: 'ast-cat__bar' },
                h('i', { style: { width: Math.round(c.units / widest * 100) + '%' } }))));
        }))),

      attnSt[0] ? h(AttentionModal, { item: attnSt[0], onClose: function () { attnSt[1](null); } }) : null);
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
        description: 'PRD 4.29: every asset with its serial, warranty, condition, location and current holder. '
          + 'The category and the state are marks — hover either one for the rest.',
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
            /* The asset ID and the serial used to be columns of their own. Eleven
               columns is more than this table has room for, and neither of those two
               is read on its own — they are how you identify the thing in the row
               beside them. So they sit under the name, and the table fits. */
            { key: 'name', header: 'Asset', sortable: true,
              /* The export still carries all three, because a spreadsheet has no
                 subtext line to put them on. */
              csv: function (a) { return a.name + ' (' + a.id + ' · ' + a.serial + ')'; },
              cell: function (a) {
                return { children: a.name, subtext: a.id + ' · ' + a.serial };
              } },
            /* The category was the word, repeated down four hundred rows: eleven
               identical "Access Card" cells say nothing the icon beside them does
               not. It is the mark now, with the word on hover and in the export,
               and the width it used to take goes to the name and the holder. */
            { key: 'category', header: 'Category', width: 104, align: 'center', sortable: true,
              cell: function (a) {
                /* The word is in the cell, hidden, rather than only in the tooltip:
                   `aria-describedby` is read when a control takes focus, and a screen
                   reader walking the table row by row never focuses this. Not a tab
                   stop either — twenty-five rows of two marks apiece put fifty stops
                   between the search box and the first thing anybody wants to press. */
                return h(ui.Tip, { text: a.category, focusable: false },
                  h('span', { className: 'ast-mark' }, assetIcon(a.category, 18)),
                  h('span', { className: 'vi-sr' }, a.category));
              } },
            { key: 'location', header: 'Location', width: 132, csv: function (a) { return locName(a.location); },
              cell: function (a) { return locName(a.location); } },
            { key: 'value', header: 'Value', width: 112, numeric: true, align: 'right', sortable: true,
              csv: function (a) { return a.value; },
              cell: function (a) { return ui.inr(a.value).replace(/ /g, '\u00a0'); } },
            { key: 'warranty', header: 'Warranty', width: 134, sortable: true, csv: function (a) { return a.warranty || ''; },
              cell: function (a) {
                if (!a.warranty) return h('span', { className: 'muted' }, '—');
                return a.warranty < today()
                  ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'neutral' }, 'Expired')
                  : ui.dateLabel(a.warranty);
              } },
            /* Condition had a column of its own for a word nobody sorts, filters or
               acts on — it is what you read once you have already found the asset.
               The status tooltip carries it now, and so does the status column's
               export, which is where a spreadsheet would look for it. */
            { key: 'assignedTo', header: 'Holder', csv: function (a) { return a.assignedTo ? empName(a.assignedTo) : ''; },
              cell: function (a) { return a.assignedTo ? person(a.assignedTo, null) : h('span', { className: 'muted' }, 'In store'); } },
            /* "Under Maintenance" set the width of this column for every row in the
               table, most of which say "Assigned". The mark carries the state; the
               tooltip carries everything the two columns used to spell out. */
            { key: 'status', header: 'Status', width: 92, align: 'center',
              csv: function (a) { return a.status + ' (' + (a.condition || '—') + ')'; },
              cell: function (a) {
                var m = STATUS_MARK[a.status] || STATUS_MARK.Retired;
                return h(ui.Tip, { text: statusDetail(a), focusable: false },
                  h('span', { className: 'ast-state is-' + m.tone }, m.icon),
                  h('span', { className: 'vi-sr' }, statusDetail(a).replace(/\n/g, '. ')));
              } },
            { key: 'actions', header: '', width: 118, align: 'right',
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
            { key: 'acknowledged', header: 'Receipt',
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

  /* Asset requests, as the asset register sees them.

     Requests are raised and decided in Tracklivo. The approval is not this app's, so
     there is no chain here, no approver and no approve or reject: what the register
     needs to know is whether a unit is waiting to be issued. "Ready to issue" is a
     request Tracklivo has cleared; "In Tracklivo" is one still being decided there. */
  /* Neutral on purpose: the same chip is read by the person who asked, for whom
     “waiting on you” would be wrong, and by IT, for whom it is exactly right. */
  var REQ_WORD = { 'Pending Approval': 'Being decided', Approved: 'Ready to issue', Rejected: 'Declined' };
  var REQ_TONE = { 'Pending Approval': 'neutral', Approved: 'success', Rejected: 'error' };
  function reqChip(status) {
    return h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: REQ_TONE[status] || 'neutral' }, REQ_WORD[status] || status);
  }
  HRMS.assetRequestChip = reqChip;

  /* ---------- Ara on this screen ----------
     The rule itself is in js/actions.js, because onboarding applies the same one.
     What is here is how it is shown: Ara says what it decided and why, the rule is
     one click away rather than folklore, and the switch is the only thing that
     turns it off. */
  var ARA_MARK = h('svg', { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', 'aria-hidden': 'true' },
    h('path', { d: 'M12 3.2l1.9 4.7 4.9 1.8-4.9 1.8L12 16.2l-1.9-4.7-4.9-1.8 4.9-1.8L12 3.2Z', fill: 'currentColor' }),
    h('circle', { cx: 18.4, cy: 17.6, r: 2.1, fill: 'currentColor', opacity: .85 }),
    h('circle', { cx: 6.2, cy: 18.4, r: 1.3, fill: 'currentColor', opacity: .6 }));

  function AraRuleModal(p) {
    var cap = ui.inr(act.araAssetCap);
    var queue = act.araAssetQueue();
    var mine = queue.filter(function (x) { return x.verdict.approve; });
    var theirs = queue.filter(function (x) { return !x.verdict.approve; });
    return h(ui.Modal, {
      title: 'What Ara decides', wide: true,
      description: 'Two cases, and nothing else. Ara never issues — a unit only moves onto '
        + 'somebody’s name when IT hands it over.',
      onClose: p.onClose,
      footer: h(V.Button, { variant: 'primary', onClick: p.onClose }, 'Close')
    },
      h('div', { className: 'arule' },
        h('div', { className: 'arule__r' },
          h('span', { className: 'arule__n' }, '1'),
          h('span', { className: 'arule__m' },
            h('strong', null, 'A replacement for something they already hold'),
            h('span', null, 'A repair request against a unit on their own name. The entitlement '
              + 'is not in question — only which unit. A card that snapped in a lanyard does not '
              + 'need a manager.'))),
        h('div', { className: 'arule__r' },
          h('span', { className: 'arule__n' }, '2'),
          h('span', { className: 'arule__m' },
            h('strong', null, 'Standard kit, under ' + cap),
            h('span', null, 'A category whose dearest unit on the register is at or under ' + cap
              + '. Read off the register rather than written as a list, so a category added next '
              + 'year is judged by what it costs.'))),
        h('div', { className: 'arule__r is-off' },
          h('span', { className: 'arule__n' }, '—'),
          h('span', { className: 'arule__m' },
            h('strong', null, 'Everything else waits for you'),
            h('span', null, 'A first laptop, a phone, a second monitor, anything over the cap '
              + 'that is not a replacement.')))),

      h('div', { className: 'ara-tags', style: { marginTop: 18 } },
        h('span', { className: 'ara-tag ara-tag--info' }, mine.length + ' waiting that Ara would take'),
        h('span', { className: 'ara-tag' }, theirs.length + ' that need you')),

      queue.length
        ? h('div', { className: 'ara-pick__list' }, queue.map(function (x) {
            return h('div', { className: 'arule__q' + (x.verdict.approve ? ' is-ara' : ''), key: x.request.id },
              h('span', { className: 'arule__q__i' }, x.verdict.approve ? ARA_MARK : I.person),
              h('span', { className: 'arule__m' },
                h('strong', null, x.request.category + ' · ' + empName(x.request.employee)),
                h('span', null, x.verdict.why)));
          }))
        : h('p', { className: 'muted', style: { marginTop: 14 } }, 'Nothing is waiting to be decided.'));
  }

  function AssetRequests() {
    var statusSt = React.useState('');
    var ruleSt = React.useState(false);
    var auto = store.pref('araAssetAuto') !== false;

    /* With the switch on, Ara decides what its rule covers as soon as the screen is
       opened, which is what "automatically" has to mean for a queue nobody is
       watching. Turning it off leaves every request for a person. */
    var waiting = store.collection('assetRequests')
      .filter(function (r) { return r.status === 'Pending Approval'; }).length;
    React.useEffect(function () {
      if (!auto) return;
      var pending = act.araAssetQueue().filter(function (x) { return x.verdict.approve; });
      if (!pending.length) return;
      var res = act.araDecideAssetRequests();
      if (res && res.n) ui.toast(res.message, 'success');
    }, [auto, waiting]);

    var all = store.collection('assetRequests');
    var rows = statusSt[0] ? all.filter(function (r) { return REQ_WORD[r.status] === statusSt[0]; }) : all;
    function count(st) { return all.filter(function (r) { return r.status === st; }).length; }

    var queue = act.araAssetQueue();
    var araWould = queue.filter(function (x) { return x.verdict.approve; });
    var byAra = all.filter(function (r) { return r.decidedBy === 'Ara'; });

    function decide(r, ok) {
      ui.report(act.decideAssetRequest(r.id, ok, (store.persona('admin') || {}).name || 'IT'));
    }

    return h(React.Fragment, null,
      h(Stats, null,
        h(Stat, { key: 1, label: 'Ready to issue', value: count('Approved'), sub: 'Decided — waiting on a unit and a handover', tone: count('Approved') ? 'warn' : 'good' }),
        h(Stat, { key: 2, label: 'Available to issue', value: store.collection('assets').filter(function (a) { return a.status === 'Available'; }).length,
          sub: 'Units in the store across all categories' }),
        h(Stat, { key: 3, label: 'Waiting on you', value: count('Pending Approval'), sub: 'Outside what Ara decides', tone: count('Pending Approval') ? 'warn' : 'good' }),
        h(Stat, { key: 4, label: 'Decided by Ara', value: byAra.length, sub: 'Every one of them logged with its reason' })),

      /* Ara speaks before the table, because what it has already done changes how the
         table reads. */
      h('div', { className: 'adm-say ara-band' },
        h('span', { className: 'adm-say__m' }, ARA_MARK),
        h('p', null,
          auto
            ? (byAra.length
                ? h(React.Fragment, null, h('strong', null, 'Ara decided ' + byAra.length + ' of these.'),
                    ' Replacements of something the person already holds, and standard kit under '
                    + ui.inr(act.araAssetCap) + '. '
                    + (count('Pending Approval')
                        ? count('Pending Approval') + ' need you: they are over the cap, or they are a first unit rather than a replacement.'
                        : 'Nothing else is waiting.'))
                : h(React.Fragment, null, h('strong', null, 'Ara is watching this queue.'),
                    ' Nothing waiting falls inside its rule, so everything here is yours.'))
            : h(React.Fragment, null, h('strong', null, 'Ara is switched off here.'),
                ' Every request waits for a person, including the '
                + araWould.length + ' it would otherwise take.')),
        h('div', { className: 'ara-band__c' },
          h('button', { type: 'button', className: 'dash__link', onClick: function () { ruleSt[1](true); } },
            'What Ara decides', I.right),
          h(V.Switch, {
            size: 'sm', label: 'Decide automatically', checked: auto,
            onChange: function (e) {
              store.setPref('araAssetAuto', e.target.checked);
              ui.toast(e.target.checked
                ? 'Ara will decide the requests its rule covers.'
                : 'Ara will leave every request for a person.');
            }
          }))),

      h(Card, {
        title: 'Asset requests',
        description: 'From Tracklivo and from the portal. Ara decides the two cases its rule covers; '
          + 'the rest wait for you. Issuing a unit is IT’s either way.',
        aside: h(HRMS.assetRequest.Button, { role: 'admin', employee: (store.persona('admin') || {}).id,
          variant: 'outline', label: 'Raise a request' })
      },
        h(ui.DataTable, {
          exportName: 'asset-requests', label: 'Asset requests', rows: rows, pageSize: 10,
          search: function (r) { return empName(r.employee) + ' ' + r.id + ' ' + r.category + ' ' + r.reason; },
          searchPlaceholder: 'Search by employee, category or reason',
          filters: h(ui.Filter, { label: 'Status', value: statusSt[0], onChange: statusSt[1],
            options: ['Ready to issue', 'Being decided', 'Declined'] }),
          columns: [
            { key: 'id', header: 'Request', width: 96, cell: function (r) { return h('span', { className: 'mono' }, r.id); } },
            { key: 'employee', header: 'Employee', sortable: true,
              sortValue: function (r) { return empName(r.employee); },
              csv: function (r) { return empName(r.employee); },
              cell: function (r) { return person(r.employee); } },
            /* The category as its mark, as in the inventory: eight categories, each
               one shape, with the word a hover away. */
            { key: 'category', header: 'Category', width: 92, align: 'center', sortable: true,
              cell: function (r) {
                return h(ui.Tip, { text: r.category + '\n' + (r.kind || 'New asset'), focusable: false },
                  h('span', { className: 'ast-mark' }, assetIcon(r.category, 18)),
                  h('span', { className: 'vi-sr' }, r.category + ' \u00b7 ' + (r.kind || 'New asset')));
              } },
            { key: 'reason', header: 'Reason' },
            { key: 'requestedOn', header: 'Requested', width: 124, sortable: true, cell: function (r) { return ui.dateLabel(r.requestedOn); } },
            /* Who decided it, and on what grounds. An automatic approval nobody can
               read back is not an approval, so the reason is always one hover away. */
            { key: 'decidedBy', header: 'Decided by', width: 128,
              csv: function (r) { return r.decidedBy || ''; },
              cell: function (r) {
                if (!r.decidedBy) return h('span', { className: 'muted' }, '—');
                if (r.decidedBy !== 'Ara') {
                  return h(ui.Tip, { text: r.decidedBy + '\n' + (r.decidedWhy || 'Decided by hand.') },
                    h('span', { className: 'dby' }, r.decidedBy.split(' ')[0]));
                }
                return h(ui.Tip, { text: 'Ara · ' + ui.dateLabel(r.decidedOn) + '\n' + (r.decidedWhy || '') },
                  h('span', { className: 'dby dby--ara' }, ARA_MARK, 'Ara'));
              } },
            { key: 'status', header: 'Status', width: 128, csv: function (r) { return REQ_WORD[r.status] || r.status; },
              cell: function (r) { return reqChip(r.status); } },
            { key: 'actions', header: '', width: 188, align: 'right',
              cell: function (r) {
                if (r.status === 'Approved') {
                  var unit = r.reserved && store.find('assets', r.reserved);
                  return h(ui.Tip, {
                    text: unit
                      ? unit.name + ' · ' + unit.id + ' is set aside. Issuing moves it onto their name.'
                      : 'Nothing of this category is free. Issuing waits for a return or a purchase.'
                  },
                    h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.package,
                      onClick: function () { router.go('admin/assets/allocations'); } }, 'Issue a unit'));
                }
                if (r.status !== 'Pending Approval') return null;
                /* Only the ones Ara will not take get a pair of buttons: a request Ara
                   has already decided is not waiting for anybody to press anything. */
                return h('span', { className: 'row gap-2', style: { justifyContent: 'flex-end' } },
                  h(V.Button, { variant: 'outline', className: 'vi-btn--sm',
                    onClick: function () { decide(r, false); } }, 'Decline'),
                  h(V.Button, { variant: 'primary', className: 'vi-btn--sm',
                    onClick: function () { decide(r, true); } }, 'Approve'));
              } }
          ],
          emptyIcon: I.checklist, emptyTitle: 'No asset requests',
          emptyBody: 'Requests raised in Tracklivo, or in the portal, arrive here once they exist.'
        })),

      ruleSt[0] ? h(AraRuleModal, { onClose: function () { ruleSt[1](false); } }) : null);
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
        h(Card, { span: 12, title: 'Out of circulation',
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

        h(Card, { span: 6, title: 'Out of circulation by category' },
          h(ui.Bars, { rows: distribution(out, function (a) { return a.category; }), emptyTitle: 'Nothing out of circulation' })),

        h(Card, { span: 6, title: 'Service rules' },
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

  /* ---------------------------------------------------------- Onboarding form builder
     PRD 4.7 gives a template per employee type and department. "New Onboarding" collects
     the two identifying facts first (name, employee type), then opens a builder for the
     form the joiner fills in *before* their start date.

     The flow deliberately stops at Document verification: everything past it (IT setup,
     asset allocation, orientation) happens after the joiner is on site, so it is not
     something a pre-joining form can ask for. */
  var ONB_FORM_STAGES = ['Personal information', 'Employment details', 'Document collection', 'Document verification'];

  /* The sections a pre-joining form is built from. `kind` drives the default field type
     and the icon, so a section reads as what it is without extra configuration. */
  var ONB_SECTIONS = [
    { id: 'personal', title: 'Personal information', icon: 'person', kind: 'text',
      description: 'Identity and contact details the record needs before day one.' },
    { id: 'education', title: 'Education', icon: 'reports', kind: 'text',
      description: 'Qualifications and the certificates that evidence them.' },
    { id: 'documents', title: 'Documents to sign', icon: 'file', kind: 'esign',
      description: 'Anything the joiner signs or uploads ahead of verification.' },
    { id: 'policies', title: 'Policies', icon: 'shield', kind: 'ack',
      description: 'Policies the joiner reads and acknowledges.' }
  ];

  var ONB_FIELD_TYPES = [
    { value: 'text', label: 'Short text' },
    { value: 'long', label: 'Long text' },
    { value: 'date', label: 'Date' },
    { value: 'number', label: 'Number' },
    { value: 'choice', label: 'Dropdown' },
    { value: 'upload', label: 'File upload' },
    { value: 'esign', label: 'E-signature' },
    { value: 'ack', label: 'Acknowledgement' }
  ];
  function fieldTypeLabel(t) {
    var found = ONB_FIELD_TYPES.filter(function (x) { return x.value === t; })[0];
    return found ? found.label : t;
  }
  function sectionMeta(id) {
    return ONB_SECTIONS.filter(function (s) { return s.id === id; })[0] || ONB_SECTIONS[0];
  }

  /* The catalog the AI draft is assembled from. Each entry is [section, label, type,
     required, keywords]. Keywords are what a prompt is matched against; an entry with
     `core` true is in every draft regardless of the prompt. */
  var ONB_CATALOG = [
    ['personal', 'Full name as per records', 'text', true, 'name personal identity', true],
    ['personal', 'Date of birth', 'date', true, 'dob birth age personal', true],
    ['personal', 'Personal email address', 'text', true, 'email contact personal', true],
    ['personal', 'Mobile number', 'text', true, 'phone mobile contact personal', true],
    ['personal', 'Current residential address', 'long', true, 'address residence personal', true],
    ['personal', 'Emergency contact name and number', 'text', true, 'emergency contact', false],
    ['personal', 'Blood group', 'choice', false, 'blood medical health', false],
    ['personal', 'Nationality', 'choice', false, 'nationality passport visa', false],

    ['education', 'Highest qualification', 'choice', true, 'education qualification degree', true],
    ['education', 'Institution name', 'text', true, 'education institution college university', true],
    ['education', 'Specialisation', 'text', false, 'education specialisation branch stream', true],
    ['education', 'Year of passing', 'number', true, 'education year passing graduation', true],
    ['education', 'Percentage or CGPA', 'number', false, 'education marks cgpa percentage grade', false],
    ['education', 'Degree certificate', 'upload', true, 'education certificate degree document', true],
    ['education', 'Consolidated marksheet', 'upload', false, 'education marksheet transcript document', false],
    ['education', 'Professional certifications', 'long', false, 'education certification course training', false],

    ['documents', 'Government photo ID', 'upload', true, 'id document kyc aadhaar passport', true],
    ['documents', 'PAN card', 'upload', true, 'pan tax document kyc', true],
    ['documents', 'Passport-size photograph', 'upload', true, 'photo photograph document', true],
    ['documents', 'Previous employment relieving letter', 'upload', false, 'experience relieving previous employment document', false],
    ['documents', 'Bank account proof for payroll', 'upload', true, 'bank payroll salary account document', true],
    ['documents', 'Offer letter acceptance', 'esign', true, 'offer letter sign acceptance', true],
    ['documents', 'Employment agreement', 'esign', true, 'agreement contract employment sign', true],
    ['documents', 'Non-disclosure agreement', 'esign', true, 'nda confidentiality disclosure sign', true],
    ['documents', 'Intellectual property assignment', 'esign', false, 'ip intellectual property sign', false],
    ['documents', 'Background verification consent', 'esign', false, 'background verification bgv consent sign', false],

    ['policies', 'Code of conduct', 'ack', true, 'policy conduct ethics', true],
    ['policies', 'Information security policy', 'ack', true, 'policy security information data', true],
    ['policies', 'Acceptable use of IT assets', 'ack', false, 'policy it asset acceptable use', false],
    ['policies', 'Leave and attendance policy', 'ack', true, 'policy leave attendance', true],
    ['policies', 'Anti-harassment and POSH policy', 'ack', true, 'policy harassment posh grievance', true],
    ['policies', 'Travel and expense policy', 'ack', false, 'policy travel expense reimbursement', false],
    ['policies', 'Work-from-home policy', 'ack', false, 'policy remote wfh hybrid', false]
  ];

  var onbFieldSeq = 0;
  function onbField(section, label, type, required) {
    onbFieldSeq += 1;
    return { id: 'fld-' + onbFieldSeq, section: section, label: label, type: type, required: !!required };
  }

  /* A draft from the catalog. With no prompt this is the core set; with one, every entry
     whose keywords the prompt mentions is pulled in on top. Deterministic on purpose —
     the prototype has no model behind it, and a draft that changes under the same prompt
     would read as a bug. */
  function draftForm(prompt, employeeType) {
    var words = String(prompt || '').toLowerCase().match(/[a-z]+/g) || [];
    var intern = /intern|trainee/i.test(employeeType || '');
    var contract = /contract|consultant|vendor/i.test(employeeType || '');
    return ONB_CATALOG.filter(function (row) {
      /* Interns have no prior employment to evidence; contractors sign rather than enrol. */
      if (intern && /relieving/.test(row[1])) return false;
      if (contract && /Leave and attendance/.test(row[1])) return false;
      if (row[5]) return true;
      if (!words.length) return false;
      var keys = row[4].split(' ');
      return words.some(function (w) { return keys.indexOf(w) >= 0; });
    }).map(function (row) { return onbField(row[0], row[1], row[2], row[3]); });
  }

  /* Step 2 of the flow: the builder itself. Fields live in the parent so switching back
     to step 1 and forward again does not lose the draft. */
  function OnboardingFormBuilder(p) {
    var fields = p.fields, setFields = p.setFields;
    var promptSt = React.useState('');
    var addSt = React.useState({ section: 'education', label: '', type: 'text' });
    var add = addSt[0];

    function generate() {
      var next = draftForm(promptSt[0], p.employeeType);
      setFields(next);
      ui.toast('Drafted ' + next.length + ' fields across ' + ONB_SECTIONS.length + ' sections', 'success');
    }
    function addField() {
      var label = add.label.trim();
      if (!label) { ui.toast('Give the field a label first', 'error'); return; }
      setFields(fields.concat([onbField(add.section, label, add.type, false)]));
      addSt[1](Object.assign({}, add, { label: '' }));
    }
    function removeField(id) { setFields(fields.filter(function (f) { return f.id !== id; })); }
    function toggleRequired(id) {
      setFields(fields.map(function (f) { return f.id === id ? Object.assign({}, f, { required: !f.required }) : f; }));
    }
    /* Move within the section, so a field never silently changes which section it is in. */
    function move(id, dir) {
      var field = fields.filter(function (f) { return f.id === id; })[0];
      if (!field) return;
      var peers = fields.filter(function (f) { return f.section === field.section; });
      var at = peers.indexOf(field);
      var to = at + dir;
      if (to < 0 || to >= peers.length) return;
      var reordered = peers.slice();
      reordered.splice(at, 1);
      reordered.splice(to, 0, field);
      var queue = reordered.slice();
      setFields(fields.map(function (f) { return f.section === field.section ? queue.shift() : f; }));
    }

    return h('div', { className: 'stack gap-4' },
      /* ---- AI draft ---- */
      h('div', { className: 'ai-note' },
        h('span', { className: 'ai-note__mark' }, I.robot),
        h('div', { className: 'ai-note__body' },
          h('span', { className: 'ai-note__eyebrow' }, 'Build with AI'),
          h('p', { className: 'ai-note__text' },
            'Describe what the joiner should be asked for and a draft form is assembled. '
            + 'Everything it produces stays editable below, and you can skip it and build the form by hand.'),
          h(V.TextArea, {
            label: 'What should this onboarding collect?', rows: 2,
            placeholder: 'e.g. degree certificates, NDA and IP agreement, security and POSH policies, bank proof for payroll',
            value: promptSt[0], onChange: function (e) { promptSt[1](e.target.value); }
          }),
          h('div', { className: 'ai-note__acts' },
            h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.bolt, onClick: generate },
              fields.length ? 'Redraft form' : 'Generate form'),
            h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.trash,
              onClick: function () { setFields([]); } }, 'Clear all')))),

      /* ---- Stage strip: what this form covers, and where it stops ---- */
      h('div', { className: 'stack gap-2' },
        h('span', { className: 'eyebrow' }, 'Pre-joining stages'),
        h('div', { className: 'row gap-2', style: { flexWrap: 'wrap' } },
          ONB_FORM_STAGES.map(function (stage, i) {
            return h(V.Chip, { key: stage, size: 'sm', shape: 'tag',
              variant: i === ONB_FORM_STAGES.length - 1 ? 'soft' : undefined,
              tone: i === ONB_FORM_STAGES.length - 1 ? 'success' : undefined }, stage);
          })),
        h('p', { className: 'muted', style: { fontSize: 12, lineHeight: 1.6, margin: 0 } },
          'The form runs up to document verification. Anything after it needs the joiner on site, '
          + 'so it is handled on the onboarding case rather than asked for here.')),

      /* ---- Sections ---- */
      ONB_SECTIONS.map(function (section) {
        var mine = fields.filter(function (f) { return f.section === section.id; });
        return h(ui.FormSection, {
          key: section.id,
          title: section.title + ' · ' + mine.length + (mine.length === 1 ? ' field' : ' fields'),
          description: section.description
        },
          mine.length
            ? h('div', { className: 'checks' }, mine.map(function (f, i) {
              return h('div', { className: 'checks__row', key: f.id },
                h('span', { className: 'empty__mark', style: { width: 28, height: 28 } }, I[section.icon] || I.forms),
                h('div', { className: 'checks__main' },
                  h('span', { className: 'checks__name' }, f.label),
                  h('span', { className: 'checks__meta' },
                    fieldTypeLabel(f.type) + ' · ' + (f.required ? 'required' : 'optional'))),
                h(V.Chip, {
                  size: 'sm', shape: 'tag',
                  variant: f.required ? 'soft' : undefined, tone: f.required ? 'warning' : undefined,
                  onClick: function () { toggleRequired(f.id); }
                }, f.required ? 'Required' : 'Optional'),
                h(V.IconButton, { icon: I.up, 'aria-label': 'Move "' + f.label + '" up',
                  disabled: i === 0, onClick: function () { move(f.id, -1); } }),
                h(V.IconButton, { icon: I.down, 'aria-label': 'Move "' + f.label + '" down',
                  disabled: i === mine.length - 1, onClick: function () { move(f.id, 1); } }),
                h(V.IconButton, { icon: I.trash, 'aria-label': 'Remove "' + f.label + '"',
                  onClick: function () { removeField(f.id); } }));
            }))
            : h('p', { className: 'muted', style: { fontSize: 13, margin: 0 } },
              'Nothing asked for yet. Add a field below, or draft the form with AI.'));
      }),

      /* ---- Manual add ---- */
      h(ui.FormSection, { title: 'Add a field by hand', description: 'Pick the section it belongs to and what kind of answer it takes.' },
        h(ui.FieldRow, { cols: 3 },
          h(V.Select, {
            label: 'Section', value: add.section,
            options: ONB_SECTIONS.map(function (s) { return { value: s.id, label: s.title }; }),
            onChange: function (v) {
              /* Follow the section's natural answer type, unless one was chosen already. */
              addSt[1](Object.assign({}, add, { section: v, type: sectionMeta(v).kind }));
            }
          }),
          h(V.TextField, {
            label: 'Question or field label', placeholder: 'e.g. Highest qualification',
            value: add.label,
            onChange: function (e) { addSt[1](Object.assign({}, add, { label: e.target.value })); },
            onKeyDown: function (e) { if (e.key === 'Enter') { e.preventDefault(); addField(); } }
          }),
          h(V.Select, {
            label: 'Answer type', value: add.type, options: ONB_FIELD_TYPES,
            onChange: function (v) { addSt[1](Object.assign({}, add, { type: v })); }
          })),
        h('div', { className: 'row gap-2' },
          h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.plus, onClick: addField }, 'Add field'))));
  }

  /* The two-step flow behind "New Onboarding". */
  function NewOnboardingModal(p) {
    var stepSt = React.useState(1);
    var fieldsSt = React.useState([]);
    var form = ui.useForm({ name: '', employeeType: 'Full-Time', department: 'All' }, function (v) {
      var errs = {};
      if (!String(v.name || '').trim()) errs.name = 'Give the onboarding a name';
      if (!v.employeeType) errs.employeeType = 'Pick an employee type';
      return errs;
    });

    function next() { form.submit(function () { stepSt[1](2); return { ok: true }; }); }
    function save() {
      var fields = fieldsSt[0];
      if (!fields.length) { ui.toast('Add at least one field before saving', 'error'); return; }
      var v = form.values;
      store.add('onboardingTemplates', {
        id: 'tpl-' + Date.now().toString(36),
        name: String(v.name).trim(),
        employeeType: v.employeeType,
        department: v.department || 'All',
        tasks: ONB_FORM_STAGES.length,
        status: 'Draft',
        form: fields
      });
      store.log('Created onboarding template "' + String(v.name).trim() + '" with ' + fields.length + ' form fields');
      ui.toast('"' + String(v.name).trim() + '" saved as a draft template', 'success');
      p.onClose();
    }

    var atBuilder = stepSt[0] === 2;
    return h(ui.Modal, {
      title: atBuilder ? 'Build the onboarding form' : 'New onboarding',
      wide: atBuilder,
      description: atBuilder
        ? 'What "' + (String(form.values.name).trim() || 'this onboarding') + '" asks a '
          + form.values.employeeType + ' joiner for before their start date.'
        : 'Name it and pick who it applies to. The form builder opens next.',
      onClose: p.onClose,
      footer: atBuilder
        ? h(React.Fragment, null,
          h(V.Button, { variant: 'ghost', iconStart: I.back, onClick: function () { stepSt[1](1); } }, 'Back'),
          h('span', { className: 'muted', style: { fontSize: 12, marginRight: 'auto' } },
            fieldsSt[0].length + (fieldsSt[0].length === 1 ? ' field' : ' fields') + ' · '
            + fieldsSt[0].filter(function (f) { return f.required; }).length + ' required'),
          h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: save }, 'Save onboarding'))
        : h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
          h(V.Button, { variant: 'primary', iconStart: I.arrow, onClick: next }, 'Continue to form builder'))
    },
      atBuilder
        ? h(OnboardingFormBuilder, {
          fields: fieldsSt[0], setFields: fieldsSt[1], employeeType: form.values.employeeType
        })
        : h('div', { className: 'stack gap-3' },
          h(V.TextField, Object.assign({
            label: 'Onboarding name', placeholder: 'e.g. Graduate engineer onboarding'
          }, form.field('name', { hint: 'Shown wherever the template is picked' }))),
          h(ui.FieldRow, { cols: 2 },
            h(V.Select, Object.assign({
              label: 'Employee type',
              options: ['Full-Time', 'Part-Time', 'Contract', 'Intern']
            }, form.select('employeeType', { hint: 'Decides which joiners this form is offered to' }))),
            h(V.Select, Object.assign({
              label: 'Department',
              options: [{ value: 'All', label: 'All departments' }].concat(
                store.collection('departments').map(function (d) { return { value: d.name, label: d.name }; }))
            }, form.select('department'))))));
  }

  function OnboardingConfig() {
    var templates = store.collection('onboardingTemplates');
    var newSt = React.useState(false);
    return h(React.Fragment, null,
      h(Grid, null,
        h(Card, { span: 12, title: 'Onboarding templates',
          description: 'PRD 4.7: a template per employee type and department. The template chosen when a record is created decides the checklist.',
          aside: h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus,
            onClick: function () { newSt[1](true); } }, 'New Onboarding')
        },
          h(ui.DataTable, {
            exportName: 'config-onboarding-templates', label: 'Onboarding templates', rows: templates, pageSize: 10,
            search: function (t) { return t.name + ' ' + t.employeeType; }, searchPlaceholder: 'Search templates',
            columns: [
              { key: 'name', header: 'Template', sortable: true },
              { key: 'employeeType', header: 'Employee type' },
              { key: 'department', header: 'Department' },
              { key: 'tasks', header: 'Tasks', numeric: true, align: 'right', sortable: true },
              { key: 'form', header: 'Form fields', numeric: true, align: 'right', sortable: true,
                sortValue: function (t) { return t.form ? t.form.length : -1; },
                csv: function (t) { return t.form ? t.form.length : ''; },
                cell: function (t) {
                  return t.form
                    ? h('span', null, t.form.length)
                    : h('span', { className: 'muted' }, '—');
                } },
              { key: 'status', header: 'Status', cell: function (t) { return h(ui.StatusChip, { status: t.status }); } }
            ],
            emptyIcon: I.template, emptyTitle: 'No templates configured',
            emptyBody: 'Without a template a new record gets the standard task list.',
            emptyActions: h(V.Button, { variant: 'primary', iconStart: I.plus,
              onClick: function () { newSt[1](true); } }, 'New Onboarding')
          }))),
      newSt[0] ? h(NewOnboardingModal, { onClose: function () { newSt[1](false); } }) : null);
  }

  /* ====================================== Offboarding configuration (PRD 4.48)
     The clearance checklist used to be eight strings with the owner worked out
     from the step's name by a regular expression. It is built here now: a
     checklist per kind of leaver, each an ordered list of steps with an owner, an
     approver, when it falls relative to the last working day, and whether it
     blocks the settlement. Submitting a resignation builds the case's tasks from
     whichever checklist matches, so what is set here is what an exit clears. */
  var CHECKLIST_SCOPE = ['All'];
  var CHECKLIST_STATUS = ['Active', 'Inactive'];

  function ownerOptions() { return seed.exitOwners; }
  function scopeOptions() {
    return CHECKLIST_SCOPE.concat(store.collection('employeeTypes').map(function (t) { return t.name; }))
      .map(function (v) { return { value: v, label: v === 'All' ? 'Every leaver' : v + ' only' }; });
  }
  /* "3 days before the last working day", and so on. */
  function whenLabel(after) {
    var n = Number(after) || 0;
    return n === 0 ? 'On the last working day'
      : n < 0 ? Math.abs(n) + ' day' + (Math.abs(n) === 1 ? '' : 's') + ' before'
        : n + ' day' + (n === 1 ? '' : 's') + ' after';
  }

  function ChecklistModal(p) {
    var c = p.checklist;
    var form = ui.useForm(c
      ? { name: c.name, appliesTo: c.appliesTo, description: c.description || '', status: c.status || 'Active' }
      : { name: '', appliesTo: 'All', description: '', status: 'Active' });
    var stepsSt = React.useState(c
      ? c.steps.map(function (s) { return Object.assign({}, s); })
      : [{ name: '', owner: 'HR Administrator', approver: 'Reporting Manager', after: 0, mandatory: true, gate: false }]);
    var steps = stepsSt[0];

    function setStep(i, patch) {
      stepsSt[1](steps.map(function (s, n) { return n === i ? Object.assign({}, s, patch) : s; }));
    }
    function addStep() {
      stepsSt[1](steps.concat([{ name: '', owner: 'HR Administrator', approver: 'HR Administrator',
        after: 0, mandatory: true, gate: false }]));
    }
    function removeStep(i) { stepsSt[1](steps.filter(function (_, n) { return n !== i; })); }
    function move(i, by) {
      var to = i + by;
      if (to < 0 || to >= steps.length) return;
      var next = steps.slice();
      var tmp = next[i]; next[i] = next[to]; next[to] = tmp;
      stepsSt[1](next);
    }
    function save() {
      var res = form.submit(function (v) {
        var payload = Object.assign({}, v, { steps: steps });
        return ui.report(c ? act.updateExitChecklist(c.id, payload) : act.createExitChecklist(payload));
      });
      if (res && res.ok) p.onClose();
    }

    return h(ui.Modal, {
      title: c ? 'Edit ' + c.name : 'New exit checklist',
      description: 'The steps an exit has to clear, in the order they happen.',
      wide: true,
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
        h(V.Button, { variant: 'primary', onClick: save }, c ? 'Save changes' : 'Create checklist'))
    },
      h(ui.FormSection, { title: 'What it covers' },
        h(ui.FieldRow, null,
          h(V.TextField, Object.assign({ label: 'Checklist name', required: true,
            placeholder: 'e.g. Senior leaver clearance' }, form.field('name'))),
          h(V.Select, Object.assign({ label: 'Applies to', options: scopeOptions(),
            hint: 'A checklist naming an employee type wins over the one for everyone' },
            form.select('appliesTo')))),
        h(V.TextField, Object.assign({ label: 'Description',
          placeholder: 'When this checklist is the one that runs' }, form.field('description'))),
        h(V.Select, Object.assign({ label: 'Status', options: CHECKLIST_STATUS }, form.select('status')))),

      h(ui.FormSection, { title: 'Steps',
        description: 'Each step has somebody who does it and somebody who signs it off. '
          + 'Timing is relative to the last working day.' },
        steps.length
          ? h('div', { className: 'xsteps' }, steps.map(function (st, i) {
              return h('div', { className: 'xstep', key: i },
                h('span', { className: 'xstep__n' }, i + 1),
                h('div', { className: 'xstep__grid' },
                  h('div', { className: 'xstep__f xstep__f--wide' },
                    h(V.TextField, { label: 'Step', value: st.name, placeholder: 'e.g. Asset return',
                      onChange: function (e) { setStep(i, { name: e.target.value }); } })),
                  h('div', { className: 'xstep__f' },
                    h(V.Select, { label: 'Owner', options: ownerOptions(), value: st.owner,
                      onChange: function (e) { setStep(i, { owner: e.target.value }); } })),
                  h('div', { className: 'xstep__f' },
                    h(V.Select, { label: 'Approver', options: ownerOptions(), value: st.approver,
                      onChange: function (e) { setStep(i, { approver: e.target.value }); } })),
                  h('div', { className: 'xstep__f xstep__f--num' },
                    h(V.NumberField, { label: 'Day', value: st.after, min: -180, max: 180,
                      hint: whenLabel(st.after),
                      onChange: function (e) { setStep(i, { after: Number(e.target.value) }); } }))),
                h('div', { className: 'xstep__side' },
                  h('label', { className: 'xstep__t' },
                    h(V.Checkbox, { checked: st.mandatory !== false,
                      'aria-label': 'Step ' + (i + 1) + ' is mandatory',
                      onChange: function (e) { setStep(i, { mandatory: e.target.checked }); } }),
                    h('span', null, 'Mandatory')),
                  h('label', { className: 'xstep__t' },
                    h(V.Checkbox, { checked: !!st.gate,
                      'aria-label': 'Step ' + (i + 1) + ' blocks the settlement',
                      onChange: function (e) { setStep(i, { gate: e.target.checked }); } }),
                    h('span', null, 'Blocks settlement')),
                  h('span', { className: 'row gap-1' },
                    h(V.IconButton, { icon: I.up, title: 'Move up', 'aria-label': 'Move step ' + (i + 1) + ' up',
                      disabled: i === 0, onClick: function () { move(i, -1); } }),
                    h(V.IconButton, { icon: I.down, title: 'Move down', 'aria-label': 'Move step ' + (i + 1) + ' down',
                      disabled: i === steps.length - 1, onClick: function () { move(i, 1); } }),
                    h(V.IconButton, { icon: I.trash, title: 'Remove', 'aria-label': 'Remove step ' + (i + 1),
                      onClick: function () { removeStep(i); } }))));
            }))
          : h('div', { className: 'chain__empty' }, 'No steps yet. An exit with nothing to clear closes itself.'),
        h('div', { className: 'row gap-2' },
          h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.plus, onClick: addStep },
            'Add step')),
        form.errors.steps
          ? h('p', { style: { color: 'var(--danger-fg)', fontSize: 13, margin: 0 } }, form.errors.steps)
          : null),

      (function () {
        var bound = ['name', 'appliesTo', 'description', 'status', 'steps'];
        var loose = Object.keys(form.errors || {}).filter(function (k) { return bound.indexOf(k) < 0; })
          .map(function (k) { return form.errors[k]; });
        return loose.length
          ? h('p', { style: { color: 'var(--danger-fg)', fontSize: 13, margin: 0 } }, loose.join(' · '))
          : null;
      }()));
  }

  /* The steps of one checklist, read-only, opened from its row. */
  function ChecklistDrawer(p) {
    var c = p.checklist;
    return h(ui.Drawer, {
      eyebrow: c.appliesTo === 'All' ? 'Every leaver' : c.appliesTo + ' only',
      title: c.name, description: c.description || 'The steps an exit on this checklist has to clear.',
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Close'),
        h(V.Button, { variant: 'primary', iconStart: I.pencil,
          onClick: function () { p.onClose(); p.onEdit(c); } }, 'Edit checklist'))
    },
      h(ui.KeyValue, { rows: [
        ['Checklist ID', h('span', { className: 'mono' }, c.id)],
        ['Applies to', c.appliesTo === 'All' ? 'Every leaver' : c.appliesTo + ' only'],
        ['Steps', c.steps.length + ' · ' + c.steps.filter(function (s) { return s.mandatory !== false; }).length + ' mandatory'],
        ['Blocks settlement', c.steps.filter(function (s) { return s.gate; }).map(function (s) { return s.name; }).join(', ') || 'Nothing'],
        ['Status', h(ui.StatusChip, { status: c.status || 'Active' })]
      ]}),
      h('div', { className: 'stack gap-2' },
        h('span', { className: 'eyebrow' }, 'Order of play'),
        h('div', { className: 'steps' }, c.steps.map(function (st, i) {
          return h('div', { className: 'steps__row', key: i },
            h('span', { className: 'steps__tick' }, I.check),
            h('span', null, (i + 1) + '. ' + st.name + ' — ' + st.owner
              + ', signed off by ' + st.approver + ' · ' + whenLabel(st.after).toLowerCase()
              + (st.gate ? ' · blocks settlement' : '')
              + (st.mandatory === false ? ' · optional' : '')));
        }))));
  }

  function OffboardingConfig() {
    var editSt = React.useState(null);     // null | false (new) | checklist
    var openSt = React.useState(null);
    var killSt = React.useState(null);
    var cases = offboardingCases();
    var lists = store.collection('exitChecklists');
    var open = openSt[0] && store.find('exitChecklists', openSt[0]);
    var kill = killSt[0] && store.find('exitChecklists', killSt[0]);

    return h(Grid, null,
      h(Card, { span: 12, title: 'Exit clearance checklists',
        description: 'What an exit has to clear, who does each step and who signs it off. '
          + 'A resignation picks up the checklist that matches the leaver (PRD 4.48).',
        aside: h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus,
          onClick: function () { editSt[1](false); } }, 'New checklist') },
        h(ui.DataTable, {
          exportName: 'exit-checklists', label: 'Exit clearance checklists', rows: lists, pageSize: 10,
          search: function (c) { return c.name + ' ' + c.appliesTo + ' ' + (c.description || ''); },
          searchPlaceholder: 'Search checklists',
          columns: [
            { key: 'name', header: 'Checklist', sortable: true,
              cell: function (c) {
                return h('div', { className: 'stack gap-1' },
                  h('button', { type: 'button', className: 'link',
                    onClick: function () { openSt[1](c.id); } }, c.name),
                  c.description ? h('span', { className: 'list__meta' }, c.description) : null);
              } },
            { key: 'appliesTo', header: 'Applies to',
              cell: function (c) {
                return h(V.Chip, { size: 'sm', shape: 'tag' },
                  c.appliesTo === 'All' ? 'Every leaver' : c.appliesTo);
              } },
            { key: 'steps', header: 'Steps', numeric: true, align: 'right', sortable: true,
              sortValue: function (c) { return c.steps.length; },
              csv: function (c) { return c.steps.map(function (s) { return s.name; }).join(' → '); },
              cell: function (c) { return c.steps.length; } },
            { key: 'owners', header: 'Owners',
              csv: function (c) { return c.steps.map(function (s) { return s.owner; }).join('; '); },
              cell: function (c) {
                var seen = [];
                c.steps.forEach(function (s) { if (seen.indexOf(s.owner) < 0) seen.push(s.owner); });
                return h('span', { className: 'row gap-2 wrap' }, seen.map(function (o) {
                  return h(V.Chip, { key: o, size: 'sm', shape: 'tag', variant: 'soft', tone: 'neutral' }, o);
                }));
              } },
            { key: 'gates', header: 'Blocks settlement', numeric: true, align: 'right',
              csv: function (c) { return c.steps.filter(function (s) { return s.gate; }).length; },
              cell: function (c) {
                var n = c.steps.filter(function (s) { return s.gate; }).length;
                return n ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning' }, n + ' gated')
                  : h('span', { className: 'muted' }, 'None');
              } },
            { key: 'status', header: 'Status',
              csv: function (c) { return c.status || 'Active'; },
              cell: function (c) { return h(ui.StatusChip, { status: c.status || 'Active' }); } },
            { key: 'actions', header: 'Action', align: 'right', csv: false,
              cell: function (c) {
                return h('span', { className: 'row gap-1', style: { justifyContent: 'flex-end' } },
                  h(V.IconButton, { icon: I.pencil, title: 'Edit', 'aria-label': 'Edit ' + c.name,
                    onClick: function () { editSt[1](c); } }),
                  h(V.IconButton, { icon: I.trash, title: 'Delete', 'aria-label': 'Delete ' + c.name,
                    onClick: function () { killSt[1](c.id); } }));
              } }
          ],
          emptyIcon: I.checklist, emptyTitle: 'No exit checklists yet',
          emptyBody: 'Without one, a resignation would open with nothing to clear.',
          emptyActions: h(V.Button, { variant: 'primary', iconStart: I.plus,
            onClick: function () { editSt[1](false); } }, 'New checklist')
        })),

      h(Card, { span: 7, title: 'Notice rules' },
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

      h(Card, { span: 5, title: 'Who owns a step',
        description: 'What each owner resolves to when a resignation opens.' },
        h(ui.KeyValue, { rows: [
          ['HR Administrator', 'The HR account on the organisation'],
          ['Reporting Manager', 'The leaver’s own manager'],
          ['Department Head', 'The head of the leaver’s department'],
          ['IT Administrator', 'The IT account, for access and assets'],
          ['Finance Controller', 'Finance, for the settlement'],
          ['Facilities', 'Whoever holds the building and the cards'],
          ['Organization Admin', 'The admin account']
        ]})),

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
        })),

      editSt[0] !== null ? h(ChecklistModal, {
        checklist: editSt[0] || null, onClose: function () { editSt[1](null); }
      }) : null,
      open ? h(ChecklistDrawer, {
        checklist: open, onClose: function () { openSt[1](null); },
        onEdit: function (c) { editSt[1](c); }
      }) : null,
      kill ? h(ui.Confirm, {
        title: 'Delete ' + kill.name + '?',
        body: 'Exits already open keep the steps they were given. Nothing new picks up this checklist.',
        confirmLabel: 'Delete', tone: 'danger',
        onConfirm: function () { ui.report(act.deleteExitChecklist(kill.id)); },
        onClose: function () { killSt[1](null); }
      }) : null);
  }

  /* ---------------------------------------------------------------- Register */
  /* ====================================================== HR's asset requests
     HR does not hold the register, so this is not a second copy of it: it is the
     asking. What HR raises — most of it a joiner's kit before day one — and where
     Tracklivo has got to with each one. Issuing stays with admin. */
  function HrAssetRequests() {
    var mePersona = store.persona('hr') || {};
    var chip = HRMS.assetRequestChip;
    var all = store.collection('assetRequests');
    /* Raised by HR, or for somebody whose onboarding is still open: both are HR's to
       follow, however they got here. */
    var joining = {};
    store.collection('onboarding').forEach(function (o) { if (o.stage !== 'Completed') joining[o.employee] = o; });
    var rows = all.filter(function (r) { return r.raisedBy === mePersona.id || joining[r.employee]; });
    var ready = rows.filter(function (r) { return r.status === 'Approved'; }).length;
    var waiting = rows.filter(function (r) { return r.status === 'Pending Approval'; }).length;

    return h(React.Fragment, null,
      h(Stats, null,
        h(Stat, { key: 1, label: 'Waiting on Tracklivo', value: waiting, sub: 'Raised, not yet decided' }),
        h(Stat, { key: 2, label: 'Ready to issue', value: ready, sub: 'Cleared · admin issues the unit', tone: ready ? 'warn' : 'good' }),
        h(Stat, { key: 3, label: 'Joiners onboarding', value: Object.keys(joining).length, sub: 'Each needs a kit for day one' }),
        h(Stat, { key: 4, label: 'Raised by you', value: rows.filter(function (r) { return r.raisedBy === mePersona.id; }).length,
          sub: 'Across joiners and replacements' })),

      h(Card, {
        title: 'Asset requests',
        description: 'Ask for a joiner’s kit before their first day, or for anyone who needs something. ' +
          'Decided in Tracklivo; issued by admin from the register.',
        aside: h(HRMS.assetRequest.Button, { role: 'hr', employee: mePersona.id, kind: 'Onboarding',
          label: 'Raise a request' })
      },
        h(ui.DataTable, {
          exportName: 'hr-asset-requests', label: 'Asset requests', rows: rows, pageSize: 10,
          search: function (r) { return empName(r.employee) + ' ' + r.id + ' ' + r.category + ' ' + r.reason; },
          searchPlaceholder: 'Search by employee, category or reason',
          columns: [
            { key: 'id', header: 'Request', cell: function (r) { return h('span', { className: 'mono' }, r.id); } },
            { key: 'employee', header: 'For', sortable: true,
              sortValue: function (r) { return empName(r.employee); },
              csv: function (r) { return empName(r.employee); },
              cell: function (r) { return person(r.employee); } },
            { key: 'kind', header: 'Kind', cell: function (r) { return r.kind || 'New asset'; } },
            { key: 'category', header: 'Category', sortable: true },
            { key: 'reason', header: 'Reason' },
            { key: 'requestedOn', header: 'Raised', sortable: true, cell: function (r) { return ui.dateLabel(r.requestedOn); } },
            { key: 'status', header: 'Status', csv: function (r) { return r.status; },
              cell: function (r) { return chip ? chip(r.status) : r.status; } }
          ],
          emptyIcon: I.package, emptyTitle: 'Nothing raised yet',
          emptyBody: 'Raise a joiner’s kit before their first day and it shows up here, with whatever Tracklivo decides.'
        })));
  }

  HRMS.screens.register({
    'hr/assets': HrAssetRequests,
    'hr/onboarding/cases': OnboardingCases,
    'hr/onboarding/verification': DocumentVerification,
    'hr/onboarding/completed': OnboardingCompleted,
    'hr/onboarding/templates': OnboardingTemplates,

    'hr/offboarding/resignations': Resignations,
    'hr/offboarding/notice': NoticePeriod,
    'hr/offboarding/clearance': Clearance,
    'hr/offboarding/settlement': Settlement,

    'hr/documents': documentsLibrary(false),
    'me/documents': documentsLibrary(true),

    /* The asset register is admin's module now. Its screens are unchanged; only the
       workspace they hang off has moved. */
    'admin/assets/dashboard': AssetsDashboard,
    'admin/assets/inventory': Inventory,
    'admin/assets/allocations': Allocations,
    'admin/assets/requests': AssetRequests,
    'admin/assets/returns': Returns,
    'admin/assets/maintenance': Maintenance,

    'hr/config/onboarding': OnboardingConfig,
    'hr/config/offboarding': OffboardingConfig
  });
})();

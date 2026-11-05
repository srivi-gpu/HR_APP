/* Phase 2, HR side (PRD 18): employee records, the employee profile, employee creation,
   bulk import, and the organization-structure configuration screens. */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var store = HRMS.store, router = HRMS.router, ui = HRMS.ui, seed = HRMS.seed;
  var act = HRMS.actions, rules = HRMS.rules;
  var Card = ui.Card, Grid = ui.Grid, Stat = ui.Stat, Stats = ui.Stats;

  function emp(id) { return store.employee(id); }
  function deptName(id) { var d = store.department(id); return d ? d.name : '—'; }
  function locName(id) { var l = store.location(id); return l ? l.name : '—'; }
  function deptOptions() { return store.collection('departments').map(function (d) { return { value: d.id, label: d.name }; }); }
  function desOptions() { return store.collection('designations').map(function (d) { return { value: d.id, label: d.name }; }); }
  function locOptions() { return store.collection('locations').map(function (l) { return { value: l.id, label: l.name }; }); }
  /* Employee types are configuration now (employee setup, PRD 3.3), so they come
     from the store rather than a list in this file: a type added there has to show
     up in the Add employee dialog and in the type filters, not just on the screen
     that created it. Only active types are offered. */
  function typeNames() {
    return store.collection('employeeTypes')
      .filter(function (t) { return t.status !== 'Inactive'; })
      .map(function (t) { return t.name; });
  }

  /* ======================================================= Employee profile
     A side drawer with the tabs PRD 4.4 lists, opened from any employee table. */
  function ProfileDrawer(p) {
    var e = emp(p.id);
    var tabSt = React.useState('overview');
    var editSt = React.useState(false);
    var statusSt = React.useState(false);
    var uploadSt = React.useState(false);
    if (!e) return null;

    var history = store.collection('employmentHistory').filter(function (x) { return x.employee === e.id; });
    var leave = store.collection('leaveRequests').filter(function (x) { return x.employee === e.id; });
    var assets = store.collection('assets').filter(function (x) { return x.assignedTo === e.id; });
    var docs = store.collection('employeeDocuments').filter(function (x) { return x.employee === e.id; });
    var balances = store.balancesFor(e.id);
    var att = store.collection('attendanceToday').filter(function (x) { return x.employee === e.id; })[0];
    var goals = store.collection('goals').filter(function (x) { return x.employee === e.id; });
    var assessment = store.collection('assessments').filter(function (x) { return x.employee === e.id; })[0];
    var slips = store.collection('payslips').filter(function (x) { return x.employee === e.id; });

    var TABS = [
      { value: 'overview', label: 'Overview' }, { value: 'personal', label: 'Personal' },
      { value: 'employment', label: 'Employment' }, { value: 'compensation', label: 'Compensation' },
      { value: 'attendance', label: 'Attendance' }, { value: 'leave', label: 'Leave' },
      { value: 'documents', label: 'Documents' }, { value: 'assets', label: 'Assets' },
      { value: 'performance', label: 'Performance' }, { value: 'activity', label: 'Activity' }
    ];

    var editForm = ui.useForm(e);
    function saveEdit() {
      var res = editForm.submit(function (v) {
        return ui.report(act.editEmployee(e.id, {
          workEmail: v.workEmail, phone: v.phone, personalEmail: v.personalEmail,
          department: v.department, designationId: v.designationId,
          designation: (store.designation(v.designationId) || {}).name,
          location: v.location, manager: v.manager, shift: v.shift, ctc: Number(v.ctc)
        }));
      });
      if (res && res.ok) editSt[1](false);
    }

    var statusForm = ui.useForm({});
    function saveStatus() {
      var res = statusForm.submit(function (v) {
        if (!v.status) return { ok: false, errors: { status: 'Choose a new status' } };
        return ui.report(act.changeEmployeeStatus(e.id, v.status, v.reason));
      });
      if (res && res.ok) { statusSt[1](false); statusForm.reset({}); }
    }

    function body() {
      if (tabSt[0] === 'overview') {
        return h(React.Fragment, null,
          h(ui.KeyValue, { rows: [
            ['Employee ID', h('span', { className: 'mono' }, e.id)],
            ['Status', h(ui.StatusChip, { status: e.status })],
            ['Department', deptName(e.department)],
            ['Designation', e.designation],
            ['Reporting manager', e.manager ? emp(e.manager).name : h('span', { className: 'muted' }, 'None — reports to the board')],
            ['Work location', locName(e.location)],
            ['Joined', e.joinedLabel],
            ['Employment type', e.type],
            ['Work email', e.workEmail]
          ]}),
          h('div', { className: 'row gap-2 wrap' },
            h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.pencil, onClick: function () { editForm.reset(emp(e.id)); editSt[1](true); } }, 'Edit'),
            h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.relate, onClick: function () { statusSt[1](true); } }, 'Change status')));
      }
      if (tabSt[0] === 'personal') {
        return h(ui.KeyValue, { rows: [
          ['Full name', e.name], ['Date of birth', ui.dateLabel(e.dob)], ['Gender', e.gender],
          ['Personal email', e.personalEmail], ['Phone', e.phone],
          ['Emergency contact', e.emergency && e.emergency.name ? e.emergency.name + ' (' + e.emergency.relation + ')' : null],
          ['Emergency phone', e.emergency && e.emergency.phone]
        ]});
      }
      if (tabSt[0] === 'employment') {
        return h(React.Fragment, null,
          h(ui.KeyValue, { rows: [
            ['Employee ID', h('span', { className: 'mono' }, e.id)],
            ['Joined', e.joinedLabel], ['Employment type', e.type],
            ['Probation', e.probationMonths + ' months'],
            ['Job level', 'L' + e.level], ['Assigned shift', (store.shift(e.shift) || {}).name],
            ['Leave policy', (store.collection('leavePolicies').filter(function (x) { return x.id === e.leavePolicy; })[0] || {}).name]
          ]}),
          h('div', { className: 'stack gap-2' },
            h('span', { className: 'eyebrow' }, 'Employment history'),
            h(ui.Timeline, {
              emptyTitle: 'No changes recorded',
              items: history.slice().reverse().map(function (x) {
                return { id: x.id, title: x.change, body: x.from ? x.from + ' → ' + x.to : x.to, when: ui.dateLabel(x.on) };
              })
            })));
      }
      if (tabSt[0] === 'compensation') {
        var b = e.breakdown || seed.util.breakdown(e.ctc);
        return h(React.Fragment, null,
          h(ui.KeyValue, { rows: [
            ['Annual CTC', ui.inr(e.ctc)], ['Monthly gross', ui.inr(b.gross)],
            ['Total deductions', ui.inr(b.totalDeductions)], ['Monthly net', h('strong', null, ui.inr(b.net))],
            ['Salary structure', (store.collection('salaryStructures').filter(function (s) { return s.id === e.salaryStructure; })[0] || {}).name],
            ['Effective from', e.salaryEffective ? ui.dateLabel(e.salaryEffective) : e.joinedLabel]
          ]}),
          h('div', { className: 'stack gap-2' },
            h('span', { className: 'eyebrow' }, 'Payslips'),
            slips.length
              ? h('div', { className: 'list' }, slips.slice(0, 4).map(function (s) {
                  return h('div', { className: 'list__row', key: s.id },
                    h('div', { className: 'list__main' },
                      h('span', { className: 'list__title' }, s.period),
                      h('span', { className: 'list__meta' }, 'Net ' + ui.inr(s.net) + ' · paid ' + ui.dateLabel(s.paidOn))),
                    h(ui.StatusChip, { status: s.status }));
                }))
              : h(ui.Empty, { icon: I.card, title: 'No payslips yet' })));
      }
      if (tabSt[0] === 'attendance') {
        return h(React.Fragment, null,
          h(ui.KeyValue, { rows: [
            ['Today', att ? h(ui.StatusChip, { status: att.status }) : null],
            ['Check in', att && att.checkIn], ['Check out', att && att.checkOut],
            ['Hours', att && att.hours ? att.hours + ' h' : null],
            ['Source', att && att.source]
          ]}),
          h(V.Button, { variant: 'outline', className: 'vi-btn--sm',
            onClick: function () { p.onClose(); router.goAs('hr/attendance/daily'); } }, 'Open daily attendance'));
      }
      if (tabSt[0] === 'leave') {
        return h(React.Fragment, null,
          balances.length
            ? h(V.Table, {
                density: 'compact',
                columns: [
                  { key: 'type', header: 'Type', cell: function (x) { return store.leaveType(x.type).name; } },
                  { key: 'entitled', header: 'Entitled', numeric: true, align: 'right' },
                  { key: 'used', header: 'Used', numeric: true, align: 'right' },
                  { key: 'available', header: 'Available', numeric: true, align: 'right' }
                ],
                rows: balances.map(function (b, i) { return Object.assign({ id: i }, b); })
              })
            : h(ui.Empty, { icon: I.calendar, title: 'No leave policy assigned' }),
          h('div', { className: 'stack gap-2' },
            h('span', { className: 'eyebrow' }, 'Recent requests'),
            leave.length
              ? h('div', { className: 'list' }, leave.slice(0, 5).map(function (l) {
                  return h('div', { className: 'list__row', key: l.id },
                    h('div', { className: 'list__main' },
                      h('span', { className: 'list__title' }, store.leaveType(l.type).name + ' · ' + l.days + 'd'),
                      h('span', { className: 'list__meta' }, l.fromLabel + ' → ' + l.toLabel)),
                    h(ui.StatusChip, { status: l.status }));
                }))
              : h(ui.Empty, { icon: I.calendar, title: 'No leave requests' })));
      }
      if (tabSt[0] === 'documents') {
        /* This is where an employee's documents live (PRD 4.24). They used to be listed
           in the company library too, which meant one person's identity proof sat beside
           the handbook; the library is for company documents now, and a person's own
           papers belong to their record. Upload, verification and expiry are all here. */
        var REQUIRED_DOCS = ['Identity Proof', 'Address Proof', 'Education Certificate', 'Employment Agreement'];
        var held = {};
        docs.forEach(function (d) { held[d.category] = d; });
        var missing = REQUIRED_DOCS.filter(function (cat) { return !held[cat]; });
        var pending = docs.filter(function (d) { return d.status === 'Pending Verification'; }).length;

        return h(React.Fragment, null,
          h('div', { className: 'row gap-2 wrap', style: { marginBottom: 12 } },
            h(V.Chip, { size: 'sm', shape: 'tag', icon: I.file }, docs.length + ' on file'),
            pending
              ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning', dot: true }, pending + ' pending verification')
              : null,
            missing.length
              ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'error', dot: true }, missing.length + ' required missing')
              : h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'success', dot: true }, 'Required set complete'),
            h(V.Button, {
              variant: 'primary', className: 'vi-btn--sm', iconStart: I.up,
              onClick: function () { uploadSt[1](true); }
            }, 'Upload')),

          missing.length
            ? h('p', { className: 'muted', style: { fontSize: 12, margin: '0 0 10px' } },
              'Still needed: ' + missing.join(', ') + '.')
            : null,

          docs.length
            ? h('div', { className: 'checks' }, docs.map(function (d) {
                var days = d.expiry ? Math.round((new Date(d.expiry + 'T00:00') - seed.today) / 86400000) : null;
                return h('div', { className: 'checks__row', key: d.id },
                  h('span', { className: 'empty__mark', style: { width: 28, height: 28 } }, I.file),
                  h('div', { className: 'checks__main' },
                    h('span', { className: 'checks__name' }, d.title || d.category),
                    h('span', { className: 'checks__meta' },
                      d.category + ' · ' + d.name + ' · ' + d.size + ' · uploaded ' + ui.dateLabel(d.uploaded)
                      + (d.verifiedBy ? ' · verified by ' + (emp(d.verifiedBy) || {}).name : ''))),
                  days != null
                    ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', dot: true,
                        tone: days < 0 ? 'error' : days <= 30 ? 'error' : days <= 90 ? 'warning' : 'info' },
                        days < 0 ? 'Expired' : 'Expires ' + ui.dateLabel(d.expiry))
                    : null,
                  d.status === 'Pending Verification'
                    ? h('span', { className: 'row gap-2' },
                        h(V.Button, { variant: 'outline', className: 'vi-btn--sm',
                          onClick: function () { ui.report(act.verifyDocument(d.id, 'Rejected')); } }, 'Reject'),
                        h(V.Button, { variant: 'primary', className: 'vi-btn--sm',
                          onClick: function () { ui.report(act.verifyDocument(d.id, 'Verified')); } }, 'Verify'))
                    : h(ui.StatusChip, { status: d.status }));
              }))
            : h(ui.Empty, {
                icon: I.file, title: 'No documents uploaded',
                body: 'Identity, address, education and employment documents for ' + e.name + ' are kept here.',
                actions: h(V.Button, { variant: 'primary', iconStart: I.up,
                  onClick: function () { uploadSt[1](true); } }, 'Upload a document')
              }));
      }
      if (tabSt[0] === 'assets') {
        return assets.length
          ? h('div', { className: 'list' }, assets.map(function (a) {
              return h('div', { className: 'list__row', key: a.id },
                h('div', { className: 'list__main' },
                  h('span', { className: 'list__title' }, a.name),
                  h('span', { className: 'list__meta' }, a.id + ' · ' + a.serial + ' · since ' + ui.dateLabel(a.assignedOn))),
                a.acknowledged === false ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning' }, 'Unacknowledged') : null,
                h(ui.StatusChip, { status: a.status }));
            }))
          : h(ui.Empty, { icon: I.package, title: 'No assets assigned' });
      }
      if (tabSt[0] === 'performance') {
        return h(React.Fragment, null,
          assessment
            ? h(ui.KeyValue, { rows: [
                ['Open cycle', 'H2 FY2026'],
                ['Self-assessment', h(ui.StatusChip, { status: assessment.self === 'Submitted' ? 'Submitted' : 'Not Started' })],
                ['Manager review', h(ui.StatusChip, { status: assessment.manager === 'Submitted' ? 'Submitted' : 'Not Started' })],
                ['Reviewer', assessment.reviewer ? emp(assessment.reviewer).name : null],
                ['Rating', assessment.rating || null]
              ]})
            : h(ui.Empty, { icon: I.target, title: 'Not in an open cycle' }),
          goals.length
            ? h('div', { className: 'stack gap-2' },
                h('span', { className: 'eyebrow' }, 'Goals'),
                h('div', { className: 'list' }, goals.map(function (g) {
                  return h('div', { className: 'list__row', key: g.id },
                    h('div', { className: 'list__main' },
                      h('span', { className: 'list__title' }, g.title),
                      h('span', { className: 'list__meta' }, g.weight + '% weight · due ' + ui.dateLabel(g.due))),
                    h('span', { style: { width: 84 } }, h(V.ProgressBar, { value: g.progress, size: 'sm', 'aria-label': g.title })));
                })))
            : null);
      }
      /* Activity */
      var activity = []
        .concat(history.map(function (x) { return { id: x.id, title: x.change, body: x.from ? x.from + ' → ' + x.to : x.to, when: x.on, tone: 'neutral' }; }))
        .concat(leave.slice(0, 6).map(function (l) {
          return { id: l.id, title: store.leaveType(l.type).name + ' ' + l.status.toLowerCase(), body: l.fromLabel + ' → ' + l.toLabel, when: l.appliedOn,
            tone: l.status === 'Approved' ? 'success' : l.status === 'Rejected' ? 'error' : 'warning' };
        }))
        .concat(docs.slice(0, 4).map(function (d) { return { id: d.id, title: d.category + ' ' + d.status.toLowerCase(), body: d.name, when: d.uploaded, tone: 'neutral' }; }))
        .sort(function (a, b) { return a.when < b.when ? 1 : -1; });
      return h(ui.Timeline, {
        emptyTitle: 'No activity recorded',
        items: activity.map(function (x) { return Object.assign({}, x, { when: ui.dateLabel(x.when) }); })
      });
    }

    return h(React.Fragment, null,
      h(ui.Drawer, {
        eyebrow: deptName(e.department) + ' · ' + locName(e.location),
        title: e.name, description: e.designation + ' · ' + e.id,
        onClose: p.onClose,
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Close'),
          h(V.Button, { variant: 'primary', iconStart: I.pencil, onClick: function () { editForm.reset(emp(e.id)); editSt[1](true); } }, 'Edit employee'))
      },
        h('div', { className: 'row gap-3 wrap' },
          h(V.Avatar, { name: e.name, size: 'xl' }),
          h('div', { className: 'stack gap-2' },
            h(ui.StatusChip, { status: e.status, size: 'md' }),
            h('span', { className: 'muted', style: { fontSize: 13 } }, e.workEmail),
            h('span', { className: 'muted', style: { fontSize: 13 } }, e.phone))),
        h(V.TabGroup, { value: tabSt[0], onChange: tabSt[1], items: TABS }),
        body()),

      editSt[0] ? h(ui.Modal, {
        title: 'Edit ' + e.name, wide: true, onClose: function () { editSt[1](false); },
        description: 'Changes to department, manager, location or salary are recorded in the employment history.',
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { editSt[1](false); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: saveEdit }, 'Save changes'))
      },
        h(ui.FieldRow, null,
          h(V.TextField, Object.assign({ label: 'Work email', type: 'email' }, editForm.field('workEmail'))),
          h(V.TextField, Object.assign({ label: 'Phone' }, editForm.field('phone')))),
        h(ui.FieldRow, null,
          h(V.Select, Object.assign({ label: 'Department', options: deptOptions() }, editForm.select('department'))),
          h(V.Select, Object.assign({ label: 'Designation', options: desOptions() }, editForm.select('designationId')))),
        h(ui.FieldRow, null,
          h(V.Select, Object.assign({ label: 'Work location', options: locOptions() }, editForm.select('location'))),
          h(V.Select, Object.assign({ label: 'Assigned shift',
            options: store.collection('shifts').map(function (s) { return { value: s.id, label: s.name + ' (' + s.start + '–' + s.end + ')' }; }) }, editForm.select('shift')))),
        h(ui.EmployeePicker, {
          label: 'Reporting manager', allowNone: true, value: editForm.values.manager,
          onChange: function (v) { editForm.set('manager', v); }
        }),
        h(V.NumberField, Object.assign({ label: 'Annual CTC (₹)', min: 0, step: 10000,
          hint: 'A change here starts a new salary revision effective today (PRD 14.6).' }, editForm.field('ctc', { number: true })))) : null,

      statusSt[0] ? h(ui.Modal, {
        title: 'Change status', description: e.name + ' is currently ' + e.status + '. Only valid transitions are offered (PRD 14.1).',
        onClose: function () { statusSt[1](false); },
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { statusSt[1](false); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: saveStatus }, 'Change status'))
      },
        rules.allowedStatuses(e.status).length
          ? h(React.Fragment, null,
              h(V.Select, Object.assign({ label: 'New status', required: true,
                options: rules.allowedStatuses(e.status) }, statusForm.select('status'))),
              h(V.TextArea, Object.assign({ label: 'Reason', rows: 2, placeholder: 'Recorded in the employment history' }, statusForm.field('reason'))))
          : h(ui.Empty, { icon: I.lock, title: 'No transitions available', body: 'An ' + e.status.toLowerCase() + ' record cannot change status.' })) : null,

      uploadSt[0] ? h(UploadEmployeeDocModal, {
        employee: e, onClose: function () { uploadSt[1](false); }
      }) : null);
  }

  /* Uploading a document onto a person's record (PRD 4.24). It lands as Pending
     Verification, which is the same path an employee's own upload takes. */
  function UploadEmployeeDocModal(p) {
    var form = ui.useForm({ title: '', category: seed.documentCategories[0], name: '', size: '', expiry: '' });
    function save() {
      var res = form.submit(function (v) {
        return ui.report(act.uploadDocument(p.employee.id, {
          title: v.title || v.name, category: v.category, name: v.name,
          size: v.size || '— KB', expiry: v.expiry || null
        }));
      });
      if (res && res.ok) p.onClose();
    }
    return h(ui.Modal, {
      title: 'Upload a document',
      description: 'Onto ' + p.employee.name + '\u2019s record. It is held as pending until HR verifies it.',
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
        h(V.Button, { variant: 'primary', iconStart: I.up, onClick: save }, 'Upload'))
    },
      h(V.TextField, Object.assign({ label: 'Document name', placeholder: 'e.g. Aadhaar card',
        hint: 'Defaults to the file name' }, form.field('title'))),
      h(V.Select, Object.assign({ label: 'Category', required: true, options: seed.documentCategories }, form.select('category'))),
      h(V.TextField, Object.assign({ label: 'File name', required: true, placeholder: 'e.g. Aadhaar_Front.pdf' }, form.field('name'))),
      h(ui.FieldRow, { cols: 2 },
        h(V.TextField, Object.assign({ label: 'Size', placeholder: 'e.g. 1.2 MB' }, form.field('size'))),
        h(V.DateField, Object.assign({ label: 'Expires on' },
          form.field('expiry', { hint: 'Leave empty if it does not lapse' })))));
  }

  /* ======================================================== Add employee form */
  function AddEmployeeModal(p) {
    var stepSt = React.useState(0);
    var STEPS = ['Basic', 'Employment', 'Contact', 'Compensation', 'Work setup'];
    var form = ui.useForm({
      id: store.nextId('employees', 'NEX'), type: 'Full-Time', status: 'Invited',
      joined: seed.todayIso, shift: 'sh-gen', leavePolicy: 'lp-standard',
      location: seed.locations[0].id, salaryStructure: 'ss-ic'
    }, function (v) {
      var errs = {};
      if (stepSt[0] === 0) {
        errs = rules.required([{ key: 'firstName', label: 'First name' }, { key: 'lastName', label: 'Last name' }], v);
      }
      return errs;
    });

    function save() {
      var res = form.submit(function (v) { return ui.report(act.createEmployee(v)); });
      if (res && res.ok) { p.onClose(); if (p.onCreated) p.onCreated(res.employee); }
      else if (res && res.errors) {
        /* Jump to the step holding the first error, so the message is visible. */
        var map = { firstName: 0, lastName: 0, id: 1, workEmail: 1, joined: 1, department: 1, designation: 1, type: 1, location: 1 };
        var first = Object.keys(res.errors)[0];
        if (map[first] != null) stepSt[1](map[first]);
      }
    }

    function step() {
      if (stepSt[0] === 0) {
        return h(React.Fragment, null,
          h(ui.FieldRow, { cols: 3 },
            h(V.TextField, Object.assign({ label: 'First name', required: true }, form.field('firstName'))),
            h(V.TextField, Object.assign({ label: 'Middle name' }, form.field('middleName'))),
            h(V.TextField, Object.assign({ label: 'Last name', required: true }, form.field('lastName')))),
          h(ui.FieldRow, null,
            h(V.DateField, Object.assign({ label: 'Date of birth' }, form.field('dob'))),
            h(V.Select, Object.assign({ label: 'Gender', placeholder: 'Prefer not to say',
              options: ['Female', 'Male', 'Non-binary', 'Prefer not to say'] }, form.select('gender')))),
          h(ui.FieldRow, null,
            h(V.TextField, Object.assign({ label: 'Personal email', type: 'email' }, form.field('personalEmail'))),
            h(V.TextField, Object.assign({ label: 'Phone' }, form.field('phone')))));
      }
      if (stepSt[0] === 1) {
        return h(React.Fragment, null,
          h(ui.FieldRow, null,
            h(V.TextField, Object.assign({ label: 'Employee ID', required: true,
              hint: form.errors.id || 'Must be unique across the organization (PRD 14.1)' }, form.field('id'))),
            h(V.TextField, Object.assign({ label: 'Work email', type: 'email', required: true }, form.field('workEmail')))),
          h(ui.FieldRow, null,
            h(V.DateField, Object.assign({ label: 'Joining date', required: true }, form.field('joined'))),
            h(V.Select, Object.assign({ label: 'Employment type', required: true, options: typeNames() }, form.select('type')))),
          h(ui.FieldRow, null,
            h(V.Select, Object.assign({ label: 'Department', required: true, placeholder: 'Choose', options: deptOptions() }, form.select('department'))),
            h(V.Select, Object.assign({ label: 'Designation', required: true, placeholder: 'Choose', options: desOptions() }, form.select('designation')))),
          h(ui.FieldRow, null,
            h(V.Select, Object.assign({ label: 'Work location', required: true, options: locOptions() }, form.select('location'))),
            h(V.Select, Object.assign({ label: 'Initial status',
              options: ['Invited', 'Onboarding', 'Probation', 'Active'],
              hint: 'Invited and Onboarding create an onboarding checklist (PRD 5.1)' }, form.select('status')))),
          h(ui.EmployeePicker, {
            label: 'Reporting manager', allowNone: true, value: form.values.manager,
            onChange: function (v) { form.set('manager', v); }
          }));
      }
      if (stepSt[0] === 2) {
        return h(React.Fragment, null,
          h(V.TextArea, Object.assign({ label: 'Current address', rows: 2 }, form.field('address'))),
          h(V.TextArea, Object.assign({ label: 'Permanent address', rows: 2 }, form.field('permanentAddress'))),
          h(ui.FormSection, { title: 'Emergency contact' },
            h(ui.FieldRow, { cols: 3 },
              h(V.TextField, Object.assign({ label: 'Name' }, form.field('emergencyName'))),
              h(V.Select, Object.assign({ label: 'Relationship', options: ['Spouse', 'Parent', 'Sibling', 'Friend', 'Other'] }, form.select('emergencyRelation'))),
              h(V.TextField, Object.assign({ label: 'Phone' }, form.field('emergencyPhone'))))));
      }
      if (stepSt[0] === 3) {
        var ctc = Number(form.values.ctc) || 0;
        var b = seed.util.breakdown(ctc);
        return h(React.Fragment, null,
          h(ui.FieldRow, null,
            h(V.NumberField, Object.assign({ label: 'Annual CTC (₹)', min: 0, step: 10000 }, form.field('ctc', { number: true }))),
            h(V.Select, Object.assign({ label: 'Salary structure',
              options: store.collection('salaryStructures').map(function (s) { return { value: s.id, label: s.name }; }) }, form.select('salaryStructure')))),
          ctc ? h(Card, { className: 'card--quiet', title: 'Monthly breakdown' },
            h(ui.KeyValue, { rows: [
              ['Gross', ui.inr(b.gross)], ['Deductions', ui.inr(b.totalDeductions)],
              ['Net', h('strong', null, ui.inr(b.net))]
            ]})) : h('p', { className: 'muted', style: { fontSize: 13 } }, 'Enter a CTC to preview the monthly breakdown.'),
          h(ui.FormSection, { title: 'Bank details' },
            h(ui.FieldRow, { cols: 3 },
              h(V.TextField, Object.assign({ label: 'Bank name' }, form.field('bankName'))),
              h(V.TextField, Object.assign({ label: 'Account number' }, form.field('bankAccount'))),
              h(V.TextField, Object.assign({ label: 'IFSC' }, form.field('bankIfsc'))))));
      }
      return h(React.Fragment, null,
        h(ui.FieldRow, null,
          h(V.Select, Object.assign({ label: 'Assigned shift',
            options: store.collection('shifts').map(function (s) { return { value: s.id, label: s.name + ' (' + s.start + '–' + s.end + ')' }; }) }, form.select('shift'))),
          h(V.Select, Object.assign({ label: 'Leave policy',
            options: store.collection('leavePolicies').map(function (x) { return { value: x.id, label: x.name }; }) }, form.select('leavePolicy')))),
        h(ui.FieldRow, null,
          h(V.Select, Object.assign({ label: 'Onboarding template',
            options: store.collection('onboardingTemplates').map(function (t) { return { value: t.id, label: t.name }; }) }, form.select('onboardingTemplate'))),
          h(V.Select, { label: 'Holiday calendar', defaultValue: 'default',
            options: [{ value: 'default', label: 'Organization default' }] })),
        h('p', { className: 'muted', style: { fontSize: 13, lineHeight: 1.6 } },
          'Saving creates the employee record and, for an invited or onboarding status, generates the ' +
          'onboarding checklist from the chosen template.'));
    }

    return h(ui.Modal, {
      title: 'Add employee', wide: true, onClose: p.onClose,
      description: 'Step ' + (stepSt[0] + 1) + ' of ' + STEPS.length + ' · ' + STEPS[stepSt[0]],
      footer: h(React.Fragment, null,
        stepSt[0] > 0 ? h(V.Button, { variant: 'ghost', iconStart: I.back, onClick: function () { stepSt[1](stepSt[0] - 1); } }, 'Back') : null,
        h('span', { style: { flex: 1 } }),
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
        stepSt[0] < STEPS.length - 1
          ? h(V.Button, { variant: 'primary', iconStart: I.right, onClick: function () { stepSt[1](stepSt[0] + 1); } }, 'Next')
          : h(V.Button, { variant: 'primary', onClick: save }, 'Create employee'))
    },
      h(V.ProgressBar, { value: ((stepSt[0] + 1) / STEPS.length) * 100, 'aria-label': 'Progress' }),
      h(V.SegmentedControl, {
        size: 'sm', fullWidth: true, value: String(stepSt[0]),
        items: STEPS.map(function (s, i) { return { value: String(i), label: s }; }),
        onChange: function (v) { stepSt[1](Number(v)); }
      }),
      step(),
      form.errors._ ? h('p', { style: { color: 'var(--danger-fg)', fontSize: 13 } }, form.errors._) : null);
  }

  /* ========================================================== Bulk import */
  var TEMPLATE_HEADERS = ['id', 'name', 'workEmail', 'department', 'designation', 'type', 'location', 'joined', 'ctc'];

  function BulkImportModal(p) {
    var textSt = React.useState('');
    var resultSt = React.useState(null);

    function parse(text) {
      var lines = String(text).trim().split(/\r?\n/).filter(function (l) { return l.trim(); });
      if (!lines.length) return [];
      var head = lines[0].split(',').map(function (x) { return x.trim(); });
      return lines.slice(1).map(function (line) {
        var cells = line.split(',').map(function (x) { return x.trim(); });
        var row = {};
        head.forEach(function (k, i) { row[k] = cells[i]; });
        return row;
      });
    }

    function validate() {
      var rows = parse(textSt[0]);
      if (!rows.length) { ui.toast('Paste at least one data row below the header', 'error'); return; }
      /* Validate without committing, by running the import and reading the rejections. */
      var dry = HRMS.actions.importEmployees(rows);
      resultSt[1](Object.assign({}, dry, { rows: rows, committed: dry.ok }));
      if (dry.ok) ui.toast(dry.accepted.length + ' employees imported', 'success');
    }

    function downloadTemplate() {
      var sample = TEMPLATE_HEADERS.join(',') + '\n'
        + ['NEX9001', 'Asha Menon', 'asha.menon@nexoratech.com', 'dep-eng', 'des-exe', 'Full-Time', 'loc-hyd', seed.todayIso, '1400000'].join(',') + '\n'
        + ['NEX9002', 'Dev Patel', 'dev.patel@nexoratech.com', 'dep-sal', 'des-asc', 'Full-Time', 'loc-blr', seed.todayIso, '700000'].join(',');
      var blob = new Blob([sample], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'employee-import-template.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    }

    var res = resultSt[0];
    return h(ui.Modal, {
      title: 'Bulk import employees', wide: true, onClose: p.onClose,
      description: 'Paste CSV rows. Every row is validated against the rules in PRD 14.1 before anything is written.',
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'ghost', iconStart: I.download, onClick: downloadTemplate }, 'Download template'),
        h('span', { style: { flex: 1 } }),
        h(V.Button, { variant: 'outline', onClick: p.onClose }, res && res.committed ? 'Done' : 'Cancel'),
        res && res.committed ? null : h(V.Button, { variant: 'primary', onClick: validate }, 'Validate and import'))
    },
      h('div', { className: 'row gap-2 wrap' },
        TEMPLATE_HEADERS.map(function (x) { return h(V.Chip, { key: x, size: 'sm', shape: 'tag' }, x); })),
      h(V.TextArea, {
        label: 'CSV data', rows: 7, value: textSt[0],
        placeholder: TEMPLATE_HEADERS.join(',') + '\nNEX9001,Asha Menon,asha.menon@nexoratech.com,dep-eng,des-exe,Full-Time,loc-hyd,' + seed.todayIso + ',1400000',
        onChange: function (e) { textSt[1](e.target.value); resultSt[1](null); }
      }),
      res ? h(Card, { className: 'card--quiet',
        title: res.committed ? 'Imported' : 'Nothing imported — fix these rows first',
        aside: h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: res.committed ? 'success' : 'error', dot: true },
          res.committed ? res.accepted.length + ' added' : res.rejected.length + ' rejected') },
        res.committed
          ? h('p', { className: 'muted', style: { fontSize: 13 } },
              res.accepted.length + ' employee records created with status Invited. Each has an onboarding checklist waiting.')
          : h(React.Fragment, null,
              h('p', { className: 'muted', style: { fontSize: 13 } },
                'The whole file is rejected if any row fails, so a partial import cannot leave the data inconsistent.'),
              h('div', null, res.rejected.slice(0, 12).map(function (r) {
                return h('div', { className: 'importrow', key: r.line },
                  h('span', { className: 'importrow__line' }, 'Line ' + r.line),
                  h('div', { className: 'stack gap-1', style: { minWidth: 0 } },
                    h('span', null, r.row.name || r.row.id || '(blank row)'),
                    h('div', { className: 'importrow__problems' }, r.problems.map(function (x, i) { return h('span', { key: i }, '· ' + x); }))));
              })))) : null);
  }

  /* ====================================================== Employee listings */
  function employeesScreen(opts) {
    return function () {
      var openSt = React.useState(null);
      var addSt = React.useState(false);
      var importSt = React.useState(false);
      var deptSt = React.useState(''), locSt = React.useState(''), typeSt = React.useState('');

      var all = store.collection('employees');
      var rows = all.filter(opts.filter);
      if (deptSt[0]) rows = rows.filter(function (e) { return e.department === deptSt[0]; });
      if (locSt[0]) rows = rows.filter(function (e) { return e.location === locSt[0]; });
      if (typeSt[0]) rows = rows.filter(function (e) { return e.type === typeSt[0]; });

      var columns = [
        { key: 'name', header: 'Employee', sortable: true, csv: function (e) { return e.name; },
          cell: function (e) { return h(ui.Person, { employee: e, sub: e.id, onClick: function () { openSt[1](e.id); } }); } },
        { key: 'designation', header: 'Designation', sortable: true },
        { key: 'department', header: 'Department', sortable: true,
          csv: function (e) { return deptName(e.department); },
          cell: function (e) { return deptName(e.department); } },
        { key: 'manager', header: 'Manager', csv: function (e) { return e.manager ? emp(e.manager).name : ''; },
          cell: function (e) { return e.manager ? emp(e.manager).name : h('span', { className: 'muted' }, '—'); } },
        { key: 'location', header: 'Location', sortable: true,
          csv: function (e) { return locName(e.location); }, cell: function (e) { return locName(e.location); } },
        { key: 'type', header: 'Type' },
        { key: 'joined', header: 'Joined', sortable: true, cell: function (e) { return e.joinedLabel; } },
        { key: 'status', header: 'Status', cell: function (e) { return h(ui.StatusChip, { status: e.status }); } },
        { key: 'actions', header: '', align: 'right',
          cell: function (e) {
            return h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', onClick: function () { openSt[1](e.id); } }, 'View');
          } }
      ];

      return h(React.Fragment, null,
        opts.stats ? h(Stats, null, opts.stats(store.stats())) : null,
        h(Card, {
          title: opts.title, description: opts.description,
          aside: h('div', { className: 'row gap-2' },
            h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.package, onClick: function () { importSt[1](true); } }, 'Bulk import'),
            h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus, onClick: function () { addSt[1](true); } }, 'Add employee'))
        },
          h(ui.DataTable, {
            exportName: 'employees-' + opts.key, label: opts.title, rows: rows, pageSize: 10,
            search: function (e) { return e.name + ' ' + e.id + ' ' + e.designation + ' ' + deptName(e.department); },
            searchPlaceholder: 'Search by name, ID or designation',
            filters: h(React.Fragment, null,
              h(ui.Filter, { label: 'Department', value: deptSt[0], onChange: deptSt[1], options: deptOptions() }),
              h(ui.Filter, { label: 'Location', value: locSt[0], onChange: locSt[1], options: locOptions() }),
              h(ui.Filter, { label: 'Type', value: typeSt[0], onChange: typeSt[1], options: typeNames() })),
            columns: columns,
            emptyIcon: I.users, emptyTitle: opts.emptyTitle || 'No employees found',
            emptyBody: opts.emptyBody || 'Adjust the filters, or add an employee to get started.',
            emptyActions: h(V.Button, { variant: 'primary', iconStart: I.plus, onClick: function () { addSt[1](true); } }, 'Add employee')
          })),
        openSt[0] ? h(ProfileDrawer, { id: openSt[0], onClose: function () { openSt[1](null); } }) : null,
        addSt[0] ? h(AddEmployeeModal, {
          onClose: function () { addSt[1](false); },
          onCreated: function (e) { openSt[1](e.id); }
        }) : null,
        importSt[0] ? h(BulkImportModal, { onClose: function () { importSt[1](false); } }) : null);
    };
  }

  /* =============================================== Organization structure (3.3) */
  function OrgStructure() {
    var tabSt = React.useState('departments');
    var deptSt = React.useState(false), desSt = React.useState(false);
    var deptForm = ui.useForm({ status: 'Active' });
    var desForm = ui.useForm({ status: 'Active', level: 3 });

    function saveDept() {
      var res = deptForm.submit(function (v) { return ui.report(act.createDepartment(v)); });
      if (res && res.ok) { deptSt[1](false); deptForm.reset({ status: 'Active' }); }
    }
    function saveDes() {
      var res = desForm.submit(function (v) { return ui.report(act.createDesignation(v)); });
      if (res && res.ok) { desSt[1](false); desForm.reset({ status: 'Active', level: 3 }); }
    }

    var departments = store.collection('departments');
    var designations = store.collection('designations');

    return h(React.Fragment, null,
      h(V.TabGroup, {
        value: tabSt[0], onChange: tabSt[1],
        items: [
          { value: 'departments', label: 'Departments', count: departments.length },
          { value: 'designations', label: 'Designations', count: designations.length }
        ]
      }),

      tabSt[0] === 'departments' ? h(Card, {
        title: 'Departments',
        aside: h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus, onClick: function () { deptSt[1](true); } }, 'Create department')
      },
        h(ui.DataTable, {
          exportName: 'departments', label: 'Departments', rows: departments, pageSize: 10,
          search: function (d) { return d.name + ' ' + d.code; }, searchPlaceholder: 'Search departments',
          columns: [
            { key: 'name', header: 'Department', sortable: true },
            { key: 'code', header: 'Code', cell: function (d) { return h('span', { className: 'mono' }, d.code); } },
            { key: 'head', header: 'Department head', csv: function (d) { return d.head ? emp(d.head).name : ''; },
              cell: function (d) { return d.head && emp(d.head) ? h(ui.Person, { employee: emp(d.head) }) : h('span', { className: 'muted' }, 'Not set'); } },
            { key: 'headcount', header: 'Headcount', numeric: true, align: 'right', sortable: true },
            { key: 'status', header: 'Status', cell: function (d) { return h(ui.StatusChip, { status: d.status || 'Active' }); } }
          ]
        })) : null,

      tabSt[0] === 'designations' ? h(Card, {
        title: 'Designations',
        aside: h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus, onClick: function () { desSt[1](true); } }, 'Create designation')
      },
        h(ui.DataTable, {
          exportName: 'designations', label: 'Designations', rows: designations, pageSize: 10,
          search: function (d) { return d.name + ' ' + d.code; }, searchPlaceholder: 'Search designations',
          columns: [
            { key: 'name', header: 'Designation', sortable: true },
            { key: 'code', header: 'Code', cell: function (d) { return h('span', { className: 'mono' }, d.code); } },
            { key: 'level', header: 'Job level', numeric: true, align: 'right', sortable: true,
              cell: function (d) { return 'L' + d.level; } },
            { key: 'reportsTo', header: 'Reports to', csv: function (d) { return d.reportsTo ? (store.designation(d.reportsTo) || {}).name : ''; },
              cell: function (d) { return d.reportsTo && store.designation(d.reportsTo) ? store.designation(d.reportsTo).name : h('span', { className: 'muted' }, '—'); } },
            { key: 'count', header: 'Employees', numeric: true, align: 'right',
              cell: function (d) { return store.collection('employees').filter(function (e) { return e.designationId === d.id && e.status !== 'Exited'; }).length; } },
            { key: 'status', header: 'Status', cell: function (d) { return h(ui.StatusChip, { status: d.status }); } }
          ]
        })) : null,

      deptSt[0] ? h(ui.Modal, {
        title: 'Create department', onClose: function () { deptSt[1](false); },
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { deptSt[1](false); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: saveDept }, 'Create department'))
      },
        h(ui.FieldRow, null,
          h(V.TextField, Object.assign({ label: 'Department name', required: true, placeholder: 'e.g. Customer Success' }, deptForm.field('name'))),
          h(V.TextField, Object.assign({ label: 'Department code', required: true, placeholder: 'e.g. CS' }, deptForm.field('code')))),
        h(ui.EmployeePicker, {
          label: 'Department head', allowNone: true, value: deptForm.values.head,
          onChange: function (v) { deptForm.set('head', v); }
        }),
        h(ui.FieldRow, null,
          h(V.Select, Object.assign({ label: 'Parent department', placeholder: 'None', options: deptOptions() }, deptForm.select('parent'))),
          h(V.Select, Object.assign({ label: 'Primary location', placeholder: 'Any', options: locOptions() }, deptForm.select('location')))),
        h(V.TextArea, Object.assign({ label: 'Description', rows: 2 }, deptForm.field('description')))) : null,

      desSt[0] ? h(ui.Modal, {
        title: 'Create designation', onClose: function () { desSt[1](false); },
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { desSt[1](false); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: saveDes }, 'Create designation'))
      },
        h(ui.FieldRow, null,
          h(V.TextField, Object.assign({ label: 'Designation name', required: true, placeholder: 'e.g. Staff Engineer' }, desForm.field('name'))),
          h(V.TextField, Object.assign({ label: 'Code', required: true, placeholder: 'e.g. STE' }, desForm.field('code')))),
        h(ui.FieldRow, null,
          h(V.NumberField, Object.assign({ label: 'Job level', required: true, min: 1, max: 10 }, desForm.field('level', { number: true }))),
          h(V.Select, Object.assign({ label: 'Reports to', placeholder: 'None', options: desOptions() }, desForm.select('reportsTo')))),
        h(V.TextArea, Object.assign({ label: 'Description', rows: 2 }, desForm.field('description')))) : null);
  }

  /* ============================================= Employee configuration (3.3)
     Two things live here, and both are now records rather than constants in the
     source: the employee types an employee can be given, and the status machine the
     Change status dialog obeys. Each can be added to, edited and deleted.

     The "Employee statuses" bar chart that used to sit between them is gone. It
     counted how many people hold each status, which is a headcount question the
     people screens already answer; on a configuration screen it was the one panel
     that could not be configured. */
  var TYPE_STATUS = ['Active', 'Inactive'];

  function leavePolicyOptions() {
    return store.collection('leavePolicies').map(function (lp) { return { value: lp.id, label: lp.name }; });
  }
  function leavePolicyName(id) {
    var lp = id && store.collection('leavePolicies').filter(function (x) { return x.id === id; })[0];
    return lp ? lp.name : null;
  }

  function EmployeeTypeModal(p) {
    var row = p.row;
    var form = ui.useForm(row
      ? { name: row.name, code: row.code, probation: row.probation, leavePolicy: row.leavePolicy || '',
        status: row.status || 'Active', description: row.description || '' }
      : { name: '', code: '', probation: 3, leavePolicy: '', status: 'Active', description: '' });

    function save() {
      var res = form.submit(function (v) {
        return ui.report(row ? act.updateEmployeeType(row.id, v) : act.createEmployeeType(v));
      });
      if (res && res.ok) p.onClose();
    }

    return h(ui.Modal, {
      title: row ? 'Edit ' + row.name : 'Add an employee type',
      description: row
        ? 'Renaming a type moves every employee on it to the new name.'
        : 'Types appear in the Add employee dialog and in every employee-type filter.',
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
        h(V.Button, { variant: 'primary', onClick: save }, row ? 'Save changes' : 'Add type'))
    },
      h(ui.FieldRow, null,
        h(V.TextField, Object.assign({ label: 'Type name', required: true, placeholder: 'e.g. Apprentice' }, form.field('name'))),
        h(V.TextField, Object.assign({ label: 'Code', required: true, placeholder: 'e.g. AP' }, form.field('code')))),
      h(ui.FieldRow, null,
        h(V.NumberField, Object.assign({ label: 'Probation', min: 0, max: 24, hint: 'Months. Zero for no probation.' },
          form.field('probation', { number: true }))),
        h(V.Select, Object.assign({ label: 'Leave policy', placeholder: 'None', options: leavePolicyOptions() },
          form.select('leavePolicy')))),
      h(V.Select, Object.assign({ label: 'Status', options: TYPE_STATUS }, form.select('status'))),
      h(V.TextArea, Object.assign({ label: 'Description', rows: 2, placeholder: 'What this type is for' },
        form.field('description'))),
      looseErrors(form, ['name', 'code', 'probation', 'leavePolicy', 'status', 'description']));
  }

  function StatusModal(p) {
    var row = p.row;
    var others = store.collection('statusTransitions')
      .filter(function (x) { return !row || x.id !== row.id; });
    var form = ui.useForm(row
      ? { status: row.status, to: (row.to || []).slice(), note: row.note || '' }
      : { status: '', to: [], note: '' });

    function toggle(name) {
      var next = (form.values.to || []).slice();
      var at = next.indexOf(name);
      if (at < 0) next.push(name); else next.splice(at, 1);
      form.set('to', next);
    }
    function save() {
      var res = form.submit(function (v) {
        return ui.report(row ? act.updateEmployeeStatus(row.id, v) : act.createEmployeeStatus(v));
      });
      if (res && res.ok) p.onClose();
    }

    return h(ui.Modal, {
      title: row ? 'Edit ' + row.status : 'Add a status',
      description: 'Tick the statuses an employee on this one can be moved to. Leave them all clear '
        + 'to make it terminal.',
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
        h(V.Button, { variant: 'primary', onClick: save }, row ? 'Save changes' : 'Add status'))
    },
      h(V.TextField, Object.assign({ label: 'Status name', required: true, placeholder: 'e.g. Garden Leave' },
        form.field('status'))),
      h('div', { className: 'stack gap-2' },
        h('span', { className: 'eyebrow' }, 'Can move to'),
        h('div', { className: 'checks' }, others.map(function (o) {
          return h('div', { className: 'checks__row', key: o.id },
            h(V.Checkbox, {
              checked: (form.values.to || []).indexOf(o.status) >= 0,
              'aria-label': 'Can move to ' + o.status,
              onChange: function () { toggle(o.status); }
            }),
            h('div', { className: 'checks__main' },
              h('span', { className: 'checks__name' }, o.status),
              o.note ? h('span', { className: 'checks__note' }, o.note) : null));
        }))),
      h(V.TextArea, Object.assign({ label: 'What it means', rows: 2, placeholder: 'A line for whoever picks this status' },
        form.field('note'))),
      looseErrors(form, ['status', 'to', 'note']));
  }

  /* A refusal may key on something the form has no field for — a type still on
     somebody's record, for one — so anything unbound is shown rather than living
     only in a toast that fades. */
  function looseErrors(form, bound) {
    var loose = Object.keys(form.errors || {})
      .filter(function (k) { return bound.indexOf(k) < 0; })
      .map(function (k) { return form.errors[k]; });
    return loose.length
      ? h('p', { style: { color: 'var(--danger-fg)', fontSize: 13, margin: 0 } }, loose.join(' · '))
      : null;
  }

  function EmployeeConfig() {
    var typeSt = React.useState(null);      // null | false (new) | row
    var statusSt = React.useState(null);
    var killTypeSt = React.useState(null);
    var killStatusSt = React.useState(null);

    var types = store.collection('employeeTypes');
    var transitions = store.collection('statusTransitions');
    var counts = {};
    store.collection('employees').forEach(function (e) { counts[e.type] = (counts[e.type] || 0) + 1; });
    var statusCounts = {};
    store.collection('employees').forEach(function (e) { statusCounts[e.status] = (statusCounts[e.status] || 0) + 1; });

    var killType = killTypeSt[0] && store.find('employeeTypes', killTypeSt[0]);
    var killStatus = killStatusSt[0] && store.find('statusTransitions', killStatusSt[0]);

    return h(Grid, null,
      h(Card, { span: 12, title: 'Employee types',
        description: 'The types offered when creating an employee, and what each one implies.',
        aside: h(V.Button, {
          variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus,
          onClick: function () { typeSt[1](false); }
        }, 'Add type') },
        h(ui.DataTable, {
          exportName: 'employee-types', label: 'Employee types', rows: types, pageSize: 10,
          search: function (t) { return t.name + ' ' + t.code + ' ' + (t.description || ''); },
          searchPlaceholder: 'Search employee types',
          columns: [
            { key: 'name', header: 'Type', sortable: true,
              cell: function (t) {
                return h('div', { className: 'stack gap-1' },
                  h('strong', { style: { fontWeight: 500 } }, t.name),
                  t.description ? h('span', { className: 'list__meta' }, t.description) : null);
              } },
            { key: 'code', header: 'Code', cell: function (t) { return h('span', { className: 'mono' }, t.code); } },
            { key: 'probation', header: 'Probation', numeric: true, align: 'right', sortable: true,
              csv: function (t) { return t.probation; },
              cell: function (t) { return t.probation ? t.probation + ' months' : h('span', { className: 'muted' }, 'None'); } },
            { key: 'leavePolicy', header: 'Leave policy',
              csv: function (t) { return leavePolicyName(t.leavePolicy) || ''; },
              cell: function (t) {
                var name = leavePolicyName(t.leavePolicy);
                return name ? h(V.Chip, { size: 'sm', shape: 'tag' }, name) : h('span', { className: 'muted' }, 'Not set');
              } },
            { key: 'people', header: 'Employees', numeric: true, align: 'right', sortable: true,
              sortValue: function (t) { return counts[t.name] || 0; },
              csv: function (t) { return counts[t.name] || 0; },
              cell: function (t) { return counts[t.name] || 0; } },
            { key: 'status', header: 'Status', cell: function (t) { return h(ui.StatusChip, { status: t.status || 'Active' }); } },
            { key: 'actions', header: 'Action', align: 'right', csv: false,
              cell: function (t) {
                return h('span', { className: 'row gap-1', style: { justifyContent: 'flex-end' } },
                  h(V.IconButton, { icon: I.pencil, title: 'Edit', 'aria-label': 'Edit ' + t.name,
                    onClick: function () { typeSt[1](t); } }),
                  h(V.IconButton, { icon: I.trash, title: 'Delete', 'aria-label': 'Delete ' + t.name,
                    disabled: !!counts[t.name], onClick: function () { killTypeSt[1](t.id); } }));
              } }
          ],
          emptyIcon: I.users, emptyTitle: 'No employee types yet',
          emptyBody: 'An employee needs a type before the record can be created.',
          emptyActions: h(V.Button, { variant: 'primary', iconStart: I.plus,
            onClick: function () { typeSt[1](false); } }, 'Add type')
        })),

      h(Card, { span: 12, title: 'Statuses and allowed transitions',
        description: 'PRD 14.1: the Change status dialog only offers what a status points to here.',
        aside: h(V.Button, {
          variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus,
          onClick: function () { statusSt[1](false); }
        }, 'Add status') },
        h(ui.DataTable, {
          exportName: 'status-transitions', label: 'Statuses and transitions', rows: transitions, pageSize: 12,
          search: function (r) { return r.status + ' ' + (r.note || '') + ' ' + (r.to || []).join(' '); },
          searchPlaceholder: 'Search statuses',
          columns: [
            { key: 'status', header: 'Status', csv: function (r) { return r.status; },
              cell: function (r) {
                return h('div', { className: 'stack gap-1' },
                  h(ui.StatusChip, { status: r.status }),
                  r.note ? h('span', { className: 'list__meta' }, r.note) : null);
              } },
            { key: 'to', header: 'Can move to', csv: function (r) { return (r.to || []).join('; '); },
              cell: function (r) {
                return (r.to || []).length
                  ? h('span', { className: 'row gap-2 wrap' }, r.to.map(function (t) {
                      return h(V.Chip, { key: t, size: 'sm', shape: 'tag' }, t);
                    }))
                  : h('span', { className: 'muted' }, 'Terminal — no further transitions');
              } },
            { key: 'people', header: 'Employees', numeric: true, align: 'right', sortable: true,
              sortValue: function (r) { return statusCounts[r.status] || 0; },
              csv: function (r) { return statusCounts[r.status] || 0; },
              cell: function (r) { return statusCounts[r.status] || 0; } },
            { key: 'actions', header: 'Action', align: 'right', csv: false,
              cell: function (r) {
                return h('span', { className: 'row gap-1', style: { justifyContent: 'flex-end' } },
                  h(V.IconButton, { icon: I.pencil, title: 'Edit', 'aria-label': 'Edit ' + r.status,
                    onClick: function () { statusSt[1](r); } }),
                  h(V.IconButton, { icon: I.trash, title: 'Delete', 'aria-label': 'Delete ' + r.status,
                    disabled: !!statusCounts[r.status], onClick: function () { killStatusSt[1](r.id); } }));
              } }
          ],
          emptyIcon: I.relate, emptyTitle: 'No statuses configured',
          emptyBody: 'Without a status machine an employee record cannot move anywhere.',
          emptyActions: h(V.Button, { variant: 'primary', iconStart: I.plus,
            onClick: function () { statusSt[1](false); } }, 'Add status')
        })),

      typeSt[0] !== null ? h(EmployeeTypeModal, {
        row: typeSt[0] || null, onClose: function () { typeSt[1](null); }
      }) : null,
      statusSt[0] !== null ? h(StatusModal, {
        row: statusSt[0] || null, onClose: function () { statusSt[1](null); }
      }) : null,
      killType ? h(ui.Confirm, {
        title: 'Delete ' + killType.name + '?',
        body: 'Nobody is on this type. It disappears from the Add employee dialog and from every type filter.',
        confirmLabel: 'Delete', tone: 'danger',
        onConfirm: function () { ui.report(act.deleteEmployeeType(killType.id)); },
        onClose: function () { killTypeSt[1](null); }
      }) : null,
      killStatus ? h(ui.Confirm, {
        title: 'Delete ' + killStatus.status + '?',
        body: 'Nobody holds this status. Any other status that could move to it stops offering it.',
        confirmLabel: 'Delete', tone: 'danger',
        onConfirm: function () { ui.report(act.deleteEmployeeStatus(killStatus.id)); },
        onClose: function () { killStatusSt[1](null); }
      }) : null);
  }

  /* ---------------------------------------------------------------- Register */
  HRMS.screens.register({
    'hr/people/all': employeesScreen({
      key: 'all', filter: function (e) { return e.status !== 'Exited'; },
      title: 'All employees', description: 'The central employee record every other module references (PRD 4.1).',
      stats: function (s) {
        return [
          h(Stat, { key: 1, label: 'Total employees', value: s.headcount, sub: s.newJoiners + ' joined this month', tone: 'good' }),
          h(Stat, { key: 2, label: 'Active', value: s.active, sub: s.probation + ' on probation' }),
          h(Stat, { key: 3, label: 'Joining or onboarding', value: s.onboarding, sub: s.invited + ' not yet accepted' }),
          h(Stat, { key: 4, label: 'Serving notice', value: s.notice, sub: s.exited + ' exited in total', tone: s.notice ? 'warn' : null })
        ];
      }
    }),
    'hr/people/new': employeesScreen({
      key: 'new', filter: function (e) { return e.status !== 'Exited' && e.joined >= '2026-11-01'; },
      title: 'New joiners', description: 'Employees who joined this month.',
      emptyTitle: 'No one joined this month'
    }),
    'hr/people/probation': employeesScreen({
      key: 'probation', filter: function (e) { return e.status === 'Probation'; },
      title: 'Probation', description: 'Employees on probation, with confirmation approaching.',
      emptyTitle: 'Nobody is on probation'
    }),
    'hr/people/notice': employeesScreen({
      key: 'notice', filter: function (e) { return e.status === 'Notice Period'; },
      title: 'Notice period', description: 'Employees serving notice. Clearance progress is on the offboarding screens.',
      emptyTitle: 'Nobody is serving notice'
    }),
    'hr/people/exited': employeesScreen({
      key: 'exited', filter: function (e) { return e.status === 'Exited'; },
      title: 'Exited', description: 'Archived records, excluded from active headcount (PRD 14.1).',
      emptyTitle: 'No exited employees'
    }),
    'hr/config/structure': OrgStructure,
    'hr/config/employee': EmployeeConfig
  });

  /* Shared with other phase files that open an employee record. */
  HRMS.screens.ProfileDrawer = ProfileDrawer;
  HRMS.screens.AddEmployeeModal = AddEmployeeModal;
})();

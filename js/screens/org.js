/* Phase 2, admin side (PRD 18): organization profile, entities, locations, work week,
   holidays, users, roles, billing and usage, integrations, system settings and audit logs. */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var store = HRMS.store, router = HRMS.router, ui = HRMS.ui, seed = HRMS.seed;
  var act = HRMS.actions, perms = HRMS.permissions;
  var Card = ui.Card, Grid = ui.Grid, PageHead = ui.PageHead, Stat = ui.Stat, Stats = ui.Stats;

  function emp(id) { return store.employee(id); }
  function org() { return Object.assign({}, seed.org, (store.find('orgProfile', 'org') || {})); }

  /* ====================================================== Organization profile */
  function CompanyProfile() {
    var o = org();
    var editSt = React.useState(false);
    var form = ui.useForm(o, function (v) {
      return HRMS.rules.required([{ key: 'name', label: 'Organization name' }, { key: 'industry', label: 'Industry' }], v);
    });

    function save() {
      form.submit(function (v) {
        return ui.report(act.updateOrganization({
          name: v.name, industry: v.industry, website: v.website, size: v.size, founded: v.founded
        }));
      });
      editSt[1](false);
    }

    return h(React.Fragment, null,
      h(Grid, null,
        h(Card, { span: 7, title: 'Company profile',
          aside: h(V.Button, { variant: editSt[0] ? 'ghost' : 'outline', className: 'vi-btn--sm', iconStart: I.pencil,
            onClick: function () { form.reset(org()); editSt[1](!editSt[0]); } }, editSt[0] ? 'Cancel' : 'Edit') },
          editSt[0]
            ? h('div', { className: 'stack gap-4' },
                h(ui.FieldRow, null,
                  h(V.TextField, Object.assign({ label: 'Organization name', required: true }, form.field('name'))),
                  h(V.TextField, Object.assign({ label: 'Industry', required: true }, form.field('industry')))),
                h(ui.FieldRow, null,
                  h(V.TextField, Object.assign({ label: 'Website' }, form.field('website'))),
                  h(V.TextField, Object.assign({ label: 'Company size' }, form.field('size')))),
                h('div', { className: 'row gap-2' },
                  h(V.Button, { variant: 'primary', onClick: save }, 'Save changes'),
                  h(V.Button, { variant: 'outline', onClick: function () { editSt[1](false); } }, 'Cancel')))
            : h(ui.KeyValue, { rows: [
                ['Organization name', o.name],
                ['Industry', o.industry],
                ['Company size', o.size],
                ['Website', o.website],
                ['Founded', o.founded],
                ['Registration', seed.entities[0].reg],
                ['Primary entity', seed.entities[0].name]
              ]})),
        h(Card, { span: 5, title: 'At a glance' },
          h(ui.KeyValue, { rows: [
            ['Employees', store.stats().headcount],
            ['Legal entities', seed.entities.length],
            ['Locations', seed.locations.length],
            ['Departments', store.collection('departments').length],
            ['Designations', store.collection('designations').length],
            ['Subscription', seed.subscription.plan]
          ]}),
          h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.sitemap,
            onClick: function () { router.goAs('hr/config/structure'); } }, 'Organization structure'))));
  }

  function OrganizationDetails() {
    var o = org();
    return h(Grid, null,
      h(Card, { span: 6, title: 'Regional settings' },
        h(ui.KeyValue, { rows: [
          ['Time zone', o.timezone],
          ['Default currency', o.currency + ' (₹)'],
          ['Week starts on', o.weekStart],
          ['Date format', 'DD MMM YYYY'],
          ['Number format', 'Indian grouping (1,23,456)']
        ]})),
      h(Card, { span: 6, title: 'Fiscal & statutory' },
        h(ui.KeyValue, { rows: [
          ['Financial year', '1 April – 31 March'],
          ['Statutory jurisdiction', 'India'],
          ['Provident fund', 'Applicable · 12% of basic'],
          ['Professional tax', 'Slab based, by state'],
          ['Gratuity', 'Applicable after 5 years']
        ]}),
        h('p', { className: 'muted', style: { fontSize: 12 } },
          'PRD 4.34: statutory rules are configurable per jurisdiction and are not assumed to be universal.')));
  }

  function LegalEntities() {
    return h(Card, { title: 'Legal entities', description: 'Registered business entities under the organization.' },
      h(ui.DataTable, {
        exportName: 'legal-entities', label: 'Legal entities', rows: seed.entities, pageSize: 10,
        columns: [
          { key: 'name', header: 'Entity', sortable: true,
            cell: function (e) { return h('span', { className: 'row gap-2' }, e.name, e.primary ? h(V.Chip, { size: 'sm', shape: 'tag' }, 'Primary') : null); } },
          { key: 'country', header: 'Country' },
          { key: 'reg', header: 'Registration', cell: function (e) { return h('span', { className: 'mono' }, e.reg); } },
          { key: 'locations', header: 'Locations', numeric: true, align: 'right',
            cell: function (e) { return seed.locations.filter(function (l) { return l.entity === e.id; }).length; } },
          { key: 'status', header: 'Status', cell: function (e) { return h(ui.StatusChip, { status: e.status }); } }
        ]
      }));
  }

  function Locations() {
    var openSt = React.useState(false);
    var form = ui.useForm({ entity: seed.entities[0].id, tz: seed.org.timezone });
    var rows = store.collection('locations');

    function save() {
      var res = form.submit(function (v) { return ui.report(act.createLocation(v)); });
      if (res && res.ok) { openSt[1](false); form.reset({ entity: seed.entities[0].id, tz: seed.org.timezone }); }
    }

    return h(React.Fragment, null,
      h(Card, { title: 'Locations & branches',
        aside: h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus, onClick: function () { openSt[1](true); } }, 'Add location') },
        h(ui.DataTable, {
          exportName: 'locations', label: 'Locations', rows: rows, pageSize: 10, search: function (l) { return l.name + ' ' + l.address; },
          searchPlaceholder: 'Search locations',
          columns: [
            { key: 'name', header: 'Location', sortable: true,
              cell: function (l) { return h('span', { className: 'row gap-2' }, l.name, l.hq ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info' }, 'HQ') : null); } },
            { key: 'address', header: 'Address' },
            { key: 'tz', header: 'Time zone' },
            { key: 'headcount', header: 'Headcount', numeric: true, align: 'right', sortable: true },
            { key: 'actions', header: '', align: 'right',
              cell: function (l) {
                return h(V.Button, { variant: 'ghost', className: 'vi-btn--sm',
                  onClick: function () { router.goAs('hr/people/all'); } }, 'View people');
              } }
          ]
        })),
      openSt[0] ? h(ui.Modal, {
        title: 'Add location', description: 'A branch or office under a legal entity.',
        onClose: function () { openSt[1](false); },
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { openSt[1](false); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: save }, 'Add location'))
      },
        h(V.TextField, Object.assign({ label: 'Location name', required: true, placeholder: 'e.g. Chennai' }, form.field('name'))),
        h(V.TextArea, Object.assign({ label: 'Address', required: true, rows: 3 }, form.field('address'))),
        h(ui.FieldRow, null,
          h(V.Select, Object.assign({ label: 'Legal entity',
            options: seed.entities.map(function (e) { return { value: e.id, label: e.name }; }) }, form.select('entity'))),
          h(V.TextField, Object.assign({ label: 'Time zone' }, form.field('tz'))))) : null);
  }

  function WorkWeek() {
    var DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    var working = seed.org.workWeek;
    return h(Grid, null,
      h(Card, { span: 7, title: 'Work week', description: 'Organization-wide default. Locations and shifts may override it.' },
        h('div', { className: 'checks' }, DAYS.map(function (d) {
          var on = working.indexOf(d.slice(0, 3)) >= 0;
          return h('div', { className: 'checks__row', key: d },
            h(V.Switch, { defaultChecked: on, 'aria-label': d }),
            h('div', { className: 'checks__main' },
              h('span', { className: 'checks__name' }, d),
              h('span', { className: 'checks__meta' }, on ? 'Working day' : 'Weekly off')));
        }))),
      h(Card, { span: 5, title: 'Default working hours' },
        h(ui.KeyValue, { rows: [
          ['Hours per day', '9 (including 1 hour break)'],
          ['Standard shift', '09:00 – 18:00'],
          ['Grace period', '15 minutes'],
          ['Half day threshold', '4 hours'],
          ['Full day threshold', '8 hours']
        ]}),
        h(V.Button, { variant: 'outline', className: 'vi-btn--sm',
          onClick: function () { router.goAs('hr/shifts/templates'); } }, 'Shift templates')));
  }

  function OrgHolidays() {
    var rows = store.collection('holidays').slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return h(Card, { title: 'Organization holidays', description: 'The global default calendar. Locations inherit it unless overridden.' },
      h(ui.DataTable, {
        exportName: 'holidays', label: 'Holidays', rows: rows.map(function (hd, i) { return Object.assign({ id: hd.date + i }, hd); }),
        pageSize: 15, onExport: true, search: function (hd) { return hd.name; }, searchPlaceholder: 'Search holidays',
        columns: [
          { key: 'date', header: 'Date', sortable: true, cell: function (hd) { return ui.dateLabel(hd.date); } },
          { key: 'day', header: 'Day', cell: function (hd) {
              return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(hd.date + 'T00:00').getDay()];
            } },
          { key: 'name', header: 'Holiday', sortable: true },
          { key: 'type', header: 'Type', cell: function (hd) { return h(V.Chip, { size: 'sm', shape: 'tag', variant: hd.type === 'Optional' ? 'outline' : 'soft', tone: hd.type === 'Optional' ? 'neutral' : 'info' }, hd.type); } },
          { key: 'passed', header: '', align: 'right',
            cell: function (hd) { return hd.date < seed.todayIso ? h('span', { className: 'muted', style: { fontSize: 12 } }, 'Passed') : ''; } }
        ]
      }));
  }

  function OrgSettings() {
    return h(Grid, null,
      h(Card, { span: 6, title: 'Defaults that cascade to HR' },
        h('div', { className: 'checks' },
          [['Employees may update their own profile', true],
            ['Profile changes need HR approval', true],
            ['Managers may approve leave for their team', true],
            ['Employees may see the team leave calendar', true],
            ['Employees may see the full org directory', true],
            ['Salary visible to the employee', true]].map(function (row) {
            return h('div', { className: 'checks__row', key: row[0] },
              h(V.Switch, { defaultChecked: row[1], 'aria-label': row[0] }),
              h('div', { className: 'checks__main' }, h('span', { className: 'checks__name' }, row[0])));
          }))),
      h(Card, { span: 6, title: 'Numbering & identifiers' },
        h(ui.KeyValue, { rows: [
          ['Employee ID format', h('span', { className: 'mono' }, 'NEX####')],
          ['Next employee ID', h('span', { className: 'mono' }, store.nextId('employees', 'NEX'))],
          ['Leave request prefix', h('span', { className: 'mono' }, 'LV')],
          ['Asset prefix', h('span', { className: 'mono' }, 'AST')],
          ['Approval history', 'Retained indefinitely']
        ]})));
  }

  /* ============================================================= Users (2.1) */
  var ROLE_LABEL = { admin: 'Organization Admin', hr: 'HR Administrator', manager: 'Manager', me: 'Employee' };

  function usersScreen(filter, title, description, emptyTitle) {
    return function () {
      var inviteSt = React.useState(false);
      var confirmSt = React.useState(null);
      var form = ui.useForm({ role: 'me' });
      var all = store.collection('users');
      var rows = filter ? all.filter(filter) : all;

      function invite() {
        var res = form.submit(function (v) { return ui.report(act.inviteUser(v)); });
        if (res && res.ok) { inviteSt[1](false); form.reset({ role: 'me' }); }
      }

      var columns = [
        { key: 'employee', header: 'User', sortable: true,
          sortValue: function (u) { var e = emp(u.employee); return e ? e.name : u.email; },
          csv: function (u) { var e = emp(u.employee); return e ? e.name : u.email; },
          cell: function (u) {
            var e = emp(u.employee);
            return e ? h(ui.Person, { employee: e, sub: u.email, onClick: function () { router.goAs('hr/people/all'); } })
              : h('span', null, u.email);
          } },
        { key: 'role', header: 'Role', sortable: true, cell: function (u) { return ROLE_LABEL[u.role] || u.role; } },
        { key: 'status', header: 'Status', cell: function (u) { return h(ui.StatusChip, { status: u.status }); } },
        { key: 'mfa', header: 'MFA', align: 'center', csv: function (u) { return u.mfa ? 'On' : 'Off'; },
          cell: function (u) { return u.mfa ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'success' }, 'On') : h('span', { className: 'muted' }, 'Off'); } },
        { key: 'lastSignIn', header: 'Last sign-in', sortable: true, cell: function (u) { return u.lastSignIn ? ui.relTime(u.lastSignIn) : h('span', { className: 'muted' }, 'Never'); } },
        { key: 'actions', header: '', align: 'right',
          cell: function (u) {
            if (u.status === 'Pending Invitation') {
              return h('span', { className: 'row gap-2', style: { justifyContent: 'flex-end' } },
                h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', onClick: function () { ui.toast('Invitation resent to ' + u.email, 'success'); } }, 'Resend'),
                h(V.Button, { variant: 'outline', className: 'vi-btn--sm', onClick: function () { confirmSt[1]({ user: u, to: 'Deactivated', verb: 'Revoke' }); } }, 'Revoke'));
            }
            return h('span', { className: 'row gap-2', style: { justifyContent: 'flex-end' } },
              u.status === 'Active'
                ? h(V.Button, { variant: 'outline', className: 'vi-btn--sm', onClick: function () { confirmSt[1]({ user: u, to: 'Suspended', verb: 'Suspend' }); } }, 'Suspend')
                : h(V.Button, { variant: 'outline', className: 'vi-btn--sm', onClick: function () { ui.report(act.setUserStatus(u.id, 'Active')); } }, 'Reactivate'));
          } }
      ];

      return h(React.Fragment, null,
        h(Card, {
          title: title, description: description,
          aside: h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus, onClick: function () { inviteSt[1](true); } }, 'Invite user')
        },
          h(ui.DataTable, {
            exportName: 'users', label: 'Users', rows: rows, pageSize: 10,
            search: function (u) { var e = emp(u.employee); return (e ? e.name : '') + ' ' + u.email + ' ' + u.role; },
            searchPlaceholder: 'Search by name, email or role',
            emptyIcon: I.users, emptyTitle: emptyTitle || 'No users here',
            emptyBody: 'Users appear here once they match this view.'
          })),

        inviteSt[0] ? h(ui.Modal, {
          title: 'Invite user', description: 'The invitee sets their own password from the emailed link.',
          onClose: function () { inviteSt[1](false); },
          footer: h(React.Fragment, null,
            h(V.Button, { variant: 'outline', onClick: function () { inviteSt[1](false); } }, 'Cancel'),
            h(V.Button, { variant: 'primary', onClick: invite }, 'Send invitation'))
        },
          h(V.TextField, Object.assign({ label: 'Work email', type: 'email', required: true, placeholder: 'name@nexoratech.com' }, form.field('email'))),
          h(V.Select, Object.assign({ label: 'Role', required: true,
            options: Object.keys(ROLE_LABEL).map(function (k) { return { value: k, label: ROLE_LABEL[k] }; }) }, form.select('role'))),
          h(ui.EmployeePicker, {
            label: 'Link to employee record (optional)', allowNone: true,
            value: form.values.employee, onChange: function (v) { form.set('employee', v); }
          })) : null,

        confirmSt[0] ? h(ui.Confirm, {
          title: confirmSt[0].verb + ' ' + confirmSt[0].user.email + '?',
          body: confirmSt[0].to === 'Suspended'
            ? 'They will be signed out and blocked from signing in until reactivated.'
            : 'The invitation link stops working immediately.',
          confirmLabel: confirmSt[0].verb, tone: 'danger',
          onClose: function () { confirmSt[1](null); },
          onConfirm: function () { ui.report(act.setUserStatus(confirmSt[0].user.id, confirmSt[0].to)); }
        }) : null);
    };
  }

  /* ================================================ Roles: custom + groups */
  /* The roles this organization has added. They live in the same `roles` collection the
     permission editor writes, so the two screens cannot disagree; creating and
     re-permissioning both happen there, and this tab lists what exists and leads to it. */
  function CustomRoles() {
    var rows = store.collection('roles').filter(function (r) { return !r.system; });

    function openEditor() { router.go('admin/roles/modules'); }

    return h(React.Fragment, null,
      h(Card, {
        title: 'Custom roles', description: 'Roles the organization defines on top of the predefined four.',
        aside: h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus, onClick: openEditor }, 'Create role')
      },
        h(ui.DataTable, {
          exportName: 'custom-roles', label: 'Custom roles', rows: rows, pageSize: 10, onExport: false,
          columns: [
            { key: 'name', header: 'Role', sortable: true, cell: function (r) { return h('strong', null, r.name); } },
            { key: 'basedOn', header: 'Falls back to', cell: function (r) {
                var base = store.find('roles', r.basedOn);
                return base ? base.name : (ROLE_LABEL[r.basedOn] || r.basedOn);
              } },
            { key: 'description', header: 'Description' },
            { key: 'perms', header: 'Changed', numeric: true, align: 'right',
              csv: function (r) { return Object.keys(r.perms || {}).length; },
              cell: function (r) {
                var n = Object.keys(r.perms || {}).length;
                return n ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info' }, n + (n === 1 ? ' module' : ' modules'))
                  : h('span', { className: 'muted' }, 'Same as its fallback');
              } },
            { key: 'users', header: 'Users', numeric: true, align: 'right' },
            { key: 'actions', header: '', align: 'right', cell: function () {
                return h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', iconEnd: I.right, onClick: openEditor }, 'Permissions');
              } }
          ],
          emptyIcon: I.shield, emptyTitle: 'No custom roles yet',
          emptyBody: 'The four predefined roles cover most needs. Create a custom role to vary module access.',
          emptyActions: h(V.Button, { variant: 'primary', iconStart: I.plus, onClick: openEditor }, 'Create role')
        })),
      null);
  }

  function PermissionGroups() {
    var GROUPS = [
      { id: 'pg-1', name: 'People operations', modules: ['people', 'onboarding', 'offboarding'], roles: 'HR Administrator' },
      { id: 'pg-2', name: 'Time & attendance', modules: ['leave', 'attendance', 'shifts'], roles: 'HR Administrator, Manager' },
      { id: 'pg-3', name: 'Compensation', modules: ['payroll'], roles: 'HR Administrator' },
      { id: 'pg-4', name: 'Platform governance', modules: ['org', 'users', 'roles', 'billing', 'settings', 'audit'], roles: 'Organization Admin' },
      { id: 'pg-5', name: 'Self-service', modules: ['people', 'leave', 'attendance', 'documents', 'assets'], roles: 'Employee' }
    ];
    return h(Card, { title: 'Permission groups', description: 'Reusable bundles of module permissions that roles draw from.' },
      h(ui.DataTable, {
        exportName: 'permission-groups', label: 'Permission groups', rows: GROUPS, pageSize: 10, onExport: false,
        columns: [
          { key: 'name', header: 'Group', sortable: true },
          { key: 'modules', header: 'Modules', csv: function (g) { return g.modules.join('; '); },
            cell: function (g) {
              return h('span', { className: 'row gap-2 wrap' }, g.modules.map(function (m) {
                return h(V.Chip, { key: m, size: 'sm', shape: 'tag' }, (perms.byModule[m] || {}).label || m);
              }));
            } },
          { key: 'roles', header: 'Used by' }
        ]
      }));
  }

  function ApprovalPermissions() {
    var KINDS = [
      ['Leave Request', 'Reporting Manager', 'HR Administrator', 'Sequential'],
      ['Attendance Regularization', 'Reporting Manager', 'HR Administrator', 'Sequential'],
      ['Shift Swap', 'Reporting Manager', '—', 'Single'],
      ['Asset Request', 'IT Administrator', 'HR Administrator', 'Sequential'],
      ['Profile Change', 'HR Administrator', '—', 'Single'],
      ['Payroll', 'Finance Controller', 'Organization Admin', 'Sequential'],
      ['Document Verification', 'HR Administrator', '—', 'Single'],
      ['Resignation', 'Reporting Manager', 'HR Administrator', 'Sequential'],
      ['Performance Review', 'Reporting Manager', 'Department Head', 'Sequential']
    ].map(function (k, i) { return { id: i, kind: k[0], first: k[1], second: k[2], mode: k[3] }; });

    return h(Card, { title: 'Approval permissions', description: 'Which roles may approve which request types (PRD 6.3).' },
      h(ui.DataTable, {
        exportName: 'approval-permissions', label: 'Approval permissions', rows: KINDS, pageSize: 15, onExport: false,
        columns: [
          { key: 'kind', header: 'Request type', sortable: true },
          { key: 'first', header: 'First approver' },
          { key: 'second', header: 'Second approver' },
          { key: 'mode', header: 'Mode', cell: function (r) { return h(V.Chip, { size: 'sm', shape: 'tag' }, r.mode); } }
        ]
      }));
  }

  /* ======================================================= Billing and usage

     Two tabs where there used to be twelve. Billing is what you pay for and what you
     pay it with; Usage is what the AI credits in that plan went on. The split follows
     the only two questions an admin opens this module with, and everything either tab
     needs is on that tab — no second screen to go and read a number from.

     State lives in this module rather than the store because none of it outlives the
     session: this is a prototype, and a card added here is not a card anywhere else.
     Every change that would cost money or change the bill goes through a dialog that
     shows the arithmetic before it is confirmed. */

  var BILL = function () { return seed.billing; };

  function planOf(key) {
    var all = BILL().plans, i;
    for (i = 0; i < all.length; i++) if (all[i].key === key) return all[i];
    return all[0];
  }
  function monthOf(key) {
    var all = BILL().months, i;
    for (i = 0; i < all.length; i++) if (all[i].k === key) return all[i];
    return all[0];
  }
  function sum(ns) { return ns.reduce(function (a, n) { return a + n; }, 0); }
  function num(n) { return Number(n).toLocaleString('en-IN'); }

  /* Days left in the billing cycle, so a pro-rata charge is never a hard-coded guess. */
  function daysToRenewal() {
    var renews = new Date(BILL().renews + 'T00:00');
    return Math.max(1, Math.round((renews - seed.today) / 86400000));
  }

  function tierFor(n) {
    var ts = BILL().tiers, found = ts[0], i;
    for (i = 0; i < ts.length; i++) if (n >= ts[i].min) found = ts[i];
    return found;
  }
  function nextTier(n) {
    var ts = BILL().tiers, i;
    for (i = 0; i < ts.length; i++) if (ts[i].min > n) return ts[i];
    return null;
  }
  function creditCost(n) { return (n / 1000) * tierFor(n).per; }

  var GST = 0.18;

  /* A dismissable prompt above the tab's cards. It is the one place either tab makes a
     recommendation, and it always carries the number behind it — an admin should be
     able to disagree with it from the banner alone. */
  function Nudge(p) {
    var goneSt = React.useState(false);
    if (goneSt[0]) return null;
    return h('div', { className: 'ai-note' },
      h('span', { className: 'ai-note__mark' }, I.leo),
      h('div', { className: 'ai-note__body' },
        h('span', { className: 'ai-note__eyebrow' }, 'Assistant'),
        h('strong', { style: { fontSize: 15 } }, p.title),
        h('p', { className: 'ai-note__text' }, p.why),
        h('div', { className: 'ai-note__acts' },
          h(V.Button, {
            variant: 'primary', className: 'vi-btn--sm',
            onClick: function () { p.apply(); goneSt[1](true); }
          }, p.label),
          h(V.Button, {
            variant: 'ghost', className: 'vi-btn--sm', onClick: function () { goneSt[1](true); }
          }, 'Dismiss'))));
  }

  /* A minus/value/plus control. A plain number field invites a typo that becomes a
     charge, so the only way to change the quantity is one step at a time. */
  function Stepper(p) {
    return h('div', { className: 'bu-step' },
      h('button', {
        type: 'button', className: 'bu-step__b', 'aria-label': 'Fewer ' + p.unit + 's',
        disabled: p.value <= p.min,
        onClick: function () { p.onChange(Math.max(p.min, p.value - p.step)); }
      }, '−', h('span', null, p.unit)),
      h('span', { className: 'bu-step__v', role: 'status', 'aria-label': p.label },
        (p.fmt || num)(p.value)),
      h('button', {
        type: 'button', className: 'bu-step__b', 'aria-label': 'More ' + p.unit + 's',
        disabled: p.value >= p.max,
        onClick: function () { p.onChange(Math.min(p.max, p.value + p.step)); }
      }, '+', h('span', null, p.unit)));
  }

  /* The month's running total against the monthly limit, and — for the month still
     running — where today's pace lands. The dashed projection is the whole point of
     the chart: a month that is 30% spent on day 3 is not a month that is fine. */
  function UsageTrend(p) {
    var m = p.m, limit = p.limit, perDay = p.perDay;
    var W = 580, H = 250, L = 56, R = 18, T = 16, B = 30;

    var cum = [], run = 0, i;
    for (i = 0; i < m.daily.length; i++) { run += m.daily[i]; cum.push(run); }
    var lastDay = cum.length, spent = cum[cum.length - 1];

    var proj = [];
    if (m.live) {
      var v = spent, d = lastDay + 1;
      while (v < limit * 1.06 && d <= lastDay + 40) { v += perDay; proj.push([d, v]); d++; }
    }
    var maxD = proj.length ? proj[proj.length - 1][0] : lastDay;
    var maxY = Math.max(limit * 1.12, (proj.length ? proj[proj.length - 1][1] : spent) * 1.06);
    function x(day) { return L + ((day - 1) / Math.max(1, maxD - 1)) * (W - L - R); }
    function y(val) { return T + (1 - val / maxY) * (H - T - B); }
    function line(pts) {
      return pts.map(function (pt, n) {
        return (n ? 'L' : 'M') + x(pt[0]).toFixed(1) + ' ' + y(pt[1]).toFixed(1);
      }).join(' ');
    }
    var real = cum.map(function (val, n) { return [n + 1, val]; });
    var area = line(real) + ' L' + x(lastDay).toFixed(1) + ' ' + y(0).toFixed(1)
      + ' L' + x(1).toFixed(1) + ' ' + y(0).toFixed(1) + ' Z';
    var over = real.filter(function (pt) { return pt[1] >= limit; })[0];
    var cross = proj.filter(function (pt) { return pt[1] >= limit; })[0] || over;
    var ticks = [0, limit / 2, limit];
    var xs = [1, Math.round(maxD * 0.3), Math.round(maxD * 0.6), lastDay, maxD]
      .filter(function (d, n, a) { return a.indexOf(d) === n && d > 0; });

    return h('div', { className: 'bu-chart' },
      h('svg', {
        viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid meet', role: 'img',
        'aria-label': 'Credits used in ' + m.k + ' against the ' + num(limit) + ' monthly limit'
      },
        h('defs', null, h('linearGradient', { id: 'buFill', x1: 0, y1: 0, x2: 0, y2: 1 },
          h('stop', { offset: '0%', stopColor: 'var(--brand-solid)', stopOpacity: 0.28 }),
          h('stop', { offset: '100%', stopColor: 'var(--brand-solid)', stopOpacity: 0.02 }))),
        ticks.map(function (t) {
          return h('g', { key: t },
            h('line', { x1: L, x2: W - R, y1: y(t), y2: y(t), stroke: 'var(--border-subtle)', strokeWidth: 1 }),
            h('text', { x: L - 10, y: y(t) + 4, textAnchor: 'end', className: 'bu-chart__ax' },
              t ? (t / 1000) + 'k' : '0'));
        }),
        h('line', {
          x1: L, x2: W - R, y1: y(limit), y2: y(limit),
          stroke: 'var(--danger-fg)', strokeWidth: 1.5, strokeDasharray: '5 4'
        }),
        h('text', { x: L + 4, y: y(limit) - 8, textAnchor: 'start', className: 'bu-chart__lim' },
          'Monthly limit · ' + num(limit)),
        h('path', { d: area, fill: 'url(#buFill)' }),
        h('path', {
          d: line(real), fill: 'none', stroke: 'var(--brand-solid)', strokeWidth: 2.5,
          strokeLinejoin: 'round', strokeLinecap: 'round'
        }),
        proj.length ? h('path', {
          d: line([[lastDay, spent]].concat(proj)), fill: 'none', stroke: 'var(--brand-solid)',
          strokeWidth: 2, strokeDasharray: '5 5', opacity: 0.55
        }) : null,
        h('circle', { cx: x(lastDay), cy: y(spent), r: 4.5, fill: 'var(--brand-solid)' }),
        cross ? h('circle', { cx: x(cross[0]), cy: y(limit), r: 4, fill: 'var(--danger-fg)' }) : null,
        cross ? h('text', {
          x: x(cross[0]), y: y(limit) - 8, textAnchor: 'end', className: 'bu-chart__lim'
        }, (m.live ? 'Runs out ' : 'Ran out ') + cross[0] + ' ' + m.k.slice(0, 3)) : null,
        xs.map(function (d) {
          return h('text', { key: d, x: x(d), y: H - 9, textAnchor: 'middle', className: 'bu-chart__ax' }, d);
        })),
      h('div', { className: 'bu-chart__k' },
        h('span', null, h('i', { className: 'k-line' }), 'Used'),
        m.live ? h('span', null, h('i', { className: 'k-dash' }), 'At the current pace') : null,
        h('span', null, h('i', { className: 'k-lim' }), 'Monthly limit'),
        h('span', { className: 'bu-sub' }, 'Day of the month')));
  }

  /* ---------------------------------------------------------------- Dialogs */

  /* Every charge goes through here: the lines, the GST, the total and the card, before
     anything is confirmed. Nothing in this module charges without showing this first. */
  function PayDialog(p) {
    var cards = p.cards;
    var cardSt = React.useState(((cards.filter(function (c) { return c.def; })[0] || cards[0]) || {}).id);
    var net = sum(p.lines.map(function (l) { return l.amt; }));
    var gst = Math.round(net * GST), total = net + gst;
    var card = cards.filter(function (c) { return c.id === cardSt[0]; })[0];

    return h(ui.Modal, {
      title: p.title, description: p.description, onClose: p.onClose,
      footer: h(React.Fragment, null,
        h('span', { className: 'bu-sub', style: { flex: 1 } }, 'Charged once, today.'),
        h(V.Button, { variant: 'ghost', onClick: p.onClose }, 'Cancel'),
        h(V.Button, {
          variant: 'primary', iconStart: I.card, disabled: !card,
          onClick: function () { p.onPaid(total, card); }
        }, 'Pay ' + ui.inr(total)))
    },
      h('div', { className: 'bu-quote' },
        p.lines.map(function (l) {
          return h('div', { className: 'bu-quote__r', key: l.t },
            h('span', { style: { flex: 1 } }, l.t,
              l.sub ? h('span', { className: 'bu-sub' }, ' · ' + l.sub) : null),
            h('span', { className: 'bu-num' }, ui.inr(l.amt)));
        }),
        h('div', { className: 'bu-quote__r' },
          h('span', { className: 'bu-sub', style: { flex: 1 } }, 'GST 18%'),
          h('span', { className: 'bu-num bu-sub' }, ui.inr(gst))),
        h('div', { className: 'bu-quote__r bu-quote__r--tot' },
          h('span', { style: { flex: 1 } }, 'Total'),
          h('span', { className: 'bu-num' }, ui.inr(total)))),
      h(V.Select, {
        label: 'Pay with', required: true, value: cardSt[0],
        options: cards.map(function (c) {
          return { value: c.id, label: c.brand + ' ending ' + c.last + (c.def ? ' · default' : '') };
        }),
        onChange: function (v) { cardSt[1](v); }
      }),
      p.note ? h('p', { className: 'bu-sub', style: { margin: 0 } }, p.note) : null);
  }

  var CREDIT_OPTIONS = [1000, 2000, 5000, 10000, 20000, 30000, 50000, 75000, 100000];

  /* Buying credits is the one place the price per unit moves, so the dialog shows the
     tier you are on, the saving it is worth, and how far the next tier is. */
  function BuyCreditsDialog(p) {
    var nSt = React.useState(p.suggested || 20000);
    var cards = p.cards;
    var cardSt = React.useState(((cards.filter(function (c) { return c.def; })[0] || cards[0]) || {}).id);
    var n = nSt[0];
    var tier = tierFor(n), next = nextTier(n);
    var base = (n / 1000) * BILL().tiers[0].per;
    var net = creditCost(n), gst = Math.round(net * GST), total = net + gst;
    var card = cards.filter(function (c) { return c.id === cardSt[0]; })[0];

    return h(ui.Modal, {
      wide: true, title: 'Buy AI credits', onClose: p.onClose,
      description: 'Credits you buy never expire, and they are only drawn on once the '
        + 'monthly allowance runs out, so nothing is wasted.',
      footer: h(React.Fragment, null,
        h('span', { className: 'bu-sub', style: { flex: 1 } }, 'Charged once, today. Available straight away.'),
        h(V.Button, { variant: 'ghost', onClick: p.onClose }, 'Cancel'),
        h(V.Button, {
          variant: 'primary', iconStart: I.card, disabled: !card,
          onClick: function () { p.onBuy(n, total, card); }
        }, 'Pay ' + ui.inr(total)))
    },
      h('div', { className: 'bu-buygrid' },
        h('div', { className: 'stack gap-4' },
          h(V.Select, {
            label: 'How many credits', required: true, value: String(n),
            hint: 'The more you buy at once, the lower the rate per 1,000.',
            options: CREDIT_OPTIONS.map(function (v) {
              return {
                value: String(v),
                label: num(v) + ' credits · ' + ui.inr(creditCost(v))
                  + (tierFor(v).save ? ' · save ' + tierFor(v).save + '%' : '')
              };
            }),
            onChange: function (v) { nSt[1](Number(v)); }
          }),
          h('div', { className: 'bu-tiers' }, BILL().tiers.map(function (t) {
            return h('button', {
              key: t.min, type: 'button', 'aria-pressed': tier.min === t.min,
              className: 'bu-tier' + (tier.min === t.min ? ' is-on' : ''),
              onClick: function () { nSt[1](t.min); }
            },
              h('strong', null, num(t.min) + '+'),
              h('span', { className: 'bu-sub' }, ui.inr(t.per) + ' per 1,000'),
              t.save
                ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'success' }, 'Save ' + t.save + '%')
                : h('span', { className: 'bu-sub' }, 'Base rate'));
          })),
          next ? h('div', { className: 'bu-hint' },
            h('span', { style: { flex: 1 } },
              'Add ' + num(next.min - n) + ' more to reach ' + num(next.min) + ' and pay '
              + ui.inr(next.per) + ' per 1,000 instead of ' + ui.inr(tier.per)
              + ' — ' + next.save + '% off.'),
            h(V.Button, {
              variant: 'outline', className: 'vi-btn--sm',
              onClick: function () { nSt[1](next.min); }
            }, 'Make it ' + num(next.min))) : null,
          h(V.Select, {
            label: 'Pay with', required: true, value: cardSt[0],
            options: cards.map(function (c) {
              return { value: c.id, label: c.brand + ' ending ' + c.last + (c.def ? ' · default' : '') };
            }),
            onChange: function (v) { cardSt[1](v); }
          })),

        h('div', { className: 'stack gap-2' },
          h('span', { className: 'bu-label' }, 'What you pay'),
          h('div', { className: 'bu-quote' },
            h('div', { className: 'bu-quote__r' },
              h('span', { style: { flex: 1 } }, 'You get'),
              h('span', { className: 'bu-num' }, num(n) + ' credits')),
            h('div', { className: 'bu-quote__r' },
              h('span', { style: { flex: 1 } }, 'Rate'),
              h('span', { className: 'bu-num' }, ui.inr(tier.per) + ' per 1,000')),
            tier.save > 0 ? h('div', { className: 'bu-quote__r is-save' },
              h('span', { style: { flex: 1 } }, 'You save ' + tier.save + '% on the base rate'),
              h('span', { className: 'bu-num' }, '− ' + ui.inr(base - net))) : null,
            h('div', { className: 'bu-quote__r' },
              h('span', { style: { flex: 1 } }, 'Before GST'),
              h('span', { className: 'bu-num' }, ui.inr(net))),
            h('div', { className: 'bu-quote__r' },
              h('span', { className: 'bu-sub', style: { flex: 1 } }, 'GST 18%'),
              h('span', { className: 'bu-num bu-sub' }, ui.inr(gst))),
            h('div', { className: 'bu-quote__r bu-quote__r--tot' },
              h('span', { style: { flex: 1 } }, 'Total'),
              h('span', { className: 'bu-num' }, ui.inr(total)))),
          h('p', { className: 'bu-sub', style: { margin: 0 } },
            num(n) + ' credits is about ' + Math.round(n / BILL().perDay)
            + ' days at the pace this month has been running.'))));
  }

  function PlanDialog(p) {
    var selSt = React.useState(p.plan);
    return h(ui.Modal, {
      wide: true, title: 'Change plan', onClose: p.onClose,
      description: 'Per seat, per month. A change applies from the next renewal, and the '
        + 'monthly AI credit allowance changes with it.',
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'ghost', onClick: p.onClose }, 'Cancel'),
        h(V.Button, {
          variant: 'primary', iconStart: I.check, disabled: selSt[0] === p.plan,
          onClick: function () { p.onPick(selSt[0]); }
        }, selSt[0] === p.plan ? 'This is your plan' : 'Move to ' + planOf(selSt[0]).name))
    },
      h('div', { className: 'bu-plans' }, BILL().plans.map(function (x) {
        return h('button', {
          key: x.key, type: 'button', 'aria-pressed': selSt[0] === x.key,
          className: 'bu-plan' + (selSt[0] === x.key ? ' is-on' : ''),
          onClick: function () { selSt[1](x.key); }
        },
          h('div', { className: 'bu-plan__h' },
            h('strong', null, x.name),
            x.key === p.plan
              ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'success' }, 'Current')
              : null),
          h('div', { className: 'bu-plan__p' }, ui.inr(x.price),
            h('span', { className: 'bu-sub' }, ' / seat / month')),
          h('span', { className: 'bu-sub' }, x.for),
          h('span', { className: 'bu-plan__c' }, num(x.credits) + ' AI credits a month'),
          h('ul', null, x.has.map(function (f) { return h('li', { key: f }, I.check, f); })));
      })));
  }

  function CardDialog(p) {
    var fSt = React.useState({ num: '', name: '', exp: '', cvv: '', def: !p.cards.length });
    var f = fSt[0];
    function set(k) {
      return function (e) {
        var next = Object.assign({}, fSt[0]);
        next[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        fSt[1](next);
      };
    }
    var digits = f.num.replace(/\D/g, '');
    var ok = digits.length >= 15 && f.name.trim()
      && /^\d{2}\s*\/\s*\d{2}$/.test(f.exp.trim())
      && f.cvv.replace(/\D/g, '').length >= 3;

    return h(ui.Modal, {
      title: 'Add a payment method', onClose: p.onClose,
      description: 'Used for the monthly subscription, extra seats and AI credit top-ups.',
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'ghost', onClick: p.onClose }, 'Cancel'),
        h(V.Button, {
          variant: 'primary', iconStart: I.check, disabled: !ok,
          onClick: function () {
            p.onSave({
              id: 'c' + Date.now(),
              brand: digits[0] === '5' ? 'Mastercard' : digits[0] === '3' ? 'Amex' : 'Visa',
              last: digits.slice(-4), exp: f.exp.trim(), name: f.name.trim(), def: f.def
            });
          }
        }, 'Add card'))
    },
      h(V.TextField, {
        label: 'Card number', required: true, value: f.num, onChange: set('num'),
        placeholder: '4242 4242 4242 4242', autoFocus: true, inputMode: 'numeric'
      }),
      h(V.TextField, {
        label: 'Name on the card', required: true, value: f.name, onChange: set('name'),
        placeholder: 'Nexora Technologies Pvt Ltd'
      }),
      h(ui.FieldRow, null,
        h(V.TextField, { label: 'Expiry', required: true, value: f.exp, onChange: set('exp'), placeholder: 'MM / YY' }),
        h(V.TextField, {
          label: 'CVV', required: true, type: 'password', value: f.cvv, onChange: set('cvv'),
          placeholder: '123', inputMode: 'numeric'
        })),
      h(V.Checkbox, { label: 'Use this card by default', checked: f.def, onChange: set('def') }),
      h('p', { className: 'bu-sub', style: { margin: 0 } },
        'Prototype only. Nothing is sent anywhere and no card is stored.'));
  }

  function MemoDialog(p) {
    var vSt = React.useState(p.memo);
    return h(ui.Modal, {
      title: 'Invoice memo', onClose: p.onClose,
      description: 'Printed on every invoice, under the billing address. Finance teams use '
        + 'it for a PO number or a cost centre.',
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'ghost', onClick: p.onClose }, 'Cancel'),
        h(V.Button, {
          variant: 'primary', iconStart: I.check,
          onClick: function () { p.onSave(vSt[0].trim()); }
        }, 'Save memo'))
    },
      h(V.TextArea, {
        label: 'Memo', rows: 3, value: vSt[0],
        onChange: function (e) { vSt[1](e.target.value); },
        placeholder: 'PO 2026-114 · Cost centre: People Operations'
      }));
  }

  /* ------------------------------------------------------- The shared state

     Both tabs read and write the same subscription, so the state sits in one hook that
     each tab calls. Switching tabs remounts the screen, which is why what must survive
     the switch — seats, plan, cards, invoices, credits bought — is kept on the store
     rather than in component state. */
  var billingState = null;

  function useBilling() {
    var b = BILL();
    var tick = React.useState(0);
    if (!billingState) {
      billingState = {
        plan: b.plan, seats: b.seats, auto: true, notify: false, memo: '',
        cards: b.cards.slice(), payments: b.payments.slice(), bought: 0
      };
    }
    var live = billingState;

    function patch(next) {
      Object.keys(next).forEach(function (k) { live[k] = next[k]; });
      tick[1](tick[0] + 1);
    }
    function invoice(what, note, amt, card) {
      patch({ payments: [{
        d: ui.dateLabel(seed.todayIso), what: what, note: note, amt: amt,
        how: card.brand + ' ••' + card.last, st: 'Paid'
      }].concat(live.payments) });
    }
    return { s: live, patch: patch, invoice: invoice };
  }

  /* ------------------------------------------------------------ Billing tab */
  function BillingTab() {
    var b = BILL();
    var st = useBilling(), s = st.s;
    var plan = planOf(s.plan);
    var used = store.stats().headcount;
    var days = daysToRenewal();

    var addSeatsSt = React.useState(1);
    var planOpenSt = React.useState(false);
    var cardOpenSt = React.useState(false);
    var memoOpenSt = React.useState(false);
    var paySt = React.useState(null);

    var defCard = s.cards.filter(function (c) { return c.def; })[0] || s.cards[0];
    /* The bill goes to the legal entity at the head office, both of which are set on
       other screens — so they are shown here and edited there, never typed twice. */
    var entity = seed.entities[0];
    var hq = seed.locations.filter(function (l) { return l.hq; })[0] || seed.locations[0];
    var billingEmail = 'accounts@' + org().website;

    /* Seats held by people who have left are seats being paid for twice over. */
    var leavers = store.collection('employees')
      .filter(function (e) { return e.status === 'Exited' || e.status === 'Notice Period'; }).length;
    var suggested = Math.max(used, used + 5 - leavers);

    function proRata(n) { return (n * plan.price * days) / 30; }

    function buySeats(n) {
      paySt[1]({
        title: 'Add ' + n + ' ' + (n === 1 ? 'seat' : 'seats'),
        description: 'Charged for the ' + days + ' days left in this cycle. From '
          + b.renewsLabel + ' they are on the normal monthly bill.',
        lines: [{
          t: n + ' × ' + plan.name + ' seat',
          sub: ui.inr(plan.price) + ' a month each, ' + days + ' days pro-rata',
          amt: proRata(n)
        }],
        note: 'From ' + b.renewsLabel + ' the subscription becomes '
          + ui.inr((s.seats + n) * plan.price) + ' a month for ' + (s.seats + n) + ' seats.',
        onPaid: function (total, card) {
          paySt[1](null);
          st.patch({ seats: s.seats + n });
          st.invoice('Seats', n + ' ' + (n === 1 ? 'seat' : 'seats') + ' added · pro-rata to '
            + b.renewsLabel, total, card);
          addSeatsSt[1](1);
          store.log('added ' + n + ' ' + (n === 1 ? 'seat' : 'seats') + ' for ' + ui.inr(total), 'Configuration');
          ui.toast(n + ' ' + (n === 1 ? 'seat' : 'seats') + ' added', 'success');
        }
      });
    }

    return h(React.Fragment, null,
      s.seats > suggested ? h(Nudge, {
        title: 'Drop to ' + suggested + ' seats at renewal',
        why: used + ' of ' + s.seats + ' seats are in use'
          + (leavers ? ', and ' + leavers + ' of them belong to people on notice or already gone' : '')
          + '. ' + suggested + ' keeps 5 spare and saves '
          + ui.inr((s.seats - suggested) * plan.price) + ' a month.',
        label: 'Set ' + suggested + ' seats',
        apply: function () {
          st.patch({ seats: suggested });
          store.log('set seats to ' + suggested + ' from the ' + b.renewsLabel + ' renewal', 'Configuration');
          ui.toast('Seats drop to ' + suggested + ' at renewal', 'success');
        }
      }) : null,

      h(Card, {
        title: 'Current subscription',
        description: plan.name + ' · ' + s.seats + ' seats · renews ' + b.renewsLabel + '.',
        aside: h(V.Button, {
          variant: 'ghost', className: 'vi-btn--sm', iconEnd: I.right,
          onClick: function () { planOpenSt[1](true); }
        }, 'Explore plans')
      },
        h('div', { className: 'bu-sub2' },
          h('span', { className: 'bu-sub2__m' }, I.bolt),
          h('div', { className: 'stack gap-1', style: { flex: 1, minWidth: 0 } },
            h('strong', null, plan.name),
            h('span', { className: 'bu-sub' },
              s.seats + ' seats · ' + ui.inr(plan.price) + ' a seat · renews ' + b.renewsLabel)),
          h('span', { className: 'bu-num bu-sub2__p' }, ui.inr(s.seats * plan.price),
            h('span', { className: 'bu-sub' }, ' / month')),
          h(V.Button, { variant: 'primary', onClick: function () { planOpenSt[1](true); } }, 'Upgrade')),

        h('div', { className: 'checks' },
          h('div', { className: 'checks__row' },
            h(V.Switch, {
              checked: s.auto, 'aria-label': 'Renew automatically',
              onChange: function (e) {
                st.patch({ auto: e.target.checked });
                ui.toast(e.target.checked
                  ? 'Auto-renew is on. You will be charged on ' + b.renewsLabel + '.'
                  : 'Auto-renew is off. Pay before ' + b.renewsLabel + ' to keep the workspace open.',
                  e.target.checked ? 'success' : 'info');
              }
            }),
            h('div', { className: 'checks__main' },
              h('span', { className: 'checks__name' }, 'Renew automatically on ' + b.renewsLabel),
              h('span', { className: 'checks__meta' }, s.auto
                ? ui.inr(s.seats * plan.price) + ' plus GST on '
                  + (defCard ? defCard.brand + ' ••' + defCard.last : 'no card yet')
                : 'Nobody is charged. The workspace becomes read-only on ' + b.renewsLabel + ' until you pay.')))) ),

      h(Card, { title: 'Seats' },
        h(V.ProgressBar, {
          label: 'Seats in use', value: ui.pct(used, s.seats),
          valueLabel: used + ' of ' + s.seats, showValue: true,
          tone: used / s.seats > 0.9 ? 'warning' : 'primary'
        }),
        h('span', { className: 'bu-sub' },
          used + ' of ' + s.seats + ' seats taken · ' + (s.seats - used) + ' free · '
          + ui.inr(plan.price) + ' a seat a month'),

        h('div', { className: 'bu-buy' },
          h('div', { className: 'stack gap-1', style: { flex: 1, minWidth: 0 } },
            h('strong', null, 'Add seats'),
            h('span', { className: 'bu-sub' },
              '1 seat = ' + ui.inr(plan.price) + ' a month · ' + ui.inr(proRata(1))
              + ' for the ' + days + ' days left in this cycle')),
          h(Stepper, {
            label: 'Seats to add', unit: 'seat', value: addSeatsSt[0],
            step: 1, min: 1, max: 500, onChange: addSeatsSt[1]
          })),

        h('div', { className: 'bu-buy__f' },
          h('span', { style: { flex: 1 } },
            h('strong', null, addSeatsSt[0] + (addSeatsSt[0] === 1 ? ' seat' : ' seats')),
            h('span', { className: 'bu-sub' },
              ' · ' + ui.inr(proRata(addSeatsSt[0])) + ' now, then '
              + ui.inr(addSeatsSt[0] * plan.price) + ' a month')),
          h(V.Button, {
            variant: 'primary', iconStart: I.card,
            onClick: function () { buySeats(addSeatsSt[0]); }
          }, 'Pay ' + ui.inr(proRata(addSeatsSt[0]) * (1 + GST)))),

        h(V.Button, {
          variant: 'ghost', className: 'vi-btn--sm', disabled: s.seats <= used,
          onClick: function () {
            st.patch({ seats: Math.max(used, s.seats - 1) });
            store.log('removed a seat from the ' + b.renewsLabel + ' renewal', 'Configuration');
            ui.toast('One seat comes off at renewal', 'success');
          }
        }, 'Remove a seat from the renewal')),

      h(Card, {
        title: 'Payment methods',
        aside: h(V.Button, {
          variant: 'outline', className: 'vi-btn--sm', iconStart: I.plus,
          onClick: function () { cardOpenSt[1](true); }
        }, 'Add payment method')
      },
        s.cards.length
          ? h('div', { className: 'stack gap-2' }, s.cards.map(function (c) {
              return h('div', { className: 'bu-pay' + (c.def ? ' is-def' : ''), key: c.id },
                h('span', { className: 'bu-pay__b' }, c.brand),
                h('div', { className: 'stack gap-1', style: { flex: 1, minWidth: 0 } },
                  h('strong', null, '•••• •••• •••• ' + c.last),
                  h('span', { className: 'bu-sub' }, c.name + ' · expires ' + c.exp)),
                c.def
                  ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'success' }, 'Default')
                  : h(V.Button, {
                      variant: 'ghost', className: 'vi-btn--sm',
                      onClick: function () {
                        st.patch({ cards: s.cards.map(function (x) {
                          return Object.assign({}, x, { def: x.id === c.id });
                        }) });
                        ui.toast(c.brand + ' ••' + c.last + ' is now the default', 'success');
                      }
                    }, 'Make default'),
                h(V.IconButton, {
                  icon: I.trash, 'aria-label': 'Remove ' + c.brand + ' ending ' + c.last,
                  disabled: c.def && s.cards.length > 1,
                  onClick: function () {
                    st.patch({ cards: s.cards.filter(function (x) { return x.id !== c.id; }) });
                    store.log('removed ' + c.brand + ' ••' + c.last, 'Configuration');
                    ui.toast('Payment method removed', 'success');
                  }
                }));
            }))
          : h(ui.Empty, { icon: I.card, title: 'No payment method yet', body: 'Auto-renew needs one.' })),

      h(Card, { title: 'Invoice information' },
        h('div', { className: 'checks' },
          h('div', { className: 'checks__row' },
            h(V.Switch, {
              checked: s.notify, 'aria-label': 'Email new invoices',
              onChange: function (e) {
                st.patch({ notify: e.target.checked });
                ui.toast(e.target.checked ? 'Invoices will be emailed' : 'Invoice emails turned off', 'success');
              }
            }),
            h('div', { className: 'checks__main' },
              h('span', { className: 'checks__name' }, 'Email me when a new invoice is ready'),
              h('span', { className: 'checks__meta' }, 'Goes to ' + billingEmail)))),

        h(ui.KeyValue, { rows: [
          ['Billed to', entity.name + ' \u00b7 ' + entity.reg],
          ['Billing address', hq.address],
          ['Invoice memo', s.memo || h('span', { className: 'muted' },
            'Not set up. A PO number or cost centre printed on every invoice.')]
        ]}),
        h('div', { className: 'row gap-2 wrap' },
          h(V.Button, {
            variant: 'outline', className: 'vi-btn--sm',
            onClick: function () { router.go('admin/org/locations'); }
          }, 'Edit billing address'),
          h(V.Button, {
            variant: 'outline', className: 'vi-btn--sm',
            onClick: function () { memoOpenSt[1](true); }
          }, s.memo ? 'Change invoice memo' : 'Add invoice memo'))),

      h(Card, {
        title: 'Invoices',
        aside: h('span', { className: 'bu-sub' }, 'Subscription, seats and AI credits')
      },
        h('div', { className: 'bu-table', role: 'table' },
          h('div', { className: 'bu-tr bu-th', role: 'row' },
            ['Date', 'For', 'Paid with', 'Amount', 'Status', ''].map(function (head, i) {
              return h('span', { key: i, role: 'columnheader' }, head);
            })),
          s.payments.map(function (x, i) {
            return h('div', { className: 'bu-tr', role: 'row', key: i },
              h('span', null, x.d),
              h('span', { className: 'stack gap-1' },
                h('strong', null, x.what),
                h('span', { className: 'bu-sub' }, x.note)),
              h('span', { className: 'bu-sub' }, x.how),
              h('span', { className: 'bu-num' }, ui.inr(x.amt)),
              h('span', null, h(ui.StatusChip, { status: x.st })),
              h('span', { style: { textAlign: 'right' } },
                h(V.IconButton, {
                  icon: I.download, 'aria-label': 'Download the ' + x.d + ' invoice',
                  onClick: function () { ui.toast(x.d + ' invoice downloaded', 'success'); }
                })));
          }))),

      planOpenSt[0] ? h(PlanDialog, {
        plan: s.plan,
        onClose: function () { planOpenSt[1](false); },
        onPick: function (key) {
          planOpenSt[1](false);
          st.patch({ plan: key });
          var next = planOf(key);
          store.log('moved to the ' + next.name + ' plan from ' + b.renewsLabel, 'Configuration');
          ui.toast('Moving to ' + next.name + ' on ' + b.renewsLabel, 'success');
        }
      }) : null,

      cardOpenSt[0] ? h(CardDialog, {
        cards: s.cards,
        onClose: function () { cardOpenSt[1](false); },
        onSave: function (card) {
          cardOpenSt[1](false);
          st.patch({ cards: card.def
            ? s.cards.map(function (x) { return Object.assign({}, x, { def: false }); }).concat([card])
            : s.cards.concat([card]) });
          store.log('added ' + card.brand + ' ••' + card.last, 'Configuration');
          ui.toast('Payment method added', 'success');
        }
      }) : null,

      memoOpenSt[0] ? h(MemoDialog, {
        memo: s.memo,
        onClose: function () { memoOpenSt[1](false); },
        onSave: function (v) {
          memoOpenSt[1](false);
          st.patch({ memo: v });
          ui.toast(v ? 'Invoice memo saved' : 'Invoice memo removed', 'success');
        }
      }) : null,

      paySt[0] ? h(PayDialog, Object.assign({}, paySt[0], {
        cards: s.cards, onClose: function () { paySt[1](null); }
      })) : null);
  }

  /* -------------------------------------------------------------- Usage tab */
  function UsageTab() {
    var b = BILL();
    var st = useBilling(), s = st.s;
    var plan = planOf(s.plan);
    var monSt = React.useState(b.months[0].k);
    var buySt = React.useState(null);

    var m = monthOf(monSt[0]);
    var spent = sum(m.cats);
    var pct = Math.round((spent / plan.credits) * 100);

    var liveMonth = b.months[0];
    var liveSpent = sum(liveMonth.cats);
    var left = plan.credits - liveSpent;
    var daysOfCredit = Math.max(1, Math.ceil(left / b.perDay));
    var pctLeft = Math.max(0, 100 - Math.round((liveSpent / plan.credits) * 100));

    function topUp(n, total, card) {
      buySt[1](null);
      st.patch({ bought: s.bought + n });
      st.invoice('AI credits', num(n) + ' credits bought', total, card);
      store.log('bought ' + num(n) + ' AI credits for ' + ui.inr(total), 'Configuration');
      ui.toast(num(n) + ' credits added', 'success');
    }

    return h(React.Fragment, null,
      left < b.perDay * 7 ? h(Nudge, {
        title: 'Buy 20,000 AI credits — these run out in ' + daysOfCredit
          + (daysOfCredit === 1 ? ' day' : ' days'),
        why: num(liveSpent) + ' of ' + num(plan.credits) + ' gone, ' + num(b.perDay)
          + ' a day, and the allowance does not reset until ' + b.renewsLabel
          + '. Bought in small packs the rate is ' + ui.inr(tierFor(1000).per)
          + ' per 1,000. At 20,000 it is ' + ui.inr(tierFor(20000).per) + ' — '
          + ui.inr(creditCost(20000)) + ', and it never expires.',
        label: 'Buy 20,000 credits',
        apply: function () { buySt[1](20000); }
      }) : null,

      h(Card, {
        title: 'What your plan includes',
        description: num(liveSpent) + ' of ' + num(plan.credits)
          + ' AI credits used this month, and the allowance resets ' + b.renewsLabel + '.'
      },
        h('div', { className: 'bu-allow' },
          h('div', { className: 'bu-allow__r' },
            h('div', { className: 'stack gap-1' },
              h('strong', null, 'Monthly AI credits'),
              h('span', { className: 'bu-sub' },
                'On the ' + plan.name + ' plan · resets ' + b.renewsLabel)),
            h(V.ProgressBar, {
              value: pctLeft, 'aria-label': 'Monthly credits left',
              tone: pctLeft < 20 ? 'warning' : 'primary'
            }),
            h('span', { className: 'bu-num' }, pctLeft + '% left')),
          h('div', { className: 'bu-allow__r' },
            h('div', { className: 'stack gap-1' },
              h('strong', null, 'Credits you bought'),
              h('span', { className: 'bu-sub' }, s.bought
                ? num(s.bought) + ' bought · never expires'
                : 'None yet · never expires')),
            h(V.ProgressBar, { value: s.bought ? 100 : 0, 'aria-label': 'Bought credits left' }),
            h('span', { className: 'bu-num' }, s.bought ? '100% left' : '—')))),

      h('div', { className: 'bu-head' },
        h('h2', null, 'AI credits usage'),
        h(V.Button, {
          variant: 'primary', iconStart: I.plus,
          onClick: function () { buySt[1](20000); }
        }, 'Buy AI credits')),

      h('div', { className: 'grid bu-grid' },
        h(Card, {
          span: 6, className: 'bu-card--even',
          title: m.k.split(' ')[0] + ' AI credits usage',
          aside: h(V.Select, {
            'aria-label': 'Month', value: monSt[0], className: 'bu-monthsel',
            options: b.months.map(function (x) { return x.k; }),
            onChange: function (v) { monSt[1](v); }
          })
        },
          h('div', { className: 'bu-big' }, pct + '%'),
          h('span', { className: 'bu-sub' },
            num(spent) + ' / ' + num(plan.credits) + ' credits used'
            + (m.live ? ' · ' + num(plan.credits - spent) + ' left'
              : m.ranOut ? ' · ran out on the ' + m.ranOut + 'th'
                : ' · stayed inside the plan')),
          h(V.ProgressBar, {
            value: Math.min(100, pct), 'aria-label': 'Credits used',
            tone: pct >= 100 ? 'error' : pct > 80 ? 'warning' : 'primary'
          }),
          m.extra > 0 ? h('span', { className: 'bu-sub' },
            'Plus ' + num(m.extra) + ' bought in top-ups, ' + ui.inr(m.spentOnTopups) + ' in total.') : null,

          h('div', { className: 'bu-cats' },
            h('div', { className: 'bu-cat bu-cat--h' },
              h('span', null, 'Category'),
              h('span', null, 'AI credits')),
            b.categories.map(function (c, i) {
              return h('div', { className: 'bu-cat', key: c[0] },
                h('span', null,
                  h('i', { className: 'bu-dot', style: { background: b.colors[i] } }),
                  h('span', { className: 'stack gap-1' }, c[0],
                    h('span', { className: 'bu-sub' }, c[1]))),
                h('span', { className: 'bu-num' }, num(m.cats[i])));
            }),
            h('div', { className: 'bu-cat bu-cat--t' },
              h('span', null, 'Total'),
              h('span', { className: 'bu-num' }, num(spent))))),

        h(Card, {
          span: 6, className: 'bu-card--even', title: 'Usage trend',
          aside: h('span', { className: 'bu-sub' }, m.k)
        },
          h('p', { className: 'bu-sub', style: { margin: 0 } },
            m.live ? 'Used so far, and where the pace lands.' : 'Used across ' + m.k + '.'),
          h(UsageTrend, { m: m, limit: plan.credits, perDay: b.perDay }),
          h('div', { className: 'bu-foot' },
            h('span', { className: 'ai-note__mark', style: { width: 28, height: 28 } }, I.leo),
            h('span', { style: { flex: 1 } }, m.live
              ? num(b.perDay) + ' a day. At that pace the allowance is gone in '
                + daysOfCredit + (daysOfCredit === 1 ? ' day' : ' days') + ', well before '
                + b.renewsLabel + '.'
              : m.ranOut
                ? 'Out on the ' + m.ranOut + 'th. ' + num(m.extra) + ' in small packs cost '
                  + ui.inr(m.spentOnTopups) + '; 20,000 at once is ' + ui.inr(creditCost(20000)) + '.'
                : 'Stayed inside the plan. ' + num(plan.credits - spent) + ' unused at the reset.')))),

      buySt[0] ? h(BuyCreditsDialog, {
        cards: s.cards, suggested: buySt[0],
        onClose: function () { buySt[1](null); },
        onBuy: topUp
      }) : null);
  }

  /* ========================================================= Integrations

     One page and one flat grid of cards. This module used to carry six tabs, then
     section headings; both made you click or scan before you could answer "what is
     connected". With three providers there is nothing to group — the grid is the
     whole picture, and each card is self-contained.

     The cards are the design system's integration card (.icards/.icard), so this module
     looks like the rest of the admin console rather than a list of rows.

     A card opens its own configuration form. The fields come from the seed record, so
     adding a provider is a data change and this screen does not grow a branch for it. */

  /* The configuration form a card opens. Fields are declared in the seed record. */
  function IntegrationForm(p) {
    var x = p.integration;
    var init = {};
    x.fields.forEach(function (f) { init[f.id] = f.value; });
    var valSt = React.useState(init);

    function set(id, v) {
      var next = {};
      Object.keys(valSt[0]).forEach(function (k) { next[k] = valSt[0][k]; });
      next[id] = v;
      valSt[1](next);
    }

    function save() {
      store.log('updated the ' + x.name + ' integration', 'Configuration');
      ui.toast(x.name + ' settings saved', 'success');
      p.onClose();
    }

    return h(ui.Modal, {
      title: x.name + ' settings',
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
        h(V.Button, { variant: 'primary', iconStart: I.check, onClick: save }, 'Save settings'))
    },
      h('p', { className: 'muted', style: { fontSize: 13, lineHeight: 1.55, marginTop: 0 } }, x.summary),
      x.fields.map(function (f) {
        var v = valSt[0][f.id];
        if (f.kind === 'switch') {
          return h('div', { className: 'checks__row', key: f.id },
            h(V.Switch, {
              checked: !!v, 'aria-label': f.label,
              onChange: function (e) { set(f.id, e.target.checked); }
            }),
            h('div', { className: 'checks__main' },
              h('span', { className: 'checks__name' }, f.label),
              f.hint ? h('span', { className: 'checks__meta' }, f.hint) : null));
        }
        if (f.kind === 'select') {
          return h(V.Select, {
            key: f.id, label: f.label, value: v, options: f.options, hint: f.hint,
            onChange: function (nv) { set(f.id, nv); }
          });
        }
        return h(V.TextField, {
          key: f.id, label: f.label, value: v, hint: f.hint,
          onChange: function (e) { set(f.id, e.target.value); }
        });
      }));
  }

  /* One provider, as the design system's integration card: logo, name, the regions it
     covers, what it does, an optional caution, and a footer that carries the connection
     state on the left and the way in on the right. No chips and no second button — the
     card says what this is and opens its settings, and everything else lives in there. */
  function IntegrationCard(p) {
    var x = p.integration;
    var connected = x.status === 'Connected';

    function open() { p.onConfigure(x); }

    return h('div', { className: 'icard' },
      h('div', { className: 'icard__h' },
        h('span', {
          className: 'icard__logo',
          style: { background: x.logo.bg, color: x.logo.fg }
        }, x.logo.text),
        h('span', { style: { minWidth: 0 } },
          h('strong', null, x.name),
          h('span', null, x.scope))),

      h('p', null, x.summary),

      x.note ? h('div', { className: 'icard__note' },
        h('span', { className: 'icard__note-i', 'aria-hidden': 'true' }, '⚠'),
        h('span', null, x.note)) : null,

      h('div', { className: 'icard__f' },
        h('span', { className: 'icard__state' },
          h('span', {
            className: 'icard__dot' + (connected ? ' is-on' : ''), 'aria-hidden': 'true'
          }),
          connected
            ? 'Connected · ' + ui.dateLabel(x.connectedOn)
            : 'Not connected'),
        connected
          ? h(V.Button, { variant: 'ghost', className: 'vi-btn--sm icard__view', onClick: open }, 'View')
          : h(V.Button, { variant: 'outline', className: 'vi-btn--sm icard__view', onClick: open }, 'View')));
  }

  function Integrations() {
    var cfgSt = React.useState(null);
    var rows = store.collection('integrations');
    var connected = rows.filter(function (x) { return x.status === 'Connected'; }).length;

    return h(React.Fragment, null,
      h(PageHead, {
        eyebrow: 'Integrations', title: 'Connected services',
        description: connected + ' of ' + rows.length + ' connected. Each card opens its own settings.'
      }),

      h('div', { className: 'icards' }, rows.map(function (x) {
        return h(IntegrationCard, {
          key: x.id, integration: x,
          onConfigure: function (it) { cfgSt[1](it); }
        });
      })),

      rows.length ? null : h(ui.Empty, { icon: I.plug, title: 'No integrations available yet' }),

      cfgSt[0] ? h(IntegrationForm, {
        integration: cfgSt[0],
        onClose: function () { cfgSt[1](null); }
      }) : null);
  }

  /* ====================================================== System settings */
  function settingsScreen(title, description, rows, toggles) {
    return function () {
      return h(Grid, null,
        h(Card, { span: toggles ? 7 : 12, title: title, description: description },
          h(ui.KeyValue, { rows: rows })),
        toggles ? h(Card, { span: 5, title: 'Options' },
          h('div', { className: 'checks' }, toggles.map(function (t) {
            return h('div', { className: 'checks__row', key: t[0] },
              h(V.Switch, { defaultChecked: t[1], 'aria-label': t[0],
                onChange: function (e) { ui.toast(t[0] + ' ' + (e.target.checked ? 'enabled' : 'disabled'), 'success'); } }),
              h('div', { className: 'checks__main' }, h('span', { className: 'checks__name' }, t[0])));
          }))) : null);
    };
  }

  /* =========================================================== Audit logs */
  function auditScreen(category, title, description) {
    return function () {
      var rows = store.collection('audit').filter(function (a) { return !category || a.category === category; });
      return h(Card, { title: title, description: description },
        h(ui.DataTable, {
          exportName: 'audit-' + (category || 'all').toLowerCase().replace(/ /g, '-'),
          label: title, rows: rows, pageSize: 15,
          search: function (a) { return (emp(a.actor) ? emp(a.actor).name : '') + ' ' + a.action; },
          searchPlaceholder: 'Search by person or action',
          columns: [
            { key: 'on', header: 'When', sortable: true, cell: function (a) { return ui.relTime(a.on); }, csv: function (a) { return a.on; } },
            { key: 'actor', header: 'Who', csv: function (a) { return emp(a.actor) ? emp(a.actor).name : 'System'; },
              cell: function (a) { return emp(a.actor) ? h(ui.Person, { employee: emp(a.actor) }) : h('span', { className: 'muted' }, 'System'); } },
            { key: 'action', header: 'Action' },
            { key: 'category', header: 'Category', cell: function (a) { return h(V.Chip, { size: 'sm', shape: 'tag' }, a.category); } },
            { key: 'local', header: '', align: 'right',
              cell: function (a) { return a.local ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info' }, 'This session') : ''; } }
          ],
          emptyIcon: I.history, emptyTitle: 'Nothing logged here yet',
          emptyBody: 'Actions you take in this prototype are appended to the log.'
        }));
    };
  }

  function AuditExport() {
    return h(Grid, null,
      h(Card, { span: 7, title: 'Export logs' },
        h(ui.FieldRow, null,
          h(V.DateField, { label: 'From', defaultValue: '2026-10-01' }),
          h(V.DateField, { label: 'To', defaultValue: seed.todayIso })),
        h(V.Select, { label: 'Category', placeholder: 'All categories',
          options: ['User activity', 'Configuration', 'Permissions', 'Security'] }),
        h(V.Button, { variant: 'primary', iconStart: I.download,
          onClick: function () { ui.toast(store.collection('audit').length + ' log entries exported', 'success'); } }, 'Export CSV')),
      h(Card, { span: 5, title: 'Retention' },
        h(ui.KeyValue, { rows: [
          ['Entries retained', store.collection('audit').length],
          ['Retention period', '7 years'],
          ['Oldest entry', ui.dateLabel('2026-10-18')],
          ['Export format', 'CSV, UTF-8']
        ]})));
  }


  /* ============================================ Organization setup (PRD 3.2)
     The four setup screens the admin workspace was missing: the position hierarchy,
     the department list, the teams under them, and employee numbering. Positions are
     deliberately not people — a vacant position keeps its place in the hierarchy, and
     therefore in the approval path, which is the whole reason to model it separately. */

  /* Who actually holds each designation, so a vacancy is counted rather than asserted. */
  function heldBy(desId) {
    return store.collection('employees').filter(function (e) {
      return e.designationId === desId && e.status !== 'Exited';
    });
  }

  function OrgChart() {
    var all = store.collection('designations');
    var roots = all.filter(function (d) { return !d.reportsTo; });
    var vacant = all.filter(function (d) { return !heldBy(d.id).length; });

    function rows(parent, depth, out) {
      all.filter(function (d) { return d.reportsTo === parent; })
        .sort(function (a, b) { return b.level - a.level; })
        .forEach(function (d) { out.push({ d: d, depth: depth }); rows(d.id, depth + 1, out); });
      return out;
    }
    var flat = [];
    roots.forEach(function (r) { flat.push({ d: r, depth: 0 }); rows(r.id, 1, flat); });

    return h(React.Fragment, null,
      h(Stats, null,
        h(Stat, { label: 'Positions', value: all.length, sub: 'across ' + (Math.max.apply(null, all.map(function (d) { return d.level; }))) + ' job levels' }),
        h(Stat, { label: 'Filled', value: all.length - vacant.length, sub: 'held by at least one person', tone: 'good' }),
        h(Stat, { label: 'Vacant', value: vacant.length, sub: vacant.length ? vacant.map(function (d) { return d.name; }).join(', ') : 'Every position is held',
          tone: vacant.length ? 'warn' : 'good' })),

      h(Card, { title: 'Position hierarchy',
        description: 'Positions, not people. A vacant position keeps its place, so the approval path above it still resolves.' },
        h('div', { className: 'tree2' }, flat.map(function (row) {
          var held = heldBy(row.d.id);
          var lead = held[0];
          return h('div', { className: 'tree2__row', key: row.d.id, style: { paddingLeft: (row.depth * 34) + 'px' } },
            row.depth ? h('span', { className: 'tree2__rail' }) : null,
            h('div', { className: 'node2' + (held.length ? '' : ' node2--vacant') },
              held.length
                ? h(V.Avatar, { name: lead.name, size: 'sm' })
                : h('span', { style: { color: 'var(--warning-fg)', display: 'flex' } }, I.person),
              h('span', { className: 'node2__t' },
                h('strong', null, row.d.name),
                h('span', null, row.d.code + ' · level ' + row.d.level + ' · '
                  + (held.length ? held.length + ' holding' : 'Vacant'))),
              held.length > 1 ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft' }, held.length) : null));
        }))));
  }

  function Departments() {
    var rows = store.collection('departments');
    var over = rows.filter(function (d) { return d.headcount > d.target; });
    return h(React.Fragment, null,
      h(Stats, null,
        h(Stat, { label: 'Departments', value: rows.length }),
        h(Stat, { label: 'Headcount', value: rows.reduce(function (n, d) { return n + d.headcount; }, 0),
          sub: 'against a target of ' + rows.reduce(function (n, d) { return n + d.target; }, 0) }),
        h(Stat, { label: 'Over target', value: over.length,
          sub: over.length ? over.map(function (d) { return d.name; }).join(', ') : 'All within target',
          tone: over.length ? 'warn' : 'good' })),

      h(Card, { title: 'Departments',
        description: 'Admin reads the department list; HR owns it, under People \u203a Configuration.',
        aside: h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconEnd: I.right,
          onClick: function () { router.goAs('hr/config/structure'); } }, 'Edit in HR') },
        h(ui.DataTable, {
          exportName: 'departments', label: 'Departments', rows: rows, pageSize: 10,
          columns: [
            { key: 'name', header: 'Department', sortable: true,
              cell: function (d) { return h('strong', null, d.name); } },
            { key: 'code', header: 'Code', cell: function (d) { return h('span', { className: 'mono' }, d.code); } },
            { key: 'headName', header: 'Head', cell: function (d) {
                var e = emp(d.head);
                return e ? h(ui.Person, { employee: e, sub: null }) : h('span', { className: 'muted' }, 'Not assigned');
              } },
            { key: 'location', header: 'Location', cell: function (d) {
                var l = store.location(d.location);
                return l ? l.name : h('span', { className: 'muted' }, '\u2014');
              } },
            { key: 'headcount', header: 'People', numeric: true, align: 'right', sortable: true },
            { key: 'target', header: 'Target', numeric: true, align: 'right',
              cell: function (d) {
                return h('span', { className: d.headcount > d.target ? 'warnx' : 'muted-s' }, d.target);
              } }
          ]
        })));
  }

  function Teams() {
    var rows = store.collection('teams');
    var unled = rows.filter(function (t) { return !t.leadName; });
    function deptName(id) { var d = store.department(id); return d ? d.name : '\u2014'; }
    return h(React.Fragment, null,
      h(Stats, null,
        h(Stat, { label: 'Teams', value: rows.length, sub: 'across ' + Object.keys(rows.reduce(function (m, t) { m[t.department] = 1; return m; }, {})).length + ' departments' }),
        h(Stat, { label: 'People in teams', value: rows.reduce(function (n, t) { return n + t.members; }, 0) }),
        h(Stat, { label: 'Without a lead', value: unled.length,
          sub: unled.length ? unled.map(function (t) { return t.name; }).join(', ') : 'Every team has a lead',
          tone: unled.length ? 'warn' : 'good' })),

      h(Card, { title: 'Teams', description: 'Working groups inside a department, which the department alone does not say.' },
        h(ui.DataTable, {
          exportName: 'teams', label: 'Teams', rows: rows, pageSize: 10,
          columns: [
            { key: 'name', header: 'Team', sortable: true, cell: function (t) { return h('strong', null, t.name); } },
            { key: 'department', header: 'Department', sortable: true,
              csv: function (t) { return deptName(t.department); },
              cell: function (t) { return deptName(t.department); } },
            { key: 'leadName', header: 'Lead', cell: function (t) {
                if (!t.leadName) return h('span', { className: 'warnx' }, 'No lead');
                var e = store.employeeByName(t.leadName);
                return e ? h(ui.Person, { employee: e, sub: null }) : t.leadName;
              } },
            { key: 'members', header: 'Members', numeric: true, align: 'right', sortable: true }
          ]
        })));
  }

  function Numbering() {
    var rows = store.collection('numbering');
    function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
    return h(React.Fragment, null,
      h(Card, { title: 'Employee numbering',
        description: 'The prefix and width every employee ID in this organization is built from.' },
        h(ui.DataTable, {
          exportName: 'numbering', label: 'Numbering', rows: rows,
          columns: [
            { key: 'entity', header: 'Entity', csv: function (n) { var e = seed.entities.filter(function (x) { return x.id === n.entity; })[0]; return e ? e.name : n.entity; },
              cell: function (n) {
                var e = seed.entities.filter(function (x) { return x.id === n.entity; })[0];
                return h('strong', null, e ? e.name : n.entity);
              } },
            { key: 'applies', header: 'Applies to' },
            { key: 'prefix', header: 'Prefix', cell: function (n) { return h('span', { className: 'mono' }, n.prefix); } },
            { key: 'width', header: 'Digits', numeric: true, align: 'right' },
            { key: 'next', header: 'Next number', numeric: true, align: 'right' },
            { key: 'resets', header: 'Resets' },
            { key: 'preview', header: 'Next ID', align: 'right',
              csv: function (n) { return n.prefix + pad(n.next, n.width); },
              cell: function (n) { return h('span', { className: 'mono' }, n.prefix + pad(n.next, n.width)); } }
          ]
        })),
      h(Card, { title: 'How this reads today' },
        h(ui.KeyValue, { rows: [
          ['Highest ID issued', (function () {
            var ids = store.collection('employees').map(function (e) { return e.id; }).sort();
            return ids.length ? ids[ids.length - 1] : '\u2014';
          })()],
          ['People on the books', store.collection('employees').length],
          ['Format', rows.length ? rows[0].prefix + '0'.repeat(rows[0].width) : '\u2014']
        ]})));
  }

  /* ---------------------------------------------------------------- Register */
  HRMS.screens.register({
    'admin/org/profile': CompanyProfile,
    'admin/org/details': OrganizationDetails,
    'admin/org/entities': LegalEntities,
    'admin/org/chart': OrgChart,
    'admin/org/departments': Departments,
    'admin/org/teams': Teams,
    'admin/org/numbering': Numbering,
    'admin/org/locations': Locations,
    'admin/org/workweek': WorkWeek,
    'admin/org/holidays': OrgHolidays,
    'admin/org/settings': OrgSettings,

    'admin/users/all': usersScreen(null, 'All users', 'Every user account with role, status and last sign-in.'),
    'admin/users/active': usersScreen(function (u) { return u.status === 'Active'; }, 'Active users', 'Accounts that can currently sign in.', 'No active users'),
    'admin/users/pending': usersScreen(function (u) { return u.status === 'Pending Invitation'; }, 'Pending invitations', 'Sent but not yet accepted.', 'No invitations outstanding'),
    'admin/users/suspended': usersScreen(function (u) { return u.status === 'Suspended'; }, 'Suspended users', 'Temporarily blocked accounts.', 'No suspended accounts'),
    'admin/users/deactivated': usersScreen(function (u) { return u.status === 'Deactivated'; }, 'Deactivated users', 'Closed accounts retained for audit.', 'No deactivated accounts'),

    'admin/roles/custom': CustomRoles,
    'admin/roles/groups': PermissionGroups,
    'admin/roles/approvals': ApprovalPermissions,

    'admin/billing/billing': BillingTab,
    'admin/billing/usage': UsageTab,

    'admin/integrations': Integrations,

    'admin/settings/general': settingsScreen('General settings', 'Formats and defaults across the product.', [
      ['Date format', 'DD MMM YYYY'], ['Number format', 'Indian grouping'], ['Week starts on', 'Monday'],
      ['Default language', 'English (India)'], ['Default currency', 'INR (₹)'], ['Time zone', 'Asia/Kolkata']
    ], [['Show employee photos', true], ['Show the org directory to all', true], ['Compact tables by default', false]]),
    'admin/settings/auth': settingsScreen('Authentication', 'How people sign in.', [
      ['Sign-in methods', 'Email and password'], ['Single sign-on', 'Not configured'],
      ['Allowed email domains', 'nexoratech.com'], ['Multi-factor', 'Optional, 38% enrolled']
    ], [['Require multi-factor for Admin', true], ['Allow password sign-in alongside SSO', true], ['Remember devices for 30 days', true]]),
    'admin/settings/passwords': settingsScreen('Password policy', 'Applied at sign-up and every reset.', [
      ['Minimum length', '12 characters'], ['Requires', 'Upper, lower, number, symbol'],
      ['Rotation', 'Every 180 days'], ['Reuse', 'Last 5 passwords blocked'], ['Lockout', '5 failed attempts, 15 minutes']
    ], [['Block common passwords', true], ['Warn on breached passwords', true]]),
    'admin/settings/security': settingsScreen('Security', 'Network and device controls.', [
      ['IP allow-list', 'Not enforced'], ['Device trust', 'Off'],
      ['Lockout threshold', '5 failed attempts'], ['Audit retention', '7 years']
    ], [['Alert on sign-in from a new country', true], ['Alert on permission changes', true], ['Enforce IP allow-list', false]]),
    'admin/settings/sessions': settingsScreen('Sessions', 'How long a session lasts.', [
      ['Session lifetime', '12 hours'], ['Idle timeout', '60 minutes'],
      ['Concurrent sessions', 'Allowed'], ['Forced sign-out', 'On password change']
    ], [['Sign out all devices on password change', true], ['Allow "keep me signed in"', true]]),
    'admin/settings/notifications': settingsScreen('Notification defaults', 'The channels each notification type uses unless a person overrides them.', [
      ['In-app', 'All notification types'], ['Email', 'Leave, payroll, policy and exit events'],
      ['Push', 'Not configured'], ['Digest', 'Daily at 09:00']
    ], [['Let employees change their own channels', true], ['Send a daily digest', true], ['Email approvals immediately', true]]),
    'admin/settings/retention': settingsScreen('Data retention', 'How long records are kept after an employee exits.', [
      ['Exited employee records', '7 years, then anonymised'], ['Payroll records', '8 years (statutory)'],
      ['Attendance records', '3 years'], ['Audit logs', '7 years'], ['Documents', 'Until 1 year after exit']
    ], [['Anonymise instead of deleting', true], ['Allow HR to export before purge', true]]),

    'admin/audit/activity': auditScreen('User activity', 'User activity', 'Who did what, where and when.'),
    'admin/audit/config': auditScreen('Configuration', 'Configuration changes', 'Every configuration edit.'),
    'admin/audit/permissions': auditScreen('Permissions', 'Permission changes', 'Role and permission grants and revocations.'),
    'admin/audit/logins': auditScreen('Security', 'Login history', 'Sign-ins with device and location.'),
    'admin/audit/security': auditScreen('Security', 'Security events', 'Lockouts, policy changes and suspicious activity.'),
    'admin/audit/export': AuditExport
  });
})();

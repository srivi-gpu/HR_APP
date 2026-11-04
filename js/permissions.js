/* Role-based access, from the permission matrix in PRD section 10.

   This is prototype-level access control. PRD 16.6 is explicit that frontend-only
   permissions are not production security: a real deployment must enforce
   authorization in the backend. What this gives the prototype is an honest model of
   who sees what, plus the access-denied states section 17 asks for. */
(function () {
  var HRMS = (window.HRMS = window.HRMS || {});

  /* The permission levels a role can hold on a module. */
  var FULL = ['view', 'create', 'edit', 'delete', 'approve', 'export', 'configure'];
  var LEVELS = {
    full: FULL,
    manage: ['view', 'create', 'edit', 'approve', 'export'],
    limited: ['view', 'create', 'edit'],
    participate: ['view', 'create'],
    own: ['view', 'create', 'edit'],
    viewOnly: ['view'],
    none: []
  };

  /* Modules, in the order PRD 10 tabulates them. `scope` is the data boundary the
     role sees (PRD 10, "data scope"). */
  var MATRIX = [
    { id: 'org',          label: 'Organization profile', admin: 'full',     hr: 'viewOnly',    me: 'none' },
    { id: 'locations',    label: 'Locations',            admin: 'full',     hr: 'limited',     me: 'viewOnly', meScope: 'own-location' },
    { id: 'users',        label: 'User management',      admin: 'full',     hr: 'limited',     me: 'own',      meScope: 'own' },
    { id: 'roles',        label: 'Roles & permissions',  admin: 'full',     hr: 'viewOnly',    me: 'none' },
    { id: 'departments',  label: 'Departments',          admin: 'viewOnly', hr: 'full',        me: 'viewOnly', meScope: 'own' },
    { id: 'designations', label: 'Designations',         admin: 'viewOnly', hr: 'full',        me: 'viewOnly', meScope: 'own' },
    { id: 'people',       label: 'Employee records',     admin: 'viewOnly', hr: 'full',        me: 'own',      meScope: 'own' },
    { id: 'onboarding',   label: 'Onboarding',           admin: 'viewOnly', hr: 'full',        me: 'participate', meScope: 'assigned' },
    { id: 'leave',        label: 'Leave management',     admin: 'viewOnly', hr: 'full',        me: 'own',      meScope: 'own' },
    { id: 'attendance',   label: 'Attendance',           admin: 'viewOnly', hr: 'full',        me: 'own',      meScope: 'own' },
    { id: 'shifts',       label: 'Shifts',               admin: 'viewOnly', hr: 'full',        me: 'participate', meScope: 'own' },
    { id: 'documents',    label: 'Documents & policies', admin: 'viewOnly', hr: 'full',        me: 'participate', meScope: 'own' },
    { id: 'assets',       label: 'Asset management',     admin: 'viewOnly', hr: 'full',        me: 'participate', meScope: 'own' },
    { id: 'payroll',      label: 'Payroll',              admin: 'viewOnly', hr: 'full',        me: 'viewOnly', meScope: 'own', confidential: true },
    { id: 'engagement',   label: 'Engagement',           admin: 'viewOnly', hr: 'full',        me: 'participate', meScope: 'own' },
    { id: 'performance',  label: 'Performance',          admin: 'viewOnly', hr: 'full',        me: 'participate', meScope: 'own' },
    { id: 'offboarding',  label: 'Offboarding',          admin: 'viewOnly', hr: 'full',        me: 'own',      meScope: 'own' },
    { id: 'reports',      label: 'Reports',              admin: 'manage',   hr: 'full',        me: 'viewOnly', meScope: 'own' },
    { id: 'billing',      label: 'Billing and usage',    admin: 'full',     hr: 'none',        me: 'none' },
    { id: 'integrations', label: 'Integrations',         admin: 'full',     hr: 'none',        me: 'none' },
    { id: 'settings',     label: 'System settings',      admin: 'full',     hr: 'viewOnly',    me: 'none' },
    { id: 'audit',        label: 'Audit logs',           admin: 'full',     hr: 'viewOnly',    me: 'none' },
    { id: 'approvals',    label: 'Approvals',            admin: 'viewOnly', hr: 'manage',      me: 'participate', meScope: 'own' },
    { id: 'notifications', label: 'Notifications',       admin: 'own',      hr: 'own',         me: 'own',      meScope: 'own' }
  ];

  var SCOPES = {
    all: 'All organization', 'own-location': 'Assigned locations', 'own-department': 'Assigned departments',
    team: 'Assigned employees', assigned: 'Assigned records', own: 'Own records', none: '—'
  };

  var byModule = {};
  MATRIX.forEach(function (m) { byModule[m.id] = m; });

  /* Which module a route belongs to. Sidebar item paths are the module names almost
     everywhere, so the exceptions are listed rather than the rule. */
  var ROUTE_MODULE = {
    'admin/dashboard': 'org', 'hr/dashboard': 'people', 'me/dashboard': 'people',
    'me/announcements': 'engagement', 'hr/announcements': 'engagement',
    'me/profile': 'people', 'me/exit': 'offboarding', 'hr/holidays': 'leave',
    'admin/config': 'settings', 'hr/config': 'settings',
    /* Admin's People module governs accounts, access and the reporting structure, not
       employee records, so it is gated on User management rather than on `people` —
       which admin only reads. The HR workspace keeps `hr/people` on employee records. */
    'admin/people': 'users'
  };

  function moduleOf(path) {
    if (!path) return null;
    if (ROUTE_MODULE[path]) return ROUTE_MODULE[path];
    var parts = path.split('/');
    if (parts[0] === 'global') return null;                 // global screens are not gated
    var base = parts[0] + '/' + parts[1];
    if (ROUTE_MODULE[base]) return ROUTE_MODULE[base];
    return byModule[parts[1]] ? parts[1] : null;
  }

  /* A role's level on a module, resolved in three steps: what the role has been given
     explicitly, then what the role it is based on resolves to, then the baseline in
     MATRIX. Editing a role in Admin writes the first of those, which is what makes the
     roles screen govern the whole application rather than describe it.
     `depth` only guards a `basedOn` chain that someone has pointed at itself. */
  function roleRecord(id) {
    var store = HRMS.store;
    return store ? store.find('roles', id) : null;
  }
  function levelName(role, moduleId, depth) {
    var rec = roleRecord(role);
    if (rec && rec.perms && rec.perms[moduleId]) return rec.perms[moduleId];
    if (rec && rec.basedOn && rec.basedOn !== role && (depth || 0) < 8) {
      return levelName(rec.basedOn, moduleId, (depth || 0) + 1);
    }
    var m = byModule[moduleId];
    return m ? (m[role] || 'none') : 'full';
  }

  /* What the role would fall back to if its explicit level were cleared. The roles
     screen shows this so an edit reads as a change from something, not from nothing. */
  function baselineLevel(role, moduleId) {
    var rec = roleRecord(role);
    if (rec && rec.basedOn && rec.basedOn !== role) return levelName(rec.basedOn, moduleId);
    var m = byModule[moduleId];
    return m ? (m[role] || 'none') : 'full';
  }
  function actions(role, moduleId) { return LEVELS[levelName(role, moduleId)] || []; }
  function can(role, moduleId, action) { return actions(role, moduleId).indexOf(action) >= 0; }
  function scope(role, moduleId) {
    var m = byModule[moduleId];
    if (!m) return 'all';
    if (levelName(role, moduleId) === 'none') return 'none';
    if (role === 'me') return m.meScope || 'own';
    if (role === 'hr') return 'all';
    return 'all';
  }

  /* The signed-in user's own profile belongs to the person, not to a workspace:
     every role reaches it from the profile menu, which is why it is offered there in
     all three. So it is exempt from the cross-workspace refusal below, though the
     module gate still applies to it like any other route. */
  function isPersonal(path) { return /^me\/profile(\/|$)/.test(path || ''); }

  /* Route-level gate. A deep link into a module the active role cannot view lands on
     the access-denied screen instead of rendering. */
  function allows(role, path) {
    var moduleId = moduleOf(path);
    if (!moduleId) return true;
    return can(role, moduleId, 'view');
  }

  /* Whether a role may see another person's record for a module. Used to keep
     confidential data out of the employee workspace (PRD 16.6). */
  function allowsRecord(role, moduleId, viewerId, subjectId) {
    if (viewerId === subjectId) return true;
    var s = scope(role, moduleId);
    return s === 'all' || s === 'team' || s === 'assigned';
  }

  HRMS.permissions = {
    matrix: MATRIX, byModule: byModule, levels: LEVELS, scopes: SCOPES, allActions: FULL,
    moduleOf: moduleOf, levelName: levelName, baselineLevel: baselineLevel, actions: actions,
    roleRecord: roleRecord,
    can: can, scope: scope, allows: allows, allowsRecord: allowsRecord, isPersonal: isPersonal,
    /* The four predefined roles in PRD 2.1. Manager is an employee with extra
       team-level permissions, not a fourth workspace (PRD 10). */
    predefined: [
      { id: 'admin', name: 'Organization Admin', workspace: 'Admin', users: 2,
        description: 'Governs the organization, users, permissions, billing and platform configuration.' },
      { id: 'hr', name: 'HR Administrator', workspace: 'HR', users: 4,
        description: 'Operates the employee lifecycle, policies, workflows, payroll and performance.' },
      { id: 'manager', name: 'Manager', workspace: 'Employee', users: 31,
        description: 'An employee with team-level view and approval rights. Not a separate workspace.' },
      { id: 'me', name: 'Employee', workspace: 'Employee', users: 248,
        description: 'Self-service access to own records, requests and tasks.' }
    ],
    /* What a manager gains on top of the employee role (PRD 10). */
    managerExtras: [
      'View assigned team members', 'Approve leave requests', 'Review regularization requests',
      'View team attendance', 'Approve shift swaps', 'Complete performance reviews',
      'Review team onboarding tasks', 'Approve resignation requests where configured'
    ]
  };
})();

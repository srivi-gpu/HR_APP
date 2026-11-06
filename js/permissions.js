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
    /* Admin runs the register; HR reads it, because offboarding raises the return
       tasks and needs to see what somebody is holding. */
    { id: 'assets',       label: 'Asset management',     admin: 'full',     hr: 'viewOnly',    me: 'participate', meScope: 'own' },
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
    /* Two sidebar items whose path is not a module name. `time` is one rail row over
       two modules — leave and attendance — and gates on attendance, which is the half
       that is always present; `data` is the export, import and retention module, which
       is the same authority as system settings. Without these two, a module grant that
       withheld attendance still left the row on the rail. */
    'hr/time': 'attendance', 'me/time': 'attendance', 'admin/data': 'settings',
    /* Admin's People module governs accounts, access and the reporting structure, not
       employee records, so it is gated on User management rather than on `people` —
       which admin only reads. The HR workspace keeps `hr/people` on employee records. */
    'admin/people': 'users',
    /* HR's and the employee's Organization item is the reporting tree, which is a
       reading of employee records rather than of the company profile in `org` — the
       employee may not see that one at all, and gating the tree on it would have left
       the rail row there and the screen denied. */
    'hr/org': 'people', 'me/org': 'people', 'team/org': 'people'
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
  /* A team member is an employee who also approves, so they read the employee column
     of the matrix with one row changed. Writing the whole column out again would have
     been twenty-four more cells to keep in step with the employee's, and the first
     time somebody changed one and not the other the two roles would have silently
     diverged. */
  var TEAM_BASE = 'me';
  var TEAM_OVERRIDE = { approvals: 'manage' };

  function matrixLevel(role, moduleId) {
    var m = byModule[moduleId];
    if (!m) return 'full';
    if (role === 'team') return TEAM_OVERRIDE[moduleId] || m[TEAM_BASE] || 'none';
    return m[role] || 'none';
  }

  function levelName(role, moduleId, depth) {
    var rec = roleRecord(role);
    if (rec && rec.perms && rec.perms[moduleId]) return rec.perms[moduleId];
    if (rec && rec.basedOn && rec.basedOn !== role && (depth || 0) < 8) {
      return levelName(rec.basedOn, moduleId, (depth || 0) + 1);
    }
    return matrixLevel(role, moduleId);
  }

  /* What the role would fall back to if its explicit level were cleared. The roles
     screen shows this so an edit reads as a change from something, not from nothing. */
  function baselineLevel(role, moduleId) {
    var rec = roleRecord(role);
    if (rec && rec.basedOn && rec.basedOn !== role) return levelName(rec.basedOn, moduleId);
    return matrixLevel(role, moduleId);
  }
  /* ------------------------------------------------- Per-user module grants

     A role says what a job can do; it does not say what *this person* does. HR is the
     case that makes it obvious: four people hold the HR role and one runs payroll, one
     runs recruitment and two run the lifecycle — and before this, every one of them
     could open every HR screen, because the only dial was the role they shared.

     So a user can be narrowed to a set of modules. A grant only ever takes away: it is
     intersected with the role, never added to it, which means narrowing someone can
     never hand them something their role did not already have. That is the one
     property this has to hold, because it is what makes a grant safe to edit.

     No grant at all means "everything the role allows", so nothing changes for anyone
     until somebody is deliberately narrowed.

     `ALWAYS` is what a grant cannot take: a person must be able to reach their own
     dashboard, search what they can see, read their notifications and open their own
     record, or narrowing them would lock them out of the product rather than out of a
     module. */
  var ALWAYS = { notifications: true };
  function grants() { return (HRMS.store && HRMS.store.pref('moduleGrants')) || {}; }
  /* The user record behind a workspace. The prototype signs in as the role's persona,
     so the active user is the one whose employee is that persona. */
  function userFor(role) {
    var store = HRMS.store;
    if (!store) return null;
    var who = store.persona(role);
    if (!who) return null;
    return store.collection('users').filter(function (u) { return u.employee === who.id; })[0] || null;
  }
  function grantFor(userId) {
    var g = grants()[userId];
    return g && g.length ? g : null;
  }
  /* What the signed-in person of this workspace is narrowed to, or null for everything
     the role allows. */
  function activeGrant(role) {
    var u = userFor(role);
    return u ? grantFor(u.id) : null;
  }
  function isNarrowed(role, moduleId) {
    if (ALWAYS[moduleId]) return false;
    var g = activeGrant(role);
    return !!g && g.indexOf(moduleId) < 0;
  }

  /* ------------------------------------------- Who approves

     Approving is not a rank, it is a position in the reporting line: a manager, an HR
     administrator and the IT administrator all stand above somebody, and an approval
     is the same object whichever of them is looking at it. So one inbox, reached by
     all three — and the rule for who reaches it is read off the tree rather than
     written down, which means only a leaf, with nobody under them, has none.

     The alternative was a flag on the role, and a flag would have been wrong the day
     somebody's last report moved to another team. */
  function hasReports(role) {
    var store = HRMS.store;
    if (!store) return false;
    var who = store.persona(role);
    if (!who) return false;
    return store.collection('employees').some(function (e) {
      return e.manager === who.id && e.status !== 'Exited';
    });
  }

  function actions(role, moduleId) {
    if (isNarrowed(role, moduleId)) return [];
    if (moduleId === 'approvals' && !hasReports(role)) return [];
    return LEVELS[levelName(role, moduleId)] || [];
  }
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
  /* Routes a module grant may never take away: the way in, the way to find things, and
     a person's own record and notifications. */
  var OPEN_PATHS = /^(admin|hr|me)\/(dashboard|search)(\/|$)|^me\/profile(\/|$)/;
  function allows(role, path) {
    if (OPEN_PATHS.test(path || '')) {
      var m0 = moduleOf(path);
      return !m0 || (LEVELS[levelName(role, m0)] || []).indexOf('view') >= 0;
    }
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

  /* Writing a grant. Always intersected with what the role allows, so the stored set
     can never describe more access than the role carries. */
  function setGrant(userId, role, moduleIds) {
    var store = HRMS.store;
    var next = Object.assign({}, grants());
    if (!moduleIds) delete next[userId];
    else {
      next[userId] = moduleIds.filter(function (m) {
        return (LEVELS[levelName(role, m)] || []).indexOf('view') >= 0;
      });
    }
    store.setPref('moduleGrants', next);
  }
  /* Every module this role can view, which is the most a grant for it may contain. */
  function modulesForRole(role) {
    return MATRIX.filter(function (m) {
      return !ALWAYS[m.id] && (LEVELS[levelName(role, m.id)] || []).indexOf('view') >= 0;
    });
  }

  HRMS.permissions = {
    matrix: MATRIX, byModule: byModule, levels: LEVELS, scopes: SCOPES, allActions: FULL,
    moduleOf: moduleOf, levelName: levelName, baselineLevel: baselineLevel, actions: actions,
    roleRecord: roleRecord,
    hasReports: hasReports,
    grants: grants, grantFor: grantFor, setGrant: setGrant, userFor: userFor,
    activeGrant: activeGrant, isNarrowed: isNarrowed, modulesForRole: modulesForRole,
    can: can, scope: scope, allows: allows, allowsRecord: allowsRecord, isPersonal: isPersonal,
    /* The four predefined roles in PRD 2.1. Manager is an employee with extra
       team-level permissions, not a fourth workspace (PRD 10). */
    predefined: [
      { id: 'admin', name: 'Organization Admin', workspace: 'Admin', users: 2,
        description: 'Governs the organization, users, permissions, billing and platform configuration.' },
      { id: 'hr', name: 'HR Administrator', workspace: 'HR', users: 4,
        description: 'Operates the employee lifecycle, policies, workflows, payroll and performance.' },
      /* It is a workspace now. "An employee with approval rights" was always a
         workspace wearing a disclaimer: the rights are real, they need a screen to be
         used on, and the screen needs a sidebar to be reached from. */
      { id: 'team', name: 'Team member', workspace: 'Team member', users: 31,
        description: 'An employee who also approves: everything in the employee workspace, plus the requests from the people who report to them.' },
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

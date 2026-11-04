/* Store: seed data plus the changes a viewer makes, persisted to localStorage.
   Everything reads through get(); writes go through mutate() and notify subscribers.
   Every localStorage call is guarded, so the prototype still works in a private window. */
(function () {
  var HRMS = (window.HRMS = window.HRMS || {});
  var KEY = 'hrms.prototype.v1';

  var subs = [];
  var patch = read();

  function read() {
    try {
      var raw = window.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function write() {
    try { window.localStorage.setItem(KEY, JSON.stringify(patch)); } catch (e) { /* private window, quota, blocked */ }
  }

  /* ---- Preferences (role, theme, collapsed rail) ---- */
  /* `setupComplete` starts false, so organisation setup is the first thing an admin meets
     after signing in. It is set once the wizard is finished or skipped and never returns
     by itself; the dashboard reopens it on demand. Only the Admin workspace is held by it
     — HR and Employee sign in to their own workspaces untouched. */
  /* `signedIn` is what makes the sign-in page the front door. Without it the app had
     no notion of being signed out at all: an empty hash fell through to the stored
     role's dashboard, so the first thing a visitor saw was somebody's workspace. */
  var DEFAULTS = { role: 'hr', signedIn: false, theme: 'system', railCollapsed: false,
    readNotifications: [], setupComplete: false };

  function pref(key) { return patch.prefs && patch.prefs[key] !== undefined ? patch.prefs[key] : DEFAULTS[key]; }
  function setPref(key, value) {
    patch.prefs = patch.prefs || {};
    patch.prefs[key] = value;
    write(); notify();
  }

  /* ---- Overrides on seeded records ---- */
  function overrides(collection) { return (patch.overrides && patch.overrides[collection]) || {}; }
  function setOverride(collection, id, fields) {
    patch.overrides = patch.overrides || {};
    patch.overrides[collection] = patch.overrides[collection] || {};
    patch.overrides[collection][id] = Object.assign({}, patch.overrides[collection][id], fields);
    write(); notify();
  }
  function added(collection) { return (patch.added && patch.added[collection]) || []; }
  function add(collection, record) {
    patch.added = patch.added || {};
    patch.added[collection] = (patch.added[collection] || []).concat([record]);
    write(); notify();
    return record;
  }
  /* Removal is a tombstone, because seeded rows cannot be deleted from the seed. */
  function removed(collection) { return (patch.removed && patch.removed[collection]) || []; }
  function remove(collection, id) {
    patch.removed = patch.removed || {};
    patch.removed[collection] = (patch.removed[collection] || []).concat([id]);
    if (patch.added && patch.added[collection]) {
      patch.added[collection] = patch.added[collection].filter(function (x) { return x.id !== id; });
    }
    write(); notify();
  }

  /* Next id in a collection's own series, e.g. nextId('leaveRequests', 'LV'). */
  function nextId(collection, prefix) {
    var max = 0;
    collectionOf(collection).forEach(function (row) {
      var m = String(row.id || '').match(new RegExp('^' + prefix + '(\\d+)$'));
      if (m) max = Math.max(max, Number(m[1]));
    });
    return prefix + (max + 1);
  }

  /* Audit trail. Every action goes through here, so PRD 14's "changes must retain
     history" and the audit screens in 2.1 read from one place. */
  function log(action, category, extra) {
    var role = pref('role');
    var actor = HRMS.nav && HRMS.nav.role ? (HRMS.store.persona(role) || {}).id : null;
    return add('audit', Object.assign({
      id: nextId('audit', 'AUD'),
      actor: actor, action: action, category: category || 'User activity',
      on: new Date().toISOString().slice(0, 16), local: true
    }, extra || {}));
  }

  /* Seeded rows with any stored edits folded in, plus rows added in this browser,
     minus anything deleted. Rows added here come first, so new records are visible.

     Overrides must fold into added rows as well as seeded ones. Without that, a record
     created in this session could never be edited: approving a leave request that was
     applied for in-session would report success and change nothing. */
  function collectionOf(name) {
    var over = overrides(name);
    var gone = removed(name);
    function fold(row) { return over[row.id] ? Object.assign({}, row, over[row.id]) : row; }
    return added(name).map(fold)
      .concat((HRMS.seed[name] || []).map(fold))
      .filter(function (row) { return gone.indexOf(row.id) < 0; });
  }
  var collection = collectionOf;

  function find(name, id) {
    return collectionOf(name).filter(function (row) { return row.id === id; })[0] || null;
  }

  function notify() { subs.forEach(function (fn) { fn(); }); }

  /* ---- Theme ---- */
  function applyTheme() {
    var t = pref('theme');
    if (t === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
  }

  /* ---- Notifications ---- */
  function notificationsFor(role) {
    var readIds = pref('readNotifications') || [];
    return HRMS.seed.notifications
      .filter(function (n) { return n.roles.indexOf(role) >= 0; })
      .map(function (n) { return Object.assign({}, n, { read: n.read || readIds.indexOf(n.id) >= 0 }); });
  }
  function markRead(ids) {
    var next = (pref('readNotifications') || []).slice();
    [].concat(ids).forEach(function (id) { if (next.indexOf(id) < 0) next.push(id); });
    setPref('readNotifications', next);
  }

  /* ---- Derived figures the dashboards use ---- */
  /* Every figure here is derived from the sample data, never hardcoded on a screen
     (PRD 15). The smoke test asserts the key ones against HRMS.seed.targets. */
  function stats() {
    var emps = collection('employees');
    var live = emps.filter(function (e) { return e.status !== 'Exited'; });
    var att = collection('attendanceToday');
    var leave = collection('leaveRequests');
    var regs = collection('regularizations');
    var monthStart = HRMS.seed.todayIso.slice(0, 8) + '01';
    function countAtt(s) { return att.filter(function (a) { return a.status === s; }).length; }
    function countStatus(s) { return live.filter(function (e) { return e.status === s; }).length; }
    return {
      headcount: live.length,
      active: countStatus('Active'),
      probation: countStatus('Probation'),
      notice: countStatus('Notice Period'),
      suspended: countStatus('Suspended'),
      invited: countStatus('Invited'),
      onboarding: countStatus('Onboarding') + countStatus('Invited'),
      exited: emps.filter(function (e) { return e.status === 'Exited'; }).length,
      newJoiners: live.filter(function (e) { return e.joined >= monthStart; }).length,
      present: countAtt('Present') + countAtt('Late'),
      wfh: countAtt('Work From Home'),
      absent: countAtt('Absent'),
      onLeaveToday: countAtt('On Leave'),
      late: countAtt('Late'),
      missingPunch: countAtt('Missing Punch'),
      pendingLeave: leave.filter(function (l) { return l.status === 'Pending Approval'; }).length,
      pendingRegs: regs.filter(function (x) { return x.status === 'Pending Approval'; }).length,
      pendingAssetRequests: collection('assetRequests').filter(function (a) { return a.status === 'Pending Approval'; }).length,
      pendingOnboardingTasks: collection('onboarding').reduce(function (n, o) { return n + (o.tasksTotal - o.tasksDone); }, 0),
      pendingApprovals: collection('approvals').filter(function (a) { return a.status === 'Pending Approval'; }).length,
      locations: HRMS.seed.locations.length,
      departments: HRMS.seed.departments.length,
      entities: HRMS.seed.entities.length
    };
  }

  HRMS.store = {
    seed: null,                      // filled in below
    collection: collection,
    find: find,
    add: add,
    remove: remove,
    nextId: nextId,
    log: log,
    setOverride: setOverride,
    pref: pref,
    setPref: setPref,
    applyTheme: applyTheme,
    notificationsFor: notificationsFor,
    markRead: markRead,
    stats: stats,
    employee: function (id) {
      var over = overrides('employees')[id];
      var base = HRMS.seed.byId[id]
        || added('employees').filter(function (e) { return e.id === id; })[0];
      if (!base) return null;
      return over ? Object.assign({}, base, over) : base;
    },
    /* Featured employees are addressed by name, so seeded records never pin an ID.
       Falls back to a scan so someone created in this session is findable too. */
    employeeByName: function (name) {
      var base = HRMS.seed.byName[name]
        || collectionOf('employees').filter(function (e) { return e.name === name; })[0];
      return base ? HRMS.store.employee(base.id) : null;
    },
    /* The signed-in employee for a workspace, per nav.js. */
    persona: function (roleId) {
      var role = HRMS.nav.role(roleId);
      return HRMS.store.employeeByName(role.persona);
    },
    department: function (id) { return HRMS.seed.departments.filter(function (d) { return d.id === id; })[0] || null; },
    designation: function (id) { return HRMS.seed.designations.filter(function (d) { return d.id === id; })[0] || null; },
    location: function (id) { return HRMS.seed.locations.filter(function (l) { return l.id === id; })[0] || null; },
    leaveType: function (id) { return HRMS.seed.leaveTypes.filter(function (t) { return t.id === id; })[0] || null; },
    shift: function (id) { return HRMS.seed.shifts.filter(function (s) { return s.id === id; })[0] || null; },
    /* Leave balances are keyed by employee rather than row id, so they get their own
       patch bucket instead of going through overrides. */
    balancesFor: function (id) {
      var local = patch.balances && patch.balances[id];
      return local || HRMS.seed.balances[id] || [];
    },
    setBalances: function (id, rows) {
      patch.balances = patch.balances || {};
      patch.balances[id] = rows;
      write(); notify();
    },
    subscribe: function (fn) { subs.push(fn); return function () { subs = subs.filter(function (x) { return x !== fn; }); }; },
    reset: function () {
      patch = {};
      try { window.localStorage.removeItem(KEY); } catch (e) {}
      applyTheme(); notify();
    }
  };

  HRMS.store.seed = HRMS.seed;
  applyTheme();
})();

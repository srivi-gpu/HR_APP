/* Roles & permissions (PRD 10), as a role you select rather than a matrix you read.

   The old screen printed the permission matrix: modules down, the three workspaces
   across, nothing to change. Custom roles sat on a separate tab and carried no
   permissions at all, so creating one varied nobody's access. Both are the same screen
   now — pick a role on the left, change what it may do on the right — because a
   permission only means anything next to the role holding it.

   What is edited here governs the application. js/permissions.js resolves a level by
   asking the role record first, so lowering HR's access to payroll hides those screens
   from HR the moment it is saved, and the access-denied state is the one in PRD 16.6.
   Levels are the ones in the matrix rather than free-form action ticks: an action set
   that no level describes would have nothing to show in the workspace.

   The one edit refused is the one that cannot be undone from here: the signed-in role
   may not drop its own view right on this module, which would close the door from the
   inside. */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var store = HRMS.store, router = HRMS.router, ui = HRMS.ui, perms = HRMS.permissions;
  var Card = ui.Card, PageHead = ui.PageHead;

  var LEVEL_TONE = { full: 'success', manage: 'success', limited: 'info', own: 'info', participate: 'info', viewOnly: 'neutral', none: 'error' };
  var LEVEL_LABEL = { full: 'Full', manage: 'Manage', limited: 'Limited', own: 'Own records', participate: 'Participate', viewOnly: 'View only', none: 'No access' };
  var LEVEL_ORDER = ['full', 'manage', 'limited', 'participate', 'own', 'viewOnly', 'none'];
  var ACTION_LABEL = { view: 'View', create: 'Create', edit: 'Edit', 'delete': 'Delete', approve: 'Approve', export: 'Export', configure: 'Configure' };

  /* Added rows come back before seeded ones, so order them deliberately: the four the
     PRD defines, then whatever this organization has added, each alphabetically. */
  function roles() {
    return store.collection('roles').slice().sort(function (a, b) {
      if (!!a.system !== !!b.system) return a.system ? -1 : 1;
      if (a.system && b.system) return 0;
      return a.name.localeCompare(b.name);
    });
  }
  function roleById(id) { return store.find('roles', id); }

  /* An explicit level, or null where the role still falls through to its baseline. */
  function explicit(role, moduleId) {
    return role && role.perms ? (role.perms[moduleId] || null) : null;
  }

  function setLevel(role, moduleId, level) {
    var next = Object.assign({}, role.perms || {});
    if (level === '__inherit') delete next[moduleId]; else next[moduleId] = level;
    store.setOverride('roles', role.id, { perms: next });
    store.log((level === '__inherit' ? 'reset ' : 'changed ') + role.name + ' on ' + (perms.byModule[moduleId] || {}).label, 'Configuration');
  }

  /* ------------------------------------------------------------ New role */
  function RoleModal(p) {
    var all = roles();
    var nameSt = React.useState(p.copyOf ? p.copyOf.name + ' copy' : '');
    var descSt = React.useState(p.copyOf ? p.copyOf.description : '');
    var baseSt = React.useState(p.copyOf ? p.copyOf.id : 'me');
    var triedSt = React.useState(false);

    var name = nameSt[0].trim();
    var clash = all.some(function (r) { return r.name.toLowerCase() === name.toLowerCase(); });
    var error = triedSt[0] ? (!name ? 'Give the role a name' : clash ? 'A role with this name already exists' : null) : null;

    function save() {
      triedSt[1](true);
      if (!name || clash) return;
      var base = roleById(baseSt[0]);
      var id = 'role-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36).slice(-4);
      store.add('roles', {
        id: id, name: name, description: descSt[0].trim() || 'Custom role.',
        workspace: base ? base.workspace : 'Employee', system: false,
        basedOn: baseSt[0], users: 0,
        /* Copied, not referenced: duplicating a role takes its permissions as they are
           now, so editing the original later does not quietly change this one. */
        perms: p.copyOf ? Object.assign({}, p.copyOf.perms || {}) : {}
      });
      store.log('created the ' + name + ' role', 'Configuration');
      ui.toast(name + ' created');
      p.onCreated(id);
    }

    return h(ui.Modal, {
      title: p.copyOf ? 'Duplicate ' + p.copyOf.name : 'New role',
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
        h(V.Button, { variant: 'primary', iconStart: I.check, onClick: save }, p.copyOf ? 'Duplicate role' : 'Create role'))
    },
      h(V.TextField, {
        label: 'Role name', required: true, autoFocus: true, placeholder: 'e.g. Payroll Reviewer',
        value: nameSt[0], status: error ? 'error' : 'default', hint: error || undefined,
        onChange: function (e) { nameSt[1](e.target.value); },
        onKeyDown: function (e) { if (e.key === 'Enter') save(); }
      }),
      h(V.TextArea, {
        label: 'What this role is for', rows: 2, value: descSt[0],
        placeholder: 'Reviews the payroll register before it is finalised.',
        onChange: function (e) { descSt[1](e.target.value); }
      }),
      p.copyOf ? null : h(V.Select, {
        label: 'Start with the permissions of', value: baseSt[0],
        options: all.map(function (r) { return { value: r.id, label: r.name }; }),
        onChange: function (v) { baseSt[1](v); },
        hint: 'The new role falls back to this one wherever it says nothing of its own.'
      }));
  }

  /* ------------------------------------------------------------- Screen */
  function RolePermissions() {
    var all = roles();
    var selSt = React.useState(all[0] ? all[0].id : null);
    var newSt = React.useState(null);          // null | {copyOf}
    var confirmSt = React.useState(null);
    var qSt = React.useState('');

    var role = roleById(selSt[0]) || all[0];
    var signedIn = store.pref('role');

    if (!role) return h(ui.Empty, { icon: I.shield, title: 'No roles defined' });

    var q = qSt[0].trim().toLowerCase();
    var modules = perms.matrix.filter(function (m) {
      return !q || m.label.toLowerCase().indexOf(q) >= 0 || m.id.indexOf(q) >= 0;
    });
    var changed = Object.keys(role.perms || {}).length;

    function remove() {
      store.remove('roles', role.id);
      store.log('deleted the ' + role.name + ' role', 'Configuration');
      ui.toast(role.name + ' deleted');
      confirmSt[1](null);
      selSt[1](all[0].id);
    }

    function resetAll() {
      store.setOverride('roles', role.id, { perms: {} });
      store.log('reset ' + role.name + ' to its default permissions', 'Configuration');
      ui.toast(role.name + ' reset to defaults');
    }

    return h(React.Fragment, null,
      h(PageHead, {
        eyebrow: 'Roles & permissions', title: 'Module permissions',
        description: 'Pick a role, then set what it may do in each module. Changes apply across the application immediately.',
        actions: [
          h(V.Button, { key: 'd', variant: 'outline', iconStart: I.copy,
            onClick: function () { newSt[1]({ copyOf: role }); } }, 'Duplicate'),
          h(V.Button, { key: 'n', variant: 'primary', iconStart: I.plus,
            onClick: function () { newSt[1]({}); } }, 'New role')
        ]
      }),

      h('div', { className: 'roles2' },
        /* ---- the roles ---- */
        h('div', null,
          h('div', { className: 'roles2__head' },
            h('span', { className: 'eyebrow' }, all.length + ' roles'),
            changed ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'info' }, changed + ' changed') : null),
          h('div', { className: 'roles2__list', role: 'tablist', 'aria-label': 'Roles' }, all.map(function (r) {
            var edits = Object.keys(r.perms || {}).length;
            return h('button', {
              key: r.id, type: 'button', role: 'tab', 'aria-selected': r.id === role.id ? 'true' : 'false',
              className: 'rolebtn' + (r.id === role.id ? ' is-on' : ''),
              onClick: function () { selSt[1](r.id); }
            },
              h('span', { className: 'rolebtn__ico' }, r.system ? I.shield : I.person),
              h('span', { className: 'rolebtn__t' },
                h('span', { className: 'rolebtn__name' }, r.name),
                h('span', { className: 'rolebtn__sub' },
                  r.workspace + ' workspace' + (edits ? ' · ' + edits + ' changed' : ''))),
              h('span', { className: 'rolebtn__n' }, r.users || 0));
          }))),

        /* ---- what it may do ---- */
        h('div', { className: 'stack gap-3' },
          h(Card, {
            title: role.name,
            description: role.description,
            aside: h('span', { className: 'row gap-2' },
              h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: role.system ? 'neutral' : 'info' },
                role.system ? 'System role' : 'Custom role'),
              changed ? h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', onClick: resetAll }, 'Reset to default') : null,
              role.system ? null : h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', iconStart: I.trash,
                onClick: function () { confirmSt[1](true); } }, 'Delete'))
          },
            role.basedOn ? h('p', { className: 'muted', style: { marginTop: 0 } },
              'Falls back to ', h('strong', null, (roleById(role.basedOn) || {}).name || role.basedOn),
              ' wherever this role says nothing of its own.') : null,
            h(V.SearchField, {
              'aria-label': 'Filter modules', placeholder: 'Filter modules', value: qSt[0],
              onChange: function (e) { qSt[1](e.target.value); }
            })),

          h('div', { className: 'pmods' }, modules.map(function (m) {
            var own = explicit(role, m.id);
            var level = perms.levelName(role.id, m.id);
            var base = perms.baselineLevel(role.id, m.id);
            var granted = perms.levels[level] || [];
            /* Closing the door from the inside: the signed-in role cannot take away its
               own sight of this module, because nothing here would be reachable after. */
            var locked = role.id === signedIn && m.id === 'roles';

            return h('div', { className: 'pmod' + (own ? ' is-changed' : ''), key: m.id },
              h('div', { className: 'pmod__head' },
                h('span', { className: 'pmod__name' },
                  h('strong', null, m.label),
                  h('span', null, own
                    ? 'Changed from ' + LEVEL_LABEL[base]
                    : 'Default · ' + LEVEL_LABEL[base] + (m.confidential ? ' · confidential' : ''))),
                m.confidential ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'warning', icon: I.lock }, 'Restricted') : null,
                h('span', { className: 'pmod__pick' },
                  h(V.Select, {
                    'aria-label': m.label + ' permission for ' + role.name,
                    value: own || '__inherit', disabled: locked,
                    options: [{ value: '__inherit', label: 'Default · ' + LEVEL_LABEL[base] }].concat(
                      LEVEL_ORDER.map(function (k) { return { value: k, label: LEVEL_LABEL[k] }; })),
                    onChange: function (v) {
                      if (locked) return;
                      setLevel(role, m.id, v);
                      ui.toast(role.name + ' · ' + m.label + ' · ' + (v === '__inherit' ? 'reset to default' : LEVEL_LABEL[v]));
                    }
                  }))),
              h('div', { className: 'pmod__acts' },
                locked
                  ? h('span', { className: 'pact' }, I.lock, 'You are signed in as this role, so it keeps its own access here')
                  : perms.allActions.map(function (a) {
                      var on = granted.indexOf(a) >= 0;
                      return h('span', { className: 'pact' + (on ? ' is-on' : ''), key: a },
                        on ? I.check : null, ACTION_LABEL[a]);
                    })));
          })),

          modules.length ? null : h(ui.Empty, { icon: I.search, title: 'No module matches “' + qSt[0].trim() + '”' }))),

      newSt[0] ? h(RoleModal, {
        copyOf: newSt[0].copyOf,
        onClose: function () { newSt[1](null); },
        onCreated: function (id) { newSt[1](null); selSt[1](id); }
      }) : null,

      confirmSt[0] ? h(ui.Modal, {
        title: 'Delete ' + role.name + '?',
        onClose: function () { confirmSt[1](null); },
        footer: h(React.Fragment, null,
          h(V.Button, { variant: 'outline', onClick: function () { confirmSt[1](null); } }, 'Cancel'),
          h(V.Button, { variant: 'primary', onClick: remove }, 'Delete role'))
      },
        h('p', null, 'Anyone holding ' + role.name + ' falls back to '
          + ((roleById(role.basedOn) || {}).name || 'Employee') + '. This cannot be undone from here.')) : null);
  }

  HRMS.screens.register({ 'admin/roles/modules': RolePermissions });
})();

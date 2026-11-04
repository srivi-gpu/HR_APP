/* The application shell: floating side rail, role switcher, top bar and the page frame.
   Matches the layout rules in PRD section 12.2 — 248px rail, 64px top bar, 32px page padding. */
(function () {
  var HRMS = (window.HRMS = window.HRMS || {});
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var store = HRMS.store, router = HRMS.router, ui = HRMS.ui;

  /* ---------- Prototype role switch ----------
     Which workspace you are looking from is a fact about the prototype, not about the
     product, so it is kept apart from the application's own furniture: a pill in the
     bottom corner that names the role you hold and opens the three to choose from.
     It replaces the switcher that used to sit at the top of the rail, where it read as
     part of the product. */
  function ProtoSwitch(p) {
    var openSt = React.useState(false);
    var ref = React.useRef(null);

    React.useEffect(function () {
      if (!openSt[0]) return;
      function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) openSt[1](false); }
      function onKey(e) { if (e.key === 'Escape') openSt[1](false); }
      document.addEventListener('mousedown', onDoc);
      document.addEventListener('keydown', onKey);
      return function () { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
    }, [openSt[0]]);

    var current = HRMS.nav.role(p.role);

    return h('div', { className: 'proto', ref: ref },
      openSt[0] ? h('div', { className: 'proto__panel', role: 'dialog', 'aria-label': 'Prototype role' },
        h('div', { className: 'stack gap-1' },
          h('span', { className: 'eyebrow' }, 'Prototype · ' + HRMS.nav.roles.length + ' workspaces'),
          h('strong', null, current.label + ' workspace'),
          h('span', { className: 'proto__node muted' }, 'Screen: ', h('span', { className: 'mono' }, '#/' + p.path))),
        h('div', { className: 'proto__scen' }, HRMS.nav.roles.map(function (r) {
          var on = r.id === p.role;
          var persona = store.employeeByName(r.persona);
          return h('button', {
            key: r.id, type: 'button', 'aria-current': on ? 'true' : undefined,
            className: on ? 'is-now' : undefined,
            onClick: function () {
              openSt[1](false);
              if (on) return;
              store.setPref('role', r.id);
              router.go(r.home);
            }
          },
            r.label,
            on ? h('span', { className: 'proto__badge' }, 'Current role') : null,
            h('small', null, persona ? persona.name + ' · ' + persona.workEmail : r.persona));
        }))) : null,
      h('button', {
        type: 'button', className: 'proto__toggle', 'aria-expanded': openSt[0] ? 'true' : 'false',
        onClick: function () { openSt[1](!openSt[0]); }
      }, I.flask, openSt[0] ? 'Close'
        : h(React.Fragment, null, 'Workspace', h('span', { className: 'proto__now' }, current.label))));
  }

  /* ---------- Side rail ---------- */
  function SideNav(p) {
    var role = HRMS.nav.role(p.role);
    var collapsed = p.collapsed;
    var counts = p.counts;

    function badgeFor(item) {
      if (item.path === 'approvals') return counts.pendingApprovals || null;
      if (item.path === 'leave' && p.role === 'hr') return counts.pendingLeave || null;
      return null;
    }

    return h('nav', { className: 'sidenav', 'aria-label': 'Main navigation' },
      h('div', { className: 'sidenav__head' },
        h('div', { className: 'brand' },
          h('span', { className: 'brand__mark' }, 'A'),
          h('span', { className: 'brand__name' }, 'Aptagrim HR'))),

      h('div', { className: 'sidenav__items' }, role.groups.map(function (group, gi) {
        return h(React.Fragment, { key: group.label || gi },
          group.label ? h('div', { className: 'sidenav__group' }, group.label) : null,
          group.items.map(function (item) {
            /* A linked item leaves the single-page prototype, so it renders as a real anchor and
               never takes the selected state — no route of ours is current while it is open. */
            if (item.href) {
              return h(V.ListItem, {
                key: item.path, icon: I[item.icon], collapsed: collapsed, href: item.href,
                trailingIcon: collapsed ? null : I.external, 'aria-label': item.label,
                onClick: function () { if (p.onNavigate) p.onNavigate(); }
              }, item.label);
            }
            var base = role.id + '/' + item.path;
            /* An item whose tabs keep their own routes is current when any of them is. */
            var on = p.path === base || p.path.indexOf(base + '/') === 0
              || (item.tabs || []).some(function (t) {
                return t.route && (p.path === t.route || p.path.indexOf(t.route + '/') === 0);
              });
            var badge = badgeFor(item);
            return h(V.ListItem, {
              key: item.path, icon: I[item.icon], selected: on, collapsed: collapsed,
              badge: badge, badgeTone: on ? 'primary' : 'neutral',
              'aria-label': item.label,
              onClick: function () { router.go(base); if (p.onNavigate) p.onNavigate(); }
            }, item.label);
          }));
      })),

      /* Settings and the theme toggle live in the profile menu, so the rail foot
         carries only the control that acts on the rail itself. */
      h('div', { className: 'sidenav__foot' },
        h(V.ListItem, {
          icon: collapsed ? I.panelRight : I.panelLeft, collapsed: collapsed,
          onClick: function () { store.setPref('railCollapsed', !collapsed); }
        }, 'Collapse')));
  }

  /* ---------- Breadcrumbs ---------- */
  function Crumbs(p) {
    var meta = p.meta;
    if (!meta) return h('div', { className: 'crumbs' }, h('span', { className: 'crumbs__now' }, 'Not found'));
    var role = meta.role ? HRMS.nav.role(meta.role) : null;
    var parts = [];
    if (role) parts.push({ label: role.label, to: role.home });
    if (meta.group) parts.push({ label: meta.group });
    if (meta.item && meta.tab) parts.push({ label: meta.item.label, to: meta.role + '/' + meta.item.path });
    /* In a two-tier module the tab label alone loses which half you are in — Dashboard
       belongs to both Attendance and Leave — so the group goes in the trail as well. */
    if (meta.tab && meta.tab.group) parts.push({ label: meta.tab.group });
    parts.push({ label: meta.label });

    return h('div', { className: 'crumbs', 'aria-label': 'Breadcrumb' }, parts.map(function (part, i) {
      var last = i === parts.length - 1;
      return h(React.Fragment, { key: i },
        i ? h('span', { className: 'crumbs__sep', 'aria-hidden': 'true' }, I.right) : null,
        last ? h('span', { className: 'crumbs__now', 'aria-current': 'page' }, part.label)
          : part.to ? h('button', { type: 'button', onClick: function () { router.go(part.to); } }, part.label)
            : h('span', null, part.label));
    }));
  }

  /* ---------- Profile menu ---------- */
  function ProfileMenu(p) {
    var openSt = React.useState(false);
    var ref = React.useRef(null);
    React.useEffect(function () {
      if (!openSt[0]) return;
      function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) openSt[1](false); }
      function onKey(e) { if (e.key === 'Escape') openSt[1](false); }
      document.addEventListener('mousedown', onDoc);
      document.addEventListener('keydown', onKey);
      return function () { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
    }, [openSt[0]]);

    var me = p.persona;
    function item(icon, label, fn) {
      return h('button', { type: 'button', className: 'menu__item', onClick: function () { openSt[1](false); fn(); } }, icon, label);
    }
    return h('div', { className: 'profile', ref: ref },
      h('button', {
        type: 'button', className: 'avatar-btn', 'aria-label': 'Profile and settings',
        'aria-haspopup': 'true', 'aria-expanded': openSt[0] ? 'true' : 'false',
        onClick: function () { openSt[1](!openSt[0]); }
      }, h(V.Avatar, { name: me ? me.name : 'User', size: 'sm' })),
      openSt[0] ? h('div', { className: 'menu', role: 'menu' },
        h('div', { className: 'menu__head' },
          h(V.Avatar, { name: me ? me.name : 'User', size: 'md' }),
          h('div', { className: 'stack', style: { minWidth: 0 } },
            h('strong', { style: { fontSize: 14, fontWeight: 500 } }, me ? me.name : 'User'),
            h('span', { className: 'menu__mail muted' }, me ? me.workEmail : '—'))),
        h('hr', { className: 'menu__rule' }),
        item(I.person, 'My profile', function () { router.go('me/profile'); }),
        item(I.gear, 'My settings', function () { router.go('me/profile/preferences'); }),
        item(p.dark ? I.sun : I.moon, p.dark ? 'Light mode' : 'Dark mode', function () {
          store.setPref('theme', p.dark ? 'light' : 'dark'); store.applyTheme();
        }),
        item(I.info, 'Help & support', function () { router.go('global/help'); }),
        h('hr', { className: 'menu__rule' }),
        item(I.history, 'Reset prototype data', function () {
          store.reset();
          if (p.onReset) p.onReset();
        }),
        item(I.logout, 'Sign out', function () {
          /* Clearing the session is what makes signing out mean anything: without it
             the next visit walks back into the workspace. */
          store.setPref('signedIn', false);
          router.go('global/login');
        })) : null);
  }

  /* ---------- Top bar ---------- */
  function TopBar(p) {
    return h('header', { className: 'topbar' },
      h(V.IconButton, {
        icon: I.menu, className: 'topbar__menu', 'aria-label': 'Open navigation',
        onClick: p.onOpenDrawer
      }),
      h(Crumbs, { meta: p.meta }),
      h('div', { className: 'topbar__right' },
        h('button', { className: 'searchbar', type: 'button', onClick: p.onSearch },
          h('span', { className: 'searchbar__icon' }, I.search),
          h('span', { className: 'searchbar__text' }, 'Search people, requests, policies'),
          h('span', { className: 'searchbar__kbd' }, 'Ctrl K')),
        h('span', { className: 'bell' },
          h(V.IconButton, {
            icon: I.bell, 'aria-label': p.unread ? p.unread + ' unread notifications' : 'Notifications',
            onClick: function () {
              /* No workspace carries a notifications row in the rail, so the bell is the way in.
                 The per-role check stays: a workspace that regains its own centre keeps it. */
              var own = p.role + '/notifications';
              router.go(HRMS.nav.routes[own] ? own : 'global/notifications');
            }
          }),
          p.unread ? h('span', { className: 'bell__count' }, p.unread > 9 ? '9+' : p.unread) : null),
        h(ProfileMenu, { persona: p.persona, dark: p.dark, onReset: p.onReset })));
  }

  /* ---------- Shell ---------- */
  function AppShell(p) {
    var drawerSt = React.useState(false);
    var collapsed = store.pref('railCollapsed');
    var dark = document.documentElement.dataset.theme === 'dark'
      || (store.pref('theme') === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

    /* Close the mobile drawer whenever the route changes. */
    React.useEffect(function () { drawerSt[1](false); }, [p.path]);

    var role = p.role || 'hr';
    var notes = store.notificationsFor(role);
    var unread = notes.filter(function (n) { return !n.read; }).length;
    var stats = store.stats();
    var persona = store.employee(HRMS.nav.role(role).persona);

    var cls = ['shell', collapsed ? 'is-collapsed' : '', drawerSt[0] ? 'is-drawer' : ''].filter(Boolean).join(' ');

    return h('div', { className: cls },
      h(SideNav, {
        role: role, path: p.path, collapsed: collapsed,
        counts: { pendingApprovals: stats.pendingApprovals, pendingLeave: stats.pendingLeave },
        onNavigate: function () { drawerSt[1](false); }
      }),
      h('div', { className: 'sidenav__scrim', onClick: function () { drawerSt[1](false); } }),
      h('div', { className: 'shell__body' },
        h(TopBar, {
          meta: p.meta, role: role, unread: unread, persona: persona, dark: dark,
          onOpenDrawer: function () { drawerSt[1](true); },
          onSearch: p.onSearch, onReset: p.onReset
        }),
        h('main', { className: 'main' }, p.children)));
  }

  HRMS.shell = { AppShell: AppShell, ProtoSwitch: ProtoSwitch };
})();

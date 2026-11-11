/* Boot: resolve the route, pick a screen, and wrap it in the shell.
   Auth screens render without the shell; everything else gets the rail and top bar. */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var store = HRMS.store, router = HRMS.router, ui = HRMS.ui;

  /* Screens that draw themselves, without the rail and top bar, and that a person who
     has not signed in may reach: the way in, and the two wizards that sit on it — the
     organisation setup an admin meets after signing up, and the joiner's own
     onboarding. Both open over the sign-in screen and sign you in by finishing. */
  var CHROMELESS = ['global/login', 'global/forgot', 'global/reset', 'global/activate', 'global/invite',
    'global/setup', 'global/joiner'];

  /* Re-render whenever the store changes, so a write anywhere updates every screen. */
  function useStore() {
    var tick = React.useState(0);
    React.useEffect(function () {
      return store.subscribe(function () { tick[1](function (n) { return n + 1; }); });
    }, []);
  }

  /* Search is a screen (js/screens/search.js) with an overlay in front of it. The
     overlay is the quick jump — Ctrl K, or the search bar — and the screen is where the
     filters and the full lists live. Both run the one engine, so they cannot answer the
     same query differently; the palette that used to live here had its own, which is
     how it ended up knowing only routes and employee names. */

  /* ---------------------------------------------------------------- Root */
  function App() {
    useStore();
    var route = router.useRoute();
    var paletteSt = React.useState(false);

    /* The stored role is the signed-in account and only the role switcher changes it.
       A deep link into another workspace is therefore refused rather than silently
       switching the session, which is what makes the access-denied state in PRD 16.6
       reachable at all. The denied screen offers a one-click switch. */

    React.useEffect(function () {
      function onKey(e) {
        /* Ctrl K opens the overlay over whatever you are looking at. The Search screen
           is still a screen, reached from the rail or from "See all results". */
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          paletteSt[1](function (v) { return !v; });
        }
      }
      window.addEventListener('keydown', onKey);
      return function () { window.removeEventListener('keydown', onKey); };
    }, []);

    /* Signed out, the only thing to show is the way in. This is a guard rather than a
       redirect: it renders the sign-in page over whatever the hash says, so a deep link
       is still in the address bar when the person signs in and lands on it.

       Organisation setup is not guarded here. It is offered once, by the sign-in
       handler, to an admin whose organisation has not been set up — and nowhere else.
       An app-level redirect used to do it, which meant that looking at the Admin
       workspace through the prototype's workspace switcher dropped you into a wizard
       you had not asked for and could not get out of. */
    var signedIn = store.pref('signedIn') === true;

    /* Follow the OS theme while the preference is "system". */
    React.useEffect(function () {
      if (!window.matchMedia) return;
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      function onChange() { if (store.pref('theme') === 'system') store.applyTheme(); }
      if (mq.addEventListener) { mq.addEventListener('change', onChange); return function () { mq.removeEventListener('change', onChange); }; }
    }, []);

    var palette = paletteSt[0]
      ? h(HRMS.search.Palette, { onClose: function () { paletteSt[1](false); } })
      : null;

    var authPath = CHROMELESS.indexOf(route.path) >= 0 ? route.path
      : (signedIn ? null : 'global/login');
    if (authPath) {
      var Auth = HRMS.screens.registry[authPath];
      return h('div', { className: 'authpage' }, h(Auth, { route: route }),
        h(HRMS.shell.ProtoSwitch, { role: store.pref('role'), path: authPath }),
        palette, h(ui.ToastHost));
    }

    var activeRole = store.pref('role');
    var perms = HRMS.permissions;

    /* Two ways to be refused: the route belongs to another workspace, or the active
       role has no view right on the module (PRD 10). */
    var wrongWorkspace = !route.notFound && route.role && route.role !== activeRole
      && !perms.isPersonal(route.path);
    var noRight = !route.notFound && !wrongWorkspace && !perms.allows(activeRole, route.path);
    var denied = wrongWorkspace || noRight;

    var Screen = HRMS.screens.resolve(route);
    var body, shellMeta = route.meta, shellPath = route.path;

    if (route.notFound) {
      body = h(HRMS.screens.NotFound, { path: route.path });
    } else if (denied) {
      body = h(HRMS.screens.Denied, {
        path: route.path, activeRole: activeRole,
        requiredRole: wrongWorkspace ? route.role : null,
        module: perms.moduleOf(route.path),
        label: route.meta && route.meta.label
      });
      /* Keep the rail on the signed-in workspace rather than the one being refused. */
      shellMeta = { role: activeRole, group: 'Access', label: 'Access denied' };
      shellPath = activeRole + '/__denied';
    } else if (Screen) {
      body = h(Screen, { route: route });
    } else {
      body = h(ui.Stub, { meta: route.meta });
    }

    /* Tabs and the page heading belong to the frame, so every page agrees: the tab
       row, then the name of the tab you are on, then the page.

       The heading is drawn here for every route, from the route's own metadata, and
       the stylesheet hides it where the page already names itself — a screen with its
       own PageHead, or a table whose toolbar carries the title. That way a page can
       still call itself something better than its tab label ("Leave requests" rather
       than "Requests") without any page being left nameless, which 16 of them were. */
    var Banner = route.meta && route.meta.item && route.meta.item.banner
      ? HRMS.screens.banners[route.meta.item.banner] : null;
    var framed = denied || route.notFound ? body : h(React.Fragment, null,
      /* Above the tabs, because it belongs to the person rather than to one tab. */
      Banner ? h(Banner, { route: route }) : null,
      route.meta.item && route.meta.item.tabs
        ? h(ui.ModuleTabs, { item: route.meta.item, role: route.meta.role, active: route.meta.tab && route.meta.tab.path })
        : null,
      h('div', { className: 'page-body' },
        h(ui.PageHead, {
          className: 'page-head--auto', title: route.meta.label, description: route.meta.note
        }),
        body));

    return h(React.Fragment, null,
      h(HRMS.shell.AppShell, {
        path: shellPath, role: activeRole, meta: shellMeta,
        onSearch: function () { paletteSt[1](true); },
        onReset: function () { router.go(HRMS.nav.role(store.pref('role')).home); }
      }, framed),
      h(HRMS.shell.ProtoSwitch, { role: activeRole, path: route.path }),
      palette, h(ui.ToastHost));
  }

  /* The team workspace is the employee workspace plus an approval inbox, so it is the
     employee's screens that have to answer under it. Aliasing them here, once every
     screen module has registered, is what makes "plus one item" true: a screen added
     to the employee workspace tomorrow reaches a manager with no second registration
     to remember, and the two cannot drift apart.

     Anything already registered under team/ — the inbox — is left alone. */
  (function aliasEmployeeScreens() {
    var reg = HRMS.screens.registry;
    Object.keys(reg).forEach(function (path) {
      if (path.indexOf('me/') !== 0) return;
      var mirrored = 'team/' + path.slice(3);
      if (!reg[mirrored]) reg[mirrored] = reg[path];
    });
  })();

  /* The same again for admin, which now carries HR's modules: one screen answers in
     both workspaces rather than two that start identical and drift. Anything admin
     has registered for itself is left alone — its asset register, its own people
     screens — because that is a different screen, not a copy of HR's. */
  (function aliasHrScreens() {
    var reg = HRMS.screens.registry;
    Object.keys(reg).forEach(function (path) {
      if (path.indexOf('hr/') !== 0) return;
      var mirrored = 'admin/' + path.slice(3);
      if (!reg[mirrored]) reg[mirrored] = reg[path];
    });
  })();

  HRMS.App = App;   // exported so the smoke test can render routes outside a browser
  ReactDOM.createRoot(document.getElementById('root')).render(h(App));
})();

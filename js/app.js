/* Boot: resolve the route, pick a screen, and wrap it in the shell.
   Auth screens render without the shell; everything else gets the rail and top bar. */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var store = HRMS.store, router = HRMS.router, ui = HRMS.ui;

  var CHROMELESS = ['global/login', 'global/forgot', 'global/reset', 'global/activate', 'global/invite', 'global/setup'];

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

    /* Tabs and page head belong to the frame, so a stub and a built screen agree.
       A built screen draws its own head; only stubs get one here. */
    var framed = denied || route.notFound ? body : h(React.Fragment, null,
      Screen ? null : h(ui.PageHead, { eyebrow: route.meta.group, title: route.meta.label }),
      route.meta.item && route.meta.item.tabs
        ? h(ui.ModuleTabs, { item: route.meta.item, role: route.meta.role, active: route.meta.tab && route.meta.tab.path })
        : null,
      body);

    return h(React.Fragment, null,
      h(HRMS.shell.AppShell, {
        path: shellPath, role: activeRole, meta: shellMeta,
        onSearch: function () { paletteSt[1](true); },
        onReset: function () { router.go(HRMS.nav.role(store.pref('role')).home); }
      }, framed),
      h(HRMS.shell.ProtoSwitch, { role: activeRole, path: route.path }),
      palette, h(ui.ToastHost));
  }

  HRMS.App = App;   // exported so the smoke test can render routes outside a browser
  ReactDOM.createRoot(document.getElementById('root')).render(h(App));
})();

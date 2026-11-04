/* Hash router. Routes look like #/hr/leave/requests, so every screen is a real
   bookmarkable link and the browser's back button behaves. */
(function () {
  var HRMS = (window.HRMS = window.HRMS || {});
  var React = window.React;

  function raw() { return window.location.hash.replace(/^#\/?/, ''); }

  function current() {
    /* An empty hash is a visitor, not a session. Falling back to the stored role's
       dashboard is what used to land the first page view inside somebody's
       workspace; the app's own guard decides what a signed-out visitor sees. */
    return raw().split('?')[0].replace(/\/+$/, '')
      || (HRMS.store.pref('signedIn') ? HRMS.store.pref('role') + '/dashboard' : 'global/login');
  }

  /* A route may carry a query string, so a screen that takes input — search — can put it
     in the URL and stay a real link. The path is everything before the '?', so nav
     resolution and the route table are untouched by it. */
  function query() {
    var out = {}, qs = raw().split('?')[1];
    if (!qs) return out;
    qs.split('&').forEach(function (pair) {
      if (!pair) return;
      var i = pair.indexOf('=');
      var k = i < 0 ? pair : pair.slice(0, i);
      var v = i < 0 ? '' : pair.slice(i + 1);
      try { out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); }
      catch (e) { out[k] = v; }
    });
    return out;
  }

  function go(path) {
    var next = String(path).replace(/^\/+/, '');
    if (raw() === next) return;
    window.location.hash = '#/' + next;
  }
  function replace(path) {
    var url = window.location.pathname + window.location.search + '#/' + String(path).replace(/^\/+/, '');
    window.history.replaceState(null, '', url);
  }

  /* Re-render on hash change, and hand screens the resolved route. */
  function useRoute() {
    /* The query is held alongside the path, so a change to it alone still re-renders. */
    var st = React.useState(function () { return { path: current(), query: query() }; });
    React.useEffect(function () {
      function onHash() { st[1]({ path: current(), query: query() }); }
      window.addEventListener('hashchange', onHash);
      return function () { window.removeEventListener('hashchange', onHash); };
    }, []);
    var path = st[0].path;
    var meta = HRMS.nav.resolve(path);

    /* An item that only has tabs lands on its first tab — keep the URL honest. */
    React.useEffect(function () {
      if (meta && meta.path !== path) replace(meta.path);
    }, [path, meta && meta.path]);

    return {
      path: meta ? meta.path : path,
      query: st[0].query,
      meta: meta,
      role: meta && meta.role ? meta.role : (path.split('/')[0] === 'global' ? null : path.split('/')[0]),
      notFound: !meta
    };
  }

  /* Navigate to a route in any workspace, switching the signed-in role if it belongs to
     another one. Used by the command palette and the screen map, where crossing
     workspaces is the explicit intent — unlike a pasted deep link, which is refused. */
  function goAs(path) {
    var meta = HRMS.nav.resolve(path);
    var role = meta && meta.role;
    if (role && role !== HRMS.store.pref('role')) HRMS.store.setPref('role', role);
    go(meta ? meta.path : path);
  }

  HRMS.router = { current: current, query: query, go: go, goAs: goAs, replace: replace, useRoute: useRoute };
})();

/* The admin dashboard, in two versions, and the control that chooses between them.

   The brief asked for two: one built to an attached reference, and one that is a
   different page rather than a restyle of the first — AI-led, with its analysis attached
   to the charts and panels it is about. Both are real screens on the same route, because
   the point of having two is comparing them, and a comparison that needs two browser
   tabs and a rebuild in between does not get made.

   The choice is remembered, so the page you were last reading is the page you come back
   to. The switcher itself sits inside whichever version is showing — version 1 puts it
   beside its title, version 2 inside its opening band — rather than above them both,
   because a strip of chrome over the top would be the one piece of the page neither
   design asked for.

   Version 1 lives in js/screens/admin-dash-v1.js, version 2 in admin-dash-v2.js, and
   neither knows about the other. */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement, I = window.Icons;
  var store = HRMS.store;

  var ARA = h('svg', { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', 'aria-hidden': 'true' },
    h('path', { d: 'M12 3.2l1.9 4.7 4.9 1.8-4.9 1.8L12 16.2l-1.9-4.7-4.9-1.8 4.9-1.8L12 3.2Z', fill: 'currentColor' }),
    h('circle', { cx: 18.4, cy: 17.6, r: 2.1, fill: 'currentColor', opacity: .85 }));

  var VERSIONS = [
    { k: 'v1', label: 'Overview', icon: I.grid, title: 'Version 1 — the reference layout' },
    { k: 'v2', label: 'Ara', icon: ARA, title: 'Version 2 — Ara reads the organisation' }
  ];

  function Switcher(p) {
    return h('div', { className: 'dsw', role: 'group', 'aria-label': 'Dashboard version' },
      VERSIONS.map(function (v) {
        return h('button', {
          key: v.k, type: 'button', title: v.title,
          className: 'dsw__b' + (p.value === v.k ? ' is-on' : ''),
          'aria-pressed': p.value === v.k,
          onClick: function () { p.onChange(v.k); }
        }, v.icon, v.label);
      }));
  }

  function AdminDashboard() {
    /* The stored preference is the source of truth; local state only exists so the page
       repaints when it changes. An unrecognised stored value falls back to version 1
       rather than rendering nothing. */
    var saved = store.pref('adminDashVersion');
    var vSt = React.useState(saved === 'v2' ? 'v2' : 'v1');

    function pick(k) {
      vSt[1](k);
      store.setPref('adminDashVersion', k);
    }

    var switcher = h(Switcher, { value: vSt[0], onChange: pick });
    var Screen = vSt[0] === 'v2' ? HRMS.adminDashV2 : HRMS.adminDashV1;
    return h(Screen, { switcher: switcher });
  }

  HRMS.screens.register({ 'admin/dashboard': AdminDashboard });
})();

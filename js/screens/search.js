/* Search (PRD 11.1). One screen in every workspace that looks across the whole
   prototype — people, requests, records, configuration and the screens themselves —
   rather than the command palette this replaces, which only knew routes and employee
   names and had nowhere to put a result list longer than twelve rows.

   Two rules hold the module together:

   - A source is only searched when the signed-in role may view its module (PRD 10), so
     Search can never become a way around the permission matrix. Where the role's data
     scope is its own records, the source is narrowed to the signed-in person before a
     single row is matched, which is why the Employee workspace finds its own payslip
     and nobody else's.
   - The query lives in the URL, so a result list is a link like every other screen.

   Ara moved here from the palette: a question still gets an answer drawn from this
   prototype's own data, now beside the results rather than instead of them. */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var store = HRMS.store, router = HRMS.router, ui = HRMS.ui, perms = HRMS.permissions;

  /* ------------------------------------------------------------------ Ara */
  var ARA_GLYPH = h('svg', { viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
    h('path', { d: 'M12 3.2l1.9 4.7 4.9 1.8-4.9 1.8L12 16.2l-1.9-4.7-4.9-1.8 4.9-1.8L12 3.2Z', fill: 'currentColor' }),
    h('circle', { cx: 18.4, cy: 17.6, r: 2.1, fill: 'currentColor', opacity: .85 }),
    h('circle', { cx: 6.2, cy: 18.4, r: 1.3, fill: 'currentColor', opacity: .6 }));
  function Ara(p) { return h('span', { className: 'ara ara--' + ((p && p.size) || 'md'), 'aria-hidden': 'true' }, ARA_GLYPH); }

  function isQuestion(q) {
    return q.length > 12 && /\b(who|what|which|how many|how much|why|when|where|is |are |can |show me|list)\b/i.test(q);
  }

  /* Ara answers from the store and names what she read. Anything outside this prototype
     she declines rather than guesses at. */
  function araAnswer(q) {
    var t = q.toLowerCase();
    var staff = store.collection('employees') || [];
    function src(n, what) { return 'Read from ' + what + ' · ' + n + ' records.'; }

    if (/probation/.test(t)) {
      var pr = staff.filter(function (e) { return /probation/i.test(e.status || ''); });
      return { p: pr.length ? pr.length + ' people are on probation:' : 'Nobody is on probation.',
        l: pr.slice(0, 6).map(function (e) { return e.name + ' · ' + e.designation; }), s: src(staff.length, 'Employees') };
    }
    if (/notice|resign|exit|leaving|offboard/.test(t)) {
      var nt = staff.filter(function (e) { return /notice|resigned|exit/i.test(e.status || ''); });
      return { p: nt.length ? nt.length + ' people are serving notice or exiting:' : 'Nobody is on notice.',
        l: nt.slice(0, 6).map(function (e) { return e.name + ' · ' + e.designation; }), s: src(staff.length, 'Employees') };
    }
    if (/headcount|how many (people|employees|staff)|total (people|employees)/.test(t)) {
      var byDept = {};
      staff.forEach(function (e) { byDept[e.department] = (byDept[e.department] || 0) + 1; });
      return { p: staff.length + ' people on the books, across ' + Object.keys(byDept).length + ' departments:',
        l: Object.keys(byDept).slice(0, 6).map(function (d) { return deptName(d) + ' · ' + byDept[d]; }), s: src(staff.length, 'Employees') };
    }
    if (/approval|waiting|pending|inbox/.test(t)) {
      var reqs = store.collection('approvals') || [];
      var open = reqs.filter(function (r) { return /pending/i.test(r.status || ''); });
      return { p: open.length ? open.length + ' requests are waiting on an approver:' : 'Nothing is waiting for approval.',
        l: open.slice(0, 6).map(function (r) { return r.kind + ' · ' + empName(r.employee) + ' · ' + r.detail; }), s: src(reqs.length, 'Approvals') };
    }
    if (/role|permission|who can|access/.test(t)) {
      var roles = HRMS.nav.roles || [];
      return { p: 'There are ' + roles.length + ' workspaces, each with its own role:',
        l: roles.map(function (r) { return r.label + ' · ' + (r.blurb || '').split('.')[0]; }), s: 'Read from the navigation model.' };
    }
    return { p: 'I can answer on headcount, probation, notice periods, open requests and who has access. Anything outside this prototype I will not guess at.', l: [], s: null };
  }

  /* ------------------------------------------------------------- Lookups */
  function deptName(id) { var d = store.department(id); return d ? d.name : ''; }
  function locName(id) { var l = store.location(id); return l ? l.name : ''; }
  function leaveName(id) { var t = store.leaveType(id); return t ? t.name : ''; }
  function empName(id) { var e = store.employee(id); return e ? e.name : (id || ''); }

  /* ------------------------------------------------------------- Sources
     Each source names the module it belongs to, so the permission matrix decides whether
     it is searched at all; `own` names the employee a record belongs to, so a role scoped
     to its own records never matches anybody else's. `to` is where a hit opens, preferring
     a screen in the workspace you are already in. */
  function first(routes, role) {
    var order = [role, 'hr', 'admin', 'me'];
    for (var i = 0; i < order.length; i++) {
      var r = routes[order[i]];
      if (r && HRMS.nav.routes[r]) return r;
    }
    return null;
  }

  var SOURCES = [
    { key: 'people', label: 'People', icon: 'users', module: 'people',
      rows: function () { return store.collection('employees'); },
      own: function (e) { return e.id; },
      text: function (e) { return [e.name, e.id, e.workEmail, e.designation, e.type, e.status, deptName(e.department), locName(e.location)].join(' '); },
      row: function (e) {
        return { avatar: e.name, title: e.name, sub: e.designation + ' · ' + deptName(e.department) + ' · ' + locName(e.location), chip: e.status };
      },
      to: { admin: 'admin/people/users', hr: 'hr/people/all', me: 'me/profile' } },

    { key: 'leave', label: 'Leave requests', icon: 'calendar', module: 'leave',
      rows: function () { return store.collection('leaveRequests'); },
      own: function (r) { return r.employee; },
      text: function (r) { return [empName(r.employee), leaveName(r.type), r.reason, r.status, r.fromLabel, r.toLabel].join(' '); },
      row: function (r) {
        return { title: leaveName(r.type) + ' · ' + empName(r.employee),
          sub: r.fromLabel + ' – ' + r.toLabel + ' · ' + r.days + ' day' + (r.days === 1 ? '' : 's') + (r.reason ? ' · ' + r.reason : ''),
          chip: r.status };
      },
      to: { hr: 'hr/leave/requests', me: 'me/leave/history' } },

    { key: 'attendance', label: 'Regularizations', icon: 'clock', module: 'attendance',
      rows: function () { return store.collection('regularizations'); },
      own: function (r) { return r.employee; },
      text: function (r) { return [empName(r.employee), r.issue, r.reason, r.status, r.dateLabel].join(' '); },
      row: function (r) {
        return { title: r.issue + ' · ' + empName(r.employee), sub: r.dateLabel + ' · ' + r.original + ' → ' + r.corrected, chip: r.status };
      },
      to: { hr: 'hr/attendance/regularization', me: 'me/attendance/regularization' } },

    { key: 'approvals', label: 'Approvals', icon: 'check', module: 'approvals',
      rows: function () { return store.collection('approvals'); },
      own: function (r) { return r.employee; },
      text: function (r) { return [r.kind, r.module, empName(r.employee), r.detail, r.status].join(' '); },
      row: function (r) { return { title: r.kind + ' · ' + empName(r.employee), sub: r.detail, chip: r.status }; },
      route: function (r) { return r.route; },
      to: { hr: 'hr/approvals', me: 'me/dashboard' } },

    { key: 'assets', label: 'Assets', icon: 'box', module: 'assets',
      rows: function () { return store.collection('assets'); },
      own: function (a) { return a.assignedTo; },
      text: function (a) { return [a.name, a.serial, a.category, a.status, a.condition, empName(a.assignedTo), locName(a.location)].join(' '); },
      row: function (a) {
        return { title: a.name, sub: a.serial + ' · ' + a.category + (a.assignedTo ? ' · ' + empName(a.assignedTo) : ' · unassigned'), chip: a.status };
      },
      to: { hr: 'hr/assets/inventory', me: 'me/assets' } },

    { key: 'documents', label: 'Documents', icon: 'file', module: 'documents',
      rows: function () { return store.collection('employeeDocuments'); },
      own: function (d) { return d.employee; },
      text: function (d) { return [d.name, d.category, empName(d.employee), d.status].join(' '); },
      row: function (d) { return { title: d.name, sub: d.category + ' · ' + empName(d.employee), chip: d.status }; },
      to: { hr: 'hr/documents/employee', me: 'me/documents' } },

    { key: 'policies', label: 'Policies', icon: 'shield', module: 'documents',
      rows: function () { return store.collection('policies'); },
      text: function (p) { return [p.name, p.category, p.audience, p.version].join(' '); },
      row: function (p) { return { title: p.name, sub: p.category + ' · ' + p.audience, chip: 'v' + p.version }; },
      to: { hr: 'hr/documents/policies', me: 'me/documents' } },

    { key: 'payroll', label: 'Payslips', icon: 'card', module: 'payroll',
      rows: function () { return store.collection('payslips'); },
      own: function (s) { return s.employee; },
      text: function (s) { return [empName(s.employee), s.period, s.status, s.cycle].join(' '); },
      row: function (s) { return { title: s.period + ' · ' + empName(s.employee), sub: 'Net ' + ui.inr(s.net), chip: s.status }; },
      to: { hr: 'hr/payroll/payslips', me: 'me/payroll/payslips' } },

    { key: 'performance', label: 'Goals', icon: 'target', module: 'performance',
      rows: function () { return store.collection('goals'); },
      own: function (g) { return g.employee; },
      text: function (g) { return [g.title, empName(g.employee), g.status, g.cycle].join(' '); },
      row: function (g) { return { title: g.title, sub: empName(g.employee) + ' · ' + g.progress + '% · due ' + g.due, chip: g.status }; },
      to: { hr: 'hr/performance/goals', me: 'me/performance/goals' } },

    { key: 'announcements', label: 'Announcements', icon: 'bell', module: 'engagement',
      rows: function () { return store.collection('announcements'); },
      text: function (a) { return [a.title, a.body, a.byName].join(' '); },
      row: function (a) { return { title: a.title, sub: a.byName + ' · ' + a.on, chip: a.pinned ? 'Pinned' : null }; },
      to: { me: 'me/announcements' } },

    { key: 'recognition', label: 'Recognition', icon: 'star', module: 'engagement',
      rows: function () { return store.collection('recognition'); },
      own: function (r) { return r.to; },
      text: function (r) { return [empName(r.to), empName(r.from), r.value, r.note].join(' '); },
      row: function (r) { return { title: empName(r.to), sub: r.note + ' · from ' + empName(r.from), chip: r.value }; },
      to: { me: 'me/engagement/recognition' } },

    { key: 'holidays', label: 'Holidays', icon: 'calendar', module: 'leave',
      rows: function () { return store.collection('holidays'); },
      text: function (x) { return [x.name, x.type, x.date].join(' '); },
      row: function (x) { return { title: x.name, sub: x.date, chip: x.type }; },
      to: { admin: 'admin/org/holidays', hr: 'hr/holidays' } },

    { key: 'departments', label: 'Departments', icon: 'building', module: 'departments',
      rows: function () { return store.collection('departments'); },
      text: function (d) { return [d.name, d.code, empName(d.head), locName(d.location)].join(' '); },
      row: function (d) { return { title: d.name, sub: d.code + ' · ' + d.headcount + ' people · head ' + empName(d.head), chip: null }; },
      to: { hr: 'hr/config/structure' } },

    { key: 'locations', label: 'Locations', icon: 'pin', module: 'locations',
      rows: function () { return store.collection('locations'); },
      text: function (l) { return [l.name, l.label, l.address, l.tz].join(' '); },
      row: function (l) { return { title: l.name, sub: l.address + ' · ' + l.tz, chip: l.hq ? 'HQ' : null }; },
      to: { admin: 'admin/org/locations', hr: 'hr/config/structure' } },

    { key: 'audit', label: 'Audit log', icon: 'history', module: 'audit',
      rows: function () { return store.collection('audit'); },
      text: function (a) { return [a.actor, a.action, a.category].join(' '); },
      row: function (a) { return { title: a.action, sub: a.actor + ' · ' + a.on, chip: a.category }; },
      to: { admin: 'admin/audit/activity' } },

    /* The screens themselves, so the palette's one genuinely useful trick survives. */
    { key: 'screens', label: 'Screens', icon: 'right', module: null,
      rows: function () {
        return Object.keys(HRMS.nav.routes).map(function (k) { return HRMS.nav.routes[k]; })
          .filter(function (m) { return !(m.item && m.item.tabs && !m.tab); });
      },
      text: function (m) { return [m.label, m.group, m.item && m.item.label, m.path].filter(Boolean).join(' '); },
      row: function (m) {
        return { title: m.label,
          sub: [m.role ? HRMS.nav.role(m.role).label : 'Global', m.group, m.item && m.item.label !== m.label ? m.item.label : null].filter(Boolean).join(' · '),
          mono: '#/' + m.path };
      },
      route: function (m) { return m.path; } }
  ];

  /* The sources this role may search at all, already narrowed to the records it may see. */
  function sourcesFor(role) {
    return SOURCES.filter(function (s) {
      return !s.module || perms.can(role, s.module, 'view');
    }).map(function (s) {
      var rows = s.rows() || [];
      if (s.module && s.own && perms.scope(role, s.module) === 'own') {
        var me = store.persona(role);
        rows = me ? rows.filter(function (r) { return s.own(r) === me.id; }) : [];
      }
      return { src: s, rows: rows };
    });
  }

  function search(role, q, limitPer) {
    var needle = q.trim().toLowerCase();
    if (!needle) return [];
    return sourcesFor(role).map(function (bucket) {
      var hits = [];
      for (var i = 0; i < bucket.rows.length; i++) {
        var rec = bucket.rows[i];
        if (String(bucket.src.text(rec) || '').toLowerCase().indexOf(needle) >= 0) {
          hits.push(rec);
          if (hits.length >= limitPer) break;
        }
      }
      return { src: bucket.src, hits: hits, total: bucket.rows.length };
    }).filter(function (g) { return g.hits.length; });
  }

  /* ------------------------------------------------------------- Screen */
  function Search(p) {
    var role = store.pref('role');
    var routeQ = (p.route && p.route.query && p.route.query.q) || '';
    var qSt = React.useState(routeQ);
    var typeSt = React.useState('all');
    var ansSt = React.useState(null);
    var busySt = React.useState(false);
    var boxRef = React.useRef(null);

    /* A link into Search carries its query, so follow the URL when it changes under us. */
    React.useEffect(function () { qSt[1](routeQ); }, [routeQ]);

    React.useEffect(function () {
      var t = setTimeout(function () {
        var el = boxRef.current && boxRef.current.querySelector('input');
        if (el) el.focus();
      }, 20);
      return function () { clearTimeout(t); };
    }, []);

    /* Mirror the query into the URL so a result list can be shared. `replace` keeps the
       back button meaning "the screen before Search" rather than every keystroke. */
    React.useEffect(function () {
      var t = setTimeout(function () {
        var q = qSt[0].trim();
        router.replace(role + '/search' + (q ? '?q=' + encodeURIComponent(q) : ''));
      }, 300);
      return function () { clearTimeout(t); };
    }, [qSt[0], role]);

    React.useEffect(function () { ansSt[1](null); typeSt[1]('all'); }, [qSt[0]]);

    var q = qSt[0].trim();
    var single = typeSt[0] !== 'all';
    var groups = React.useMemo(function () {
      return search(role, q, single ? 60 : 8);
    }, [q, role, single]);

    var shown = single ? groups.filter(function (g) { return g.src.key === typeSt[0]; }) : groups;
    var found = groups.reduce(function (n, g) { return n + g.hits.length; }, 0);

    function ask() {
      if (!q) return;
      busySt[1](true); ansSt[1](null);
      setTimeout(function () { busySt[1](false); ansSt[1](araAnswer(q)); }, 420);
    }

    function open(group, rec) {
      var path = (group.src.route && group.src.route(rec)) || first(group.src.to || {}, role);
      if (!path) { ui.toast('That record has no screen in this prototype yet'); return; }
      router.goAs(path);
    }

    function onKey(e) {
      if (e.key === 'Enter' && isQuestion(q)) { e.preventDefault(); ask(); }
    }

    var catalogue = sourcesFor(role);

    return h(React.Fragment, null,
      h(ui.PageHead, {
        eyebrow: 'Search',
        title: 'Search',
        description: 'People, requests, records and screens — everything this workspace may see, in one place.'
      }),

      h('div', { className: 'palette__field', ref: boxRef, onKeyDown: onKey, style: { marginBottom: 16 } },
        h(V.SearchField, {
          placeholder: 'Search people, requests, documents, screens — or ask Ara',
          value: qSt[0], 'aria-label': 'Search everything',
          onChange: function (e) { qSt[1](e.target.value); }
        })),

      q && isQuestion(q) && !ansSt[0] && !busySt[0]
        ? h('button', { type: 'button', className: 'palette__askrow', onClick: ask, style: { marginBottom: 16 } },
            h('span', { className: 'palette__icon' }, ARA_GLYPH),
            h('span', { className: 'palette__text' },
              h('span', { className: 'palette__label' }, 'Ask Ara — “' + q + '”'),
              h('span', { className: 'palette__context' }, 'Answers from this prototype only')),
            h('span', { className: 'palette__path mono' }, 'Enter'))
        : null,

      busySt[0]
        ? h('div', { className: 'palette__ara', style: { marginBottom: 16 } }, h(Ara, { size: 'md' }),
            h('span', { className: 'palette__ara__b' }, h('span', { className: 'shimmer', style: { display: 'block', height: 11, width: '60%' } })))
        : null,

      ansSt[0]
        ? h('div', { className: 'palette__ara', style: { marginBottom: 16 } }, h(Ara, { size: 'md' }),
            h('span', { className: 'palette__ara__b' },
              h('p', null, ansSt[0].p),
              ansSt[0].l.length ? h('ul', null, ansSt[0].l.map(function (x, i) { return h('li', { key: i }, x); })) : null,
              ansSt[0].s ? h('small', null, ansSt[0].s) : null))
        : null,

      /* Nothing typed yet: say what this role may search, rather than show an empty box. */
      !q
        ? h(ui.Card, { title: 'What you can search here',
            aside: h(V.Chip, { size: 'sm', shape: 'tag' }, catalogue.length + ' sources') },
            h('p', { className: 'muted', style: { marginTop: 0 } },
              'Search covers only what your workspace may view, so results never cross the permission matrix.'),
            h('div', { className: 'row gap-2 wrap' }, catalogue.map(function (b) {
              return h(V.Chip, { key: b.src.key, size: 'sm', shape: 'tag', variant: 'soft' },
                b.src.label + ' · ' + b.rows.length);
            })))
        : found
          ? h(React.Fragment, null,
              h('div', { className: 'row gap-2 wrap', style: { marginBottom: 16, alignItems: 'center' } },
                h('span', { className: 'muted' }, found + (found === 60 ? '+' : '') + ' result' + (found === 1 ? '' : 's') + ' for “' + q + '”'),
                h('span', { className: 'grow' }),
                h(V.Chip, { size: 'sm', shape: 'tag', variant: typeSt[0] === 'all' ? 'solid' : 'soft',
                  onClick: function () { typeSt[1]('all'); } }, 'All'),
                groups.map(function (g) {
                  return h(V.Chip, { key: g.src.key, size: 'sm', shape: 'tag',
                    variant: typeSt[0] === g.src.key ? 'solid' : 'soft',
                    onClick: function () { typeSt[1](g.src.key); } }, g.src.label + ' ' + g.hits.length);
                })),

              shown.map(function (g) {
                return h(ui.Card, { key: g.src.key, title: g.src.label,
                  aside: h(V.Chip, { size: 'sm', shape: 'tag' }, g.hits.length + ' of ' + g.total) },
                  h('div', { className: 'lrows' }, g.hits.map(function (rec, i) {
                    var r = g.src.row(rec);
                    return h('div', { className: 'lrow', key: g.src.key + i },
                      r.avatar ? h(V.Avatar, { name: r.avatar, size: 'sm' })
                        : h('span', { className: 'lrow__ico' }, I[g.src.icon] || I.file),
                      h('span', { className: 'lrow__m' }, h('strong', null, r.title), r.sub ? h('span', null, r.sub) : null),
                      r.chip ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft' }, r.chip) : null,
                      r.mono ? h('span', { className: 'palette__path mono' }, r.mono) : null,
                      h('button', { type: 'button', className: 'lrow__go', 'aria-label': 'Open ' + r.title,
                        onClick: function () { open(g, rec); } }, I.right));
                  })),
                  !single && g.hits.length >= 8
                    ? h(V.Button, { variant: 'ghost', className: 'vi-btn--sm',
                        onClick: function () { typeSt[1](g.src.key); } }, 'Show more ' + g.src.label.toLowerCase())
                    : null);
              }))
          : h(ui.Empty, {
              icon: I.search, title: 'Nothing matches “' + q + '”',
              body: 'Try a name, an employee ID, a document, a serial number or a screen. Search only covers what this workspace may view.'
            }));
  }


  /* ------------------------------------------------------- The ⌘K overlay
     The quick way through: the same search, over whatever you are looking at, without
     leaving it. It runs the engine above rather than one of its own — a second
     implementation is how the palette and the screen would start giving different
     answers to the same query, which is the thing the screen was built to end.

     It is a shortcut, not a replacement: it shows the first few hits per source and
     hands the rest to the screen, where the filtering and the full lists live. */
  function Palette(p) {
    var role = store.pref('role');
    var qSt = React.useState('');
    var selSt = React.useState(0);
    var ansSt = React.useState(null);
    var busySt = React.useState(false);
    var boxRef = React.useRef(null);

    React.useEffect(function () {
      var t = setTimeout(function () {
        var el = boxRef.current && boxRef.current.querySelector('input');
        if (el) el.focus();
      }, 20);
      return function () { clearTimeout(t); };
    }, []);

    var q = qSt[0].trim();

    /* Flattened to a single list, because arrow keys move through one list, not a grid. */
    var rows = React.useMemo(function () {
      if (!q) return [];
      var out = [];
      search(role, q, 3).forEach(function (g) {
        g.hits.forEach(function (rec) { out.push({ group: g, rec: rec }); });
      });
      return out.slice(0, 12);
    }, [q, role]);

    var total = React.useMemo(function () {
      if (!q) return 0;
      return search(role, q, 60).reduce(function (n, g) { return n + g.hits.length; }, 0);
    }, [q, role]);

    React.useEffect(function () { selSt[1](0); ansSt[1](null); }, [q]);

    function ask() {
      if (!q) return;
      busySt[1](true); ansSt[1](null);
      setTimeout(function () { busySt[1](false); ansSt[1](araAnswer(q)); }, 420);
    }

    function open(row) {
      if (!row) return;
      var path = (row.group.src.route && row.group.src.route(row.rec)) || first(row.group.src.to || {}, role);
      if (!path) { ui.toast('That record has no screen in this prototype yet'); return; }
      p.onClose();
      router.goAs(path);
    }

    function seeAll() {
      p.onClose();
      router.go(role + '/search' + (q ? '?q=' + encodeURIComponent(q) : ''));
    }

    function onKey(e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); selSt[1](Math.min(selSt[0] + 1, rows.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); selSt[1](Math.max(selSt[0] - 1, 0)); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (isQuestion(q)) ask(); else if (rows.length) open(rows[selSt[0]]); else if (q) seeAll();
      } else if (e.key === 'Escape') { e.preventDefault(); p.onClose(); }
    }

    return h('div', { className: 'modal__scrim', onMouseDown: function (e) { if (e.target === e.currentTarget) p.onClose(); } },
      h('div', { className: 'modal palette', role: 'dialog', 'aria-label': 'Search', onKeyDown: onKey },
        h('div', { className: 'palette__field', ref: boxRef },
          h(V.SearchField, {
            placeholder: 'Search people, requests, documents, screens — or ask Ara',
            value: qSt[0], 'aria-label': 'Search everything',
            onChange: function (e) { qSt[1](e.target.value); }
          })),

        busySt[0] ? h('div', { className: 'palette__ara' }, h(Ara, { size: 'md' }),
          h('span', { className: 'palette__ara__b' }, h('span', { className: 'shimmer', style: { display: 'block', height: 11, width: '60%' } }))) : null,

        ansSt[0] ? h('div', { className: 'palette__ara' }, h(Ara, { size: 'md' }),
          h('span', { className: 'palette__ara__b' },
            h('p', null, ansSt[0].p),
            ansSt[0].l.length ? h('ul', null, ansSt[0].l.map(function (x, i) { return h('li', { key: i }, x); })) : null,
            ansSt[0].s ? h('small', null, ansSt[0].s) : null)) : null,

        q && isQuestion(q) && !ansSt[0] && !busySt[0]
          ? h('button', { type: 'button', className: 'palette__askrow', onClick: ask },
              h('span', { className: 'palette__icon' }, ARA_GLYPH),
              h('span', { className: 'palette__text' },
                h('span', { className: 'palette__label' }, 'Ask Ara — “' + q + '”'),
                h('span', { className: 'palette__context' }, 'Answers from this prototype only')),
              h('span', { className: 'palette__path mono' }, 'Enter'))
          : null,

        rows.length
          ? h('ul', { className: 'palette__list' }, rows.map(function (row, i) {
              var r = row.group.src.row(row.rec);
              return h('li', { key: row.group.src.key + i },
                h('button', {
                  type: 'button', className: 'palette__item' + (i === selSt[0] ? ' is-on' : ''),
                  onMouseEnter: function () { selSt[1](i); },
                  onClick: function () { open(row); }
                },
                  r.avatar ? h(V.Avatar, { name: r.avatar, size: 'xs' })
                    : h('span', { className: 'palette__icon' }, I[row.group.src.icon] || I.right),
                  h('span', { className: 'palette__text' },
                    h('span', { className: 'palette__label' }, r.title),
                    h('span', { className: 'palette__context' }, r.sub || row.group.src.label)),
                  h('span', { className: 'palette__path mono' }, r.mono || row.group.src.label)));
            }))
          : (q && !ansSt[0] && !busySt[0]
              ? h('div', { style: { padding: '8px 0 16px' } },
                  h(ui.Empty, { icon: I.search, title: 'Nothing matches “' + q + '”',
                    body: 'Search only covers what this workspace may view.' }))
              : null),

        q && total > rows.length
          ? h('button', { type: 'button', className: 'palette__askrow', onClick: seeAll },
              h('span', { className: 'palette__icon' }, I.search),
              h('span', { className: 'palette__text' },
                h('span', { className: 'palette__label' }, 'See all ' + total + ' results'),
                h('span', { className: 'palette__context' }, 'Opens Search, where the filters are')),
              h('span', { className: 'palette__path mono' }, '#/' + role + '/search'))
          : null,

        h('div', { className: 'palette__foot muted' },
          h('span', null, q ? total + ' result' + (total === 1 ? '' : 's') : HRMS.nav.count + ' screens'),
          h('span', null, 'Enter to open · ask a question for Ara · Esc to close'))));
  }

  HRMS.screens.register({
    'admin/search': Search,
    'hr/search': Search,
    'me/search': Search
  });

  /* The shell opens it; it lives here so it cannot drift from the screen it shortcuts. */
  HRMS.search = { Palette: Palette };
})();

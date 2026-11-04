/* Admin · People (PRD 2.1) — users, the org tree, teams, lifecycle and access requests.

   This module used to be a page of its own at admin/people.html, carrying a second shell:
   its own rail, top bar, workspace switcher, notification panel, command palette and
   toast host, plus a "Back to workspace" link because the rail item that opened it led
   out of the prototype. None of that is needed twice. The module body moved here, so
   People is now five bookmarkable routes under #/admin/people rendered inside the
   application shell, like every other module. The shell draws the rail, the breadcrumbs
   and the module tabs; the screens below draw only the body of each tab. */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var ui = HRMS.ui, router = HRMS.router;
  var useState = React.useState;

  /* The page kept a toast of its own. The application already hosts one, so a message
     goes there and this module no longer owns any chrome. */
  function toast(m) { ui.toast(m); }

  function g(d, s) {
    return h('svg', { viewBox: '0 0 24 24', width: s || 20, height: s || 20, fill: 'none', 'aria-hidden': 'true' },
      h('path', { d: d, stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }));
  }
  var CHECK = g('M5 13l4 4L19 7', 16);
  var WAND = g('M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8l1.4 1.4M17.8 6.2l1.4-1.4M12.2 6.2l-1.4-1.4M3 21l9-9');
  var TEAMS = g('M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c.4-3.3 3.3-5.8 7-5.8s6.6 2.5 7 5.8M17 11.2a2.6 2.6 0 1 0 0-5.2M18 14.4c2.3.5 4 2.4 4 4.6');
  var SYNC = g('M4 10a8 8 0 0 1 13.7-5.6L20 7M20 14a8 8 0 0 1-13.7 5.6L4 17M20 4v3h-3M4 20v-3h3');

  /* Ara is the assistant. One mark, used everywhere she speaks. */
  var ARA_GLYPH = h('svg', { viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
    h('path', { d: 'M12 3.2l1.9 4.7 4.9 1.8-4.9 1.8L12 16.2l-1.9-4.7-4.9-1.8 4.9-1.8L12 3.2Z', fill: 'currentColor' }),
    h('circle', { cx: 18.4, cy: 17.6, r: 2.1, fill: 'currentColor', opacity: .85 }),
    h('circle', { cx: 6.2, cy: 18.4, r: 1.3, fill: 'currentColor', opacity: .6 }));
  function Ara(p) { return h('span', { className: 'ara ara--' + (p && p.size || 'md'), 'aria-hidden': 'true' }, ARA_GLYPH); }
  var MOVE = g('M4 8h12m0 0-3-3m3 3-3 3M20 16H8m0 0 3-3m-3 3 3 3');
  var ADDP = g('M15 19c-.3-3-2.6-5-6-5s-5.7 2-6 5M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 8v6M21 11h-6');
  var EYE2 = g('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z');
  /* Shares of one total: darkest = largest. Monotonic lightness, chroma clears the floor. */
  var RAMP = ['#3d2496', '#5733c1', '#7a5ad2', '#a690e4'];
  /* ---------- Small building blocks ---------- */
  function Card(p) {
    return h('section', { className: 'dash__card ' + (p.span || 'c12') },
      h('div', { className: 'dash__card__head' },
        h('h2', null, p.title),
        p.right || null),
      p.children);
  }
  function Table(p) {
    return h('div', { className: 'tblx__wrap' }, h('table', { className: 'tblx' },
      h('thead', null, h('tr', null, p.cols.map(function (c, i) {
        return h('th', { key: i, className: c.right ? 'tblx__act' : undefined }, c.h);
      }))),
      h('tbody', null, p.rows.map(function (r, i) {
        return h('tr', { key: i }, p.cols.map(function (c, j) {
          return h('td', { key: j, className: c.right ? 'tblx__act' : undefined }, c.cell(r));
        }));
      }))));
  }

  /* ---------- Data ---------- */
  /* Exits are Ara's to close. Confirmations change pay, so a person signs them off. */
  var LIFE_SEED = [
    { id: 'x1', kind: 'exit', who: 'Ananya Rao', what: 'Exiting · Design', when: 'Nov 04', state: 'new' },
    { id: 'x2', kind: 'exit', who: '2 people in Sales', what: 'Exiting', when: 'Nov 04', state: 'new' },
    { id: 'p1', kind: 'probation', who: '4 people', what: 'Probation ends', when: 'Nov 07', state: 'new', approver: 'Meera Nair (HR Head)' },
    { id: 'p2', kind: 'probation', who: 'Arjun Pillai', what: 'Probation ends', when: 'Nov 12', state: 'new', approver: 'Meera Nair (HR Head)' }
  ];
  /* ---------- Export ----------
     The workbook is SpreadsheetML, which Excel, Numbers and Sheets all open as a real
     sheet with typed cells and a styled header — no library and no CSV guesswork. */
  function xmlEsc(v) { return String(v == null ? '' : v).replace(/[<>&"]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]; }); }
  function toWorkbook(sheetName, cols, rows) {
    var head = cols.map(function (c) { return '<Cell ss:StyleID="h"><Data ss:Type="String">' + xmlEsc(c) + '</Data></Cell>'; }).join('');
    var body = rows.map(function (r) {
      return '<Row>' + r.map(function (v) {
        var num = typeof v === 'number' && isFinite(v);
        return '<Cell><Data ss:Type="' + (num ? 'Number' : 'String') + '">' + xmlEsc(v) + '</Data></Cell>';
      }).join('') + '</Row>';
    }).join('');
    return '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>'
      + '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'
      + '<Styles><Style ss:ID="h"><Font ss:Bold="1" ss:Color="#FFFFFF"/>'
      + '<Interior ss:Color="#5733C1" ss:Pattern="Solid"/></Style></Styles>'
      + '<Worksheet ss:Name="' + xmlEsc(sheetName) + '"><Table><Row>' + head + '</Row>' + body + '</Table></Worksheet></Workbook>';
  }
  function download(name, mime, text) {
    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function exportExcel(name, sheet, cols, rows) { download(name + '.xls', 'application/vnd.ms-excel', toWorkbook(sheet, cols, rows)); }
  /* PDF goes through the browser's own print-to-PDF, so it keeps the fonts and the brand. */
  function exportPDF(title, cols, rows) {
    var w = window.open('', '_blank');
    if (!w) return false;
    w.document.write('<!doctype html><title>' + xmlEsc(title) + '</title><style>'
      + 'body{font:13px -apple-system,system-ui,sans-serif;color:#111;padding:32px}'
      + 'h1{font-size:20px;margin:0 0 4px}p.s{color:#666;margin:0 0 18px;font-size:12px}'
      + 'table{border-collapse:collapse;width:100%}th{background:#5733c1;color:#fff;text-align:left;font-size:12px;padding:8px 10px}'
      + 'td{padding:8px 10px;border-bottom:1px solid #eee}tr:nth-child(even) td{background:#faf9fe}</style>'
      + '<h1>' + xmlEsc(title) + '</h1><p class="s">aptaHR · exported ' + new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + '</p>'
      + '<table><thead><tr>' + cols.map(function (c) { return '<th>' + xmlEsc(c) + '</th>'; }).join('') + '</tr></thead><tbody>'
      + rows.map(function (r) { return '<tr>' + r.map(function (v) { return '<td>' + xmlEsc(v) + '</td>'; }).join('') + '</tr>'; }).join('')
      + '</tbody></table>');
    w.document.close(); setTimeout(function () { w.print(); }, 300);
    return true;
  }

  function ExportMenu(p) {
    var openSt = useState(false);
    return h('span', { className: 'xmenu' },
      h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.download, iconEnd: I.chevron,
        onClick: function () { openSt[1](!openSt[0]); } }, 'Export'),
      openSt[0] ? h('span', { className: 'xmenu__pop' },
        h('button', { type: 'button', className: 'xmenu__i', onClick: function () { openSt[1](false); p.onPick('xls'); } }, I.grid, 'Excel (.xls)'),
        h('button', { type: 'button', className: 'xmenu__i', onClick: function () { openSt[1](false); p.onPick('pdf'); } }, I.printer, 'PDF')) : null);
  }

  /* Every team action opens a real form rather than a message. */
  var ACTIONS = {
    add: { t: 'Add a team member', ok: 'Add', f: [['Name', 'text', 'e.g. Priya Raman'], ['Role', 'select', ['Product Designer', 'UX Designer', 'UI Designer', 'Design Analyst']], ['Reports to', 'select', ['Arun Kumar', 'Vignesh S', 'Kavya R', 'Rahul N']]], d: 'They are created as an Employee. Access beyond that is granted in Roles & Access.' },
    reassign: { t: 'Reassign reporting', ok: 'Reassign', f: [['Person', 'select', ['Vignesh S', 'Kavya R', 'Rahul N', 'Meena P']], ['New manager', 'select', ['Arun Kumar', 'Karthik Menon', 'Meera Nair']]], d: 'Anything waiting on their old manager moves across with them.' },
    sub: { t: 'Create a sub-team', ok: 'Create', f: [['Team name', 'text', 'e.g. Design systems'], ['Lead', 'select', ['Vignesh S', 'Kavya R', 'Rahul N']]], d: 'A sub-team sits under this one and inherits its approval chain.' },
    move: { t: 'Move to another team', ok: 'Move', f: [['Person', 'select', ['Vignesh S', 'Kavya R', 'Rahul N', 'Meena P']], ['Target team', 'select', ['Platform', 'Mobile', 'Payroll ops']]], d: 'Their department changes with the team, so payroll cost moves too.' },
    role: { t: 'Update role', ok: 'Update', f: [['Person', 'select', ['Vignesh S', 'Kavya R', 'Rahul N', 'Meena P']], ['Role', 'select', ['Employee', 'HR Junior', 'HR Senior', 'HR Head', 'Admin']]], d: 'Role changes above Employee need the HR Head to approve.' },
    details: { t: 'Team details', ok: 'Done', f: [['Team name', 'text', 'Product Design Team'], ['Department', 'select', ['Design', 'Engineering', 'Finance']], ['Cost centre', 'text', 'CC-DSN-01']], d: 'Used on the org chart, payroll splits and reports.' }
  };
  function TeamAction(p) {
    var cfg = ACTIONS[p.kind]; if (!cfg) return null;
    var vSt = useState({});
    return h('div', { className: 'modal__scrim', onClick: function (e) { if (e.target === e.currentTarget) p.onClose(); } },
      h('div', { className: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': cfg.t, style: { width: 'min(520px, 100%)' } },
        h('div', { className: 'modal__head' },
          h('h2', { style: { fontFamily: 'var(--font-flex)', fontSize: 20, fontWeight: 600 } }, cfg.t),
          h(V.IconButton, { icon: I.close, 'aria-label': 'Close', style: { marginLeft: 'auto' }, onClick: p.onClose })),
        h('div', { className: 'modal__body' },
          h('p', { className: 'muted-s' }, cfg.d),
          h('div', { className: 'fieldgrid' }, cfg.f.map(function (f) {
            return f[1] === 'select'
              ? h('div', { className: 'span2', key: f[0] }, h(V.Select, { label: f[0], placeholder: 'Choose', options: f[2],
                  onChange: function (v) { var o = Object.assign({}, vSt[0]); o[f[0]] = v; vSt[1](o); } }))
              : h('div', { className: 'span2', key: f[0] }, h(V.TextField, { label: f[0], placeholder: f[2],
                  onChange: function (e) { var o = Object.assign({}, vSt[0]); o[f[0]] = e.target.value; vSt[1](o); } }));
          }))),
        h('div', { className: 'modal__foot' },
          h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
          h(V.Button, { onClick: function () {
            var first = Object.keys(vSt[0]).map(function (k) { return vSt[0][k]; }).filter(Boolean)[0];
            p.onDone(cfg.t + (first ? ' · ' + first : '') + ' — saved in the prototype.');
          } }, cfg.ok))));
  }

  /* ---------- Org tree + teams ---------- */
  var TREE = [
    { id: 'Priya Sharma', r: 'Managing Director', d: 'Leadership', k: null },
    { id: 'Meera Nair', r: 'Head of People', d: 'People & Culture', k: 'Priya Sharma' },
    { id: 'Divya Menon', r: 'HR Business Partner', d: 'People & Culture', k: 'Meera Nair' },
    { id: 'Sana Qureshi', r: 'HR Executive', d: 'People & Culture', k: 'Meera Nair' },
    { id: 'Arun Kumar', r: 'Head of Design', d: 'Design', k: 'Priya Sharma' },
    { id: 'Vignesh S', r: 'Product Designer', d: 'Design', k: 'Arun Kumar' },
    { id: 'Kavya R', r: 'UX Designer', d: 'Design', k: 'Arun Kumar' },
    { id: 'Rahul N', r: 'UI Designer', d: 'Design', k: 'Arun Kumar' },
    { id: 'Meena P', r: 'Design Analyst', d: 'Design', k: 'Arun Kumar' },
    { id: 'Karthik Menon', r: 'VP Engineering', d: 'Engineering', k: 'Priya Sharma' },
    { id: 'Rahul Verma', r: 'Engineering Manager', d: 'Engineering', k: 'Karthik Menon' },
    { id: 'Rohit Shetty', r: 'Finance Controller', d: 'Finance', k: 'Priya Sharma' }
  ];
  function kidsOf(id) { return TREE.filter(function (n) { return n.k === id; }); }

  var ALL_MEMBERS = [
    { n: 'Arun Kumar', r: 'Head of Design', n2: 8 },
    { n: 'Vignesh S', r: 'Product Designer', to: 'Arun Kumar', j: 'May 12, 2025', n2: 3 },
    { n: 'Kavya R', r: 'UX Designer', to: 'Arun Kumar', j: 'Jun 02, 2025', n2: 2 },
    { n: 'Rahul N', r: 'UI Designer', to: 'Arun Kumar', j: 'Jun 18, 2025', n2: 1 },
    { n: 'Meena P', r: 'Design Analyst', to: 'Vignesh S', j: 'Aug 04, 2025' },
    { n: 'Kiran B', r: 'Visual Designer', to: 'Vignesh S', j: 'Sep 01, 2025' },
    { n: 'Asha T', r: 'Researcher', to: 'Vignesh S', j: 'Sep 15, 2025' },
    { n: 'Neha S', r: 'UX Designer', to: 'Kavya R', j: 'Oct 06, 2025' },
    { n: 'Imran Q', r: 'UX Writer', to: 'Kavya R', j: 'Oct 20, 2025' },
    { n: 'Dev P', r: 'UI Designer', to: 'Rahul N', j: 'Oct 27, 2025' }
  ];
  var SUBROLE = { 'Meena P': 'Design Analyst', 'Kiran B': 'Visual Designer', 'Asha T': 'Researcher',
    'Neha S': 'UX Designer', 'Imran Q': 'UX Writer', 'Dev P': 'UI Designer' };
  var TEAM = {
    name: 'Product Design Team', lead: 'Arun Kumar', leadRole: 'Head of Design',
    reportsTo: 'Chief Product Officer', size: 8, dept: 'Design',
    reports: [
      { n: 'Vignesh S', r: 'Product Designer', sub: ['Meena P', 'Kiran B', 'Asha T'] },
      { n: 'Kavya R', r: 'UX Designer', sub: ['Neha S', 'Imran Q'] },
      { n: 'Rahul N', r: 'UI Designer', sub: ['Dev P'] },
      { n: 'Meena P', r: 'Design Analyst', sub: [] }
    ],
    composition: [['Product Designer', 2], ['UX Designer', 2], ['UI Designer', 2], ['Design Analyst', 1], ['Others', 1]],
    roster: [
      { n: 'Vignesh S', r: 'Product Designer', to: 'Arun Kumar', j: 'May 12, 2025', s: 'Active', star: true },
      { n: 'Kavya R', r: 'UX Designer', to: 'Arun Kumar', j: 'Jun 02, 2025', s: 'Active' },
      { n: 'Rahul N', r: 'UI Designer', to: 'Arun Kumar', j: 'Jun 18, 2025', s: 'Active' },
      { n: 'Meena P', r: 'Design Analyst', to: 'Arun Kumar', j: 'Aug 04, 2025', s: 'Active' }
    ]
  };

  /* ---------- The directory ----------
     Two calls with latency, standing in for a server. The tree only ever holds the
     branches somebody expanded, so the team panel re-queries subtree() on every
     selection rather than walking what happens to be in memory. */
  /* Where someone stands: on probation, serving notice, or neither. */
  var STATUS = {
    'Dev P': { k: 'prob', t: 'Probation', d: 'ends 30 Nov' },
    'Neha S': { k: 'prob', t: 'Probation', d: 'ends 05 Dec' },
    'Sana Qureshi': { k: 'prob', t: 'Probation', d: 'ends 07 Nov' },
    'Rahul N': { k: 'notice', t: 'Notice', d: 'last day 21 Nov' },
    'Kiran B': { k: 'notice', t: 'Notice', d: 'last day 14 Nov' }
  };
  function statusOf(id) { return STATUS[id] || null; }

  var STAFF = TREE.concat([
    { id: 'Imran Q', r: 'QA Engineer', d: 'Engineering', k: 'Rahul Verma' },
    { id: 'Neha S', r: 'Software Engineer', d: 'Engineering', k: 'Rahul Verma' },
    { id: 'Dev P', r: 'Software Engineer', d: 'Engineering', k: 'Rahul Verma' },
    { id: 'Kiran B', r: 'Accounts Executive', d: 'Finance', k: 'Rohit Shetty' }
  ]);
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  var directory = {
    childrenOf: function (id) { return STAFF.filter(function (n) { return n.k === id; }); },
    /* direct reports only */
    children: function (id) { return wait(220).then(function () { return directory.childrenOf(id); }); },
    /* everyone below a person, however deep */
    subtree: function (id) {
      return wait(260).then(function () {
        var out = [], stack = directory.childrenOf(id).slice();
        while (stack.length) { var n = stack.shift(); out.push(n); stack = stack.concat(directory.childrenOf(n.id)); }
        return out;
      });
    }
  };
  function initials(n) { return n.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase(); }
  var AV = [['#ece5fc', '#5733c1'], ['#e3eeff', '#1f5fd1'], ['#e2f5e7', '#1f7a36'], ['#fde9d9', '#b9560a'], ['#eeedf0', '#3b3a40']];
  function avFor(n) { var s = 0; for (var i = 0; i < n.length; i++) s += n.charCodeAt(i); return AV[s % AV.length]; }

  /* ---------- Org chart ----------
     Laid out here rather than by a library: subtree widths are measured bottom-up and each
     parent is centred over its children. Positions are then eased toward that layout frame
     by frame, and the edges are rebuilt from the eased positions on every frame, so cards
     and wires move together instead of the wires snapping. Children load on first expand. */
  var NW = 188, NH = 104, HGAP = 26, VGAP = 86;

  function layout(rootId, kidsFor) {
    var nodes = [], cursor = 0;
    function walk(id, depth, parent) {
      var kids = kidsFor(id), x;
      if (!kids.length) { x = cursor; cursor += NW + HGAP; }
      else {
        var xs = kids.map(function (k) { return walk(k.id, depth + 1, id); });
        x = (xs[0] + xs[xs.length - 1]) / 2;
      }
      nodes.push({ id: id, x: x, y: depth * (NH + VGAP) + 28, depth: depth, parent: parent });
      return x;
    }
    walk(rootId, 0, null);
    var w = nodes.reduce(function (m, n) { return Math.max(m, n.x + NW); }, 0);
    var hgt = nodes.reduce(function (m, n) { return Math.max(m, n.y + NH); }, 0);
    return { nodes: nodes, w: w + 48, h: hgt + 48 };
  }
  function ancestorsOf(id) {
    var out = [], cur = STAFF.find(function (n) { return n.id === id; });
    while (cur && cur.k) { out.unshift(cur.k); cur = STAFF.find(function (n) { return n.id === cur.k; }); }
    return out;
  }

  function OrgChart(p) {
    var viewRef = React.useRef(null), dragRef = React.useRef(null), draggedRef = React.useRef(false);
    var posRef = React.useRef({});        // eased positions, id -> {x, y}
    var rafRef = React.useRef(0);
    var zoomSt = useState(1), openSt = useState({}), busySt = useState({}), loadedSt = useState({}), moveSt = useState(null);
    var tickSt = useState(0);

    /* Fetched children live in a ref as well as state: opening a chain fires several
       expands in a row, and reading the snapshot each closure captured would let a later
       write wipe an earlier one. The ref is the source of truth, state only redraws. */
    var cacheRef = React.useRef({});
    function kidsFor(id) { return cacheRef.current[id] || []; }
    function visibleKids(id) { return openSt[0][id] ? kidsFor(id) : []; }
    function setOpen(id, v) { openSt[1](function (prev) { var o = Object.assign({}, prev); o[id] = v; return o; }); }

    function expand(id) {
      if (cacheRef.current[id]) { setOpen(id, true); return Promise.resolve(); }
      busySt[1](function (prev) { var b = Object.assign({}, prev); b[id] = true; return b; });
      return directory.children(id).then(function (kids) {
        cacheRef.current[id] = kids;
        loadedSt[1](function (prev) { var l = Object.assign({}, prev); l[id] = kids; return l; });
        setOpen(id, true);
        busySt[1](function (prev) { var b = Object.assign({}, prev); delete b[id]; return b; });
        var c = cacheRef.current;
        p.onCount(Object.keys(c).reduce(function (a, k) { return a + c[k].length; }, 1));
      });
    }
    function toggle(id) { if (openSt[0][id]) setOpen(id, false); else expand(id); }

    /* Open the top two levels on arrival, so the chart lands full rather than as one card. */
    React.useEffect(function () {
      var first = [p.rootId].concat(directory.childrenOf(p.rootId).map(function (n) { return n.id; }));
      var i = 0;
      (function step() { if (i >= first.length) return; expand(first[i++]).then(step); })();
    }, []);

    /* Picking someone opens the line down to them, a level at a time. */
    React.useEffect(function () {
      var chain = ancestorsOf(p.selected);
      if (!chain.length) return;
      var i = 0;
      (function step() {
        if (i >= chain.length) return;
        var id = chain[i++];
        expand(id).then(step);
      })();
    }, [p.selected]);

    var L = layout(p.rootId, visibleKids);
    var byId = {}; STAFF.forEach(function (n) { byId[n.id] = n; });
    var anc = ancestorsOf(p.selected);
    var onPath = {}; anc.concat([p.selected]).forEach(function (id) { onPath[id] = true; });

    /* Ease every card toward its place; new cards start on their parent. */
    React.useEffect(function () {
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var pos = posRef.current, target = {};
      L.nodes.forEach(function (n) { target[n.id] = n; });
      L.nodes.forEach(function (n) {
        if (!pos[n.id]) {
          var from = n.parent && pos[n.parent];
          pos[n.id] = from ? { x: from.x, y: from.y, o: 0 } : { x: n.x, y: n.y, o: 1 };
        }
      });
      Object.keys(pos).forEach(function (id) { if (!target[id]) delete pos[id]; });
      if (reduce) {
        L.nodes.forEach(function (n) { pos[n.id] = { x: n.x, y: n.y, o: 1 }; });
        tickSt[1](function (v) { return v + 1; });
        return;
      }
      cancelAnimationFrame(rafRef.current);
      (function frame() {
        var moving = false;
        L.nodes.forEach(function (n) {
          var q = pos[n.id];
          q.x += (n.x - q.x) * 0.22; q.y += (n.y - q.y) * 0.22; q.o += (1 - q.o) * 0.22;
          if (Math.abs(n.x - q.x) > 0.4 || Math.abs(n.y - q.y) > 0.4 || q.o < 0.99) moving = true;
          else { q.x = n.x; q.y = n.y; q.o = 1; }
        });
        tickSt[1](function (v) { return v + 1; });
        if (moving) rafRef.current = requestAnimationFrame(frame);
      })();
      return function () { cancelAnimationFrame(rafRef.current); };
    }, [L.w, L.h, L.nodes.length]);

    /* Bring whoever is selected into the middle; fall back to the root. */
    React.useEffect(function () {
      var v = viewRef.current; if (!v) return;
      var t = L.nodes.find(function (n) { return n.id === p.selected; }) || L.nodes.find(function (n) { return n.id === p.rootId; });
      if (!t) return;
      var left = Math.max(0, (t.x + NW / 2) * zoomSt[0] - v.clientWidth / 2);
      var top = Math.max(0, (t.y + NH / 2) * zoomSt[0] - v.clientHeight / 2);
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (v.scrollTo) v.scrollTo({ left: left, top: top, behavior: reduce ? 'auto' : 'smooth' });
      else { v.scrollLeft = left; v.scrollTop = top; }
    }, [p.selected, L.w, L.h, zoomSt[0]]);

    /* Pan with pointer capture, so a drag that starts on a card still pans and keeps
       tracking when the pointer leaves the canvas. A drag past a few pixels swallows the
       click underneath, so panning never selects somebody by accident. */
    function down(e) {
      var v = viewRef.current; if (!v || e.button !== 0) return;
      if (e.target.closest && e.target.closest('.ocn__grab, .ocn__tw, .oc__tools')) return;
      dragRef.current = { x: e.clientX, y: e.clientY, l: v.scrollLeft, t: v.scrollTop, moved: 0 };
      try { v.setPointerCapture(e.pointerId); } catch (err) {}
      v.classList.add('is-drag');
    }
    function move(e) {
      var d = dragRef.current, v = viewRef.current; if (!d || !v) return;
      var dx = e.clientX - d.x, dy = e.clientY - d.y;
      d.moved = Math.max(d.moved, Math.abs(dx) + Math.abs(dy));
      v.scrollLeft = d.l - dx; v.scrollTop = d.t - dy;
    }
    function up(e) {
      var d = dragRef.current, v = viewRef.current;
      if (v) { v.classList.remove('is-drag'); try { v.releasePointerCapture(e.pointerId); } catch (err) {} }
      draggedRef.current = !!(d && d.moved > 4);
      dragRef.current = null;
    }
    function zoom(by) { zoomSt[1](Math.min(1.5, Math.max(0.5, Math.round((zoomSt[0] + by) * 10) / 10))); }
    function wheel(e) {
      if (!(e.ctrlKey || e.metaKey)) return;     /* plain wheel still scrolls the canvas */
      e.preventDefault();
      zoomSt[1](function (z) { return Math.min(1.5, Math.max(0.5, Math.round((z - Math.sign(e.deltaY) * 0.1) * 10) / 10)); });
    }

    /* Drag a card onto another to move someone under a new manager. */
    function startMove(e, id) {
      e.preventDefault(); e.stopPropagation();
      moveSt[1]({ id: id, over: null });
      function onMove(ev) {
        var el = document.elementFromPoint(ev.clientX, ev.clientY);
        var card = el && el.closest ? el.closest('.ocn') : null;
        var overId = card && card.getAttribute('data-id');
        moveSt[1](function (m) { return m && m.id !== overId ? { id: m.id, over: overId && overId !== m.id ? overId : null } : m; });
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        moveSt[1](function (m) {
          if (m && m.over) p.onMove(m.id, m.over);
          return null;
        });
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }

    var pos = posRef.current, z = zoomSt[0];
    function at(id) { return pos[id] || { x: 0, y: 0, o: 1 }; }
    /* Edges come from the eased positions, so they track the cards every frame. */
    var edges = L.nodes.filter(function (n) { return n.parent; }).map(function (n) {
      var a = at(n.parent), b = at(n.id);
      var x1 = a.x + NW / 2, y1 = a.y + NH, x2 = b.x + NW / 2, y2 = b.y;
      var my = y1 + (y2 - y1) / 2, r = Math.min(12, Math.abs(x2 - x1) / 2);
      var d = Math.abs(x2 - x1) < 1
        ? 'M' + x1 + ' ' + y1 + ' V' + y2
        : 'M' + x1 + ' ' + y1 + ' V' + (my - r)
          + ' Q' + x1 + ' ' + my + ' ' + (x1 + (x2 > x1 ? r : -r)) + ' ' + my
          + ' H' + (x2 - (x2 > x1 ? r : -r))
          + ' Q' + x2 + ' ' + my + ' ' + x2 + ' ' + (my + r) + ' V' + y2;
      return { d: d, hot: onPath[n.id] && onPath[n.parent], key: n.id };
    });

    return h('div', { className: 'oc oc--big' + (p.big ? ' oc--full' : '') },
      h('div', { className: 'oc__tools' },
        h('button', { type: 'button', className: 'oc__tool', 'aria-label': 'Zoom out', onClick: function () { zoom(-0.1); } }, g('M5 12h14', 16)),
        h('span', { className: 'oc__zoom' }, Math.round(z * 100) + '%'),
        h('button', { type: 'button', className: 'oc__tool', 'aria-label': 'Zoom in', onClick: function () { zoom(0.1); } }, g('M12 5v14M5 12h14', 16)),
        h('button', { type: 'button', className: 'oc__tool', 'aria-label': 'Reset view',
          onClick: function () { zoomSt[1](1); var v = viewRef.current; if (v) { v.scrollTop = 0; } } }, SYNC)),

      h('div', { className: 'oc__hint' },
        h('span', { className: 'oc__legend' },
          h('span', null, h('i', { style: { background: 'var(--warning-fg)' } }), 'On probation'),
          h('span', null, h('i', { style: { background: 'var(--danger-fg)' } }), 'Serving notice')),
        h('span', { style: { opacity: .5 } }, '·'),
        h('b', null, 'Drag'), 'to pan · ', h('b', null, 'drag a card'), 'onto a manager to move someone · ', h('b', null, '⌘ scroll'), 'to zoom'),
      h('div', { className: 'oc__view', ref: viewRef, 'data-lenis-prevent': true, onWheel: wheel, onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up },
        h('div', { className: 'oc__sizer', style: { width: L.w * z, height: L.h * z } },
        h('div', { className: 'oc__stage', style: { width: L.w, height: L.h, transform: 'scale(' + z + ')' } },
          h('svg', { className: 'oc__edges', width: L.w, height: L.h, 'aria-hidden': 'true' },
            edges.map(function (e) { return h('path', { key: e.key, d: e.d, className: e.hot ? 'is-path' : undefined }); })),
          L.nodes.map(function (n) {
            var who = byId[n.id] || { r: '', d: '' };
            var kids = directory.childrenOf(n.id);
            var col = avFor(n.id), q = at(n.id);
            var isOpen = !!openSt[0][n.id], busy = !!busySt[0][n.id];
            var mv = moveSt[0];
            var cls = 'ocn' + (p.selected === n.id ? ' is-on' : (onPath[n.id] ? ' is-anc' : ''))
              + (mv && mv.id === n.id ? ' is-ghost' : '') + (mv && mv.over === n.id ? ' is-drop' : '');
            return h('div', {
              key: n.id, className: cls, tabIndex: 0, 'data-id': n.id,
              style: { width: NW, height: NH, transform: 'translate(' + q.x + 'px,' + q.y + 'px)', opacity: q.o },
              onClick: function () { if (draggedRef.current) { draggedRef.current = false; return; } p.onSelect(n.id); },
              onKeyDown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); p.onSelect(n.id); } }
            },
              who.k ? h('span', { className: 'ocn__grab', role: 'button', tabIndex: -1,
                'aria-label': 'Move ' + n.id + ' to another manager', title: 'Drag onto a manager to move ' + n.id,
                onMouseDown: function (e) { startMove(e, n.id); } }, g('M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01', 13)) : null,
              h('span', { className: 'ocn__ph', style: { background: col[0], color: col[1] } },
                who.photo ? h('img', { src: who.photo, alt: '' }) : initials(n.id)),
              h('span', { className: 'ocn__nm' }, n.id),
              h('span', { className: 'ocn__ro' }, who.r),
              h('span', { className: 'ocn__dp' }, who.d),
              kids.length ? h('span', { className: 'ocn__cn' }, kids.length) : null,
              (function () {
                var st = statusOf(n.id);
                return st ? h('span', { className: 'ocn__st st--' + st.k, title: st.t + ' · ' + st.d }, st.t) : null;
              })(),
              kids.length ? h('span', {
                className: 'ocn__tw' + (isOpen ? ' is-open' : '') + (busy ? ' is-busy' : ''), role: 'button', tabIndex: 0,
                'aria-label': (isOpen ? 'Collapse ' : 'Expand ') + n.id, 'aria-expanded': isOpen ? 'true' : 'false',
                onClick: function (e) { e.stopPropagation(); toggle(n.id); },
                onKeyDown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggle(n.id); } }
              }, busy ? g('M12 3a9 9 0 1 0 9 9', 13) : I.chevron) : null);
          })))));
  }

  /* The whole structure as an outline, with the selected line of command picked out. */
  function OrgOutline(p) {
    var rows = [];
    (function walk(id, depth) {
      var n = STAFF.find(function (x) { return x.id === id; }); if (!n) return;
      rows.push({ n: n, depth: depth });
      directory.childrenOf(id).forEach(function (k) { walk(k.id, depth + 1); });
    })(p.rootId, 0);
    var anc = ancestorsOf(p.selected), on = {};
    anc.forEach(function (id) { on[id] = 'anc'; }); on[p.selected] = 'on';
    return h('div', { className: 'ocout', 'data-lenis-prevent': true }, rows.map(function (r) {
      return h('button', {
        key: r.n.id, type: 'button', className: 'ocout__r' + (on[r.n.id] === 'on' ? ' is-on' : on[r.n.id] === 'anc' ? ' is-anc' : ''),
        style: { paddingLeft: (9 + r.depth * 16) + 'px' }, onClick: function () { p.onSelect(r.n.id); }
      },
        r.depth ? h('span', { className: 'ocout__rail' }) : null,
        h(V.Avatar, { name: r.n.id, size: 'sm' }),
        h('span', { className: 'ocout__nm' }, r.n.id),
        (function () {
          var st = statusOf(r.n.id);
          return st ? h('span', { className: 'chip-st st--' + st.k, title: st.d }, st.t) : null;
        })(),
        h('span', { className: 'ocout__ro' }, r.n.r));
    }));
  }

  /* ---------- Team map: cards wired together, measured after layout ---------- */
  function TeamMap(p) {
    var T = p.team, toast = p.toast, go = p.go;
    var focusSt = useState(T.reports[0].n), openTeams = useState({});
    var wrapRef = React.useRef(null), pinsRef = React.useRef({});
    var pathSt = useState([]);
    function setPin(k) { return function (el) { if (el) pinsRef.current[k] = el; else delete pinsRef.current[k]; }; }

    React.useLayoutEffect(function () {
      function draw() {
        var wrap = wrapRef.current; if (!wrap) return;
        var W = wrap.getBoundingClientRect();
        function c(k) {
          var el = pinsRef.current[k]; if (!el) return null;
          var r = el.getBoundingClientRect();
          return { x: r.left - W.left + r.width / 2, y: r.top - W.top + r.height / 2 };
        }
        var out = [];
        function wire(fromK, toK) {
          var a = c(fromK), b = c(toK); if (!a || !b) return;
          var dx = Math.max(26, (b.x - a.x) * 0.55);
          out.push('M' + a.x + ' ' + a.y + ' C' + (a.x + dx) + ' ' + a.y + ', ' + (b.x - dx) + ' ' + b.y + ', ' + b.x + ' ' + b.y);
        }
        T.reports.forEach(function (r) { wire('lead', 'rep-' + r.n); });
        T.reports.filter(function (r) { return r.sub.length; }).forEach(function (r) { wire('rep-out-' + r.n, 'team-' + r.n); });
        wire('team-out', 'acts');
        var next = { d: out, w: Math.round(W.width), h: Math.round(W.height) };
        var cur = pathSt[0];
        /* Only write when the geometry really moved — this effect has no dep array,
           so an unconditional setState would re-render forever. */
        if (!cur || cur.w !== next.w || cur.h !== next.h || String(cur.d) !== String(next.d)) pathSt[1](next);
      }
      draw();
      var ro = window.ResizeObserver ? new ResizeObserver(draw) : null;
      if (ro && wrapRef.current) ro.observe(wrapRef.current);
      window.addEventListener('resize', draw);
      return function () { if (ro) ro.disconnect(); window.removeEventListener('resize', draw); };
    });

    var wires = pathSt[0] && pathSt[0].d ? pathSt[0] : { d: [], w: 0, h: 0 };
    var withSub = T.reports.filter(function (r) { return r.sub.length; });
    var midTeam = withSub[Math.floor(withSub.length / 2)];

    return h('div', { className: 'tmap', ref: wrapRef },
      h('svg', { className: 'tmap__wires', viewBox: '0 0 ' + (wires.w || 1) + ' ' + (wires.h || 1), 'aria-hidden': 'true' },
        wires.d.map(function (d, i) { return h('path', { key: i, d: d }); })),

      h('div', { className: 'tmap__cols' },
        /* 1 · the lead */
        h('div', { className: 'tmap__col' },
          h('div', { className: 'mcard mcard--lead' },
            h('div', { className: 'mlead__h' }, h(V.Avatar, { name: T.lead, size: 'lg' }),
              h('span', null, h('strong', null, T.lead), h('span', null, T.leadRole))),
            h('div', { className: 'mlead__f' },
              h('div', { className: 'mlead__r' }, I.sitemap, h('em', null, 'Reports to'), h('b', null, T.reportsTo)),
              h('div', { className: 'mlead__r' }, TEAMS, h('em', null, 'Team size'), h('b', null, T.size + ' members')),
              h('div', { className: 'mlead__r' }, I.building, h('em', null, 'Department'), h('b', null, T.dept))),
            h('span', { className: 'pin pin--r', ref: setPin('lead') })),
          h('span', { className: 'tmap__cap' }, 'Reporting to')),

        /* 2 · direct reports */
        h('div', { className: 'tmap__col' },
          h('div', { className: 'mcard mlist' }, T.reports.map(function (r) {
            return h('div', { className: 'mrow' + (focusSt[0] === r.n ? ' is-on' : ''), key: r.n, onClick: function () { focusSt[1](r.n); } },
              h('span', { className: 'pin pin--l', ref: setPin('rep-' + r.n) }),
              h(V.Avatar, { name: r.n, size: 'sm' }),
              h('span', { className: 'mrow__t' }, h('strong', null, r.n), h('span', null, r.r)),
              h('button', { className: 'mrow__b', type: 'button', 'aria-label': 'Schedule with ' + r.n,
                onClick: function (e) { e.stopPropagation(); toast('Schedule with ' + r.n + ' — prototype.'); } }, I.calendar),
              r.sub.length ? h('span', { className: 'pin pin--r', ref: setPin('rep-out-' + r.n) }) : null);
          })),
          h('span', { className: 'tmap__cap' }, 'Direct reports (' + T.reports.length + ')')),

        /* 3 · sub-teams */
        h('div', { className: 'tmap__col' },
          withSub.map(function (r) {
            var open = !!openTeams[0][r.n];
            return h('div', { className: 'mcard mteam', key: r.n },
              h('span', { className: 'pin pin--l', ref: setPin('team-' + r.n) }),
              h('div', { className: 'mteam__h' }, TEAMS, r.n + "'s team (" + r.sub.length + ')',
                h('button', {
                  className: 'mteam__x' + (open ? ' is-open' : ''), type: 'button',
                  'aria-expanded': open ? 'true' : 'false', 'aria-label': (open ? 'Collapse ' : 'Expand ') + r.n + "'s team",
                  onClick: function () { var m = Object.assign({}, openTeams[0]); m[r.n] = !open; openTeams[1](m); }
                }, I.chevron)),
              open
                ? h('div', { className: 'mteam__list' }, r.sub.map(function (m) {
                    return h('div', { className: 'mteam__p', key: m }, h(V.Avatar, { name: m, size: 'sm' }), m,
                      h('small', null, SUBROLE[m] || 'Designer'));
                  }))
                : h('div', { className: 'mteam__faces' }, r.sub.map(function (m) { return h(V.Avatar, { key: m, name: m, size: 'sm' }); })),
              r === midTeam ? h('span', { className: 'pin pin--r', ref: setPin('team-out') }) : null);
          }),
          h('span', { className: 'tmap__cap' }, 'Team members (' + T.size + ')')),

        /* 4 · actions */
        h('div', { className: 'tmap__col' },
          h('div', { style: { position: 'relative' } },
            h('span', { className: 'pin pin--l', ref: setPin('acts'), style: { top: 38 } }),
            h('div', { className: 'tt__acts' },
              h('button', { type: 'button', className: 'tt__act tt__act--pri', onClick: function () { p.onAction('add'); } }, ADDP, 'Add team member'),
              h('button', { type: 'button', className: 'tt__act', onClick: function () { p.onAction('reassign'); } }, I.sitemap, 'Reassign reporting'),
              h('button', { type: 'button', className: 'tt__act', onClick: function () { p.onAction('sub'); } }, TEAMS, 'Create sub-team'),
              h('button', { type: 'button', className: 'tt__act', onClick: function () { p.onAction('move'); } }, MOVE, 'Move to another team'),
              h('button', { type: 'button', className: 'tt__act', onClick: function () { p.onAction('role'); } }, I.shield, 'Update role'),
              h('button', { type: 'button', className: 'tt__act', onClick: function () { p.onAction('details'); } }, EYE2, 'View team details'))),
          h('span', { className: 'tmap__cap' }, 'Team actions'))));
  }


  /* ------------------------------------------------------------------ Screens
     One component serves all five tabs. It is registered against each of the five
     routes, so React keeps it mounted as the tabs change and the chart selection, the
     branches already loaded and any lifecycle edits survive moving between them — the
     way they did when this was a single page. */
  /* Accounts live in the Users module, so People no longer carries a Users tab. */
  var TAB_OF = {
    'org-tree': 'Org tree', teams: 'Teams',
    lifecycle: 'Lifecycle', access: 'Access requests'
  };

  function PeopleModule(p) {
    var teamSt = useState('Product Design'), focusSt = useState('Priya Sharma');
    var openSt = useState({ 'Engineering': true, 'People & Culture': true });
    var loadedSt = useState(1), teamRowsSt = useState({ loading: true, rows: [] }), panelSt = useState('team');
    var lifeSt = useState(LIFE_SEED.map(function (r) { return Object.assign({}, r); }));
    var moveKeySt = useState(0), actSt = useState(null), bigSt = useState(false), sheetSt = useState(false);

    /* The chart holds only what was expanded, so the team always comes from the directory. */
    React.useEffect(function () {
      var id = focusSt[0], live = true;
      teamRowsSt[1]({ loading: true, rows: [] });
      directory.subtree(id).then(function (rows) { if (live) teamRowsSt[1]({ loading: false, rows: rows }); });
      return function () { live = false; };
    }, [focusSt[0]]);

    /* The active tab is the route, not local state, so every tab is a real link. */
    var meta = p.route && p.route.meta;
    var tabPath = meta && meta.tab ? meta.tab.path : 'org-tree';

    function body() {
      var t = TAB_OF[tabPath] || 'Org tree';

      if (t === 'Org tree') {
        var open = openSt[0];
        function toggle(id) { var m = Object.assign({}, open); m[id] = !m[id]; openSt[1](m); }
        /* The plain nested list, kept for the Selected panel's compact view. */
        function cssNode(n, depth) {
          var kids = kidsOf(n.id);
          var isOpen = open[n.id] === undefined ? depth < 2 : open[n.id];
          return h('li', { key: n.id },
            h('div', { className: 'onode' + (focusSt[0] === n.id ? ' is-on' : ''), onClick: function () { focusSt[1](n.id); } },
              kids.length
                ? h('span', { className: 'onode__tw' + (isOpen ? ' is-open' : ''), role: 'button', tabIndex: 0,
                    'aria-label': (isOpen ? 'Collapse ' : 'Expand ') + n.id, 'aria-expanded': isOpen ? 'true' : 'false',
                    onClick: function (e) { e.stopPropagation(); toggle(n.id); } }, I.chevron)
                : h('span', { className: 'onode__sp' }),
              h(V.Avatar, { name: n.id, size: 'sm' }),
              h('span', { className: 'onode__m' }, h('strong', null, n.id), h('span', null, n.r + ' · ' + n.d)),
              kids.length ? h('span', { className: 'onode__n' }, kids.length + ' report' + (kids.length === 1 ? '' : 's')) : null),
            kids.length && isOpen ? h('ul', null, kids.map(function (k) { return cssNode(k, depth + 1); })) : null);
        }
        var root = STAFF.find(function (n) { return !n.k; });
        var sel = STAFF.find(function (n) { return n.id === focusSt[0]; }) || root;
        var team = teamRowsSt[0];

        return h('div', { className: 'stack gap-4' },
          h('div', { className: 'astat' },
            h('span', { className: 'astat__i' }, I.sitemap, 'Loaded in the chart ', h('b', null, loadedSt[0])),
            h('span', { className: 'astat__i' }, TEAMS, 'Reporting to ' + sel.id + ' ',
              team.loading ? h('b', null, '…') : h('b', null, team.rows.length)),
            !team.loading && team.rows.length > loadedSt[0] - 1
              ? h('span', { className: 'astat__warn' }, 'Counted from the directory, not the chart')
              : h('span', { className: 'astat__ok' }, 'In step'),
            (function () {
              var pr = 0, nt = 0;
              STAFF.forEach(function (n) { var st = statusOf(n.id); if (st) { if (st.k === 'prob') pr++; else nt++; } });
              return h('span', { className: 'astat__i' }, I.person,
                h('span', { className: 'chip-st st--prob' }, pr + ' on probation'),
                h('span', { className: 'chip-st st--notice' }, nt + ' on notice'));
            })(),
            h('span', { className: 'astat__sp anote' }, 'Expanding loads a branch; the team panel always re-queries the whole subtree.')),

          h('div', { className: 'agrid' },
            h('section', { className: 'dash__card c12', style: { padding: 0, overflow: 'hidden' } },
              h('div', { className: 'dash__card__head', style: { padding: '18px 20px 10px' } },
                h('h2', null, 'Reporting chart'),
                h('span', { className: 'row gap-2' },
                  h('span', { className: 'anote' }, 'Drag to pan · click a person to load their team'),
                  h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: bigSt[0] ? I.shrink : I.expand,
                    onClick: function () { bigSt[1](!bigSt[0]); } }, bigSt[0] ? 'Exit full screen' : 'Full screen'))),
              bigSt[0] ? h('div', { className: 'oc__scrim', onClick: function () { bigSt[1](false); } }) : null,
              h(OrgChart, { key: moveKeySt[0], rootId: root.id, selected: focusSt[0], big: bigSt[0],
                onSelect: function (id) { focusSt[1](id); sheetSt[1](true); },
                onCount: function (n) { loadedSt[1](n); },
                onMove: function (who, to) {
                  var p1 = STAFF.find(function (x) { return x.id === who; });
                  if (!p1 || who === to) return;
                  /* refuse a move that would put someone under their own report */
                  var cur = STAFF.find(function (x) { return x.id === to; });
                  while (cur) { if (cur.id === who) { toast('That would put ' + who + ' under their own report.'); return; } cur = STAFF.find(function (x) { return x.id === cur.k; }); }
                  p1.k = to;
                  moveKeySt[1](moveKeySt[0] + 1);
                  loadedSt[1](1);
                  toast(who + ' now reports to ' + to + '.');
                } })),

            null),

          sheetSt[0] ? h(React.Fragment, null,
            h('div', { className: 'sheet__scrim', onClick: function () { sheetSt[1](false); } }),
            h('aside', { className: 'sheet', role: 'dialog', 'aria-label': sel.id },
              h('div', { className: 'sheet__top' },
                h(V.Avatar, { name: sel.id, size: 'lg' }),
                h('span', { className: 'sheet__t' },
                  h('strong', null, sel.id),
                  h('span', null, sel.r + ' · ' + sel.d),
                  (function () {
                    var st = statusOf(sel.id);
                    return st ? h('span', { className: 'chip-st st--' + st.k, style: { marginTop: 4, alignSelf: 'flex-start' } }, st.t + ' · ' + st.d) : null;
                  })()),
                h(V.IconButton, { icon: I.close, 'aria-label': 'Close', onClick: function () { sheetSt[1](false); } })),

              h('div', { className: 'sheet__body', 'data-lenis-prevent': true },
                h('div', { className: 'ocpath' }, ancestorsOf(sel.id).concat([sel.id]).map(function (id, i, arr) {
                  return h(React.Fragment, { key: id },
                    h('button', { type: 'button', className: i === arr.length - 1 ? 'is-on' : '',
                      onClick: function () { focusSt[1](id); } }, id),
                    i < arr.length - 1 ? I.right : null);
                })),

                h('div', { className: 'mlead__f' },
                  h('div', { className: 'mlead__r' }, I.sitemap, h('em', null, 'Reports to'), h('b', null, sel.k || '—')),
                  h('div', { className: 'mlead__r' }, TEAMS, h('em', null, 'Direct reports'), h('b', null, directory.childrenOf(sel.id).length)),
                  h('div', { className: 'mlead__r' }, I.users, h('em', null, 'Everyone below'),
                    h('b', null, team.loading ? '…' : team.rows.length))),

                h(V.TabGroup, { 'aria-label': 'Panel', value: panelSt[0], onChange: panelSt[1],
                  items: [{ value: 'team', label: 'Their team' }, { value: 'all', label: 'Whole structure' }] }),

                panelSt[0] === 'all'
                  ? h(OrgOutline, { rootId: root.id, selected: sel.id, onSelect: function (id) { focusSt[1](id); } })
                  : team.loading
                    ? h('div', { className: 'stack gap-2' }, [0, 1, 2].map(function (i) {
                        return h('span', { className: 'shimmer', key: i, style: { height: 34, width: (92 - i * 11) + '%' } });
                      }))
                    : team.rows.length
                      ? h('div', { className: 'lrows' }, team.rows.map(function (r) {
                          var st = statusOf(r.id);
                          return h('div', { className: 'lrow', key: r.id },
                            h(V.Avatar, { name: r.id, size: 'sm' }),
                            h('span', { className: 'lrow__m' }, h('strong', null, r.id), h('span', null, r.r + ' · reports to ' + r.k)),
                            st ? h('span', { className: 'chip-st st--' + st.k }, st.t) : null,
                            h('button', { type: 'button', className: 'lrow__go', 'aria-label': 'Open ' + r.id,
                              onClick: function () { focusSt[1](r.id); } }, I.right));
                        }))
                      : h('p', { className: 'muted-s' }, 'Nobody reports to ' + sel.id + '.')),

              h('div', { className: 'sheet__foot' },
                h(V.Button, { variant: 'outline', iconStart: MOVE, onClick: function () { toast('Reassign reporting — prototype.'); } }, 'Reassign'),
                h(V.Button, { iconStart: EYE2, onClick: function () { sheetSt[1](false); router.go('admin/users/all'); } }, 'Open record')))) : null);
      }

      if (t === 'Teams') {
        var T = TEAM, total = T.composition.reduce(function (a, c) { return a + c[1]; }, 0);
        var C = 2 * Math.PI * 62, off = 0;
        return h('div', { className: 'teamfit' },
          h('div', { className: 'thead' },
            h('div', { className: 'thead__pick' },
              h('small', null, 'Team'),
              h(V.Select, { 'aria-label': 'Team', value: teamSt[0], onChange: teamSt[1],
                options: ['Product Design', 'Platform', 'Mobile', 'Payroll ops'] })),

            /* everyone on the team, up front */
            h('div', { className: 'thead__roster' },
              h('div', { className: 'faces' },
                ALL_MEMBERS.slice(0, 9).map(function (m) {
                  var st = statusOf(m.n);
                  return h('span', {
                    className: 'faces__f' + (focusSt[0] === m.n ? ' is-on' : ''), key: m.n,
                    title: m.n + ' · ' + m.r + (st ? ' · ' + st.t + ' ' + st.d : ''),
                    onClick: function () { focusSt[1](m.n); }
                  },
                    h(V.Avatar, { name: m.n, size: 'md' }),
                    st ? h('span', { className: 'faces__b faces__b--' + st.k }, st.k === 'prob' ? 'P' : 'N')
                       : (m.n2 ? h('span', { className: 'faces__b faces__b--n' }, m.n2) : null));
                }),
                ALL_MEMBERS.length > 9 ? h('span', { className: 'faces__more' }, '+' + (ALL_MEMBERS.length - 9)) : null)),

            h('div', { className: 'thead__acts' },
              h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.plus,
                onClick: function () { actSt[1]({ kind: 'add' }); } }, 'Add member'),
              h(ExportMenu, { onPick: function (kind) {
                var cols = ['Team member', 'Role', 'Reporting to', 'Join date', 'Status', 'Standing'];
                var rows = ALL_MEMBERS.map(function (m) {
                  var st = statusOf(m.n);
                  return [m.n, m.r, m.to || T.lead, m.j || '—', 'Active', st ? st.t + ' · ' + st.d : 'Confirmed'];
                });
                if (kind === 'xls') { exportExcel('aptaHR-' + teamSt[0].replace(/\s+/g, '-') + '-team', 'Team', cols, rows); toast('Workbook downloaded.'); }
                else { exportPDF(teamSt[0] + ' team', cols, rows) || toast('Allow pop-ups to print to PDF.'); }
              } }))),

          h('div', { className: 'teamfit__map' },
            h(TeamMap, { team: T, toast: toast, go: router.go, onAction: function (k) { actSt[1]({ kind: k, who: null }); } })),

          h('div', { className: 'agrid' },
            h(Card, { span: 'c7', title: 'Team overview' },
              h('div', { className: 'teamfit__scroll' },
              h(Table, { rows: T.roster, cols: [
                { h: 'Team member', cell: function (r) { return h('span', { className: 'who2' },
                    h('span', { style: { color: r.star ? 'var(--warning-fg)' : 'var(--border-default)', display: 'flex' } }, I.star),
                    h(V.Avatar, { name: r.n, size: 'sm' }), h('span', null, h('strong', null, r.n))); } },
                { h: 'Role', cell: function (r) { return h('span', { className: 'muted-s' }, r.r); } },
                { h: 'Reporting to', cell: function (r) { return h('span', { className: 'muted-s' }, r.to); } },
                { h: 'Join date', cell: function (r) { return h('span', { className: 'muted-s' }, r.j); } },
                { h: 'Status', cell: function (r) { return h('span', { className: 'tag2 tag2--ok' }, r.s); } }
              ] }))),
            h(Card, { span: 'c5', title: 'Team composition' },
              h('div', { className: 'donut' },
                h('div', { className: 'donut__svg' },
                  h('svg', { viewBox: '0 0 168 168', 'aria-hidden': 'true' }, T.composition.map(function (c, i) {
                    var len = (c[1] / total) * C, d = Math.max(len - 4, 2), o = off; off += len;
                    return h('circle', { key: c[0], cx: 84, cy: 84, r: 62, fill: 'none', stroke: RAMP[Math.min(i, RAMP.length - 1)],
                      strokeWidth: 20, strokeDasharray: d + ' ' + (C - d), strokeDashoffset: -o });
                  })),
                  h('span', { className: 'donut__mid' }, h('span', null, h('b', null, total), h('span', null, 'Team members')))),
                h('div', { className: 'donut__key' }, T.composition.map(function (c, i) {
                  return h('div', { className: 'donut__row', key: c[0] },
                    h('span', { className: 'donut__dot', style: { background: RAMP[Math.min(i, RAMP.length - 1)] } }),
                    h('span', { className: 'donut__lbl' }, c[0]),
                    h('span', { className: 'donut__n' }, c[1]));
                })))))); 
      }

      if (t === 'Lifecycle') {
        var L = lifeSt[0];
        function setRow(id, patch) { lifeSt[1](L.map(function (r) { return r.id === id ? Object.assign({}, r, patch) : r; })); }
        return h('div', { className: 'panelx' },
          h('div', { className: 'panelx__head' },
            h('div', null, h('h2', null, 'Lifecycle'),
              h('p', null, 'Joining, confirming and leaving. Ara closes access on an exit by herself — a confirmation needs a person, so it goes to HR.')),
            h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.history,
              onClick: function () { lifeSt[1](LIFE_SEED.map(function (r) { return Object.assign({}, r); })); toast('Reset to the incoming state.'); } }, 'Reset')),

          h('div', { className: 'lc' }, L.map(function (r) {
            var auto = r.kind === 'exit', done = r.state === 'done', sent = r.state === 'sent';
            return h('div', { className: 'lcr' + (auto ? ' is-auto' : ' is-hold'), key: r.id },
              h('span', { className: 'lcr__ic' }, auto ? I.logout : I.calendar),
              h('span', { className: 'lcr__m' },
                h('strong', null, r.who),
                h('span', null, r.what + ' · ' + r.when),
                auto
                  ? h('span', { className: 'lcr__ara' }, ARA_GLYPH,
                      done ? 'Access disabled at 18:00 on ' + r.when
                           : 'Ara will disable the account at 18:00 on ' + r.when)
                  : h('span', { className: 'lcr__ara' }, ARA_GLYPH,
                      sent ? 'Waiting on ' + r.approver + ' to confirm'
                           : 'Confirmation changes pay and benefits, so ' + r.approver + ' has to approve it')),
              h('span', { className: 'lcr__r' },
                auto
                  ? (done
                      ? h('span', { className: 'tag2 tag2--ok' }, CHECK, 'Scheduled')
                      : h('span', { className: 'row gap-2' },
                          h(V.Button, { variant: 'ghost', className: 'vi-btn--sm',
                            onClick: function () { setRow(r.id, { state: 'held' }); toast('Held. ' + r.who + " keeps access until you say otherwise."); } }, 'Hold'),
                          h(V.Button, { className: 'vi-btn--sm', iconStart: WAND,
                            onClick: function () { setRow(r.id, { state: 'done' }); toast('Ara will close ' + r.who + "'s access at 18:00."); } }, 'Let Ara do it')))
                  : (sent
                      ? h('span', { className: 'tag2 tag2--warn' }, 'With ' + r.approver)
                      : h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.shield,
                          onClick: function () { setRow(r.id, { state: 'sent' }); toast('Sent to ' + r.approver + ' for approval.'); } }, 'Send for HR approval'))));
          })));
      }

      return h('div', { className: 'panelx' },
        h('div', { className: 'panelx__head' },
          h('div', null, h('h2', null, 'Access requests'), h('p', null, 'One inbox. Type is a filter, not a separate screen.')),
          h(V.SegmentedControl, { size: 'sm', items: ['All', 'New user', 'Role change', 'Team', 'System'], defaultValue: 'All' })),
        h(Table, { rows: [
          { w: 'Sana Qureshi', t: 'Role change', d: 'HR Junior → HR Senior', by: 'Meera Nair', age: '2 days' },
          { w: 'Arjun Pillai', t: 'New user', d: 'Employee · People & Culture', by: 'Meera Nair', age: '1 day' },
          { w: 'Finance team', t: 'Team access', d: 'Payroll register, read', by: 'Rohit Shetty', age: '4 hrs' },
          { w: 'Tally', t: 'System access', d: 'Journal posting', by: 'Rohit Shetty', age: '3 hrs' }
        ], cols: [
          { h: 'Request', cell: function (r) { return h('span', null, h('strong', null, r.w), h('br'), h('span', { className: 'muted-s' }, r.d)); } },
          { h: 'Type', cell: function (r) { return h('span', { className: 'tag2 tag2--off' }, r.t); } },
          { h: 'Raised by', cell: function (r) { return h('span', { className: 'muted-s' }, r.by); } },
          { h: 'Waiting', cell: function (r) { return h('span', { className: 'muted-s' }, r.age); } },
          { h: '', right: true, cell: function () { return h('span', { className: 'row gap-2' },
              h(V.Button, { variant: 'outline', className: 'vi-btn--sm', onClick: function () { toast('Declined — prototype.'); } }, 'Decline'),
              h(V.Button, { className: 'vi-btn--sm', onClick: function () { toast('Approved — prototype.'); } }, 'Approve')); } }
        ] }));
    }

    /* ---------- Organisation ---------- */

    /* The team action form used to hang off the page shell; it belongs to the module. */
    return h(React.Fragment, null,
      body(),
      actSt[0] ? h(TeamAction, {
        kind: actSt[0].kind, team: TEAM,
        onClose: function () { actSt[1](null); },
        onDone: function (msg) { actSt[1](null); toast(msg); }
      }) : null);
  }

  HRMS.screens.register({
    'admin/people/org-tree': PeopleModule,
    'admin/people/teams': PeopleModule,
    'admin/people/lifecycle': PeopleModule,
    'admin/people/access': PeopleModule
  });
})();

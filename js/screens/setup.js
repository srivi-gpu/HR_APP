/* First-run setup (PRD 3.2). The screen an Admin lands on after signing up, before the
   organisation exists: a stepper that reads the documents you already have, fills the
   steps in from them, and asks you to confirm every value.

   Two things make it more than a form. Each filled field says which document it came
   from and whether the value was stated or inferred, so nothing arrives unattributed.
   And "Go live" writes through the same actions the rest of the console uses —
   updateOrganization, createLocation, createDepartment, inviteUser — so what the wizard
   creates is validated exactly as a hand-typed record would be, and shows up everywhere
   immediately. Offices and departments are added, never overwritten, so a wizard run can
   never orphan an employee who already belongs to one.

   Prototype: documents are matched on their names and nothing is uploaded anywhere. */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var store = HRMS.store, router = HRMS.router, ui = HRMS.ui, act = HRMS.actions;

  var useState = React.useState;

  function g(d, s) {
    return h('svg', { viewBox: '0 0 24 24', width: s || 20, height: s || 20, fill: 'none', 'aria-hidden': 'true' },
      h('path', { d: d, stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }));
  }
  var CHECK = g('M5 13l4 4L19 7', 16);
  var UP = g('M12 16V4m0 0L8 8m4-4 4 4M4 17v1.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V17');
  var WAND = g('M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8l1.4 1.4M17.8 6.2l1.4-1.4M12.2 6.2l-1.4-1.4M3 21l9-9');
  var X = g('M6 6l12 12M18 6L6 18', 12);

  var WEEKS = ['Mon – Fri', 'Mon – Sat', 'Sun – Thu', 'Rotational'];
  var ZONES = ['Asia/Kolkata (IST)', 'Asia/Dubai (GST)', 'Europe/London (GMT)', 'Asia/Singapore (SGT)'];
  var HOLS = ['India 2026', 'UAE 2026', 'UK 2026', 'Singapore 2026'];
  /* Three roles in the system: Admin (whoever runs this wizard), HR, and Employee.
     HR is the only one the assistant proposes, and it comes in three levels. */
  var HR_LEVELS = [
    { k: 'HR Head', can: 'Everything in HR: policy, payroll approval, roles and exits' },
    { k: 'HR Senior', can: 'The full lifecycle and approvals, but cannot finalise payroll' },
    { k: 'HR Junior', can: 'Records, requests and documents. No approvals' }
  ];
  var ROLES = HR_LEVELS.map(function (l) { return l.k; });
  /* Title patterns that mean HR, most senior first. Everything else is left alone. */
  var RULES = [
    { re: /head of (people|hr)|chief people|hr director|vp,? ?(people|hr)/i, role: 'HR Head', why: 'Leads the function' },
    { re: /hr (business partner|manager|lead)|hrbp|senior hr|people partner/i, role: 'HR Senior', why: 'Owns a population end to end' },
    { re: /hr (executive|associate|assistant|officer|generalist|ops|operations)|people (ops|operations)|recruit/i, role: 'HR Junior', why: 'Works the day-to-day queue' }
  ];
  function suggestRole(p) {
    var hrDept = /people|human resource|\bhr\b/i.test(p.dept || '');
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i].re.test(p.desig)) {
        return { role: RULES[i].role, why: RULES[i].why,
          ev: '\u201c' + p.desig + '\u201d' + (p.dept ? ' in ' + p.dept : ''),
          conf: hrDept ? 'high' : 'med' };
      }
    }
    return null;
  }

  var DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  var WEEKDAYS = { 'Mon – Fri': [1, 1, 1, 1, 1, 0, 0], 'Mon – Sat': [1, 1, 1, 1, 1, 1, 0], 'Sun – Thu': [1, 1, 1, 1, 0, 0, 1], 'Rotational': [1, 1, 1, 1, 1, 0, 0] };

  var STEPS = [
    { k: 'Documents', hint: 'Upload and read' },
    { k: 'Legal entity', hint: 'Name, PAN, GSTIN' },
    { k: 'Offices', hint: 'Week, calendar, fence' },
    { k: 'Structure', hint: 'Departments and IDs' },
    { k: 'HR access', hint: 'Who runs HR' },
    { k: 'Review', hint: 'Check and go live' }
  ];
  var TITLES = ['Start with your documents', 'Confirm the legal entity', 'Confirm the offices', 'Confirm the structure', 'Who runs HR', 'Review and go live'];
  var SUBS = [
    'Drop in what you already have. The assistant reads them and fills in the steps that follow — you confirm every value.',
    'Filled from your documents. Each field says where it came from; anything marked “Check this” was inferred rather than stated.',
    'Taken from your employee sheet. The working week, calendar and geo-fence are defaults for each time zone.',
    'Counted from your employee sheet. Each of these becomes a dropdown value everywhere else in the system.',
    'Three roles exist: you are the Admin, everyone is an Employee, and these people look like HR. HR comes in three levels — pick the right one for each.',
    'This is everything the wizard will create. Nothing has been saved yet.'
  ];

  var SAMPLES = [
    { name: 'Certificate of incorporation.pdf', size: 418000 },
    { name: 'GST registration.pdf', size: 221000 },
    { name: 'PAN card.jpg', size: 96000 },
    { name: 'Employee master.xlsx', size: 184000 }
  ];

  /* What a document yields. 'high' means it was stated, 'med' means it had to be inferred. */
  function readDoc(name) {
    var n = name.toLowerCase(), f = {}, note;
    if (/gst/.test(n)) {
      f.gstin = ['36AAACA1234F1Z5', 'high']; f.address = ['Plot 42, HITEC City, Hyderabad 500081', 'high'];
      note = 'GSTIN and place of business';
    } else if (/\bpan\b|pan[-_ ]?card/.test(n)) { f.pan = ['AAACA1234F', 'high']; note = 'Permanent account number'; }
    else if (/tan|tds/.test(n)) { f.tan = ['HYDA12345B', 'high']; note = 'Tax deduction account number'; }
    else if (/incorp|coi|moa|constitution|certificate/.test(n)) {
      f.name = ['Aptagrim Technologies Pvt Ltd', 'high']; f.short = ['ATPL', 'med'];
      f.signatory = ['Priya Sharma · Director', 'med']; f.address = ['Plot 42, HITEC City, Hyderabad 500081', 'high'];
      note = 'Registered name, address, first director';
    } else if (/employee|master|roster|payroll|staff|people|headcount/.test(n)) {
      f.people = [248, 'high'];
      f.depts = [['Engineering', 96], ['Design', 18], ['People & Culture', 11], ['Finance', 14], ['Sales', 31]];
      f.desigs = [['Software Engineer', 'L2'], ['Senior Software Engineer', 'L3'], ['Engineering Manager', 'L5'], ['Product Designer', 'L3'], ['HR Business Partner', 'L4']];
      f.locs = [['Hyderabad HQ', 'Asia/Kolkata (IST)'], ['Bengaluru', 'Asia/Kolkata (IST)'], ['Dubai', 'Asia/Dubai (GST)']];
      f.types = ['Full-time', 'Contract', 'Intern'];
      f.people_rows = [
        { name: 'Meera Nair', desig: 'Head of People', dept: 'People & Culture', email: 'meera@aptagrim.com' },
        { name: 'Divya Menon', desig: 'HR Business Partner', dept: 'People & Culture', email: 'divya@aptagrim.com' },
        { name: 'Sana Qureshi', desig: 'HR Executive', dept: 'People & Culture', email: 'sana@aptagrim.com' },
        { name: 'Arjun Pillai', desig: 'Talent Acquisition Associate', dept: 'People & Culture', email: 'arjun@aptagrim.com' },
        { name: 'Priya Sharma', desig: 'Managing Director', dept: 'Leadership', email: 'priya@aptagrim.com' },
        { name: 'Rohit Shetty', desig: 'Finance Controller', dept: 'Finance', email: 'rohit@aptagrim.com' },
        { name: 'Karthik Menon', desig: 'Engineering Manager', dept: 'Engineering', email: 'karthik@aptagrim.com' },
        { name: 'Ananya Rao', desig: 'Product Designer', dept: 'Design', email: 'ananya@aptagrim.com' }
      ];
      note = '248 people · 5 departments · 3 offices';
    } else if (/logo|letterhead|brand/.test(n)) { f.letterhead = [true, 'high']; note = 'Letterhead artwork'; }
    return { fields: f, note: note, blank: !note };
  }

  var LABELS = { name: 'Registered name', short: 'Short code', pan: 'PAN', tan: 'TAN', gstin: 'GSTIN',
    address: 'Registered address', signatory: 'Authorised signatory', people: 'Headcount', letterhead: 'Letterhead' };

  function Setup() {
    /* The sign-in screen, borrowed as the backdrop. Taken from the registry at render
       time rather than at load, so script order cannot matter. */
    var Login = HRMS.screens.registry['global/login'];

    var openSt = useState(true), stepSt = useState(0);
    var filesSt = useState([]), overSt = useState(false), scanSt = useState(false), scannedSt = useState(false);
    var entSt = useState({ name: '', short: '', pan: '', tan: '', gstin: '', address: '', signatory: '' });
    var metaSt = useState({});
    var locSt = useState([]), depSt = useState([]), desSt = useState([]), typeSt = useState([]);
    var numSt = useState({ prefix: '', next: 1 });
    var editSt = useState(null);
    var accSt = useState([]);          // [{name, desig, dept, email, role, why, ev, conf, on}]
    var assignedSt = useState(false), skipSt = useState([]);

    function toast(m) { ui.toast(m); }
    function addFiles(list) {
      filesSt[1](filesSt[0].concat(list.map(function (f, i) {
        return { id: Date.now() + '-' + i, name: f.name, size: f.size || 120000, status: 'queued' };
      })));
      scannedSt[1](false);
    }

    function analyse() {
      if (!filesSt[0].length) return;
      scanSt[1](true);
      filesSt[1](filesSt[0].map(function (f) { return Object.assign({}, f, { status: 'reading' }); }));
      setTimeout(function () {
        var ent = Object.assign({}, entSt[0]), meta = Object.assign({}, metaSt[0]);
        var locs = locSt[0].slice(), deps = depSt[0].slice(), des = desSt[0].slice(), types = typeSt[0].slice();
        var num = Object.assign({}, numSt[0]);
        var roster = [];
        var read = filesSt[0].map(function (f) {
          var r = readDoc(f.name);
          Object.keys(r.fields).forEach(function (k) {
            var v = r.fields[k];
            if (k === 'depts') { v.forEach(function (d) { if (!deps.some(function (x) { return x.name === d[0]; })) deps.push({ name: d[0], n: d[1] }); }); return; }
            if (k === 'desigs') { v.forEach(function (d) { if (!des.some(function (x) { return x.name === d[0]; })) des.push({ name: d[0], grade: d[1] }); }); return; }
            if (k === 'locs') {
              v.forEach(function (l) {
                if (locs.some(function (x) { return x.name === l[0]; })) return;
                var tz = l[1];
                locs.push({ id: 'l' + locs.length + Date.now(), name: l[0], tz: tz,
                  week: tz.indexOf('Dubai') > -1 ? 'Sun – Thu' : 'Mon – Fri',
                  hol: tz.indexOf('Dubai') > -1 ? 'UAE 2026' : tz.indexOf('London') > -1 ? 'UK 2026' : tz.indexOf('Singapore') > -1 ? 'Singapore 2026' : 'India 2026',
                  fence: 200, src: f.name });
              });
              return;
            }
            if (k === 'types') { v.forEach(function (t) { if (types.indexOf(t) < 0) types.push(t); }); return; }
            if (k === 'people_rows') { roster = roster.concat(v); return; }
            if (k === 'people' || k === 'letterhead') { meta[k] = { src: f.name, conf: v[1], value: v[0] }; return; }
            if (!ent[k]) { ent[k] = v[0]; meta[k] = { src: f.name, conf: v[1] }; }
          });
          return Object.assign({}, f, { status: r.blank ? 'blank' : 'read', note: r.note });
        });
        if (!num.prefix && ent.short) num.prefix = ent.short.toUpperCase() + '-';
        /* Run every person in the roster past the rules; keep only those needing more than Employee. */
        var acc = roster.map(function (p) {
          var sug = suggestRole(p);
          return sug ? Object.assign({}, p, sug, { on: true }) : null;
        }).filter(Boolean);
        var skipped = roster.filter(function (p) { return !suggestRole(p); });
        filesSt[1](read); entSt[1](ent); metaSt[1](meta); locSt[1](locs);
        depSt[1](deps); desSt[1](des); typeSt[1](types); numSt[1](num); accSt[1](acc); skipSt[1](skipped);
        scanSt[1](false); scannedSt[1](true);
        var got = read.filter(function (x) { return x.status === 'read'; }).length;
        toast('Read ' + got + ' of ' + read.length + ' documents.');
      }, 1500);
    }

    function Field(p) {
      var m = metaSt[0][p.k], check = m && m.conf === 'med';
      return h('div', { className: 'ff' + (check ? ' is-check' : '') + (p.wide ? ' span2' : '') },
        h(V.TextField, {
          label: LABELS[p.k], value: entSt[0][p.k] || '', placeholder: p.ph,
          onChange: function (e) {
            var n = Object.assign({}, entSt[0]); n[p.k] = e.target.value; entSt[1](n);
            if (m) { var mm = Object.assign({}, metaSt[0]); mm[p.k] = Object.assign({}, m, { conf: 'edited' }); metaSt[1](mm); }
          }
        }),
        h('span', { className: 'ff__src' }, m ? I.file : null,
          m ? [m.src, h('span', { key: 'c', className: 'ff__conf' + (m.conf === 'med' ? ' ff__conf--med' : m.conf === 'edited' ? ' ff__conf--none' : '') },
                m.conf === 'med' ? 'Check this' : m.conf === 'edited' ? 'You edited it' : 'From document')]
            : h('span', { className: 'ff__conf ff__conf--none' }, 'Not found — type it in')));
    }

    var filled = Object.keys(metaSt[0]).length;
    var flags = (function () {
      var out = [];
      ['name', 'pan', 'gstin', 'address', 'signatory'].forEach(function (k) { if (!entSt[0][k]) out.push(LABELS[k] + ' is empty'); });
      Object.keys(metaSt[0]).forEach(function (k) { if (metaSt[0][k].conf === 'med' && LABELS[k]) out.push(LABELS[k] + ' was inferred, not stated'); });
      if (!locSt[0].length) out.push('No offices added');
      if (!depSt[0].length) out.push('No departments');
      if (!numSt[0].prefix) out.push('No employee ID format');
      var on = accSt[0].filter(function (p) { return p.on; });
      if (accSt[0].length && !on.some(function (p) { return p.role === 'HR Head'; })) out.push('Nobody holds HR Head');
      if (accSt[0].length && !on.length) out.push('Nobody has HR access');
      return out;
    })();

    /* ---- Previews ---- */
    function pvEntity() {
      return h('aside', { className: 'osm__preview' },
        h('span', { className: 'osm__preview__h' }, 'On your letters'),
        h('div', { className: 'pv' },
          h('span', { className: 'pv__logo' }, entSt[0].short || '—'),
          h('strong', null, entSt[0].name || 'Your company name'),
          h('span', null, entSt[0].address || 'Registered address'),
          h('span', { className: 'pv__rule' }),
          h('dl', { className: 'pv__kv' },
            h('dt', null, 'PAN'), h('dd', null, entSt[0].pan || '—'),
            h('dt', null, 'GSTIN'), h('dd', null, entSt[0].gstin || '—')),
          h('span', { className: 'pv__rule' }),
          h('span', null, entSt[0].signatory || 'Authorised signatory')),
        h('span', { className: 'osm__preview__h' }, 'Read so far'),
        h('span', { className: 'muted-s' }, filled + ' field' + (filled === 1 ? '' : 's') + ' filled from ' + filesSt[0].filter(function (f) { return f.status === 'read'; }).length + ' documents.'));
    }
    function pvWeek() {
      var l = locSt[0].find(function (x) { return x.id === editSt[0]; }) || locSt[0][0];
      if (!l) return null;
      var on = WEEKDAYS[l.week] || WEEKDAYS['Mon – Fri'];
      return h('aside', { className: 'osm__preview' },
        h('span', { className: 'osm__preview__h' }, l.name),
        h('div', { className: 'pv' },
          h('span', null, 'Working week'),
          h('span', { className: 'pv__week' }, DAYS.map(function (d, i) {
            return h('span', { className: 'pv__d' + (on[i] ? ' is-on' : ''), key: i }, d);
          })),
          h('span', { className: 'pv__rule' }),
          h('dl', { className: 'pv__kv' },
            h('dt', null, 'Zone'), h('dd', null, l.tz.replace(/ \(.*/, '')),
            h('dt', null, 'Calendar'), h('dd', null, l.hol),
            h('dt', null, 'Geo-fence'), h('dd', null, l.fence ? l.fence + ' m' : 'None'))),
        h('span', { className: 'muted-s' }, 'Punch-in outside the fence is flagged for the employee’s manager.'));
    }
    function pvStruct() {
      var total = depSt[0].reduce(function (a, d) { return a + (d.n || 0); }, 0);
      return h('aside', { className: 'osm__preview' },
        h('span', { className: 'osm__preview__h' }, 'First joiner'),
        h('div', { className: 'pv' },
          h('span', { className: 'pv__id' }, numSt[0].prefix ? numSt[0].prefix + String(numSt[0].next).padStart(4, '0') : 'No format yet'),
          h('span', null, 'Every new joiner takes the next number in this sequence.')),
        h('span', { className: 'osm__preview__h' }, 'Covers'),
        h('div', { className: 'pv' },
          h('dl', { className: 'pv__kv' },
            h('dt', null, 'People'), h('dd', null, total || '—'),
            h('dt', null, 'Departments'), h('dd', null, depSt[0].length),
            h('dt', null, 'Grades'), h('dd', null, new Set(desSt[0].map(function (d) { return d.grade; })).size || '—'))));
    }

    /* ---- Step bodies ---- */
    function bodyDocs() {
      var n = filesSt[0].length;
      return h('div', { className: 'osm__split' },
        h('div', { className: 'osm__col' },
          h('div', {
            className: 'drop' + (overSt[0] ? ' is-over' : ''),
            onDragOver: function (e) { e.preventDefault(); overSt[1](true); },
            onDragLeave: function () { overSt[1](false); },
            onDrop: function (e) { e.preventDefault(); overSt[1](false); addFiles(Array.prototype.slice.call(e.dataTransfer.files)); }
          },
            h('span', { className: 'drop__i' }, UP),
            h('strong', null, 'Drop your documents here'),
            h('span', null, 'PDF, image or spreadsheet'),
            h('div', { className: 'drop__acts' },
              h('label', null,
                h('input', { type: 'file', multiple: true, style: { display: 'none' },
                  onChange: function (e) { addFiles(Array.prototype.slice.call(e.target.files)); e.target.value = ''; } }),
                h('span', { className: 'vi-btn vi-btn--outline vi-btn--sm', role: 'button', tabIndex: 0 }, h('span', { className: 'vi-btn__label' }, 'Choose files'))),
              h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', onClick: function () { addFiles(SAMPLES); } }, 'Use samples'))),
          n ? h('div', { className: 'files' }, filesSt[0].map(function (f) {
            return h('div', { className: 'file' + (f.status === 'read' ? ' is-read' : f.status === 'blank' ? ' is-blank' : ''), key: f.id },
              h('span', { className: 'file__i' }, f.status === 'read' ? CHECK : f.status === 'blank' ? I.warn : I.file),
              h('span', { className: 'file__m' }, h('strong', null, f.name),
                f.status === 'reading'
                  ? h('span', { className: 'shimmer', style: { height: 9, width: '40%', marginTop: 3 } })
                  : h('span', null, f.status === 'read' ? f.note : f.status === 'blank' ? 'Nothing recognised in this one' : 'Waiting to be read')),
              h(V.IconButton, { icon: I.close, 'aria-label': 'Remove ' + f.name,
                onClick: function () { filesSt[1](filesSt[0].filter(function (x) { return x.id !== f.id; })); } }));
          })) : null,
          scannedSt[0] ? h('div', { className: 'found' },
            [['Entity', entSt[0].name], ['PAN', entSt[0].pan], ['GSTIN', entSt[0].gstin],
             ['Offices', locSt[0].length || null], ['Departments', depSt[0].length || null],
             ['Headcount', metaSt[0].people ? metaSt[0].people.value : null]]
              .filter(function (x) { return x[1]; }).map(function (x) {
                return h('div', { className: 'found__i', key: x[0] }, h('span', null, x[0]), h('strong', null, x[1]));
              })) : null),
        h('aside', { className: 'osm__preview' },
          h('span', { className: 'osm__preview__h' }, 'What it can read'),
          h('div', { className: 'pv' },
            h('dl', { className: 'pv__kv' },
              h('dt', null, 'Incorporation'), h('dd', null, 'Name, address, director'),
              h('dt', null, 'GST'), h('dd', null, 'GSTIN, place of business'),
              h('dt', null, 'PAN / TAN'), h('dd', null, 'Statutory IDs'),
              h('dt', null, 'Employee sheet'), h('dd', null, 'Offices, departments, grades'))),
          h('span', { className: 'muted-s' }, 'Anything it cannot place is left for you to type in, and it says so.')));
    }

    function bodyEntity() {
      return h('div', { className: 'osm__split' },
        h('div', { className: 'osm__col' },
          h('div', { className: 'grid2' },
            h(Field, { k: 'name', wide: true, ph: 'e.g. Company Pvt Ltd' }),
            h(Field, { k: 'pan', ph: 'e.g. AAACA1234F' }),
            h(Field, { k: 'gstin', ph: 'e.g. 36AAACA1234F1Z5' }),
            h(Field, { k: 'short', ph: 'e.g. ATPL' }),
            h(Field, { k: 'tan', ph: 'e.g. HYDA12345B' }),
            h(Field, { k: 'address', wide: true, ph: 'Street, city, postcode' }),
            h(Field, { k: 'signatory', wide: true, ph: 'e.g. Priya Sharma · Director' }))),
        pvEntity());
    }

    function bodyLocs() {
      function upd(id, k, v) { locSt[1](locSt[0].map(function (l) { return l.id === id ? Object.assign({}, l, (function (o) { o[k] = v; return o; })({})) : l; })); }
      return h('div', { className: 'osm__split' },
        h('div', { className: 'osm__col' },
          locSt[0].length ? h('div', { className: 'rows' }, locSt[0].map(function (l) {
            var open = editSt[0] === l.id;
            return h('div', { key: l.id },
              h('div', { className: 'rowx' },
                h('span', { className: 'rowx__m' }, h('strong', null, l.name),
                  h('span', null, l.week + ' · ' + l.hol + ' · ' + (l.fence ? l.fence + ' m' : 'no geo-fence'))),
                l.src ? h('span', { className: 'ff__conf ff__conf--med' }, 'Defaults') : null,
                h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', onClick: function () { editSt[1](open ? null : l.id); } }, open ? 'Done' : 'Edit'),
                h(V.IconButton, { icon: I.close, 'aria-label': 'Remove ' + l.name,
                  onClick: function () { locSt[1](locSt[0].filter(function (x) { return x.id !== l.id; })); } })),
              open ? h('div', { className: 'rowx__edit' },
                h(V.TextField, { label: 'Name', value: l.name, onChange: function (e) { upd(l.id, 'name', e.target.value); } }),
                h(V.Select, { label: 'Work week', value: l.week, onChange: function (v) { upd(l.id, 'week', v); }, options: WEEKS }),
                h(V.Select, { label: 'Time zone', value: l.tz, onChange: function (v) { upd(l.id, 'tz', v); }, options: ZONES }),
                h(V.Select, { label: 'Holiday calendar', value: l.hol, onChange: function (v) { upd(l.id, 'hol', v); }, options: HOLS }),
                h(V.TextField, { label: 'Geo-fence (m)', value: String(l.fence || ''),
                  onChange: function (e) { upd(l.id, 'fence', +(e.target.value.replace(/\D/g, '') || 0)); } })) : null);
          })) : h('p', { className: 'muted-s' }, 'No offices were found in your documents. Add the first one.'),
          h('div', null, h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.plus,
            onClick: function () {
              var id = 'l' + Date.now();
              locSt[1](locSt[0].concat([{ id: id, name: 'New office', tz: ZONES[0], week: WEEKS[0], hol: HOLS[0], fence: 200 }]));
              editSt[1](id);
            } }, 'Add an office'))),
        pvWeek());
    }

    function bodyStruct() {
      function chip(label, sub, onX, key) {
        return h('span', { className: 'chip2', key: key || label }, label, sub ? h('b', null, sub) : null,
          onX ? h('button', { type: 'button', 'aria-label': 'Remove ' + label, onClick: onX }, X) : null);
      }
      return h('div', { className: 'osm__split' },
        h('div', { className: 'osm__col' },
          h('div', { className: 'sect' }, h('span', { className: 'lbl' }, 'Departments'),
            h('div', { className: 'chips2' }, depSt[0].length
              ? depSt[0].map(function (d) { return chip(d.name, d.n ? String(d.n) : null, function () { depSt[1](depSt[0].filter(function (x) { return x.name !== d.name; })); }, d.name); })
              : h('span', { className: 'muted-s' }, 'None found'))),
          h('div', { className: 'sect' }, h('span', { className: 'lbl' }, 'Designations and grades'),
            h('div', { className: 'chips2' }, desSt[0].length
              ? desSt[0].map(function (d) { return chip(d.name, d.grade, null, d.name); })
              : h('span', { className: 'muted-s' }, 'None found'))),
          h('div', { className: 'sect' }, h('span', { className: 'lbl' }, 'Employment types'),
            h('div', { className: 'chips2' }, typeSt[0].length
              ? typeSt[0].map(function (t) { return chip(t, null, function () { typeSt[1](typeSt[0].filter(function (x) { return x !== t; })); }); })
              : h('span', { className: 'muted-s' }, 'None found'))),
          h('div', { className: 'sect' }, h('span', { className: 'lbl' }, 'Employee IDs'),
            h('div', { className: 'grid2' },
              h(V.TextField, { label: 'Prefix', value: numSt[0].prefix, placeholder: 'e.g. ATPL-',
                onChange: function (e) { numSt[1](Object.assign({}, numSt[0], { prefix: e.target.value })); } }),
              h(V.TextField, { label: 'Start from', value: String(numSt[0].next),
                onChange: function (e) { numSt[1](Object.assign({}, numSt[0], { next: +(e.target.value.replace(/\D/g, '') || 0) })); } })))),
        pvStruct());
    }

    /* ---- HR access ---- */
    function bodyAccess() {
      var on = accSt[0].filter(function (p) { return p.on; });
      var heads = on.filter(function (p) { return p.role === 'HR Head'; }).length;
      function set(email, k, v) {
        accSt[1](accSt[0].map(function (p) { return p.email === email ? Object.assign({}, p, (function (o) { o[k] = v; return o; })({})) : p; }));
      }
      return h('div', { className: 'osm__split' },
        h('div', { className: 'osm__col' },
          accSt[0].length ? h('div', { className: 'rows' }, accSt[0].map(function (p) {
            return h('div', { key: p.email },
              h('div', { className: 'rowx' },
                h(V.Checkbox, { checked: p.on, 'aria-label': 'Give ' + p.name + ' HR access',
                  onChange: function (e) { set(p.email, 'on', e.target.checked); } }),
                h(V.Avatar, { name: p.name, size: 'sm' }),
                h('span', { className: 'rowx__m' },
                  h('strong', null, p.name),
                  h('span', null, p.desig + ' · ' + p.dept)),
                h('span', { style: { width: 150, flex: 'none' } },
                  h(V.Select, { 'aria-label': 'HR level for ' + p.name, value: p.role, options: ROLES, disabled: !p.on,
                    onChange: function (v) { set(p.email, 'role', v); set(p.email, 'conf', 'edited'); } }))),
              h('span', { className: 'ff__src', style: { padding: '0 0 11px 34px' } }, I.leo,
                p.conf === 'edited' ? 'You chose this level' : p.ev + ' — ' + p.why,
                h('span', { className: 'ff__conf' + (p.conf === 'med' ? ' ff__conf--med' : p.conf === 'edited' ? ' ff__conf--none' : '') },
                  p.conf === 'med' ? 'Check this' : p.conf === 'edited' ? 'Yours' : 'Clear match')));
          })) : h('p', { className: 'muted-s' }, 'No employee sheet was read, so there is nobody to propose. HR access can be granted later.'),

          heads !== 1 ? h('div', { className: 'flags' },
            h('strong', null, heads ? 'More than one HR Head' : 'Nobody holds HR Head'),
            h('ul', null, [h('li', { key: 0 }, heads
              ? 'Policy, payroll approval and role changes would have several owners. One is usually enough.'
              : 'Policy, payroll approval and role changes would have no owner. Promote one of the people above, or add someone later.')])) : null,

          (function () {
            /* In an HR department but the title does not say HR: worth asking about, not assuming. */
            var near = skipSt[0].filter(function (p) { return /people|human resource|\bhr\b/i.test(p.dept || ''); });
            if (!near.length) return null;
            return h('div', { className: 'sect' },
              h('span', { className: 'lbl' }, 'In an HR team, but the title does not say so'),
              h('div', { className: 'rows' }, near.map(function (p) {
                return h('div', { className: 'rowx', key: p.email },
                  h(V.Avatar, { name: p.name, size: 'sm' }),
                  h('span', { className: 'rowx__m' }, h('strong', null, p.name),
                    h('span', null, p.desig + ' · ' + p.dept)),
                  h('span', { className: 'ff__conf ff__conf--med' }, 'Your call'),
                  h(V.Button, { variant: 'outline', className: 'vi-btn--sm', onClick: function () {
                    accSt[1](accSt[0].concat([Object.assign({}, p, { role: 'HR Junior', conf: 'edited', on: true })]));
                    skipSt[1](skipSt[0].filter(function (x) { return x.email !== p.email; }));
                  } }, 'Give HR Junior'));
              })),
              h('span', { className: 'muted-s' }, 'Sitting in People & Culture is not the same as doing HR, so this one is yours to decide.'));
          })(),

          skipSt[0].filter(function (p) { return !/people|human resource|\bhr\b/i.test(p.dept || ''); }).length ? h('div', { className: 'sect' },
            h('span', { className: 'lbl' }, 'Not proposed · stay as Employee'),
            h('div', { className: 'chips2' }, skipSt[0].filter(function (p) { return !/people|human resource|\bhr\b/i.test(p.dept || ''); }).map(function (p) {
              return h('span', { className: 'chip2', key: p.email, title: p.desig }, p.name, h('b', null, p.desig));
            })),
            h('span', { className: 'muted-s' }, 'Nothing in their titles says HR. You are the Admin; anyone else who needs access can be given it later.')) : null),

        h('aside', { className: 'osm__preview' },
          h('span', { className: 'osm__preview__h' }, 'What each level can do'),
          HR_LEVELS.map(function (l) {
            var n = on.filter(function (p) { return p.role === l.k; }).length;
            return h('div', { className: 'pv', key: l.k, style: n ? null : { opacity: .55 } },
              h('strong', null, l.k + ' · ' + n),
              h('span', null, l.can));
          }),
          h('span', { className: 'muted-s' }, (248 - on.length) + ' others stay as Employee. Levels can be changed any time.')));
    }

    function bodyReview() {
      return h('div', { className: 'rev2' },
        h('div', { className: 'rev2__s' },
          h('h4', null, 'Legal entity', entSt[0].name ? h('span', { style: { color: 'var(--success-fg)', display: 'inline-flex' } }, CHECK) : null),
          h('dl', null,
            h('dt', null, 'Registered name'), h('dd', null, entSt[0].name || '—'),
            h('dt', null, 'PAN · GSTIN'), h('dd', null, (entSt[0].pan || '—') + ' · ' + (entSt[0].gstin || '—')),
            h('dt', null, 'Address'), h('dd', null, entSt[0].address || '—'),
            h('dt', null, 'Signatory'), h('dd', null, entSt[0].signatory || '—'))),
        h('div', { className: 'rev2__s' },
          h('h4', null, locSt[0].length + ' office' + (locSt[0].length === 1 ? '' : 's'), locSt[0].length ? h('span', { style: { color: 'var(--success-fg)', display: 'inline-flex' } }, CHECK) : null),
          h('dl', null, locSt[0].length ? [].concat.apply([], locSt[0].map(function (l) {
            return [h('dt', { key: l.id + 'a' }, l.name), h('dd', { key: l.id + 'b' }, l.week + ' · ' + l.hol + ' · ' + (l.fence ? l.fence + ' m' : 'no geo-fence'))];
          })) : [h('dt', { key: 'x' }, 'None'), h('dd', { key: 'y' }, '—')])),
        h('div', { className: 'rev2__s' },
          h('h4', null, 'Structure', depSt[0].length ? h('span', { style: { color: 'var(--success-fg)', display: 'inline-flex' } }, CHECK) : null),
          h('dl', null,
            h('dt', null, 'Departments'), h('dd', null, depSt[0].map(function (d) { return d.name; }).join(', ') || '—'),
            h('dt', null, 'Designations'), h('dd', null, desSt[0].length + ' mapped to grades'),
            h('dt', null, 'Employment types'), h('dd', null, typeSt[0].join(', ') || '—'),
            h('dt', null, 'First employee ID'), h('dd', null, numSt[0].prefix ? numSt[0].prefix + String(numSt[0].next).padStart(4, '0') : '—'))),
        h('div', { className: 'rev2__s' },
          h('h4', null, 'HR access', accSt[0].filter(function (p) { return p.on; }).length ? h('span', { style: { color: 'var(--success-fg)', display: 'inline-flex' } }, CHECK) : null),
          h('dl', null, accSt[0].filter(function (p) { return p.on; }).length
            ? [].concat.apply([], accSt[0].filter(function (p) { return p.on; }).map(function (p) {
                return [h('dt', { key: p.email + 'a' }, p.role), h('dd', { key: p.email + 'b' }, p.name + ' · ' + p.desig)];
              }))
            : [h('dt', { key: 'x' }, 'HR'), h('dd', { key: 'y' }, 'Nobody yet — everyone is an Employee')])),
        flags.length
          ? h('div', { className: 'flags' }, h('strong', null, flags.length + ' worth checking first'),
              h('ul', null, flags.slice(0, 6).map(function (x, i) { return h('li', { key: i }, x); })))
          : h('div', { className: 'allgood' }, CHECK, 'Everything the wizard checks is in place.'));
    }

    var BODIES = [bodyDocs, bodyEntity, bodyLocs, bodyStruct, bodyAccess, bodyReview];
    var step = stepSt[0];


    /* Apply the wizard through the console's own actions, so every record it creates is
       validated exactly as a hand-typed one would be and appears everywhere at once.
       Offices and departments are only added where the name is new: overwriting one would
       orphan the people already filed under it. */
    function goLive() {
      var made = { offices: 0, departments: 0, invites: 0 };

      if (entSt[0].name) {
        act.updateOrganization({
          name: entSt[0].name, short: entSt[0].short, address: entSt[0].address,
          pan: entSt[0].pan, gstin: entSt[0].gstin, tan: entSt[0].tan, signatory: entSt[0].signatory
        });
      }

      var haveLoc = {};
      store.collection('locations').forEach(function (l) { haveLoc[l.name.toLowerCase()] = true; });
      locSt[0].forEach(function (l) {
        if (haveLoc[l.name.toLowerCase()]) return;
        var r = act.createLocation({
          name: l.name, address: entSt[0].address || l.name,
          tz: String(l.tz || '').replace(/ \(.*/, '')
        });
        if (r && r.ok) made.offices++;
      });

      var haveDep = {}, haveCode = {};
      store.collection('departments').forEach(function (d) {
        haveDep[d.name.toLowerCase()] = true; haveCode[d.code] = true;
      });
      depSt[0].forEach(function (d) {
        if (haveDep[d.name.toLowerCase()]) return;
        var base = d.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'DEP';
        var code = base, n = 1;
        while (haveCode[code]) { code = base.slice(0, 2) + n; n++; }   /* keep codes unique */
        haveCode[code] = true;
        var r = act.createDepartment({ name: d.name, code: code });
        if (r && r.ok) made.departments++;
      });

      if (numSt[0].prefix) {
        /* On a true first run the org is empty and the wizard's start number stands. Run
           against an org that already has people — the wizard is reachable from the
           dashboard — starting again at 1 would hand out an ID somebody already has, so
           the next number never goes below the highest already issued. */
        var issued = 0;
        store.collection('employees').forEach(function (e) {
          var m = String(e.id || '').match(/(\d+)$/);
          if (m) issued = Math.max(issued, Number(m[1]));
        });
        store.setOverride('numbering', 'num-in', {
          prefix: numSt[0].prefix, next: Math.max(numSt[0].next || 1, issued + 1)
        });
      }

      /* HR access is an invitation, not an account: the person still has to accept it. */
      accSt[0].filter(function (p) { return p.on; }).forEach(function (p) {
        var r = act.inviteUser({ email: p.email, role: 'hr' });
        if (r && r.ok) made.invites++;
      });

      finish();
      openSt[1](false);
      toast('Organisation is live \u00b7 ' + made.offices + ' offices, ' + made.departments
        + ' departments and ' + made.invites + ' HR invitations created.');
      /* Live means the console has something to show, so go there rather than back to
         the sign-in page the wizard was sitting on. */
      store.setPref('role', 'admin');
      router.go('admin/dashboard');
    }

    function footer() {
      if (step === 0) {
        return [
          h('span', { className: 'osm__note', key: 'n' }, filesSt[0].length ? filesSt[0].length + ' document' + (filesSt[0].length === 1 ? '' : 's') + ' added' : 'Nothing is uploaded anywhere'),
          h('span', { className: 'osm__foot__r', key: 'r' },
            h(V.Button, { variant: 'ghost', onClick: function () { stepSt[1](1); } }, 'Skip and type it in'),
            scannedSt[0]
              ? h(V.Button, { iconEnd: I.arrow, onClick: function () { stepSt[1](1); } }, 'Continue')
              : h(V.Button, { iconStart: WAND, disabled: !filesSt[0].length || scanSt[0], onClick: analyse },
                  scanSt[0] ? 'Reading…' : 'Read documents'))
        ];
      }
      if (step === 5) {
        return [
          h(V.Button, { key: 'b', variant: 'ghost', iconStart: I.back, onClick: function () { stepSt[1](4); } }, 'Back'),
          h('span', { className: 'osm__foot__r', key: 'r' },
            h(V.Button, { variant: 'outline', onClick: function () { finish(); router.go('admin/people/users'); } }, 'Open People'),
            h(V.Button, { disabled: !entSt[0].name, onClick: function () { goLive(); } }, 'Go live'))
        ];
      }
      return [
        h(V.Button, { key: 'b', variant: 'ghost', iconStart: I.back, onClick: function () { stepSt[1](step - 1); } }, 'Back'),
        h('span', { className: 'osm__foot__r', key: 'r' },
          h(V.Button, { iconEnd: I.arrow, disabled: step === 1 && !entSt[0].name, onClick: function () { stepSt[1](step + 1); } }, 'Continue'))
      ];
    }

    return h(React.Fragment, null,
      /* The wizard opens over the page it was reached from — the sign-in screen — rather
         than over a welcome card of its own. Setting the organisation up is something you
         do on the way in, not a place you arrive at, and the person has not signed in yet.
         Closing the wizard therefore reveals sign-in, which is where they were. */
      h(Login, null),

      openSt[0] ? h('div', { className: 'osm__scrim' },
        h('div', {
          className: 'osm beam' + (scanSt[0] ? ' is-on' : ''), role: 'dialog', 'aria-modal': 'true',
          'aria-label': 'Set up your organisation', 'aria-busy': scanSt[0] ? 'true' : 'false'
        },
          h('div', { className: 'osm__rail' },
            h('span', { className: 'osm__brand' }, h('span', { className: 'brand__mark' }, I.users), 'HRMS'),
            h('ul', { className: 'osm__steps' }, STEPS.map(function (s, i) {
              return h('li', { key: s.k },
                h('button', {
                  type: 'button', className: 'osm__step' + (step === i ? ' is-on' : step > i ? ' is-done' : ''),
                  disabled: i > step, 'aria-current': step === i ? 'step' : undefined,
                  onClick: function () { stepSt[1](i); }
                },
                  h('span', { className: 'osm__num' }, step > i ? CHECK : i + 1),
                  h('span', { className: 'osm__t' },
                    h('span', { className: 'osm__label' }, s.k),
                    h('span', { className: 'osm__hint' }, s.hint))));
            })),
            h('div', { className: 'osm__sum' },
              h('span', { className: 'osm__sum__h' }, I.leo, 'From your documents'),
              filled
                ? h('dl', null,
                    h('dt', null, 'Fields filled'), h('dd', null, filled),
                    h('dt', null, 'Offices'), h('dd', null, locSt[0].length),
                    h('dt', null, 'Departments'), h('dd', null, depSt[0].length),
                    h('dt', null, 'Headcount'), h('dd', null, metaSt[0].people ? metaSt[0].people.value : '—'),
                    h('dt', null, 'Roles proposed'), h('dd', null, accSt[0].length || '—'))
                : h('p', null, 'Nothing read yet. Drop your documents on the first step and the rest fills itself in.'))),

          h('div', { className: 'osm__main' },
            h('div', { className: 'osm__head' },
              h('span', { className: 'osm__head__t' },
                h('span', { className: 'osm__count' }, 'Step ' + (step + 1) + ' of 6'),
                h('h2', null, TITLES[step]),
                h('p', null, SUBS[step])),
              h(V.IconButton, {
                icon: I.close, 'aria-label': 'Close setup',
                /* Leaving setup has to clear it too. The redirect that brought you here
                   fires on every admin route while setup is outstanding, so closing
                   without this would bounce you back the moment you signed in. */
                onClick: function () { openSt[1](false); finish(); ui.toast('Setup left for later. Reopen it from the dashboard.'); }
              })),
            h('div', { className: 'osm__progress' }, h('i', { style: { width: ((step + 1) / 6 * 100) + '%' } })),
            h('div', { className: 'osm__body' }, BODIES[step]()),
            h('div', { className: 'osm__foot' }, footer())))) : null,

      null);
  }


  /* Setup is done: remember it, so the first-run redirect does not fire again. */
  function finish() { store.setPref('setupComplete', true); }

  HRMS.screens.register({ 'global/setup': Setup });
})();

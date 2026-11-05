/* Data, import and retention (PRD 8.3, 14).

   Three questions an administrator arrives with, none of which the product could
   answer: how do I get our data out, how do I get our data in, and how long do we keep
   it. They are one module because they are one subject — the data map — and because
   the answers have to agree. An export that offers payslips while retention has never
   heard of them is how a data map goes stale, so all three tabs read the same list of
   record kinds from the seed (`seed.dataRecords`).

   Import is the longest of the three and the one Integrations links to. It is a wizard
   rather than a form because the order matters: where is it coming from, what are we
   bringing, what happens to a row that is already here, and only then run it. The dry
   run is not a courtesy — it is the default, and applying is a second, deliberate
   press.

   Nothing here pretends to have moved a database. An import run writes a job record
   and reports what it would have done, which is the honest depth for a prototype; the
   screens say which of the two happened rather than implying the other. */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var ui = HRMS.ui, store = HRMS.store, seed = HRMS.seed;
  var PageHead = ui.PageHead, Card = ui.Card, Grid = ui.Grid;

  function records() { return seed.dataRecords || []; }
  function jobs() { return store.collection('dataJobs'); }
  function nf(n) { return Number(n || 0).toLocaleString('en-IN'); }

  /* A job id continues the seeded series, so a run made here sorts and reads with the
     ones that were already there. */
  function addJob(fields) {
    return store.add('dataJobs', Object.assign({
      id: store.nextId('dataJobs', 'JOB'),
      on: new Date().toISOString().slice(0, 16),
      by: (store.persona('admin') || {}).name || 'Admin',
      local: true
    }, fields));
  }

  /* ------------------------------------------------------------------ Export */

  var FORMATS = [
    { value: 'csv', label: 'CSV, one file per record kind' },
    { value: 'xlsx', label: 'Excel workbook, one sheet per record kind' },
    { value: 'json', label: 'JSON, for loading into another system' }
  ];
  var RANGES = [
    { value: 'all', label: 'Everything we hold' },
    { value: 'fy', label: 'Current financial year' },
    { value: '12', label: 'Last 12 months' },
    { value: '3', label: 'Last 3 months' }
  ];

  function ExportTab() {
    var pickSt = React.useState({ employees: true, documents: false });
    var fmtSt = React.useState('csv');
    var rangeSt = React.useState('all');
    var protSt = React.useState(true);
    var filesSt = React.useState(false);

    var picked = records().filter(function (r) { return pickSt[0][r.id]; });
    var rows = picked.reduce(function (n, r) { return n + r.rows; }, 0);

    function toggle(id) {
      var next = Object.assign({}, pickSt[0]);
      next[id] = !next[id];
      pickSt[1](next);
    }
    function all(on) {
      var next = {};
      records().forEach(function (r) { next[r.id] = on; });
      pickSt[1](next);
    }

    function run() {
      if (!picked.length) { ui.toast('Pick at least one record kind to export', 'error'); return; }
      var fmt = FORMATS.filter(function (f) { return f.value === fmtSt[0]; })[0];
      addJob({
        direction: 'Export',
        what: picked.map(function (r) { return r.label; }).join(' · '),
        target: fmt.label.split(',')[0] + (protSt[0] ? ', password protected' : ''),
        rows: rows, status: 'Ready',
        detail: nf(rows) + ' rows across ' + picked.length + ' record '
          + (picked.length === 1 ? 'kind' : 'kinds')
          + (filesSt[0] ? ', with document files' : '')
          + ' · download window 7 days'
      });
      store.log('exported ' + picked.length + ' record kinds', 'Configuration');
      ui.toast('Export prepared. It is in the history below.', 'success');
    }

    return h(Grid, null,
      h(Card, {
        span: 7, title: 'What to take out',
        description: 'Pick the record kinds. Everything an export can carry is a kind retention knows '
          + 'about, so the two never disagree.',
        aside: h('div', { className: 'row gap-1' },
          h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', onClick: function () { all(true); } }, 'All'),
          h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', onClick: function () { all(false); } }, 'None'))
      },
        h('div', { className: 'dpick' }, records().map(function (r) {
          var on = !!pickSt[0][r.id];
          return h('label', { key: r.id, className: 'dpick__row' + (on ? ' is-on' : '') },
            h(V.Checkbox, {
              checked: on, 'aria-label': r.label,
              onChange: function () { toggle(r.id); }
            }),
            h('span', { className: 'dpick__m' },
              h('strong', null, r.label),
              h('span', null, r.note)),
            h('span', { className: 'dpick__n' }, nf(r.rows)));
        }))),

      h(Card, { span: 5, title: 'How to take it' },
        h('div', { className: 'stack gap-3' },
          h(V.Select, {
            label: 'Format', value: fmtSt[0], options: FORMATS,
            onChange: function (v) { fmtSt[1](v); }
          }),
          h(V.Select, {
            label: 'Range', value: rangeSt[0], options: RANGES,
            hint: 'Employee records and the asset register ignore a range; they are a current picture.',
            onChange: function (v) { rangeSt[1](v); }
          }),
          h('div', { className: 'checks__row' },
            h(V.Switch, {
              checked: protSt[0], 'aria-label': 'Password protect the archive',
              onChange: function (e) { protSt[1](e.target.checked); }
            }),
            h('div', { className: 'checks__main' },
              h('span', { className: 'checks__name' }, 'Password protect the archive'),
              h('span', { className: 'checks__meta' }, 'The password is shown once, to you, when the file is ready.'))),
          h('div', { className: 'checks__row' },
            h(V.Switch, {
              checked: filesSt[0], 'aria-label': 'Include document files',
              onChange: function (e) { filesSt[1](e.target.checked); }
            }),
            h('div', { className: 'checks__main' },
              h('span', { className: 'checks__name' }, 'Include the document files themselves'),
              h('span', { className: 'checks__meta' }, 'Not just the index. Makes the archive much larger.'))),

          h('div', { className: 'dsum' },
            h('span', { className: 'dsum__n' }, nf(rows)),
            h('span', { className: 'dsum__s' }, picked.length
              ? 'rows across ' + picked.length + ' record ' + (picked.length === 1 ? 'kind' : 'kinds')
              : 'nothing picked yet')),

          h(V.Button, {
            variant: 'primary', iconStart: I.download, fullWidth: true, onClick: run
          }, 'Prepare export'),
          h('p', { className: 'muted', style: { fontSize: 12.5, lineHeight: 1.45, margin: 0 } },
            'Every export is written to the audit log with who asked for it and what it contained.'))),

      h(Card, {
        span: 12, title: 'Export and import history',
        description: 'Download windows close after seven days. An expired file is not recoverable — '
          + 'request it again and a fresh one is prepared.'
      }, h(JobsTable, null)));
  }

  function JobsTable() {
    var rows = jobs();
    return h(ui.DataTable, {
      exportName: 'data-jobs', label: 'Data jobs', rows: rows, pageSize: 8,
      search: function (j) { return j.id + ' ' + j.direction + ' ' + j.what + ' ' + j.target; },
      searchPlaceholder: 'Search by record kind or provider',
      columns: [
        { key: 'id', header: 'Run', width: 86, cell: function (j) {
          return h('span', { className: 'mono' }, j.id);
        } },
        { key: 'direction', header: 'Direction', width: 104, cell: function (j) {
          return h('span', { className: 'djob__dir djob__dir--' + j.direction.toLowerCase() }, j.direction);
        } },
        { key: 'what', header: 'What', cell: function (j) {
          return h('span', { className: 'djob__what' },
            h('strong', null, j.what),
            h('span', null, j.detail));
        } },
        { key: 'target', header: 'Through', width: 190 },
        { key: 'rows', header: 'Rows', width: 92, align: 'right', cell: function (j) { return nf(j.rows); } },
        { key: 'on', header: 'When', width: 150, cell: function (j) { return ui.relTime(j.on); } },
        { key: 'status', header: 'State', width: 120, cell: function (j) {
          return h(ui.StatusChip, { status: j.status });
        } }
      ],
      emptyIcon: I.download, emptyTitle: 'Nothing exported or imported yet'
    });
  }

  /* ------------------------------------------------------------------ Import */

  /* Where an import can come from. The providers come from the integration catalogue —
     any entry that declares `imports` — so adding a provider there adds a source here
     without touching this screen. The two that are not providers are the ones everybody
     actually falls back on. */
  function sources() {
    var provided = store.collection('integrations')
      .filter(function (x) { return x.imports && x.imports.length; })
      .map(function (x) {
        return {
          id: x.id, name: x.name, mark: x.mark, kind: x.kind, brings: x.imports,
          connected: x.status === 'Connected',
          note: x.status === 'Connected'
            ? 'Connected. Reads straight from the provider.'
            : 'Not connected yet. Connecting is part of the run.'
        };
      });
    return provided.concat([
      { id: 'sheet', name: 'Spreadsheet', mark: 'generic', kind: 'CSV or Excel file',
        brings: ['Employees', 'Departments and designations', 'Locations', 'Reporting lines',
          'Leave balances', 'Salary structures'],
        connected: true, note: 'Download the template, fill it in, upload it back.' },
      { id: 'other', name: 'Another application', mark: 'generic', kind: 'Not in the catalogue',
        brings: ['Employees', 'Departments and designations', 'Locations', 'Reporting lines',
          'Leave balances', 'Attendance history', 'Salary structures', 'Documents'],
        connected: false, note: 'Export to CSV from the other side, then map the columns here.' }
    ]);
  }

  var DUPES = [
    { value: 'skip', label: 'Leave the record here as it is' },
    { value: 'update', label: 'Update the record here with the incoming values' },
    { value: 'ask', label: 'Hold it for me to decide, one by one' }
  ];

  /* The dry run. Derived from the source and what was picked rather than random, so the
     same choices report the same numbers twice — a validation that changes its mind
     between presses is worse than none. */
  /* Rows per kind, because a locations file is not the size of an employees file and
     reporting the same count for both is the tell that a number was invented. */
  var ROWS_PER = {
    'Employees': 1, 'Reporting lines': 0.97, 'Leave balances': 4, 'Salary structures': 1,
    'Attendance history': 290, 'Documents': 4.6, 'Projects': 0.05, 'Worked hours': 120,
    'Worklog hours': 86, 'Candidates': 2.7, 'Offers': 0.3, 'Interview history': 5.4,
    'Assets': 1.5, 'Departments and designations': 0.04, 'Locations': 0.006
  };
  var WHY = {
    'Attendance history': { err: 'Punches dated before the joining date on record.' },
    'Documents': { warn: 'An index row with no file behind it.' },
    'Leave balances': { warn: 'A leave type we have no equivalent for.' },
    'Salary structures': { warn: 'A pay component that needs mapping to one of ours.' },
    'Employees': { warn: 'A field we have no column for, or a missing work email.' }
  };
  function dryRun(source, picked) {
    var people = source.id === 'sheet' ? 312 : 1284;
    return picked.map(function (what) {
      var total = Math.max(3, Math.round(people * (ROWS_PER[what] || 0.5)));
      var why = WHY[what] || {};
      var warn = why.warn ? Math.max(1, Math.round(total * 0.015)) : 0;
      var err = why.err ? Math.max(1, Math.round(total * 0.004)) : 0;
      return {
        what: what, total: total, ready: total - warn - err, warn: warn, err: err,
        why: err ? why.err : warn ? why.warn : null
      };
    });
  }

  function ImportTab() {
    var stepSt = React.useState(0);
    var srcSt = React.useState(null);
    var pickSt = React.useState([]);
    var dupeSt = React.useState('update');
    var noticeSt = React.useState(false);
    var resultSt = React.useState(null);

    var list = sources();
    var src = srcSt[0] ? list.filter(function (s) { return s.id === srcSt[0]; })[0] : null;
    var picked = pickSt[0];

    function choose(s) {
      srcSt[1](s.id);
      pickSt[1](s.brings.slice(0, 4));
      resultSt[1](null);
      stepSt[1](1);
    }
    function toggle(what) {
      pickSt[1](picked.indexOf(what) >= 0
        ? picked.filter(function (x) { return x !== what; })
        : picked.concat([what]));
      resultSt[1](null);
    }

    function validate() {
      if (!picked.length) { ui.toast('Pick at least one kind of record to bring over', 'error'); return; }
      resultSt[1]({ applied: false, rows: dryRun(src, picked) });
      stepSt[1](3);
    }
    function apply() {
      var rows = resultSt[0].rows;
      var ready = rows.reduce(function (n, r) { return n + r.ready; }, 0);
      var held = rows.reduce(function (n, r) { return n + r.warn + r.err; }, 0);
      addJob({
        direction: 'Import', what: picked.join(' · '), target: src.name, rows: ready,
        status: 'Completed',
        detail: nf(ready) + ' rows brought over · ' + nf(held) + ' held for review · duplicates: '
          + DUPES.filter(function (d) { return d.value === dupeSt[0]; })[0].label.toLowerCase()
      });
      store.log('imported ' + picked.length + ' record kinds from ' + src.name, 'Configuration');
      resultSt[1]({ applied: true, rows: rows, ready: ready, held: held });
      ui.toast('Import run recorded. ' + nf(held) + ' rows are waiting for review.', 'success');
    }
    function restart() { srcSt[1](null); pickSt[1]([]); resultSt[1](null); stepSt[1](0); }

    var steps = ['Where from', 'What to bring', 'How to handle it', 'Review and run'];

    return h(React.Fragment, null,
      h('ol', { className: 'dsteps' }, steps.map(function (label, i) {
        var state = i === stepSt[0] ? ' is-now' : i < stepSt[0] ? ' is-done' : '';
        return h('li', { key: label, className: 'dstep' + state },
          h('button', {
            type: 'button', className: 'dstep__b',
            disabled: i > stepSt[0],
            onClick: function () { if (i <= stepSt[0]) stepSt[1](i); }
          },
            h('span', { className: 'dstep__n' }, i < stepSt[0] ? '✓' : i + 1),
            h('span', { className: 'dstep__t' }, label)));
      })),

      stepSt[0] === 0 ? h(Card, {
        title: 'Where is it coming from',
        description: 'Anything in the integration catalogue that can hand its records over, plus the two '
          + 'everybody falls back on. Connecting a provider is part of the run — you do not have to go '
          + 'and set it up first.'
      },
        h('div', { className: 'dsrc' }, list.map(function (s) {
          return h('button', {
            key: s.id, type: 'button', className: 'dsrc__c', onClick: function () { choose(s); }
          },
            h('span', { className: 'dsrc__logo' }, HRMS.logos.mark(s.mark, 30, s.name)),
            h('span', { className: 'dsrc__m' },
              h('strong', null, s.name),
              h('span', null, s.kind),
              h('em', null, s.note)),
            h('span', { className: 'dsrc__go', 'aria-hidden': 'true' }, '→'));
        }))) : null,

      stepSt[0] === 1 && src ? h(Card, {
        title: 'What to bring from ' + src.name,
        description: 'Order matters on the way in: people first, then the structure they sit in, then the '
          + 'history that hangs off them. The run does that for you — this is only what to include.',
        aside: h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', onClick: restart }, 'Change source')
      },
        h('div', { className: 'dpick' }, src.brings.map(function (what) {
          var on = picked.indexOf(what) >= 0;
          return h('label', { key: what, className: 'dpick__row' + (on ? ' is-on' : '') },
            h(V.Checkbox, {
              checked: on, 'aria-label': what, onChange: function () { toggle(what); }
            }),
            h('span', { className: 'dpick__m' }, h('strong', null, what)));
        })),
        h('div', { className: 'row gap-2', style: { marginTop: 14 } },
          h(V.Button, {
            variant: 'primary', onClick: function () { stepSt[1](2); }
          }, 'Continue'),
          src.id === 'sheet' || src.id === 'other'
            ? h(V.Button, {
                variant: 'outline', iconStart: I.download,
                onClick: function () {
                  store.log('downloaded the import template', 'Configuration');
                  ui.toast('Template prepared with a sheet per record kind', 'success');
                }
              }, 'Download the template')
            : null)) : null,

      stepSt[0] === 2 && src ? h(Grid, null,
        h(Card, { span: 7, title: 'How to handle what is already here' },
          h('div', { className: 'stack gap-3' },
            h(V.Select, {
              label: 'When an incoming row matches someone we already have',
              value: dupeSt[0], options: DUPES,
              hint: 'Matched on work email first, then on employee number.',
              onChange: function (v) { dupeSt[1](v); }
            }),
            h('div', { className: 'checks__row' },
              h(V.Switch, {
                checked: noticeSt[0], 'aria-label': 'Tell people their record has arrived',
                onChange: function (e) { noticeSt[1](e.target.checked); }
              }),
              h('div', { className: 'checks__main' },
                h('span', { className: 'checks__name' }, 'Tell people their record has arrived'),
                h('span', { className: 'checks__meta' },
                  'Sends each imported employee a notification asking them to check their own details. '
                  + 'Off by default: 1,284 notifications on a migration day is not a welcome.'))),
            h('div', { className: 'dnote' },
              h('strong', null, 'Nothing is written yet.'),
              h('span', null, 'The next step validates every row and reports what it would do. Applying '
                + 'it is a separate press.')),
            h(V.Button, { variant: 'primary', onClick: validate }, 'Validate ' + picked.length
              + ' record ' + (picked.length === 1 ? 'kind' : 'kinds')))),
        h(Card, { span: 5, title: 'The run, in order' },
          h('ol', { className: 'dorder' }, ['Connect to ' + src.name, 'Read and map the columns',
            'Validate every row', 'Report what would change', 'Write, on your word',
            'Record the run in the audit log'].map(function (t, i) {
            return h('li', { key: t }, h('span', null, i + 1), t);
          })))) : null,

      stepSt[0] === 3 && resultSt[0] ? h(React.Fragment, null,
        h(Card, {
          title: resultSt[0].applied ? 'Imported from ' + src.name : 'Dry run against ' + src.name,
          description: resultSt[0].applied
            ? 'The run is in the history on the Export tab. Rows held for review are in the import '
              + 'queue until someone resolves them.'
            : 'This is what would happen. Nothing has been written.',
          aside: h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', onClick: restart }, 'Start again')
        },
          h('div', { className: 'dres' }, resultSt[0].rows.map(function (r) {
            return h('div', { key: r.what, className: 'dres__r' },
              h('span', { className: 'dres__w' }, r.what),
              h('span', { className: 'dres__bar' },
                h('span', { className: 'dres__seg is-ok', style: { flex: r.ready } }),
                r.warn ? h('span', { className: 'dres__seg is-warn', style: { flex: r.warn } }) : null,
                r.err ? h('span', { className: 'dres__seg is-err', style: { flex: r.err } }) : null),
              h('span', { className: 'dres__n' }, nf(r.ready) + ' ready'),
              h('span', { className: 'dres__why' }, r.warn || r.err
                ? nf(r.warn + r.err) + ' held · ' + r.why
                : 'Nothing to query'));
          })),
          resultSt[0].applied ? null : h('div', { className: 'row gap-2', style: { marginTop: 16 } },
            h(V.Button, { variant: 'primary', iconStart: I.check, onClick: apply },
              'Apply this import'),
            h(V.Button, { variant: 'outline', onClick: function () { stepSt[1](2); } }, 'Change the options')))) : null);
  }

  /* --------------------------------------------------------------- Retention */

  var ON_END = [
    { value: 'anonymise', label: 'Anonymise — keep the row, drop who it was' },
    { value: 'aggregate', label: 'Aggregate — keep the monthly totals only' },
    { value: 'archive', label: 'Archive — move to cold storage, read-only' },
    { value: 'delete', label: 'Delete — remove the row' }
  ];
  var KEEP = [
    { value: '12', label: '12 months' }, { value: '24', label: '2 years' },
    { value: '36', label: '3 years' }, { value: '60', label: '5 years' },
    { value: '96', label: '8 years' }, { value: '0', label: 'Keep indefinitely' }
  ];

  function RetentionTab() {
    var saved = store.pref('retention') || {};
    var editSt = React.useState(saved);
    var holdSt = React.useState(store.pref('legalHold') || {});

    function setting(r) {
      var e = editSt[0][r.id] || {};
      return { keep: e.keep !== undefined ? e.keep : String(r.defaultKeep), onEnd: e.onEnd || r.onEnd };
    }
    function set(r, key, v) {
      var next = Object.assign({}, editSt[0]);
      next[r.id] = Object.assign({}, setting(r));
      next[r.id][key] = v;
      editSt[1](next);
    }
    function save() {
      store.setPref('retention', editSt[0]);
      store.setPref('legalHold', holdSt[0]);
      store.log('changed the retention schedule', 'Configuration');
      ui.toast('Retention schedule saved', 'success');
    }
    function hold(r) {
      var next = Object.assign({}, holdSt[0]);
      next[r.id] = !next[r.id];
      holdSt[1](next);
    }

    var dirty = JSON.stringify(editSt[0]) !== JSON.stringify(saved)
      || JSON.stringify(holdSt[0]) !== JSON.stringify(store.pref('legalHold') || {});
    var holds = records().filter(function (r) { return holdSt[0][r.id]; }).length;

    return h(React.Fragment, null,
      h(Grid, null,
        h(Card, {
          span: 12, title: 'How long each record kind is kept',
          description: 'A period, and what happens when it runs out. A legal hold suspends the schedule '
            + 'for that kind entirely, which is what you reach for when a dispute or an audit is open.',
          aside: dirty
            ? h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.check, onClick: save },
                'Save schedule')
            : h('span', { className: 'muted', style: { fontSize: 12.5 } },
                holds ? holds + ' kinds on legal hold' : 'No unsaved changes')
        },
          h('div', { className: 'dret' }, records().map(function (r) {
            var s = setting(r);
            var held = !!holdSt[0][r.id];
            return h('div', { key: r.id, className: 'dret__r' + (held ? ' is-held' : '') },
              h('div', { className: 'dret__m' },
                h('strong', null, r.label),
                h('span', null, r.note),
                r.statutory ? h('em', null, r.statutory) : null),
              h('div', { className: 'dret__k' },
                h(V.Select, {
                  label: 'Keep for', value: s.keep, options: KEEP, disabled: r.locked || held,
                  onChange: function (v) { set(r, 'keep', v); }
                })),
              h('div', { className: 'dret__e' },
                h(V.Select, {
                  label: 'Then', value: s.onEnd, options: ON_END, disabled: r.locked || held,
                  onChange: function (v) { set(r, 'onEnd', v); }
                })),
              h('div', { className: 'dret__h' },
                h(V.Switch, {
                  checked: held, 'aria-label': 'Legal hold on ' + r.label,
                  onChange: function () { hold(r); }
                }),
                h('span', null, r.locked ? 'Fixed by policy' : 'Legal hold')));
          }))),

        h(Card, {
          span: 12, title: 'Erasure requests',
          description: 'A person outside the organisation sets this clock, so it is a record with a due '
            + 'date rather than a setting. Payroll and audit rows survive an erasure: the statutory '
            + 'period outranks the request, and the screen says so rather than quietly keeping them.'
        }, h(ErasureTable, null))));
  }

  function ErasureTable() {
    var openSt = React.useState(false);
    var rows = store.collection('erasure');

    return h(React.Fragment, null,
      h(ui.DataTable, {
        exportName: 'erasure-requests', label: 'Erasure requests', rows: rows, pageSize: 6,
        search: function (e) { return e.id + ' ' + e.employee + ' ' + e.scope; },
        searchPlaceholder: 'Search by person or scope',
        toolbar: h(V.Button, {
          variant: 'outline', className: 'vi-btn--sm', iconStart: I.plus,
          onClick: function () { openSt[1](true); }
        }, 'Raise a request'),
        columns: [
          { key: 'id', header: 'Request', width: 96, cell: function (e) {
            return h('span', { className: 'mono' }, e.id);
          } },
          { key: 'employee', header: 'Person', cell: function (e) {
            return h(ui.Person, { employee: store.employeeByName(e.employee) || { name: e.employee } });
          } },
          { key: 'scope', header: 'Scope' },
          { key: 'reason', header: 'Why' },
          { key: 'dueOn', header: 'Due', width: 128, cell: function (e) { return ui.dateLabel(e.dueOn); } },
          { key: 'status', header: 'State', width: 150, cell: function (e) {
            return h(ui.StatusChip, { status: e.status });
          } }
        ],
        emptyIcon: I.shield, emptyTitle: 'No erasure requests'
      }),
      openSt[0] ? h(ErasureModal, { onClose: function () { openSt[1](false); } }) : null);
  }

  function ErasureModal(p) {
    var whoSt = React.useState(null);
    var scopeSt = React.useState('all');
    var whySt = React.useState('');

    function raise() {
      if (!whoSt[0]) { ui.toast('Pick whose record this is about', 'error'); return; }
      var who = store.employee(whoSt[0]);
      var due = new Date();
      due.setDate(due.getDate() + 30);
      store.add('erasure', {
        id: store.nextId('erasure', 'ER'),
        employee: who.name,
        raisedOn: new Date().toISOString().slice(0, 10),
        dueOn: due.toISOString().slice(0, 10),
        status: 'Pending Approval',
        scope: scopeSt[0] === 'all' ? 'Everything except payroll and audit' : 'Candidate record only',
        reason: whySt[0] || 'Right to erasure requested.',
        local: true
      });
      store.log('raised an erasure request for ' + who.name, 'Configuration');
      ui.toast('Erasure request raised. It is due in 30 days.', 'success');
      p.onClose();
    }

    return h(ui.Modal, {
      title: 'Raise an erasure request', onClose: p.onClose,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
        h(V.Button, { variant: 'primary', iconStart: I.check, onClick: raise }, 'Raise request'))
    },
      h('div', { className: 'stack gap-3' },
        h(ui.EmployeePicker, {
          label: 'Whose record', value: whoSt[0], includeExited: true,
          hint: 'Exited people are included: most erasure requests arrive after someone has left.',
          onChange: function (v) { whoSt[1](v); }
        }),
        h(V.Select, {
          label: 'Scope', value: scopeSt[0],
          options: [
            { value: 'all', label: 'Everything except payroll and audit' },
            { value: 'candidate', label: 'Candidate record only' }
          ],
          hint: 'Payroll and audit rows are kept for their statutory period whatever the request says.',
          onChange: function (v) { scopeSt[1](v); }
        }),
        h(V.TextArea, {
          label: 'Why', value: whySt[0], rows: 3,
          placeholder: 'What was asked for, and by whom.',
          onChange: function (e) { whySt[1](e.target.value); }
        })));
  }

  /* --------------------------------------------------------------- Screens */

  function wrap(title, description, Body) {
    return function () {
      return h(React.Fragment, null,
        h(PageHead, { eyebrow: 'Data and retention', title: title, description: description }),
        h(Body, null));
    };
  }

  HRMS.screens.register({
    'admin/data/export': wrap('Export',
      'Take a copy of any record kind out of the product. Every export is logged with who asked for it '
      + 'and what it contained.', ExportTab),
    'admin/data/import': wrap('Import',
      'Bring people, structure, balances and history in from another application or a spreadsheet. '
      + 'Nothing is written until a dry run has reported what it would do.', ImportTab),
    'admin/data/retention': wrap('Retention',
      'How long each record kind is kept, what happens at the end of that, and the erasure requests '
      + 'that override it.', RetentionTab)
  });
})();

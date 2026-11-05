/* The joiner's own onboarding: the first thing somebody does with the credentials IT
   issued them.

   HR starts a case, IT makes the account (Users → Joiner setup), and then there was
   nothing: "Document collection" and "Personal information" sat on HR's checklist as
   boxes somebody else ticked on the joiner's behalf. The person those tasks belong to
   had no way to do them.

   This is that way. It opens over the sign-in screen, like the organisation wizard an
   admin meets after signing up, because it is something you do on the way in rather
   than a place you arrive at. Every step writes through the same actions the rest of
   the product uses — editEmployee, uploadDocument, acknowledgePolicy — so what the
   joiner fills in is the record HR then verifies, not a copy of it, and each step
   closes its own task on the onboarding case.

   Who it runs as: the first open onboarding whose credentials have been issued, and
   failing that the first open case at all. Finishing it signs you in as that person,
   so the dashboard you land on is your own. */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var store = HRMS.store, router = HRMS.router, ui = HRMS.ui, act = HRMS.actions, seed = HRMS.seed;
  var useState = React.useState;

  var CHECK = h('svg', { viewBox: '0 0 24 24', width: 14, height: 14, fill: 'none', 'aria-hidden': 'true' },
    h('path', { d: 'M5 13l4 4L19 7', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

  var STEPS = [
    { k: 'Welcome', hint: 'What we have so far' },
    { k: 'About you', hint: 'Contact and emergency' },
    { k: 'Documents', hint: 'Upload and send' },
    { k: 'Bank', hint: 'Where salary goes' },
    { k: 'Policies', hint: 'Read and acknowledge' }
  ];
  var TITLES = ['Welcome to the team', 'A few things about you', 'Your documents',
    'Where your salary goes', 'The policies you are agreeing to'];
  var SUBS = [
    'Your account is live. Five minutes here and everything HR needs before your first day is done.',
    'What is on your record came from your offer. Correct anything that is wrong and fill in what is missing.',
    'Four documents, and the same four your offer letter asked for. HR verifies them after you send them.',
    'The account your salary is paid into. It is checked against your name before the first run.',
    'The ones everybody signs. Open each, then acknowledge — your acknowledgement is dated and kept.'
  ];

  /* The four a joiner is actually asked for, which is the set HR's verification tab
     expects to see. Anything else they want to add can wait for the documents screen. */
  var WANTED = [
    { cat: 'Identity Proof', t: 'Identity proof', s: 'Aadhaar, passport or driving licence', file: 'identity-proof.pdf' },
    { cat: 'Address Proof', t: 'Address proof', s: 'Anything with your current address on it', file: 'address-proof.pdf' },
    { cat: 'Education Certificate', t: 'Highest qualification', s: 'Degree or diploma certificate', file: 'degree-certificate.pdf' },
    { cat: 'Bank Proof', t: 'Bank proof', s: 'A cancelled cheque or a bank letter', file: 'bank-proof.pdf' }
  ];

  /* Whose onboarding this is. Credentials issued first, because that person has been
     told to come here; otherwise the first case still open, so the flow is reachable
     in a browser where nothing has been issued yet. */
  function pickJoiner() {
    var cases = store.collection('onboarding').filter(function (c) { return c.stage !== 'Completed'; });
    var withAccount = cases.filter(function (c) {
      var e = store.employee(c.employee);
      return e && e.workEmail && e.credentialsIssuedOn;
    });
    return (withAccount[0] || cases[0]) || null;
  }

  function Joiner() {
    var Login = HRMS.screens.registry['global/login'];
    var caseRef = React.useRef(null);
    if (!caseRef.current) caseRef.current = pickJoiner();
    var kase = caseRef.current;
    var employee = kase ? store.employee(kase.employee) : null;

    var openSt = useState(true), stepSt = useState(0);
    var doneSt = useState({});
    var sentSt = useState({});
    var ackSt = useState({});
    var step = stepSt[0];

    var form = ui.useForm(employee ? {
      phone: employee.phone || '', dob: employee.dob || '',
      personalEmail: employee.personalEmail || '',
      emergencyName: (employee.emergency || {}).name || '',
      emergencyRelation: (employee.emergency || {}).relation || '',
      emergencyPhone: (employee.emergency || {}).phone || '',
      bankName: (employee.bank || {}).name || '', bankAccount: (employee.bank || {}).account || '',
      bankIfsc: (employee.bank || {}).ifsc || ''
    } : {});

    if (!employee) {
      return h(React.Fragment, null, Login ? h(Login, null) : null);
    }

    var policies = (seed.policies || []).slice(0, 4);

    function close(message) {
      openSt[1](false);
      if (message) ui.toast(message, 'success');
      store.setPref('joinerAs', employee.id);
      store.setPref('role', 'me');
      store.setPref('signedIn', true);
      router.go('me/dashboard');
    }

    function markTask(name) {
      act.completeOnboardingTask(kase.id, name, true);
      doneSt[1](function (prev) {
        var next = Object.assign({}, prev); next[name] = true; return next;
      });
    }

    /* ---- Step bodies ---- */
    function bodyWelcome() {
      var left = (kase.tasks || []).filter(function (t) { return !t.done; }).length;
      return h('div', { className: 'osm__split' },
        h('div', { className: 'osm__col' },
          h('div', { className: 'jn-card' },
            h('span', { className: 'jn-card__h' }, 'Your sign-in details'),
            h('dl', { className: 'jn-kv' },
              h('dt', null, 'Employee ID'), h('dd', { className: 'mono' }, employee.id),
              h('dt', null, 'Work email'), h('dd', null, employee.workEmail || 'Not issued yet'),
              h('dt', null, 'Starts'), h('dd', null, kase.startDateLabel || ui.dateLabel(kase.startDate)),
              h('dt', null, 'Reports to'), h('dd', null, employee.manager
                ? (store.employee(employee.manager) || {}).name || '—' : '—'))),
          h('p', { className: 'muted-s' },
            'These were sent to ' + (employee.personalEmail || 'your personal address')
            + '. Everything below is what HR needs before ' + (kase.startDateLabel || 'your first day')
            + ' — ' + left + ' task' + (left === 1 ? '' : 's') + ' left on your file.')),
        h('aside', { className: 'osm__preview' },
          h('span', { className: 'osm__preview__h' }, 'What happens to this'),
          h('div', { className: 'pv' },
            h('dl', { className: 'pv__kv' },
              h('dt', null, 'Your details'), h('dd', null, 'Go straight onto your record'),
              h('dt', null, 'Documents'), h('dd', null, 'HR verifies each one'),
              h('dt', null, 'Bank'), h('dd', null, 'Checked before the first payroll run'),
              h('dt', null, 'Policies'), h('dd', null, 'Acknowledgement dated and kept'))),
          h('span', { className: 'muted-s' },
            'Nothing here is shared outside HR and your manager.')));
    }

    function bodyAbout() {
      return h('div', { className: 'osm__split' },
        h('div', { className: 'osm__col' },
          h('div', { className: 'grid2' },
            h('div', { className: 'span2' },
              h(V.TextField, Object.assign({ label: 'Personal email', type: 'email' }, form.field('personalEmail')))),
            h('div', null, h(V.TextField, Object.assign({ label: 'Phone' }, form.field('phone')))),
            h('div', null, h(V.DateField, Object.assign({ label: 'Date of birth' }, form.field('dob'))))),
          h('span', { className: 'jn-sub' }, 'Who to reach in an emergency'),
          h('div', { className: 'grid2' },
            h('div', null, h(V.TextField, Object.assign({ label: 'Name' }, form.field('emergencyName')))),
            h('div', null, h(V.TextField, Object.assign({ label: 'Relationship' }, form.field('emergencyRelation')))),
            h('div', { className: 'span2' },
              h(V.TextField, Object.assign({ label: 'Phone' }, form.field('emergencyPhone')))))),
        h('aside', { className: 'osm__preview' },
          h('span', { className: 'osm__preview__h' }, 'From your offer'),
          h('div', { className: 'pv' },
            h('dl', { className: 'pv__kv' },
              h('dt', null, 'Name'), h('dd', null, employee.name),
              h('dt', null, 'Designation'), h('dd', null, employee.designation),
              h('dt', null, 'Department'), h('dd', null, (store.department(employee.department) || {}).name || '—'),
              h('dt', null, 'Location'), h('dd', null, (store.location(employee.location) || {}).name || '—'))),
          h('span', { className: 'muted-s' },
            'Something wrong here? Tell HR rather than changing it — these came from your offer.')));
    }

    function bodyDocs() {
      var sent = sentSt[0];
      return h('div', { className: 'osm__split' },
        h('div', { className: 'osm__col' },
          h('div', { className: 'jn-docs' }, WANTED.map(function (d) {
            var on = !!sent[d.cat];
            return h('div', { className: 'jn-doc' + (on ? ' is-on' : ''), key: d.cat },
              h('span', { className: 'jn-doc__i' }, on ? CHECK : I.file),
              h('span', { className: 'jn-doc__m' },
                h('strong', null, d.t),
                h('span', null, on ? 'Sent · waiting on HR to verify' : d.s)),
              on
                ? h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: 'success' }, 'Sent')
                : h('label', { className: 'jn-doc__up' },
                    h('input', {
                      type: 'file', style: { display: 'none' },
                      onChange: function (e) {
                        var f = (e.target.files || [])[0];
                        upload(d, f ? f.name : d.file, f ? f.size : null);
                        e.target.value = '';
                      }
                    }),
                    h('span', { className: 'vi-btn vi-btn--outline vi-btn--sm', role: 'button', tabIndex: 0 },
                      h('span', { className: 'vi-btn__label' }, 'Choose file'))));
          })),
          h('div', { className: 'row gap-2' },
            h(V.Button, {
              variant: 'ghost', className: 'vi-btn--sm',
              onClick: function () { WANTED.forEach(function (d) { if (!sent[d.cat]) upload(d, d.file, null); }); }
            }, 'Use sample files'))),
        h('aside', { className: 'osm__preview' },
          h('span', { className: 'osm__preview__h' }, 'Why these four' ),
          h('div', { className: 'pv' },
            h('dl', { className: 'pv__kv' },
              h('dt', null, 'Identity'), h('dd', null, 'Statutory, for payroll registration'),
              h('dt', null, 'Address'), h('dd', null, 'Your record and any courier to you'),
              h('dt', null, 'Qualification'), h('dd', null, 'Confirms the offer’s basis'),
              h('dt', null, 'Bank'), h('dd', null, 'Matched against the account on the next step'))),
          h('span', { className: 'muted-s' },
            'HR sees each one on their verification tab and either accepts it or asks again.')));
    }

    function upload(d, fileName, bytes) {
      var res = act.uploadDocument(employee.id, {
        title: d.t, category: d.cat, name: fileName,
        size: bytes ? Math.round(bytes / 1024) + ' KB' : '— KB'
      });
      /* The updater form, because "use sample files" uploads four in one pass and a
         copy taken from the current value would have been built from the same stale
         state four times — three of the four would have vanished. */
      if (res && res.ok) {
        sentSt[1](function (prev) {
          var next = Object.assign({}, prev); next[d.cat] = true; return next;
        });
      } else { ui.report(res); }
    }

    function bodyBank() {
      return h('div', { className: 'osm__split' },
        h('div', { className: 'osm__col' },
          h('div', { className: 'grid2' },
            h('div', { className: 'span2' },
              h(V.TextField, Object.assign({ label: 'Bank name' }, form.field('bankName')))),
            h('div', null, h(V.TextField, Object.assign({ label: 'Account number' }, form.field('bankAccount')))),
            h('div', null, h(V.TextField, Object.assign({ label: 'IFSC' }, form.field('bankIfsc'))))),
          h('p', { className: 'muted-s' },
            'Changing this later goes to HR for approval, because it decides where money lands.')),
        h('aside', { className: 'osm__preview' },
          h('span', { className: 'osm__preview__h' }, 'First payroll' ),
          h('div', { className: 'pv' },
            h('dl', { className: 'pv__kv' },
              h('dt', null, 'Your start'), h('dd', null, kase.startDateLabel || ui.dateLabel(kase.startDate)),
              h('dt', null, 'Account name'), h('dd', null, 'Must match ' + employee.name),
              h('dt', null, 'Proof'), h('dd', null, sentSt[0]['Bank Proof'] ? 'Sent' : 'Upload it on the previous step'))),
          h('span', { className: 'muted-s' },
            'Payroll checks the name on the account against your record before it pays anybody.')));
    }

    function bodyPolicies() {
      var acked = ackSt[0];
      return h('div', { className: 'osm__split' },
        h('div', { className: 'osm__col' },
          h('div', { className: 'jn-docs' }, policies.map(function (pol) {
            var on = !!acked[pol.id];
            return h('label', { className: 'jn-doc' + (on ? ' is-on' : ''), key: pol.id },
              h('span', { className: 'jn-doc__i' }, on ? CHECK : I.file),
              h('span', { className: 'jn-doc__m' },
                h('strong', null, pol.title),
                h('span', null, (pol.category || 'Policy') + (pol.version ? ' · ' + pol.version : ''))),
              h(V.Switch, {
                checked: on, 'aria-label': 'Acknowledge ' + pol.title,
                onChange: function () {
                  ackSt[1](function (prev) {
                    var next = Object.assign({}, prev); next[pol.id] = !prev[pol.id]; return next;
                  });
                }
              }));
          }))),
        h('aside', { className: 'osm__preview' },
          h('span', { className: 'osm__preview__h' }, 'What acknowledging means'),
          h('div', { className: 'pv' },
            h('dl', { className: 'pv__kv' },
              h('dt', null, 'Recorded'), h('dd', null, 'Against your name, with today’s date'),
              h('dt', null, 'Visible to'), h('dd', null, 'You and HR'),
              h('dt', null, 'If one changes'), h('dd', null, 'You are asked again'))),
          h('span', { className: 'muted-s' },
            'You can reread any of them from Documents & policies whenever you like.')));
    }

    var BODIES = [bodyWelcome, bodyAbout, bodyDocs, bodyBank, bodyPolicies];

    /* ---- Moving between steps, saving as it goes ---- */
    function saveAbout() {
      var v = form.values;
      ui.report(act.editEmployee(employee.id, {
        phone: v.phone, dob: v.dob, personalEmail: v.personalEmail,
        emergency: { name: v.emergencyName, relation: v.emergencyRelation, phone: v.emergencyPhone }
      }));
      markTask('Personal information');
      stepSt[1](2);
    }
    function saveBank() {
      var v = form.values;
      ui.report(act.editEmployee(employee.id, {
        bank: { name: v.bankName, account: v.bankAccount, ifsc: v.bankIfsc }
      }));
      markTask('Payroll enrolment');
      stepSt[1](4);
    }
    function finishAll() {
      markTask('Policy acknowledgement');
      close('Welcome aboard, ' + employee.name.split(' ')[0] + '. HR has everything they asked for.');
    }

    function footer() {
      var back = step
        ? h(V.Button, { key: 'b', variant: 'ghost', iconStart: I.back, onClick: function () { stepSt[1](step - 1); } }, 'Back')
        : h('span', { className: 'osm__note', key: 'b' }, 'Signed in as ' + (employee.workEmail || employee.id));

      if (step === 0) {
        return [back, h('span', { className: 'osm__foot__r', key: 'r' },
          h(V.Button, { iconEnd: I.arrow, onClick: function () { stepSt[1](1); } }, 'Start'))];
      }
      if (step === 1) {
        return [back, h('span', { className: 'osm__foot__r', key: 'r' },
          h(V.Button, { iconEnd: I.arrow, onClick: saveAbout }, 'Save and continue'))];
      }
      if (step === 2) {
        var sent = Object.keys(sentSt[0]).length;
        return [back, h('span', { className: 'osm__foot__r', key: 'r' },
          h('span', { className: 'osm__note' }, sent + ' of ' + WANTED.length + ' sent'),
          h(V.Button, {
            iconEnd: I.arrow, disabled: sent < WANTED.length,
            onClick: function () { markTask('Document collection'); stepSt[1](3); }
          }, 'Continue'))];
      }
      if (step === 3) {
        return [back, h('span', { className: 'osm__foot__r', key: 'r' },
          h(V.Button, { iconEnd: I.arrow, onClick: saveBank }, 'Save and continue'))];
      }
      var allAcked = policies.every(function (pol) { return ackSt[0][pol.id]; });
      return [back, h('span', { className: 'osm__foot__r', key: 'r' },
        h(V.Button, { iconStart: CHECK, disabled: !allAcked, onClick: finishAll }, 'Finish'))];
    }

    var leftOnFile = (store.find('onboarding', kase.id) || kase).tasks || [];
    var remaining = leftOnFile.filter(function (t) { return !t.done; }).length;

    return h(React.Fragment, null,
      Login ? h(Login, null) : null,

      openSt[0] ? h('div', { className: 'osm__scrim' },
        h('div', { className: 'osm', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Your onboarding' },
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
              h('span', { className: 'osm__sum__h' }, I.person, employee.name),
              h('dl', null,
                h('dt', null, 'Employee ID'), h('dd', null, employee.id),
                h('dt', null, 'Starts'), h('dd', null, kase.startDateLabel || ui.dateLabel(kase.startDate)),
                h('dt', null, 'Left on file'), h('dd', null, remaining)))),

          h('div', { className: 'osm__main' },
            h('div', { className: 'osm__head' },
              h('span', { className: 'osm__head__t' },
                h('span', { className: 'osm__count' }, 'Step ' + (step + 1) + ' of ' + STEPS.length),
                h('h2', null, TITLES[step]),
                h('p', null, SUBS[step])),
              h(V.IconButton, {
                icon: I.close, 'aria-label': 'Finish later',
                onClick: function () { close('Picked up where you left off next time you sign in.'); }
              })),
            h('div', { className: 'osm__progress' },
              h('i', { style: { width: ((step + 1) / STEPS.length * 100) + '%' } })),
            h('div', { className: 'osm__body' }, BODIES[step]()),
            h('div', { className: 'osm__foot' }, footer())))) : null);
  }

  HRMS.screens.register({ 'global/joiner': Joiner });
})();

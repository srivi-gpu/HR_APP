/* Raising an asset request, from inside the asset portal.

   Until now a request could only arrive from Tracklivo, which left the portal able to
   show work and never to ask for any: an employee whose laptop had died had to leave
   the product to say so. This is the one form that fixes that, shared by the three
   places it belongs — an employee's own requests, HR's queue for joiners, and the
   admin register — because the thing being asked for is the same in all three and only
   the person asking differs.

   What it is not is an approval. The decision stays Tracklivo's, so a request raised
   here leaves in exactly the state a Tracklivo one arrives in; the register marks where
   it came from and nothing else changes. */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var ui = HRMS.ui, store = HRMS.store, seed = HRMS.seed, act = HRMS.actions;

  /* Who may ask for what. An employee asks for themselves; HR and admin also raise a
     joiner's kit, which is the one request made on somebody else's behalf. */
  var KINDS = [
    { k: 'New asset', icon: 'package', t: 'New asset', s: 'Something you do not have yet', roles: ['me', 'hr', 'admin'] },
    { k: 'Repair', icon: 'bug', t: 'Repair', s: 'Something you hold has a fault', roles: ['me', 'hr', 'admin'] },
    { k: 'Onboarding', icon: 'users', t: 'Onboarding kit', s: 'What a joiner needs for day one', roles: ['hr', 'admin'] }
  ];
  function kindsFor(role) {
    return KINDS.filter(function (x) { return x.roles.indexOf(role) > -1; });
  }

  function AssetRequestModal(p) {
    var role = p.role || 'me';
    var kinds = kindsFor(role);
    var form = ui.useForm({ kind: p.kind || kinds[0].k, category: '', reason: '', asset: '', employee: '', neededBy: '' });
    var kind = form.values.kind;

    /* Repairs are raised against something the person actually holds, so the picker is
       their own register rather than every unit in the company. */
    var mine = store.collection('assets').filter(function (a) {
      return a.assignedTo === p.employee && a.status === 'Assigned';
    });
    /* A joiner's kit is asked for before they start, so the list is the people whose
       onboarding is still open. */
    var joiners = store.collection('onboarding')
      .filter(function (o) { return o.stage !== 'Completed'; })
      .map(function (o) { return store.employee(o.employee); })
      .filter(Boolean);

    function save() {
      var res = form.submit(function (v) { return ui.report(act.raiseAssetRequest(p.employee, v)); });
      if (res && res.ok) p.onClose(res);
    }

    var chosen = kinds.filter(function (x) { return x.k === kind; })[0] || kinds[0];

    return h(ui.Modal, {
      title: 'Raise an asset request',
      description: 'Raised here, decided in Tracklivo. IT is told as soon as you send it.',
      onClose: p.onClose, wide: true,
      footer: h(React.Fragment, null,
        h('span', { className: 'muted grow' }, 'Nothing is issued until Tracklivo clears it.'),
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Cancel'),
        h(V.Button, { variant: 'primary', iconStart: I.plus, onClick: save }, 'Send request'))
    },
      /* What kind of request, as cards rather than a dropdown: there are three, and
         which one you want is the first thing you know. */
      kinds.length > 1 ? h('div', { className: 'arq-kinds' }, kinds.map(function (x) {
        return h('button', {
          key: x.k, type: 'button', className: 'arq-kind' + (kind === x.k ? ' is-on' : ''),
          'aria-pressed': kind === x.k ? 'true' : 'false',
          onClick: function () { form.set('kind', x.k); }
        },
          h('span', { className: 'arq-kind__i' }, I[x.icon] || I.package),
          h('span', { className: 'arq-kind__m' }, h('strong', null, x.t), h('span', null, x.s)));
      })) : null,

      kind === 'Onboarding'
        ? h(V.Select, Object.assign({
            label: 'Who it is for', required: true, placeholder: 'Pick a joiner',
            options: joiners.map(function (e) { return { value: e.id, label: e.name + ' · ' + e.designation }; })
          }, form.select('employee')))
        : null,

      kind === 'Repair'
        ? (mine.length
            ? h(V.Select, Object.assign({
                label: 'Which asset', required: true, placeholder: 'Pick one you hold',
                options: mine.map(function (a) { return { value: a.id, label: a.name + ' · ' + a.serial }; })
              }, form.select('asset')))
            : h(ui.Empty, { icon: I.package, title: 'Nothing is issued to you',
                body: 'A repair is raised against a unit you hold. Ask for a new asset instead.' }))
        : null,

      kind !== 'Repair'
        ? h(V.Select, Object.assign({
            label: 'Asset category', required: true, placeholder: 'Pick a category',
            options: seed.assetCategories.map(function (c) { return { value: c, label: c }; })
          }, form.select('category')))
        : null,

      kind === 'Onboarding'
        ? h(V.DateField, Object.assign({ label: 'Needed by' }, form.field('neededBy')))
        : null,

      h(V.TextArea, Object.assign({
        label: kind === 'Repair' ? 'What is wrong' : 'Reason', required: true, rows: 3,
        placeholder: kind === 'Repair' ? 'What it does, and since when'
          : kind === 'Onboarding' ? 'What the role needs it for'
            : 'Why you need it'
      }, form.field('reason'))),

      h('p', { className: 'arq-note' }, I.info,
        h('span', null, chosen.k === 'Onboarding'
          ? 'IT sees it on the register straight away, and the joiner is told it was asked for.'
          : 'IT sees it on the register straight away. You can follow it under Requests.')),

      form.errors._ ? h('p', { style: { color: 'var(--danger-fg)', fontSize: 13 } }, form.errors._) : null);
  }

  /* The button that opens it, so every screen offers the same way in. */
  function RaiseButton(p) {
    var openSt = React.useState(false);
    return h(React.Fragment, null,
      h(V.Button, { variant: p.variant || 'primary', className: p.className, iconStart: I.plus,
        onClick: function () { openSt[1](true); } }, p.label || 'Raise a request'),
      openSt[0] ? h(AssetRequestModal, {
        role: p.role, employee: p.employee, kind: p.kind,
        onClose: function () { openSt[1](false); }
      }) : null);
  }

  HRMS.assetRequest = { Modal: AssetRequestModal, Button: RaiseButton, kindsFor: kindsFor };
})();

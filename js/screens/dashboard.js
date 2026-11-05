/* The admin dashboard, built to the reference layout in the product's own palette.

   The brief attached a dashboard — a KPI strip across the top on one card, a tall
   illustrated card, a square card, a wide chart, a table and an alerts column — and this
   keeps that geometry: four KPIs on a single card split by hairline rules, dark circular
   icons, a grey header band on the table, bordered status pills, blurred ellipses behind
   everything. The colour is the Tracklivo tokens', not the reference's lime and pink,
   because a page in colours the rest of the app never uses reads as another product.

   What each card holds is the admin's job, which is accounts and access:

   - the first card has two tabs: MFA coverage by role, privileged roles first, because
     an account that can change everyone else's is the one a password alone protects
     worst; and the plan, seats and AI credits against what is paid for;
   - the wide card is how recently people actually sign in, with Ara's suggestions read
     off the same records and pinned to the bar they are about;
   - the bottom row is charts: the access work queued against the admin as a donut by
     kind (leavers to revoke, invites nobody accepted, suspensions, privileged accounts
     without MFA), and the asset requests Tracklivo has sent, stacked by status.

   Every count is read from the store. The one fixed panel is the backup line in the
   alerts, because nothing in the prototype records a backup. */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var store = HRMS.store, router = HRMS.router, ui = HRMS.ui, seed = HRMS.seed;

  function deptName(id) { var d = store.department(id); return d ? d.name : '\u2014'; }
  function locName(id) { var l = store.location(id); return l ? l.name : '\u2014'; }

  /* ---------- glyphs the Tracklivo set does not carry ---------- */
  function g(d, s) {
    return h('svg', { viewBox: '0 0 24 24', width: s || 20, height: s || 20, fill: 'none', 'aria-hidden': 'true' },
      h('path', { d: d, stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }));
  }
  var CHECK = g('M5 13l4 4L19 7', 15);
  var XMARK = g('M6 6l12 12M18 6L6 18', 18);
  var WIFI = g('M2 8.5a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16.5a5 5 0 0 1 6 0M12 20h.01');
  var KEY = g('M14.5 9.5a4 4 0 1 1-1.2-2.9M14.5 9.5L21 16v3h-3v-2h-2v-2h-2l-1.3-1.3', 18);
  var ARA = h('svg', { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', 'aria-hidden': 'true' },
    h('path', { d: 'M12 3.2l1.9 4.7 4.9 1.8-4.9 1.8L12 16.2l-1.9-4.7-4.9-1.8 4.9-1.8L12 3.2Z', fill: 'currentColor' }),
    h('circle', { cx: 18.4, cy: 17.6, r: 2.1, fill: 'currentColor', opacity: .85 }),
    h('circle', { cx: 6.2, cy: 18.4, r: 1.3, fill: 'currentColor', opacity: .6 }));

  var num = function (n) { return Number(n || 0).toLocaleString('en-IN'); };
  function plural(n, one, many) { return num(n) + ' ' + (n === 1 ? one : (many || one + 's')); }
  function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 864e5); }
  function nameOf(id) { var e = store.employee(id); return e ? e.name : id; }
  function deptOf(id) {
    var e = store.employee(id), d = e && store.department(e.department);
    return d ? d.name : '—';
  }
  var ROLE_NAME = { admin: 'Organization Admin', hr: 'HR Administrator', manager: 'Manager', me: 'Employee' };

  /* ---------- the four KPIs ----------
     Each names the action it is about, so the arrow on the card opens the same modal
     Ara's own suggestions open. A KPI whose action has nothing left to do shows no
     arrow rather than an arrow that leads to an empty list. */
  function kpis(s, users) {
    var running = store.collection('onboarding').filter(function (o) { return o.stage !== 'Completed'; }).length;
    var sub = seed.subscription;
    return [
      { k: 'quiet', t: 'Active accounts', s: 'Of ' + num(users.length) + ' on the directory',
        n: users.filter(function (u) { return u.status === 'Active'; }).length },
      { k: 'nudge', t: 'Without MFA', s: 'Password-only sign-in',
        n: users.filter(function (u) { return !u.mfa; }).length },
      { k: 'onboarding', t: 'Open onboarding tasks', s: 'Across ' + running + ' people joining', n: s.pendingOnboardingTasks },
      { k: 'leaving', t: 'Seats in use', s: 'Of ' + sub.seats + ' on ' + sub.plan,
        n: Math.round(sub.seatsUsed / sub.seats * 100), unit: '%' }
    ];
  }

  /* ====================================================== privileged access
     The people whose account can change everyone else's. On most days this is the
     single most important list an admin owns, and it is short enough to show whole. */
  function privileged(users) {
    return users.filter(function (u) { return u.role === 'admin' || u.role === 'hr'; })
      .sort(function (a, b) { return (a.mfa === b.mfa ? 0 : a.mfa ? 1 : -1) || (a.role === 'admin' ? -1 : 1); });
  }

  /* ====================================================== sign-in activity
     When each account last signed in, bucketed. Read off `lastSignIn` on every user. */
  var BUCKETS = [
    { k: 'today', t: 'Last day', test: function (d) { return d !== null && d <= 1; } },
    { k: 'week', t: '2–7 days', test: function (d) { return d !== null && d > 1 && d <= 7; } },
    { k: 'month', t: '8–30 days', test: function (d) { return d !== null && d > 7 && d <= 30; } },
    { k: 'dormant', t: '30+ days', test: function (d) { return d !== null && d > 30; } },
    { k: 'never', t: 'Never', test: function (d) { return d === null; } }
  ];
  function signins(users) {
    return BUCKETS.map(function (b) {
      var who = users.filter(function (u) {
        return b.test(u.lastSignIn ? daysBetween(u.lastSignIn, seed.todayIso) : null);
      });
      return { k: b.k, t: b.t, n: who.length, who: who };
    });
  }

  /* ====================================================== Ara's suggestions
     Each one is a rule over the records, with the arithmetic that fired it kept beside
     it so the modal can show its working. Nothing here is a model: a suggestion only
     appears when its rule holds, and says exactly which records made it hold. */
  /* Each suggestion also carries the action that settles it: the records it would act
     on, what the button says, and how to apply and undo it. Applying writes real record
     fields through the store — `mfaRequired`, `resentOn`, `revokeScheduled`,
     `remindedOn` — and logs the change to the audit trail, and every rule below leaves
     out the records already acted on, so a suggestion shrinks or goes once it is dealt
     with. Requiring MFA does not enrol anyone: the KPI for accounts without MFA still
     counts them until they set it up, because that is still true. */
  function suggestions(users, buckets, queue) {
    var out = [], today = seed.todayIso, act = HRMS.actions;
    var priv = privileged(users);
    var privNoMfa = priv.filter(function (u) { return !u.mfa && !u.mfaRequired; });
    var noMfa = users.filter(function (u) { return !u.mfa && !u.mfaNudgedOn; });
    var never = users.filter(function (u) { return !u.lastSignIn && u.resentOn !== today; });
    var quiet = users.filter(function (u) {
      return u.lastSignIn && daysBetween(u.lastSignIn, today) > 7 && !u.remindedOn;
    });
    var leaving = queue.filter(function (r) { return r.kind === 'revoke' && !r.scheduled; });

    /* Open onboarding tasks, gathered by who owns them: one nudge per owner, not one
       per task, because a person with six of them wants one message about six. */
    var owners = {};
    store.collection('onboarding').forEach(function (o) {
      if (o.stage === 'Completed' || o.nudgedOn === today) return;
      (o.tasks || []).filter(function (t) { return !t.done; }).forEach(function (t) {
        var e = owners[t.assignee] || (owners[t.assignee] = { id: t.assignee, n: 0, who: {} });
        e.n++; e.who[o.employee] = true;
      });
    });
    var ownerRows = Object.keys(owners).map(function (id) { return owners[id]; })
      .sort(function (x, y) { return y.n - x.n; });
    var openTasks = ownerRows.reduce(function (n, r) { return n + r.n; }, 0);

    function userTargets(list, sub) {
      return list.map(function (u) { return { id: u.id, emp: u.employee, t: nameOf(u.employee), s: sub(u) }; });
    }
    function setUsers(field, value) {
      return function (ids) { ids.forEach(function (id) { var o = {}; o[field] = value; store.setOverride('users', id, o); }); };
    }
    /* The people behind the chosen rows, for the notification each action sends. */
    function empsOf(targets, ids) {
      return targets.filter(function (t) { return ids.indexOf(t.id) > -1; })
        .map(function (t) { return t.emp; }).filter(Boolean);
    }

    if (privNoMfa.length) {
      var privT = userTargets(privNoMfa, function (u) { return ROLE_NAME[u.role]; });
      out.push({
        k: 'priv', bucket: null, icon: I.shield, tone: 'bad', impact: 'High impact',
        t: 'Require MFA for the ' + plural(privNoMfa.length, 'privileged account') + ' without it',
        s: privNoMfa.length + ' of the ' + priv.length + ' people with admin or HR rights sign in with a password alone. ' +
          'Requiring it for those two roles first protects the accounts that can change everyone else’s, without ' +
          'asking all ' + num(users.length) + ' people to set it up on the same day.',
        targets: privT,
        verb: function (n) { return 'Require MFA for ' + plural(n, 'account'); },
        run: function (ids) {
          setUsers('mfaRequired', true)(ids);
          act.notifyEach(empsOf(privT, ids), function () {
            return { kind: 'Security', roles: ['me', 'hr', 'admin'], route: 'me/profile',
              title: 'Set up two-factor sign-in', body: 'Your role can change other people’s accounts, so MFA is now required on it.' };
          });
        },
        undo: setUsers('mfaRequired', false),
        done: function (n) { return 'MFA is now required for ' + plural(n, 'account') + ', and each person has been told.'; },
        log: function (n) { return 'required MFA for ' + plural(n, 'privileged account'); }, cat: 'Security',
        a: 'Open security settings', to: 'admin/settings'
      });
    }
    if (never.length) {
      var nvT = userTargets(never, function (u) { return 'Invited ' + ui.dateLabel(u.invitedOn); });
      out.push({
        k: 'never', bucket: 'never', icon: I.mail, tone: 'warn', impact: 'Blocking',
        t: plural(never.length, 'invitation') + ' never accepted',
        s: 'These accounts were invited and have never signed in. ' +
          never.map(function (u) { return nameOf(u.employee); }).join(' and ') +
          (never.length === 1 ? ' was' : ' were') + ' invited on ' + ui.dateLabel(never[0].invitedOn) +
          ' and ' + (never.length === 1 ? 'is' : 'are') + ' already past their start date, so the invite has probably gone to spam.',
        targets: nvT,
        verb: function (n) { return 'Resend ' + plural(n, 'invitation'); },
        run: function (ids) {
          setUsers('resentOn', today)(ids);
          act.notifyEach(empsOf(nvT, ids), function () {
            return { kind: 'Invitation', roles: ['me'], route: 'me/dashboard',
              title: 'Your invitation has been resent', body: 'Activate your account to pick up your onboarding tasks.' };
          });
        },
        undo: setUsers('resentOn', null),
        done: function (n) { return plural(n, 'invitation') + ' resent, from the same sender address.'; },
        log: function (n) { return 'resent ' + plural(n, 'invitation'); }, cat: 'User activity',
        a: 'Open users', to: 'admin/users/all'
      });
    }
    if (leaving.length) {
      out.push({
        k: 'leaving', bucket: null, icon: I.logout, tone: 'warn', impact: 'Frees seats',
        t: 'Close access for ' + plural(leaving.length, 'leaver') + ' on their last day',
        s: 'Every one of them is on notice with their access still open. Scheduling it now means nobody has to ' +
          'remember on the day — the earliest is ' + ui.dateLabel(leaving[0].due) + ' — and each seat returns ' +
          'to the plan as they go.',
        targets: leaving.map(function (r) { return { id: r.id, emp: r.emp, t: r.who, s: 'Last day ' + ui.dateLabel(r.due) }; }),
        verb: function (n) { return 'Schedule ' + plural(n, 'account') + ' to close'; },
        run: function (ids) {
          ids.forEach(function (id) {
            var o = store.find('offboarding', id);
            if (o) {
              store.setOverride('offboarding', id, { revokeScheduled: o.lastWorkingDay });
              act.notify({ to: o.employee, kind: 'Offboarding', roles: ['me'], route: 'me/exit/formalities',
                title: 'Your access closes on your last working day',
                body: 'Save anything personal before ' + ui.dateLabel(o.lastWorkingDay) + '.' });
            }
          });
        },
        undo: function (ids) { ids.forEach(function (id) { store.setOverride('offboarding', id, { revokeScheduled: null }); }); },
        done: function (n) { return plural(n, 'account') + ' will close at the end of each last working day, freeing ' +
          plural(n, 'seat') + ' on the plan.'; },
        log: function (n) { return 'scheduled access removal for ' + plural(n, 'leaver'); }, cat: 'Security',
        a: 'Open access review', to: 'admin/roles/review'
      });
    }
    if (noMfa.length) {
      var ndT = userTargets(noMfa, function (u) { return ROLE_NAME[u.role] + ' · ' + deptOf(u.employee); });
      out.push({
        k: 'nudge', bucket: null, icon: KEY, tone: 'info', impact: 'Reaches people',
        t: 'Nudge the ' + plural(noMfa.length, 'account') + ' still signing in on a password',
        s: Math.round(noMfa.length / (users.length || 1) * 100) + '% of the directory has no second factor. A nudge puts ' +
          'the setup link in front of each of them without forcing anyone out of their session — the people who act ' +
          'on it are the ones you no longer have to require it of.',
        targets: ndT,
        verb: function (n) { return 'Send ' + plural(n, 'nudge'); },
        run: function (ids) {
          setUsers('mfaNudgedOn', today)(ids);
          act.notifyEach(empsOf(ndT, ids), function () {
            return { kind: 'Security', roles: ['me', 'hr', 'admin'], route: 'me/profile',
              title: 'Add two-factor sign-in to your account', body: 'It takes a minute and protects your pay and personal details.' };
          });
        },
        undo: setUsers('mfaNudgedOn', null),
        done: function (n) { return plural(n, 'nudge') + ' sent. Each lands in their notifications with the setup link.'; },
        log: function (n) { return 'sent ' + plural(n, 'MFA nudge'); }, cat: 'Security',
        a: 'Open security settings', to: 'admin/settings'
      });
    }
    if (ownerRows.length) {
      out.push({
        k: 'onboarding', bucket: null, icon: I.checklist, tone: 'info', impact: 'Unblocks joiners',
        t: 'Nudge the owners of ' + plural(openTasks, 'open onboarding task'),
        s: plural(openTasks, 'task') + ' across ' + plural(store.collection('onboarding').filter(function (o) { return o.stage !== 'Completed'; }).length, 'joiner') +
          ' are still open, and every one of them is somebody’s to do. A nudge tells each owner what is theirs and ' +
          'whose first week it is holding up.',
        targets: ownerRows.map(function (r) {
          return { id: r.id, emp: r.id, t: nameOf(r.id),
            s: plural(r.n, 'task') + ' · ' + plural(Object.keys(r.who).length, 'joiner') };
        }),
        verb: function (n) { return 'Nudge ' + plural(n, 'owner'); },
        run: function (ids) {
          store.collection('onboarding').forEach(function (o) {
            if (o.stage === 'Completed') return;
            var mine = (o.tasks || []).filter(function (t) { return !t.done && ids.indexOf(t.assignee) > -1; });
            if (mine.length) store.setOverride('onboarding', o.id, { nudgedOn: today });
          });
          ids.forEach(function (id) {
            var r = owners[id];
            if (!r) return;
            act.notify({ to: id, kind: 'Onboarding Reminder', roles: ['me', 'hr', 'admin'], route: 'hr/onboarding/tasks',
              title: plural(r.n, 'onboarding task') + ' waiting on you',
              body: 'Across ' + plural(Object.keys(r.who).length, 'joiner') + ' who have already started.' });
          });
        },
        undo: function () {
          store.collection('onboarding').forEach(function (o) {
            if (o.nudgedOn === today) store.setOverride('onboarding', o.id, { nudgedOn: null });
          });
        },
        done: function (n) { return plural(n, 'owner') + ' told what is theirs, with the joiners it is holding up.'; },
        log: function (n) { return 'nudged ' + plural(n, 'onboarding task owner'); }, cat: 'User activity',
        a: 'Open onboarding', to: 'hr/onboarding/cases'
      });
    }
    if (quiet.length) {
      var qT = userTargets(quiet, function (u) { return daysBetween(u.lastSignIn, today) + ' days since sign-in'; });
      out.push({
        k: 'quiet', bucket: 'month', icon: I.clock, tone: 'info', impact: 'Worth a look',
        t: plural(quiet.length, 'account') + ' quiet for over a week',
        s: 'Nobody here has signed in for eight days or more. Most will be leave or travel, which is why this is a ' +
          'reminder rather than a suspension — but an account nobody is using is also one nobody would notice being used.',
        targets: qT,
        verb: function (n) { return 'Send ' + plural(n, 'sign-in reminder'); },
        run: function (ids) {
          setUsers('remindedOn', today)(ids);
          act.notifyEach(empsOf(qT, ids), function () {
            return { kind: 'Security', roles: ['me', 'hr', 'admin'], route: 'me/dashboard',
              title: 'We have not seen you in a while', body: 'Sign in when you are back so your account stays active.' };
          });
        },
        undo: setUsers('remindedOn', null),
        done: function (n) { return plural(n, 'reminder') + ' sent. Anyone still quiet in a week shows up in access review.'; },
        log: function (n) { return 'sent ' + plural(n, 'sign-in reminder'); }, cat: 'User activity',
        a: 'Open access review', to: 'admin/roles/review'
      });
    }
    var gone = store.pref('araDismissed') || [];
    return out.filter(function (x) { return gone.indexOf(x.k) < 0; });
  }

  var TONE_CLASS = { bad: 'is-bad', warn: 'is-warn', info: 'is-info' };

  /* The sign-in chart. A bar Ara has something to say about carries a marker at its
     head, and the marker opens that suggestion. */
  function SigninChart(p) {
    var b = p.buckets, max = Math.max.apply(null, b.map(function (x) { return x.n; }).concat([1]));
    var W = 640, H = 196, PL = 34, PR = 8, PT = 40, PB = 22;
    var band = (W - PL - PR) / b.length, bw = Math.min(64, band * 0.56);
    function x(i) { return PL + band * i + band / 2; }
    function y(v) { return PT + (1 - v / max) * (H - PT - PB); }
    var step = max > 100 ? 50 : max > 40 ? 20 : max > 10 ? 5 : 2;
    var ticks = [];
    for (var t = 0; t <= max; t += step) ticks.push(t);

    return h('div', { className: 'adm-plot' },
      h('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
        'aria-label': 'Accounts by last sign-in: ' + b.map(function (x) { return x.t + ' ' + x.n; }).join(', ') },
        h('defs', null, h('linearGradient', { id: 'admBar', x1: 0, y1: 0, x2: 0, y2: 1 },
          h('stop', { offset: 0, stopColor: 'var(--brand-solid)' }),
          h('stop', { offset: 1, stopColor: 'var(--brand-solid)', stopOpacity: .35 }))),
        ticks.map(function (t) {
          return h('g', { key: t },
            h('line', { x1: PL, x2: W - PR, y1: y(t), y2: y(t), stroke: 'var(--border-subtle)' }),
            h('text', { x: PL - 8, y: y(t) + 4, textAnchor: 'end', className: 'adm-plot__ax' }, t));
        }),
        b.map(function (s, i) {
          var flagged = p.flags[s.k];
          return h('g', { key: s.k },
            h('rect', { x: x(i) - bw / 2, y: y(s.n), width: bw, height: Math.max(2, y(0) - y(s.n)), rx: 7,
              fill: flagged ? 'var(--warning-fg)' : 'url(#admBar)', opacity: flagged ? .85 : 1 }),
            h('text', { x: x(i), y: y(s.n) - 8, textAnchor: 'middle', className: 'adm-plot__v' }, s.n),
            h('text', { x: x(i), y: H - 6, textAnchor: 'middle', className: 'adm-plot__ax' }, s.t));
        })),
      b.map(function (s, i) {
        var f = p.flags[s.k];
        if (!f) return null;
        return h('button', {
          key: s.k, type: 'button', className: 'adm-pin',
          title: 'Ara on ' + s.t, 'aria-label': 'What Ara suggests about ' + s.t,
          style: { left: (x(i) / W * 100) + '%', top: ((y(s.n) - 34) / H * 100) + '%' },
          onClick: function () { p.onOpen(f); }
        }, ARA);
      }));
  }

  /* A suggestion, opened, and acted on in place. The reasoning first, then exactly
     which records Ara will touch — each one can be left out — then the action. Once it
     runs the modal says what changed, that it is in the audit trail, and offers undo;
     the suggestion itself recomputes from the records, so it shrinks or disappears. */
  function SuggestionModal(p) {
    var x = p.item;
    var pickSt = React.useState(x.targets.map(function (t) { return t.id; }));
    var doneSt = React.useState(null);
    var allSt = React.useState(false);
    var picked = pickSt[0];
    /* A rule can reach a hundred and fifty people. Show a handful, and open the rest
       on request: a wall of checkboxes is not a review, it is a scroll. */
    var CAP = 8;
    var shown = allSt[0] ? x.targets : x.targets.slice(0, CAP);
    var n = x.targets.length ? picked.length : 1;

    function toggle(id) {
      pickSt[1](picked.indexOf(id) > -1 ? picked.filter(function (v) { return v !== id; }) : picked.concat([id]));
    }
    function apply() {
      var ids = picked.slice();
      x.run(ids);
      store.log(x.log(ids.length || 1), x.cat);
      doneSt[1]({ ids: ids, n: ids.length || 1 });
    }
    function undo() {
      x.undo(doneSt[0].ids);
      store.log('undid: ' + x.log(doneSt[0].n), x.cat);
      ui.toast('Undone.');
      p.onClose();
    }
    function dismiss() {
      store.setPref('araDismissed', (store.pref('araDismissed') || []).concat([x.k]));
      ui.toast('Suggestion dismissed. It will not come back unless you clear dismissed suggestions.');
      p.onClose();
    }

    if (doneSt[0]) return h(ui.Modal, {
      title: 'Ara · done', description: 'Applied on ' + seed.todayLabel + '.',
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h('span', { className: 'muted grow' }, 'Logged in the audit trail.'),
        h(V.Button, { variant: 'outline', onClick: undo }, 'Undo'),
        h(V.Button, { variant: 'primary', onClick: p.onClose }, 'Done'))
    },
      h('div', { className: 'ara-done' },
        h('span', { className: 'ara-done__i' }, CHECK),
        h('strong', null, x.done(doneSt[0].n)),
        h('button', { type: 'button', className: 'dash__link', onClick: function () { p.onClose(); router.go(x.to); } }, x.a, I.right)));

    return h(ui.Modal, {
      title: 'Ara · ' + x.t,
      description: 'Read off the directory on ' + seed.todayLabel + '. Nothing changes until you run it.',
      onClose: p.onClose, wide: true,
      footer: h(React.Fragment, null,
        h(V.Button, { variant: 'ghost', onClick: dismiss }, 'Dismiss'),
        h('span', { className: 'grow' }),
        h(V.Button, { variant: 'outline', iconEnd: I.right, onClick: function () { p.onClose(); router.go(x.to); } }, x.a),
        h(V.Button, { variant: 'primary', iconStart: ARA, disabled: x.targets.length > 0 && !picked.length, onClick: apply }, x.verb(n)))
    },
      h('div', { className: 'ara-tags' },
        h('span', { className: 'ara-tag ara-tag--' + x.tone }, x.impact),
        x.targets.length ? h('span', { className: 'ara-tag' }, plural(x.targets.length, 'record')) : null),
      h('div', { className: 'adm-say' },
        h('span', { className: 'adm-say__m' }, ARA),
        h('p', null, x.s)),
      x.targets.length ? h('div', { className: 'ara-pick' },
        h('div', { className: 'ara-pick__h' },
          h('span', { className: 'adm-src__h' }, 'Ara will act on'),
          h('button', { type: 'button', className: 'dash__link',
            onClick: function () { pickSt[1](picked.length === x.targets.length ? [] : x.targets.map(function (t) { return t.id; })); } },
            picked.length === x.targets.length ? 'Clear all' : 'Select all')),
        h('div', { className: 'ara-pick__list' }, shown.map(function (t) {
          var on = picked.indexOf(t.id) > -1;
          return h('label', { className: 'ara-pick__r' + (on ? ' is-on' : ''), key: t.id },
            h('input', { type: 'checkbox', checked: on, onChange: function () { toggle(t.id); } }),
            h(V.Avatar, { name: t.t, size: 'xs' }),
            h('span', { className: 'grow' }, t.t),
            h('small', null, t.s));
        })),
        x.targets.length > CAP ? h('button', { type: 'button', className: 'ara-pick__more',
          onClick: function () { allSt[1](!allSt[0]); } },
          allSt[0] ? 'Show the first ' + CAP : 'Show all ' + num(x.targets.length)) : null) : null);
  }

  /* All of them at once, in the order they matter, each a step from being done. */
  /* ---------------------------------------------------------------- Alerts

     One timeline, drawn in two places: five rows on the card and all of them in the
     modal. Writing it once is the point — a card that shows a shortened version of a
     list in a dialog has to be the same list, or the count on the card is a lie. */
  function Timeline(p) {
    return h('ol', { className: 'adm-tl' + (p.full ? ' adm-tl--full' : '') }, p.rows.map(function (a, i) {
      return h('li', { className: 'adm-tl__r is-' + (a.tone || 'info'), key: a.t + i },
        h('span', { className: 'adm-tl__time' }, a.at),
        h('span', { className: 'adm-tl__dot', 'aria-hidden': 'true' }),
        h('button', { type: 'button', className: 'adm-tl__m', onClick: function () { p.onGo(a); } },
          h('strong', { title: a.t }, a.t),
          h('span', { title: a.s }, a.s),
          p.full ? h('span', { className: 'adm-tl__go' }, 'Open ', I.right) : null));
    }));
  }

  function AlertsModal(p) {
    var rows = p.rows;
    var bad = rows.filter(function (a) { return a.sev === 2; }).length;
    var warn = rows.filter(function (a) { return a.sev === 1; }).length;
    return h(ui.Modal, {
      wide: true,
      title: 'Alerts \u00b7 ' + rows.length + ' raised today',
      description: bad || warn
        ? plural(bad, 'thing') + ' to put right and ' + warn + ' to attend to. Every one of them '
          + 'opens where it can be dealt with.'
        : 'Nothing is broken. These are notes rather than alerts.',
      onClose: p.onClose,
      footer: h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Close')
    },
      h(Timeline, {
        rows: rows, full: true,
        onGo: function (a) { p.onClose(); router.go(a.to); }
      }));
  }

  function AllSuggestions(p) {
    return h(ui.Modal, {
      title: 'Ara · ' + plural(p.items.length, 'suggestion') + ' about accounts',
      description: 'Ranked by risk: what protects the most first. Open one to review it and run it.',
      onClose: p.onClose, wide: true,
      footer: h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Close')
    },
      p.items.length ? h('div', { className: 'ara-list' }, p.items.map(function (c) {
        return h('div', { className: 'ara-list__r', key: c.k },
          h('span', { className: 'adm-tip__i ara-list__i is-' + c.tone }, c.icon),
          h('span', { className: 'ara-list__m' },
            h('span', { className: 'ara-tag ara-tag--' + c.tone }, c.impact),
            h('strong', null, c.t),
            h('span', null, c.s)),
          h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: ARA, onClick: function () { p.onOpen(c); } }, 'Review & run'));
      })) : h(ui.Empty, { icon: I.ok, title: 'Nothing to suggest', body: 'Every suggestion has been acted on or dismissed.' }));
  }

  /* ====================================================== the access queue
     Work the admin owes, from the records that create it: leavers whose access is still
     open, invitations nobody accepted, suspensions waiting on a decision, and privileged
     accounts without a second factor. Ordered by when it is due. */
  var PILL = { revoke: 'fail', invite: 'warn', suspend: 'sched', mfa: 'manual',
    Overdue: 'fail', 'Due soon': 'warn', Scheduled: 'sched', 'At risk': 'fail', Waiting: 'warn' };

  function accessQueue(users) {
    var today = seed.todayIso, rows = [];
    store.collection('offboarding').forEach(function (o) {
      if (o.stage === 'Completed') return;
      var t = (o.tasks || []).filter(function (x) { return x.name === 'Access revocation'; })[0];
      if (t && t.done) return;
      var d = daysBetween(today, o.lastWorkingDay);
      rows.push({ id: o.id, emp: o.employee, who: nameOf(o.employee), dept: deptOf(o.employee), kind: 'revoke', due: o.lastWorkingDay,
        when: 'Last day ' + ui.dateLabel(o.lastWorkingDay), scheduled: !!o.revokeScheduled,
        status: o.revokeScheduled ? 'Scheduled' : d < 0 ? 'Overdue' : d <= 30 ? 'Due soon' : 'Scheduled', to: 'admin/roles/review' });
    });
    users.forEach(function (u) {
      if (u.status === 'Pending Invitation') {
        /* An unaccepted invite is overdue once its person's start date has passed, not after
           an arbitrary number of days: that is the day they needed to be able to sign in. */
        var emp = store.employee(u.employee), start = emp && emp.joined;
        var late = start && start <= today;
        rows.push({ id: u.id, who: nameOf(u.employee), dept: deptOf(u.employee), kind: 'invite', due: u.invitedOn,
          when: start ? (late ? 'Started ' : 'Starts ') + ui.dateLabel(start) : 'Invited ' + ui.dateLabel(u.invitedOn),
          status: late ? 'Overdue' : 'Waiting', to: 'admin/users/all' });
      } else if (u.status === 'Suspended') {
        rows.push({ id: u.id, who: nameOf(u.employee), dept: deptOf(u.employee), kind: 'suspend', due: u.lastSignIn || today,
          when: 'Since ' + ui.dateLabel(u.lastSignIn), status: 'Waiting', to: 'admin/users/all' });
      } else if ((u.role === 'admin' || u.role === 'hr') && !u.mfa && !u.mfaRequired) {
        rows.push({ id: u.id, who: nameOf(u.employee), dept: deptOf(u.employee), kind: 'mfa', due: today,
          when: ROLE_NAME[u.role], status: 'At risk', to: 'admin/settings' });
      }
    });
    var rank = { Overdue: 0, 'At risk': 1, 'Due soon': 2, Waiting: 3, Scheduled: 4 };
    return rows.sort(function (a, b) { return (rank[a.status] - rank[b.status]) || (a.due < b.due ? -1 : 1); });
  }

  function pill(word, cls) { return h('span', { className: 'adm-p adm-p--' + (cls || PILL[word]) }, word); }

  /* ====================================================== the access queue, as a donut
     The same twelve items the queue holds, grouped by the kind of work, so the card says
     at a glance what the admin owes and each slice's row opens where it is done. */
  var QUEUE_KINDS = [
    /* These four are a queue broken down by kind, not four levels of severity, so
       they take the chart ramp. Revoking access keeps the danger colour because it is
       the one of the four that is genuinely urgent — somebody who has left can still
       sign in — and the other three are work, not alarms. */
    { k: 'revoke', t: 'Revoke access', c: 'var(--danger-fg)', to: 'admin/roles/review' },
    { k: 'mfa', t: 'Require MFA', c: 'var(--chart-1)', to: 'admin/settings' },
    { k: 'invite', t: 'Resend invite', c: 'var(--chart-4)', to: 'admin/users/all' },
    { k: 'suspend', t: 'Decide suspension', c: 'var(--chart-6)', to: 'admin/users/all' }
  ];

  function Donut(p) {
    var total = p.rows.reduce(function (a, r) { return a + r.n; }, 0);
    var R = 58, C = 2 * Math.PI * R, GAP = total > 1 ? 3 : 0, off = 0;
    return h('div', { className: 'admb-ring adm-donut' },
      h('svg', { viewBox: '0 0 150 150', role: 'img', 'aria-label': p.label },
        h('circle', { cx: 75, cy: 75, r: R, fill: 'none', stroke: 'var(--bg-muted)', strokeWidth: 9 }),
        p.rows.filter(function (r) { return r.n; }).map(function (r) {
          var len = r.n / (total || 1) * C, dash = Math.max(len - GAP, 1.5), o = off;
          off += len;
          return h('circle', { key: r.k, cx: 75, cy: 75, r: R, fill: 'none', stroke: r.c, strokeWidth: 9,
            strokeDasharray: dash + ' ' + (C - dash), strokeDashoffset: -o, transform: 'rotate(-90 75 75)' });
        })),
      h('span', { className: 'admb-ring__mid' }, h('b', null, total), h('span', null, p.caption)));
  }

  /* ====================================================== from Tracklivo
     Asset requests are raised and decided in Tracklivo; what reaches the register is
     the request and where Tracklivo has got to with it. Stacked by that status, per
     category, so "what are people asking for, and what is cleared to issue" is one read. */
  var TL_STATUS = [
    /* Ready, waiting and refused really are an outcome, so these three keep their
       semantic colours. */
    { s: 'Approved', t: 'Ready to issue', c: 'var(--success-fg)' },
    { s: 'Pending Approval', t: 'In Tracklivo', c: 'var(--chart-1)' },
    { s: 'Rejected', t: 'Declined', c: 'var(--chart-6)' }
  ];
  function tracklivoRows() {
    var by = {};
    store.collection('assetRequests').forEach(function (r) {
      var c = by[r.category] || (by[r.category] = { k: r.category, n: 0, parts: {} });
      c.n++; c.parts[r.status] = (c.parts[r.status] || 0) + 1;
    });
    return Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.n - a.n; });
  }

  /* ====================================================== MFA coverage, by role
     Who signs in with a second factor, per role, privileged roles first — the gap that
     matters most is the one at the top of this list. */
  var MFA_ROLES = [['admin', 'Admins'], ['hr', 'HR'], ['manager', 'Managers'], ['me', 'Employees']];
  function mfaByRole(users) {
    return MFA_ROLES.map(function (r) {
      var all = users.filter(function (u) { return u.role === r[0]; });
      return { k: r[0], t: r[1], n: all.length, on: all.filter(function (u) { return u.mfa; }).length };
    }).filter(function (r) { return r.n; });
  }

  /* ====================================================== plan usage
     What the plan includes and how much of it is spent: seats against the plan, AI
     credits against the month, and where the credits went. Read from the subscription
     and the AI usage the billing screens use. */
  function Gauge(p) {
    var R = 34, C = 2 * Math.PI * R, on = Math.max(0, Math.min(100, p.pct)) / 100 * C;
    return h('div', { className: 'adm-gauge' },
      h('span', { className: 'adm-gauge__ring' },
        h('svg', { viewBox: '0 0 84 84', 'aria-hidden': 'true' },
          h('circle', { cx: 42, cy: 42, r: R, fill: 'none', stroke: 'var(--bg-muted)', strokeWidth: 5.5 }),
          h('circle', { cx: 42, cy: 42, r: R, fill: 'none', stroke: p.color, strokeWidth: 5.5, strokeLinecap: 'round',
            strokeDasharray: on + ' ' + (C - on), transform: 'rotate(-90 42 42)' })),
        h('b', null, Math.round(p.pct) + '%')),
      h('span', { className: 'adm-gauge__m' }, h('strong', null, p.t), h('span', null, p.s)));
  }

  /* ====================================================== the page */
  var TABS = [{ k: 'mfa', t: 'MFA coverage' }, { k: 'plan', t: 'Plan usage' }];

  function AdminDashA(p) {
    var savedTab = store.pref('adminDashTab');
    var tabSt = React.useState(savedTab === 'plan' ? 'plan' : 'mfa');
    var tab = tabSt[0];
    function pickTab(k) { tabSt[1](k); store.setPref('adminDashTab', k); }
    var openSt = React.useState(null);
    var allSt = React.useState(false);
    var alertsSt = React.useState(false);
    var s = store.stats();
    var users = store.collection('users');
    var me = store.employeeByName(HRMS.nav.role('admin').persona);

    var mfa = mfaByRole(users);
    var mfaOn = mfa.reduce(function (a, r) { return a + r.on; }, 0);
    var sub = seed.subscription, ai = seed.aiUsage;
    var aiMax = Math.max.apply(null, ai.byModule.map(function (m) { return m.credits; }).concat([1]));
    var buckets = signins(users);
    var queue = accessQueue(users);
    var queueRows = QUEUE_KINDS.map(function (k) {
      var items = queue.filter(function (r) { return r.kind === k.k; });
      return Object.assign({ n: items.length, overdue: items.filter(function (r) { return r.status === 'Overdue' || r.status === 'At risk'; }).length }, k);
    });
    var urgent = queueRows.reduce(function (a, r) { return a + r.overdue; }, 0);
    var firstLeave = (queue.filter(function (r) { return r.kind === 'revoke'; }).map(function (r) { return r.due; }).sort()[0]) || seed.todayIso;
    var tlRows = tracklivoRows();
    var tlTotal = tlRows.reduce(function (a, r) { return a + r.n; }, 0);
    var tlMax = Math.max.apply(null, tlRows.map(function (r) { return r.n; }).concat([1]));
    var tlReady = store.collection('assetRequests').filter(function (r) { return r.status === 'Approved'; }).length;
    var tlConn = (seed.integrations.filter(function (x) { return x.name === 'Tracklivo'; })[0] || {}).connectedOn;
    var sugg = suggestions(users, buckets, queue);
    var flags = {}, byKey = {};
    sugg.forEach(function (x) { if (x.bucket) flags[x.bucket] = x; byKey[x.k] = x; });
    var top = sugg[0] || null;
    var active7 = buckets[0].n + buckets[1].n;

    /* ---------------------------------------------------------------- Alerts

       Every line here is derived from the data, never written down (PRD 15), and every
       one carries where to go about it. The list used to be three hand-written lines
       plus one per unconnected provider, which is how widening the integration
       catalogue from three to thirty-four turned it into a list of software this
       organisation has never used.

       `sev` ranks them so the card can show the few that matter and the modal the rest:
       2 is something broken, 1 is something to attend to, 0 is a note. */
    function alertList() {
      var out = [];
      function add(sev, tone, t, s, at, to) { out.push({ sev: sev, tone: tone, t: t, s: s, at: at, to: to }); }

      /* Read through the store, so a provider disconnected in this session shows up
         here rather than on the next reload. */
      var integrations = store.collection('integrations');
      var offline = integrations.filter(function (x) { return x.status !== 'Connected'; });
      /* A provider nobody ever connected is not an alert — the catalogue is a shelf,
         and most of it is things this organisation does not run. What is an alert is
         one that was connected and is not any more. */
      var dropped = offline.filter(function (x) { return x.droppedOn; });
      dropped.forEach(function (x) {
        add(2, 'bad', x.name + ' disconnected',
          'It was connected and is not any more · ' + (x.kind || 'integration') + '.',
          'Today', 'admin/integrations');
      });

      /* Privileged accounts with no second step. The one that protects the most. */
      var priv = users.filter(function (u) {
        return (u.role === 'admin' || u.role === 'hr') && !u.mfa && u.status !== 'Deactivated';
      });
      if (priv.length) {
        add(2, 'bad', plural(priv.length, 'privileged account') + ' without a second step',
          'An admin or HR account that signs in on a password alone can change everyone else’s.',
          'Today', 'admin/roles/review');
      }

      /* Someone who has left and can still sign in. */
      var leavers = queue.filter(function (r) { return r.kind === 'revoke'; });
      if (leavers.length) {
        add(2, 'bad', plural(leavers.length, 'leaver') + ' with access still open',
          'The earliest last working day is ' + ui.dateLabel(firstLeave) + '.',
          'Today', 'admin/roles/review');
      }

      /* Single sign-on. It is an Integrations question now, not a Security one: the
         identity provider is Entra ID, Okta or Google Workspace, and none is connected. */
      var idp = integrations.filter(function (x) {
        return x.category === 'Identity and access' && x.status === 'Connected';
      });
      if (!idp.length) {
        add(2, 'bad', 'Single sign-on not configured',
          'Everyone signs in with an email and a password. Connect an identity provider.',
          '09:51', 'admin/integrations');
      }

      if (s.invited) {
        add(1, 'warn', plural(s.invited, 'invitation') + ' unaccepted',
          'Past the start date and never signed in.', '11:04', 'admin/users/all');
      }

      /* Seats. The plan is a number you can run out of. */
      if (sub && sub.seats) {
        var left = sub.seats - s.active;
        if (left <= 10) {
          add(left < 0 ? 2 : 1, left < 0 ? 'bad' : 'warn',
            left < 0 ? Math.abs(left) + ' accounts over the seat count' : plural(left, 'seat') + ' left on the plan',
            s.active + ' active accounts against ' + sub.seats + ' seats.', 'Today', 'admin/billing/billing');
        }
      }

      /* Assets still out after an exit. The admin issues them, so the admin chases. */
      var outstanding = store.collection('offboarding').filter(function (c) {
        return c.status !== 'Completed' && (c.assetsOutstanding || 0) > 0;
      }).reduce(function (n, c) { return n + c.assetsOutstanding; }, 0);
      if (outstanding) {
        add(1, 'warn', plural(outstanding, 'asset') + ' not returned from an exit',
          'Each one is still assigned to somebody who has left or is leaving.',
          'Today', 'admin/assets/returns');
      }

      /* Erasure requests run on somebody else's clock. */
      var dueSoon = store.collection('erasure').filter(function (e) {
        return e.status !== 'Completed' && e.dueOn
          && (new Date(e.dueOn) - seed.today) / 86400000 <= 14;
      });
      if (dueSoon.length) {
        add(1, 'warn', plural(dueSoon.length, 'erasure request') + ' due within a fortnight',
          'The clock on these is set outside the organisation.', 'Today', 'admin/data/retention');
      }

      /* The shape of the integration estate, once, rather than once per provider. */
      if (offline.length > dropped.length) {
        add(0, 'info', (integrations.length - offline.length) + ' of ' + integrations.length + ' providers connected',
          'The rest of the catalogue is waiting, including '
            + offline.filter(function (x) { return !x.droppedOn; }).slice(0, 3)
                .map(function (x) { return x.name; }).join(', ') + '.',
          'Today', 'admin/integrations');
      }

      add(0, 'good', 'Nightly backup completed',
        'No errors reported · core platform to object store.', '04:00', 'admin/settings');

      return out.sort(function (a, b) { return b.sev - a.sev; });
    }
    var alerts = alertList();
    var alertsBad = alerts.filter(function (a) { return a.sev === 2; }).length;

    return h('div', { className: 'adm' },
      h('div', { className: 'adm__glow', 'aria-hidden': 'true' }, h('i', null), h('i', null)),

      h('div', { className: 'adm__head' },
        h('div', null,
          h('span', { className: 'adm__eyebrow' }, 'Accounts, access and platform'),
          h('h1', null, 'Admin ', h('em', null, 'dashboard')),
          h('div', { className: 'adm__status' },
            h('b', null, CHECK, 'Platform health: Healthy'),
            h('i', null),
            h('span', null, 'Read on ' + seed.todayLabel),
            h('i', null),
            h('span', null, me ? 'Signed in as ' + me.name : 'Administrator'))),
        /* Ara sits at the head, before the option switcher: one small button for every
           suggestion on the page, wherever its subject appears below. */
        h('div', { className: 'adm__tools' },
          sugg.length ? h('button', {
            type: 'button', className: 'adm-ara', onClick: function () { allSt[1](true); },
            title: plural(sugg.length, 'suggestion') + ' from Ara',
            'aria-label': 'Ara has ' + plural(sugg.length, 'suggestion')
          }, ARA, h('span', { className: 'adm-ara__n' }, sugg.length)) : null,
          p.switcher)),

      /* Four numbers on one card, divided by rules. */
      h('section', { className: 'adm-card', style: { padding: 0 }, 'aria-label': 'Key figures' },
        h('div', { className: 'adm-kpis' }, kpis(s, users).map(function (k) {
          var action = byKey[k.k];
          return h('div', { className: 'adm-kpi', key: k.t },
            h('div', { className: 'adm-kpi__t' },
              h('span', { className: 'adm-kpi__l' }, h('strong', null, k.t), h('span', null, k.s)),
              /* The arrow is the way from the figure to the thing to do about it. */
              action ? h('button', {
                type: 'button', className: 'adm-kpi__go', onClick: function () { openSt[1](action); },
                title: action.verb(action.targets.length || 1),
                'aria-label': action.verb(action.targets.length || 1)
              }, I.right) : null),
            h('span', { className: 'adm-kpi__n' }, num(k.n), k.unit ? h('small', null, k.unit) : null));
        }))),

      h('div', { className: 'adm-mid' },
        /* Two readings an admin owns, MFA coverage and the plan, in one card with a tab
           each. The tab picked is remembered, so the card opens where it was left. */
        h('section', { className: 'adm-card adm-tabbed' },
          h('div', { className: 'adm-card__head' },
            h('div', { className: 'ad-seg', role: 'tablist', 'aria-label': 'Account health' },
              TABS.map(function (t) {
                return h('button', {
                  key: t.k, type: 'button', role: 'tab', id: 'admtab-' + t.k,
                  'aria-selected': tab === t.k ? 'true' : 'false', 'aria-controls': 'admpanel-' + t.k,
                  className: 'ad-seg__b' + (tab === t.k ? ' is-on' : ''),
                  onClick: function () { pickTab(t.k); }
                }, t.t);
              })),
            tab === 'mfa'
              ? h('button', { type: 'button', className: 'dash__link', onClick: function () { router.go('admin/settings'); } }, 'Security', I.right)
              : h('button', { type: 'button', className: 'dash__link', onClick: function () { router.go('admin/billing/usage'); } }, 'Usage', I.right)),
          tab === 'mfa'
            ? h('div', { className: 'adm-tabbed__p', role: 'tabpanel', id: 'admpanel-mfa', 'aria-labelledby': 'admtab-mfa' },
                h('p', { className: 'adm-tabbed__s' }, h('b', { className: 'adm-inl' }, num(mfaOn)), ' of ' + num(users.length) + ' accounts on MFA \u00b7 ',
                  h('b', { className: 'adm-inl' }, Math.round(mfaOn / (users.length || 1) * 100) + '%')),
          h('div', { className: 'adm-legend' },
            h('span', null, h('i', { style: { background: 'var(--success-fg)' } }), 'MFA on'),
            h('span', null, h('i', { style: { background: 'var(--danger-fg)', opacity: .35 } }), 'Password only')),
          h('div', { className: 'adm-stack adm-stack--mfa' }, mfa.map(function (r) {
            var pct = r.n ? r.on / r.n * 100 : 0;
            return h('button', { type: 'button', className: 'adm-stack__r', key: r.k,
              title: r.on + ' of ' + r.n + ' ' + r.t.toLowerCase() + ' on MFA',
              onClick: function () { router.go('admin/settings'); } },
              h('span', { className: 'adm-stack__l' }, r.t, h('small', null, num(r.n))),
              h('span', { className: 'adm-stack__bar' },
                r.on ? h('i', { style: { width: pct + '%', background: 'var(--success-fg)' } }) : null,
                r.n - r.on ? h('i', { style: { width: (100 - pct) + '%', background: 'var(--danger-fg)', opacity: .35 } }) : null),
              h('b', { className: pct < 50 ? 'is-low' : null }, Math.round(pct) + '%'));
          })),
          h('p', { className: 'adm-card__foot' }, 'Privileged roles first: their accounts can change everyone else’s.'))
            : h('div', { className: 'adm-tabbed__p', role: 'tabpanel', id: 'admpanel-plan', 'aria-labelledby': 'admtab-plan' },
                h('p', { className: 'adm-tabbed__s' }, sub.plan + ' plan \u00b7 renews ' + sub.renewsLabel),
          h('div', { className: 'adm-gauges' },
            h(Gauge, { pct: sub.seatsUsed / sub.seats * 100, color: 'var(--brand-solid)', t: 'Seats',
              s: num(sub.seatsUsed) + ' of ' + num(sub.seats) }),
            h(Gauge, { pct: ai.used / ai.credits * 100, color: 'var(--chart-4)', t: 'AI credits',
              s: num(ai.used) + ' of ' + num(ai.credits) })),
          h('span', { className: 'adm-sub' }, 'Where the credits went this month'),
          h('div', { className: 'adm-stack adm-stack--wide' }, ai.byModule.map(function (m) {
            return h('div', { className: 'adm-stack__r adm-stack__r--static', key: m.module },
              h('span', { className: 'adm-stack__l', title: m.module }, m.module),
              h('span', { className: 'adm-stack__bar' }, h('i', { style: { width: (m.credits / aiMax * 100) + '%', background: 'var(--chart-4)' } })),
              h('b', null, (m.credits / 1000).toFixed(1) + 'k'));
          })))),

        /* How recently people sign in, with Ara's reading pinned to it. */
        h('section', { className: 'adm-card' },
          h('div', { className: 'adm-card__head' },
            h('div', null,
              h('h2', null, 'Sign-in activity'),
              h('p', null, h('b', { className: 'adm-inl' }, num(active7)), ' signed in this week \u00b7 ',
                h('b', { className: 'adm-inl' }, Math.round(active7 / (users.length || 1) * 100) + '%'), ' of the directory')),
            null),
          h(SigninChart, { buckets: buckets, flags: flags, onOpen: function (f) { openSt[1](f); } }),
          /* One suggestion under the chart, the most pressing. The rest are behind Ara
             at the head of the page: a card should carry a line about itself, not a
             stack of everything Ara has noticed. */
          top ? h('div', { className: 'adm-tip' },
            h('span', { className: 'adm-tip__i' }, ARA),
            h('span', { className: 'adm-tip__m' },
              h('strong', null, top.t),
              h('span', null, top.s.split('. ')[0] + '.')),
            h('button', { type: 'button', className: 'adm-tip__go', onClick: function () { openSt[1](top); } },
              top.verb(top.targets.length || 1)),
            h('button', { type: 'button', className: 'adm-tip__x', 'aria-label': 'Dismiss this suggestion',
              onClick: function () { store.setPref('araDismissed', (store.pref('araDismissed') || []).concat([top.k])); } },
              I.close)) : null)),

      h('div', { className: 'adm-low' },
        /* The access work queued against the admin, by kind. */
        h('section', { className: 'adm-card' },
          h('div', { className: 'adm-card__head' },
            h('div', null,
              h('h2', null, 'Access queue'),
              h('p', null, 'Work waiting on an admin')),
            h('button', { type: 'button', className: 'dash__link', onClick: function () { router.go('admin/roles/review'); } }, 'Review', I.right)),
          queue.length ? h('div', { className: 'adm-split' },
            h(Donut, { rows: queueRows, caption: queue.length === 1 ? 'item' : 'items',
              label: 'Access queue: ' + queueRows.map(function (r) { return r.n + ' ' + r.t; }).join(', ') }),
            h('div', { className: 'adm-key' }, queueRows.map(function (r) {
              return h('button', { type: 'button', className: 'adm-key__r', key: r.k, disabled: !r.n,
                onClick: function () { router.go(r.to); } },
                h('i', { style: { background: r.c } }),
                h('span', { className: 'grow' }, r.t),
                h('b', null, r.n));
            })))
            : h(ui.Empty, { icon: I.ok, title: 'Nothing waiting', body: 'No leaver, invitation or privileged account needs an admin today.' }),
          urgent ? h('p', { className: 'adm-card__foot adm-card__foot--warn' }, I.warn,
            plural(urgent, 'item') + ' overdue or at risk \u00b7 the earliest leaver goes ' + ui.dateLabel(firstLeave)) : null),

        /* Asset requests, as Tracklivo reports them. */
        h('section', { className: 'adm-card' },
          h('div', { className: 'adm-card__head' },
            h('div', null,
              h('h2', null, 'Asset requests'),
              h('p', null, num(tlTotal) + ' from Tracklivo, by category')),
            h('span', { className: 'atl__src' }, 'From Tracklivo')),
          h('div', { className: 'adm-legend' }, TL_STATUS.map(function (st) {
            return h('span', { key: st.s }, h('i', { style: { background: st.c } }), st.t);
          })),
          h('div', { className: 'adm-stack' }, tlRows.map(function (r) {
            return h('button', { type: 'button', className: 'adm-stack__r', key: r.k,
              title: TL_STATUS.map(function (st) { return (r.parts[st.s] || 0) + ' ' + st.t.toLowerCase(); }).join(' · '),
              onClick: function () { router.go('admin/assets/requests'); } },
              h('span', { className: 'adm-stack__l' }, r.k),
              h('span', { className: 'adm-stack__bar' }, TL_STATUS.map(function (st) {
                var n = r.parts[st.s] || 0;
                return n ? h('i', { key: st.s, style: { width: (n / tlMax * 100) + '%', background: st.c } }) : null;
              })),
              h('b', null, r.n));
          })),
          h('p', { className: 'adm-card__foot' }, plural(tlReady, 'request') + ' ready to issue · synced from Tracklivo, connected ' +
            ui.dateLabel(tlConn))),

        /* The alerts column. The card carries the ones that matter and "All" opens
           the rest, rather than sending you to the audit log, which is a different
           question asked of different data. */
        h('section', { className: 'adm-card' },
          h('div', { className: 'adm-card__head' },
            h('div', null,
              h('h2', null, 'Alerts'),
              h('p', null, alertsBad
                ? plural(alertsBad, 'thing') + ' to put right'
                : 'Nothing is broken right now')),
            h('button', { type: 'button', className: 'dash__link', onClick: function () { alertsSt[1](true); } },
              'All ' + alerts.length, I.right)),
          h(Timeline, { rows: alerts.slice(0, 5), onGo: function (a) { router.go(a.to); } }),
          alerts.length > 5
            ? h('div', { className: 'adm-card__foot' },
                h('button', { type: 'button', className: 'adm-tl__more',
                  onClick: function () { alertsSt[1](true); } },
                  'Show the other ' + (alerts.length - 5)))
            : null)),

      openSt[0] ? h(SuggestionModal, { key: openSt[0].k, item: openSt[0], onClose: function () { openSt[1](null); } }) : null,
      allSt[0] && !openSt[0] ? h(AllSuggestions, { items: sugg, onClose: function () { allSt[1](false); },
        onOpen: function (c) { openSt[1](c); } }) : null,
      alertsSt[0] ? h(AlertsModal, { rows: alerts, onClose: function () { alertsSt[1](false); } }) : null);
  }

  /* ====================================================== A or B
     Two options for the same route, so they can be compared on the same data without a
     rebuild in between. Option B lives in admin-dash-b.js and takes this page's styles.
     The choice is remembered; a value stored by an older build falls back to A. */
  var OPTIONS = [
    { k: 'a', label: 'Option A', title: 'Accounts and access' },
    { k: 'b', label: 'Option B', title: 'System overview' }
  ];

  function Switcher(p) {
    return h('div', { className: 'dsw', role: 'group', 'aria-label': 'Dashboard option' },
      OPTIONS.map(function (o) {
        return h('button', {
          key: o.k, type: 'button', title: o.title,
          className: 'dsw__b' + (p.value === o.k ? ' is-on' : ''),
          'aria-pressed': p.value === o.k,
          onClick: function () { p.onChange(o.k); }
        }, o.label);
      }));
  }

  function AdminDashboard() {
    var saved = store.pref('adminDashOption');
    var optSt = React.useState(saved === 'b' && HRMS.adminDashB ? 'b' : 'a');
    function pick(k) { optSt[1](k); store.setPref('adminDashOption', k); }
    var switcher = h(Switcher, { value: optSt[0], onChange: pick });
    return optSt[0] === 'b'
      ? h(HRMS.adminDashB, { switcher: switcher })
      : h(AdminDashA, { switcher: switcher });
  }


  /* ================================================== The employee dashboard
     A working day, in the order somebody actually asks about it: what needs me,
     where my month stands, how the week has gone, what I promised, what I open
     most, and who is around.

     Everything on it is derived from the store — the action list, the week, the
     month, the team — so nothing here can say something the module it links to
     would contradict. Two exceptions are stated where they occur.

     No KPI strip and no "My tasks": the first restated the cards below it and the
     second was a hard-coded list nothing could complete. */

  var MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function dayOf(iso) { return new Date(iso + 'T00:00'); }
  function daysFromToday(iso) {
    return Math.round((dayOf(iso) - dayOf(seed.todayIso)) / 864e5);
  }
  function shortWhen(iso) {
    var d = dayOf(iso);
    return d.getDate() + ' ' + MONTH_ABBR[d.getMonth()];
  }
  function relDays(n) {
    return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n > 0 ? 'in ' + n + ' days'
      : n === -1 ? 'yesterday' : Math.abs(n) + ' days ago';
  }
  function greeting() {
    var hr = new Date().getHours();
    return hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  }
  function minutesOf(hhmm) {
    var p = String(hhmm || '').split(':');
    return Number(p[0]) * 60 + Number(p[1] || 0);
  }
  function spell(mins) {
    if (mins < 0) mins = 0;
    var hrs = Math.floor(mins / 60);
    return (hrs ? hrs + 'h ' : '') + (mins % 60) + 'm';
  }

  /* ------------------------------------------------------ Needs your action
     Four sources, each a real record: a goal that is behind, a day the clock did
     not record, the appraisal window, and a survey still open. Sorted by how late
     the thing is, so the first row is the one that has waited longest. */
  function actionsFor(who) {
    var out = [];

    store.collection('goals')
      .filter(function (g) { return g.employee === who.id && g.status !== 'Achieved'; })
      .forEach(function (g) {
        var left = daysFromToday(g.due);
        out.push({
          id: g.id, icon: I.target,
          tone: left < 0 ? 'bad' : left <= 14 ? 'warn' : 'info',
          title: g.title,
          sub: 'Goal · ' + (left < 0 ? 'was due ' : 'due ') + ui.dateLabel(g.due)
            + ' · ' + g.progress + '% complete',
          pill: left < 0 ? Math.abs(left) + ' days overdue' : 'Due ' + relDays(left),
          pillTone: left < 0 ? 'fail' : left <= 14 ? 'warn' : 'sched',
          action: 'Update', to: 'me/performance/goals', urgency: left
        });
      });

    /* A day inside the correction window with no punches on it. PRD 14.3 lets an
       employee fix one, and this is the only place that tells them there is one. */
    var recent = (HRMS.attendanceHistory ? HRMS.attendanceHistory(who, 30) : [])
      .filter(function (r) { return r.status === 'Absent'; });
    if (recent.length) {
      var gap = recent[0];
      out.push({
        id: 'gap-' + gap.date, icon: I.clock, tone: 'warn',
        title: 'No punches recorded on ' + WEEKDAY[dayOf(gap.date).getDay()] + ' ' + shortWhen(gap.date),
        sub: 'Attendance · raise a correction while it is inside the 30-day window',
        pill: 'Needs fix', pillTone: 'warn',
        action: 'Regularize', to: 'me/attendance/regularization',
        urgency: daysFromToday(gap.date)
      });
    }

    var cycle = seed.perfCycles.filter(function (c) { return c.status !== 'Completed'; })[0];
    if (cycle) {
      var opens = daysFromToday(cycle.from);
      var closes = daysFromToday(cycle.to);
      out.push({
        id: cycle.id, icon: I.star, tone: 'info',
        title: 'Submit your ' + cycle.name.replace(' Appraisal', '') + ' self-review',
        sub: 'Performance · ' + (opens > 0 ? 'opens ' + ui.dateLabel(cycle.from) : 'open now')
          + ', closes ' + ui.dateLabel(cycle.to),
        pill: opens > 0 ? 'Opens ' + relDays(opens) : 'Due ' + relDays(closes),
        pillTone: opens > 0 ? 'sched' : closes <= 7 ? 'warn' : 'ok',
        action: 'Start', to: 'me/performance/self', urgency: opens > 0 ? opens : closes
      });
    }

    var answered = {};
    store.collection('surveyResponses')
      .filter(function (r) { return r.employee === who.id; })
      .forEach(function (r) { answered[r.survey] = true; });
    store.collection('surveys')
      .filter(function (s) { return s.status === 'Live' && !answered[s.id]; })
      .slice(0, 1)
      .forEach(function (sv) {
        var closes = sv.to ? daysFromToday(sv.to) : 14;
        out.push({
          id: sv.id, icon: I.checklist, tone: closes <= 7 ? 'warn' : 'info',
          title: sv.name,
          sub: 'Survey \u00b7 ' + sv.questions + ' questions'
            + (sv.anonymous ? ', anonymous' : '') + ', a couple of minutes',
          pill: sv.to ? 'Closes ' + relDays(closes) : 'Open now',
          pillTone: closes <= 7 ? 'warn' : 'sched',
          action: 'Answer', to: 'me/engagement/surveys', urgency: closes
        });
      });

    /* Not sliced here: the banner and the card's count state how many there are,
       and only the list itself is cut, so a sixth item is still counted. */
    return out.sort(function (a, b) { return a.urgency - b.urgency; });
  }

  /* ----------------------------------------------------------- This month */
  function monthRows(who) {
    var monthStart = seed.todayIso.slice(0, 8) + '01';
    var days = daysFromToday(monthStart) * -1 + 1;
    return (HRMS.attendanceHistory ? HRMS.attendanceHistory(who, days) : [])
      .filter(function (r) { return r.date >= monthStart; });
  }
  var MONTH_TALLY = [
    { k: 'Present', l: 'Present' },
    { k: 'Work From Home', l: 'Work from home' },
    { k: 'Late', l: 'Late' },
    { k: 'On Leave', l: 'On leave' },
    { k: 'Absent', l: 'Not recorded' }
  ];

  /* A ring, not a pie: one figure in the middle and the rest of the year's
     entitlement behind it. */
  function Ring(p) {
    var R = 52, C = 2 * Math.PI * R;
    var on = Math.max(0, Math.min(1, p.value)) * C;
    return h('div', { className: 'ering' },
      h('svg', { viewBox: '0 0 128 128', 'aria-hidden': 'true' },
        h('circle', { cx: 64, cy: 64, r: R, fill: 'none', stroke: 'var(--bg-muted)', strokeWidth: 16 }),
        h('circle', {
          cx: 64, cy: 64, r: R, fill: 'none', stroke: p.color || 'var(--brand-solid)', strokeWidth: 16,
          strokeDasharray: on + ' ' + (C - on), strokeDashoffset: C / 4, strokeLinecap: 'butt'
        })),
      h('span', { className: 'ering__mid' }, h('b', null, p.big), h('span', null, p.small)));
  }

  /* -------------------------------------------------------- Around the team
     Colleagues are the people sharing a department: the ones whose absence or
     first week actually lands on the same work. */
  function teamOf(who) {
    /* Not you: your own birthday under "Around the team" reads as a mistake. */
    return store.collection('employees').filter(function (e) {
      return e.department === who.department && e.status !== 'Exited' && e.id !== who.id;
    });
  }
  function daysToAnniversary(mmdd) {
    var today = seed.today;
    var d = new Date(today.getFullYear(), Number(mmdd.slice(0, 2)) - 1, Number(mmdd.slice(3)));
    if (d < today) d = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
    return Math.round((d - today) / 864e5);
  }
  var TEAM_WINDOW = 30;

  function teamGroups(who) {
    var mates = teamOf(who);
    var ids = {};
    mates.forEach(function (e) { ids[e.id] = e; });

    var out = store.collection('leaveRequests')
      .filter(function (l) {
        return ids[l.employee] && l.status === 'Approved'
          && l.from <= seed.todayIso && l.to >= seed.todayIso;
      })
      .map(function (l) {
        var back = seed.util.iso(seed.util.addDays(dayOf(l.to), 1));
        return { id: 'o' + l.id, employee: ids[l.employee], tag: 'Back ' + WEEKDAY[dayOf(back).getDay()] + ' ' + shortWhen(back), sort: 0 };
      });

    var birthdays = mates
      .filter(function (e) { return e.dob && daysToAnniversary(e.dob.slice(5)) <= TEAM_WINDOW; })
      .map(function (e) {
        var n = daysToAnniversary(e.dob.slice(5));
        return { id: 'b' + e.id, employee: e, tag: shortWhen(e.dob.slice(0, 4) + '-' + e.dob.slice(5)) + ' · ' + relDays(n), sort: n };
      }).sort(function (a, b) { return a.sort - b.sort; });

    var joiners = mates
      .filter(function (e) {
        return e.joined <= seed.todayIso && daysFromToday(e.joined) >= -TEAM_WINDOW;
      })
      .map(function (e) {
        return { id: 'n' + e.id, employee: e, tag: 'Joined ' + shortWhen(e.joined), sort: -daysFromToday(e.joined) };
      }).sort(function (a, b) { return a.sort - b.sort; });

    var years = mates
      .map(function (e) {
        var served = seed.today.getFullYear() - Number(e.joined.slice(0, 4));
        return { e: e, served: served, n: daysToAnniversary(e.joined.slice(5)) };
      })
      .filter(function (x) { return x.served > 0 && x.n <= TEAM_WINDOW; })
      .map(function (x) {
        return { id: 'a' + x.e.id, employee: x.e,
          tag: x.served + (x.served === 1 ? ' year' : ' years') + ' · ' + relDays(x.n), sort: x.n };
      }).sort(function (a, b) { return a.sort - b.sort; });

    return [
      { k: 'out', label: 'Out today', rows: out },
      { k: 'birthdays', label: 'Birthdays', rows: birthdays },
      { k: 'joiners', label: 'New joiners', rows: joiners },
      { k: 'years', label: 'Anniversaries', rows: years }
    ];
  }

  function MeCard(p) {
    return h('section', { className: 'adm-card' + (p.className ? ' ' + p.className : '') },
      h('div', { className: 'adm-card__head' },
        h('div', null,
          h('h2', null, p.title, p.count !== undefined
            ? h('span', { className: 'ecount' + (p.countTone ? ' is-' + p.countTone : '') }, p.count) : null),
          p.sub ? h('p', null, p.sub) : null),
        p.right || null),
      p.children);
  }

  /* Each line says something about the signed-in person, so every one of these is
     scoped to them. Reading the latest payslip in the organisation, rather than
     theirs, is how a dashboard ends up quoting somebody else's salary. */
  var SHORTCUTS = [
    { t: 'Latest payslip', icon: I.download, act: 'Download', to: 'me/payroll/payslips',
      sub: function (who) {
        var ps = store.collection('payslips')
          .filter(function (x) { return x.employee === who.id && x.status === 'Published'; })
          .sort(function (a, b) { return a.paidOn < b.paidOn ? 1 : -1; })[0];
        return ps ? ps.period + ' · ' + ui.inr(ps.net) + ' net' : 'Nothing published yet';
      } },
    { t: 'Upload a document', icon: I.clip, act: 'Upload', to: 'me/profile/documents',
      sub: function () { return 'Saved against your own record'; } },
    { t: 'Tax declaration', icon: I.reports, act: 'Open', to: 'me/payroll/tax',
      sub: function (who) {
        var td = store.collection('taxDeclarations')
          .filter(function (x) { return x.employee === who.id; })[0];
        return td ? (td.fy || 'This year') + ' · ' + (td.status || 'Draft') : 'Not started yet';
      } },
    { t: 'My assets', icon: I.package, act: 'View', to: 'me/assets/assigned',
      sub: function (who) {
        var n = store.collection('assets').filter(function (a) { return a.assignedTo === who.id; }).length;
        return n ? n + ' item' + (n === 1 ? '' : 's') + ' in your name' : 'Nothing assigned';
      } }
  ];

  function MeDashboard() {
    var who = store.persona('me');
    var tabSt = React.useState('leave');
    var teamSt = React.useState('out');
    var clockSt = React.useState(new Date());
    React.useEffect(function () {
      var t = setInterval(function () { clockSt[1](new Date()); }, 30000);
      return function () { clearInterval(t); };
    }, []);
    if (!who) return h(ui.Empty, { icon: I.person, title: 'No employee record' });

    var shift = store.shift(who.shift) || seed.shifts[0];
    var balances = store.balancesFor(who.id);
    var punch = store.pref('punch') || {};
    var today = seed.todayIso;
    var inAt = punch.date === today ? punch.in : null;
    var outAt = punch.date === today ? punch.out : null;
    function hhmm(d) { return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
    function setPunch(next) {
      store.setPref('punch', Object.assign({ date: today }, punch.date === today ? punch : {}, next));
    }

    var actions = actionsFor(who);
    var rows = monthRows(who);
    var counts = {};
    rows.forEach(function (r) { counts[r.status] = (counts[r.status] || 0) + 1; });
    var worked = (counts.Present || 0) + (counts['Work From Home'] || 0) + (counts.Late || 0);
    var working = rows.filter(function (r) { return r.status !== 'Weekly Off' && r.status !== 'Holiday'; }).length;

    var left = balances.reduce(function (n, b) { return n + b.available; }, 0);
    var entitled = balances.reduce(function (n, b) { return n + b.entitled; }, 0);
    var monthStart = today.slice(0, 8) + '01';
    var takenThisMonth = store.collection('leaveRequests')
      .filter(function (l) { return l.employee === who.id && l.status === 'Approved' && l.from >= monthStart && l.from <= today; })
      .reduce(function (n, l) { return n + l.days; }, 0);

    var holidays = store.collection('holidays')
      .filter(function (x) { return x.date >= today; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var nextHoliday = holidays[0];

    var goals = store.collection('goals').filter(function (g) { return g.employee === who.id; });
    var overdue = goals.filter(function (g) { return g.status !== 'Achieved' && daysFromToday(g.due) < 0; }).length;

    /* Monday to Sunday of the week today falls in, from the same derivation the
       attendance screens use. */
    var weekStart = seed.util.addDays(seed.today, -((seed.today.getDay() + 6) % 7));
    var byDate = {};
    (HRMS.attendanceHistory ? HRMS.attendanceHistory(who, 14) : [])
      .forEach(function (r) { byDate[r.date] = r; });
    var week = [];
    for (var d = 0; d < 5; d++) {
      var day = seed.util.addDays(weekStart, d);
      var key = seed.util.iso(day);
      week.push({ iso: key, day: WEEKDAY[day.getDay()], row: byDate[key] || null, future: key > today });
    }

    var groups = teamGroups(who);
    var group = groups.filter(function (g) { return g.k === teamSt[0]; })[0] || groups[0];

    var elapsed = inAt ? Math.max(0, (clockSt[0].getHours() * 60 + clockSt[0].getMinutes()) - minutesOf(inAt)) : 0;
    var toGo = inAt ? Math.max(0, (minutesOf(shift.end) - minutesOf(shift.start)) - elapsed) : 0;

    function link(label, to) {
      return h('button', { type: 'button', className: 'dash__link',
        onClick: function () { router.go(to); } }, label, I.right);
    }

    return h('div', { className: 'edash' },

      /* ---- the banner: who, what is waiting, and where the day is up to ---- */
      h('div', { className: 'ehero' },
        h('div', { className: 'ehero__m' },
          h('span', { className: 'ehero__eyebrow' },
            dayOf(today).toLocaleDateString('en-GB', { weekday: 'long' }) + ', ' + ui.dateLabel(today)),
          h('h1', null, greeting() + ', ' + who.name.split(' ')[0]),
          h('p', null,
            actions.length
              ? actions.length + ' item' + (actions.length === 1 ? '' : 's') + ' need' + (actions.length === 1 ? 's' : '') + ' you.'
              : 'Nothing is waiting on you.',
            nextHoliday
              ? ' The office is closed ' + relDays(daysFromToday(nextHoliday.date)) + ' for ' + nextHoliday.name + '.'
              : '')),
        h('div', { className: 'ehero__punch' },
          inAt
            ? h(React.Fragment, null,
                h('div', { className: 'ehero__p1' },
                  h('span', { className: 'ehero__dot' }),
                  h('span', null, outAt ? 'Checked out at ' + outAt : 'Checked in at ' + inAt),
                  h('b', null, outAt ? spell(minutesOf(outAt) - minutesOf(inAt)) : spell(elapsed))),
                h('div', { className: 'ehero__p2' },
                  h('span', null, 'Shift ' + shift.start + ' – ' + shift.end),
                  h('span', null, outAt ? 'Day complete' : spell(toGo) + ' to go'),
                  outAt ? null : h(V.Button, { variant: 'outline', className: 'vi-btn--sm', iconStart: I.stop,
                    onClick: function () { setPunch({ out: hhmm(new Date()) }); } }, 'Check out')))
            : h(React.Fragment, null,
                h('div', { className: 'ehero__p1' },
                  h('span', { className: 'ehero__dot is-off' }),
                  h('span', null, 'Not checked in'),
                  h('b', null, '—')),
                h('div', { className: 'ehero__p2' },
                  h('span', null, 'Shift ' + shift.start + ' – ' + shift.end),
                  h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.play,
                    onClick: function () { setPunch({ in: hhmm(new Date()) }); } }, 'Check in'))))),

      /* ---- what needs me, and where the month stands ---- */
      h('div', { className: 'edash-a' },
        h(MeCard, { title: 'Needs your action', count: actions.length,
          countTone: actions.length ? 'warn' : null,
          right: actions.length
            ? h('span', { className: 'adm-card__hint' },
              actions.length > 5 ? 'Most urgent 5 of ' + actions.length : 'Most urgent first')
            : null },
          actions.length
            ? h('div', { className: 'nact' }, actions.slice(0, 5).map(function (a) {
                return h('div', { className: 'nact__r', key: a.id },
                  h('span', { className: 'nact__i is-' + a.tone }, a.icon),
                  h('span', { className: 'nact__m' },
                    h('strong', null, a.title),
                    h('span', null, a.sub)),
                  h('span', { className: 'adm-p adm-p--' + a.pillTone }, a.pill),
                  h(V.Button, { variant: a.pillTone === 'fail' ? 'primary' : 'outline', className: 'vi-btn--sm',
                    onClick: function () { router.go(a.to); } }, a.action));
              }))
            : h(ui.Empty, { icon: I.ok, title: 'Nothing is waiting on you',
              body: 'Goals, corrections, reviews and surveys appear here when they need an answer.' })),

        h(MeCard, { title: 'This month',
          right: h(V.Button, { variant: 'primary', className: 'vi-btn--sm', iconStart: I.plus,
            onClick: function () { router.go('me/leave/overview'); } }, 'Apply leave') },
          h('div', { className: 'ad-seg', role: 'tablist', 'aria-label': 'This month' },
            [['leave', 'Leave'], ['attendance', 'Attendance']].map(function (t) {
              return h('button', { key: t[0], type: 'button', role: 'tab',
                'aria-selected': tabSt[0] === t[0] ? 'true' : 'false',
                className: 'ad-seg__b' + (tabSt[0] === t[0] ? ' is-on' : ''),
                onClick: function () { tabSt[1](t[0]); } }, t[1]);
            })),

          tabSt[0] === 'leave'
            ? h('div', { className: 'emonth' },
                h('div', { className: 'emonth__top' },
                  h(Ring, { value: entitled ? left / entitled : 0, big: left, small: 'days left',
                    color: 'var(--av-green-fg)' }),
                  h('div', { className: 'emonth__key' },
                    h('div', { className: 'emonth__k' },
                      h('i', { style: { background: 'var(--brand-solid)' } }),
                      h('span', null, h('strong', null, 'Taken · ' + takenThisMonth + ' day' + (takenThisMonth === 1 ? '' : 's')),
                        h('span', null, 'This month'))),
                    h('div', { className: 'emonth__k' },
                      h('i', { style: { background: 'var(--av-green-fg)' } }),
                      h('span', null, h('strong', null, 'Left · ' + left + ' days'),
                        h('span', null, balances.map(function (b) {
                          var t = store.leaveType(b.type) || {};
                          return (t.code || t.name) + ' ' + b.available;
                        }).join(' · ')))))),
                holidays.length
                  ? h('div', { className: 'ehol' }, holidays.slice(0, 2).map(function (hd) {
                      var n = daysFromToday(hd.date);
                      return h('div', { className: 'ehol__r', key: hd.id || hd.date },
                        h('span', { className: 'ehol__d' },
                          h('b', null, dayOf(hd.date).getDate()),
                          h('span', null, MONTH_ABBR[dayOf(hd.date).getMonth()].toUpperCase())),
                        h('span', { className: 'ehol__m' },
                          h('strong', null, hd.name),
                          h('span', null, dayOf(hd.date).toLocaleDateString('en-GB', { weekday: 'long' })
                            + ' · ' + relDays(n))),
                        h('span', { className: 'adm-p adm-p--' + (hd.type === 'Optional' ? 'sched' : 'ok') },
                          hd.type === 'Optional' ? 'Optional' : 'Office closed'));
                    }))
                  : null)
            : h('div', { className: 'emonth' },
                h('div', { className: 'echips' }, MONTH_TALLY.map(function (t) {
                  return h('div', { className: 'echip', key: t.k },
                    h('b', null, counts[t.k] || 0), h('span', null, t.l));
                })),
                h('p', { className: 'adm-card__foot' },
                  working
                    ? 'Worked ' + worked + ' of ' + working + ' working day' + (working === 1 ? '' : 's')
                      + ' this month. Weekends and holidays are not counted.'
                    : 'The month has not reached a working day yet.')))),

      /* ---- the week, the promises, the shortcuts ---- */
      h('div', { className: 'edash-b' },
        h(MeCard, { title: 'This week',
          right: h('span', { className: 'adm-card__hint' },
            shortWhen(seed.util.iso(weekStart)) + ' – ' + shortWhen(seed.util.iso(seed.util.addDays(weekStart, 4)))) },
          h('div', { className: 'eweek' }, week.map(function (w) {
            var r = w.row;
            var tone = !r ? '' : r.status === 'Holiday' || r.status === 'Weekly Off' ? 'is-off'
              : r.status === 'Absent' ? 'is-bad' : 'is-ok';
            return h('div', { className: 'eweek__r', key: w.iso },
              h('span', { className: 'eweek__d' + (w.iso === today ? ' is-now' : '') }, w.day),
              h('span', { className: 'eweek__t' },
                w.future ? h('span', { className: 'muted' }, '—')
                  : r && r.status === 'Holiday' ? (r.holiday || 'Holiday')
                    : r && r.status === 'Weekly Off' ? 'Weekly off'
                      : r && r.status === 'Absent' ? 'No punches recorded'
                        : r ? r.checkIn + ' – ' + (w.iso === today && !outAt ? 'now' : r.checkOut)
                          : '—'),
              w.future ? h('span', { className: 'eweek__p' })
                : r && r.status === 'Absent'
                  ? h('button', { type: 'button', className: 'linklike eweek__fix',
                      onClick: function () { router.go('me/attendance/regularization'); } }, 'Regularize')
                  : h('span', { className: 'eweek__p ' + tone },
                      w.iso === today ? 'Today'
                        : r && r.status === 'Holiday' ? 'Holiday'
                          : r && r.status === 'Weekly Off' ? 'Off'
                            : r ? r.hours + 'h' : ''));
          }))),

        h(MeCard, { title: 'My goals', count: overdue || undefined, countTone: 'bad',
          right: link('All goals', 'me/performance/goals') },
          goals.length
            ? h(React.Fragment, null,
                h('div', { className: 'egoals' }, goals.slice(0, 3).map(function (g) {
                  var late = g.status !== 'Achieved' && daysFromToday(g.due) < 0;
                  return h('div', { className: 'egoal', key: g.id },
                    h('span', { className: 'egoal__t' },
                      h('strong', null, g.title),
                      h('span', null, (late ? 'Was due ' : 'Due ') + ui.dateLabel(g.due))),
                    h('span', { className: 'egoal__bar' },
                      h('i', { style: { width: g.progress + '%',
                        background: g.progress >= 100 ? 'var(--success-fg)' : late ? 'var(--danger-fg)' : 'var(--brand-solid)' } })),
                    h('b', { className: 'egoal__n' }, g.progress + '%'));
                })),
                h('div', { className: 'row gap-2', style: { marginTop: 14 } },
                  h(V.Button, { variant: 'primary', className: 'vi-btn--sm',
                    onClick: function () { router.go('me/performance/goals'); } }, 'Update progress')))
            : h(ui.Empty, { icon: I.target, title: 'No goals set',
              body: 'Goals for the open cycle appear here once your manager sets them.' })),

        h(MeCard, { title: 'Shortcuts', sub: 'The things people open most' },
          h('div', { className: 'eshort' }, SHORTCUTS.map(function (s) {
            return h('div', { className: 'eshort__r', key: s.t },
              h('span', { className: 'eshort__i' }, s.icon),
              h('span', { className: 'eshort__m' },
                h('strong', null, s.t),
                h('span', null, s.sub(who))),
              h(V.Button, { variant: 'outline', className: 'vi-btn--sm',
                onClick: function () { router.go(s.to); } }, s.act));
          })))),

      /* ---- who is around ---- */
      h(MeCard, { title: 'Around the team',
        sub: (store.department(who.department) || {}).name + ' · next 30 days' },
        h('div', { className: 'eteam__tabs' }, groups.map(function (g) {
          return h('button', { key: g.k, type: 'button',
            className: 'eteam__tab' + (teamSt[0] === g.k ? ' is-on' : ''),
            'aria-pressed': teamSt[0] === g.k ? 'true' : 'false',
            onClick: function () { teamSt[1](g.k); } },
            g.label, h('span', null, g.rows.length));
        })),
        group.rows.length
          ? h('div', { className: 'eteam' }, group.rows.slice(0, 8).map(function (r) {
              return h('div', { className: 'eteam__c', key: r.id },
                h(V.Avatar, { name: r.employee.name, size: 'sm' }),
                h('span', { className: 'eteam__m' },
                  h('strong', null, r.employee.name),
                  h('span', null, r.employee.designation)),
                h('span', { className: 'adm-p adm-p--sched' }, r.tag));
            }))
          : h(ui.Empty, { icon: I.users, title: 'Nothing under ' + group.label.toLowerCase(),
            body: 'Try another tab — the counts show what each one holds.' })));
  }

  HRMS.screens.register({ 'admin/dashboard': AdminDashboard, 'me/dashboard': MeDashboard });
})();

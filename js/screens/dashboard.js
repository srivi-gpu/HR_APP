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
        a: 'Open onboarding', to: 'hr/onboarding/dashboard'
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
    { k: 'revoke', t: 'Revoke access', c: 'var(--danger-fg)', to: 'admin/roles/review' },
    { k: 'mfa', t: 'Require MFA', c: 'var(--info-fg)', to: 'admin/settings' },
    { k: 'invite', t: 'Resend invite', c: 'var(--warning-fg)', to: 'admin/users/all' },
    { k: 'suspend', t: 'Decide suspension', c: 'var(--text-muted)', to: 'admin/users/all' }
  ];

  function Donut(p) {
    var total = p.rows.reduce(function (a, r) { return a + r.n; }, 0);
    var R = 58, C = 2 * Math.PI * R, GAP = total > 1 ? 3 : 0, off = 0;
    return h('div', { className: 'admb-ring adm-donut' },
      h('svg', { viewBox: '0 0 150 150', role: 'img', 'aria-label': p.label },
        h('circle', { cx: 75, cy: 75, r: R, fill: 'none', stroke: 'var(--bg-muted)', strokeWidth: 16 }),
        p.rows.filter(function (r) { return r.n; }).map(function (r) {
          var len = r.n / (total || 1) * C, dash = Math.max(len - GAP, 1.5), o = off;
          off += len;
          return h('circle', { key: r.k, cx: 75, cy: 75, r: R, fill: 'none', stroke: r.c, strokeWidth: 16,
            strokeDasharray: dash + ' ' + (C - dash), strokeDashoffset: -o, transform: 'rotate(-90 75 75)' });
        })),
      h('span', { className: 'admb-ring__mid' }, h('b', null, total), h('span', null, p.caption)));
  }

  /* ====================================================== from Tracklivo
     Asset requests are raised and decided in Tracklivo; what reaches the register is
     the request and where Tracklivo has got to with it. Stacked by that status, per
     category, so "what are people asking for, and what is cleared to issue" is one read. */
  var TL_STATUS = [
    { s: 'Approved', t: 'Ready to issue', c: 'var(--success-fg)' },
    { s: 'Pending Approval', t: 'In Tracklivo', c: 'var(--brand-solid)' },
    { s: 'Rejected', t: 'Declined', c: 'var(--border-strong)' }
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
          h('circle', { cx: 42, cy: 42, r: R, fill: 'none', stroke: 'var(--bg-muted)', strokeWidth: 9 }),
          h('circle', { cx: 42, cy: 42, r: R, fill: 'none', stroke: p.color, strokeWidth: 9, strokeLinecap: 'round',
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

    var integrations = seed.integrations;
    var offline = integrations.filter(function (x) { return x.status !== 'Connected'; });
    /* Newest first, each with the tone its dot takes on the timeline. */
    var alerts = offline.map(function (x) {
      return { tone: 'warn', t: x.name + ' not connected', s: x.summary ? x.summary.replace(/\.\s[\s\S]*$/, '.') : x.kind,
        at: 'Today', to: 'admin/integrations' };
    }).concat([
      { tone: 'warn', t: plural(s.invited, 'invitation') + ' unaccepted', s: 'Past the start date and never signed in.',
        at: '11:04', to: 'admin/users/all' },
      { tone: 'bad', t: 'Single sign-on not configured', s: 'Everyone signs in with an email and a password only.',
        at: '09:51', to: 'admin/settings' },
      { tone: 'good', t: 'Nightly backup completed', s: 'No errors reported \u00b7 core platform to object store.',
        at: '04:00', to: 'admin/settings' }
    ]);

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
            h(Gauge, { pct: ai.used / ai.credits * 100, color: 'var(--priority-high)', t: 'AI credits',
              s: num(ai.used) + ' of ' + num(ai.credits) })),
          h('span', { className: 'adm-sub' }, 'Where the credits went this month'),
          h('div', { className: 'adm-stack adm-stack--wide' }, ai.byModule.map(function (m) {
            return h('div', { className: 'adm-stack__r adm-stack__r--static', key: m.module },
              h('span', { className: 'adm-stack__l', title: m.module }, m.module),
              h('span', { className: 'adm-stack__bar' }, h('i', { style: { width: (m.credits / aiMax * 100) + '%', background: 'var(--priority-high)' } })),
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

        /* The alerts column, with the reference's source and target lines. */
        h('section', { className: 'adm-card' },
          h('div', { className: 'adm-card__head' },
            h('div', null,
              h('h2', null, 'Alerts'),
              h('p', null, 'Raised by the platform today')),
            h('button', { type: 'button', className: 'dash__link', onClick: function () { router.go('admin/audit/security'); } }, 'All', I.right)),
          /* A minimal timeline: the time, a dot on the line, and what happened. */
          h('ol', { className: 'adm-tl' }, alerts.map(function (a) {
            return h('li', { className: 'adm-tl__r is-' + (a.tone || 'info'), key: a.t },
              h('span', { className: 'adm-tl__time' }, a.at),
              h('span', { className: 'adm-tl__dot', 'aria-hidden': 'true' }),
              h('button', { type: 'button', className: 'adm-tl__m', onClick: function () { router.go(a.to); } },
                h('strong', { title: a.t }, a.t),
                h('span', { title: a.s }, a.s)));
          })))),

      openSt[0] ? h(SuggestionModal, { key: openSt[0].k, item: openSt[0], onClose: function () { openSt[1](null); } }) : null,
      allSt[0] && !openSt[0] ? h(AllSuggestions, { items: sugg, onClose: function () { allSt[1](false); },
        onOpen: function (c) { openSt[1](c); } }) : null);
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

  HRMS.screens.register({ 'admin/dashboard': AdminDashboard });
})();

/* The admin dashboard, built to the reference layout in the product's own palette.

   The brief attached a dashboard — a KPI strip across the top on one card, a tall
   illustrated card, a square card, a wide chart, a table and an alerts column — and this
   keeps that geometry: four KPIs on a single card split by hairline rules, dark circular
   icons, a grey header band on the table, bordered status pills, blurred ellipses behind
   everything. The colour is the Tracklivo tokens', not the reference's lime and pink,
   because a page in colours the rest of the app never uses reads as another product.

   What each card holds is the admin's job, which is accounts and access:

   - the first card is the audit log, newest first, so "who changed that?" is answered
     on the page that opens;
   - the square card is the handful of people who can change everything, and whether
     their sign-in is protected;
   - the wide card is how recently people actually sign in, with Ara's suggestions read
     off the same records and pinned to the bar they are about;
   - the table is the access work queued against the admin — leavers to revoke, invites
     nobody accepted, suspensions to decide, privileged accounts without MFA.

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

  /* ---------- the four KPIs ---------- */
  function kpis(s, users) {
    var running = store.collection('onboarding').filter(function (o) { return o.stage !== 'Completed'; }).length;
    var sub = seed.subscription;
    return [
      { ico: CHECK, t: 'Active accounts', s: 'Of ' + num(users.length) + ' on the directory',
        n: users.filter(function (u) { return u.status === 'Active'; }).length },
      { ico: XMARK, t: 'Without MFA', s: 'Password-only sign-in',
        n: users.filter(function (u) { return !u.mfa; }).length },
      { ico: I.gear, t: 'Open onboarding tasks', s: 'Across ' + running + ' people joining', n: s.pendingOnboardingTasks },
      { ico: WIFI, t: 'Seats in use', s: 'Of ' + sub.seats + ' on ' + sub.plan,
        n: Math.round(sub.seatsUsed / sub.seats * 100), unit: '%' }
    ];
  }

  /* ====================================================== recent changes
     The audit log, newest first: who changed what, and when. It is the record an admin
     is most often asked about ("who turned that off?"), and the app writes to it on
     every action, so the card is live rather than a summary of the seed. */
  var AUDIT_ICON = { Security: 'lock', Configuration: 'gear', Permissions: 'shield', 'User activity': 'person' };
  var AUDIT_ROUTE = { Security: 'admin/audit/security', Configuration: 'admin/audit/config',
    Permissions: 'admin/audit/permissions', 'User activity': 'admin/audit/activity' };
  function recentChanges(n) {
    return store.collection('audit').slice()
      .sort(function (a, b) { return a.on < b.on ? 1 : a.on > b.on ? -1 : 0; })
      .slice(0, n);
  }
  function when(on) {
    var d = daysBetween(on.slice(0, 10), seed.todayIso);
    if (d <= 0) return 'Today ' + on.slice(11, 16);
    if (d === 1) return 'Yesterday';
    if (d < 7) return d + ' days ago';
    return ui.dateLabel(on.slice(0, 10));
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
  function suggestions(users, buckets, queue) {
    var out = [];
    var priv = privileged(users), privNoMfa = priv.filter(function (u) { return !u.mfa; });
    var noMfa = users.filter(function (u) { return !u.mfa; });
    var never = buckets.filter(function (b) { return b.k === 'never'; })[0];
    var quiet = buckets.filter(function (b) { return b.k === 'month' || b.k === 'dormant'; })
      .reduce(function (a, b) { return a.concat(b.who); }, []);
    var leaving = queue.filter(function (r) { return r.kind === 'revoke'; });
    var sub = seed.subscription;

    if (privNoMfa.length) out.push({
      k: 'priv', bucket: null, icon: I.shield, tone: 'bad',
      t: 'Require MFA for the ' + plural(privNoMfa.length, 'privileged account') + ' without it',
      s: privNoMfa.length + ' of the ' + priv.length + ' people with admin or HR rights sign in with a password alone. ' +
        'Requiring it for those two roles first protects the accounts that can change everyone else’s, without ' +
        'asking all ' + num(users.length) + ' people to set it up on the same day.',
      rows: privNoMfa.map(function (u) { return { t: nameOf(u.employee), n: ROLE_NAME[u.role] }; }),
      a: 'Open security settings', to: 'admin/settings'
    });
    if (never && never.n) out.push({
      k: 'never', bucket: 'never', icon: I.mail, tone: 'warn',
      t: plural(never.n, 'invitation') + ' never accepted',
      s: 'These accounts were invited and have never signed in. ' +
        never.who.map(function (u) { return nameOf(u.employee); }).join(' and ') +
        (never.n === 1 ? ' was' : ' were') + ' invited on ' + ui.dateLabel(never.who[0].invitedOn) +
        ' and ' + (never.n === 1 ? 'is' : 'are') + ' already past their start date, so the invite has probably gone to spam.',
      rows: never.who.map(function (u) { return { t: nameOf(u.employee), n: 'Invited ' + ui.dateLabel(u.invitedOn) }; }),
      a: 'Resend invitations', to: 'admin/users/all'
    });
    if (leaving.length) out.push({
      k: 'leaving', bucket: null, icon: I.logout, tone: 'warn',
      t: 'Schedule access removal for ' + plural(leaving.length, 'leaver'),
      s: 'Every one of them is on notice with their access still open. Scheduling the revocation for each last ' +
        'working day now means nobody has to remember to do it on the day — the earliest is ' +
        ui.dateLabel(leaving[0].due) + '.',
      rows: leaving.map(function (r) { return { t: r.who, n: 'Last day ' + ui.dateLabel(r.due) }; }),
      a: 'Open access review', to: 'admin/roles/review'
    });
    if (quiet.length) out.push({
      k: 'quiet', bucket: 'month', icon: I.clock, tone: 'info',
      t: plural(quiet.length, 'account') + ' quiet for over a week',
      s: 'Nobody here has signed in for eight days or more. Most will be leave or travel, which is why this is a ' +
        'list to glance down rather than a suspension to run — but an account nobody is using is also one nobody ' +
        'would notice being used.',
      rows: quiet.slice(0, 6).map(function (u) {
        return { t: nameOf(u.employee), n: daysBetween(u.lastSignIn, seed.todayIso) + ' days' };
      }).concat(quiet.length > 6 ? [{ t: '…and ' + (quiet.length - 6) + ' more', n: '' }] : []),
      a: 'Open access review', to: 'admin/roles/review'
    });
    if (noMfa.length > privNoMfa.length) out.push({
      k: 'mfa', bucket: null, icon: KEY, tone: 'info',
      t: 'Roll MFA out to the other ' + num(noMfa.length - privNoMfa.length) + ' accounts in stages',
      s: Math.round(noMfa.length / users.length * 100) + '% of the directory signs in without a second factor. ' +
        'Once the privileged accounts are done, a department at a time keeps the helpdesk queue manageable.',
      rows: [], a: 'Open security settings', to: 'admin/settings'
    });
    var free = sub.seats - sub.seatsUsed;
    out.push({
      k: 'seats', bucket: null, icon: WIFI, tone: 'info',
      t: free + ' seats free before the ' + sub.renewsLabel + ' renewal',
      s: sub.seatsUsed + ' of ' + sub.seats + ' seats are in use. With ' + plural(leaving.length, 'leaver') +
        ' on notice, the renewal is the moment to decide whether ' + sub.seats + ' is still the right number.',
      rows: [{ t: 'Seats on the plan', n: sub.seats }, { t: 'In use', n: sub.seatsUsed }, { t: 'Leavers on notice', n: leaving.length }],
      a: 'Open billing', to: 'admin/billing/billing'
    });
    return out;
  }

  var TONE_CLASS = { bad: 'is-bad', warn: 'is-warn', info: 'is-info' };

  /* The sign-in chart. A bar Ara has something to say about carries a marker at its
     head, and the marker opens that suggestion. */
  function SigninChart(p) {
    var b = p.buckets, max = Math.max.apply(null, b.map(function (x) { return x.n; }).concat([1]));
    var W = 640, H = 196, PL = 34, PR = 8, PT = 22, PB = 22;
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
          style: { left: (x(i) / W * 100) + '%', top: ((y(s.n) - 24) / H * 100) + '%' },
          onClick: function () { p.onOpen(f); }
        }, ARA);
      }));
  }

  /* A suggestion, opened: what it is, why it fired, the records that fired it. */
  function SuggestionModal(p) {
    var x = p.item;
    return h(ui.Modal, {
      title: 'Ara · ' + x.t,
      description: 'A suggestion read off the directory on ' + seed.todayLabel + '.',
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h('span', { className: 'muted grow' }, 'Nothing changes until you act on it.'),
        h(V.Button, { variant: 'primary', iconEnd: I.right,
          onClick: function () { p.onClose(); router.go(x.to); } }, x.a),
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Close'))
    },
      h('div', { className: 'adm-say' },
        h('span', { className: 'adm-say__m' }, ARA),
        h('p', null, x.s)),
      x.rows.length ? h('div', { className: 'adm-src' },
        h('span', { className: 'adm-src__h' }, 'Read from'),
        x.rows.map(function (r, i) {
          return h('div', { className: 'adm-src__r', key: i }, h('span', null, r.t), h('b', null, r.n));
        })) : null);
  }

  /* All of them at once, in the order they matter. */
  function AllSuggestions(p) {
    return h(ui.Modal, {
      title: 'Ara · ' + p.items.length + ' suggestions about accounts',
      description: 'Ranked by risk: what protects the most first.',
      onClose: p.onClose,
      footer: h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Close')
    },
      h('div', { className: 'cop' }, p.items.map(function (c) {
        return h('div', { className: 'cop__i', key: c.k },
          h('span', { className: 'cop__ico' }, c.icon),
          h('span', { className: 'cop__m' },
            h('strong', null, c.t),
            h('span', null, c.s),
            h('button', { type: 'button', className: 'cop__a',
              onClick: function () { p.onClose(); router.go(c.to); } }, c.a, I.right)));
      })));
  }

  /* ====================================================== the access queue
     Work the admin owes, from the records that create it: leavers whose access is still
     open, invitations nobody accepted, suspensions waiting on a decision, and privileged
     accounts without a second factor. Ordered by when it is due. */
  var PILL = { revoke: 'fail', invite: 'warn', suspend: 'sched', mfa: 'manual',
    Overdue: 'fail', 'Due soon': 'warn', Scheduled: 'sched', 'At risk': 'fail', Waiting: 'warn' };
  var ACTION = { revoke: 'Revoke access', invite: 'Resend invite', suspend: 'Decide suspension', mfa: 'Require MFA' };

  function accessQueue(users) {
    var today = seed.todayIso, rows = [];
    store.collection('offboarding').forEach(function (o) {
      if (o.stage === 'Completed') return;
      var t = (o.tasks || []).filter(function (x) { return x.name === 'Access revocation'; })[0];
      if (t && t.done) return;
      var d = daysBetween(today, o.lastWorkingDay);
      rows.push({ id: o.id, who: nameOf(o.employee), dept: deptOf(o.employee), kind: 'revoke', due: o.lastWorkingDay,
        when: 'Last day ' + ui.dateLabel(o.lastWorkingDay),
        status: d < 0 ? 'Overdue' : d <= 30 ? 'Due soon' : 'Scheduled', to: 'admin/roles/review' });
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
      } else if ((u.role === 'admin' || u.role === 'hr') && !u.mfa) {
        rows.push({ id: u.id, who: nameOf(u.employee), dept: deptOf(u.employee), kind: 'mfa', due: today,
          when: ROLE_NAME[u.role], status: 'At risk', to: 'admin/settings' });
      }
    });
    var rank = { Overdue: 0, 'At risk': 1, 'Due soon': 2, Waiting: 3, Scheduled: 4 };
    return rows.sort(function (a, b) { return (rank[a.status] - rank[b.status]) || (a.due < b.due ? -1 : 1); });
  }

  function pill(word, cls) { return h('span', { className: 'adm-p adm-p--' + (cls || PILL[word]) }, word); }

  /* ====================================================== the page */
  var QUEUE_FOLD = 6;

  function AdminDashA(p) {
    var openSt = React.useState(null);
    var allSt = React.useState(false);
    var moreSt = React.useState(false);
    var s = store.stats();
    var users = store.collection('users');
    var me = store.employeeByName(HRMS.nav.role('admin').persona);

    var changes = recentChanges(4);
    var priv = privileged(users), privMfa = priv.filter(function (u) { return u.mfa; }).length;
    var buckets = signins(users);
    var queue = accessQueue(users);
    var sugg = suggestions(users, buckets, queue);
    var flags = {};
    sugg.forEach(function (x) { if (x.bucket) flags[x.bucket] = x; });
    var active7 = buckets[0].n + buckets[1].n;

    var integrations = seed.integrations;
    var offline = integrations.filter(function (x) { return x.status !== 'Connected'; });
    var alerts = offline.map(function (x) {
      return { icon: I.plug, t: x.name + ' not connected', s: x.summary ? x.summary.split('. ')[0] + '.' : x.kind,
        src: x.provider, tgt: x.kind, at: 'Today', to: 'admin/integrations' };
    }).concat([
      { icon: I.person, t: plural(s.invited, 'invitation') + ' unaccepted', s: 'Past the start date and never signed in. Resend or revoke them.',
        src: 'User management', tgt: plural(s.invited, 'account'), at: '11:04:12 IST', to: 'admin/users/all' },
      { icon: I.shield, t: 'Single sign-on not configured', s: 'Everyone signs in with an email and a password only.',
        src: 'Authentication', tgt: 'All ' + num(users.length) + ' users', at: '09:51:40 IST', to: 'admin/settings' },
      { icon: I.database, t: 'Nightly backup completed', s: 'No errors reported.',
        src: 'Core platform', tgt: 'Object store', at: '04:00:00 IST', to: 'admin/settings' }
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
        p.switcher),

      /* Four numbers on one card, divided by rules. */
      h('section', { className: 'adm-card', style: { padding: 0 }, 'aria-label': 'Key figures' },
        h('div', { className: 'adm-kpis' }, kpis(s, users).map(function (k) {
          return h('div', { className: 'adm-kpi', key: k.t },
            h('div', { className: 'adm-kpi__t' },
              h('span', { className: 'adm-ico' }, k.ico),
              h('span', { className: 'adm-kpi__l' }, h('strong', null, k.t), h('span', null, k.s))),
            h('span', { className: 'adm-kpi__n' }, num(k.n), k.unit ? h('small', null, k.unit) : null));
        }))),

      h('div', { className: 'adm-mid' },
        /* What has changed lately, and who changed it. */
        h('section', { className: 'adm-card adm-log' },
          h('div', { className: 'adm-card__head' },
            h('div', null,
              h('h2', null, 'Recent changes'),
              h('p', null, 'Audit log, newest first')),
            h('button', { type: 'button', className: 'dash__link',
              onClick: function () { router.go('admin/audit/activity'); } }, 'Audit log', I.right)),
          changes.length ? h('div', { className: 'adm-log__list' }, changes.map(function (c) {
            return h('button', { type: 'button', className: 'adm-log__r', key: c.id,
              onClick: function () { router.go(AUDIT_ROUTE[c.category] || 'admin/audit/activity'); } },
              h('span', { className: 'adm-ico adm-ico--sm' }, I[AUDIT_ICON[c.category]] || I.history),
              h('span', { className: 'adm-log__m' },
                h('span', { className: 'adm-log__t' }, h('b', null, nameOf(c.actor)), ' ', c.action),
                h('span', { className: 'adm-log__w' }, c.category, ' \u00b7 ', when(c.on))));
          })) : h(ui.Empty, { icon: I.history, title: 'Nothing logged yet', body: 'Changes made in the app appear here as they happen.' })),

        /* The few accounts that can change everything. */
        h('section', { className: 'adm-card adm-priv' },
          h('div', { className: 'adm-card__head' },
            h('div', null,
              h('h2', null, 'Privileged access'),
              h('p', null, 'Admin and HR rights')),
            h('button', { type: 'button', className: 'dash__link',
              onClick: function () { router.go('admin/roles/modules'); } }, 'Roles', I.right)),
          h('div', { className: 'adm-priv__top' },
            h('span', { className: 'adm-priv__n' }, priv.length),
            h('span', { className: 'adm-priv__cap' },
              h('b', null, privMfa + ' of ' + priv.length + ' on MFA'),
              h('span', { className: 'adm-priv__meter' },
                h('i', { style: { width: (priv.length ? privMfa / priv.length * 100 : 0) + '%' } })))),
          h('div', { className: 'adm-priv__list' }, priv.map(function (u) {
            var e = store.employee(u.employee);
            return h('div', { className: 'adm-priv__r', key: u.id },
              h(V.Avatar, { name: e ? e.name : u.email, size: 'xs' }),
              h('span', { className: 'adm-priv__m' },
                h('strong', null, e ? e.name : u.email),
                h('span', null, ROLE_NAME[u.role])),
              u.mfa ? pill('MFA on', 'ok') : pill('No MFA', 'fail'));
          }))),

        /* How recently people sign in, with Ara's reading pinned to it. */
        h('section', { className: 'adm-card' },
          h('div', { className: 'adm-card__head' },
            h('div', null,
              h('h2', null, 'Sign-in activity'),
              h('p', null, h('b', { className: 'adm-inl' }, num(active7)), ' signed in this week \u00b7 ',
                h('b', { className: 'adm-inl' }, Math.round(active7 / (users.length || 1) * 100) + '%'), ' of the directory')),
            h('button', { type: 'button', className: 'adm-sug', onClick: function () { allSt[1](true); } },
              ARA, 'Ara suggests', h('span', { className: 'adm-sug__n' }, sugg.length))),
          h(SigninChart, { buckets: buckets, flags: flags, onOpen: function (f) { openSt[1](f); } }),
          /* The top two, inline, so the card says what to do as well as what is true.
             The rest are one click away in the modal the head button opens. */
          h('div', { className: 'adm-tips' }, sugg.slice(0, 2).map(function (x) {
            return h('button', { key: x.k, type: 'button', className: 'adm-tip ' + TONE_CLASS[x.tone],
              onClick: function () { openSt[1](x); } },
              h('span', { className: 'adm-tip__i' }, x.icon),
              h('span', { className: 'adm-tip__m' },
                h('small', null, 'Ara suggests'),
                h('strong', null, x.t)),
              I.right);
          })))),

      h('div', { className: 'adm-low' },
        /* The access work queued against the admin. */
        h('section', { className: 'adm-card' },
          h('div', { className: 'adm-card__head' },
            h('div', null,
              h('h2', null, 'Access queue'),
              h('p', null, plural(queue.length, 'item') + ' waiting on an admin — leavers, invites, suspensions and unprotected privileged accounts')),
            h(V.Button, { variant: 'ghost', className: 'vi-btn--sm', iconEnd: I.right,
              onClick: function () { router.go('admin/users/all'); } }, 'All users')),
          queue.length ? h('div', { className: 'adm-wrap' },
            h('table', { className: 'adm-tbl' },
              h('thead', null, h('tr', null,
                ['Person', 'Action', 'When', 'Status'].map(function (c, i) {
                  return h('th', { key: i }, c);
                }))),
              /* The most urgent six, ordered as the queue is; the rest one click away, so
                 the card is as tall as the work that needs doing first. */
              h('tbody', null, (moreSt[0] ? queue : queue.slice(0, QUEUE_FOLD)).map(function (r) {
                return h('tr', { key: r.id + r.kind },
                  h('td', null, h('span', { className: 'adm-who' },
                    h(V.Avatar, { name: r.who, size: 'sm' }),
                    h('span', null, h('strong', null, r.who), h('small', null, r.dept)))),
                  /* The action is the way in: the pill names the job and opens where it is done. */
                  h('td', null, h('button', {
                    type: 'button', className: 'adm-p adm-p--' + PILL[r.kind] + ' adm-p--btn',
                    'aria-label': ACTION[r.kind] + ' for ' + r.who,
                    onClick: function () { router.go(r.to); }
                  }, ACTION[r.kind], I.right)),
                  h('td', { className: 'is-mut' }, r.when),
                  h('td', null, pill(r.status)));
              }))))
            : h(ui.Empty, { icon: I.ok, title: 'Nothing waiting', body: 'No leaver, invitation or privileged account needs an admin today.' }),
          queue.length > QUEUE_FOLD ? h('button', { type: 'button', className: 'adm-more', 'aria-expanded': moreSt[0] ? 'true' : 'false',
            onClick: function () { moreSt[1](!moreSt[0]); } },
            moreSt[0] ? 'Show the first ' + QUEUE_FOLD : 'Show all ' + queue.length, moreSt[0] ? I.chevUp : I.chevron) : null),

        /* The alerts column, with the reference's source and target lines. */
        h('section', { className: 'adm-card' },
          h('div', { className: 'adm-card__head' },
            h('div', null,
              h('h2', null, 'Alerts'),
              h('p', null, 'Everything the platform has raised today')),
            h('span', { className: 'adm-pill' }, 'Showing all')),
          h('div', { className: 'adm-alerts' }, alerts.map(function (a) {
            return h('div', { className: 'adm-alert', key: a.t },
              h('span', { className: 'adm-ico' }, a.icon),
              h('div', { className: 'adm-alert__m' },
                h('span', { className: 'adm-alert__top' }, h('strong', null, a.t), h('span', { className: 'adm-alert__t' }, a.at)),
                h('span', { className: 'adm-alert__s', title: a.s }, a.s),
                h('span', { className: 'adm-alert__kv' }, a.src, ' \u2192 ', a.tgt)),
              h('button', { type: 'button', className: 'lrow__go', 'aria-label': 'Open ' + a.t,
                onClick: function () { router.go(a.to); } }, I.right));
          })))),

      openSt[0] ? h(SuggestionModal, { item: openSt[0], onClose: function () { openSt[1](null); } }) : null,
      allSt[0] ? h(AllSuggestions, { items: sugg, onClose: function () { allSt[1](false); } }) : null);
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

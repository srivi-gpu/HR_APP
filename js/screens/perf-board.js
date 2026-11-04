/* Performance standings, badges and rewards — the same screens for both workspaces,
   showing each role what it is entitled to see.

   The form is borrowed from the Tracklivo prototype: a podium over a ranked table, a
   badge cabinet in five tiers where a locked badge still states its rule and how close
   you are, and a points balance that buys things from a catalogue. What differs is
   where the numbers come from — js/perf.js reads records this application already
   keeps rather than a project board — and who sees whom.

   An employee sees their own department ranked by name, with their row called out. HR
   sees the whole organization and can narrow it to a department. Neither sees a score
   without its workings: every dimension opens to what it measured and where from,
   because a number nobody can trace is a number nobody acts on. */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var store = HRMS.store, ui = HRMS.ui, perf = HRMS.perf, seed = HRMS.seed;
  var Card = ui.Card, Grid = ui.Grid, Stat = ui.Stat, Stats = ui.Stats;

  function me() { return store.persona('me'); }
  function emp(id) { return store.employee ? store.employee(id) : store.find('employees', id); }
  function deptName(id) { var d = store.find('departments', id); return d ? d.name : 'No department'; }
  /* A band's tone is a status colour; a Stat only knows good and warn. */
  function statTone(t) { return t === 'success' ? 'good' : t === 'info' ? null : 'warn'; }

  /* ------------------------------------------------------------------- Plate
     A badge is a hexagonal plate whose colour is its tier and whose glyph is what it
     is for. A locked one keeps its shape and goes grey with a question mark, so the
     cabinet reads as a set with gaps rather than a list of things you have. */
  var GLYPH = {
    check:  'M18 33l9 9 19-20',
    bolt:   'M35 13L19 37h11l-2 14 16-23H33z',
    flame:  'M32 12c6 9 13 11 13 20a13 13 0 1 1-26 0c0-6 4-8 6-12 1 4 3 6 4 6 2 0 1-8 3-14z',
    users:  'M25 33a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm15-1a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 47c1-8 7-10 13-10s12 2 13 10m4 0c-.6-6-2-8-5-10',
    book:   'M12 17h14c4 0 6 2 6 5v25c0-3-2-5-6-5H12zm40 0H38c-4 0-6 2-6 5v25c0-3 2-5 6-5h14z',
    bulb:   'M32 12a13 13 0 0 1 8 23v5H24v-5a13 13 0 0 1 8-23zM26 47h12M28 52h8',
    target: 'M32 13a19 19 0 1 1 0 38 19 19 0 0 1 0-38zm0 10a9 9 0 1 1 0 18 9 9 0 0 1 0-18z',
    gem:    'M22 16h20l9 12-19 21-19-21zM13 28h38M22 16l10 12 10-12',
    rocket: 'M32 11c8 6 12 14 12 23l-5 7H25l-5-7c0-9 4-17 12-23zM32 27a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM25 45l-5 8 9-3m10-5l5 8-9-3',
    shield: 'M32 11l17 7v15c0 10-8 17-17 20-9-3-17-10-17-20V18zM24 32l6 6 11-12',
    clock:  'M32 13a19 19 0 1 1 0 38 19 19 0 0 1 0-38zM32 21v12l9 6',
    hand:   'M24 34V18a4 4 0 0 1 8 0v12m0-4a4 4 0 0 1 8 0v6m0-4a4 4 0 0 1 8 0v12c0 8-6 13-14 13s-14-5-14-13v-8'
  };
  var FILLED = { bolt: 1, flame: 1 };

  function Plate(p) {
    var t = perf.TIER[p.tier] || perf.TIER[1];
    var size = p.size || 56, on = p.on !== false;
    var gid = 'pl' + p.tier + (on ? 'y' : 'n');
    return h('span', { className: 'plate' + (on ? '' : ' is-off'), style: { width: size, height: size } },
      h('svg', { viewBox: '0 0 64 64', width: size, height: size, 'aria-hidden': 'true' },
        h('defs', null,
          h('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 },
            h('stop', { offset: '0%', stopColor: '#fff', stopOpacity: 0.5 }),
            h('stop', { offset: '100%', stopColor: '#000', stopOpacity: 0.16 }))),
        h('path', { d: 'M32 4l25 14v28L32 60 7 46V18z', fill: on ? t.glow : 'var(--bg-subtle)' }),
        h('path', { d: 'M32 4l25 14v28L32 60 7 46V18z', fill: 'url(#' + gid + ')' }),
        h('path', { d: 'M32 11l18 10v22L32 53 14 43V21z', fill: 'none',
          stroke: on ? '#fff' : 'var(--border-subtle)', strokeOpacity: on ? 0.45 : 1, strokeWidth: 1.4 }),
        h('g', { transform: 'translate(32 32) scale(.62) translate(-32 -32)',
          style: { color: on ? t.ink : 'var(--text-muted)' } },
          p.locked
            ? h('text', { x: 32, y: 44, textAnchor: 'middle', fontSize: 34, fill: 'currentColor', opacity: 0.55 }, '?')
            : h('path', { d: GLYPH[p.g] || GLYPH.check, fill: FILLED[p.g] ? 'currentColor' : 'none',
              stroke: 'currentColor', strokeWidth: FILLED[p.g] ? 2 : 4.6,
              strokeLinecap: 'round', strokeLinejoin: 'round' }))));
  }

  /* --------------------------------------------------------------- Score dial
     The score, its band, and the seven dimensions underneath it. Every row says what
     it measured and where that came from, so the number can be argued with. */
  function ScoreBreakdown(p) {
    var person = p.employee;
    var sc = perf.score(person), bd = perf.band(sc), parts = perf.parts(person);
    var m = perf.measures(person), cap = perf.capFor(m.policiesOverdue);
    return h('div', { className: 'pscore' },
      h('div', { className: 'pscore__dim' }, perf.INPUTS.map(function (i) {
        var v = parts[i.k];
        return h('div', { className: 'pdim', key: i.k },
          h('span', { className: 'pdim__n' }, i.label,
            h('i', { className: 'pdim__k' }, i.kind === 'rated' ? 'rated' : 'measured')),
          h('span', { className: 'pdim__w' }, i.w, '%'),
          h('span', { className: 'pdim__t' },
            v == null ? null : h('i', { style: { width: Math.max(v, 2) + '%' } })),
          h('span', { className: 'pdim__v' + (v == null ? ' is-none' : '') }, v == null ? 'Not rated' : v),
          h('span', { className: 'pdim__h' }, i.how, ' · ', i.from));
      })),
      cap.max < 100 ? h('p', { className: 'pscore__cap' },
        h('strong', null, cap.review), ' — ', m.policiesOverdue,
        m.policiesOverdue === 1 ? ' policy is' : ' policies are',
        ' past the date they were due, so the score is capped at ', cap.max, '.') : null,
      h('p', { className: 'pscore__band' }, bd.label, ' · ', bd.use));
  }

  /* -------------------------------------------------------------- The cabinet */
  function Cabinet(p) {
    var person = p.employee;
    var list = perf.badgesFor(person).slice().sort(function (a, b) {
      return (b.on - a.on) || (b.b.t - a.b.t) || b.prog - a.prog;
    });
    var got = list.filter(function (x) { return x.on; });
    return h(ui.Drawer, { title: p.title || (person.name + ' · badges'), onClose: p.onClose },
      h('p', { className: 'pcab__h' }, got.length, ' of ', list.length, ' earned · ',
        perf.badgePoints(person), ' badge points'),
      h('div', { className: 'pcab' }, list.map(function (x) {
        var t = perf.TIER[x.b.t];
        return h('div', { className: 'pcab__i' + (x.on ? '' : ' is-off'), key: x.b.k },
          h(Plate, { tier: x.b.t, g: x.b.g, on: x.on, locked: !x.on, size: 54 }),
          h('div', { className: 'pcab__m' },
            h('strong', null, x.b.n,
              h('span', { className: 'pcab__t', style: { color: t.ink } }, t.name)),
            h('span', { className: 'pcab__r' }, x.b.rule),
            x.on
              ? h('span', { className: 'pcab__on' }, 'Earned ', perf.earnedOn(person, x.b), ' · ', x.now)
              : h('span', { className: 'pcab__p' },
                h('i', null, h('u', { style: { width: Math.round(x.prog * 100) + '%' } })),
                h('b', null, x.now))));
      })));
  }

  /* ---------------------------------------------------------------- The board
     Top three on a podium, in the order a podium is actually built — second, first,
     third — then everyone else as rows. The viewer's own row is marked wherever it
     falls, and the header says their rank even when it is far down the list. */
  function Podium(p) {
    var row = p.row, place = p.place;
    var top = perf.badgesFor(row.employee).filter(function (x) { return x.on; })
      .sort(function (a, b) { return b.b.t - a.b.t; }).slice(0, 3);
    return h('button', { type: 'button', className: 'ppod ppod--' + place + (p.isMe ? ' is-me' : ''),
      onClick: function () { p.onOpen(row); } },
      h('span', { className: 'ppod__r' }, place),
      h(V.Avatar, { name: row.employee.name, size: 'md' }),
      h('strong', { className: 'ppod__n' }, row.employee.name),
      h('span', { className: 'ppod__d' }, row.employee.designationName || deptName(row.employee.department)),
      h('span', { className: 'ppod__s' }, row.score),
      h('span', { className: 'ppod__b' }, top.map(function (x) {
        return h(Plate, { key: x.b.k, tier: x.b.t, g: x.b.g, size: 26 });
      })),
      h('span', { className: 'ppod__p' }));
  }

  function Board(p) {
    var rows = p.rows, mine = p.me;
    var openSt = React.useState(null);
    var myRank = mine ? perf.rankOf(rows, mine) : null;
    if (!rows.length) {
      return h(ui.Empty, { icon: I.target, title: 'Nobody to rank yet',
        body: 'A score needs goals, attendance and a cycle behind it.' });
    }
    var top = rows.slice(0, 3), rest = rows.slice(3);
    var order = [top[1], top[0], top[2]].filter(Boolean);

    return h('div', { className: 'pboard' },
      h('header', { className: 'pboard__h' },
        h('span', { className: 'stack grow' },
          h('strong', null, p.title),
          h('span', { className: 'pboard__s' }, p.note)),
        myRank ? h('button', { type: 'button', className: 'pboard__me',
          onClick: function () { openSt[1](rows[myRank - 1]); } },
          h('i', null, 'You are'), h('b', null, '#', myRank),
          h('span', null, perf.badgeCount(mine), ' of ', perf.BADGES.length, ' badges')) : null),

      h('div', { className: 'pboard__pod' }, order.map(function (r) {
        return h(Podium, { key: r.employee.id, row: r, place: top.indexOf(r) + 1,
          isMe: mine && r.employee.id === mine.id, onOpen: function (x) { openSt[1](x); } });
      })),

      rest.length ? h('div', { className: 'pboard__rest' },
        h('div', { className: 'pboard__restH' },
          h('span', { className: 'grow' }, 'Everyone else on the board'),
          h('span', null, 'Open a row for the score and the badges behind it')),
        rest.map(function (r) {
          var isMe = mine && r.employee.id === mine.id;
          var badges = perf.badgesFor(r.employee).filter(function (x) { return x.on; })
            .sort(function (a, b) { return b.b.t - a.b.t; });
          return h('button', { type: 'button', key: r.employee.id,
            className: 'prow' + (isMe ? ' is-me' : ''), onClick: function () { openSt[1](r); } },
            h('span', { className: 'prow__r' }, r.rank),
            h(V.Avatar, { name: r.employee.name, size: 'xs' }),
            h('span', { className: 'stack grow', style: { gap: 0, minWidth: 0 } },
              h('strong', null, r.employee.name, isMe ? h('span', { className: 'prow__you' }, 'You') : null),
              h('span', { className: 'prow__d' }, deptName(r.employee.department))),
            h('span', { className: 'prow__bar' },
              h('i', { style: { width: Math.max(r.score, 4) + '%' } }), h('b', null, r.score)),
            h('span', { className: 'prow__t is-' + (r.trend.delta > 3 ? 'up' : r.trend.delta < -3 ? 'down' : 'flat') },
              r.trend.delta > 3 ? '↑' : r.trend.delta < -3 ? '↓' : '→', ' ', r.trend.word),
            h('span', { className: 'prow__b' }, badges.slice(0, 4).map(function (x) {
              return h(Plate, { key: x.b.k, tier: x.b.t, g: x.b.g, size: 24 });
            }), badges.length > 4 ? h('u', null, '+', badges.length - 4) : null),
            h('span', { className: 'prow__go' }, I.right));
        })) : null,

      openSt[0] ? h(PersonSheet, { row: openSt[0], onClose: function () { openSt[1](null); } }) : null);
  }

  /* What a row opens into: the score with its workings, the trend, and the badges. */
  function PersonSheet(p) {
    var row = p.row, person = row.employee;
    var badgeSt = React.useState(false);
    var list = perf.badgesFor(person);
    var got = list.filter(function (x) { return x.on; });
    return h(ui.Drawer, { title: person.name, onClose: p.onClose },
      h('div', { className: 'psheet' },
        h(Stats, null,
          h(Stat, { label: 'Rank', value: '#' + row.rank }),
          h(Stat, { label: 'Score', value: row.score, tone: statTone(perf.band(row.score).tone),
            sub: perf.band(row.score).label }),
          h(Stat, { label: 'Trend', value: row.trend.word,
            sub: (row.trend.delta > 0 ? '+' : '') + row.trend.delta + ' over six months' }),
          h(Stat, { label: 'Badges', value: got.length + ' of ' + list.length,
            sub: perf.badgePoints(person) + ' badge points' })),
        row.settled ? null : h('p', { className: 'pnote' },
          person.name.split(' ')[0], ' has been here ', perf.measures(person).tenureMonths,
          ' months. A score needs ', perf.MIN_MONTHS,
          ' before it settles, so this one is shown but does not count towards a reward.'),
        h('div', { className: 'pbwall' }, list.slice().sort(function (a, b) {
          return (b.on - a.on) || (b.b.t - a.b.t);
        }).map(function (x) {
          return h('button', { type: 'button', key: x.b.k, className: 'pbwall__i' + (x.on ? '' : ' is-off'),
            title: x.on ? x.b.n + ' · ' + perf.TIER[x.b.t].name : 'Locked — ' + x.b.rule,
            onClick: function () { badgeSt[1](true); } },
            h(Plate, { tier: x.b.t, g: x.b.g, on: x.on, locked: !x.on, size: 46 }),
            h('span', null, x.b.n));
        })),
        h(ScoreBreakdown, { employee: person })),
      badgeSt[0] ? h(Cabinet, { employee: person, onClose: function () { badgeSt[1](false); } }) : null);
  }

  /* ------------------------------------------------------------ Period picker
     The period does not change the numbers in this prototype — the records behind
     them are a single snapshot — so rather than draw a control that does nothing, the
     board says which window it is reading. */
  function PeriodNote(p) {
    return h('span', { className: 'ad-sub' }, p.children);
  }

  /* ========================================================= Employee: standing */
  function MyStanding() {
    var person = me();
    if (!person) return h(ui.Empty, { icon: I.target, title: 'No employee record' });
    var cabSt = React.useState(false);
    var sc = perf.score(person), bd = perf.band(sc), tr = perf.trendOf(person);
    var list = perf.badgesFor(person), got = list.filter(function (x) { return x.on; });
    var peers = store.collection('employees').filter(function (e) {
      return e.department === person.department && e.status !== 'Exited';
    });
    var rows = perf.standings(peers), rank = perf.rankOf(rows, person);
    var next = list.filter(function (x) { return !x.on; })
      .sort(function (a, b) { return b.prog - a.prog; })[0];

    return h('div', { className: 'stack gap-4' },
      h(ui.PageHead, { eyebrow: 'Performance', title: 'Where you stand',
        description: 'Your score, what it is made of, and the badges you have earned.' }),
      h(Stats, null,
        h(Stat, { label: 'Score', value: sc, tone: statTone(bd.tone), sub: bd.label }),
        h(Stat, { label: 'In ' + deptName(person.department), value: '#' + rank + ' of ' + rows.length }),
        h(Stat, { label: 'Trend', value: tr.word, sub: (tr.delta > 0 ? '+' : '') + tr.delta + ' over six months' }),
        h(Stat, { label: 'Badges', value: got.length + ' of ' + list.length,
          sub: perf.badgePoints(person) + ' badge points' })),
      perf.settled(person) ? null : h('p', { className: 'pnote' },
        'You have been here ', perf.measures(person).tenureMonths, ' months. A score needs ',
        perf.MIN_MONTHS, ' before it settles — yours is shown, but it does not count towards a reward yet.'),
      h(Grid, null,
        h(Card, { span: 7, title: 'What the score is made of',
          description: 'Seven dimensions, weighted. Five are measured; two are judged.' },
          h(ScoreBreakdown, { employee: person })),
        h(Card, { span: 5, title: 'Badges',
          description: next ? 'Closest to earning: ' + next.b.n + ' — ' + next.now : 'Every badge earned.',
          aside: h(V.Button, { variant: 'ghost', className: 'vi-btn--sm',
            onClick: function () { cabSt[1](true); } }, 'See all') },
          h('div', { className: 'pbwall' }, list.slice().sort(function (a, b) {
            return (b.on - a.on) || (b.b.t - a.b.t);
          }).map(function (x) {
            return h('button', { type: 'button', key: x.b.k, className: 'pbwall__i' + (x.on ? '' : ' is-off'),
              title: x.on ? x.b.n + ' · ' + perf.TIER[x.b.t].name : 'Locked — ' + x.b.rule,
              onClick: function () { cabSt[1](true); } },
              h(Plate, { tier: x.b.t, g: x.b.g, on: x.on, locked: !x.on, size: 48 }),
              h('span', null, x.b.n));
          })))),
      cabSt[0] ? h(Cabinet, { employee: person, title: 'Your badges',
        onClose: function () { cabSt[1](false); } }) : null);
  }

  /* ========================================================== Employee: board */
  function MyBoard() {
    var person = me();
    if (!person) return h(ui.Empty, { icon: I.target, title: 'No employee record' });
    var peers = store.collection('employees').filter(function (e) {
      return e.department === person.department && e.status !== 'Exited';
    });
    var rows = perf.standings(peers);
    return h('div', { className: 'stack gap-4' },
      h(ui.PageHead, { eyebrow: 'Performance', title: 'Leaderboard',
        description: 'Your department, by score.' }),
      h(Board, { rows: rows, me: person, title: deptName(person.department),
        note: rows.length + ' people, ranked by performance score — this cycle.' }));
  }

  /* ======================================================== Employee: rewards */
  function MyRewards() {
    var person = me();
    if (!person) return h(ui.Empty, { icon: I.target, title: 'No employee record' });
    var pts = perf.points(person), left = perf.balance(person);
    var tier = perf.rewardTier(pts), next = perf.nextTier(pts);
    var mine = perf.claimsOf(person);
    var sc = perf.score(person), got = perf.badgeCount(person);

    function claim(item) {
      var res = HRMS.actions && HRMS.actions.claimReward
        ? HRMS.actions.claimReward(person.id, item)
        : null;
      if (res) { ui.report(res); return; }
      store.add('rewardClaims', {
        id: store.nextId('RW'), employee: person.id, reward: item.k, cost: item.cost,
        raised: seed.todayIso, status: 'Awaiting approval', approver: person.manager, note: null
      });
      ui.toast(item.name + ' claimed. It is with your manager.', 'success');
    }

    return h('div', { className: 'stack gap-4' },
      h(ui.PageHead, { eyebrow: 'Performance', title: 'Rewards',
        description: 'Points come from badges, goals finished and recognition. They only go up.' }),
      h(Stats, null,
        h(Stat, { label: 'Points earned', value: pts, sub: tier.n }),
        h(Stat, { label: 'Available to spend', value: left,
          sub: pts - left ? (pts - left) + ' claimed' : 'Nothing claimed yet' }),
        h(Stat, { label: 'Score', value: sc, tone: statTone(perf.band(sc).tone), sub: perf.band(sc).label }),
        h(Stat, { label: 'Badges', value: got + ' of ' + perf.BADGES.length })),
      next ? h('div', { className: 'ptier' },
        h('span', { className: 'ptier__l' }, tier.n, ' → ', next.n),
        h('span', { className: 'ptier__t' },
          h('i', { style: { width: Math.round((pts - tier.at) / (next.at - tier.at) * 100) + '%' } })),
        h('span', { className: 'ptier__n' }, (next.at - pts), ' points to ', next.n)) : null,
      h(Grid, null,
        h(Card, { span: 7, title: 'What points buy',
          description: 'Each needs a balance, a score and a number of badges, all three at once.' },
          h('div', { className: 'prw' }, perf.CATALOGUE.map(function (item) {
            var why = perf.blockers(person, item), can = !why.length;
            return h('div', { className: 'prw__i' + (can ? '' : ' is-off'), key: item.k },
              h('span', { className: 'prw__ic' }, I[item.icon] || I.star),
              h('div', { className: 'prw__m' },
                h('strong', null, item.name, h('span', { className: 'prw__c' }, item.cost, ' pts')),
                h('span', { className: 'prw__w' }, item.what),
                h('span', { className: 'prw__g' }, 'Needs ', item.minScore, ' score · ',
                  item.minBadges, ' badges', item.hr ? ' · goes to HR' : '')),
              can
                ? h(V.Button, { variant: 'outline', className: 'vi-btn--sm',
                  onClick: function () { claim(item); } }, 'Claim')
                : h('span', { className: 'prw__why' }, why.join(' · ')));
          }))),
        h(Card, { span: 5, title: 'Your claims',
          description: perf.CLAIM_CAP + ' a quarter. A declined one does not count against that.' },
          mine.length
            ? h('div', { className: 'pclaims' }, mine.map(function (c) {
              var item = perf.CATALOGUE.filter(function (x) { return x.k === c.reward; })[0];
              return h('div', { className: 'pclaims__i', key: c.id },
                h('div', { className: 'stack grow', style: { gap: 1, minWidth: 0 } },
                  h('strong', null, item ? item.name : c.reward),
                  h('span', { className: 'ad-sub' }, c.cost, ' pts · raised ', ui.dateLabel(c.raised)),
                  c.note ? h('span', { className: 'ad-sub' }, c.note) : null),
                h(ui.StatusChip, { status: c.status }));
            }))
            : h(ui.Empty, { icon: I.star, title: 'Nothing claimed yet',
              body: 'Claim something from the catalogue and it goes to your manager.' }))));
  }

  /* ============================================================== HR: the board */
  function HrBoard() {
    var depts = store.collection('departments');
    var filterSt = React.useState('all');
    var people = store.collection('employees').filter(function (e) {
      return e.status !== 'Exited' && e.status !== 'Invited'
        && (filterSt[0] === 'all' || e.department === filterSt[0]);
    });
    var rows = perf.standings(people);
    var bands = perf.BANDS.map(function (b) {
      return { label: b.label, tone: b.tone,
        n: rows.filter(function (r) { return perf.band(r.score).label === b.label; }).length };
    });
    var unsettled = rows.filter(function (r) { return !r.settled; }).length;

    return h('div', { className: 'stack gap-4' },
      h(ui.PageHead, { eyebrow: 'Performance', title: 'Leaderboard',
        description: 'Everyone, by performance score. Open a row for what the score is made of.' }),
      h(Stats, null,
        bands.map(function (b) {
          return h(Stat, { key: b.label, label: b.label, value: b.n, tone: statTone(b.tone),
            sub: rows.length ? Math.round(b.n / rows.length * 100) + '% of the board' : null });
        })),
      unsettled ? h('p', { className: 'pnote' },
        unsettled, unsettled === 1 ? ' person has' : ' people have', ' been here under ',
        perf.MIN_MONTHS, ' months. They are ranked, but their score is not settled and cannot be claimed on.') : null,
      h('div', { className: 'pfilter' },
        h('span', { className: 'ad-sub grow' }, rows.length, ' people ranked, this cycle.'),
        h(V.Select, { 'aria-label': 'Department', value: filterSt[0],
          onChange: function (v) { filterSt[1](v); },
          options: [{ value: 'all', label: 'Every department' }].concat(depts.map(function (d) {
            return { value: d.id, label: d.name };
          })) })),
      h(Board, { rows: rows, me: null,
        title: filterSt[0] === 'all' ? 'The whole organization' : deptName(filterSt[0]),
        note: rows.length + ' people, ranked by performance score — this cycle.' }));
  }

  /* ============================================================ HR: the badges */
  function HrBadges() {
    var people = store.collection('employees').filter(function (e) {
      return e.status !== 'Exited' && e.status !== 'Invited';
    });
    var openSt = React.useState(null);
    var held = {};
    people.forEach(function (e) {
      perf.badgesFor(e).forEach(function (x) {
        if (!x.on) return;
        (held[x.b.k] = held[x.b.k] || []).push(e);
      });
    });
    var byTier = {};
    perf.BADGES.forEach(function (b) { (byTier[b.t] = byTier[b.t] || []).push(b); });

    return h('div', { className: 'stack gap-4' },
      h(ui.PageHead, { eyebrow: 'Performance', title: 'Badges',
        description: 'What the organization recognises, what each one asks for, and who holds it.' }),
      Object.keys(byTier).sort().map(function (t) {
        var tier = perf.TIER[t];
        return h(Card, { key: t, title: tier.name,
          description: byTier[t].length + ' badges · worth ' + (t * 20) + ' points each' },
          h('div', { className: 'pcat' }, byTier[t].map(function (b) {
            var who = held[b.k] || [];
            return h('button', { type: 'button', className: 'pcat__i', key: b.k,
              onClick: function () { openSt[1]({ badge: b, who: who }); } },
              h(Plate, { tier: b.t, g: b.g, size: 52 }),
              h('div', { className: 'pcat__m' },
                h('strong', null, b.n),
                h('span', { className: 'pcat__r' }, b.rule),
                h('span', { className: 'pcat__n' }, who.length,
                  who.length === 1 ? ' person holds it' : ' people hold it',
                  ' · ', people.length ? Math.round(who.length / people.length * 100) : 0, '%')));
          })));
      }),
      openSt[0] ? h(ui.Drawer, { title: openSt[0].badge.n, onClose: function () { openSt[1](null); } },
        h('p', { className: 'pcab__h' }, openSt[0].badge.rule),
        openSt[0].who.length
          ? h('div', { className: 'pholders' }, openSt[0].who.map(function (e) {
            return h('div', { className: 'pholders__i', key: e.id },
              h(ui.Person, { employee: e }),
              h('span', { className: 'ad-sub' }, 'Earned ', perf.earnedOn(e, openSt[0].badge)));
          }))
          : h(ui.Empty, { icon: I.target, title: 'Nobody holds this yet' })) : null);
  }

  /* =========================================================== HR: the rewards */
  function HrRewards() {
    var claims = store.collection('rewardClaims');
    var waiting = claims.filter(function (c) { return /Awaiting|With HR/.test(c.status); });
    var spentPts = claims.filter(function (c) { return c.status !== 'Declined'; })
      .reduce(function (t, c) { return t + c.cost; }, 0);

    return h('div', { className: 'stack gap-4' },
      h(ui.PageHead, { eyebrow: 'Performance', title: 'Rewards',
        description: 'The catalogue people claim against, and where each claim stands.' }),
      h(Stats, null,
        h(Stat, { label: 'Claims raised', value: claims.length }),
        h(Stat, { label: 'Waiting on a decision', value: waiting.length,
          tone: waiting.length ? 'warn' : 'good' }),
        h(Stat, { label: 'Points spent', value: spentPts }),
        h(Stat, { label: 'Catalogue', value: perf.CATALOGUE.length + ' rewards',
          sub: perf.CLAIM_CAP + ' claims a quarter each' })),
      h(Grid, null,
        h(Card, { span: 7, title: 'Claims',
          description: 'Raised by the employee, approved by their manager, and by HR where it costs money.' },
          claims.length ? h(ui.DataTable, {
            rows: claims.slice().sort(function (a, b) { return b.raised.localeCompare(a.raised); }),
            columns: [
              { key: 'employee', header: 'Employee',
                cell: function (c) { return h(ui.Person, { employee: emp(c.employee) }); } },
              { key: 'reward', header: 'Reward', cell: function (c) {
                var item = perf.CATALOGUE.filter(function (x) { return x.k === c.reward; })[0];
                return item ? item.name : c.reward;
              } },
              { key: 'cost', header: 'Points', align: 'right', cell: function (c) { return c.cost; } },
              { key: 'raised', header: 'Raised', cell: function (c) { return ui.dateLabel(c.raised); } },
              { key: 'status', header: 'Status',
                cell: function (c) { return h(ui.StatusChip, { status: c.status }); } }
            ]
          }) : h(ui.Empty, { icon: I.star, title: 'No claims yet' })),
        h(Card, { span: 5, title: 'The catalogue',
          description: 'Costs and gates live with the rules, not with the records.' },
          h('div', { className: 'prw' }, perf.CATALOGUE.map(function (item) {
            var takers = claims.filter(function (c) { return c.reward === item.k; }).length;
            return h('div', { className: 'prw__i', key: item.k },
              h('span', { className: 'prw__ic' }, I[item.icon] || I.star),
              h('div', { className: 'prw__m' },
                h('strong', null, item.name, h('span', { className: 'prw__c' }, item.cost, ' pts')),
                h('span', { className: 'prw__w' }, item.what),
                h('span', { className: 'prw__g' }, 'Needs ', item.minScore, ' score · ',
                  item.minBadges, ' badges', item.hr ? ' · goes to HR' : '',
                  ' · ', takers, takers === 1 ? ' claim' : ' claims')));
          })))));
  }

  HRMS.screens.register({
    'me/performance/standing': MyStanding,
    'me/performance/board': MyBoard,
    'me/performance/rewards': MyRewards,
    'hr/performance/board': HrBoard,
    'hr/performance/badges': HrBadges,
    'hr/performance/rewards': HrRewards
  });
  HRMS.perfUI = { Plate: Plate, Board: Board, Cabinet: Cabinet, ScoreBreakdown: ScoreBreakdown };
})();

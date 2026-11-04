/* Performance scoring, badges and the reward economy.

   The shape of this is borrowed from the Tracklivo prototype: one score out of a
   hundred from seven weighted dimensions, five rating bands, a cap when something
   critical is missed, a badge catalogue in five tiers where every badge states its rule
   and how far along you are, and a points balance — separate from the score — that
   buys things from a catalogue.

   What is not borrowed is the inputs. Tracklivo measures a project board: sprints
   closed, items bounced back from review, commitments landed on the day. An HRMS keeps
   none of that, and inventing it would mean a score that looks precise and means
   nothing. So each dimension reads a number this application already records — goal
   progress, attendance, recognition, appraisal ratings, policy acknowledgements — and
   the weights stay the framework's.

   Everything here is derived, not seeded. Nothing is stored, so a score cannot drift
   out of step with the records it is drawn from: change a goal's progress and the score
   moves with it. */
(function () {
  var HRMS = (window.HRMS = window.HRMS || {});

  function store() { return HRMS.store; }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function pct(v, lo, hi) { return clamp((v - lo) / (hi - lo), 0, 1); }
  function round(n) { return Math.round(n); }

  /* ----------------------------------------------------------- The dimensions
     Five are measured off records the application keeps; two are the human ratings
     from the appraisal cycle, out of five. `how` is what the number is, in the words
     an employee would use, and `from` is where it comes from — both shown on screen,
     because a score nobody can trace is a score nobody trusts. */
  var INPUTS = [
    { k: 'goals',    label: 'Goal attainment', w: 20, kind: 'measured',
      how: 'Progress across your goals, each counted at its own weight',
      from: 'Goals in the current cycle' },
    { k: 'delivery', label: 'On pace',         w: 15, kind: 'measured',
      how: 'How far your goals have come against how far the cycle has',
      from: 'Goal progress and the cycle period' },
    { k: 'presence', label: 'Presence',        w: 10, kind: 'measured',
      how: 'Days present against days you were due in',
      from: 'Attendance records' },
    { k: 'conduct',  label: 'Compliance',      w: 10, kind: 'measured',
      how: 'Policies acknowledged and documents kept current',
      from: 'Policy acknowledgements and document expiry' },
    { k: 'teamwork', label: 'Teamwork',        w: 10, kind: 'measured',
      how: 'Recognition from colleagues, and recognition you gave',
      from: 'Peer recognition' },
    { k: 'review',   label: '360 feedback',    w: 25, kind: 'rated',
      how: 'The manager and peer rating from your last completed appraisal',
      from: 'Appraisal ratings, out of five' },
    { k: 'growth',   label: 'Growth',          w: 10, kind: 'rated',
      how: 'Self-assessments filed, and filed before the cycle closed',
      from: 'Appraisal participation \u2014 blank until you have had a cycle' }
  ];
  var WEIGHTS = {};
  INPUTS.forEach(function (i) { WEIGHTS[i.k] = i.w; });

  /* The framework's rating bands, and what each one asks of a manager. */
  var BANDS = [
    { min: 90, label: 'Excellent',          tone: 'success', use: 'Sustained high performance' },
    { min: 80, label: 'Strong',             tone: 'success', use: 'Above expected' },
    { min: 70, label: 'Effective',          tone: 'info',    use: 'Meets expected' },
    { min: 50, label: 'Needs improvement',  tone: 'warning', use: 'Corrective plan' },
    { min: 0,  label: 'Critical attention', tone: 'error',   use: 'Immediate intervention' }
  ];
  function band(n) {
    for (var i = 0; i < BANDS.length; i++) if (n >= BANDS[i].min) return BANDS[i];
    return BANDS[BANDS.length - 1];
  }

  /* A critical miss caps the score however well the rest of it reads. Here a miss is a
     policy left unacknowledged past its due date or a mandatory document expired —
     the things that are not a matter of degree. */
  var CAPS = [
    { misses: 0, max: 100, review: 'Normal review' },
    { misses: 1, max: 59,  review: 'Gate review required' },
    { misses: 2, max: 39,  review: 'Critical intervention' }
  ];
  function capFor(misses) {
    var c = CAPS[0];
    CAPS.forEach(function (x) { if (misses >= x.misses) c = x; });
    return c;
  }

  var PERIODS = ['This month', 'This quarter', 'This cycle', 'Last six months'];

  /* --------------------------------------------------------------- The measures
     One pass over the records per employee, cached for the life of the page because
     nothing here changes without a store write, and a leaderboard asks for it once
     per row per render otherwise. */
  var cache = {};
  HRMS.perfInvalidate = function () { cache = {}; };

  function measures(emp) {
    if (!emp) return null;
    if (cache[emp.id]) return cache[emp.id];
    var s = store();

    /* Goals: attainment is progress weighted as the cycle weights it; delivery is
       how many of them actually finished. */
    var goals = s.collection('goals').filter(function (g) { return g.employee === emp.id; });
    var wsum = goals.reduce(function (t, g) { return t + (g.weight || 0); }, 0);
    var attain = wsum
      ? goals.reduce(function (t, g) { return t + g.progress * (g.weight || 0); }, 0) / wsum
      : 0;
    var done = goals.filter(function (g) { return g.status === 'Achieved'; }).length;

    /* Presence: the prototype seeds only today's attendance, so the history comes from
       the same derivation the employee's own attendance screens read — one source, so
       a score and the days behind it cannot disagree. Weekly offs and holidays are not
       days due in. */
    var hist = HRMS.attendanceHistory ? HRMS.attendanceHistory(emp, 90) : [];
    var due = hist.filter(function (a) { return a.status !== 'Weekly Off' && a.status !== 'Holiday'; });
    var here = due.filter(function (a) { return a.status !== 'Absent'; });
    var late = due.filter(function (a) { return a.status === 'Late'; });

    /* Compliance: a policy that asks for an acknowledgement and has not had one is
       owed. Past its due date it stops being a backlog item and becomes a critical
       miss, which caps the score. Documents still waiting on verification are a drag
       on the dimension but not a miss — the delay is not the employee's. */
    var acked = {};
    s.collection('acknowledgements').forEach(function (a) {
      if (a.employee === emp.id) acked[a.policy] = true;
    });
    var owed = s.collection('policies').filter(function (pol) {
      return pol.ack && !acked[pol.id];
    });
    var overdue = owed.filter(function (pol) { return pol.due && pol.due < s.seed.todayIso; });
    var docs = s.collection('employeeDocuments').filter(function (d) { return d.employee === emp.id; });
    var unverified = docs.filter(function (d) { return d.status === 'Pending Verification'; });

    /* Teamwork: recognition is a two-way signal — being appreciated and appreciating
       others both count, the second at half weight because it is cheaper to give. */
    var rec = s.collection('recognition');
    var got = rec.filter(function (x) { return x.to === emp.id; }).length;
    var gave = rec.filter(function (x) { return x.from === emp.id; }).length;

    /* The two human ratings. An appraisal that has not been through manager review
       has no rating yet, and the score says so rather than guessing one. */
    var asm = s.collection('assessments').filter(function (a) { return a.employee === emp.id; });
    var reviewed = asm.filter(function (a) { return a.manager === 'Submitted'; });
    var rated = reviewed.length > 0;

    /* Surveys answered, which is the measurable half of Growth. */
    var responses = s.collection('surveyResponses')
      .filter(function (x) { return x.employee === emp.id; }).length;
    var surveys = s.collection('surveys').filter(function (x) { return x.status !== 'Scheduled'; }).length;
    var selfOnTime = asm.filter(function (a) { return a.self === 'Submitted'; }).length;

    var m = {
      id: emp.id, employee: emp,
      goalsSet: goals.length, goalsDone: done, attain: round(attain),
      daysDue: due.length, daysHere: here.length, lates: late.length,
      presence: due.length ? round(here.length / due.length * 100) : 0,
      punctual: due.length ? round((due.length - late.length) / due.length * 100) : 0,
      policiesOwed: owed.length, policiesOverdue: overdue.length, docsUnverified: unverified.length,
      recognitionGot: got, recognitionGave: gave,
      surveysAnswered: responses, surveysOpen: surveys,
      selfOnTime: selfOnTime, rated: rated, cycles: asm.length, cyclesReviewed: reviewed.length,
      pace: goals.length ? round(clamp(attain / Math.max(elapsed(), 0.2), 0, 100)) : 0,
      goalsOnPace: goals.filter(function (g) { return g.progress >= 90; }).length,
      tenureMonths: monthsSince(emp.joined),
      manages: s.collection('employees').filter(function (e) { return e.manager === emp.id; }).length
    };
    cache[emp.id] = m;
    return m;
  }

  /* How far through the open appraisal period today is, 0–1. */
  function elapsed() {
    var open = store().collection('perfCycles').filter(function (c) { return c.status !== 'Completed'; })[0]
      || store().collection('perfCycles')[0];
    if (!open || !open.starts || !open.ends) return 1;
    var a = new Date(open.starts + 'T00:00'), b = new Date(open.ends + 'T00:00'), now = store().seed.today;
    var span = b - a;
    return span > 0 ? clamp((now - a) / span, 0.05, 1) : 1;
  }

  function monthsSince(iso) {
    if (!iso) return 0;
    var then = new Date(iso + 'T00:00'), now = store().seed.today;
    return Math.max(0, (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth()));
  }

  /* The seven dimensions, each 0–100, from those measures. The two rated ones are
     derived from the records too — this prototype has no reviewer typing a number —
     but they are marked `rated` so a screen can say which half of the score is
     judgement rather than measurement. */
  function parts(emp) {
    var m = measures(emp);
    if (!m) return null;
    var p = {
      goals: clamp(m.attain, 0, 100),
      /* Finished goals alone would be unfair read partway through a cycle: on the
         third of November a December cycle is two thirds run, so most goals are
         rightly still open. This asks the fairer question — is the work where the
         calendar says it should be — and being on pace scores full marks. */
      delivery: m.goalsSet ? m.pace : null,
      presence: m.presence,
      conduct: round(clamp(100 - m.policiesOwed * 14 - m.docsUnverified * 6, 0, 100)),
      teamwork: round(clamp(pct(m.recognitionGot + m.recognitionGave * 0.5, 0, 3) * 100, 0, 100)),
      /* 360 is what a reviewer concluded, so it rests on the two things a reviewer
         actually weighs — what was delivered and how colleagues rate working with the
         person. Punctuality is deliberately not in it: Presence already carries that,
         and a score should not count the same fact twice. With no reviewed cycle
         behind it there is nothing to rate, and it reads as not rated rather than
         as zero. */
      review: m.rated
        ? round(clamp(m.attain * 0.65 + clamp(pct(m.recognitionGot, 0, 3) * 100, 0, 100) * 0.35, 0, 100))
        : null,
      /* Growth is appraisal participation. Survey responses would be the better
         measure, but this organization's surveys are anonymous — which is the right
         default and not something to undo for a score — so they cannot be attributed
         to a person. Somebody who has never been in a cycle has nothing to measure
         here, and the dimension drops out rather than scoring them zero for it. */
      growth: m.cycles
        ? round(clamp(pct(m.selfOnTime, 0, m.cycles) * 100, 0, 100))
        : null
    };
    return p;
  }

  /* The score. A dimension with nothing to measure yet drops out, and its weight
     drops with it, so an unrated newcomer is scored on what is known about them
     rather than penalised for the blank. */
  function score(emp) {
    var p = parts(emp);
    if (!p) return 0;
    var m = measures(emp);
    var tot = 0, acc = 0;
    INPUTS.forEach(function (i) {
      if (p[i.k] == null) return;
      acc += p[i.k] * i.w; tot += i.w;
    });
    var n = tot ? round(acc / tot) : 0;
    var cap = capFor(m.policiesOverdue);
    return Math.min(n, cap.max);
  }

  /* Whether a score can be read at all. A percentage over two weeks is not a signal,
     so the board shows a new joiner their standing but marks it unsettled, and the
     reward gates refuse to count it. Points are unaffected: they accrue from day one. */
  var MIN_MONTHS = 3;
  function settled(emp) { return measures(emp).tenureMonths >= MIN_MONTHS; }

  /* A six-month shape for the trend line. There is no month-by-month history in the
     records, so this is derived from the person's own figures rather than invented
     per render: same employee, same curve, every time. */
  function trend(emp) {
    var n = score(emp), out = [];
    var h = String(emp.id).split('').reduce(function (a, c) { return a + c.charCodeAt(0); }, 0);
    var drift = (h % 7) - 3;                       /* -3..3 points a month */
    for (var i = 5; i >= 0; i--) out.push(clamp(round(n - drift * i), 0, 100));
    return out;
  }
  function trendOf(emp) {
    var t = trend(emp), d = t[t.length - 1] - t[0];
    return { series: t, delta: d, word: d > 3 ? 'Improving' : d < -3 ? 'Declining' : 'Holding steady' };
  }

  /* ------------------------------------------------------------------- Badges
     Five tiers, and every badge states its rule in plain words, where the person is
     against it now, and what it is worth. A locked badge is shown, not hidden: the
     catalogue is the thing that tells somebody what the organization values. */
  var TIER = {
    1: { name: 'Common',    ink: '#8d8375', soft: '#efebe4', glow: '#cdc3b4' },
    2: { name: 'Uncommon',  ink: '#11867f', soft: '#dcf4f1', glow: '#5fd3cb' },
    3: { name: 'Rare',      ink: '#b4681c', soft: '#fcecd9', glow: '#f0a24a' },
    4: { name: 'Epic',      ink: '#4e6c93', soft: '#e6eefa', glow: '#9fc0ea' },
    5: { name: 'Legendary', ink: '#a9770a', soft: '#fcf0d2', glow: '#f3c344' }
  };

  var BADGES = [
    { k: 'setup', n: 'Goal Setter', t: 1, g: 'target',
      rule: 'Have your goals set and weighted for the cycle.',
      has: function (m) { return m.goalsSet >= 3; },
      prog: function (m) { return pct(m.goalsSet, 0, 3); },
      now: function (m) { return m.goalsSet + ' of 3 goals set'; } },

    { k: 'current', n: 'Policy Current', t: 1, g: 'book',
      rule: 'Acknowledge every policy that asks for it.',
      has: function (m) { return m.policiesOwed === 0; },
      prog: function (m) { return m.policiesOwed === 0 ? 1 : clamp(1 - m.policiesOwed / 8, 0.05, 0.9); },
      now: function (m) {
        return m.policiesOwed === 0 ? 'All acknowledged'
          : m.policiesOwed + ' still to acknowledge'
            + (m.policiesOverdue ? ', ' + m.policiesOverdue + ' overdue' : '');
      } },

    { k: 'here', n: 'Always Here', t: 2, g: 'users',
      rule: 'Turn up for 96% of the days you were due in.',
      has: function (m) { return m.presence >= 96; },
      prog: function (m) { return pct(m.presence, 80, 96); },
      now: function (m) { return m.presence + '% of 96%'; } },

    { k: 'closer', n: 'Goal Closer', t: 2, g: 'check',
      rule: 'Finish two goals in the cycle.',
      has: function (m) { return m.goalsDone >= 2; },
      prog: function (m) { return pct(m.goalsDone, 0, 2); },
      now: function (m) { return m.goalsDone + ' of 2 finished'; } },

    /* This was Tracklivo's survey badge. Surveys here are anonymous, which is the
        right default and not something to undo for a badge, so it asks instead about
        the other paperwork a person owns outright. */
    { k: 'papers', n: 'Paperwork Done', t: 2, g: 'bulb',
      rule: 'Every document you have filed is verified, with none waiting.',
      has: function (m) { return m.docsUnverified === 0; },
      prog: function (m) { return m.docsUnverified === 0 ? 1 : clamp(1 - m.docsUnverified / 4, 0.1, 0.85); },
      now: function (m) {
        return m.docsUnverified === 0 ? 'All verified' : m.docsUnverified + ' still waiting';
      } },

    { k: 'ontime', n: 'On Time, Always', t: 3, g: 'clock',
      rule: 'Arrive on time on 95% of the days you were due in.',
      has: function (m) { return m.punctual >= 95; },
      prog: function (m) { return pct(m.punctual, 75, 95); },
      now: function (m) { return m.punctual + '% of 95%'; } },

    { k: 'thanked', n: 'Appreciated', t: 3, g: 'hand',
      rule: 'Be recognised by three colleagues.',
      has: function (m) { return m.recognitionGot >= 3; },
      prog: function (m) { return pct(m.recognitionGot, 0, 3); },
      now: function (m) { return m.recognitionGot + ' of 3'; } },

    { k: 'giver', n: 'Generous', t: 3, g: 'gem',
      rule: 'Recognise three colleagues yourself.',
      has: function (m) { return m.recognitionGave >= 3; },
      prog: function (m) { return pct(m.recognitionGave, 0, 3); },
      now: function (m) { return m.recognitionGave + ' of 3 given'; } },

    { k: 'crusher', n: 'Goal Crusher', t: 4, g: 'shield',
      rule: 'Every goal in the cycle at 90% or better.',
      has: function (m) { return m.goalsSet >= 2 && m.goalsOnPace === m.goalsSet; },
      prog: function (m) { return m.goalsSet ? m.goalsOnPace / m.goalsSet : 0; },
      now: function (m) { return m.goalsOnPace + ' of ' + m.goalsSet + ' at 90%'; } },

    { k: 'consist', n: 'Consistency Champ', t: 4, g: 'flame',
      rule: 'Three months without an absence, and your goals on pace.',
      has: function (m) { return m.presence >= 100 && m.pace >= 95; },
      prog: function (m) { return Math.min(pct(m.presence, 88, 100), pct(m.pace, 60, 95)); },
      now: function (m) { return m.presence + '% present · ' + m.pace + '% of pace'; } },

    { k: 'top', n: 'Top Performer', t: 5, g: 'rocket',
      rule: 'Score 90 or better with every goal on pace.',
      has: function (m, sc) { return sc >= 90 && m.goalsSet > 0 && m.goalsOnPace === m.goalsSet; },
      prog: function (m, sc) {
        return Math.min(pct(sc, 60, 90), m.goalsSet ? m.goalsOnPace / m.goalsSet : 0);
      },
      now: function (m, sc) { return sc + ' of 90 · ' + m.goalsOnPace + ' of ' + m.goalsSet + ' on pace'; } },

    { k: 'mentor', n: 'Mentor', t: 5, g: 'bolt',
      rule: 'Lead a team of three or more whose own scores average 78.',
      has: function (m) { return m.manages >= 3 && teamScore(m.employee) >= 78; },
      prog: function (m) {
        return m.manages ? Math.min(pct(m.manages, 0, 3), pct(teamScore(m.employee), 50, 78)) : 0;
      },
      now: function (m) {
        return m.manages ? m.manages + ' reports · team at ' + teamScore(m.employee) : 'Leads a team only';
      } }
  ];

  function teamScore(emp) {
    var team = store().collection('employees').filter(function (e) { return e.manager === emp.id; });
    if (!team.length) return 0;
    return round(team.reduce(function (t, e) { return t + score(e); }, 0) / team.length);
  }

  /* Every badge for a person, earned first, each carrying its progress. */
  function badgesFor(emp) {
    var m = measures(emp), sc = score(emp);
    return BADGES.map(function (b) {
      var on = !!b.has(m, sc);
      return { b: b, on: on, prog: on ? 1 : clamp(b.prog(m, sc) || 0, 0, 1), now: b.now(m, sc) };
    });
  }
  function badgeCount(emp) {
    return badgesFor(emp).filter(function (x) { return x.on; }).length;
  }
  /* A badge is worth its tier, twenty points a tier, so a Legendary is worth five
     Commons and the number means something beyond how many were collected. */
  function badgePoints(emp) {
    return badgesFor(emp).reduce(function (t, x) { return t + (x.on ? x.b.t * 20 : 0); }, 0);
  }
  /* A stable earned-on date, so the cabinet reads like a record rather than a list. */
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function earnedOn(emp, b) {
    var h = (String(emp.id) + b.k).split('').reduce(function (a, c) { return a + c.charCodeAt(0); }, 0);
    return (h % 27 + 1) + ' ' + MON[h % 11];
  }

  /* --------------------------------------------------------- The reward economy
     Points are not the score. The score says how somebody is doing and can go down;
     points are a balance that only accrues, so a person who has pulled their work up
     is not spending a quarter paying off a bad one. Points come from badges, finished
     goals and recognition — things done, not levels reached. */
  var REWARD_TIERS = [
    { n: 'Bronze',   at: 0 },
    { n: 'Silver',   at: 300 },
    { n: 'Gold',     at: 500 },
    { n: 'Platinum', at: 800 }
  ];
  function points(emp) {
    var m = measures(emp);
    return badgePoints(emp) + m.goalsDone * 25 + m.recognitionGot * 30 + m.recognitionGave * 10;
  }
  function rewardTier(pts) {
    var t = REWARD_TIERS[0];
    REWARD_TIERS.forEach(function (x) { if (pts >= x.at) t = x; });
    return t;
  }
  function nextTier(pts) {
    for (var i = 0; i < REWARD_TIERS.length; i++) if (REWARD_TIERS[i].at > pts) return REWARD_TIERS[i];
    return null;
  }

  /* What points buy. Each is gated on three things at once — a balance, a score and a
     number of badges — so the catalogue cannot be cleared by one good quarter alone. */
  var CATALOGUE = [
    { k: 'wfh1', name: 'Work from home · 1 day', icon: 'home', cost: 150, minScore: 75, minBadges: 3,
      what: 'One working day from home, on a date you pick. The quickest claim to get signed.' },
    { k: 'wfh2', name: 'Work from home · 2 days', icon: 'home', cost: 280, minScore: 80, minBadges: 5,
      what: 'Two working days from home. The calendar shows them as working, not as leave.' },
    { k: 'learn', name: 'Learning day', icon: 'file', cost: 220, minScore: 78, minBadges: 4,
      what: 'A working day away from your goals for a course, a certification or a conference.' },
    { k: 'leave', name: 'A day of leave, on us', icon: 'calendar', cost: 400, minScore: 82, minBadges: 6,
      what: 'One day credited to your casual leave balance. Goes to your manager for the nod.' },
    { k: 'var', name: 'Variable pay nomination', icon: 'card', cost: 600, minScore: 88, minBadges: 8, hr: true,
      what: 'Your manager puts you forward at the next cycle. Goes to HR, not to the team budget.' }
  ];
  var CLAIM_CAP = 2;   /* claims a quarter, so the catalogue paces itself */

  function claimsOf(emp) {
    return store().collection('rewardClaims').filter(function (c) { return c.employee === emp.id; });
  }
  function spent(emp) {
    return claimsOf(emp)
      .filter(function (c) { return c.status !== 'Declined'; })
      .reduce(function (t, c) { return t + c.cost; }, 0);
  }
  function balance(emp) { return Math.max(0, points(emp) - spent(emp)); }

  /* Why a reward cannot be claimed, in the order a person would fix it. An empty list
     means it can. */
  function blockers(emp, item) {
    var out = [], m = measures(emp), sc = score(emp), left = balance(emp);
    if (!settled(emp)) {
      var n = MIN_MONTHS - m.tenureMonths;
      out.push(n + ' more ' + (n === 1 ? 'month' : 'months') + ' before a score counts');
    } else if (sc < item.minScore) {
      out.push((item.minScore - sc) + ' more points of score');
    }
    var got = badgeCount(emp);
    if (got < item.minBadges) {
      var b = item.minBadges - got;
      out.push(b + ' more ' + (b === 1 ? 'badge' : 'badges'));
    }
    if (left < item.cost) out.push((item.cost - left) + ' more reward points');
    if (claimsOf(emp).filter(function (c) { return c.status !== 'Declined'; }).length >= CLAIM_CAP) {
      out.push('this quarter’s ' + CLAIM_CAP + ' claims already used');
    }
    return out;
  }
  function canClaim(emp, item) { return blockers(emp, item).length === 0; }

  /* ------------------------------------------------------------- The standings
     A board is always a population plus an order. The population is the caller's to
     choose — their department, or the whole organization — and the order is the score,
     highest first, with the better trend breaking a tie. */
  function standings(people) {
    return people.map(function (e) {
      return { employee: e, score: score(e), trend: trendOf(e), badges: badgeCount(e),
        points: points(e), measures: measures(e), settled: settled(e) };
    }).sort(function (a, b) {
      return b.score - a.score || b.trend.delta - a.trend.delta
        || a.employee.name.localeCompare(b.employee.name);
    }).map(function (row, i) { row.rank = i + 1; return row; });
  }
  function rankOf(rows, emp) {
    for (var i = 0; i < rows.length; i++) if (rows[i].employee.id === emp.id) return i + 1;
    return null;
  }

  HRMS.perf = {
    INPUTS: INPUTS, WEIGHTS: WEIGHTS, BANDS: BANDS, CAPS: CAPS, PERIODS: PERIODS,
    TIER: TIER, BADGES: BADGES, REWARD_TIERS: REWARD_TIERS, CATALOGUE: CATALOGUE,
    CLAIM_CAP: CLAIM_CAP, MIN_MONTHS: MIN_MONTHS,
    measures: measures, parts: parts, score: score, band: band, capFor: capFor,
    settled: settled, trendOf: trendOf, teamScore: teamScore,
    badgesFor: badgesFor, badgeCount: badgeCount, badgePoints: badgePoints, earnedOn: earnedOn,
    points: points, rewardTier: rewardTier, nextTier: nextTier,
    claimsOf: claimsOf, spent: spent, balance: balance, blockers: blockers, canClaim: canClaim,
    standings: standings, rankOf: rankOf
  };
})();

/* What happens to an asset request between somebody asking and somebody handing over
   the laptop.

   The request itself is raised in Tracklivo and decided there. This product does not
   own that queue and does not pretend to: nothing here approves, rejects or raises
   anything. What it owns is the answer to "where has my request got to, and why" —
   which is a question about people in this directory, so it is answered here.

   The chain is not configured anywhere. It is read off the reporting line: the person
   who asked, then their manager, then their manager's manager, up to whoever has
   nobody above them, and then IT, who actually issues the thing. That means a request
   from somebody six levels down passes six desks and a request from a direct report of
   the founder passes one, which is what an organisation chart already says should
   happen. Nothing has to be kept in step with it because nothing is written down twice.

   The states on each step are derived from the request's own status, deterministically
   from its id, so the same request tells the same story every time it is opened. */
(function () {
  var HRMS = window.HRMS;

  /* A stable number from a string: the same request gets the same timeline on every
     render, which a random one would not. */
  function hash(str) {
    var hv = 0, i;
    for (i = 0; i < String(str).length; i++) {
      hv = ((hv << 5) - hv + String(str).charCodeAt(i)) | 0;
    }
    return Math.abs(hv);
  }

  function store() { return HRMS.store; }

  /* ---------------------------------------------------------------- the chain */
  function managerChain(employeeId) {
    var out = [], seen = {}, cur = store().employee(employeeId);
    var guard = 0;
    while (cur && cur.manager && !seen[cur.manager] && guard++ < 12) {
      var m = store().employee(cur.manager);
      if (!m) break;
      seen[m.id] = true;
      out.push(m);
      cur = m;
    }
    return out;
  }

  /* IT issues the asset, so IT closes the chain. The Admin workspace is where the asset
     register lives, so its persona is who that is. */
  function itApprover() {
    var users = store().collection('users');
    var admin = users.filter(function (u) { return u.role === 'admin' && u.status === 'Active'; })[0];
    return admin ? store().employee(admin.employee) : null;
  }

  var APPROVE_WHY = [
    'Within the standing allocation for the role.',
    'Replacement is overdue; the current unit is out of warranty.',
    'Agreed in the team plan for this quarter.',
    'Needed for the client engagement starting this month.',
    'Checked against the budget line and there is room.',
    'Previous unit logged as damaged, so this is a like-for-like.'
  ];
  var REJECT_WHY = [
    'An unallocated unit of this model is already in stock — raise a transfer instead.',
    'Outside the refresh cycle; the current unit is eleven months old.',
    'Budget for the category is committed until the next quarter.',
    'The spec asked for is above the band for this role.'
  ];
  var PENDING_WHY = 'Waiting on this approval.';

  /* ------------------------------------------------------------- the timeline */
  function timeline(req) {
    if (!req) return [];
    var who = store().employee(req.employee);
    var hv = hash(req.id);
    var chain = managerChain(req.employee);
    var it = itApprover();
    if (it && !chain.some(function (p) { return p.id === it.id; })) chain = chain.concat([it]);

    var steps = [{
      kind: 'raised',
      who: who ? who.name : req.employee,
      role: who ? who.designation : '',
      state: 'raised',
      on: req.requestedOn,
      note: req.reason || '',
      source: 'Tracklivo'
    }];

    /* Where the request has got to. Approved means every desk said yes; rejected means
       one of them said no and the rest never saw it; pending means it is sitting on
       somebody's desk right now. */
    var stop;
    if (req.status === 'Approved') stop = chain.length;
    else if (req.status === 'Rejected') stop = hv % Math.max(1, chain.length);
    else stop = hv % Math.max(1, chain.length);

    chain.forEach(function (person, i) {
      var isIt = it && person.id === it.id;
      var label = isIt ? 'IT' : (i === 0 ? 'Line manager' : 'Reporting line');
      var step = {
        kind: isIt ? 'it' : 'approver',
        who: person.name,
        role: person.designation,
        dept: person.department,
        label: label,
        state: 'waiting',
        on: null,
        note: ''
      };
      if (i < stop) {
        step.state = 'approved';
        step.on = dayAfter(req.requestedOn, i + 1);
        step.note = APPROVE_WHY[(hv + i) % APPROVE_WHY.length];
      } else if (i === stop) {
        if (req.status === 'Rejected') {
          step.state = 'rejected';
          step.on = dayAfter(req.requestedOn, i + 1);
          step.note = REJECT_WHY[hv % REJECT_WHY.length];
        } else if (req.status === 'Approved') {
          step.state = 'approved';
          step.on = dayAfter(req.requestedOn, i + 1);
          step.note = APPROVE_WHY[(hv + i) % APPROVE_WHY.length];
        } else {
          step.state = 'pending';
          step.note = PENDING_WHY;
        }
      }
      steps.push(step);
    });

    if (req.status === 'Approved') {
      steps.push({
        kind: 'issued', who: it ? it.name : 'IT', role: 'Asset register',
        state: 'approved', on: dayAfter(req.requestedOn, chain.length + 1),
        note: 'Unit allocated and handed over.'
      });
    }
    return steps;
  }

  function dayAfter(isoDate, n) {
    if (!isoDate) return null;
    var d = new Date(isoDate + 'T00:00');
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  /* Whose desk is it on now, which is the only thing a queue really needs to say. */
  function waitingOn(req) {
    var t = timeline(req);
    var p = t.filter(function (s) { return s.state === 'pending'; })[0];
    return p ? p.who : null;
  }

  function decidedBy(req) {
    var t = timeline(req);
    var r = t.filter(function (s) { return s.state === 'rejected'; })[0];
    if (r) return { who: r.who, why: r.note, on: r.on, rejected: true };
    var done = t.filter(function (s) { return s.state === 'approved'; });
    var last = done[done.length - 1];
    return last ? { who: last.who, why: last.note, on: last.on, rejected: false } : null;
  }

  /* -------------------------------------------------------------- visibility
     An employee sees their own. A manager also sees what is sitting on their desk.
     Admin sees the queue, because admin runs the register. */
  function visibleTo(role, personId) {
    var all = store().collection('assetRequests');
    if (role === 'admin') return all;
    if (!personId) return [];
    return all.filter(function (r) {
      if (r.employee === personId) return true;
      var me = store().employee(personId);
      if (!me) return false;
      return timeline(r).some(function (s) {
        return s.state === 'pending' && s.who === me.name;
      });
    });
  }

  HRMS.assetflow = {
    timeline: timeline,
    waitingOn: waitingOn,
    decidedBy: decidedBy,
    visibleTo: visibleTo,
    managerChain: managerChain,
    source: 'Tracklivo'
  };
})();

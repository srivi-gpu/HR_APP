/* The approval timeline for one asset request, in a modal over whatever opened it.

   The same component serves admin and the employee, because it is the same question:
   where has this got to, who decided, and what did they say. The only thing that
   differs is who can open it, which `assetflow.visibleTo` settles elsewhere.

   Nothing here acts. The request is Tracklivo's to decide and the modal says so once,
   at the top, rather than offering buttons that would have to explain themselves. */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement, V = window.Violet, I = window.Icons;
  var ui = HRMS.ui, store = HRMS.store;

  var STATE_TONE = { approved: 'success', rejected: 'error', pending: 'warning', waiting: 'neutral', raised: 'info' };
  var STATE_WORD = { approved: 'Approved', rejected: 'Rejected', pending: 'Waiting', waiting: 'Not reached', raised: 'Raised' };

  function when(isoDate) {
    if (!isoDate) return null;
    return ui.dateLabel ? ui.dateLabel(isoDate) : isoDate;
  }

  function AssetTimeline(p) {
    var req = p.request;
    if (!req) return null;
    var flow = HRMS.assetflow;
    var steps = flow.timeline(req);
    var who = store.employee(req.employee);
    var decided = flow.decidedBy(req);
    var pending = flow.waitingOn(req);

    return h(ui.Modal, {
      title: req.category + ' request',
      description: (who ? who.name : req.employee) + ' · ' + req.id,
      onClose: p.onClose,
      footer: h(React.Fragment, null,
        h('span', { className: 'muted grow' },
          'Raised and decided in Tracklivo. This is a record of it.'),
        h(V.Button, { variant: 'outline', onClick: p.onClose }, 'Close'))
    },
      h('div', { className: 'atl__head' },
        h('div', { className: 'stack gap-1 grow', style: { minWidth: 0 } },
          h('span', { className: 'muted' }, 'Asked for'),
          h('strong', null, req.category),
          h('span', { className: 'muted' }, req.reason)),
        h('div', { className: 'stack gap-1', style: { alignItems: 'flex-end' } },
          h(ui.StatusChip, { status: req.status }),
          h('span', { className: 'muted' },
            req.status === 'Pending Approval'
              ? (pending ? 'With ' + pending : 'Waiting')
              : decided ? (decided.rejected ? 'Rejected by ' : 'Cleared by ') + decided.who : ''))),

      h('div', { className: 'atl' }, steps.map(function (s, i) {
        return h('div', { className: 'atl__row atl__row--' + s.state, key: i },
          h('span', { className: 'atl__dot' },
            s.state === 'approved' ? I.check
              : s.state === 'rejected' ? I.close
                : s.state === 'pending' ? I.clock
                  : s.state === 'raised' ? I.flag : null),
          h('div', { className: 'atl__body' },
            h('div', { className: 'atl__top' },
              h('strong', null, s.who),
              s.label ? h('span', { className: 'atl__tag' }, s.label) : null,
              h(V.Chip, { size: 'sm', shape: 'tag', variant: 'soft', tone: STATE_TONE[s.state] || 'neutral' },
                STATE_WORD[s.state] || s.state),
              s.source ? h('span', { className: 'atl__src' }, s.source) : null,
              h('span', { className: 'grow' }),
              h('span', { className: 'muted' }, when(s.on) || '—')),
            s.role ? h('span', { className: 'muted' }, s.role) : null,
            s.note ? h('p', { className: 'atl__note' }, s.note) : null));
      })));
  }

  HRMS.assetTimeline = AssetTimeline;
})();

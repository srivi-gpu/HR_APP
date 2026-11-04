/* Charts.

   Four pieces, shared by every workspace so the same question looks the same whoever is
   asking it. The data differs — HR sees the organization, an employee sees themselves —
   but the form does not, which is the point: a shape you have already learned to read
   costs nothing to read again.

   Every mark here is one hue, the brand's. None of these is a categorical chart: a gauge
   carries one number, the trend one series, the ranked bars one measure. A single series
   needs no legend, so none is drawn and the card's title names what is shown. The status
   tiles are the exception, and they are not a series — each carries its own icon and its
   own label, so the colour is reinforcement rather than the thing you read.

   Hover is not optional. Every mark that encodes a value says what it is on hover, which
   is what lets the axes stay quiet and the labels stay selective. */
(function () {
  var HRMS = (window.HRMS = window.HRMS || {});
  var React = window.React, h = React.createElement, I = window.Icons;

  function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }
  /* Resolved on call: ui.js and charts.js load in either order. */
  function ui() { return HRMS.ui; }

  /* ------------------------------------------------------------------ Gauge
     One number, read at a glance. A 180° arc rather than a full ring, because half a
     circle leaves the middle free for the number itself, which is what is actually being
     read — the arc is the context around it. */
  function Gauge(p) {
    var value = Math.max(0, Math.min(100, p.value || 0));
    var R = 70, CX = 90, CY = 86, STROKE = 18;
    /* Half the circumference is the whole track; the value fills a share of it. */
    var half = Math.PI * R;
    var fill = (value / 100) * half;

    function arc() {
      return 'M ' + (CX - R) + ' ' + CY + ' A ' + R + ' ' + R + ' 0 0 1 ' + (CX + R) + ' ' + CY;
    }
    return h('div', { className: 'gauge' },
      h('svg', { className: 'gauge__svg', viewBox: '0 0 180 104', role: 'img',
        'aria-label': (p.label || 'Value') + ': ' + value + '%' },
        h('defs', null,
          h('linearGradient', { id: 'gaugeFill', x1: 0, y1: 0, x2: 1, y2: 0 },
            h('stop', { offset: 0, stopColor: 'var(--brand-hover)' }),
            h('stop', { offset: 1, stopColor: 'var(--brand-solid)' }))),
        h('path', { d: arc(), className: 'gauge__track', strokeWidth: STROKE, strokeLinecap: 'round' }),
        h('path', {
          d: arc(), className: 'gauge__fill', strokeWidth: STROKE, strokeLinecap: 'round',
          strokeDasharray: fill + ' ' + (half * 2), stroke: 'url(#gaugeFill)'
        })),
      h('div', { className: 'gauge__mid' },
        h('strong', null, value, h('span', { className: 'gauge__pc' }, '%')),
        p.label ? h('span', null, p.label) : null));
  }

  /* ------------------------------------------------------------- Trend bars
     One series over time. Thin marks with rounded data-ends anchored to the baseline, a
     2px gap between them, and a quiet band of gridlines behind. Only the first, last and
     peak bars are labelled on the axis — every bar labelled is no labels at all — and the
     rest answer on hover. */
  function TrendBars(p) {
    var hoverSt = React.useState(null);
    var rows = p.rows || [];
    if (!rows.length) return null;

    var values = rows.map(function (r) { return r.value; });
    var hi = Math.max.apply(null, values);
    var lo = Math.min.apply(null, values);
    /* A floor well below the data would flatten the whole series into the top band, so the
       scale starts a little under the minimum rather than at zero — and the axis says so. */
    var base = p.zero ? 0 : Math.max(0, Math.floor((lo - (hi - lo) * 0.45) / 5) * 5);
    var span = Math.max(hi - base, 1);
    var ticks = [hi, base + span * 0.5, base].map(function (t) { return Math.round(t); });

    var hv = hoverSt[0];
    return h('div', { className: 'tbar' },
      h('div', { className: 'tbar__ticks' }, ticks.map(function (t, i) {
        return h('span', { key: i }, t + (p.unit || ''));
      })),
      h('div', { className: 'tbar__plot', onMouseLeave: function () { hoverSt[1](null); } },
        rows.map(function (r, i) {
          var pcOf = Math.max(((r.value - base) / span) * 100, 2);
          return h('span', {
            key: i, className: 'tbar__col' + (hv === i ? ' is-on' : '') + (i === rows.length - 1 ? ' is-last' : ''),
            onMouseEnter: function () { hoverSt[1](i); },
            tabIndex: 0, role: 'img', 'aria-label': r.label + ': ' + r.value + (p.unit || ''),
            onFocus: function () { hoverSt[1](i); }, onBlur: function () { hoverSt[1](null); }
          }, h('span', { className: 'tbar__fill', style: { height: pcOf + '%' } }));
        }),
        hv != null ? h('span', {
          className: 'tbar__tip',
          style: { left: ((hv + 0.5) / rows.length * 100) + '%' }
        }, h('strong', null, rows[hv].value + (p.unit || '')), h('span', null, rows[hv].label)) : null),
      h('div', { className: 'tbar__axis' },
        h('span', null, rows[0].label),
        h('span', null, rows[Math.floor(rows.length / 2)].label),
        h('span', null, rows[rows.length - 1].label)));
  }

  /* ------------------------------------------------------------ Ranked bars
     Magnitude down a list: the thing, its count, its share, and a bar for the eye to sort
     by. One hue, because nothing here is a category — the bars are all the same measure. */
  function RankBars(p) {
    var rows = p.rows || [];
    if (!rows.length) return h(HRMS.ui.Empty, { icon: I.reports, title: p.emptyTitle || 'Nothing to show' });
    var max = Math.max.apply(null, rows.map(function (r) { return r.value; }).concat([1]));
    return h('div', { className: 'rbar' }, rows.map(function (r) {
      return h('div', { className: 'rbar__row', key: r.label, title: r.label },
        h('span', { className: 'rbar__label' }, r.label),
        h('span', { className: 'rbar__n' }, r.value),
        r.rate != null ? h('span', { className: 'rbar__pc' }, r.rate + '%') : null,
        h('span', { className: 'rbar__track' },
          h('span', { className: 'rbar__fill', style: { width: Math.max(pct(r.value, max), 2) + '%' } })));
    }));
  }


  /* -------------------------------------------------------------- Day strip
     A state per day, not a quantity. An earlier version drew these as bars whose height
     stood for the status — full for a day worked, lower for late, lower still for absent —
     which gives a category a magnitude it does not have: the heights were invented, so the
     eye compared numbers that were not numbers.

     The one after that was a weekday grid, a month laid out as a calendar. It read well
     and cost three hundred pixels to say thirty things, which left the card towering over
     everything beside it.

     Thirty days in a row is a sequence, not a month, so it is drawn as one: a strip of
     cells, oldest to newest, each carrying its state as colour. Runs are what matter here
     — four absences together, a late among the present — and a run reads as well along a
     line as it does in a grid, in a fraction of the height. Weekends and holidays stay
     quiet so the working pattern is what stands out, a legend names every state that
     occurs, and each cell gives its date and hours on hover. */
  function DayStrip(p) {
    var hoverSt = React.useState(null);
    var days = p.days || [];
    if (!days.length) return null;

    var TONE = p.tones || {};
    var seen = [];
    days.forEach(function (d) { if (seen.indexOf(d.status) < 0) seen.push(d.status); });
    var legend = (p.order || seen).filter(function (k) { return seen.indexOf(k) >= 0; });

    var hv = hoverSt[0];
    var reading = hv != null ? days[hv] : days[days.length - 1];

    return h('div', { className: 'dstrip' },
      h('div', { className: 'dstrip__row', onMouseLeave: function () { hoverSt[1](null); } },
        days.map(function (d, i) {
          return h('span', {
            key: d.date, className: 'dstrip__d is-' + (TONE[d.status] || 'none') + (hv === i ? ' is-on' : ''),
            tabIndex: 0, role: 'img', 'aria-label': d.dateLabel + ': ' + d.status,
            onMouseEnter: function () { hoverSt[1](i); },
            onFocus: function () { hoverSt[1](i); }, onBlur: function () { hoverSt[1](null); }
          });
        })),
      h('div', { className: 'dstrip__axis' },
        h('span', null, ui().shortDate(days[0].date)),
        h('span', null, ui().shortDate(days[Math.floor(days.length / 2)].date)),
        h('span', null, ui().shortDate(days[days.length - 1].date))),
      h('div', { className: 'dstrip__foot' },
        h('span', { className: 'dstrip__read' },
          h('strong', null, reading.status),
          h('span', null, reading.dateLabel
            + (reading.hours ? ' · ' + reading.hours + 'h' : '')
            + (reading.lateBy ? ' · ' + reading.lateBy + ' min late' : ''))),
        h('span', { className: 'dstrip__key' }, legend.map(function (k) {
          return h('span', { className: 'dstrip__ki', key: k },
            h('i', { className: 'is-' + (TONE[k] || 'none'), 'aria-hidden': 'true' }), k);
        }))));
  }

  /* ----------------------------------------------------------- Status tiles
     Not a series. Each tile is a state, and carries an icon and a label of its own, so the
     colour repeats what the words already say rather than being the only way to tell them
     apart. Tones come from the app's status tokens, so they follow light and dark with
     everything else. */
  function Tiles(p) {
    return h('div', { className: 'tiles' }, (p.items || []).map(function (t) {
      return h('div', { className: 'tile tile--' + (t.tone || 'brand'), key: t.label,
        onClick: t.onClick || null, role: t.onClick ? 'button' : undefined,
        tabIndex: t.onClick ? 0 : undefined },
        h('span', { className: 'tile__ico' }, t.icon),
        h('span', { className: 'tile__m' },
          h('strong', null, t.value),
          h('span', null, t.label)));
    }));
  }

  HRMS.charts = { Gauge: Gauge, TrendBars: TrendBars, RankBars: RankBars, Tiles: Tiles, DayStrip: DayStrip };
})();

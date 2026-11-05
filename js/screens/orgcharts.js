/* Two more ways to read the same reporting line.

   The card chart answers "who reports to whom" one branch at a time, which is the
   right shape for changing something. It is the wrong shape for seeing the whole
   organisation at once: 248 people in boxes is a map you have to walk.

   Vertical is a reporting path, read top to bottom: the person at the head of the
   organisation, then their reports as a panel of cards, then — for whichever of
   those you open — that person's reports in the next panel down. One branch is open
   at a time, so the page grows downwards and never sideways, however wide a team is.
   It is plain React and CSS rather than a chart: it is a list of people, and a list
   of people reads best as cards with names on them.

   Network is a collapsible force-directed tree, built the way amCharts' own demo of
   one is built (and the way Tracklivo draws its force-directed chart): people as
   circles sized by the group under them, their name inside the circle, pushed apart
   gently and pulled to the centre firmly so the picture settles rather than drifts.
   It is the view for shape — which teams are large, which sit alone, how deep a
   branch runs — rather than for detail; the tooltip carries the role.

   Both are amCharts 5, drawn into a plain element the React tree owns but does not
   touch: amCharts manages its own DOM under that node, so React must never re-render
   through it. The root is disposed when the view changes or the screen unmounts, which
   is the one thing that leaks here if it is forgotten. */
(function () {
  var HRMS = window.HRMS;
  var React = window.React, h = React.createElement;

  /* The design system's own palette, so the charts belong to the product rather than
     arriving in amCharts' default colours. Read from the stylesheet at draw time, so a
     change of accent — Organization → Branding — carries into them. */
  function cssVar(name, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    } catch (e) { return fallback; }
  }
  function palette() {
    var brand = cssVar('--brand-solid', '#5733c1');
    return ['#3d2496', brand, '#7a5ad2', '#a690e4', '#2f7ae5', '#1f7a6e', '#2f8a52', '#c2741a', '#c02848', '#b4249e']
      .map(function (c) { return window.am5.color(c); });
  }

  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/);
    return ((parts[0] || '')[0] || '') + ((parts[1] || '')[0] || '');
  }

  /* The directory as one nested tree. `value` is the size of the subtree, so a circle
     is as big as the group under it — which is the only honest thing for a circle to
     mean on an org chart. */
  function treeData(staff, rootId) {
    var byManager = {};
    staff.forEach(function (n) {
      var k = n.k || '\u0000root';
      (byManager[k] = byManager[k] || []).push(n);
    });
    function build(node, depth, branch) {
      var kids = (byManager[node.id] || []).map(function (k, i) { return build(k, depth + 1, depth === 0 ? i : branch); });
      var out = {
        id: node.id, name: node.id, role: node.r || '', dept: node.d || '',
        mark: initials(node.id), depth: depth, branch: branch
      };
      if (kids.length) {
        out.children = kids;
        out.value = kids.reduce(function (a, c) { return a + (c.value || 1); }, 0);
      } else {
        out.value = 1;
      }
      return out;
    }
    var root = staff.filter(function (n) { return n.id === rootId; })[0]
      || (byManager['\u0000root'] || [])[0];
    return root ? [build(root, 0, -1)] : [];
  }

  /* One element, owned by amCharts. The key forces a fresh node per view, so a chart
     never inherits the DOM another one left behind. */
  function AmChart(p) {
    var ref = React.useRef(null);
    React.useEffect(function () {
      var el = ref.current;
      if (!el || !window.am5) return;
      var root = window.am5.Root.new(el);
      root.setThemes([
        window.am5themes_Animated.new(root),
        window.am5themes_Responsive.new(root)
      ]);
      /* The amCharts credit sits over the chart in a prototype that is not public
         data; the licence allows it to stay, so it stays. */
      try { p.draw(root, window.am5, window.am5hierarchy); } catch (e) {
        if (window.console) window.console.error('org chart:', e);
      }
      return function () { root.dispose(); };
    }, [p.view, p.epoch]);
    return h('div', { className: 'amc' + (p.tall ? ' amc--tall' : ''), ref: ref, 'aria-label': p.label, role: 'img' });
  }

  /* -------------------------------------------------------------------- vertical */
  /* The department decides the colour, from the avatar tones the rest of the app uses,
     so a person is the same colour here as on their profile chip. */
  var TONES = ['violet', 'blue', 'green', 'peach', 'grey'];
  function toneFor(dept, depts) {
    var i = depts.indexOf(dept);
    return TONES[(i < 0 ? 0 : i) % TONES.length];
  }

  function VerticalTree(p) {
    var staff = p.staff;
    var byManager = React.useMemo(function () {
      var m = {};
      staff.forEach(function (n) { (m[n.k || '\u0000'] = m[n.k || '\u0000'] || []).push(n); });
      Object.keys(m).forEach(function (k) { m[k].sort(function (a, b) { return a.id < b.id ? -1 : 1; }); });
      return m;
    }, [staff]);
    var depts = React.useMemo(function () {
      return staff.map(function (n) { return n.d; }).filter(function (d, i, a) { return a.indexOf(d) === i; }).sort();
    }, [staff]);
    /* Everyone under a person, at any depth: the number a manager is usually asked. */
    var under = React.useMemo(function () {
      var memo = {};
      function count(id) {
        if (memo[id] != null) return memo[id];
        var kids = byManager[id] || [];
        return (memo[id] = kids.reduce(function (a, k) { return a + 1 + count(k.id); }, 0));
      }
      staff.forEach(function (n) { count(n.id); });
      return memo;
    }, [staff, byManager]);

    var root = staff.filter(function (n) { return n.id === p.rootId; })[0] || (byManager['\u0000'] || [])[0];
    var pathSt = React.useState(root ? [root.id] : []);
    var path = pathSt[0];
    if (!root) return null;

    function find(id) { return staff.filter(function (n) { return n.id === id; })[0]; }
    function open(level, id) {
      /* Opening a person at a level replaces everything below it; opening the person
         who is already open there folds their team away again. */
      var next = path.slice(0, level + 1);
      if (path[level + 1] !== id) next.push(id);
      pathSt[1](next);
    }

    /* A plain function, not a component: defined inside the render, a component would
       be a new type every time and every card would remount, losing focus on click. */
    function person(q) {
      var n = q.n, kids = (byManager[n.id] || []).length, tone = toneFor(n.d, depts);
      return h('button', {
        key: n.id, type: 'button',
        className: 'ovt-card ovt--' + tone + (q.on ? ' is-on' : '') + (q.lead ? ' ovt-card--lead' : ''),
        'aria-expanded': kids ? (q.on ? 'true' : 'false') : null,
        title: kids ? (q.on ? 'Fold ' : 'Open ') + n.id + '’s team' : 'Open ' + n.id,
        onClick: function () {
          if (kids && !q.lead) open(q.level, n.id);
          else if (p.onSelect) p.onSelect(n.id);
        }
      },
        h('span', { className: 'ovt-av' }, initials(n.id)),
        h('span', { className: 'ovt-card__m' },
          h('strong', null, n.id),
          h('span', null, n.r || '—'),
          h('small', null, n.d)),
        kids ? h('span', { className: 'ovt-count', 'aria-hidden': 'true' },
          kids, h('svg', { viewBox: '0 0 12 12', width: 10, height: 10 },
            h('path', { d: q.on ? 'M3 7.5L6 4.5 9 7.5' : 'M3 4.5L6 7.5 9 4.5', stroke: 'currentColor', strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' })))
          : null);
    }

    var levels = path.map(function (id, i) {
      var who = find(id), kids = byManager[id] || [];
      return { i: i, who: who, kids: kids };
    });

    return h('div', { className: 'ovt' + (p.big ? ' ovt--big' : '') },
      /* Where you are, and a way back to any step of it. */
      h('nav', { className: 'ovt-crumbs', 'aria-label': 'Reporting path' },
        path.map(function (id, i) {
          var last = i === path.length - 1;
          return h(React.Fragment, { key: id },
            i ? h('span', { className: 'ovt-crumbs__sep', 'aria-hidden': 'true' }, '›') : null,
            h('button', {
              type: 'button', className: 'ovt-crumbs__b' + (last ? ' is-on' : ''),
              'aria-current': last ? 'step' : null,
              onClick: function () { pathSt[1](path.slice(0, i + 1)); }
            }, id));
        }),
        path.length > 1 ? h('button', { type: 'button', className: 'ovt-crumbs__reset',
          onClick: function () { pathSt[1]([root.id]); } }, 'Fold all') : null),

      /* The head of the organisation. */
      h('div', { className: 'ovt-head' },
        person({ n: root, lead: true, level: -1 }),
        h('span', { className: 'ovt-head__meta' }, (byManager[root.id] || []).length + ' direct reports · ' + under[root.id] + ' in the organisation')),

      levels.map(function (lv) {
        if (!lv.kids.length) return null;
        return h(React.Fragment, { key: lv.who.id },
          h('span', { className: 'ovt-stem', 'aria-hidden': 'true' }),
          h('section', { className: 'ovt-tier', 'aria-label': 'Reports to ' + lv.who.id },
            h('header', { className: 'ovt-tier__h' },
              h('span', { className: 'ovt-av ovt-av--sm ovt--' + toneFor(lv.who.d, depts) }, initials(lv.who.id)),
              h('span', null, 'Reports to ', h('b', null, lv.who.id)),
              h('span', { className: 'ovt-tier__n' }, lv.kids.length + (lv.kids.length === 1 ? ' person' : ' people') +
                (under[lv.who.id] > lv.kids.length ? ' · ' + under[lv.who.id] + ' in the branch' : ''))),
            h('div', { className: 'ovt-grid' }, lv.kids.map(function (k) {
              return person({ n: k, level: lv.i, on: path[lv.i + 1] === k.id });
            }))));
      }),

      h('p', { className: 'ovt-hint' },
        'Open a card with a count to see that person’s team below it. A card without one opens the person.'));
  }

  /* ------------------------------------------------------------------- network */
  /* A collapsible force-directed tree that reads as a reporting line rather than a
     heap of bubbles. Three decisions do it:

     - size by level, not by headcount. amCharts sizes a circle by everything under it,
       so the head of a 248-person organisation was a planet and everyone else was dust.
       Here the root is largest, then directors, then managers, then individuals, so the
       eye reads depth at a glance. (The series' own radius step is replaced on this one
       instance; it only sets the circle's radius, which the collision force reads.)
     - colour by branch. Each director's team takes one colour, lighter at each level
       down, so a team reads as one group instead of the palette cycling node by node.
     - links that carry the flow: each is drawn in the colour of the team it feeds and
       thins with depth, so a reporting line can be followed out from the centre. */
  var LEVEL_R = [46, 30, 21, 15];
  function drawNetwork(data, onSelect) {
    return function (root, am5, am5hierarchy) {
      var chart = root.container.children.push(am5.SerialChartContainer.new(root, {
        width: am5.p100, height: am5.p100, layout: root.verticalLayout
      }));

      var series = chart.series.push(am5hierarchy.ForceDirected.new(root, {
        singleBranchOnly: false,
        downDepth: 1,
        initialDepth: 1,
        valueField: 'value',
        categoryField: 'name',
        childDataField: 'children',
        idField: 'id',
        manyBodyStrength: -18,
        centerStrength: 0.7,
        nodePadding: 7,
        velocityDecay: 0.45
      }));
      /* Zoom and pan, with the buttons, so a wide-open branch can always be brought
         back into the frame. */
      chart.zoomableContainer.setAll({ wheelable: true, pinchZoom: true, minZoomLevel: 0.3, maxZoomLevel: 4 });
      chart.set('zoomTools', am5.ZoomTools.new(root, {}));

      var colours = palette().slice(1);   // the first, darkest, is the root's
      function branchColour(d) {
        if (!d || d.depth === 0) return am5.color(cssVar('--brand-solid', '#5733c1'));
        var c = colours[(d.branch < 0 ? 0 : d.branch) % colours.length];
        return d.depth <= 1 ? c : am5.Color.lighten(c, Math.min(0.55, (d.depth - 1) * 0.28));
      }

      series._updateRadius = function (dataItem) {
        var d = dataItem.dataContext || {};
        var r = LEVEL_R[Math.min(d.depth || 0, LEVEL_R.length - 1)];
        dataItem.get('circle').animate({ key: 'radius', to: r, duration: this.get('animationDuration', 0) });
      };

      series.circles.template.setAll({ fillOpacity: 1, strokeWidth: 3, stroke: am5.color(cssVar('--bg-surface', '#ffffff')),
        shadowColor: am5.color(0x2a1866), shadowOpacity: 0.16, shadowBlur: 10, shadowOffsetY: 3 });
      series.circles.template.adapters.add('fill', function (fill, target) {
        return branchColour(target.dataItem && target.dataItem.dataContext);
      });
      /* The dashed ring marks a person whose team is folded away. */
      series.outerCircles.template.setAll({ strokeOpacity: 0.5, strokeWidth: 1.5, strokeDasharray: [3, 3] });
      series.outerCircles.template.adapters.add('stroke', function (st, target) {
        return branchColour(target.dataItem && target.dataItem.dataContext);
      });

      series.links.template.setAll({ strength: 0.7, distance: 1.25, strokeOpacity: 0.55 });
      series.links.template.adapters.add('stroke', function (st, target) {
        var t = target.get('target');
        return branchColour(t && t.dataContext);
      });
      series.links.template.adapters.add('strokeWidth', function (w, target) {
        var t = target.get('target'), d = t && t.dataContext;
        return d ? Math.max(1.2, 3.2 - (d.depth - 1) * 0.9) : 1.5;
      });

      /* First names where there is room for them, initials where there is not; the
         tooltip always carries the whole name and the role. */
      series.labels.template.setAll({
        fontSize: 12, fontWeight: '600', textAlign: 'center', fill: am5.color(0xffffff),
        oversizedBehavior: 'fit', minScale: 0.7, populateText: true
      });
      series.labels.template.adapters.add('text', function (text, target) {
        var d = target.dataItem && target.dataItem.dataContext;
        if (!d) return text;
        if (d.depth === 0) return '[bold]' + d.name + '[/]';
        return d.depth === 1 ? String(d.name).split(' ')[0] : d.mark;
      });
      series.labels.template.adapters.add('fill', function (f, target) {
        var d = target.dataItem && target.dataItem.dataContext;
        return d && d.depth >= 3 ? am5.color(0x2a1866) : am5.color(0xffffff);
      });

      series.nodes.template.setAll({ tooltipText: '[bold]{category}[/]\n{role} · {dept}', draggable: true });
      series.nodes.template.events.on('click', function (ev) {
        var d = ev.target.dataItem && ev.target.dataItem.dataContext;
        if (d && onSelect) onSelect(d.id);
      });

      series.data.setAll(data);
      series.set('selectedDataItem', series.dataItems[0]);
      series.appear(900, 100);
    };
  }


  /* ====================================================== ApexTree

     The reporting chart, as a real tree rather than a pannable field of cards. The
     card chart is still here — it is the one you drag people around in — but it
     answers "who reports to whom" one branch at a time, and the first thing anybody
     wants from an org chart is the shape of the top levels at once.

     ApexTree is vendored (vendor/apextree.js) for the same reason amCharts is: the CDN
     is not reachable from this container. It is pinned at 1.0.0, the last MIT release —
     every version from 1.6.2 on is under a proprietary licence and stamps an APEXCHARTS
     watermark across the chart unless a licence key is set. 1.0.0 has no expand and
     collapse, which is why this drills instead: three levels at a time from whoever is
     at the top of the view, and clicking a manager makes them the top.

     Every colour comes from the stylesheet rather than from the library's options, so
     the chart follows the accent set on Branding and reads in dark mode. That is also
     why the node template emits classes rather than inline styles.

     amCharts' rule applies here too: the library owns the DOM under a node React
     renders once and never touches, and the instance is destroyed on unmount. */

  /* A name can carry anything; it is written into an HTML string, so it is escaped. */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* How many cards can be on screen before the tree stops being a picture. Two levels
     under a 13-report manager is 93 cards, and 93 cards scaled to fit a card is a grey
     smear — so the depth is chosen from the branch rather than fixed: three levels
     where the branch is small enough to read, two where it is not. */
  var APEX_BUDGET = 34;

  /* The directory as ApexTree's nested shape, cut at the depth the branch can carry.
     `data` carries what the node template draws; a node with reports below the cut
     says how many, because a leaf that is not a leaf is the one thing a tree must not
     imply. */
  function apexData(staff, rootId) {
    var byManager = {};
    staff.forEach(function (n) { (byManager[n.k || '\u0000root'] = byManager[n.k || '\u0000root'] || []).push(n); });
    Object.keys(byManager).forEach(function (k) {
      byManager[k].sort(function (a, b) { return a.id < b.id ? -1 : 1; });
    });
    var root = staff.filter(function (n) { return n.id === rootId; })[0] || staff[0];

    /* Everyone under this person, however deep, so a cut-off card can say how many. */
    function below(id) {
      var kids = byManager[id] || [];
      return kids.reduce(function (n, k) { return n + 1 + below(k.id); }, 0);
    }

    /* How many cards three levels would draw, so the choice is made once, up front,
       rather than discovered halfway down the tree. */
    var direct = byManager[root.id] || [];
    var three = 1 + direct.length + direct.reduce(function (n, k) {
      return n + (byManager[k.id] || []).length;
    }, 0);
    var maxDepth = three <= APEX_BUDGET ? 3 : 2;

    function build(node, depth) {
      var kids = byManager[node.id] || [];
      var cut = depth >= maxDepth - 1 && kids.length;
      var out = {
        id: node.id,
        data: {
          name: node.id,
          title: node.r || '',
          subtitle: node.d || '',
          mark: initials(node.id),
          /* The tone is picked by department name, so a branch reads as one colour
             without anybody choosing colours by hand. */
          tone: depth === 0 ? 'root' : 't' + (Math.abs(hashOf(node.d || '')) % 5),
          /* Only the top two levels carry a badge; below that it is noise. */
          badge: depth <= 1 && node.r ? shortTitle(node.r) : null,
          reports: kids.length,
          more: cut ? below(node.id) : 0
        }
      };
      if (kids.length && !cut) out.children = kids.map(function (k) { return build(k, depth + 1); });
      return out;
    }
    return build(root, 0);
  }
  function hashOf(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) { n = (n * 31 + s.charCodeAt(i)) | 0; }
    return n;
  }
  /* "Chief Technology Officer" reads as CTO on a badge; anything that is not a title
     of that shape keeps its first word. */
  function shortTitle(t) {
    var words = String(t).split(/\s+/).filter(Boolean);
    if (words.length >= 3 && /^(chief|head|vice|senior)$/i.test(words[0])) {
      return words.map(function (w) { return w[0]; }).join('').toUpperCase().slice(0, 4);
    }
    return words[0] || '';
  }
  /* The line from the organisation's head down to whoever is at the top of the view. */
  function chainTo(staff, topId, id) {
    var by = {};
    staff.forEach(function (n) { by[n.id] = n; });
    var out = [], cur = by[id], guard = 0;
    while (cur && guard++ < 50) { out.unshift(cur.id); if (cur.id === topId) break; cur = by[cur.k]; }
    return out;
  }

  function ApexOrgTree(p) {
    var hostRef = React.useRef(null);
    var topSt = React.useState(p.rootId);
    var top = topSt[0];
    var onSelect = p.onSelect;
    var staff = p.staff;

    /* Whoever is at the top of the view comes from the props when they change — moving
       somebody rebuilds the chart — and from a click the rest of the time. */
    React.useEffect(function () { topSt[1](p.rootId); }, [p.rootId, p.epoch]);

    var trail = React.useMemo(function () {
      return chainTo(staff, p.rootId, top);
    }, [staff, p.rootId, top]);

    React.useEffect(function () {
      var el = hostRef.current;
      if (!el || !window.ApexTree) return;
      el.innerHTML = '';

      /* Left to right rather than top down. The sample in ApexTree's own docs has
         three people at the top level; a real organisation has thirteen, and thirteen
         cards side by side is 3,000px of tree squeezed into a 1,000px card. Laid on
         its side the siblings run down the page, which is the direction a page
         already scrolls. */
      var data = apexData(staff, top);
      var widest = 1;
      (function measure(n, d, counts) {
        counts[d] = (counts[d] || 0) + 1;
        widest = Math.max(widest, counts[d]);
        (n.children || []).forEach(function (k) { measure(k, d + 1, counts); });
      })(data, 0, {});

      var tree = new window.ApexTree(el, {
        contentKey: 'data',
        width: el.clientWidth || 1000,
        height: Math.max(p.big ? Math.max(480, window.innerHeight - 250) : 460,
          widest * 104 + 40),
        nodeWidth: 254,
        nodeHeight: 80,
        childrenSpacing: 72,
        siblingSpacing: 26,
        direction: 'left',
        enableToolbar: true,
        highlightOnHover: false,
        containerClassName: 'axroot',
        /* The card is ours, so the library draws no box of its own behind it. */
        nodeBGColor: 'transparent', nodeBGColorHover: 'transparent',
        borderWidth: 0, borderColor: 'transparent', borderColorHover: 'transparent',
        borderRadius: '16px',
        edgeColor: cssVar('--border-default', '#d8d8e0'),
        edgeColorHover: cssVar('--brand-solid', '#5733c1'),
        canvasStyle: 'background: transparent;',
        fontFamily: 'inherit',
        nodeTemplate: function (c) {
          c = c || {};
          return '<div class="axn axn--' + esc(c.tone || 't0') + (c.more ? ' has-more' : '') + '">'
            + '<span class="axn__a">' + esc(c.mark || '') + '</span>'
            + '<span class="axn__m">'
            + '<strong>' + esc(c.name) + '</strong>'
            + '<span>' + esc(c.title) + '</span>'
            + '<em>' + esc(c.subtitle)
            + (c.reports ? ' · ' + c.reports + ' direct' : '') + '</em>'
            + '</span>'
            + (c.badge ? '<span class="axn__b">' + esc(c.badge) + '</span>' : '')
            + (c.more ? '<span class="axn__more">+' + c.more + '</span>' : '')
            + '</div>';
        }
      });

      try { tree.render(data); } catch (e) { /* drawn or not, the page stands */ }

      /* The node is an HTML string, so the click is caught once on the host: a card
         with people hidden below it opens that branch, any other card opens the
         person. */
      function click(ev) {
        var card = ev.target && ev.target.closest ? ev.target.closest('.axn') : null;
        if (!card) return;
        var name = card.querySelector('strong');
        if (!name) return;
        if (card.classList.contains('has-more')) topSt[1](name.textContent);
        else if (onSelect) onSelect(name.textContent);
      }
      el.addEventListener('click', click);

      return function () {
        el.removeEventListener('click', click);
        try { tree.destroy && tree.destroy(); } catch (e) {}
        el.innerHTML = '';
      };
    }, [staff, top, p.big]);

    if (!window.ApexTree) {
      return h('div', { className: 'amc__miss' }, 'The tree library did not load.');
    }
    return h('div', { className: 'axwrap' + (p.big ? ' is-full' : '') },
      trail.length > 1
        ? h('nav', { className: 'axcrumb', 'aria-label': 'Reporting line' }, trail.map(function (id, i) {
            var last = i === trail.length - 1;
            return h(React.Fragment, { key: id },
              i ? h('span', { className: 'axcrumb__s', 'aria-hidden': 'true' }, '›') : null,
              last
                ? h('span', { className: 'axcrumb__c is-on', 'aria-current': 'true' }, id)
                : h('button', { type: 'button', className: 'axcrumb__c',
                    onClick: function () { topSt[1](id); } }, id));
          }))
        : null,
      h('div', { className: 'apextree', ref: hostRef }));
  }

  HRMS.orgcharts = {
    AmChart: AmChart,
    treeData: treeData,
    VerticalTree: VerticalTree,
    ApexOrgTree: ApexOrgTree,
    apexReady: function () { return !!window.ApexTree; },
    drawNetwork: drawNetwork,
    ready: function () { return !!(window.am5 && window.am5hierarchy); }
  };
})();

/* Two more ways to read the same reporting line.

   The card chart answers "who reports to whom" one branch at a time, which is the
   right shape for changing something. It is the wrong shape for seeing the whole
   organisation at once: 248 people in boxes is a map you have to walk.

   Vertical is the tree, top to bottom: the root at the head of the page, each level
   below the one it reports to, the way an org chart is read on paper. It opens one
   level deep and every click opens the next one down the branch being read.

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
    function build(node) {
      var kids = (byManager[node.id] || []).map(function (k) { return build(k); });
      var out = {
        id: node.id, name: node.id, role: node.r || '', dept: node.d || '',
        mark: initials(node.id)
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
    return root ? [build(root)] : [];
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
  /* amCharts' Tree spaces siblings by the size of everything under them, folded or not,
     so a director with forty reports claimed forty slots of width while leaf reports
     were crushed together at the far end. This tree is therefore handed only the
     branches that are open, and does its own opening and closing: a click rebuilds the
     data with that branch toggled, and the layout spaces what is actually on screen. */
  function prune(node, open) {
    var out = { id: node.id, name: node.name, role: node.role, dept: node.dept, mark: node.mark, value: 1,
      more: (node.children || []).length };
    if (node.children && open[node.id]) {
      out.children = node.children.map(function (c) { return prune(c, open); });
      out.more = 0;
    }
    return out;
  }

  function depthOf(node) {
    return 1 + Math.max.apply(null, [0].concat((node.children || []).map(depthOf)));
  }
  function widestLevel(node) {
    var counts = [];
    (function walk(n, d) {
      counts[d] = (counts[d] || 0) + 1;
      (n.children || []).forEach(function (c) { walk(c, d + 1); });
    })(node, 0);
    return Math.max.apply(null, counts);
  }

  /* A branch opening or closing redraws the tree on the same root. Adding nodes to a
     Tree that is already drawn leaves them hidden, and a fresh draw is also what lets
     the layout space the new shape properly rather than squeezing it into the old one. */
  function drawVertical(data, onSelect, openState) {
    return function draw(root, am5, am5hierarchy) {
      var open = openState || {};
      if (!openState && data[0]) open[data[0].id] = true;   // the root opens on its direct reports
      var shown = data[0] ? prune(data[0], open) : null;

      /* Each level gets a fixed height rather than a share of the card, so two levels
         sit close together instead of being stretched to the bottom edge; and a name
         wraps to the width its sibling slot actually has. */
      var levels = shown ? depthOf(shown) : 1;
      var width = (root.dom && root.dom.clientWidth) || 1100;
      var slot = width / Math.max(1, shown ? widestLevel(shown) : 1);
      var labelWidth = Math.max(60, Math.min(130, slot - 18));

      var chart = root.container.children.push(am5.SerialChartContainer.new(root, {
        width: am5.p100, height: am5.p100
      }));
      chart.zoomableContainer.setAll({ wheelable: true, pinchZoom: true, maxZoomLevel: 6, minZoomLevel: 0.3 });
      chart.set('zoomTools', am5.ZoomTools.new(root, {}));

      var series = chart.series.push(am5hierarchy.Tree.new(root, {
        singleBranchOnly: false,
        downDepth: 1,
        initialDepth: 99,
        valueField: 'value',
        categoryField: 'name',
        childDataField: 'children',
        idField: 'id',
        orientation: 'vertical',
        height: Math.min(((root.dom && root.dom.clientHeight) || 700) - 20, 60 + levels * 170),
        paddingTop: 34, paddingBottom: 96, paddingLeft: 50, paddingRight: 50
      }));

      series.get('colors').set('colors', palette());
      series.circles.template.setAll({ radius: 22, strokeWidth: 3, stroke: am5.color(cssVar('--bg-surface', '#ffffff')) });
      series.outerCircles.template.setAll({ forceHidden: true });
      series.links.template.setAll({ strokeWidth: 1.5, strokeOpacity: 0.35 });

      series.labels.template.setAll({
        text: '{mark}', fontSize: 13, fontWeight: '600',
        fill: am5.color(0xffffff), centerX: am5.p50, centerY: am5.p50, populateText: true
      });
      series.bullets.push(function (rt, se, dataItem) {
        var d = dataItem.dataContext || {};
        return am5.Bullet.new(rt, {
          locationY: 0,
          sprite: am5.Label.new(rt, {
            text: '[bold]' + (d.name || '') + '[/]\n[fontSize:10px]' + (d.role || '') +
              (d.more ? '\n[#5733c1]+' + d.more + (d.more === 1 ? ' report' : ' reports') + '[/]' : '') + '[/]',
            fill: am5.color(cssVar('--text-secondary', '#555555')),
            fontSize: slot < 100 ? 10 : 11.5, textAlign: 'center', centerX: am5.p50, centerY: am5.p0,
            dy: 30, maxWidth: labelWidth, oversizedBehavior: 'wrap'
          })
        });
      });

      series.nodes.template.setAll({ tooltipText: '[bold]{category}[/]\n{role} · {dept}', toggleKey: 'none' });
      series.nodes.template.events.on('click', function (ev) {
        var d = ev.target.dataItem && ev.target.dataItem.dataContext;
        if (!d) return;
        var src = find(data[0], d.id);
        if (src && src.children && src.children.length) {
          open[d.id] = !open[d.id];
          /* Defer past this click's own handling before tearing the chart down. */
          setTimeout(function () {
            root.container.children.clear();
            drawVertical(data, onSelect, open)(root, am5, am5hierarchy);
          }, 0);
        } else if (onSelect) {
          onSelect(d.id);   // a leaf has nothing to open, so a click opens the person
        }
      });

      function find(node, id) {
        if (!node) return null;
        if (node.id === id) return node;
        for (var i = 0; i < (node.children || []).length; i++) {
          var hit = find(node.children[i], id);
          if (hit) return hit;
        }
        return null;
      }

      series.data.setAll(shown ? [shown] : []);
      series.set('selectedDataItem', series.dataItems[0]);
      series.appear(500, 50);
    };
  }

  /* ------------------------------------------------------------------- network */
  /* The collapsible force-directed tree, on amCharts' own recipe: the stock forces,
     a soft shadow under each circle, every other colour so neighbouring branches
     differ, and the name inside the circle. Only the palette and the click are ours. */
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
        minRadius: 24,
        maxRadius: am5.percent(9),
        manyBodyStrength: -10,
        centerStrength: 0.8
      }));

      series.get('colors').setAll({ colors: palette(), step: 2 });
      series.links.template.setAll({ strength: 0.5, strokeOpacity: 0.4 });
      series.circles.template.setAll({
        fillOpacity: 1,
        shadowColor: am5.color(0x000000), shadowOpacity: 0.25, shadowBlur: 6, shadowOffsetX: 2, shadowOffsetY: 2
      });
      series.outerCircles.template.setAll({ strokeOpacity: 0.35, strokeDasharray: [3, 3] });

      /* The name, fitted into its own circle. A circle too small for the whole name
         shows the first one, and the tooltip always has the whole name and role. */
      series.labels.template.setAll({
        text: '{name}', fontSize: 12, fontWeight: '600', textAlign: 'center',
        fill: am5.color(0xffffff), oversizedBehavior: 'fit', minScale: 0.6
      });
      series.labels.template.adapters.add('text', function (text, target) {
        var di = target.dataItem, circle = di && di.get('circle');
        var r = circle ? circle.get('radius', 0) : 0;
        var d = di && di.dataContext;
        return d && r < 40 ? String(d.name || '').split(' ')[0] : text;
      });

      series.nodes.template.set('tooltipText', '[bold]{category}[/]\n{role} · {dept}');
      series.nodes.template.events.on('click', function (ev) {
        var d = ev.target.dataItem && ev.target.dataItem.dataContext;
        if (d && onSelect) onSelect(d.id);
      });

      series.data.setAll(data);
      series.set('selectedDataItem', series.dataItems[0]);
      series.appear(1000, 100);
    };
  }

  HRMS.orgcharts = {
    AmChart: AmChart,
    treeData: treeData,
    drawVertical: drawVertical,
    drawNetwork: drawNetwork,
    ready: function () { return !!(window.am5 && window.am5hierarchy); }
  };
})();

/* Two more ways to read the same reporting line.

   The card chart answers "who reports to whom" one branch at a time, which is the
   right shape for changing something. It is the wrong shape for seeing the whole
   organisation at once: 248 people in boxes is a map you have to walk.

   Horizontal lays the hierarchy left to right. Depth runs across the page rather than
   down it, which is the direction a reporting line is usually read in, and names stay
   horizontal so a deep branch is still legible.

   Network is the force-directed view: everyone as a linked circle, coloured by
   department, laid out by the pull of their own reporting lines rather than by a grid.
   It is pannable and zoomable, and clicking somebody folds or unfolds the people under
   them. It is the view for shape — which teams are large, which sit alone, how deep a
   branch runs — rather than for detail.

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

  /* ------------------------------------------------------------------ horizontal */
  function drawHorizontal(data, onSelect) {
    return function (root, am5, am5hierarchy) {
      var chart = root.container.children.push(am5.SerialChartContainer.new(root, {
        width: am5.percent(100), height: am5.percent(100),
        zoomTools: am5.ZoomTools.new(root, {})
      }));

      var series = chart.series.push(am5hierarchy.Tree.new(root, {
        singleBranchOnly: false,
        downDepth: 2,
        initialDepth: 1,
        valueField: 'value',
        categoryField: 'name',
        childDataField: 'children',
        idField: 'id',
        orientation: 'horizontal'
      }));

      series.get('colors').set('colors', palette());
      series.circles.template.setAll({ radius: 17, strokeWidth: 2, stroke: am5.color(0xffffff) });
      series.outerCircles.template.setAll({ strokeOpacity: 0.35, strokeDasharray: [3, 3] });
      series.links.template.setAll({ strokeWidth: 1.5, strokeOpacity: 0.4 });
      /* No maxWidth and no truncation: a name clipped to an ellipsis is worse than a
         name that overlaps the next branch, and the chart pans. */
      series.labels.template.setAll({
        text: '[bold]{category}[/]\n[fontSize:11px]{role}[/]',
        fontSize: 13, textAlign: 'left', centerX: 0, centerY: am5.p50, paddingLeft: 12,
        fill: am5.color(cssVar('--text-primary', '#111111')),
        oversizedBehavior: 'none'
      });
      series.nodes.template.set('tooltipText', '[bold]{category}[/]\n{role} · {dept}');
      series.nodes.template.events.on('click', function (ev) {
        var d = ev.target.dataItem && ev.target.dataItem.dataContext;
        if (d && onSelect) onSelect(d.id);
      });

      series.data.setAll(data);
      series.set('selectedDataItem', series.dataItems[0]);
      chart.zoomableContainer.setAll({ maxZoomLevel: 6, minZoomLevel: 0.3 });
    };
  }

  /* ------------------------------------------------------------------- network */
  function drawNetwork(data, onSelect) {
    return function (root, am5, am5hierarchy) {
      var chart = root.container.children.push(am5.SerialChartContainer.new(root, {
        width: am5.percent(100), height: am5.percent(100),
        zoomTools: am5.ZoomTools.new(root, {})
      }));

      var series = chart.series.push(am5hierarchy.ForceDirected.new(root, {
        valueField: 'value',
        categoryField: 'name',
        childDataField: 'children',
        idField: 'id',
        minRadius: 21,
        maxRadius: 30,
        initialDepth: 1,
        initialFrames: 400,
        centerStrength: 0.4,
        manyBodyStrength: -22,
        /* The name sits under the circle, so the gap a node keeps has to clear the
           label too, not just the next circle. */
        nodePadding: 40
      }));

      series.get('colors').set('colors', palette());
      series.circles.template.setAll({
        fillOpacity: 1, strokeWidth: 3, stroke: am5.color(cssVar('--bg-surface', '#ffffff'))
      });
      series.outerCircles.template.setAll({ strokeOpacity: 0.3, strokeDasharray: [3, 3] });
      series.links.template.setAll({ strokeWidth: 1.5, strokeOpacity: 0.35 });

      /* The person in the middle of their own circle, and who they are underneath it.
         Two labels rather than one: initials have to sit in the node to read as an
         avatar, and a name long enough to be useful will not fit inside a 44px circle. */
      series.labels.template.setAll({
        text: '{mark}', fontSize: 15, fontWeight: '600',
        fill: am5.color(0xffffff), centerX: am5.p50, centerY: am5.p50,
        populateText: true
      });

      series.nodes.template.setAll({
        tooltipText: '[bold]{category}[/]\n{role} · {dept}',
        draggable: true
      });

      series.nodes.template.events.on('click', function (ev) {
        var d = ev.target.dataItem && ev.target.dataItem.dataContext;
        if (d && onSelect) onSelect(d.id);
      });

      /* The name and designation, hung below each circle. */
      series.bullets.push(function (rt, se, dataItem) {
        var d = dataItem.dataContext || {};
        return am5.Bullet.new(rt, {
          locationY: 0,
          sprite: am5.Label.new(rt, {
            text: '[bold]' + (d.name || '') + '[/]\n[fontSize:10px]' + (d.role || '') + '[/]',
            fill: am5.color(cssVar('--text-secondary', '#555555')),
            fontSize: 11.5, textAlign: 'center',
            centerX: am5.p50, centerY: am5.p0,
            dy: 34,
            oversizedBehavior: 'none'
          })
        });
      });

      series.data.setAll(data);
      chart.zoomableContainer.setAll({ maxZoomLevel: 8, minZoomLevel: 0.25 });
    };
  }

  HRMS.orgcharts = {
    AmChart: AmChart,
    treeData: treeData,
    drawHorizontal: drawHorizontal,
    drawNetwork: drawNetwork,
    ready: function () { return !!(window.am5 && window.am5hierarchy); }
  };
})();

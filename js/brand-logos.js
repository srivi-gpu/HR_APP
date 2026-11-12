/* Brand marks for the integration catalogue.

   An integration card used to draw a coloured tile with the provider's first letter in
   it. That reads as a placeholder: a catalogue of two dozen providers where every one
   is a letter in a box tells you nothing at a glance, and the one thing people scan an
   integration list for is the logo they already recognise.

   So each provider that has a mark simple enough to draw honestly is drawn — Jira,
   Slack, Microsoft, Google, Zoom, Okta and the rest are their own geometry, in their own
   colours, as inline SVG. There is no network request and nothing to go stale.

   Everything else falls back to `monogram`, which is the old tile but in the provider's
   real brand colour rather than a pastel from the seed. A monogram is an honest stand-in
   for a mark we are not going to trace; a wrong logo is not.

   Usage: HRMS.logos.mark('jira', 40) -> a React element, 40px square.
           HRMS.logos.has('jira')      -> whether a real mark exists. */
(function () {
  var HRMS = (window.HRMS = window.HRMS || {});
  var h = React.createElement;

  function svg(size, box, children) {
    return h('svg', {
      width: size, height: size, viewBox: box, focusable: 'false', 'aria-hidden': 'true',
      style: { display: 'block', flex: 'none' }
    }, children);
  }
  function p(d, fill, extra) { return h('path', Object.assign({ key: d.slice(0, 12) + fill, d: d, fill: fill }, extra || {})); }
  function r(x, y, w, hh, rx, fill) {
    return h('rect', { key: 'r' + x + y + fill, x: x, y: y, width: w, height: hh, rx: rx, fill: fill });
  }
  function c(cx, cy, rad, fill, extra) {
    return h('circle', Object.assign({ key: 'c' + cx + cy + fill, cx: cx, cy: cy, r: rad, fill: fill }, extra || {}));
  }

  /* Each entry draws into a 0 0 32 32 box unless it names its own. */
  var MARKS = {
    /* Jira: the rotated square with a square hole, with the two darker wings that give
       it its depth. */
    jira: function (s) {
      return svg(s, '0 0 32 32', [
        p('M16 1.2 30.8 16 16 30.8 1.2 16Z M16 10.9 21.1 16 16 21.1 10.9 16Z', '#2684ff',
          { fillRule: 'evenodd' }),
        p('M16 1.2 30.8 16 23.4 23.4 16 16Z', '#0052cc', { opacity: 0.85 }),
        p('M16 30.8 1.2 16 8.6 8.6 16 16Z', '#0052cc', { opacity: 0.85 })
      ]);
    },
    /* Confluence and Bitbucket share Jira's palette; the Atlassian mark is the A. */
    atlassian: function (s) {
      return svg(s, '0 0 32 32', [
        p('M10.3 15.2a1 1 0 0 0-1.6.2L1.1 30.5a1 1 0 0 0 .9 1.5h10.5a1 1 0 0 0 .9-.6c2.3-4.7.9-11.8-3.1-16.2Z', '#2684ff'),
        p('M15.2 1.5a21.6 21.6 0 0 0-1.3 21.3l5.1 10.2h10.9a1 1 0 0 0 .9-1.5L16.8 1.5a1 1 0 0 0-1.6 0Z', '#0052cc')
      ]);
    },
    /* Slack's pinwheel. Each bar is offset perpendicular to its own length so the four
       rotate around the centre; centred on the same two axes they read as a plus. */
    slack: function (s) {
      return svg(s, '0 0 32 32', [
        r(9.6, 2, 6.4, 16.4, 3.2, '#36c5f0'),
        r(15.6, 9.6, 14.4, 6.4, 3.2, '#2eb67d'),
        r(16, 15.6, 6.4, 14.4, 3.2, '#ecb22e'),
        r(2, 16, 14.4, 6.4, 3.2, '#e01e5a')
      ]);
    },
    /* Outlook and Teams get their own marks rather than the four Microsoft squares:
       four identical tiles down one page says Microsoft, not which Microsoft. */
    outlook: function (s) {
      return svg(s, '0 0 32 32', [
        r(12, 5, 18, 22, 2, '#0f6cbd'),
        p('M14 9h14v3.4l-7 4.6-7-4.6Z', '#fff'),
        p('M14 14.4l7 4.4 7-4.4V23H14Z', '#fff', { opacity: 0.82 }),
        r(1.5, 6.5, 15, 19, 3, '#0358a7'),
        h('text', { key: 'o', x: 9, y: 21.6, fill: '#fff', fontSize: 13.5, fontWeight: 700,
          textAnchor: 'middle', fontFamily: 'Arial, Helvetica, sans-serif' }, 'O')
      ]);
    },
    teams: function (s) {
      return svg(s, '0 0 32 32', [
        r(12.5, 9.5, 17.5, 15, 3, '#5059c9'),
        c(24.5, 6.5, 3.6, '#7b83eb'),
        r(2, 7.5, 17, 19, 3.4, '#4b53bc'),
        h('text', { key: 't', x: 10.5, y: 21.8, fill: '#fff', fontSize: 13.5, fontWeight: 700,
          textAnchor: 'middle', fontFamily: 'Arial, Helvetica, sans-serif' }, 'T')
      ]);
    },
    microsoft: function (s) {
      return svg(s, '0 0 32 32', [
        r(3, 3, 11.6, 11.6, 1, '#f25022'), r(17.4, 3, 11.6, 11.6, 1, '#7fba00'),
        r(3, 17.4, 11.6, 11.6, 1, '#00a4ef'), r(17.4, 17.4, 11.6, 11.6, 1, '#ffb900')
      ]);
    },
    google: function (s) {
      return svg(s, '0 0 48 48', [
        p('M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.6C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9Z', '#ffc107'),
        p('M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.6C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7Z', '#ff3d00'),
        p('M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A11.9 11.9 0 0 1 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44Z', '#4caf50'),
        p('M43.6 20.1H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37.8 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9Z', '#1976d2')
      ]);
    },
    zoom: function (s) {
      return svg(s, '0 0 32 32', [
        r(1, 1, 30, 30, 7.5, '#0b5cff'),
        p('M8.6 11.4h8.2a2.4 2.4 0 0 1 2.4 2.4v4.8a2.4 2.4 0 0 1-2.4 2.4H8.6a2.4 2.4 0 0 1-2.4-2.4v-4.8a2.4 2.4 0 0 1 2.4-2.4Z', '#fff'),
        p('M20.4 14.6 25.2 11.6a.6.6 0 0 1 .9.5v7.8a.6.6 0 0 1-.9.5l-4.8-3Z', '#fff')
      ]);
    },
    okta: function (s) {
      return svg(s, '0 0 32 32', [
        c(16, 16, 9.6, 'none', { stroke: '#007dc1', strokeWidth: 6.2 })
      ]);
    },
    asana: function (s) {
      return svg(s, '0 0 32 32', [
        c(16, 8.6, 5.6, '#f06a6a'), c(8.2, 22.2, 5.6, '#f06a6a'), c(23.8, 22.2, 5.6, '#f06a6a')
      ]);
    },
    trello: function (s) {
      return svg(s, '0 0 32 32', [
        r(1.5, 1.5, 29, 29, 5.5, '#0079bf'),
        r(6, 6, 9, 17, 1.8, '#fff'), r(17.5, 6, 9, 11, 1.8, '#fff')
      ]);
    },
    dropbox: function (s) {
      return svg(s, '0 0 32 32', [
        p('M9.5 4 1.5 9.2l8 5.2 8-5.2ZM24.5 4l-8 5.2 8 5.2 8-5.2Z', '#0061ff'),
        p('M1.5 19.6l8 5.2 8-5.2-8-5.2ZM24.5 14.4l-8 5.2 8 5.2 6.5-4.2Z', '#0061ff'),
        p('M9.6 26.5l8-5.2 7.9 5.2-7.9 4.6Z', '#0061ff', { opacity: 0.85 })
      ]);
    },
    notion: function (s) {
      return svg(s, '0 0 32 32', [
        r(1.5, 1.5, 29, 29, 5, '#fff'),
        h('rect', { key: 'nb', x: 1.5, y: 1.5, width: 29, height: 29, rx: 5, fill: 'none', stroke: '#111', strokeWidth: 1.6 }),
        p('M10 23V9.8l9.6 12.4V9.4', '#111', { stroke: '#111', strokeWidth: 2.4, fill: 'none', strokeLinejoin: 'round' })
      ]);
    },
    github: function (s) {
      return svg(s, '0 0 32 32', [
        p('M16 1.5A14.5 14.5 0 0 0 11.4 29.8c.7.1 1-.3 1-.7v-2.6c-4 .9-4.9-1.9-4.9-1.9-.6-1.7-1.6-2.1-1.6-2.1-1.3-.9.1-.9.1-.9 1.5.1 2.2 1.5 2.2 1.5 1.3 2.2 3.4 1.6 4.2 1.2a3.3 3.3 0 0 1 1-2.1c-3.2-.4-6.5-1.6-6.5-7a5.5 5.5 0 0 1 1.5-3.8 5.1 5.1 0 0 1 .1-3.8s1.2-.4 4 1.5a13.7 13.7 0 0 1 7.2 0c2.8-1.9 4-1.5 4-1.5a5.1 5.1 0 0 1 .1 3.8 5.5 5.5 0 0 1 1.5 3.8c0 5.4-3.3 6.6-6.5 7a3.7 3.7 0 0 1 1.1 2.9v4.3c0 .4.3.8 1 .7A14.5 14.5 0 0 0 16 1.5Z', '#1b1f24')
      ]);
    },
    linkedin: function (s) {
      return svg(s, '0 0 32 32', [
        r(1.5, 1.5, 29, 29, 5, '#0a66c2'),
        r(7, 13, 4, 12, 0.6, '#fff'), c(9, 9.2, 2.4, '#fff'),
        p('M13.6 13h4v1.8a4.4 4.4 0 0 1 3.9-2c3 0 4.5 1.9 4.5 5.4V25h-4v-6.2c0-1.7-.6-2.6-2-2.6s-2.4 1-2.4 2.8V25h-4Z', '#fff')
      ]);
    },
    docusign: function (s) {
      return svg(s, '0 0 32 32', [
        r(1.5, 1.5, 29, 29, 5, '#ffcc22'),
        p('M8.5 20.5c3.5-1 5.4-9 7.8-9s.6 6.6 3 6.6 3.3-3.4 3.3-3.4', 'none',
          { stroke: '#1a1a1a', strokeWidth: 2.4, fill: 'none', strokeLinecap: 'round' }),
        r(8, 23.5, 16, 2.2, 1.1, '#1a1a1a')
      ]);
    },
    sap: function (s) {
      return svg(s, '0 0 32 32', [
        p('M1 7h30l-8 18H1Z', '#0a6ed1'),
        h('text', { key: 't', x: 6.5, y: 20.4, fill: '#fff', fontSize: 9.5, fontWeight: 700,
          fontFamily: 'Arial, Helvetica, sans-serif', letterSpacing: 0.4 }, 'SAP')
      ]);
    },
    zoho: function (s) {
      return svg(s, '0 0 32 32', [
        r(2, 11, 6.2, 10, 1.4, '#e42527'), r(9.3, 11, 6.2, 10, 1.4, '#089949'),
        r(16.6, 11, 6.2, 10, 1.4, '#f9b21d'), r(23.9, 11, 6.2, 10, 1.4, '#226db4')
      ]);
    },
    razorpay: function (s) {
      return svg(s, '0 0 32 32', [
        p('M24.6 3 23 9.2l-9.7 20.8H7.5l7.4-15.7-8.9 5.3L9.4 7l15.2-4Z', '#3395ff'),
        p('M13.3 30 18.6 9.6l5.6-1.4L18.9 30Z', '#072654')
      ]);
    },
    quickbooks: function (s) {
      return svg(s, '0 0 32 32', [
        c(16, 16, 14.5, '#2ca01c'),
        h('text', { key: 't', x: 16, y: 21.5, fill: '#fff', fontSize: 14, fontWeight: 700,
          textAnchor: 'middle', fontFamily: 'Arial, Helvetica, sans-serif' }, 'qb')
      ]);
    },
    freshworks: function (s) {
      return svg(s, '0 0 32 32', [
        p('M16 2a14 14 0 0 0-14 14v11.5A2.5 2.5 0 0 0 4.5 30H16a14 14 0 0 0 0-28Z', '#25c16f'),
        c(12.2, 13.4, 2.2, '#fff'), c(20.2, 13.4, 2.2, '#fff'),
        p('M11 19.4a5.6 5.6 0 0 0 10 0', 'none', { stroke: '#fff', strokeWidth: 2.2, fill: 'none', strokeLinecap: 'round' })
      ]);
    },
    /* Tracklivo is the product this HRMS reports into, so it is the one provider whose
       mark has to be recognisable at a glance in a shelf of thirty-four: a square
       bracket around a tracked path, in its own violet. */
    tracklivo: function (s) {
      return svg(s, '0 0 32 32', [
        r(1.5, 1.5, 29, 29, 8, '#5733c1'),
        p('M8.5 20.5l4.6-5.6 3.6 3.1 6.8-7.4', 'none',
          { stroke: '#fff', strokeWidth: 2.3, strokeLinecap: 'round', strokeLinejoin: 'round' }),
        c(23.5, 10.6, 2.6, '#c9b6ff')
      ]);
    },
    greenhouse: function (s) {
      return svg(s, '0 0 32 32', [
        r(1.5, 1.5, 29, 29, 7, '#24a47f'),
        p('M16 25V13', 'none', { stroke: '#fff', strokeWidth: 2.4, strokeLinecap: 'round' }),
        p('M16 14c-4.4 0-6.8-2.4-6.8-6.8C13.6 7.2 16 9.6 16 14Z', '#fff'),
        p('M16 18c4.4 0 6.8-2.4 6.8-6.8C18.4 11.2 16 13.6 16 18Z', '#fff')
      ]);
    }
  };

  /* Brand colours for the providers we draw a monogram for. The tile is the brand's own
     colour, which is still a recognisable cue even without the mark. */
  var TONES = {
    darwinbox: '#0b2d71', keka: '#f05a28', bamboo: '#8dc63f', workday: '#f68c1e',
    greythr: '#e4002b', tally: '#005ca9', jamf: '#1f2a44', device: '#0f7b53',
    intune: '#0f6cbd', ldap: '#4a5568', zendesk: '#03363d',
    springverify: '#3f3bd6', authbridge: '#e4572e', idfy: '#1f8fd6', hireright: '#00558c',
    generic: '#5b6472'
  };

  function monogram(key, label, size) {
    var bg = TONES[key] || TONES.generic;
    var text = String(label || '?').trim().slice(0, 1).toUpperCase();
    return svg(size, '0 0 32 32', [
      r(0, 0, 32, 32, 9, bg),
      h('text', { key: 't', x: 16, y: 21.6, fill: '#fff', fontSize: 15, fontWeight: 700,
        textAnchor: 'middle', fontFamily: 'inherit' }, text)
    ]);
  }

  HRMS.logos = {
    has: function (key) { return !!MARKS[key]; },
    /* `key` names a mark; `label` is only read when there is no mark to draw. */
    mark: function (key, size, label) {
      var fn = MARKS[key];
      return fn ? fn(size || 40) : monogram(key, label, size || 40);
    },
    tone: function (key) { return TONES[key] || TONES.generic; }
  };
})();

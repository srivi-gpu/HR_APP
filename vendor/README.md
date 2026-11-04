# vendor

`amcharts5.js` is amCharts 5.21.5 — core, hierarchy, and the Animated and
Responsive themes — bundled into one script that sets `am5`, `am5hierarchy`,
`am5themes_Animated` and `am5themes_Responsive` on `window`.

It is committed rather than loaded from `cdn.amcharts.com` for the same reason
the rest of the prototype is a folder of static files: the page should open and
draw without asking anything of the network beyond the host it came from. The
app already depends on a CDN for React, which is the one thing the README warns
about; this does not add a second.

Rebuild it with:

    npm install @amcharts/amcharts5@5.21.5 esbuild
    esbuild entry.js --bundle --minify --format=iife --target=es2017 \
      --outfile=vendor/amcharts5.js

where entry.js imports the four modules and assigns them to `window`.

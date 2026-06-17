TMS-Twin — Tower Management & Digital Twin MVP
================================================

WHAT THIS IS
------------
A self-contained, static web app that demonstrates what an in-house Tower
Management System (TMS) with digital twins could look like, built directly
from the limited Site Master Database (SMDB). It is meant as a leadership
demo: a single page, no backend, no database, no paid services, and no
build step. It plots real tower sites from the SMDB on a satellite map,
renders a clickable digital twin of each tower's physical assets, and shows
a network topology view of how the sites relate to one another.

This is a proof-of-concept, not a production system. The goal is to show
that the visibility and intelligence benefits of a real digital twin
platform (the kind of thing Affectli / commercial TMS platforms sell) can
be approximated quickly using our own data, so we can make the case for
investing in a proper in-house build.


WHAT'S INSIDE THE FOLDER
-------------------------
index.html        The whole app shell (open this file / host this file)
styles.css         All visual styling (dark "NOC" theme)
app.js             Map logic, tab switching, network diagram, search, ticker
twin-rig.js        Builds the clickable digital twin SVG for each tower
data.js            SMDB data, baked directly into the page as JSON
data/sites.json    Same site data in plain JSON, for reference/editing
data/network.json  The computed network links (which towers connect to which)

Nothing else is required. There is no server, no API keys, no database.


HOW THE DATA GOT HERE
-----------------------
The 11 sites in the "Partial_SMDB_for_Power_Apps_and_AI.xlsx" file were
extracted and cleaned into data.js. Around 70 of the most relevant SMDB
columns per site were kept — coordinates, structure type, antennas/RRUs,
power plant (rectifiers, batteries, DG, solar, grid), capacity/loading,
fiber, tenants, and contacts — so the digital twin and map popups are
backed by real data, not placeholders.

Because all 11 sites in this extract are geographically close to each
other, the network topology was built automatically by:
  1. Grouping sites into clusters using straight-line distance (~15 km
     threshold) — this produced 6 natural clusters.
  2. Picking a "hub" in each cluster (the site with fiber connectivity if
     one exists, otherwise the site with the most tenants).
  3. Drawing "access" links from every other site in the cluster to its hub.
  4. Drawing "backbone" links connecting the hubs to each other (nearest-
     neighbour chain), to represent a realistic aggregation network.

This logic lives in plain Python. When we perform this on the SMDB export 
later (more sites, or real microwave/fiber link data instead of inferred ones),
see "UPDATING THE DATA" below to regenerate data.js with the real topology instead
of the distance-based approximation.


HOW TO DEPLOY ON GITHUB PAGES (free hosting, shareable link)
---------------------------------------------------------------
Step 1 — Create a GitHub account if you don't already have one.
  Go to https://github.com and sign up (free tier is enough).

Step 2 — Create a new repository.
  Click the "+" icon (top right) -> "New repository".
  Name it something like "tms-digital-twin-demo".
  Set visibility to "Public" (Pages on the free tier needs a public repo,
  unless you're on GitHub Pro/Team/Enterprise which allows private Pages).
  Click "Create repository".

Step 3 — Upload the files.
  On the new repository's page, click "uploading an existing file".
  Drag in everything from inside the "site" folder:
    index.html, styles.css, app.js, twin-rig.js, data.js, and the data/
    folder (sites.json, network.json).
  Important: upload the FILES themselves, not the "site" folder as a zip.
  index.html must end up at the repository root (not inside a sub-folder),
  so that the published URL points straight at it.
  Scroll down and click "Commit changes".

Step 4 — Turn on GitHub Pages.
  In the repository, click "Settings" (top menu).
  In the left sidebar, click "Pages".
  Under "Build and deployment" -> "Source", choose "Deploy from a branch".
  Under "Branch", choose "main" (or "master") and folder "/ (root)".
  Click "Save".

Step 5 — Wait, then open your link.
  GitHub takes 30 seconds to a couple of minutes to publish the first time.
  Refresh the Pages settings screen until you see a green box with a URL
  like:
      https://<your-username>.github.io/tms-digital-twin-demo/
  Open that link — this is now a permanent, shareable, free URL you can
  put in front of management. Any time you upload new files to the repo,
  the live page updates automatically within a minute or two.

Alternative to Step 3 (if you're comfortable with git):
  git clone <your new empty repo's URL>
  cd tms-digital-twin-demo
  # copy all files from the "site" folder into this directory
  git add .
  git commit -m "Initial TMS digital twin MVP"
  git push origin main
  Then do Step 4 as above.


HOW TO USE THE APP
---------------------
Map pane (left)
  - Each glowing marker is a real tower site from the SMDB. Violet markers
    are the cluster "hub" sites; cyan markers are regular sites.
  - Click a marker to select it — the map flies to it and the right pane
    loads its digital twin.
  - Click "Open Digital Twin" inside a marker's popup to jump straight to
    the twin view.
  - Use the search box (top-left) to jump to a site by code, city, or
    district. Press Enter to select it directly.
  - Top-right toggles: switch satellite imagery on/off, show/hide the
    inferred network links on the map itself, and show/hide site code
    labels under each marker.

Digital Twin pane (right, "Digital Twin" tab)
  - After selecting a site, you'll see a clickable rig of that tower's
    physical assets: RF antennas, microwave/BSD dish, RRUs, equipment
    shelter, rectifier/power plant, battery bank, diesel generator, solar
    array (if solarized), grid/transformer connection, and fiber node.
  - Click any glowing asset to open the inspector drawer on the right,
    showing the real SMDB fields for that specific asset (vendor, capacity,
    install age, status, etc).
  - Asset color reflects status at a glance: green = healthy/operational/
    present, amber = an overload/advisory condition, muted grey = not
    present/not deployed at this site.

Network Topology pane (right, "Network Topology" tab)
  - A node-and-link diagram of every site in the SMDB. Violet nodes are
    cluster hubs; cyan nodes are leaf sites. Solid cyan lines are intra-
    cluster "access" links; dashed violet lines (with a moving pulse) are
    inter-hub "backbone" links.
  - Click any node to jump straight to that site's digital twin.

Bottom ticker
  - A scrolling status strip summarising every site's on-air status, any
    tower-loading advisories, and which sites have fiber connectivity —
    a small taste of what a live NOC ticker could show with real
    monitoring data behind it.


UPDATING THE DATA (for the full SMDB export)
----------------------------------------------------------
The entire dataset lives in two places that need to stay in sync:
  - data.js (what the live page actually reads)
  - data/sites.json and data/network.json (the same data, human-readable)

If you're comfortable with Python, the cleanest way to refresh this is:
  1. Re-export/clean the SMDB into the same column structure as the
     original "Partial_SMDB_for_Power_Apps_and_AI.xlsx" (Site Code,
     Latitude, Longitude, Region, etc. — same headers as before).
  2. Re-run the same extraction + clustering logic that produced
     data/sites.json and data/network.json (group sites by proximity,
     pick hubs, generate access/backbone links — or, better, replace the
     clustering step entirely with the actual microwave/fiber link
     records if we have them, which will be far more accurate than
     distance-based guessing).
  3. Paste the resulting JSON into data.js, replacing the
     window.SMDB_SITES and window.SMDB_NETWORK blocks.
No other file needs to change — app.js and twin-rig.js read whatever is in
those two variables, however many sites or links there are.


CUSTOMISING THE LOOK
------------------------
All colors, fonts, and spacing are controlled by CSS variables at the very
top of styles.css (look for ":root"). Changing --cyan, --violet, --amber,
etc. will re-color the whole app consistently, including the map markers,
the digital twin status colors, and the network diagram.


OFFLINE NOTES / WHAT NEEDS INTERNET ACCESS
-----------------------------------------------
The app needs an internet connection for:
  - The Leaflet mapping library (loaded from unpkg.com)
  - Satellite map tiles (Esri World Imagery) and the optional dark basemap
    (CARTO) — these are free, no API key required, suitable for an
    internal demo
  - Two Google Fonts (Space Grotesk, IBM Plex Mono)
Everything else (site data, the digital twin rig, the network
diagram, search, and the ticker) runs entirely client-side with zero
external calls.


KNOWN LIMITATIONS (BY DESIGN, FOR AN MVP)
-----------------------------------------------
- Only 11 sites are included because that's what was in the provided
  partial SMDB export. The app scales to any number of sites without code
  changes — just provide more rows in data.js.
- Network links are inferred from geographic proximity, not from actual
  transmission/backhaul records, because that data wasn't in the export.
  Treat the topology view as "what a real link map could look like," not
  as the actual physical network today.
- There's no live telemetry — all "live" data is the static snapshot from
  the SMDB export at the time this was created. A production TMS would
  connect this same UI to a real RMS feed for live alarms and KPIs.
- No authentication or multi-tenant access control. Treat this build as an
  internal demo artifact, not as something to expose with sensitive data
  on a public URL without first checking with your security/compliance
  team.


QUESTIONS THIS DEMO IS DESIGNED TO ANSWER FOR MANAGEMENT
------------------------------------------------------------
- "What would visibility across all our towers actually look like?" —
  the map pane, populated with our own coordinates.
- "What does 'digital twin' mean for a tower site in practice?" — the
  clickable asset rig, wired to our own SMDB fields instead of generic
  placeholders.
- "Could we see the network holistically, not just site by site?" — the
  network topology tab.
- "Could we build this ourselves instead of buying a platform?" — yes;
  this entire MVP was built with open, free web technology (HTML, CSS,
  JavaScript, Leaflet maps) and your own spreadsheet export, no proprietary
  platform license required to reach this stage.

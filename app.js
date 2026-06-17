/* ============================================================
   app.js — TMS-Twin application logic
   ============================================================ */

(function(){
  'use strict';

  const SITES = window.SMDB_SITES || [];
  const NETWORK = window.SMDB_NETWORK || {edges:[], clusterCount:0};
  const byCode = {};
  SITES.forEach(s => byCode[s.siteCode] = s);

  let selectedCode = null;
  let map, markersByCode = {}, linkLayer, labelLayer;
  let activeTab = 'twin';

  /* --------------------------------------------------------
     INIT
  -------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    initTopStats();
    initMap();
    initTabs();
    initInspectorClose();
    initSearch();
    initLayerToggles();
    initTicker();
    buildNetworkSVG();
  });

  function initTopStats(){
    const onAir = SITES.filter(s => (s.opStatus||'').toLowerCase().includes('on air')).length;
    document.getElementById('statOnAir').textContent = onAir;
    const overloaded = SITES.filter(s => (s.towerLoadingStatus||'').toLowerCase().includes('overload') && !(s.towerLoadingStatus||'').toLowerCase().includes('not')).length;
    document.getElementById('statAlerts').textContent = overloaded;
    const cells = SITES.reduce((a,s)=> a + (Number(s.total2G)||0) + (Number(s.total4G)||0), 0);
    document.getElementById('statCells').textContent = cells;
  }

  /* --------------------------------------------------------
     MAP
  -------------------------------------------------------- */
  function initMap(){
    const lats = SITES.map(s=>s.lat), lons = SITES.map(s=>s.lon);
    const centerLat = lats.reduce((a,b)=>a+b,0)/lats.length;
    const centerLon = lons.reduce((a,b)=>a+b,0)/lons.length;

    map = L.map('map', {
      zoomControl: true,
      attributionControl: true,
      minZoom: 4,
      maxZoom: 18,
    }).setView([centerLat, centerLon], 7);

    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics',
      maxZoom: 18
    }).addTo(map);

    const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19
    });

    window._tileLayers = {satellite, dark};

    linkLayer = L.layerGroup().addTo(map);
    labelLayer = L.layerGroup();

    drawNetworkLinksOnMap();
    drawMarkers();

    const bounds = L.latLngBounds(SITES.map(s => [s.lat, s.lon]));
    map.fitBounds(bounds, {padding: [60,60]});
  }

  function drawMarkers(){
    SITES.forEach(site => {
      const isHub = !!site.isHub;
      const iconHtml = `
        <div class="tower-marker ${isHub?'is-hub':''}" id="marker-${site.siteCode}">
          <div class="ring"></div>
          <div class="core">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
        </div>`;
      const icon = L.divIcon({
        html: iconHtml,
        className: '',
        iconSize: [30,30],
        iconAnchor: [15,15]
      });
      const marker = L.marker([site.lat, site.lon], {icon, riseOnHover:true}).addTo(map);

      const popupHtml = `
        <div class="popup-code">${site.siteCode}</div>
        <div class="popup-name">${escapeHtml(site.siteName||'')}</div>
        <div class="popup-row"><span>District</span><span>${escapeHtml(site.district||'—')}</span></div>
        <div class="popup-row"><span>Structure</span><span>${escapeHtml(site.structureType||'—')}</span></div>
        <div class="popup-row"><span>Height</span><span>${site.towerHeight||'—'} m</span></div>
        <div class="popup-row"><span>Status</span><span>${escapeHtml(site.opStatus||'—')}</span></div>
        <div class="popup-row"><span>Tenants</span><span>${site.totalTenants ?? '—'}</span></div>
        <button class="popup-btn" data-open-twin="${site.siteCode}">Open Digital Twin →</button>
      `;
      marker.bindPopup(popupHtml, {closeButton:true, maxWidth:240});

      marker.on('click', () => selectSite(site.siteCode));
      marker.on('popupopen', (e) => {
        const node = e.popup.getElement ? e.popup.getElement() : e.popup._contentNode;
        const btn = node ? node.querySelector('[data-open-twin]') : null;
        if(btn) btn.addEventListener('click', () => { selectSite(site.siteCode); switchTab('twin'); map.closePopup(); });
      });

      markersByCode[site.siteCode] = marker;
    });
  }

  function drawNetworkLinksOnMap(){
    linkLayer.clearLayers();
    (NETWORK.edges||[]).forEach(edge => {
      const a = byCode[edge.from], b = byCode[edge.to];
      if(!a || !b) return;
      const color = edge.type === 'backbone' ? '#8b7cf6' : '#3ddbd9';
      const weight = edge.type === 'backbone' ? 2 : 1.6;
      const dash = edge.type === 'backbone' ? '6 5' : null;
      const line = L.polyline([[a.lat,a.lon],[b.lat,b.lon]], {
        color, weight, opacity: 0.55, dashArray: dash
      }).addTo(linkLayer);
      line.bindTooltip(`${edge.from} ↔ ${edge.to} · ${edge.type} · ${edge.distanceKm} km`, {
        className:'edge-tip', sticky:true
      });
    });
  }

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function selectSite(code){
    selectedCode = code;
    document.querySelectorAll('.tower-marker').forEach(m => m.classList.remove('selected'));
    const mEl = document.getElementById('marker-'+code);
    if(mEl) mEl.classList.add('selected');
    const site = byCode[code];
    if(!site) return;
    map.flyTo([site.lat, site.lon], Math.max(map.getZoom(), 11), {duration:0.6});
    renderTwin(site);
    document.getElementById('crumbRegion').textContent = site.region + ' · ' + site.siteCode;
  }

  /* --------------------------------------------------------
     TABS (Digital Twin / Network Topology)
  -------------------------------------------------------- */
  function initTabs(){
    document.querySelectorAll('.tabstrip button').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
  }

  function switchTab(tab){
    activeTab = tab;
    document.querySelectorAll('.tabstrip button').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
    document.getElementById('twinView').style.display = tab==='twin' ? 'flex' : 'none';
    document.getElementById('networkView').style.display = tab==='network' ? 'block' : 'none';

    const titleEl = document.getElementById('rightPaneTitle');
    const subEl = document.getElementById('rightPaneSub');
    if(tab==='twin'){
      titleEl.childNodes[0].textContent = 'Digital Twin ';
      subEl.textContent = selectedCode ? `${selectedCode} asset rig` : 'Select a site on the map';
    } else {
      titleEl.childNodes[0].textContent = 'Network Topology ';
      subEl.textContent = `${SITES.length} sites · ${NETWORK.edges.length} links · ${NETWORK.clusterCount} clusters`;
    }
  }

  /* --------------------------------------------------------
     DIGITAL TWIN RENDER
  -------------------------------------------------------- */
  function renderTwin(site){
    document.getElementById('twinEmpty').style.display = 'none';
    const svg = document.getElementById('twinSvg');
    const label = document.getElementById('twinSiteLabel');
    svg.style.display = 'block';
    label.style.display = 'block';

    TwinRig.buildTwinSVG(svg, site);

    const statusGood = (site.opStatus||'').toLowerCase().includes('on air');
    label.innerHTML = `
      <div class="code">${site.siteCode}</div>
      <div class="meta">${escapeHtml(site.siteName||'')}</div>
      <div class="meta">${escapeHtml(site.district||'')}, ${escapeHtml(site.province||'')}</div>
      <div class="status-chip" style="${statusGood?'':'background:var(--amber-dim);color:var(--amber);border-color:rgba(245,166,35,.3);'}">
        <span class="dot"></span> ${escapeHtml(site.opStatus||'Unknown')}
      </div>
    `;

    document.getElementById('rightPaneSub').textContent = `${site.siteCode} asset rig`;

    const tooltip = document.getElementById('assetTooltip');
    svg.querySelectorAll('.twin-hotspot').forEach(hs => {
      hs.addEventListener('mouseenter', () => {
        tooltip.innerHTML = `<div class="t-title">${hs.dataset.label}</div>Click for full asset detail`;
        tooltip.classList.add('show');
      });
      hs.addEventListener('mousemove', (e) => {
        const rect = document.getElementById('twinCanvas').getBoundingClientRect();
        tooltip.style.left = (e.clientX - rect.left + 14) + 'px';
        tooltip.style.top = (e.clientY - rect.top - 10) + 'px';
      });
      hs.addEventListener('mouseleave', () => tooltip.classList.remove('show'));
      hs.addEventListener('click', () => openInspector(hs.dataset.asset, site));
    });
  }

  function openInspector(assetId, site){
    const detail = TwinRig.assetDetail(assetId, site);
    const insp = document.getElementById('inspector');
    insp.classList.remove('collapsed');
    document.getElementById('inspTitle').textContent = detail.title;
    document.getElementById('inspSub').textContent = `${site.siteCode} · ${detail.sub}`;

    const body = document.getElementById('inspBody');
    let html = `<div class="field-group">
      <div class="field-group-title"><span class="bar"></span> Asset Parameters</div>`;
    detail.rows.forEach(([k,v]) => {
      html += `<div class="field-row"><span class="k">${escapeHtml(k)}</span><span class="v">${escapeHtml(String(v))}</span></div>`;
    });
    html += `</div>`;

    if(assetId === 'shelter' && site.availableCapacityPct !== undefined && site.availableCapacityPct !== null){
      const pct = Math.max(0, Math.min(100, Number(site.availableCapacityPct)*100));
      const avail = typeof site.availableCapacity === 'number' ? site.availableCapacity.toFixed(2) : site.availableCapacity;
      const loadingWarn = (site.towerLoadingStatus||'').toLowerCase().includes('overload') && !(site.towerLoadingStatus||'').toLowerCase().includes('not');
      html += `<div class="field-group">
        <div class="field-group-title"><span class="bar"></span> Tower Capacity</div>
        <div class="field-row"><span class="k">Design capacity</span><span class="v">${site.designCapacity ?? '—'} m²</span></div>
        <div class="field-row"><span class="k">Used (Jazz)</span><span class="v accent">${site.capacityUsedJazz ?? '—'} m²</span></div>
        <div class="field-row"><span class="k">Available</span><span class="v good">${avail} m²</span></div>
        <div class="capacity-bar-track"><div class="capacity-bar-fill" style="width:${pct}%"></div></div>
        <div class="field-row"><span class="k">Loading status</span><span class="v ${loadingWarn?'warn':'good'}">${escapeHtml(site.towerLoadingStatus||'—')}</span></div>
      </div>`;
    }

    html += `<div class="field-group">
      <div class="field-group-title"><span class="bar"></span> Site &amp; Ownership</div>
      <div class="field-row"><span class="k">Site code</span><span class="v accent">${site.siteCode}</span></div>
      <div class="field-row"><span class="k">Tower height</span><span class="v">${site.towerHeight ?? '—'} m</span></div>
      <div class="field-row"><span class="k">Structure type</span><span class="v">${escapeHtml(site.structureType||'—')}</span></div>
      <div class="field-row"><span class="k">Vendor</span><span class="v">${escapeHtml(site.vendor||'—')}</span></div>
      <div class="field-row"><span class="k">Total tenants</span><span class="v">${site.totalTenants ?? '—'}</span></div>
      <div class="field-row"><span class="k">MBU lead</span><span class="v">${escapeHtml(site.mbuLead||'—')}</span></div>
      <div class="field-row"><span class="k">Zonal manager</span><span class="v">${escapeHtml(site.zonalManager||'—')}</span></div>
      <div class="field-row"><span class="k">Lease expiry</span><span class="v">${escapeHtml(site.leaseExpiry||'—')}</span></div>
    </div>`;

    body.innerHTML = html;
  }

  function initInspectorClose(){
    document.getElementById('inspClose').addEventListener('click', () => {
      document.getElementById('inspector').classList.add('collapsed');
    });
  }

  /* --------------------------------------------------------
     SEARCH
  -------------------------------------------------------- */
  function initSearch(){
    const input = document.getElementById('siteSearch');
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if(!q) return;
      const hit = SITES.find(s =>
        (s.siteCode||'').toLowerCase().includes(q) ||
        (s.city||'').toLowerCase().includes(q) ||
        (s.district||'').toLowerCase().includes(q) ||
        (s.siteName||'').toLowerCase().includes(q)
      );
      if(hit){
        const m = markersByCode[hit.siteCode];
        if(m){ map.flyTo([hit.lat,hit.lon], 12, {duration:0.6}); m.openPopup(); }
      }
    });
    input.addEventListener('keydown', (e) => {
      if(e.key === 'Enter'){
        e.preventDefault();
        const q = input.value.trim().toLowerCase();
        const hit = SITES.find(s => (s.siteCode||'').toLowerCase()===q) ||
                    SITES.find(s => (s.siteCode||'').toLowerCase().includes(q));
        if(hit) selectSite(hit.siteCode);
      }
    });
  }

  /* --------------------------------------------------------
     LAYER TOGGLES
  -------------------------------------------------------- */
  function initLayerToggles(){
    const satToggle = document.getElementById('toggleSatellite');
    const linkToggle = document.getElementById('toggleLinks');
    const labelToggle = document.getElementById('toggleLabels');

    satToggle.addEventListener('change', () => {
      if(satToggle.checked){
        map.removeLayer(window._tileLayers.dark);
        map.addLayer(window._tileLayers.satellite);
      } else {
        map.removeLayer(window._tileLayers.satellite);
        map.addLayer(window._tileLayers.dark);
      }
    });

    linkToggle.addEventListener('change', () => {
      if(linkToggle.checked) map.addLayer(linkLayer);
      else map.removeLayer(linkLayer);
    });

    labelToggle.addEventListener('change', () => {
      if(labelToggle.checked){
        SITES.forEach(site => {
          const m = markersByCode[site.siteCode];
          if(m) m.bindTooltip(site.siteCode, {permanent:true, direction:'top', className:'edge-tip', offset:[0,-16]}).openTooltip();
        });
      } else {
        SITES.forEach(site => {
          const m = markersByCode[site.siteCode];
          if(m && m.getTooltip()) m.closeTooltip().unbindTooltip();
        });
      }
    });
  }

  /* --------------------------------------------------------
     NETWORK TOPOLOGY SVG VIEW
  -------------------------------------------------------- */
  function buildNetworkSVG(){
    const svg = document.getElementById('networkSvg');
    const W = 800, H = 600;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = '';

    const clusters = {};
    SITES.forEach(s => {
      const cid = s.clusterId ?? 0;
      clusters[cid] = clusters[cid] || [];
      clusters[cid].push(s);
    });
    const clusterIds = Object.keys(clusters).map(Number).sort((a,b)=>a-b);

    const centerX = W/2, centerY = H/2 + 10;
    const ringR = Math.min(W,H)/2 - 110;
    const positions = {};

    clusterIds.forEach((cid, i) => {
      const angle = (i / clusterIds.length) * Math.PI * 2 - Math.PI/2;
      const cx = centerX + ringR * Math.cos(angle);
      const cy = centerY + ringR * Math.sin(angle) * 0.82;
      const members = clusters[cid];
      const hub = members.find(m => m.isHub) || members[0];
      positions[hub.siteCode] = {x: cx, y: cy, cid};

      const others = members.filter(m => m !== hub);
      const memberR = 62;
      others.forEach((m, j) => {
        const a2 = (j / Math.max(others.length,1)) * Math.PI * 2;
        positions[m.siteCode] = {
          x: cx + memberR * Math.cos(a2),
          y: cy + memberR * Math.sin(a2),
          cid
        };
      });
    });

    const NSx = 'http://www.w3.org/2000/svg';
    function mk(tag, attrs){
      const n = document.createElementNS(NSx, tag);
      for(const k in attrs) n.setAttribute(k, attrs[k]);
      return n;
    }

    const edgesG = mk('g', {});
    const nodesG = mk('g', {});
    svg.appendChild(edgesG);
    svg.appendChild(nodesG);

    (NETWORK.edges||[]).forEach(edge => {
      const a = positions[edge.from], b = positions[edge.to];
      if(!a || !b) return;
      const isBackbone = edge.type === 'backbone';
      const line = mk('line', {
        x1:a.x, y1:a.y, x2:b.x, y2:b.y,
        stroke: isBackbone ? '#8b7cf6' : '#3ddbd9',
        'stroke-width': isBackbone ? 2 : 1.4,
        'stroke-dasharray': isBackbone ? '6 5' : 'none',
        opacity: 0.55
      });
      edgesG.appendChild(line);

      if(isBackbone){
        const dot = mk('circle', {r:2.6, fill:'#8b7cf6'});
        const animMotion = document.createElementNS(NSx, 'animateMotion');
        animMotion.setAttribute('dur', (3 + Math.random()*2).toFixed(1)+'s');
        animMotion.setAttribute('repeatCount', 'indefinite');
        animMotion.setAttribute('path', `M${a.x},${a.y} L${b.x},${b.y}`);
        dot.appendChild(animMotion);
        edgesG.appendChild(dot);
      }
    });

    SITES.forEach(site => {
      const p = positions[site.siteCode];
      if(!p) return;
      const isHub = !!site.isHub;
      const r = isHub ? 16 : 10;
      const color = isHub ? '#8b7cf6' : '#3ddbd9';

      const g = mk('g', {class:'net-node', 'data-code':site.siteCode, style:'cursor:pointer;'});

      const halo = mk('circle', {cx:p.x, cy:p.y, r:r+9, fill:color, opacity:0.10});
      const ring = mk('circle', {cx:p.x, cy:p.y, r:r+4, fill:'none', stroke:color, 'stroke-width':1, opacity:0.4});
      const core = mk('circle', {cx:p.x, cy:p.y, r, fill:'#10151d', stroke:color, 'stroke-width':2});
      g.appendChild(halo); g.appendChild(ring); g.appendChild(core);

      const label = mk('text', {x:p.x, y:p.y + r + 15, 'text-anchor':'middle', fill:'#9fb0c2', 'font-size':'10', 'font-family':'IBM Plex Mono, monospace'});
      label.textContent = site.siteCode;
      g.appendChild(label);

      if(isHub){
        const hubLabel = mk('text', {x:p.x, y:p.y - r - 8, 'text-anchor':'middle', fill:'#8b7cf6', 'font-size':'8.5', 'font-family':'IBM Plex Mono, monospace', 'letter-spacing':'0.06em'});
        hubLabel.textContent = 'HUB';
        g.appendChild(hubLabel);
      }

      g.addEventListener('click', () => {
        selectSite(site.siteCode);
        switchTab('twin');
      });
      g.addEventListener('mouseenter', () => core.setAttribute('r', r+2));
      g.addEventListener('mouseleave', () => core.setAttribute('r', r));

      nodesG.appendChild(g);
    });

    document.getElementById('netNodeCount').textContent = SITES.length;
    document.getElementById('netEdgeCount').textContent = (NETWORK.edges||[]).length;
    document.getElementById('netClusterCount').textContent = NETWORK.clusterCount || clusterIds.length;
  }

  /* --------------------------------------------------------
     TICKER
  -------------------------------------------------------- */
  function initTicker(){
    const items = [];
    SITES.forEach(s => {
      items.push({tag:s.siteCode, val:s.opStatus||'—', warn:false});
    });
    const overloaded = SITES.filter(s => (s.towerLoadingStatus||'').toLowerCase().includes('overload') && !(s.towerLoadingStatus||'').toLowerCase().includes('not'));
    overloaded.forEach(s => items.push({tag:s.siteCode, val:'TOWER LOADING ADVISORY', warn:true}));
    const fiberSites = SITES.filter(s => String(s.fiber).toLowerCase()==='yes');
    fiberSites.forEach(s => items.push({tag:s.siteCode, val:'FIBER LINK ACTIVE', warn:false}));

    const track = document.getElementById('tickerTrack');
    const renderItems = (arr) => arr.map(it => `
      <div class="ticker-item"><span class="tag">${it.tag}</span><span class="val ${it.warn?'warn':''}">${it.val}</span></div>
    `).join('');
    track.innerHTML = renderItems(items) + renderItems(items);
  }

})();

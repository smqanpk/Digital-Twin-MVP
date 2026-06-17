/* ============================================================
   twin-rig.js
   Builds the clickable isometric-style digital twin SVG for a
   given site record, wiring every asset hotspot to real SMDB
   fields. Pure function: site -> appends into an <svg>
   ============================================================ */

(function(){

  const NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, children){
    const n = document.createElementNS(NS, tag);
    for(const k in (attrs||{})) n.setAttribute(k, attrs[k]);
    (children||[]).forEach(c => n.appendChild(c));
    return n;
  }
  function text(x, y, str, attrs){
    const t = el('text', Object.assign({x, y}, attrs||{}));
    t.textContent = str;
    return t;
  }

  function statusColor(val){
    if(val === undefined || val === null) return 'var(--text-mute)';
    const s = String(val).toLowerCase();
    if(['yes','operational','on air','good grid','not overloaded'].includes(s)) return 'var(--green)';
    if(['no','obsolete'].includes(s)) return 'var(--text-mute)';
    if(s.includes('overload') && !s.includes('not')) return 'var(--amber)';
    return 'var(--cyan)';
  }

  function buildHotspot(id, cx, cy, r, label, statusVal){
    const color = statusColor(statusVal);
    const g = el('g', {class:'twin-hotspot', 'data-asset': id, style:'cursor:pointer;'});
    const ring = el('circle', {cx, cy, r: r+7, fill:'none', stroke:color, 'stroke-width':1, opacity:0.35, class:'hotspot-ring'});
    const halo = el('circle', {cx, cy, r: r+3, fill:color, opacity:0.14, class:'hotspot-halo'});
    const core = el('circle', {cx, cy, r, fill:'var(--panel)', stroke:color, 'stroke-width':2, class:'hotspot-core'});
    const dot = el('circle', {cx, cy, r:2.4, fill:color, class:'hotspot-dot'});
    g.appendChild(ring); g.appendChild(halo); g.appendChild(core); g.appendChild(dot);
    g.dataset.label = label;
    return g;
  }

  function buildTwinSVG(svgEl, site){
    svgEl.innerHTML = '';
    svgEl.setAttribute('viewBox', '0 0 520 560');

    const defs = el('defs', {}, [
      (function(){
        const grad = el('linearGradient', {id:'towerGrad', x1:'0', y1:'0', x2:'0', y2:'1'});
        grad.appendChild(el('stop', {offset:'0%', 'stop-color':'#3ddbd9', 'stop-opacity':'0.9'}));
        grad.appendChild(el('stop', {offset:'100%', 'stop-color':'#2a3744', 'stop-opacity':'0.9'}));
        return grad;
      })(),
      (function(){
        const grad = el('linearGradient', {id:'cabinGrad', x1:'0', y1:'0', x2:'1', y2:'1'});
        grad.appendChild(el('stop', {offset:'0%', 'stop-color':'#1c2735'}));
        grad.appendChild(el('stop', {offset:'100%', 'stop-color':'#101822'}));
        return grad;
      })()
    ]);
    svgEl.appendChild(defs);

    const sceneGroup = el('g', {id:'twinScene'});
    svgEl.appendChild(sceneGroup);

    sceneGroup.appendChild(el('ellipse', {cx:260, cy:500, rx:220, ry:34, fill:'#0d1420', stroke:'#1d2733', 'stroke-width':1}));
    sceneGroup.appendChild(el('ellipse', {cx:260, cy:500, rx:155, ry:22, fill:'none', stroke:'#1d2733', 'stroke-width':1, 'stroke-dasharray':'3 5'}));

    const towerX = 260, towerBaseY = 478, towerTopY = 56;
    const towerWidthBase = 46, towerWidthTop = 8;
    const legL = [];
    const legR = [];
    const segs = 9;
    for(let i=0;i<=segs;i++){
      const t = i/segs;
      const y = towerBaseY - t*(towerBaseY-towerTopY);
      const w = towerWidthBase - t*(towerWidthBase-towerWidthTop);
      legL.push([towerX - w/2, y]);
      legR.push([towerX + w/2, y]);
    }
    const leftPath = legL.map((p,i)=> (i===0?'M':'L')+p[0]+','+p[1]).join(' ');
    const rightPath = legR.map((p,i)=> (i===0?'M':'L')+p[0]+','+p[1]).join(' ');
    sceneGroup.appendChild(el('path', {d:leftPath, fill:'none', stroke:'url(#towerGrad)', 'stroke-width':2.2}));
    sceneGroup.appendChild(el('path', {d:rightPath, fill:'none', stroke:'url(#towerGrad)', 'stroke-width':2.2}));
    for(let i=0;i<segs;i++){
      const a = legL[i], b = legR[i+1];
      const c = legR[i], d = legL[i+1];
      sceneGroup.appendChild(el('line', {x1:a[0], y1:a[1], x2:b[0], y2:b[1], stroke:'#2a3744', 'stroke-width':1.1, opacity:0.8}));
      sceneGroup.appendChild(el('line', {x1:c[0], y1:c[1], x2:d[0], y2:d[1], stroke:'#2a3744', 'stroke-width':1.1, opacity:0.8}));
      sceneGroup.appendChild(el('line', {x1:legL[i+1][0], y1:legL[i+1][1], x2:legR[i+1][0], y2:legR[i+1][1], stroke:'#2a3744', 'stroke-width':1, opacity:0.6}));
    }
    const beacon = el('circle', {cx:towerX, cy:towerTopY-6, r:3.2, fill:'#f15b6c'});
    beacon.appendChild(el('animate', {attributeName:'opacity', values:'1;0.2;1', dur:'1.6s', repeatCount:'indefinite'}));
    sceneGroup.appendChild(el('line', {x1:towerX, y1:towerTopY, x2:towerX, y2:towerTopY-6, stroke:'#5c6b7d', 'stroke-width':1.4}));
    sceneGroup.appendChild(beacon);

    const totalRF = site.totalRFAntenna || (site.dualBandAntennas||0)+(site.tribandAntennas||0)+(site.antenna4T6S||0)+(site.mmAntenna||0);
    const platformYs = [108, 150];
    platformYs.forEach((py)=>{
      sceneGroup.appendChild(el('line', {x1:towerX-58, y1:py, x2:towerX+58, y2:py, stroke:'#3a4756', 'stroke-width':3, 'stroke-linecap':'round'}));
      [-1,1].forEach(side=>{
        const px = towerX + side*52;
        sceneGroup.appendChild(el('rect', {x:px-5, y:py-22, width:10, height:24, rx:2, fill:'#1c2735', stroke:'#3ddbd9', 'stroke-width':1}));
      });
    });
    sceneGroup.appendChild(buildHotspot('rf-antennas', towerX, 108, 11, 'RF Antennas', totalRF>0?'Yes':'No'));
    sceneGroup.appendChild(buildHotspot('mw-link', towerX-58, 150, 9, 'Microwave / Backhaul', (site.totalMWAntenna||0)>0?'Yes':'No'));
    if(site.massiveMimoAAU){
      sceneGroup.appendChild(el('rect', {x:towerX+18, y:128, width:18, height:20, rx:2, fill:'#1c2735', stroke:'#8b7cf6', 'stroke-width':1}));
      sceneGroup.appendChild(buildHotspot('massive-mimo', towerX+27, 138, 9, 'Massive MIMO AAU', site.massiveMimoAAU>0?'Yes':'No'));
    }

    sceneGroup.appendChild(el('rect', {x:towerX-9, y:195, width:18, height:26, rx:2, fill:'#1c2735', stroke:'#3ddbd9', 'stroke-width':1}));
    sceneGroup.appendChild(buildHotspot('rru', towerX, 208, 10, 'RRUs', (site.totalRRUs||0)>0?'Yes':'No'));

    if((site.noOfBSDDishes||0) > 0){
      const dishX = towerX+58, dishY=250;
      sceneGroup.appendChild(el('circle', {cx:dishX, cy:dishY, r:13, fill:'#1c2735', stroke:'#f5a623', 'stroke-width':1.6}));
      sceneGroup.appendChild(el('circle', {cx:dishX, cy:dishY, r:5, fill:'#0c1117', stroke:'#f5a623', 'stroke-width':1}));
      sceneGroup.appendChild(buildHotspot('bsd-dish', dishX, dishY, 17, 'BSD Microwave Dish', 'Yes'));
    }

    const shelterX = 130, shelterY = 420, shelterW = 90, shelterH = 56;
    sceneGroup.appendChild(el('path', {
      d:`M${shelterX},${shelterY+shelterH} L${shelterX},${shelterY+14} L${shelterX+16},${shelterY} L${shelterX+shelterW+16},${shelterY} L${shelterX+shelterW+16},${shelterY+shelterH-14} L${shelterX+shelterW},${shelterY+shelterH} Z`,
      fill:'url(#cabinGrad)', stroke:'#2a3744', 'stroke-width':1.4
    }));
    sceneGroup.appendChild(el('path', {
      d:`M${shelterX},${shelterY+14} L${shelterX+16},${shelterY} L${shelterX+shelterW+16},${shelterY} L${shelterX+shelterW},${shelterY+14} Z`,
      fill:'#22303f', stroke:'#2a3744', 'stroke-width':1
    }));
    sceneGroup.appendChild(text(shelterX+10, shelterY+34, 'EQUIPMENT', {fill:'var(--text-mute)', 'font-size':8, 'font-family':'var(--font-mono)', 'letter-spacing':'0.05em'}));
    sceneGroup.appendChild(text(shelterX+10, shelterY+45, 'SHELTER', {fill:'var(--text-mute)', 'font-size':8, 'font-family':'var(--font-mono)', 'letter-spacing':'0.05em'}));
    sceneGroup.appendChild(buildHotspot('shelter', shelterX+shelterW/2+8, shelterY+shelterH-10, 11, 'Equipment Shelter / RMS', site.rms));
    sceneGroup.appendChild(buildHotspot('rectifier', shelterX+shelterW-10, shelterY+10, 9, 'Rectifier / Power Plant', site.numRectifiers>0?'Operational':'No'));

    const battX = 235, battY = 452;
    sceneGroup.appendChild(el('rect', {x:battX, y:battY, width:54, height:30, rx:3, fill:'#161f2a', stroke:'#3a4756', 'stroke-width':1.2}));
    for(let i=0;i<4;i++){
      sceneGroup.appendChild(el('rect', {x:battX+6+i*11, y:battY+6, width:8, height:18, rx:1.5, fill:'#1c2735', stroke:'#4ade80', 'stroke-width':0.8}));
    }
    sceneGroup.appendChild(buildHotspot('battery', battX+27, battY+15, 13, 'Battery Bank', site.batteryBank1Type));

    const dgX = 320, dgY = 458;
    sceneGroup.appendChild(el('rect', {x:dgX, y:dgY, width:58, height:26, rx:4, fill:'#1c2735', stroke:'#3a4756', 'stroke-width':1.2}));
    sceneGroup.appendChild(el('rect', {x:dgX+6, y:dgY-10, width:10, height:10, fill:'#1c2735', stroke:'#3a4756', 'stroke-width':1}));
    sceneGroup.appendChild(buildHotspot('dg', dgX+29, dgY+13, 12, 'Diesel Generator', site.dg1Status));

    if(String(site.solarized).toLowerCase()==='yes'){
      const solX = 390, solY = 380;
      sceneGroup.appendChild(el('rect', {x:solX, y:solY, width:54, height:34, rx:2, fill:'#16202c', stroke:'#f5a623', 'stroke-width':1.3, transform:`rotate(-18 ${solX+27} ${solY+17})`}));
      for(let i=1;i<4;i++){
        sceneGroup.appendChild(el('line', {x1:solX, y1:solY+i*8.5, x2:solX+54, y2:solY+i*8.5, stroke:'#0c1117','stroke-width':1, transform:`rotate(-18 ${solX+27} ${solY+17})`}));
      }
      sceneGroup.appendChild(buildHotspot('solar', solX+27, solY+17, 16, 'Solar Array', 'Yes'));
    } else {
      sceneGroup.appendChild(el('rect', {x:390, y:380, width:54, height:34, rx:2, fill:'none', stroke:'#2a3744', 'stroke-width':1, 'stroke-dasharray':'3 4'}));
      sceneGroup.appendChild(buildHotspot('solar', 417, 397, 14, 'Solar Array', 'No'));
    }

    const tfX = 90, tfY = 360;
    sceneGroup.appendChild(el('rect', {x:tfX, y:tfY, width:26, height:34, rx:3, fill:'#16202c', stroke:'#3ddbd9', 'stroke-width':1.2}));
    sceneGroup.appendChild(buildHotspot('grid', tfX+13, tfY+17, 12, 'Grid / Transformer', site.gridType));

    const fX = 440, fY = 300;
    sceneGroup.appendChild(el('rect', {x:fX-10, y:fY-10, width:20, height:20, rx:10, fill:'#16202c', stroke: String(site.fiber).toLowerCase()==='yes' ? '#4ade80' : '#3a4756', 'stroke-width':1.2}));
    sceneGroup.appendChild(buildHotspot('fiber', fX, fY, 13, 'Fiber Connectivity', site.fiber));

    sceneGroup.appendChild(el('rect', {x:55, y:330, width:410, height:158, rx:6, fill:'none', stroke:'#1d2733', 'stroke-width':1, 'stroke-dasharray':'2 6'}));

    return sceneGroup;
  }

  function assetDetail(id, site){
    const fmtBool = v => v===undefined||v===null||v==='' ? '—' : v;
    const groups = {
      'rf-antennas': {
        title:'RF Antenna Array', sub:'Sector panel antennas',
        rows:[
          ['Dual-band antennas', fmtBool(site.dualBandAntennas)],
          ['Triband / above', fmtBool(site.tribandAntennas)],
          ['4T6S antennas', fmtBool(site.antenna4T6S)],
          ['mmWave antennas', fmtBool(site.mmAntenna)],
          ['Total RF antennas', fmtBool(site.totalRFAntenna)],
          ['Current technology', fmtBool(site.currentTech)],
        ]
      },
      'mw-link': {
        title:'Microwave Backhaul', sub:'Point-to-point link',
        rows:[
          ['Total MW antennas', fmtBool(site.totalMWAntenna)],
          ['BSD dishes', fmtBool(site.noOfBSDDishes)],
          ['Dish size', fmtBool(site.sizeOfDishes)],
          ['Fiber available', fmtBool(site.fiber)],
        ]
      },
      'massive-mimo': {
        title:'Massive MIMO AAU', sub:'Active antenna unit',
        rows:[
          ['Massive MIMO AAU count', fmtBool(site.massiveMimoAAU)],
          ['Total RRUs', fmtBool(site.totalRRUs)],
          ['Technology', fmtBool(site.currentTech)],
        ]
      },
      'rru': {
        title:'Remote Radio Units', sub:'Baseband RF front-end',
        rows:[
          ['Total RRUs installed', fmtBool(site.totalRRUs)],
          ['Vendor', fmtBool(site.vendor)],
          ['2G active cells', fmtBool(site.total2G)],
          ['4G active cells', fmtBool(site.total4G)],
        ]
      },
      'bsd-dish': {
        title:'BSD Microwave Dish', sub:'Backhaul / spur dish',
        rows:[
          ['Dishes installed', fmtBool(site.noOfBSDDishes)],
          ['Dish size', fmtBool(site.sizeOfDishes)],
          ['BSD fiber nodes', fmtBool(site.bsdFiberNodes)],
        ]
      },
      'shelter': {
        title:'Equipment Shelter', sub:'Indoor / outdoor cabinet',
        rows:[
          ['Enclosure type', fmtBool(site.indoorOutdoor)],
          ['RMS deployed', fmtBool(site.rms)],
          ['RMS vendor', fmtBool(site.rmsVendor)],
          ['FLM / O&M vendor', fmtBool(site.flmVendor)],
          ['Site category', fmtBool(site.siteCategory)],
        ]
      },
      'rectifier': {
        title:'Rectifier / Power Plant', sub:'DC power conversion',
        rows:[
          ['Rectifiers installed', fmtBool(site.numRectifiers)],
          ['Rectifier #1 manufacturer', fmtBool(site.rectifier1Manufacturer)],
          ['Rectifier #1 modules', fmtBool(site.rectifier1Modules)],
          ['Rectifier #2 manufacturer', fmtBool(site.rectifier2Manufacturer)],
        ]
      },
      'battery': {
        title:'Battery Bank', sub:'DC backup storage',
        rows:[
          ['Bank #1 type', fmtBool(site.batteryBank1Type)],
          ['Bank #1 cells', fmtBool(site.batteryBank1Cells)],
          ['Bank #1 AH capacity', fmtBool(site.batteryBank1AH)],
          ['Bank #1 install age', fmtBool(site.batteryBank1Install)],
        ]
      },
      'dg': {
        title:'Diesel Generator', sub:'Backup power generation',
        rows:[
          ['DG #1 model / make', fmtBool(site.dg1ModelMake)],
          ['DG #1 rating (KVA)', fmtBool(site.dg1RatingKVA)],
          ['DG #1 status', fmtBool(site.dg1Status)],
          ['DG #1 install age', fmtBool(site.dg1InstallDate)],
        ]
      },
      'solar': {
        title:'Solar Array', sub:'Renewable supplementary power',
        rows:[
          ['Solarized', fmtBool(site.solarized)],
          ['Deployment date', fmtBool(site.solarDeployDate)],
          ['Design load (kW)', fmtBool(site.solarLoadDesign)],
        ]
      },
      'grid': {
        title:'Grid / Transformer', sub:'Utility power connection',
        rows:[
          ['Grid type', fmtBool(site.gridType)],
          ['On grid', fmtBool(site.onGrid)],
          ['Transformer entity', fmtBool(site.transformerEntity)],
          ['Transformer capacity', fmtBool(site.transformerCapacityKVA)],
        ]
      },
      'fiber': {
        title:'Fiber Connectivity', sub:'Transport medium',
        rows:[
          ['Fiber available', fmtBool(site.fiber)],
          ['Macro / TXN', fmtBool(site.macroTxn)],
          ['Hard access area', fmtBool(site.hardAccessArea)],
        ]
      },
    };
    return groups[id] || {title:id, sub:'', rows:[]};
  }

  window.TwinRig = { buildTwinSVG, assetDetail, statusColor };
})();

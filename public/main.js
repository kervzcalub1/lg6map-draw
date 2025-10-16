// main.js - full app logic for lg6map-draw
// Expects /config.js to exist (window.__MAPS_API_KEY)
// Place this file in /public along with index.html and style.css

/* ---------- CONFIG ---------- */
const KML_RAW_URL = 'https://raw.githubusercontent.com/kervzcalub1/lg6map/refs/heads/main/kml/Untitled%20project.kml';
const LS_MARKERS = 'lg6map_markers_v1';
const LS_HISTORY = 'lg6map_history_v1';
const DRAW_LS_KEY = 'lg6map_drawings_v1';

// Built-in markers (lat,lng,image)
const builtInMarkers = [
  { lat: 7.083483615107523, lng: 125.62724728562387, image: 'https://picsum.photos/id/1015/800/560' },
  { lat: 7.0837635750295025, lng: 125.62749048383216, image: 'https://picsum.photos/id/1016/800/560' },
  { lat: 7.083870160887393, lng: 125.62754624549838, image: 'https://picsum.photos/id/1018/800/560' },
  { lat: 7.08391344844686, lng: 125.62758628119416, image: 'https://picsum.photos/id/1020/800/560' },
  { lat: 7.084145057569356, lng: 125.62779091136315, image: 'https://picsum.photos/id/1024/800/560' },
  { lat: 7.084190664953738, lng: 125.62783308144925, image: 'https://picsum.photos/id/1025/800/560' },
  { lat: 7.084248025387979, lng: 125.62787345516176, image: 'https://picsum.photos/id/1027/800/560' },
  { lat: 7.084330032613001, lng: 125.62795374569423, image: 'https://picsum.photos/id/1031/800/560' },
  { lat: 7.084407392795819, lng: 125.62803000646079, image: 'https://picsum.photos/id/1033/800/560' },
  { lat: 7.084504708741913, lng: 125.62811858329982, image: 'https://picsum.photos/id/1035/800/560' },
  { lat: 7.084611963979416, lng: 125.62825136355237, image: 'https://picsum.photos/id/1036/800/560' },
  { lat: 7.084673774348007, lng: 125.62828946432103, image: 'https://picsum.photos/id/1038/800/560' },
  { lat: 7.084852571172857, lng: 125.62841246788105, image: 'https://picsum.photos/id/1040/800/560' },
];

// SVG pin helper
function makePinSVG(color = '#007bff', size = 36) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 24 24'><path fill='${color}' d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z'/><circle cx='12' cy='9' r='2.5' fill='#fff'/></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/* ---------- APP STATE ---------- */
let map;
let markerObjects = []; // {id, marker, note, date, saved, image, labelWindow}
let historyArr = [];

// Drawing state
let drawMode = false;
let eraseMode = false;
let currentColor = '#ff0000'; // default red
let currentSize = 5;
let strokes = []; // google.maps.Polyline objects
let strokePaths = []; // array of arrays of {lat,lng,color,weight}

/* ---------- PERSISTENCE ---------- */
function loadState() {
  try {
    const ms = JSON.parse(localStorage.getItem(LS_MARKERS) || 'null');
    const hs = JSON.parse(localStorage.getItem(LS_HISTORY) || 'null');
    if (Array.isArray(hs)) historyArr = hs;
    return ms;
  } catch (e) {
    console.warn('loadState error', e);
    return null;
  }
}
function saveState() {
  try {
    const toSave = markerObjects.map(m => ({ id:m.id, note:m.note, date:m.date, saved:m.saved, image:m.image }));
    localStorage.setItem(LS_MARKERS, JSON.stringify(toSave));
    localStorage.setItem(LS_HISTORY, JSON.stringify(historyArr));
  } catch (e) {
    console.warn('saveState error', e);
  }
}

function loadDrawingsFromStorage() {
  try {
    const raw = localStorage.getItem(DRAW_LS_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return;
    strokePaths = arr;
  } catch (e) { console.warn('loadDrawingsFromStorage', e); }
}
function saveDrawingsToStorage() {
  try {
    localStorage.setItem(DRAW_LS_KEY, JSON.stringify(strokePaths));
  } catch (e) { console.warn('saveDrawingsToStorage', e); }
}

/* ---------- HISTORY UI ---------- */
function renderHistory() {
  const list = document.getElementById('historyList');
  const listMobile = document.getElementById('historyListMobile');
  if (!list || !listMobile) return;
  list.innerHTML = '';
  listMobile.innerHTML = '';
  if (!historyArr || historyArr.length === 0) {
    const n = document.createElement('div'); n.className='muted'; n.innerText='No history yet.'; list.appendChild(n);
    const nm = n.cloneNode(true); listMobile.appendChild(nm);
    return;
  }
  [...historyArr].reverse().forEach((h) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `<div style="display:flex;justify-content:space-between;"><div><strong>${h.type.toUpperCase()}</strong> — Marker ${h.markerId}</div><div class="muted">${h.when}</div></div><div style="margin-top:6px"><small>${h.note||''}</small><br/><small class="muted">${h.date||''}</small></div>`;
    item.onclick = () => reviewHistory(h);
    list.appendChild(item);
    const m = item.cloneNode(true);
    m.onclick = () => reviewHistory(h);
    listMobile.appendChild(m);
  });
}

let reviewWindow = null;
function reviewHistory(h) {
  if (reviewWindow) { reviewWindow.close(); reviewWindow = null; }
  const found = markerObjects.find(m => m.id === h.markerId);
  let pos;
  if (found) pos = found.marker.getPosition();
  else {
    const idx = h.markerId - 1;
    if (builtInMarkers[idx]) pos = { lat: builtInMarkers[idx].lat, lng: builtInMarkers[idx].lng };
  }
  if (!pos) { alert('Cannot locate marker for this history entry'); return; }
  const el = document.createElement('div');
  el.className = 'popup-content';
  el.innerHTML = `<div style="font-weight:700">History — Marker ${h.markerId}</div><div style="margin-top:8px"><b>Note</b>: ${h.note||'<i>(none)</i>'}</div><div style="margin-top:6px"><b>Date</b>: ${h.date||'<i>(none)</i>'}</div><div class="muted" style="margin-top:8px">${h.when}</div>`;
  reviewWindow = new google.maps.InfoWindow({ content: el, maxWidth: 320 });
  reviewWindow.setPosition(pos);
  reviewWindow.open(map);
  map.panTo(pos);
}

/* ---------- MARKER POPUP ---------- */
let openInfoWindow = null;
function showSavedLabel(mObj) {
  if (mObj.labelWindow) { mObj.labelWindow.close(); mObj.labelWindow = null; }
  const el = document.createElement('div');
  el.style.padding = '8px';
  el.style.background = '#fff';
  el.style.borderRadius = '8px';
  el.style.boxShadow = '0 6px 18px rgba(3,10,46,0.08)';
  el.innerHTML = `<strong>${mObj.date || ''}</strong><div style="font-size:13px;margin-top:6px">${(mObj.note||'').replace(/\n/g,'<br/>')}</div>`;
  const iw = new google.maps.InfoWindow({ content: el, pixelOffset: new google.maps.Size(0, -30) });
  iw.open(map, mObj.marker);
  mObj.labelWindow = iw;
}

function openMarkerPopup(mObj) {
  if (openInfoWindow) { openInfoWindow.close(); openInfoWindow = null; }

  const container = document.createElement('div');
  container.className = 'popup-content';
  container.style.position = 'relative';

  const closeX = document.createElement('div');
  closeX.className = 'close-x';
  closeX.innerText = '×';
  container.appendChild(closeX);

  const img = document.createElement('img');
  img.className = 'popup-img';
  img.src = mObj.image;
  container.appendChild(img);

  const note = document.createElement('textarea');
  note.className = 'popup-note';
  note.placeholder = 'Enter note...';
  note.value = mObj.note || '';
  container.appendChild(note);

  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.className = 'form-control';
  dateInput.value = mObj.date || '';
  dateInput.style.marginTop = '8px';
  container.appendChild(dateInput);

  const btnRow = document.createElement('div');
  btnRow.className = 'popup-row';
  btnRow.style.marginTop = '8px';
  container.appendChild(btnRow);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'popup-btn btn-save';
  saveBtn.innerText = 'Save';
  saveBtn.disabled = !(note.value.trim() && dateInput.value);
  btnRow.appendChild(saveBtn);

  const delBtn = document.createElement('button');
  delBtn.className = 'popup-btn btn-delete';
  delBtn.innerText = 'Delete';
  if (!(mObj.note && mObj.date)) delBtn.style.display = 'none';
  btnRow.appendChild(delBtn);

  let edited = false;
  note.addEventListener('input', () => { edited = true; saveBtn.disabled = !(note.value.trim() && dateInput.value); });
  dateInput.addEventListener('change', () => { edited = true; saveBtn.disabled = !(note.value.trim() && dateInput.value); });

  saveBtn.addEventListener('click', () => {
    if (!note.value.trim() || !dateInput.value) return;
    // Clear other markers' data to avoid confusion
    markerObjects.forEach(m => {
      if (m.id === mObj.id) {
        m.note = note.value.trim();
        m.date = dateInput.value;
        m.saved = true;
        showSavedLabel(m);
        m.marker.setIcon({ url: makePinSVG('#ff0000'), scaledSize: new google.maps.Size(36,36) });
      } else {
        if (m.labelWindow) { m.labelWindow.close(); m.labelWindow = null; }
        m.note = '';
        m.date = '';
        m.saved = false;
        m.marker.setIcon({ url: makePinSVG('#007bff'), scaledSize: new google.maps.Size(36,36) });
      }
    });
    // add to history
    historyArr.push({ type:'save', markerId: mObj.id, note: note.value.trim(), date: dateInput.value, when: new Date().toLocaleString() });
    mObj.note = note.value.trim();
    mObj.date = dateInput.value;
    mObj.saved = true;
    saveState();
    renderHistory();
    edited = false;
    if (openInfoWindow) { openInfoWindow.close(); openInfoWindow = null; }
  });

  delBtn.addEventListener('click', () => {
    if (!confirm('Clear saved data for this marker?')) return;
    mObj.note = ''; mObj.date = ''; mObj.saved = false;
    if (mObj.labelWindow) { mObj.labelWindow.close(); mObj.labelWindow = null; }
    mObj.marker.setIcon({ url: makePinSVG('#007bff'), scaledSize: new google.maps.Size(36,36) });
    historyArr.push({ type:'delete', markerId: mObj.id, note:'', date:'', when: new Date().toLocaleString() });
    saveState();
    renderHistory();
    if (openInfoWindow) { openInfoWindow.close(); openInfoWindow = null; }
  });

  closeX.addEventListener('click', () => {
    if (edited) {
      const wantSave = confirm('You have unsaved changes. Press OK to save, Cancel to discard.');
      if (wantSave) { saveBtn.click(); return; } else { edited=false; if (openInfoWindow) { openInfoWindow.close(); openInfoWindow = null; } return; }
    } else {
      if (openInfoWindow) { openInfoWindow.close(); openInfoWindow = null; }
    }
  });

  const infoWindow = new google.maps.InfoWindow({ content: container, maxWidth: 360 });
  infoWindow.open(map, mObj.marker);
  openInfoWindow = infoWindow;
}

/* ---------- DRAWING IMPLEMENTATION ---------- */
let isDrawing = false;
let currentPolyline = null;

// helper to create polyline and record path array
function startPolyline(color, weight) {
  const pl = new google.maps.Polyline({
    path: [],
    map,
    strokeColor: color,
    strokeOpacity: 0.95,
    strokeWeight: weight,
    clickable: false,
    geodesic: true
  });
  strokes.push(pl);
  strokePaths.push([]); // new path container
  return pl;
}

function rebuildStrokesFromPaths() {
  // clear existing polylines
  strokes.forEach(s => s.setMap(null));
  strokes = [];
  strokePaths.forEach(path => {
    if (!path || path.length < 2) return;
    const pts = path.map(p => new google.maps.LatLng(p.lat, p.lng));
    const poly = new google.maps.Polyline({
      path: pts,
      map,
      strokeColor: path[0].color || '#ff0000',
      strokeOpacity: 0.95,
      strokeWeight: path[0].weight || 5,
      clickable: false,
      geodesic: true
    });
    strokes.push(poly);
  });
}

/* erase helper: remove stroke segments near latlng (simple approach) */
function eraseAtLatLng(latLng, radiusMeters = 8) {
  const R = 6371000;
  let changed = false;
  for (let i = strokePaths.length - 1; i >= 0; i--) {
    const path = strokePaths[i];
    const filtered = path.filter(pt => {
      const dLat = (pt.lat - latLng.lat()) * Math.PI/180;
      const dLng = (pt.lng - latLng.lng()) * Math.PI/180;
      const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(pt.lat*Math.PI/180)*Math.cos(latLng.lat()*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const dist = R * c;
      return dist > radiusMeters;
    });
    if (filtered.length !== path.length) changed = true;
    if (filtered.length < 2) {
      // remove entire stroke
      strokePaths.splice(i, 1);
    } else {
      strokePaths[i] = filtered;
    }
  }
  if (changed) {
    rebuildStrokesFromPaths();
    saveDrawingsToStorage();
  }
}

function undoLastStroke() {
  if (strokes.length === 0) return;
  const last = strokes.pop();
  last.setMap(null);
  strokePaths.pop();
  saveDrawingsToStorage();
}

function clearAllDrawings() {
  // Erase all but DO NOT disable drawMode
  strokes.forEach(s => s.setMap(null));
  strokes = [];
  strokePaths = [];
  saveDrawingsToStorage();
}

/* Attach drawing handlers (mouse + touch). Called when drawMode toggled ON */
function attachDrawingHandlers() {
  // remove old listeners
  google.maps.event.clearListeners(map, 'mousedown');
  google.maps.event.clearListeners(map, 'mousemove');
  google.maps.event.clearListeners(map, 'mouseup');

  const mapDiv = map.getDiv();

  // ensure Projection overlay to convert pixel -> latlng for touch
  if (!map.__projOverlay) {
    function P() {}
    P.prototype = new google.maps.OverlayView();
    P.prototype.onAdd = function() {};
    P.prototype.draw = function() {};
    P.prototype.onRemove = function() {};
    map.__projOverlay = new P();
    map.__projOverlay.setMap(map);
  }

  map.addListener('mousedown', (e) => {
    if (!drawMode) return;
    if (eraseMode) {
      eraseAtLatLng(e.latLng, currentSize * 1.5);
      return;
    }
    isDrawing = true;
    currentPolyline = startPolyline(currentColor, currentSize);
    currentPolyline.getPath().push(e.latLng);
    strokePaths[strokePaths.length - 1].push({ lat: e.latLng.lat(), lng: e.latLng.lng(), color: currentColor, weight: currentSize });
    // disable map drag to avoid panning
    map.setOptions({ draggable: false, gestureHandling: 'none' });
  });

  map.addListener('mousemove', (e) => {
    if (!isDrawing || !currentPolyline) return;
    currentPolyline.getPath().push(e.latLng);
    strokePaths[strokePaths.length - 1].push({ lat: e.latLng.lat(), lng: e.latLng.lng(), color: currentColor, weight: currentSize });
  });

  map.addListener('mouseup', (e) => {
    if (!isDrawing) return;
    isDrawing = false;
    currentPolyline = null;
    map.setOptions({ draggable: true, gestureHandling: 'greedy' });
    saveDrawingsToStorage();
  });

  // touch handlers
  mapDiv.addEventListener('touchstart', (ev) => {
    if (!drawMode) return;
    const touch = ev.touches[0];
    const rect = mapDiv.getBoundingClientRect();
    const px = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    const proj = map.__projOverlay.getProjection();
    if (!proj) return;
    const latLng = proj.fromContainerPixelToLatLng(new google.maps.Point(px.x, px.y));
    if (eraseMode) { eraseAtLatLng(latLng, currentSize * 1.5); return; }
    isDrawing = true;
    currentPolyline = startPolyline(currentColor, currentSize);
    currentPolyline.getPath().push(latLng);
    strokePaths[strokePaths.length - 1].push({ lat: latLng.lat(), lng: latLng.lng(), color: currentColor, weight: currentSize });
    map.setOptions({ draggable: false, gestureHandling: 'none' });
  }, { passive: true });

  mapDiv.addEventListener('touchmove', (ev) => {
    if (!isDrawing) return;
    const touch = ev.touches[0];
    const rect = mapDiv.getBoundingClientRect();
    const px = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    const proj = map.__projOverlay.getProjection();
    if (!proj) return;
    const latLng = proj.fromContainerPixelToLatLng(new google.maps.Point(px.x, px.y));
    if (eraseMode) { eraseAtLatLng(latLng, currentSize * 1.5); return; }
    currentPolyline.getPath().push(latLng);
    strokePaths[strokePaths.length - 1].push({ lat: latLng.lat(), lng: latLng.lng(), color: currentColor, weight: currentSize });
    ev.preventDefault && ev.preventDefault();
  }, { passive: false });

  mapDiv.addEventListener('touchend', (ev) => {
    if (!isDrawing) return;
    isDrawing = false;
    currentPolyline = null;
    map.setOptions({ draggable: true, gestureHandling: 'greedy' });
    saveDrawingsToStorage();
  }, { passive: true });
}

/* Detach drawing handlers (when drawMode OFF) */
function detachDrawingHandlers() {
  google.maps.event.clearListeners(map, 'mousedown');
  google.maps.event.clearListeners(map, 'mousemove');
  google.maps.event.clearListeners(map, 'mouseup');
  // touch listeners remain but will no-op because drawMode=false
}

/* ---------- TOOLBAR UI ---------- */
function updateToolbarUI() {
  const toolbar = document.getElementById('drawToolbar');
  const controls = document.getElementById('toolbarControls');
  if (!toolbar || !controls) return;
  if (drawMode) {
    toolbar.classList.remove('collapsed');
    controls.setAttribute('aria-hidden', 'false');
    attachDrawingHandlers();
  } else {
    toolbar.classList.add('collapsed');
    controls.setAttribute('aria-hidden', 'true');
    detachDrawingHandlers();
  }
}

function setupToolbarControls() {
  const btnToggle = document.getElementById('btnToggleDraw');
  const tbColor = document.getElementById('tbColor');
  const tbSize = document.getElementById('tbSize');
  const btnUndo = document.getElementById('btnUndo');
  const btnEraseMode = document.getElementById('btnEraseMode');
  const btnEraseAll = document.getElementById('btnEraseAll');
  const btnSaveDraw = document.getElementById('btnSaveDraw');

  // initial values from UI
  currentColor = tbColor.value || '#ff0000';
  currentSize = parseInt(tbSize.value, 10) || 5;

  btnToggle.addEventListener('click', () => {
    drawMode = !drawMode;
    if (!drawMode) eraseMode = false; // if turning off, clear erase mode
    updateToolbarUI();
  });

  tbColor.addEventListener('change', (e) => { currentColor = e.target.value; });
  tbSize.addEventListener('change', (e) => { currentSize = parseInt(e.target.value, 10) || 5; });

  btnUndo.addEventListener('click', () => undoLastStroke());

  btnEraseMode.addEventListener('click', () => {
    eraseMode = !eraseMode;
    btnEraseMode.classList.toggle('active', eraseMode);
    // if enabling erase mode and drawMode is off, enable drawMode handlers so erase works
    if (eraseMode && !drawMode) { drawMode = true; updateToolbarUI(); }
  });

  btnEraseAll.addEventListener('click', () => {
    if (!confirm('Erase all drawings? This cannot be undone.')) return;
    clearAllDrawings();
    // DO NOT change drawMode — keep it as requested
    rebuildStrokesFromPaths();
  });

  btnSaveDraw.addEventListener('click', () => {
    saveDrawingsToStorage();
    alert('Drawings saved.');
  });
}

/* ---------- KML + MARKERS + MAP ---------- */
function fitMapToDataBounds() {
  // Fit to drawn data or markers if KML not present
  const b = new google.maps.LatLngBounds();
  let extended = false;
  // try data layer
  map.data.forEach(function(feature) {
    feature.getGeometry().forEach && feature.getGeometry().forEach(function(g) {
      // iterate geometry coordinates if possible
      // simple approach: try extending bounds with coordinate points
      // We'll do a more robust loop when creating the geojson fallback
    });
    extended = true;
  });
  if (!extended) {
    // fit markers
    const bounds = new google.maps.LatLngBounds();
    builtInMarkers.forEach(m => bounds.extend({ lat: m.lat, lng: m.lng }));
    if (!bounds.isEmpty()) map.fitBounds(bounds);
  }
}

function createMarkers(restored) {
  markerObjects = [];
  builtInMarkers.forEach((m, i) => {
    const id = i + 1;
    let initial = { id, note:'', date:'', saved:false, image: m.image };
    if (restored && Array.isArray(restored)) {
      const r = restored.find(rr => rr.id === id);
      if (r) { initial.note = r.note || ''; initial.date = r.date || ''; initial.saved = !!r.saved; initial.image = r.image || initial.image; }
    }
    const color = initial.saved ? '#ff0000' : '#007bff';
    const gm = new google.maps.Marker({
      position: { lat: m.lat, lng: m.lng },
      map,
      title: `Marker ${id}`,
      icon: { url: makePinSVG(color), scaledSize: new google.maps.Size(36,36) },
    });

    const mObj = { id, marker: gm, note: initial.note, date: initial.date, saved: initial.saved, image: initial.image, labelWindow: null };
    if (mObj.saved && (mObj.note || mObj.date)) showSavedLabel(mObj);

    gm.addListener('click', () => openMarkerPopup(mObj));
    markerObjects.push(mObj);
  });
}

function loadKmlThenFit(restoredMarkers) {
  let kmlLoaded = false;
  try {
    const kmlLayer = new google.maps.KmlLayer({ url: KML_RAW_URL, map: map, preserveViewport: false, suppressInfoWindows: true });
    kmlLayer.addListener('defaultviewport_changed', () => {
      try {
        const bounds = kmlLayer.getDefaultViewport();
        if (bounds) {
          map.fitBounds(bounds);
          kmlLoaded = true;
        }
      } catch (e) { console.warn('kml viewport error', e); }
    });
    kmlLayer.addListener('status_changed', () => console.info('KML status:', kmlLayer.getStatus && kmlLayer.getStatus()));
  } catch (e) {
    console.warn('KML Layer init failed:', e);
  }

  // fallback: fetch KML text and render via toGeoJSON, then fit bounds
  fetch(KML_RAW_URL).then(r => {
    if (!r.ok) throw new Error('KML fetch failed: ' + r.status);
    return r.text();
  }).then(kmlText => {
    try {
      const parser = new DOMParser();
      const kmlDoc = parser.parseFromString(kmlText, 'text/xml');
      const geojson = toGeoJSON.kml(kmlDoc);
      if (geojson && geojson.features && geojson.features.length) {
        map.data.addGeoJson(geojson);
        map.data.setStyle({ strokeColor:'#ff0000', strokeWeight:2, fillOpacity:0.05 });
        // compute bounds
        const bounds = new google.maps.LatLngBounds();
        geojson.features.forEach(f => {
          const geom = f.geometry;
          if (!geom) return;
          const coordsToExtend = (coords) => {
            coords.forEach(c => {
              if (Array.isArray(c[0])) coordsToExtend(c); // nested
              else bounds.extend({ lat: c[1], lng: c[0] });
            });
          };
          if (geom.type === 'Point') bounds.extend({ lat: geom.coordinates[1], lng: geom.coordinates[0] });
          else if (geom.type === 'LineString' || geom.type === 'MultiPoint') coordsToExtend(geom.coordinates);
          else if (geom.type === 'Polygon' || geom.type === 'MultiLineString') coordsToExtend(geom.coordinates);
          else if (geom.type === 'MultiPolygon') coordsToExtend(geom.coordinates);
        });
        if (!bounds.isEmpty()) { map.fitBounds(bounds); kmlLoaded = true; }
      }
    } catch (err) { console.warn('KML-to-GeoJSON error', err); }
  }).catch(err => {
    console.warn('KML fallback fetch error', err);
  }).finally(() => {
    // after short delay, if KML didn't fit, fit to marker bounds
    setTimeout(() => {
      if (!kmlLoaded) {
        const b = new google.maps.LatLngBounds();
        builtInMarkers.forEach(m => b.extend({ lat: m.lat, lng: m.lng }));
        if (!b.isEmpty()) map.fitBounds(b);
      }
      // create markers after we have an appropriate viewport
      createMarkers(restoredMarkers);
    }, 900);
  });
}

/* ---------- MAP INIT (injected after config loads) ---------- */
function initMapCore() {
  const fallbackCenter = { lat: builtInMarkers[0].lat, lng: builtInMarkers[0].lng };
  map = new google.maps.Map(document.getElementById('map'), {
    center: fallbackCenter,
    zoom: 17,
    mapTypeId: 'hybrid',
    tilt: 0,
    streetViewControl: false,
    gestureHandling: 'greedy',
    rotateControl: true,
  });

  // Load persisted drawings first (into strokePaths)
  loadDrawingsFromStorage();

  // restore marker state
  const restored = loadState();
  // render history
  const storedHistory = JSON.parse(localStorage.getItem(LS_HISTORY) || 'null');
  if (Array.isArray(storedHistory)) historyArr = storedHistory;
  renderHistory();

  // Render saved strokes (if any)
  if (Array.isArray(strokePaths) && strokePaths.length) {
    strokePaths.forEach(path => {
      if (!path || path.length < 2) return;
      const pts = path.map(p => new google.maps.LatLng(p.lat, p.lng));
      const poly = new google.maps.Polyline({
        path: pts,
        map,
        strokeColor: path[0].color || '#ff0000',
        strokeOpacity: 0.95,
        strokeWeight: path[0].weight || 5,
        clickable: false,
        geodesic: true
      });
      strokes.push(poly);
    });
  }

  // load KML & markers; markers will be created after kml attempt
  loadKmlThenFit(restored);

  // setup toolbar wiring
  setupToolbarControls();

  // ensure toolbar UI initial state
  updateToolbarUI();
}

/* ---------- DYNAMIC LOADER ---------- */
function loadGoogleMapsAndInit() {
  if (!window.__MAPS_API_KEY) {
    console.error('Google Maps API key not found in config.js');
    alert('Map API key not found. Make sure config.js is present (Vercel env).');
    return;
  }
  // if google maps already present, call core init
  if (window.google && google.maps) {
    initMapCore();
    return;
  }
  // inject script
  const s = document.createElement('script');
  s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(window.__MAPS_API_KEY)}&libraries=geometry&callback=__LG6_INIT`;
  s.async = true;
  s.defer = true;
  window.__LG6_INIT = function() {
    initMapCore();
  };
  document.head.appendChild(s);
}

/* ---------- START ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // wire mobile history offcanvas
  try {
    const offcanvasEl = document.getElementById('mobileHistory');
    const offcanvas = new bootstrap.Offcanvas(offcanvasEl);
    document.getElementById('openHistoryMobile').addEventListener('click', () => offcanvas.show());
  } catch (e) {}

  // Reset all saved markers
  document.getElementById('resetAll').addEventListener('click', () => {
    if (!confirm('Reset all saved marker data and history?')) return;
    historyArr = [];
    markerObjects.forEach(m => {
      m.note=''; m.date=''; m.saved=false;
      if (m.labelWindow) { m.labelWindow.close(); m.labelWindow=null; }
      m.marker.setIcon({ url: makePinSVG('#007bff'), scaledSize: new google.maps.Size(36,36) });
    });
    saveState(); renderHistory();
  });
  document.getElementById('resetAllMobile').addEventListener('click', () => {
    if (!confirm('Reset all saved marker data and history?')) return;
    historyArr = [];
    markerObjects.forEach(m => {
      m.note=''; m.date=''; m.saved=false;
      if (m.labelWindow) { m.labelWindow.close(); m.labelWindow=null; }
      m.marker.setIcon({ url: makePinSVG('#007bff'), scaledSize: new google.maps.Size(36,36) });
    });
    saveState(); renderHistory();
    try { const off = bootstrap.Offcanvas.getInstance(document.getElementById('mobileHistory')); off && off.hide(); } catch(e){}
  });

  // Load maps and start
  loadGoogleMapsAndInit();
});

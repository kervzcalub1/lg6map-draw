/* main.js - LG6 MAP main logic (vanilla JS)
   - Assumes /config.js exists and contains window.__MAPS_API_KEY
   - Place this file in /public along with index.html and style.css
*/

const KML_RAW_URL = 'https://raw.githubusercontent.com/kervzcalub1/lg6map/refs/heads/main/kml/Untitled%20project.kml';
const LS_MARKERS = 'lg6map_markers_v1';
const LS_HISTORY = 'lg6map_history_v1';
const DRAW_LS_KEY = 'lg6map_drawings_v1';

// built-in markers list (lat,lng,image)
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

// util pin svg
function makePinSVG(color = '#007bff', size = 36) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 24 24'><path fill='${color}' d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z'/><circle cx='12' cy='9' r='2.5' fill='#fff'/></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/* APP STATE */
let map;
let markerObjects = []; // {id, marker, note, date, saved, image, labelWindow}
let historyArr = [];

/* DRAWING STATE */
let drawMode = false;
let eraseMode = false;
let currentColor = '#ff0000'; // default red
let currentSize = 5;
let strokes = []; // google.maps.Polyline[]
let strokePaths = []; // array of arrays: {lat,lng,color,weight}

/* LOAD PERSISTED DRAWINGS */
function loadDrawings() {
  try {
    const raw = localStorage.getItem(DRAW_LS_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return;
    strokePaths = arr;
    // draw them if map is ready
    if (map && strokePaths.length) {
      strokePaths.forEach(path => {
        const latlngs = path.map(p => new google.maps.LatLng(p.lat, p.lng));
        const poly = new google.maps.Polyline({
          path: latlngs,
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
  } catch (e) {
    console.warn('loadDrawings error', e);
  }
}

function saveDrawings() {
  try {
    localStorage.setItem(DRAW_LS_KEY, JSON.stringify(strokePaths));
    alert('Drawings saved.');
  } catch (e) {
    console.warn('saveDrawings error', e);
  }
}

/* MARKER / HISTORY PERSISTENCE */
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

/* HISTORY UI */
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

/* Review history item */
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

/* Popup / Marker UI (preserve prior behavior) */
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

/* DRAWING IMPLEMENTATION (mouse & touch) */
let isDrawing = false;
let currentPolyline = null;

// Helper: create a new polyline
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
  strokePaths.push([]); // push empty path container
  return pl;
}

// attach drawing handlers when drawMode is active
function attachDrawingHandlers() {
  // remove previous listeners to avoid duplicates
  google.maps.event.clearListeners(map, 'mousedown');
  google.maps.event.clearListeners(map, 'mousemove');
  google.maps.event.clearListeners(map, 'mouseup');
  google.maps.event.clearListeners(map, 'touchstart');
  google.maps.event.clearListeners(map, 'touchmove');
  google.maps.event.clearListeners(map, 'touchend');

  // get overlay for projection (for touch)
  if (!map.__projectionOverlay) {
    function ProjectionOverlay() {}
    ProjectionOverlay.prototype = new google.maps.OverlayView();
    ProjectionOverlay.prototype.onAdd = function() {};
    ProjectionOverlay.prototype.draw = function() {};
    ProjectionOverlay.prototype.onRemove = function() {};
    map.__projectionOverlay = new ProjectionOverlay();
    map.__projectionOverlay.setMap(map);
  }

  // Mouse events
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
    // temporarily disable map drag to avoid panning while drawing
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
    saveDrawings(); // autosave
  });

  // Touch events (use container pixel -> latlng)
  const mapDiv = map.getDiv();
  mapDiv.addEventListener('touchstart', (ev) => {
    if (!drawMode) return;
    const touch = ev.touches[0];
    const rect = mapDiv.getBoundingClientRect();
    const px = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    const proj = map.__projectionOverlay.getProjection();
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
    const proj = map.__projectionOverlay.getProjection();
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
    saveDrawings();
  }, { passive: true });
}

function detachDrawingHandlers() {
  google.maps.event.clearListeners(map, 'mousedown');
  google.maps.event.clearListeners(map, 'mousemove');
  google.maps.event.clearListeners(map, 'mouseup');
  // touch listeners attached to div remain — but will noop since drawMode false
}

/* erase helper: remove points/paths near latlng */
function eraseAtLatLng(latLng, radiusMeters = 10) {
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
      return dist > radiusMeters; // keep if further than radius
    });
    if (filtered.length !== path.length) changed = true;
    if (filtered.length < 2) {
      // remove the entire stroke
      strokePaths.splice(i, 1);
    } else {
      strokePaths[i] = filtered;
    }
  }
  if (changed) {
    // rebuild polylines
    strokes.forEach(s => s.setMap(null));
    strokes = [];
    strokePaths.forEach(path => {
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
    saveDrawings();
  }
}

/* undo last stroke */
function undoLastStroke() {
  if (strokes.length === 0) return;
  const last = strokes.pop();
  last.setMap(null);
  strokePaths.pop();
  saveDrawings();
}

/* clear all strokes with confirmation */
function clearAllStrokes() {
  if (!confirm('Erase ALL drawings? This cannot be undone.')) return;
  strokes.forEach(s => s.setMap(null));
  strokes = [];
  strokePaths = [];
  saveDrawings();
  // also exit draw mode and update toolbar
  drawMode = false;
  eraseMode = false;
  updateToolbarUI();
}

/* toolbar UI wiring */
function updateToolbarUI() {
  const toolbar = document.getElementById('toolbar');
  const controls = document.getElementById('toolbarControls');
  const toolToggle = document.getElementById('toolToggle');

  if (drawMode) {
    toolbar.classList.remove('collapsed');
    controls.setAttribute('aria-hidden', 'false');
    // show controls and attach handlers
    attachDrawingHandlers();
  } else {
    toolbar.classList.add('collapsed');
    controls.setAttribute('aria-hidden', 'true');
    detachDrawingHandlers();
  }

  // update tool icon tooltip
  toolToggle.title = drawMode ? 'Stop drawing' : 'Open drawing tools';
}

/* hook toolbar buttons */
function setupToolbarControls() {
  const toolToggle = document.getElementById('toolToggle');
  const colorSelect = document.getElementById('colorSelect');
  const sizeSelect = document.getElementById('sizeSelect');
  const undoBtn = document.getElementById('undoBtn');
  const eraseModeBtn = document.getElementById('eraseModeBtn');
  const eraseAllBtn = document.getElementById('eraseAllBtn');
  const saveDrawBtn = document.getElementById('saveDrawBtn');

  // start collapsed
  drawMode = false; eraseMode = false;
  updateToolbarUI();

  toolToggle.addEventListener('click', () => {
    // If collapsed -> expand to drawing (toggle)
    drawMode = !drawMode;
    if (!drawMode) eraseMode = false;
    updateToolbarUI();
  });

  colorSelect.addEventListener('change', (e) => {
    currentColor = e.target.value;
  });
  // ensure defaults reflect UI
  currentColor = colorSelect.value;

  sizeSelect.addEventListener('change', (e) => {
    currentSize = parseInt(e.target.value, 10) || 5;
  });
  currentSize = parseInt(sizeSelect.value, 10) || 5;

  undoBtn.addEventListener('click', () => undoLastStroke());

  eraseModeBtn.addEventListener('click', () => {
    eraseMode = !eraseMode;
    eraseModeBtn.classList.toggle('active', eraseMode);
    // if eraseMode enabled, ensure drawMode also enabled so handlers active
    if (eraseMode && !drawMode) {
      drawMode = true;
      updateToolbarUI();
    }
  });

  eraseAllBtn.addEventListener('click', () => {
    if (!confirm('Erase all drawings? This will clear everything.')) return;
    clearAllStrokes();
    // after erase all, collapse toolbar to avoid inconsistent state
    drawMode = false; eraseMode = false; updateToolbarUI();
  });

  saveDrawBtn.addEventListener('click', () => saveDrawings());
}

/* KML load + map initialization and markers */
function initMap() {
  console.info('initMap start');
  // default center - use center of markers as fallback
  const fallbackCenter = { lat: builtInMarkers[0].lat, lng: builtInMarkers[0].lng };
  map = new google.maps.Map(document.getElementById('map'), {
    center: fallbackCenter,
    zoom: 20,
    mapTypeId: 'hybrid',
    tilt: 0, // top-down
    streetViewControl: false,
    gestureHandling: 'greedy',
    rotateControl: true,
  });

  // Load persisted drawings (if any)
  loadDrawings();

  // Restore markers from storage (or create new)
  const restored = loadState();
  if (restored && Array.isArray(restored)) console.info('Restored marker state from localStorage');

  // create markers
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

  // Try loading KML via KmlLayer and fit to bounds when ready
  let kmlLoaded = false;
  try {
    const kmlLayer = new google.maps.KmlLayer({ url: KML_RAW_URL, map: map, preserveViewport: true, suppressInfoWindows: true });
    kmlLayer.addListener('defaultviewport_changed', () => {
      try {
        const bounds = kmlLayer.getDefaultViewport();
        if (bounds) {
          map.fitBounds(bounds);
          kmlLoaded = true;
        }
      } catch (e) {
        console.warn('kml defaultviewport_changed error', e);
      }
    });
    kmlLayer.addListener('status_changed', () => {
      console.info('KML status:', kmlLayer.getStatus && kmlLayer.getStatus());
    });
  } catch (e) {
    console.warn('KmlLayer init failed:', e);
  }

  // fallback: try to fetch and render KML via toGeoJSON then fit bounds
  fetch(KML_RAW_URL).then(r => {
    if (!r.ok) throw new Error('KML fetch failed: ' + r.status);
    return r.text();
  }).then(kmlText => {
    const parser = new DOMParser();
    const kmlDoc = parser.parseFromString(kmlText, 'text/xml');
    const geojson = toGeoJSON.kml(kmlDoc);
    map.data.addGeoJson(geojson);
    map.data.setStyle({ strokeColor:'#ff0000', strokeWeight:2, fillOpacity:0.05 });
    // try to fit to data bounds
    const bounds = new google.maps.LatLngBounds();
    map.data.forEach(function(feature) {
      const geom = feature.getGeometry();
      const extendBounds = (g) => {
        if (g instanceof google.maps.Data.Point) {
          bounds.extend(g.get());
        } else if (g instanceof google.maps.Data.LineString || g instanceof google.maps.Data.MultiLineString) {
          g.getArray().forEach(p => bounds.extend(p));
        } else if (g instanceof google.maps.Data.Polygon || g instanceof google.maps.Data.MultiPolygon) {
          g.getArray().forEach(ring => ring.getArray().forEach(p => bounds.extend(p)));
        }
      };
      // traverse geometry
      if (geom) {
        if (geom.getType && geom.getType() === 'GeometryCollection') {
          geom.getArray().forEach(extendBounds);
        } else {
          extendBounds(geom);
        }
      }
    });
    // only fit if non-empty
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds);
      kmlLoaded = true;
    }
    console.info('KML fallback rendered via toGeoJSON');
  }).catch(err => {
    console.warn('KML fallback error:', err.message);
  }).finally(() => {
    // If after small delay KML not loaded, fit to marker bounds
    setTimeout(() => {
      if (!kmlLoaded) {
        const b = new google.maps.LatLngBounds();
        builtInMarkers.forEach(m => b.extend({ lat: m.lat, lng: m.lng }));
        map.fitBounds(b);
      }
    }, 1400);
  });

  // load history
  const storedHistory = JSON.parse(localStorage.getItem(LS_HISTORY) || 'null');
  if (Array.isArray(storedHistory)) historyArr = storedHistory;
  renderHistory();

  // setup toolbar controls
  setupToolbarControls();
}

/* Expose initMap to google callback */
window.initMap = initMap;

/* DOM ready handlers (mobile offcanvas toggles, reset buttons) */
document.addEventListener('DOMContentLoaded', () => {
  // history mobile open
  const offcanvasEl = document.getElementById('mobileHistory');
  const offcanvas = new bootstrap.Offcanvas(offcanvasEl);
  document.getElementById('openHistoryMobile').addEventListener('click', () => offcanvas.show());

  // reset all saved
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
    try { const off = bootstrap.Offcanvas.getInstance(offcanvasEl); off && off.hide(); } catch(e){}
  });
});

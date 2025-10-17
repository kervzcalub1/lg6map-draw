// main.js - updated full file (replace existing /public/main.js)
// Key fixes: pinch/no-draw, rotation allowed, zoom 20, improved manual eraser, persistent strokes

// ---------- CONFIG ----------
const KML_RAW_URL = 'https://raw.githubusercontent.com/kervzcalub1/lg6map/refs/heads/main/kml/Untitled%20project.kml';
const LS_MARKERS = 'lg6map_markers_v1';
const LS_HISTORY = 'lg6map_history_v1';
const DRAW_LS_KEY = 'lg6map_drawings_v1';

// Built-in markers list (lat, lng, image)
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

// ---------- UTIL: SVG PIN ----------
function makePinSVG(color = '#007bff', size = 36) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 24 24'><path fill='${color}' d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z'/><circle cx='12' cy='9' r='2.5' fill='#fff'/></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// ---------- APP STATE ----------
let map;
let markerObjects = []; // { id, marker, note, date, saved, image, labelWindow }
let historyArr = [];

// Drawing state
let drawMode = false;
let eraseMode = false;
let currentColor = '#ff0000'; // default red
let currentSize = 5;
let strokes = []; // google.maps.Polyline[]
let strokePaths = []; // array of arrays of {lat,lng,color,weight}

// Multi-touch (pinch) flag to avoid drawing during pinch-zoom
let multiTouchActive = false;

// ---------- PERSISTENCE ----------
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
    const toSave = markerObjects.map(m => ({ id: m.id, note: m.note, date: m.date, saved: m.saved, image: m.image }));
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
  } catch (e) {
    console.warn('loadDrawingsFromStorage error', e);
  }
}
function saveDrawingsToStorage() {
  try {
    localStorage.setItem(DRAW_LS_KEY, JSON.stringify(strokePaths));
  } catch (e) {
    console.warn('saveDrawingsToStorage error', e);
  }
}

// ---------- HISTORY UI ----------
function renderHistory() {
  const list = document.getElementById('historyList');
  const listMobile = document.getElementById('historyListMobile');
  if (!list || !listMobile) return;
  list.innerHTML = '';
  listMobile.innerHTML = '';
  if (!historyArr || historyArr.length === 0) {
    const n = document.createElement('div'); n.className = 'muted'; n.innerText = 'No history yet.'; list.appendChild(n);
    listMobile.appendChild(n.cloneNode(true));
    return;
  }
  [...historyArr].reverse().forEach(h => {
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

// ---------- MARKER POPUP & LABEL ----------
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

// ---------- DRAWING IMPLEMENTATION ----------

let isDrawing = false;
let currentPolyline = null;

// Create a new polyline and add to strokePaths
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

// Improved eraser: remove points within radius (meters) and split into segments
function eraseAtLatLng(latLng, radiusMeters = 4) {
  if (!latLng) return;
  const R = 6371000;
  let changed = false;
  const newPaths = [];

  for (let i = 0; i < strokePaths.length; i++) {
    const path = strokePaths[i];
    if (!path || path.length === 0) continue;
    // mark points that are far enough to keep
    const keep = path.map(pt => {
      const dLat = (pt.lat - latLng.lat) * Math.PI/180;
      const dLng = (pt.lng - latLng.lng) * Math.PI/180;
      const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(pt.lat*Math.PI/180)*Math.cos(latLng.lat*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const dist = R * c;
      return dist > radiusMeters;
    });

    // if all true -> keep entire path
    if (keep.every(k => k)) {
      newPaths.push(path);
      continue;
    }

    changed = true;
    // split contiguous kept points into new subpaths
    let current = [];
    for (let j = 0; j < path.length; j++) {
      if (keep[j]) {
        current.push(path[j]);
      } else {
        if (current.length >= 2) {
          newPaths.push(current);
        }
        current = [];
      }
    }
    if (current.length >= 2) newPaths.push(current);
  }

  if (changed) {
    strokePaths = newPaths;
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
  strokes.forEach(s => s.setMap(null));
  strokes = [];
  strokePaths = [];
  saveDrawingsToStorage();
  // Do NOT change drawMode (retain current state)
}

/* Attach drawing handlers (mouse + touch) */
function attachDrawingHandlers() {
  // Remove old listeners to avoid duplicates
  google.maps.event.clearListeners(map, 'mousedown');
  google.maps.event.clearListeners(map, 'mousemove');
  google.maps.event.clearListeners(map, 'mouseup');

  const mapDiv = map.getDiv();

  // Ensure projection overlay exists (for touch pixel->latlng)
  if (!map.__projOverlay) {
    function P() {}
    P.prototype = new google.maps.OverlayView();
    P.prototype.onAdd = function() {};
    P.prototype.draw = function() {};
    P.prototype.onRemove = function() {};
    map.__projOverlay = new P();
    map.__projOverlay.setMap(map);
  }

  // Helper to convert container pixels to LatLng
  function getLatLngFromContainerPixels(x, y) {
    const proj = map.__projOverlay.getProjection();
    if (!proj) return null;
    const point = new google.maps.Point(x, y);
    return proj.fromContainerPixelToLatLng(point);
  }

  // Mouse events
  map.addListener('mousedown', (e) => {
    if (!drawMode) return;
    if (eraseMode) {
      eraseAtLatLng(e.latLng, currentSize * 0.6); // meters approx
      return;
    }
    isDrawing = true;
    currentPolyline = startPolyline(currentColor, currentSize);
    currentPolyline.getPath().push(e.latLng);
    strokePaths[strokePaths.length - 1].push({ lat: e.latLng.lat(), lng: e.latLng.lng(), color: currentColor, weight: currentSize });
    // Prevent map dragging while drawing with mouse
    map.setOptions({ draggable: false });
  });

  map.addListener('mousemove', (e) => {
    if (!isDrawing || !currentPolyline) return;
    currentPolyline.getPath().push(e.latLng);
    strokePaths[strokePaths.length - 1].push({ lat: e.latLng.lat(), lng: e.latLng.lng(), color: currentColor, weight: currentSize });
  });

  map.addListener('mouseup', () => {
    if (!isDrawing) return;
    isDrawing = false;
    currentPolyline = null;
    map.setOptions({ draggable: true });
    saveDrawingsToStorage();
  });

  // Map div touch handlers (pixel -> latlng conversion)
  // NOTE: passive: false so we can call preventDefault() and stop drawing on pinch
  mapDiv.addEventListener('touchstart', (ev) => {
    if (!drawMode) return;
    if (ev.touches && ev.touches.length > 1) {
      // Multi-touch detected (pinch/rotate) -> do not start drawing
      multiTouchActive = true;
      return;
    }
    multiTouchActive = false;
    const touch = ev.touches[0];
    const rect = mapDiv.getBoundingClientRect();
    const px = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    const latLng = getLatLngFromContainerPixels(px.x, px.y);
    if (!latLng) return;
    if (eraseMode) {
      eraseAtLatLng(latLng, currentSize * 0.6);
      return;
    }
    // start drawing
    isDrawing = true;
    currentPolyline = startPolyline(currentColor, currentSize);
    currentPolyline.getPath().push(latLng);
    strokePaths[strokePaths.length - 1].push({ lat: latLng.lat(), lng: latLng.lng(), color: currentColor, weight: currentSize });
    // Do not change gestureHandling - allow rotate/zoom with two-finger gestures
    ev.preventDefault && ev.preventDefault();
  }, { passive: false });

  mapDiv.addEventListener('touchmove', (ev) => {
    // if multi-touch (pinch) then skip drawing to allow pinch-zoom/rotate
    if (ev.touches && ev.touches.length > 1) { multiTouchActive = true; return; }
    if (multiTouchActive) return; // skip until touchend resets
    if (!isDrawing || !currentPolyline) return;
    const touch = ev.touches[0];
    const rect = mapDiv.getBoundingClientRect();
    const px = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    const latLng = getLatLngFromContainerPixels(px.x, px.y);
    if (!latLng) return;
    if (eraseMode) {
      eraseAtLatLng(latLng, currentSize * 0.6);
      return;
    }
    currentPolyline.getPath().push(latLng);
    strokePaths[strokePaths.length - 1].push({ lat: latLng.lat(), lng: latLng.lng(), color: currentColor, weight: currentSize });
    ev.preventDefault && ev.preventDefault();
  }, { passive: false });

  mapDiv.addEventListener('touchend', (ev) => {
    // If touchend ended a pinch, reset multiTouchActive properly
    if (ev.touches && ev.touches.length > 0) {
      multiTouchActive = ev.touches.length > 1;
    } else {
      multiTouchActive = false;
    }
    if (isDrawing) {
      isDrawing = false;
      currentPolyline = null;
      saveDrawingsToStorage();
    }
  }, { passive: false });
}

// Detach drawing handlers when drawMode false
function detachDrawingHandlers() {
  google.maps.event.clearListeners(map, 'mousedown');
  google.maps.event.clearListeners(map, 'mousemove');
  google.maps.event.clearListeners(map, 'mouseup');
  // DOM touch listeners remain attached to div but will early-return when drawMode=false
}

// ---------- TOOLBAR UI ----------
function updateToolbarUI() {
  const btn = document.getElementById('btnDrawToggle');
  if (!btn) return;
  if (drawMode) {
    btn.classList.add('active');
    btn.textContent = '🛑 Stop Drawing';
    attachDrawingHandlers();
  } else {
    btn.classList.remove('active');
    btn.textContent = '✏️ Draw';
    detachDrawingHandlers();
  }
}

function setupToolbarControls() {
  const btnToggle = document.getElementById('btnDrawToggle');
  const tbColor = document.getElementById('tbColor');
  const tbSize = document.getElementById('tbSize');
  const btnUndo = document.getElementById('btnUndo');
  const btnEraseMode = document.getElementById('btnEraseMode');
  const btnEraseAll = document.getElementById('btnEraseAll');
  const btnSaveDraw = document.getElementById('btnSaveDraw');

  // initialize from UI
  if (tbColor) currentColor = tbColor.value || '#ff0000';
  if (tbSize) currentSize = parseInt(tbSize.value, 10) || 5;

  if (btnToggle) btnToggle.addEventListener('click', () => {
    drawMode = !drawMode;
    if (!drawMode) eraseMode = false; // if turning off, also reset erase mode
    updateToolbarUI();
  });

  if (tbColor) tbColor.addEventListener('change', (e) => { currentColor = e.target.value; });
  if (tbSize) tbSize.addEventListener('change', (e) => { currentSize = parseInt(e.target.value, 10) || 5; });

  if (btnUndo) btnUndo.addEventListener('click', () => undoLastStroke());
  if (btnEraseMode) btnEraseMode.addEventListener('click', () => {
    eraseMode = !eraseMode;
    btnEraseMode.classList.toggle('active', eraseMode);
    if (eraseMode && !drawMode) {
      drawMode = true;
      updateToolbarUI();
    }
  });
  if (btnEraseAll) btnEraseAll.addEventListener('click', () => {
    if (!confirm('Erase all drawings? This cannot be undone.')) return;
    clearAllDrawings();
    // keep drawMode state as-is (do not disable)
  });
  if (btnSaveDraw) btnSaveDraw.addEventListener('click', () => {
    saveDrawingsToStorage();
    alert('Drawings saved.');
  });
}

// ---------- KML & MARKERS ----------
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

function loadKmlAndFit(restored) {
  let kmlLoaded = false;
  try {
    const kml = new google.maps.KmlLayer({ url: KML_RAW_URL, map: map, preserveViewport: false, suppressInfoWindows: true });
    kml.addListener('defaultviewport_changed', () => {
      try {
        const bounds = kml.getDefaultViewport();
        if (bounds) {
          map.fitBounds(bounds);
          kmlLoaded = true;
        }
      } catch (e) { console.warn('kml default viewport error', e); }
    });
    kml.addListener('status_changed', () => console.info('KML status:', kml.getStatus && kml.getStatus()));
  } catch (e) {
    console.warn('KmlLayer init failed:', e);
  }

  // fallback using toGeoJSON
  fetch(KML_RAW_URL).then(r => {
    if (!r.ok) throw new Error('KML fetch failed: ' + r.status);
    return r.text();
  }).then(kmlText => {
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
        // generic coordinate walker
        const extendCoords = (coords) => {
          coords.forEach(c => {
            if (Array.isArray(c[0])) extendCoords(c);
            else bounds.extend({ lat: c[1], lng: c[0] });
          });
        };
        if (geom.type === 'Point') bounds.extend({ lat: geom.coordinates[1], lng: geom.coordinates[0] });
        else extendCoords(geom.coordinates);
      });
      if (!bounds.isEmpty()) { map.fitBounds(bounds); kmlLoaded = true; }
    }
  }).catch(err => {
    console.warn('KML fallback fetch error', err);
  }).finally(() => {
    setTimeout(() => {
      if (!kmlLoaded) {
        const b = new google.maps.LatLngBounds();
        builtInMarkers.forEach(m => b.extend({ lat: m.lat, lng: m.lng }));
        if (!b.isEmpty()) map.fitBounds(b);
      }
      // create markers AFTER we have a proper viewport
      createMarkers(restored);
    }, 900);
  });
}

// ---------- MAP INITIALIZATION ----------
function initMapCore() {
  const fallbackCenter = { lat: builtInMarkers[0].lat, lng: builtInMarkers[0].lng };
  map = new google.maps.Map(document.getElementById('map'), {
    center: fallbackCenter,
    zoom: 20,               // DEFAULT ZOOM 20 as requested
    mapTypeId: 'hybrid',
    tilt: 25,               // slight tilt
    streetViewControl: false,
    gestureHandling: 'greedy',
    rotateControl: true,    // allow rotation
    tiltControl: true,
  });

  // Load persisted drawing paths
  loadDrawingsFromStorage();

  // render saved strokes (if any)
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

  // restore marker state & history
  const restored = loadState();
  const storedHistory = JSON.parse(localStorage.getItem(LS_HISTORY) || 'null');
  if (Array.isArray(storedHistory)) historyArr = storedHistory;
  renderHistory();

  // load KML and fit viewport, then create markers
  loadKmlAndFit(restored);

  // toolbar wiring
  setupToolbarControls();
  updateToolbarUI();
}

// dynamic loading of Google Maps using config.js injected key
function loadGoogleMapsAndInit() {
  if (!window.__MAPS_API_KEY) {
    console.error('Google Maps API key missing. Ensure /config.js is present.');
    alert('Map API key missing. Check config.js or Vercel env variable.');
    return;
  }
  if (window.google && google.maps) {
    initMapCore();
    return;
  }
  const s = document.createElement('script');
  s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(window.__MAPS_API_KEY)}&libraries=geometry&callback=__LG6MAP_INIT`;
  s.async = true;
  s.defer = true;
  window.__LG6MAP_INIT = function() { initMapCore(); };
  document.head.appendChild(s);
}

// ---------- START ----------
document.addEventListener('DOMContentLoaded', () => {
  // mobile offcanvas history handling
  try {
    const offcanvasEl = document.getElementById('mobileHistory');
    const offcanvas = new bootstrap.Offcanvas(offcanvasEl);
    document.getElementById('openHistoryMobile').addEventListener('click', () => offcanvas.show());
  } catch (e) {}

  // Reset saved markers
  const resetAll = document.getElementById('resetAll');
  const resetAllMobile = document.getElementById('resetAllMobile');
  if (resetAll) {
    resetAll.addEventListener('click', () => {
      if (!confirm('Reset all saved marker data and history?')) return;
      historyArr = [];
      markerObjects.forEach(m => {
        m.note=''; m.date=''; m.saved=false;
        if (m.labelWindow) { m.labelWindow.close(); m.labelWindow=null; }
        m.marker.setIcon({ url: makePinSVG('#007bff'), scaledSize: new google.maps.Size(36,36) });
      });
      saveState(); renderHistory();
    });
  }
  if (resetAllMobile) {
    resetAllMobile.addEventListener('click', () => {
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
  }

  // Load Google Maps and start
  loadGoogleMapsAndInit();
});

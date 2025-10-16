/* main.js - LG6 MAP with Drawing Toolbar (vanilla JS)
   Assumptions:
   - public/config.js defines window.__MAPS_API_KEY
   - index.html loads this script after Google Maps script injection
*/

const KML_RAW_URL = 'https://raw.githubusercontent.com/kervzcalub1/lg6map/refs/heads/main/kml/Untitled%20project.kml';
const DRAW_LS_KEY = 'lg6map_drawings_v1';
const LS_MARKERS = 'lg6map_markers_v1';
const LS_HISTORY = 'lg6map_history_v1';

// built-in markers (lat, lng, image)
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

// Utility: colored pin svg data url
function makePinSVG(color = '#007bff', size = 36) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 24 24'><path fill='${color}' d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z'/><circle cx='12' cy='9' r='2.5' fill='#fff'/></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/* APP STATE */
let map;
let markerObjects = []; // {id, marker, note, date, saved, image, labelWindow}
let historyArr = [];

/* DRAWING STATE */
let drawing = false;
let erasing = false;
let currentStroke = null; // google.maps.Polyline object while drawing
let strokes = [];         // array of google.maps.Polyline
let strokePaths = [];     // array of arrays of {lat,lng,color,weight}
let currentColor = '#16a34a';
let currentWeight = 5;

/* Helpers: drawings persistence */
function loadDrawings() {
  try {
    const raw = localStorage.getItem(DRAW_LS_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return;
    strokePaths = arr; // each path is array of points with lat,lng,color,weight
    if (map) renderLoadedStrokes();
  } catch (e) {
    console.warn('loadDrawings error', e);
  }
}

function saveDrawingsToStorage() {
  try {
    localStorage.setItem(DRAW_LS_KEY, JSON.stringify(strokePaths || []));
  } catch (e) {
    console.warn('saveDrawings error', e);
  }
}

function renderLoadedStrokes() {
  // clear existing polylines
  strokes.forEach(s => s.setMap(null));
  strokes = [];
  strokePaths.forEach(path => {
    const latLngArray = path.map(p => new google.maps.LatLng(p.lat, p.lng));
    const color = (path.length && path[0].color) ? path[0].color : '#16a34a';
    const weight = (path.length && path[0].weight) ? path[0].weight : 5;
    const pl = new google.maps.Polyline({
      path: latLngArray,
      map,
      strokeColor: color,
      strokeOpacity: 0.95,
      strokeWeight: weight,
      clickable: false,
      geodesic: true
    });
    strokes.push(pl);
  });
}

/* Marker / History persistence */
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

/* History UI */
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

/* KML fallback */
function fallbackKmlLoad(url) {
  fetch(url).then(r => {
    if (!r.ok) throw new Error('KML fetch failed: ' + r.status);
    return r.text();
  }).then(kmlText => {
    const parser = new DOMParser();
    const kmlDoc = parser.parseFromString(kmlText, 'text/xml');
    const geojson = toGeoJSON.kml(kmlDoc);
    map.data.addGeoJson(geojson);
    map.data.setStyle({ strokeColor:'#ff0000', strokeWeight:2, fillOpacity:0.05 });
    console.info('KML fallback rendered via toGeoJSON');
  }).catch(err => {
    console.warn('KML fallback error:', err.message);
  });
}

/* Marker popups from your original code (keeps behavior) */
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

/* DRAWING IMPLEMENTATION */
function startDrawing(e) {
  if (!map) return;
  drawing = true;
  currentStroke = new google.maps.Polyline({
    path: [],
    map,
    strokeColor: currentColor,
    strokeOpacity: 0.95,
    strokeWeight: currentWeight,
    clickable: false,
    geodesic: true
  });
  strokes.push(currentStroke);
  strokePaths.push([]);
  // disable dragging for precise draw
  map.setOptions({ draggable: false, gestureHandling: 'none' });

  // initial point
  if (e.latLng) {
    const p = e.latLng;
    currentStroke.getPath().push(p);
    strokePaths[strokePaths.length - 1].push({ lat: p.lat(), lng: p.lng(), color: currentColor, weight: currentWeight });
  }
}

function moveDrawing(e) {
  if (!drawing || !currentStroke) return;
  if (!e.latLng) return;
  const p = e.latLng;
  currentStroke.getPath().push(p);
  strokePaths[strokePaths.length - 1].push({ lat: p.lat(), lng: p.lng(), color: currentColor, weight: currentWeight });
}

function endDrawing() {
  if (!drawing) return;
  drawing = false;
  currentStroke = null;
  map.setOptions({ draggable: true, gestureHandling: 'greedy' });
  // After finishing, save temporarily
  saveDrawingsToStorage();
}

/* Eraser: manual pencil-style erase - remove points near pointer */
function eraseAtLatLng(latLng, radiusMeters = 10) {
  if (!strokePaths || strokePaths.length === 0) return;
  const R = 6371000; // earth radius in meters
  let changed = false;

  // iterate through each path, filter out points near latLng
  const newPaths = strokePaths.map(path => {
    if (!Array.isArray(path)) return path;
    const filtered = path.filter(pt => {
      const dLat = (pt.lat - latLng.lat()) * Math.PI/180;
      const dLng = (pt.lng - latLng.lng()) * Math.PI/180;
      const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(pt.lat*Math.PI/180)*Math.cos(latLng.lat()*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const dist = R * c;
      return dist > radiusMeters; // keep points further than radius
    });
    if (filtered.length !== path.length) changed = true;
    return filtered;
  });

  // remove empty paths
  const final = newPaths.filter(p => p.length > 1);
  if (changed) {
    strokePaths = final;
    // rebuild polylines
    strokes.forEach(s => s.setMap(null));
    strokes = [];
    strokePaths.forEach(path => {
      const latLngs = path.map(pt => new google.maps.LatLng(pt.lat, pt.lng));
      const pl = new google.maps.Polyline({
        path: latLngs,
        map,
        strokeColor: path[0].color || '#16a34a',
        strokeOpacity: 0.95,
        strokeWeight: path[0].weight || 5,
        clickable: false,
        geodesic: true
      });
      strokes.push(pl);
    });
    saveDrawingsToStorage();
  }
}

/* Undo last stroke */
function undoLastStroke() {
  if (strokes.length === 0) return;
  const last = strokes.pop();
  last.setMap(null);
  strokePaths.pop();
  saveDrawingsToStorage();
}

/* Clear all strokes */
function clearAllStrokes() {
  if (!confirm('Erase ALL drawings? This cannot be undone.')) return;
  strokes.forEach(s => s.setMap(null));
  strokes = [];
  strokePaths = [];
  saveDrawingsToStorage();
}

/* Event wiring when drawing mode toggled ON */
function enableDrawingHandlers() {
  // clear previous listeners to avoid duplicates
  google.maps.event.clearListeners(map, 'mousedown');
  google.maps.event.clearListeners(map, 'mousemove');
  google.maps.event.clearListeners(map, 'mouseup');

  map.addListener('mousedown', startDrawing);
  map.addListener('mousemove', moveDrawing);
  map.addListener('mouseup', endDrawing);

  // touch handling for mobile: convert touch point to latLng via overlay projection
  const mapDiv = map.getDiv();
  if (!map.__projectionOverlay) {
    function ProjectionOverlay() {}
    ProjectionOverlay.prototype = new google.maps.OverlayView();
    ProjectionOverlay.prototype.onAdd = function() {};
    ProjectionOverlay.prototype.draw = function() {};
    ProjectionOverlay.prototype.onRemove = function() {};
    map.__projectionOverlay = new ProjectionOverlay();
    map.__projectionOverlay.setMap(map);
  }

  // add touch listeners on map div
  mapDiv.addEventListener('touchstart', function(ev) {
    if (!ev.touches || ev.touches.length === 0) return;
    const touch = ev.touches[0];
    const pt = { x: touch.clientX - mapDiv.getBoundingClientRect().left, y: touch.clientY - mapDiv.getBoundingClientRect().top };
    const proj = map.__projectionOverlay.getProjection();
    if (!proj) return;
    const latLng = proj.fromContainerPixelToLatLng(new google.maps.Point(pt.x, pt.y));
    if (!latLng) return;
    if (erasing) {
      eraseAtLatLng(latLng, currentWeight * 1.5 * 2);
    } else {
      startDrawing({ latLng });
    }
  }, { passive: true });

  mapDiv.addEventListener('touchmove', function(ev) {
    if (!ev.touches || ev.touches.length === 0) return;
    const touch = ev.touches[0];
    const pt = { x: touch.clientX - mapDiv.getBoundingClientRect().left, y: touch.clientY - mapDiv.getBoundingClientRect().top };
    const proj = map.__projectionOverlay.getProjection();
    if (!proj) return;
    const latLng = proj.fromContainerPixelToLatLng(new google.maps.Point(pt.x, pt.y));
    if (!latLng) return;
    if (erasing) {
      eraseAtLatLng(latLng, currentWeight * 1.5 * 2);
    } else {
      moveDrawing({ latLng });
    }
    ev.preventDefault && ev.preventDefault();
  }, { passive: false });

  mapDiv.addEventListener('touchend', function(ev) {
    endDrawing();
  }, { passive: true });

  // also add mouse-based eraser support: if erasing true, mousemove will erase
  map.addListener('mousemove', (e) => {
    if (erasing && e.latLng) {
      eraseAtLatLng(e.latLng, currentWeight * 1.5);
    }
  });
}

/* INIT MAP (callback for Google Maps) */
function initMap() {
  console.info('initMap called');
  const center = { lat: 7.0840, lng: 125.6277 };
  map = new google.maps.Map(document.getElementById('map'), {
    center,
    zoom: 17,
    mapTypeId: 'hybrid',
    streetViewControl: false,
    gestureHandling: 'greedy',
    rotateControl: true,
    tilt: 45,
  });

  // load drawings first so they're beneath markers and KML
  loadDrawings();

  const restored = loadState();
  if (restored && Array.isArray(restored)) console.info('Restored marker state from localStorage');

  // create markers (preserve previous behavior)
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

  // load KML
  try {
    const kml = new google.maps.KmlLayer({ url: KML_RAW_URL, map: map, preserveViewport: true, suppressInfoWindows: true });
    kml.addListener('status_changed', () => console.info('KmlLayer status:', kml.getStatus && kml.getStatus()));
  } catch (e) {
    console.warn('KmlLayer init failed:', e);
  }
  fallbackKmlLoad(KML_RAW_URL);

  // load history
  try {
    const storedHistory = JSON.parse(localStorage.getItem(LS_HISTORY) || 'null');
    if (Array.isArray(storedHistory)) historyArr = storedHistory;
  } catch (e) {}
  renderHistory();

  // wire toolbar
  setupToolbar();

  // render strokes if loaded earlier
  if (strokePaths.length > 0 && strokes.length === 0) {
    renderLoadedStrokes();
  }
}

/* TOOLBAR wiring */
function setupToolbar() {
  const toggleBtn = document.getElementById('btnDrawToggle');
  const colorSel = document.getElementById('tbColor');
  const sizeSel = document.getElementById('tbSize');
  const undoBtn = document.getElementById('btnUndo');
  const eraseModeBtn = document.getElementById('btnEraseMode');
  const eraseAllBtn = document.getElementById('btnEraseAll');
  const saveDrawBtn = document.getElementById('btnSaveDraw');

  let drawActive = false;

  toggleBtn.addEventListener('click', () => {
    drawActive = !drawActive;
    if (drawActive) {
      toggleBtn.classList.add('active');
      toggleBtn.innerText = '✏️ Drawing';
      erasing = false;
      eraseModeBtn.classList.remove('active');
      enableDrawingHandlers();
    } else {
      toggleBtn.classList.remove('active');
      toggleBtn.innerText = '✏️ Draw';
      // remove drawing listeners
      google.maps.event.clearListeners(map, 'mousedown');
      google.maps.event.clearListeners(map, 'mousemove');
      google.maps.event.clearListeners(map, 'mouseup');
      map.setOptions({ draggable: true, gestureHandling: 'greedy' });
    }
  });

  colorSel.addEventListener('change', (e) => {
    currentColor = e.target.value;
  });

  sizeSel.addEventListener('change', (e) => {
    currentWeight = parseInt(e.target.value, 10) || 5;
  });

  undoBtn.addEventListener('click', () => undoLastStroke());

  eraseModeBtn.addEventListener('click', () => {
    erasing = !erasing;
    if (erasing) {
      eraseModeBtn.classList.add('active');
      eraseModeBtn.innerText = '🩹 Erasing';
      // ensure drawing listeners active (so mousemove erases)
      enableDrawingHandlers();
    } else {
      eraseModeBtn.classList.remove('active');
      eraseModeBtn.innerText = '🩹 Erase';
    }
  });

  eraseAllBtn.addEventListener('click', () => {
    if (!confirm('Erase ALL drawings? This cannot be undone.')) return;
    clearAllStrokes();
  });

  saveDrawBtn.addEventListener('click', () => {
    saveDrawingsToStorage();
    alert('Drawings saved.');
  });

  // Reset / clear marker history (desktop/mobile)
  document.getElementById('resetAll').addEventListener('click', () => {
    if (!confirm('Reset all saved marker data and history?')) return;
    historyArr = [];
    markerObjects.forEach(m => {
      m.note=''; m.date=''; m.saved=false;
      if (m.labelWindow) { m.labelWindow.close(); m.labelWindow=null; }
      m.marker.setIcon({ url: makePinSVG('#007bff'), scaledSize: new google.maps.Size(36,36) });
    });
    saveState();
    renderHistory();
  });
  document.getElementById('resetAllMobile').addEventListener('click', () => {
    if (!confirm('Reset all saved marker data and history?')) return;
    historyArr = [];
    markerObjects.forEach(m => {
      m.note=''; m.date=''; m.saved=false;
      if (m.labelWindow) { m.labelWindow.close(); m.labelWindow=null; }
      m.marker.setIcon({ url: makePinSVG('#007bff'), scaledSize: new google.maps.Size(36,36) });
    });
    saveState();
    renderHistory();
    const offcanvasEl = document.getElementById('mobileHistory');
    try {
      const offcanvas = bootstrap.Offcanvas.getInstance(offcanvasEl);
      offcanvas && offcanvas.hide();
    } catch (e) {}
  });

  // mobile history open
  document.getElementById('openHistoryMobile').addEventListener('click', () => {
    const offcanvasEl = document.getElementById('mobileHistory');
    const offcanvas = new bootstrap.Offcanvas(offcanvasEl);
    offcanvas.show();
  });
}

/* Expose initMap for Google callback */
window.initMap = initMap;

/* When page loads, ensure config exists */
document.addEventListener('DOMContentLoaded', () => {
  // if config.js didn't inject key correctly show a warning in console
  if (!(window && window.__MAPS_API_KEY)) {
    console.warn('Warning: window.__MAPS_API_KEY is not defined. Add GOOGLE_MAPS_API_KEY env in Vercel or create public/config.js for local dev.');
  }

  // no-op; map will be created by Google callback initMap
});

let map;
let drawingMode = false;
let eraseMode = false;
let currentColor = "#ff0000"; // Default red
let currentSize = 5;
let drawnPolylines = [];
let currentPath = [];
let activePolyline = null;
let drawingListener = null;

// ===== INIT MAP =====
function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 14.5995, lng: 120.9842 }, // Manila
    zoom: 20,
    mapTypeId: "satellite",
    tilt: 0,
    gestureHandling: "greedy", // Allow scroll zoom without Ctrl
    mapId: "lg6map-draw",
  });

  // Load KML overlay
  const kmlLayer = new google.maps.KmlLayer({
    url: "https://raw.githubusercontent.com/kervzcalub1/lg6map/main/kml/Untitled%20project.kml",
    map: map,
    preserveViewport: true,
  });

  setupToolbar();
}

// ===== TOOLBAR SETUP =====
function setupToolbar() {
  const btnDrawToggle = document.getElementById("btnDrawToggle");
  const tbColor = document.getElementById("tbColor");
  const tbSize = document.getElementById("tbSize");
  const btnUndo = document.getElementById("btnUndo");
  const btnEraseMode = document.getElementById("btnEraseMode");
  const btnEraseAll = document.getElementById("btnEraseAll");
  const btnSaveDraw = document.getElementById("btnSaveDraw");

  // Initialize visibility
  showDrawingTools(false);

  // Draw toggle
  btnDrawToggle.addEventListener("click", () => {
    drawingMode = !drawingMode;
    eraseMode = false;
    updateToolbarState();
  });

  // Color picker
  tbColor.addEventListener("change", (e) => {
    currentColor = e.target.value;
  });

  // Size picker
  tbSize.addEventListener("change", (e) => {
    currentSize = parseInt(e.target.value);
  });

  // Undo
  btnUndo.addEventListener("click", () => {
    if (drawnPolylines.length > 0) {
      const last = drawnPolylines.pop();
      last.setMap(null);
    }
  });

  // Erase Mode
  btnEraseMode.addEventListener("click", () => {
    eraseMode = !eraseMode;
    btnEraseMode.classList.toggle("active", eraseMode);
    btnEraseMode.title = eraseMode ? "Click map lines to erase" : "Erase manually";
  });

  // Erase All
  btnEraseAll.addEventListener("click", () => {
    if (confirm("Are you sure you want to erase all drawings?")) {
      clearAllDrawings();
      drawingMode = false;
      eraseMode = false;
      updateToolbarState();
    }
  });

  // Save Draw (future use)
  btnSaveDraw.addEventListener("click", () => {
    alert("Save function coming soon!");
  });

  // Initialize toolbar UI
  updateToolbarState();
}

// ===== UPDATE TOOLBAR STATE =====
function updateToolbarState() {
  const btnDrawToggle = document.getElementById("btnDrawToggle");

  if (drawingMode) {
    btnDrawToggle.textContent = "🛑 Stop Drawing";
    btnDrawToggle.title = "Exit drawing mode";
    showDrawingTools(true);
    enableDrawing();
  } else {
    btnDrawToggle.textContent = "✏️ Draw";
    btnDrawToggle.title = "Start drawing mode";
    showDrawingTools(false);
    disableDrawing();
  }
}

// ===== SHOW / HIDE TOOLBAR TOOLS =====
function showDrawingTools(show) {
  const toolbar = document.getElementById("topToolbar");
  const children = Array.from(toolbar.children).filter(
    (el) => el.id !== "btnDrawToggle"
  );

  children.forEach((child) => {
    child.style.display = show ? "inline-flex" : "none";
  });
}

// ===== ENABLE DRAWING =====
function enableDrawing() {
  disableDrawing(); // Remove any previous listener

  drawingListener = map.addListener("click", (e) => {
    if (eraseMode) {
      eraseAtPoint(e.latLng);
      return;
    }

    if (!activePolyline) {
      activePolyline = new google.maps.Polyline({
        map: map,
        path: [],
        strokeColor: currentColor,
        strokeOpacity: 1.0,
        strokeWeight: currentSize,
      });
      drawnPolylines.push(activePolyline);
    }

    const path = activePolyline.getPath();
    path.push(e.latLng);
  });

  // Stop drawing when user double clicks
  map.addListener("dblclick", () => {
    activePolyline = null;
  });
}

// ===== DISABLE DRAWING =====
function disableDrawing() {
  if (drawingListener) {
    google.maps.event.removeListener(drawingListener);
    drawingListener = null;
  }
  activePolyline = null;
}

// ===== ERASE FUNCTIONS =====
function eraseAtPoint(latLng) {
  const eraseThreshold = 0.0001;
  for (let i = drawnPolylines.length - 1; i >= 0; i--) {
    const poly = drawnPolylines[i];
    const path = poly.getPath().getArray();
    for (let p of path) {
      const dist = google.maps.geometry.spherical.computeDistanceBetween(
        latLng,
        p
      );
      if (dist < 10) {
        poly.setMap(null);
        drawnPolylines.splice(i, 1);
        return;
      }
    }
  }
}

function clearAllDrawings() {
  drawnPolylines.forEach((poly) => poly.setMap(null));
  drawnPolylines = [];
  activePolyline = null;
}

// ===== SAVE DRAW (placeholder) =====
function saveDrawings() {
  alert("Saving drawings is not implemented yet!");
}

// Expose globally
window.initMap = initMap;

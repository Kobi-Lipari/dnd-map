const mapWidth = 8192;
const mapHeight = 5966;

const rows = 7;
const cols = 7;
const pieceWidth = mapWidth / cols;
const pieceHeight = mapHeight / rows;
const overlap = 1;

const usedCodes = new Set();
const SAVE_KEY = "_save_v2";

const imageUrls = [
  /* G1 */ "https://i.imgur.com/kecSCl7.png",
  /* G2 */ "https://i.imgur.com/4p7CSvu.png",
  /* G3 */ "https://i.imgur.com/qJRiopu.png",
  /* G4 */ "https://i.imgur.com/FGaeVDP.png",
  /* G5 */ "https://i.imgur.com/yXfneGu.png",
  /* G6 */ "https://i.imgur.com/btGHWGI.png",
  /* G7 */ "https://i.imgur.com/yXhFlRh.png",

  /* F1 */ "https://i.imgur.com/8JPrZgf.png",
  /* F2 */ "https://i.imgur.com/HvpDNtM.jpeg",
  /* F3 */ "https://i.imgur.com/9oX4cKv.png",
  /* F4 */ "https://i.imgur.com/MP9g6MS.png",
  /* F5 */ "https://i.imgur.com/slb03iz.png",
  /* F6 */ "https://i.imgur.com/AORPOKP.png",
  /* F7 */ "https://i.imgur.com/sN4XGl3.png",

  /* E1 */ "https://i.imgur.com/6n8hCUc.png",
  /* E2 */ "https://i.imgur.com/cvsnprm.png",
  /* E3 */ "https://i.imgur.com/Qg8rWT2.jpeg",
  /* E4 */ "https://i.imgur.com/bb55c7u.png",
  /* E5 */ "https://i.imgur.com/YDq6Pf4.jpeg",
  /* E6 */ "https://i.imgur.com/3zzg0EQ.png",
  /* E7 */ "https://i.imgur.com/THeS9GE.png",

  /* D1 */ "https://i.imgur.com/cpYiRpJ.png",
  /* D2 */ "https://i.imgur.com/guuQxWy.jpeg",
  /* D3 */ "https://i.imgur.com/ptIUQis.jpeg",
  /* D4 */ "https://i.imgur.com/pg1Z97L.jpeg",
  /* D5 */ "https://i.imgur.com/bzees9M.jpeg",
  /* D6 */ "https://i.imgur.com/5XdYVjH.png",
  /* D7 */ "https://i.imgur.com/sLsDwls.png",

  /* C1 */ "https://i.imgur.com/8dQpJkV.png",
  /* C2 */ "https://i.imgur.com/onHmbki.png",
  /* C3 */ "https://i.imgur.com/x5GHp65.png",
  /* C4 */ "https://i.imgur.com/km42GBZ.jpeg",
  /* C5 */ "https://i.imgur.com/9k246mc.jpeg",
  /* C6 */ "https://i.imgur.com/dMlm8We.jpeg",
  /* C7 */ "https://i.imgur.com/V1pnCBz.png",

  /* B1 */ "https://i.imgur.com/rTuUzIA.png",
  /* B2 */ "https://i.imgur.com/3kdzTjJ.png",
  /* B3 */ "https://i.imgur.com/DnYIJwk.png",
  /* B4 */ "https://i.imgur.com/E5IPyDp.jpeg",
  /* B5 */ "https://i.imgur.com/Js8q9Zd.jpeg",
  /* B6 */ "https://i.imgur.com/NZ2S3OQ.png",
  /* B7 */ "https://i.imgur.com/LD9w4VK.png",

  /* A1 */ "https://i.imgur.com/vyXpGZc.png",
  /* A2 */ "https://i.imgur.com/8JLQnpB.png",
  /* A3 */ "https://i.imgur.com/vhp2Ars.png",
  /* A4 */ "https://i.imgur.com/IUEdzm6.png",
  /* A5 */ "https://i.imgur.com/6VahqC4.png",
  /* A6 */ "https://i.imgur.com/HK3wOPN.png",
  /* A7 */ "https://i.imgur.com/uwexvkC.png"
];

// ---------- MAP ----------
const map = L.map("map", {
  crs: L.CRS.Simple,
  minZoom: -2,
  maxZoom: 3,
  zoomSnap: 1,
  zoomDelta: 1,
  fadeAnimation: false,
  zoomAnimation: false,
  markerZoomAnimation: false,
  doubleClickZoom: false,
  zoomControl: false,
  attributionControl: false,
  closePopupOnClick: false
});

const bounds = [[0, 0], [5966, 8192]];

map.fitBounds(bounds);

map.createPane("tiles");
map.getPane("tiles").style.zIndex = 200;

map.createPane("fog");
map.getPane("fog").style.zIndex = 650;
map.getPane("fog").style.pointerEvents = "none";

const regions = {};
const regionState = {};
const regionScenes = {};
const sceneMarkers = {};
const sceneData = {};
const lockedSceneState = {};

const fogClip = document.getElementById("fog-clip");
const mapWrapper = document.getElementById("map-wrapper");

function getSingleRing(latlngs) {
  if (!Array.isArray(latlngs) || latlngs.length === 0) return [];
  return Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
}

function updateFogClipPath() {
  if (!fogClip) return;

  fogClip.innerHTML = "";

  Object.entries(regions).forEach(([regionName, regionLayer]) => {
    const level = regionState[regionName];
    if (level === 1) return;

    const latlngs = getSingleRing(regionLayer.getLatLngs());
    if (!latlngs.length) return;

    const points = latlngs
      .map((latlng) => `${latlng.lng},${latlng.lat}`)
      .join(" ");

    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    poly.setAttribute("points", points);
    fogClip.appendChild(poly);
  });
}

function reapplyAllFogPatterns() {
  Object.values(regions).forEach((region) => applyFogPattern(region));
}

map.on("zoomend moveend viewreset", reapplyAllFogPatterns);

const fogRenderer = L.svg({ padding: 2 });

for (let row = 0; row < rows; row++) {
  for (let col = 0; col < cols; col++) {
    const index = row * cols + col;
    const url = imageUrls[index];

    const y1 = row * pieceHeight - (row > 0 ? overlap : 0);
    const y2 = (row + 1) * pieceHeight + (row < rows - 1 ? overlap : 0);
    const x1 = col * pieceWidth - (col > 0 ? overlap : 0);
    const x2 = (col + 1) * pieceWidth + (col < cols - 1 ? overlap : 0);

    L.imageOverlay(url, [[y1, x1], [y2, x2]], {
      pane: "tiles",
      interactive: false
    }).addTo(map);
  }
}

const cloudImages = [
  "https://i.imgur.com/TW6aVCA.png",
  "https://i.imgur.com/DX5176n.png",
  "https://i.imgur.com/WnfN1N5.png",
  "https://i.imgur.com/kdSoftz.png",
  "https://i.imgur.com/5KgMzdZ.png",
  "https://i.imgur.com/AMb9qxM.png"
];

const fogPane = map.getPane("fog");

const fogContainer = L.DomUtil.create("div", "", fogPane);
fogContainer.id = "fog-back-container";

const sheet1 = L.DomUtil.create("div", "fog-sheet", fogContainer);
const sheet2 = L.DomUtil.create("div", "fog-sheet", fogContainer);

const container = fogContainer;

const fogFront = L.DomUtil.create("div", "", fogPane);
fogFront.id = "fog-front";

const CLOUD_WIDTH = 200;
const CLOUD_HEIGHT = 200;
const COL_STEP = 145;
const ROW_STEP = 145;

let sheetHeight = 0;

function randomCloud() {
  return cloudImages[Math.floor(Math.random() * cloudImages.length)];
}

function randomOrientation() {
  const rotations = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85];
  const flipX = Math.random() < 0.5 ? 1 : -1;
  const flipY = Math.random() < 0.5 ? 1 : -1;
  const angle = rotations[Math.floor(Math.random() * rotations.length)];

  return `rotate(${angle}deg) scale(${flipX}, ${flipY})`;
}

function positionFog() {
  const topLeft = map.latLngToLayerPoint([0, 0]);

  fogContainer.style.left = `${topLeft.x}px`;
  fogContainer.style.top = `${topLeft.y}px`;
  fogContainer.style.width = `${mapWidth}px`;
  fogContainer.style.height = `${mapHeight}px`;

  fogFront.style.left = `${topLeft.x}px`;
  fogFront.style.top = `${topLeft.y}px`;
  fogFront.style.width = `${mapWidth}px`;
  fogFront.style.height = `${mapHeight}px`;
}

map.on("move zoom viewreset", positionFog);
positionFog();

function buildFogSheet(sheet) {
  sheet.innerHTML = "";

  const containerWidth = mapWidth;
  const containerHeight = mapHeight;

  const cloud_cols = Math.ceil(containerWidth / COL_STEP) + 4;
  const cloud_rows = Math.ceil(containerHeight / ROW_STEP) + 4;

  sheetHeight = cloud_rows * ROW_STEP;
  sheet.style.height = `${sheetHeight}px`;

  for (let r = 0; r < cloud_rows; r++) {
    for (let c = 0; c < cloud_cols; c++) {
      const img = document.createElement("img");
      img.className = "fog-cloud";
      img.src = randomCloud();
      img.alt = "";

      const offsetX = r % 2 === 1 ? -(COL_STEP / 2) : 0;

      img.style.left = `${c * COL_STEP + offsetX}px`;
      img.style.top = `${r * ROW_STEP}px`;
      img.style.transform = randomOrientation();

      sheet.appendChild(img);
    }
  }
}

function buildFogSystem() {
  buildFogSheet(sheet1);
  buildFogSheet(sheet2);

  sheet1._y = 0;
  sheet2._y = -sheetHeight;

  sheet1.style.transform = `translateY(${sheet1._y}px)`;
  sheet2.style.transform = `translateY(${sheet2._y}px)`;
}

buildFogSystem();

const driftSpeed = 0.06;

function animateCloudSheet() {
  sheet1._y += driftSpeed;
  sheet2._y += driftSpeed;

  if (sheet1._y >= sheetHeight) {
    sheet1._y = sheet2._y - sheetHeight;
    buildFogSheet(sheet1);
  }

  if (sheet2._y >= sheetHeight) {
    sheet2._y = sheet1._y - sheetHeight;
    buildFogSheet(sheet2);
  }

  sheet1.style.transform = `translateY(${sheet1._y}px)`;
  sheet2.style.transform = `translateY(${sheet2._y}px)`;

  requestAnimationFrame(animateCloudSheet);
}

function animateRegionFog(region, fromOpacity, toOpacity, duration = 500) {
  const start = performance.now();

  function step(now) {
    const progress = Math.min((now - start) / duration, 1);

    const eased =
      progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    const currentOpacity = fromOpacity + (toOpacity - fromOpacity) * eased;

    region.setStyle({
      fillOpacity: currentOpacity
    });

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

animateCloudSheet();
window.addEventListener("resize", buildFogSystem);

// ---------- FOG / REGIONS / SCENES ----------
const fogLevels = {
  3: 0.85, // never visited / no info
  2: 0.50, // mapped / informed
  1: 0.00  // present
};

const sceneIcon = L.icon({
  iconUrl: "icons/vista-marker.png",
  iconSize: [36, 44],
  iconAnchor: [18, 44],
  popupAnchor: [0, -36]
});

const lockedSceneIcon = L.icon({
  iconUrl: "icons/vista-marker-red.png",
  iconSize: [36, 44],
  iconAnchor: [18, 44],
  popupAnchor: [0, -36]
});

const fogStyle = {
  renderer: fogRenderer,
  pane: "fog",
  stroke: false,
  fillOpacity: 0,
  interactive: false
};

function applyFogPattern(layer) {
  if (!layer || !layer._path) return;
  layer._path.setAttribute("fill", "transparent");
  layer._path.setAttribute("stroke", "none");
}

function makeRegion(name, coords) {
  const polygon = L.polygon(coords, fogStyle).addTo(map);

  function waitForPath() {
    if (polygon._path) {
      applyFogPattern(polygon);
    } else {
      requestAnimationFrame(waitForPath);
    }
  }

  waitForPath();

  regions[name] = polygon;
  regionState[name] = 3;
  regionScenes[name] = [];
}

function addScene(scene) {
  const isLocked = !!scene.passwordLocked;

  const marker = L.marker(scene.coords, {
    icon: isLocked ? lockedSceneIcon : sceneIcon
  });

  sceneData[scene.id] = scene;
  sceneMarkers[scene.id] = marker;
  lockedSceneState[scene.id] = !!scene.passwordLocked;

  if (!regionScenes[scene.region]) {
    regionScenes[scene.region] = [];
  }

  regionScenes[scene.region].push(scene.id);

  marker.bindPopup(buildScenePopup(scene));

  marker.on("click", function (e) {
    L.DomEvent.stopPropagation(e);
    marker.setPopupContent(buildScenePopup(scene));
    marker.openPopup();
  });

  marker.on("dblclick", function (e) {
    L.DomEvent.stopPropagation(e);
    marker.setPopupContent(buildVariantPopup(scene));
    marker.openPopup();
  });
}

function buildScenePopup(scene) {
  const isLocked = !!lockedSceneState[scene.id];
  const hintText = scene.lockHint
    ? `<p style="margin:0 0 10px 0; color:#d66;"><em>${scene.lockHint}</em></p>`
    : "";

  const linkHtml = isLocked
    ? `<span style="
        display:inline-block;
        padding:8px 10px;
        background:#3a1f1f;
        color:#f1c0c0;
        border:1px solid rgba(255,120,120,0.35);
        border-radius:6px;
        cursor:not-allowed;
        opacity:0.85;
      ">Locked</span>`
    : `<a href="${scene.url}" target="_blank" style="
        display:inline-block;
        padding:8px 10px;
        background:#2a241a;
        color:#f3ead5;
        border:1px solid rgba(232,220,192,0.2);
        border-radius:6px;
        text-decoration:none;
      ">Open scene</a>`;

  return `
    <div style="min-width:240px;">
      <h3 style="margin:0 0 8px 0;">${scene.name}</h3>
      <p style="margin:0 0 10px 0;">${scene.description}</p>
      ${isLocked ? hintText : ""}
      ${linkHtml}
    </div>
  `;
}

function buildVariantPopup(scene) {
  const isLocked = !!lockedSceneState[scene.id];

  if (isLocked) {
    return `
      <div style="min-width:240px;">
        <h3 style="margin:0 0 8px 0;">${scene.name}</h3>
        <p style="margin:0 0 10px 0;">This scene is still locked.</p>
        ${
          scene.lockHint
            ? `<p style="margin:0 0 10px 0; color:#d66;"><em>${scene.lockHint}</em></p>`
            : ""
        }
        <span style="
          display:inline-block;
          padding:8px 10px;
          background:#3a1f1f;
          color:#f1c0c0;
          border:1px solid rgba(255,120,120,0.35);
          border-radius:6px;
          cursor:not-allowed;
          opacity:0.85;
        ">Variants locked</span>
      </div>
    `;
  }

  const variants = scene.variants || { Default: scene.url };

  const links = Object.entries(variants)
    .map(([label, url]) => {
      return `
        <div style="margin:8px 0;">
          <a href="${url}" target="_blank" style="
            display:block;
            padding:8px 10px;
            background:#2a241a;
            color:#f3ead5;
            text-decoration:none;
            border-radius:6px;
            border:1px solid rgba(232,220,192,0.2);
          ">${label}</a>
        </div>
      `;
    })
    .join("");

  return `
    <div style="min-width:240px;">
      <h3 style="margin:0 0 8px 0;">${scene.name} Variants</h3>
      <p style="margin:0 0 10px 0;">Choose a scene version:</p>
      ${links}
    </div>
  `;
}

function setSceneVisibility(sceneId, visible) {
  const marker = sceneMarkers[sceneId];
  if (!marker) return;

  if (visible) {
    if (!map.hasLayer(marker)) {
      marker.addTo(map);
    }
  } else {
    marker.closePopup();
    if (map.hasLayer(marker)) {
      map.removeLayer(marker);
    }
  }
}

function updateRegionScenes(regionName) {
  const level = regionState[regionName];
  const ids = regionScenes[regionName] || [];

  ids.forEach((id) => {
    setSceneVisibility(id, level === 1);
  });
}

function setRegionState(regionName, level, animate = true, shouldSave = true) {
  const region = regions[regionName];
  if (!region) return;

  const currentLevel = regionState[regionName] || 3;
  const fromOpacity = fogLevels[currentLevel];
  const toOpacity = fogLevels[level];

  regionState[regionName] = level;

  if (animate) {
    animateRegionFog(region, fromOpacity, toOpacity, 500);
  } else {
    region.setStyle({ fillOpacity: toOpacity });
  }

  updateRegionScenes(regionName);
  updateFogClipPath();

  if (shouldSave) {
    saveMapState();
  }
}

function unlockScene(sceneId) {
  if (!(sceneId in lockedSceneState)) return false;
  if (lockedSceneState[sceneId] === false) return false;

  lockedSceneState[sceneId] = false;
  sceneMarkers[sceneId].setIcon(sceneIcon);

  for (const regionName in regionScenes) {
    if (regionScenes[regionName].includes(sceneId)) {
      if (regionState[regionName] === 1) {
        setSceneVisibility(sceneId, true);
      }
      break;
    }
  }

  saveMapState();
  return true;
}

// ---------- SAVE / LOAD ----------
function saveMapState() {
  const saveData = {
    regionState,
    lockedSceneState,
    usedCodes: Array.from(usedCodes)
  };

  localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
}

function loadMapState() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to parse save data:", err);
    return null;
  }
}

function applyLoadedState(saveData) {
  if (!saveData) return;

  if (saveData.lockedSceneState) {
    for (const sceneId in saveData.lockedSceneState) {
      if (sceneId in lockedSceneState) {
        lockedSceneState[sceneId] = saveData.lockedSceneState[sceneId];

        if (sceneMarkers[sceneId]) {
          sceneMarkers[sceneId].setIcon(
            lockedSceneState[sceneId] ? lockedSceneIcon : sceneIcon
          );
        }
      }
    }
  }

  if (Array.isArray(saveData.usedCodes)) {
    saveData.usedCodes.forEach((code) => usedCodes.add(code));
  }

  if (saveData.regionState) {
    for (const regionName in saveData.regionState) {
      if (regionName in regions) {
        setRegionState(regionName, saveData.regionState[regionName], false, false);
      }
    }
  }
}

// ---------- REGIONS ----------
makeRegion("eastern_forest", [
  [2200, 4500],
  [2000, 6000],
  [2600, 7000],
  [3400, 6800],
  [3600, 5200],
  [3000, 4200]
]);

makeRegion("desert", [
  [3200, 4000],
  [3500, 6500],
  [4500, 7500],
  [5500, 6000],
  [5200, 4200],
  [4000, 3500]
]);

// ---------- SCENES ----------
addScene({
  id: "bridge_town",
  region: "eastern_forest",
  name: "Bridge Town",
  coords: [2850, 5600],
  description: "A narrow crossing settlement with old timber walkways and suspicious tollkeepers.",
  lockHint: "The old woman in Bridge Town mentioned that the path opens for those who know the hut’s true name.",
  url: "https://example.com/bridge-town",
  passwordLocked: true,
  variants: {
    Default: "https://example.com/bridge-town",
    Rain: "https://example.com/bridge-town-rain",
    Snow: "https://example.com/bridge-town-snow"
  }
});

addScene({
  id: "bridge_town2",
  region: "eastern_forest",
  name: "Bridge Town2",
  coords: [1850, 5600],
  description: "A narrow crossing settlement with old timber walkways and suspicious tollkeepers.",
  url: "scenes/CityMarketplace_Original_Day_Crowd.jpeg",
  passwordLocked: false,
  variants: {
    Default: "scenes/CityMarketplace_Original_Day_Crowd.jpeg",
    Rain: "scenes/CityMarketplace_Rain.jpeg",
    Snow: "scenes/CityMarketplace_Winter.jpeg",
    Fog: "scenes/CityMarketplace_Fog.jpeg",
    Massacre: "scenes/CityMarketplace_Massacre.jpeg",
    DayEmpty: "scenes/CityMarketplace_Original_Day_Empty.jpeg",
    Sunset: "scenes/CityMarketplace_Sunset_Crowd.jpeg",
    SunsetEmpty: "scenes/CityMarketplace_Sunset_Empty.jpeg",
    Night: "scenes/CityMarketplace_Original_Night.jpeg"
  }
});

// default startup state
setRegionState("eastern_forest", 3, false, false);
setRegionState("desert", 3, false, false);

// apply saved state after regions/scenes exist
const loadedSave = loadMapState();
applyLoadedState(loadedSave);

map.on("zoom move resize viewreset zoomend moveend", updateFogClipPath);
updateFogClipPath();

// ---------- ARCHIVIST CODES ----------
const archivistCodes = {
  EASTERNFORESTGREEN: {
    message: "Riverlands survey restored.",
    action: {
      type: "regionLevel",
      region: "eastern_forest",
      level: 2
    }
  },
  DESERTTAN: {
    message: "Firelands border records recovered.",
    action: {
      type: "regionLevel",
      region: "desert",
      level: 2
    }
  },
  WITCHHUTRED: {
    message: "Hidden Witch's Hut unlocked.",
    action: {
      type: "sceneUnlock",
      sceneId: "bridge_town"
    }
  }
};

function runArchivistAction(action) {
  if (!action) return false;

  if (action.type === "regionLevel") {
    const current = regionState[action.region];
    if (current > action.level) {
      setRegionState(action.region, action.level);
      return true;
    }
    return false;
  }

  if (action.type === "sceneUnlock") {
    return unlockScene(action.sceneId);
  }

  if (action.type === "multi") {
    let changed = false;
    action.actions.forEach((subAction) => {
      if (runArchivistAction(subAction)) {
        changed = true;
      }
    });
    return changed;
  }

  return false;
}

// ---------- ARCHIVIST CONSOLE ----------
const archivistConsole = document.getElementById("archivist-console");
const archivistToggle = document.getElementById("archivist-toggle");
const archivistInput = document.getElementById("archivist-code-input");
const archivistSubmit = document.getElementById("archivist-submit");
const archivistStatus = document.getElementById("archivist-status");
const archivistLog = document.getElementById("archivist-log");

archivistInput.addEventListener("input", function () {
  this.value = this.value.toUpperCase();
});

archivistToggle.addEventListener("click", function () {
  archivistConsole.classList.toggle("collapsed");
  archivistToggle.textContent = archivistConsole.classList.contains("collapsed") ? "+" : "−";
});

function normalizeCode(code) {
  return code.trim().toUpperCase();
}

function setArchivistStatus(message) {
  archivistStatus.textContent = message;
}

function addArchivistLog(message) {
  const li = document.createElement("li");
  li.textContent = message;
  archivistLog.prepend(li);
}

function submitArchivistCode() {
  const code = normalizeCode(archivistInput.value);

  if (!code) {
    setArchivistStatus("Enter a code first.");
    return;
  }

  const entry = archivistCodes[code];

  if (!entry) {
    setArchivistStatus(`No archive match found for "${code}".`);
    return;
  }

  if (usedCodes.has(code)) {
    setArchivistStatus(`"${code}" has already been recorded.`);
    return;
  }

  const changed = runArchivistAction(entry.action);

  if (changed) {
    usedCodes.add(code);
    setArchivistStatus(entry.message);
    addArchivistLog(`${code} — ${entry.message}`);
    archivistInput.value = "";
    saveMapState();
  } else {
    setArchivistStatus(`"${code}" provided no new information.`);
  }
}

archivistSubmit.addEventListener("click", submitArchivistCode);
archivistInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    submitArchivistCode();
  }
});

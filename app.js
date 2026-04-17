// app.js – main orchestrator, state & UI
import { initMap, getMapLocations, updateMapLocations } from './map/map.js';

// ---------- STATE ----------
let state = {
  tracks: [],
  character: {
    name: 'Ironheart',
    image: null,
    stats: { edge: 2, iron: 2, heart: 2, wit: 1, shadow: 1 },
    health: 5, spirit: 5, supply: 5,
    momentum: 2,
    xp: 0,
    background: '',
    vows: [] // array of track IDs
  },
  npcs: [],
  locations: [] // managed by map module mostly, but we sync
};

// Helper: load/save
const STORAGE_KEY = 'ironsworn_app';
function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const loaded = JSON.parse(saved);
      state = { ...state, ...loaded };
      // ensure defaults
      if (!state.character.vows) state.character.vows = [];
    } catch(e) { console.warn('load error', e); }
  }
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Track helpers
function getTrackById(id) { return state.tracks.find(t => t.id === id); }
function generateId() { return Date.now() + '-' + Math.random().toString(36); }

// Progress mark logic based on rank
function markProgress(track) {
  const rank = track.rank;
  let ticksToAdd = 0;
  let progressBoxes = 0;
  switch(rank) {
    case 'troublesome': progressBoxes = 3; ticksToAdd = 3 * 3; break; // 3 progress, 3 ticks each
    case 'dangerous': progressBoxes = 2; ticksToAdd = 2 * 4; break;    // 2 progress (full boxes)
    case 'formidable': progressBoxes = 1; ticksToAdd = 4; break;       // 1 progress (full)
    case 'extreme': ticksToAdd = 2; break;                            // 2 ticks total
    case 'epic': ticksToAdd = 1; break;
    default: return;
  }
  // Apply ticks
  let remaining = ticksToAdd;
  for (let i = 0; i < track.boxes.length && remaining > 0; i++) {
    const space = 4 - track.boxes[i];
    const add = Math.min(space, remaining);
    track.boxes[i] += add;
    remaining -= add;
  }
  // If using progressBoxes (troublesome/dangerous/formidable) and we didn't fill enough, ensure full boxes.
  if (progressBoxes > 0) {
    for (let i = 0; i < progressBoxes && i < track.boxes.length; i++) {
      track.boxes[i] = Math.min(4, track.boxes[i] + (4 - track.boxes[i]));
    }
  }
}

// ---------- RENDER ----------
function renderAll() {
  renderTracks();
  renderCharacter();
  renderVows();
  renderLocationsList();
  renderNpcsList();
  populateVowSelects();
}

// Progress Tracks
function renderTracks() {
  const container = document.getElementById('tracksList');
  if (!container) return;
  container.innerHTML = state.tracks.map(track => {
    const boxesHtml = track.boxes.map((ticks, idx) => `
      <div class="progress-box" data-track-id="${track.id}" data-box-index="${idx}">
        <div>${ticks}/4</div>
        <div class="ticks">${'⬤'.repeat(ticks)}${'◯'.repeat(4-ticks)}</div>
      </div>
    `).join('');
    return `<div class="track-card" data-track-id="${track.id}">
      <div class="track-header">
        <span class="track-name">${track.name}</span>
        <span class="track-rank">${track.rank}</span>
        <button class="btn small edit-track" data-id="${track.id}">✎</button>
      </div>
      <div class="track-boxes">${boxesHtml}</div>
      <div class="track-actions">
        <button class="btn small mark-progress" data-id="${track.id}">📈 Mark (${track.rank})</button>
        <button class="btn small reset-track" data-id="${track.id}">⟲ Reset</button>
      </div>
    </div>`;
  }).join('') || '<p>No tracks yet. Create one.</p>';
  
  // Attach box click handlers
  document.querySelectorAll('.progress-box').forEach(box => {
    box.addEventListener('click', (e) => {
      const trackId = box.dataset.trackId;
      const idx = parseInt(box.dataset.boxIndex);
      const track = getTrackById(trackId);
      if (!track) return;
      // cycle ticks 0-4
      track.boxes[idx] = (track.boxes[idx] + 1) % 5;
      saveState(); renderTracks();
    });
  });
  document.querySelectorAll('.mark-progress').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.dataset.id;
      const track = getTrackById(id);
      if (track) { markProgress(track); saveState(); renderTracks(); }
    });
  });
  document.querySelectorAll('.reset-track').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.dataset.id;
      const track = getTrackById(id);
      if (track) { track.boxes = new Array(10).fill(0); saveState(); renderTracks(); }
    });
  });
  document.querySelectorAll('.edit-track').forEach(btn => {
    btn.addEventListener('click', () => openTrackModal(btn.dataset.id));
  });
}

// Character rendering
function renderCharacter() {
  document.getElementById('charName').value = state.character.name;
  document.getElementById('statEdge').value = state.character.stats.edge;
  document.getElementById('statIron').value = state.character.stats.iron;
  document.getElementById('statHeart').value = state.character.stats.heart;
  document.getElementById('statWit').value = state.character.stats.wit;
  document.getElementById('statShadow').value = state.character.stats.shadow;
  document.getElementById('healthVal').textContent = state.character.health;
  document.getElementById('spiritVal').textContent = state.character.spirit;
  document.getElementById('supplyVal').textContent = state.character.supply;
  document.getElementById('momentumVal').textContent = state.character.momentum;
  document.getElementById('xpVal').textContent = state.character.xp;
  document.getElementById('charBackground').value = state.character.background || '';
  if (state.character.image) {
    document.getElementById('charImage').src = state.character.image;
  }
}

function renderVows() {
  const container = document.getElementById('vowsList');
  const vows = state.character.vows.map(id => getTrackById(id)).filter(t => t);
  container.innerHTML = vows.map(t => `<div class="track-card compact"><strong>${t.name}</strong> ${t.rank} 
    <button class="btn small vow-remove" data-id="${t.id}">✕</button></div>`).join('');
  document.querySelectorAll('.vow-remove').forEach(b => {
    b.addEventListener('click', () => {
      state.character.vows = state.character.vows.filter(id => id !== b.dataset.id);
      saveState(); renderVows();
    });
  });
}

// Locations list (synced with map)
function renderLocationsList() {
  const locs = getMapLocations();
  const container = document.getElementById('locationsList');
  container.innerHTML = locs.map(loc => `
    <div class="location-card" data-loc-id="${loc.id}">
      <h4>${loc.name || 'Unnamed'}</h4>
      <p>${loc.notes || ''}</p>
      <button class="btn small edit-location" data-id="${loc.id}">Edit</button>
    </div>
  `).join('');
  document.querySelectorAll('.edit-location').forEach(btn => {
    btn.addEventListener('click', () => openLocationEdit(btn.dataset.id));
  });
}

// NPCs
function renderNpcsList() {
  const container = document.getElementById('npcsList');
  container.innerHTML = state.npcs.map(npc => `
    <div class="npc-card" data-npc-id="${npc.id}">
      <strong>${npc.name}</strong> ❤️${npc.health} ✨${npc.spirit} 🎒${npc.supply}
      <button class="btn small edit-npc" data-id="${npc.id}">Edit</button>
    </div>
  `).join('');
  document.querySelectorAll('.edit-npc').forEach(btn => {
    btn.addEventListener('click', () => openNpcModal(btn.dataset.id));
  });
}

function populateVowSelects() {
  const select1 = document.getElementById('npcVowSelect');
  const select2 = document.getElementById('npcBondSelect');
  const options = state.tracks.map(t => `<option value="${t.id}">${t.name} (${t.rank})</option>`).join('');
  if(select1) select1.innerHTML = '<option value="">None</option>' + options;
  if(select2) select2.innerHTML = '<option value="">None</option>' + options;
}

// Modal handlers
let editingTrackId = null;
function openTrackModal(id) {
  editingTrackId = id;
  const modal = document.getElementById('trackModal');
  const title = document.getElementById('modalTitle');
  if (id) {
    const track = getTrackById(id);
    document.getElementById('trackNameInput').value = track.name;
    document.getElementById('trackRankSelect').value = track.rank;
    title.textContent = 'Edit Track';
  } else {
    document.getElementById('trackNameInput').value = '';
    document.getElementById('trackRankSelect').value = 'dangerous';
    title.textContent = 'New Track';
  }
  modal.classList.remove('hidden');
}
document.getElementById('addTrackBtn').addEventListener('click', () => openTrackModal(null));
document.getElementById('cancelTrackModal').addEventListener('click', () => {
  document.getElementById('trackModal').classList.add('hidden');
});
document.getElementById('saveTrack').addEventListener('click', () => {
  const name = document.getElementById('trackNameInput').value.trim();
  if (!name) return;
  const rank = document.getElementById('trackRankSelect').value;
  if (editingTrackId) {
    const track = getTrackById(editingTrackId);
    track.name = name; track.rank = rank;
  } else {
    const newTrack = { id: generateId(), name, rank, boxes: new Array(10).fill(0) };
    state.tracks.push(newTrack);
  }
  saveState(); renderTracks(); populateVowSelects();
  document.getElementById('trackModal').classList.add('hidden');
});

// Character interactions
function setupCharacterEvents() {
  document.getElementById('charName').addEventListener('change', e => { state.character.name = e.target.value; saveState(); });
  ['edge','iron','heart','wit','shadow'].forEach(stat => {
    document.getElementById(`stat${stat.charAt(0).toUpperCase()+stat.slice(1)}`).addEventListener('change', e => {
      state.character.stats[stat] = parseInt(e.target.value)||0; saveState();
    });
  });
  const adjust = (target, delta) => {
    let val = state.character[target] + delta;
    val = Math.min(5, Math.max(0, val));
    state.character[target] = val; renderCharacter(); saveState();
  };
  document.querySelectorAll('.inc').forEach(b => b.addEventListener('click', () => adjust(b.dataset.target, 1)));
  document.querySelectorAll('.dec').forEach(b => b.addEventListener('click', () => adjust(b.dataset.target, -1)));
  
  document.getElementById('momentumInc').addEventListener('click', () => {
    state.character.momentum = Math.min(10, state.character.momentum+1); renderCharacter(); saveState();
  });
  document.getElementById('momentumDec').addEventListener('click', () => {
    state.character.momentum = Math.max(-6, state.character.momentum-1); renderCharacter(); saveState();
  });
  document.getElementById('momentumReset').addEventListener('click', () => {
    state.character.momentum = 2; renderCharacter(); saveState();
  });
  document.getElementById('xpInc').addEventListener('click', () => {
    state.character.xp++; renderCharacter(); saveState();
  });
  document.getElementById('charBackground').addEventListener('change', e => {
    state.character.background = e.target.value; saveState();
  });
  document.getElementById('changeImageBtn').addEventListener('click', () => {
    document.getElementById('imageUpload').click();
  });
  document.getElementById('imageUpload').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => { state.character.image = ev.target.result; renderCharacter(); saveState(); };
      reader.readAsDataURL(file);
    }
  });
  document.getElementById('addVowBtn').addEventListener('click', () => {
    // create a vow track automatically
    const vowTrack = { id: generateId(), name: 'New Vow', rank: 'dangerous', boxes: new Array(10).fill(0) };
    state.tracks.push(vowTrack);
    state.character.vows.push(vowTrack.id);
    saveState(); renderTracks(); renderVows(); populateVowSelects();
  });
}

// NPC modal
let editingNpcId = null;
function openNpcModal(id) {
  editingNpcId = id;
  const modal = document.getElementById('npcModal');
  const npc = id ? state.npcs.find(n => n.id === id) : null;
  document.getElementById('npcName').value = npc?.name || '';
  document.getElementById('npcHealth').value = npc?.health ?? 3;
  document.getElementById('npcSpirit').value = npc?.spirit ?? 3;
  document.getElementById('npcSupply').value = npc?.supply ?? 3;
  document.getElementById('npcMomentum').value = npc?.momentum ?? 0;
  document.getElementById('npcItems').value = npc?.items || '';
  document.getElementById('npcMood').value = npc?.mood || '';
  document.getElementById('npcGoal').value = npc?.goal || '';
  document.getElementById('npcVowSelect').value = npc?.ironVow || '';
  document.getElementById('npcBondSelect').value = npc?.bond || '';
  document.getElementById('npcNotes').value = npc?.notes || '';
  document.getElementById('npcModalTitle').textContent = id ? 'Edit NPC' : 'New NPC';
  document.getElementById('deleteNpcBtn').style.display = id ? 'block' : 'none';
  modal.classList.remove('hidden');
}
document.getElementById('addNpcBtn').addEventListener('click', () => openNpcModal(null));
document.getElementById('cancelNpcModal').addEventListener('click', () => {
  document.getElementById('npcModal').classList.add('hidden');
});
document.getElementById('saveNpcBtn').addEventListener('click', () => {
  const npcData = {
    id: editingNpcId || generateId(),
    name: document.getElementById('npcName').value,
    health: parseInt(document.getElementById('npcHealth').value)||3,
    spirit: parseInt(document.getElementById('npcSpirit').value)||3,
    supply: parseInt(document.getElementById('npcSupply').value)||3,
    momentum: parseInt(document.getElementById('npcMomentum').value)||0,
    items: document.getElementById('npcItems').value,
    mood: document.getElementById('npcMood').value,
    goal: document.getElementById('npcGoal').value,
    ironVow: document.getElementById('npcVowSelect').value,
    bond: document.getElementById('npcBondSelect').value,
    notes: document.getElementById('npcNotes').value
  };
  if (editingNpcId) {
    const idx = state.npcs.findIndex(n => n.id === editingNpcId);
    state.npcs[idx] = npcData;
  } else state.npcs.push(npcData);
  saveState(); renderNpcsList();
  document.getElementById('npcModal').classList.add('hidden');
});
document.getElementById('deleteNpcBtn').addEventListener('click', () => {
  if (editingNpcId) {
    state.npcs = state.npcs.filter(n => n.id !== editingNpcId);
    saveState(); renderNpcsList();
    document.getElementById('npcModal').classList.add('hidden');
  }
});

// Location edit (simple inline)
function openLocationEdit(id) {
  const locs = getMapLocations();
  const loc = locs.find(l => l.id === id);
  if (!loc) return;
  const newName = prompt('Edit location name:', loc.name);
  if (newName !== null) loc.name = newName;
  const newNotes = prompt('Edit notes:', loc.notes);
  if (newNotes !== null) loc.notes = newNotes;
  updateMapLocations(locs);
  renderLocationsList();
  saveState(); // but map module has its own storage; we'll sync
}

// Tabs
function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const panes = document.querySelectorAll('.tab-pane');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      tabs.forEach(b => b.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(tabId).classList.add('active');
      if (tabId === 'map') { setTimeout(() => initMap(), 20); }
    });
  });
}

// Initialize
async function init() {
  loadState();
  renderAll();
  setupCharacterEvents();
  initTabs();
  // sync locations from map module after load
  window.addEventListener('load', () => {
    // Map will handle its own load
  });
}

init();
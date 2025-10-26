// ==================== AUDIO SETUP ====================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Create analyzer for visualization
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 2048;
analyser.connect(audioCtx.destination);

// Audio nodes
const rainGainNode = audioCtx.createGain();
const thunderGainNode = audioCtx.createGain();
const birdsGainNode = audioCtx.createGain();
const lowpassFilterNode = audioCtx.createBiquadFilter();
const rainEQNode = audioCtx.createBiquadFilter();
const musicLowpassNode = audioCtx.createBiquadFilter();
const musicReverbNode = audioCtx.createConvolver();
const musicWetGain = audioCtx.createGain();
const musicDryGain = audioCtx.createGain();
const rainReverbNode = audioCtx.createConvolver();
const rainWetGain = audioCtx.createGain();
const rainDryGain = audioCtx.createGain();
const thunderReverbNode = audioCtx.createConvolver();
const thunderWetGain = audioCtx.createGain();
const thunderDryGain = audioCtx.createGain();

// Radio-style EQ nodes for vintage sound
const musicEQBass = audioCtx.createBiquadFilter();
const musicEQMidBass = audioCtx.createBiquadFilter();
const musicEQMid = audioCtx.createBiquadFilter();
const musicEQMidTreble = audioCtx.createBiquadFilter();
const musicEQTreble = audioCtx.createBiquadFilter();

// Configure EQ nodes
musicEQBass.type = 'lowshelf';
musicEQBass.frequency.value = 200;
musicEQBass.gain.value = 0;

musicEQMidBass.type = 'peaking';
musicEQMidBass.frequency.value = 500;
musicEQMidBass.Q.value = 1.0;
musicEQMidBass.gain.value = 0;

musicEQMid.type = 'peaking';
musicEQMid.frequency.value = 1500;
musicEQMid.Q.value = 1.0;
musicEQMid.gain.value = 0;

musicEQMidTreble.type = 'peaking';
musicEQMidTreble.frequency.value = 4000;
musicEQMidTreble.Q.value = 1.0;
musicEQMidTreble.gain.value = 0;

musicEQTreble.type = 'highshelf';
musicEQTreble.frequency.value = 8000;
musicEQTreble.gain.value = 0;

// Configure audio nodes with default values
lowpassFilterNode.type = 'lowpass';
lowpassFilterNode.frequency.value = 22050;
rainEQNode.type = 'peaking';
rainEQNode.frequency.value = 900;
rainEQNode.Q.value = 1.2;
rainEQNode.gain.value = 0;
musicLowpassNode.type = 'lowpass';
musicLowpassNode.frequency.value = 22050;

// Default volumes (will be set from sliders on page load)
rainGainNode.gain.value = 0.25;
thunderGainNode.gain.value = 0.5;
birdsGainNode.gain.value = 0;

// Audio connections
rainGainNode.connect(rainEQNode);
rainEQNode.connect(lowpassFilterNode);
// Rain reverb routing: split to wet (reverb) and dry paths BEFORE the shared lowpass
rainEQNode.connect(rainDryGain).connect(lowpassFilterNode);
rainEQNode.connect(rainReverbNode).connect(rainWetGain).connect(lowpassFilterNode);
// Final rain output goes through lowpass to analyzer and destination
lowpassFilterNode.connect(analyser);

// Thunder reverb routing: thunder has its own reverb chain, then goes through lowpass
thunderGainNode.connect(thunderDryGain).connect(lowpassFilterNode);
thunderGainNode.connect(thunderReverbNode).connect(thunderWetGain).connect(lowpassFilterNode);

birdsGainNode.connect(lowpassFilterNode);

// Sound paths
const RAIN_SOUND = 'sounds/rain/rain-sound-188158.mp3';
const BIRDS_SOUND = 'sounds/birds/birds-19624.mp3';
const MUSIC_PATH = 'sounds/music/SARAH VAUGHAN  1944-1946 (1997)(FULL ALBUM).mp3';
const THUNDER_SOUNDS = [
    'sounds/thunder/clean-thunder-69077.mp3',
    'sounds/thunder/dry-thunder-364468.mp3',
    'sounds/thunder/heavy-thunder-sound-effect-no-copyright-338980.mp3',
    'sounds/thunder/loud-thunder-sound-effect-359272.mp3',
    'sounds/thunder/scary-thunder-27407.mp3',
    'sounds/thunder/thunder-124463.mp3',
    'sounds/thunder/thunder-25689.mp3',
    'sounds/thunder/thunder-307513.mp3'
];

// State variables
let isPlaying = false;
let lastThunderIndex = -1;
let rainSources = []; // Array to hold multiple overlapping rain sources
let rainBuffer = null; // Cached rain audio buffer
let birdsSource = null;
let birdsBuffer = null;
let birdsMuted = false;
let birdsFadeInterval = null;
let thunderTimeout = null;
let defaultMusicAudio = null;
let hasStartedStormBefore = false; // Track if storm has been manually started before

// User playlist state
let userPlaylist = []; // Array of {name, url, blob}
let currentTrackIndex = -1;
let userMusicAudio = null;
let db = null; // IndexedDB database

// Weather icon element
let weatherIcon = null;

// ==================== INDEXEDDB SETUP ====================
function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('StormGenMusicDB', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains('tracks')) {
                database.createObjectStore('tracks', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

// Save track to IndexedDB
function saveTrackToDB(name, blob) {
    return new Promise((resolve, reject) => {
        if (!db) return reject('Database not initialized');
        
        const transaction = db.transaction(['tracks'], 'readwrite');
        const store = transaction.objectStore('tracks');
        const request = store.add({ name, blob });
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Load all tracks from IndexedDB
function loadTracksFromDB() {
    return new Promise((resolve, reject) => {
        if (!db) return reject('Database not initialized');
        
        const transaction = db.transaction(['tracks'], 'readonly');
        const store = transaction.objectStore('tracks');
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Delete track from IndexedDB
function deleteTrackFromDB(id) {
    return new Promise((resolve, reject) => {
        if (!db) return reject('Database not initialized');
        
        const transaction = db.transaction(['tracks'], 'readwrite');
        const store = transaction.objectStore('tracks');
        const request = store.delete(id);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Clear all tracks from IndexedDB
function clearTracksFromDB() {
    return new Promise((resolve, reject) => {
        if (!db) return reject('Database not initialized');
        
        const transaction = db.transaction(['tracks'], 'readwrite');
        const store = transaction.objectStore('tracks');
        const request = store.clear();
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Note: Music does NOT auto-play. User must click "Play" button.
// This respects browser autoplay policies and gives users full control.
// ==================== WEATHER ICON FUNCTIONS ====================
function updateWeatherIcon() {
    if (!weatherIcon) return;
    
    // If storm is not playing, always show sun icon
    if (!isPlaying) {
        weatherIcon.textContent = '☀️'; // Sunny - no storm
        return;
    }
    
    const rainVolume = parseFloat(document.getElementById('rainVolume').value);
    
    // Determine icon based on rain volume when storm is active
    if (rainVolume === 0) {
        weatherIcon.textContent = '☀️'; // Sunny - no rain
    } else if (rainVolume < 0.3) {
        weatherIcon.textContent = '⛅'; // Partly cloudy - light rain
    } else if (rainVolume < 0.7) {
        weatherIcon.textContent = '🌧️'; // Rain cloud - moderate rain
    } else {
        weatherIcon.textContent = '🌧️'; // Rain cloud - heavy rain (still just rain, no lightning)
    }
}

function showLightningIcon() {
    if (!weatherIcon) return;
    
    // Show thunder/lightning icon when thunder strikes
    weatherIcon.textContent = '⛈️'; // Thunder cloud with lightning
    
    // Add lightning animation class
    weatherIcon.classList.add('lightning');
    
    // Remove after animation completes and fade back to current rain level icon
    setTimeout(() => {
        weatherIcon.classList.remove('lightning');
        updateWeatherIcon(); // Return to appropriate rain/cloud icon (no lightning)
    }, 300);
}

function createImpulseResponse(duration, decay) {
    const sampleRate = audioCtx.sampleRate;
    const length = sampleRate * duration;
    const impulse = audioCtx.createBuffer(2, length, sampleRate);
    for (let channel = 0; channel < 2; channel++) {
        const channelData = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            // Invert decay so higher values = longer reverb
            // Lower decay (like 0.5) = steep curve = short reverb (small room)
            // Higher decay (like 4.0) = gentle curve = long reverb (large room)
            // We invert with division: 1/decay
            const invertedDecay = 1 / decay;
            channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, invertedDecay);
        }
    }
    return impulse;
}

// ==================== PRESET FUNCTIONS ====================
function applyPreset(presetName) {
    const rainVolumeSlider = document.getElementById('rainVolume');
    const thunderVolumeSlider = document.getElementById('thunderVolume');
    const lowpassFilterSlider = document.getElementById('lowpassFilter');
    const musicVolumeSlider = document.getElementById('musicVolume');
    const musicLowpassSlider = document.getElementById('musicLowpass');
    const musicRoomSizeSlider = document.getElementById('musicRoomSize');
    const musicReverbSlider = document.getElementById('musicReverb');
    const rainReverbSlider = document.getElementById('rainReverb');
    const thunderReverbSlider = document.getElementById('thunderReverb');
    
    // Resume AudioContext if needed
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    if (presetName === 'indoorcozy') {
        // Indoor Cozy: 100% rain, heavy filtering, tiny room with reverb
        rainVolumeSlider.value = 1;
        thunderVolumeSlider.value = 1;
        lowpassFilterSlider.value = 420; // Lowest - muffled sound like indoors
        musicVolumeSlider.value = 100;
        musicLowpassSlider.value = 22050; // Max - no filtering on music
        musicRoomSizeSlider.value = 0.02; // Very small room
        musicReverbSlider.value = 0.80; // Higher reverb mix
        rainReverbSlider.value = 0.50; // Rain reverb for indoor space
        thunderReverbSlider.value = 0.30; // Thunder reverb for indoor space
        
        // Do NOT auto-play music for Indoor Cozy preset
        
    } else if (presetName === 'indoor') {
        // Indoor: 100% rain, heavy filtering, medium reverb
        rainVolumeSlider.value = 1;
        thunderVolumeSlider.value = 1;
        lowpassFilterSlider.value = 420; // Lowest - muffled sound like indoors
        musicVolumeSlider.value = 100;
        musicLowpassSlider.value = 22050; // Max - no filtering on music
        musicRoomSizeSlider.value = 0.02; // Very small room
        musicReverbSlider.value = 0.60; // Higher reverb mix
        rainReverbSlider.value = 0.50; // Rain reverb for indoor space
        thunderReverbSlider.value = 0.60; // Thunder reverb for indoor space
        
        // Do NOT auto-play music for Indoor preset
        
    } else if (presetName === 'outdoor') {
        // Outdoor: 50% rain, open sound, no reverb
        rainVolumeSlider.value = 0.5;
        thunderVolumeSlider.value = 1;
        lowpassFilterSlider.value = 22050; // Max - no filtering
        musicVolumeSlider.value = 100; // Full volume
        musicLowpassSlider.value = 22050; // Max - no filtering
        musicRoomSizeSlider.value = 0.02; // Small room
        musicReverbSlider.value = 0; // No reverb
        rainReverbSlider.value = 0; // No rain reverb
        thunderReverbSlider.value = 0; // No thunder reverb
        
        // Do NOT auto-play music for Outdoor preset
    }
    
    // Trigger all input events to update audio nodes and labels
    rainVolumeSlider.dispatchEvent(new Event('input'));
    thunderVolumeSlider.dispatchEvent(new Event('input'));
    lowpassFilterSlider.dispatchEvent(new Event('input'));
    musicVolumeSlider.dispatchEvent(new Event('input'));
    musicLowpassSlider.dispatchEvent(new Event('input'));
    musicRoomSizeSlider.dispatchEvent(new Event('input'));
    musicReverbSlider.dispatchEvent(new Event('input'));
    rainReverbSlider.dispatchEvent(new Event('input'));
    thunderReverbSlider.dispatchEvent(new Event('input'));
    
    // Mark that storm has been configured (preset applied)
    hasStartedStormBefore = true;
    
    // Start storm if not already playing (don't override rain volume)
    if (!isPlaying) {
        startStorm(true); // Pass true to indicate we're starting from a preset
    }
}

// ==================== RAIN FUNCTIONS ====================
// Pre-load rain buffer for efficient playback
function loadRainBuffer() {
    fetch(RAIN_SOUND)
        .then(res => res.arrayBuffer())
        .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
        .then(audioBuffer => {
            rainBuffer = audioBuffer;
        })
        .catch(err => console.error('Rain buffer loading failed:', err));
}

function playRain() {
    stopRain();
    
    if (!rainBuffer) {
        // If buffer isn't loaded yet, load it first
        fetch(RAIN_SOUND)
            .then(res => res.arrayBuffer())
            .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
            .then(audioBuffer => {
                rainBuffer = audioBuffer;
                startRainLayer();
            })
            .catch(err => console.error('Rain audio failed:', err));
    } else {
        startRainLayer();
    }
}

function startRainLayer() {
    if (!rainBuffer || !isPlaying) return;
    
    const source = audioCtx.createBufferSource();
    source.buffer = rainBuffer;
    source.loop = false; // No loop - we'll manually overlap
    source.connect(rainGainNode);
    
    const duration = rainBuffer.duration;
    
    // Calculate random start time for next layer (between 50% and 100% of duration)
    // This creates natural waves - sometimes layers overlap more, sometimes less
    const nextLayerDelay = (0.5 + Math.random() * 0.5) * duration * 1000;
    
    // Start this layer
    source.start(0);
    rainSources.push(source);
    
    // Schedule next layer before this one ends
    const scheduleTimeout = setTimeout(() => {
        if (isPlaying) {
            startRainLayer(); // Recursively start next layer
        }
    }, nextLayerDelay);
    
    // Clean up this source when it ends
    source.onended = () => {
        const index = rainSources.indexOf(source);
        if (index > -1) {
            rainSources.splice(index, 1);
        }
        try {
            source.disconnect();
        } catch(e) {}
    };
    
    // Store timeout so we can cancel it if needed
    source._scheduleTimeout = scheduleTimeout;
}

function stopRain() {
    // Stop all active rain sources
    rainSources.forEach(source => {
        try {
            source.stop();
            source.disconnect();
            if (source._scheduleTimeout) {
                clearTimeout(source._scheduleTimeout);
            }
        } catch(e) {}
    });
    rainSources = [];
}

// ==================== BIRDS FUNCTIONS ====================
function loadBirds() {
    fetch(BIRDS_SOUND)
        .then(res => res.arrayBuffer())
        .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
        .then(buffer => {
            birdsBuffer = buffer;
        })
        .catch(err => console.error('Birds audio failed:', err));
}

function playBirds() {
    if (birdsMuted) return;
    stopBirds();
    
    if (!birdsBuffer) return;
    
    birdsSource = audioCtx.createBufferSource();
    birdsSource.buffer = birdsBuffer;
    birdsSource.loop = true;
    birdsSource.connect(birdsGainNode);
    birdsSource.start(0);
    updateBirdsVolume();
}

function stopBirds() {
    if (birdsSource) {
        try {
            birdsSource.stop();
            birdsSource.disconnect();
        } catch(e) {}
        birdsSource = null;
    }
    if (birdsFadeInterval) {
        clearInterval(birdsFadeInterval);
        birdsFadeInterval = null;
    }
}

function updateBirdsVolume() {
    if (birdsMuted) {
        birdsGainNode.gain.value = 0;
        return;
    }
    
    const rainVolume = parseFloat(document.getElementById('rainVolume').value);
    const targetVolume = rainVolume < 0.5 ? (1 - rainVolume / 0.5) : 0;
    
    if (birdsFadeInterval) clearInterval(birdsFadeInterval);
    
    birdsFadeInterval = setInterval(() => {
        const current = birdsGainNode.gain.value;
        const diff = targetVolume - current;
        
        if (Math.abs(diff) < 0.02) {
            birdsGainNode.gain.value = targetVolume;
            clearInterval(birdsFadeInterval);
            birdsFadeInterval = null;
        } else {
            birdsGainNode.gain.value += diff * 0.1;
        }
    }, 30);
}

// ==================== THUNDER FUNCTIONS ====================
function playThunder() {
    let idx;
    do {
        idx = Math.floor(Math.random() * THUNDER_SOUNDS.length);
    } while (THUNDER_SOUNDS.length > 1 && idx === lastThunderIndex);
    lastThunderIndex = idx;
    
    // Show lightning effect on weather icon
    showLightningIcon();
    
    fetch(THUNDER_SOUNDS[idx])
        .then(res => res.arrayBuffer())
        .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
        .then(audioBuffer => {
            const source = audioCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(thunderGainNode);
            source.start(0);
        })
        .catch(err => console.error('Thunder audio failed:', err));
}

function scheduleThunder() {
    if (!isPlaying) return;
    
    const min = parseFloat(document.getElementById('thunderMin').value);
    const max = parseFloat(document.getElementById('thunderMax').value);
    const delay = min * 1000 + Math.random() * (max - min) * 1000;
    
    if (thunderTimeout) clearTimeout(thunderTimeout);
    
    thunderTimeout = setTimeout(() => {
        if (!isPlaying) return;
        playThunder();
        scheduleThunder();
    }, delay);
}

// ==================== MUSIC FUNCTIONS ====================
function playDefaultMusic() {
    // Resume AudioContext if suspended (required by browsers)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    if (!defaultMusicAudio) {
        defaultMusicAudio = new Audio(MUSIC_PATH);
        defaultMusicAudio.loop = true;
        
        const musicSource = audioCtx.createMediaElementSource(defaultMusicAudio);
        musicSource.connect(musicLowpassNode);
        musicLowpassNode.connect(musicDryGain).connect(analyser);
        musicLowpassNode.connect(musicReverbNode).connect(musicWetGain).connect(analyser);
        
        // Set initial volume from slider
        const musicVolumeSlider = document.getElementById('musicVolume');
        if (musicVolumeSlider) {
            defaultMusicAudio.volume = parseFloat(musicVolumeSlider.value) / 100;
        }
        
        // Add track position update listeners
        defaultMusicAudio.addEventListener('timeupdate', updateTrackPosition);
        defaultMusicAudio.addEventListener('loadedmetadata', updateTrackDuration);
    }
    
    defaultMusicAudio.play().catch(err => {
        console.error('Music playback failed:', err);
    });
    
    // Update button text
    const playPauseBtn = document.getElementById('musicPlayPauseBtn');
    if (playPauseBtn) playPauseBtn.textContent = '⏸ Pause';
    
    // Update current track display
    updateCurrentTrackDisplay();
}

function pauseDefaultMusic() {
    if (defaultMusicAudio) defaultMusicAudio.pause();
    
    // Update button text
    const playPauseBtn = document.getElementById('musicPlayPauseBtn');
    if (playPauseBtn) playPauseBtn.textContent = '▶ Play';
}

function stopDefaultMusic() {
    if (defaultMusicAudio) {
        defaultMusicAudio.pause();
        defaultMusicAudio.currentTime = 0;
    }
    
    // Update button text
    const playPauseBtn = document.getElementById('musicPlayPauseBtn');
    if (playPauseBtn) playPauseBtn.textContent = '▶ Play';
    
    // Update current track display
    updateCurrentTrackDisplay();
}

// ==================== USER PLAYLIST FUNCTIONS ====================
// Load playlist from IndexedDB
async function loadPlaylistFromStorage() {
    try {
        const tracks = await loadTracksFromDB();
        userPlaylist = tracks.map(track => ({
            id: track.id,
            name: track.name,
            url: URL.createObjectURL(track.blob),
            blob: track.blob
        }));
        renderPlaylist();
        updateCurrentTrackDisplay();
    } catch (e) {
        console.error('Failed to load playlist:', e);
    }
}

// Upload MP3 files
async function handleMusicUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type === 'audio/mpeg' || file.type === 'audio/mp3') {
            try {
                // Save to IndexedDB
                const id = await saveTrackToDB(file.name, file);
                
                // Add to playlist
                const url = URL.createObjectURL(file);
                userPlaylist.push({
                    id: id,
                    name: file.name,
                    url: url,
                    blob: file
                });
            } catch (e) {
                console.error('Failed to save track:', e);
            }
        }
    }
    
    renderPlaylist();
    
    // Auto-select first track if none selected
    if (currentTrackIndex === -1 && userPlaylist.length > 0) {
        loadTrack(0);
    }
}

// Render playlist UI
function renderPlaylist() {
    const container = document.getElementById('playlist-items');
    if (!container) return;
    
    container.innerHTML = '';
    
    userPlaylist.forEach((track, index) => {
        const item = document.createElement('div');
        item.className = 'playlist-item';
        if (index === currentTrackIndex) {
            item.classList.add('active');
        }
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'track-name';
        nameSpan.textContent = track.name;
        nameSpan.onclick = () => loadTrack(index);
        
        const controls = document.createElement('div');
        controls.className = 'track-controls';
        
        // Move up button
        if (index > 0) {
            const upBtn = document.createElement('button');
            upBtn.textContent = '▲';
            upBtn.className = 'track-btn';
            upBtn.onclick = (e) => {
                e.stopPropagation();
                moveTrack(index, -1);
            };
            controls.appendChild(upBtn);
        }
        
        // Move down button
        if (index < userPlaylist.length - 1) {
            const downBtn = document.createElement('button');
            downBtn.textContent = '▼';
            downBtn.className = 'track-btn';
            downBtn.onclick = (e) => {
                e.stopPropagation();
                moveTrack(index, 1);
            };
            controls.appendChild(downBtn);
        }
        
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '✕';
        deleteBtn.className = 'track-btn delete-btn';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteTrack(index);
        };
        controls.appendChild(deleteBtn);
        
        item.appendChild(nameSpan);
        item.appendChild(controls);
        container.appendChild(item);
    });
}

// Move track up or down in playlist
function moveTrack(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= userPlaylist.length) return;
    
    // Swap tracks
    const temp = userPlaylist[index];
    userPlaylist[index] = userPlaylist[newIndex];
    userPlaylist[newIndex] = temp;
    
    // Update current track index if needed
    if (currentTrackIndex === index) {
        currentTrackIndex = newIndex;
    } else if (currentTrackIndex === newIndex) {
        currentTrackIndex = index;
    }
    
    renderPlaylist();
}

// Delete track from playlist
async function deleteTrack(index) {
    const track = userPlaylist[index];
    
    // Revoke object URL to free memory
    if (track.url) {
        URL.revokeObjectURL(track.url);
    }
    
    // Delete from IndexedDB
    if (track.id) {
        try {
            await deleteTrackFromDB(track.id);
        } catch (e) {
            console.error('Failed to delete track from DB:', e);
        }
    }
    
    userPlaylist.splice(index, 1);
    
    // Update current track index
    if (currentTrackIndex === index) {
        stopUserMusic();
        currentTrackIndex = -1;
        updateCurrentTrackDisplay();
    } else if (currentTrackIndex > index) {
        currentTrackIndex--;
    }
    
    renderPlaylist();
}

// Clear entire playlist
async function clearPlaylist() {
    // Stop music if playing
    stopUserMusic();
    
    // Revoke all object URLs to free memory
    userPlaylist.forEach(track => {
        if (track.url) {
            URL.revokeObjectURL(track.url);
        }
    });
    
    // Clear from IndexedDB
    try {
        await clearTracksFromDB();
    } catch (e) {
        console.error('Failed to clear tracks from DB:', e);
    }
    
    // Clear playlist and reset state
    userPlaylist = [];
    currentTrackIndex = -1;
    
    // Update UI
    renderPlaylist();
    updateCurrentTrackDisplay();
}

// Load a track by index
function loadTrack(index) {
    if (index < 0 || index >= userPlaylist.length) return;
    
    const wasPlaying = userMusicAudio && !userMusicAudio.paused;
    
    stopUserMusic();
    currentTrackIndex = index;
    
    if (wasPlaying) {
        playUserMusic();
    }
    
    updateCurrentTrackDisplay();
    renderPlaylist();
}

// Play previous track
function playPrevTrack() {
    if (userPlaylist.length === 0) return;
    
    let newIndex = currentTrackIndex - 1;
    if (newIndex < 0) {
        newIndex = userPlaylist.length - 1; // Loop to end
    }
    
    loadTrack(newIndex);
    playUserMusic();
}

// Play next track
function playNextTrack() {
    if (userPlaylist.length === 0) return;
    
    let newIndex = currentTrackIndex + 1;
    if (newIndex >= userPlaylist.length) {
        newIndex = 0; // Loop to beginning
    }
    
    loadTrack(newIndex);
    playUserMusic();
}

// Update current track display
function updateCurrentTrackDisplay() {
    const display = document.getElementById('current-track-display');
    if (!display) return;
    
    if (currentTrackIndex >= 0 && currentTrackIndex < userPlaylist.length) {
        display.textContent = `🎵 ${userPlaylist[currentTrackIndex].name}`;
    } else if (defaultMusicAudio && !defaultMusicAudio.paused) {
        display.textContent = '🎵 Default Music';
    } else {
        display.textContent = 'No track loaded';
    }
}

// Play user music with full audio chain
function playUserMusic() {
    if (currentTrackIndex < 0 || currentTrackIndex >= userPlaylist.length) return;
    
    const track = userPlaylist[currentTrackIndex];
    if (!track.url) return;
    
    // Resume AudioContext if suspended
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    if (!userMusicAudio) {
        userMusicAudio = new Audio();
        
        const musicSource = audioCtx.createMediaElementSource(userMusicAudio);
        
        // Connect through EQ chain: source -> EQ bands -> lowpass -> reverb -> analyzer
        musicSource.connect(musicEQBass);
        musicEQBass.connect(musicEQMidBass);
        musicEQMidBass.connect(musicEQMid);
        musicEQMid.connect(musicEQMidTreble);
        musicEQMidTreble.connect(musicEQTreble);
        musicEQTreble.connect(musicLowpassNode);
        musicLowpassNode.connect(musicDryGain).connect(analyser);
        musicLowpassNode.connect(musicReverbNode).connect(musicWetGain).connect(analyser);
        
        // Set initial volume
        const musicVolumeSlider = document.getElementById('musicVolume');
        if (musicVolumeSlider) {
            userMusicAudio.volume = parseFloat(musicVolumeSlider.value) / 100;
        }
        
        // Auto-advance to next track when current ends
        userMusicAudio.addEventListener('ended', () => {
            playNextTrack();
        });
        
        // Update track position as song plays
        userMusicAudio.addEventListener('timeupdate', updateTrackPosition);
        userMusicAudio.addEventListener('loadedmetadata', updateTrackDuration);
    }
    
    // If audio is paused, just resume; otherwise load new track
    if (userMusicAudio.paused && userMusicAudio.src === track.url) {
        // Simply resume playback at current position
        userMusicAudio.play().catch(err => {
            console.error('Music playback failed:', err);
        });
    } else {
        // Load and play new track
        userMusicAudio.src = track.url;
        userMusicAudio.play().catch(err => {
            console.error('Music playback failed:', err);
        });
    }
    
    // Update button text
    const playPauseBtn = document.getElementById('musicPlayPauseBtn');
    if (playPauseBtn) playPauseBtn.textContent = '⏸ Pause';
}

// Pause user music
function pauseUserMusic() {
    if (userMusicAudio) {
        userMusicAudio.pause();
    }
    
    // Update button text
    const playPauseBtn = document.getElementById('musicPlayPauseBtn');
    if (playPauseBtn) playPauseBtn.textContent = '▶ Play';
}

// Stop user music
function stopUserMusic() {
    if (userMusicAudio) {
        userMusicAudio.pause();
        userMusicAudio.currentTime = 0;
    }
    
    // Update button text
    const playPauseBtn = document.getElementById('musicPlayPauseBtn');
    if (playPauseBtn) playPauseBtn.textContent = '▶ Play';
}

// ==================== TRACK POSITION FUNCTIONS ====================
function updateTrackPosition() {
    // Use whichever audio is currently active
    const activeAudio = (userMusicAudio && !userMusicAudio.paused) ? userMusicAudio : defaultMusicAudio;
    if (!activeAudio || !activeAudio.duration) return;
    
    const positionSlider = document.getElementById('trackPosition');
    const currentTimeDisplay = document.getElementById('currentTime');
    
    if (positionSlider && !positionSlider.dataset.seeking) {
        const percentage = (activeAudio.currentTime / activeAudio.duration) * 100;
        positionSlider.value = percentage;
    }
    
    if (currentTimeDisplay) {
        currentTimeDisplay.textContent = formatTime(activeAudio.currentTime);
    }
}

function updateTrackDuration() {
    // Use whichever audio is currently active
    const activeAudio = (userMusicAudio && userMusicAudio.src) ? userMusicAudio : defaultMusicAudio;
    if (!activeAudio || !activeAudio.duration) return;
    
    const totalTimeDisplay = document.getElementById('totalTime');
    if (totalTimeDisplay) {
        totalTimeDisplay.textContent = formatTime(activeAudio.duration);
    }
}

function formatTime(seconds) {
    if (isNaN(seconds) || seconds === Infinity) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function seekTrack(percentage) {
    // Use whichever audio is currently active
    const activeAudio = (userMusicAudio && !userMusicAudio.paused) ? userMusicAudio : defaultMusicAudio;
    if (!activeAudio || !activeAudio.duration) return;
    
    const newTime = (percentage / 100) * activeAudio.duration;
    activeAudio.currentTime = newTime;
}

// ==================== RADIO EQ PRESETS ====================
function applyRadioEQPreset(presetName) {
    const eqBassSlider = document.getElementById('eqBass');
    const eqMidBassSlider = document.getElementById('eqMidBass');
    const eqMidSlider = document.getElementById('eqMid');
    const eqMidTrebleSlider = document.getElementById('eqMidTreble');
    const eqTrebleSlider = document.getElementById('eqTreble');
    
    if (!eqBassSlider || !eqMidBassSlider || !eqMidSlider || !eqMidTrebleSlider || !eqTrebleSlider) return;
    
    // Different EQ curves for vintage radio sounds
    if (presetName === 'modern') {
        // Flat response
        eqBassSlider.value = 0;
        eqMidBassSlider.value = 0;
        eqMidSlider.value = 0;
        eqMidTrebleSlider.value = 0;
        eqTrebleSlider.value = 0;
        
    } else if (presetName === 'vintage') {
        // Vintage radio: boosted mids, rolled off bass and treble
        eqBassSlider.value = -8;
        eqMidBassSlider.value = 2;
        eqMidSlider.value = 6;
        eqMidTrebleSlider.value = 4;
        eqTrebleSlider.value = -6;
        
    } else if (presetName === 'am') {
        // AM radio: very limited frequency range, boxy sound
        eqBassSlider.value = -10;
        eqMidBassSlider.value = -2;
        eqMidSlider.value = 8;
        eqMidTrebleSlider.value = 2;
        eqTrebleSlider.value = -10;
        
    } else if (presetName === 'gramophone') {
        // Gramophone: heavily limited, nasal, lo-fi
        eqBassSlider.value = -12;
        eqMidBassSlider.value = -4;
        eqMidSlider.value = 10;
        eqMidTrebleSlider.value = 6;
        eqTrebleSlider.value = -12;
    }
    
    // Trigger input events to update audio nodes and labels
    eqBassSlider.dispatchEvent(new Event('input'));
    eqMidBassSlider.dispatchEvent(new Event('input'));
    eqMidSlider.dispatchEvent(new Event('input'));
    eqMidTrebleSlider.dispatchEvent(new Event('input'));
    eqTrebleSlider.dispatchEvent(new Event('input'));
}

// ==================== STORM CONTROL ====================
function startStorm(fromPreset = false) {
    if (isPlaying) return;
    
    // Resume AudioContext if suspended (required by browsers)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    const rainVolumeSlider = document.getElementById('rainVolume');
    
    // Only set rain volume to 50% on very first manual start (not from preset)
    if (!fromPreset && !hasStartedStormBefore) {
        rainVolumeSlider.value = 0.5;
        hasStartedStormBefore = true; // Mark that storm has been started
    }
    
    // Always restore rain gain from slider value (preserves user/preset settings)
    rainGainNode.gain.value = parseFloat(rainVolumeSlider.value);
    
    updateWeatherIcon();
    updateBirdsVolume();
    
    isPlaying = true;
    playRain();
    playBirds();
    
    // Play immediate thunder when storm starts (announces the storm)
    playThunder();
    
    // Then schedule regular thunder intervals
    scheduleThunder();
    
    const btn = document.getElementById('stormToggleBtn');
    btn.textContent = 'Stop Storm';
    btn.classList.remove('storm-start');
    btn.classList.add('storm-stop');
}

function stopStorm() {
    isPlaying = false;
    stopRain();
    stopBirds();
    
    if (thunderTimeout) {
        clearTimeout(thunderTimeout);
        thunderTimeout = null;
    }
    
    // Set rain audio to 0 without changing slider (preserves user setting)
    rainGainNode.gain.value = 0;
    updateWeatherIcon(); // Will show sun icon since isPlaying = false
    updateBirdsVolume();
    
    const btn = document.getElementById('stormToggleBtn');
    btn.textContent = 'Start Storm';
    btn.classList.remove('storm-stop');
    btn.classList.add('storm-start');
}

function toggleStorm() {
    if (isPlaying) {
        stopStorm();
    } else {
        startStorm();
    }
}

// ==================== RAIN EMOJI ANIMATION ====================
// Rain emoji animation removed - no longer needed

// ==================== DOM INITIALIZATION ====================
window.addEventListener('DOMContentLoaded', async () => {
    // Pre-load audio buffers (doesn't play yet)
    loadBirds();
    loadRainBuffer();
    
    // Initialize IndexedDB and load user playlist
    try {
        await initIndexedDB();
        await loadPlaylistFromStorage();
    } catch (e) {
        console.error('Failed to initialize music database:', e);
    }
    
    // Get weather icon element
    weatherIcon = document.getElementById('weather-icon');
    updateWeatherIcon();
    
    // Set up reverb nodes with corrected decay (all use same room size)
    const defaultRoomDecay = 2; // Default room size 1.0 * 2 = decay 2
    musicReverbNode.buffer = createImpulseResponse(2, defaultRoomDecay);
    rainReverbNode.buffer = createImpulseResponse(2, defaultRoomDecay);
    thunderReverbNode.buffer = createImpulseResponse(2, defaultRoomDecay);
    
    // Set initial reverb mix gains
    musicWetGain.gain.value = 0.3;
    musicDryGain.gain.value = 0.7;
    rainWetGain.gain.value = 0;
    rainDryGain.gain.value = 1;
    thunderWetGain.gain.value = 0;
    thunderDryGain.gain.value = 1;
    
    // Initialize UI elements
    const stormToggleBtn = document.getElementById('stormToggleBtn');
    stormToggleBtn.classList.add('storm-start');
    stormToggleBtn.addEventListener('click', toggleStorm);
    
    // ===== SET DEFAULT VALUES TO OUTDOOR PRESET =====
    const rainVolumeSlider = document.getElementById('rainVolume');
    const thunderVolumeSlider = document.getElementById('thunderVolume');
    const lowpassFilterSlider = document.getElementById('lowpassFilter');
    const musicVolumeSlider = document.getElementById('musicVolume');
    const musicLowpassSlider = document.getElementById('musicLowpass');
    const musicRoomSizeSlider = document.getElementById('musicRoomSize');
    const musicReverbSlider = document.getElementById('musicReverb');
    const rainReverbSlider = document.getElementById('rainReverb');
    const thunderReverbSlider = document.getElementById('thunderReverb');
    
    // Apply Outdoor preset defaults
    rainVolumeSlider.value = 0;
    thunderVolumeSlider.value = 1;
    lowpassFilterSlider.value = 22050;
    musicVolumeSlider.value = 100;
    musicLowpassSlider.value = 22050;
    musicRoomSizeSlider.value = 0.02;
    musicReverbSlider.value = 0;
    rainReverbSlider.value = 0;
    thunderReverbSlider.value = 0;
    
    // Set initial gain nodes from Outdoor preset values
    rainGainNode.gain.value = 0;
    thunderGainNode.gain.value = 1;
    lowpassFilterNode.frequency.value = 22050;
    musicLowpassNode.frequency.value = 22050;
    
    // Update room size reverb for all reverb nodes
    const roomDecay = 0.02 * 2;
    musicReverbNode.buffer = createImpulseResponse(2, roomDecay);
    rainReverbNode.buffer = createImpulseResponse(2, roomDecay);
    thunderReverbNode.buffer = createImpulseResponse(2, roomDecay);
    
    // Update reverb mix
    musicWetGain.gain.value = 0;
    musicDryGain.gain.value = 1;
    rainWetGain.gain.value = 0;
    rainDryGain.gain.value = 1;
    thunderWetGain.gain.value = 0;
    thunderDryGain.gain.value = 1;
    
    // Update all labels to match Outdoor preset
    document.getElementById('lowpassLabel').textContent = '22050 Hz';
    document.getElementById('musicLowpassLabel').textContent = '22050 Hz';
    document.getElementById('musicRoomSizeLabel').textContent = '0.02';
    document.getElementById('musicReverbLabel').textContent = '0.00';
    document.getElementById('rainReverbLabel').textContent = '0.00';
    document.getElementById('thunderReverbLabel').textContent = '0.00';
    document.getElementById('frequencyLabel').textContent = '5-60s';
    
    // ===== WEATHER PRESET BUTTONS =====
    const presetIndoorCozyBtn = document.getElementById('presetIndoorCozy');
    const presetIndoorBtn = document.getElementById('presetIndoor');
    const presetOutdoorBtn = document.getElementById('presetOutdoor');
    
    if (presetIndoorCozyBtn) {
        presetIndoorCozyBtn.addEventListener('click', () => applyPreset('indoorcozy'));
    }
    if (presetIndoorBtn) {
        presetIndoorBtn.addEventListener('click', () => applyPreset('indoor'));
    }
    if (presetOutdoorBtn) {
        presetOutdoorBtn.addEventListener('click', () => applyPreset('outdoor'));
    }
    
    // ===== RAIN VOLUME =====
    
    rainVolumeSlider.addEventListener('input', () => {
        rainGainNode.gain.value = parseFloat(rainVolumeSlider.value);
        updateBirdsVolume();
        updateWeatherIcon();
    });
    
    // ===== THUNDER VOLUME =====
    
    thunderVolumeSlider.addEventListener('input', () => {
        thunderGainNode.gain.value = parseFloat(thunderVolumeSlider.value);
    });
    
    const thunderMinSlider = document.getElementById('thunderMin');
    const thunderMaxSlider = document.getElementById('thunderMax');
    const frequencyLabel = document.getElementById('frequencyLabel');
    
    function updateFrequencyLabel() {
        const min = thunderMinSlider.value;
        const max = thunderMaxSlider.value;
        frequencyLabel.textContent = `${min}-${max}s`;
        
        if (isPlaying && thunderTimeout) {
            clearTimeout(thunderTimeout);
            scheduleThunder();
        }
    }
    
    thunderMinSlider.addEventListener('input', updateFrequencyLabel);
    thunderMaxSlider.addEventListener('input', updateFrequencyLabel);
    
    const lowpassLabel = document.getElementById('lowpassLabel');
    
    lowpassFilterSlider.addEventListener('input', () => {
        const cutoff = parseFloat(lowpassFilterSlider.value);
        lowpassLabel.textContent = cutoff + ' Hz';
        lowpassFilterNode.frequency.value = cutoff;
        
        const min = parseFloat(lowpassFilterSlider.min);
        const max = parseFloat(lowpassFilterSlider.max);
        const boost = 8 * (1 - (cutoff - min) / (max - min));
        rainEQNode.gain.value = boost;
    });
    
    const birdsMuteBtn = document.getElementById('birdsMuteBtn');
    
    function updateBirdsMuteBtn() {
        if (birdsMuted) {
            birdsMuteBtn.textContent = 'Unmute Birds';
            birdsMuteBtn.style.background = '#c0392b';
        } else {
            birdsMuteBtn.textContent = 'Mute Birds';
            birdsMuteBtn.style.background = '#27ae60';
        }
    }
    
    birdsMuteBtn.addEventListener('click', () => {
        birdsMuted = !birdsMuted;
        
        if (birdsMuted) {
            stopBirds();
        } else if (isPlaying) {
            playBirds();
        }
        
        updateBirdsMuteBtn();
    });
    
    updateBirdsMuteBtn();
    
    // ===== MUSIC PLAYBACK CONTROLS =====
    const musicPlayPauseBtn = document.getElementById('musicPlayPauseBtn');
    const musicStopBtn = document.getElementById('musicStopBtn');
    const musicPrevBtn = document.getElementById('musicPrevBtn');
    const musicNextBtn = document.getElementById('musicNextBtn');
    
    // Combined Play/Pause button
    musicPlayPauseBtn.addEventListener('click', () => {
        // Check if user music is playing
        const isUserMusicPlaying = userMusicAudio && !userMusicAudio.paused;
        // Check if default music is playing
        const isDefaultMusicPlaying = defaultMusicAudio && !defaultMusicAudio.paused;
        
        if (isUserMusicPlaying || isDefaultMusicPlaying) {
            // If any music is playing, pause it
            if (isUserMusicPlaying) {
                pauseUserMusic();
            } else {
                pauseDefaultMusic();
            }
            musicPlayPauseBtn.textContent = '▶ Play';
        } else {
            // If music is paused/stopped, play it
            // Stop default music if it's playing
            if (defaultMusicAudio && !defaultMusicAudio.paused) {
                stopDefaultMusic();
            }
            
            // If user has playlist, use that; otherwise fall back to default
            if (userPlaylist.length > 0) {
                playUserMusic();
            } else {
                playDefaultMusic(); // Fallback to default if no playlist
            }
            musicPlayPauseBtn.textContent = '⏸ Pause';
        }
    });
    
    musicStopBtn.addEventListener('click', () => {
        if (userPlaylist.length > 0 && userMusicAudio) {
            stopUserMusic();
        } else {
            stopDefaultMusic();
        }
        musicPlayPauseBtn.textContent = '▶ Play';
    });
    
    if (musicPrevBtn) {
        musicPrevBtn.addEventListener('click', playPrevTrack);
    }
    
    if (musicNextBtn) {
        musicNextBtn.addEventListener('click', playNextTrack);
    }
    
    // ===== TRACK POSITION SLIDER =====
    const trackPositionSlider = document.getElementById('trackPosition');
    
    if (trackPositionSlider) {
        // When user starts dragging
        trackPositionSlider.addEventListener('mousedown', () => {
            trackPositionSlider.dataset.seeking = 'true';
        });
        
        // When user stops dragging
        trackPositionSlider.addEventListener('mouseup', () => {
            seekTrack(parseFloat(trackPositionSlider.value));
            delete trackPositionSlider.dataset.seeking;
        });
        
        // For touch devices
        trackPositionSlider.addEventListener('touchstart', () => {
            trackPositionSlider.dataset.seeking = 'true';
        });
        
        trackPositionSlider.addEventListener('touchend', () => {
            seekTrack(parseFloat(trackPositionSlider.value));
            delete trackPositionSlider.dataset.seeking;
        });
        
        // Allow seeking by clicking anywhere on the slider
        trackPositionSlider.addEventListener('click', () => {
            seekTrack(parseFloat(trackPositionSlider.value));
        });
    }
    
    // ===== MUSIC UPLOAD & PLAYLIST =====
    const uploadMusicBtn = document.getElementById('uploadMusicBtn');
    const musicUploadInput = document.getElementById('musicUpload');
    const clearPlaylistBtn = document.getElementById('clearPlaylistBtn');
    
    if (uploadMusicBtn && musicUploadInput) {
        uploadMusicBtn.addEventListener('click', () => {
            musicUploadInput.click();
        });
        
        musicUploadInput.addEventListener('change', handleMusicUpload);
    }
    
    if (clearPlaylistBtn) {
        clearPlaylistBtn.addEventListener('click', () => {
            if (confirm('Clear all tracks from playlist?')) {
                clearPlaylist();
            }
        });
    }
    
    // ===== RADIO EQ CONTROLS =====
    const eqBassSlider = document.getElementById('eqBass');
    const eqMidBassSlider = document.getElementById('eqMidBass');
    const eqMidSlider = document.getElementById('eqMid');
    const eqMidTrebleSlider = document.getElementById('eqMidTreble');
    const eqTrebleSlider = document.getElementById('eqTreble');
    
    const eqBassLabel = document.getElementById('eqBassLabel');
    const eqMidBassLabel = document.getElementById('eqMidBassLabel');
    const eqMidLabel = document.getElementById('eqMidLabel');
    const eqMidTrebleLabel = document.getElementById('eqMidTrebleLabel');
    const eqTrebleLabel = document.getElementById('eqTrebleLabel');
    
    if (eqBassSlider) {
        eqBassSlider.addEventListener('input', () => {
            const gain = parseFloat(eqBassSlider.value);
            musicEQBass.gain.value = gain;
            if (eqBassLabel) eqBassLabel.textContent = gain.toFixed(1) + ' dB';
        });
    }
    
    if (eqMidBassSlider) {
        eqMidBassSlider.addEventListener('input', () => {
            const gain = parseFloat(eqMidBassSlider.value);
            musicEQMidBass.gain.value = gain;
            if (eqMidBassLabel) eqMidBassLabel.textContent = gain.toFixed(1) + ' dB';
        });
    }
    
    if (eqMidSlider) {
        eqMidSlider.addEventListener('input', () => {
            const gain = parseFloat(eqMidSlider.value);
            musicEQMid.gain.value = gain;
            if (eqMidLabel) eqMidLabel.textContent = gain.toFixed(1) + ' dB';
        });
    }
    
    if (eqMidTrebleSlider) {
        eqMidTrebleSlider.addEventListener('input', () => {
            const gain = parseFloat(eqMidTrebleSlider.value);
            musicEQMidTreble.gain.value = gain;
            if (eqMidTrebleLabel) eqMidTrebleLabel.textContent = gain.toFixed(1) + ' dB';
        });
    }
    
    if (eqTrebleSlider) {
        eqTrebleSlider.addEventListener('input', () => {
            const gain = parseFloat(eqTrebleSlider.value);
            musicEQTreble.gain.value = gain;
            if (eqTrebleLabel) eqTrebleLabel.textContent = gain.toFixed(1) + ' dB';
        });
    }
    
    // Initialize EQ labels on page load
    if (eqBassLabel) eqBassLabel.textContent = '0.0 dB';
    if (eqMidBassLabel) eqMidBassLabel.textContent = '0.0 dB';
    if (eqMidLabel) eqMidLabel.textContent = '0.0 dB';
    if (eqMidTrebleLabel) eqMidTrebleLabel.textContent = '0.0 dB';
    if (eqTrebleLabel) eqTrebleLabel.textContent = '0.0 dB';
    
    // ===== RADIO EQ PRESETS =====
    const radioPresetBtns = document.querySelectorAll('.radio-preset-btn');
    radioPresetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.getAttribute('data-preset');
            applyRadioEQPreset(preset);
        });
    });
    
    musicVolumeSlider.addEventListener('input', () => {
        if (userMusicAudio) {
            userMusicAudio.volume = parseFloat(musicVolumeSlider.value) / 100;
        }
        if (defaultMusicAudio) {
            defaultMusicAudio.volume = parseFloat(musicVolumeSlider.value) / 100;
        }
    });
    
    const musicLowpassLabel = document.getElementById('musicLowpassLabel');
    
    musicLowpassSlider.addEventListener('input', () => {
        const cutoff = parseFloat(musicLowpassSlider.value);
        musicLowpassLabel.textContent = cutoff + ' Hz';
        musicLowpassNode.frequency.value = cutoff;
    });
    
    const musicReverbLabel = document.getElementById('musicReverbLabel');
    
    musicReverbSlider.addEventListener('input', () => {
        const mix = parseFloat(musicReverbSlider.value);
        musicWetGain.gain.value = mix;
        musicDryGain.gain.value = 1 - mix;
        musicReverbLabel.textContent = mix.toFixed(2);
    });
    
    const rainReverbLabel = document.getElementById('rainReverbLabel');
    
    rainReverbSlider.addEventListener('input', () => {
        const mix = parseFloat(rainReverbSlider.value);
        rainWetGain.gain.value = mix;
        rainDryGain.gain.value = 1 - mix;
        rainReverbLabel.textContent = mix.toFixed(2);
    });
    
    const thunderReverbLabel = document.getElementById('thunderReverbLabel');
    
    thunderReverbSlider.addEventListener('input', () => {
        const mix = parseFloat(thunderReverbSlider.value);
        thunderWetGain.gain.value = mix;
        thunderDryGain.gain.value = 1 - mix;
        thunderReverbLabel.textContent = mix.toFixed(2);
    });
    
    const musicRoomSizeLabel = document.getElementById('musicRoomSizeLabel');
    
    musicRoomSizeSlider.addEventListener('input', () => {
        const sliderValue = parseFloat(musicRoomSizeSlider.value);
        
        // Invert the decay calculation so:
        // Low slider value (0.1) = small room = short reverb (low decay like 0.5)
        // High slider value (2.0) = large room = long reverb (high decay like 4)
        // Formula: decay = sliderValue * 2 (ranges from 0.2 to 4.0)
        const decay = sliderValue * 2;
        
        // Update all reverb nodes to use the same room size
        musicReverbNode.buffer = createImpulseResponse(2, decay);
        rainReverbNode.buffer = createImpulseResponse(2, decay);
        thunderReverbNode.buffer = createImpulseResponse(2, decay);
        thunderReverbLabel.textContent = mix.toFixed(2);
    });
    
    const stormIcon = weatherIcon; // Use weather icon for click interaction
    if (stormIcon) {
        stormIcon.style.cursor = 'pointer';
        stormIcon.addEventListener('click', () => {
            // Resume AudioContext on user interaction
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            playThunder();
        });
    }
    
    const detailsPanels = document.querySelectorAll('.controls details');
    detailsPanels.forEach((panel, idx) => {
        const key = 'stormgen_panel_' + idx;
        const saved = localStorage.getItem(key);
        
        if (saved === 'closed') {
            panel.open = false;
        }
        
        panel.addEventListener('toggle', () => {
            localStorage.setItem(key, panel.open ? 'open' : 'closed');
        });
    });
});

// ==================== WAVEFORM VISUALIZER ====================
const canvas = document.getElementById('waveform');
const canvasCtx = canvas.getContext('2d');

// Use the analyzer already created at the top
const bufferLength = analyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);

function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function drawWaveform() {
    requestAnimationFrame(drawWaveform);
    
    analyser.getByteTimeDomainData(dataArray);
    
    canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid lines
    canvasCtx.strokeStyle = 'rgba(0, 255, 65, 0.1)';
    canvasCtx.lineWidth = 1;
    
    // Horizontal center line
    canvasCtx.beginPath();
    canvasCtx.moveTo(0, canvas.height / 2);
    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
    
    // Waveform
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = '#00ff41';
    canvasCtx.shadowBlur = 10;
    canvasCtx.shadowColor = '#00ff41';
    
    canvasCtx.beginPath();
    
    const sliceWidth = canvas.width / bufferLength;
    let x = 0;
    
    // Amplify the waveform by 3x for more dramatic visualization
    const amplification = 3;
    
    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = ((v - 1) * amplification + 1) * canvas.height / 2;
        
        if (i === 0) {
            canvasCtx.moveTo(x, y);
        } else {
            canvasCtx.lineTo(x, y);
        }
        
        x += sliceWidth;
    }
    
    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
    
    canvasCtx.shadowBlur = 0;
}

// Start the visualizer
drawWaveform();
